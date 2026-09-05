// Squad Leader: Vietnam - Backend Save Persistence Test Suite
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MessageBus } from '../src/core/MessageBus.js';
import { Ledger } from '../src/state/Ledger.js';
import { SquadManager } from '../src/entities/SquadManager.js';
import { SceneManager } from '../src/core/SceneManager.js';
import { SaveManager } from '../src/core/SaveManager.js';

describe('SaveManager & Server Backend Integration', () => {
  const SERVER_URL = 'http://127.0.0.1:8080';

  test('SaveManager should have restoreState, syncToBackend, loadFromBackend, and clearBackendSave methods', () => {
    const messageBus = new MessageBus();
    const ledger = new Ledger(messageBus);
    const squadManager = new SquadManager(messageBus);
    const sceneManager = new SceneManager(messageBus, {
      start: { id: 'start', text: 'Intro', choices: [] }
    });
    const saveManager = new SaveManager(messageBus, sceneManager, squadManager, ledger);

    assert.equal(typeof saveManager.restoreState, 'function');
    assert.equal(typeof saveManager.syncToBackend, 'function');
    assert.equal(typeof saveManager.loadFromBackend, 'function');
    assert.equal(typeof saveManager.clearBackendSave, 'function');
  });

  test('SaveManager.restoreState() should properly deserialize state and broadcast GAME_LOADED', () => {
    const messageBus = new MessageBus();
    const ledger = new Ledger(messageBus);
    const squadManager = new SquadManager(messageBus);
    const sceneManager = new SceneManager(messageBus, {
      start: { id: 'start', text: 'Intro', choices: [] },
      rendezvous: { id: 'rendezvous', text: 'Rendezvous Point', choices: [] }
    });
    const saveManager = new SaveManager(messageBus, sceneManager, squadManager, ledger);

    let gameLoadedFired = false;
    messageBus.subscribe('GAME_LOADED', (payload) => {
      gameLoadedFired = true;
      assert.equal(payload.sceneId, 'rendezvous');
    });

    const mockSave = {
      version: 3,
      timestamp: '2026-09-05T03:40:00Z',
      sceneId: 'rendezvous',
      stats: { heat: 45, intel: 20, supplies: 80, stress: 30 },
      squad: [
        { id: 'miller', name: 'Sgt. Miller', role: 'Squad Leader', isAlive: true, status: 'healthy', morale: 90 }
      ]
    };

    const restored = saveManager.restoreState(mockSave);
    assert.ok(restored);
    assert.equal(gameLoadedFired, true);
    assert.equal(sceneManager.getCurrentSceneId(), 'rendezvous');
    assert.equal(ledger.stats.heat, 45);
    assert.equal(ledger.stats.supplies, 80);
    assert.equal(squadManager.getSoldierById('miller').morale, 90);
  });

  test('Live Server REST API: POST /api/save and GET /api/load round-trip', async () => {
    // 1. Clear any prior server save
    const clearRes = await fetch(`${SERVER_URL}/api/clear`, { method: 'POST' });
    assert.equal(clearRes.status, 200);

    // 2. Post test save state
    const testPayload = {
      version: 3,
      timestamp: '2026-09-05T03:48:00Z',
      sceneId: 'tactical_retreat',
      stats: { heat: 60, intel: 35, supplies: 40, stress: 55 },
      squad: [{ id: 'brady', name: 'Cpl. Brady', role: 'Point Man', isAlive: true }]
    };

    const saveRes = await fetch(`${SERVER_URL}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    assert.equal(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.success, true);
    assert.equal(saveJson.sceneId, 'tactical_retreat');

    // 3. Verify status endpoint reports hasSave: true
    const statusRes = await fetch(`${SERVER_URL}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.status, 'ok');
    assert.equal(statusJson.hasSave, true);
    assert.ok(statusJson.lastModified);

    // 4. Load saved state from server
    const loadRes = await fetch(`${SERVER_URL}/api/load`);
    assert.equal(loadRes.status, 200);
    const loadJson = await loadRes.json();
    assert.equal(loadJson.success, true);
    assert.equal(loadJson.data.sceneId, 'tactical_retreat');
    assert.equal(loadJson.data.stats.heat, 60);

    // 5. Clear save file via DELETE /api/save
    const delRes = await fetch(`${SERVER_URL}/api/save`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.equal(delJson.success, true);

    // 6. Verify load now returns 404
    const emptyLoadRes = await fetch(`${SERVER_URL}/api/load`);
    assert.equal(emptyLoadRes.status, 404);
    const emptyLoadJson = await emptyLoadRes.json();
    assert.equal(emptyLoadJson.success, false);
  });
});
