// Squad Leader: Vietnam - Tactical Map Manager
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: TacticalMapManager.js
Purpose: Coordinates tactical map data, spatial tracking, breadcrumb path history, and Intel-gated tactical markers for Grid 881 and Highway 9.
Responsibilities:
- Maintain authoritative registry of tactical map markers across 7 battlefield categories:
  * enemy_location: Last known NVA positions / spider holes
  * ambush: Verified or suspected ambush danger zones
  * mortar_impact: Artillery or mortar crater zones
  * minefield: Dangerous booby-trapped or toe-popper areas
  * casualty: Locations where squad members fell or were wounded
  * extraction_zone: LZ X-Ray, LZ Blue, emergency pick-up points
  * recon_discovery: Trails, tunnels, supply caches discovered by scouts
- Enforce dynamic Intel-tier visibility gating:
  * LOW Intel: Only reveals casualty markers, player path, and broad extraction zone.
  * MEDIUM Intel: Reveals mortar impacts, recon discoveries, and general ambush zones (plus LOW markers).
  * HIGH Intel: Reveals exact enemy locations, minefields, hidden paths, and fortified bunkers (all markers).
- Record and maintain squad movement breadcrumbs (x, y, sceneId, timestamp) adhering to Directive 13 PST time.
- Publish MAP_UPDATED and MAP_MARKER_ADDED events over the MessageBus.
- Subscribe to SCENE_RENDERED, CASUALTY_TAKEN, AMBUSH_TRIGGERED, INTEL_RECON_ACQUIRED, INTEL_LEVEL_CHANGED, and GAME_LOADED.
- Provide full serialization and deserialization for game save persistence.
Dependencies: MessageBus.js, optional IntelSystem.js, optional Ledger.js
Published Events:
- MAP_UPDATED: Dispatched when markers, intel tier visibility, or squad movement path changes
- MAP_MARKER_ADDED: Dispatched when a new tactical marker is placed on the map
Subscribed Events:
- SCENE_RENDERED: Automatically updates player path breadcrumb from scene coordinates
- CASUALTY_TAKEN: Places casualty marker at squad's current coordinates
- AMBUSH_TRIGGERED: Places ambush danger zone marker at contact location
- INTEL_RECON_ACQUIRED: Places recon discovery marker based on scout findings
- INTEL_LEVEL_CHANGED: Triggers map refresh as new markers become visible
- GAME_LOADED: Restores markers and path history from save data
Future Expansion Notes: Dynamic line-of-sight fog-of-war polygons, topographical elevation overlays, and artillery call grid coordinates.
--------------------------------------------------
*/

/**
 * Standard tactical marker types in Squad Leader: Vietnam.
 */
export const MAP_MARKER_TYPES = {
  ENEMY_LOCATION: 'enemy_location',
  AMBUSH: 'ambush',
  MORTAR_IMPACT: 'mortar_impact',
  MINEFIELD: 'minefield',
  CASUALTY: 'casualty',
  EXTRACTION_ZONE: 'extraction_zone',
  RECON_DISCOVERY: 'recon_discovery'
};

/**
 * Minimum Intelligence tiers required to reveal marker types on the tactical map.
 * - LOW: casualty, extraction_zone
 * - MEDIUM: mortar_impact, recon_discovery, ambush
 * - HIGH: enemy_location, minefield
 */
export const MARKER_INTEL_TIERS = {
  [MAP_MARKER_TYPES.CASUALTY]: 'LOW',
  [MAP_MARKER_TYPES.EXTRACTION_ZONE]: 'LOW',
  [MAP_MARKER_TYPES.MORTAR_IMPACT]: 'MEDIUM',
  [MAP_MARKER_TYPES.RECON_DISCOVERY]: 'MEDIUM',
  [MAP_MARKER_TYPES.AMBUSH]: 'MEDIUM',
  [MAP_MARKER_TYPES.ENEMY_LOCATION]: 'HIGH',
  [MAP_MARKER_TYPES.MINEFIELD]: 'HIGH'
};

/**
 * Numeric hierarchy for comparing intelligence tier thresholds.
 */
const INTEL_TIER_RANKS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

/**
 * TacticalMapManager coordinates spatial tracking, breadcrumbs, and Intel-gated markers.
 */
