// Squad Leader: Vietnam - Phase 6 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase6.test.js
Purpose: Automated verification suite for Phase 6 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify ExtractionSystem procedural calculation of all 6 Dynamic Ending Archetypes:
  * Clean Extraction
  * Running Gunfight
  * Helicopter Shot Down
  * Last Stand
  * Rear Guard Sacrifice
  * Split Evacuation
- Verify ExtractionSystem war story epilogue generation incorporating fallen comrades, specific heroic feats, and LZ X-Ray climax
- Verify ExtractionSystem execution, medal decoration citations, rear-guard sacrifice mechanics, and journal logging
- Verify ExtractionSystem state serialization and restoration
- Verify Complete Full-Campaign Save/Load Round-Trip across ALL 16 systems:
  1. Relationships
  2. Traits
  3. Conditions
  4. Reputation
  5. Journal
  6. Heroic Actions
  7. Dynamic Events
  8. Weather
  9. Enemy Commander
  10. Intel State
  11. Radio History
  12. Tactical Map
  13. Wounded Soldier State
  14. Battlefield Recovery
  15. Extraction System
  16. Core Ledger & Squad Roster
- Verify end-to-end cross-system MessageBus integration from combat wounding to extraction liftoff
Dependencies: node:test, node:assert/strict, MessageBus, Ledger, SquadManager, SceneManager, SaveManager,
  RelationshipManager, TraitManager, Journal, PsychologicalConditionManager, ReputationManager,
  DynamicEventManager, WeatherSystem, RadioSystem, IntelSystem, EnemyCommander, AmbushSystem,
  HeroicActionManager, TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem, ExtractionSystem
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Multi-ship Dustoff tests, campaign victory medal ribbons, and cinematic cutscene triggers.
--------------------------------------------------
*/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { Ledger } from '../src/state/Ledger.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { SceneManager } from '../src/core/SceneManager.js';
import { SaveManager } from '../src/core/SaveManager.js';
import { RelationshipManager } from '../src/systems/RelationshipManager.js';
import { TraitManager } from '../src/systems/TraitManager.js';
import { Journal } from '../src/systems/Journal.js';
import { PsychologicalConditionManager } from '../src/systems/PsychologicalConditionManager.js';
import { ReputationManager } from '../src/systems/ReputationManager.js';
import { DynamicEventManager } from '../src/systems/DynamicEventManager.js';
import { WeatherSystem, WEATHER_TYPES } from '../src/systems/WeatherSystem.js';
import { RadioSystem, RADIO_CHANNELS } from '../src/systems/RadioSystem.js';
import { IntelSystem, INTEL_TIERS } from '../src/systems/IntelSystem.js';
import { EnemyCommander, ENEMY_STRATEGIES } from '../src/systems/EnemyCommander.js';
import { AmbushSystem } from '../src/systems/AmbushSystem.js';
import { HeroicActionManager } from '../src/systems/HeroicActionManager.js';
import { TacticalMapManager, MAP_MARKER_TYPES } from '../src/systems/TacticalMapManager.js';
import { WoundedSoldierManager } from '../src/systems/WoundedSoldierManager.js';
import { BattlefieldRecoverySystem, RECOVERY_OPTIONS } from '../src/systems/BattlefieldRecoverySystem.js';
import {
  ExtractionSystem,
  EXTRACTION_ARCHETYPES,
  ARCHETYPE_METADATA
} from '../src/systems/ExtractionSystem.js';

