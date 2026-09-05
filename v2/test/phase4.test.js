// Squad Leader: Vietnam - Phase 4 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase4.test.js
Purpose: Automated verification suite for Phase 4 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify EnemyCommander AI metrics, player action recording, countermeasure adaptations, strategy shifts, and serialization
- Verify AmbushSystem 5-factor risk evaluation, multi-stage suspense sequences, outcome resolutions, and serialization
- Verify HeroicActionManager 6 heroic acts, medal awards, permanent military citations adhering to Directive 13 PST time, and serialization
- Verify SaveManager state persistence for enemy commander, ambush sequences, and heroic awards
- Verify full cross-system MessageBus integration choreographing EnemyCommander, AmbushSystem, HeroicActionManager, Journal, Ledger, and SquadManager
Dependencies: node:test, node:assert/strict, MessageBus, Ledger, SquadManager, SaveManager, Journal, IntelSystem, WeatherSystem, EnemyCommander, AmbushSystem, HeroicActionManager
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Multi-squad flank defense tests, sapper infiltration tests, and post-campaign valor review verification.
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
import { WeatherSystem } from '../src/systems/WeatherSystem.js';
import {
  EnemyCommander,
  ENEMY_STRATEGIES,
  ENEMY_COUNTERMEASURES
} from '../src/systems/EnemyCommander.js';
import {
  AmbushSystem,
  AMBUSH_OUTCOMES,
  AMBUSH_OUTCOME_DEFINITIONS
} from '../src/systems/AmbushSystem.js';
import {
  HeroicActionManager,
  HEROIC_ACTS,
  MEDAL_TYPES
} from '../src/systems/HeroicActionManager.js';