export class TacticalMapManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [options={}] - Configuration options.
   * @param {import('./IntelSystem.js').IntelSystem} [options.intelSystem] - IntelSystem reference.
   * @param {import('../state/Ledger.js').Ledger} [options.ledger] - Ledger reference.
   * @param {string} [options.timeZone='America/Los_Angeles'] - User timezone preference (Directive 13).
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.intelSystem = options.intelSystem || null;
    this.ledger = options.ledger || null;
    this.timeZone = options.timeZone || 'America/Los_Angeles';

    /** @type {Map<string, object>} */
    this.markers = new Map();

    /** @type {Array<{x: number, y: number, sceneId: string, timestamp: string}>} */
    this.pathHistory = [];

    // Current coordinates of the squad
    this.currentPosition = { x: 50, y: 50, sceneId: 'start' };

    this._setupSubscriptions();
  }

  /**
   * Set or update active user timezone (Directive 13).
   * @param {string} tz
   */
  setTimeZone(tz) {
    if (!tz || typeof tz !== 'string') return;
    this.timeZone = tz.toUpperCase() === 'PST' ? 'America/Los_Angeles' : tz;
  }

  /**
   * Format a date into user's active timezone timestamp.
   * @param {Date} [date=new Date()]
   * @returns {string}
   */
  formatTimestamp(date = new Date()) {
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
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }

  /**
   * Set up MessageBus event subscriptions.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. SCENE_RENDERED: Record breadcrumb if coordinates exist
    this.messageBus.subscribe('SCENE_RENDERED', (payload) => {
      if (!payload) return;
      const sceneId = payload.id || payload.sceneId || 'unknown';
      if (typeof payload.mapX === 'number' && typeof payload.mapY === 'number') {
        this.recordPath(payload.mapX, payload.mapY, sceneId);
      }
    });

    // 2. CASUALTY_TAKEN: Place casualty marker at squad's current position
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      const name = payload?.name || payload?.soldier?.name || payload?.soldierId || 'Squad Member';
      const status = payload?.status === 'wounded' ? 'WIA' : 'KIA';
      const x = typeof payload?.mapX === 'number' ? payload.mapX : this.currentPosition.x;
      const y = typeof payload?.mapY === 'number' ? payload.mapY : this.currentPosition.y;

      this.addMarker(
        MAP_MARKER_TYPES.CASUALTY,
        x,
        y,
        `Casualty: ${name} (${status})`,
        {
          soldierId: payload?.soldierId || payload?.id,
          status,
          cause: payload?.cause || payload?.reason || 'Combat Fire'
        }
      );
    });

    // 3. AMBUSH_TRIGGERED: Place ambush marker
    this.messageBus.subscribe('AMBUSH_TRIGGERED', (payload) => {
      const desc = payload?.description || payload?.probableThreat || 'Ambush Contact';
      const x = typeof payload?.mapX === 'number' ? payload.mapX : this.currentPosition.x;
      const y = typeof payload?.mapY === 'number' ? payload.mapY : this.currentPosition.y;

      this.addMarker(
        MAP_MARKER_TYPES.AMBUSH,
        x,
        y,
        `Ambush Danger Zone: ${desc}`,
        { outcome: payload?.outcomeKey || 'ambush', details: payload }
      );
    });

    // 4. INTEL_RECON_ACQUIRED: Place recon or enemy marker
    this.messageBus.subscribe('INTEL_RECON_ACQUIRED', (payload) => {
      const disc = payload?.discovery;
      if (!disc) return;

      let markerType = MAP_MARKER_TYPES.RECON_DISCOVERY;
      if (disc.type === 'bunker' || disc.type === 'spider_hole' || disc.type === 'enemy_force') {
        markerType = MAP_MARKER_TYPES.ENEMY_LOCATION;
      } else if (disc.type === 'minefield' || disc.type === 'booby_trap') {
        markerType = MAP_MARKER_TYPES.MINEFIELD;
      }

      const x = typeof disc.mapX === 'number' ? disc.mapX : this.currentPosition.x;
      const y = typeof disc.mapY === 'number' ? disc.mapY : this.currentPosition.y;

      this.addMarker(
        markerType,
        x,
        y,
        disc.description || 'Recon Discovery',
        { discovery: disc }
      );
    });

    // 5. INTEL_LEVEL_CHANGED: Re-publish map updated event as visibility shifts
    this.messageBus.subscribe('INTEL_LEVEL_CHANGED', () => {
      this._publishMapUpdated();
    });

    // 6. GAME_LOADED: Restore serialized map data
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.tacticalMap || payload.map)) {
        this.deserialize(payload.tacticalMap || payload.map);
      }
    });
  }

  /**
   * Adds a tactical marker to the map.
   *
   * @param {string} type - Marker type from MAP_MARKER_TYPES.
   * @param {number} x - Horizontal coordinate [0-100].
   * @param {number} y - Vertical coordinate [0-100].
   * @param {string} label - Display title or description.
   * @param {object} [data={}] - Additional metadata.
   * @returns {object} The created marker record.
   */
  addMarker(type, x, y, label, data = {}) {
    const markerType = Object.values(MAP_MARKER_TYPES).includes(type)
      ? type
      : MAP_MARKER_TYPES.RECON_DISCOVERY;

    const defaultMinTier = MARKER_INTEL_TIERS[markerType] || 'LOW';
    const minIntelTier = data.minIntelTier || defaultMinTier;

    const id = data.id || `marker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();

    const marker = {
      id,
      type: markerType,
      x: typeof x === 'number' ? x : 50,
      y: typeof y === 'number' ? y : 50,
      label: label || 'Tactical Marker',
      minIntelTier: minIntelTier.toUpperCase(),
      data: { ...data },
      timestamp: this.formatTimestamp(now),
      isoTimestamp: now.toISOString()
    };

    this.markers.set(id, marker);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('MAP_MARKER_ADDED', { marker });
    }

    this._publishMapUpdated();

    return marker;
  }

  /**
   * Records squad movement position in the breadcrumb path history.
   *
   * @param {number} x - Map horizontal coordinate.
   * @param {number} y - Map vertical coordinate.
   * @param {string} sceneId - Active scene identifier.
   * @returns {object} The recorded breadcrumb.
   */
  recordPath(x, y, sceneId = 'unknown') {
    const now = new Date();
    const breadcrumb = {
      x: typeof x === 'number' ? x : 50,
      y: typeof y === 'number' ? y : 50,
      sceneId: String(sceneId),
      timestamp: this.formatTimestamp(now),
      isoTimestamp: now.toISOString()
    };

    this.currentPosition = { x: breadcrumb.x, y: breadcrumb.y, sceneId: breadcrumb.sceneId };
    this.pathHistory.push(breadcrumb);

    this._publishMapUpdated();

    return breadcrumb;
  }

  /**
   * Retrieves markers filtered by dynamic intelligence visibility.
   * - LOW Intel: casualty, extraction_zone
   * - MEDIUM Intel: mortar_impact, recon_discovery, ambush (plus LOW)
   * - HIGH Intel: enemy_location, minefield (all markers)
   *
   * @param {string} [intelTierOverride=null] - Optional override ('LOW', 'MEDIUM', 'HIGH').
   * @returns {object[]} Array of visible marker objects.
   */
  getMarkers(intelTierOverride = null) {
    const effectiveTier = (intelTierOverride || this._getCurrentIntelTier()).toUpperCase();
    const currentRank = INTEL_TIER_RANKS[effectiveTier] || INTEL_TIER_RANKS.LOW;

    const visibleMarkers = [];
    for (const marker of this.markers.values()) {
      const requiredRank = INTEL_TIER_RANKS[marker.minIntelTier] || INTEL_TIER_RANKS.LOW;
      if (currentRank >= requiredRank) {
        visibleMarkers.push({ ...marker });
      }
    }

    return visibleMarkers;
  }

  /**
   * Retrieves the complete squad breadcrumb path history.
   * @returns {Array<{x: number, y: number, sceneId: string, timestamp: string}>}
   */
  getPathHistory() {
    return [...this.pathHistory];
  }

  /**
   * Clears all placed tactical markers.
   */
  clearMarkers() {
    this.markers.clear();
    this._publishMapUpdated();
  }

  /**
   * Helper to retrieve active intelligence tier from attached IntelSystem or Ledger.
   * @private
   * @returns {string}
   */
  _getCurrentIntelTier() {
    if (this.intelSystem && typeof this.intelSystem.getIntelTier === 'function') {
      return this.intelSystem.getIntelTier();
    }
    if (this.ledger && typeof this.ledger.getStat === 'function') {
      const intelScore = this.ledger.getStat('intel') || 0;
      if (intelScore >= 60) return 'HIGH';
      if (intelScore >= 25) return 'MEDIUM';
      return 'LOW';
    }
    return 'LOW';
  }

  /**
   * Broadcasts MAP_UPDATED event over the MessageBus.
   * @private
   */
  _publishMapUpdated() {
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('MAP_UPDATED', {
        markers: this.getMarkers(),
        allMarkersCount: this.markers.size,
        currentPosition: { ...this.currentPosition },
        pathHistory: this.getPathHistory(),
        intelTier: this._getCurrentIntelTier()
      });
    }
  }

  /**
   * Serializes tactical map manager state for game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      markers: Array.from(this.markers.values()),
      pathHistory: [...this.pathHistory],
      currentPosition: { ...this.currentPosition },
      timeZone: this.timeZone
    };
  }

  /**
   * Restores tactical map manager state from serialized data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    this.markers.clear();
    if (Array.isArray(data.markers)) {
      for (const m of data.markers) {
        if (m && m.id) {
          this.markers.set(m.id, { ...m });
        }
      }
    }

    this.pathHistory = Array.isArray(data.pathHistory) ? [...data.pathHistory] : [];
    if (data.currentPosition) {
      this.currentPosition = { ...data.currentPosition };
    }
    if (data.timeZone) {
      this.timeZone = data.timeZone;
    }

    this._publishMapUpdated();
  }
}
