// Squad Leader: Vietnam - Dynamic Soldier Relationships System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: RelationshipManager.js
Purpose: Manages dynamic relationship networks between squad members (friendships, rivalries, mentorships, trust levels 0-100).
Responsibilities:
- Maintain relationship graph between soldiers, indexing pairs symmetrically
- Track and modify trust levels clamped between [0, 100]
- React to CASUALTY_TAKEN events: detect fallen friends, inflict morale penalties, and publish FRIEND_KIA
- Monitor stress, heat, and high-stakes choices via CHOICE_MADE to trigger RIVAL_CONFLICT events
- Leverage HEROIC_ACTION events to boost trust and forge bonds between soldiers
- Provide serialization and deserialization for save game persistence
Dependencies: MessageBus.js, optional SquadManager.js
Published Events:
- RELATIONSHIP_UPDATED: Dispatched when a relationship type or trust level changes
- TRUST_CHANGED: Dispatched when trust between two soldiers changes
- FRIEND_KIA: Dispatched when a soldier's friend or mentor is killed in action, inflicting morale penalty
- RIVAL_CONFLICT: Dispatched when tension boils over between rivals under combat stress
Subscribed Events:
- CASUALTY_TAKEN: Checks relationships of fallen soldiers to trigger friend reactions
- SQUAD_UPDATED: Synchronizes relationship states with roster modifications
- HEROIC_ACTION: Increases trust and creates mentorship/friendship bonds
- CHOICE_MADE: Evaluates rival conflict risk based on stress, heat, or choices
- GAME_LOADED: Restores relationship graph from save data
Future Expansion Notes: Future phases will support squad chemistry bonuses in combat resolution, multi-member cliques, and mutiny risk if trust collapses.
--------------------------------------------------
*/

/**
 * Dynamic relationship manager that governs interpersonal squad bonds,
 * trust dynamics, grief reactions to casualties, and rivalry conflicts.
 */
