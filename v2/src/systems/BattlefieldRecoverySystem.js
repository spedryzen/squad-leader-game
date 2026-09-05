// Squad Leader: Vietnam - Battlefield Recovery System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: BattlefieldRecoverySystem.js
Purpose: Provides post-engagement scavenging choices weighing tactical reward against the deadly risk of lingering under NVA observation.
Responsibilities:
- Generate 5 contextual recovery actions following firefights and ambushes:
  * Recover Documents: Inspect enemy satchels / maps (+15 to +25 Intel, +10 Heat)
  * Search Bodies: Search fallen enemy combatants (+20 Supplies, -5 Morale for younger recruits, +15 Heat)
  * Salvage Weapons: Recover AK-47s / RPG rounds (+10 Supplies, +1 Valor Point, +20 Heat)
  * Recover Equipment: Reclaim abandoned US gear / radio batteries (+15 Supplies, +5 Heat)
  * Evacuate Fallen: Recover dog tags & bodies of fallen Americans (+10 Squad Morale floor, +25 Heat)
- Enforce risk/reward calculus: each recovery action consumes critical time and increases Heat, granting the Enemy Commander time to coordinate counter-attacks
- Update Ledger, SquadManager, Journal, and EnemyCommander state accordingly
- Publish RECOVERY_OFFERED and RECOVERY_EXECUTED events
- Subscribe to SCENE_RENDERED, CHOICE_MADE, and GAME_LOADED
- Provide complete serialization and deserialization for game persistence
Dependencies: MessageBus.js, optional Ledger.js, optional SquadManager.js, optional EnemyCommander.js, optional Journal.js
Published Events:
- RECOVERY_OFFERED: Dispatched when post-combat recovery actions become available
- RECOVERY_EXECUTED: Dispatched when a commander executes a specific recovery action
Subscribed Events:
- SCENE_RENDERED: Checks for post-engagement opportunities to generate recovery actions
- CHOICE_MADE: Detects embedded recovery actions chosen by player
- GAME_LOADED: Restores recovery history from save state
Future Expansion Notes: Booby-trapped corpse minigames, intelligence decryption puzzles, and weapon malfunction chances with salvaged gear.
--------------------------------------------------
*/

/**
 * Standard recovery action keys.
 */
export const RECOVERY_OPTIONS = {
  RECOVER_DOCUMENTS: 'recover_documents',
  SEARCH_BODIES: 'search_bodies',
  SALVAGE_WEAPONS: 'salvage_weapons',
  RECOVER_EQUIPMENT: 'recover_equipment',
  EVACUATE_FALLEN: 'evacuate_fallen'
};

/**
 * Authoritative recovery action profiles with rewards, risks, and narrative descriptors.
 */
export const RECOVERY_OPTION_DEFINITIONS = {
  [RECOVERY_OPTIONS.RECOVER_DOCUMENTS]: {
    key: RECOVERY_OPTIONS.RECOVER_DOCUMENTS,
    title: 'Recover Documents',
    description: 'Inspect enemy officer satchels, operational maps, and frequency codebooks.',
    baseIntel: 20,
    intelRange: [15, 25],
    suppliesReward: 0,
    heatCost: 10,
    moraleReward: 0,
    valorPoints: 0,
    consequences: '+15 to +25 Intel, +10 Heat',
    narrativeSuccess: 'Recovered NVA regiment communication codes and sector map overlay.'
  },
  [RECOVERY_OPTIONS.SEARCH_BODIES]: {
    key: RECOVERY_OPTIONS.SEARCH_BODIES,
    title: 'Search Bodies',
    description: 'Search fallen enemy combatants for rice rations, bandoliers, and field dressings.',
    baseIntel: 0,
    suppliesReward: 20,
    heatCost: 15,
    moraleReward: -5,
    affectsRecruitsOnly: true,
    valorPoints: 0,
    consequences: '+20 Supplies, -5 Morale for younger recruits, +15 Heat',
    narrativeSuccess: 'Scavenged 20 units of rations and ammunition, though the grisly work unsettled younger recruits.'
  },
  [RECOVERY_OPTIONS.SALVAGE_WEAPONS]: {
    key: RECOVERY_OPTIONS.SALVAGE_WEAPONS,
    title: 'Salvage Weapons',
    description: 'Collect intact Type 56 assault rifles, drum magazines, and unexploded RPG-7 rockets.',
    baseIntel: 0,
    suppliesReward: 10,
    heatCost: 20,
    moraleReward: 0,
    valorPoints: 1,
    consequences: '+10 Supplies, +1 Valor Point, +20 Heat',
    narrativeSuccess: 'Captured enemy RPG launcher and rockets, bolstering defensive firepower (+1 Valor Point).'
  },
  [RECOVERY_OPTIONS.RECOVER_EQUIPMENT]: {
    key: RECOVERY_OPTIONS.RECOVER_EQUIPMENT,
    title: 'Recover Equipment',
    description: 'Reclaim abandoned US ruck packs, fresh PRC-25 radio batteries, and sterile morphine syrettes.',
    baseIntel: 0,
    suppliesReward: 15,
    heatCost: 5,
    moraleReward: 0,
    valorPoints: 0,
    consequences: '+15 Supplies, +5 Heat',
    narrativeSuccess: 'Retrieved vital radio batteries and field trauma supplies from previous patrol position.'
  },
  [RECOVERY_OPTIONS.EVACUATE_FALLEN]: {
    key: RECOVERY_OPTIONS.EVACUATE_FALLEN,
    title: 'Evacuate Fallen',
    description: 'Recover dog tags, personal effects, and bodies of fallen Americans with solemn military honor.',
    baseIntel: 0,
    suppliesReward: 0,
    heatCost: 25,
    moraleReward: 10,
    valorPoints: 0,
    consequences: '+10 Squad Morale floor, +25 Heat',
    narrativeSuccess: 'Honored our fallen brothers and secured their remains. Squad brotherhood and morale strengthened.'
  }
};

