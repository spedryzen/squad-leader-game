// Squad Leader: Vietnam - Wounded Soldier Decision System
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: WoundedSoldierManager.js
Purpose: Governs agonizing wartime decisions when soldiers are wounded in action (WIA) rather than immediately killed.
Responsibilities:
- Track combat casualties that sustain debilitating ballistic or blast trauma instead of immediate KIA
- Maintain active status of wounded soldiers, stabilization state, and bleedout countdown timers
- Manage four high-stakes command decisions:
  * Carry Soldier: Prevents bleedout; incurs -25% mobility penalty and -1 firepower penalty (carrier cannot fire)
  * Call Medevac: Evacuates casualty to field hospital; spikes Heat (+25) and requires LZ clearance
  * Hold Position: Combat medic stabilizes wounds in place; squad pinned down under flanking/mortar risk
  * Leave Behind: Squad retains max mobility; inflicts catastrophic morale shock (-35), triggers Survivor's Guilt, records permanent journal entry, and drops trust to 0
- Track active carrier assignments and compute squad-level mobility and firepower penalties
- Advance bleedout timers on scene progression for unstabilized, uncarried casualties
- Publish SOLDIER_WOUNDED, WOUNDED_DECISION_MADE, SOLDIER_EVACUATED, and SOLDIER_ABANDONED events
- Subscribe to CASUALTY_TAKEN, CHOICE_MADE, SCENE_RENDERED, and GAME_LOADED
- Provide full serialization and deserialization for game persistence
Dependencies: MessageBus.js, optional SquadManager.js, optional Ledger.js, optional PsychologicalConditionManager.js, optional RelationshipManager.js, optional Journal.js
Published Events:
- SOLDIER_WOUNDED: Dispatched when a soldier is wounded and enters the WIA registry
- WOUNDED_DECISION_MADE: Dispatched when commander chooses carry, medevac, hold/stabilize, or leave behind
- SOLDIER_EVACUATED: Dispatched when a wounded soldier is evacuated via helicopter Dustoff
- SOLDIER_ABANDONED: Dispatched when a wounded soldier is left behind on the battlefield
- SOLDIER_BLED_OUT: Dispatched when an untended casualty succumbs to untreated hemorrhage
Subscribed Events:
- CASUALTY_TAKEN: Intercepts non-fatal WIA casualties to register them
- CHOICE_MADE: Detects embedded tactical decisions regarding wounded personnel
- SCENE_RENDERED: Decrements bleedout timers for unstabilized, uncarried casualties
- GAME_LOADED: Restores wounded soldiers and carrier assignments from save data
Future Expansion Notes: Tourniquet and plasma infusion mechanics, litter bearer stretcher teams, and hospital ship recovery timelines.
--------------------------------------------------
*/

/**
 * Bleedout turns based on wound severity if casualty is neither carried nor stabilized.
 */
export const WOUND_SEVERITY_BLEEDOUT = {
  light: 5,
  moderate: 3,
  severe: 2,
  critical: 1
};

/**
 * WoundedSoldierManager oversees battlefield triage, carrier assignments, and life-or-death command decisions.
 */
export class WoundedSoldierManager {
  /**
   * @param {import('../core/MessageBus.js').MessageBus} [messageBus] - Central message bus.
   * @param {object} [systems={}] - System references.
   * @param {import('../entities/SquadManager.js').SquadManager} [systems.squadManager] - Squad manager.
   * @param {import('../state/Ledger.js').Ledger} [systems.ledger] - Resource ledger.
   * @param {import('./PsychologicalConditionManager.js').PsychologicalConditionManager} [systems.conditionManager] - Conditions.
   * @param {import('./RelationshipManager.js').RelationshipManager} [systems.relationshipManager] - Relationships.
   * @param {import('./Journal.js').Journal} [systems.journal] - Campaign journal.
   */
  constructor(messageBus, systems = {}) {
    this.messageBus = messageBus || null;
    this.squadManager = systems.squadManager || null;
    this.ledger = systems.ledger || null;
    this.conditionManager = systems.conditionManager || systems.psychologicalConditionManager || null;
    this.relationshipManager = systems.relationshipManager || null;
    this.journal = systems.journal || null;

    /** @type {Map<string, object>} soldierId -> woundedRecord */
    this.woundedSoldiers = new Map();

    /** @type {Map<string, string>} carrierId -> woundedId */
    this.carrierToWounded = new Map();

    this._setupSubscriptions();
  }

