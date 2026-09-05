// Squad Leader: Vietnam - SaveManager State Persistence
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: SaveManager.js
Purpose: Manages auto-saving and state restoration to/from HTML5 localStorage for scene progression, ledger resources, squad status, relationships, traits, journal entries, psychological conditions, reputation, dynamic events, weather, radio communications, tactical intelligence, enemy commander AI, ambush encounters, heroic actions, tactical map, wounded soldiers, battlefield recovery, and dynamic extraction endgame.
Responsibilities:
- Serialize active game state across all 16 systems (sceneId, ledger stats, squad roster, relationships, traits, journal, conditions, reputation, dynamicEvents, weather, radio, intel, enemyCommander, ambush, heroics, tacticalMap, wounded, recovery, extraction)
- Persist snapshots to browser localStorage under key 'squadLeaderSave'
- Restore campaign state and broadcast GAME_LOADED
- Provide manual save, load, and save clearing routines
Dependencies: MessageBus.js, SceneManager.js, SquadManager.js, Ledger.js, optional systems (RelationshipManager, TraitManager, Journal, PsychologicalConditionManager, ReputationManager, DynamicEventManager, WeatherSystem, RadioSystem, IntelSystem, EnemyCommander, AmbushSystem, HeroicActionManager, TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem, ExtractionSystem)
Published Events:
- GAME_SAVED: Dispatched upon successful save snapshot serialization
- GAME_LOADED: Dispatched upon loading and restoring state across all systems
- SAVE_CLEARED: Dispatched when save record is deleted from storage
Subscribed Events:
- SCENE_RENDERED: Automatically triggers auto-save on scene navigation
Future Expansion Notes: Cloud sync support and multi-slot save profiles.
--------------------------------------------------
*/

/**
 * SaveManager handles auto-saving and loading game state to/from HTML5 localStorage.
 * Subscribes to SCENE_RENDERED events to serialize current progress.
 */
