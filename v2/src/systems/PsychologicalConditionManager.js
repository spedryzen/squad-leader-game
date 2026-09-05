// Squad Leader: Vietnam - Psychological Conditions System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: PsychologicalConditionManager.js
Purpose: Expands transient combat stress into enduring psychological states and behavioral conditions for soldiers.
Responsibilities:
- Maintain authoritative catalog of psychological conditions (Exhausted, Hypervigilant, Survivor's Guilt, Traumatized, Combat Hardened, Blooded Veteran)
- Monitor gameplay events (stress, casualties, friend KIA, heroic acts, scene transitions) to trigger mental condition shifts
- Enforce condition uniqueness and synchronize directly with Soldier domain entities
- Broadcast CONDITION_GAINED and CONDITION_REMOVED events across the MessageBus
- Provide complete state serialization and deserialization for save game persistence
Dependencies: MessageBus.js, optional SquadManager.js
Published Events:
- CONDITION_GAINED: Dispatched when a soldier acquires a psychological condition
- CONDITION_REMOVED: Dispatched when a psychological condition is cured or resolved
Subscribed Events:
- STAT_CHANGED: Evaluates stress spikes and exhaustion thresholds
- CASUALTY_TAKEN: Evaluates combat trauma and survival guilt on high squad losses
- FRIEND_KIA: Immediately evaluates Survivor's Guilt when close friends are killed
- HEROIC_ACTION: Evaluates bravery and combat seasoning into Combat Hardened or Blooded Veteran
- SCENE_RENDERED: Evaluates fatigue and prolonged operation strain
- GAME_LOADED: Restores active conditions from saved state
Future Expansion Notes: Future phases will introduce psychiatric medevac, R&R recovery, and deep trauma triggers during night operations.
--------------------------------------------------
*/

/**
 * Psychological conditions catalog defining mental and physiological states in Squad Leader: Vietnam.
 * Each condition provides descriptive context, tactical gameplay effects, and numeric stat modifiers.
 */
export const PSYCHOLOGICAL_CONDITIONS = {
  'Exhausted': {
    name: 'Exhausted',
    category: 'physiological_negative',
    description: 'Severe physical and mental exhaustion; drains reflexes, accuracy, and endurance.',
    gameplayEffect: '-movement/accuracy, -morale recovery, burns extra stamina',
    statModifiers: {
      movementPenalty: -15,
      accuracyPenalty: -10,
      moraleRecoveryRate: -0.5,
      staminaBurnRate: 1.5
    }
  },
  'Hypervigilant': {
    name: 'Hypervigilant',
    category: 'situational_mixed',
    description: 'Extreme nervous vigilance; detects ambushes and enemy movements early, but burns supplies rapidly from chronic tension.',
    gameplayEffect: '+improved ambush/recon detection, -increased supply consumption due to nervous vigilance',
    statModifiers: {
      ambushDetection: +25,
      reconBonus: +15,
      supplyDrain: 5
    }
  },
  "Survivor's Guilt": {
    name: "Survivor's Guilt",
    category: 'psychological_negative',
    description: 'Haunted by surviving when squadmates or close comrades were killed in action.',
    gameplayEffect: '-morale, -leadership effectiveness; gained when close friends die or high squad casualties',
    statModifiers: {
      moralePenalty: -20,
      leadershipPenalty: -25,
      moraleRecoveryRate: -0.3
    }
  },
  'Traumatized': {
    name: 'Traumatized',
    category: 'psychological_negative',
    description: 'Shattered nerves caused by deafening concussive bombardment and near-miss shrapnel.',
    gameplayEffect: 'prone to panic/freeze under mortar/artillery fire',
    statModifiers: {
      panicThreshold: +30,
      artilleryFreezeChance: 0.45,
      stressResistance: -25
    }
  },
  'Combat Hardened': {
    name: 'Combat Hardened',
    category: 'psychological_positive',
    description: 'Calloused by brutal firefights; shrugs off panic and horror at the expense of emotional isolation.',
    gameplayEffect: '+high resistance to stress/panic, -slower relationship building',
    statModifiers: {
      stressResistance: +35,
      panicResistance: +40,
      relationshipGrowthRate: -0.5
    }
  },
  'Blooded Veteran': {
    name: 'Blooded Veteran',
    category: 'psychological_positive',
    description: 'Deadly, battle-proven warrior whose lethal marksmanship and composure inspire lower-rank recruits.',
    gameplayEffect: '+combat bonus, +inspires lower-rank recruits',
    statModifiers: {
      combatBonus: +20,
      recruitInspirationBonus: +15,
      accuracyBonus: +10
    }
  }
};

/**
 * Manages the acquisition, removal, persistence, and event evaluation of psychological conditions.
 */
export class PsychologicalConditionManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central event bus.
   * @param {import('../entities/SquadManager.js').SquadManager} [squadManager] - Reference to squad roster.
   */
  constructor(messageBus = null, squadManager = null) {
    this.messageBus = messageBus;
    this.squadManager = squadManager;

    /** @type {Map<string, Map<string, object>>} soldierId -> (conditionName -> conditionRecord) */
    this.conditions = new Map();

    this._setupSubscriptions();
  }

  /**
   * Register event handlers on the MessageBus to monitor combat trauma and mental shifts.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. STAT_CHANGED: Monitor stress spikes and prolonged exhaustion
    this.messageBus.subscribe('STAT_CHANGED', (payload) => {
      this.evaluateConditions({ event: 'STAT_CHANGED', ...payload });
    });

    // 2. CASUALTY_TAKEN: Monitor squad losses that trigger trauma or Survivor's Guilt
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      const soldierId = (typeof payload === 'object' && payload !== null)
        ? (payload.soldierId ?? payload.id ?? (typeof payload.soldier === 'string' ? payload.soldier : payload.soldier?.id))
        : payload;

      this.evaluateConditions({
        event: 'CASUALTY_TAKEN',
        soldierId,
        cause: payload?.cause || payload?.reason
      });
    });

    // 3. FRIEND_KIA: Monitor close friend loss to trigger Survivor's Guilt directly
    this.messageBus.subscribe('FRIEND_KIA', (payload) => {
      if (payload && payload.affectedSoldierId) {
        this.addCondition(
          payload.affectedSoldierId,
          "Survivor's Guilt",
          `Devastated by the death of close comrade ${payload.fallenName || payload.fallenSoldierId || 'in combat'}.`
        );
      }
    });

    // 4. HEROIC_ACTION: Award Combat Hardened or Blooded Veteran on heroic combat feats
    this.messageBus.subscribe('HEROIC_ACTION', (payload) => {
      const soldierId = payload?.soldierId || payload?.heroId;
      if (soldierId) {
        this.evaluateConditions({
          event: 'HEROIC_ACTION',
          soldierId,
          action: payload?.action || payload?.description
        });
      }
    });

    // 5. SCENE_RENDERED: Evaluate physical exhaustion and prolonged operational strain
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      this.evaluateConditions({ event: 'SCENE_RENDERED', scene: payload });
    });

    // 6. GAME_LOADED: Restore persisted psychological conditions from save state
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && payload.conditions) {
        this.deserialize(payload.conditions);
      }
    });
  }

  /**
   * Retrieve official catalog definition for a psychological condition.
   * @param {string} conditionName
   * @returns {object|null}
   */
  getConditionDefinition(conditionName) {
    return PSYCHOLOGICAL_CONDITIONS[conditionName] || null;
  }

  /**
   * Assign a psychological condition to a soldier.
   * Prevents duplicates, synchronizes with Soldier domain entity, and publishes CONDITION_GAINED.
   * @param {string|number} soldierId
   * @param {string} conditionName
   * @param {string} [reason='Combat Trauma']
   * @returns {boolean} True if newly added, false if already present or invalid.
   */
  addCondition(soldierId, conditionName, reason = 'Combat Trauma') {
    if (!soldierId || !conditionName) return false;

    const sId = String(soldierId).toLowerCase();

    if (!this.conditions.has(sId)) {
      this.conditions.set(sId, new Map());
    }

    const soldierMap = this.conditions.get(sId);
    if (soldierMap.has(conditionName)) {
      return false; // Condition already present
    }

    const def = this.getConditionDefinition(conditionName) || {
      name: conditionName,
      category: 'general',
      description: 'Psychological or physical condition acquired during operations.',
      gameplayEffect: 'Situational combat modifier',
      statModifiers: {}
    };

    const record = {
      name: conditionName,
      category: def.category,
      description: def.description,
      gameplayEffect: def.gameplayEffect,
      statModifiers: { ...(def.statModifiers || {}) },
      reason,
      acquiredAt: new Date().toISOString()
    };

    soldierMap.set(conditionName, record);

    // Synchronize directly with Soldier entity
    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.addCondition === 'function') {
      soldier.addCondition(conditionName);
    }

    // Apply immediate morale penalty if applicable
    if (def.statModifiers?.moralePenalty && soldier && typeof soldier.adjustMorale === 'function') {
      soldier.adjustMorale(def.statModifiers.moralePenalty);
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('CONDITION_GAINED', {
        soldierId: sId,
        soldierName: soldier?.name || sId,
        condition: conditionName,
        definition: def,
        reason,
        timestamp: record.acquiredAt
      });
    }

    return true;
  }

  /**
   * Remove a psychological condition from a soldier (recovery, treatment, or therapy).
   * Synchronizes with Soldier domain entity and publishes CONDITION_REMOVED.
   * @param {string|number} soldierId
   * @param {string} conditionName
   * @param {string} [reason='Treated or Restored']
   * @returns {boolean} True if removed, false if not found.
   */
  removeCondition(soldierId, conditionName, reason = 'Treated or Restored') {
    if (!soldierId || !conditionName) return false;

    const sId = String(soldierId).toLowerCase();
    const soldierMap = this.conditions.get(sId);

    if (!soldierMap || !soldierMap.has(conditionName)) {
      // Also check soldier entity in case it was set directly
      const soldier = this.squadManager?.getSoldierById(sId);
      if (soldier && typeof soldier.hasCondition === 'function' && soldier.hasCondition(conditionName)) {
        soldier.removeCondition(conditionName);
        return true;
      }
      return false;
    }

    soldierMap.delete(conditionName);
    if (soldierMap.size === 0) {
      this.conditions.delete(sId);
    }

    // Synchronize directly with Soldier entity
    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.removeCondition === 'function') {
      soldier.removeCondition(conditionName);
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('CONDITION_REMOVED', {
        soldierId: sId,
        soldierName: soldier?.name || sId,
        condition: conditionName,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Check if a soldier currently has a psychological condition.
   * @param {string|number} soldierId
   * @param {string} conditionName
   * @returns {boolean}
   */
  hasCondition(soldierId, conditionName) {
    if (!soldierId || !conditionName) return false;
    const sId = String(soldierId).toLowerCase();

    const soldierMap = this.conditions.get(sId);
    if (soldierMap && soldierMap.has(conditionName)) {
      return true;
    }

    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.hasCondition === 'function') {
      return soldier.hasCondition(conditionName);
    }

    return false;
  }

  /**
   * Retrieve all condition names currently affecting a soldier.
   * @param {string|number} soldierId
   * @returns {string[]}
   */
  getConditionsFor(soldierId) {
    if (!soldierId) return [];
    const sId = String(soldierId).toLowerCase();
    const names = new Set();

    const soldierMap = this.conditions.get(sId);
    if (soldierMap) {
      for (const name of soldierMap.keys()) {
        names.add(name);
      }
    }

    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.getConditions === 'function') {
      soldier.getConditions().forEach(c => names.add(c));
    }

    return Array.from(names);
  }

  /**
   * Retrieve full detailed condition records for a soldier.
   * @param {string|number} soldierId
   * @returns {object[]}
   */
  getConditionRecordsFor(soldierId) {
    if (!soldierId) return [];
    const sId = String(soldierId).toLowerCase();
    const soldierMap = this.conditions.get(sId);
    if (!soldierMap) return [];
    return Array.from(soldierMap.values());
  }

  /**
   * Evaluate gameplay context and dynamically assign conditions based on battlefield conditions.
   * Analyzes stress levels, casualties, friend deaths, heroic feats, and fatigue.
   * @param {object} context
   * @returns {object[]} Array of newly gained conditions during this evaluation cycle.
   */
  evaluateConditions(context = {}) {
    const newlyGained = [];

    // 1. Direct explicit trigger
    if (context.soldierId && context.trigger) {
      const sId = String(context.soldierId).toLowerCase();
      let conditionToAward = null;
      let reasonText = 'Triggered by battlefield event';

      switch (context.trigger) {
        case 'fatigue':
        case 'exhaustion':
          conditionToAward = 'Exhausted';
          reasonText = 'Overcome by prolonged forced marches and sleep deprivation.';
          break;
        case 'ambush_patrol':
        case 'paranoia':
          conditionToAward = 'Hypervigilant';
          reasonText = 'Paralyzing fear of unseen tripwires and jungle ambushes.';
          break;
        case 'artillery_barrage':
        case 'mortar_attack':
          conditionToAward = 'Traumatized';
          reasonText = 'Concussive terror under continuous mortar impact.';
          break;
        case 'veteran_baptism':
        case 'sustained_combat':
          conditionToAward = 'Combat Hardened';
          reasonText = 'Hardened into stoicism after surviving repeated close-quarters firefights.';
          break;
        case 'heroic_assault':
        case 'valor_recognized':
          conditionToAward = 'Blooded Veteran';
          reasonText = 'Distinguished by ruthless combat proficiency under direct enemy fire.';
          break;
        case 'friend_death':
        case 'survivor':
          conditionToAward = "Survivor's Guilt";
          reasonText = 'Haunted by survival while comrades were killed.';
          break;
        default:
          break;
      }

      if (conditionToAward && !this.hasCondition(sId, conditionToAward)) {
        if (this.addCondition(sId, conditionToAward, reasonText)) {
          newlyGained.push({ soldierId: sId, condition: conditionToAward, reason: reasonText });
        }
      }
    }

    // 2. High stress evaluations (STAT_CHANGED)
    if (context.event === 'STAT_CHANGED' && context.stat === 'stress') {
      const stressVal = Number(context.value ?? context.delta ?? 0);
      const alive = this.squadManager?.getAliveSoldiers() || [];

      if (stressVal >= 70) {
        // Severe stress: Low morale soldiers risk Traumatized or Exhausted
        for (const soldier of alive) {
          if (soldier.morale < 40 && !this.hasCondition(soldier.id, 'Traumatized')) {
            const reason = `Combat stress spiked to ${stressVal}, fracturing nerve stability.`;
            if (this.addCondition(soldier.id, 'Traumatized', reason)) {
              newlyGained.push({ soldierId: soldier.id, condition: 'Traumatized', reason });
            }
          } else if (soldier.morale >= 80 && !this.hasCondition(soldier.id, 'Combat Hardened')) {
            const reason = `Maintained stoic discipline through severe stress spike (${stressVal}).`;
            if (this.addCondition(soldier.id, 'Combat Hardened', reason)) {
              newlyGained.push({ soldierId: soldier.id, condition: 'Combat Hardened', reason });
            }
          }
        }
      }
    }

    // 3. Heat & Alertness evaluations -> Hypervigilant
    if (context.event === 'STAT_CHANGED' && context.stat === 'heat') {
      const heatVal = Number(context.value ?? context.delta ?? 0);
      if (heatVal >= 65) {
        const alive = this.squadManager?.getAliveSoldiers() || [];
        const pointMan = alive.find(s => s.role.toLowerCase().includes('point') || s.role.toLowerCase().includes('scout')) || alive[0];
        if (pointMan && !this.hasCondition(pointMan.id, 'Hypervigilant')) {
          const reason = `Extreme battlefield heat (${heatVal}) drove point scout into intense hypervigilance.`;
          if (this.addCondition(pointMan.id, 'Hypervigilant', reason)) {
            newlyGained.push({ soldierId: pointMan.id, condition: 'Hypervigilant', reason });
          }
        }
      }
    }

    // 4. Squad casualties evaluation -> Survivor's Guilt & Traumatized
    if (context.event === 'CASUALTY_TAKEN') {
      const casualties = this.squadManager?.getCasualties() || [];
      const alive = this.squadManager?.getAliveSoldiers() || [];

      // High squad losses (> 2 casualties) trigger Survivor's Guilt among remaining squad
      if (casualties.length >= 2) {
        for (const survivor of alive) {
          if (!this.hasCondition(survivor.id, "Survivor's Guilt") && survivor.morale < 60) {
            const reason = `Witnessed catastrophic squad losses (${casualties.length} KIA).`;
            if (this.addCondition(survivor.id, "Survivor's Guilt", reason)) {
              newlyGained.push({ soldierId: survivor.id, condition: "Survivor's Guilt", reason });
            }
          }
        }
      }
    }

    // 5. Heroic Actions -> Blooded Veteran or Combat Hardened
    if (context.event === 'HEROIC_ACTION' && context.soldierId) {
      const sId = String(context.soldierId).toLowerCase();
      if (!this.hasCondition(sId, 'Blooded Veteran')) {
        const reason = `Demonstrated exceptional valor and lethal efficiency: ${context.action || 'heroic action'}.`;
        if (this.addCondition(sId, 'Blooded Veteran', reason)) {
          newlyGained.push({ soldierId: sId, condition: 'Blooded Veteran', reason });
        }
      }
    }

    // 6. Scene narrative context (e.g. night march, artillery barrage)
    if (context.scene && context.scene.narrative) {
      const narrative = context.scene.narrative.toLowerCase();
      const alive = this.squadManager?.getAliveSoldiers() || [];

      // Artillery / Mortar barrage narrative
      if (narrative.includes('mortar') || narrative.includes('artillery') || narrative.includes('barrage') || narrative.includes('shelling')) {
        for (const soldier of alive) {
          if (soldier.morale < 45 && !this.hasCondition(soldier.id, 'Traumatized')) {
            const reason = 'Pinned under intense explosive bombardment.';
            if (this.addCondition(soldier.id, 'Traumatized', reason)) {
              newlyGained.push({ soldierId: soldier.id, condition: 'Traumatized', reason });
            }
          }
        }
      }

      // Exhaustion / Forced march narrative
      if (narrative.includes('forced march') || narrative.includes('exhaustion') || narrative.includes('sleepless') || narrative.includes('monsoon rain')) {
        for (const soldier of alive) {
          if (!this.hasCondition(soldier.id, 'Exhausted')) {
            const reason = 'Fatigued by continuous relentless operation without rest.';
            if (this.addCondition(soldier.id, 'Exhausted', reason)) {
              newlyGained.push({ soldierId: soldier.id, condition: 'Exhausted', reason });
            }
          }
        }
      }
    }

    return newlyGained;
  }

  /**
   * Serialize all active psychological conditions for save game persistence.
   * @returns {object} Object mapping soldierId to array of condition records.
   */
  serialize() {
    const serialized = {};
    for (const [soldierId, conditionMap] of this.conditions.entries()) {
      serialized[soldierId] = Array.from(conditionMap.values());
    }
    return serialized;
  }

  /**
   * Restore psychological conditions state from save game data.
   * Reconstructs condition maps and synchronizes soldier domain entities.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;
    this.conditions.clear();

    for (const [soldierId, records] of Object.entries(data)) {
      const sId = String(soldierId).toLowerCase();
      const soldierMap = new Map();

      if (Array.isArray(records)) {
        for (const record of records) {
          const name = typeof record === 'string' ? record : record.name;
          if (name) {
            const def = this.getConditionDefinition(name) || {};
            soldierMap.set(name, {
              name,
              category: record.category || def.category || 'general',
              description: record.description || def.description || '',
              gameplayEffect: record.gameplayEffect || def.gameplayEffect || '',
              statModifiers: record.statModifiers || def.statModifiers || {},
              reason: record.reason || 'Restored from save state',
              acquiredAt: record.acquiredAt || new Date().toISOString()
            });

            // Synchronize with Soldier entity
            const soldier = this.squadManager?.getSoldierById(sId);
            if (soldier && typeof soldier.addCondition === 'function') {
              soldier.addCondition(name);
            }
          }
        }
      }

      this.conditions.set(sId, soldierMap);
    }
  }
}
