// Squad Leader: Vietnam - Soldier Entity
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: Soldier.js
Purpose: Represents an individual squad member entity with state tracking for health, wounds, morale, role, and traits.
Responsibilities:
- Encapsulate individual soldier operational status (healthy, wounded, kia)
- Manage primary and hidden personality traits discovered during campaign gameplay
- Track combat trauma, ballistic/shrapnel wounds, and physiological conditions
- Regulate psychological morale with bounded limits [0 - 100]
- Provide clean JSON serialization and deserialization preserving backward compatibility
Dependencies: None (Pure domain entity)
Published Events: None (Domain entity modified via system managers)
Subscribed Events: None
Future Expansion Notes: Future phases will add inventory/loadout slots, detailed hit location body maps, and persistent PTSD tracking.
--------------------------------------------------
*/

/**
 * Class representing an individual squad member in Squad Leader: Vietnam.
 * Supports primary tactical specialty, discovered hidden traits, combat wounds,
 * physiological conditions, operational status, and psychological morale.
 */
export class Soldier {
  /**
   * @param {string|number} id - Unique identifier for the soldier (e.g. 'miller', 'brady').
   * @param {string} name - Military rank and callsign or full name (e.g. 'SSG Miller').
   * @param {string} role - Military Occupational Specialty / role (e.g. 'Squad Leader').
   * @param {string} [trait='Standard'] - Primary distinctive personality trait or tactical specialty.
   * @param {string[]} [traits=[]] - Comprehensive list of all primary and unlocked hidden traits.
   * @param {string[]} [wounds=[]] - Active physical combat wounds (e.g. 'Shrapnel Arm', 'Bullet Flesh').
   * @param {string[]} [conditions=[]] - Active physiological/mental conditions (e.g. 'Pinned', 'Exhausted', 'Shaken').
   * @param {string} [status='healthy'] - Operational status: 'healthy', 'wounded', or 'kia'.
   */
  constructor(id, name, role, trait = 'Standard', traits = [], wounds = [], conditions = [], status = 'healthy') {
    this.id = id;
    this.name = name;
    this.role = role;
    this.trait = trait;

    // Initialize traits array and ensure primary trait is included
    this.traits = Array.isArray(traits) ? [...traits] : [];
    if (this.trait && !this.traits.includes(this.trait)) {
      this.traits.unshift(this.trait);
    }

    // Physical combat wounds and operational conditions
    this.wounds = Array.isArray(wounds) ? [...wounds] : [];
    this.conditions = Array.isArray(conditions) ? [...conditions] : [];

    // Operational life and status flags
    this._status = status || 'healthy';
    this.isAlive = this._status !== 'kia';
    this.morale = 100;

    // Auto-align status based on wounds if alive
    if (this.isAlive && this.wounds.length > 0) {
      this._status = 'wounded';
    }
  }

  /**
   * Check if the soldier is operational and alive.
   * @returns {boolean}
   */
  get alive() {
    return this.isAlive;
  }

  /**
   * Set the alive status of the soldier.
   * If marked dead, status is automatically transitioned to 'kia'.
   * @param {boolean} status
   */
  set alive(status) {
    this.isAlive = Boolean(status);
    if (!this.isAlive) {
      if (this._status !== 'abandoned' && this._status !== 'mia') {
        this._status = 'kia';
      }
    } else if (this._status === 'kia' || this._status === 'abandoned') {
      this._status = this.wounds.length > 0 ? 'wounded' : 'healthy';
    }
  }

  /**
   * Set the alive status of the soldier (method syntax).
   * @param {boolean} status
   */
  setAlive(status) {
    this.alive = status;
  }

  /**
   * Get operational status ('healthy', 'wounded', 'kia', or 'abandoned').
   * @returns {string}
   */
  get status() {
    if (!this.isAlive) {
      return (this._status === 'abandoned' || this._status === 'mia') ? this._status : 'kia';
    }
    if (this.wounds.length > 0) {
      return 'wounded';
    }
    return this._status || 'healthy';
  }

