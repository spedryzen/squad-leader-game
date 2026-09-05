// Squad Leader: Vietnam - Tension & Ambush Encounter System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: AmbushSystem.js
Purpose: Generates suspenseful multi-stage encounter sequences ("Movement detected..." -> tension building -> outcome resolution) factoring heat, intel, terrain, weather, and enemy strategy.
Responsibilities:
- Manage 4 distinct encounter outcomes:
  * False Alarm: Rustling foliage, wildlife, or wind (relieves tension, slight stress reduction).
  * Tripwire: Concealed grenade / bamboo stake booby trap (injury or supplies loss).
  * RPG Attack: Sudden B-40 rocket blast striking cover (heavy danger, casualty/suppression).
  * Sniper Fire: High-velocity shot from canopy (pins squad, forces counter-fire).
- Calculate dynamic weighted probabilities based on 5 battlefield factors:
  * Heat: Higher heat dramatically increases hostile ambush probability.
  * Intel: Higher intel (from IntelSystem) reduces surprise chance and increases detection/evasion.
  * Terrain: Jungle/ridge/elephant grass increases ambush odds; clearings/bunkers reduce concealment.
  * Weather: Fog and rain increase ambush chance; clear weather aids spotting.
  * Enemy Strategy: Ambush and Hunt strategies boost hostile outcomes.
- Publish encounter lifecycle events: AMBUSH_WARNING, AMBUSH_TRIGGERED, AMBUSH_EVADED, TENSION_RESOLVED.
- Subscribe to game lifecycle events: SCENE_RENDERED, CHOICE_MADE, WEATHER_CHANGED, ENEMY_STRATEGY_CHANGED, GAME_LOADED.
- Maintain full state inspection, active tension tracking, and save game persistence.
Dependencies: MessageBus.js, optional Ledger.js, IntelSystem.js, WeatherSystem.js, EnemyCommander.js
Published Events:
- AMBUSH_WARNING: Dispatched when suspenseful movement or audio cues are first detected.
- AMBUSH_TRIGGERED: Dispatched when a hostile booby trap, rocket strike, or sniper springs.
- AMBUSH_EVADED: Dispatched when the squad spots, disarms, or dodges the incoming threat.
- TENSION_RESOLVED: Dispatched when the encounter sequence concludes and tension resets.
Subscribed Events:
- SCENE_RENDERED: Evaluates tactical terrain context and potential for emergent ambushes.
- CHOICE_MADE: Evaluates player tactical reactions (take cover, spotter, recon fire, charge).
- WEATHER_CHANGED: Updates active weather modifier context for ambush probability.
- ENEMY_STRATEGY_CHANGED: Adjusts ambush frequency when enemy shifts to Ambush or Hunt.
- GAME_LOADED: Restores serialized active tension state and encounter history.
Future Expansion Notes: Claymore perimeter tripwires, tracker dog early-bark warnings, and tunnel entrance counter-ambushes.
--------------------------------------------------
*/

/**
 * Standard encounter outcomes for tension and ambush sequences.
 */
export const AMBUSH_OUTCOMES = {
  FALSE_ALARM: 'False Alarm',
  TRIPWIRE: 'Tripwire',
  RPG_ATTACK: 'RPG Attack',
  SNIPER_FIRE: 'Sniper Fire'
};

/**
 * Detailed profiles and effects for all encounter outcomes.
 */
export const AMBUSH_OUTCOME_DEFINITIONS = {
  [AMBUSH_OUTCOMES.FALSE_ALARM]: {
    key: AMBUSH_OUTCOMES.FALSE_ALARM,
    type: 'benign',
    title: 'False Alarm (Wilderness Disturbance)',
    description: 'Rustling foliage and snapping branches turn out to be wild birds or wind in the bamboo. Tension eases.',
    stressDelta: -5,
    suppliesDelta: 0,
    casualtyRisk: 0,
    isHostile: false
  },
  [AMBUSH_OUTCOMES.TRIPWIRE]: {
    key: AMBUSH_OUTCOMES.TRIPWIRE,
    type: 'trap',
    title: 'Concealed Tripwire Booby Trap',
    description: 'Taut rusty wire concealed beneath damp leaves triggers a concealed Chinese fragmentation grenade or bamboo punji stake trap.',
    stressDelta: 15,
    suppliesDelta: -10,
    casualtyRisk: 0.45,
    isHostile: true
  },
  [AMBUSH_OUTCOMES.RPG_ATTACK]: {
    key: AMBUSH_OUTCOMES.RPG_ATTACK,
    type: 'attack',
    title: 'B-40 Rocket Blast Strike',
    description: 'A sudden deafening whoosh of a B-40 rocket-propelled grenade detonates against an adjacent tree trunk, spraying lethal shrapnel.',
    stressDelta: 25,
    suppliesDelta: -15,
    casualtyRisk: 0.70,
    isHostile: true
  },
  [AMBUSH_OUTCOMES.SNIPER_FIRE]: {
    key: AMBUSH_OUTCOMES.SNIPER_FIRE,
    type: 'sniper',
    title: 'Canopy Sniper Fire',
    description: 'A high-velocity 7.62mm crack from an unseen marksman concealed in the ironwood canopy pins the squad in the mud.',
    stressDelta: 20,
    suppliesDelta: -5,
    casualtyRisk: 0.55,
    isHostile: true
  }
};

