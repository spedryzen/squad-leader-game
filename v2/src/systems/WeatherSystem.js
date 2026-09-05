// Squad Leader: Vietnam - Dynamic Weather System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: WeatherSystem.js
Purpose: Simulates dynamic atmospheric conditions affecting combat, detection, air support, and morale across the battlefield.
Responsibilities:
- Maintain authoritative weather catalog with 6 meteorological condition profiles (Clear, Rain, Heavy Rain, Fog, Monsoon, Thunderstorm)
- Manage active weather state and duration tracking (in narrative scenes or combat turns)
- Calculate tactical combat and operational modifiers (stealth, visibility, movement, air support, radio reception, noise masking)
- Probabilistically roll and transition weather conditions based on tactical and environmental context
- Publish WEATHER_CHANGED events on MessageBus when atmospheric conditions shift
- React to SCENE_RENDERED to tick weather durations and apply environmental wear (e.g. monsoon supplies/morale decay)
- Support comprehensive serialization and deserialization for game state persistence
Dependencies: MessageBus.js
Published Events:
- WEATHER_CHANGED: Dispatched whenever weather type, duration, or active atmospheric modifiers change
Subscribed Events:
- SCENE_RENDERED: Evaluates scene weather overrides, decrements weather duration, and applies weather upkeep
- GAME_LOADED: Restores serialized weather state and atmospheric history
Future Expansion Notes: Seasonal typhoon cycles, localized mud/flooding impassability, and flash illumination from lightning.
--------------------------------------------------
*/

/**
 * Enumeration of available weather types in Squad Leader: Vietnam.
 */
export const WEATHER_TYPES = {
  CLEAR: 'Clear',
  RAIN: 'Rain',
  HEAVY_RAIN: 'Heavy Rain',
  FOG: 'Fog',
  MONSOON: 'Monsoon',
  THUNDERSTORM: 'Thunderstorm'
};

/**
 * Catalog of atmospheric condition profiles, tactical descriptions, and gameplay modifiers.
 * All modifier values represent percentage adjustments (e.g. +15 = +15%, -20 = -20%).
 */
