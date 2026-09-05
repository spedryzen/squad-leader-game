// Squad Leader: Vietnam - Radio Communication System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: RadioSystem.js
Purpose: Coordinates tactical incoming and outgoing military transmissions with timed operational decision windows across 5 military channels.
Responsibilities:
- Manage 5 authoritative traffic channels: HQ (India Six), Forward Observer, Medevac (Dustoff), Artillery (Battery Alpha), Air Support (Phantoms/Spooky)
- Process urgent incoming transmissions featuring branched decision choices and active response windows
- Track remaining message response lifetimes across narrative scene transitions and trigger RADIO_TIMEOUT when windows expire
- Execute tactical decisions, apply combat consequences over MessageBus, and publish RADIO_DECISION
- Monitor dynamic weather interference (e.g. Thunderstorm electrical static reducing radio reception by -40%)
- Maintain comprehensive military communication history and support serialization/deserialization for save states
Dependencies: MessageBus.js, optional WeatherSystem.js
Published Events:
- RADIO_MESSAGE_RECEIVED: Dispatched when a transmission is logged on any channel
- RADIO_DECISION: Dispatched when a squad leader acknowledges and resolves an urgent radio transmission
- RADIO_TIMEOUT: Dispatched when an urgent transmission response window expires without command resolution
Subscribed Events:
- SCENE_RENDERED: Decrements response windows for active urgent messages and triggers timeout evaluation
- CHOICE_MADE: Evaluates choices that trigger radio fire missions or medevac calls
- WEATHER_CHANGED: Updates atmospheric reception modifiers (e.g. electrical storm static)
- GAME_LOADED: Restores serialized active messages, communication history, and reception state
Future Expansion Notes: PRC-25 battery drain tracking, direction-finding triangulation by enemy signals intelligence, and radio operator KIA jamming.
--------------------------------------------------
*/

/**
 * Military traffic channels in Squad Leader: Vietnam.
 */
export const RADIO_CHANNELS = {
  HQ: 'HQ',
  FORWARD_OBSERVER: 'Forward Observer',
  MEDEVAC: 'Medevac',
  ARTILLERY: 'Artillery',
  AIR_SUPPORT: 'Air Support'
};

/**
 * Technical specifications, callsigns, and tactical roles for each radio net.
 */
export const CHANNEL_METADATA = {
  [RADIO_CHANNELS.HQ]: {
    channel: RADIO_CHANNELS.HQ,
    name: 'HQ Command Net',
    callsign: 'India Six',
    frequency: '46.50 MHz FM',
    description: 'Battalion operational command net. Directs tactical objectives, sitreps, and strategic asset releases.'
  },
  [RADIO_CHANNELS.FORWARD_OBSERVER]: {
    name: 'Forward Observer Net',
    channel: RADIO_CHANNELS.FORWARD_OBSERVER,
    callsign: 'Eyes in the Sky',
    frequency: '49.20 MHz FM',
    description: 'High-angle coordinate spotting network. Coordinates enemy troop movement azimuths and artillery corrections.'
  },
  [RADIO_CHANNELS.MEDEVAC]: {
    name: 'Dustoff Medevac Net',
    channel: RADIO_CHANNELS.MEDEVAC,
    callsign: 'Dustoff',
    frequency: '52.00 MHz FM',
    description: 'Aeromedical evacuation net. Coordinates LZ smoke identification, landing security, and wounded triage.'
  },
  [RADIO_CHANNELS.ARTILLERY]: {
    name: 'Battery Alpha Direct Fire Net',
    channel: RADIO_CHANNELS.ARTILLERY,
    callsign: 'Battery Alpha',
    frequency: '38.80 MHz FM',
    description: '105mm and 155mm howitzer fire direction net. Authorizes HE, WP smoke, and defensive perimeter barrages.'
  },
  [RADIO_CHANNELS.AIR_SUPPORT]: {
    name: 'Tactical Air Control Net',
    channel: RADIO_CHANNELS.AIR_SUPPORT,
    callsign: 'Spooky / Phantoms',
    frequency: '65.10 MHz FM',
    description: 'Close air support net for F-4 Phantom strike packages (napalm/bombs) and AC-47 gunship minigun sweeps.'
  }
};