/**
 * AmbushSystem manages procedural multi-stage suspense sequences and ambush resolution.
 */
export class AmbushSystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [systems={}] - Related systems: { ledger, intelSystem, weatherSystem, enemyCommander }.
   */
  constructor(messageBus, systems = {}) {
    this.messageBus = messageBus || null;
    this.ledger = systems.ledger || null;
    this.intelSystem = systems.intelSystem || null;
    this.weatherSystem = systems.weatherSystem || null;
    this.enemyCommander = systems.enemyCommander || null;

    // Active multi-stage suspense encounter state
    /** @type {object|null} */
    this.activeTension = null;

    // History of all encounters generated during the campaign
    this.encounterHistory = [];

    // Current cached weather condition and enemy strategy
    this.currentWeather = 'Clear';
    this.currentEnemyStrategy = 'Recon';

    this._setupSubscriptions();
  }

  /**
   * Register event listeners on the central MessageBus.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. Scene navigation: check for dynamic suspense encounters
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      this._handleSceneRendered(payload);
    });

    // 2. Choice made: check player reactions to active warnings
    this.messageBus.subscribe('CHOICE_MADE', (choice) => {
      this._handleChoiceMade(choice);
    });

    // 3. Weather changes
    this.messageBus.subscribe('WEATHER_CHANGED', (payload) => {
      if (payload && (payload.type || payload.weather)) {
        this.currentWeather = payload.type || payload.weather;
      }
    });

    // 4. Enemy strategy changes
    this.messageBus.subscribe('ENEMY_STRATEGY_CHANGED', (payload) => {
      if (payload && payload.newStrategy) {
        this.currentEnemyStrategy = payload.newStrategy;
      }
    });

    // 5. Restore serialized state
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.ambush || payload.ambushSystem)) {
        this.deserialize(payload.ambush || payload.ambushSystem);
      }
    });
  }

  /**
   * Evaluates overall ambush probability risk and outcome weights based on 5 factors:
   * Heat, Intel, Terrain, Weather, and Enemy Strategy.
   *
   * @param {object} [context={}] - Contextual overrides (location, terrain, weather, heat, intel).
   * @returns {object} Comprehensive risk assessment and weighted probabilities.
   */
  evaluateAmbushRisk(context = {}) {
    const heat = typeof context.heat === 'number'
      ? context.heat
      : (this.ledger?.getStat ? this.ledger.getStat('heat') : (this.ledger?.heat || 0));

    const intelScore = typeof context.intel === 'number'
      ? context.intel
      : (this.ledger?.getStat ? this.ledger.getStat('intel') : (this.ledger?.intel || 0));

    const terrain = String(context.terrain || context.location || 'jungle').toLowerCase();
    const weather = String(context.weather || this.currentWeather || 'Clear');
    const strategy = String(context.enemyStrategy || this.currentEnemyStrategy || 'Recon');

    // 1. Base Risk
    let risk = 20;

    // 2. Heat Factor: Higher heat dramatically increases hostile ambush probability (+0% to +35%)
    const heatFactor = Math.min(35, Math.round((heat / 100) * 35));
    risk += heatFactor;

    // 3. Intel Factor: Higher intel reduces surprise chance and increases early detection (-0% to -35%)
    let intelReduction = 0;
    if (this.intelSystem && typeof this.intelSystem.getAmbushProbabilityModifier === 'function') {
      intelReduction = Math.abs(this.intelSystem.getAmbushProbabilityModifier());
    } else {
      if (intelScore >= 60) intelReduction = 35;
      else if (intelScore >= 25) intelReduction = 15;
      else intelReduction = 0;
    }
    risk -= intelReduction;

    // 4. Terrain Factor: Jungle/ridge/elephant grass increases odds; clearings/bunkers reduce concealment
    let terrainFactor = 0;
    if (
      terrain.includes('jungle') ||
      terrain.includes('ridge') ||
      terrain.includes('elephant grass') ||
      terrain.includes('bamboo') ||
      terrain.includes('creek') ||
      terrain.includes('trail')
    ) {
      terrainFactor = 20;
    } else if (
      terrain.includes('clearing') ||
      terrain.includes('bunker') ||
      terrain.includes('firebase') ||
      terrain.includes('perimeter') ||
      terrain.includes('road')
    ) {
      terrainFactor = -15;
    }
    risk += terrainFactor;

    // 5. Weather Factor: Fog and rain increase ambush chance; clear weather aids spotting
    let weatherFactor = 0;
    if (weather === 'Fog') {
      weatherFactor = 25;
    } else if (weather === 'Rain' || weather === 'Heavy Rain' || weather === 'Monsoon') {
      weatherFactor = 15;
    } else if (weather === 'Clear') {
      weatherFactor = -10;
    }
    risk += weatherFactor;

    // 6. Enemy Strategy Factor: 'Ambush' and 'Hunt' boost hostile outcomes
    let strategyFactor = 0;
    if (strategy === 'Ambush') {
      strategyFactor = 30;
    } else if (strategy === 'Hunt') {
      strategyFactor = 25;
    } else if (strategy === 'Full Assault') {
      strategyFactor = 20;
    } else if (strategy === 'Harassment') {
      strategyFactor = 10;
    }
    risk += strategyFactor;

    // Clamp effective risk between 5% and 95%
    const riskPercentage = Math.max(5, Math.min(95, risk));

    // Dynamic Outcome Weights
    // High heat/aggression boosts hostile attacks; High intel boosts False Alarm / detection
    let wFalseAlarm = Math.max(5, Math.round(40 + (intelReduction * 0.8) - (heatFactor * 0.6)));
    let wTripwire = Math.max(10, Math.round(25 + (terrainFactor > 0 ? 10 : 0)));
    let wRpg = Math.max(10, Math.round(20 + (heatFactor * 0.7) + (strategy === 'Hunt' || strategy === 'Full Assault' ? 15 : 0)));
    let wSniper = Math.max(10, Math.round(15 + (terrain.includes('ridge') || terrain.includes('canopy') ? 15 : 0) + (strategy === 'Ambush' ? 10 : 0)));

    const totalWeight = wFalseAlarm + wTripwire + wRpg + wSniper;

    return {
      riskPercentage,
      factors: {
        heat,
        heatFactor,
        intelScore,
        intelReduction,
        terrain,
        terrainFactor,
        weather,
        weatherFactor,
        strategy,
        strategyFactor
      },
      outcomeWeights: {
        [AMBUSH_OUTCOMES.FALSE_ALARM]: Math.round((wFalseAlarm / totalWeight) * 100),
        [AMBUSH_OUTCOMES.TRIPWIRE]: Math.round((wTripwire / totalWeight) * 100),
        [AMBUSH_OUTCOMES.RPG_ATTACK]: Math.round((wRpg / totalWeight) * 100),
        [AMBUSH_OUTCOMES.SNIPER_FIRE]: Math.round((wSniper / totalWeight) * 100)
      }
    };
  }

  /**
   * Initiates a multi-stage suspense encounter sequence.
   * If an ambush triggers, enters 'warning' stage, sets active tension, and publishes AMBUSH_WARNING.
   *
   * @param {object} [context={}] - Contextual parameters.
   * @param {boolean} [context.forceTrigger=false] - Force trigger an encounter (useful for scripted events).
   * @param {string} [context.forceOutcome=null] - Pre-selected outcome.
   * @returns {object|null} Active tension state if triggered, or null.
   */
  rollAmbushSequence(context = {}) {
    const evaluation = this.evaluateAmbushRisk(context);
    const shouldTrigger = context.forceTrigger || (Math.random() * 100 < evaluation.riskPercentage);

    if (!shouldTrigger) {
      return null;
    }

    // Determine projected outcome based on weights
    let projectedOutcome = context.forceOutcome || null;
    if (!projectedOutcome) {
      const roll = Math.random() * 100;
      let cumulative = 0;
      for (const [outcomeKey, weight] of Object.entries(evaluation.outcomeWeights)) {
        cumulative += weight;
        if (roll <= cumulative) {
          projectedOutcome = outcomeKey;
          break;
        }
      }
    }
    if (!projectedOutcome) projectedOutcome = AMBUSH_OUTCOMES.FALSE_ALARM;

    // Atmospheric cues
    const cues = {
      [AMBUSH_OUTCOMES.FALSE_ALARM]: 'Sudden rustle in the dense elephant grass off the trail flank. Foliage trembling violently.',
      [AMBUSH_OUTCOMES.TRIPWIRE]: 'A subtle metallic glint of a taut tripwire low along the bamboo roots. Bamboo stakes freshly cut nearby.',
      [AMBUSH_OUTCOMES.RPG_ATTACK]: 'Muffled click of a weapon safety and a sharp metallic clang 40 meters up the slope.',
      [AMBUSH_OUTCOMES.SNIPER_FIRE]: 'Dead jungle silence. The cicadas and birds have abruptly ceased calling in the canopy above.'
    };

    const tensionId = `tension_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const cueText = cues[projectedOutcome] || 'Movement detected in the treeline ahead.';

    this.activeTension = {
      id: tensionId,
      stage: 'warning',
      suspenseLevel: evaluation.riskPercentage,
      cue: cueText,
      probableThreat: projectedOutcome,
      projectedOutcome,
      evaluation,
      context,
      timestamp: new Date().toISOString()
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('AMBUSH_WARNING', {
        tensionId,
        stage: 'warning',
        cue: cueText,
        suspenseLevel: this.activeTension.suspenseLevel,
        probableThreat: projectedOutcome,
        location: context.location || 'Unknown Grid',
        context
      });
    }

    return this.activeTension;
  }

  /**
   * Resolves an active suspense sequence with an outcome and optional player reaction.
   *
   * @param {string} [outcomeKey=null] - Explicit outcome or defaults to projectedOutcome.
   * @param {object} [playerReaction={}] - Player reaction ('take_cover', 'recon_fire', 'spotter', 'rush', 'ignore').
   * @returns {object} Full encounter resolution record.
   */
  resolveAmbush(outcomeKey = null, playerReaction = {}) {
    const key = outcomeKey || this.activeTension?.projectedOutcome || AMBUSH_OUTCOMES.FALSE_ALARM;
    const def = AMBUSH_OUTCOME_DEFINITIONS[key] || AMBUSH_OUTCOME_DEFINITIONS[AMBUSH_OUTCOMES.FALSE_ALARM];
    const tensionId = this.activeTension?.id || `tension_instant_${Date.now()}`;
    const location = this.activeTension?.context?.location || playerReaction.location || 'Tactical Grid';

    const reactionAction = (playerReaction.action || '').toLowerCase();
    const isCautiousReaction = (
      reactionAction.includes('cover') ||
      reactionAction.includes('spot') ||
      reactionAction.includes('scout') ||
      reactionAction.includes('recon') ||
      reactionAction.includes('halt') ||
      reactionAction.includes('freeze')
    );

    // Evasion evaluation:
    // Intel bonus + smart player reaction can evade or disarm hostile threats
    let wasEvaded = false;
    let evasionNarrative = '';

    if (key === AMBUSH_OUTCOMES.FALSE_ALARM) {
      wasEvaded = true;
      evasionNarrative = 'The rustling passes—it was jungle wildlife spooked by your patrol. Squad breathes a collective sigh of relief.';
    } else {
      const intelBonus = (this.ledger?.getStat ? this.ledger.getStat('intel') : 0) * 0.4;
      const reactionBonus = isCautiousReaction ? 40 : 0;
      const evasionScore = (playerReaction.evasionRoll !== undefined ? playerReaction.evasionRoll : (Math.random() * 100)) + intelBonus + reactionBonus;

      if (evasionScore >= 70 || playerReaction.forceEvade) {
        wasEvaded = true;
        if (key === AMBUSH_OUTCOMES.TRIPWIRE) {
          evasionNarrative = 'Point man halts in his tracks, spotting the taut wire. Doc Baker and Duke gingerly disarm the Chinese grenade trap.';
        } else if (key === AMBUSH_OUTCOMES.RPG_ATTACK) {
          evasionNarrative = 'Alert squad members dive behind a granite outcrop just as the B-40 warhead shrieks overhead, bursting harmlessly in the rocks.';
        } else if (key === AMBUSH_OUTCOMES.SNIPER_FIRE) {
          evasionNarrative = 'Point man ducks under an ironwood trunk. The sniper round snaps through empty air into the bamboo behind him.';
        }
      }
    }

    // Publish AMBUSH_EVADED or AMBUSH_TRIGGERED
    if (wasEvaded) {
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('AMBUSH_EVADED', {
          tensionId,
          outcomeKey: key,
          description: evasionNarrative,
          location,
          reaction: playerReaction
        });
      }
    } else {
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('AMBUSH_TRIGGERED', {
          tensionId,
          outcomeKey: key,
          outcome: def,
          title: def.title,
          location,
          description: def.description,
          details: def.description,
          stressDelta: def.stressDelta,
          suppliesDelta: def.suppliesDelta,
          casualtyRisk: def.casualtyRisk
        });
      }

      // Apply resource penalties if ledger attached
      if (this.ledger && typeof this.ledger.modifyStat === 'function') {
        if (def.stressDelta) this.ledger.modifyStat('stress', def.stressDelta);
        if (def.suppliesDelta) this.ledger.modifyStat('supplies', def.suppliesDelta);
      }
    }

    // Construct resolution record
    const resolution = {
      id: tensionId,
      outcomeKey: key,
      outcome: def,
      wasEvaded,
      narrative: wasEvaded ? evasionNarrative : def.description,
      location,
      reaction: playerReaction,
      stressDelta: wasEvaded ? -5 : def.stressDelta,
      timestamp: new Date().toISOString()
    };

    this.encounterHistory.push(resolution);
    if (this.encounterHistory.length > 30) {
      this.encounterHistory.shift();
    }

    // Publish TENSION_RESOLVED
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('TENSION_RESOLVED', {
        tensionId,
        outcomeKey: key,
        wasEvaded,
        resolution,
        stressRelief: wasEvaded ? 5 : 0
      });
    }

    // Clear active tension
    this.activeTension = null;

    return resolution;
  }

  /**
   * Retrieves active tension state if an encounter sequence is currently underway.
   * @returns {object|null}
   */
  getActiveTension() {
    return this.activeTension ? { ...this.activeTension } : null;
  }

  /**
   * Retrieves encounter history.
   * @returns {Array<object>}
   */
  getEncounterHistory() {
    return [...this.encounterHistory];
  }

  /**
   * Serializes ambush system state for save game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      activeTension: this.activeTension ? JSON.parse(JSON.stringify(this.activeTension)) : null,
      encounterHistory: JSON.parse(JSON.stringify(this.encounterHistory)),
      currentWeather: this.currentWeather,
      currentEnemyStrategy: this.currentEnemyStrategy
    };
  }

  /**
   * Restores ambush system state from serialized save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.activeTension) {
      this.activeTension = JSON.parse(JSON.stringify(data.activeTension));
    } else {
      this.activeTension = null;
    }

    if (Array.isArray(data.encounterHistory)) {
      this.encounterHistory = JSON.parse(JSON.stringify(data.encounterHistory));
    }

    if (data.currentWeather) this.currentWeather = data.currentWeather;
    if (data.currentEnemyStrategy) this.currentEnemyStrategy = data.currentEnemyStrategy;
  }

  /**
   * Internal handler for SCENE_RENDERED events.
   * Checks if scene payload specifies or rolls an ambush encounter.
   * @param {object} payload
   * @private
   */
  _handleSceneRendered(payload) {
    if (!payload || typeof payload !== 'object') return;

    // If scene explicitly configures an ambush check
    if (payload.checkAmbush || payload.ambush) {
      const context = typeof payload.ambush === 'object' ? payload.ambush : {};
      this.rollAmbushSequence({
        ...context,
        location: payload.location || payload.id,
        terrain: payload.terrain || payload.location
      });
    }
  }

  /**
   * Internal handler for CHOICE_MADE events.
   * Automatically checks if a choice resolves an active tension warning.
   * @param {object} choice
   * @private
   */
  _handleChoiceMade(choice) {
    if (!this.activeTension || !choice || typeof choice !== 'object') return;

    const actionText = `${choice.text || ''} ${choice.resolutionText || ''}`.toLowerCase();
    let action = 'standard';

    if (actionText.includes('cover') || actionText.includes('dive') || actionText.includes('hit the dirt')) {
      action = 'take_cover';
    } else if (actionText.includes('recon') || actionText.includes('scout') || actionText.includes('spot')) {
      action = 'spotter';
    } else if (actionText.includes('charge') || actionText.includes('assault')) {
      action = 'rush';
    }

    this.resolveAmbush(this.activeTension.projectedOutcome, {
      action,
      choiceText: choice.text
    });
  }
}
