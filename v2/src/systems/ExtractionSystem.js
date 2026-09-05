// Squad Leader: Vietnam - Dynamic Extraction Endgame System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: ExtractionSystem.js
Purpose: Procedurally determines, executes, and memorializes the campaign endgame extraction at LZ X-Ray based on cumulative campaign history.
Responsibilities:
- Ingest comprehensive campaign inputs:
  * Surviving Soldiers count & identities (from SquadManager)
  * Wounded Personnel count & carrier assignments (from WoundedSoldierManager)
  * Final Heat level, supplies, valor points, and stress (from Ledger)
  * Intel Tier & Clarity percentage (from IntelSystem)
  * Command Reputation primary doctrine and archetype scores (from ReputationManager)
  * Weather conditions at LZ (from WeatherSystem)
  * Heroic Actions & Sacrifices recorded (from HeroicActionManager)
  * Enemy Commander Strategy, Aggression, and Countermeasures (from EnemyCommander)
- Procedurally calculate one of 6 Dynamic Ending Archetypes:
  1. Clean Extraction: Low heat, good weather, intact squad -> Clean liftoff, door gunners suppress woodline, all survivors make it home.
  2. Running Gunfight: High heat, aggressive enemy -> Hot LZ under automatic weapon fire; desperate sprint to Huey, door gunners blazing.
  3. Helicopter Shot Down: Heavy enemy aggression + RPG/AA fire -> The incoming Huey is struck and crashes on the LZ rim; survivors must rush the burning wreckage to rescue the crew.
  4. Last Stand: Extreme heat, overwhelming assault, low ammo -> Perimeter collapses; survivors fight back-to-back in an unforgettable final defense.
  5. Rear Guard Sacrifice: Squad trapped or slowed by wounded -> A heroic soldier stays behind with a machine gun/claymores to buy time for the chopper to lift off.
  6. Split Evacuation: Severely limited lift capacity -> Chopper can only take wounded and partial squad; agonizing decision of who boards first while remainder prepares defense.
- Execute extraction decisions:
  * Manage rear guard sacrifice assignment and posthumous valor honors.
  * Manage crash site crew rescues and combat lifesaver decorations.
  * Manage triage prioritization for partial evacuations.
  * Record formal chronicles into the military Journal with PST timestamps per Directive 13.
- Generate emergent war story epilogues synthesizing soldier relationships, heroic acts, casualties, and the final extraction climax.
- Publish extraction lifecycle events: EXTRACTION_CALCULATED, EXTRACTION_BEGUN, EXTRACTION_CONCLUDED.
- Subscribe to SCENE_RENDERED, CHOICE_MADE, and GAME_LOADED.
- Provide full serialization and deserialization for game persistence.
Dependencies: MessageBus.js, optional systems (SquadManager, WoundedSoldierManager, Ledger, IntelSystem, ReputationManager, WeatherSystem, HeroicActionManager, EnemyCommander, Journal)
Published Events:
- EXTRACTION_CALCULATED: Dispatched when endgame conditions are evaluated and an archetype is determined.
- EXTRACTION_BEGUN: Dispatched when extraction sequence commences at LZ X-Ray.
- EXTRACTION_CONCLUDED: Dispatched when extraction resolution, war story epilogue, and medal citations are finalized.
Subscribed Events:
- SCENE_RENDERED: Evaluates extraction readiness upon arriving at LZ X-Ray scenes.
- CHOICE_MADE: Detects player tactical decisions during the extraction climax.
- GAME_LOADED: Restores extraction evaluation, execution state, and generated epilogue.
Future Expansion Notes: Multi-ship Dustoff formations, gunship air cavalry strikes, and memorial monument roll of honor.
--------------------------------------------------
*/

/**
 * The 6 Dynamic Ending Archetypes.
 */
export const EXTRACTION_ARCHETYPES = {
  CLEAN_EXTRACTION: 'clean_extraction',
  RUNNING_GUNFIGHT: 'running_gunfight',
  HELICOPTER_SHOT_DOWN: 'helicopter_shot_down',
  LAST_STAND: 'last_stand',
  REAR_GUARD_SACRIFICE: 'rear_guard_sacrifice',
  SPLIT_EVACUATION: 'split_evacuation'
};

/**
 * Metadata and narrative templates for each extraction ending archetype.
 */
