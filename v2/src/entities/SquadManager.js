// Squad Leader: Vietnam - SquadManager Entity Manager
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: SquadManager.js
Purpose: Manages active squad roster lifecycle, roster state restoration, casualty processing, and squad status broadcasting.
Responsibilities:
- Maintain active roster of Soldier domain entities
- Handle CASUALTY_TAKEN events and broadcast rich casualty notifications for RelationshipManager and Journal
- Restore roster from serialized save games, preserving Phase 1 traits, wounds, conditions, and status
- Provide query methods for live, wounded, and fallen squad members
Dependencies: Soldier.js, MessageBus.js
Published Events:
- SQUAD_UPDATED: Dispatched whenever squad composition, casualty, or roster changes occur
Subscribed Events:
- CASUALTY_TAKEN: Triggered when a soldier falls in combat or sustains critical wounds
- GAME_LOADED: Triggered when loading saved state to restore the roster
Future Expansion Notes: Future phases will support squad formations, fireteam subdivisions, and reinforcement arrivals.
--------------------------------------------------
*/

import { Soldier } from './Soldier.js';

/**
 * SquadManager manages the active roster of Soldier instances and handles squad casualty events.
 */
export class SquadManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {Soldier[]} [initialRoster] - Optional custom initial roster.
   */
  constructor(messageBus, initialRoster = null) {
    this.messageBus = messageBus || null;
    this.soldiers = Array.isArray(initialRoster) && initialRoster.length > 0
      ? [...initialRoster]
      : this._createDefaultRoster();

    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => this.handleCasualty(payload));
      this.messageBus.subscribe('GAME_LOADED', (payload) => {
        if (payload && (payload.squad || payload.roster)) {
          this.setRoster(payload.squad || payload.roster);
        }
      });
    }
  }

  /**
   * Builds the default squad roster, ensuring CPL Brady and Duke are included.
   * @private
   * @returns {Soldier[]}
   */
  _createDefaultRoster() {
    return [
      new Soldier('miller', 'SSG Miller', 'Squad Leader', 'Battle Tested'),
      new Soldier('brady', 'CPL Brady', 'K-9 Handler', 'Canine Bond'),
      new Soldier('duke', 'Duke', 'Scout Dog', 'Alert & Loyal'),
      new Soldier('jenkins', 'PFC Jenkins', 'Point Man', 'Keen Senses'),
      new Soldier('baker', 'DOC Baker', 'Combat Medic', 'Field Surgeon'),
      new Soldier('thompson', 'CPL Thompson', 'Radio Operator', 'Signal Veteran'),
      new Soldier('torres', 'SP4 Torres', 'RTO', 'Comms Specialist'),
      new Soldier('kowalski', 'PFC Kowalski', 'Machine Gunner', 'Heavy Weapons'),
      new Soldier('washington', 'LCPL Washington', 'Grenadier', 'Demolitions')
    ];
  }

  /**
   * Handle a casualty event by updating soldier status and broadcasting squad update.
   * Supports both fatal KIA casualties and non-fatal WIA woundings.
   * @param {object|string|number} payload - Event payload containing soldier ID or the ID directly.
   */
  handleCasualty(payload) {
    const soldierId = (typeof payload === 'object' && payload !== null)
      ? (payload.soldierId ?? payload.id ?? (typeof payload.soldier === 'string' ? payload.soldier : payload.soldier?.id))
      : payload;

    const soldier = this.getSoldierById(soldierId);
    if (!soldier) return;

    // Check if payload specifies a non-fatal wounding or specific wound description
    const isWoundedOnly = typeof payload === 'object' && payload !== null && payload.status === 'wounded';
    const woundDesc = typeof payload === 'object' && payload !== null ? (payload.wound || payload.condition) : null;
    const cause = (typeof payload === 'object' && payload !== null) 
      ? (payload.cause || payload.reason || 'Enemy Fire') 
      : 'Combat Action';

    if (woundDesc) {
      soldier.addWound(woundDesc);
    }

    if (isWoundedOnly) {
      soldier.status = 'wounded';
    } else {
      soldier.isAlive = false;
      soldier.status = 'kia';
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SQUAD_UPDATED', {
        casualty: soldier,
        soldier: soldier,
        soldierId: soldier.id,
        name: soldier.name,
        role: soldier.role,
        status: soldier.status,
        cause: cause,
        soldiers: this.getSoldiers(),
        aliveCount: this.getAliveSoldiers().length,
        totalCount: this.soldiers.length
      });
    }
  }

  /**
   * Retrieve all squad members.
   * @returns {Soldier[]}
   */
  getSoldiers() {
    return [...this.soldiers];
  }

  /**
   * Retrieve currently living squad members.
   * @returns {Soldier[]}
   */
  getAliveSoldiers() {
    return this.soldiers.filter((soldier) => soldier.isAlive);
  }

  /**
   * Retrieve fallen squad members (KIA).
   * @returns {Soldier[]}
   */
  getCasualties() {
    return this.soldiers.filter((soldier) => !soldier.isAlive);
  }

  /**
   * Retrieve wounded squad members who are still alive.
   * @returns {Soldier[]}
   */
  getWoundedSoldiers() {
    return this.soldiers.filter((soldier) => soldier.isAlive && soldier.status === 'wounded');
  }

  /**
   * Find a soldier by their unique ID or name.
   * @param {string|number} id
   * @returns {Soldier|undefined}
   */
  getSoldierById(id) {
    return this.soldiers.find((s) => s.id === id || s.name === id);
  }

  /**
   * Add a new soldier to the squad roster.
   * @param {Soldier} soldier
   */
  addSoldier(soldier) {
    if (soldier instanceof Soldier) {
      this.soldiers.push(soldier);
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('SQUAD_UPDATED', {
          added: soldier,
          soldiers: this.getSoldiers(),
          aliveCount: this.getAliveSoldiers().length,
          totalCount: this.soldiers.length
        });
      }
    }
  }

  /**
   * Replace or update the squad roster from saved state or Soldier instances.
   * Preserves traits, wounds, conditions, and status attributes.
   * @param {Array<Soldier|object>} roster
   */
  setRoster(roster) {
    if (!Array.isArray(roster)) return;

    this.soldiers = roster.map((item) => {
      if (item instanceof Soldier) {
        return item;
      }
      const existing = this.getSoldierById(item.id);
      if (existing) {
        if (item.name) existing.name = item.name;
        if (item.role) existing.role = item.role;
        if (item.trait) existing.trait = item.trait;
        if (Array.isArray(item.traits)) {
          item.traits.forEach((t) => existing.addTrait(t));
        }
        if (Array.isArray(item.wounds)) {
          existing.wounds = [...item.wounds];
        }
        if (Array.isArray(item.conditions)) {
          existing.conditions = [...item.conditions];
        }
        if (item.isAlive !== undefined) existing.isAlive = Boolean(item.isAlive);
        else if (item.alive !== undefined) existing.isAlive = Boolean(item.alive);
        if (item.status) existing.status = item.status;
        if (item.morale !== undefined) existing.morale = item.morale;
        return existing;
      }

      const soldier = new Soldier(
        item.id,
        item.name || item.id,
        item.role || 'Infantry',
        item.trait || 'Standard',
        item.traits || [],
        item.wounds || [],
        item.conditions || [],
        item.status || 'healthy'
      );
      if (item.isAlive !== undefined) soldier.isAlive = Boolean(item.isAlive);
      else if (item.alive !== undefined) soldier.alive = Boolean(item.alive);
      if (item.morale !== undefined) soldier.morale = item.morale;
      return soldier;
    });

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SQUAD_UPDATED', {
        soldiers: this.getSoldiers(),
        aliveCount: this.getAliveSoldiers().length,
        totalCount: this.soldiers.length
      });
    }
  }

  /**
   * Resets squad roster to default starting configuration.
   */
  resetToDefault() {
    this.soldiers = this._createDefaultRoster();
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SQUAD_UPDATED', {
        soldiers: this.getSoldiers(),
        aliveCount: this.getAliveSoldiers().length,
        totalCount: this.soldiers.length
      });
    }
  }
}
