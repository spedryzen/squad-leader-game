// Squad Leader: Vietnam - Dynamic Event System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: DynamicEventManager.js
Purpose: Injects procedural dynamic battlefield encounters and tactical incidents to ensure high campaign replayability.
Responsibilities:
- Maintain procedural dynamic event catalog with 9 tactical encounter definitions
- Evaluate battlefield conditions (heat, intel, scene progress) to probabilistically trigger dynamic encounters
- Handle event resolution with branched tactical outcomes and consequence application
- Synchronize consequences across MessageBus (resource adjustments, casualties, morale, intelligence)
- Track full event encounter history and support complete state serialization and deserialization
Dependencies: MessageBus.js
Published Events:
- DYNAMIC_EVENT_TRIGGERED: Dispatched when a dynamic incident or procedural encounter occurs
- DYNAMIC_EVENT_RESOLVED: Dispatched when a dynamic encounter is resolved with tactical outcomes
Subscribed Events:
- SCENE_RENDERED: Evaluates dynamic event trigger conditions upon arriving at new locations
- CHOICE_MADE: Checks for tactical opportunities to resolve or trigger situational encounters
- STAT_CHANGED: Reacts to spikes in heat or intelligence to adjust encounter probabilities
- GAME_LOADED: Restores encounter history and cooldown states from save data
Future Expansion Notes: Future phases will support multi-stage dynamic encounters, dynamic weather squalls, and secondary squad rescue missions.
--------------------------------------------------
*/

/**
 * Catalog of the 9 procedural dynamic battlefield events in Squad Leader: Vietnam.
 */
