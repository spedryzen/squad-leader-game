// Squad Leader: Vietnam - Phase 3 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase3.test.js
Purpose: Automated verification suite for Phase 3 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify WeatherSystem weather types, modifier calculations, dynamic transitions, context rolls, and serialization
- Verify RadioSystem 5 traffic channels, message queuing, urgent decision resolution, timeout handling, and weather interference
- Verify IntelSystem 3 qualitative tiers, tactical target revelations, ambush probability modifiers, recon discovery tracking, and serialization
- Verify SaveManager version 3 state persistence for weather, radio, and intelligence
- Verify cross-system MessageBus integration (Weather affecting Radio, Intel affecting combat risk, Radio decisions triggering ledger changes)
Dependencies: node:test, node:assert/strict, MessageBus, Ledger, SquadManager, SaveManager, WeatherSystem, RadioSystem, IntelSystem
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Multi-grid artillery fire direction, forward air controller spotting, and signal intelligence radio interception tests.
--------------------------------------------------
*/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { Ledger } from '../src/state/Ledger.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { SaveManager } from '../src/core/SaveManager.js';
import { WeatherSystem, WEATHER_TYPES, WEATHER_DEFINITIONS } from '../src/systems/WeatherSystem.js';
import { RadioSystem, RADIO_CHANNELS, CHANNEL_METADATA } from '../src/systems/RadioSystem.js';
import { IntelSystem, INTEL_TIERS, INTEL_TIER_DEFINITIONS } from '../src/systems/IntelSystem.js';