export const WEATHER_DEFINITIONS = {
  [WEATHER_TYPES.CLEAR]: {
    type: WEATHER_TYPES.CLEAR,
    name: 'Clear',
    description: 'Standard visibility, normal movement, full air support.',
    tacticalSummary: 'Optimal operational conditions. Visibility is unimpeded; tactical air strikes and artillery support operate at peak accuracy.',
    modifiers: {
      stealth: 0,
      visibility: 0,
      movementSpeed: 0,
      ambushChance: 0,
      detectionRange: 0,
      artilleryAccuracy: 0,
      airSupportAccuracy: 0,
      closeAirSupportAvailable: true,
      radioReception: 0,
      noiseMasking: 0,
      moraleDrain: 0,
      suppliesBurn: 0
    }
  },
  [WEATHER_TYPES.RAIN]: {
    type: WEATHER_TYPES.RAIN,
    name: 'Rain',
    description: '+stealth (+15%), -visibility (-20%).',
    tacticalSummary: 'Light to moderate tropical rainfall dampens movement sound while haze limits long-range observation.',
    modifiers: {
      stealth: 15,
      visibility: -20,
      movementSpeed: 0,
      ambushChance: 0,
      detectionRange: -20,
      artilleryAccuracy: 0,
      airSupportAccuracy: 0,
      closeAirSupportAvailable: true,
      radioReception: 0,
      noiseMasking: 10,
      moraleDrain: 0,
      suppliesBurn: 0
    }
  },
  [WEATHER_TYPES.HEAVY_RAIN]: {
    type: WEATHER_TYPES.HEAVY_RAIN,
    name: 'Heavy Rain',
    description: '+stealth (+25%), -artillery/air support accuracy (-30%), -movement speed (-15%).',
    tacticalSummary: 'Torrential tropical downpour turns dirt trails to slick red clay, impairs heavy coordinate fire, and silences foot patrols.',
    modifiers: {
      stealth: 25,
      visibility: -30,
      movementSpeed: -15,
      ambushChance: 10,
      detectionRange: -30,
      artilleryAccuracy: -30,
      airSupportAccuracy: -30,
      closeAirSupportAvailable: true,
      radioReception: -10,
      noiseMasking: 20,
      moraleDrain: -5,
      suppliesBurn: 5
    }
  },
  [WEATHER_TYPES.FOG]: {
    type: WEATHER_TYPES.FOG,
    name: 'Fog',
    description: '+ambush chance (+25%), -detection range (-30%).',
    tacticalSummary: 'Dense highland cloud deck clings to valley floors, blinding observation posts and creating prime conditions for close-range ambushes.',
    modifiers: {
      stealth: 20,
      visibility: -35,
      movementSpeed: 0,
      ambushChance: 25,
      detectionRange: -30,
      artilleryAccuracy: -15,
      airSupportAccuracy: -25,
      closeAirSupportAvailable: true,
      radioReception: 0,
      noiseMasking: 5,
      moraleDrain: 0,
      suppliesBurn: 0
    }
  },
  [WEATHER_TYPES.MONSOON]: {
    type: WEATHER_TYPES.MONSOON,
    name: 'Monsoon',
    description: '-movement (-25%), -morale over time (-10%), supplies burn (+15%).',
    tacticalSummary: 'Severe seasonal monsoon storm floods defensive trenches, rots combat boots and field rations, and rapidly saps soldier spirits.',
    modifiers: {
      stealth: 20,
      visibility: -40,
      movementSpeed: -25,
      ambushChance: 15,
      detectionRange: -35,
      artilleryAccuracy: -30,
      airSupportAccuracy: -40,
      closeAirSupportAvailable: false,
      radioReception: -20,
      noiseMasking: 25,
      moraleDrain: -10,
      suppliesBurn: 15
    }
  },
  [WEATHER_TYPES.THUNDERSTORM]: {
    type: WEATHER_TYPES.THUNDERSTORM,
    name: 'Thunderstorm',
    description: 'grounds close air support, -radio reception (-40%), +noise masking (+30%).',
    tacticalSummary: 'Violent electrical squall with continuous thunder and lightning. Tactical aircraft cannot penetrate the cloud ceiling, radio static drowns out command channels, and thunder masks infiltration.',
    modifiers: {
      stealth: 25,
      visibility: -30,
      movementSpeed: -10,
      ambushChance: 15,
      detectionRange: -25,
      artilleryAccuracy: -20,
      airSupportAccuracy: -50,
      closeAirSupportAvailable: false,
      radioReception: -40,
      noiseMasking: 30,
      moraleDrain: -5,
      suppliesBurn: 5
    }
  }
};

/**
 * WeatherSystem coordinates dynamic weather states, atmospheric transitions,
 * tactical modifier calculations, and cross-system event propagation.
 */