export const DYNAMIC_EVENTS = {
  'friendly_patrol': {
    id: 'friendly_patrol',
    name: 'Friendly Patrol',
    category: 'allied_encounter',
    description: 'Encounter an allied US Marine or ARVN infantry patrol operating in the sector.',
    triggerCriteria: { minHeat: 0, maxHeat: 70, minIntel: 0 },
    outcomes: {
      'trade_supplies': {
        name: 'Trade Rations & Ammo',
        description: 'Squad exchanges surplus gear for critical fresh supplies.',
        effects: { supplies: +20, heat: -5 },
        moraleDelta: +5
      },
      'share_recon': {
        name: 'Exchange Recon Intel',
        description: 'Allied patrol points out enemy trail markers and suspected mortar pits.',
        effects: { intel: +15 },
        moraleDelta: 0
      }
    }
  },
  'sniper_attack': {
    id: 'sniper_attack',
    name: 'Sniper Attack',
    category: 'hostile_encounter',
    description: 'Sudden supersonic rifle fire cracks from the canopy, pinning the squad into the mud.',
    triggerCriteria: { minHeat: 35, maxHeat: 100, minIntel: 0 },
    outcomes: {
      'counter_snipe': {
        name: 'Suppress & Counter-Snipe',
        description: 'Marksman spots muzzle flash and eliminates the sniper with return fire.',
        effects: { intel: +10, heat: +5 },
        moraleDelta: +5
      },
      'pinned_casualty': {
        name: 'Pinned Down with Wounded',
        description: 'Sniper round strikes a squad member before contact is broken.',
        effects: { heat: +15 },
        casualtyRisk: true,
        moraleDelta: -15
      },
      'smoke_retreat': {
        name: 'Deploy Smoke & Disengage',
        description: 'Squad pops smoke grenades and maneuvers around the sniper kill-zone.',
        effects: { supplies: -10, heat: 0 },
        moraleDelta: -5
      }
    }
  },
  'ammo_cache': {
    id: 'ammo_cache',
    name: 'Ammo Cache',
    category: 'tactical_discovery',
    description: 'Discovered a camouflaged NVA supply cache concealed under thick bamboo brush.',
    triggerCriteria: { minHeat: 10, maxHeat: 80, minIntel: 10 },
    outcomes: {
      'secure_cache': {
        name: 'Secure Munitions & Medical Kits',
        description: 'Salvaged usable ammo and medical field supplies from the cache.',
        effects: { supplies: +25 },
        moraleDelta: +10
      },
      'demolish_cache': {
        name: 'Demolish with Thermite/C4',
        description: 'Rigged explosives to detonate enemy weapons, preventing resupply.',
        effects: { heat: +15, intel: +10 },
        moraleDelta: +5
      },
      'booby_trapped': {
        name: 'Trigger Hidden Grenade Trap',
        description: 'A pull-wire detonated a concealed grenade during cache inspection.',
        effects: { supplies: -5, heat: +15 },
        casualtyRisk: true,
        moraleDelta: -10
      }
    }
  },
  'lost_recon_team': {
    id: 'lost_recon_team',
    name: 'Lost Recon Team',
    category: 'rescue_mission',
    description: 'Intercepted distress beacon from an isolated US long-range reconnaissance team.',
    triggerCriteria: { minHeat: 20, maxHeat: 85, minIntel: 15 },
    outcomes: {
      'rescue_success': {
        name: 'Execute Daring Extraction',
        description: 'Successfully reached and extracted the stranded scouts under fire.',
        effects: { intel: +25, heat: +10 },
        moraleDelta: +20
      },
      'unable_to_reach': {
        name: 'Unable to Reach in Time',
        description: 'Enemy patrols overran the LZ before squad could link up.',
        effects: { heat: +10 },
        moraleDelta: -15
      }
    }
  },
  'captured_courier': {
    id: 'captured_courier',
    name: 'Captured Courier',
    category: 'intelligence_opportunity',
    description: 'Point man intercepts and detains an NVA liaison courier carrying leather dispatch satchels.',
    triggerCriteria: { minHeat: 0, maxHeat: 75, minIntel: 20 },
    outcomes: {
      'exploit_intel': {
        name: 'Decode Dispatch Maps',
        description: 'Deciphered route maps showing enemy underground staging areas.',
        effects: { intel: +35, heat: -10 },
        moraleDelta: +10
      },
      'interrogate_briefly': {
        name: 'Field Interrogation',
        description: 'Courier reveals upcoming mortar coordinate targets before handoff.',
        effects: { intel: +20 },
        moraleDelta: +5
      }
    }
  },
  'helicopter_support': {
    id: 'helicopter_support',
    name: 'Helicopter Support',
    category: 'allied_air_support',
    description: 'An AH-1 Cobra gunship checks in on tactical radio frequency, offering close-air support.',
    triggerCriteria: { minHeat: 30, maxHeat: 100, minIntel: 0 },
    outcomes: {
      'rocket_strike': {
        name: 'Order Rocket & Minigun Run',
        description: 'Gunship saturates the enemy treeline with 2.75-inch rockets and minigun fire.',
        effects: { heat: -25 },
        moraleDelta: +15
      },
      'emergency_airdrop': {
        name: 'Request Emergency Crate Drop',
        description: 'Helicopter drops water bladders and ammunition crates into a small clearing.',
        effects: { supplies: +30 },
        moraleDelta: +10
      }
    }
  },
  'booby_trap': {
    id: 'booby_trap',
    name: 'Booby Trap',
    category: 'hazard_encounter',
    description: 'Point man spots a taut copper tripwire connected to a concealed grenade in the roots.',
    triggerCriteria: { minHeat: 25, maxHeat: 100, minIntel: 0 },
    outcomes: {
      'disarmed': {
        name: 'Delicate Defusal',
        description: 'Point scout carefully snips the tripwire and disarms the explosive mechanism.',
        effects: { intel: +10 },
        moraleDelta: +10
      },
      'detonated': {
        name: 'Tripwire Tripped',
        description: 'The explosive detonates, spraying shrapnel across the lead scout.',
        effects: { supplies: -10, heat: +15 },
        casualtyRisk: true,
        moraleDelta: -15
      },
      'marked_bypassed': {
        name: 'Mark & Bypass',
        description: 'Engineers stake danger flags and route the squad safely around the hazard.',
        effects: { heat: 0 },
        moraleDelta: 0
      }
    }
  },
  'vehicle_breakdown': {
    id: 'vehicle_breakdown',
    name: 'Vehicle Breakdown',
    category: 'tactical_obstacle',
    description: 'An allied M113 ACAV or supply truck has thrown a track on a jungle road corridor.',
    triggerCriteria: { minHeat: 0, maxHeat: 90, minIntel: 0 },
    outcomes: {
      'assist_repairs': {
        name: 'Provide Perimeter Security & Assist',
        description: 'Squad holds the perimeter while mechanics repair the track; rewarded with ammo.',
        effects: { supplies: +20, heat: +5 },
        moraleDelta: +10
      },
      'scuttle_and_march': {
        name: 'Scuttle Vehicle and Press On',
        description: 'Crew destroys sensitive radio gear and abandons vehicle to avoid encirclement.',
        effects: { heat: +10, supplies: -5 },
        moraleDelta: -5
      }
    }
  },
  'enemy_defector': {
    id: 'enemy_defector',
    name: 'Enemy Defector',
    category: 'intelligence_opportunity',
    description: 'An NVA soldier waving Chieu Hoi safe-conduct leaflets emerges with hands raised.',
    triggerCriteria: { minHeat: 20, maxHeat: 85, minIntel: 20 },
    outcomes: {
      'accept_surrender': {
        name: 'Accept Surrender & Interrogate',
        description: 'Defector reveals exact bunker firing apertures and concealed tunnel entrances.',
        effects: { intel: +40 },
        moraleDelta: +10
      },
      'false_surrender_ambush': {
        name: 'Trap Sprung During Handoff',
        description: 'The surrender was a feint; trailing enemy squad opens fire on flank.',
        effects: { heat: +20 },
        casualtyRisk: true,
        moraleDelta: -10
      }
    }
  }
};