describe('Phase 4 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. ENEMY COMMANDER AI TESTS
  // ============================================================================
  describe('EnemyCommander', () => {
    let enemyCommander;
    let ledger;
    let squadManager;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
    });

    it('should initialize with default metrics and Recon strategy', () => {
      const state = enemyCommander.getState();
      assert.equal(state.aggression, 50);
      assert.equal(state.awareness, 30);
      assert.equal(state.adaptation, 20);
      assert.equal(state.currentStrategy, ENEMY_STRATEGIES.RECON);
      assert.equal(state.countermeasures.length, 0);
    });

    it('should clamp stats strictly between 0 and 100 upon modification', () => {
      enemyCommander.modifyStat('aggression', 70);
      assert.equal(enemyCommander.aggression, 100);

      enemyCommander.modifyStat('aggression', -150);
      assert.equal(enemyCommander.aggression, 0);

      enemyCommander.modifyStat('awareness', 50);
      assert.equal(enemyCommander.awareness, 80);

      enemyCommander.modifyStat('adaptation', -50);
      assert.equal(enemyCommander.adaptation, 0);
    });

    it('should adapt to frequent artillery and air strikes by deploying spider holes', () => {
      let adaptedEvent = null;
      messageBus.subscribe('ENEMY_ADAPTED', (payload) => {
        adaptedEvent = payload;
      });

      // 1st artillery action
      enemyCommander.recordPlayerAction('artillery', { callsign: 'Battery B' });
      assert.equal(adaptedEvent, null);

      // 2nd artillery action triggers spider holes countermeasure
      enemyCommander.recordPlayerAction('artillery', { callsign: 'Battery B' });

      assert.ok(adaptedEvent);
      assert.equal(adaptedEvent.counterMeasure, ENEMY_COUNTERMEASURES.SPIDER_HOLES);
      assert.ok(adaptedEvent.adaptation >= 35);
      assert.ok(enemyCommander.countermeasures.has(ENEMY_COUNTERMEASURES.SPIDER_HOLES));
    });

    it('should adapt to frequent stealth actions by deploying trackers', () => {
      let adaptedEvent = null;
      messageBus.subscribe('ENEMY_ADAPTED', (payload) => {
        adaptedEvent = payload;
      });

      // 1st stealth action
      enemyCommander.recordPlayerAction('stealth', { route: 'ridgeline bamboo' });
      assert.equal(adaptedEvent, null);

      // 2nd stealth action triggers tracker dogs and scouts
      enemyCommander.recordPlayerAction('stealth', { route: 'creek bed' });

      assert.ok(adaptedEvent);
      assert.equal(adaptedEvent.counterMeasure, ENEMY_COUNTERMEASURES.TRACKERS);
      assert.ok(adaptedEvent.awareness >= 50);
      assert.ok(enemyCommander.countermeasures.has(ENEMY_COUNTERMEASURES.TRACKERS));
    });

    it('should shift strategy to Hunt when heat exceeds 60', () => {
      let strategyEvent = null;
      let huntTriggerEvent = null;

      messageBus.subscribe('ENEMY_STRATEGY_CHANGED', (payload) => {
        strategyEvent = payload;
      });
      messageBus.subscribe('ENEMY_HUNT_TRIGGERED', (payload) => {
        huntTriggerEvent = payload;
      });

      // Spike heat via STAT_CHANGED
      messageBus.publish('STAT_CHANGED', { stat: 'heat', delta: 65 });

      assert.ok(strategyEvent);
      assert.equal(strategyEvent.newStrategy, ENEMY_STRATEGIES.HUNT);
      assert.ok(huntTriggerEvent);
      assert.equal(huntTriggerEvent.strategy, ENEMY_STRATEGIES.HUNT);
      assert.equal(enemyCommander.currentStrategy, ENEMY_STRATEGIES.HUNT);
    });

    it('should shift strategy to Full Assault when heat exceeds 75 or casualties reach 3', () => {
      let huntTriggerEvent = null;
      messageBus.subscribe('ENEMY_HUNT_TRIGGERED', (payload) => {
        huntTriggerEvent = payload;
      });

      // Simulate 3 casualties taken
      messageBus.publish('CASUALTY_TAKEN', { soldierId: 'doc_baker' });
      messageBus.publish('CASUALTY_TAKEN', { soldierId: 'pfc_jenkins' });
      messageBus.publish('CASUALTY_TAKEN', { soldierId: 'duke' });

      assert.equal(enemyCommander.currentStrategy, ENEMY_STRATEGIES.FULL_ASSAULT);
      assert.ok(huntTriggerEvent);
      assert.equal(huntTriggerEvent.strategy, ENEMY_STRATEGIES.FULL_ASSAULT);
    });

    it('should shift strategy to Harassment or Ambush when player is stationary and heat is low', () => {
      // Heat is 0 (low)
      enemyCommander.recordPlayerAction('stationary', { location: 'Bunker 4' });
      enemyCommander.recordPlayerAction('stationary', { location: 'Bunker 4' });

      assert.ok(
        enemyCommander.currentStrategy === ENEMY_STRATEGIES.HARASSMENT ||
        enemyCommander.currentStrategy === ENEMY_STRATEGIES.AMBUSH
      );
    });

    it('should automatically analyze player actions from CHOICE_MADE events', () => {
      messageBus.publish('CHOICE_MADE', {
        text: 'Call in immediate 105mm artillery barrage on the tree line.',
        resolutionText: 'HE shells impact the jungle.'
      });

      const state = enemyCommander.getState();
      assert.equal(state.actionCounts.artillery, 1);
    });

    it('should serialize and deserialize state cleanly', () => {
      enemyCommander.modifyStat('aggression', 30);
      enemyCommander.modifyStat('awareness', 40);
      enemyCommander.countermeasures.add(ENEMY_COUNTERMEASURES.SPIDER_HOLES);
      enemyCommander.setStrategy(ENEMY_STRATEGIES.AMBUSH, 'Testing');

      const serialized = enemyCommander.serialize();
      assert.equal(serialized.aggression, 80);
      assert.equal(serialized.awareness, 70);
      assert.equal(serialized.currentStrategy, ENEMY_STRATEGIES.AMBUSH);
      assert.ok(serialized.countermeasures.includes(ENEMY_COUNTERMEASURES.SPIDER_HOLES));

      const restored = new EnemyCommander(messageBus);
      restored.deserialize(serialized);

      assert.equal(restored.aggression, 80);
      assert.equal(restored.awareness, 70);
      assert.equal(restored.currentStrategy, ENEMY_STRATEGIES.AMBUSH);
      assert.ok(restored.countermeasures.has(ENEMY_COUNTERMEASURES.SPIDER_HOLES));
    });
  });

  // ============================================================================
  // 2. TENSION & AMBUSH SYSTEM TESTS
  // ============================================================================
  describe('AmbushSystem', () => {
    let ambushSystem;
    let ledger;
    let intelSystem;
    let weatherSystem;
    let enemyCommander;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
      weatherSystem = new WeatherSystem(messageBus);
      enemyCommander = new EnemyCommander(messageBus, { ledger });
      ambushSystem = new AmbushSystem(messageBus, {
        ledger,
        intelSystem,
        weatherSystem,
        enemyCommander
      });
    });

    it('should evaluate ambush risk considering heat, intel, terrain, weather, and strategy', () => {
      // Baseline clear weather, low heat, low intel
      let riskProfile = ambushSystem.evaluateAmbushRisk({
        heat: 0,
        intel: 0,
        terrain: 'clearing',
        weather: 'Clear',
        enemyStrategy: 'Recon'
      });
      // Base (20) + heat(0) - intel(0) + terrain(-15) + weather(-10) + strategy(0) = -5 -> clamped to 5
      assert.equal(riskProfile.riskPercentage, 5);

      // High danger scenario: Heat 90, dense jungle, Fog, Enemy Ambush strategy
      riskProfile = ambushSystem.evaluateAmbushRisk({
        heat: 90,
        intel: 0,
        terrain: 'dense jungle',
        weather: 'Fog',
        enemyStrategy: 'Ambush'
      });
      // Base (20) + heat(31) - intel(0) + terrain(20) + weather(25) + strategy(30) = 126 -> clamped to 95
      assert.equal(riskProfile.riskPercentage, 95);
      assert.ok(riskProfile.outcomeWeights[AMBUSH_OUTCOMES.RPG_ATTACK] > 0);
      assert.ok(riskProfile.outcomeWeights[AMBUSH_OUTCOMES.TRIPWIRE] > 0);
      assert.ok(riskProfile.outcomeWeights[AMBUSH_OUTCOMES.SNIPER_FIRE] > 0);
    });

    it('should reduce risk when squad possesses High Intel depth', () => {
      ledger.setStat('intel', 75); // High tier (-35% modifier)
      const profile = ambushSystem.evaluateAmbushRisk({
        heat: 50,
        terrain: 'jungle',
        weather: 'Clear',
        enemyStrategy: 'Recon'
      });
      assert.ok(profile.factors.intelReduction >= 35);
      // High intel boosts False Alarm weight
      assert.ok(profile.outcomeWeights[AMBUSH_OUTCOMES.FALSE_ALARM] > 30);
    });

    it('should initiate a multi-stage suspense sequence and broadcast AMBUSH_WARNING', () => {
      let warningEvent = null;
      messageBus.subscribe('AMBUSH_WARNING', (payload) => {
        warningEvent = payload;
      });

      const tension = ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.TRIPWIRE,
        location: 'Hill 881 Trail'
      });

      assert.ok(tension);
      assert.equal(tension.stage, 'warning');
      assert.equal(tension.probableThreat, AMBUSH_OUTCOMES.TRIPWIRE);
      assert.ok(tension.cue.includes('wire'));
      assert.ok(warningEvent);
      assert.equal(warningEvent.probableThreat, AMBUSH_OUTCOMES.TRIPWIRE);

      const active = ambushSystem.getActiveTension();
      assert.equal(active.id, tension.id);
    });

    it('should resolve False Alarm peacefully and relieve stress', () => {
      ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.FALSE_ALARM
      });

      let resolvedEvent = null;
      let evadedEvent = null;

      messageBus.subscribe('TENSION_RESOLVED', (payload) => {
        resolvedEvent = payload;
      });
      messageBus.subscribe('AMBUSH_EVADED', (payload) => {
        evadedEvent = payload;
      });

      const resolution = ambushSystem.resolveAmbush(AMBUSH_OUTCOMES.FALSE_ALARM);

      assert.ok(resolution);
      assert.equal(resolution.wasEvaded, true);
      assert.ok(resolvedEvent);
      assert.ok(evadedEvent);
      assert.equal(ambushSystem.getActiveTension(), null);
    });

    it('should resolve hostile RPG Attack and publish AMBUSH_TRIGGERED', () => {
      ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.RPG_ATTACK
      });

      let triggeredEvent = null;
      messageBus.subscribe('AMBUSH_TRIGGERED', (payload) => {
        triggeredEvent = payload;
      });

      // Force failure to evade
      const resolution = ambushSystem.resolveAmbush(AMBUSH_OUTCOMES.RPG_ATTACK, {
        action: 'ignore',
        evasionRoll: 10
      });

      assert.ok(resolution);
      assert.equal(resolution.wasEvaded, false);
      assert.ok(triggeredEvent);
      assert.equal(triggeredEvent.outcomeKey, AMBUSH_OUTCOMES.RPG_ATTACK);
      assert.ok(triggeredEvent.description.includes('B-40'));
      assert.equal(triggeredEvent.stressDelta, 25);
    });

    it('should allow player tactical reaction to evade an ambush', () => {
      ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.TRIPWIRE
      });

      let evadedEvent = null;
      messageBus.subscribe('AMBUSH_EVADED', (payload) => {
        evadedEvent = payload;
      });

      const resolution = ambushSystem.resolveAmbush(AMBUSH_OUTCOMES.TRIPWIRE, {
        action: 'spot_and_disarm',
        forceEvade: true
      });

      assert.equal(resolution.wasEvaded, true);
      assert.ok(evadedEvent);
      assert.equal(evadedEvent.outcomeKey, AMBUSH_OUTCOMES.TRIPWIRE);
    });

    it('should serialize and deserialize active tension and history accurately', () => {
      ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.SNIPER_FIRE,
        location: 'Eastern Ridge'
      });

      const serialized = ambushSystem.serialize();
      assert.ok(serialized.activeTension);
      assert.equal(serialized.activeTension.probableThreat, AMBUSH_OUTCOMES.SNIPER_FIRE);

      const restored = new AmbushSystem(messageBus);
      restored.deserialize(serialized);

      const active = restored.getActiveTension();
      assert.ok(active);
      assert.equal(active.probableThreat, AMBUSH_OUTCOMES.SNIPER_FIRE);
    });
  });

  // ============================================================================
  // 3. HEROIC ACTION & MEDAL CITATION SYSTEM TESTS
  // ============================================================================
  describe('HeroicActionManager', () => {
    let heroicManager;
    let squadManager;

    beforeEach(() => {
      squadManager = new SquadManager(messageBus);
      heroicManager = new HeroicActionManager(messageBus, { squadManager });
    });

    it('should trigger Last Stand heroic action and award Medal of Honor with citation', () => {
      let heroicEvent = null;
      let medalEvent = null;

      messageBus.subscribe('HEROIC_ACTION', (payload) => {
        heroicEvent = payload;
      });
      messageBus.subscribe('MEDAL_AWARDED', (payload) => {
        medalEvent = payload;
      });

      const result = heroicManager.triggerHeroicAction('pfc_jenkins', HEROIC_ACTS.LAST_STAND, {
        location: 'Hill 881 Perimeter'
      });

      assert.ok(result);
      assert.ok(heroicEvent);
      assert.equal(heroicEvent.actionType, HEROIC_ACTS.LAST_STAND);
      assert.equal(heroicEvent.heroName, 'PFC Jenkins');

      assert.ok(medalEvent);
      assert.equal(medalEvent.medalType, MEDAL_TYPES.MEDAL_OF_HONOR);
      assert.ok(medalEvent.citation.includes('CONSPICUOUS GALLANTRY'));
      assert.ok(medalEvent.citation.includes('JENKINS'));

      const actions = heroicManager.getHeroicActions();
      assert.equal(actions.length, 1);
    });

    it('should trigger Combat Rescue and award Distinguished Service Cross', () => {
      let medalEvent = null;
      messageBus.subscribe('MEDAL_AWARDED', (payload) => {
        medalEvent = payload;
      });

      const result = heroicManager.triggerHeroicAction('cpl_brady', HEROIC_ACTS.COMBAT_RESCUE, {
        location: 'Rice Paddy'
      });

      assert.ok(result);
      assert.equal(medalEvent.medalType, MEDAL_TYPES.DISTINGUISHED_SERVICE_CROSS);
      assert.ok(medalEvent.citation.includes('EXTRAORDINARY HEROISM'));
    });

    it('should trigger Medic Save and award Silver Star', () => {
      const result = heroicManager.triggerHeroicAction('doc_baker', HEROIC_ACTS.MEDIC_SAVE, {
        location: 'Aid Station'
      });

      assert.ok(result);
      assert.equal(result.medal.medalType, MEDAL_TYPES.SILVER_STAR);
      assert.ok(result.medal.citation.includes('GALLANTRY'));
    });

    it('should automatically award Purple Heart on CASUALTY_TAKEN', () => {
      let medalEvent = null;
      messageBus.subscribe('MEDAL_AWARDED', (payload) => {
        medalEvent = payload;
      });

      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'cpl_thompson',
        name: 'CPL Thompson',
        role: 'Assistant Squad Leader',
        location: 'Treeline',
        cause: 'Fragment shrapnel'
      });

      assert.ok(medalEvent);
      assert.equal(medalEvent.soldierId, 'cpl_thompson');
      assert.equal(medalEvent.medalType, MEDAL_TYPES.PURPLE_HEART);
      assert.ok(medalEvent.citation.includes('PURPLE HEART'));
      assert.ok(medalEvent.citation.includes('THOMPSON'));
    });

    it('should evaluate heroic opportunities during crisis contexts', () => {
      // 1. Casualty crisis gives Doc Baker Medic Save opportunity
      const medOpp = heroicManager.checkHeroicOpportunity({
        type: 'casualty',
        casualtyId: 'pfc_jenkins'
      });
      assert.ok(medOpp);
      assert.equal(medOpp.actionType, HEROIC_ACTS.MEDIC_SAVE);

      // 2. Ambush crisis gives Duke or Jenkins Scout Warning opportunity
      const ambushOpp = heroicManager.checkHeroicOpportunity({
        type: 'ambush',
        ambushOutcome: 'Tripwire'
      });
      assert.ok(ambushOpp);
      assert.equal(ambushOpp.actionType, HEROIC_ACTS.SCOUT_WARNING);

      // 3. Outnumbered crisis gives Last Stand opportunity
      const lastStandOpp = heroicManager.checkHeroicOpportunity({
        type: 'last_stand',
        outnumbered: true
      });
      assert.ok(lastStandOpp);
      assert.equal(lastStandOpp.actionType, HEROIC_ACTS.LAST_STAND);
    });

    it('should retrieve medals for a specific soldier and across the squad', () => {
      heroicManager.awardMedal('ssg_miller', MEDAL_TYPES.SILVER_STAR, 'Citation A');
      heroicManager.awardMedal('ssg_miller', MEDAL_TYPES.PURPLE_HEART, 'Citation B');
      heroicManager.awardMedal('doc_baker', MEDAL_TYPES.DISTINGUISHED_SERVICE_CROSS, 'Citation C');

      const millerMedals = heroicManager.getMedalsForSoldier('ssg_miller');
      assert.equal(millerMedals.length, 2);

      const allMedals = heroicManager.getAllMedals();
      assert.equal(allMedals.length, 3);
    });

    it('should serialize and deserialize heroic actions and medals cleanly', () => {
      heroicManager.triggerHeroicAction('duke', HEROIC_ACTS.SCOUT_WARNING, {
        location: 'LZ X-Ray'
      });

      const serialized = heroicManager.serialize();
      assert.equal(serialized.heroicActions.length, 1);
      assert.equal(serialized.medals.length, 1);

      const restored = new HeroicActionManager(messageBus, { squadManager });
      restored.deserialize(serialized);

      assert.equal(restored.getHeroicActions().length, 1);
      assert.equal(restored.getAllMedals().length, 1);
    });
  });

  // ============================================================================
  // 4. SAVEMANAGER PHASE 4 PERSISTENCE TESTS
  // ============================================================================
  describe('SaveManager Phase 4 Persistence', () => {
    let saveManager;
    let ledger;
    let squadManager;
    let enemyCommander;
    let ambushSystem;
    let heroicManager;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
      ambushSystem = new AmbushSystem(messageBus, { ledger, enemyCommander });
      heroicManager = new HeroicActionManager(messageBus, { squadManager });

      saveManager = new SaveManager(messageBus, null, squadManager, ledger, 'testPhase4Save', {
        enemyCommander,
        ambushSystem,
        heroicActionManager: heroicManager
      });
    });

    it('should serialize enemy commander, ambush system, and heroic action records', () => {
      enemyCommander.setStrategy(ENEMY_STRATEGIES.HUNT, 'Test hunt');
      enemyCommander.countermeasures.add(ENEMY_COUNTERMEASURES.SPIDER_HOLES);

      ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.RPG_ATTACK
      });

      heroicManager.triggerHeroicAction('doc_baker', HEROIC_ACTS.MEDIC_SAVE);

      const saveData = saveManager.saveGame('scene_bunker_defense');

      assert.ok(saveData.enemyCommander);
      assert.equal(saveData.enemyCommander.currentStrategy, ENEMY_STRATEGIES.HUNT);
      assert.ok(saveData.enemyCommander.countermeasures.includes(ENEMY_COUNTERMEASURES.SPIDER_HOLES));

      assert.ok(saveData.ambush);
      assert.ok(saveData.ambush.activeTension);
      assert.equal(saveData.ambush.activeTension.probableThreat, AMBUSH_OUTCOMES.RPG_ATTACK);

      assert.ok(saveData.heroics);
      assert.equal(saveData.heroics.heroicActions.length, 1);
      assert.equal(saveData.heroics.medals.length, 1);
    });

    it('should restore Phase 4 systems upon loadGame()', () => {
      const mockSave = {
        sceneId: 'scene_ridge_ambush',
        stats: { heat: 45, intel: 30, supplies: 85 },
        squad: [],
        enemyCommander: {
          aggression: 85,
          awareness: 75,
          adaptation: 60,
          currentStrategy: ENEMY_STRATEGIES.AMBUSH,
          countermeasures: [ENEMY_COUNTERMEASURES.TRACKERS]
        },
        ambush: {
          activeTension: {
            id: 'tension_mock',
            probableThreat: AMBUSH_OUTCOMES.TRIPWIRE,
            stage: 'warning'
          }
        },
        heroics: {
          heroicActions: [{ id: 'heroic_1', actionType: HEROIC_ACTS.LAST_STAND }],
          medals: [{ id: 'medal_1', medalType: MEDAL_TYPES.MEDAL_OF_HONOR }]
        }
      };

      // Mock getSaveData
      saveManager.getSaveData = () => mockSave;
      saveManager.isStorageAvailable = () => true;

      const loaded = saveManager.loadGame();
      assert.ok(loaded);

      assert.equal(enemyCommander.aggression, 85);
      assert.equal(enemyCommander.currentStrategy, ENEMY_STRATEGIES.AMBUSH);
      assert.ok(enemyCommander.countermeasures.has(ENEMY_COUNTERMEASURES.TRACKERS));

      assert.ok(ambushSystem.getActiveTension());
      assert.equal(ambushSystem.getActiveTension().probableThreat, AMBUSH_OUTCOMES.TRIPWIRE);

      assert.equal(heroicManager.getHeroicActions().length, 1);
      assert.equal(heroicManager.getAllMedals().length, 1);
    });
  });

  // ============================================================================
  // 5. FULL CROSS-SYSTEM MESSAGEBUS INTEGRATION
  // ============================================================================
  describe('Full Cross-System MessageBus Integration', () => {
    it('should coordinate EnemyCommander, AmbushSystem, HeroicActionManager, Journal, and Ledger in combat crisis', () => {
      const ledger = new Ledger(messageBus);
      const squadManager = new SquadManager(messageBus);
      const journal = new Journal(messageBus);
      const enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
      const ambushSystem = new AmbushSystem(messageBus, { ledger, enemyCommander });
      const heroicManager = new HeroicActionManager(messageBus, { squadManager });

      // Step 1: Squad calls in artillery -> EnemyCommander adapts
      messageBus.publish('CHOICE_MADE', {
        text: 'Call in heavy 105mm artillery barrage',
        actionType: 'artillery'
      });
      messageBus.publish('CHOICE_MADE', {
        text: 'Fire second artillery battery volley',
        actionType: 'artillery'
      });

      assert.ok(enemyCommander.countermeasures.has(ENEMY_COUNTERMEASURES.SPIDER_HOLES));

      // Step 2: Heat spikes to 65 -> Enemy shifts to HUNT
      messageBus.publish('STAT_CHANGED', { stat: 'heat', delta: 65 });
      assert.equal(enemyCommander.currentStrategy, ENEMY_STRATEGIES.HUNT);

      // Step 3: Ambush system triggers under Hunt conditions
      const tension = ambushSystem.rollAmbushSequence({
        forceTrigger: true,
        forceOutcome: AMBUSH_OUTCOMES.RPG_ATTACK,
        location: 'Hill 881 Treeline'
      });
      assert.ok(tension);

      // Step 4: Resolve ambush -> springs hostile RPG attack
      ambushSystem.resolveAmbush(AMBUSH_OUTCOMES.RPG_ATTACK, { action: 'freeze', evasionRoll: 5 });

      // Step 5: RPG explosion causes casualty -> triggers Purple Heart
      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'pfc_jenkins',
        name: 'PFC Jenkins',
        role: 'Scout',
        location: 'Hill 881 Treeline',
        cause: 'RPG shrapnel'
      });

      const jenkinsMedals = heroicManager.getMedalsForSoldier('pfc_jenkins');
      assert.equal(jenkinsMedals.length, 1);
      assert.equal(jenkinsMedals[0].medalType, MEDAL_TYPES.PURPLE_HEART);

      // Step 6: Doc Baker performs Medic Save heroic action
      heroicManager.triggerHeroicAction('doc_baker', HEROIC_ACTS.MEDIC_SAVE, {
        location: 'Hill 881 Treeline',
        description: 'Doc Baker crawled through hot shrapnel to stop Jenkins from bleeding out.'
      });

      const bakerMedals = heroicManager.getMedalsForSoldier('doc_baker');
      assert.equal(bakerMedals.length, 1);
      assert.equal(bakerMedals[0].medalType, MEDAL_TYPES.SILVER_STAR);

      // Step 7: Verify Campaign Journal logged casualties, ambushes, and heroism
      const entries = journal.getEntries();
      assert.ok(entries.some((e) => e.category === 'CASUALTY' && e.tags.includes('PFC Jenkins')));
      assert.ok(entries.some((e) => e.category === 'COMBAT' && e.tags.includes('AMBUSH')));
      assert.ok(entries.some((e) => e.category === 'HEROISM' && e.tags.includes('Doc Baker')));
    });
  });
});
