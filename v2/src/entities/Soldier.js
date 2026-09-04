// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * Class representing an individual squad member.
 */
export class Soldier {
  /**
   * @param {string|number} id - Unique identifier for the soldier.
   * @param {string} name - Full name or callsign of the soldier.
   * @param {string} role - Soldier's role or Military Occupational Specialty (MOS).
   * @param {string} trait - Distinctive personality trait or tactical specialty.
   */
  constructor(id, name, role, trait) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.trait = trait;
    this.isAlive = true;
    this.morale = 100;
  }

  /**
   * Check if the soldier is alive.
   * @returns {boolean}
   */
  get alive() {
    return this.isAlive;
  }

  /**
   * Set the alive status of the soldier.
   * @param {boolean} status
   */
  set alive(status) {
    this.isAlive = Boolean(status);
  }

  /**
   * Set the alive status of the soldier.
   * @param {boolean} status
   */
  setAlive(status) {
    this.isAlive = Boolean(status);
  }

  /**
   * Modify the soldier's morale clamped between 0 and 100.
   * @param {number} delta - Positive or negative morale change.
   */
  adjustMorale(delta) {
    this.morale = Math.max(0, Math.min(100, this.morale + delta));
  }

  /**
   * Serialize soldier data to a plain object.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      trait: this.trait,
      isAlive: this.isAlive,
      morale: this.morale
    };
  }
}