/**
 * RadioSystem coordinates incoming and outgoing military transmissions with timed operational decision windows.
 */
export class RadioSystem {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [options={}] - Configuration options.
   * @param {import('./WeatherSystem.js').WeatherSystem} [options.weatherSystem] - Optional reference to weather system.
   * @param {number} [options.baseReception=100] - Base signal strength percentage (0-100).
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.weatherSystem = options.weatherSystem || null;
    this.baseReception = options.baseReception !== undefined ? options.baseReception : 100;
    this.receptionModifier = 0; // Negative values degrade signal (e.g. -40 during Thunderstorm)

    // Active urgent messages awaiting command decisions
    this.activeMessages = [];

    // Complete transmission history log
    this.history = [];

    // Auto-sync initial weather reception modifier if weatherSystem provided
    if (this.weatherSystem && typeof this.weatherSystem.getModifiers === 'function') {
      const mods = this.weatherSystem.getModifiers();
      this.receptionModifier = mods.radioReception || 0;
    }

    // Subscribe to engine lifecycle events
    if (this.messageBus && typeof this.messageBus.subscribe === 'function') {
      this.messageBus.subscribe('SCENE_RENDERED', (payload) => this._handleSceneRendered(payload));
      this.messageBus.subscribe('CHOICE_MADE', (payload) => this._handleChoiceMade(payload));
      this.messageBus.subscribe('WEATHER_CHANGED', (payload) => this._handleWeatherChanged(payload));
      this.messageBus.subscribe('GAME_LOADED', (payload) => this._handleGameLoaded(payload));
    }
  }

  /**
   * Calculates effective radio reception quality (clamped between 0% and 100%).
   * Takes into account base signal and dynamic atmospheric degradation (e.g. Thunderstorm -40%).
   * @returns {number} Effective reception percentage (0 - 100).
   */
  getReceptionQuality() {
    const total = this.baseReception + this.receptionModifier;
    return Math.max(0, Math.min(100, total));
  }

  /**
   * Transmits an outgoing message over a designated military channel.
   * Evaluates signal quality and records to transmission log.
   *
   * @param {string} channel - Target channel from RADIO_CHANNELS.
   * @param {string} message - Transmission content text.
   * @param {object} [options={}] - Optional transmission settings (sender, urgent, gridCoordinates).
   * @returns {object} The transmission result object.
   */
  transmit(channel, message, options = {}) {
    const normalizedChannel = this._normalizeChannel(channel);
    const reception = this.getReceptionQuality();
    const meta = CHANNEL_METADATA[normalizedChannel] || CHANNEL_METADATA[RADIO_CHANNELS.HQ];

    // Determine if signal is severely degraded by atmospheric interference
    const isDegraded = reception < 70;
    const isBlocked = reception <= 20;

    const transmissionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      direction: 'outgoing',
      channel: normalizedChannel,
      callsign: meta.callsign,
      sender: options.sender || 'Squad Leader (Whiskey One)',
      text: message,
      receptionQuality: reception,
      status: isBlocked ? 'blocked_by_static' : (isDegraded ? 'noisy_transmission' : 'transmitted'),
      timestamp: new Date().toISOString(),
      gridCoordinates: options.gridCoordinates || null
    };

    this.history.push(transmissionRecord);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RADIO_TRANSMISSION_SENT', transmissionRecord);
    }

    return transmissionRecord;
  }

  /**
   * Receives an incoming transmission from a battlefield net.
   * Urgent messages include decision choices and active response lifetimes.
   *
   * @param {object} msgObj - Transmission descriptor.
   * @param {string} msgObj.channel - Radio channel from RADIO_CHANNELS.
   * @param {string} [msgObj.sender] - Caller callsign.
   * @param {string} msgObj.text - Transmission body text.
   * @param {boolean} [msgObj.urgent=false] - If true, requires squad leader decision.
   * @param {Array<object>} [msgObj.choices=[]] - Decision options array if urgent.
   * @param {number} [msgObj.lifetime=1] - Active decision response window in scenes.
   * @returns {object} The structured received message object.
   */
  receiveMessage(msgObj = {}) {
    const channel = this._normalizeChannel(msgObj.channel);
    const meta = CHANNEL_METADATA[channel] || CHANNEL_METADATA[RADIO_CHANNELS.HQ];
    const reception = this.getReceptionQuality();

    const isUrgent = Boolean(msgObj.urgent || (Array.isArray(msgObj.choices) && msgObj.choices.length > 0));
    const lifetime = isUrgent ? (typeof msgObj.lifetime === 'number' ? msgObj.lifetime : 1) : null;

    let contentText = msgObj.text || 'Static crackle across the frequency...';
    if (reception <= 60) {
      contentText = `[STATIC CRACKLE - RECEPTION ${reception}%] ${contentText}`;
    }

    const messageRecord = {
      id: msgObj.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      direction: 'incoming',
      channel,
      callsign: meta.callsign,
      sender: msgObj.sender || meta.callsign,
      text: contentText,
      originalText: msgObj.text || contentText,
      urgent: isUrgent,
      choices: Array.isArray(msgObj.choices) ? [...msgObj.choices] : [],
      lifetime,
      remainingLifetime: lifetime,
      receptionQuality: reception,
      status: isUrgent ? 'pending' : 'received',
      timestamp: new Date().toISOString()
    };

    if (isUrgent) {
      this.activeMessages.push(messageRecord);
    }

    this.history.push(messageRecord);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RADIO_MESSAGE_RECEIVED', messageRecord);
    }

    return messageRecord;
  }

  /**
   * Resolves an urgent radio transmission by selecting a decision choice.
   * Dispatches choice events over MessageBus and updates message status.
   *
   * @param {string} messageId - ID of active urgent message.
   * @param {string} decisionKey - Key matching choice in message.choices.
   * @returns {object} Decision resolution outcome.
   */
  makeDecision(messageId, decisionKey) {
    const messageIndex = this.activeMessages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      return {
        success: false,
        error: `Message with ID "${messageId}" not found in active urgent transmissions.`
      };
    }

    const message = this.activeMessages[messageIndex];
    const choice = message.choices.find((c) => c.key === decisionKey || c.id === decisionKey);

    if (!choice) {
      return {
        success: false,
        error: `Choice "${decisionKey}" not found for radio message "${messageId}".`
      };
    }

    // Mark message as resolved
    message.status = 'resolved';
    message.resolvedAt = new Date().toISOString();
    message.selectedDecision = {
      key: choice.key || choice.id,
      text: choice.text,
      resolvedAt: message.resolvedAt
    };

    // Remove from active pending messages
    this.activeMessages.splice(messageIndex, 1);

    // Apply any choice side-effects or events over MessageBus
    if (choice.events && Array.isArray(choice.events) && this.messageBus) {
      for (const evt of choice.events) {
        if (evt && evt.type) {
          this.messageBus.publish(evt.type, evt.payload || {});
        }
      }
    }

    if (choice.effects && this.messageBus) {
      for (const [stat, delta] of Object.entries(choice.effects)) {
        this.messageBus.publish('STAT_CHANGED', { stat, delta, reason: `Radio Decision: ${choice.text}` });
      }
    }

    // Publish RADIO_DECISION
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('RADIO_DECISION', {
        messageId: message.id,
        decisionKey,
        choice,
        message,
        channel: message.channel
      });
    }

    return {
      success: true,
      message,
      choice
    };
  }

  /**
   * Checks all active urgent messages for response window expiration.
   * Publishes RADIO_TIMEOUT for expired transmissions.
   *
   * @returns {Array<object>} List of timed-out messages.
   */
  checkTimeouts() {
    const timedOutList = [];
    const remaining = [];

    for (const msg of this.activeMessages) {
      if (typeof msg.remainingLifetime === 'number' && msg.remainingLifetime <= 0) {
        msg.status = 'timed_out';
        msg.timedOutAt = new Date().toISOString();
        timedOutList.push(msg);

        if (this.messageBus && typeof this.messageBus.publish === 'function') {
          this.messageBus.publish('RADIO_TIMEOUT', {
            messageId: msg.id,
            message: msg,
            channel: msg.channel,
            reason: 'Response window expired before command order was radioed.'
          });
        }
      } else {
        remaining.push(msg);
      }
    }

    this.activeMessages = remaining;
    return timedOutList;
  }

  /**
   * Retrieves list of active pending messages requiring command decisions.
   * @returns {Array<object>}
   */
  getActiveMessages() {
    return [...this.activeMessages];
  }

  /**
   * Retrieves complete radio traffic history.
   * @returns {Array<object>}
   */
  getMessageHistory() {
    return [...this.history];
  }

  /**
   * Serializes radio system state for save game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      activeMessages: JSON.parse(JSON.stringify(this.activeMessages)),
      history: JSON.parse(JSON.stringify(this.history)),
      baseReception: this.baseReception,
      receptionModifier: this.receptionModifier
    };
  }

  /**
   * Restores radio system state from serialized save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    this.activeMessages = Array.isArray(data.activeMessages)
      ? JSON.parse(JSON.stringify(data.activeMessages))
      : [];

    this.history = Array.isArray(data.history)
      ? JSON.parse(JSON.stringify(data.history))
      : [];

    this.baseReception = typeof data.baseReception === 'number' ? data.baseReception : 100;
    this.receptionModifier = typeof data.receptionModifier === 'number' ? data.receptionModifier : 0;
  }

  /**
   * Internal handler for SCENE_RENDERED events.
   * Decrements lifetime of active messages and evaluates timeouts.
   * @param {object|string} payload
   * @private
   */
  _handleSceneRendered(payload) {
    // Decrement remaining lifetime for all active urgent messages
    for (const msg of this.activeMessages) {
      if (typeof msg.remainingLifetime === 'number') {
        msg.remainingLifetime -= 1;
      }
    }

    // Check for expired response windows
    this.checkTimeouts();

    // Check if scene payload contains an immediate incoming radio dispatch
    const sceneObj = typeof payload === 'object' && payload !== null ? payload : {};
    if (sceneObj.radioTransmission) {
      this.receiveMessage(sceneObj.radioTransmission);
    }
  }

  /**
   * Internal handler for CHOICE_MADE events.
   * Checks if player choice invoked a direct radio communication or fire mission.
   * @param {object} choice
   * @private
   */
  _handleChoiceMade(choice) {
    if (!choice || typeof choice !== 'object') return;

    if (choice.radioCall) {
      this.transmit(
        choice.radioCall.channel || RADIO_CHANNELS.HQ,
        choice.radioCall.message || choice.text,
        choice.radioCall.options || {}
      );
    }
  }

  /**
   * Internal handler for WEATHER_CHANGED events.
   * Updates atmospheric radio reception degradation.
   * @param {object} payload
   * @private
   */
  _handleWeatherChanged(payload) {
    if (payload && payload.modifiers && typeof payload.modifiers.radioReception === 'number') {
      this.receptionModifier = payload.modifiers.radioReception;
    } else {
      this.receptionModifier = 0;
    }
  }

  /**
   * Internal handler for GAME_LOADED events.
   * @param {object} payload
   * @private
   */
  _handleGameLoaded(payload) {
    if (payload && payload.radio) {
      this.deserialize(payload.radio);
    }
  }

  /**
   * Normalizes channel names against RADIO_CHANNELS catalog.
   * @param {string} channel
   * @returns {string}
   * @private
   */
  _normalizeChannel(channel) {
    if (!channel || typeof channel !== 'string') return RADIO_CHANNELS.HQ;

    const lower = channel.trim().toLowerCase();
    for (const [key, value] of Object.entries(RADIO_CHANNELS)) {
      if (value.toLowerCase() === lower || key.toLowerCase() === lower) {
        return value;
      }
    }

    // Secondary matches
    if (lower.includes('observer') || lower.includes('spotter')) return RADIO_CHANNELS.FORWARD_OBSERVER;
    if (lower.includes('medevac') || lower.includes('dustoff')) return RADIO_CHANNELS.MEDEVAC;
    if (lower.includes('artillery') || lower.includes('battery')) return RADIO_CHANNELS.ARTILLERY;
    if (lower.includes('air') || lower.includes('phantom') || lower.includes('spooky')) return RADIO_CHANNELS.AIR_SUPPORT;

    return RADIO_CHANNELS.HQ;
  }
}