export const ARCHETYPE_METADATA = {
  [EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION]: {
    id: EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION,
    name: 'Clean Extraction',
    subtitle: 'Rendezvous at LZ X-Ray - Liftoff Achieved',
    description: 'Low heat, good weather, and an intact squad allow a textbook extraction. Door gunners suppress the woodline as all survivors board safely.',
    tacticalRisk: 'Low',
    badgeColor: 'var(--terminal-green)',
    recommendedAction: 'Board all personnel in good order and pop green smoke for immediate liftoff.'
  },
  [EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT]: {
    id: EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT,
    name: 'Running Gunfight',
    subtitle: 'Hot LZ - Desperate Sprint Under Fire',
    description: 'The LZ erupts in heavy enemy automatic fire. Door gunners lay down covering fire while survivors sprint through hostile crossfire to the skids.',
    tacticalRisk: 'High',
    badgeColor: 'var(--warning-yellow)',
    recommendedAction: 'Lay down suppressive fire, pop red smoke, and sprint for the doors under door-gunner cover.'
  },
  [EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN]: {
    id: EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN,
    name: 'Helicopter Shot Down',
    subtitle: 'Chopper Down - Rescue on the Perimeter Rim',
    description: 'Hostile RPG and heavy anti-aircraft fire strike the incoming Huey on short final, causing it to crash into the perimeter rim. Survivors must rush the burning wreckage.',
    tacticalRisk: 'Extreme',
    badgeColor: 'var(--blood-red)',
    recommendedAction: 'Form an assault rescue team, pull the aircrew from the burning wreckage, and establish an emergency perimeter.'
  },
  [EXTRACTION_ARCHETYPES.LAST_STAND]: {
    id: EXTRACTION_ARCHETYPES.LAST_STAND,
    name: 'Last Stand',
    subtitle: 'Overwhelming Assault - Back-to-Back Defense',
    description: 'Extreme heat, relentless human wave assaults, and depleted ammunition collapse the perimeter. The remaining squad fights back-to-back in an unforgettable final defense.',
    tacticalRisk: 'Catastrophic',
    badgeColor: '#ff2a2a',
    recommendedAction: 'Fix bayonets, stack remaining magazines, and fight together to the very last round.'
  },
  [EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE]: {
    id: EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE,
    name: 'Rear Guard Sacrifice',
    subtitle: 'Holding the Woodline - The Ultimate Sacrifice',
    description: 'Slowed by wounded comrades and pressed by pursuing enemy platoons, extraction is impossible without someone staying behind with a machine gun and claymores to hold the line.',
    tacticalRisk: 'Severe / Heroic',
    badgeColor: '#ff9800',
    recommendedAction: 'Designate a volunteer rear-guard gunner to anchor the woodline and buy precious time for liftoff.'
  },
  [EXTRACTION_ARCHETYPES.SPLIT_EVACUATION]: {
    id: EXTRACTION_ARCHETYPES.SPLIT_EVACUATION,
    name: 'Split Evacuation',
    subtitle: 'Limited Lift Capacity - Agonizing Triage',
    description: 'Aircraft damage, density altitude, and adverse weather severely limit hover lift capacity. The commander faces an agonizing choice of who boards first.',
    tacticalRisk: 'Severe',
    badgeColor: '#e0a800',
    recommendedAction: 'Prioritize critically wounded personnel and carriers for first lift; remaining riflemen dig in for a second bird.'
  }
};

/**
 * Dynamic Extraction Endgame System coordinates the procedural climax of the campaign.
 */
