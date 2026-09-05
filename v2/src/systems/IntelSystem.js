// Squad Leader: Vietnam - Intelligence Expansion System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: IntelSystem.js
Purpose: Converts abstract ledger intel scores into qualitative battlefield awareness and tactical clarity across 3 operational tiers.
Responsibilities:
- Maintain 3 qualitative intelligence tiers:
  * LOW (Intel 0-24): "Enemy activity suspected. Unconfirmed signals in sector."
  * MEDIUM (Intel 25-59): "Likely platoon-sized force (20-30 NVA). Patrol routes identified."
  * HIGH (Intel 60+): "12-15 enemy. 2 RPG teams. Fortified spider holes and minefield on eastern ridge confirmed."
- Provide tactical revelation assessments for battlefield targets (enemy counts, hidden trails, fortified bunkers, ambush likelihood percentage, weapon emplacements)
- Calculate tactical ambush probability modifiers based on intelligence depth (LOW: 0%, MEDIUM: -15%, HIGH: -35%)
- Track and record recon discoveries acquired through scouting, prisoner interrogation, captured documents, and aerial reconnaissance
- Publish INTEL_LEVEL_CHANGED and INTEL_RECON_ACQUIRED events over the MessageBus
- Support complete state serialization and deserialization for game persistence
Dependencies: MessageBus.js, Ledger.js
Published Events:
- INTEL_LEVEL_CHANGED: Dispatched whenever intel score crosses a tier threshold (LOW -> MEDIUM, MEDIUM -> HIGH)
- INTEL_RECON_ACQUIRED: Dispatched when a new recon discovery, trail, or fortification is logged
Subscribed Events:
- STAT_CHANGED: Monitors changes to the intel ledger stat and triggers tier evaluation
- CHOICE_MADE: Detects choices that produce recon discoveries or tactical scout findings
- GAME_LOADED: Restores serialized recon discoveries and tier state
Future Expansion Notes: Signal intelligence radio direction finding, defector debriefing minigames, and aerial photo interpretation.
--------------------------------------------------
*/

/**
 * Operational intelligence tiers in Squad Leader: Vietnam.
 */
export const INTEL_TIERS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

/**
 * Specification and qualitative descriptions for intelligence tiers.
 */
export const INTEL_TIER_DEFINITIONS = {
  [INTEL_TIERS.LOW]: {
    tier: INTEL_TIERS.LOW,
    range: [0, 24],
    description: 'Enemy activity suspected. Unconfirmed signals in sector.',
    tacticalSummary: 'Minimal situational awareness. Enemy strength, dispositions, and booby traps are completely obscured by jungle canopy.',
    clarityPercentage: 20,
    ambushModifier: 0,
    revealsEnemyCounts: false,
    revealsHiddenTrails: false,
    revealsBunkers: false,
    revealsWeaponEmplacements: false
  },
  [INTEL_TIERS.MEDIUM]: {
    tier: INTEL_TIERS.MEDIUM,
    range: [25, 59],
    description: 'Likely platoon-sized force (20-30 NVA). Patrol routes identified.',
    tacticalSummary: 'Moderate tactical clarity. Primary infiltration corridors and rough troop estimates established.',
    clarityPercentage: 60,
    ambushModifier: -15,
    revealsEnemyCounts: true,
    revealsHiddenTrails: true,
    revealsBunkers: false,
    revealsWeaponEmplacements: false
  },
  [INTEL_TIERS.HIGH]: {
    tier: INTEL_TIERS.HIGH,
    range: [60, Infinity],
    description: '12-15 enemy. 2 RPG teams. Fortified spider holes and minefield on eastern ridge confirmed.',
    tacticalSummary: 'Comprehensive battlefield intelligence. Precision enemy counts, machine gun nests, fortified bunkers, and subterranean tunnel networks mapped.',
    clarityPercentage: 95,
    ambushModifier: -35,
    revealsEnemyCounts: true,
    revealsHiddenTrails: true,
    revealsBunkers: true,
    revealsWeaponEmplacements: true
  }
};

/**
 * IntelSystem converts abstract ledger intel scores into qualitative battlefield awareness and tactical clarity.
 */