  /**
   * Attach or update system dependencies.
   * @param {object} systems
   */
  setSystems(systems = {}) {
    if (systems.squadManager) this.squadManager = systems.squadManager;
    if (systems.ledger) this.ledger = systems.ledger;
    if (systems.conditionManager || systems.psychologicalConditionManager) {
      this.conditionManager = systems.conditionManager || systems.psychologicalConditionManager;
    }
    if (systems.relationshipManager) this.relationshipManager = systems.relationshipManager;
    if (systems.journal) this.journal = systems.journal;
  }

  /**
   * Helper to resolve bleedout turns for wound severity.
   * @param {string} severity
   * @returns {number}
   * @private
   */
  _getBleedoutForSeverity(severity) {
    const key = String(severity).toLowerCase();
    return WOUND_SEVERITY_BLEEDOUT[key] ?? WOUND_SEVERITY_BLEEDOUT.moderate;
  }

  /**
   * Set up event subscriptions.
   * @private
   */
  _setupSubscriptions() {
    if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') return;

    // 1. CASUALTY_TAKEN: Register non-fatal casualties as wounded
    this.messageBus.subscribe('CASUALTY_TAKEN', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const isWounded = payload.status === 'wounded' || payload.isWounded === true;
      if (isWounded) {
        const soldierId = payload.soldierId || payload.id || (typeof payload.soldier === 'string' ? payload.soldier : payload.soldier?.id);
        if (soldierId && !this.woundedSoldiers.has(String(soldierId).toLowerCase())) {
          this.woundSoldier(soldierId, payload.severity || 'moderate', payload);
        }
      }
    });