export class SaveManager {
  /**
   * @param {import('./MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {import('./SceneManager.js').SceneManager} [sceneManager] - Active scene manager.
   * @param {import('../entities/SquadManager.js').SquadManager} [squadManager] - Active squad manager.
   * @param {import('../state/Ledger.js').Ledger} [ledger] - Active resource ledger.
   * @param {string} [storageKey='squadLeaderSave'] - Key name for localStorage.
   * @param {object} [systems={}] - Optional systems: { relationshipManager, traitManager, journal, conditionManager, reputationManager, dynamicEventManager, weatherSystem, radioSystem, intelSystem, enemyCommander, ambushSystem, heroicActionManager, tacticalMapManager, woundedSoldierManager, battlefieldRecoverySystem, extractionSystem }.
   */
  constructor(messageBus, sceneManager, squadManager, ledger, storageKey = 'squadLeaderSave', systems = {}) {
    this.messageBus = messageBus || null;
    this.sceneManager = sceneManager || null;
    this.squadManager = squadManager || null;
    this.ledger = ledger || null;
    this.storageKey = storageKey;
    this.isAutoSaveEnabled = true;

    // Phase 1 systems
    this.relationshipManager = systems.relationshipManager || null;
    this.traitManager = systems.traitManager || null;
    this.journal = systems.journal || null;

    // Phase 2 systems
    this.conditionManager = systems.conditionManager || systems.psychologicalConditionManager || null;
    this.reputationManager = systems.reputationManager || null;
    this.dynamicEventManager = systems.dynamicEventManager || null;

    // Phase 3 systems
    this.weatherSystem = systems.weatherSystem || null;
    this.radioSystem = systems.radioSystem || null;
    this.intelSystem = systems.intelSystem || null;

    // Phase 4 systems
    this.enemyCommander = systems.enemyCommander || null;
    this.ambushSystem = systems.ambushSystem || null;
    this.heroicActionManager = systems.heroicActionManager || systems.heroicManager || null;

    // Phase 5 systems
    this.tacticalMapManager = systems.tacticalMapManager || systems.mapManager || null;
    this.woundedSoldierManager = systems.woundedSoldierManager || systems.woundedManager || null;
    this.battlefieldRecoverySystem = systems.battlefieldRecoverySystem || systems.recoverySystem || null;

    // Phase 6 systems
    this.extractionSystem = systems.extractionSystem || null;

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
   * Attach or update additional system references for serialization.
   * @param {object} systems
   */
  setSystems(systems = {}) {
    if (systems.relationshipManager) this.relationshipManager = systems.relationshipManager;
    if (systems.traitManager) this.traitManager = systems.traitManager;
    if (systems.journal) this.journal = systems.journal;
    if (systems.conditionManager || systems.psychologicalConditionManager) {
      this.conditionManager = systems.conditionManager || systems.psychologicalConditionManager;
    }
    if (systems.reputationManager) this.reputationManager = systems.reputationManager;
    if (systems.dynamicEventManager) this.dynamicEventManager = systems.dynamicEventManager;
    if (systems.weatherSystem) this.weatherSystem = systems.weatherSystem;
    if (systems.radioSystem) this.radioSystem = systems.radioSystem;
    if (systems.intelSystem) this.intelSystem = systems.intelSystem;
    if (systems.enemyCommander) this.enemyCommander = systems.enemyCommander;
    if (systems.ambushSystem) this.ambushSystem = systems.ambushSystem;
    if (systems.heroicActionManager || systems.heroicManager) {
      this.heroicActionManager = systems.heroicActionManager || systems.heroicManager;
    }
    if (systems.tacticalMapManager || systems.mapManager) {
      this.tacticalMapManager = systems.tacticalMapManager || systems.mapManager;
    }
    if (systems.woundedSoldierManager || systems.woundedManager) {
      this.woundedSoldierManager = systems.woundedSoldierManager || systems.woundedManager;
    }
    if (systems.battlefieldRecoverySystem || systems.recoverySystem) {
      this.battlefieldRecoverySystem = systems.battlefieldRecoverySystem || systems.recoverySystem;
    }
    if (systems.extractionSystem) {
      this.extractionSystem = systems.extractionSystem;
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
        traits: soldier.traits || (soldier.trait ? [soldier.trait] : []),
        wounds: soldier.wounds || [],
        conditions: soldier.conditions || [],
        status: soldier.status || (soldier.isAlive ? 'healthy' : 'kia'),
        isAlive: Boolean(soldier.isAlive),
        morale: soldier.morale ?? 100
      };
    });

    const stats = this.ledger?.getStats ? this.ledger.getStats() : (this.ledger?.stats || {});

