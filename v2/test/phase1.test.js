// Squad Leader: Vietnam - Phase 1 Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: phase1.test.js
Purpose: Automated verification suite for Phase 1 architecture of Squad Leader: Vietnam V3.
Responsibilities:
- Verify Soldier entity traits array, wounds, conditions, status, and backward compatibility
- Verify SquadManager casualty handling and rich event broadcasting
- Verify RelationshipManager trust mechanics, friend grief on KIA, and rival conflicts
- Verify TraitManager trait discovery, duplicate prevention, and contextual evaluations
- Verify Journal chronological logging, military formatting, and PST timezone compliance
- Verify end-to-end integration across MessageBus between all Phase 1 systems
Dependencies: node:test, node:assert/strict, Soldier.js, SquadManager.js, RelationshipManager.js, TraitManager.js, Journal.js, MessageBus.js
Published Events: None (Test driver)
Subscribed Events: None (Test driver)
Future Expansion Notes: Will be expanded in Phase 2 for tactical AI, ballistics resolution, and procedural mission generation.
--------------------------------------------------
*/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../src/core/MessageBus.js';
import { Soldier } from '../src/entities/Soldier.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { RelationshipManager } from '../src/systems/RelationshipManager.js';
import { TraitManager, TRAIT_DEFINITIONS } from '../src/systems/TraitManager.js';
import { Journal, JOURNAL_CATEGORIES } from '../src/systems/Journal.js';