export class ExtractionSystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [systems={}] - Attached system dependencies.
   * @param {import('../entities/SquadManager.js').SquadManager} [systems.squadManager] - Squad manager.
   * @param {import('../state/Ledger.js').Ledger} [systems.ledger] - Resource ledger.
   * @param {import('./IntelSystem.js').IntelSystem} [systems.intelSystem] - Intelligence system.
   * @param {import('./ReputationManager.js').ReputationManager} [systems.reputationManager] - Reputation manager.
   * @param {import('./WeatherSystem.js').WeatherSystem} [systems.weatherSystem] - Weather system.
   * @param {import('./HeroicActionManager.js').HeroicActionManager} [systems.heroicActionManager] - Heroic action manager.
   * @param {import('./EnemyCommander.js').EnemyCommander} [systems.enemyCommander] - Enemy commander AI.
   * @param {import('./WoundedSoldierManager.js').WoundedSoldierManager} [systems.woundedSoldierManager] - Wounded soldier manager.
   * @param {import('./Journal.js').Journal} [systems.journal] - Campaign journal.
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.timeZone='America/Los_Angeles'] - User timezone per Directive 13.
   */
  constructor(messageBus, systems = {}, options = {}) {
    this.messageBus = messageBus || null;
    this.squadManager = systems.squadManager || null;
    this.ledger = systems.ledger || null;
    this.intelSystem = systems.intelSystem || null;
    this.reputationManager = systems.reputationManager || null;
    this.weatherSystem = systems.weatherSystem || null;
    this.heroicActionManager = systems.heroicActionManager || null;
    this.enemyCommander = systems.enemyCommander || null;
    this.woundedSoldierManager = systems.woundedSoldierManager || null;
    this.journal = systems.journal || null;

    this.timeZone = options.timeZone || 'America/Los_Angeles';

    // State properties
    this.calculatedEnding = null;
    this.executed = false;
    this.endingId = null;
    this.decisions = {};
    this.epilogue = null;
    this.summary = null;
    this.evaluatedAt = null;
    this.executedAt = null;

    this._setupSubscriptions();
  }

  /**
   * Attach or update system dependencies.
   * @param {object} systems
   */
  setSystems(systems = {}) {
    if (systems.squadManager) this.squadManager = systems.squadManager;
    if (systems.ledger) this.ledger = systems.ledger;
    if (systems.intelSystem) this.intelSystem = systems.intelSystem;
    if (systems.reputationManager) this.reputationManager = systems.reputationManager;
    if (systems.weatherSystem) this.weatherSystem = systems.weatherSystem;
    if (systems.heroicActionManager) this.heroicActionManager = systems.heroicActionManager;
    if (systems.enemyCommander) this.enemyCommander = systems.enemyCommander;
    if (systems.woundedSoldierManager) this.woundedSoldierManager = systems.woundedSoldierManager;
    if (systems.journal) this.journal = systems.journal;
  }

  /**
   * Setup message bus subscriptions.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. SCENE_RENDERED: Evaluate extraction when reaching LZ arrival or campaign end
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      if (!payload) return;
      const sceneId = typeof payload === 'string' ? payload : (payload.sceneId || payload.id || '');
      const isLzScene = sceneId === 'lz_arrival' ||
                        sceneId === 'campaign_end' ||
                        payload.isExtraction === true ||
                        (typeof payload.narrative === 'string' && payload.narrative.includes('LZ X-Ray'));

      if (isLzScene && !this.calculatedEnding) {
        this.evaluateExtraction({ sceneId, scenePayload: payload });
      }
    });

    // 2. CHOICE_MADE: Detect player extraction choices
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const choiceId = payload.id || '';

      if (choiceId === 'lz_board_huey' || payload.isExtractionChoice) {
        const endingId = this.calculatedEnding?.endingId || EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION;
        const decisions = payload.extractionDecisions || payload.decisions || {};
        this.executeExtraction(endingId, decisions);
      }
    });

    // 3. GAME_LOADED: Restore extraction system state
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.extraction || payload.extractionSystem)) {
        this.deserialize(payload.extraction || payload.extractionSystem);
      }
    });
  }

  /**
   * Gathers comprehensive battlefield metrics across all attached systems.
   * @param {object} [context={}] - Contextual overrides.
   * @returns {object} Normalized input state.
   */
  gatherInputs(context = {}) {
    // 1. Squad data
    const soldiers = this.squadManager?.getSoldiers() || [];
    const aliveSoldiers = this.squadManager?.getAliveSoldiers() || soldiers.filter((s) => s.isAlive);
    const deadSoldiers = soldiers.filter((s) => !s.isAlive);

    // 2. Wounded data
    const woundedRecords = this.woundedSoldierManager?.getWoundedSoldiers() || [];
    const carriedRecords = this.woundedSoldierManager?.getCarriedSoldiers() || [];

    // 3. Ledger resources
    const stats = this.ledger?.getStats ? this.ledger.getStats() : (this.ledger?.stats || {});
    const heat = typeof context.heat === 'number' ? context.heat : (stats.heat ?? 0);
    const supplies = typeof context.supplies === 'number' ? context.supplies : (stats.supplies ?? 100);
    const valorPoints = typeof context.valorPoints === 'number' ? context.valorPoints : (stats.valorPoints ?? 0);
    const stress = typeof context.stress === 'number' ? context.stress : (stats.stress ?? 0);

    // 4. Intelligence
    const intelTier = context.intelTier || this.intelSystem?.getIntelTier() || 'LOW';
    const intelDef = this.intelSystem?.getTierDefinition ? this.intelSystem.getTierDefinition(intelTier) : null;
    const intelClarity = typeof context.intelClarity === 'number'
      ? context.intelClarity
      : (intelDef?.clarityPercentage ?? 20);

    // 5. Reputation
    const primaryReputation = context.primaryReputation || this.reputationManager?.getPrimaryReputation() || 'Reliable';
    const reputationScores = this.reputationManager?.getScores ? this.reputationManager.getScores() : {};

    // 6. Weather
    const currentWeather = this.weatherSystem?.getCurrentWeather ? this.weatherSystem.getCurrentWeather() : null;
    const weather = context.weather || currentWeather?.name || currentWeather?.type || 'Clear';

    // 7. Heroic Actions & Medals
    const heroicActions = this.heroicActionManager?.getHeroicActions ? this.heroicActionManager.getHeroicActions() : [];
    const medals = this.heroicActionManager?.getAllMedals
      ? this.heroicActionManager.getAllMedals()
      : (this.heroicActionManager?.getMedals ? this.heroicActionManager.getMedals() : []);

    // 8. Enemy Commander
    const enemyState = this.enemyCommander?.getState ? this.enemyCommander.getState() : null;
    const enemyStrategy = context.enemyStrategy || enemyState?.currentStrategy || this.enemyCommander?.currentStrategy || 'Recon';
    const enemyAggression = typeof context.enemyAggression === 'number'
      ? context.enemyAggression
      : (enemyState?.aggression ?? this.enemyCommander?.aggression ?? 50);
    const enemyCountermeasures = enemyState?.countermeasures || Array.from(this.enemyCommander?.countermeasures || []);

    return {
      survivors: aliveSoldiers.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        morale: s.morale,
        status: s.status,
        traits: s.getTraits ? s.getTraits() : (s.traits || [s.trait]),
        conditions: s.conditions || []
      })),
      survivorCount: aliveSoldiers.length,
      fallen: deadSoldiers.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        cause: s.causeOfDeath || 'Killed in action'
      })),
      fallenCount: deadSoldiers.length,
      wounded: woundedRecords.map((w) => ({ ...w })),
      woundedCount: woundedRecords.length,
      carried: carriedRecords.map((c) => ({ ...c })),
      carriedCount: carriedRecords.length,
      heat,
      supplies,
      valorPoints,
      stress,
      intelTier,
      intelClarity,
      primaryReputation,
      reputationScores,
      weather,
      heroicActions,
      heroicActionCount: heroicActions.length,
      medals,
      medalCount: medals.length,
      enemyStrategy,
      enemyAggression,
      enemyCountermeasures,
      // Pass-through overrides
      ...context
    };
  }

  /**
   * Procedurally calculates the endgame extraction archetype based on comprehensive inputs.
   *
   * @param {object} [inputs={}] - Input state parameters.
   * @returns {object} Calculated ending object with archetype, breakdown, and narrative.
   */
  calculateEnding(inputs = {}) {
    const norm = {
      survivorCount: inputs.survivorCount ?? (inputs.survivors?.length ?? 8),
      woundedCount: inputs.woundedCount ?? (inputs.wounded?.length ?? 0),
      carriedCount: inputs.carriedCount ?? (inputs.carried?.length ?? 0),
      heat: Number(inputs.heat ?? 0),
      supplies: Number(inputs.supplies ?? 100),
      valorPoints: Number(inputs.valorPoints ?? 0),
      intelTier: inputs.intelTier || 'LOW',
      intelClarity: Number(inputs.intelClarity ?? 20),
      primaryReputation: inputs.primaryReputation || 'Reliable',
      weather: String(inputs.weather || 'Clear'),
      enemyStrategy: String(inputs.enemyStrategy || 'Recon'),
      enemyAggression: Number(inputs.enemyAggression ?? 50),
      enemyCountermeasures: Array.isArray(inputs.enemyCountermeasures) ? inputs.enemyCountermeasures : [],
      forcedEnding: inputs.forcedEnding || inputs.endingId || inputs.archetype || null,
      limitedLift: Boolean(inputs.limitedLift),
      rearGuardVolunteered: Boolean(inputs.rearGuardVolunteered)
    };

    // If caller explicitly forced or specified an ending archetype, honor it
    if (norm.forcedEnding && ARCHETYPE_METADATA[norm.forcedEnding]) {
      const meta = ARCHETYPE_METADATA[norm.forcedEnding];
      return {
        endingId: meta.id,
        name: meta.name,
        subtitle: meta.subtitle,
        description: meta.description,
        narrative: meta.description,
        tacticalRisk: meta.tacticalRisk,
        recommendedAction: meta.recommendedAction,
        badgeColor: meta.badgeColor,
        scoreBreakdown: { forced: 999 },
        conditionsMet: ['Explicitly specified or forced scenario.'],
        inputs: norm
      };
    }

    // Initialize scores for the 6 archetypes
    const scores = {
      [EXTRACTION_ARCHETYPES.LAST_STAND]: 0,
      [EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN]: 0,
      [EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE]: 0,
      [EXTRACTION_ARCHETYPES.SPLIT_EVACUATION]: 0,
      [EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT]: 0,
      [EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION]: 0
    };

    const conditionsMet = [];

    // --- 1. LAST STAND SCORING ---
    // Extreme heat, overwhelming assault, depleted supplies, or few survivors
    if (norm.heat >= 80) scores[EXTRACTION_ARCHETYPES.LAST_STAND] += (norm.heat / 100) * 45;
    if (norm.enemyAggression >= 75) scores[EXTRACTION_ARCHETYPES.LAST_STAND] += (norm.enemyAggression / 100) * 35;
    if (norm.enemyStrategy === 'Full Assault') {
      scores[EXTRACTION_ARCHETYPES.LAST_STAND] += 40;
      conditionsMet.push('Enemy employing Full Assault doctrine against LZ perimeter.');
    }
    if (norm.supplies <= 25) {
      scores[EXTRACTION_ARCHETYPES.LAST_STAND] += 30;
      conditionsMet.push('Squad ammunition and supplies depleted to critical levels.');
    } else if (norm.supplies <= 40) {
      scores[EXTRACTION_ARCHETYPES.LAST_STAND] += 15;
    }
    if (norm.survivorCount <= 3 && norm.heat >= 60) {
      scores[EXTRACTION_ARCHETYPES.LAST_STAND] += 25;
      conditionsMet.push('Squad reduced to a handful of survivors under severe enemy pressure.');
    }

    // --- 2. HELICOPTER SHOT DOWN SCORING ---
    // Heavy aggression, hostile AA/RPG fire, severe weather interference
    const hasAntiAirThreat = norm.enemyCountermeasures.includes('interlocking_crossfire') ||
                             norm.enemyCountermeasures.includes('camouflaged_mortars');
    if (norm.enemyAggression >= 70) {
      scores[EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN] += (norm.enemyAggression / 100) * 45;
    }
    if (norm.heat >= 60) {
      scores[EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN] += (norm.heat / 100) * 30;
    }
    if (norm.weather === 'Thunderstorm' || norm.weather === 'Monsoon') {
      scores[EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN] += 35;
      conditionsMet.push(`Severe atmospheric turbulence and visibility degradation caused by ${norm.weather}.`);
    }
    if (norm.enemyStrategy === 'Hunt' || norm.enemyStrategy === 'Full Assault') {
      scores[EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN] += 20;
    }
    if (hasAntiAirThreat) {
      scores[EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN] += 25;
      conditionsMet.push('Enemy interlocking heavy fire positions registered on LZ approach corridor.');
    }

    // --- 3. REAR GUARD SACRIFICE SCORING ---
    // Trapped or burdened by multiple wounded personnel under hostile pursuit
    if (norm.woundedCount >= 1) {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += norm.woundedCount * 30;
    }
    if (norm.carriedCount >= 1) {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += norm.carriedCount * 25;
      conditionsMet.push(`Active wounded casualties (${norm.carriedCount} carried) severely slowing squad mobility.`);
    }
    if (norm.heat >= 50) {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += (norm.heat / 100) * 30;
    }
    if (norm.enemyAggression >= 60) {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += (norm.enemyAggression / 100) * 20;
    }
    if (norm.primaryReputation === 'Protector') {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += 15;
    }
    if (norm.rearGuardVolunteered) {
      scores[EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE] += 100;
      conditionsMet.push('A squad member explicitly stepped forward to man the rear guard.');
    }

    // --- 4. SPLIT EVACUATION SCORING ---
    // Severely limited lift capacity: large squad + wounded, or adverse weather restricting hover power
    if (norm.survivorCount >= 6) {
      scores[EXTRACTION_ARCHETYPES.SPLIT_EVACUATION] += 35;
    }
    if (norm.woundedCount >= 1) {
      scores[EXTRACTION_ARCHETYPES.SPLIT_EVACUATION] += 25;
      conditionsMet.push('Wounded personnel require dedicated floor space on the evacuation slick.');
    }
    if (norm.weather === 'Fog' || norm.weather === 'Heavy Rain') {
      scores[EXTRACTION_ARCHETYPES.SPLIT_EVACUATION] += 30;
      conditionsMet.push(`High density altitude and ${norm.weather} reduce UH-1 max hover gross weight.`);
    }
    if (norm.heat >= 40 && norm.heat < 75) {
      scores[EXTRACTION_ARCHETYPES.SPLIT_EVACUATION] += 20;
    }
    if (norm.limitedLift) {
      scores[EXTRACTION_ARCHETYPES.SPLIT_EVACUATION] += 60;
      conditionsMet.push('Flight crew reports helicopter damaged; cargo payload capacity cut by 50%.');
    }

    // --- 5. RUNNING GUNFIGHT SCORING ---
    // Hot LZ, automatic weapons fire, aggressive enemy probe
    if (norm.heat >= 40) {
      scores[EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT] += (norm.heat / 100) * 40;
    }
    if (norm.enemyAggression >= 50) {
      scores[EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT] += (norm.enemyAggression / 100) * 40;
    }
    if (norm.enemyStrategy === 'Hunt' || norm.enemyStrategy === 'Ambush' || norm.enemyStrategy === 'Harassment') {
      scores[EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT] += 25;
      conditionsMet.push(`Enemy ${norm.enemyStrategy} strategy established active contact at LZ perimeter.`);
    }

    // --- 6. CLEAN EXTRACTION SCORING ---
    // Low heat, good weather, intact squad, high tactical intelligence
    if (norm.heat < 40 && norm.enemyAggression < 50 && norm.woundedCount <= 1) {
      scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += ((100 - norm.heat) / 100) * 45;
      scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += ((100 - norm.enemyAggression) / 100) * 35;
      if (norm.woundedCount === 0) {
        scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += 30;
        conditionsMet.push('Squad has sustained zero unevacuated casualties; full operational readiness.');
      }
      if (norm.weather === 'Clear') {
        scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += 20;
      }
      if (norm.intelTier === 'HIGH') {
        scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += 25;
        conditionsMet.push('High-tier tactical intel enabled optimal, undetected approach vector to LZ.');
      } else if (norm.intelTier === 'MEDIUM') {
        scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] += 10;
      }
    } else {
      // Hot or hostile conditions disqualify a textbook clean extraction
      scores[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION] = 0;
    }

    // Select the highest scoring archetype
    let bestArchetype = EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION;
    let highestScore = -Infinity;

    for (const [archetype, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        bestArchetype = archetype;
      }
    }

    // Fallback safeguard: If all scores are 0, default to Clean Extraction or Running Gunfight based on heat
    if (highestScore <= 0) {
      bestArchetype = norm.heat >= 40
        ? EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT
        : EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION;
    }

    const meta = ARCHETYPE_METADATA[bestArchetype];

    return {
      endingId: meta.id,
      name: meta.name,
      subtitle: meta.subtitle,
      description: meta.description,
      narrative: meta.description,
      tacticalRisk: meta.tacticalRisk,
      recommendedAction: meta.recommendedAction,
      badgeColor: meta.badgeColor,
      scoreBreakdown: { ...scores },
      conditionsMet,
      inputs: norm
    };
  }

  /**
   * Evaluates current campaign context, determines the ending archetype, and publishes EXTRACTION_CALCULATED.
   *
   * @param {object} [context={}] - Contextual overrides or scene data.
   * @returns {object} Evaluation results.
   */
  evaluateExtraction(context = {}) {
    const inputs = this.gatherInputs(context);
    const calculated = this.calculateEnding(inputs);

    this.calculatedEnding = calculated;
    this.evaluatedAt = new Date().toISOString();

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('EXTRACTION_CALCULATED', {
        endingId: calculated.endingId,
        name: calculated.name,
        subtitle: calculated.subtitle,
        narrative: calculated.narrative,
        tacticalRisk: calculated.tacticalRisk,
        inputs,
        scoreBreakdown: calculated.scoreBreakdown,
        evaluatedAt: this.evaluatedAt
      });
    }

    return calculated;
  }

  /**
   * Executes the extraction endgame resolution, applies tactical side-effects, awards decorations,
   * generates the emergent epilogue, and broadcasts lifecycle events.
   *
   * @param {string} [endingId] - Extraction archetype ID.
   * @param {object} [decisions={}] - Command decisions made by player.
   * @returns {object} Full extraction summary.
   */
  executeExtraction(endingId = null, decisions = {}) {
    const targetEndingId = endingId || this.calculatedEnding?.endingId || EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION;
    const meta = ARCHETYPE_METADATA[targetEndingId] || ARCHETYPE_METADATA[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION];

    this.endingId = targetEndingId;
    this.decisions = { ...decisions };
    this.executed = true;
    this.executedAt = new Date().toISOString();

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('EXTRACTION_BEGUN', {
        endingId: targetEndingId,
        name: meta.name,
        timestamp: this.executedAt
      });
    }

    // Archetype-specific side effects, medal citations, and journal entries
    const soldiers = this.squadManager?.getSoldiers() || [];
    const alive = this.squadManager?.getAliveSoldiers() || soldiers.filter((s) => s.isAlive);

    switch (targetEndingId) {
      case EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE: {
        // Resolve designated or automatic rear guard volunteer
        let sacrificeId = decisions.rearGuardSoldierId || decisions.volunteerId;
        if (!sacrificeId && alive.length > 0) {
          // Choose Kowalski, Washington, or first alive rifleman/gunner
          const pref = alive.find((s) => s.id === 'kowalski' || s.id === 'washington') || alive[0];
          sacrificeId = pref.id;
        }

        const sacrificeSoldier = this.squadManager?.getSoldierById(sacrificeId);
        if (sacrificeSoldier) {
          sacrificeSoldier.isAlive = false;
          sacrificeSoldier.status = 'kia';
          sacrificeSoldier.causeOfDeath = 'Heroic Rear Guard Sacrifice at LZ X-Ray';

          // Award Medal of Honor / DSC posthumously
          if (this.heroicActionManager && typeof this.heroicActionManager.triggerHeroicAction === 'function') {
            this.heroicActionManager.triggerHeroicAction(sacrificeSoldier.id, 'Last Stand', {
              soldierName: sacrificeSoldier.name,
              reason: `Manned rear guard position alone at LZ X-Ray with an M60 and claymores, sacrificing himself so the squad could extract.`
            });
          }

          // Record formal military journal entry
          if (this.journal && typeof this.journal.addEntry === 'function') {
            this.journal.addEntry({
              category: 'HEROISM',
              title: 'Rear Guard Sacrifice at LZ X-Ray',
              content: `${sacrificeSoldier.name} remained behind at the woodline to buy time for the extraction helicopter. His heroic sacrifice saved the remaining members of the squad.`,
              tags: ['EXTRACTION', 'SACRIFICE', 'KIA', sacrificeSoldier.name]
            });
          }
        }
        break;
      }

      case EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN: {
        // Crash rescue: Squad charges burning wreckage to pull out aircrew
        const rescuer = alive.find((s) => s.id === 'baker' || s.id === 'duke') || (alive.length > 0 ? alive[0] : null);
        if (rescuer && this.heroicActionManager && typeof this.heroicActionManager.triggerHeroicAction === 'function') {
          this.heroicActionManager.triggerHeroicAction(rescuer.id, 'Combat Rescue', {
            soldierName: rescuer.name,
            reason: `Braved exploding fuel cells and hostile RPG fire to pull the wounded pilot and door gunner from the downed Huey at the LZ rim.`
          });
        }

        if (this.journal && typeof this.journal.addEntry === 'function') {
          this.journal.addEntry({
            category: 'COMBAT',
            title: 'Huey Shot Down at LZ X-Ray',
            content: `The extraction helicopter took catastrophic RPG fire on final approach, crashing on the perimeter rim. Survivors rushed the burning wreckage and pulled the aircrew out before secondary explosions.`,
            tags: ['EXTRACTION', 'CRASH', 'RESCUE']
          });
        }
        break;
      }

      case EXTRACTION_ARCHETYPES.LAST_STAND: {
        // Survivors fight to the last cartridge
        if (this.journal && typeof this.journal.addEntry === 'function') {
          this.journal.addEntry({
            category: 'COMBAT',
            title: 'The Last Stand at LZ X-Ray',
            content: `Outnumbered and out of ammunition, the surviving squad members formed a perimeter circle and fought with unforgettable valor against human-wave NVA assaults.`,
            tags: ['EXTRACTION', 'LAST_STAND', 'VALOR']
          });
        }

        // Award Silver Star or DSC to all surviving defenders
        alive.forEach((s) => {
          if (this.heroicActionManager && typeof this.heroicActionManager.awardMedal === 'function') {
            this.heroicActionManager.awardMedal(s.id, 'Silver Star', {
              reason: `Gallantry in action during the desperate perimeter defense of LZ X-Ray.`
            });
          }
        });
        break;
      }

      case EXTRACTION_ARCHETYPES.SPLIT_EVACUATION: {
        if (this.journal && typeof this.journal.addEntry === 'function') {
          this.journal.addEntry({
            category: 'COMMAND',
            title: 'Split Evacuation at LZ X-Ray',
            content: `High density altitude and combat damage forced an agonizing split evacuation. Wounded personnel were given priority lift while riflemen dug in to await second dustoff.`,
            tags: ['EXTRACTION', 'SPLIT_EVAC', 'TRIAGE']
          });
        }
        break;
      }

      case EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT: {
        if (this.journal && typeof this.journal.addEntry === 'function') {
          this.journal.addEntry({
            category: 'COMBAT',
            title: 'Hot Extraction Under Fire',
            content: `Door gunners expended over 2,000 rounds into the woodline as the squad sprinted through mortar bursts and crossfire to board the hovering slick.`,
            tags: ['EXTRACTION', 'HOT_LZ', 'CONTACT']
          });
        }
        break;
      }

      case EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION:
      default: {
        if (this.journal && typeof this.journal.addEntry === 'function') {
          this.journal.addEntry({
            category: 'COMMAND',
            title: 'Clean Liftoff at LZ X-Ray',
            content: `Tactical discipline and thorough reconnaissance enabled a clean extraction. All surviving soldiers evacuated safely from the AOR.`,
            tags: ['EXTRACTION', 'MISSION_COMPLETE', 'SUCCESS']
          });
        }
        break;
      }
    }

    // Generate emergent war story narrative
    this.epilogue = this.generateWarStoryEpilogue();
    this.summary = this.getExtractionSummary();

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('EXTRACTION_CONCLUDED', {
        endingId: targetEndingId,
        name: meta.name,
        summary: this.summary,
        epilogue: this.epilogue,
        survivors: this.summary.survivors,
        fallen: this.summary.fallen,
        medals: this.summary.medals,
        timestamp: this.executedAt
      });
    }

    return this.summary;
  }

  /**
   * Generates a moving, emergent war story epilogue synthesizing player choices,
   * fallen comrades, heroic deeds, and the final extraction climax.
   *
   * @returns {string} Multiline paragraph war story text.
   */
  generateWarStoryEpilogue() {
    const soldiers = this.squadManager?.getSoldiers() || [];
    const alive = this.squadManager?.getAliveSoldiers() || soldiers.filter((s) => s.isAlive);
    const fallen = soldiers.filter((s) => !s.isAlive);
    const medals = this.heroicActionManager?.getMedals ? this.heroicActionManager.getMedals() : [];
    const heroicActions = this.heroicActionManager?.getHeroicActions ? this.heroicActionManager.getHeroicActions() : [];
    const endingMeta = ARCHETYPE_METADATA[this.endingId || this.calculatedEnding?.endingId] ||
                       ARCHETYPE_METADATA[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION];

    const paragraphs = [];

    // 1. Setting & Campaign Crucible
    const weatherDesc = this.weatherSystem?.getCurrentWeather?.()?.description || 'oppressive tropical heat';
    paragraphs.push(
      `The long fighting withdrawal through the jungle of Grid 881 had pushed the squad to the razor edge of human endurance. Under ${weatherDesc.toLowerCase()}, they had hacked through razor-sharp elephant grass, skirted NVA spider holes, and carried the weight of the war on their blistered shoulders.`
    );

    // 2. Memorialization of the Fallen & Specific Valor
    if (fallen.length > 0) {
      const fallenNames = fallen.map((f) => `${f.name} (${f.role})`).join(', ');
      let sacrificeNote = '';

      // Check if Washington died saving Jenkins or other notable heroics
      const rescueAction = heroicActions.find((h) => (h.actionType || h.actType) === 'Combat Rescue' || (h.actionType || h.actType) === 'Last Stand');
      if (rescueAction) {
        sacrificeNote = ` Their memories were etched in blood and valor—none more profound than ${rescueAction.soldierName}, who gave everything when the woodline exploded in crossfire.`;
      } else {
        sacrificeNote = ` Every step toward the extraction zone was paid for in the blood of comrades who would never see home again.`;
      }

      paragraphs.push(
        `Not everyone made it to the clearing. The roll of honor claimed ${fallenNames}.${sacrificeNote}`
      );
    } else {
      paragraphs.push(
        `Miraculously, through steady nerve and tactical discipline, every single member of the squad survived the gauntlet intact—a rare and sacred miracle in the valleys of Khe Sanh.`
      );
    }

    // 3. Climax at LZ X-Ray (Ending Archetype Specific Narrative)
    switch (this.endingId || this.calculatedEnding?.endingId) {
      case EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION:
        paragraphs.push(
          `At LZ X-Ray, green smoke billowed smoothly into the morning sky. The UH-1 Huey flared with mechanical grace, door gunners sweeping the perimeter with heavy barrels. In disciplined silence, the survivors bounded aboard, helmet visors reflecting the shrinking jungle below. As the aircraft cleared the tree canopy, an overwhelming wave of relief broke across the cabin. They were going home.`
        );
        break;

      case EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT:
        paragraphs.push(
          `LZ X-Ray was an inferno. NVA machine gunners opened up from the tree line, tracers whipping through the grass in lethal intersecting arcs. With door gunners blazing thousands of rounds in return, the squad made a desperate sprint across open ground. Diving onto the vibrating aluminum deck as the pilot pulled maximum pitch, the survivors looked back through cordite smoke at a woodline chewing itself to pieces.`
        );
        break;

      case EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN:
        paragraphs.push(
          `Disaster struck on short final. A rocket-propelled grenade clipped the tail boom of the rescue Huey, sending it spinning into the perimeter rim in a fireball of aviation fuel. Refusing to abandon their brothers in the sky, the squad surged forward into the teeth of enemy fire. Prying open the crushed cockpit, they hauled the battered crew to safety before consolidating an emergency defense in the red dirt.`
        );
        break;

      case EXTRACTION_ARCHETYPES.LAST_STAND:
        paragraphs.push(
          `As the perimeter collapsed under human-wave assaults, the survivors formed an unbreakable ring back-to-back. With rifles glowing hot and ammunition down to loose rounds gathered from webbing, they stood their ground with defiance that shook the valley. Whatever their fate in that bloody clearing, their brotherhood was forged into legend.`
        );
        break;

      case EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE:
        paragraphs.push(
          `With the wounded slowing the retreat and the enemy closing fast, someone had to hold the gate. A solitary soldier remained behind at the woodline, claymores rigged and an M60 spitting defiant fire into the jungle. As the Huey banked hard into the sky, the rhythmic chatter of that lone gun was the last sound echoing up through the cloud deck—a final, sacred gift of life to the brothers flying away.`
        );
        break;

      case EXTRACTION_ARCHETYPES.SPLIT_EVACUATION:
        paragraphs.push(
          `With the bird straining under hot, thin air and rotor damage, the pilot signaled the grim truth: only half the men could board. The wounded and their lifesavers were lifted up first. A long, silent glance passed between the men in the air and the riflemen kneeling in the elephant grass, fixing bayonets and digging into the dirt to hold until the next bird came.`
        );
        break;

      default:
        paragraphs.push(endingMeta.description);
        break;
    }

    // 4. Medals & Enduring Legacy
    if (medals.length > 0) {
      const medalSummaries = medals.slice(0, 3).map((m) => `${m.medalType || m.medal} (${m.soldierName})`).join(', ');
      paragraphs.push(
        `For extraordinary valor under fire, official citations were conferred across the squad: ${medalSummaries}. Those who survived would carry the physical scars and psychological weight of the war for the rest of their days, bound by a bond that only those who walked through the fire could understand.`
      );
    } else {
      paragraphs.push(
        `Those who flew out of the valley left a part of their souls behind in the red clay. The war would continue, but for this squad, the crucible of Hill 881 was written into history.`
      );
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Compiles and returns a comprehensive extraction debriefing summary.
   * @returns {object}
   */
  getExtractionSummary() {
    const soldiers = this.squadManager?.getSoldiers() || [];
    const alive = this.squadManager?.getAliveSoldiers() || soldiers.filter((s) => s.isAlive);
    const fallen = soldiers.filter((s) => !s.isAlive);
    const wounded = this.woundedSoldierManager?.getWoundedSoldiers() || [];
    const medals = this.heroicActionManager?.getAllMedals
      ? this.heroicActionManager.getAllMedals()
      : (this.heroicActionManager?.getMedals ? this.heroicActionManager.getMedals() : []);
    const stats = this.ledger?.getStats ? this.ledger.getStats() : (this.ledger?.stats || {});
    const targetEndingId = this.endingId || this.calculatedEnding?.endingId || EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION;
    const meta = ARCHETYPE_METADATA[targetEndingId] || ARCHETYPE_METADATA[EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION];

    return {
      endingId: targetEndingId,
      name: meta.name,
      subtitle: meta.subtitle,
      description: meta.description,
      tacticalRisk: meta.tacticalRisk,
      badgeColor: meta.badgeColor,
      executed: this.executed,
      executedAt: this.executedAt,
      evaluatedAt: this.evaluatedAt,
      survivors: alive.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        morale: s.morale,
        status: s.status,
        traits: s.getTraits ? s.getTraits() : (s.traits || [s.trait]),
        conditions: s.conditions || []
      })),
      survivorCount: alive.length,
      fallen: fallen.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        cause: s.causeOfDeath || 'Killed in action'
      })),
      fallenCount: fallen.length,
      wounded: wounded.map((w) => ({
        soldierId: w.soldierId,
        soldierName: w.soldierName,
        severity: w.severity,
        carrierId: w.carrierId
      })),
      woundedCount: wounded.length,
      medals: medals.map((m) => ({
        medal: m.medalType || m.medal,
        soldierId: m.soldierId,
        soldierName: m.soldierName,
        citationText: m.citation || m.citationText,
        awardedAt: m.timestamp || m.isoTimestamp || m.awardedAt
      })),
      medalCount: medals.length,
      finalHeat: stats.heat ?? 0,
      finalIntel: stats.intel ?? 0,
      finalSupplies: stats.supplies ?? 100,
      finalValorPoints: stats.valorPoints ?? 0,
      primaryReputation: this.reputationManager?.getPrimaryReputation?.() || 'Reliable',
      weather: this.weatherSystem?.getCurrentWeather?.()?.name || 'Clear',
      enemyStrategy: this.enemyCommander?.currentStrategy || 'Recon',
      decisions: { ...this.decisions },
      epilogue: this.epilogue || this.generateWarStoryEpilogue()
    };
  }

  /**
   * Serializes the extraction state for game persistence.
   * @returns {object} Serialized snapshot.
   */
  serialize() {
    return {
      calculatedEnding: this.calculatedEnding ? JSON.parse(JSON.stringify(this.calculatedEnding)) : null,
      executed: this.executed,
      endingId: this.endingId,
      decisions: JSON.parse(JSON.stringify(this.decisions)),
      epilogue: this.epilogue,
      summary: this.summary ? JSON.parse(JSON.stringify(this.summary)) : null,
      evaluatedAt: this.evaluatedAt,
      executedAt: this.executedAt
    };
  }

  /**
   * Deserializes and restores the extraction state from saved data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    this.calculatedEnding = data.calculatedEnding || null;
    this.executed = Boolean(data.executed);
    this.endingId = data.endingId || null;
    this.decisions = data.decisions ? JSON.parse(JSON.stringify(data.decisions)) : {};
    this.epilogue = data.epilogue || null;
    this.summary = data.summary ? JSON.parse(JSON.stringify(data.summary)) : null;
    this.evaluatedAt = data.evaluatedAt || null;
    this.executedAt = data.executedAt || null;
  }
}
