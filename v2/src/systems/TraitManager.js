// Squad Leader: Vietnam - Hidden Traits System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: TraitManager.js
Purpose: Discovers and manages dormant soldier traits during gameplay based on events, stress, choices, or combat actions.
Responsibilities:
- Maintain catalog of positive and negative tactical and psychological traits
- Monitor gameplay events (stress, casualties, tactical decisions) to evaluate trait discovery conditions
- Safely unlock dormant traits preventing duplicate discoveries
- Synchronize discovered traits directly with Soldier domain entities
- Broadcast TRAIT_DISCOVERED events across the MessageBus
- Support full state serialization and deserialization
Dependencies: MessageBus.js, optional SquadManager.js
Published Events:
- TRAIT_DISCOVERED: Dispatched when a soldier manifests a dormant personality or combat trait
Subscribed Events:
- STAT_CHANGED: Evaluates stress, heat, and supply thresholds for trait discovery
- CASUALTY_TAKEN: Evaluates trauma, resilience, and medical lifesaver discoveries
- CHOICE_MADE: Evaluates situational triggers (tunnel crawling, reckless charges, sharpshooting)
- GAME_LOADED: Restores discovered traits from saved state
Future Expansion Notes: Future phases will add trait synergies (e.g. Calm Under Fire + Sharpshooter = Overwatch Master) and trait evolution under prolonged trauma.
--------------------------------------------------
*/

/**
 * Trait catalog defining standard positive and negative traits in Squad Leader: Vietnam.
 */
export const TRAIT_DEFINITIONS = {
  // Positive Traits
  'Calm Under Fire': {
    category: 'positive',
    description: 'Maintains composure under intense enemy fire, resisting panic and stress.',
    combatEffect: '+25% stress resistance, steady aim under mortar fire'
  },
  'Lucky': {
    category: 'positive',
    description: 'Bizarre fortune seems to deflect fatal rounds and shrapnel.',
    combatEffect: '+20% survival roll on lethal hit, avoidance of tripwires'
  },
  'Sharpshooter': {
    category: 'positive',
    description: 'Exceptional marksmanship at medium to long range.',
    combatEffect: '+15% hit probability, precision targeting against snipers'
  },
  'Inspiring Leader': {
    category: 'positive',
    description: 'Rallies demoralized comrades through sheer personal charisma and courage.',
    combatEffect: '+10 squad morale boost when holding tactical positions'
  },
  'Jungle Hunter': {
    category: 'positive',
    description: 'Attuned to jungle sounds, foliage disturbances, and enemy scent.',
    combatEffect: '+20% ambush detection, increased intel gain in thick canopy'
  },
  'Combat Lifesaver': {
    category: 'positive',
    description: 'Swift and decisive emergency first-aid skills in the heat of battle.',
    combatEffect: '+30% chance to stabilize critical wounds and prevent KIA'
  },

  // Negative Traits
  'Panic Prone': {
    category: 'negative',
    description: 'Easily overwhelmed by deafening explosions, smoke, and close combat.',
    combatEffect: '-30% stress resistance, risk of freezing or taking cover prematurely'
  },
  'Reckless': {
    category: 'negative',
    description: 'Disregards tactical cover to charge ahead recklessly.',
    combatEffect: 'Increased vulnerability to ambushes and booby traps'
  },
  'Trigger Happy': {
    category: 'negative',
    description: 'Burns through ammunition and supplies indiscriminately into the foliage.',
    combatEffect: '-15 supplies during sustained firefights'
  },
  'Homesick': {
    category: 'negative',
    description: 'Constantly dwells on letters from home, losing focus on perimeter security.',
    combatEffect: '-5 gradual morale attrition per campaign phase'
  },
  'Superstitious': {
    category: 'negative',
    description: 'Believes in bad omens, ghosts, and jungle curses.',
    combatEffect: 'Hesitation during night operations and dense fog'
  },
  'Claustrophobic': {
    category: 'negative',
    description: 'Suffers overwhelming panic attacks inside tunnels, bunkers, and spider holes.',
    combatEffect: '-25 morale penalty and combat incapacity inside subterranean environments'
  }
};

/**
 * Manages discovery, persistence, and activation of hidden soldier traits.
 */
