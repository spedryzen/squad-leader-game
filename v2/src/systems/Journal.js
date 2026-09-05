// Squad Leader: Vietnam - Campaign Journal System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: Journal.js
Purpose: Automatically record and format wartime narrative diary entries (KIA, WIA, Heroic Acts, Ambushes, Battles, Weather, Radio logs).
Responsibilities:
- Maintain chronological log of tactical campaign journal entries
- Automatically capture battlefield events (casualties, heroism, ambushes, weather changes, radio intercepts)
- Ensure all user-facing date/time displays adhere to PST (America/Los_Angeles) per Directive 13
- Support querying and filtering entries by category and tag
- Provide formatted military diary presentations and exportable digests
- Support state serialization and deserialization for save game continuity
Dependencies: MessageBus.js
Published Events:
- JOURNAL_ENTRY_ADDED: Dispatched whenever a new journal entry is recorded
Subscribed Events:
- CASUALTY_TAKEN: Records casualty reports and battlefield losses
- HEROIC_ACTION: Records valorous conduct and field commendations
- AMBUSH_TRIGGERED: Records enemy ambushes, sniper fire, and booby traps
- WEATHER_CHANGED: Records atmospheric shifts (monsoon downpours, morning fog)
- RADIO_MESSAGE_RECEIVED: Records incoming battalion intelligence and field transmissions
- SCENE_RENDERED: Tracks tactical positioning and operational milestones
- GAME_LOADED: Restores journal history from saved state
Future Expansion Notes: Future phases will support player personal note additions, photographic/sketch attachments, and post-campaign after-action review (AAR) generation.
--------------------------------------------------
*/

/**
 * Standard categories for wartime journal logs.
 */
export const JOURNAL_CATEGORIES = {
  COMBAT: 'COMBAT',
  CASUALTY: 'CASUALTY',
  HEROISM: 'HEROISM',
  WEATHER: 'WEATHER',
  INTEL: 'INTEL',
  COMMAND: 'COMMAND'
};

/**
 * Campaign Journal that logs tactical events, casualties, heroism, and radio transmissions.
 */
