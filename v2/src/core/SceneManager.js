// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * SceneManager coordinates narrative progression, scene loading, and decision branching.
 * Listens for CHOICE_MADE events and broadcasts SCENE_RENDERED events via the MessageBus.
 */
export class SceneManager {
  /**
   * @param {import('./MessageBus.js').MessageBus} [messageBus] - Central message bus instance.
   * @param {object} [sceneData={}] - Scene dictionary mapping scene IDs to scene data definitions.
   * @param {object} [systems={}] - Attached system references for requirement evaluations.
   */
  constructor(messageBus, sceneData = {}, systems = {}) {
    this.messageBus = messageBus || null;
    this.sceneData = sceneData || {};
    this.systems = systems || {};
    this.currentSceneId = null;
    this.currentScene = null;

    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('CHOICE_MADE', (payload) => this.handleChoiceMade(payload));
    }
  }

  /**
   * Set or update attached systems for requirement evaluations.
   * @param {object} systems
   */
  setSystems(systems = {}) {
    this.systems = { ...this.systems, ...systems };
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

  /**
   * Evaluates requirements for a given choice against the game context or attached systems.
   * Checks:
   * - alive / alive2: Living soldier requirements.
   * - stat / value: Ledger resource requirements.
   * - reputation: Primary doctrine match OR score >= 40 for that archetype.
   * - trait: At least one living squad member possessing the trait.
   * - intelTier: Minimum Intel Tier ('LOW', 'MEDIUM', 'HIGH').
   * - notWeather: Choice unavailable under specified atmospheric conditions.
   *
   * @param {object} choice - The choice object to evaluate.
   * @param {object} [context={}] - Optional system overrides or context properties.
   * @returns {{ available: boolean, reason: string|null, failures: string[] }}
   */
  evaluateChoiceRequirements(choice, context = {}) {
    if (!choice || !choice.requirements || typeof choice.requirements !== 'object') {
      return { available: true, reason: null, failures: [] };
    }

    const reqs = choice.requirements;
    const ctx = { ...this.systems, ...context };
    const failures = [];

    // 1. Living soldier requirement (alive)
    if (reqs.alive) {
      const soldier = ctx.squadManager?.getSoldierById
        ? ctx.squadManager.getSoldierById(reqs.alive)
        : null;
      if (soldier && soldier.isAlive === false) {
        failures.push(`[UNAVAILABLE: ${soldier.name || reqs.alive.toUpperCase()} KIA]`);
      }
    }

    // 2. Second living soldier requirement (alive2)
    if (reqs.alive2) {
      const soldier2 = ctx.squadManager?.getSoldierById
        ? ctx.squadManager.getSoldierById(reqs.alive2)
        : null;
      if (soldier2 && soldier2.isAlive === false) {
        failures.push(`[UNAVAILABLE: ${soldier2.name || reqs.alive2.toUpperCase()} KIA]`);
      }
    }

    // 3. Ledger resource requirement (stat & value)
    if (reqs.stat !== undefined && reqs.value !== undefined) {
      let currentVal = 0;
      if (ctx.ledger?.getStat) {
        currentVal = ctx.ledger.getStat(reqs.stat) ?? 0;
      } else if (ctx.ledger && ctx.ledger[reqs.stat] !== undefined) {
        currentVal = ctx.ledger[reqs.stat];
      }
      if (currentVal < reqs.value) {
        failures.push(`[LOCKED: REQUIRES ${reqs.value} ${String(reqs.stat).toUpperCase()}]`);
      }
    }

    // 4. Reputation / Doctrine requirement
    // Requires player primary reputation or reputation score >= 40 for that doctrine
    if (reqs.reputation) {
      const targetDoctrine = reqs.reputation;
      let primary = null;
      let score = 0;

      if (ctx.reputationManager) {
        primary = ctx.reputationManager.getPrimaryReputation
          ? ctx.reputationManager.getPrimaryReputation()
          : ctx.reputationManager.primaryReputation;
        score = ctx.reputationManager.getScore
          ? ctx.reputationManager.getScore(targetDoctrine)
          : (ctx.reputationManager.scores?.[targetDoctrine] ?? 0);
      } else if (ctx.reputation) {
        if (typeof ctx.reputation === 'string') {
          primary = ctx.reputation;
        } else if (typeof ctx.reputation === 'object') {
          primary = ctx.reputation.primaryReputation || ctx.reputation.primary;
          score = ctx.reputation.scores?.[targetDoctrine] ?? ctx.reputation[targetDoctrine] ?? 0;
        }
      }

      const isPrimaryMatch = Boolean(primary && primary.toLowerCase() === targetDoctrine.toLowerCase());
      const hasMinScore = typeof score === 'number' && score >= 40;

      if (!isPrimaryMatch && !hasMinScore) {
        failures.push(`[LOCKED: ${targetDoctrine.toUpperCase()} DOCTRINE REQUIRED]`);
      }
    }

    // 5. Hidden Trait requirement
    // Requires at least one living squad member possessing the trait
    if (reqs.trait) {
      const reqTrait = reqs.trait;
      let livingSoldiers = [];

      if (ctx.squadManager?.getAliveSoldiers) {
        livingSoldiers = ctx.squadManager.getAliveSoldiers();
      } else if (ctx.squadManager?.soldiers) {
        livingSoldiers = ctx.squadManager.soldiers.filter((s) => s.isAlive !== false);
      } else if (Array.isArray(ctx.aliveSoldiers)) {
        livingSoldiers = ctx.aliveSoldiers;
      } else if (Array.isArray(ctx.squad)) {
        livingSoldiers = ctx.squad.filter((s) => s.isAlive !== false);
      }

      let traitFound = false;
      for (const s of livingSoldiers) {
        if (s.isAlive === false) continue;
        if (typeof s.hasTrait === 'function' && s.hasTrait(reqTrait)) {
          traitFound = true;
          break;
        }
        if (Array.isArray(s.traits) && s.traits.some((t) => t.toLowerCase() === reqTrait.toLowerCase())) {
          traitFound = true;
          break;
        }
        if (ctx.traitManager && typeof ctx.traitManager.hasTrait === 'function' && ctx.traitManager.hasTrait(s.id, reqTrait)) {
          traitFound = true;
          break;
        }
      }

      if (!traitFound) {
        failures.push(`[LOCKED: ${reqTrait.toUpperCase()} REQUIRED]`);
      }
    }

    // 6. Intel Tier requirement
    // Minimum Intel Tier ("LOW", "MEDIUM", "HIGH")
    if (reqs.intelTier) {
      const INTEL_TIER_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      const reqTierStr = String(reqs.intelTier).toUpperCase();
      const reqRank = INTEL_TIER_ORDER[reqTierStr] || 1;

      let currentTier = 'LOW';
      if (ctx.intelSystem?.getIntelTier) {
        currentTier = ctx.intelSystem.getIntelTier();
      } else if (ctx.intelTier) {
        currentTier = ctx.intelTier;
      } else if (ctx.ledger) {
        const intelScore = ctx.ledger.getStat ? ctx.ledger.getStat('intel') : (ctx.ledger.intel || 0);
        if (intelScore >= 60) currentTier = 'HIGH';
        else if (intelScore >= 25) currentTier = 'MEDIUM';
        else currentTier = 'LOW';
      }

      const currentRank = INTEL_TIER_ORDER[String(currentTier).toUpperCase()] || 1;
      if (currentRank < reqRank) {
        failures.push(`[LOCKED: ${reqTierStr} INTEL REQUIRED]`);
      }
    }

    // 7. Not Weather requirement
    // Choice unavailable in certain weather (e.g. air strike unavailable in "Thunderstorm" or "Monsoon")
    if (reqs.notWeather) {
      const forbiddenList = (Array.isArray(reqs.notWeather) ? reqs.notWeather : [reqs.notWeather])
        .map((w) => String(w).toLowerCase());

      let weatherName = 'Clear';
      if (ctx.weatherSystem?.getCurrentWeather) {
        const wObj = ctx.weatherSystem.getCurrentWeather();
        weatherName = wObj.name || wObj.type || 'Clear';
      } else if (ctx.weather) {
        if (typeof ctx.weather === 'string') {
          weatherName = ctx.weather;
        } else if (typeof ctx.weather === 'object') {
          weatherName = ctx.weather.name || ctx.weather.type || 'Clear';
        }
      }

      const weatherLower = weatherName.toLowerCase();
      if (forbiddenList.includes(weatherLower)) {
        if (reqs.weatherLockReason) {
          failures.push(reqs.weatherLockReason);
        } else {
          const isAirSupport = /air|strike|phantom|huey|gunship|napalm|howitzer|close air/i.test(
            `${choice.id || ''} ${choice.text || ''}`
          );
          if (isAirSupport) {
            failures.push(`[LOCKED: AIR SUPPORT GROUNDED IN ${weatherName.toUpperCase()}]`);
          } else {
            failures.push(`[LOCKED: UNAVAILABLE IN ${weatherName.toUpperCase()}]`);
          }
        }
      }
    }

    const available = failures.length === 0;
    const reason = available ? null : failures[0];
    return { available, reason, failures };
  }

  /**
   * Check if a choice is available under current conditions.
   * @param {object} choice
   * @param {object} [context={}]
   * @returns {boolean}
   */
  isChoiceAvailable(choice, context = {}) {
    return this.evaluateChoiceRequirements(choice, context).available;
  }

  /**
   * Get the primary lock or unavailability reason tag for a choice.
   * @param {object} choice
   * @param {object} [context={}]
   * @returns {string|null}
   */
  getChoiceLockReason(choice, context = {}) {
    return this.evaluateChoiceRequirements(choice, context).reason;
  }
}