export class TraitManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus]
   * @param {import('../entities/SquadManager.js').SquadManager} [squadManager]
   */
  constructor(messageBus, squadManager = null) {
    this.messageBus = messageBus || null;
    this.squadManager = squadManager || null;

    /** @type {Map<string, Map<string, object>>} soldierId -> (traitName -> traitRecord) */
    this.discoveredTraits = new Map();

    this._setupSubscriptions();
  }

  /**
   * Subscribe to gameplay events to evaluate hidden trait discovery conditions.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // Monitor stat changes (stress spikes, supply drains, heat increases)
    this.messageBus.subscribe('STAT_CHANGED', (payload) => {
      this.evaluateDiscovery({ event: 'STAT_CHANGED', ...payload });
    });

    // Monitor casualties to discover Combat Lifesaver or Panic Prone
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      const soldierId = (typeof payload === 'object' && payload !== null)
        ? (payload.soldierId ?? payload.id ?? (typeof payload.soldier === 'string' ? payload.soldier : payload.soldier?.id))
        : payload;

      this.evaluateDiscovery({
        event: 'CASUALTY_TAKEN',
        soldierId: soldierId,
        cause: payload?.cause || payload?.reason
      });
    });

    // Monitor tactical choices (tunnel sweeps, reckless assaults, sniping)
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      this.evaluateDiscovery({ event: 'CHOICE_MADE', choice: payload });
    });

    // Restore state from save game
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && payload.traits) {
        this.deserialize(payload.traits);
      }
    });
  }

  /**
   * Retrieve official catalog definition for a trait.
   * @param {string} traitName
   * @returns {object|null}
   */
  getTraitDefinition(traitName) {
    return TRAIT_DEFINITIONS[traitName] || null;
  }

  /**
   * Discover and unlock a dormant trait for a specific soldier.
   * Prevents duplicate discovery and updates the domain entity.
   * @param {string|number} soldierId
   * @param {string} traitName
   * @param {string} [reason='Combat Experience']
   * @returns {boolean} True if trait was newly discovered, false if already possessed.
   */
  discoverTrait(soldierId, traitName, reason = 'Combat Experience') {
    if (!soldierId || !traitName) return false;

    const sId = String(soldierId).toLowerCase();

    if (!this.discoveredTraits.has(sId)) {
      this.discoveredTraits.set(sId, new Map());
    }

    const soldierMap = this.discoveredTraits.get(sId);
    if (soldierMap.has(traitName)) {
      return false; // Trait already discovered
    }

    const def = this.getTraitDefinition(traitName) || {
      category: 'positive',
      description: 'Tactical adaptation developed during combat.',
      combatEffect: 'Situational modifier'
    };

    const record = {
      name: traitName,
      category: def.category,
      description: def.description,
      combatEffect: def.combatEffect,
      reason: reason,
      discoveredAt: new Date().toISOString()
    };

    soldierMap.set(traitName, record);

    // Sync with Soldier domain entity if available
    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.addTrait === 'function') {
      soldier.addTrait(traitName);
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('TRAIT_DISCOVERED', {
        soldierId: sId,
        soldierName: soldier?.name || sId,
        trait: traitName,
        category: def.category,
        description: def.description,
        reason: reason,
        timestamp: record.discoveredAt
      });
    }

    return true;
  }

  /**
   * Check if a soldier has discovered or possesses a specific trait.
   * @param {string|number} soldierId
   * @param {string} traitName
   * @returns {boolean}
   */
  hasTrait(soldierId, traitName) {
    if (!soldierId || !traitName) return false;
    const sId = String(soldierId).toLowerCase();

    const soldierMap = this.discoveredTraits.get(sId);
    if (soldierMap && soldierMap.has(traitName)) {
      return true;
    }

    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.hasTrait === 'function') {
      return soldier.hasTrait(traitName);
    }

    return false;
  }

  /**
   * Retrieve all traits discovered for a soldier as an array of trait names.
   * @param {string|number} soldierId
   * @returns {string[]}
   */
  getTraitsFor(soldierId) {
    if (!soldierId) return [];
    const sId = String(soldierId).toLowerCase();
    const names = new Set();

    const soldierMap = this.discoveredTraits.get(sId);
    if (soldierMap) {
      for (const traitName of soldierMap.keys()) {
        names.add(traitName);
      }
    }

    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier && typeof soldier.getTraits === 'function') {
      soldier.getTraits().forEach(t => names.add(t));
    }

    return Array.from(names);
  }

  /**
   * Retrieve full detailed trait records for a soldier.
   * @param {string|number} soldierId
   * @returns {object[]}
   */
  getTraitRecordsFor(soldierId) {
    if (!soldierId) return [];
    const sId = String(soldierId).toLowerCase();
    const soldierMap = this.discoveredTraits.get(sId);
    if (!soldierMap) return [];
    return Array.from(soldierMap.values());
  }

  /**
   * Evaluates current gameplay context and determines if hidden traits should unlock.
   * Analyzes stress levels, casualties, environment, and tactical decisions.
   * @param {object} context
   * @returns {object[]} Array of newly discovered traits in this evaluation cycle.
   */
  evaluateDiscovery(context = {}) {
    const newlyDiscovered = [];

    // 1. Stress-based discoveries
    if (context.event === 'STAT_CHANGED' && context.stat === 'stress') {
      const stressVal = Number(context.value ?? context.delta ?? 0);
      if (stressVal >= 60) {
        // High stress: living soldiers may manifest Calm Under Fire or Panic Prone
        const alive = this.squadManager?.getAliveSoldiers() || [];
        for (const soldier of alive) {
          if (soldier.morale >= 70 && !this.hasTrait(soldier.id, 'Calm Under Fire')) {
            if (this.discoverTrait(soldier.id, 'Calm Under Fire', 'Withstood intense combat stress without flinching.')) {
              newlyDiscovered.push({ soldierId: soldier.id, trait: 'Calm Under Fire' });
            }
          } else if (soldier.morale < 35 && !this.hasTrait(soldier.id, 'Panic Prone')) {
            if (this.discoverTrait(soldier.id, 'Panic Prone', 'Combat trauma eroded psychological stability.')) {
              newlyDiscovered.push({ soldierId: soldier.id, trait: 'Panic Prone' });
            }
          }
        }
      }
    }

    // 2. Supply depletion triggers Trigger Happy
    if (context.event === 'STAT_CHANGED' && context.stat === 'supplies' && Number(context.delta) <= -15) {
      const alive = this.squadManager?.getAliveSoldiers() || [];
      const gunner = alive.find(s => s.role.toLowerCase().includes('machine') || s.role.toLowerCase().includes('gunner'));
      if (gunner && !this.hasTrait(gunner.id, 'Trigger Happy')) {
        if (this.discoverTrait(gunner.id, 'Trigger Happy', 'Expended excessive ammunition spraying the treeline.')) {
          newlyDiscovered.push({ soldierId: gunner.id, trait: 'Trigger Happy' });
        }
      }
    }

    // 3. Casualty-driven discoveries (Combat Lifesaver, Lucky)
    if (context.event === 'CASUALTY_TAKEN') {
      // If Doc Baker or a squadmate is present, evaluate Combat Lifesaver
      const medic = this.squadManager?.getSoldierById('baker');
      if (medic && medic.isAlive && !this.hasTrait('baker', 'Combat Lifesaver')) {
        if (this.discoverTrait('baker', 'Combat Lifesaver', 'Stabilized a critical battlefield casualty under fire.')) {
          newlyDiscovered.push({ soldierId: 'baker', trait: 'Combat Lifesaver' });
        }
      }
    }

    // 4. Tactical Choice context evaluation
    if (context.choice || context.event === 'CHOICE_MADE') {
      const choice = context.choice || {};
      const text = (choice.text || '').toLowerCase();
      const resolution = (choice.resolutionText || '').toLowerCase();
      const combined = `${text} ${resolution}`;

      // Subterranean / Bunker environment -> Claustrophobic
      if (combined.includes('tunnel') || combined.includes('bunker') || combined.includes('crawl') || combined.includes('spider hole')) {
        const alive = this.squadManager?.getAliveSoldiers() || [];
        // Point man or random soldier
        const pointMan = alive.find(s => s.role.toLowerCase().includes('point')) || alive[0];
        if (pointMan && !this.hasTrait(pointMan.id, 'Claustrophobic')) {
          if (this.discoverTrait(pointMan.id, 'Claustrophobic', 'Felt suffocating terror entering confined underground tunnels.')) {
            newlyDiscovered.push({ soldierId: pointMan.id, trait: 'Claustrophobic' });
          }
        }
      }

      // Aggressive / High Risk assault -> Reckless
      if (combined.includes('charge') || combined.includes('rush') || combined.includes('bayonet') || combined.includes('frontal assault')) {
        const alive = this.squadManager?.getAliveSoldiers() || [];
        const grenadier = alive.find(s => s.role.toLowerCase().includes('grenadier')) || alive[0];
        if (grenadier && !this.hasTrait(grenadier.id, 'Reckless')) {
          if (this.discoverTrait(grenadier.id, 'Reckless', 'Exposed self to danger in an aggressive combat charge.')) {
            newlyDiscovered.push({ soldierId: grenadier.id, trait: 'Reckless' });
          }
        }
      }

      // Precision / Marksman -> Sharpshooter
      if (combined.includes('sniper') || combined.includes('aim') || combined.includes('scope') || combined.includes('marksman')) {
        const alive = this.squadManager?.getAliveSoldiers() || [];
        const marksman = alive[0];
        if (marksman && !this.hasTrait(marksman.id, 'Sharpshooter')) {
          if (this.discoverTrait(marksman.id, 'Sharpshooter', 'Eliminated high-value enemy targets with precision fire.')) {
            newlyDiscovered.push({ soldierId: marksman.id, trait: 'Sharpshooter' });
          }
        }
      }

      // Inspiring leadership
      if (combined.includes('rally') || combined.includes('inspire') || combined.includes('lead') || combined.includes('command')) {
        const leader = this.squadManager?.getSoldierById('miller');
        if (leader && leader.isAlive && !this.hasTrait('miller', 'Inspiring Leader')) {
          if (this.discoverTrait('miller', 'Inspiring Leader', 'Steeled squad resolve during a desperate tactical defense.')) {
            newlyDiscovered.push({ soldierId: 'miller', trait: 'Inspiring Leader' });
          }
        }
      }
    }

    // 5. Direct triggers in context
    if (context.soldierId && context.trigger) {
      const sId = String(context.soldierId).toLowerCase();
      switch (context.trigger) {
        case 'survived_ambush':
        case 'near_miss':
          if (!this.hasTrait(sId, 'Lucky')) {
            if (this.discoverTrait(sId, 'Lucky', 'Miraculously dodged fatal fire.')) {
              newlyDiscovered.push({ soldierId: sId, trait: 'Lucky' });
            }
          }
          break;
        case 'jungle_scout':
          if (!this.hasTrait(sId, 'Jungle Hunter')) {
            if (this.discoverTrait(sId, 'Jungle Hunter', 'Identified enemy movement deep in dense jungle.')) {
              newlyDiscovered.push({ soldierId: sId, trait: 'Jungle Hunter' });
            }
          }
          break;
        case 'omen_witnessed':
          if (!this.hasTrait(sId, 'Superstitious')) {
            if (this.discoverTrait(sId, 'Superstitious', 'Shaken by bad omens in the jungle mist.')) {
              newlyDiscovered.push({ soldierId: sId, trait: 'Superstitious' });
            }
          }
          break;
        case 'letters_from_home':
          if (!this.hasTrait(sId, 'Homesick')) {
            if (this.discoverTrait(sId, 'Homesick', 'Longing for home distracted from tactical duties.')) {
              newlyDiscovered.push({ soldierId: sId, trait: 'Homesick' });
            }
          }
          break;
        default:
          break;
      }
    }

    return newlyDiscovered;
  }

  /**
   * Serialize discovered traits state for save game persistence.
   * @returns {object}
   */
  serialize() {
    const serialized = {};
    for (const [soldierId, traitMap] of this.discoveredTraits.entries()) {
      serialized[soldierId] = Array.from(traitMap.values());
    }
    return serialized;
  }

  /**
   * Restore discovered traits state from save game data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;
    this.discoveredTraits.clear();

    for (const [soldierId, records] of Object.entries(data)) {
      const sId = String(soldierId).toLowerCase();
      const soldierMap = new Map();

      if (Array.isArray(records)) {
        for (const record of records) {
          const name = typeof record === 'string' ? record : record.name;
          if (name) {
            const def = this.getTraitDefinition(name) || {};
            soldierMap.set(name, {
              name: name,
              category: record.category || def.category || 'positive',
              description: record.description || def.description || '',
              combatEffect: record.combatEffect || def.combatEffect || '',
              reason: record.reason || 'Restored from save',
              discoveredAt: record.discoveredAt || new Date().toISOString()
            });

            // Ensure soldier entity is also updated
            const soldier = this.squadManager?.getSoldierById(sId);
            if (soldier && typeof soldier.addTrait === 'function') {
              soldier.addTrait(name);
            }
          }
        }
      }

      this.discoveredTraits.set(sId, soldierMap);
    }
  }
}
