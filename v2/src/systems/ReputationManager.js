// Squad Leader: Vietnam - Command Reputation System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: ReputationManager.js
Purpose: Tracks player leadership style across 6 archetypes based on decisions made in combat.
Responsibilities:
- Quantify player tactical doctrine across 6 archetypes: Aggressive, Reliable, Tactical, Protector, Ruthless, Jungle Ghost
- Evaluate tactical choices, casualties, and heroic actions to dynamically adjust reputation scores [0 - 100]
- Identify current primaryReputation archetype and compute active doctrine perks
- Broadcast REPUTATION_CHANGED events when scores or primary archetype shift
- Provide state serialization and deserialization for save game persistence
Dependencies: MessageBus.js
Published Events:
- REPUTATION_CHANGED: Dispatched when reputation scores or primary leadership archetype changes
Subscribed Events:
- CHOICE_MADE: Evaluates player tactical decisions and adjusts corresponding archetypes
- CASUALTY_TAKEN: Evaluates command accountability and impacts Protector or Ruthless scores
- HEROIC_ACTION: Boosts Protector, Aggressive, or Reliable scores based on context
- GAME_LOADED: Restores reputation scores and history from save state
Future Expansion Notes: Future phases will unlock specialized support assets (e.g. Spooky AC-47 gunships, MACV-SOG reconnaissance) based on reputation levels.
--------------------------------------------------
*/

/**
 * Catalog defining the 6 leadership archetypes and their distinctive doctrine perks.
 */
export const REPUTATION_ARCHETYPES = {
  'Aggressive': {
    name: 'Aggressive',
    description: 'Calls heavy fire missions, charges enemy lines, and employs overwhelming kinetic violence of action.',
    perk: '+1 Fire Support Availability, +15% assault suppression effectiveness',
    bonusEffects: { fireSupportPriority: true, assaultBonus: 15 }
  },
  'Reliable': {
    name: 'Reliable',
    description: 'Completes objectives with minimal losses through steady, disciplined, and methodical leadership.',
    perk: 'Priority reinforcements and elite replacement personnel',
    bonusEffects: { reinforcementQuality: 'elite', supplyConservation: 10 }
  },
  'Tactical': {
    name: 'Tactical',
    description: 'Uses scouting, flanking, fire-and-maneuver, and indirect approaches to defeat the enemy.',
    perk: '+25% ambush detection, -15% casualty vulnerability during tactical maneuvers',
    bonusEffects: { ambushDetectionBonus: 25, flankingAdvantage: 15 }
  },
  'Protector': {
    name: 'Protector',
    description: 'Prioritizes saving wounded personnel, medical evacuation, and sustaining squad cohesion.',
    perk: '+20 squad morale resilience floor, +15 base squad trust',
    bonusEffects: { moraleFloorBonus: 20, squadTrustBonus: 15 }
  },
  'Ruthless': {
    name: 'Ruthless',
    description: 'Willing to sacrifice soldiers and tactical positions to achieve mission objectives at any cost.',
    perk: '+15% combat expediency and rapid objective completion (-15 squad trust)',
    bonusEffects: { combatExpediencyBonus: 15, trustPenalty: -15 }
  },
  'Jungle Ghost': {
    name: 'Jungle Ghost',
    description: 'Employs silent movement, evasion, camouflage, and jungle concealment to avoid detection.',
    perk: '+30% ambush evasion, unlocks covert reconnaissance paths and silent takedowns',
    bonusEffects: { stealthBonus: 30, ambushAvoidance: 30 }
  }
};

/**
 * Manages player leadership reputation across 6 archetypes, evaluating decisions and granting perks.
 */