/**
 * BattlefieldRecoverySystem governs post-combat scavenging, tactical risks, and resource rewards.
 */
export class BattlefieldRecoverySystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [systems={}] - Attached system dependencies.
   * @param {import('../state/Ledger.js').Ledger} [systems.ledger] - Resource ledger.
   * @param {import('../entities/SquadManager.js').SquadManager} [systems.squadManager] - Squad manager.
   * @param {import('./EnemyCommander.js').EnemyCommander} [systems.enemyCommander] - Enemy commander AI.
   * @param {import('./Journal.js').Journal} [systems.journal] - Campaign journal.
   * @param {string} [systems.timeZone='America/Los_Angeles'] - User timezone preference (Directive 13).
   */
  constructor(messageBus, systems = {}) {
    this.messageBus = messageBus || null;
    this.ledger = systems.ledger || null;
    this.squadManager = systems.squadManager || null;
    this.enemyCommander = systems.enemyCommander || null;
    this.journal = systems.journal || null;
    this.timeZone = systems.timeZone || 'America/Los_Angeles';

    /** @type {object[]} */
    this.recoveryHistory = [];

    /** @type {object|null} */
    this.activeOfferedOptions = null;

    this._setupSubscriptions();
  }

  /**
   * Set or update active user timezone (Directive 13).
   * @param {string} tz
   */
  setTimeZone(tz) {
    if (!tz || typeof tz !== 'string') return;
    this.timeZone = tz.toUpperCase() === 'PST' ? 'America/Los_Angeles' : tz;
  }

  /**
   * Format timestamp in user's active timezone.
   * @param {Date} [date=new Date()]
   * @returns {string}
   */
  formatTimestamp(date = new Date()) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: this.timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }

  /**
   * Set up MessageBus event listeners.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. SCENE_RENDERED: Check if scene prompts battlefield recovery
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      if (!payload) return;
      const isPostCombat = payload.postCombat === true ||
        payload.recoveryAvailable === true ||
        (payload.narrative && (
          payload.narrative.toLowerCase().includes('bodies') ||
          payload.narrative.toLowerCase().includes('aftermath') ||
          payload.narrative.toLowerCase().includes('smoke clears')
        ));

      if (isPostCombat) {
        this.generateRecoveryOptions({ scene: payload });
      }
    });

    // 2. CHOICE_MADE: Check if choice executed a recovery option
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      if (payload && payload.recoveryAction) {
        this.executeRecovery(payload.recoveryAction);
      }
    });

    // 3. GAME_LOADED: Restore recovery history
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.recovery || payload.battlefieldRecovery)) {
        this.deserialize(payload.recovery || payload.battlefieldRecovery);
      }
    });
  }

  /**
   * Generates available recovery options based on battlefield engagement context.
   *
   * @param {object} [context={}] - Combat context details.
   * @returns {object[]} Array of available recovery option records.
   */
  generateRecoveryOptions(context = {}) {
    const options = [];

    // All 5 standard options are evaluated
    for (const key of Object.values(RECOVERY_OPTIONS)) {
      const def = RECOVERY_OPTION_DEFINITIONS[key];
      if (!def) continue;

      // Filter contextual eligibility if explicit context is provided
      if (context.hasAmericanCasualties === false && key === RECOVERY_OPTIONS.EVACUATE_FALLEN) {
        continue;
      }
      if (context.hasEnemyCasualties === false && (key === RECOVERY_OPTIONS.SEARCH_BODIES || key === RECOVERY_OPTIONS.SALVAGE_WEAPONS)) {
        continue;
      }

      options.push({
        ...def,
        available: true
      });
    }

    this.activeOfferedOptions = options;

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RECOVERY_OFFERED', {
        options,
        context,
        timestamp: this.formatTimestamp()
      });
    }

    return options;
  }

  /**
   * Executes a chosen recovery action, applying resource rewards and escalating enemy Heat.
   *
   * @param {string} optionKey - Identifier from RECOVERY_OPTIONS.
   * @returns {object|null} Execution report.
   */
  executeRecovery(optionKey) {
    if (!optionKey) return null;
    const def = RECOVERY_OPTION_DEFINITIONS[optionKey];
    if (!def) return null;

    const now = new Date();
    const rewardsApplied = {
      intel: 0,
      supplies: 0,
      morale: 0,
      valorPoints: 0
    };

    // 1. Calculate Intel reward
    if (def.intelRange) {
      const [min, max] = def.intelRange;
      rewardsApplied.intel = Math.floor(Math.random() * (max - min + 1)) + min;
    } else if (def.baseIntel > 0) {
      rewardsApplied.intel = def.baseIntel;
    }

    if (rewardsApplied.intel > 0) {
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('STAT_CHANGED', {
          stat: 'intel',
          delta: rewardsApplied.intel,
          reason: `Battlefield Recovery: ${def.title}`
        });
      } else if (this.ledger && typeof this.ledger.modifyStat === 'function') {
        this.ledger.modifyStat('intel', rewardsApplied.intel);
      }
    }

    // 2. Calculate Supplies reward
    if (def.suppliesReward > 0) {
      rewardsApplied.supplies = def.suppliesReward;
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('STAT_CHANGED', {
          stat: 'supplies',
          delta: rewardsApplied.supplies,
          reason: `Battlefield Recovery: ${def.title}`
        });
      } else if (this.ledger && typeof this.ledger.modifyStat === 'function') {
        this.ledger.modifyStat('supplies', rewardsApplied.supplies);
      }
    }

    // 3. Apply Heat escalation
    const heatCost = def.heatCost || 0;
    if (heatCost > 0) {
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('STAT_CHANGED', {
          stat: 'heat',
          delta: heatCost,
          reason: `Lingering to execute ${def.title}`
        });
      } else if (this.ledger && typeof this.ledger.modifyStat === 'function') {
        this.ledger.modifyStat('heat', heatCost);
      }
    }

    // 4. Inform EnemyCommander of squad lingering / scavenging
    if (this.enemyCommander && typeof this.enemyCommander.recordPlayerAction === 'function') {
      this.enemyCommander.recordPlayerAction('scavenging', {
        actionKey: optionKey,
        heatDelta: heatCost
      });
    }

    // 5. Apply Morale effects
    if (this.squadManager) {
      const aliveSoldiers = this.squadManager.getAliveSoldiers();

      if (def.key === RECOVERY_OPTIONS.EVACUATE_FALLEN) {
        // Boosts morale for the entire living squad
        rewardsApplied.morale = def.moraleReward;
        for (const soldier of aliveSoldiers) {
          if (typeof soldier.adjustMorale === 'function') {
            soldier.adjustMorale(def.moraleReward);
          }
        }
      } else if (def.key === RECOVERY_OPTIONS.SEARCH_BODIES) {
        // Unsettles younger recruits (e.g. Jenkins, Kowalski, Washington)
        rewardsApplied.morale = def.moraleReward;
        for (const soldier of aliveSoldiers) {
          const role = (soldier.role || '').toLowerCase();
          const name = (soldier.name || '').toLowerCase();
          const isRecruit = role.includes('point') || role.includes('gunner') || name.includes('jenkins') || name.includes('kowalski');
          if (isRecruit && typeof soldier.adjustMorale === 'function') {
            soldier.adjustMorale(def.moraleReward);
          }
        }
      }
    }

    // 6. Apply Valor Points
    if (def.valorPoints > 0) {
      rewardsApplied.valorPoints = def.valorPoints;
      if (this.messageBus) {
        this.messageBus.publish('VALOR_POINT_AWARDED', {
          points: def.valorPoints,
          reason: `Battlefield Recovery: ${def.title}`
        });
      }
    }

    // 7. Log to Journal
    if (this.journal && typeof this.journal.addEntry === 'function') {
      this.journal.addEntry({
        title: `Battlefield Recovery: ${def.title}`,
        category: 'COMMAND',
        content: `${def.narrativeSuccess} Heat increased by ${heatCost}. Consequences: ${def.consequences}.`,
        tags: ['RECOVERY', optionKey.toUpperCase()]
      });
    }

    const record = {
      optionKey,
      title: def.title,
      heatCost,
      rewards: rewardsApplied,
      narrativeOutcome: def.narrativeSuccess,
      timestamp: this.formatTimestamp(now),
      isoTimestamp: now.toISOString()
    };

    this.recoveryHistory.push(record);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RECOVERY_EXECUTED', {
        record,
        optionKey,
        definition: def,
        rewardsApplied,
        heatCost
      });
    }

    return record;
  }

  /**
   * Retrieves all executed recovery operations.
   * @returns {object[]}
   */
  getRecoveryHistory() {
    return [...this.recoveryHistory];
  }

  /**
   * Serializes battlefield recovery system state for game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      recoveryHistory: [...this.recoveryHistory],
      activeOfferedOptions: this.activeOfferedOptions ? [...this.activeOfferedOptions] : null,
      timeZone: this.timeZone
    };
  }

  /**
   * Restores battlefield recovery system state from save game data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    this.recoveryHistory = Array.isArray(data.recoveryHistory)
      ? [...data.recoveryHistory]
      : [];

    this.activeOfferedOptions = Array.isArray(data.activeOfferedOptions)
      ? [...data.activeOfferedOptions]
      : null;

    if (data.timeZone) {
      this.timeZone = data.timeZone;
    }
  }
}
