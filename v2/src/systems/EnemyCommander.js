// Squad Leader: Vietnam - Enemy Commander Autonomous AI System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: EnemyCommander.js
Purpose: Autonomous NVA adversary AI that tracks player behavior, adapts operational doctrine, and dynamically adjusts aggression, awareness, adaptation, and strategy.
Responsibilities:
- Maintain core adversarial psychological and tactical metrics:
  * aggression: (0-100) How fiercely the enemy attacks vs holds back.
  * awareness: (0-100) How alert the enemy is to the squad's presence and location.
  * adaptation: (0-100) How effectively the enemy counters player tactics.
  * currentStrategy: One of 'Recon', 'Harassment', 'Ambush', 'Hunt', 'Full Assault'.
- Adapt dynamically to player tactical patterns:
  * Frequent artillery / air strikes -> Adapts by dispersing into spider holes and digging in.
  * Frequent stealth / bushwhacking -> Deploys trackers and scout sweeps across ridgelines.
  * High heat (> 60) or high squad casualties -> Shifts strategy to 'Hunt' or 'Full Assault'.
  * Low heat (< 30) / stationary squad -> Shifts strategy to 'Harassment' (mortars) or 'Ambush'.
- Publish adversarial lifecycle events: ENEMY_ADAPTED, ENEMY_STRATEGY_CHANGED, ENEMY_HUNT_TRIGGERED.
- Subscribe to gameplay events: CHOICE_MADE, STAT_CHANGED, CASUALTY_TAKEN, SCENE_RENDERED, GAME_LOADED.
- Provide full state inspection and serialization/deserialization for save game continuity.
Dependencies: MessageBus.js, optional Ledger.js, SquadManager.js
Published Events:
- ENEMY_ADAPTED: Dispatched when the enemy counters a recurring player tactic with doctrinal countermeasures.
- ENEMY_STRATEGY_CHANGED: Dispatched when the enemy commander transitions operational posture.
- ENEMY_HUNT_TRIGGERED: Dispatched when high heat or casualties trigger an aggressive manhunt.
Subscribed Events:
- CHOICE_MADE: Analyzes player choices to categorize and record tactical action patterns.
- STAT_CHANGED: Monitors heat spikes and operational resource fluctuations.
- CASUALTY_TAKEN: Reacts to squad casualties by emboldening enemy aggression and tightening pursuit.
- SCENE_RENDERED: Evaluates tactical terrain context and evaluates doctrinal shifts.
- GAME_LOADED: Restores serialized enemy commander metrics and countermeasures.
Future Expansion Notes: Multi-unit coordinated pincer movements, tunnel retreat networks, and specialized sapper squad deployments.
--------------------------------------------------
*/

/**
 * Operational strategies available to the Enemy Commander AI.
 */
export const ENEMY_STRATEGIES = {
  RECON: 'Recon',
  HARASSMENT: 'Harassment',
  AMBUSH: 'Ambush',
  HUNT: 'Hunt',
  FULL_ASSAULT: 'Full Assault'
};

/**
 * Valid strategy list for fast validation.
 */
export const VALID_STRATEGIES = Object.values(ENEMY_STRATEGIES);

/**
 * Doctrinal countermeasures deployed by the Enemy Commander.
 */
export const ENEMY_COUNTERMEASURES = {
  SPIDER_HOLES: 'dispersed_spider_holes',
  DUG_IN: 'dug_in_fortifications',
  TRACKERS: 'deployed_trackers',
  RIDGELINE_SWEEPS: 'ridgeline_sweeps',
  MORTAR_REGISTER: 'camouflaged_mortars',
  CROSSFIRE_TRAPS: 'interlocking_crossfire'
};

/**
 * EnemyCommander models the autonomous NVA adversary AI.
 * It tracks player decisions, learns tactical habits, and adapts operational doctrine in real time.
 */
export class EnemyCommander {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {object} [options={}] - Configuration options.
   * @param {number} [options.aggression=50] - Initial aggression (0-100).
   * @param {number} [options.awareness=30] - Initial awareness (0-100).
   * @param {number} [options.adaptation=20] - Initial adaptation (0-100).
   * @param {string} [options.currentStrategy=ENEMY_STRATEGIES.RECON] - Initial strategy.
   * @param {import('../state/Ledger.js').Ledger} [options.ledger] - Optional Ledger reference.
   * @param {import('../entities/SquadManager.js').SquadManager} [options.squadManager] - Optional SquadManager reference.
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.ledger = options.ledger || null;
    this.squadManager = options.squadManager || null;

