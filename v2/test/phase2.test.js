// Squad Leader: Vietnam - Phase 2 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase2.test.js
Purpose: Automated verification suite for Phase 2 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify PsychologicalConditionManager condition definitions, assignment, duplicate prevention, entity sync, evaluations, and serialization
- Verify ReputationManager archetype score tracking, primary calculation, choice evaluation, perk unlocks, and serialization
- Verify DynamicEventManager 9 procedural events, triggering, resolution, probability evaluation, history, and serialization
- Verify SaveManager version 3 serialization/deserialization across all Phase 1 & Phase 2 systems
- Verify full end-to-end event choreography and cross-system MessageBus integration
Dependencies: node:test, node:assert/strict, MessageBus, Soldier, SquadManager, Ledger, SaveManager, SceneManager, RelationshipManager, PsychologicalConditionManager, ReputationManager, DynamicEventManager
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Will be expanded in Phase 3 for tactical AI, ballistics resolution, and procedural campaign generator.
--------------------------------------------------
*/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { Soldier } from '../src/entities/Soldier.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { Ledger } from '../src/state/Ledger.js';
import { SaveManager } from '../src/core/SaveManager.js';
import { SceneManager } from '../src/core/SceneManager.js';
import { RelationshipManager } from '../src/systems/RelationshipManager.js';
import { TraitManager } from '../src/systems/TraitManager.js';
import { Journal } from '../src/systems/Journal.js';
import { PsychologicalConditionManager, PSYCHOLOGICAL_CONDITIONS } from '../src/systems/PsychologicalConditionManager.js';
import { ReputationManager, REPUTATION_ARCHETYPES } from '../src/systems/ReputationManager.js';
import { DynamicEventManager, DYNAMIC_EVENTS } from '../src/systems/DynamicEventManager.js';