    const saveData = {
      version: 3,
      timestamp: new Date().toISOString(),
      sceneId: targetSceneId,
      stats: { ...stats },
      squad: serializedSquad,
      relationships: this.relationshipManager?.serialize ? this.relationshipManager.serialize() : [],
      traits: this.traitManager?.serialize ? this.traitManager.serialize() : {},
      journal: this.journal?.serialize ? this.journal.serialize() : {},
      conditions: this.conditionManager?.serialize ? this.conditionManager.serialize() : {},
      reputation: this.reputationManager?.serialize ? this.reputationManager.serialize() : {},
      dynamicEvents: this.dynamicEventManager?.serialize ? this.dynamicEventManager.serialize() : {},
      weather: this.weatherSystem?.serialize ? this.weatherSystem.serialize() : null,
      radio: this.radioSystem?.serialize ? this.radioSystem.serialize() : null,
      intel: this.intelSystem?.serialize ? this.intelSystem.serialize() : null,
      enemyCommander: this.enemyCommander?.serialize ? this.enemyCommander.serialize() : null,
      ambush: this.ambushSystem?.serialize ? this.ambushSystem.serialize() : null,
      heroics: this.heroicActionManager?.serialize ? this.heroicActionManager.serialize() : null,
      tacticalMap: this.tacticalMapManager?.serialize ? this.tacticalMapManager.serialize() : null,
      wounded: this.woundedSoldierManager?.serialize ? this.woundedSoldierManager.serialize() : null,
      recovery: this.battlefieldRecoverySystem?.serialize ? this.battlefieldRecoverySystem.serialize() : null,
      extraction: this.extractionSystem?.serialize ? this.extractionSystem.serialize() : null
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

    // 3. Restore Phase 1 systems if references attached
    if (saveData.relationships && this.relationshipManager && typeof this.relationshipManager.deserialize === 'function') {
      this.relationshipManager.deserialize(saveData.relationships);
    }

    if (saveData.traits && this.traitManager && typeof this.traitManager.deserialize === 'function') {
      this.traitManager.deserialize(saveData.traits);
    }

    if (saveData.journal && this.journal && typeof this.journal.deserialize === 'function') {
      this.journal.deserialize(saveData.journal);
    }

    // 4. Restore Phase 2 systems if references attached
    if (saveData.conditions && this.conditionManager && typeof this.conditionManager.deserialize === 'function') {
      this.conditionManager.deserialize(saveData.conditions);
    }

    if (saveData.reputation && this.reputationManager && typeof this.reputationManager.deserialize === 'function') {
      this.reputationManager.deserialize(saveData.reputation);
    }

    if (saveData.dynamicEvents && this.dynamicEventManager && typeof this.dynamicEventManager.deserialize === 'function') {
      this.dynamicEventManager.deserialize(saveData.dynamicEvents);
    }

    // 5. Restore Phase 3 systems if references attached
    if (saveData.weather && this.weatherSystem && typeof this.weatherSystem.deserialize === 'function') {
      this.weatherSystem.deserialize(saveData.weather);
    }

    if (saveData.radio && this.radioSystem && typeof this.radioSystem.deserialize === 'function') {
      this.radioSystem.deserialize(saveData.radio);
    }

    if (saveData.intel && this.intelSystem && typeof this.intelSystem.deserialize === 'function') {
      this.intelSystem.deserialize(saveData.intel);
    }

    // 6. Restore Phase 4 systems if references attached
    if (saveData.enemyCommander && this.enemyCommander && typeof this.enemyCommander.deserialize === 'function') {
      this.enemyCommander.deserialize(saveData.enemyCommander);
    }

    if (saveData.ambush && this.ambushSystem && typeof this.ambushSystem.deserialize === 'function') {
      this.ambushSystem.deserialize(saveData.ambush);
    }

    if ((saveData.heroics || saveData.heroicActions) && this.heroicActionManager && typeof this.heroicActionManager.deserialize === 'function') {
      this.heroicActionManager.deserialize(saveData.heroics || saveData.heroicActions);
    }

    // 7. Restore Phase 5 systems if references attached
    if ((saveData.tacticalMap || saveData.map) && this.tacticalMapManager && typeof this.tacticalMapManager.deserialize === 'function') {
      this.tacticalMapManager.deserialize(saveData.tacticalMap || saveData.map);
    }

    if ((saveData.wounded || saveData.woundedSoldiers) && this.woundedSoldierManager && typeof this.woundedSoldierManager.deserialize === 'function') {
      this.woundedSoldierManager.deserialize(saveData.wounded || saveData.woundedSoldiers);
    }

    if ((saveData.recovery || saveData.battlefieldRecovery) && this.battlefieldRecoverySystem && typeof this.battlefieldRecoverySystem.deserialize === 'function') {
      this.battlefieldRecoverySystem.deserialize(saveData.recovery || saveData.battlefieldRecovery);
    }

    // 8. Restore Phase 6 Dynamic Extraction system if references attached
    if ((saveData.extraction || saveData.extractionSystem) && this.extractionSystem && typeof this.extractionSystem.deserialize === 'function') {
      this.extractionSystem.deserialize(saveData.extraction || saveData.extractionSystem);
    }

    // 9. Temporarily disable auto-save while restoring scene to avoid redundant intermediate writes
    const prevAutoSave = this.isAutoSaveEnabled;
    this.isAutoSaveEnabled = false;

    // 10. Restore Scene in SceneManager
    if (saveData.sceneId && this.sceneManager && typeof this.sceneManager.loadScene === 'function') {
      this.sceneManager.loadScene(saveData.sceneId);
    }

    this.isAutoSaveEnabled = prevAutoSave;

    // 11. Publish GAME_LOADED event so all subscribed systems react
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