    // Core adversarial properties (clamped 0-100)
    this.aggression = this._clamp(options.aggression ?? 50);
    this.awareness = this._clamp(options.awareness ?? 30);
    this.adaptation = this._clamp(options.adaptation ?? 20);

    // Initial strategy
    this.currentStrategy = VALID_STRATEGIES.includes(options.currentStrategy)
      ? options.currentStrategy
      : ENEMY_STRATEGIES.RECON;

    // Tactical action history & pattern recognition counters
    this.actionCounts = {
      artillery: 0,
      airstrike: 0,
      stealth: 0,
      stationary: 0,
      assault: 0,
      patrol: 0,
      medical: 0
    };

    /** @type {Array<{ actionType: string, timestamp: string, details: object }>} */
    this.actionHistory = [];

    // Active unlocked countermeasures
    /** @type {Set<string>} */
    this.countermeasures = new Set();

    // Tracked casualty count suffered by player squad
    this.squadCasualtiesObserved = 0;

    // Subscribe to engine lifecycle events
    this._setupSubscriptions();
  }

  /**
   * Helper to clamp numeric stats strictly between 0 and 100.
   * @param {number} val
   * @returns {number}
   * @private
   */
  _clamp(val) {
    if (typeof val !== 'number' || isNaN(val)) return 0;
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  /**
   * Register event listeners on the central MessageBus.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. Analyze player tactical choices
    this.messageBus.subscribe('CHOICE_MADE', (choice) => {
      this._handleChoiceMade(choice);
    });

    // 2. Monitor resource and heat shifts
    this.messageBus.subscribe('STAT_CHANGED', (payload) => {
      this._handleStatChanged(payload);
    });

    // 3. Embolden enemy when squad suffers a casualty
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      this._handleCasualtyTaken(payload);
    });

    // 4. Evaluate terrain and context on scene navigation
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      this._handleSceneRendered(payload);
    });

    // 5. Restore serialized state
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.enemyCommander || payload.enemy)) {
        this.deserialize(payload.enemyCommander || payload.enemy);
      }
    });
  }

  /**
   * Modifies a core adversarial metric clamped between 0 and 100.
   * @param {'aggression'|'awareness'|'adaptation'} stat
   * @param {number} delta
   * @returns {number} The updated stat value.
   */
  modifyStat(stat, delta) {
    if (typeof delta !== 'number' || isNaN(delta)) return this[stat] ?? 0;

    if (stat === 'aggression') {
      this.aggression = this._clamp(this.aggression + delta);
      return this.aggression;
    }
    if (stat === 'awareness') {
      this.awareness = this._clamp(this.awareness + delta);
      return this.awareness;
    }
    if (stat === 'adaptation') {
      this.adaptation = this._clamp(this.adaptation + delta);
      return this.adaptation;
    }
    return 0;
  }

  /**
   * Sets the active operational strategy, publishing ENEMY_STRATEGY_CHANGED and
   * optionally ENEMY_HUNT_TRIGGERED if entering an aggressive pursuit posture.
   *
   * @param {string} strategy - One of ENEMY_STRATEGIES.
   * @param {string} [reason='Doctrinal reassessment'] - Narrative explanation.
   * @returns {boolean} True if strategy was updated, false if identical or invalid.
   */
  setStrategy(strategy, reason = 'Doctrinal reassessment') {
    if (!VALID_STRATEGIES.includes(strategy)) {
      console.warn(`EnemyCommander: Invalid strategy "${strategy}" rejected.`);
      return false;
    }

    if (this.currentStrategy === strategy) {
      return false;
    }

    const previousStrategy = this.currentStrategy;
    this.currentStrategy = strategy;

    const payload = {
      previousStrategy,
      newStrategy: this.currentStrategy,
      reason,
      aggression: this.aggression,
      awareness: this.awareness,
      adaptation: this.adaptation,
      timestamp: new Date().toISOString()
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('ENEMY_STRATEGY_CHANGED', payload);

      // If transitioning to Hunt or Full Assault, broadcast hunt trigger
      if (strategy === ENEMY_STRATEGIES.HUNT || strategy === ENEMY_STRATEGIES.FULL_ASSAULT) {
        this.messageBus.publish('ENEMY_HUNT_TRIGGERED', {
          strategy,
          reason,
          heat: this._getCurrentHeat(),
          squadCasualties: this.squadCasualtiesObserved,
          aggression: this.aggression,
          awareness: this.awareness
        });
      }
    }

    return true;
  }

  /**
   * Records a player tactical action, categorizes player tendencies, and evaluates
   * whether doctrinal adaptation or countermeasures should be triggered.
   *
   * @param {string} actionType - 'artillery', 'airstrike', 'stealth', 'stationary', 'assault', 'patrol', etc.
   * @param {object} [details={}] - Optional metadata regarding the choice or scene.
   * @returns {object} Summary of recorded action and triggered adaptations.
   */
  recordPlayerAction(actionType, details = {}) {
    const normType = String(actionType || 'patrol').toLowerCase();
    
    if (this.actionCounts[normType] !== undefined) {
      this.actionCounts[normType]++;
    } else {
      this.actionCounts[normType] = 1;
    }

    const record = {
      actionType: normType,
      timestamp: new Date().toISOString(),
      details
    };

    this.actionHistory.push(record);
    if (this.actionHistory.length > 50) {
      this.actionHistory.shift();
    }

    let adapted = false;
    let counterMeasure = null;
    let adaptationReason = '';

    // 1. Frequent Artillery / Air Strikes Adaptation
    // Enemy disperses, digs spider holes, and improves bunker fortifications
    const heavyFireCount = (this.actionCounts.artillery || 0) + (this.actionCounts.airstrike || 0);
    if ((normType === 'artillery' || normType === 'airstrike') && heavyFireCount >= 2) {
      if (!this.countermeasures.has(ENEMY_COUNTERMEASURES.SPIDER_HOLES)) {
        this.countermeasures.add(ENEMY_COUNTERMEASURES.SPIDER_HOLES);
        this.modifyStat('adaptation', 15);
        adapted = true;
        counterMeasure = ENEMY_COUNTERMEASURES.SPIDER_HOLES;
        adaptationReason = 'Frequent artillery and air strikes compelled enemy to disperse into camouflaged spider holes.';
      } else if (heavyFireCount >= 4 && !this.countermeasures.has(ENEMY_COUNTERMEASURES.DUG_IN)) {
        this.countermeasures.add(ENEMY_COUNTERMEASURES.DUG_IN);
        this.modifyStat('adaptation', 20);
        adapted = true;
        counterMeasure = ENEMY_COUNTERMEASURES.DUG_IN;
        adaptationReason = 'Sustained bombardment forced enemy units to fortify deep bunker complexes.';
      }
    }

    // 2. Frequent Stealth / Bushwhacking Adaptation
    // Enemy deploys trackers, scout patrols, and ridgeline sweepers
    const stealthCount = this.actionCounts.stealth || 0;
    if (normType === 'stealth' && stealthCount >= 2) {
      if (!this.countermeasures.has(ENEMY_COUNTERMEASURES.TRACKERS)) {
        this.countermeasures.add(ENEMY_COUNTERMEASURES.TRACKERS);
        this.modifyStat('awareness', 20);
        this.modifyStat('adaptation', 10);
        adapted = true;
        counterMeasure = ENEMY_COUNTERMEASURES.TRACKERS;
        adaptationReason = 'Frequent squad stealth and bushwhacking prompted NVA to deploy tracker dogs and scouts.';
      } else if (stealthCount >= 4 && !this.countermeasures.has(ENEMY_COUNTERMEASURES.RIDGELINE_SWEEPS)) {
        this.countermeasures.add(ENEMY_COUNTERMEASURES.RIDGELINE_SWEEPS);
        this.modifyStat('awareness', 15);
        adapted = true;
        counterMeasure = ENEMY_COUNTERMEASURES.RIDGELINE_SWEEPS;
        adaptationReason = 'Persistent infiltration caused enemy to institute systematic ridgeline sweeps.';
      }
    }

    // Broadcast ENEMY_ADAPTED if a new countermeasure was adopted
    if (adapted && this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('ENEMY_ADAPTED', {
        actionType: normType,
        counterMeasure,
        reason: adaptationReason,
        adaptation: this.adaptation,
        awareness: this.awareness,
        aggression: this.aggression,
        allCountermeasures: Array.from(this.countermeasures)
      });
    }

    // Re-evaluate strategic posture
    this.adaptStrategy();

    return {
      actionType: normType,
      adapted,
      counterMeasure,
      strategy: this.currentStrategy
    };
  }

  /**
   * Adapts the enemy's operational strategy based on player heat, squad casualties,
   * awareness, aggression, and tactical habits.
   *
   * Rules:
   * 1. High heat (> 75) or critical squad casualties (>= 3) -> Full Assault.
   * 2. High heat (> 60) or moderate squad casualties (>= 1-2) -> Hunt.
   * 3. Low heat (< 30) and stationary/holding squad -> Harassment or Ambush.
   * 4. High awareness (>= 60) while in Recon -> Ambush.
   * 5. Otherwise maintain Recon or balanced doctrine.
   *
   * @returns {string} The active strategy after adaptation.
   */
  adaptStrategy() {
    const heat = this._getCurrentHeat();
    const casualties = this._getCasualtyCount();

    // 1. Extreme Heat or heavy casualties -> Full Assault
    if (heat >= 75 || casualties >= 3) {
      this.modifyStat('aggression', 15);
      this.modifyStat('awareness', 10);
      this.setStrategy(
        ENEMY_STRATEGIES.FULL_ASSAULT,
        `Overwhelming tactical signature (Heat ${heat}) and squad attrition (${casualties} casualties) provoked Full Assault.`
      );
      return this.currentStrategy;
    }

    // 2. High Heat (> 60) or squad casualties taken -> Hunt
    if (heat > 60 || casualties >= 1) {
      this.modifyStat('aggression', 10);
      this.modifyStat('awareness', 10);
      this.setStrategy(
        ENEMY_STRATEGIES.HUNT,
        `Elevated squad heat (${heat}) and blood in the water (${casualties} casualties) initiated active Hunt.`
      );
      return this.currentStrategy;
    }

    // 3. Low Heat (< 30) and squad is stationary / defensive -> Harassment or Ambush
    const stationaryCount = this.actionCounts.stationary || 0;
    const recentAction = this.actionHistory[this.actionHistory.length - 1]?.actionType;

    if (heat < 30 && (stationaryCount >= 2 || recentAction === 'stationary')) {
      if (this.awareness >= 40) {
        this.setStrategy(
          ENEMY_STRATEGIES.AMBUSH,
          'Stationary squad in low-heat sector pinpointed for coordinated Ambush.'
        );
      } else {
        this.setStrategy(
          ENEMY_STRATEGIES.HARASSMENT,
          'Stationary target probed by long-range mortar Harassment.'
        );
      }
      return this.currentStrategy;
    }

    // 4. High awareness with moderate aggression -> Ambush
    if (this.awareness >= 60 && this.currentStrategy === ENEMY_STRATEGIES.RECON) {
      this.setStrategy(
        ENEMY_STRATEGIES.AMBUSH,
        'High enemy battlefield awareness enabled pre-planned Ambush positioning.'
      );
      return this.currentStrategy;
    }

    // 5. Default/Fallback posture
    if (this.currentStrategy === ENEMY_STRATEGIES.HUNT && heat <= 40 && casualties === 0) {
      // Heat cooled down; fall back to Recon
      this.setStrategy(
        ENEMY_STRATEGIES.RECON,
        'Squad broke contact and cooled signature; enemy reverted to Recon.'
      );
    }

    return this.currentStrategy;
  }

  /**
   * Retrieves a comprehensive snapshot of enemy adversarial state.
   * @returns {object}
   */
  getState() {
    return {
      aggression: this.aggression,
      awareness: this.awareness,
      adaptation: this.adaptation,
      currentStrategy: this.currentStrategy,
      countermeasures: Array.from(this.countermeasures),
      actionCounts: { ...this.actionCounts },
      squadCasualtiesObserved: this.squadCasualtiesObserved,
      recentActions: this.actionHistory.slice(-5)
    };
  }

  /**
   * Serializes the enemy commander state for game saving.
   * @returns {object}
   */
  serialize() {
    return {
      aggression: this.aggression,
      awareness: this.awareness,
      adaptation: this.adaptation,
      currentStrategy: this.currentStrategy,
      countermeasures: Array.from(this.countermeasures),
      actionCounts: { ...this.actionCounts },
      squadCasualtiesObserved: this.squadCasualtiesObserved,
      actionHistory: JSON.parse(JSON.stringify(this.actionHistory))
    };
  }

  /**
   * Restores enemy commander state from serialized data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.aggression !== undefined) this.aggression = this._clamp(data.aggression);
    if (data.awareness !== undefined) this.awareness = this._clamp(data.awareness);
    if (data.adaptation !== undefined) this.adaptation = this._clamp(data.adaptation);

    if (data.currentStrategy && VALID_STRATEGIES.includes(data.currentStrategy)) {
      this.currentStrategy = data.currentStrategy;
    }

    if (Array.isArray(data.countermeasures)) {
      this.countermeasures = new Set(data.countermeasures);
    }

    if (data.actionCounts && typeof data.actionCounts === 'object') {
      this.actionCounts = { ...this.actionCounts, ...data.actionCounts };
    }

    if (typeof data.squadCasualtiesObserved === 'number') {
      this.squadCasualtiesObserved = data.squadCasualtiesObserved;
    }

    if (Array.isArray(data.actionHistory)) {
      this.actionHistory = JSON.parse(JSON.stringify(data.actionHistory));
    }
  }

  /**
   * Internal handler for CHOICE_MADE events.
   * Semantic parser that detects artillery, stealth, movement, and hold actions.
   * @param {object} choice
   * @private
   */
  _handleChoiceMade(choice) {
    if (!choice || typeof choice !== 'object') return;

    const text = (choice.text || '').toLowerCase();
    const resolution = (choice.resolutionText || '').toLowerCase();
    const combined = `${text} ${resolution}`;

    let actionType = 'patrol';

    if (
      combined.includes('artillery') ||
      combined.includes('mortar') ||
      combined.includes('barrage') ||
      combined.includes('battery') ||
      choice.actionType === 'artillery'
    ) {
      actionType = 'artillery';
    } else if (
      combined.includes('air strike') ||
      combined.includes('airstrike') ||
      combined.includes('napalm') ||
      combined.includes('arclight') ||
      combined.includes('cas') ||
      choice.actionType === 'airstrike'
    ) {
      actionType = 'airstrike';
    } else if (
      combined.includes('stealth') ||
      combined.includes('sneak') ||
      combined.includes('crawl') ||
      combined.includes('bushwhack') ||
      combined.includes('quiet') ||
      combined.includes('shadow') ||
      choice.actionType === 'stealth'
    ) {
      actionType = 'stealth';
    } else if (
      combined.includes('hold') ||
      combined.includes('wait') ||
      combined.includes('defend') ||
      combined.includes('dig in') ||
      combined.includes('perimeter') ||
      choice.actionType === 'stationary'
    ) {
      actionType = 'stationary';
    } else if (
      combined.includes('assault') ||
      combined.includes('charge') ||
      combined.includes('rush') ||
      combined.includes('open fire') ||
      combined.includes('attack') ||
      choice.actionType === 'assault'
    ) {
      actionType = 'assault';
    }

    this.recordPlayerAction(actionType, { choiceText: choice.text });
  }

  /**
   * Internal handler for STAT_CHANGED events.
   * @param {object} payload
   * @private
   */
  _handleStatChanged(payload) {
    if (!payload || typeof payload !== 'object') return;

    let heatDelta = 0;
    if (payload.stat === 'heat') {
      heatDelta = payload.delta || 0;
    } else if (payload.heat !== undefined) {
      heatDelta = payload.heat;
    } else if (payload.stats && payload.stats.heat !== undefined) {
      heatDelta = payload.stats.heat;
    }

    // High heat increases enemy awareness and aggression
    if (heatDelta > 0) {
      this.modifyStat('awareness', Math.round(heatDelta * 0.4));
      this.modifyStat('aggression', Math.round(heatDelta * 0.3));
      this.adaptStrategy();
    }
  }

  /**
   * Internal handler for CASUALTY_TAKEN events.
   * Emboldens enemy forces when the squad suffers losses.
   * @param {object} payload
   * @private
   */
  _handleCasualtyTaken(payload) {
    this.squadCasualtiesObserved++;
    this.modifyStat('aggression', 15);
    this.modifyStat('awareness', 10);
    this.adaptStrategy();
  }

  /**
   * Internal handler for SCENE_RENDERED events.
   * @param {object} payload
   * @private
   */
  _handleSceneRendered(payload) {
    if (!payload || typeof payload !== 'object') return;

    // Detect if scene indicates stationary status or movement
    const desc = (payload.narrative || '').toLowerCase();
    if (desc.includes('dig in') || desc.includes('night falls') || desc.includes('await orders')) {
      this.recordPlayerAction('stationary', { sceneId: payload.id });
    } else {
      this.adaptStrategy();
    }
  }

  /**
   * Helper to retrieve current heat level from attached ledger.
   * @returns {number}
   * @private
   */
  _getCurrentHeat() {
    if (this.ledger && typeof this.ledger.getStat === 'function') {
      const val = this.ledger.getStat('heat');
      return typeof val === 'number' && !isNaN(val) ? val : 0;
    }
    return 0;
  }

  /**
   * Helper to retrieve casualty count from attached squad manager or local counter.
   * @returns {number}
   * @private
   */
  _getCasualtyCount() {
    let count = this.squadCasualtiesObserved;
    if (this.squadManager && typeof this.squadManager.getCasualties === 'function') {
      const casualties = this.squadManager.getCasualties();
      if (Array.isArray(casualties)) {
        count = Math.max(count, casualties.length);
      }
    }
    return count;
  }
}