describe('Phase 6 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. EXTRACTION SYSTEM ARCHETYPE CALCULATION TESTS
  // ============================================================================
  describe('ExtractionSystem Archetype Calculations', () => {
    let extractionSystem;

    beforeEach(() => {
      extractionSystem = new ExtractionSystem(messageBus);
    });

    it('should calculate Clean Extraction when heat is low, squad is intact, weather is clear, and intel is high', () => {
      const inputs = {
        heat: 10,
        supplies: 85,
        survivorCount: 8,
        woundedCount: 0,
        carriedCount: 0,
        weather: 'Clear',
        enemyAggression: 20,
        enemyStrategy: 'Recon',
        intelTier: 'HIGH',
        intelClarity: 95,
        primaryReputation: 'Reliable'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION);
      assert.equal(result.name, 'Clean Extraction');
      assert.equal(result.tacticalRisk, 'Low');
      assert.ok(result.conditionsMet.length > 0);
    });

    it('should calculate Running Gunfight under elevated heat and aggressive enemy probe', () => {
      const inputs = {
        heat: 60,
        supplies: 65,
        survivorCount: 6,
        woundedCount: 0,
        carriedCount: 0,
        weather: 'Clear',
        enemyAggression: 60,
        enemyStrategy: 'Hunt',
        intelTier: 'MEDIUM',
        primaryReputation: 'Tactical'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      assert.equal(result.name, 'Running Gunfight');
      assert.equal(result.tacticalRisk, 'High');
    });

    it('should calculate Helicopter Shot Down when enemy aggression is severe with anti-air threat or thunderstorm', () => {
      const inputs = {
        heat: 70,
        supplies: 50,
        survivorCount: 6,
        woundedCount: 0,
        carriedCount: 0,
        weather: 'Thunderstorm',
        enemyAggression: 85,
        enemyStrategy: 'Hunt',
        enemyCountermeasures: ['interlocking_crossfire', 'camouflaged_mortars'],
        intelTier: 'MEDIUM',
        primaryReputation: 'Aggressive'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN);
      assert.equal(result.name, 'Helicopter Shot Down');
      assert.equal(result.tacticalRisk, 'Extreme');
    });

    it('should calculate Last Stand when heat is extreme, enemy is in Full Assault, and supplies are depleted', () => {
      const inputs = {
        heat: 95,
        supplies: 15,
        survivorCount: 3,
        woundedCount: 0,
        carriedCount: 0,
        weather: 'Clear',
        enemyAggression: 90,
        enemyStrategy: 'Full Assault',
        intelTier: 'LOW',
        primaryReputation: 'Ruthless'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.LAST_STAND);
      assert.equal(result.name, 'Last Stand');
      assert.equal(result.tacticalRisk, 'Catastrophic');
    });

    it('should calculate Rear Guard Sacrifice when squad is slowed by wounded personnel under hostile pursuit', () => {
      const inputs = {
        heat: 65,
        supplies: 55,
        survivorCount: 5,
        woundedCount: 2,
        carriedCount: 2,
        weather: 'Rain',
        enemyAggression: 65,
        enemyStrategy: 'Hunt',
        intelTier: 'MEDIUM',
        primaryReputation: 'Protector'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE);
      assert.equal(result.name, 'Rear Guard Sacrifice');
      assert.equal(result.tacticalRisk, 'Severe / Heroic');
    });

    it('should calculate Split Evacuation when large squad + wounded face adverse weather and limited lift capacity', () => {
      const inputs = {
        heat: 45,
        supplies: 60,
        survivorCount: 6,
        woundedCount: 2,
        carriedCount: 1,
        weather: 'Fog',
        enemyAggression: 40,
        enemyStrategy: 'Harassment',
        intelTier: 'MEDIUM',
        limitedLift: true,
        primaryReputation: 'Tactical'
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.SPLIT_EVACUATION);
      assert.equal(result.name, 'Split Evacuation');
      assert.equal(result.tacticalRisk, 'Severe');
    });

    it('should honor explicitly forced or specified ending archetypes', () => {
      const inputs = {
        forcedEnding: EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN,
        heat: 0,
        supplies: 100
      };

      const result = extractionSystem.calculateEnding(inputs);
      assert.equal(result.endingId, EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN);
      assert.equal(result.scoreBreakdown.forced, 999);
    });
  });

  // ============================================================================
  // 2. EXTRACTION EVALUATION & EVENT PUBLISHING TESTS
  // ============================================================================
  describe('ExtractionSystem Lifecycle & Execution', () => {
    let extractionSystem;
    let ledger;
    let squadManager;
    let intelSystem;
    let reputationManager;
    let weatherSystem;
    let heroicActionManager;
    let enemyCommander;
    let woundedSoldierManager;
    let journal;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
      reputationManager = new ReputationManager(messageBus);
      weatherSystem = new WeatherSystem(messageBus);
      heroicActionManager = new HeroicActionManager(messageBus, { squadManager });
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
      woundedSoldierManager = new WoundedSoldierManager(messageBus, { squadManager, ledger });
      journal = new Journal(messageBus);

      extractionSystem = new ExtractionSystem(messageBus, {
        squadManager,
        ledger,
        intelSystem,
        reputationManager,
        weatherSystem,
        heroicActionManager,
        enemyCommander,
        woundedSoldierManager,
        journal
      });
    });

    it('should evaluate extraction from live systems and publish EXTRACTION_CALCULATED', () => {
      let calcEvent = null;
      messageBus.subscribe('EXTRACTION_CALCULATED', (payload) => {
        calcEvent = payload;
      });

      // Populate live state
      ledger.modifyStat('heat', 15);
      weatherSystem.setWeather(WEATHER_TYPES.CLEAR, 5);

      const evalResult = extractionSystem.evaluateExtraction();
      assert.ok(evalResult);
      assert.ok(calcEvent);
      assert.equal(calcEvent.endingId, evalResult.endingId);
      assert.equal(calcEvent.inputs.heat, 15);
      assert.equal(calcEvent.inputs.survivorCount, 9);
    });

    it('should execute Rear Guard Sacrifice, mark soldier KIA, award Medal of Honor, and record journal entry', () => {
      let begunEvent = null;
      let concludedEvent = null;
      messageBus.subscribe('EXTRACTION_BEGUN', (p) => { begunEvent = p; });
      messageBus.subscribe('EXTRACTION_CONCLUDED', (p) => { concludedEvent = p; });

      // Execute rear guard sacrifice designating Kowalski
      const summary = extractionSystem.executeExtraction(EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE, {
        rearGuardSoldierId: 'kowalski'
      });

      assert.ok(summary);
      assert.equal(summary.endingId, EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE);
      assert.equal(summary.executed, true);
      assert.ok(begunEvent);
      assert.ok(concludedEvent);

      // Verify Kowalski marked KIA
      const kowalski = squadManager.getSoldierById('kowalski');
      assert.equal(kowalski.isAlive, false);
      assert.equal(kowalski.status, 'kia');

      // Verify Medal awarded via HeroicActionManager
      const medals = heroicActionManager.getMedalsForSoldier('kowalski');
      assert.ok(medals.length > 0);
      assert.equal(medals[0].medal, 'Medal of Honor');

      // Verify Journal captured entry
      const entries = journal.getEntriesByCategory('HEROISM');
      assert.ok(entries.length > 0);
      assert.ok(entries[0].content.includes('Kowalski'));
    });

    it('should execute Helicopter Shot Down, award Combat Rescue decoration, and record journal entry', () => {
      const summary = extractionSystem.executeExtraction(EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN, {
        rescueCrew: true
      });

      assert.equal(summary.endingId, EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN);
      assert.equal(summary.executed, true);

      // Verify heroic rescue registered
      const heroics = heroicActionManager.getHeroicActions();
      assert.ok(heroics.some((h) => (h.actionType || h.actType) === 'Combat Rescue'));

      // Verify Journal captured entry
      const combatEntries = journal.getEntriesByCategory('COMBAT');
      assert.ok(combatEntries.some((e) => e.title.includes('Huey Shot Down')));
    });

    it('should compile a complete extraction summary with survivors, fallen, medals, and epilogue', () => {
      // Create a casualty
      squadManager.handleCasualty({ soldierId: 'jenkins', status: 'kia' });

      // Award a medal
      heroicActionManager.awardMedal('baker', 'Silver Star', {
        reason: 'Treated wounded under intense crossfire.'
      });

      extractionSystem.executeExtraction(EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      const summary = extractionSystem.getExtractionSummary();

      assert.equal(summary.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      assert.equal(summary.survivorCount, 8);
      assert.equal(summary.fallenCount, 1);
      assert.equal(summary.fallen[0].id, 'jenkins');
      assert.ok(summary.medals.length >= 1);
      assert.ok(summary.epilogue.length > 50);
    });
  });

  // ============================================================================
  // 3. WAR STORY EPILOGUE GENERATION TESTS
  // ============================================================================
  describe('Emergent War Story Epilogue Generation', () => {
    let extractionSystem;
    let squadManager;
    let heroicActionManager;

    beforeEach(() => {
      squadManager = new SquadManager(messageBus);
      heroicActionManager = new HeroicActionManager(messageBus, { squadManager });
      extractionSystem = new ExtractionSystem(messageBus, {
        squadManager,
        heroicActionManager
      });
    });

    it('should generate an emergent war story mentioning fallen soldiers and heroic feats ("Washington died saving Jenkins")', () => {
      // Set up narrative context: Washington fell during a Combat Rescue for Jenkins
      squadManager.handleCasualty({ soldierId: 'washington', status: 'kia' });
      heroicActionManager.triggerHeroicAction('washington', 'Combat Rescue', {
        soldierName: 'LCPL Washington',
        reason: 'Washington died saving Jenkins under heavy machine gun fire.'
      });

      extractionSystem.endingId = EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT;
      const epilogue = extractionSystem.generateWarStoryEpilogue();

      assert.ok(typeof epilogue === 'string');
      assert.ok(epilogue.includes('Washington'));
      assert.ok(epilogue.includes('Grid 881'));
      assert.ok(epilogue.includes('LZ X-Ray'));
    });

    it('should produce distinct atmospheric text for each of the 6 ending archetypes', () => {
      const archetypes = [
        EXTRACTION_ARCHETYPES.CLEAN_EXTRACTION,
        EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT,
        EXTRACTION_ARCHETYPES.HELICOPTER_SHOT_DOWN,
        EXTRACTION_ARCHETYPES.LAST_STAND,
        EXTRACTION_ARCHETYPES.REAR_GUARD_SACRIFICE,
        EXTRACTION_ARCHETYPES.SPLIT_EVACUATION
      ];

      const epilogues = new Set();
      for (const arch of archetypes) {
        extractionSystem.endingId = arch;
        const text = extractionSystem.generateWarStoryEpilogue();
        assert.ok(text.length > 50);
        epilogues.add(text);
      }

      // Assert all 6 archetypes generated unique epilogues
      assert.equal(epilogues.size, 6);
    });
  });

  // ============================================================================
  // 4. EXTRACTION SYSTEM SERIALIZATION TESTS
  // ============================================================================
  describe('ExtractionSystem State Serialization & Restoration', () => {
    it('should serialize and deserialize extraction state cleanly', () => {
      const sys1 = new ExtractionSystem(messageBus);
      sys1.calculatedEnding = { endingId: EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT, name: 'Running Gunfight' };
      sys1.executed = true;
      sys1.endingId = EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT;
      sys1.decisions = { popSmoke: true, doorGunnerCover: true };
      sys1.epilogue = 'The squad made it out under heavy machine gun fire.';
      sys1.summary = { endingId: EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT, survivorCount: 6 };

      const serialized = sys1.serialize();
      assert.ok(serialized);
      assert.equal(serialized.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      assert.equal(serialized.executed, true);
      assert.deepEqual(serialized.decisions, { popSmoke: true, doorGunnerCover: true });

      const sys2 = new ExtractionSystem(messageBus);
      sys2.deserialize(serialized);

      assert.equal(sys2.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      assert.equal(sys2.executed, true);
      assert.deepEqual(sys2.decisions, { popSmoke: true, doorGunnerCover: true });
      assert.equal(sys2.epilogue, 'The squad made it out under heavy machine gun fire.');
      assert.equal(sys2.summary.survivorCount, 6);
    });
  });

  // ============================================================================
  // 5. MASTER FULL-CAMPAIGN SAVE/LOAD ROUND-TRIP (ALL 16 SYSTEMS)
  // ============================================================================
  describe('Master Save/Load Round-Trip (All 16 Systems)', () => {
    // Setup in-memory mock for localStorage
    let mockStore;
    let originalLocalStorage;

    beforeEach(() => {
      mockStore = new Map();
      originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: (k) => mockStore.get(k) || null,
        setItem: (k, v) => mockStore.set(k, String(v)),
        removeItem: (k) => mockStore.delete(k),
        clear: () => mockStore.clear()
      };
    });

    it('should serialize and restore state across ALL 16 systems with 100% fidelity', () => {
      const bus1 = new MessageBus();

      // 1. Ledger & 2. Squad
      const ledger1 = new Ledger(bus1);
      ledger1.setStats({ heat: 42, intel: 75, supplies: 60, valorPoints: 3, stress: 25 });
      const squad1 = new SquadManager(bus1);

      // 3. Relationships
      const rel1 = new RelationshipManager(bus1, null, squad1);
      rel1.setRelationship('miller', 'jenkins', 'mentor', 88);

      // 4. Traits
      const traits1 = new TraitManager(bus1, squad1);
      traits1.discoverTrait('jenkins', 'Eagle Eyed', 'Spotted camouflaged sniper nest');

      // 5. Conditions
      const cond1 = new PsychologicalConditionManager(bus1, squad1);
      cond1.addCondition('baker', 'Exhausted', 'Tended three casualties under fire');
      cond1.addCondition('miller', 'Combat Hardened', 'Surviving multiple intense ambushes');

      // 6. Reputation
      const rep1 = new ReputationManager(bus1);
      rep1.modifyReputation('Protector', 80);
      rep1.modifyReputation('Tactical', 65);

      // 7. Journal
      const journal1 = new Journal(bus1);
      journal1.addEntry({
        category: 'COMBAT',
        title: 'Breakthrough on Grid 881',
        content: 'Squad overran an NVA blocking position on the eastern ridgeline.',
        tags: ['COMBAT', 'GRID881']
      });

      // 8. Heroic Actions
      const hero1 = new HeroicActionManager(bus1, { squadManager: squad1 });
      hero1.triggerHeroicAction('baker', 'Combat Rescue', {
        soldierName: 'Doc Baker',
        reason: 'Dragged wounded rifleman through crossfire.'
      });

      // 9. Dynamic Events
      const dyn1 = new DynamicEventManager(bus1);

      // 10. Weather
      const weather1 = new WeatherSystem(bus1);
      weather1.setWeather(WEATHER_TYPES.HEAVY_RAIN, 4);

      // 11. Enemy Commander
      const enemy1 = new EnemyCommander(bus1, { ledger: ledger1, squadManager: squad1 });
      enemy1.aggression = 72;
      enemy1.currentStrategy = ENEMY_STRATEGIES.HUNT;
      enemy1.countermeasures.add('interlocking_crossfire');

      // 12. Intel State
      const intel1 = new IntelSystem(bus1, ledger1);
      intel1.recordReconDiscovery({
        type: 'bunker',
        targetKey: 'hill_north',
        description: 'Hardened machine gun bunker guarding the main trail'
      });

      // 13. Radio History
      const radio1 = new RadioSystem(bus1, { weatherSystem: weather1 });
      radio1.receiveMessage({
        channel: RADIO_CHANNELS.MEDEVAC,
        text: 'Dustoff Three inbound LZ X-Ray in 3 mikes.',
        urgent: true,
        choices: [{ key: 'pop_smoke', text: 'Pop violet smoke' }]
      });

      // 14. Tactical Map
      const map1 = new TacticalMapManager(bus1, { intelSystem: intel1, ledger: ledger1 });
      map1.addMarker(MAP_MARKER_TYPES.ENEMY_LOCATION, 35, 45, 'NVA Heavy MG Nest');
      map1.recordPath(25, 30, 'lz_start');

      // 15. Wounded Soldier State
      const wounded1 = new WoundedSoldierManager(bus1, {
        squadManager: squad1,
        ledger: ledger1,
        conditionManager: cond1,
        relationshipManager: rel1,
        journal: journal1
      });
      wounded1.woundSoldier('hernandez', 'severe', { wound: 'Shrapnel puncture to chest' });
      wounded1.assignCarrier('hernandez', 'kowalski');

      // 16. Battlefield Recovery
      const rec1 = new BattlefieldRecoverySystem(bus1, {
        ledger: ledger1,
        squadManager: squad1,
        enemyCommander: enemy1,
        journal: journal1
      });
      rec1.executeRecovery(RECOVERY_OPTIONS.RECOVER_DOCUMENTS);

      // 17. Extraction System
      const ext1 = new ExtractionSystem(bus1, {
        squadManager: squad1,
        ledger: ledger1,
        intelSystem: intel1,
        reputationManager: rep1,
        weatherSystem: weather1,
        heroicActionManager: hero1,
        enemyCommander: enemy1,
        woundedSoldierManager: wounded1,
        journal: journal1
      });
      ext1.evaluateExtraction();
      ext1.executeExtraction(EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT, { doorGunnersActive: true });

      // Save using SaveManager with all systems
      const scene1 = new SceneManager(bus1, {
        scene_lz_extraction_roundtrip: { narrative: 'Final extraction testing scene', choices: [] }
      });

      const saveManager1 = new SaveManager(bus1, scene1, squad1, ledger1, 'masterTestSave', {
        relationshipManager: rel1,
        traitManager: traits1,
        journal: journal1,
        conditionManager: cond1,
        reputationManager: rep1,
        dynamicEventManager: dyn1,
        weatherSystem: weather1,
        radioSystem: radio1,
        intelSystem: intel1,
        enemyCommander: enemy1,
        ambushSystem: new AmbushSystem(bus1, { ledger: ledger1, intelSystem: intel1 }),
        heroicActionManager: hero1,
        tacticalMapManager: map1,
        woundedSoldierManager: wounded1,
        battlefieldRecoverySystem: rec1,
        extractionSystem: ext1
      });

      const savedSnapshot = saveManager1.saveGame('scene_lz_extraction_roundtrip');
      assert.ok(savedSnapshot);
      assert.equal(savedSnapshot.sceneId, 'scene_lz_extraction_roundtrip');

      // Verify all 16 systems populated in saved JSON record
      assert.ok(savedSnapshot.stats);
      assert.ok(savedSnapshot.squad);
      assert.ok(savedSnapshot.relationships);
      assert.ok(savedSnapshot.traits);
      assert.ok(savedSnapshot.conditions);
      assert.ok(savedSnapshot.reputation);
      assert.ok(savedSnapshot.journal);
      assert.ok(savedSnapshot.heroics);
      assert.ok(savedSnapshot.dynamicEvents);
      assert.ok(savedSnapshot.weather);
      assert.ok(savedSnapshot.enemyCommander);
      assert.ok(savedSnapshot.intel);
      assert.ok(savedSnapshot.radio);
      assert.ok(savedSnapshot.tacticalMap);
      assert.ok(savedSnapshot.wounded);
      assert.ok(savedSnapshot.recovery);
      assert.ok(savedSnapshot.extraction);

      // ========================================================================
      // NOW CREATE A FRESH CAMPAIGN INSTANCE AND RESTORE
      // ========================================================================
      const bus2 = new MessageBus();
      const ledger2 = new Ledger(bus2);
      const squad2 = new SquadManager(bus2);
      const rel2 = new RelationshipManager(bus2, null, squad2);
      const traits2 = new TraitManager(bus2, squad2);
      const cond2 = new PsychologicalConditionManager(bus2, squad2);
      const rep2 = new ReputationManager(bus2);
      const journal2 = new Journal(bus2);
      const hero2 = new HeroicActionManager(bus2, { squadManager: squad2 });
      const dyn2 = new DynamicEventManager(bus2);
      const weather2 = new WeatherSystem(bus2);
      const enemy2 = new EnemyCommander(bus2, { ledger: ledger2, squadManager: squad2 });
      const intel2 = new IntelSystem(bus2, ledger2);
      const radio2 = new RadioSystem(bus2, { weatherSystem: weather2 });
      const map2 = new TacticalMapManager(bus2, { intelSystem: intel2, ledger: ledger2 });
      const wounded2 = new WoundedSoldierManager(bus2, { squadManager: squad2, ledger: ledger2 });
      const rec2 = new BattlefieldRecoverySystem(bus2, { ledger: ledger2, squadManager: squad2 });
      const ext2 = new ExtractionSystem(bus2, { squadManager: squad2, ledger: ledger2 });
      const scene2 = new SceneManager(bus2, {
        scene_lz_extraction_roundtrip: { narrative: 'Final extraction testing scene', choices: [] }
      });

      const saveManager2 = new SaveManager(bus2, scene2, squad2, ledger2, 'masterTestSave', {
        relationshipManager: rel2,
        traitManager: traits2,
        journal: journal2,
        conditionManager: cond2,
        reputationManager: rep2,
        dynamicEventManager: dyn2,
        weatherSystem: weather2,
        radioSystem: radio2,
        intelSystem: intel2,
        enemyCommander: enemy2,
        heroicActionManager: hero2,
        tacticalMapManager: map2,
        woundedSoldierManager: wounded2,
        battlefieldRecoverySystem: rec2,
        extractionSystem: ext2
      });

      let gameLoadedEvent = null;
      bus2.subscribe('GAME_LOADED', (payload) => {
        gameLoadedEvent = payload;
      });

      const loadedSnapshot = saveManager2.loadGame();
      assert.ok(loadedSnapshot);
      assert.ok(gameLoadedEvent);

      // Verify exact fidelity across ALL 16 systems:
      // 1. Ledger
      assert.equal(ledger2.getStat('heat'), 52); // 42 + 10 from recover_documents
      assert.ok(ledger2.getStat('intel') >= 75);
      assert.equal(ledger2.getStat('valorPoints'), 3);

      // 2. Squad
      assert.equal(squad2.getSoldiers().length, 9);

      // 3. Relationships
      assert.equal(rel2.getRelationship('miller', 'jenkins').trust, 88);

      // 4. Traits
      assert.ok(traits2.hasTrait('jenkins', 'Eagle Eyed'));

      // 5. Conditions
      assert.ok(cond2.hasCondition('baker', 'Exhausted'));
      assert.ok(cond2.hasCondition('miller', 'Combat Hardened'));

      // 6. Reputation
      assert.equal(rep2.getScores().Protector, 90);
      assert.equal(rep2.getPrimaryReputation(), 'Protector');

      // 7. Journal
      assert.ok(journal2.getEntries().length >= 1);
      assert.ok(journal2.getEntries().some((e) => e.title.includes('Breakthrough on Grid 881')));

      // 8. Heroic Actions
      const restoredMedals = hero2.getMedalsForSoldier('baker');
      assert.ok(restoredMedals.length >= 1);
      assert.equal(restoredMedals[0].medal, 'Distinguished Service Cross');

      // 9. Weather
      assert.equal(weather2.getCurrentWeather().type, WEATHER_TYPES.HEAVY_RAIN);
      assert.equal(weather2.getCurrentWeather().duration, 4);

      // 10. Enemy Commander
      assert.equal(enemy2.currentStrategy, ENEMY_STRATEGIES.HUNT);
      assert.equal(enemy2.aggression, enemy1.aggression);
      assert.ok(enemy2.countermeasures.has('interlocking_crossfire'));

      // 11. Intel
      assert.ok(intel2.getState().discoveries.some((d) => d.type === 'bunker'));

      // 12. Radio
      assert.equal(radio2.getActiveMessages().length, 1);
      assert.equal(radio2.getActiveMessages()[0].channel, RADIO_CHANNELS.MEDEVAC);

      // 13. Tactical Map
      const mapMarkers = map2.getMarkers('HIGH');
      assert.ok(mapMarkers.some((m) => m.label.includes('Heavy MG Nest')));
      assert.equal(map2.getPathHistory().length, 1);

      // 14. Wounded Soldier
      assert.equal(wounded2.getWoundedSoldiers().length, 1);
      assert.equal(wounded2.getCarriedSoldiers().length, 1);
      assert.equal(wounded2.getMobilityModifier(), -25);

      // 15. Battlefield Recovery
      assert.equal(rec2.getRecoveryHistory().length, 1);
      assert.equal(rec2.getRecoveryHistory()[0].optionKey, RECOVERY_OPTIONS.RECOVER_DOCUMENTS);

      // 16. Extraction System
      assert.equal(ext2.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
      assert.equal(ext2.executed, true);
      assert.deepEqual(ext2.decisions, { doorGunnersActive: true });
      assert.ok(ext2.epilogue.length > 50);
      assert.equal(ext2.summary.endingId, EXTRACTION_ARCHETYPES.RUNNING_GUNFIGHT);
    });
  });

  // ============================================================================
  // 6. FULL CROSS-SYSTEM MESSAGEBUS INTEGRATION
  // ============================================================================
  describe('Full Cross-System MessageBus Integration', () => {
    let ledger;
    let squadManager;
    let intelSystem;
    let reputationManager;
    let weatherSystem;
    let heroicActionManager;
    let enemyCommander;
    let mapManager;
    let woundedManager;
    let recoverySystem;
    let extractionSystem;
    let journal;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      squadManager = new SquadManager(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
      reputationManager = new ReputationManager(messageBus);
      weatherSystem = new WeatherSystem(messageBus);
      heroicActionManager = new HeroicActionManager(messageBus, { squadManager });
      enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
      journal = new Journal(messageBus);
      mapManager = new TacticalMapManager(messageBus, { intelSystem, ledger });
      woundedManager = new WoundedSoldierManager(messageBus, { squadManager, ledger });
      recoverySystem = new BattlefieldRecoverySystem(messageBus, { ledger, squadManager, enemyCommander });
      extractionSystem = new ExtractionSystem(messageBus, {
        squadManager,
        ledger,
        intelSystem,
        reputationManager,
        weatherSystem,
        heroicActionManager,
        enemyCommander,
        woundedSoldierManager: woundedManager,
        journal
      });
    });

    it('should coordinate combat trauma, tactical map tracking, heroic rescue, and endgame extraction climax', () => {
      // 1. Squad advances toward LZ X-Ray
      messageBus.publish('SCENE_RENDERED', {
        id: 'scene_lz_perimeter',
        narrative: 'Breaking into the clearing of LZ X-Ray under heavy NVA pressure.',
        mapX: 20,
        mapY: 20,
        isExtraction: true
      });

      // Tactical map tracks breadcrumb
      assert.equal(mapManager.getPathHistory().length, 1);

      // Extraction system automatically evaluates scene
      assert.ok(extractionSystem.calculatedEnding);

      // 2. Heavy incoming mortar fire wounds Kowalski
      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'kowalski',
        name: 'Cpl Kowalski',
        status: 'wounded',
        severity: 'severe'
      });

      assert.equal(woundedManager.getWoundedSoldiers().length, 1);

      // 3. Miller performs a Combat Rescue under fire
      heroicActionManager.triggerHeroicAction('miller', 'Combat Rescue', {
        soldierName: 'SSG Miller',
        targetSoldierName: 'Cpl Kowalski',
        reason: 'Braved heavy mortar shrapnel to drag Kowalski to the extraction marker.'
      });

      const medals = heroicActionManager.getMedalsForSoldier('miller');
      assert.ok(medals.length > 0);
      assert.equal(medals[0].medal, 'Distinguished Service Cross');

      // 4. Commander assigns Jenkins to carry Kowalski
      woundedManager.assignCarrier('kowalski', 'jenkins');
      assert.equal(woundedManager.getMobilityModifier(), -25);

      // 5. Squad reaches the Huey and executes extraction
      messageBus.publish('CHOICE_MADE', {
        id: 'lz_board_huey',
        text: 'Board the hovering Huey under door gunner suppressive fire.',
        extractionDecisions: { doorGunnerSuppression: true }
      });

      assert.equal(extractionSystem.executed, true);
      const summary = extractionSystem.getExtractionSummary();
      assert.ok(summary.epilogue.includes('Miller'));
      assert.ok(summary.survivors.length >= 7);
    });
  });
});