describe('Phase 2 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. PSYCHOLOGICAL CONDITIONS SYSTEM TESTS
  // ============================================================================
  describe('PsychologicalConditionManager', () => {
    let squad;
    let conditionManager;

    beforeEach(() => {
      squad = new SquadManager(messageBus);
      conditionManager = new PsychologicalConditionManager(messageBus, squad);
    });

    it('should provide complete catalog definitions for all 6 core psychological conditions', () => {
      const required = [
        'Exhausted',
        'Hypervigilant',
        "Survivor's Guilt",
        'Traumatized',
        'Combat Hardened',
        'Blooded Veteran'
      ];

      for (const name of required) {
        const def = conditionManager.getConditionDefinition(name);
        assert.ok(def, `Condition definition missing for ${name}`);
        assert.equal(def.name, name);
        assert.ok(def.description, `Description missing for ${name}`);
        assert.ok(def.gameplayEffect, `Gameplay effect missing for ${name}`);
        assert.ok(def.statModifiers, `Stat modifiers missing for ${name}`);
      }
    });

    it('should assign condition, synchronize with Soldier entity, and publish CONDITION_GAINED', () => {
      let publishedEvent = null;
      messageBus.subscribe('CONDITION_GAINED', (payload) => {
        publishedEvent = payload;
      });

      const added = conditionManager.addCondition('jenkins', 'Traumatized', 'Concussive mortar blast');
      assert.equal(added, true);
      assert.equal(conditionManager.hasCondition('jenkins', 'Traumatized'), true);

      // Verify synchronization with Soldier domain entity
      const jenkins = squad.getSoldierById('jenkins');
      assert.ok(jenkins);
      assert.equal(jenkins.hasCondition('Traumatized'), true);
      assert.ok(jenkins.getConditions().includes('Traumatized'));

      // Verify event broadcast
      assert.ok(publishedEvent);
      assert.equal(publishedEvent.soldierId, 'jenkins');
      assert.equal(publishedEvent.condition, 'Traumatized');
      assert.equal(publishedEvent.reason, 'Concussive mortar blast');
    });

    it('should prevent duplicate condition assignments to the same soldier', () => {
      const first = conditionManager.addCondition('miller', 'Exhausted', 'Forced jungle march');
      assert.equal(first, true);

      const duplicate = conditionManager.addCondition('miller', 'Exhausted', 'Second march');
      assert.equal(duplicate, false);

      const list = conditionManager.getConditionsFor('miller');
      assert.equal(list.filter(c => c === 'Exhausted').length, 1);
    });

    it('should remove condition, synchronize with Soldier entity, and publish CONDITION_REMOVED', () => {
      conditionManager.addCondition('brady', 'Hypervigilant', 'Night ambush tension');
      assert.equal(conditionManager.hasCondition('brady', 'Hypervigilant'), true);

      let removedEvent = null;
      messageBus.subscribe('CONDITION_REMOVED', (payload) => {
        removedEvent = payload;
      });

      const removed = conditionManager.removeCondition('brady', 'Hypervigilant', 'Rest and recuperation');
      assert.equal(removed, true);
      assert.equal(conditionManager.hasCondition('brady', 'Hypervigilant'), false);

      const brady = squad.getSoldierById('brady');
      assert.equal(brady.hasCondition('Hypervigilant'), false);

      assert.ok(removedEvent);
      assert.equal(removedEvent.soldierId, 'brady');
      assert.equal(removedEvent.condition, 'Hypervigilant');
    });

    it('should evaluate and trigger conditions based on gameplay events and triggers', () => {
      // 1. Direct fatigue trigger -> Exhausted
      const eval1 = conditionManager.evaluateConditions({ soldierId: 'kowalski', trigger: 'fatigue' });
      assert.equal(eval1.length, 1);
      assert.equal(eval1[0].condition, 'Exhausted');
      assert.equal(conditionManager.hasCondition('kowalski', 'Exhausted'), true);

      // 2. High stress with low morale soldier -> Traumatized
      const jenkins = squad.getSoldierById('jenkins');
      jenkins.adjustMorale(-75); // Morale < 40
      const eval2 = conditionManager.evaluateConditions({ event: 'STAT_CHANGED', stat: 'stress', value: 75 });
      assert.ok(eval2.some(c => c.soldierId === 'jenkins' && c.condition === 'Traumatized'));

      // 3. Heroic action -> Blooded Veteran
      const eval3 = conditionManager.evaluateConditions({
        event: 'HEROIC_ACTION',
        soldierId: 'miller',
        action: 'Single-handedly charged an enemy bunker'
      });
      assert.ok(eval3.some(c => c.soldierId === 'miller' && c.condition === 'Blooded Veteran'));
      assert.equal(conditionManager.hasCondition('miller', 'Blooded Veteran'), true);
    });

    it('should automatically assign Survivor\'s Guilt when FRIEND_KIA is published', () => {
      // Setup friendship between Brady and Duke
      messageBus.publish('FRIEND_KIA', {
        affectedSoldierId: 'brady',
        fallenSoldierId: 'duke',
        fallenName: 'Duke'
      });

      assert.equal(conditionManager.hasCondition('brady', "Survivor's Guilt"), true);
      const brady = squad.getSoldierById('brady');
      assert.equal(brady.hasCondition("Survivor's Guilt"), true);
    });

    it('should serialize and deserialize psychological conditions cleanly', () => {
      conditionManager.addCondition('miller', 'Combat Hardened', 'Seasoned veteran');
      conditionManager.addCondition('baker', 'Hypervigilant', 'Medic on high alert');

      const serialized = conditionManager.serialize();
      assert.ok(serialized.miller);
      assert.ok(serialized.baker);

      // Create new manager and deserialize
      const newManager = new PsychologicalConditionManager(messageBus, squad);
      newManager.deserialize(serialized);

      assert.equal(newManager.hasCondition('miller', 'Combat Hardened'), true);
      assert.equal(newManager.hasCondition('baker', 'Hypervigilant'), true);
      assert.equal(newManager.hasCondition('jenkins', 'Combat Hardened'), false);
    });
  });

  // ============================================================================
  // 2. COMMAND REPUTATION SYSTEM TESTS
  // ============================================================================
  describe('ReputationManager', () => {
    let reputationManager;

    beforeEach(() => {
      reputationManager = new ReputationManager(messageBus);
    });

    it('should track scores for all 6 archetypes clamped between 0 and 100', () => {
      const initial = reputationManager.getScores();
      assert.deepEqual(Object.keys(initial), [
        'Aggressive',
        'Reliable',
        'Tactical',
        'Protector',
        'Ruthless',
        'Jungle Ghost'
      ]);

      // Modify within limits
      reputationManager.modifyReputation('Aggressive', 50);
      assert.equal(reputationManager.getScore('Aggressive'), 50);

      // Clamp at 100
      reputationManager.modifyReputation('Aggressive', 80);
      assert.equal(reputationManager.getScore('Aggressive'), 100);

      // Clamp at 0
      reputationManager.modifyReputation('Aggressive', -150);
      assert.equal(reputationManager.getScore('Aggressive'), 0);
    });

    it('should dynamically calculate the primaryReputation archetype', () => {
      // Default baseline
      assert.equal(reputationManager.getPrimaryReputation(), 'Reliable');

      // Tactical becomes highest
      reputationManager.modifyReputation('Tactical', 30);
      assert.equal(reputationManager.getPrimaryReputation(), 'Tactical');

      // Protector surpasses Tactical
      reputationManager.modifyReputation('Protector', 45);
      assert.equal(reputationManager.getPrimaryReputation(), 'Protector');

      // Ruthless surpasses Protector
      reputationManager.modifyReputation('Ruthless', 60);
      assert.equal(reputationManager.getPrimaryReputation(), 'Ruthless');
    });

    it('should retrieve active perks for primary reputation and threshold archetypes', () => {
      reputationManager.modifyReputation('Jungle Ghost', 50);

      const perks = reputationManager.getPerks();
      assert.ok(Array.isArray(perks));
      assert.ok(perks.length > 0);

      const ghostPerk = perks.find(p => p.archetype === 'Jungle Ghost');
      assert.ok(ghostPerk);
      assert.equal(ghostPerk.isPrimary, true);
      assert.ok(ghostPerk.perk.includes('Ambush') || ghostPerk.perk.includes('ambush'));
    });

    it('should evaluate tactical choices by keywords and reputation tags', () => {
      // 1. Explicit reputation payload
      const applied1 = reputationManager.evaluateChoice({
        text: 'Deploy air strikes',
        reputation: { Aggressive: 20 }
      });
      assert.equal(applied1.length, 1);
      assert.equal(reputationManager.getScore('Aggressive'), 20);

      // 2. Keyword parsing: "flank" -> Tactical
      const applied2 = reputationManager.evaluateChoice({
        text: 'Order Jenkins to flank the enemy position along the creek'
      });
      assert.ok(applied2.some(a => a.type === 'Tactical'));
      assert.equal(reputationManager.getScore('Tactical'), 10);

      // 3. Keyword parsing: "medic" & "rescue" -> Protector
      const applied3 = reputationManager.evaluateChoice({
        text: 'Send Doc Baker to rescue and bandage the wounded scout'
      });
      assert.ok(applied3.some(a => a.type === 'Protector'));
      assert.equal(reputationManager.getScore('Protector'), 10);

      // 4. Keyword parsing: "stealth" -> Jungle Ghost
      const applied4 = reputationManager.evaluateChoice({
        text: 'Crawl through the tall grass in complete silence to bypass the patrol'
      });
      assert.ok(applied4.some(a => a.type === 'Jungle Ghost'));
      assert.equal(reputationManager.getScore('Jungle Ghost'), 10);
    });

    it('should broadcast REPUTATION_CHANGED when scores or primary doctrine change', () => {
      let publishedEvent = null;
      messageBus.subscribe('REPUTATION_CHANGED', (payload) => {
        publishedEvent = payload;
      });

      reputationManager.modifyReputation('Aggressive', 25);

      assert.ok(publishedEvent);
      assert.equal(publishedEvent.type, 'Aggressive');
      assert.equal(publishedEvent.delta, 25);
      assert.equal(publishedEvent.newScore, 25);
      assert.equal(publishedEvent.primaryReputation, 'Aggressive');
      assert.ok(publishedEvent.scores);
    });

    it('should serialize and deserialize reputation state accurately', () => {
      reputationManager.modifyReputation('Tactical', 45);
      reputationManager.modifyReputation('Protector', 30);

      const serialized = reputationManager.serialize();
      assert.equal(serialized.scores.Tactical, 45);
      assert.equal(serialized.scores.Protector, 30);
      assert.equal(serialized.primaryReputation, 'Tactical');

      const restoredManager = new ReputationManager(messageBus);
      restoredManager.deserialize(serialized);

      assert.equal(restoredManager.getScore('Tactical'), 45);
      assert.equal(restoredManager.getScore('Protector'), 30);
      assert.equal(restoredManager.getPrimaryReputation(), 'Tactical');
    });
  });

  // ============================================================================
  // 3. RANDOM DYNAMIC EVENTS SYSTEM TESTS
  // ============================================================================
  describe('DynamicEventManager', () => {
    let dynamicManager;

    beforeEach(() => {
      dynamicManager = new DynamicEventManager(messageBus);
    });

    it('should contain all 9 procedural battlefield events in its catalog', () => {
      const requiredEvents = [
        'Friendly Patrol',
        'Sniper Attack',
        'Ammo Cache',
        'Lost Recon Team',
        'Captured Courier',
        'Helicopter Support',
        'Booby Trap',
        'Vehicle Breakdown',
        'Enemy Defector'
      ];

      for (const name of requiredEvents) {
        const def = dynamicManager.getEventDefinition(name);
        assert.ok(def, `Dynamic event catalog missing "${name}"`);
        assert.ok(def.id, `ID missing for "${name}"`);
        assert.ok(def.outcomes, `Outcomes missing for "${name}"`);
        assert.ok(Object.keys(def.outcomes).length >= 2, `Expected multiple outcomes for "${name}"`);
      }
    });

    it('should trigger dynamic event and broadcast DYNAMIC_EVENT_TRIGGERED', () => {
      let triggeredPayload = null;
      messageBus.subscribe('DYNAMIC_EVENT_TRIGGERED', (payload) => {
        triggeredPayload = payload;
      });

      const active = dynamicManager.triggerEvent('Sniper Attack', { location: 'Canopy Ridge' });
      assert.ok(active);
      assert.equal(active.name, 'Sniper Attack');
      assert.equal(dynamicManager.getActiveEvent(), active);

      assert.ok(triggeredPayload);
      assert.equal(triggeredPayload.name, 'Sniper Attack');
      assert.equal(triggeredPayload.context.location, 'Canopy Ridge');
    });

    it('should resolve dynamic event with selected outcome and dispatch consequences', () => {
      dynamicManager.triggerEvent('Friendly Patrol');

      let resolvedPayload = null;
      let statChangePayload = null;

      messageBus.subscribe('DYNAMIC_EVENT_RESOLVED', (payload) => {
        resolvedPayload = payload;
      });

      messageBus.subscribe('STAT_CHANGED', (payload) => {
        if (payload.stat === 'supplies') {
          statChangePayload = payload;
        }
      });

      const resolution = dynamicManager.resolveEvent('Friendly Patrol', 'trade_supplies');
      assert.ok(resolution);
      assert.equal(resolution.outcomeKey, 'trade_supplies');
      assert.equal(resolution.effects.supplies, 20);

      // Verify active event cleared
      assert.equal(dynamicManager.getActiveEvent(), null);

      // Verify history recorded
      const history = dynamicManager.getEventHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].name, 'Friendly Patrol');

      // Verify published events
      assert.ok(resolvedPayload);
      assert.equal(resolvedPayload.name, 'Friendly Patrol');
      assert.ok(statChangePayload);
      assert.equal(statChangePayload.stat, 'supplies');
      assert.equal(statChangePayload.delta, 20);
    });

    it('should evaluate battlefield criteria during checkDynamicEventTrigger', () => {
      // Force trigger probability to 1.0 for deterministic verification
      const deterministicManager = new DynamicEventManager(messageBus, { triggerProbability: 1.0 });

      // High heat (75) -> Eligible for hostile events like sniper_attack, booby_trap
      const triggeredHighHeat = deterministicManager.checkDynamicEventTrigger({ scene: 'bunker' }, 75, 10);
      assert.ok(triggeredHighHeat, 'Expected eligible event for high heat');

      // High intel (40) -> Eligible for intel events like captured_courier or enemy_defector
      const triggeredIntel = deterministicManager.checkDynamicEventTrigger({ scene: 'trail' }, 30, 40);
      assert.ok(triggeredIntel, 'Expected eligible event for high intel');
    });

    it('should serialize and deserialize dynamic event manager history and active states', () => {
      dynamicManager.triggerEvent('Ammo Cache', { location: 'Bunker 4' });
      dynamicManager.resolveEvent('Ammo Cache', 'secure_cache');

      const serialized = dynamicManager.serialize();
      assert.ok(serialized.history);
      assert.equal(serialized.history.length, 1);

      const restoredManager = new DynamicEventManager(messageBus);
      restoredManager.deserialize(serialized);

      assert.equal(restoredManager.getEventHistory().length, 1);
      assert.equal(restoredManager.getEventHistory()[0].name, 'Ammo Cache');
    });
  });

  // ============================================================================
  // 4. SAVEMANAGER & PERSISTENCE INTEGRATION
  // ============================================================================
  describe('SaveManager Phase 2 State Persistence', () => {
    let squad;
    let ledger;
    let conditionManager;
    let reputationManager;
    let dynamicManager;
    let saveManager;

    beforeEach(() => {
      squad = new SquadManager(messageBus);
      ledger = new Ledger(messageBus);
      conditionManager = new PsychologicalConditionManager(messageBus, squad);
      reputationManager = new ReputationManager(messageBus);
      dynamicManager = new DynamicEventManager(messageBus);

      saveManager = new SaveManager(
        messageBus,
        null,
        squad,
        ledger,
        'squadLeaderSaveTest',
        {
          conditionManager,
          reputationManager,
          dynamicEventManager: dynamicManager
        }
      );
    });

    it('should serialize version 3 save game with conditions, reputation, and dynamic events', () => {
      // Populate state across Phase 2 systems
      conditionManager.addCondition('miller', 'Combat Hardened', 'Lead veteran');
      reputationManager.modifyReputation('Tactical', 40);
      dynamicManager.triggerEvent('Booby Trap');
      dynamicManager.resolveEvent('Booby Trap', 'disarmed');

      const saveData = saveManager.saveGame('scene_hill881_bunker');
      assert.ok(saveData);
      assert.equal(saveData.version, 3);
      assert.equal(saveData.sceneId, 'scene_hill881_bunker');

      // Verify Phase 2 data serialized
      assert.ok(saveData.conditions);
      assert.ok(saveData.conditions.miller);
      assert.equal(saveData.conditions.miller[0].name, 'Combat Hardened');

      assert.ok(saveData.reputation);
      assert.equal(saveData.reputation.scores.Tactical, 40);

      assert.ok(saveData.dynamicEvents);
      assert.equal(saveData.dynamicEvents.history.length, 1);
      assert.equal(saveData.dynamicEvents.history[0].name, 'Booby Trap');
    });

    it('should restore Phase 2 systems through loadGame() or setSystems()', () => {
      const mockSaveData = {
        version: 3,
        sceneId: 'test_ridge',
        stats: { heat: 40, intel: 20, supplies: 80 },
        squad: [
          {
            id: 'jenkins',
            name: 'PFC Jenkins',
            role: 'Point Man',
            trait: 'Keen Senses',
            traits: ['Keen Senses'],
            conditions: ['Traumatized'],
            wounds: [],
            status: 'healthy',
            isAlive: true,
            morale: 65
          }
        ],
        conditions: {
          jenkins: [
            {
              name: 'Traumatized',
              category: 'psychological_negative',
              description: 'Shattered nerves',
              reason: 'Restored from test'
            }
          ]
        },
        reputation: {
          scores: {
            Aggressive: 60,
            Reliable: 10,
            Tactical: 20,
            Protector: 0,
            Ruthless: 0,
            'Jungle Ghost': 0
          },
          history: []
        },
        dynamicEvents: {
          history: [
            {
              eventId: 'friendly_patrol',
              name: 'Friendly Patrol',
              outcomeKey: 'share_recon',
              resolvedAt: new Date().toISOString()
            }
          ],
          activeEvent: null,
          cooldowns: { friendly_patrol: 2 }
        }
      };

      // Mock getSaveData to return test snapshot
      saveManager.getSaveData = () => mockSaveData;
      saveManager.loadGame();

      // Verify squad soldier condition restored
      const jenkins = squad.getSoldierById('jenkins');
      assert.ok(jenkins);
      assert.equal(jenkins.hasCondition('Traumatized'), true);
      assert.equal(conditionManager.hasCondition('jenkins', 'Traumatized'), true);

      // Verify reputation restored
      assert.equal(reputationManager.getScore('Aggressive'), 60);
      assert.equal(reputationManager.getPrimaryReputation(), 'Aggressive');

      // Verify dynamic event history restored
      assert.equal(dynamicManager.getEventHistory().length, 1);
      assert.equal(dynamicManager.getEventHistory()[0].name, 'Friendly Patrol');
    });
  });

  // ============================================================================
  // 5. CROSS-SYSTEM MESSAGEBUS INTEGRATION
  // ============================================================================
  describe('Full Phase 2 Systems Integration', () => {
    it('should coordinate Soldier, SquadManager, Relationships, Conditions, Reputation, DynamicEvents, and Journal', () => {
      const squad = new SquadManager(messageBus);
      const ledger = new Ledger(messageBus);
      const relationships = new RelationshipManager(messageBus, null, squad);
      const traits = new TraitManager(messageBus, squad);
      const conditions = new PsychologicalConditionManager(messageBus, squad);
      const reputation = new ReputationManager(messageBus);
      const dynamicEvents = new DynamicEventManager(messageBus);
      const journal = new Journal(messageBus);

      // Scenario:
      // 1. Player makes an aggressive tactical choice
      messageBus.publish('CHOICE_MADE', {
        id: 'charge_hill',
        text: 'Order full assault charge up the bunker ridge with heavy fire',
        reputation: { Aggressive: 15 }
      });
      assert.equal(reputation.getScore('Aggressive'), 15);
      assert.equal(reputation.getPrimaryReputation(), 'Aggressive');

      // 2. Casualty occurs in combat
      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'duke',
        cause: 'Mortar shrapnel'
      });
      assert.equal(squad.getSoldierById('duke').isAlive, false);

      // 3. Friendship reaction triggers FRIEND_KIA -> CPL Brady receives Survivor's Guilt
      assert.equal(conditions.hasCondition('brady', "Survivor's Guilt"), true);
      assert.equal(squad.getSoldierById('brady').hasCondition("Survivor's Guilt"), true);

      // 4. Procedural dynamic event triggers (Helicopter Support)
      ledger.setStat('heat', 50);
      const gunshipEvent = dynamicEvents.triggerEvent('Helicopter Support', { target: 'Treeline' });
      assert.ok(gunshipEvent);

      // 5. Gunship strike resolves, adjusting heat down by 25
      dynamicEvents.resolveEvent('Helicopter Support', 'rocket_strike');
      assert.equal(ledger.getStat('heat'), 25); // 50 - 25 = 25
      assert.equal(dynamicEvents.getEventHistory().length, 1);

      // 6. Journal captured the fallen soldier entry
      const journalEntries = journal.getEntries();
      assert.ok(journalEntries.length > 0);
      assert.ok(journalEntries.some(e => (e.content || e.title || '').toLowerCase().includes('duke')));
    });
  });
});