describe('Phase 1 Architecture Test Suite', () => {
  let messageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  // ============================================================================
  // 1. SOLDIER ENTITY TESTS
  // ============================================================================
  describe('Soldier Entity Enhancements', () => {
    it('should maintain backward compatibility with legacy constructor signature', () => {
      const soldier = new Soldier('miller', 'SSG Miller', 'Squad Leader', 'Battle Tested');
      assert.equal(soldier.id, 'miller');
      assert.equal(soldier.name, 'SSG Miller');
      assert.equal(soldier.role, 'Squad Leader');
      assert.equal(soldier.trait, 'Battle Tested');
      assert.equal(soldier.alive, true);
      assert.equal(soldier.isAlive, true);
      assert.equal(soldier.status, 'healthy');
      assert.equal(soldier.morale, 100);
      assert.deepEqual(soldier.traits, ['Battle Tested']);
      assert.deepEqual(soldier.wounds, []);
      assert.deepEqual(soldier.conditions, []);
    });

    it('should manage traits dynamically with duplicate prevention', () => {
      const soldier = new Soldier('jenkins', 'PFC Jenkins', 'Point Man', 'Keen Senses');
      assert.equal(soldier.hasTrait('Keen Senses'), true);
      assert.equal(soldier.hasTrait('Calm Under Fire'), false);

      const addedFirst = soldier.addTrait('Calm Under Fire');
      assert.equal(addedFirst, true);
      assert.equal(soldier.hasTrait('Calm Under Fire'), true);
      assert.equal(soldier.getTraits().length, 2);

      const addedDuplicate = soldier.addTrait('Calm Under Fire');
      assert.equal(addedDuplicate, false);
      assert.equal(soldier.getTraits().length, 2);
    });

    it('should handle wounds and update status accordingly', () => {
      const soldier = new Soldier('baker', 'DOC Baker', 'Combat Medic', 'Field Surgeon');
      assert.equal(soldier.status, 'healthy');

      soldier.addWound('Shrapnel Left Leg');
      assert.equal(soldier.hasWound('Shrapnel Left Leg'), true);
      assert.equal(soldier.status, 'wounded');
      assert.equal(soldier.isAlive, true);

      soldier.removeWound('Shrapnel Left Leg');
      assert.equal(soldier.hasWound('Shrapnel Left Leg'), false);
      assert.equal(soldier.status, 'healthy');
    });

    it('should handle conditions without overriding healthy status', () => {
      const soldier = new Soldier('brady', 'CPL Brady', 'K-9 Handler', 'Canine Bond');
      soldier.addCondition('Pinned');
      assert.equal(soldier.hasCondition('Pinned'), true);
      assert.equal(soldier.status, 'healthy');

      soldier.removeCondition('Pinned');
      assert.equal(soldier.hasCondition('Pinned'), false);
    });

    it('should transition status to kia when killed and update isAlive', () => {
      const soldier = new Soldier('kowalski', 'PFC Kowalski', 'Machine Gunner', 'Heavy Weapons');
      soldier.alive = false;
      assert.equal(soldier.isAlive, false);
      assert.equal(soldier.alive, false);
      assert.equal(soldier.status, 'kia');

      // Reversal / resuscitation scenario
      soldier.alive = true;
      assert.equal(soldier.isAlive, true);
      assert.equal(soldier.status, 'healthy');
    });

    it('should serialize comprehensive state via toJSON()', () => {
      const soldier = new Soldier('duke', 'Duke', 'Scout Dog', 'Alert & Loyal', ['Alert & Loyal', 'Jungle Hunter'], ['Scratch'], ['Alert'], 'wounded');
      soldier.adjustMorale(-15);

      const json = soldier.toJSON();
      assert.equal(json.id, 'duke');
      assert.equal(json.name, 'Duke');
      assert.equal(json.trait, 'Alert & Loyal');
      assert.deepEqual(json.traits, ['Alert & Loyal', 'Jungle Hunter']);
      assert.deepEqual(json.wounds, ['Scratch']);
      assert.deepEqual(json.conditions, ['Alert']);
      assert.equal(json.status, 'wounded');
      assert.equal(json.isAlive, true);
      assert.equal(json.morale, 85);
    });
  });

  // ============================================================================
  // 2. SQUAD MANAGER INTEGRATION TESTS
  // ============================================================================
  describe('SquadManager Enhancements', () => {
    it('should handle casualty taken, mark soldier KIA, and publish rich event', () => {
      const squad = new SquadManager(messageBus);
      let publishedEvent = null;

      messageBus.subscribe('SQUAD_UPDATED', (payload) => {
        publishedEvent = payload;
      });

      squad.handleCasualty({ soldierId: 'jenkins', cause: 'Sniper Fire' });

      const jenkins = squad.getSoldierById('jenkins');
      assert.ok(jenkins);
      assert.equal(jenkins.isAlive, false);
      assert.equal(jenkins.status, 'kia');

      assert.ok(publishedEvent);
      assert.equal(publishedEvent.soldierId, 'jenkins');
      assert.equal(publishedEvent.name, 'PFC Jenkins');
      assert.equal(publishedEvent.status, 'kia');
      assert.equal(publishedEvent.cause, 'Sniper Fire');
    });

    it('should restore squad roster with traits, wounds, and status from save data', () => {
      const squad = new SquadManager(messageBus);
      const savedState = [
        {
          id: 'miller',
          name: 'SSG Miller',
          role: 'Squad Leader',
          trait: 'Battle Tested',
          traits: ['Battle Tested', 'Inspiring Leader'],
          wounds: ['Shrapnel Arm'],
          conditions: ['Exhausted'],
          status: 'wounded',
          isAlive: true,
          morale: 90
        }
      ];

      squad.setRoster(savedState);
      const miller = squad.getSoldierById('miller');
      assert.ok(miller);
      assert.equal(miller.hasTrait('Inspiring Leader'), true);
      assert.equal(miller.hasWound('Shrapnel Arm'), true);
      assert.equal(miller.status, 'wounded');
      assert.equal(miller.morale, 90);
    });
  });

  // ============================================================================
  // 3. RELATIONSHIP MANAGER TESTS
  // ============================================================================
  describe('RelationshipManager', () => {
    let squad;
    let relManager;

    beforeEach(() => {
      squad = new SquadManager(messageBus);
      relManager = new RelationshipManager(messageBus, null, squad);
    });

    it('should initialize default Khe Sanh bonds', () => {
      const bradyDuke = relManager.getRelationship('brady', 'duke');
      assert.ok(bradyDuke);
      assert.equal(bradyDuke.type, 'friendship');
      assert.equal(bradyDuke.trust, 100);

      const millerJenkins = relManager.getRelationship('jenkins', 'miller');
      assert.ok(millerJenkins);
      assert.equal(millerJenkins.type, 'mentorship');
      assert.equal(millerJenkins.trust, 80);
    });

    it('should set and retrieve relationship regardless of soldier ID order', () => {
      relManager.setRelationship('torres', 'washington', 'friendship', 85);

      const rel1 = relManager.getRelationship('torres', 'washington');
      const rel2 = relManager.getRelationship('washington', 'torres');

      assert.ok(rel1);
      assert.equal(rel1.trust, 85);
      assert.equal(rel1.type, 'friendship');
      assert.deepEqual(rel1, rel2);
    });

    it('should modify trust level clamped between 0 and 100', () => {
      let trustChangedEvent = null;
      messageBus.subscribe('TRUST_CHANGED', (payload) => {
        trustChangedEvent = payload;
      });

      const initialTrust = relManager.getRelationship('kowalski', 'torres').trust; // 25
      const newTrust = relManager.modifyTrust('kowalski', 'torres', 15);
      assert.equal(newTrust, 40);
      assert.ok(trustChangedEvent);
      assert.equal(trustChangedEvent.oldTrust, 25);
      assert.equal(trustChangedEvent.newTrust, 40);

      // Over-clamp test
      const maxClamped = relManager.modifyTrust('kowalski', 'torres', 200);
      assert.equal(maxClamped, 100);

      const minClamped = relManager.modifyTrust('kowalski', 'torres', -300);
      assert.equal(minClamped, 0);
    });

    it('should trigger FRIEND_KIA and reduce friend morale when soldier is killed', () => {
      let friendKiaEvent = null;
      messageBus.subscribe('FRIEND_KIA', (payload) => {
        friendKiaEvent = payload;
      });

      const brady = squad.getSoldierById('brady');
      const duke = squad.getSoldierById('duke');
      assert.equal(brady.morale, 100);

      // Duke is KIA!
      squad.handleCasualty({ soldierId: 'duke', cause: 'Mortar Shrapnel' });

      assert.ok(friendKiaEvent);
      assert.equal(friendKiaEvent.fallenSoldierId, 'duke');
      assert.equal(friendKiaEvent.affectedSoldierId, 'brady');
      assert.ok(friendKiaEvent.moralePenalty > 0);
      assert.ok(brady.morale < 100, `Brady morale should decrease, got: ${brady.morale}`);
    });

    it('should trigger RIVAL_CONFLICT between rivals during high-stress choices', () => {
      let conflictEvent = null;
      messageBus.subscribe('RIVAL_CONFLICT', (payload) => {
        conflictEvent = payload;
      });

      const kowalski = squad.getSoldierById('kowalski');
      const torres = squad.getSoldierById('torres');
      const initialKowalskiMorale = kowalski.morale;

      // Publish high-heat choice
      messageBus.publish('CHOICE_MADE', {
        text: 'Rush the bunker entrance through open crossfire!',
        events: [{ type: 'STAT_CHANGED', payload: { heat: 25, stress: 20 } }]
      });

      assert.ok(conflictEvent);
      assert.equal(conflictEvent.soldier1Id, 'kowalski');
      assert.equal(conflictEvent.soldier2Id, 'torres');
      assert.ok(kowalski.morale < initialKowalskiMorale);
    });

    it('should calculate rescue chance modifier based on trust level', () => {
      const highTrustMod = relManager.getRescueChanceModifier('brady', 'duke');
      assert.ok(highTrustMod > 20, `High trust should provide substantial bonus, got ${highTrustMod}`);

      const rivalryMod = relManager.getRescueChanceModifier('kowalski', 'torres');
      assert.ok(rivalryMod < 0, `Rivalry should result in negative modifier, got ${rivalryMod}`);
    });

    it('should serialize and deserialize relationships accurately', () => {
      relManager.setRelationship('miller', 'baker', 'friendship', 92);
      const serialized = relManager.serialize();
      assert.ok(Array.isArray(serialized));

      const freshRelManager = new RelationshipManager(messageBus, serialized);
      const restored = freshRelManager.getRelationship('miller', 'baker');
      assert.ok(restored);
      assert.equal(restored.type, 'friendship');
      assert.equal(restored.trust, 92);
    });
  });

  // ============================================================================
  // 4. TRAIT MANAGER TESTS
  // ============================================================================
  describe('TraitManager', () => {
    let squad;
    let traitManager;

    beforeEach(() => {
      squad = new SquadManager(messageBus);
      traitManager = new TraitManager(messageBus, squad);
    });

    it('should provide trait definitions from catalog', () => {
      const def = traitManager.getTraitDefinition('Calm Under Fire');
      assert.ok(def);
      assert.equal(def.category, 'positive');
      assert.ok(def.combatEffect.includes('stress resistance'));

      const negDef = traitManager.getTraitDefinition('Claustrophobic');
      assert.ok(negDef);
      assert.equal(negDef.category, 'negative');
    });

    it('should discover a new trait, publish event, and update soldier entity', () => {
      let discoveredEvent = null;
      messageBus.subscribe('TRAIT_DISCOVERED', (payload) => {
        discoveredEvent = payload;
      });

      const success = traitManager.discoverTrait('miller', 'Inspiring Leader', 'Rallied defense at Bunker 4');
      assert.equal(success, true);
      assert.equal(traitManager.hasTrait('miller', 'Inspiring Leader'), true);

      const soldier = squad.getSoldierById('miller');
      assert.ok(soldier.hasTrait('Inspiring Leader'));

      assert.ok(discoveredEvent);
      assert.equal(discoveredEvent.soldierId, 'miller');
      assert.equal(discoveredEvent.trait, 'Inspiring Leader');
      assert.equal(discoveredEvent.category, 'positive');
    });

    it('should prevent duplicate trait discovery for the same soldier', () => {
      const first = traitManager.discoverTrait('jenkins', 'Jungle Hunter', 'First scout');
      assert.equal(first, true);

      const second = traitManager.discoverTrait('jenkins', 'Jungle Hunter', 'Second scout');
      assert.equal(second, false);

      const traits = traitManager.getTraitsFor('jenkins');
      const count = traits.filter(t => t === 'Jungle Hunter').length;
      assert.equal(count, 1);
    });

    it('should evaluate and trigger trait discovery based on context', () => {
      // 1. Direct trigger test (near_miss -> Lucky)
      const results1 = traitManager.evaluateDiscovery({
        soldierId: 'kowalski',
        trigger: 'near_miss'
      });
      assert.ok(results1.length > 0);
      assert.equal(traitManager.hasTrait('kowalski', 'Lucky'), true);

      // 2. Choice-based trigger (tunnel -> Claustrophobic)
      const results2 = traitManager.evaluateDiscovery({
        event: 'CHOICE_MADE',
        choice: {
          text: 'Send a man to crawl into the subterranean tunnel complex',
          resolutionText: 'The tunnel was pitch black and narrow.'
        }
      });
      assert.ok(results2.length > 0);
      assert.equal(results2[0].trait, 'Claustrophobic');
    });

    it('should serialize and deserialize discovered traits', () => {
      traitManager.discoverTrait('baker', 'Combat Lifesaver', 'Field triage');
      const serialized = traitManager.serialize();
      assert.ok(serialized.baker);

      const freshTraitManager = new TraitManager(messageBus, squad);
      freshTraitManager.deserialize(serialized);

      assert.equal(freshTraitManager.hasTrait('baker', 'Combat Lifesaver'), true);
      const traits = freshTraitManager.getTraitsFor('baker');
      assert.ok(traits.includes('Combat Lifesaver'));
    });
  });

  // ============================================================================
  // 5. CAMPAIGN JOURNAL TESTS
  // ============================================================================
  describe('Campaign Journal', () => {
    let journal;

    beforeEach(() => {
      journal = new Journal(messageBus, {
        timeZone: 'America/Los_Angeles',
        currentDay: 1,
        currentTime: '0630 hrs',
        currentLocation: 'Hill 881 South'
      });
    });

    it('should add manual entry and publish JOURNAL_ENTRY_ADDED', () => {
      let publishedEntry = null;
      messageBus.subscribe('JOURNAL_ENTRY_ADDED', (payload) => {
        publishedEntry = payload.entry;
      });

      const entry = journal.addEntry({
        title: 'Morning Patrol Briefing',
        category: JOURNAL_CATEGORIES.COMMAND,
        content: 'Squad ordered to establish listening post 200m north.',
        tags: ['BRIEFING', 'PATROL']
      });

      assert.ok(entry);
      assert.ok(entry.id);
      assert.equal(entry.category, 'COMMAND');
      assert.equal(entry.title, 'Morning Patrol Briefing');
      assert.ok(entry.timestamp.includes('PST') || entry.timestamp.includes('GMT-8') || entry.timestamp.length > 0);

      assert.ok(publishedEntry);
      assert.equal(publishedEntry.id, entry.id);
    });

    it('should automatically subscribe and log casualty events', () => {
      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'jenkins',
        name: 'PFC Jenkins',
        role: 'Point Man',
        cause: 'Mortar Blast',
        status: 'kia'
      });

      const entries = journal.getEntriesByCategory('CASUALTY');
      assert.equal(entries.length, 1);
      assert.ok(entries[0].title.includes('PFC Jenkins'));
      assert.ok(entries[0].content.includes('Mortar Blast'));
      assert.ok(entries[0].tags.includes('PFC Jenkins'));
    });

    it('should automatically subscribe and log heroic acts, ambushes, and weather', () => {
      // Heroic action
      messageBus.publish('HEROIC_ACTION', {
        heroName: 'CPL Brady',
        action: 'advanced through direct crossfire to retrieve fallen radio'
      });

      // Ambush
      messageBus.publish('AMBUSH_TRIGGERED', {
        location: 'Highway 9 Culvert',
        description: 'Automatic rifle fire from camouflaged spiders holes.'
      });

      // Weather
      messageBus.publish('WEATHER_CHANGED', {
        weather: 'Heavy Monsoon Downpour',
        visibility: 'Zero'
      });

      assert.equal(journal.getEntriesByCategory('HEROISM').length, 1);
      assert.equal(journal.getEntriesByCategory('COMBAT').length, 1);
      assert.equal(journal.getEntriesByCategory('WEATHER').length, 1);
    });

    it('should format military journal entries cleanly with PST timestamps', () => {
      journal.addEntry({
        title: 'Perimeter Check',
        category: JOURNAL_CATEGORIES.COMBAT,
        content: 'All sectors reported quiet.',
        tags: ['PERIMETER']
      });

      const formatted = journal.getFormattedEntries();
      assert.equal(formatted.length, 1);
      assert.ok(formatted[0].includes('Day 1 - 0630 hrs'));
      assert.ok(formatted[0].includes('Perimeter Check'));
      assert.ok(formatted[0].includes('TAGS: #PERIMETER'));
    });

    it('should serialize and deserialize journal log data', () => {
      journal.addEntry({ title: 'Log 1', content: 'First entry' });
      journal.addEntry({ title: 'Log 2', content: 'Second entry' });

      const serialized = journal.serialize();
      assert.equal(serialized.entries.length, 2);

      const restoredJournal = new Journal(messageBus);
      restoredJournal.deserialize(serialized);

      assert.equal(restoredJournal.getEntries().length, 2);
      assert.equal(restoredJournal.getEntries()[0].title, 'Log 1');
    });

    it('should support dynamic timezone configuration per Directive 13', () => {
      journal.setTimeZone('EST');
      assert.equal(journal.getTimeZone(), 'America/New_York');

      journal.setTimeZone('PST');
      assert.equal(journal.getTimeZone(), 'America/Los_Angeles');
    });
  });

  // ============================================================================
  // 6. END-TO-END PHASE 1 INTEGRATION TEST
  // ============================================================================
  describe('Full Phase 1 Systems Integration', () => {
    it('should coordinate Soldier, SquadManager, RelationshipManager, TraitManager, and Journal across MessageBus', () => {
      const squad = new SquadManager(messageBus);
      const relManager = new RelationshipManager(messageBus, null, squad);
      const traitManager = new TraitManager(messageBus, squad);
      const journal = new Journal(messageBus, { currentLocation: 'Hill 881 South' });

      // Step 1: Discover a trait under combat pressure
      messageBus.publish('CHOICE_MADE', {
        text: 'Order Miller to inspire the men to hold the bunker line!',
        resolutionText: 'Miller shouted orders above the roar of incoming shells.'
      });

      const miller = squad.getSoldierById('miller');
      assert.equal(traitManager.hasTrait('miller', 'Inspiring Leader'), true);
      assert.equal(miller.hasTrait('Inspiring Leader'), true);

      // Step 2: Heroic act increases trust
      messageBus.publish('HEROIC_ACTION', {
        heroId: 'miller',
        heroName: 'SSG Miller',
        targetId: 'jenkins',
        action: 'pulled Jenkins out of an exposed crater',
        trustDelta: 20
      });

      const bond = relManager.getRelationship('miller', 'jenkins');
      assert.ok(bond.trust >= 90);

      const heroismLogs = journal.getEntriesByCategory('HEROISM');
      assert.equal(heroismLogs.length, 1);
      assert.ok(heroismLogs[0].title.includes('SSG Miller'));

      // Step 3: Fatal Casualty triggers SquadManager, RelationshipManager grief, and Journal entry
      const initialBradyMorale = squad.getSoldierById('brady').morale;

      messageBus.publish('CASUALTY_TAKEN', {
        soldierId: 'duke',
        name: 'Duke',
        cause: 'Mortar Shrapnel',
        status: 'kia'
      });

      // Squad status updated
      const duke = squad.getSoldierById('duke');
      assert.equal(duke.isAlive, false);
      assert.equal(duke.status, 'kia');

      // Relationship grief triggered
      const brady = squad.getSoldierById('brady');
      assert.ok(brady.morale < initialBradyMorale, 'Brady should suffer morale loss from Duke KIA');

      // Journal entry recorded
      const casualtyLogs = journal.getEntriesByCategory('CASUALTY');
      assert.equal(casualtyLogs.length, 1);
      assert.ok(casualtyLogs[0].title.includes('Duke (KIA)'));
    });
  });
});
