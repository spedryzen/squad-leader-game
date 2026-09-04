// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * SaveManager handles auto-saving and loading game state to/from HTML5 localStorage.
 * Subscribes to SCENE_RENDERED events to serialize current progress (scene ID, ledger stats, squad status).
 */
export class SaveManager {
  /**
   * @param {import('./MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {import('./SceneManager.js').SceneManager} [sceneManager] - Active scene manager.
   * @param {import('../entities/SquadManager.js').SquadManager} [squadManager] - Active squad manager.
   * @param {import('../state/Ledger.js').Ledger} [ledger] - Active resource ledger.
   * @param {string} [storageKey='squadLeaderSave'] - Key name for localStorage.
   */
  constructor(messageBus, sceneManager, squadManager, ledger, storageKey = 'squadLeaderSave') {
    this.messageBus = messageBus || null;
    this.sceneManager = sceneManager || null;
    this.squadManager = squadManager || null;
    this.ledger = ledger || null;
    this.storageKey = storageKey;
    this.isAutoSaveEnabled = true;

    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
        if (this.isAutoSaveEnabled) {
          const sceneId = (payload && typeof payload === 'object')
            ? (payload.sceneId || payload.id)
            : (typeof payload === 'string' ? payload : this.sceneManager?.getCurrentSceneId());
          this.saveGame(sceneId);
        }
      });
    }
  }

  /**
   * Checks if localStorage is available in the current runtime environment.
   * @returns {boolean}
   */
  isStorageAvailable() {
    try {
      if (typeof localStorage === 'undefined' || localStorage === null) {
        return false;
      }
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Serializes current game state and persists to localStorage.
   * @param {string} [sceneId] - Optional scene ID override.
   * @returns {object|null} The serialized save state object, or null if storage failed.
   */
  saveGame(sceneId = null) {
    const targetSceneId = sceneId || this.sceneManager?.getCurrentSceneId() || 'start';

    const soldiers = this.squadManager?.getSoldiers() || [];
    const serializedSquad = soldiers.map((soldier) => {
      if (typeof soldier.toJSON === 'function') {
        return soldier.toJSON();
      }
      return {
        id: soldier.id,
        name: soldier.name,
        role: soldier.role,
        trait: soldier.trait,
        isAlive: Boolean(soldier.isAlive),
        morale: soldier.morale ?? 100
      };
    });

    const stats = this.ledger?.getStats ? this.ledger.getStats() : (this.ledger?.stats || {});

    const saveData = {
      version: 1,
      timestamp: new Date().toISOString(),
      sceneId: targetSceneId,
      stats: { ...stats },
      squad: serializedSquad
    };

    if (this.isStorageAvailable()) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(saveData));
      } catch (err) {
        console.warn('SaveManager: Failed to write save state to localStorage', err);
      }
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('GAME_SAVED', saveData);
    }

    return saveData;
  }

  /**
   * Retrieves parsed save data from localStorage.
   * @returns {object|null}
   */
  getSaveData() {
    if (!this.isStorageAvailable()) {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('SaveManager: Failed to read or parse save state from localStorage', err);
      return null;
    }
  }

  /**
   * Checks if a valid save state exists in localStorage.
   * @returns {boolean}
   */
  hasSave() {
    const data = this.getSaveData();
    return Boolean(data && (data.sceneId || data.stats || data.squad));
  }

  /**
   * Loads game state from localStorage and restores managers.
   * Publishes GAME_LOADED event over the MessageBus.
   * @returns {object|null} The loaded state or null if no save existed.
   */
  loadGame() {
    const saveData = this.getSaveData();
    if (!saveData) {
      return null;
    }

    // 1. Restore Ledger resource statistics
    if (saveData.stats && this.ledger && typeof this.ledger.setStats === 'function') {
      this.ledger.setStats(saveData.stats);
    }

    // 2. Restore Squad roster and alive/dead statuses
    if (saveData.squad && this.squadManager && typeof this.squadManager.setRoster === 'function') {
      this.squadManager.setRoster(saveData.squad);
    }

    // 3. Temporarily disable auto-save while restoring scene to avoid redundant intermediate writes
    const prevAutoSave = this.isAutoSaveEnabled;
    this.isAutoSaveEnabled = false;

    // 4. Restore Scene in SceneManager
    if (saveData.sceneId && this.sceneManager && typeof this.sceneManager.loadScene === 'function') {
      this.sceneManager.loadScene(saveData.sceneId);
    }

    this.isAutoSaveEnabled = prevAutoSave;

    // 5. Publish GAME_LOADED event
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('GAME_LOADED', saveData);
    }

    return saveData;
  }

  /**
   * Deletes the save record from localStorage and broadcasts SAVE_CLEARED event.
   * @returns {boolean}
   */
  clearSave() {
    if (this.isStorageAvailable()) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (err) {
        console.warn('SaveManager: Failed to clear save data', err);
      }
    }

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SAVE_CLEARED', { storageKey: this.storageKey });
    }

    return true;
  }
}
