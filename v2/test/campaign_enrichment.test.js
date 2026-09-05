// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { SceneManager } from '../src/core/SceneManager.js';
import { Ledger } from '../src/state/Ledger.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { ReputationManager } from '../src/systems/ReputationManager.js';
import { TraitManager } from '../src/systems/TraitManager.js';
import { IntelSystem } from '../src/systems/IntelSystem.js';
import { WeatherSystem } from '../src/systems/WeatherSystem.js';
import { WoundedSoldierManager } from '../src/systems/WoundedSoldierManager.js';
import { BattlefieldRecoverySystem } from '../src/systems/BattlefieldRecoverySystem.js';
import { campaign3US } from '../src/data/campaign_3_us.js';
import { campaign4LZ } from '../src/data/campaign_4_lz.js';

describe('Option 3: Campaign Narrative & Encounter Enrichment', () => {
  let messageBus;
  let ledger;
  let squadManager;
  let reputationManager;
  let traitManager;
  let intelSystem;
  let weatherSystem;
  let woundedSoldierManager;
  let recoverySystem;
  let sceneManager;
  const combinedCampaign = { ...campaign3US, ...campaign4LZ };

  beforeEach(() => {
    messageBus = new MessageBus();
    ledger = new Ledger(messageBus);
    squadManager = new SquadManager(messageBus);
    reputationManager = new ReputationManager(messageBus);
    traitManager = new TraitManager(messageBus, squadManager);
    intelSystem = new IntelSystem(messageBus, ledger);
    weatherSystem = new WeatherSystem(messageBus);
    woundedSoldierManager = new WoundedSoldierManager(messageBus, {
      squadManager,
      ledger
    });
    recoverySystem = new BattlefieldRecoverySystem(messageBus, {
      ledger,
      squadManager
    });
    sceneManager = new SceneManager(messageBus, combinedCampaign, {
      reputationManager,
      squadManager,
      traitManager,
      intelSystem,
      weatherSystem,
      ledger
    });
  });

  describe('Expanded Choice Requirements Gating in SceneManager', () => {
    it('should gate choices requiring reputation doctrine unless primary or score >= 40', () => {
      const choice = {
        id: 'stealth_flank',
        text: 'Silent crawl through bamboo ditch',
        requirements: { reputation: 'Jungle Ghost' }
      };

      // 1. Initially, reputation scores are 0 and primary is Reliable -> locked
      let evalResult = sceneManager.evaluateChoiceRequirements(choice);
      assert.strictEqual(evalResult.available, false);
      assert.strictEqual(evalResult.reason, '[LOCKED: JUNGLE GHOST DOCTRINE REQUIRED]');
      assert.strictEqual(sceneManager.isChoiceAvailable(choice), false);
      assert.strictEqual(sceneManager.getChoiceLockReason(choice), '[LOCKED: JUNGLE GHOST DOCTRINE REQUIRED]');

      // 2. Grant score of 40 in Jungle Ghost -> available
      reputationManager.modifyReputation('Jungle Ghost', 40);
      evalResult = sceneManager.evaluateChoiceRequirements(choice);
      assert.strictEqual(evalResult.available, true);
      assert.strictEqual(evalResult.reason, null);

      // 3. Test Aggressive doctrine requirement
      const aggChoice = {
        id: 'artillery_strike',
        text: 'Call heavy barrage',
        requirements: { reputation: 'Aggressive' }
      };
      assert.strictEqual(sceneManager.isChoiceAvailable(aggChoice), false);
      reputationManager.modifyReputation('Aggressive', 50);
      assert.strictEqual(sceneManager.isChoiceAvailable(aggChoice), true);
    });

    it('should gate choices requiring living squad member with specific trait', () => {
      const choice = {
        id: 'calm_snipe',
        text: 'Steady aim under fire',
        requirements: { trait: 'Calm Under Fire' }
      };

      // 1. Initially no soldier has Calm Under Fire -> locked
      let evalResult = sceneManager.evaluateChoiceRequirements(choice);
      assert.strictEqual(evalResult.available, false);
      assert.strictEqual(evalResult.reason, '[LOCKED: CALM UNDER FIRE REQUIRED]');

      // 2. Discover trait on Miller (who is alive) -> available
      traitManager.discoverTrait('miller', 'Calm Under Fire', 'Battle hardened');
      evalResult = sceneManager.evaluateChoiceRequirements(choice);
      assert.strictEqual(evalResult.available, true);
      assert.strictEqual(evalResult.reason, null);

      // 3. If Miller is marked KIA -> locked again
      const miller = squadManager.getSoldierById('miller');
      miller.isAlive = false;
      evalResult = sceneManager.evaluateChoiceRequirements(choice);
      assert.strictEqual(evalResult.available, false);
      assert.strictEqual(evalResult.reason, '[LOCKED: CALM UNDER FIRE REQUIRED]');
    });

    it('should gate choices requiring minimum Intel Tier (LOW, MEDIUM, HIGH)', () => {
      const medChoice = {
        id: 'med_intel_probe',
        text: 'Infiltrate known patrol route',
        requirements: { intelTier: 'MEDIUM' }
      };
      const highChoice = {
        id: 'high_intel_assault',
        text: 'Assault mapped bunker network',
        requirements: { intelTier: 'HIGH' }
      };

      // 1. Baseline intel = 0 (Tier LOW) -> both locked
      assert.strictEqual(sceneManager.isChoiceAvailable(medChoice), false);
      assert.strictEqual(sceneManager.getChoiceLockReason(medChoice), '[LOCKED: MEDIUM INTEL REQUIRED]');
      assert.strictEqual(sceneManager.isChoiceAvailable(highChoice), false);
      assert.strictEqual(sceneManager.getChoiceLockReason(highChoice), '[LOCKED: HIGH INTEL REQUIRED]');

      // 2. Increase intel to 30 (Tier MEDIUM) -> medChoice passes, highChoice still locked
      ledger.modifyStat('intel', 30);
      assert.strictEqual(intelSystem.getIntelTier(), 'MEDIUM');
      assert.strictEqual(sceneManager.isChoiceAvailable(medChoice), true);
      assert.strictEqual(sceneManager.isChoiceAvailable(highChoice), false);

      // 3. Increase intel to 70 (Tier HIGH) -> both pass
      ledger.modifyStat('intel', 40);
      assert.strictEqual(intelSystem.getIntelTier(), 'HIGH');
      assert.strictEqual(sceneManager.isChoiceAvailable(medChoice), true);
      assert.strictEqual(sceneManager.isChoiceAvailable(highChoice), true);
    });

    it('should gate choices unavailable under certain weather conditions (notWeather)', () => {
      const airSupportChoice = {
        id: 'lz_call_napalm',
        text: 'Call in tactical Napalm air strike',
        requirements: { notWeather: ['Thunderstorm', 'Monsoon'] }
      };

      // 1. Weather is Clear -> available
      weatherSystem.setWeather('Clear');
      assert.strictEqual(sceneManager.isChoiceAvailable(airSupportChoice), true);

      // 2. Weather is Rain -> available
      weatherSystem.setWeather('Rain');
      assert.strictEqual(sceneManager.isChoiceAvailable(airSupportChoice), true);

      // 3. Weather changes to Monsoon -> locked with descriptive tag
      weatherSystem.setWeather('Monsoon');
      const evalResult = sceneManager.evaluateChoiceRequirements(airSupportChoice);
      assert.strictEqual(evalResult.available, false);
      assert.strictEqual(evalResult.reason, '[LOCKED: AIR SUPPORT GROUNDED IN MONSOON]');

      // 4. Weather changes to Thunderstorm -> locked
      weatherSystem.setWeather('Thunderstorm');
      assert.strictEqual(sceneManager.getChoiceLockReason(airSupportChoice), '[LOCKED: AIR SUPPORT GROUNDED IN THUNDERSTORM]');
    });
  });

  describe('Triage Decision Event Firing from Scene Choices', () => {
    it('should process SOLDIER_WOUNDED when sapper charge detonates in sapper_contact', () => {
      let woundedReceived = null;
      messageBus.subscribe('SOLDIER_WOUNDED', (payload) => {
        woundedReceived = payload;
      });

      sceneManager.loadScene('sapper_contact');
      const choice = sceneManager.findChoiceInCurrentScene('contact_fall_back');
      assert.ok(choice, 'contact_fall_back choice should exist');

      messageBus.publish('CHOICE_MADE', choice);

      assert.ok(woundedReceived, 'SOLDIER_WOUNDED event should be dispatched');
      assert.strictEqual(woundedReceived.soldierId, 'torres');
      assert.strictEqual(woundedReceived.severity, 'severe');

      // Verify WoundedSoldierManager registered the casualty
      const wRecord = woundedSoldierManager.getWoundedRecord('torres');
      assert.ok(wRecord, 'Torres should be registered in WoundedSoldierManager');
      assert.strictEqual(wRecord.status, 'wounded');
    });

    it('should process triage choice: Carry Torres to Bunker', () => {
      let decisionReceived = null;
      messageBus.subscribe('WOUNDED_DECISION_MADE', (payload) => {
        decisionReceived = payload;
      });

      sceneManager.loadScene('trench_defense');
      const carryChoice = sceneManager.findChoiceInCurrentScene('triage_carry_torres');
      assert.ok(carryChoice, 'Carry Torres choice should exist');

      messageBus.publish('CHOICE_MADE', carryChoice);

      assert.ok(decisionReceived);
      assert.strictEqual(decisionReceived.action, 'carry');
      assert.strictEqual(decisionReceived.woundedId, 'torres');
      assert.strictEqual(decisionReceived.carrierId, 'kowalski');
    });

    it('should process triage choice: Doc Baker Field Stabilize & Silver Star', () => {
      let heroicActionReceived = null;
      messageBus.subscribe('HEROIC_ACTION', (payload) => {
        heroicActionReceived = payload;
      });

      sceneManager.loadScene('trench_defense');
      const stabilizeChoice = sceneManager.findChoiceInCurrentScene('triage_stabilize_torres');
      assert.ok(stabilizeChoice);

      messageBus.publish('CHOICE_MADE', stabilizeChoice);

      assert.ok(heroicActionReceived);
      assert.strictEqual(heroicActionReceived.soldierId, 'baker');
      assert.strictEqual(heroicActionReceived.medal, 'Silver Star');
    });

    it('should process triage choice: Radio Dustoff Medevac (spikes Heat +25 & SOLDIER_EVACUATED)', () => {
      const initialHeat = ledger.getStat('heat') || 0;
      let evacuatedReceived = null;
      messageBus.subscribe('SOLDIER_EVACUATED', (payload) => {
        evacuatedReceived = payload;
      });

      sceneManager.loadScene('trench_defense');
      const medevacChoice = sceneManager.findChoiceInCurrentScene('triage_dustoff_torres');
      assert.ok(medevacChoice);

      messageBus.publish('CHOICE_MADE', medevacChoice);

      assert.ok(evacuatedReceived);
      assert.strictEqual(evacuatedReceived.soldierId, 'torres');
      assert.strictEqual(ledger.getStat('heat'), initialHeat + 25);
    });

    it('should process triage choice: Leave Wounded in Trench (SOLDIER_ABANDONED & Survivor Guilt)', () => {
      let abandonedReceived = null;
      let conditionReceived = null;
      messageBus.subscribe('SOLDIER_ABANDONED', (payload) => {
        abandonedReceived = payload;
      });
      messageBus.subscribe('CONDITION_GAINED', (payload) => {
        conditionReceived = payload;
      });

      sceneManager.loadScene('trench_defense');
      const abandonChoice = sceneManager.findChoiceInCurrentScene('triage_abandon_torres');
      assert.ok(abandonChoice);

      messageBus.publish('CHOICE_MADE', abandonChoice);

      assert.ok(abandonedReceived);
      assert.strictEqual(abandonedReceived.soldierId, 'torres');
      assert.ok(conditionReceived);
      assert.strictEqual(conditionReceived.condition, "Survivor's Guilt");
    });
  });

  describe('Post-Combat Battlefield Recovery Scavenging', () => {
    it('should offer and execute recovery choices in dawn_repulse and lz_clearing', () => {
      let offeredEvents = 0;
      let executedAction = null;
      messageBus.subscribe('RECOVERY_OFFERED', () => {
        offeredEvents++;
      });
      messageBus.subscribe('RECOVERY_EXECUTED', (payload) => {
        executedAction = payload.action || payload.optionKey;
      });

      // Load dawn_repulse
      sceneManager.loadScene('dawn_repulse');
      const docChoice = sceneManager.findChoiceInCurrentScene('dawn_recover_documents');
      assert.ok(docChoice);

      const initialIntel = ledger.getStat('intel');
      messageBus.publish('CHOICE_MADE', docChoice);

      assert.ok(offeredEvents > 0);
      assert.strictEqual(executedAction, 'recover_documents');
      assert.ok(ledger.getStat('intel') >= initialIntel + 15 && ledger.getStat('intel') <= initialIntel + 25);

      // Load lz_clearing
      sceneManager.loadScene('lz_clearing');
      const salvageChoice = sceneManager.findChoiceInCurrentScene('recovery_salvage_50cal');
      assert.ok(salvageChoice);

      const initialSupplies = ledger.getStat('supplies');
      messageBus.publish('CHOICE_MADE', salvageChoice);

      assert.strictEqual(executedAction, 'salvage_weapons');
      assert.strictEqual(ledger.getStat('supplies'), initialSupplies + 10);
    });
  });

  describe('Campaign Scenario Integration & Continuity', () => {
    it('should correctly initialize atmospheric conditions and radio communication in Campaign 3 scene start', () => {
      let radioReceived = null;
      messageBus.subscribe('RADIO_MESSAGE_RECEIVED', (payload) => {
        radioReceived = payload;
      });

      const scene = sceneManager.loadScene('start');
      assert.strictEqual(scene.weather, 'Fog');

      const choice = sceneManager.findChoiceInCurrentScene('start_send_duke');
      messageBus.publish('CHOICE_MADE', choice);

      assert.ok(radioReceived);
      assert.strictEqual(radioReceived.callsign, 'India Six');
      assert.strictEqual(radioReceived.channel, 'HQ');
    });

    it('should trigger Jungle Hunter discovery in mist_patrol_duke', () => {
      let traitDiscovered = null;
      messageBus.subscribe('TRAIT_DISCOVERED', (payload) => {
        traitDiscovered = payload;
      });

      sceneManager.loadScene('mist_patrol_duke');
      const scentChoice = sceneManager.findChoiceInCurrentScene('duke_track_scent');
      assert.ok(scentChoice);

      messageBus.publish('CHOICE_MADE', scentChoice);

      assert.ok(traitDiscovered);
      assert.strictEqual(traitDiscovered.trait, 'Jungle Hunter');
    });

    it('should transition to Heavy Rain in mortar_barrage and gate Calm Under Fire', () => {
      let weatherChanged = null;
      messageBus.subscribe('WEATHER_CHANGED', (payload) => {
        weatherChanged = payload;
      });

      sceneManager.loadScene('mortar_barrage');
      const steadyChoice = sceneManager.findChoiceInCurrentScene('mortar_calm_under_fire');
      assert.ok(steadyChoice);

      // Gated without Calm Under Fire
      assert.strictEqual(sceneManager.isChoiceAvailable(steadyChoice), false);

      // Discover trait on Kowalski
      traitManager.discoverTrait('kowalski', 'Calm Under Fire');
      assert.strictEqual(sceneManager.isChoiceAvailable(steadyChoice), true);

      messageBus.publish('CHOICE_MADE', steadyChoice);
      assert.ok(weatherChanged);
      assert.strictEqual(weatherChanged.type, 'Heavy Rain');
    });

    it('should execute Rear Guard Sacrifice in lz_arrival with EXTRACTION_HEROIC_SACRIFICE', () => {
      let sacrificeEvent = null;
      messageBus.subscribe('EXTRACTION_HEROIC_SACRIFICE', (payload) => {
        sacrificeEvent = payload;
      });

      sceneManager.loadScene('lz_arrival');
      const sacrificeChoice = sceneManager.findChoiceInCurrentScene('lz_rear_guard_sacrifice');
      assert.ok(sacrificeChoice);

      messageBus.publish('CHOICE_MADE', sacrificeChoice);

      assert.ok(sacrificeEvent);
      assert.strictEqual(sacrificeEvent.soldierId, 'jenkins');
    });
  });
});