  /**
   * Set operational status. If set to 'kia' or 'abandoned', automatically updates isAlive to false.
   * @param {string} val
   */
  set status(val) {
    const normalized = String(val).toLowerCase();
    this._status = normalized;
    if (normalized === 'kia' || normalized === 'abandoned' || normalized === 'mia') {
      this.isAlive = false;
    } else {
      this.isAlive = true;
    }
  }

  /**
   * Explicit method to update operational status.
   * @param {string} status - 'healthy' | 'wounded' | 'kia'
   */
  setStatus(status) {
    this.status = status;
  }

  /**
   * Modify the soldier's morale clamped between 0 and 100.
   * Morale impacts performance under fire, willingness to follow risky orders, and panic thresholds.
   * @param {number} delta - Positive or negative morale change.
   */
  adjustMorale(delta) {
    this.morale = Math.max(0, Math.min(100, this.morale + Number(delta || 0)));
  }

  /**
   * Add a trait to the soldier's repertoire if not already present.
   * @param {string} traitName - Name of the trait.
   * @returns {boolean} True if newly added, false if already exists.
   */
  addTrait(traitName) {
    if (!traitName || typeof traitName !== 'string') return false;
    if (!this.traits.includes(traitName)) {
      this.traits.push(traitName);
      if (!this.trait) {
        this.trait = traitName;
      }
      return true;
    }
    return false;
  }

  /**
   * Check whether the soldier has a specific trait (checks both primary and unlocked traits).
   * @param {string} traitName
   * @returns {boolean}
   */
  hasTrait(traitName) {
    if (!traitName) return false;
    return this.traits.includes(traitName) || this.trait === traitName;
  }

  /**
   * Retrieve all traits associated with this soldier.
   * @returns {string[]}
   */
  getTraits() {
    return [...this.traits];
  }

  /**
   * Inflict a physical combat wound on the soldier.
   * Automatically adjusts status to 'wounded' if soldier is alive.
   * @param {string} wound - Description of wound (e.g. 'Shrapnel to Shoulder').
   */
  addWound(wound) {
    if (!wound) return;
    if (!this.wounds.includes(wound)) {
      this.wounds.push(wound);
      if (this.isAlive) {
        this._status = 'wounded';
      }
    }
  }

  /**
   * Treat or remove a combat wound (e.g. treated by Doc Baker).
   * Restores status to 'healthy' if no wounds remain and soldier is alive.
   * @param {string} wound
   */
  removeWound(wound) {
    const index = this.wounds.indexOf(wound);
    if (index !== -1) {
      this.wounds.splice(index, 1);
      if (this.wounds.length === 0 && this.isAlive) {
        this._status = 'healthy';
      }
    }
  }

  /**
   * Check if soldier has a specific wound.
   * @param {string} wound
   * @returns {boolean}
   */
  hasWound(wound) {
    return this.wounds.includes(wound);
  }

  /**
   * Retrieve all active combat wounds.
   * @returns {string[]}
   */
  getWounds() {
    return [...this.wounds];
  }

  /**
   * Add a physiological or situational condition.
   * @param {string} condition - e.g. 'Pinned', 'Exhausted', 'Shaken'
   */
  addCondition(condition) {
    if (!condition) return;
    if (!this.conditions.includes(condition)) {
      this.conditions.push(condition);
    }
  }

  /**
   * Remove a physiological or situational condition.
   * @param {string} condition
   */
  removeCondition(condition) {
    const index = this.conditions.indexOf(condition);
    if (index !== -1) {
      this.conditions.splice(index, 1);
    }
  }

  /**
   * Check if soldier has an active condition.
   * @param {string} condition
   * @returns {boolean}
   */
  hasCondition(condition) {
    return this.conditions.includes(condition);
  }

  /**
   * Retrieve all active conditions.
   * @returns {string[]}
   */
  getConditions() {
    return [...this.conditions];
  }

  /**
   * Serialize soldier state to a plain JavaScript object.
   * Fully includes Phase 1 enhancements: traits array, wounds, conditions, and status.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      trait: this.trait,
      traits: [...this.traits],
      wounds: [...this.wounds],
      conditions: [...this.conditions],
      status: this.status,
      isAlive: this.isAlive,
      morale: this.morale
    };
  }
}