describe('Phase 3 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. DYNAMIC WEATHER SYSTEM TESTS
  // ============================================================================
  describe('WeatherSystem', () => {
    let weatherSystem;

    beforeEach(() => {
      weatherSystem = new WeatherSystem(messageBus);
    });

    it('should initialize with Clear weather by default', () => {
      const current = weatherSystem.getCurrentWeather();
      assert.equal(current.type, WEATHER_TYPES.CLEAR);
      assert.equal(current.name, 'Clear');
      assert.ok(current.description.includes('Standard visibility'));
      assert.equal(current.modifiers.stealth, 0);
      assert.equal(current.modifiers.visibility, 0);
      assert.equal(current.modifiers.closeAirSupportAvailable, true);
    });

    it('should provide accurate modifiers for all 6 core weather types', () => {
      // 1. Clear
      weatherSystem.setWeather(WEATHER_TYPES.CLEAR);
      let mods = weatherSystem.getModifiers();
      assert.equal(mods.stealth, 0);
      assert.equal(mods.visibility, 0);
      assert.equal(mods.movementSpeed, 0);
      assert.equal(mods.closeAirSupportAvailable, true);

      // 2. Rain: +stealth (+15%), -visibility (-20%)
      weatherSystem.setWeather(WEATHER_TYPES.RAIN);
      mods = weatherSystem.getModifiers();
      assert.equal(mods.stealth, 15);
      assert.equal(mods.visibility, -20);
      assert.equal(mods.closeAirSupportAvailable, true);

      // 3. Heavy Rain: +stealth (+25%), -artillery/air support accuracy (-30%), -movement speed (-15%)
      weatherSystem.setWeather(WEATHER_TYPES.HEAVY_RAIN);
      mods = weatherSystem.getModifiers();
      assert.equal(mods.stealth, 25);
      assert.equal(mods.artilleryAccuracy, -30);
      assert.equal(mods.airSupportAccuracy, -30);
      assert.equal(mods.movementSpeed, -15);

      // 4. Fog: +ambush chance (+25%), -detection range (-30%)
      weatherSystem.setWeather(WEATHER_TYPES.FOG);
      mods = weatherSystem.getModifiers();
      assert.equal(mods.ambushChance, 25);
      assert.equal(mods.detectionRange, -30);

      // 5. Monsoon: -movement (-25%), -morale over time (-10%), supplies burn (+15%)
      weatherSystem.setWeather(WEATHER_TYPES.MONSOON);
      mods = weatherSystem.getModifiers();
      assert.equal(mods.movementSpeed, -25);
      assert.equal(mods.moraleDrain, -10);
      assert.equal(mods.suppliesBurn, 15);

      // 6. Thunderstorm: grounds close air support, -radio reception (-40%), +noise masking (+30%)
      weatherSystem.setWeather(WEATHER_TYPES.THUNDERSTORM);
      mods = weatherSystem.getModifiers();
      assert.equal(mods.closeAirSupportAvailable, false);
      assert.equal(mods.radioReception, -40);
      assert.equal(mods.noiseMasking, 30);
    });

    it('should publish WEATHER_CHANGED event when weather is updated', () => {
      let publishedEvent = null;
      messageBus.subscribe('WEATHER_CHANGED', (payload) => {
        publishedEvent = payload;
      });

      weatherSystem.setWeather(WEATHER_TYPES.HEAVY_RAIN, 3);

      assert.ok(publishedEvent);
      assert.equal(publishedEvent.type, WEATHER_TYPES.HEAVY_RAIN);
      assert.equal(publishedEvent.previousWeather, WEATHER_TYPES.CLEAR);
      assert.equal(publishedEvent.duration, 3);
      assert.equal(publishedEvent.modifiers.artilleryAccuracy, -30);
      assert.ok(publishedEvent.tacticalSummary);
    });

    it('should roll dynamic weather based on terrain and seasonal context', () => {
      // Roll dry season weather (heavily favors Clear)
      const rolledDry = weatherSystem.rollWeather({ season: 'dry', terrain: 'base' });
      assert.ok(rolledDry);
      assert.ok(Object.values(WEATHER_TYPES).includes(rolledDry.type));

      // Roll monsoon season on ridge
      const rolledMonsoon = weatherSystem.rollWeather({ season: 'monsoon', terrain: 'ridge' });
      assert.ok(rolledMonsoon);
      assert.ok(Object.values(WEATHER_TYPES).includes(rolledMonsoon.type));
    });

    it('should handle SCENE_RENDERED duration decrement and explicit scene overrides', () => {
      // Set weather with 2 scene duration
      weatherSystem.setWeather(WEATHER_TYPES.FOG, 2);
      assert.equal(weatherSystem.getCurrentWeather().duration, 2);

      // Scene 1: decrement duration to 1
      messageBus.publish('SCENE_RENDERED', { id: 'scene_bunker_approach' });
      assert.equal(weatherSystem.getCurrentWeather().duration, 1);
      assert.equal(weatherSystem.getCurrentWeather().type, WEATHER_TYPES.FOG);

      // Explicit scene weather override
      messageBus.publish('SCENE_RENDERED', {
        id: 'scene_storm_ridge',
        weather: 'Thunderstorm',
        weatherDuration: 4
      });
      assert.equal(weatherSystem.getCurrentWeather().type, WEATHER_TYPES.THUNDERSTORM);
      assert.equal(weatherSystem.getCurrentWeather().duration, 4);
    });

    it('should serialize and deserialize weather state cleanly', () => {
      weatherSystem.setWeather(WEATHER_TYPES.MONSOON, 5);

      const serialized = weatherSystem.serialize();
      assert.equal(serialized.currentWeather, WEATHER_TYPES.MONSOON);
      assert.equal(serialized.duration, 5);
      assert.ok(Array.isArray(serialized.history));
      assert.ok(serialized.history.length > 0);

      const restoredSystem = new WeatherSystem(messageBus);
      restoredSystem.deserialize(serialized);

      assert.equal(restoredSystem.getCurrentWeather().type, WEATHER_TYPES.MONSOON);
      assert.equal(restoredSystem.getCurrentWeather().duration, 5);
      assert.equal(restoredSystem.getModifiers().movementSpeed, -25);
    });
  });

  // ============================================================================
  // 2. RADIO COMMUNICATION SYSTEM TESTS
  // ============================================================================
  describe('RadioSystem', () => {
    let radioSystem;
    let weatherSystem;

    beforeEach(() => {
      weatherSystem = new WeatherSystem(messageBus);
      radioSystem = new RadioSystem(messageBus, { weatherSystem });
    });

    it('should recognize all 5 military traffic channels with accurate callsigns and metadata', () => {
      const expectedChannels = [
        RADIO_CHANNELS.HQ,
        RADIO_CHANNELS.FORWARD_OBSERVER,
        RADIO_CHANNELS.MEDEVAC,
        RADIO_CHANNELS.ARTILLERY,
        RADIO_CHANNELS.AIR_SUPPORT
      ];

      for (const ch of expectedChannels) {
        const meta = CHANNEL_METADATA[ch];
        assert.ok(meta, `Metadata missing for channel ${ch}`);
        assert.ok(meta.callsign, `Callsign missing for ${ch}`);
        assert.ok(meta.frequency, `Frequency missing for ${ch}`);
        assert.ok(meta.description, `Description missing for ${ch}`);
      }

      assert.equal(CHANNEL_METADATA[RADIO_CHANNELS.HQ].callsign, 'India Six');
      assert.equal(CHANNEL_METADATA[RADIO_CHANNELS.MEDEVAC].callsign, 'Dustoff');
      assert.equal(CHANNEL_METADATA[RADIO_CHANNELS.ARTILLERY].callsign, 'Battery Alpha');
    });

    it('should transmit outgoing messages and log them to message history', () => {
      let sentEvent = null;
      messageBus.subscribe('RADIO_TRANSMISSION_SENT', (payload) => {
        sentEvent = payload;
      });

      const tx = radioSystem.transmit(RADIO_CHANNELS.ARTILLERY, 'Request fire mission on Grid 881-South', {
        gridCoordinates: 'XD 881-442'
      });

      assert.ok(tx);
      assert.equal(tx.channel, RADIO_CHANNELS.ARTILLERY);
      assert.equal(tx.callsign, 'Battery Alpha');
      assert.equal(tx.gridCoordinates, 'XD 881-442');
      assert.equal(tx.status, 'transmitted');

      assert.ok(sentEvent);
      assert.equal(sentEvent.id, tx.id);

      const history = radioSystem.getMessageHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].id, tx.id);
    });

    it('should receive incoming urgent messages, queue choices, and publish RADIO_MESSAGE_RECEIVED', () => {
      let receivedEvent = null;
      messageBus.subscribe('RADIO_MESSAGE_RECEIVED', (payload) => {
        receivedEvent = payload;
      });

      const msg = radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.MEDEVAC,
        sender: 'Dustoff Three',
        text: 'Approaching LZ. Treeline taking heavy small arms fire. Confirm LZ hot or cold?',
        urgent: true,
        lifetime: 2,
        choices: [
          { key: 'confirm_hot', text: 'Mark LZ HOT: Deploy yellow smoke and suppress treeline' },
          { key: 'wave_off', text: 'Wave off Dustoff: RPG threat too severe' }
        ]
      });

      assert.ok(msg);
      assert.equal(msg.urgent, true);
      assert.equal(msg.status, 'pending');
      assert.equal(msg.remainingLifetime, 2);
      assert.equal(msg.choices.length, 2);

      assert.ok(receivedEvent);
      assert.equal(receivedEvent.id, msg.id);

      const active = radioSystem.getActiveMessages();
      assert.equal(active.length, 1);
      assert.equal(active[0].id, msg.id);
    });

    it('should resolve urgent radio decisions, dispatch side-effects, and publish RADIO_DECISION', () => {
      let decisionEvent = null;
      let statChangeEvent = null;

      messageBus.subscribe('RADIO_DECISION', (payload) => {
        decisionEvent = payload;
      });

      messageBus.subscribe('STAT_CHANGED', (payload) => {
        if (payload.stat === 'supplies') {
          statChangeEvent = payload;
        }
      });

      const incoming = radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.HQ,
        text: 'India Six requesting immediate supply drop coordinates.',
        urgent: true,
        choices: [
          {
            key: 'drop_hill_crest',
            text: 'Drop ammo pallets on northern hill crest',
            effects: { supplies: 30 }
          },
          {
            key: 'cancel_drop',
            text: 'Cancel drop; hostile anti-aircraft guns active'
          }
        ]
      });

      const resolution = radioSystem.makeDecision(incoming.id, 'drop_hill_crest');
      assert.equal(resolution.success, true);
      assert.equal(resolution.choice.key, 'drop_hill_crest');

      // Verify active messages cleared
      assert.equal(radioSystem.getActiveMessages().length, 0);

      // Verify events published
      assert.ok(decisionEvent);
      assert.equal(decisionEvent.messageId, incoming.id);
      assert.equal(decisionEvent.decisionKey, 'drop_hill_crest');

      assert.ok(statChangeEvent);
      assert.equal(statChangeEvent.stat, 'supplies');
      assert.equal(statChangeEvent.delta, 30);
    });

    it('should trigger RADIO_TIMEOUT when message lifetime expires across scenes', () => {
      let timeoutEvent = null;
      messageBus.subscribe('RADIO_TIMEOUT', (payload) => {
        timeoutEvent = payload;
      });

      const msg = radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.AIR_SUPPORT,
        text: 'Phantom lead inbound. 30 seconds to target. Confirm strike coordinates!',
        urgent: true,
        lifetime: 1,
        choices: [
          { key: 'cleared_hot', text: 'Cleared hot on southern ridge' }
        ]
      });

      assert.equal(radioSystem.getActiveMessages().length, 1);

      // Scene transition occurs before player resolves radio decision
      messageBus.publish('SCENE_RENDERED', { id: 'scene_next_ridge' });

      // Response window expired: active message removed, timeout emitted
      assert.equal(radioSystem.getActiveMessages().length, 0);
      assert.ok(timeoutEvent);
      assert.equal(timeoutEvent.messageId, msg.id);
      assert.equal(timeoutEvent.channel, RADIO_CHANNELS.AIR_SUPPORT);
    });

    it('should degrade radio reception during Thunderstorms per weather specifications', () => {
      // Base reception is 100%
      assert.equal(radioSystem.getReceptionQuality(), 100);

      // Thunderstorm rolls in: -40% radio reception
      weatherSystem.setWeather(WEATHER_TYPES.THUNDERSTORM);

      assert.equal(radioSystem.getReceptionQuality(), 60);

      // Transmitting during storm marks noisy signal
      const tx = radioSystem.transmit(RADIO_CHANNELS.HQ, 'Testing radio check in storm');
      assert.equal(tx.receptionQuality, 60);
      assert.equal(tx.status, 'noisy_transmission');

      // Incoming message displays static crackle
      const rx = radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.FORWARD_OBSERVER,
        text: 'Spotting round impact 200 meters long.'
      });
      assert.ok(rx.text.includes('[STATIC CRACKLE - RECEPTION 60%]'));

      // Revert to Clear: reception restored to 100%
      weatherSystem.setWeather(WEATHER_TYPES.CLEAR);
      assert.equal(radioSystem.getReceptionQuality(), 100);
    });

    it('should serialize and deserialize active messages, history, and reception state', () => {
      radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.HQ,
        text: 'Hold current bunker perimeter.',
        urgent: true,
        choices: [{ key: 'roger', text: 'Roger India Six' }]
      });
      radioSystem.transmit(RADIO_CHANNELS.MEDEVAC, 'Dustoff LZ marked with violet smoke');

      const serialized = radioSystem.serialize();
      assert.equal(serialized.activeMessages.length, 1);
      assert.equal(serialized.history.length, 2);

      const restoredSystem = new RadioSystem(messageBus);
      restoredSystem.deserialize(serialized);

      assert.equal(restoredSystem.getActiveMessages().length, 1);
      assert.equal(restoredSystem.getMessageHistory().length, 2);
    });
  });

  // ============================================================================
  // 3. INTELLIGENCE EXPANSION SYSTEM TESTS
  // ============================================================================
  describe('IntelSystem', () => {
    let ledger;
    let intelSystem;

    beforeEach(() => {
      ledger = new Ledger(messageBus);
      intelSystem = new IntelSystem(messageBus, ledger);
    });

    it('should evaluate tiers and descriptions accurately based on Ledger intel score', () => {
      // 1. LOW Tier (0 - 24)
      ledger.setStat('intel', 15);
      assert.equal(intelSystem.getIntelTier(), INTEL_TIERS.LOW);
      const lowQuality = intelSystem.getIntelQuality();
      assert.equal(lowQuality.tier, INTEL_TIERS.LOW);
      assert.equal(lowQuality.description, 'Enemy activity suspected. Unconfirmed signals in sector.');
      assert.equal(lowQuality.clarityPercentage, 20);
      assert.equal(lowQuality.ambushModifier, 0);

      // 2. MEDIUM Tier (25 - 59)
      ledger.setStat('intel', 40);
      assert.equal(intelSystem.getIntelTier(), INTEL_TIERS.MEDIUM);
      const medQuality = intelSystem.getIntelQuality();
      assert.equal(medQuality.tier, INTEL_TIERS.MEDIUM);
      assert.equal(medQuality.description, 'Likely platoon-sized force (20-30 NVA). Patrol routes identified.');
      assert.equal(medQuality.clarityPercentage, 60);
      assert.equal(medQuality.ambushModifier, -15);

      // 3. HIGH Tier (60+)
      ledger.setStat('intel', 75);
      assert.equal(intelSystem.getIntelTier(), INTEL_TIERS.HIGH);
      const highQuality = intelSystem.getIntelQuality();
      assert.equal(highQuality.tier, INTEL_TIERS.HIGH);
      assert.equal(highQuality.description, '12-15 enemy. 2 RPG teams. Fortified spider holes and minefield on eastern ridge confirmed.');
      assert.equal(highQuality.clarityPercentage, 95);
      assert.equal(highQuality.ambushModifier, -35);
    });

    it('should publish INTEL_LEVEL_CHANGED when crossing tier thresholds via STAT_CHANGED', () => {
      let tierChangeEvent = null;
      messageBus.subscribe('INTEL_LEVEL_CHANGED', (payload) => {
        tierChangeEvent = payload;
      });

      // Start at 10 (LOW)
      ledger.setStat('intel', 10);
      assert.equal(intelSystem.getIntelTier(), INTEL_TIERS.LOW);

      // Increase to 30 (Crosses threshold to MEDIUM)
      messageBus.publish('STAT_CHANGED', { stat: 'intel', value: 30 });

      assert.ok(tierChangeEvent);
      assert.equal(tierChangeEvent.previousTier, INTEL_TIERS.LOW);
      assert.equal(tierChangeEvent.newTier, INTEL_TIERS.MEDIUM);
      assert.equal(tierChangeEvent.intelScore, 30);
      assert.ok(tierChangeEvent.tierDescription.includes('Likely platoon-sized force'));

      // Increase to 65 (Crosses threshold to HIGH)
      tierChangeEvent = null;
      messageBus.publish('STAT_CHANGED', { stat: 'intel', value: 65 });

      assert.ok(tierChangeEvent);
      assert.equal(tierChangeEvent.previousTier, INTEL_TIERS.MEDIUM);
      assert.equal(tierChangeEvent.newTier, INTEL_TIERS.HIGH);
      assert.equal(tierChangeEvent.intelScore, 65);
    });

    it('should provide qualitative tactical revelations when assessing targets across tiers', () => {
      // 1. Target assessment under LOW intel
      ledger.setStat('intel', 10);
      const lowTarget = intelSystem.assessTarget('eastern_ridge', { name: 'Eastern Ridge Bunker Complex', ambushChance: 50 });
      assert.equal(lowTarget.intelTier, INTEL_TIERS.LOW);
      assert.equal(lowTarget.ambushModifierApplied, 0);
      assert.equal(lowTarget.ambushLikelihood, 50);
      assert.ok(lowTarget.enemyCounts.includes('Unknown'));
      assert.ok(lowTarget.fortifiedBunkers.includes('unconfirmed'));

      // 2. Target assessment under HIGH intel
      ledger.setStat('intel', 70);
      const highTarget = intelSystem.assessTarget('eastern_ridge', { name: 'Eastern Ridge Bunker Complex', ambushChance: 50 });
      assert.equal(highTarget.intelTier, INTEL_TIERS.HIGH);
      assert.equal(highTarget.ambushModifierApplied, -35);
      assert.equal(highTarget.ambushLikelihood, 15); // 50 - 35 = 15%
      assert.ok(highTarget.enemyCounts.includes('12-15 enemy'));
      assert.ok(highTarget.fortifiedBunkers.includes('Fortified spider holes'));
      assert.ok(highTarget.weaponEmplacements.includes('RPG-7'));
    });

    it('should record recon discoveries, prevent duplicates, and publish INTEL_RECON_ACQUIRED', () => {
      let reconEvent = null;
      messageBus.subscribe('INTEL_RECON_ACQUIRED', (payload) => {
        reconEvent = payload;
      });

      const firstLogged = intelSystem.recordReconDiscovery({
        type: 'bunker',
        targetKey: 'eastern_ridge',
        description: 'Camouflaged machine gun bunker covered with teak logs',
        intelBonus: 10
      });

      assert.equal(firstLogged, true);
      assert.ok(reconEvent);
      assert.equal(reconEvent.discovery.type, 'bunker');
      assert.equal(reconEvent.discovery.targetKey, 'eastern_ridge');

      // Duplicate attempt should return false
      const duplicateLogged = intelSystem.recordReconDiscovery({
        type: 'bunker',
        targetKey: 'eastern_ridge',
        description: 'Camouflaged machine gun bunker covered with teak logs'
      });

      assert.equal(duplicateLogged, false);
      assert.equal(intelSystem.getReconDiscoveries().length, 1);

      // Target assessment incorporates recon discovery
      const assessed = intelSystem.assessTarget('eastern_ridge');
      assert.equal(assessed.fortifiedBunkers, 'Camouflaged machine gun bunker covered with teak logs');
    });

    it('should serialize and deserialize intelligence state accurately', () => {
      ledger.setStat('intel', 45);
      intelSystem.recordReconDiscovery({
        type: 'trail',
        targetKey: 'creek_bed',
        description: 'Concealed foot trail with bamboo punji markers'
      });

      const serialized = intelSystem.serialize();
      assert.equal(serialized.currentTier, INTEL_TIERS.MEDIUM);
      assert.equal(serialized.discoveries.length, 1);

      const restoredSystem = new IntelSystem(messageBus, ledger);
      restoredSystem.deserialize(serialized);

      assert.equal(restoredSystem.getIntelTier(), INTEL_TIERS.MEDIUM);
      assert.equal(restoredSystem.getReconDiscoveries().length, 1);
      assert.equal(restoredSystem.getReconDiscoveries()[0].targetKey, 'creek_bed');
    });
  });

  // ============================================================================
  // 4. SAVEMANAGER INTEGRATION & PERSISTENCE
  // ============================================================================
  describe('SaveManager Phase 3 Persistence', () => {
    let squad;
    let ledger;
    let weatherSystem;
    let radioSystem;
    let intelSystem;
    let saveManager;

    beforeEach(() => {
      squad = new SquadManager(messageBus);
      ledger = new Ledger(messageBus);
      weatherSystem = new WeatherSystem(messageBus);
      radioSystem = new RadioSystem(messageBus, { weatherSystem });
      intelSystem = new IntelSystem(messageBus, ledger);

      saveManager = new SaveManager(
        messageBus,
        null,
        squad,
        ledger,
        'squadLeaderSaveTestP3',
        {
          weatherSystem,
          radioSystem,
          intelSystem
        }
      );
    });

    it('should serialize version 3 save with weather, active radio messages/history, and intel state', () => {
      weatherSystem.setWeather(WEATHER_TYPES.THUNDERSTORM, 4);
      radioSystem.receiveMessage({
        channel: RADIO_CHANNELS.ARTILLERY,
        text: 'Battery Alpha waiting on spotting coordinates.',
        urgent: true,
        choices: [{ key: 'fire', text: 'Fire for effect' }]
      });
      intelSystem.recordReconDiscovery({
        type: 'minefield',
        targetKey: 'ridge_east',
        description: 'Toe-popper minefield mapped along treeline'
      });

      const saveData = saveManager.saveGame('scene_hill881_radio_bunker');
      assert.ok(saveData);
      assert.equal(saveData.version, 3);
      assert.equal(saveData.sceneId, 'scene_hill881_radio_bunker');

      // Verify weather serialized
      assert.ok(saveData.weather);
      assert.equal(saveData.weather.currentWeather, WEATHER_TYPES.THUNDERSTORM);
      assert.equal(saveData.weather.duration, 4);

      // Verify radio serialized
      assert.ok(saveData.radio);
      assert.equal(saveData.radio.activeMessages.length, 1);
      assert.equal(saveData.radio.activeMessages[0].channel, RADIO_CHANNELS.ARTILLERY);

      // Verify intel serialized
      assert.ok(saveData.intel);
      assert.equal(saveData.intel.discoveries.length, 1);
      assert.equal(saveData.intel.discoveries[0].type, 'minefield');
    });

    it('should restore weather, radio, and intel state upon loadGame()', () => {
      const mockSaveData = {
        version: 3,
        sceneId: 'scene_lz_extraction',
        stats: { heat: 35, intel: 65, supplies: 70 },
        squad: [],
        weather: {
          currentWeather: WEATHER_TYPES.HEAVY_RAIN,
          duration: 3,
          history: []
        },
        radio: {
          activeMessages: [
            {
              id: 'msg_test_dustoff',
              direction: 'incoming',
              channel: RADIO_CHANNELS.MEDEVAC,
              callsign: 'Dustoff',
              sender: 'Dustoff',
              text: 'Inbound LZ. 60 seconds.',
              urgent: true,
              choices: [{ key: 'pop_smoke', text: 'Pop smoke' }],
              lifetime: 2,
              remainingLifetime: 2,
              status: 'pending'
            }
          ],
          history: [],
          baseReception: 100,
          receptionModifier: -10
        },
        intel: {
          currentTier: INTEL_TIERS.HIGH,
          discoveries: [
            {
              id: 'recon_01',
              type: 'tunnel',
              targetKey: 'hill_base',
              description: 'Subterranean tunnel entrance behind bamboo clump'
            }
          ]
        }
      };

      saveManager.getSaveData = () => mockSaveData;
      saveManager.loadGame();

      // Verify restored weather
      assert.equal(weatherSystem.getCurrentWeather().type, WEATHER_TYPES.HEAVY_RAIN);
      assert.equal(weatherSystem.getCurrentWeather().duration, 3);

      // Verify restored radio
      assert.equal(radioSystem.getActiveMessages().length, 1);
      assert.equal(radioSystem.getActiveMessages()[0].id, 'msg_test_dustoff');

      // Verify restored intel
      assert.equal(intelSystem.getIntelTier(), INTEL_TIERS.HIGH);
      assert.equal(intelSystem.getReconDiscoveries().length, 1);
      assert.equal(intelSystem.getReconDiscoveries()[0].type, 'tunnel');
    });
  });

  // ============================================================================
  // 5. CROSS-SYSTEM MESSAGEBUS INTEGRATION
  // ============================================================================
  describe('Full Cross-System MessageBus Integration', () => {
    it('should orchestrate Weather, Radio, Intel, Ledger, and Squad systems simultaneously', () => {
      const ledger = new Ledger(messageBus);
      const squad = new SquadManager(messageBus);
      const weather = new WeatherSystem(messageBus);
      const radio = new RadioSystem(messageBus, { weatherSystem: weather });
      const intel = new IntelSystem(messageBus, ledger);

      // 1. Initial conditions: Clear weather, 100% radio signal, Low Intel
      assert.equal(weather.getCurrentWeather().type, WEATHER_TYPES.CLEAR);
      assert.equal(radio.getReceptionQuality(), 100);
      assert.equal(intel.getIntelTier(), INTEL_TIERS.LOW);

      // 2. Severe Thunderstorm rolls across Khe Sanh
      weather.setWeather(WEATHER_TYPES.THUNDERSTORM, 3);
      assert.equal(weather.getModifiers().closeAirSupportAvailable, false);
      assert.equal(radio.getReceptionQuality(), 60); // Reduced by 40%

      // 3. Radio reception handles storm interference
      const urgentCall = radio.receiveMessage({
        channel: RADIO_CHANNELS.HQ,
        text: 'Heavy enemy movement spotted near southern perimeter.',
        urgent: true,
        choices: [
          {
            key: 'scout_creek',
            text: 'Dispatch recon scout down the creek',
            reconDiscovery: {
              type: 'trail',
              targetKey: 'southern_creek',
              description: 'Footprints and severed comm wire along creek bed',
              intelBonus: 30
            }
          }
        ]
      });

      assert.ok(urgentCall.text.includes('[STATIC CRACKLE'));

      // 4. Command executes decision to scout creek
      radio.makeDecision(urgentCall.id, 'scout_creek');

      // 5. Recon discovery awards 30 intel to ledger -> crossing from LOW to MEDIUM
      assert.equal(ledger.getStat('intel'), 30);
      assert.equal(intel.getIntelTier(), INTEL_TIERS.MEDIUM);
      assert.equal(intel.getReconDiscoveries().length, 1);

      // 6. Ambush risk assessed with new intelligence
      const targetAssessment = intel.assessTarget('southern_creek', { ambushChance: 50 });
      assert.equal(targetAssessment.intelTier, INTEL_TIERS.MEDIUM);
      assert.equal(targetAssessment.ambushLikelihood, 35); // 50 - 15 = 35%
    });
  });
});