export class WeatherSystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [options={}] - Configuration options.
   * @param {string} [options.initialWeather='Clear'] - Starting weather condition.
   * @param {number} [options.initialDuration=-1] - Starting weather duration (-1 = indefinite).
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.currentWeather = options.initialWeather || WEATHER_TYPES.CLEAR;
    this.duration = options.initialDuration !== undefined ? options.initialDuration : -1;
    this.history = [];
    this.lastTransitionScene = null;

    // Normalize initial weather
    if (!WEATHER_DEFINITIONS[this.currentWeather]) {
      this.currentWeather = WEATHER_TYPES.CLEAR;
    }

    // Subscribe to engine lifecycle events
    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('SCENE_RENDERED', (payload) => this._handleSceneRendered(payload));
      this.messageBus.subscribe('GAME_LOADED', (payload) => this._handleGameLoaded(payload));
    }
  }

  /**
   * Manually sets the current weather condition and duration.
   * Publishes WEATHER_CHANGED over the MessageBus.
   *
   * @param {string} type - Weather type from WEATHER_TYPES.
   * @param {number} [duration=-1] - Duration in scenes (-1 = indefinite).
   * @returns {object} Updated weather status record.
   */
  setWeather(type, duration = -1) {
    const normalizedType = this._normalizeWeatherType(type);
    const previous = this.currentWeather;

    this.currentWeather = normalizedType;
    this.duration = duration;

    const weatherInfo = this.getCurrentWeather();

    this.history.push({
      type: this.currentWeather,
      previous,
      duration: this.duration,
      timestamp: new Date().toISOString()
    });

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('WEATHER_CHANGED', {
        type: this.currentWeather,
        previousWeather: previous,
        duration: this.duration,
        modifiers: this.getModifiers(),
        description: weatherInfo.description,
        tacticalSummary: weatherInfo.tacticalSummary
      });
    }

    return weatherInfo;
  }

  /**
   * Probabilistically rolls a new weather condition based on context.
   * Context may include season, terrain, altitude, time of day, or previous weather.
   *
   * @param {object} [context={}] - Contextual parameters for weighted roll.
   * @param {string} [context.season='wet'] - 'dry' (Jan-Apr) or 'wet' / 'monsoon' (May-Dec).
   * @param {string} [context.terrain='jungle'] - 'jungle', 'ridge', 'valley', 'base'.
   * @param {number} [context.duration=3] - Target duration in scenes.
   * @returns {object} The rolled and activated weather record.
   */
  rollWeather(context = {}) {
    const season = (context.season || 'wet').toLowerCase();
    const terrain = (context.terrain || 'jungle').toLowerCase();
    const duration = context.duration !== undefined ? context.duration : (Math.floor(Math.random() * 3) + 2);

    // Build probability distribution table
    let weights = {
      [WEATHER_TYPES.CLEAR]: 25,
      [WEATHER_TYPES.RAIN]: 30,
      [WEATHER_TYPES.HEAVY_RAIN]: 15,
      [WEATHER_TYPES.FOG]: 15,
      [WEATHER_TYPES.MONSOON]: 10,
      [WEATHER_TYPES.THUNDERSTORM]: 5
    };

    if (season === 'dry') {
      weights[WEATHER_TYPES.CLEAR] = 55;
      weights[WEATHER_TYPES.RAIN] = 20;
      weights[WEATHER_TYPES.HEAVY_RAIN] = 10;
      weights[WEATHER_TYPES.FOG] = 10;
      weights[WEATHER_TYPES.MONSOON] = 2;
      weights[WEATHER_TYPES.THUNDERSTORM] = 3;
    } else if (season === 'monsoon' || season === 'wet') {
      weights[WEATHER_TYPES.CLEAR] = 10;
      weights[WEATHER_TYPES.RAIN] = 30;
      weights[WEATHER_TYPES.HEAVY_RAIN] = 25;
      weights[WEATHER_TYPES.FOG] = 15;
      weights[WEATHER_TYPES.MONSOON] = 10;
      weights[WEATHER_TYPES.THUNDERSTORM] = 10;
    }

    if (terrain === 'valley') {
      // Valleys accumulate dense fog
      weights[WEATHER_TYPES.FOG] += 20;
    } else if (terrain === 'ridge') {
      // Ridges face electrical storms and heavy wind
      weights[WEATHER_TYPES.THUNDERSTORM] += 15;
    }

    // Roll based on cumulative weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * totalWeight;
    let selectedType = WEATHER_TYPES.CLEAR;

    for (const [type, weight] of Object.entries(weights)) {
      if (roll <= weight) {
        selectedType = type;
        break;
      }
      roll -= weight;
    }

    return this.setWeather(selectedType, duration);
  }

  /**
   * Retrieves full details for the current active weather condition.
   * @returns {object} Comprehensive weather object.
   */
  getCurrentWeather() {
    const def = WEATHER_DEFINITIONS[this.currentWeather] || WEATHER_DEFINITIONS[WEATHER_TYPES.CLEAR];
    return {
      type: def.type,
      name: def.name,
      description: def.description,
      tacticalSummary: def.tacticalSummary,
      duration: this.duration,
      modifiers: { ...def.modifiers }
    };
  }

  /**
   * Retrieves active modifiers dictionary for the current weather.
   * @returns {object} Modifier percentages and tactical capability booleans.
   */
  getModifiers() {
    const def = WEATHER_DEFINITIONS[this.currentWeather] || WEATHER_DEFINITIONS[WEATHER_TYPES.CLEAR];
    return { ...def.modifiers };
  }

  /**
   * Retrieves tactical definition for a specific weather type.
   * @param {string} type
   * @returns {object|null}
   */
  getWeatherDefinition(type) {
    const normalized = this._normalizeWeatherType(type);
    return WEATHER_DEFINITIONS[normalized] ? { ...WEATHER_DEFINITIONS[normalized] } : null;
  }

  /**
   * Retrieves weather history log.
   * @returns {Array<object>}
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Serializes weather system state for persistence.
   * @returns {object}
   */
  serialize() {
    return {
      currentWeather: this.currentWeather,
      duration: this.duration,
      history: [...this.history],
      lastTransitionScene: this.lastTransitionScene
    };
  }

  /**
   * Restores weather system state from serialized save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.currentWeather && WEATHER_DEFINITIONS[data.currentWeather]) {
      this.currentWeather = data.currentWeather;
    } else {
      this.currentWeather = WEATHER_TYPES.CLEAR;
    }

    this.duration = typeof data.duration === 'number' ? data.duration : -1;
    this.history = Array.isArray(data.history) ? [...data.history] : [];
    this.lastTransitionScene = data.lastTransitionScene || null;
  }

  /**
   * Internal handler for SCENE_RENDERED events.
   * Checks for scene weather overrides, decrements duration, and applies weather upkeep.
   * @param {object|string} payload
   * @private
   */
  _handleSceneRendered(payload) {
    const sceneObj = typeof payload === 'object' && payload !== null ? payload : {};
    const sceneId = sceneObj.id || sceneObj.sceneId || (typeof payload === 'string' ? payload : null);

    // 1. Explicit scene weather override
    if (sceneObj.weather) {
      const explicitType = this._normalizeWeatherType(sceneObj.weather);
      const sceneDuration = sceneObj.weatherDuration !== undefined ? sceneObj.weatherDuration : -1;
      this.setWeather(explicitType, sceneDuration);
      this.lastTransitionScene = sceneId;
      return;
    }

    // 2. Decrement duration if active
    if (this.duration > 0) {
      this.duration -= 1;
      if (this.duration === 0) {
        // Duration expired, roll new weather or revert to Clear
        this.rollWeather({ terrain: sceneObj.location ? 'ridge' : 'jungle' });
      }
    }

    // 3. Environmental weather wear (Monsoon/Heavy Rain effects on resources/morale)
    if (this.currentWeather === WEATHER_TYPES.MONSOON && this.messageBus) {
      // Monsoon burns supplies (+15% wear) and drains morale over time
      this.messageBus.publish('STAT_CHANGED', {
        stat: 'supplies',
        delta: -5,
        reason: 'Monsoon supply degradation'
      });
    }
  }

  /**
   * Internal handler for GAME_LOADED events.
   * @param {object} payload
   * @private
   */
  _handleGameLoaded(payload) {
    if (payload && payload.weather) {
      this.deserialize(payload.weather);
    }
  }

  /**
   * Normalizes arbitrary weather string input to canonical WEATHER_TYPES key.
   * @param {string} type
   * @returns {string}
   * @private
   */
  _normalizeWeatherType(type) {
    if (!type || typeof type !== 'string') return WEATHER_TYPES.CLEAR;

    const lower = type.trim().toLowerCase();
    for (const [key, value] of Object.entries(WEATHER_TYPES)) {
      if (value.toLowerCase() === lower || key.toLowerCase() === lower) {
        return value;
      }
    }

    return WEATHER_TYPES.CLEAR;
  }
}