export class ReputationManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus]
   * @param {object} [initialScores={}]
   */
  constructor(messageBus = null, initialScores = {}) {
    this.messageBus = messageBus;

    /** @type {Record<string, number>} Archetype scores clamped [0, 100] */
    this.scores = {
      'Aggressive': 0,
      'Reliable': 0,
      'Tactical': 0,
      'Protector': 0,
      'Ruthless': 0,
      'Jungle Ghost': 0,
      ...initialScores
    };

    /** @type {Array<object>} History of reputation adjustments */
    this.history = [];

    this._setupSubscriptions();
  }

  /**
   * Register event listeners on the MessageBus to react to choices, casualties, and actions.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. CHOICE_MADE: Evaluate player decisions
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      this.evaluateChoice(payload);
    });

    // 2. CASUALTY_TAKEN: Update Protector / Ruthless based on loss contexts
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      if (payload && payload.abandoned) {
        this.modifyReputation('Ruthless', +10);
      } else if (payload && payload.rescued) {
        this.modifyReputation('Protector', +10);
      }
    });

    // 3. HEROIC_ACTION: Elevate Protector, Aggressive, or Reliable
    this.messageBus.subscribe('HEROIC_ACTION', (payload) => {
      const type = payload?.archetype || (payload?.action?.toLowerCase().includes('charge') ? 'Aggressive' : 'Protector');
      if (this.scores[type] !== undefined) {
        this.modifyReputation(type, +10);
      }
    });

    // 4. GAME_LOADED: Restore persisted reputation data
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && payload.reputation) {
        this.deserialize(payload.reputation);
      }
    });
  }

  /**
   * Modify reputation score for an archetype clamped between 0 and 100.
   * Dispatches REPUTATION_CHANGED event on the MessageBus.
   * @param {string} type - 'Aggressive' | 'Reliable' | 'Tactical' | 'Protector' | 'Ruthless' | 'Jungle Ghost'
   * @param {number} delta - Positive or negative change.
   * @returns {number} The updated score.
   */
  modifyReputation(type, delta) {
    if (!REPUTATION_ARCHETYPES[type]) {
      console.warn(`ReputationManager: Unknown archetype "${type}"`);
      return 0;
    }

    const previousPrimary = this.getPrimaryReputation();
    const current = this.scores[type] || 0;
    const nextScore = Math.max(0, Math.min(100, current + Number(delta || 0)));
    this.scores[type] = nextScore;

    const newPrimary = this.getPrimaryReputation();

    const changeRecord = {
      type,
      delta,
      newScore: nextScore,
      previousPrimary,
      newPrimary,
      timestamp: new Date().toISOString()
    };
    this.history.push(changeRecord);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('REPUTATION_CHANGED', {
        type,
        delta,
        newScore: nextScore,
        scores: this.getScores(),
        primaryReputation: newPrimary,
        previousPrimary,
        perks: this.getPerks(),
        timestamp: changeRecord.timestamp
      });
    }

    return nextScore;
  }

  /**
   * Get all archetype reputation scores.
   * @returns {Record<string, number>}
   */
  getScores() {
    return { ...this.scores };
  }

  /**
   * Get current score for a specific archetype.
   * @param {string} type
   * @returns {number}
   */
  getScore(type) {
    return this.scores[type] || 0;
  }

  /**
   * Determine the current primary reputation archetype (archetype with highest score).
   * Defaults to 'Reliable' if all scores are 0 or tied at baseline.
   * @returns {string}
   */
  getPrimaryReputation() {
    let highestScore = -1;
    let leadingArchetype = 'Reliable';

    const order = ['Aggressive', 'Reliable', 'Tactical', 'Protector', 'Ruthless', 'Jungle Ghost'];

    for (const archetype of order) {
      const score = this.scores[archetype] ?? 0;
      if (score > highestScore && score > 0) {
        highestScore = score;
        leadingArchetype = archetype;
      }
    }

    return leadingArchetype;
  }

  /**
   * Retrieve active perks based on primary reputation and archetypes scoring >= 40.
   * @returns {Array<{ archetype: string, perk: string, isPrimary: boolean, score: number }>}
   */
  getPerks() {
    const primary = this.getPrimaryReputation();
    const perks = [];

    for (const [archetype, def] of Object.entries(REPUTATION_ARCHETYPES)) {
      const score = this.scores[archetype] || 0;
      const isPrimary = archetype === primary;

      if (isPrimary || score >= 40) {
        perks.push({
          archetype,
          perk: def.perk,
          isPrimary,
          score
        });
      }
    }

    return perks;
  }

  /**
   * Evaluate tactical choices made by the player and modify corresponding archetype scores.
   * Inspects explicit reputation modifiers, archetype tags, and narrative keywords.
   * @param {object} choicePayload
   * @returns {Array<{ type: string, delta: number }>} Array of applied reputation modifications.
   */
  evaluateChoice(choicePayload) {
    if (!choicePayload || typeof choicePayload !== 'object') return [];
    const applied = [];

    // 1. Direct explicit reputation object e.g. { reputation: { Aggressive: 10, Ruthless: 5 } }
    if (choicePayload.reputation && typeof choicePayload.reputation === 'object') {
      for (const [type, delta] of Object.entries(choicePayload.reputation)) {
        if (REPUTATION_ARCHETYPES[type]) {
          this.modifyReputation(type, delta);
          applied.push({ type, delta });
        }
      }
      return applied;
    }

    // 2. Direct archetype property e.g. { archetype: 'Tactical', delta: 10 }
    if (choicePayload.archetype && REPUTATION_ARCHETYPES[choicePayload.archetype]) {
      const delta = Number(choicePayload.delta || 10);
      this.modifyReputation(choicePayload.archetype, delta);
      applied.push({ type: choicePayload.archetype, delta });
      return applied;
    }

    // 3. Keyword and semantic content analysis
    const text = `${choicePayload.id || ''} ${choicePayload.text || ''} ${choicePayload.resolutionText || ''}`.toLowerCase();

    // Aggressive keywords
    if (
      text.includes('artillery') || text.includes('airstrike') || text.includes('napalm') ||
      text.includes('mortar') || text.includes('charge') || text.includes('assault') ||
      text.includes('heavy fire') || text.includes('spray') || text.includes('gunship') ||
      text.includes('rocket') || text.includes('grenade')
    ) {
      this.modifyReputation('Aggressive', +10);
      applied.push({ type: 'Aggressive', delta: 10 });
    }

    // Reliable keywords
    if (
      text.includes('hold ground') || text.includes('secure perimeter') || text.includes('dig in') ||
      text.includes('steady') || text.includes('defend') || text.includes('reinforce') ||
      text.includes('discipline') || text.includes('consolidate') || text.includes('checkpoint')
    ) {
      this.modifyReputation('Reliable', +10);
      applied.push({ type: 'Reliable', delta: 10 });
    }

    // Tactical keywords
    if (
      text.includes('flank') || text.includes('probe') || text.includes('scout') ||
      text.includes('recon') || text.includes('maneuver') || text.includes('smoke') ||
      text.includes('sniper') || text.includes('indirect') || text.includes('overwatch') ||
      text.includes('crossfire')
    ) {
      this.modifyReputation('Tactical', +10);
      applied.push({ type: 'Tactical', delta: 10 });
    }

    // Protector keywords
    if (
      text.includes('medic') || text.includes('save') || text.includes('rescue') ||
      text.includes('evac') || text.includes('treat') || text.includes('bandage') ||
      text.includes('carry wounded') || text.includes('baker') || text.includes('shield') ||
      text.includes('defend wounded')
    ) {
      this.modifyReputation('Protector', +10);
      applied.push({ type: 'Protector', delta: 10 });
    }

    // Ruthless keywords
    if (
      text.includes('sacrifice') || text.includes('leave behind') || text.includes('abandon') ||
      text.includes('expendable') || text.includes('press on regardless') || text.includes('ignore wounded') ||
      text.includes('brutal') || text.includes('no prisoners')
    ) {
      this.modifyReputation('Ruthless', +10);
      applied.push({ type: 'Ruthless', delta: 10 });
    }

    // Jungle Ghost keywords
    if (
      text.includes('stealth') || text.includes('crawl') || text.includes('silence') ||
      text.includes('shadow') || text.includes('avoid contact') || text.includes('bypass') ||
      text.includes('camouflage') || text.includes('spider hole') || text.includes('creeping') ||
      text.includes('unseen')
    ) {
      this.modifyReputation('Jungle Ghost', +10);
      applied.push({ type: 'Jungle Ghost', delta: 10 });
    }

    return applied;
  }

  /**
   * Serialize reputation state for save game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      scores: { ...this.scores },
      primaryReputation: this.getPrimaryReputation(),
      history: [...this.history]
    };
  }

  /**
   * Restore reputation state from save game data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.scores && typeof data.scores === 'object') {
      for (const [type, val] of Object.entries(data.scores)) {
        if (this.scores[type] !== undefined) {
          this.scores[type] = Math.max(0, Math.min(100, Number(val || 0)));
        }
      }
    }

    if (Array.isArray(data.history)) {
      this.history = [...data.history];
    }
  }
}
