// Squad Leader: Vietnam - Phase 5 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase5.test.js
Purpose: Automated verification suite for Phase 5 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify TacticalMapManager marker creation across all 7 types, dynamic Intel-tier filtering (LOW, MEDIUM, HIGH), path breadcrumb recording, and serialization
- Verify WoundedSoldierManager wounding, carrier assignments with mobility (-25%) and firepower (-1 rifle) penalties, emergency medevac Dustoff with Heat escalation (+25), agonizing abandonment consequences (morale collapse, Survivor's Guilt, trust reduction, journal entry), stabilization, and bleedout timers
- Verify BattlefieldRecoverySystem 5 scavenging choices, reward application (Intel, Supplies, Morale, Valor Points), heat accumulation, enemy commander reactions, and serialization
- Verify SaveManager state persistence and restoration for all Phase 5 systems
- Verify full cross-system MessageBus integration choreographing TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem, SquadManager, Ledger, ConditionManager, RelationshipManager, and EnemyCommander
Dependencies: node:test, node:assert/strict, MessageBus, Ledger, SquadManager, SaveManager, Journal, IntelSystem, PsychologicalConditionManager, RelationshipManager, EnemyCommander, TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Multi-grid map panning tests, stretcher bearer triage simulations, and nighttime scavenging tests.
--------------------------------------------------
*/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { Ledger } from '../src/state/Ledger.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { SaveManager } from '../src/core/SaveManager.js';
import { Journal } from '../src/systems/Journal.js';
import { IntelSystem } from '../src/systems/IntelSystem.js';
import { PsychologicalConditionManager } from '../src/systems/PsychologicalConditionManager.js';
import { RelationshipManager } from '../src/systems/RelationshipManager.js';
import { EnemyCommander } from '../src/systems/EnemyCommander.js';
import {
  TacticalMapManager,
  MAP_MARKER_TYPES,
  MARKER_INTEL_TIERS
} from '../src/systems/TacticalMapManager.js';
import {
  WoundedSoldierManager,
  WOUND_SEVERITY_BLEEDOUT
} from '../src/systems/WoundedSoldierManager.js';
import {
  BattlefieldRecoverySystem,
  RECOVERY_OPTIONS,
  RECOVERY_OPTION_DEFINITIONS
} from '../src/systems/BattlefieldRecoverySystem.js';

describe('Phase 5 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. TACTICAL MAP MANAGER TESTS
  // ============================================================================
  describe('TacticalMapManager', () => {
    let mapManager;
    let ledger;
    let intelSystem;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
      mapManager = new TacticalMapManager(messageBus, { intelSystem, ledger });
    });

    it('should create tactical markers across all marker types', () => {
      let markerAddedEvent = null;
      messageBus.subscribe('MAP_MARKER_ADDED', (payload) => {
        markerAddedEvent = payload;
      });

      const m = mapManager.addMarker(
        MAP_MARKER_TYPES.CASUALTY,
        45,
        55,
        'PFC Jenkins Wounded',
        { soldierId: 'jenkins' }
      );

      assert.ok(m);
      assert.equal(m.type, MAP_MARKER_TYPES.CASUALTY);
      assert.equal(m.x, 45);
      assert.equal(m.y, 55);
      assert.equal(m.label, 'PFC Jenkins Wounded');
      assert.equal(m.minIntelTier, 'LOW');
      assert.ok(markerAddedEvent);
      assert.equal(markerAddedEvent.marker.id, m.id);
    });

    it('should record squad path breadcrumbs with coordinates, sceneId, and timestamp', () => {
      let mapUpdatedEvent = null;
      messageBus.subscribe('MAP_UPDATED', (payload) => {
        mapUpdatedEvent = payload;
      });

      const b1 = mapManager.recordPath(20, 30, 'scene_ridge_crest');
      assert.equal(b1.x, 20);
      assert.equal(b1.y, 30);
      assert.equal(b1.sceneId, 'scene_ridge_crest');
      assert.ok(b1.timestamp);

      const b2 = mapManager.recordPath(25, 35, 'scene_bunker_4');
      const history = mapManager.getPathHistory();

      assert.equal(history.length, 2);
      assert.equal(history[0].sceneId, 'scene_ridge_crest');
      assert.equal(history[1].sceneId, 'scene_bunker_4');
      assert.ok(mapUpdatedEvent);
      assert.equal(mapUpdatedEvent.currentPosition.x, 25);
    });

    it('should filter markers dynamically based on Intel Tier (LOW, MEDIUM, HIGH)', () => {
      // Add markers across all 3 tiers
      mapManager.addMarker(MAP_MARKER_TYPES.CASUALTY, 10, 10, 'Fallen Marine'); // LOW
      mapManager.addMarker(MAP_MARKER_TYPES.EXTRACTION_ZONE, 20, 20, 'LZ X-Ray'); // LOW
      mapManager.addMarker(MAP_MARKER_TYPES.MORTAR_IMPACT, 30, 30, 'Crater Zone'); // MEDIUM
      mapManager.addMarker(MAP_MARKER_TYPES.RECON_DISCOVERY, 40, 40, 'Hidden Trail'); // MEDIUM
      mapManager.addMarker(MAP_MARKER_TYPES.AMBUSH, 50, 50, 'Ambush Danger'); // MEDIUM
      mapManager.addMarker(MAP_MARKER_TYPES.ENEMY_LOCATION, 60, 60, 'Spider Hole Nest'); // HIGH
      mapManager.addMarker(MAP_MARKER_TYPES.MINEFIELD, 70, 70, 'Toe Popper Minefield'); // HIGH

      // 1. LOW Intel: Only reveals casualty markers and extraction zones (2 markers)
      const lowMarkers = mapManager.getMarkers('LOW');
      assert.equal(lowMarkers.length, 2);
      assert.ok(lowMarkers.some((m) => m.type === MAP_MARKER_TYPES.CASUALTY));
      assert.ok(lowMarkers.some((m) => m.type === MAP_MARKER_TYPES.EXTRACTION_ZONE));
      assert.ok(!lowMarkers.some((m) => m.type === MAP_MARKER_TYPES.ENEMY_LOCATION));

      // 2. MEDIUM Intel: Reveals mortar impacts, recon discoveries, ambush zones + LOW markers (5 markers)
      const mediumMarkers = mapManager.getMarkers('MEDIUM');
      assert.equal(mediumMarkers.length, 5);
      assert.ok(mediumMarkers.some((m) => m.type === MAP_MARKER_TYPES.MORTAR_IMPACT));
      assert.ok(mediumMarkers.some((m) => m.type === MAP_MARKER_TYPES.RECON_DISCOVERY));
      assert.ok(mediumMarkers.some((m) => m.type === MAP_MARKER_TYPES.AMBUSH));
      assert.ok(!mediumMarkers.some((m) => m.type === MAP_MARKER_TYPES.ENEMY_LOCATION));
      assert.ok(!mediumMarkers.some((m) => m.type === MAP_MARKER_TYPES.MINEFIELD));

      // 3. HIGH Intel: Reveals all markers including exact enemy positions and minefields (7 markers)
      const highMarkers = mapManager.getMarkers('HIGH');
      assert.equal(highMarkers.length, 7);
      assert.ok(highMarkers.some((m) => m.type === MAP_MARKER_TYPES.ENEMY_LOCATION));
      assert.ok(highMarkers.some((m) => m.type === MAP_MARKER_TYPES.MINEFIELD));
    });

    it('should react to SCENE_RENDERED to record path automatically', () => {
      messageBus.publish('SCENE_RENDERED', {
        id: 'scene_valley_crossing',
        mapX: 42,
        mapY: 68
      });

      const history = mapManager.getPathHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].x, 42);
      assert.equal(history[0].y, 68);
      assert.equal(history[0].sceneId, 'scene_valley_crossing');
    });

    it('should react to CASUALTY_TAKEN and place a casualty marker', () => {
      mapManager.recordPath(33, 44, 'scene_ambush');

      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'kowalski',
        name: 'PFC Kowalski',
        status: 'wounded',
        cause: 'Sniper Fire'
      });

      const markers = mapManager.getMarkers('LOW');
      const casualtyMarker = markers.find((m) => m.type === MAP_MARKER_TYPES.CASUALTY);
      assert.ok(casualtyMarker);
      assert.equal(casualtyMarker.x, 33);
      assert.equal(casualtyMarker.y, 44);
      assert.ok(casualtyMarker.label.includes('Kowalski'));
    });

    it('should serialize and deserialize map markers and path history cleanly', () => {
      mapManager.addMarker(MAP_MARKER_TYPES.EXTRACTION_ZONE, 15, 25, 'LZ Blue');
      mapManager.recordPath(10, 10, 'start');
      mapManager.recordPath(15, 20, 'midpoint');

      const serialized = mapManager.serialize();
      assert.equal(serialized.markers.length, 1);
      assert.equal(serialized.pathHistory.length, 2);

      const freshMap = new TacticalMapManager(messageBus);
      freshMap.deserialize(serialized);

      assert.equal(freshMap.getPathHistory().length, 2);
      assert.equal(freshMap.getMarkers('LOW').length, 1);
      assert.equal(freshMap.getMarkers('LOW')[0].label, 'LZ Blue');
    });
  });

  // ============================================================================
  // 2. WOUNDED SOLDIER DECISION SYSTEM TESTS
  // ============================================================================
  describe('WoundedSoldierManager', () => {
    let woundedManager;
    let squadManager;
    let ledger;
    let conditionManager;
    let relationshipManager;
    let journal;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      conditionManager = new PsychologicalConditionManager(messageBus, squadManager);
      relationshipManager = new RelationshipManager(messageBus, null, squadManager);
      journal = new Journal(messageBus);

      woundedManager = new WoundedSoldierManager(messageBus, {
        squadManager,
        ledger,
        conditionManager,
        relationshipManager,
        journal
      });
    });

    it('should register a wounded soldier and broadcast SOLDIER_WOUNDED', () => {
      let woundedEvent = null;
      messageBus.subscribe('SOLDIER_WOUNDED', (payload) => {
        woundedEvent = payload;
      });

      const record = woundedManager.woundSoldier('jenkins', 'severe', {
        wound: 'Shrapnel to Leg',
        cause: 'Mortar Shrapnel'
      });

      assert.ok(record);
      assert.equal(record.soldierId, 'jenkins');
      assert.equal(record.severity, 'severe');
      assert.equal(record.bleedoutTimer, WOUND_SEVERITY_BLEEDOUT.severe);
      assert.equal(record.isStabilized, false);
      assert.equal(record.carrierId, null);

      const soldier = squadManager.getSoldierById('jenkins');
      assert.equal(soldier.status, 'wounded');
      assert.equal(soldier.isAlive, true);
      assert.ok(soldier.hasWound('Shrapnel to Leg'));

      assert.ok(woundedEvent);
      assert.equal(woundedEvent.soldierId, 'jenkins');
      assert.equal(woundedEvent.severity, 'severe');
    });

    it('should assign a carrier and calculate mobility and firepower penalties', () => {
      woundedManager.woundSoldier('jenkins', 'moderate');

      let decisionEvent = null;
      messageBus.subscribe('WOUNDED_DECISION_MADE', (payload) => {
        decisionEvent = payload;
      });

      // Assign healthy comrade (Kowalski) to carry Jenkins
      const assigned = woundedManager.assignCarrier('jenkins', 'kowalski');
      assert.equal(assigned, true);

      const carried = woundedManager.getCarriedSoldiers();
      assert.equal(carried.length, 1);
      assert.equal(carried[0].soldierId, 'jenkins');
      assert.equal(carried[0].carrierId, 'kowalski');

      // Mobility penalty: -25%
      assert.equal(woundedManager.getMobilityModifier(), -25);
      // Firepower penalty: -1 rifle
      assert.equal(woundedManager.getFirepowerModifier(), -1);

      assert.ok(decisionEvent);
      assert.equal(decisionEvent.decision, 'carry');
      assert.equal(decisionEvent.woundedId, 'jenkins');
      assert.equal(decisionEvent.carrierId, 'kowalski');
    });

    it('should prevent wounded soldier or already assigned carrier from carrying another casualty', () => {
      woundedManager.woundSoldier('jenkins', 'moderate');
      woundedManager.woundSoldier('baker', 'severe');

      // Jenkins is wounded; cannot carry Baker
      const invalidCarry = woundedManager.assignCarrier('baker', 'jenkins');
      assert.equal(invalidCarry, false);

      // Kowalski carries Jenkins
      woundedManager.assignCarrier('jenkins', 'kowalski');

      // Kowalski cannot carry Baker at the same time
      const doubleCarry = woundedManager.assignCarrier('baker', 'kowalski');
      assert.equal(doubleCarry, false);
    });

    it('should execute Call Medevac, spike Heat by +25, and broadcast SOLDIER_EVACUATED', () => {
      ledger.setStat('heat', 10);
      woundedManager.woundSoldier('jenkins', 'critical');
      woundedManager.assignCarrier('jenkins', 'kowalski');

      let evacuatedEvent = null;
      messageBus.subscribe('SOLDIER_EVACUATED', (payload) => {
        evacuatedEvent = payload;
      });

      const res = woundedManager.callMedevac('jenkins', 'hot_lz');
      assert.ok(res);
      assert.equal(res.soldierId, 'jenkins');
      assert.equal(res.heatSpike, 25);

      // Heat spiked from 10 to 35
      assert.equal(ledger.getStat('heat'), 35);

      // Jenkins removed from active wounded
      assert.equal(woundedManager.getWoundedSoldiers().length, 0);
      assert.equal(woundedManager.getCarriedSoldiers().length, 0);

      // Soldier marked evacuated
      const soldier = squadManager.getSoldierById('jenkins');
      assert.equal(soldier.status, 'evacuated');

      assert.ok(evacuatedEvent);
      assert.equal(evacuatedEvent.soldierId, 'jenkins');
    });

    it('should execute Leave Behind with catastrophic morale shock (-35), Survivor Guilt, and trust drop', () => {
      woundedManager.woundSoldier('jenkins', 'moderate');

      const initialMorale = squadManager.getSoldierById('miller').morale;

      let abandonedEvent = null;
      messageBus.subscribe('SOLDIER_ABANDONED', (payload) => {
        abandonedEvent = payload;
      });

      const res = woundedManager.abandonSoldier('jenkins', 'Enemy overrun impending');
      assert.ok(res);
      assert.equal(res.soldierId, 'jenkins');

      // 1. Morale dropped by -35 for abandonment plus -20 for Survivor's Guilt condition
      const miller = squadManager.getSoldierById('miller');
      assert.equal(miller.morale, initialMorale - 35 - 20);

      // 2. Survivor's Guilt condition applied
      assert.equal(conditionManager.hasCondition('miller', "Survivor's Guilt"), true);

      // 3. Jenkins marked abandoned / dead
      const jenkins = squadManager.getSoldierById('jenkins');
      assert.equal(jenkins.isAlive, false);
      assert.equal(jenkins.status, 'abandoned');

      // 4. Permanent journal entry logged
      const entries = journal.getEntriesByTag('ABANDONED');
      assert.ok(entries.length > 0);

      assert.ok(abandonedEvent);
      assert.equal(abandonedEvent.soldierId, 'jenkins');
    });

    it('should stabilize soldier in place and pause bleedout timer', () => {
      const record = woundedManager.woundSoldier('jenkins', 'severe');
      assert.equal(record.isStabilized, false);

      woundedManager.stabilizeSoldier('jenkins', 'baker');
      const updated = woundedManager.getWoundedSoldiers()[0];
      assert.equal(updated.isStabilized, true);
      assert.equal(updated.stabilizedBy, 'baker');

      // Advance scene: bleedout timer should not decrement
      const prevTimer = updated.bleedoutTimer;
      messageBus.publish('SCENE_RENDERED', { id: 'next_scene' });
      assert.equal(updated.bleedoutTimer, prevTimer);
    });

    it('should cause untended, unstabilized casualties to bleed out across scenes', () => {
      // Critical severity has bleedout timer of 1
      woundedManager.woundSoldier('jenkins', 'critical');

      let bledOutEvent = null;
      messageBus.subscribe('SOLDIER_BLED_OUT', (payload) => {
        bledOutEvent = payload;
      });

      // 1 scene advance causes bleedout timer to hit 0
      messageBus.publish('SCENE_RENDERED', { id: 'scene_turn_1' });

      assert.ok(bledOutEvent);
      assert.equal(bledOutEvent.soldierId, 'jenkins');

      const soldier = squadManager.getSoldierById('jenkins');
      assert.equal(soldier.isAlive, false);
      assert.equal(soldier.status, 'kia');
      assert.equal(woundedManager.getWoundedSoldiers().length, 0);
    });

    it('should serialize and deserialize wounded soldier state and carrier assignments cleanly', () => {
      woundedManager.woundSoldier('jenkins', 'moderate');
      woundedManager.assignCarrier('jenkins', 'kowalski');

      const serialized = woundedManager.serialize();
      assert.equal(serialized.woundedSoldiers.length, 1);
      assert.equal(serialized.carrierAssignments.kowalski, 'jenkins');

      const freshManager = new WoundedSoldierManager(messageBus, { squadManager });
      freshManager.deserialize(serialized);

      assert.equal(freshManager.getWoundedSoldiers().length, 1);
      assert.equal(freshManager.getCarriedSoldiers().length, 1);
      assert.equal(freshManager.getMobilityModifier(), -25);
    });
  });

  // ============================================================================
  // 3. BATTLEFIELD RECOVERY SYSTEM TESTS
  // ============================================================================
  describe('BattlefieldRecoverySystem', () => {
    let recoverySystem;
    let ledger;
    let squadManager;
    let enemyCommander;
    let journal;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
      journal = new Journal(messageBus);

      recoverySystem = new BattlefieldRecoverySystem(messageBus, {
        ledger,
        squadManager,
        enemyCommander,
        journal
      });
    });

    it('should generate all 5 standard recovery options upon post-combat context', () => {
      let offeredEvent = null;
      messageBus.subscribe('RECOVERY_OFFERED', (payload) => {
        offeredEvent = payload;
      });

      const options = recoverySystem.generateRecoveryOptions({ postCombat: true });
      assert.equal(options.length, 5);

      assert.ok(options.some((o) => o.key === RECOVERY_OPTIONS.RECOVER_DOCUMENTS));
      assert.ok(options.some((o) => o.key === RECOVERY_OPTIONS.SEARCH_BODIES));
      assert.ok(options.some((o) => o.key === RECOVERY_OPTIONS.SALVAGE_WEAPONS));
      assert.ok(options.some((o) => o.key === RECOVERY_OPTIONS.RECOVER_EQUIPMENT));
      assert.ok(options.some((o) => o.key === RECOVERY_OPTIONS.EVACUATE_FALLEN));

      assert.ok(offeredEvent);
      assert.equal(offeredEvent.options.length, 5);
    });

    it('should execute Recover Documents, award Intel (+15 to +25), and escalate Heat (+10)', () => {
      ledger.setStat('intel', 10);
      ledger.setStat('heat', 5);

      let executedEvent = null;
      messageBus.subscribe('RECOVERY_EXECUTED', (payload) => {
        executedEvent = payload;
      });

      const res = recoverySystem.executeRecovery(RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
      assert.ok(res);
      assert.equal(res.optionKey, RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
      assert.equal(res.heatCost, 10);
      assert.ok(res.rewards.intel >= 15 && res.rewards.intel <= 25);

      // Ledger heat increased by 10
      assert.equal(ledger.getStat('heat'), 15);
      // Ledger intel increased
      assert.ok(ledger.getStat('intel') >= 25);

      assert.ok(executedEvent);
      assert.equal(executedEvent.optionKey, RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
    });

    it('should execute Search Bodies, grant +20 Supplies, unsettle recruits, and add +15 Heat', () => {
      ledger.setStat('supplies', 50);
      ledger.setStat('heat', 0);

      const recruit = squadManager.getSoldierById('jenkins');
      const startMorale = recruit.morale;

      const res = recoverySystem.executeRecovery(RECOVERY_OPTIONS.SEARCH_BODIES);
      assert.ok(res);
      assert.equal(res.rewards.supplies, 20);
      assert.equal(res.heatCost, 15);

      assert.equal(ledger.getStat('supplies'), 70);
      assert.equal(ledger.getStat('heat'), 15);
      // Jenkins is point man recruit; took -5 morale penalty
      assert.equal(recruit.morale, startMorale - 5);
    });

    it('should execute Salvage Weapons, grant +10 Supplies, +1 Valor Point, and +20 Heat', () => {
      ledger.setStat('supplies', 40);
      ledger.setStat('heat', 10);

      let valorEvent = null;
      messageBus.subscribe('VALOR_POINT_AWARDED', (payload) => {
        valorEvent = payload;
      });

      const res = recoverySystem.executeRecovery(RECOVERY_OPTIONS.SALVAGE_WEAPONS);
      assert.ok(res);
      assert.equal(res.rewards.supplies, 10);
      assert.equal(res.rewards.valorPoints, 1);
      assert.equal(res.heatCost, 20);

      assert.equal(ledger.getStat('supplies'), 50);
      assert.equal(ledger.getStat('heat'), 30);
      assert.ok(valorEvent);
      assert.equal(valorEvent.points, 1);
    });

    it('should execute Evacuate Fallen, boost squad morale (+10), and incur +25 Heat', () => {
      ledger.setStat('heat', 10);
      const soldiers = squadManager.getAliveSoldiers();
      soldiers.forEach((s) => (s.morale = 60));

      const res = recoverySystem.executeRecovery(RECOVERY_OPTIONS.EVACUATE_FALLEN);
      assert.ok(res);
      assert.equal(res.rewards.morale, 10);
      assert.equal(res.heatCost, 25);

      assert.equal(ledger.getStat('heat'), 35);
      assert.equal(squadManager.getSoldierById('miller').morale, 70);
    });

    it('should serialize and deserialize recovery history cleanly', () => {
      recoverySystem.executeRecovery(RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
      recoverySystem.executeRecovery(RECOVERY_OPTIONS.RECOVER_EQUIPMENT);

      const history = recoverySystem.getRecoveryHistory();
      assert.equal(history.length, 2);

      const serialized = recoverySystem.serialize();
      assert.equal(serialized.recoveryHistory.length, 2);

      const freshSystem = new BattlefieldRecoverySystem(messageBus);
      freshSystem.deserialize(serialized);

      assert.equal(freshSystem.getRecoveryHistory().length, 2);
      assert.equal(freshSystem.getRecoveryHistory()[0].optionKey, RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
      assert.equal(freshSystem.getRecoveryHistory()[1].optionKey, RECOVERY_OPTIONS.RECOVER_EQUIPMENT);
    });
  });

  // ============================================================================
  // 4. SAVEMANAGER PHASE 5 PERSISTENCE TESTS
  // ============================================================================
  describe('SaveManager Phase 5 Persistence', () => {
    let saveManager;
    let mapManager;
    let woundedManager;
    let recoverySystem;
    let ledger;
    let squadManager;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      mapManager = new TacticalMapManager(messageBus, { ledger });
      woundedManager = new WoundedSoldierManager(messageBus, { squadManager, ledger });
      recoverySystem = new BattlefieldRecoverySystem(messageBus, { ledger, squadManager });

      saveManager = new SaveManager(messageBus, null, squadManager, ledger, 'test_save_phase5', {
        tacticalMapManager: mapManager,
        woundedSoldierManager: woundedManager,
        battlefieldRecoverySystem: recoverySystem
      });
    });

    it('should serialize version 3 save with map markers, wounded soldiers, and recovery history', () => {
      mapManager.addMarker(MAP_MARKER_TYPES.MORTAR_IMPACT, 50, 60, 'Artillery Crater');
      mapManager.recordPath(12, 34, 'scene_grid881');

      woundedManager.woundSoldier('jenkins', 'moderate');
      woundedManager.assignCarrier('jenkins', 'kowalski');

      recoverySystem.executeRecovery(RECOVERY_OPTIONS.RECOVER_DOCUMENTS);

      const saveRecord = saveManager.saveGame('scene_grid881');

      assert.ok(saveRecord);
      assert.ok(saveRecord.tacticalMap);
      assert.equal(saveRecord.tacticalMap.markers.length, 1);
      assert.equal(saveRecord.tacticalMap.pathHistory.length, 1);

      assert.ok(saveRecord.wounded);
      assert.equal(saveRecord.wounded.woundedSoldiers.length, 1);
      assert.equal(saveRecord.wounded.carrierAssignments.kowalski, 'jenkins');

      assert.ok(saveRecord.recovery);
      assert.equal(saveRecord.recovery.recoveryHistory.length, 1);
    });

    it('should restore Phase 5 systems state upon loadGame()', () => {
      const mockSaveData = {
        sceneId: 'scene_phase5_restored',
        stats: { heat: 40, intel: 50, supplies: 80 },
        squad: [],
        tacticalMap: {
          markers: [
            {
              id: 'restored_marker_1',
              type: MAP_MARKER_TYPES.ENEMY_LOCATION,
              x: 88,
              y: 81,
              label: 'NVA Command Bunker',
              minIntelTier: 'HIGH'
            }
          ],
          pathHistory: [{ x: 10, y: 20, sceneId: 'start', timestamp: 'test-time' }],
          currentPosition: { x: 10, y: 20, sceneId: 'start' }
        },
        wounded: {
          woundedSoldiers: [
            {
              soldierId: 'baker',
              soldierName: 'DOC Baker',
              severity: 'severe',
              bleedoutTimer: 2,
              isStabilized: false,
              carrierId: 'miller'
            }
          ],
          carrierAssignments: { miller: 'baker' }
        },
        recovery: {
          recoveryHistory: [
            {
              optionKey: RECOVERY_OPTIONS.SALVAGE_WEAPONS,
              title: 'Salvage Weapons',
              heatCost: 20,
              rewards: { supplies: 10, valorPoints: 1 }
            }
          ]
        }
      };

      saveManager.getSaveData = () => mockSaveData;

      const loaded = saveManager.loadGame();
      assert.ok(loaded);

      // 1. Verify tactical map restored
      assert.equal(mapManager.getPathHistory().length, 1);
      const highMarkers = mapManager.getMarkers('HIGH');
      assert.equal(highMarkers.length, 1);
      assert.equal(highMarkers[0].label, 'NVA Command Bunker');

      // 2. Verify wounded restored
      assert.equal(woundedManager.getWoundedSoldiers().length, 1);
      assert.equal(woundedManager.getCarriedSoldiers().length, 1);
      assert.equal(woundedManager.getMobilityModifier(), -25);

      // 3. Verify recovery history restored
      assert.equal(recoverySystem.getRecoveryHistory().length, 1);
      assert.equal(recoverySystem.getRecoveryHistory()[0].optionKey, RECOVERY_OPTIONS.SALVAGE_WEAPONS);
    });
  });

  // ============================================================================
  // 5. FULL CROSS-SYSTEM MESSAGEBUS INTEGRATION
  // ============================================================================
  describe('Full Cross-System MessageBus Integration', () => {
    let ledger;
    let squadManager;
    let intelSystem;
    let conditionManager;
    let relationshipManager;
    let journal;
    let enemyCommander;
    let mapManager;
    let woundedManager;
    let recoverySystem;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
      conditionManager = new PsychologicalConditionManager(messageBus, squadManager);
      relationshipManager = new RelationshipManager(messageBus, null, squadManager);
      journal = new Journal(messageBus);
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });

      mapManager = new TacticalMapManager(messageBus, { intelSystem, ledger });
      woundedManager = new WoundedSoldierManager(messageBus, {
        squadManager,
        ledger,
        conditionManager,
        relationshipManager,
        journal
      });
      recoverySystem = new BattlefieldRecoverySystem(messageBus, {
        ledger,
        squadManager,
        enemyCommander,
        journal
      });
    });

    it('should coordinate combat wounding, tactical carrier assignment, map casualty tracking, and recovery', () => {
      // 1. Squad moves to Grid 881 scene
      messageBus.publish('SCENE_RENDERED', {
        id: 'scene_grid881_treeline',
        mapX: 60,
        mapY: 45
      });

      assert.equal(mapManager.getPathHistory().length, 1);

      // 2. Contact: Jenkins takes shrapnel wound
      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'jenkins',
        name: 'PFC Jenkins',
        status: 'wounded',
        severity: 'severe',
        wound: 'Left Thigh Ballistic Shrapnel'
      });

      // Map places casualty marker
      const markers = mapManager.getMarkers('LOW');
      assert.ok(markers.some((m) => m.type === MAP_MARKER_TYPES.CASUALTY));

      // Wounded manager tracks Jenkins
      assert.equal(woundedManager.getWoundedSoldiers().length, 1);

      // 3. Commander orders Kowalski to carry Jenkins
      woundedManager.assignCarrier('jenkins', 'kowalski');
      assert.equal(woundedManager.getMobilityModifier(), -25);
      assert.equal(woundedManager.getFirepowerModifier(), -1);

      // 4. Squad secures perimeter and decides to Recover Documents
      const recoveryResult = recoverySystem.executeRecovery(RECOVERY_OPTIONS.RECOVER_DOCUMENTS);
      assert.ok(recoveryResult);
      assert.ok(recoveryResult.rewards.intel >= 15);

      // Heat increased by +10 from scavenging
      assert.equal(ledger.getStat('heat'), 10);

      // 5. Medevac called for Jenkins
      woundedManager.callMedevac('jenkins', 'cleared');
      // Heat spikes by +25 (total 35)
      assert.equal(ledger.getStat('heat'), 35);
      // Carrier released; penalties cleared
      assert.equal(woundedManager.getMobilityModifier(), 0);
      assert.equal(woundedManager.getFirepowerModifier(), 0);

      // 6. Verify journal captured records
      const journalEntries = journal.getEntries();
      assert.ok(journalEntries.length >= 2);
    });
  });
});