export class IntelSystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {import('../state/Ledger.js').Ledger} [ledger] - Game resource ledger.
   * @param {object} [options={}] - Configuration options.
   */
  constructor(messageBus, ledger, options = {}) {
    this.messageBus = messageBus || null;
    this.ledger = ledger || null;

    // Log of permanent recon discoveries
    this.discoveries = [];

    // Current cached tier
    const initialScore = this._getCurrentIntelScore();
    this.currentTier = this.calculateTier(initialScore);

    // Subscribe to engine lifecycle events
    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('STAT_CHANGED', (payload) => this._handleStatChanged(payload));
      this.messageBus.subscribe('CHOICE_MADE', (payload) => this._handleChoiceMade(payload));
      this.messageBus.subscribe('RADIO_DECISION', (payload) => this._handleRadioDecision(payload));
      this.messageBus.subscribe('GAME_LOADED', (payload) => this._handleGameLoaded(payload));
    }
  }

  /**
   * Calculates the intelligence tier based on a numerical score.
   * @param {number} score - Ledger intel value.
   * @returns {string} Tier from INTEL_TIERS ('LOW', 'MEDIUM', 'HIGH').
   */
  calculateTier(score) {
    const num = typeof score === 'number' && !isNaN(score) ? score : 0;
    if (num >= 60) return INTEL_TIERS.HIGH;
    if (num >= 25) return INTEL_TIERS.MEDIUM;
    return INTEL_TIERS.LOW;
  }

  /**
   * Retrieves the current active intelligence tier.
   * @param {number} [scoreOverride=null] - Optional score override.
   * @returns {string} Tier string ('LOW', 'MEDIUM', 'HIGH').
   */
  getIntelTier(scoreOverride = null) {
    if (scoreOverride !== null && scoreOverride !== undefined) {
      return this.calculateTier(scoreOverride);
    }
    if (this.ledger && typeof this.ledger.getStat === 'function') {
      const score = this._getCurrentIntelScore();
      this.currentTier = this.calculateTier(score);
    }
    return this.currentTier || INTEL_TIERS.LOW;
  }

  /**
   * Retrieves comprehensive quality assessment and tactical capabilities for current intel level.
   * @param {number} [scoreOverride=null] - Optional score override.
   * @returns {object} Intel quality profile.
   */
  getIntelQuality(scoreOverride = null) {
    const score = scoreOverride !== null && scoreOverride !== undefined
      ? scoreOverride
      : this._getCurrentIntelScore();

    const tier = this.calculateTier(score);
    const def = INTEL_TIER_DEFINITIONS[tier] || INTEL_TIER_DEFINITIONS[INTEL_TIERS.LOW];

    return {
      tier: def.tier,
      score,
      description: def.description,
      tacticalSummary: def.tacticalSummary,
      clarityPercentage: def.clarityPercentage,
      ambushModifier: def.ambushModifier,
      capabilities: {
        revealsEnemyCounts: def.revealsEnemyCounts,
        revealsHiddenTrails: def.revealsHiddenTrails,
        revealsBunkers: def.revealsBunkers,
        revealsWeaponEmplacements: def.revealsWeaponEmplacements
      }
    };
  }

  /**
   * Calculates the tactical ambush probability modifier (-35% for HIGH, -15% for MEDIUM, 0% for LOW).
   * @returns {number} Ambush percentage modifier.
   */
  getAmbushProbabilityModifier() {
    const quality = this.getIntelQuality();
    return quality.ambushModifier;
  }

  /**
   * Assesses a tactical target or objective, enriching base information with qualitative
   * revelations (enemy counts, hidden trails, fortified bunkers, ambush likelihood, weapon emplacements).
   *
   * @param {string} targetKey - Target or grid sector identifier.
   * @param {object} [baseInfo={}] - Baseline target data.
   * @returns {object} Assessed tactical target profile.
   */
  assessTarget(targetKey, baseInfo = {}) {
    const tier = this.getIntelTier();
    const quality = this.getIntelQuality();
    const baseAmbush = typeof baseInfo.ambushChance === 'number' ? baseInfo.ambushChance : 40;

    // Filter relevant recon discoveries matching this target or location
    const matchedDiscoveries = this.discoveries.filter(
      (d) => d.targetKey === targetKey || d.location === targetKey || d.targetKey === 'all'
    );

    let enemyCounts = 'Unknown contact strength (unconfirmed radio echoes)';
    let hiddenTrails = 'Trails obscured by dense canopy';
    let fortifiedBunkers = 'Unknown fortification status';
    let weaponEmplacements = 'Unconfirmed weapon systems';
    let qualitativeAssessment = quality.description;

    if (tier === INTEL_TIERS.LOW) {
      enemyCounts = 'Unknown (estimated 10 - 40 combatants)';
      hiddenTrails = 'Jungle trails unmapped; heavy dead-end risk';
      fortifiedBunkers = 'Fortifications unconfirmed';
      weaponEmplacements = 'Unknown weapon emplacements';
      qualitativeAssessment = 'Enemy activity suspected. Unconfirmed signals in sector.';
    } else if (tier === INTEL_TIERS.MEDIUM) {
      enemyCounts = 'Likely platoon-sized force (20-30 NVA)';
      hiddenTrails = 'Patrol routes identified along creek bed and ridgeline saddle';
      fortifiedBunkers = 'Suspected camouflaged earthworks in treeline';
      weaponEmplacements = 'Automatic rifle fire and light mortars reported';
      qualitativeAssessment = 'Likely platoon-sized force (20-30 NVA). Patrol routes identified.';
    } else if (tier === INTEL_TIERS.HIGH) {
      enemyCounts = '12-15 enemy. 2 RPG teams';
      hiddenTrails = 'Hidden jungle trail bypassing eastern ridge minefield confirmed';
      fortifiedBunkers = 'Fortified spider holes and minefield on eastern ridge confirmed';
      weaponEmplacements = '2 RPG-7 teams, 1 fortified RPD machine gun spider hole';
      qualitativeAssessment = '12-15 enemy. 2 RPG teams. Fortified spider holes and minefield on eastern ridge confirmed.';
    }

    // Apply specific recon discoveries if any
    for (const disc of matchedDiscoveries) {
      if (disc.type === 'bunker' || disc.type === 'fortification') {
        fortifiedBunkers = disc.description;
      } else if (disc.type === 'trail' || disc.type === 'hidden_route') {
        hiddenTrails = disc.description;
      } else if (disc.type === 'enemy_force' || disc.type === 'troop_count') {
        enemyCounts = disc.description;
      } else if (disc.type === 'weapon' || disc.type === 'emplacement') {
        weaponEmplacements = disc.description;
      }
    }

    // Effective ambush likelihood
    const effectiveAmbushLikelihood = Math.max(5, Math.min(95, baseAmbush + quality.ambushModifier));

    return {
      targetKey,
      name: baseInfo.name || targetKey,
      intelTier: tier,
      intelQuality: quality.clarityPercentage,
      qualitativeAssessment,
      enemyCounts,
      hiddenTrails,
      fortifiedBunkers,
      weaponEmplacements,
      ambushLikelihood: effectiveAmbushLikelihood,
      ambushModifierApplied: quality.ambushModifier,
      reconDiscoveries: matchedDiscoveries.map((d) => d.description)
    };
  }

  /**
   * Records a new recon discovery, logging verified tactical intelligence.
   * Prevents duplicate discoveries and publishes INTEL_RECON_ACQUIRED.
   *
   * @param {object} discovery - Discovery descriptor.
   * @param {string} discovery.type - Discovery category (e.g. 'trail', 'bunker', 'weapon', 'minefield', 'cache').
   * @param {string} discovery.description - Narrative recon report.
   * @param {string} [discovery.targetKey='general'] - Associated sector or target key.
   * @param {number} [discovery.intelBonus=0] - Optional direct intel points granted.
   * @returns {boolean} True if recorded, false if duplicate.
   */
  recordReconDiscovery(discovery) {
    if (!discovery || typeof discovery !== 'object' || !discovery.description) {
      return false;
    }

    const targetKey = discovery.targetKey || discovery.location || 'general';
    const type = discovery.type || 'observation';
    const desc = discovery.description.trim();

    // Check duplicate
    const isDuplicate = this.discoveries.some(
      (d) => (discovery.id && d.id === discovery.id) || (d.type === type && d.targetKey === targetKey && d.description === desc)
    );

    if (isDuplicate) {
      return false;
    }

    const record = {
      id: discovery.id || `recon_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      targetKey,
      description: desc,
      intelBonus: typeof discovery.intelBonus === 'number' ? discovery.intelBonus : 0,
      timestamp: new Date().toISOString()
    };

    this.discoveries.push(record);

    // Apply optional intel bonus to ledger
    if (record.intelBonus > 0 && this.messageBus) {
      this.messageBus.publish('STAT_CHANGED', {
        stat: 'intel',
        delta: record.intelBonus,
        reason: `Recon Discovery: ${record.description}`
      });
    }

    // Publish event
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('INTEL_RECON_ACQUIRED', {
        discovery: record,
        totalDiscoveries: this.discoveries.length,
        intelTier: this.getIntelTier()
      });
    }

    return true;
  }

  /**
   * Retrieves all recorded recon discoveries.
   * @returns {Array<object>}
   */
  getReconDiscoveries() {
    return [...this.discoveries];
  }

  /**
   * Alias for getReconDiscoveries.
   * @returns {Array<object>}
   */
  getDiscoveries() {
    return this.getReconDiscoveries();
  }

  /**
   * Returns current operational state snapshot.
   * @returns {{ currentTier: string, discoveries: Array<object> }}
   */
  getState() {
    return {
      currentTier: this.getIntelTier(),
      discoveries: this.getReconDiscoveries()
    };
  }

  /**
   * Serializes intelligence system state for persistence.
   * @returns {object}
   */
  serialize() {
    return {
      currentTier: this.getIntelTier(),
      discoveries: JSON.parse(JSON.stringify(this.discoveries))
    };
  }

  /**
   * Restores intelligence system state from serialized save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.currentTier && INTEL_TIER_DEFINITIONS[data.currentTier]) {
      this.currentTier = data.currentTier;
    } else {
      this.currentTier = this.calculateTier(this._getCurrentIntelScore());
    }

    this.discoveries = Array.isArray(data.discoveries)
      ? JSON.parse(JSON.stringify(data.discoveries))
      : [];
  }

  /**
   * Internal handler for STAT_CHANGED events.
   * Detects shifts across intel tier thresholds and publishes INTEL_LEVEL_CHANGED.
   * @param {object} payload
   * @private
   */
  _handleStatChanged(payload) {
    if (!payload || typeof payload !== 'object') return;

    // Check if this stat change affects intel
    let isIntelChange = false;
    let newScore = null;

    if (payload.stat === 'intel') {
      isIntelChange = true;
      newScore = typeof payload.value === 'number' ? payload.value : this._getCurrentIntelScore();
    } else if (payload.intel !== undefined) {
      isIntelChange = true;
      newScore = typeof payload.intel === 'number' ? payload.intel : this._getCurrentIntelScore();
    } else if (payload.stats && payload.stats.intel !== undefined) {
      isIntelChange = true;
      newScore = typeof payload.stats.intel === 'number' ? payload.stats.intel : this._getCurrentIntelScore();
    }

    if (!isIntelChange) return;

    const newTier = this.calculateTier(newScore);
    if (newTier !== this.currentTier) {
      const prevTier = this.currentTier;
      this.currentTier = newTier;
      const def = INTEL_TIER_DEFINITIONS[this.currentTier];

      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('INTEL_LEVEL_CHANGED', {
          previousTier: prevTier,
          newTier: this.currentTier,
          intelScore: newScore,
          tierDescription: def.description,
          quality: this.getIntelQuality(newScore)
        });
      }
    }
  }

  /**
   * Internal handler for RADIO_DECISION events.
   * Checks if selected radio choice generated recon discoveries or scout reports.
   * @param {object} payload
   * @private
   */
  _handleRadioDecision(payload) {
    if (payload && payload.choice) {
      this._handleChoiceMade(payload.choice);
    }
  }

  /**
   * Internal handler for CHOICE_MADE events.
   * Detects scout discoveries or recon findings embedded in player choices.
   * @param {object} choice
   * @private
   */
  _handleChoiceMade(choice) {
    if (!choice || typeof choice !== 'object') return;

    if (choice.reconDiscovery) {
      this.recordReconDiscovery(choice.reconDiscovery);
    } else if (choice.recon) {
      this.recordReconDiscovery({
        type: choice.recon.type || 'scout_report',
        targetKey: choice.recon.targetKey || choice.nextScene || 'general',
        description: choice.recon.description || choice.text,
        intelBonus: choice.recon.intelBonus || 0
      });
    }
  }

  /**
   * Internal handler for GAME_LOADED events.
   * @param {object} payload
   * @private
   */
  _handleGameLoaded(payload) {
    if (payload && payload.intel) {
      this.deserialize(payload.intel);
    } else {
      // Re-evaluate tier from restored ledger stats
      const score = this._getCurrentIntelScore();
      this.currentTier = this.calculateTier(score);
    }
  }

  /**
   * Helper to retrieve current intel score from attached ledger.
   * @returns {number}
   * @private
   */
  _getCurrentIntelScore() {
    if (this.ledger && typeof this.ledger.getStat === 'function') {
      const val = this.ledger.getStat('intel');
      return typeof val === 'number' && !isNaN(val) ? val : 0;
    }
    return 0;
  }
}