export class Journal {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus]
   * @param {object} [options={}]
   * @param {string} [options.timeZone='America/Los_Angeles'] - Default PST user timezone (Directive 13).
   * @param {number} [options.currentDay=1] - Campaign day counter.
   * @param {string} [options.currentTime='0600 hrs'] - In-game operational time.
   * @param {string} [options.currentLocation='Hill 881 South'] - Default starting grid.
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.timeZone = options.timeZone || 'America/Los_Angeles';
    this.currentDay = options.currentDay ?? 1;
    this.currentTime = options.currentTime || '0600 hrs';
    this.currentLocation = options.currentLocation || 'Hill 881 South';

    /** @type {object[]} */
    this.entries = [];
    this._entryCounter = 0;

    this._setupSubscriptions();
  }

  /**
   * Format a JavaScript Date into a military timestamp using the active user timezone (PST).
   * Complies strictly with Directive 13 (User Time Zone Standardization).
   * @param {Date|string|number} [date=new Date()]
   * @returns {string}
   */
  formatTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: this.timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }

  /**
   * Set user-configurable active timezone (e.g. 'America/Los_Angeles', 'America/New_York', 'PST').
   * @param {string} timeZone
   */
  setTimeZone(timeZone) {
    if (!timeZone || typeof timeZone !== 'string') return;
    const tz = timeZone.toUpperCase() === 'PST' ? 'America/Los_Angeles' : (
      timeZone.toUpperCase() === 'EST' ? 'America/New_York' : timeZone
    );

    try {
      // Test validity of timezone string
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      this.timeZone = tz;
    } catch {
      console.warn(`Journal: Invalid timeZone identifier "${timeZone}". Retaining "${this.timeZone}".`);
    }
  }

  /**
   * Get active user timezone.
   * @returns {string}
   */
  getTimeZone() {
    return this.timeZone;
  }

  /**
   * Register event listeners for battlefield and mission lifecycle occurrences.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. Casualty logging
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      const name = payload?.name || payload?.soldier?.name || payload?.soldierId || payload?.id || 'Squad Member';
      const role = payload?.role || payload?.soldier?.role || 'Infantry';
      const cause = payload?.cause || payload?.reason || 'Enemy Action';
      const status = (payload?.status || 'KIA').toUpperCase();

      this.addEntry({
        title: `Casualty Report: ${name} (${status})`,
        category: JOURNAL_CATEGORIES.CASUALTY,
        location: this.currentLocation,
        content: `${name} (${role}) became a combat casualty due to ${cause}. Medical evacuation status logged.`,
        tags: ['CASUALTY', status, String(name)]
      });
    });

    // 2. Heroic action logging
    this.messageBus.subscribe('HEROIC_ACTION', (payload) => {
      const heroName = payload?.heroName || payload?.heroId || 'A Soldier';
      const action = payload?.action || payload?.description || 'performed an act of valor beyond the call of duty';

      this.addEntry({
        title: `Combat Commendation: ${heroName}`,
        category: JOURNAL_CATEGORIES.HEROISM,
        location: this.currentLocation,
        content: `${heroName} displayed exceptional valor under direct fire: ${action}`,
        tags: ['HEROISM', 'VALOR', String(heroName)]
      });
    });

    // 3. Ambush logging
    this.messageBus.subscribe('AMBUSH_TRIGGERED', (payload) => {
      const loc = payload?.location || this.currentLocation;
      const desc = payload?.description || payload?.details || 'NVA/VC forces sprang a coordinated ambush from concealed fighting holes.';

      this.addEntry({
        title: `Ambush Contact at ${loc}`,
        category: JOURNAL_CATEGORIES.COMBAT,
        location: loc,
        content: `Contact front! ${desc}`,
        tags: ['COMBAT', 'AMBUSH', loc]
      });
    });

    // 4. Weather changes
    this.messageBus.subscribe('WEATHER_CHANGED', (payload) => {
      const weather = payload?.weather || payload?.condition || 'Monsoon Rain';
      const visibility = payload?.visibility || 'Reduced';

      this.addEntry({
        title: `Weather Shift: ${weather}`,
        category: JOURNAL_CATEGORIES.WEATHER,
        location: this.currentLocation,
        content: `AOR weather transitioned to ${weather}. Ground visibility is now ${visibility}.`,
        tags: ['WEATHER', weather]
      });
    });

    // 5. Radio intercepts and battalion orders
    this.messageBus.subscribe('RADIO_MESSAGE_RECEIVED', (payload) => {
      const callsign = payload?.callsign || payload?.sender || 'Battalion TOC';
      const msg = payload?.message || payload?.content || payload?.text || 'Maintain defensive perimeter.';
      const cat = payload?.isIntel ? JOURNAL_CATEGORIES.INTEL : JOURNAL_CATEGORIES.COMMAND;

      this.addEntry({
        title: `Radio Traffic: [${callsign}]`,
        category: cat,
        location: this.currentLocation,
        content: `Transmission decrypted: "${msg}"`,
        tags: ['RADIO', cat, callsign]
      });
    });

    // 6. Tactical scene transitions (tracks location and operational progress)
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      if (payload && payload.location) {
        this.currentLocation = payload.location;
      }
      if (payload && payload.inGameDay !== undefined) {
        this.currentDay = payload.inGameDay;
      }
      if (payload && payload.time) {
        this.currentTime = payload.time;
      }
    });

    // 7. Save game restore
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.journal || payload.journalEntries)) {
        this.deserialize(payload.journal || payload.journalEntries);
      }
    });
  }

  /**
   * Add a new journal entry to the campaign log.
   * Formats the timestamp using active user timezone (PST) and broadcasts JOURNAL_ENTRY_ADDED.
   * @param {object} entryData
   * @param {string} [entryData.title]
   * @param {string} [entryData.category]
   * @param {string} [entryData.location]
   * @param {string} [entryData.content]
   * @param {string[]} [entryData.tags]
   * @param {number} [entryData.inGameDay]
   * @param {string} [entryData.time]
   * @returns {object} The created journal entry record.
   */
  addEntry(entryData = {}) {
    this._entryCounter++;
    const now = new Date();

    const category = String(entryData.category || JOURNAL_CATEGORIES.COMBAT).toUpperCase();
    const validCategory = JOURNAL_CATEGORIES[category] || JOURNAL_CATEGORIES.COMBAT;

    const entry = {
      id: entryData.id || `journal_${Date.now()}_${this._entryCounter}`,
      timestamp: entryData.timestamp || this.formatTimestamp(now),
      isoTimestamp: entryData.isoTimestamp || now.toISOString(),
      inGameDay: entryData.inGameDay ?? this.currentDay,
      time: entryData.time || this.currentTime,
      title: entryData.title || 'Operational Dispatch',
      location: entryData.location || this.currentLocation,
      content: entryData.content || 'Situation logged without detailed comments.',
      category: validCategory,
      tags: Array.isArray(entryData.tags) ? [...entryData.tags] : []
    };

    this.entries.push(entry);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('JOURNAL_ENTRY_ADDED', { entry });
    }

    return entry;
  }

  /**
   * Retrieve all recorded journal entries.
   * @returns {object[]}
   */
  getEntries() {
    return [...this.entries];
  }

  /**
   * Retrieve journal entries belonging to a specific category.
   * @param {string} category - 'COMBAT', 'CASUALTY', 'HEROISM', 'WEATHER', 'INTEL', 'COMMAND'
   * @returns {object[]}
   */
  getEntriesByCategory(category) {
    if (!category) return [];
    const target = String(category).toUpperCase();
    return this.entries.filter(e => e.category === target);
  }

  /**
   * Retrieve entries marked with a specific tag.
   * @param {string} tag
   * @returns {object[]}
   */
  getEntriesByTag(tag) {
    if (!tag) return [];
    const target = String(tag).toLowerCase();
    return this.entries.filter(e => e.tags.some(t => String(t).toLowerCase() === target));
  }

  /**
   * Retrieve formatted human-readable military journal lines.
   * All timestamps are displayed in the user's active timezone (PST).
   * @returns {string[]}
   */
  getFormattedEntries() {
    return this.entries.map((e) => {
      const header = `[${e.timestamp} | Day ${e.inGameDay} - ${e.time}] [${e.category}] ${e.title}`;
      const location = `LOCATION: ${e.location}`;
      const content = `LOG: ${e.content}`;
      const tags = e.tags.length > 0 ? `TAGS: #${e.tags.join(' #')}` : '';
      return [header, location, content, tags].filter(Boolean).join('\n');
    });
  }

  /**
   * Serialize journal state for save games.
   * @returns {object}
   */
  serialize() {
    return {
      timeZone: this.timeZone,
      currentDay: this.currentDay,
      currentTime: this.currentTime,
      currentLocation: this.currentLocation,
      entryCounter: this._entryCounter,
      entries: [...this.entries]
    };
  }

  /**
   * Restore journal state from save game data.
   * @param {object|object[]} data
   */
  deserialize(data) {
    if (!data) return;

    if (Array.isArray(data)) {
      this.entries = [...data];
      this._entryCounter = this.entries.length;
    } else if (typeof data === 'object') {
      if (data.timeZone) this.setTimeZone(data.timeZone);
      if (data.currentDay !== undefined) this.currentDay = data.currentDay;
      if (data.currentTime) this.currentTime = data.currentTime;
      if (data.currentLocation) this.currentLocation = data.currentLocation;
      if (data.entryCounter !== undefined) this._entryCounter = data.entryCounter;
      if (Array.isArray(data.entries)) {
        this.entries = [...data.entries];
      }
    }
  }
}
