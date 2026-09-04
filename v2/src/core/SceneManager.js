// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * SceneManager coordinates narrative progression, scene loading, and decision branching.
 * Listens for CHOICE_MADE events and broadcasts SCENE_RENDERED events via the MessageBus.
 */
export class SceneManager {
  /**
   * @param {import('./MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {object} [sceneData={}] - Scene dictionary mapping scene IDs to scene data definitions.
   */
  constructor(messageBus, sceneData = {}) {
    this.messageBus = messageBus || null;
    this.sceneData = sceneData || {};
    this.currentSceneId = null;
    this.currentScene = null;

    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('CHOICE_MADE', (payload) => this.handleChoiceMade(payload));
    }
  }

  /**
   * Retrieve a scene definition by ID from the stored scene data.
   * @param {string} sceneId
   * @returns {object|null}
   */
  getScene(sceneId) {
    if (!this.sceneData || sceneId === undefined || sceneId === null) {
      return null;
    }

    if (typeof this.sceneData.get === 'function') {
      const sceneFromMap = this.sceneData.get(sceneId);
      if (sceneFromMap) return sceneFromMap;
    }

    if (this.sceneData[sceneId] !== undefined) {
      return this.sceneData[sceneId];
    }

    if (this.sceneData.scenes && this.sceneData.scenes[sceneId] !== undefined) {
      return this.sceneData.scenes[sceneId];
    }

    if (Array.isArray(this.sceneData)) {
      const found = this.sceneData.find((s) => s && (s.id === sceneId || s.sceneId === sceneId));
      if (found) return found;
    }

    return null;
  }

  /**
   * Load and render a scene by ID, publishing a SCENE_RENDERED event with the scene payload.
   * @param {string} sceneId - The identifier of the scene to load.
   * @returns {object|null} The resolved scene payload, or null if the scene was not found.
   */
  loadScene(sceneId) {
    const scene = this.getScene(sceneId);
    if (!scene) {
      console.warn(`SceneManager: Scene "${sceneId}" not found in sceneData.`);
      return null;
    }

    this.currentSceneId = sceneId;
    this.currentScene = scene;

    const payload = typeof scene === 'object' && scene !== null
      ? { id: scene.id ?? sceneId, sceneId, ...scene }
      : { id: sceneId, sceneId, data: scene };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SCENE_RENDERED', payload);
    }

    return payload;
  }

  /**
   * Find a specific choice within the current scene by index, identifier, or object match.
   * @param {object|number|string} query - Choice index, ID, text, or choice object.
   * @returns {object|null}
   */
  findChoiceInCurrentScene(query) {
    if (!this.currentScene || !Array.isArray(this.currentScene.choices)) {
      if (typeof query === 'object' && query !== null) {
        return query.choice || query;
      }
      return null;
    }

    const choices = this.currentScene.choices;

    // 1. If query is a numeric index
    if (typeof query === 'number') {
      return choices[query] || null;
    }

    // 2. If query is a string (id, nextScene, next, or text)
    if (typeof query === 'string') {
      return choices.find((c) =>
        c.id === query ||
        c.nextScene === query ||
        c.next === query ||
        c.text === query
      ) || null;
    }

    // 3. If query is an object
    if (typeof query === 'object' && query !== null) {
      if (query.choice && typeof query.choice === 'object') {
        const found = this.findChoiceInCurrentScene(query.choice);
        if (found) return found;
      }

      const idx = query.choiceIndex ?? query.index;
      if (typeof idx === 'number' && choices[idx]) {
        return choices[idx];
      }

      const choiceId = query.choiceId ?? query.id;
      if (choiceId !== undefined) {
        const found = choices.find((c) => c.id === choiceId);
        if (found) return found;
      }

      if (query.text) {
        const found = choices.find((c) => c.text === query.text);
        if (found) return found;
      }

      const targetScene = query.nextScene ?? query.next;
      if (targetScene) {
        const found = choices.find((c) => c.nextScene === targetScene || c.next === targetScene);
        if (found) return found;
      }

      if (choices.includes(query)) {
        return query;
      }

      if (query.nextScene !== undefined || query.next !== undefined || query.events !== undefined) {
        return query;
      }
    }

    return null;
  }

  /**
   * Publish all events attached to a choice to the MessageBus.
   * Supports arrays of event objects, tuples, strings, or key-value event maps.
   * @param {Array|object} events - Collection of event definitions.
   */
  publishChoiceEvents(events) {
    if (!events || !this.messageBus || typeof this.messageBus.publish !== 'function') {
      return;
    }

    if (Array.isArray(events)) {
      for (const eventItem of events) {
        if (!eventItem) continue;

        if (typeof eventItem === 'string') {
          this.messageBus.publish(eventItem, null);
        } else if (Array.isArray(eventItem)) {
          this.messageBus.publish(eventItem[0], eventItem[1] ?? null);
        } else if (typeof eventItem === 'object') {
          const eventName = eventItem.name || eventItem.event || eventItem.type;
          if (eventName) {
            const payload = eventItem.payload !== undefined
              ? eventItem.payload
              : (eventItem.data !== undefined ? eventItem.data : (eventItem.value !== undefined ? eventItem.value : null));
            this.messageBus.publish(eventName, payload);
          } else {
            for (const [key, val] of Object.entries(eventItem)) {
              this.messageBus.publish(key, val);
            }
          }
        }
      }
    } else if (typeof events === 'object') {
      for (const [eventName, payload] of Object.entries(events)) {
        this.messageBus.publish(eventName, payload);
      }
    }
  }

  /**
   * Handle the CHOICE_MADE event:
   * 1. Find the selected choice in the current scene.
   * 2. Publish any events specified in choice.events to the MessageBus.
   * 3. Load the next scene specified by choice.nextScene.
   * @param {object|number|string} payload - The choice payload or identifier.
   */
  handleChoiceMade(payload) {
    const choice = this.findChoiceInCurrentScene(payload);
    if (!choice) {
      console.warn('SceneManager: Choice could not be resolved from payload in current scene.', payload);
      const fallbackNext = typeof payload === 'object' && payload !== null ? (payload.nextScene || payload.next) : null;
      if (fallbackNext) {
        this.loadScene(fallbackNext);
      }
      return;
    }

    if (choice.events) {
      this.publishChoiceEvents(choice.events);
    }

    const nextScene = choice.nextScene ?? choice.next;
    if (nextScene) {
      this.messageBus.publish('CHOICE_RESOLUTION', { choice, nextScene });
    }
  }

  /**
   * Get the active scene object.
   * @returns {object|null}
   */
  getCurrentScene() {
    return this.currentScene;
  }

  /**
   * Get the ID of the active scene.
   * @returns {string|null}
   */
  getCurrentSceneId() {
    return this.currentSceneId;
  }

  /**
   * Update or replace the scene data dictionary.
   * @param {object} sceneData
   */
  setSceneData(sceneData) {
    this.sceneData = sceneData || {};
  }
}