    // 2. CHOICE_MADE: Process embedded triage decisions
    this.messageBus.subscribe('CHOICE_MADE', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.woundedDecision) {
        const dec = payload.woundedDecision;
        switch (dec.action) {
          case 'carry':
            if (dec.woundedId && dec.carrierId) {
              this.assignCarrier(dec.woundedId, dec.carrierId);
            }
            break;
          case 'medevac':
            if (dec.woundedId) {
              this.callMedevac(dec.woundedId, dec.lzStatus || 'cleared');
            }
            break;
          case 'hold':
          case 'stabilize':
            if (dec.woundedId) {
              this.stabilizeSoldier(dec.woundedId, dec.medicId || 'doc');
            }
            break;
          case 'leave_behind':
          case 'abandon':
            if (dec.woundedId) {
              this.abandonSoldier(dec.woundedId, dec.reason || payload.text);
            }
            break;
          default:
            break;
        }
      }
    });

    // 3. SCENE_RENDERED: Advance bleedout timers for untended casualties
    this.messageBus.subscribe('SCENE_RENDERED', () => {
      this._advanceBleedoutTimers();
    });

    // 4. GAME_LOADED: Restore wounded state
    this.messageBus.subscribe('GAME_LOADED', (payload) => {
      if (payload && (payload.wounded || payload.woundedSoldiers)) {
        this.deserialize(payload.wounded || payload.woundedSoldiers);
      }
    });
  }

  /**
   * Registers a soldier as wounded in action (WIA).
   *
   * @param {string|number} soldierId - Wounded soldier identifier.
   * @param {string} [severity='moderate'] - 'light', 'moderate', 'severe', or 'critical'.
   * @param {object} [details={}] - Additional metadata (wound description, cause, etc.).
   * @returns {object} Wounded soldier record.
   */
  woundSoldier(soldierId, severity = 'moderate', details = {}) {
    if (!soldierId) return null;
    const sId = String(soldierId).toLowerCase();

    const soldier = this.squadManager?.getSoldierById(sId);
    if (soldier) {
      soldier.status = 'wounded';
      soldier.isAlive = true;
      if (details.wound) {
        soldier.addWound(details.wound);
      }
    }

    const bleedoutTurns = typeof details.bleedoutTimer === 'number'
      ? details.bleedoutTimer
      : this._getBleedoutForSeverity(severity);

    const record = {
      soldierId: sId,
      soldierName: soldier?.name || details.name || sId,
      severity: String(severity).toLowerCase(),
      bleedoutTimer: bleedoutTurns,
      initialBleedout: bleedoutTurns,
      isStabilized: false,
      stabilizedBy: null,
      carrierId: null,
      status: 'wounded',
      details: { ...details },
      woundedAt: new Date().toISOString()
    };

    this.woundedSoldiers.set(sId, record);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SOLDIER_WOUNDED', {
        soldierId: sId,
        soldierName: record.soldierName,
        severity: record.severity,
        bleedoutTimer: record.bleedoutTimer,
        details: record.details
      });
    }

    return record;
  }

  /**
   * Assigns an able-bodied squad member to carry a wounded soldier.
   * Saves soldier from bleedout, but inflicts mobility (-25%) and firepower penalties.
   *
   * @param {string|number} woundedId - The casualty to be carried.
   * @param {string|number} carrierId - The healthy soldier carrying them.
   * @returns {boolean} True if assignment was successful.
   */
  assignCarrier(woundedId, carrierId) {
    if (!woundedId || !carrierId) return false;
    const wId = String(woundedId).toLowerCase();
    const cId = String(carrierId).toLowerCase();

    if (wId === cId) return false;

    const woundedRecord = this.woundedSoldiers.get(wId);
    if (!woundedRecord) return false;

    // Carrier must be alive, not wounded, and not already carrying someone
    const carrierSoldier = this.squadManager?.getSoldierById(cId);
    if (carrierSoldier && (!carrierSoldier.isAlive || carrierSoldier.status === 'wounded')) {
      return false;
    }

    if (this.woundedSoldiers.has(cId)) {
      return false; // Wounded soldiers cannot carry others
    }

    if (this.carrierToWounded.has(cId) && this.carrierToWounded.get(cId) !== wId) {
      return false; // Already carrying someone else
    }

    // Release any previous carrier assigned to this casualty
    if (woundedRecord.carrierId && woundedRecord.carrierId !== cId) {
      this.carrierToWounded.delete(woundedRecord.carrierId);
    }

    woundedRecord.carrierId = cId;
    this.carrierToWounded.set(cId, wId);

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('WOUNDED_DECISION_MADE', {
        decision: 'carry',
        woundedId: wId,
        woundedName: woundedRecord.soldierName,
        carrierId: cId,
        carrierName: carrierSoldier?.name || cId,
        mobilityModifier: this.getMobilityModifier(),
        firepowerModifier: this.getFirepowerModifier()
      });
    }

    return true;
  }

  /**
   * Releases a carrier from carrying a wounded soldier.
   *
   * @param {string|number} woundedId
   * @returns {boolean} True if released.
   */
  releaseCarrier(woundedId) {
    if (!woundedId) return false;
    const wId = String(woundedId).toLowerCase();
    const record = this.woundedSoldiers.get(wId);
    if (!record || !record.carrierId) return false;

    const cId = record.carrierId;
    record.carrierId = null;
    this.carrierToWounded.delete(cId);

    return true;
  }

  /**
   * Calls an emergency Dustoff medevac helicopter.
   * Evacuates the casualty to safety, but spikes Heat (+25) and requires LZ security.
   *
   * @param {string|number} woundedId
   * @param {string} [lzStatus='cleared'] - 'cleared', 'hot', 'contested'.
   * @returns {object|null}
   */
  callMedevac(woundedId, lzStatus = 'cleared') {
    if (!woundedId) return null;
    const wId = String(woundedId).toLowerCase();
    const record = this.woundedSoldiers.get(wId);
    if (!record) return null;

    // Release carrier if assigned
    this.releaseCarrier(wId);

    // Remove from wounded tracking
    this.woundedSoldiers.delete(wId);

    // Update soldier domain entity status in squad manager
    const soldier = this.squadManager?.getSoldierById(wId);
    if (soldier) {
      soldier.status = 'evacuated';
      soldier.isAlive = true;
    }

    // Heat escalation (+25) due to noisy helicopter rotor blades
    const heatSpike = 25;
    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('STAT_CHANGED', {
        stat: 'heat',
        delta: heatSpike,
        reason: `Dustoff Medevac for ${record.soldierName}`
      });
    } else if (this.ledger && typeof this.ledger.modifyStat === 'function') {
      this.ledger.modifyStat('heat', heatSpike);
    }

    // Log to journal
    if (this.journal && typeof this.journal.addEntry === 'function') {
      this.journal.addEntry({
        title: `Medevac Evacuation: ${record.soldierName}`,
        category: 'COMMAND',
        content: `UH-1 Dustoff successfully evacuated ${record.soldierName} from the field under ${lzStatus} LZ conditions. LZ Heat increased by ${heatSpike}.`,
        tags: ['MEDEVAC', 'DUSTOFF', record.soldierName]
      });
    }

    const result = {
      decision: 'medevac',
      woundedId: wId,
      soldierId: wId,
      soldierName: record.soldierName,
      lzStatus,
      heatSpike
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SOLDIER_EVACUATED', result);
      this.messageBus.publish('WOUNDED_DECISION_MADE', result);
    }

    return result;
  }

  /**
   * Leaves a wounded soldier behind on the battlefield.
   * Squad maintains maximum movement speed (+0 penalty), but suffers catastrophic consequences:
   * -35 morale to all squad members, Survivor's Guilt, permanent Journal entry, trust drops to 0.
   *
   * @param {string|number} woundedId
   * @param {string} [reason='Tactical Retreat']
   * @returns {object|null}
   */
  abandonSoldier(woundedId, reason = 'Tactical Retreat') {
    if (!woundedId) return null;
    const wId = String(woundedId).toLowerCase();
    const record = this.woundedSoldiers.get(wId);
    if (!record) return null;

    // Release carrier if assigned
    this.releaseCarrier(wId);

    // Remove from wounded tracking
    this.woundedSoldiers.delete(wId);

    // Update soldier entity: marked dead / abandoned
    const soldier = this.squadManager?.getSoldierById(wId);
    if (soldier) {
      soldier.isAlive = false;
      soldier.status = 'abandoned';
    }

    // 1. Catastrophic morale penalty (-35 to all squad members)
    const aliveSoldiers = this.squadManager?.getAliveSoldiers() || [];
    for (const survivor of aliveSoldiers) {
      if (typeof survivor.adjustMorale === 'function') {
        survivor.adjustMorale(-35);
      }
    }

    // 2. Triggers Survivor's Guilt in ConditionManager
    if (this.conditionManager && typeof this.conditionManager.addCondition === 'function') {
      for (const survivor of aliveSoldiers) {
        if (survivor.id !== wId) {
          this.conditionManager.addCondition(
            survivor.id,
            "Survivor's Guilt",
            `Haunted by abandoning ${record.soldierName} to enemy capture during ${reason}.`
          );
        }
      }
    }

    // 3. Severe relationship damage (trust drops to 0)
    if (this.relationshipManager && typeof this.relationshipManager.setRelationship === 'function') {
      for (const survivor of aliveSoldiers) {
        if (survivor.id !== wId) {
          this.relationshipManager.setRelationship(survivor.id, wId, 'rivalry', 0);
        }
      }
    }

    // 4. Permanent Journal entry
    if (this.journal && typeof this.journal.addEntry === 'function') {
      this.journal.addEntry({
        title: `CRITICAL DISHONOR: Soldier Abandoned (${record.soldierName})`,
        category: 'CASUALTY',
        content: `Under agonizing tactical necessity, the squad abandoned wounded soldier ${record.soldierName} in the field. Reason: ${reason}. Squad morale collapsed (-35). Survivor's guilt grips the remaining survivors.`,
        tags: ['ABANDONED', 'CASUALTY', 'SURVIVORS_GUILT', record.soldierName]
      });
    }

    const result = {
      decision: 'leave_behind',
      woundedId: wId,
      soldierId: wId,
      soldierName: record.soldierName,
      reason,
      moralePenalty: -35
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('SOLDIER_ABANDONED', result);
      this.messageBus.publish('WOUNDED_DECISION_MADE', result);
    }

    return result;
  }

  /**
   * Field medic stabilizes wounded soldier in place.
   * Squad is held in position; pauses bleedout timer.
   *
   * @param {string|number} woundedId
   * @param {string|number} [medicId='baker'] - Medic who administered aid.
   * @returns {object|null}
   */
  stabilizeSoldier(woundedId, medicId = 'baker') {
    if (!woundedId) return null;
    const wId = String(woundedId).toLowerCase();
    const record = this.woundedSoldiers.get(wId);
    if (!record) return null;

    record.isStabilized = true;
    record.stabilizedBy = String(medicId).toLowerCase();

    const medic = this.squadManager?.getSoldierById(record.stabilizedBy);

    const result = {
      decision: 'hold',
      action: 'stabilize',
      woundedId: wId,
      soldierName: record.soldierName,
      medicId: record.stabilizedBy,
      medicName: medic?.name || record.stabilizedBy
    };

    if (this.messageBus && typeof this.messageBus.publish === 'function') {
      this.messageBus.publish('WOUNDED_DECISION_MADE', result);
    }

    return record;
  }

  /**
   * Retrieves list of all currently wounded soldiers.
   * @returns {object[]}
   */
  getWoundedSoldiers() {
    return Array.from(this.woundedSoldiers.values()).map((r) => ({ ...r }));
  }

  /**
   * Retrieves list of wounded soldiers who are currently being carried.
   * @returns {object[]}
   */
  getCarriedSoldiers() {
    return Array.from(this.woundedSoldiers.values())
      .filter((r) => Boolean(r.carrierId))
      .map((r) => ({ ...r }));
  }

  /**
   * Computes squad mobility penalty (-25% per carried soldier).
   * @returns {number} Percentage mobility modifier.
   */
  getMobilityModifier() {
    const carriedCount = this.getCarriedSoldiers().length;
    return carriedCount === 0 ? 0 : -25 * carriedCount;
  }

  /**
   * Computes firepower penalty (-1 soldier firing per active carrier).
   * @returns {number} Firepower modifier (number of rifles lost).
   */
  getFirepowerModifier() {
    const carriedCount = this.getCarriedSoldiers().length;
    return carriedCount === 0 ? 0 : -1 * carriedCount;
  }

  /**
   * Advances bleedout timers for untended, unstabilized, uncarried casualties.
   * @private
   */
  _advanceBleedoutTimers() {
    for (const [wId, record] of this.woundedSoldiers.entries()) {
      // Carried soldiers and stabilized soldiers do not bleed out
      if (record.isStabilized || record.carrierId) {
        continue;
      }

      record.bleedoutTimer -= 1;

      if (record.bleedoutTimer <= 0) {
        // Soldier succumbs to wounds and bleeds out
        this.woundedSoldiers.delete(wId);
        const soldier = this.squadManager?.getSoldierById(wId);
        if (soldier) {
          soldier.isAlive = false;
          soldier.status = 'kia';
        }

        if (this.messageBus && typeof this.messageBus.publish === 'function') {
          this.messageBus.publish('SOLDIER_BLED_OUT', {
            soldierId: wId,
            soldierName: record.soldierName,
            cause: 'Untreated catastrophic hemorrhage'
          });

          this.messageBus.publish('CASUALTY_TAKEN', {
            soldierId: wId,
            name: record.soldierName,
            cause: 'Hemorrhagic shock (Bled out)',
            status: 'kia'
          });
        }
      }
    }
  }

  /**
   * Serializes wounded soldier manager state for game persistence.
   * @returns {object}
   */
  serialize() {
    return {
      woundedSoldiers: Array.from(this.woundedSoldiers.values()),
      carrierAssignments: Object.fromEntries(this.carrierToWounded)
    };
  }

  /**
   * Restores wounded soldier manager state from serialized data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return;

    this.woundedSoldiers.clear();
    this.carrierToWounded.clear();

    if (Array.isArray(data.woundedSoldiers)) {
      for (const r of data.woundedSoldiers) {
        if (r && r.soldierId) {
          this.woundedSoldiers.set(r.soldierId, { ...r });
        }
      }
    }

    if (data.carrierAssignments && typeof data.carrierAssignments === 'object') {
      for (const [cId, wId] of Object.entries(data.carrierAssignments)) {
        this.carrierToWounded.set(cId, wId);
      }
    }
  }
}
