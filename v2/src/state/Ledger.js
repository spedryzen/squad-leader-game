// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * Ledger tracks core game resource statistics (heat, intel, supplies) and reacts to stat change events.
 */
export class Ledger {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {object} [initialStats] - Optional initial stats values.
   */
  constructor(messageBus, initialStats = {}) {
    this.messageBus = messageBus || null;
    this.stats = {
      heat: initialStats.heat ?? 0,
      intel: initialStats.intel ?? 0,
      supplies: initialStats.supplies ?? 100,
      stress: initialStats.stress ?? 0,
      valorPoints: initialStats.valorPoints ?? 1,
      ...initialStats
    };

    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('STAT_CHANGED', (payload) => this.handleStatChanged(payload));
      this.messageBus.subscribe('GAME_LOADED', (payload) => {
        if (payload && (payload.stats || payload.ledger)) {
          this.setStats(payload.stats || payload.ledger);
        }
      });
    }
  }

  /**
   * Current heat level.
   * @returns {number}
   */
  get heat() {
    return this.stats.heat;
  }

  /**
   * Current intelligence value.
   * @returns {number}
   */
  get intel() {
    return this.stats.intel;
  }

  /**
   * Current supplies level.
   * @returns {number}
   */
  get supplies() {
    return this.stats.supplies;
  }

  /**
   * Get value of a specific stat.
   * @param {string} key
   * @returns {*}
   */
  getStat(key) {
    return this.stats[key];
  }

  /**
   * Set absolute value of a stat.
   * @param {string} key
   * @param {*} value
   */
  setStat(key, value) {
    const previous = this.stats[key];
    this.stats[key] = value;
    return { key, previous, current: value };
  }

  /**
   * Adjust stat by a numerical delta.
   * @param {string} key
   * @param {number} delta
   */
  modifyStat(key, delta) {
    const current = typeof this.stats[key] === 'number' ? this.stats[key] : 0;
    const updated = current + delta;
    this.stats[key] = updated;
    return { key, previous: current, current: updated, delta };
  }

  /**
   * Handle STAT_CHANGED event from MessageBus.
   * Accepts { stat: 'heat', value: 10 }, { stat: 'intel', delta: 5 }, or { heat: 10, supplies: 80 }.
   * @param {object} payload - Stat change descriptor.
   */
  handleStatChanged(payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const statKey = payload.stat || payload.key || payload.name;
    if (statKey) {
      if (payload.delta !== undefined) {
        this.modifyStat(statKey, payload.delta);
      } else if (payload.change !== undefined) {
        this.modifyStat(statKey, payload.change);
      } else if (payload.amount !== undefined) {
        this.modifyStat(statKey, payload.amount);
      } else if (payload.value !== undefined) {
        this.setStat(statKey, payload.value);
      }
      return;
    }

    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'number') {
        this.setStat(key, value);
      }
    }
  }

  /**
   * Return a shallow copy of all stats.
   * @returns {object}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Replace or bulk-update stats with loaded state.
   * @param {object} stats - Dictionary of stat keys and values.
   */
  setStats(stats) {
    if (stats && typeof stats === 'object') {
      this.stats = {
        heat: stats.heat ?? this.stats.heat ?? 0,
        intel: stats.intel ?? this.stats.intel ?? 0,
        supplies: stats.supplies ?? this.stats.supplies ?? 100,
        stress: stats.stress ?? this.stats.stress ?? 0,
        valorPoints: stats.valorPoints ?? this.stats.valorPoints ?? 1,
        ...stats
      };
      if (this.messageBus && typeof this.messageBus.publish === 'function') {
        this.messageBus.publish('STAT_CHANGED', { stats: this.getStats() });
      }
    }
  }

  /**
   * Reset stats to default or custom state.
   * @param {object} [newStats]
   */
  reset(newStats = {}) {
    this.stats = {
      heat: newStats.heat ?? 0,
      intel: newStats.intel ?? 0,
      supplies: newStats.supplies ?? 100,
      stress: newStats.stress ?? 0,
      valorPoints: newStats.valorPoints ?? 1,
      ...newStats
    };
  }
}