export class RelationshipManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central event bus.
   * @param {object[]|null} [initialRelationships=null] - Optional predefined relationship list.
   * @param {import('../entities/SquadManager.js').SquadManager} [squadManager=null] - SquadManager reference.
   */
  constructor(messageBus, initialRelationships = null, squadManager = null) {
    this.messageBus = messageBus || null;
    this.squadManager = squadManager || null;
    /** @type {Map<string, object>} */
    this.relationships = new Map();

    if (Array.isArray(initialRelationships)) {
      this.deserialize(initialRelationships);
    } else {
      this._initDefaultRelationships();
    }

    this._setupSubscriptions();
  }

  /**
   * Helper to generate a symmetric key for two soldier IDs so order does not matter.
   * @private
   * @param {string|number} id1
   * @param {string|number} id2
   * @returns {string}
   */
  _makeKey(id1, id2) {
    const s1 = String(id1).toLowerCase();
    const s2 = String(id2).toLowerCase();
    return s1 < s2 ? `${s1}:${s2}` : `${s2}:${s1}`;
  }

  /**
   * Initialize standard historical bonds within the default Khe Sanh squad.
   * E.g., CPL Brady and Duke share an unbreakable canine bond; SSG Miller mentors PFC Jenkins.
   * @private
   */
  _initDefaultRelationships() {
    this.setRelationship('brady', 'duke', 'friendship', 100);
    this.setRelationship('miller', 'jenkins', 'mentorship', 80);
    this.setRelationship('miller', 'thompson', 'friendship', 75);
    this.setRelationship('baker', 'kowalski', 'friendship', 70);
    this.setRelationship('kowalski', 'torres', 'rivalry', 25);
    this.setRelationship('jenkins', 'washington', 'friendship', 65);
  }

  /**
   * Register event subscriptions with the MessageBus.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // React to fallen soldiers
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      const soldierId = (typeof payload === 'object' && payload !== null)
        ? (payload.soldierId ?? payload.id ?? (typeof payload.soldier === 'string' ? payload.soldier : payload.soldier?.id))
        : payload;

      if (soldierId) {
        this.checkCasualtyReactions(soldierId);
      }
    });

    // React to squad roster changes
    this.messageBus.subscribe('SQUAD_UPDATED', (payload) => {
      if (payload && payload.casualty) {
        const id = payload.casualty.id || payload.soldierId;
        if (id) this.checkCasualtyReactions(id);
      }
    });

    // React to heroic actions (e.g. medic stabilizing comrade or point man drawing fire)
    this.messageBus.subscribe('HEROIC_ACTION', (payload) => {
      if (payload && payload.heroId) {
        if (payload.targetId) {
          const boost = Number(payload.trustDelta || 20);
          this.modifyTrust(payload.heroId, payload.targetId, boost);
        }
      }
    });

    // React to tactical choices and evaluate rival tensions under heat/stress
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      this._evaluateRivalConflictsOnChoice(payload);
    });

    // React to save game loading
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && payload.relationships) {
        this.deserialize(payload.relationships);
      }
    });
  }

  /**
   * Set or update a relationship between two soldiers.
   * @param {string|number} soldierId1
   * @param {string|number} soldierId2
   * @param {'friendship'|'rivalry'|'mentorship'|'neutral'|string} type - Relationship archetype.
   * @param {number|object} [value] - Trust level (0-100) or configuration object.
   * @returns {object} The created/updated relationship record.
   */
  setRelationship(soldierId1, soldierId2, type, value) {
    if (!soldierId1 || !soldierId2 || soldierId1 === soldierId2) {
      throw new Error('Relationship requires two distinct, valid soldier identifiers.');
    }

    const key = this._makeKey(soldierId1, soldierId2);
    let trust = 50;

    if (typeof value === 'number') {
      trust = value;
    } else if (value && typeof value.trust === 'number') {
      trust = value.trust;
    } else {
      // Default baseline trust by archetype
      switch (String(type).toLowerCase()) {
        case 'friendship':
        case 'friend':
          trust = 75;
          break;
        case 'mentorship':
        case 'mentor':
          trust = 70;
          break;
        case 'rivalry':
        case 'rival':
          trust = 25;
          break;
        default:
          trust = 50;
          break;
      }
    }

    // Clamp trust within [0, 100]
    trust = Math.max(0, Math.min(100, Math.round(trust)));

    const normalizedType = String(type).toLowerCase();
    const existing = this.relationships.get(key);
    const history = existing && Array.isArray(existing.history) ? [...existing.history] : [];

    history.push({
      timestamp: new Date().toISOString(),
      event: 'SET_RELATIONSHIP',
      type: normalizedType,
      trust: trust
    });

    const record = {
      soldierId1: String(soldierId1).toLowerCase(),
      soldierId2: String(soldierId2).toLowerCase(),
      type: normalizedType,
      trust: trust,
      history: history
    };

    this.relationships.set(key, record);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RELATIONSHIP_UPDATED', {
        soldierId1: record.soldierId1,
        soldierId2: record.soldierId2,
        type: record.type,
        trust: record.trust
      });
    }

    return record;
  }

  /**
   * Retrieve the relationship between two squad members.
   * @param {string|number} soldierId1
   * @param {string|number} soldierId2
   * @returns {object|null}
   */
  getRelationship(soldierId1, soldierId2) {
    if (!soldierId1 || !soldierId2) return null;
    const key = this._makeKey(soldierId1, soldierId2);
    return this.relationships.get(key) || null;
  }

  /**
   * Retrieve all relationships associated with a given soldier.
   * @param {string|number} soldierId
   * @returns {object[]}
   */
  getRelationshipsFor(soldierId) {
    if (!soldierId) return [];
    const target = String(soldierId).toLowerCase();
    const results = [];

    for (const record of this.relationships.values()) {
      if (record.soldierId1 === target || record.soldierId2 === target) {
        results.push({ ...record });
      }
    }

    return results;
  }

  /**
   * Modify the trust score between two soldiers by a relative delta.
   * Automatically adapts relationship type if trust crosses critical boundaries.
   * @param {string|number} soldierId1
   * @param {string|number} soldierId2
   * @param {number} delta - Positive or negative trust adjustment.
   * @returns {number} The updated trust level [0, 100].
   */
  modifyTrust(soldierId1, soldierId2, delta) {
    const key = this._makeKey(soldierId1, soldierId2);
    let record = this.relationships.get(key);

    if (!record) {
      record = this.setRelationship(soldierId1, soldierId2, 'neutral', 50);
    }

    const oldTrust = record.trust;
    const newTrust = Math.max(0, Math.min(100, Math.round(oldTrust + Number(delta || 0))));
    record.trust = newTrust;

    // Record audit trail in history
    record.history.push({
      timestamp: new Date().toISOString(),
      event: 'TRUST_MODIFIED',
      delta: delta,
      oldTrust: oldTrust,
      newTrust: newTrust
    });

    // Auto-evolve archetype if extreme trust is reached
    if (record.type === 'neutral') {
      if (newTrust >= 80) record.type = 'friendship';
      else if (newTrust <= 20) record.type = 'rivalry';
    } else if (record.type === 'rivalry' && newTrust >= 60) {
      record.type = 'neutral';
    } else if (record.type === 'friendship' && newTrust <= 30) {
      record.type = 'neutral';
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('TRUST_CHANGED', {
        soldierId1: record.soldierId1,
        soldierId2: record.soldierId2,
        oldTrust: oldTrust,
        newTrust: newTrust,
        delta: delta
      });

      this.messageBus.publish('RELATIONSHIP_UPDATED', {
        soldierId1: record.soldierId1,
        soldierId2: record.soldierId2,
        type: record.type,
        trust: record.trust
      });
    }

    return newTrust;
  }

  /**
   * When a soldier is KIA, checks relationship network to determine emotional fallout.
   * Friends suffer severe morale shock, and FRIEND_KIA events are published.
   * @param {string|number} fallenSoldierId
   * @returns {object[]} Array of reaction reports generated.
   */
  checkCasualtyReactions(fallenSoldierId) {
    if (!fallenSoldierId) return [];
    const fallenId = String(fallenSoldierId).toLowerCase();
    const related = this.getRelationshipsFor(fallenId);
    const reactions = [];

    const fallenSoldier = this.squadManager?.getSoldierById(fallenId);

    for (const rel of related) {
      const isSoldier1 = rel.soldierId1 === fallenId;
      const otherId = isSoldier1 ? rel.soldierId2 : rel.soldierId1;
      const survivingSoldier = this.squadManager?.getSoldierById(otherId);

      // Skip if surviving soldier is already dead
      if (survivingSoldier && !survivingSoldier.isAlive) {
        continue;
      }

      // Check if this bond constitutes a friendship or high trust connection
      const isFriend = rel.type === 'friendship' || rel.trust >= 65;
      const isMentor = rel.type === 'mentorship';

      if (isFriend || isMentor) {
        // Morale penalty scales with trust: higher trust = deeper psychological trauma
        const basePenalty = isFriend ? 20 : 15;
        const trustBonusPenalty = Math.round((rel.trust / 100) * 10);
        const totalPenalty = basePenalty + trustBonusPenalty;

        if (survivingSoldier && typeof survivingSoldier.adjustMorale === 'function') {
          survivingSoldier.adjustMorale(-totalPenalty);
        }

        const reaction = {
          fallenSoldierId: fallenId,
          affectedSoldierId: otherId,
          fallenName: fallenSoldier?.name || fallenId,
          affectedName: survivingSoldier?.name || otherId,
          relationshipType: rel.type,
          trust: rel.trust,
          moralePenalty: totalPenalty
        };

        reactions.push(reaction);

        if (this.messageBus && typeof this.messageBus.publish === 'function') {
          this.messageBus.publish('FRIEND_KIA', reaction);
        }
      }
    }

    return reactions;
  }

  /**
   * Explicitly triggers a conflict between rival soldiers.
   * Reduces morale and publishes RIVAL_CONFLICT.
   * @param {string|number} soldierId1
   * @param {string|number} soldierId2
   * @param {string} [reason='Combat Tension']
   * @returns {object} Conflict details.
   */
  triggerRivalConflict(soldierId1, soldierId2, reason = 'Combat Tension') {
    const s1Id = String(soldierId1).toLowerCase();
    const s2Id = String(soldierId2).toLowerCase();

    const s1 = this.squadManager?.getSoldierById(s1Id);
    const s2 = this.squadManager?.getSoldierById(s2Id);

    // Morale penalty inflicted due to infighting/conflict
    const penalty = 10;
    if (s1 && typeof s1.adjustMorale === 'function') s1.adjustMorale(-penalty);
    if (s2 && typeof s2.adjustMorale === 'function') s2.adjustMorale(-penalty);

    // Trust degrades further
    this.modifyTrust(s1Id, s2Id, -10);

    const conflict = {
      soldier1Id: s1Id,
      soldier2Id: s2Id,
      soldier1Name: s1?.name || s1Id,
      soldier2Name: s2?.name || s2Id,
      reason: reason,
      moralePenalty: penalty
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RIVAL_CONFLICT', conflict);
    }

    return conflict;
  }

  /**
   * Evaluate rivalries when tactical choices are made, particularly under high stress or heat.
   * @private
   * @param {object} choicePayload
   */
  _evaluateRivalConflictsOnChoice(choicePayload) {
    if (!choicePayload) return;

    // Check all active rivalries
    for (const rel of this.relationships.values()) {
      if (rel.type === 'rivalry' || rel.trust <= 25) {
        const s1 = this.squadManager?.getSoldierById(rel.soldierId1);
        const s2 = this.squadManager?.getSoldierById(rel.soldierId2);

        // Both must be alive to engage in interpersonal conflict
        if (s1 && s2 && s1.isAlive && s2.isAlive) {
          // If choice implies high danger or stress, trigger conflict
          const isHighStakes = choicePayload.events?.some(e => e.type === 'STAT_CHANGED' && (e.payload?.heat > 0 || e.payload?.stress > 0));
          if (isHighStakes) {
            this.triggerRivalConflict(
              rel.soldierId1,
              rel.soldierId2,
              `Dispute over orders: "${choicePayload.text || 'Tactical Order'}"`
            );
          }
        }
      }
    }
  }

  /**
   * Calculates a rescue or combat assistance modifier based on trust level.
   * High trust improves rescue chances; deep rivalries cause hesitation.
   * @param {string|number} rescuerId
   * @param {string|number} targetId
   * @returns {number} Percentage modifier (e.g. +20 for 20% bonus, -15 for 15% penalty).
   */
  getRescueChanceModifier(rescuerId, targetId) {
    const rel = this.getRelationship(rescuerId, targetId);
    if (!rel) return 0;

    let modifier = 0;
    if (rel.trust >= 50) {
      // Up to +25% bonus for high trust
      modifier += Math.round((rel.trust - 50) * 0.5);
    } else {
      // Up to -20% penalty for rivalry
      modifier -= Math.round((50 - rel.trust) * 0.4);
    }

    if (rel.type === 'friendship') modifier += 10;
    if (rel.type === 'mentorship') modifier += 5;

    return modifier;
  }

  /**
   * Serialize all relationships to a plain JSON-compatible array.
   * @returns {object[]}
   */
  serialize() {
    return Array.from(this.relationships.values()).map(r => ({
      soldierId1: r.soldierId1,
      soldierId2: r.soldierId2,
      type: r.type,
      trust: r.trust,
      history: r.history || []
    }));
  }

  /**
   * Restore relationship state from serialized data.
   * @param {object[]} data
   */
  deserialize(data) {
    if (!Array.isArray(data)) return;
    this.relationships.clear();

    for (const item of data) {
      if (item && item.soldierId1 && item.soldierId2) {
        const key = this._makeKey(item.soldierId1, item.soldierId2);
        this.relationships.set(key, {
          soldierId1: String(item.soldierId1).toLowerCase(),
          soldierId2: String(item.soldierId2).toLowerCase(),
          type: item.type || 'neutral',
          trust: Math.max(0, Math.min(100, item.trust ?? 50)),
          history: Array.isArray(item.history) ? [...item.history] : []
        });
      }
    }
  }
}
