// Squad Leader: Vietnam - Heroic Action & Medal Citation System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: HeroicActionManager.js
Purpose: Identifies critical battlefield crises and generates emergent heroic feats that form the emotional core of war stories, awarding official military decorations and permanent citations.
Responsibilities:
- Recognize and trigger 6 emergent heroic acts:
  * Last Stand: Outnumbered soldier holds off enemy wave to allow squad retreat.
  * Combat Rescue: Soldier dashes through hostile crossfire to drag a wounded comrade to safety.
  * Medic Save: Doc Baker stabilizes a critically wounded soldier under active mortar fire.
  * Grenade Sacrifice: Soldier dives or kicks away an incoming grenade to protect squadmates.
  * Scout Warning: Duke or Jenkins detects hidden spider hole or ambush just before it springs.
  * Defensive Heroics: Point man or gunner single-handedly suppresses an assault.
- Maintain military medal decoration registry:
  * Medal of Honor: Highest valor for self-sacrifice and Last Stand actions.
  * Distinguished Service Cross: Extraordinary heroism in combat rescue and wave defense.
  * Silver Star: Gallantry in action for medic saves and high-risk suppressing fire.
  * Bronze Star with 'V': Combat heroism for scout alerts and tactical valor.
  * Purple Heart: Awarded automatically to soldiers wounded or killed in action.
- Generate formal permanent citation text recording soldier name, action, location, and PST military timestamp per Directive 13.
- Publish valorous events: HEROIC_ACTION, MEDAL_AWARDED.
- Subscribe to crisis triggers: CASUALTY_TAKEN, AMBUSH_TRIGGERED, CHOICE_MADE, GAME_LOADED.
- Support comprehensive state serialization and deserialization for save game continuity.
Dependencies: MessageBus.js, optional SquadManager.js
Published Events:
- HEROIC_ACTION: Dispatched when an extraordinary act of valor is performed in combat.
- MEDAL_AWARDED: Dispatched when an official medal decoration and citation are conferred.
Subscribed Events:
- CASUALTY_TAKEN: Evaluates opportunities for Combat Rescue / Medic Save, and awards Purple Heart.
- AMBUSH_TRIGGERED: Evaluates opportunities for Scout Warning, Grenade Sacrifice, or Defensive Heroics.
- CHOICE_MADE: Detects player-ordered acts of sacrifice or extreme valor.
- GAME_LOADED: Restores heroic actions and medal decoration registries.
Future Expansion Notes: Post-war memorial roll of honor, presidential unit citations, and silver/gold star medal ribbons in UI.
--------------------------------------------------
*/

/**
 * Standard heroic actions recognized on the battlefield.
 */
export const HEROIC_ACTS = {
  LAST_STAND: 'Last Stand',
  COMBAT_RESCUE: 'Combat Rescue',
  MEDIC_SAVE: 'Medic Save',
  GRENADE_SACRIFICE: 'Grenade Sacrifice',
  SCOUT_WARNING: 'Scout Warning',
  DEFENSIVE_HEROICS: 'Defensive Heroics'
};

/**
 * Military medals and decorations.
 */
export const MEDAL_TYPES = {
  MEDAL_OF_HONOR: 'Medal of Honor',
  DISTINGUISHED_SERVICE_CROSS: 'Distinguished Service Cross',
  SILVER_STAR: 'Silver Star',
  BRONZE_STAR_V: "Bronze Star with 'V'",
  PURPLE_HEART: 'Purple Heart'
};

/**
 * Default medal associations for heroic acts.
 */
export const HEROIC_MEDAL_MAP = {
  [HEROIC_ACTS.LAST_STAND]: MEDAL_TYPES.MEDAL_OF_HONOR,
  [HEROIC_ACTS.GRENADE_SACRIFICE]: MEDAL_TYPES.MEDAL_OF_HONOR,
  [HEROIC_ACTS.COMBAT_RESCUE]: MEDAL_TYPES.DISTINGUISHED_SERVICE_CROSS,
  [HEROIC_ACTS.DEFENSIVE_HEROICS]: MEDAL_TYPES.SILVER_STAR,
  [HEROIC_ACTS.MEDIC_SAVE]: MEDAL_TYPES.SILVER_STAR,
  [HEROIC_ACTS.SCOUT_WARNING]: MEDAL_TYPES.BRONZE_STAR_V
};