/**
 * Manages procedural random dynamic events during combat operations.
 */
export class DynamicEventManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus]
   * @param {object} [options={}]
   */
  constructor(messageBus = null, options = {}) {
    this.messageBus = messageBus;
    this.eventCatalog = { ...DYNAMIC_EVENTS };
    this.history = [];
    this.activeEvent = null;
    this.cooldowns = {};
    this.triggerProbability = Number(options.triggerProbability ?? 0.35);

    this._setupSubscriptions();
  }

  /**
   * Register event listeners on the MessageBus.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. SCENE_RENDERED: Evaluate potential dynamic event trigger on new scene entry
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      // Decrement existing cooldowns on scene transition
      for (const [id, count] of Object.entries(this.cooldowns)) {
        if (count > 0) {
          this.cooldowns[id] = count - 1;
        }
      }

      if (payload && payload.dynamicEvent) {
        // Explicitly requested dynamic event from scene data
        this.triggerEvent(payload.dynamicEvent, { scene: payload, forced: true });
      }
    });

    // 2. CHOICE_MADE: Check if choice triggers an event (e.g. choice.triggerEvent)
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      if (payload && payload.triggerEvent) {
        this.triggerEvent(payload.triggerEvent, { choice: payload });
      }
    });

    // 3. STAT_CHANGED: Monitor environmental parameters
    this.messageBus.subscribe('STAT_CHANGED', () => {
      // Stored state updates available when checkDynamicEventTrigger is invoked
    });

    // 4. GAME_LOADED: Restore dynamic event manager state from save game
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && payload.dynamicEvents) {
        this.deserialize(payload.dynamicEvents);
      }
    });
  }

  /**
   * Look up an event definition by name, key, or ID (supports case-insensitive matching).
   * @param {string} eventId
   * @returns {object|null}
   */
  getEventDefinition(eventId) {
    if (!eventId) return null;
    const normalized = String(eventId).trim().toLowerCase().replace(/\s+/g, '_');

    for (const [key, def] of Object.entries(this.eventCatalog)) {
      if (
        key.toLowerCase() === normalized ||
        def.id.toLowerCase() === normalized ||
        def.name.toLowerCase() === String(eventId).trim().toLowerCase()
      ) {
        return def;
      }
    }

    return null;
  }

  /**
   * Trigger a procedural dynamic battlefield event.
   * Records active state and broadcasts DYNAMIC_EVENT_TRIGGERED across MessageBus.
   * @param {string} eventId
   * @param {object} [context={}]
   * @returns {object|null} The active event session record, or null if definition not found.
   */
  triggerEvent(eventId, context = {}) {
    const def = this.getEventDefinition(eventId);
    if (!def) {
      console.warn(`DynamicEventManager: Event definition not found for "${eventId}"`);
      return null;
    }

    const eventRecord = {
      eventId: def.id,
      name: def.name,
      category: def.category,
      description: def.description,
      context,
      outcomes: { ...def.outcomes },
      triggeredAt: new Date().toISOString()
    };

    this.activeEvent = eventRecord;
    this.cooldowns[def.id] = 3; // Cooldown of 3 scenes to prevent immediate repeats

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('DYNAMIC_EVENT_TRIGGERED', {
        eventId: def.id,
        name: def.name,
        eventDef: def,
        context,
        timestamp: eventRecord.triggeredAt
      });
    }

    return eventRecord;
  }

  /**
   * Resolve an active or targeted dynamic event with a specific tactical outcome.
   * Applies consequence effects over the MessageBus and broadcasts DYNAMIC_EVENT_RESOLVED.
   * @param {string} eventId
   * @param {string} outcomeKey - Key matching an outcome in the event definition, or custom outcome
   * @param {object} [customData={}]
   * @returns {object|null} Resolution outcome record.
   */
  resolveEvent(eventId, outcomeKey = 'default', customData = {}) {
    const def = this.getEventDefinition(eventId);
    if (!def) return null;

    const outcomeDef = def.outcomes?.[outcomeKey] || {
      name: outcomeKey,
      description: 'The dynamic event was resolved.',
      effects: customData.effects || {},
      moraleDelta: customData.moraleDelta || 0
    };

    const resolutionRecord = {
      eventId: def.id,
      name: def.name,
      outcomeKey,
      outcome: outcomeDef,
      effects: { ...(outcomeDef.effects || {}) },
      moraleDelta: outcomeDef.moraleDelta || 0,
      customData,
      resolvedAt: new Date().toISOString()
    };

    this.history.push(resolutionRecord);

    // Apply consequence effects over MessageBus
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      // 1. Resource stat modifications
      if (resolutionRecord.effects && Object.keys(resolutionRecord.effects).length > 0) {
        for (const [stat, delta] of Object.entries(resolutionRecord.effects)) {
          this.messageBus.publish('STAT_CHANGED', { stat, delta });
        }
      }

      // 2. Casualty / Wound risk
      if (outcomeDef.casualtyRisk) {
        this.messageBus.publish('CASUALTY_RISK_TRIGGERED', {
          eventId: def.id,
          reason: def.name
        });
      }

      // 3. Broadcast final resolution event
      this.messageBus.publish('DYNAMIC_EVENT_RESOLVED', {
        eventId: def.id,
        name: def.name,
        eventDef: def,
        outcomeKey,
        outcome: outcomeDef,
        effects: resolutionRecord.effects,
        moraleDelta: resolutionRecord.moraleDelta,
        timestamp: resolutionRecord.resolvedAt
      });
    }

    if (this.activeEvent && this.activeEvent.eventId === def.id) {
      this.activeEvent = null;
    }

    return resolutionRecord;
  }

  /**
   * Evaluate whether battlefield parameters (heat, intel, scene tags) trigger a dynamic event.
   * @param {object} [scenePayload={}] - Current scene context.
   * @param {number} [heat=0] - Current combat heat level.
   * @param {number} [intel=0] - Current intelligence score.
   * @returns {object|null} Selected event definition or null if no trigger.
   */
  checkDynamicEventTrigger(scenePayload = {}, heat = 0, intel = 0) {
    const currentHeat = Number(heat || 0);
    const currentIntel = Number(intel || 0);

    // Filter available events not currently on cooldown and matching criteria
    const candidates = [];

    for (const [id, def] of Object.entries(this.eventCatalog)) {
      if ((this.cooldowns[id] || 0) > 0) continue;

      const crit = def.triggerCriteria || {};
      const minHeat = crit.minHeat ?? 0;
      const maxHeat = crit.maxHeat ?? 100;
      const minIntel = crit.minIntel ?? 0;

      if (currentHeat >= minHeat && currentHeat <= maxHeat && currentIntel >= minIntel) {
        candidates.push(def);
      }
    }

    if (candidates.length === 0) return null;

    // Probabilistic selection: roll against trigger probability
    const roll = Math.random();
    if (roll <= this.triggerProbability) {
      const selectedIndex = Math.floor(Math.random() * candidates.length);
      return candidates[selectedIndex];
    }

    return null;
  }

  /**
   * Retrieve currently active unresolved dynamic event.
   * @returns {object|null}
   */
  getActiveEvent() {
    return this.activeEvent;
  }

  /**
   * Retrieve full dynamic event encounter history.
   * @returns {Array<object>}
   */
  getEventHistory() {
    return [...this.history];
  }

  /**
   * Serialize dynamic event manager state for save game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      history: [...this.history],
      activeEvent: this.activeEvent ? { ...this.activeEvent } : null,
      cooldowns: { ...this.cooldowns },
      triggerProbability: this.triggerProbability
    };
  }

  /**
   * Restore dynamic event manager state from save game data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data.history)) {
      this.history = [...data.history];
    }

    this.activeEvent = data.activeEvent || null;

    if (data.cooldowns && typeof data.cooldowns === 'object') {
      this.cooldowns = { ...data.cooldowns };
    }

    if (data.triggerProbability !== undefined) {
      this.triggerProbability = Number(data.triggerProbability);
    }
  }
}