/**
 * HeroicActionManager coordinates emergent battlefield valor, heroic actions, and military medal citations.
 */
export class HeroicActionManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [options={}] - Configuration options.
   * @param {import('../entities/SquadManager.js').SquadManager} [options.squadManager] - SquadManager reference.
   * @param {string} [options.timeZone='America/Los_Angeles'] - Active user timezone per Directive 13.
   */
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus || null;
    this.squadManager = options.squadManager || null;
    this.timeZone = options.timeZone || 'America/Los_Angeles';

    /** @type {Array<object>} */
    this.heroicActions = [];

    /** @type {Array<object>} */
    this.medals = [];

    this._setupSubscriptions();
  }

  /**
   * Format a date into military time string adhering to user active timezone (PST) per Directive 13.
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
   * Set user active timezone per Directive 13.
   * @param {string} timeZone
   */
  setTimeZone(timeZone) {
    if (!timeZone || typeof timeZone !== 'string') return;
    const tz = timeZone.toUpperCase() === 'PST' ? 'America/Los_Angeles' : (
      timeZone.toUpperCase() === 'EST' ? 'America/New_York' : timeZone
    );
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      this.timeZone = tz;
    } catch {
      console.warn(`HeroicActionManager: Invalid timezone "${timeZone}". Retaining "${this.timeZone}".`);
    }
  }

  /**
   * Register event listeners on the central MessageBus.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. Casualties taken: evaluate Purple Heart and potential rescue/medic saves
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      this._handleCasualtyTaken(payload);
    });

    // 2. Ambushes sprung: evaluate scout warnings or defensive heroics
    this.messageBus.subscribe('AMBUSH_TRIGGERED', (payload) => {
      this._handleAmbushTriggered(payload);
    });

    // 3. Choice made: detect explicit heroic or sacrificial orders
    this.messageBus.subscribe('CHOICE_MADE', (choice) => {
      this._handleChoiceMade(choice);
    });

    // 4. Save game restoration
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.heroics || payload.heroicActions)) {
        this.deserialize(payload.heroics || payload.heroicActions);
      }
    });
  }

  /**
   * Generates formal military citation narrative text.
   *
   * @param {string} soldierName - Soldier recipient name.
   * @param {string} role - Soldier role / military MOS.
   * @param {string} medalType - Medal name.
   * @param {string} actionType - Heroic act key.
   * @param {string} location - Tactical grid or battlefield location.
   * @param {string} timestamp - PST formatted timestamp.
   * @param {string} details - Specific narrative details of the action.
   * @returns {string} Permanent official citation text.
   */
  generateCitation(soldierName, role, medalType, actionType, location, timestamp, details) {
    if (medalType === MEDAL_TYPES.PURPLE_HEART) {
      return `THE UNITED STATES OF AMERICA TO ALL WHO SHALL SEE THESE PRESENTS, GREETING: THIS IS TO CERTIFY THAT THE PRESIDENT OF THE UNITED STATES OF AMERICA HAS AWARDED THE PURPLE HEART TO ${soldierName.toUpperCase()} (${role.toUpperCase()}) FOR WOUNDS RECEIVED IN ACTION ON ${timestamp.toUpperCase()} IN THE VICINITY OF ${location.toUpperCase()}.`;
    }

    const heading = medalType === MEDAL_TYPES.MEDAL_OF_HONOR
      ? 'FOR CONSPICUOUS GALLANTRY AND INTREPIDITY AT THE RISK OF LIFE ABOVE AND BEYOND THE CALL OF DUTY'
      : (medalType === MEDAL_TYPES.DISTINGUISHED_SERVICE_CROSS
        ? 'FOR EXTRAORDINARY HEROISM IN ACTION AGAINST AN ARMED HOSTILE FORCE'
        : 'FOR GALLANTRY IN CONNECTION WITH MILITARY OPERATIONS AGAINST A HOSTILE FORCE');

    return `CITATION: ${heading}. ${soldierName.toUpperCase()} (${role.toUpperCase()}), United States Army, distinguished themselves by conspicuous heroism on ${timestamp} at ${location}. During a critical combat engagement, they performed an act of supreme valor (${actionType}): "${details}". Their relentless courage, tactical fortitude, and disregard for personal safety reflect great credit upon themselves, their unit, and the Armed Forces of the United States.`;
  }

  /**
   * Triggers an emergent heroic action, records it in the chronicle, broadcasts HEROIC_ACTION,
   * generates an official citation, and awards the corresponding medal decoration.
   *
   * @param {string} soldierId - Soldier identifier.
   * @param {string} actionType - One of HEROIC_ACTS.
   * @param {object} [details={}] - Narrative metadata and overrides.
   * @returns {object} The heroic action record and awarded medal.
   */
  triggerHeroicAction(soldierId, actionType, details = {}) {
    const soldier = this._resolveSoldier(soldierId);
    const soldierName = this._formatSoldierName(soldier, soldierId, details.soldierName);
    const role = soldier?.role || details.role || 'Infantryman';
    const location = details.location || 'Hill 881 South';
    const timestamp = this.formatTimestamp();

    // Default action narrative descriptions
    const actionNarratives = {
      [HEROIC_ACTS.LAST_STAND]: `${soldierName} remained behind in an exposed perimeter crater, expending all ammunition to break an NVA human wave and cover the squad's fighting withdrawal.`,
      [HEROIC_ACTS.COMBAT_RESCUE]: `${soldierName} sprinted forty meters across an open, bullet-swept rice paddy under interlocking RPD machine gun fire to drag a fallen squadmate to safety.`,
      [HEROIC_ACTS.MEDIC_SAVE]: `${soldierName} repeatedly shielded a critically wounded soldier with their own body while applying pressure dressings and plasma under active mortar bombardment.`,
      [HEROIC_ACTS.GRENADE_SACRIFICE]: `${soldierName} with utter disregard for personal safety hurled an active Chinese stick grenade out of the squad bunker seconds before detonation.`,
      [HEROIC_ACTS.SCOUT_WARNING]: `${soldierName} alerted the point element to a camouflaged NVA ambush wire seconds before it sprang, preventing catastrophic squad casualties.`,
      [HEROIC_ACTS.DEFENSIVE_HEROICS]: `${soldierName} manned an exposed M60 position, delivering devastating traversing fire that repulsed a platoon-strength flank assault.`
    };

    const actionDescription = details.description || actionNarratives[actionType] || `${soldierName} performed an extraordinary act of valor.`;
    const medalType = details.medalType || HEROIC_MEDAL_MAP[actionType] || MEDAL_TYPES.SILVER_STAR;
    const citation = details.citation || this.generateCitation(soldierName, role, medalType, actionType, location, timestamp, actionDescription);

    const heroicActionId = `heroic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const record = {
      id: heroicActionId,
      soldierId,
      soldierName,
      role,
      actionType,
      description: actionDescription,
      location,
      timestamp,
      isoTimestamp: new Date().toISOString(),
      medalType,
      citation
    };

    this.heroicActions.push(record);

    // Broadcast HEROIC_ACTION over MessageBus
    // Payload includes both soldierName and heroName/action for full Journal.js interoperability
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('HEROIC_ACTION', {
        heroicActionId,
        soldierId,
        soldierName,
        heroId: soldierId,
        heroName: soldierName,
        role,
        actionType,
        action: actionDescription,
        description: actionDescription,
        location,
        timestamp,
        citation,
        medalType
      });
    }

    // Award corresponding medal
    const medal = this.awardMedal(soldierId, medalType, citation, {
      actionType,
      location,
      heroicActionId
    });

    return {
      heroicAction: record,
      medal
    };
  }

  /**
   * Awards an official military decoration to a soldier, records the permanent citation,
   * and broadcasts MEDAL_AWARDED.
   *
   * @param {string} soldierId - Recipient soldier ID.
   * @param {string} medalType - Decoration name from MEDAL_TYPES.
   * @param {string} citation - Official narrative citation text.
   * @param {object} [meta={}] - Optional metadata (actionType, location, heroicActionId).
   * @returns {object} The created medal award record.
   */
  awardMedal(soldierId, medalType, citation, meta = {}) {
    const soldier = this._resolveSoldier(soldierId);
    const soldierName = this._formatSoldierName(soldier, soldierId, meta.soldierName);
    const location = meta.location || 'Khe Sanh Sector';
    const timestamp = this.formatTimestamp();

    const medalId = `medal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const medalRecord = {
      id: medalId,
      soldierId,
      soldierName,
      medalType,
      citation,
      actionType: meta.actionType || 'Valor In Combat',
      location,
      timestamp,
      isoTimestamp: new Date().toISOString(),
      heroicActionId: meta.heroicActionId || null
    };

    this.medals.push(medalRecord);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('MEDAL_AWARDED', {
        medalId,
        soldierId,
        soldierName,
        medalType,
        citation,
        actionType: medalRecord.actionType,
        location,
        timestamp
      });
    }

    return medalRecord;
  }

  /**
   * Evaluates current crisis conditions to identify whether an opportunity for an
   * emergent heroic act is present.
   *
   * @param {object} context - Crisis parameters (type, casualtyId, ambushOutcome, outnumbered).
   * @returns {object|null} Eligible heroic opportunity descriptor, or null if no fit.
   */
  checkHeroicOpportunity(context = {}) {
    if (!context || typeof context !== 'object') return null;

    const crisisType = (context.type || '').toLowerCase();

    // 1. Casualty crisis -> Opportunity for Medic Save or Combat Rescue
    if (crisisType === 'casualty' || context.casualtyId) {
      // Check for Doc Baker
      const doc = this._findSoldierByRole('Medic') || this._resolveSoldier('doc_baker');
      if (doc && doc.isAlive && doc.id !== context.casualtyId) {
        return {
          eligible: true,
          suggestedHeroId: doc.id,
          actionType: HEROIC_ACTS.MEDIC_SAVE,
          reason: 'Combat Medic positioned to deliver life-saving trauma care under fire.'
        };
      }

      // Check for able-bodied squadmate for rescue
      const rescuer = this._findFirstAliveSoldierExcluding(context.casualtyId);
      if (rescuer) {
        return {
          eligible: true,
          suggestedHeroId: rescuer.id,
          actionType: HEROIC_ACTS.COMBAT_RESCUE,
          reason: 'Comrade ready to sprint into fire to retrieve wounded brother in arms.'
        };
      }
    }

    // 2. Ambush crisis -> Opportunity for Scout Warning, Grenade Sacrifice, or Defensive Heroics
    if (crisisType === 'ambush' || context.ambushOutcome) {
      // Scout warning if scout dog or scout present
      const scout = this._resolveSoldier('duke') || this._resolveSoldier('jenkins') || this._findSoldierByRole('Scout');
      if (scout && scout.isAlive) {
        return {
          eligible: true,
          suggestedHeroId: scout.id,
          actionType: HEROIC_ACTS.SCOUT_WARNING,
          reason: 'Scout senses tripwire or spider hole before the trap is sprung.'
        };
      }

      // Grenade sacrifice for booby trap/RPG
      if (context.ambushOutcome === 'Tripwire' || context.ambushOutcome === 'RPG Attack') {
        const pointMan = this._findFirstAliveSoldierExcluding();
        if (pointMan) {
          return {
            eligible: true,
            suggestedHeroId: pointMan.id,
            actionType: HEROIC_ACTS.GRENADE_SACRIFICE,
            reason: 'Imminent explosive hazard prompts desperate reflex to shield comrades.'
          };
        }
      }

      // Defensive heroics for sniper or assault
      const gunner = this._findSoldierByRole('Machine Gunner') || this._findFirstAliveSoldierExcluding();
      if (gunner && gunner.isAlive) {
        return {
          eligible: true,
          suggestedHeroId: gunner.id,
          actionType: HEROIC_ACTS.DEFENSIVE_HEROICS,
          reason: 'Gunner anchors the perimeter to lay down crushing suppressive fire.'
        };
      }
    }

    // 3. Outnumbered / Fighting Retreat crisis -> Opportunity for Last Stand
    if (crisisType === 'last_stand' || context.outnumbered || context.retreating) {
      const rearguard = this._findFirstAliveSoldierExcluding();
      if (rearguard) {
        return {
          eligible: true,
          suggestedHeroId: rearguard.id,
          actionType: HEROIC_ACTS.LAST_STAND,
          reason: 'Rearguard volunteer stays in the crater to buy time for the squad to break contact.'
        };
      }
    }

    return null;
  }

  /**
   * Retrieves all recorded heroic action logs.
   * @returns {Array<object>}
   */
  getHeroicActions() {
    return [...this.heroicActions];
  }

  /**
   * Retrieves all medals awarded to a specific soldier.
   * @param {string} soldierId
   * @returns {Array<object>}
   */
  getMedalsForSoldier(soldierId) {
    if (!soldierId) return [];
    return this.medals.filter((m) => m.soldierId === soldierId);
  }

  /**
   * Retrieves all medals awarded across the squad.
   * @returns {Array<object>}
   */
  getAllMedals() {
    return [...this.medals];
  }

  /**
   * Serializes heroic actions and medals for game saving.
   * @returns {object}
   */
  serialize() {
    return {
      timeZone: this.timeZone,
      heroicActions: JSON.parse(JSON.stringify(this.heroicActions)),
      medals: JSON.parse(JSON.stringify(this.medals))
    };
  }

  /**
   * Restores heroic actions and medals from serialized save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    if (data.timeZone) {
      this.setTimeZone(data.timeZone);
    }

    if (Array.isArray(data.heroicActions)) {
      this.heroicActions = JSON.parse(JSON.stringify(data.heroicActions));
    }

    if (Array.isArray(data.medals)) {
      this.medals = JSON.parse(JSON.stringify(data.medals));
    }
  }

  /**
   * Internal handler for CASUALTY_TAKEN events.
   * Confers Purple Heart and evaluates potential heroics.
   * @param {object} payload
   * @private
   */
  _handleCasualtyTaken(payload) {
    if (!payload) return;

    const casualtyId = payload.soldierId || payload.id || payload.soldier?.id;
    if (!casualtyId) return;

    const soldier = this._resolveSoldier(casualtyId);
    const soldierName = this._formatSoldierName(soldier, casualtyId, payload.name);
    const role = soldier?.role || payload.role || 'Infantry';
    const location = payload.location || 'Khe Sanh Perimeter';
    const timestamp = this.formatTimestamp();

    // Check if Purple Heart already awarded for this specific casualty occurrence
    const hasHeart = this.medals.some(
      (m) => m.soldierId === casualtyId && m.medalType === MEDAL_TYPES.PURPLE_HEART && m.timestamp === timestamp
    );

    if (!hasHeart) {
      const citation = this.generateCitation(
        soldierName,
        role,
        MEDAL_TYPES.PURPLE_HEART,
        'Wounds Received in Action',
        location,
        timestamp,
        payload.cause || 'Enemy gunfire and shrapnel'
      );

      this.awardMedal(casualtyId, MEDAL_TYPES.PURPLE_HEART, citation, {
        actionType: 'Combat Casualty',
        location
      });
    }
  }

  /**
   * Internal handler for AMBUSH_TRIGGERED events.
   * @param {object} payload
   * @private
   */
  _handleAmbushTriggered(payload) {
    if (!payload || typeof payload !== 'object') return;

    // Evaluate opportunity
    const opp = this.checkHeroicOpportunity({
      type: 'ambush',
      ambushOutcome: payload.outcomeKey
    });

    // If payload explicitly commands heroics
    if (payload.heroicAction && payload.heroicAction.soldierId) {
      this.triggerHeroicAction(
        payload.heroicAction.soldierId,
        payload.heroicAction.actionType || HEROIC_ACTS.DEFENSIVE_HEROICS,
        payload.heroicAction
      );
    }
  }

  /**
   * Internal handler for CHOICE_MADE events.
   * Detects self-sacrificing or heroic tactical choices.
   * @param {object} choice
   * @private
   */
  _handleChoiceMade(choice) {
    if (!choice || typeof choice !== 'object') return;

    if (choice.heroicAction) {
      this.triggerHeroicAction(
        choice.heroicAction.soldierId,
        choice.heroicAction.actionType,
        choice.heroicAction
      );
      return;
    }

    const text = `${choice.text || ''} ${choice.resolutionText || ''}`.toLowerCase();
    if (text.includes('last stand') && choice.soldierId) {
      this.triggerHeroicAction(choice.soldierId, HEROIC_ACTS.LAST_STAND, { description: choice.text });
    } else if (text.includes('drag') && text.includes('safety') && choice.soldierId) {
      this.triggerHeroicAction(choice.soldierId, HEROIC_ACTS.COMBAT_RESCUE, { description: choice.text });
    } else if (text.includes('throw') && text.includes('grenade') && choice.soldierId) {
      this.triggerHeroicAction(choice.soldierId, HEROIC_ACTS.GRENADE_SACRIFICE, { description: choice.text });
    }
  }

  /**
   * Resolves a soldier object from attached squad manager or returns minimal shim.
   * Supports prefixed IDs (e.g. 'doc_baker' -> 'baker', 'pfc_jenkins' -> 'jenkins').
   * @param {string} soldierId
   * @returns {object|null}
   * @private
   */
  _resolveSoldier(soldierId) {
    if (!soldierId) return null;
    if (this.squadManager && typeof this.squadManager.getSoldierById === 'function') {
      let soldier = this.squadManager.getSoldierById(soldierId);
      if (soldier) return soldier;
      const stripped = String(soldierId).replace(/^(pfc_|cpl_|doc_|ssg_|sp4_|lcpl_)/i, '');
      soldier = this.squadManager.getSoldierById(stripped);
      if (soldier) return soldier;
      const all = this.squadManager.getSoldiers ? this.squadManager.getSoldiers() : [];
      return all.find((s) => s.id === soldierId || s.id === stripped || s.name.toLowerCase().includes(stripped.toLowerCase())) || null;
    }
    return null;
  }

  /**
   * Formats a soldier display name cleanly adhering to military naming standards.
   * @param {object|null} soldier
   * @param {string} soldierId
   * @param {string} [fallback=null]
   * @returns {string}
   * @private
   */
  _formatSoldierName(soldier, soldierId, fallback = null) {
    if (fallback) return fallback;
    if (soldier?.name) {
      if (soldier.name === 'DOC Baker') return 'Doc Baker';
      return soldier.name;
    }
    if (typeof soldierId === 'string') {
      const parts = soldierId.split('_');
      return parts
        .map((p) => {
          const up = p.toUpperCase();
          if (['PFC', 'CPL', 'SSG', 'SP4', 'LCPL', 'SGT', 'LT', 'CPT'].includes(up)) return up;
          if (up === 'DOC') return 'Doc';
          return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        })
        .join(' ');
    }
    return soldierId || 'A Soldier';
  }

  /**
   * Finds a soldier matching a specific role.
   * @param {string} roleKeyword
   * @returns {object|null}
   * @private
   */
  _findSoldierByRole(roleKeyword) {
    if (this.squadManager && typeof this.squadManager.getAliveSoldiers === 'function') {
      const alive = this.squadManager.getAliveSoldiers();
      return alive.find((s) => s.role && s.role.toLowerCase().includes(roleKeyword.toLowerCase())) || null;
    }
    return null;
  }

  /**
   * Finds first alive soldier excluding specific ID.
   * @param {string} [excludeId=null]
   * @returns {object|null}
   * @private
   */
  _findFirstAliveSoldierExcluding(excludeId = null) {
    if (this.squadManager && typeof this.squadManager.getAliveSoldiers === 'function') {
      const alive = this.squadManager.getAliveSoldiers();
      return alive.find((s) => s.id !== excludeId) || null;
    }
    return null;
  }
}
