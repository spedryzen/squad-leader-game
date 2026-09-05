// Squad Leader: Vietnam - Main Application Composition Root
// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/*
--------------------------------------------------
File Name: main.js
Purpose: Composition root that wires together core engine modules, entities, state ledgers, systems, and the browser UI.
Responsibilities:
- Instantiate MessageBus, Ledger, SquadManager, RelationshipManager, TraitManager, Journal, PsychologicalConditionManager, ReputationManager, DynamicEventManager, WeatherSystem, RadioSystem, IntelSystem, EnemyCommander, AmbushSystem, HeroicActionManager, TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem, GameEngine, SceneManager, SaveManager
- Render interactive DOM tactical dashboard, roster status, tactical choices, and live event stream
- Handle player UI interactions and game lifecycle operations
Dependencies: MessageBus, GameEngine, SceneManager, SaveManager, SquadManager, Ledger, RelationshipManager, TraitManager, Journal, PsychologicalConditionManager, ReputationManager, DynamicEventManager, WeatherSystem, RadioSystem, IntelSystem, EnemyCommander, AmbushSystem, HeroicActionManager, TacticalMapManager, WoundedSoldierManager, BattlefieldRecoverySystem, campaign data
Published Events: Various lifecycle and test events
Subscribed Events: SCENE_RENDERED, CHOICE_RESOLUTION, STAT_CHANGED, SQUAD_UPDATED, GAME_SAVED, GAME_LOADED, SAVE_CLEARED, REPUTATION_CHANGED, CONDITION_GAINED, CONDITION_REMOVED, DYNAMIC_EVENT_TRIGGERED, WEATHER_CHANGED, RADIO_MESSAGE_RECEIVED, INTEL_LEVEL_CHANGED, ENEMY_STRATEGY_CHANGED, AMBUSH_WARNING, TENSION_RESOLVED, MAP_UPDATED, MAP_MARKER_ADDED, SOLDIER_WOUNDED, WOUNDED_DECISION_MADE, SOLDIER_EVACUATED, SOLDIER_ABANDONED, RECOVERY_OFFERED, RECOVERY_EXECUTED
Future Expansion Notes: Future phases will integrate canvas tactical maps, combat casualty dialogs, and campaign journal viewer modal.
--------------------------------------------------
*/

import { MessageBus } from './core/MessageBus.js';
import { GameEngine } from './core/GameEngine.js';
import { SceneManager } from './core/SceneManager.js';
import { SaveManager } from './core/SaveManager.js';
import { SquadManager } from './entities/SquadManager.js';
import { Ledger } from './state/Ledger.js';
import { RelationshipManager } from './systems/RelationshipManager.js';
import { TraitManager } from './systems/TraitManager.js';
import { Journal, JOURNAL_CATEGORIES } from './systems/Journal.js';
import { PsychologicalConditionManager, PSYCHOLOGICAL_CONDITIONS } from './systems/PsychologicalConditionManager.js';
import { ReputationManager } from './systems/ReputationManager.js';
import { DynamicEventManager } from './systems/DynamicEventManager.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { RadioSystem, RADIO_CHANNELS, CHANNEL_METADATA } from './systems/RadioSystem.js';
import { IntelSystem } from './systems/IntelSystem.js';
import { EnemyCommander } from './systems/EnemyCommander.js';
import { AmbushSystem } from './systems/AmbushSystem.js';
import { HeroicActionManager } from './systems/HeroicActionManager.js';
import { TacticalMapManager, MAP_MARKER_TYPES } from './systems/TacticalMapManager.js';
import { WoundedSoldierManager } from './systems/WoundedSoldierManager.js';
import { BattlefieldRecoverySystem } from './systems/BattlefieldRecoverySystem.js';
import { ExtractionSystem, EXTRACTION_ARCHETYPES } from './systems/ExtractionSystem.js';
import { campaign3US } from './data/campaign_3_us.js?v=7';
import { campaign4LZ } from './data/campaign_4_lz.js?v=1';

/**
 * Composition Root for Squad Leader: Vietnam (v2 OOP Architecture).
 * Wires together the MessageBus, Ledger, SquadManager, GameEngine, SceneManager, SaveManager, and DOM visualizer.
 */

// 1. Instantiate the central MessageBus
const messageBus = new MessageBus();

const isBrowser = typeof document !== 'undefined';

// 2. Setup DOM Logger, Visual Dashboard, Narrative / Choices Display, and Save Controls
if (isBrowser) {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="container">
        <header>
          <h1>Squad Leader: Vietnam</h1>
          <div class="subtitle">v3 Advanced Tactical Command &amp; Operations</div>
          <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
            <div class="status-badge" id="system-status">STATUS: INITIALIZING...</div>
            <div class="status-badge" id="save-status" style="border-color: var(--smoke-gray); color: var(--smoke-gray);">AUTO-SAVE: READY</div>
            <div class="status-badge" id="weather-status" style="border-color: var(--radio-green); color: var(--terminal-green);">WEATHER: CLEAR</div>
            <div class="status-badge" id="radio-status" style="border-color: var(--warning-yellow); color: var(--warning-yellow); display: none;">RADIO: NET READY</div>
            <div class="status-badge" id="reputation-status" style="border-color: #a78bfa; color: #a78bfa;">REP: NEUTRAL</div>
            <div class="status-badge" id="enemy-status" style="border-color: var(--blood-red); color: #ff6b6b;">NVA: RECON</div>
            <div class="status-badge" id="ambush-status" style="border-color: var(--warning-yellow); color: var(--warning-yellow); display: none;">TENSION: ALERT</div>
            <div class="status-badge" id="extraction-status" style="border-color: var(--terminal-green); color: var(--terminal-green); display: none;">EXTRACTION: READY</div>
          </div>
        </header>

        <!-- Save & Campaign Flow Controls -->
        <div class="panel" style="padding: 12px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 0.9rem; color: var(--warning-yellow); font-weight: bold;">
              <span>CAMPAIGN CONTROLS</span>
              <span id="save-summary" style="font-size: 0.8rem; color: var(--smoke-gray); margin-left: 10px; font-weight: normal;"></span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="btn-resume-game" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit; font-size: 0.85rem;">Resume Game</button>
              <button id="btn-new-game" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--warning-yellow); font-family: inherit; font-size: 0.85rem;">New Game (Reset)</button>
              <button id="btn-manual-save" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit; font-size: 0.85rem;">Manual Save</button>
              <button id="btn-clear-save" style="cursor: pointer; padding: 6px 14px; background: var(--blood-red); color: #fff; border: 1px solid #fff; font-family: inherit; font-size: 0.85rem;">Clear Save</button>
            </div>
          </div>
        </div>

        <!-- Command Stats (Ledger) -->
        <div class="panel" style="padding: 12px 18px;">
          <div class="panel-header" style="margin-bottom: 8px;">
            <span>Command Stats (Ledger)</span>
            <span id="ledger-summary">Heat: 0 | Intel: 0 [LOW] | Supplies: 100 | Stress: 0</span>
          </div>
          <div id="stats-display" style="display: flex; gap: 12px; font-size: 0.85rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 140px; padding: 8px 12px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--warning-yellow);">
              <strong>HEAT:</strong> <span id="stat-heat">0</span>
            </div>
            <div style="flex: 1; min-width: 140px; padding: 8px 12px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--radio-green);">
              <strong>INTEL:</strong> <span id="stat-intel">0</span> <span id="intel-tier-badge" style="font-size: 0.75rem; color: var(--smoke-gray); margin-left: 4px;">[LOW]</span>
            </div>
            <div style="flex: 1; min-width: 140px; padding: 8px 12px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--dust-tan);">
              <strong>SUPPLIES:</strong> <span id="stat-supplies">100</span>
            </div>
            <div style="flex: 1; min-width: 140px; padding: 8px 12px; background: rgba(0,0,0,0.3); border-left: 3px solid #ff6b6b;">
              <strong>STRESS:</strong> <span id="stat-stress">0</span>
            </div>
          </div>
        </div>

        <!-- Military Tab Navigation -->
        <nav class="nav-tabs" role="tablist">
          <button class="nav-tab active" data-tab="briefing" id="tab-btn-briefing" role="tab" aria-selected="true">[ BRIEFING &amp; ORDERS ]</button>
          <button class="nav-tab" data-tab="radio" id="tab-btn-radio" role="tab" aria-selected="false">[ FIELD RADIO (PRC-25) ] <span class="tab-badge hidden" id="radio-tab-badge">0</span></button>
          <button class="nav-tab" data-tab="journal" id="tab-btn-journal" role="tab" aria-selected="false">[ WAR JOURNAL ] <span class="tab-badge hidden" id="journal-tab-badge">0</span></button>
          <button class="nav-tab" data-tab="map" id="tab-btn-map" role="tab" aria-selected="false">[ AOR TACTICAL MAP ]</button>
          <button class="nav-tab" data-tab="dossier" id="tab-btn-dossier" role="tab" aria-selected="false">[ SQUAD DOSSIER ]</button>
          <button class="nav-tab" data-tab="events" id="tab-btn-events" role="tab" aria-selected="false">[ EVENT STREAM ]</button>
        </nav>

        <!-- Tab Content Panes -->
        <div class="tab-content">
          <!-- PANE 1: BRIEFING & ORDERS -->
          <div class="tab-pane active" id="pane-briefing" role="tabpanel">
            <div class="panel" id="scene-panel">
              <div class="panel-header">
                <span>Tactical Narrative &amp; Orders</span>
                <span id="scene-location" style="color: var(--warning-yellow); font-size: 0.9rem;"></span>
              </div>
              <div id="narrative-text" style="font-size: 1rem; line-height: 1.6; color: var(--dust-tan); background: rgba(0, 0, 0, 0.4); padding: 16px; border-left: 4px solid var(--warning-yellow); margin-bottom: 16px; min-height: 70px;">
                Awaiting tactical briefing...
              </div>
              <div id="choices-container" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Choice buttons are dynamically rendered here -->
              </div>
            </div>
          </div>

          <!-- PANE 2: FIELD RADIO (PRC-25) -->
          <div class="tab-pane" id="pane-radio" role="tabpanel">
            <div class="panel">
              <div class="panel-header">
                <span>AN/PRC-25 Field Radio Console</span>
                <span id="radio-net-info" style="color: var(--terminal-green); font-size: 0.85rem;">46.50 MHz FM • Net Operational</span>
              </div>
              <div id="radio-panel-content">
                <!-- Dynamically rendered by renderRadioUI() -->
              </div>
            </div>
          </div>

          <!-- PANE 3: WAR JOURNAL -->
          <div class="tab-pane" id="pane-journal" role="tabpanel">
            <div class="panel">
              <div class="panel-header">
                <span>Operational War Journal &amp; Citations</span>
                <span style="font-size: 0.8rem; color: var(--smoke-gray);">PST Standard Time (Directive 13)</span>
              </div>
              <div id="journal-panel-content">
                <!-- Dynamically rendered by renderJournalUI() -->
              </div>
            </div>
          </div>

          <!-- PANE 4: AOR TACTICAL MAP -->
          <div class="tab-pane" id="pane-map" role="tabpanel">
            <div class="panel">
              <div class="panel-header">
                <span>AOR Tactical Map - Grid 881 &amp; Highway 9</span>
                <span id="coordinate-readout" class="coordinate-readout">GRID: [50.0, 50.0]</span>
              </div>
              <div id="map-panel-content">
                <!-- Dynamically rendered by renderTacticalMapUI() -->
              </div>
            </div>
          </div>

          <!-- PANE 5: SQUAD DOSSIER -->
          <div class="tab-pane" id="pane-dossier" role="tabpanel">
            <div class="panel">
              <div class="panel-header">
                <span>Squad Psych &amp; Service Dossier</span>
                <span id="dossier-counter" style="color: var(--terminal-green); font-size: 0.85rem;">9 Personnel Assigned</span>
              </div>
              <div id="dossier-panel-content">
                <!-- Dynamically rendered by renderDossierUI() -->
              </div>
            </div>
          </div>

          <!-- PANE 6: EVENT STREAM -->
          <div class="tab-pane" id="pane-events" role="tabpanel">
            <div class="panel">
              <div class="panel-header">
                <span>MessageBus Live Event Stream</span>
                <span id="event-counter">0 events</span>
              </div>
              <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button id="btn-test-stat" style="cursor: pointer; padding: 6px 12px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit; font-size: 0.8rem;">+10 Intel (Test Event)</button>
                <button id="btn-test-heat" style="cursor: pointer; padding: 6px 12px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--blood-red); font-family: inherit; font-size: 0.8rem;">+15 Heat (Test Event)</button>
                <button id="btn-test-stress" style="cursor: pointer; padding: 6px 12px; background: var(--jungle-mid); color: #ff9800; border: 1px solid #ff9800; font-family: inherit; font-size: 0.8rem;">+10 Stress (Test Event)</button>
                <button id="btn-test-casualty" style="cursor: pointer; padding: 6px 12px; background: var(--blood-red); color: #fff; border: 1px solid #fff; font-family: inherit; font-size: 0.8rem;">Simulate Casualty (Test Event)</button>
              </div>
              <ul id="event-log"></ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

let eventCount = 0;

/**
 * Logs events to the on-screen DOM console.
 * @param {string} eventName
 * @param {*} payload
 */
function logEventToDOM(eventName, payload) {
  if (!isBrowser) return;

  const logList = document.getElementById('event-log');
  const counter = document.getElementById('event-counter');
  if (!logList) return;

  eventCount++;
  if (counter) {
    counter.textContent = `${eventCount} event${eventCount === 1 ? '' : 's'}`;
  }

  const item = document.createElement('li');
  item.className = 'log-entry';

  const meta = document.createElement('div');
  meta.className = 'log-meta';

  const time = new Date().toLocaleTimeString();
  meta.innerHTML = `<span class="log-event-name">[EVENT] ${eventName}</span><span>${time}</span>`;

  const body = document.createElement('pre');
  body.className = 'log-payload';
  try {
    body.textContent = payload !== null && payload !== undefined
      ? JSON.stringify(payload, (key, value) => {
          if (key === 'engine') return '[GameEngine Instance]';
          if (key === 'messageBus') return '[MessageBus Instance]';
          return value;
        }, 2)
      : 'null';
  } catch {
    body.textContent = String(payload);
  }

  item.appendChild(meta);
  item.appendChild(body);
  logList.insertBefore(item, logList.firstChild);
}

// Hook messageBus.publish to stream all events to DOM logger
const originalPublish = messageBus.publish.bind(messageBus);
messageBus.publish = function (event, payload = null) {
  logEventToDOM(event, payload);
  return originalPublish(event, payload);
};

// 3. Instantiate the core OOP systems, passing the MessageBus
const ledger = new Ledger(messageBus);
const squadManager = new SquadManager(messageBus);
const relationshipManager = new RelationshipManager(messageBus, null, squadManager);
const traitManager = new TraitManager(messageBus, squadManager);
const journal = new Journal(messageBus);
const conditionManager = new PsychologicalConditionManager(messageBus, squadManager);
const reputationManager = new ReputationManager(messageBus);
const dynamicEventManager = new DynamicEventManager(messageBus);
const weatherSystem = new WeatherSystem(messageBus);
const radioSystem = new RadioSystem(messageBus, { weatherSystem });
const intelSystem = new IntelSystem(messageBus, ledger);
const enemyCommander = new EnemyCommander(messageBus, { ledger, squadManager });
const ambushSystem = new AmbushSystem(messageBus, { ledger, intelSystem, weatherSystem, enemyCommander });
const heroicActionManager = new HeroicActionManager(messageBus, { squadManager });
const tacticalMapManager = new TacticalMapManager(messageBus, { intelSystem, ledger });
const woundedSoldierManager = new WoundedSoldierManager(messageBus, {
  squadManager,
  ledger,
  conditionManager,
  relationshipManager,
  journal
});
const battlefieldRecoverySystem = new BattlefieldRecoverySystem(messageBus, {
  ledger,
  squadManager,
  enemyCommander,
  journal
});
const extractionSystem = new ExtractionSystem(messageBus, {
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
const gameEngine = new GameEngine(messageBus);
const combinedCampaign = { ...campaign3US, ...campaign4LZ };
const sceneManager = new SceneManager(messageBus, combinedCampaign);
const saveManager = new SaveManager(messageBus, sceneManager, squadManager, ledger, 'squadLeaderSave', {
  relationshipManager,
  traitManager,
  journal,
  conditionManager,
  reputationManager,
  dynamicEventManager,
  weatherSystem,
  radioSystem,
  intelSystem,
  enemyCommander,
  ambushSystem,
  heroicActionManager,
  tacticalMapManager,
  woundedSoldierManager,
  battlefieldRecoverySystem,
  extractionSystem
});

// 4. Update UI helpers & Live Panel Renderers
let activeTab = 'briefing';
let activeRadioChannel = RADIO_CHANNELS.HQ;
let tunedFrequency = 46.5;
let activeJournalFilter = 'ALL';
let unreadJournalCount = 0;
const mapLayers = {
  enemy: true,
  ambushes: true,
  mortars: true,
  minefields: true,
  recon: true,
  casualties: true
};

/**
 * Switches the active military HUD tab.
 * @param {string} tabName - 'briefing' | 'radio' | 'journal' | 'map' | 'dossier' | 'events'
 */
function switchTab(tabName) {
  if (!isBrowser) return;
  activeTab = tabName;

  const tabBtns = document.querySelectorAll('.nav-tab');
  tabBtns.forEach((btn) => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach((pane) => {
    pane.classList.toggle('active', pane.id === `pane-${tabName}`);
  });

  if (tabName === 'journal') {
    unreadJournalCount = 0;
    const jBadge = document.getElementById('journal-tab-badge');
    if (jBadge) {
      jBadge.textContent = '0';
      jBadge.classList.add('hidden');
    }
  }

  if (tabName === 'radio') renderRadioUI();
  else if (tabName === 'journal') renderJournalUI();
  else if (tabName === 'map') renderTacticalMapUI();
  else if (tabName === 'dossier') renderDossierUI();
}

function updateReputationUI() {
  if (!isBrowser) return;
  const repBadge = document.getElementById('reputation-status');
  if (repBadge && reputationManager) {
    const level = typeof reputationManager.getLevel === 'function' ? reputationManager.getLevel() : 'Neutral';
    const score = reputationManager.score !== undefined ? reputationManager.score : 50;
    repBadge.textContent = `REP: ${level.toUpperCase()} [${score}]`;
    if (score >= 70) {
      repBadge.style.borderColor = 'var(--terminal-green)';
      repBadge.style.color = 'var(--terminal-green)';
    } else if (score <= 30) {
      repBadge.style.borderColor = 'var(--blood-red)';
      repBadge.style.color = '#ff6b6b';
    } else {
      repBadge.style.borderColor = '#a78bfa';
      repBadge.style.color = '#a78bfa';
    }
  }
}

function updateLedgerUI() {
  if (!isBrowser) return;
  const stats = ledger.getStats();
  const heatEl = document.getElementById('stat-heat');
  const intelEl = document.getElementById('stat-intel');
  const suppliesEl = document.getElementById('stat-supplies');
  const stressEl = document.getElementById('stat-stress');
  const summaryEl = document.getElementById('ledger-summary');
  const intelBadgeEl = document.getElementById('intel-tier-badge');

  const tier = intelSystem ? intelSystem.getIntelTier() : 'LOW';

  if (heatEl) heatEl.textContent = stats.heat;
  if (intelEl) intelEl.textContent = stats.intel;
  if (suppliesEl) suppliesEl.textContent = stats.supplies;
  if (stressEl) stressEl.textContent = stats.stress !== undefined ? stats.stress : 0;
  if (intelBadgeEl) intelBadgeEl.textContent = `[${tier}]`;
  if (summaryEl) summaryEl.textContent = `Heat: ${stats.heat} | Intel: ${stats.intel} [${tier}] | Supplies: ${stats.supplies} | Stress: ${stats.stress !== undefined ? stats.stress : 0}`;

  updateReputationUI();
}

function updateWeatherUI() {
  if (!isBrowser) return;
  const weatherBadge = document.getElementById('weather-status');
  if (weatherBadge && weatherSystem) {
    const current = weatherSystem.getCurrentWeather();
    weatherBadge.textContent = `WEATHER: ${current.name.toUpperCase()}`;
    if (current.type === 'Clear') {
      weatherBadge.style.borderColor = 'var(--radio-green)';
      weatherBadge.style.color = 'var(--terminal-green)';
    } else if (current.type === 'Thunderstorm' || current.type === 'Monsoon') {
      weatherBadge.style.borderColor = 'var(--blood-red)';
      weatherBadge.style.color = 'var(--blood-red)';
    } else {
      weatherBadge.style.borderColor = 'var(--warning-yellow)';
      weatherBadge.style.color = 'var(--warning-yellow)';
    }
  }
  if (activeTab === 'radio') {
    renderRadioUI();
  }
}

function updateRadioUI() {
  if (!isBrowser) return;
  const radioBadge = document.getElementById('radio-status');
  const tabBadge = document.getElementById('radio-tab-badge');
  if (radioSystem) {
    const active = radioSystem.getActiveMessages();
    if (active.length > 0) {
      if (radioBadge) {
        radioBadge.style.display = 'inline-block';
        radioBadge.textContent = `RADIO: ${active.length} URGENT CALL${active.length === 1 ? '' : 'S'}`;
        radioBadge.style.borderColor = 'var(--blood-red)';
        radioBadge.style.color = 'var(--blood-red)';
      }
      if (tabBadge) {
        tabBadge.textContent = active.length;
        tabBadge.classList.remove('hidden');
      }
    } else {
      if (radioBadge) {
        radioBadge.style.display = 'none';
      }
      if (tabBadge) {
        tabBadge.textContent = '0';
        tabBadge.classList.add('hidden');
      }
    }
  }
  if (activeTab === 'radio') {
    renderRadioUI();
  }
}

function updateEnemyUI() {
  if (!isBrowser) return;
  const enemyBadge = document.getElementById('enemy-status');
  if (enemyBadge && enemyCommander) {
    const state = enemyCommander.getState();
    enemyBadge.textContent = `NVA: ${state.currentStrategy.toUpperCase()}`;
    if (state.currentStrategy === 'Full Assault' || state.currentStrategy === 'Hunt') {
      enemyBadge.style.borderColor = 'var(--blood-red)';
      enemyBadge.style.color = '#ff4d4d';
    } else if (state.currentStrategy === 'Ambush') {
      enemyBadge.style.borderColor = 'var(--warning-yellow)';
      enemyBadge.style.color = 'var(--warning-yellow)';
    } else {
      enemyBadge.style.borderColor = 'var(--smoke-gray)';
      enemyBadge.style.color = '#ff8888';
    }
  }
}

function updateAmbushUI() {
  if (!isBrowser) return;
  const ambushBadge = document.getElementById('ambush-status');
  if (ambushBadge && ambushSystem) {
    const tension = ambushSystem.getActiveTension();
    if (tension) {
      ambushBadge.style.display = 'inline-block';
      ambushBadge.textContent = `TENSION: ${tension.probableThreat.toUpperCase()}`;
      ambushBadge.style.borderColor = 'var(--warning-yellow)';
      ambushBadge.style.color = 'var(--warning-yellow)';
    } else {
      ambushBadge.style.display = 'none';
    }
  }
}

function updateExtractionUI() {
  if (!isBrowser) return;
  const extractionBadge = document.getElementById('extraction-status');
  if (extractionBadge && extractionSystem) {
    if (extractionSystem.executed) {
      const summary = extractionSystem.getExtractionSummary();
      extractionBadge.style.display = 'inline-block';
      extractionBadge.textContent = `EXTRACTION: ${summary.name.toUpperCase()}`;
      extractionBadge.style.borderColor = summary.badgeColor || 'var(--terminal-green)';
      extractionBadge.style.color = summary.badgeColor || 'var(--terminal-green)';
    } else if (extractionSystem.calculatedEnding) {
      extractionBadge.style.display = 'inline-block';
      extractionBadge.textContent = `EXTRACTION: ${extractionSystem.calculatedEnding.name.toUpperCase()}`;
      extractionBadge.style.borderColor = 'var(--warning-yellow)';
      extractionBadge.style.color = 'var(--warning-yellow)';
    } else {
      extractionBadge.style.display = 'none';
    }
  }
}

/**
 * UI hook for the Dynamic Extraction conclusion.
 * Renders emergent war story summary, medal citations, survivors list, and fallen honors.
 * @param {object} payload
 */
function renderExtractionConclusionUI(payload = {}) {
  if (!isBrowser) return;

  switchTab('briefing');

  const narrativeEl = document.getElementById('narrative-text');
  const choicesEl = document.getElementById('choices-container');
  const locationEl = document.getElementById('scene-location');

  if (locationEl) {
    locationEl.textContent = '📍 LZ X-Ray / Airborne over Khe Sanh - Mission Debriefing';
  }

  const summary = payload.summary || extractionSystem.getExtractionSummary();
  const epilogue = payload.epilogue || summary.epilogue || extractionSystem.generateWarStoryEpilogue();

  if (narrativeEl) {
    narrativeEl.innerHTML = `
      <div style="border-bottom: 2px solid ${summary.badgeColor || 'var(--warning-yellow)'}; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span style="font-family: 'Saira Condensed', sans-serif; font-size: 1.6rem; color: ${summary.badgeColor || 'var(--warning-yellow)'}; letter-spacing: 1.5px; text-transform: uppercase;">
            ${summary.name.toUpperCase()}
          </span>
          <span class="status-badge" style="border-color: ${summary.badgeColor || 'var(--warning-yellow)'}; color: ${summary.badgeColor || 'var(--warning-yellow)'};">
            RISK: ${summary.tacticalRisk?.toUpperCase() || 'EVALUATED'}
          </span>
        </div>
        <div style="color: var(--dust-tan); font-size: 0.95rem; font-style: italic; margin-top: 4px;">
          ${summary.subtitle}
        </div>
      </div>

      <div style="color: var(--dust-tan); font-size: 0.95rem; line-height: 1.7; margin-bottom: 16px; white-space: pre-wrap;">
        ${epilogue}
      </div>
    `;
  }

  if (choicesEl) {
    choicesEl.innerHTML = `
      <!-- Citations & Medals Section -->
      ${summary.medals && summary.medals.length > 0 ? `
        <div style="background: rgba(0, 0, 0, 0.4); border-left: 4px solid var(--warning-yellow); padding: 12px 16px; margin-bottom: 12px;">
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 1.1rem; color: var(--warning-yellow); margin-bottom: 8px; text-transform: uppercase;">
            🎖️ Official Military Decorations &amp; Citations (${summary.medals.length})
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${summary.medals.map(m => `
              <div style="font-size: 0.85rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
                <span style="color: var(--warning-yellow); font-weight: bold;">${m.medal}</span>
                <span style="color: var(--dust-tan);"> — ${m.soldierName}</span>
                <div style="color: var(--smoke-gray); font-style: italic; font-size: 0.8rem; margin-top: 2px;">"${m.citationText}"</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Squad Roll Section (Survivors & Fallen) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <!-- Survivors -->
        <div style="background: rgba(0, 0, 0, 0.4); border-left: 4px solid var(--terminal-green); padding: 12px 16px;">
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 1.1rem; color: var(--terminal-green); margin-bottom: 6px; text-transform: uppercase;">
            ✓ Survivors Roll (${summary.survivorCount})
          </div>
          ${summary.survivors.length === 0 ? '<div style="font-size: 0.85rem; color: var(--smoke-gray);">No survivors recorded.</div>' : `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
              ${summary.survivors.map(s => `
                <li style="color: var(--dust-tan);">
                  <strong>${s.name}</strong> <span style="color: var(--smoke-gray);">(${s.role})</span>
                  ${s.conditions && s.conditions.length > 0 ? `<div style="color: #ff9800; font-size: 0.75rem;">Condition: ${s.conditions.join(', ')}</div>` : ''}
                </li>
              `).join('')}
            </ul>
          `}
        </div>

        <!-- Fallen Honors -->
        <div style="background: rgba(0, 0, 0, 0.4); border-left: 4px solid var(--blood-red); padding: 12px 16px;">
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 1.1rem; color: #ff6b6b; margin-bottom: 6px; text-transform: uppercase;">
            ✝ Fallen Honors (${summary.fallenCount})
          </div>
          ${summary.fallen.length === 0 ? '<div style="font-size: 0.85rem; color: var(--terminal-green);">No casualties sustained during campaign.</div>' : `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
              ${summary.fallen.map(f => `
                <li style="color: #ff6b6b;">
                  <strong>${f.name}</strong> <span style="color: var(--smoke-gray);">(${f.role})</span>
                  <div style="color: var(--smoke-gray); font-size: 0.75rem;">Cause: ${f.cause}</div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>

      <!-- Action Button -->
      <button id="btn-restart-campaign" style="cursor: pointer; padding: 14px 20px; background: var(--blood-red); color: #ffffff; border: 2px solid #ffffff; font-family: inherit; font-size: 1rem; font-weight: bold; width: 100%; transition: all 0.2s ease;">
        [ Start New Campaign / Re-deploy Squad ]
      </button>
    `;

    const restartBtn = document.getElementById('btn-restart-campaign');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        saveManager.clearSave();
        ledger.reset();
        squadManager.resetToDefault();
        extractionSystem.calculatedEnding = null;
        extractionSystem.executed = false;
        extractionSystem.endingId = null;
        extractionSystem.epilogue = null;
        extractionSystem.summary = null;
        sceneManager.loadScene('start');
        updateLedgerUI();
        updateSquadUI();
        updateSaveStatusUI();
        updateExtractionUI();
      });
    }
  }
}

/**
 * Renders the Field Radio (AN/PRC-25) Console panel.
 */
function renderRadioUI() {
  if (!isBrowser) return;
  const container = document.getElementById('radio-panel-content');
  const netInfoEl = document.getElementById('radio-net-info');
  const tabBadge = document.getElementById('radio-tab-badge');
  const radioStatusBadge = document.getElementById('radio-status');

  if (!container || !radioSystem) return;

  const reception = radioSystem.getReceptionQuality();
  const activeMessages = radioSystem.getActiveMessages();
  const currentMeta = CHANNEL_METADATA[activeRadioChannel] || CHANNEL_METADATA[RADIO_CHANNELS.HQ];
  const weather = weatherSystem ? weatherSystem.getCurrentWeather() : { name: 'Clear' };
  const weatherMod = radioSystem.receptionModifier || 0;

  if (tabBadge) {
    if (activeMessages.length > 0) {
      tabBadge.textContent = activeMessages.length;
      tabBadge.classList.remove('hidden');
    } else {
      tabBadge.textContent = '0';
      tabBadge.classList.add('hidden');
    }
  }

  if (radioStatusBadge) {
    if (activeMessages.length > 0) {
      radioStatusBadge.style.display = 'inline-block';
      radioStatusBadge.textContent = `RADIO: ${activeMessages.length} URGENT CALL${activeMessages.length === 1 ? '' : 'S'}`;
      radioStatusBadge.style.borderColor = 'var(--blood-red)';
      radioStatusBadge.style.color = 'var(--blood-red)';
    } else {
      radioStatusBadge.style.display = 'inline-block';
      radioStatusBadge.textContent = `RADIO: ${currentMeta.callsign.toUpperCase()}`;
      radioStatusBadge.style.borderColor = 'var(--radio-green)';
      radioStatusBadge.style.color = 'var(--terminal-green)';
    }
  }

  if (netInfoEl) {
    netInfoEl.textContent = `${currentMeta.frequency} • ${currentMeta.callsign}`;
  }

  let meterColor = 'var(--terminal-green)';
  if (reception < 40) meterColor = 'var(--blood-red)';
  else if (reception < 70) meterColor = 'var(--warning-yellow)';

  container.innerHTML = `
    <div class="radio-console">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="font-size: 0.85rem; color: var(--warning-yellow); font-weight: bold; text-transform: uppercase;">
          Tactical Frequencies (AN/PRC-25)
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="btn-dial-down" style="padding: 4px 10px; background: rgba(0,0,0,0.6); border: 1px solid var(--earth-brown); color: var(--dust-tan); font-family: inherit; font-size: 0.8rem; cursor: pointer;">◄ -0.5 MHz</button>
          <span style="font-size: 0.85rem; color: var(--terminal-green); font-weight: bold; min-width: 85px; text-align: center;">${tunedFrequency.toFixed(2)} MHz</span>
          <button id="btn-dial-up" style="padding: 4px 10px; background: rgba(0,0,0,0.6); border: 1px solid var(--earth-brown); color: var(--dust-tan); font-family: inherit; font-size: 0.8rem; cursor: pointer;">+0.5 MHz ►</button>
        </div>
      </div>

      <div class="radio-channel-bar">
        ${Object.values(RADIO_CHANNELS).map(ch => {
          const m = CHANNEL_METADATA[ch];
          const isAct = ch === activeRadioChannel;
          return `<button class="channel-btn ${isAct ? 'active' : ''}" data-channel="${ch}">${m.callsign} [${ch}]</button>`;
        }).join('')}
      </div>

      <div style="background: rgba(0, 0, 0, 0.4); border-left: 3px solid var(--radio-green); padding: 10px 14px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: var(--warning-yellow); font-weight: bold;">${currentMeta.name}</span>
          <span style="color: var(--terminal-green); font-family: monospace;">${currentMeta.frequency}</span>
        </div>
        <div style="color: var(--smoke-gray); font-size: 0.8rem;">${currentMeta.description}</div>
      </div>

      <div class="reception-meter-box">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span style="color: var(--dust-tan); font-weight: bold;">SIGNAL RECEPTION QUALITY:</span>
          <span style="color: ${meterColor}; font-weight: bold;">${reception}% ${weatherMod < 0 ? `(${weather.name} ${weatherMod}%)` : '(Clear Signal)'}</span>
        </div>
        <div class="reception-meter-bar">
          <div class="reception-meter-fill" style="width: ${reception}%; background: ${meterColor};"></div>
        </div>
        <div style="font-size: 0.75rem; color: var(--smoke-gray);">
          Atmospheric condition: <strong>${weather.name}</strong> • ${reception >= 70 ? 'Optimal Voice Clarity' : (reception >= 40 ? 'Moderate Atmospheric Static' : 'Severe Electromagnetic Distortion')}
        </div>
      </div>

      <div style="margin-top: 4px;">
        <div style="font-size: 0.9rem; color: var(--warning-yellow); font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">
          ⚡ Active Urgent Transmissions (${activeMessages.length})
        </div>
        ${activeMessages.length === 0 ? `
          <div style="padding: 12px; background: rgba(0,0,0,0.3); color: var(--smoke-gray); font-style: italic; font-size: 0.85rem; border: 1px dashed var(--earth-brown);">
            Net clear. No urgent incoming transmissions awaiting command resolution.
          </div>
        ` : activeMessages.map(msg => `
          <div class="tx-card urgent">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <span style="color: #ff6b6b; font-weight: bold; text-transform: uppercase; font-size: 0.85rem;">[PRIORITY TRAFFIC] ${msg.callsign} (${msg.channel})</span>
              <span style="font-size: 0.75rem; color: var(--warning-yellow);">Window: ${msg.remainingLifetime ?? 1} turn${msg.remainingLifetime === 1 ? '' : 's'} remaining</span>
            </div>
            <div style="color: var(--dust-tan); font-size: 0.9rem; line-height: 1.4; white-space: pre-wrap;">
              "${msg.text}"
            </div>
            ${msg.choices && msg.choices.length > 0 ? `
              <div class="tx-choices">
                ${msg.choices.map((c, i) => `
                  <button class="tx-choice-btn" data-msgid="${msg.id}" data-choicekey="${c.key || c.id}">
                    <strong style="color: var(--warning-yellow);">[${i + 1}]</strong> ${c.text}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 6px;">
        <div style="font-size: 0.85rem; color: var(--smoke-gray); font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">
          Radio Communication Log (${radioSystem.history.length})
        </div>
        <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
          ${radioSystem.history.length === 0 ? `
            <div style="font-size: 0.8rem; color: var(--smoke-gray); font-style: italic;">No transmissions logged on net yet.</div>
          ` : [...radioSystem.history].reverse().slice(0, 20).map(tx => `
            <div style="padding: 8px 12px; background: rgba(0,0,0,0.4); border-left: 3px solid ${tx.direction === 'outgoing' ? 'var(--warning-yellow)' : 'var(--radio-green)'}; font-size: 0.8rem;">
              <div style="display: flex; justify-content: space-between; color: var(--smoke-gray); font-size: 0.7rem; margin-bottom: 2px;">
                <span>${tx.direction === 'outgoing' ? '▲ OUTGOING' : '▼ INCOMING'} [${tx.channel}] • ${tx.callsign || tx.sender}</span>
                <span>${new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div style="color: var(--dust-tan);">${tx.text}</div>
              ${tx.selectedDecision ? `
                <div style="color: var(--terminal-green); font-size: 0.75rem; margin-top: 4px;">
                  ✓ Resolution: ${tx.selectedDecision.text}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRadioChannel = btn.getAttribute('data-channel');
      const meta = CHANNEL_METADATA[activeRadioChannel];
      if (meta && meta.frequency) {
        tunedFrequency = parseFloat(meta.frequency) || tunedFrequency;
      }
      renderRadioUI();
    });
  });

  const btnDown = container.querySelector('#btn-dial-down');
  const btnUp = container.querySelector('#btn-dial-up');
  if (btnDown) {
    btnDown.addEventListener('click', () => {
      tunedFrequency = Math.max(30.0, tunedFrequency - 0.5);
      renderRadioUI();
    });
  }
  if (btnUp) {
    btnUp.addEventListener('click', () => {
      tunedFrequency = Math.min(76.0, tunedFrequency + 0.5);
      renderRadioUI();
    });
  }

  container.querySelectorAll('.tx-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgId = btn.getAttribute('data-msgid');
      const choiceKey = btn.getAttribute('data-choicekey');
      if (msgId && choiceKey && radioSystem) {
        radioSystem.makeDecision(msgId, choiceKey);
        renderRadioUI();
        updateLedgerUI();
      }
    });
  });
}

/**
 * Renders the War Journal & Medal Citations reader panel.
 */
function renderJournalUI() {
  if (!isBrowser) return;
  const container = document.getElementById('journal-panel-content');
  if (!container || !journal) return;

  const entries = journal.getEntries ? journal.getEntries() : [];
  const medals = heroicActionManager ? heroicActionManager.getMedals() : [];
  const deadSoldiers = squadManager ? squadManager.getSoldiers().filter(s => !s.isAlive) : [];

  let filtered = entries;
  if (activeJournalFilter === 'COMBAT') {
    filtered = entries.filter(e => e.category === 'COMBAT');
  } else if (activeJournalFilter === 'CASUALTIES') {
    filtered = entries.filter(e => e.category === 'CASUALTY');
  } else if (activeJournalFilter === 'HEROISM & MEDALS') {
    filtered = entries.filter(e => e.category === 'HEROISM');
  } else if (activeJournalFilter === 'COMMAND') {
    filtered = entries.filter(e => e.category === 'COMMAND');
  } else if (activeJournalFilter === 'WEATHER') {
    filtered = entries.filter(e => e.category === 'WEATHER');
  }

  container.innerHTML = `
    <div class="journal-filters">
      ${['ALL', 'COMBAT', 'CASUALTIES', 'HEROISM & MEDALS', 'COMMAND', 'WEATHER'].map(cat => `
        <button class="journal-filter-btn ${activeJournalFilter === cat ? 'active' : ''}" data-cat="${cat}">
          ${cat} ${cat === 'ALL' ? `(${entries.length})` : ''}
        </button>
      `).join('')}
    </div>

    ${(medals.length > 0 && (activeJournalFilter === 'ALL' || activeJournalFilter === 'HEROISM & MEDALS')) ? `
      <div style="margin-bottom: 20px;">
        <div style="font-family: 'Saira Condensed', sans-serif; font-size: 1.2rem; color: var(--warning-yellow); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
          🎖️ Official Military Decorations &amp; Citations (${medals.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${medals.map(m => `
            <div class="citation-box">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span class="citation-title">${m.medal || m.decoration || 'Military Decoration'}</span>
                <span style="font-size: 0.75rem; color: var(--smoke-gray);">${m.timestamp || ''}</span>
              </div>
              <div style="color: var(--dust-tan); font-weight: bold; font-size: 0.95rem; margin-bottom: 6px;">
                Conferred upon: <span style="color: #ffffff;">${m.soldierName || m.recipient || 'Soldier'}</span>
                ${m.actionType ? `<span style="font-size: 0.8rem; color: var(--warning-yellow); margin-left: 8px;">[${m.actionType}]</span>` : ''}
              </div>
              <div style="color: var(--dust-tan); font-style: italic; font-size: 0.85rem; line-height: 1.6; background: rgba(0,0,0,0.3); padding: 10px; border-left: 3px solid var(--warning-yellow);">
                "${m.citationText || m.citation || 'For conspicuous gallantry and intrepidity at the risk of his life.'}"
              </div>
              ${m.location ? `<div style="font-size: 0.75rem; color: var(--smoke-gray); margin-top: 6px;">Location: 📍 ${m.location}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${(deadSoldiers.length > 0 && (activeJournalFilter === 'ALL' || activeJournalFilter === 'CASUALTIES')) ? `
      <div style="background: rgba(139, 46, 46, 0.15); border: 1px solid var(--blood-red); border-left: 5px solid var(--blood-red); padding: 14px; margin-bottom: 16px;">
        <div style="font-family: 'Saira Condensed', sans-serif; font-size: 1.15rem; color: #ff6b6b; margin-bottom: 8px; text-transform: uppercase;">
          ✝ In Memoriam: Fallen Squad Members (${deadSoldiers.length})
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; font-size: 0.85rem;">
          ${deadSoldiers.map(s => `
            <div style="padding: 6px 10px; background: rgba(0,0,0,0.4); border-left: 3px solid var(--blood-red);">
              <span style="color: #ff8888; font-weight: bold;">${s.name}</span>
              <span style="color: var(--smoke-gray);"> (${s.role})</span>
              <div style="color: var(--smoke-gray); font-size: 0.75rem;">Status: ${s.status.toUpperCase()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${filtered.length === 0 ? `
        <div style="padding: 16px; background: rgba(0,0,0,0.3); color: var(--smoke-gray); font-style: italic; text-align: center; border: 1px dashed var(--earth-brown);">
          No journal entries recorded for filter "${activeJournalFilter}".
        </div>
      ` : [...filtered].reverse().map(e => {
        const catClass = (e.category || 'combat').toLowerCase();
        return `
          <div class="journal-card ${catClass}">
            <div class="journal-meta">
              <span style="color: var(--warning-yellow); font-weight: bold; text-transform: uppercase;">
                [${e.category}] ${e.title || 'Mission Dispatch'}
              </span>
              <span>${e.timestamp || journal.formatTimestamp(new Date())}</span>
            </div>
            <div style="color: var(--dust-tan); font-size: 0.9rem; line-height: 1.5; margin: 4px 0;">
              ${e.content}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--smoke-gray); margin-top: 4px;">
              <span>📍 ${e.location || journal.currentLocation}</span>
              ${e.tags && e.tags.length > 0 ? `
                <span style="display: flex; gap: 4px;">
                  ${e.tags.map(t => `<span style="background: rgba(0,0,0,0.5); padding: 1px 6px; border-radius: 2px;">#${t}</span>`).join('')}
                </span>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.journal-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeJournalFilter = btn.getAttribute('data-cat');
      renderJournalUI();
    });
  });
}

/**
 * Renders the Advanced AOR Tactical Map panel with SVG overlay, breadcrumbs, and Intel-gated markers.
 */
function renderTacticalMapUI() {
  if (!isBrowser) return;
  const container = document.getElementById('map-panel-content');
  const coordReadout = document.getElementById('coordinate-readout');
  if (!container || !tacticalMapManager) return;

  const curPos = tacticalMapManager.currentPosition || { x: 50, y: 50, sceneId: 'start' };
  const intelTier = intelSystem ? intelSystem.getIntelTier() : 'LOW';
  const visibleMarkers = tacticalMapManager.getMarkers ? tacticalMapManager.getMarkers() : [];
  const breadcrumbs = tacticalMapManager.pathHistory || [];

  if (coordReadout) {
    coordReadout.textContent = `AOR GRID 881 • SQUAD POS: [X: ${curPos.x.toFixed(1)}%, Y: ${curPos.y.toFixed(1)}%] • ${intelTier} INTEL`;
  }

  const displayedMarkers = visibleMarkers.filter(m => {
    if (m.type === 'enemy_location' && !mapLayers.enemy) return false;
    if (m.type === 'ambush' && !mapLayers.ambushes) return false;
    if (m.type === 'mortar_impact' && !mapLayers.mortars) return false;
    if (m.type === 'minefield' && !mapLayers.minefields) return false;
    if (m.type === 'recon_discovery' && !mapLayers.recon) return false;
    if (m.type === 'casualty' && !mapLayers.casualties) return false;
    return true;
  });

  const polylinePoints = breadcrumbs.map(b => `${b.x},${b.y}`).join(' ');

  container.innerHTML = `
    <div class="map-layer-bar">
      <span style="color: var(--warning-yellow); font-weight: bold; margin-right: 6px;">LAYERS:</span>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-enemy" ${mapLayers.enemy ? 'checked' : ''}>
        <span>Enemy [HIGH]</span>
      </label>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-ambushes" ${mapLayers.ambushes ? 'checked' : ''}>
        <span>Ambushes [MED]</span>
      </label>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-mortars" ${mapLayers.mortars ? 'checked' : ''}>
        <span>Mortars [MED]</span>
      </label>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-minefields" ${mapLayers.minefields ? 'checked' : ''}>
        <span>Minefields [HIGH]</span>
      </label>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-recon" ${mapLayers.recon ? 'checked' : ''}>
        <span>Recon [MED]</span>
      </label>
      <label class="map-layer-item">
        <input type="checkbox" id="layer-casualties" ${mapLayers.casualties ? 'checked' : ''}>
        <span>Casualties [LOW]</span>
      </label>
    </div>

    <div class="map-canvas-container" id="tactical-svg-container">
      <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">
        <defs>
          <filter id="mapGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
          </filter>
        </defs>

        <path d="M5,20 Q30,5 60,25 T95,15" fill="none" stroke="rgba(74,246,38,0.14)" stroke-width="0.5" />
        <path d="M0,45 Q40,30 70,55 T100,40" fill="none" stroke="rgba(74,246,38,0.14)" stroke-width="0.5" />
        <path d="M10,75 Q45,60 75,80 T100,70" fill="none" stroke="rgba(74,246,38,0.14)" stroke-width="0.5" />
        <path d="M25,95 Q55,85 85,98" fill="none" stroke="rgba(74,246,38,0.14)" stroke-width="0.5" />

        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(74,246,38,0.15)" stroke-width="0.4" stroke-dasharray="1,2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(74,246,38,0.15)" stroke-width="0.4" stroke-dasharray="1,2" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(74,246,38,0.1)" stroke-width="0.4" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(74,246,38,0.1)" stroke-width="0.4" />

        ${breadcrumbs.length > 1 ? `
          <polyline points="${polylinePoints}" fill="none" stroke="var(--terminal-green)" stroke-width="0.8" stroke-dasharray="1.5,1" filter="url(#mapGlow)" />
        ` : ''}
        ${breadcrumbs.map(b => `
          <circle cx="${b.x}" cy="${b.y}" r="0.8" fill="var(--terminal-green)" opacity="0.7">
            <title>Waypoint [${b.sceneId}] - ${b.timestamp}</title>
          </circle>
        `).join('')}

        ${displayedMarkers.map(m => {
          let markerColor = 'var(--terminal-green)';
          let shape = 'circle';
          if (m.type === 'enemy_location') { markerColor = 'var(--blood-red)'; shape = 'diamond'; }
          else if (m.type === 'ambush') { markerColor = '#ff9800'; shape = 'triangle'; }
          else if (m.type === 'mortar_impact') { markerColor = '#ff4444'; shape = 'cross'; }
          else if (m.type === 'minefield') { markerColor = 'var(--warning-yellow)'; shape = 'square'; }
          else if (m.type === 'casualty') { markerColor = '#ff2222'; shape = 'cross'; }
          else if (m.type === 'recon_discovery') { markerColor = '#a78bfa'; shape = 'diamond'; }
          else if (m.type === 'extraction_zone') { markerColor = '#4af626'; shape = 'circle'; }

          return `
            <g transform="translate(${m.x}, ${m.y})" style="cursor: pointer;">
              <title>${m.label} [${m.type.toUpperCase()}]</title>
              ${shape === 'diamond' ? `
                <polygon points="0,-2.2 2.2,0 0,2.2 -2.2,0" fill="${markerColor}" stroke="#ffffff" stroke-width="0.3" />
              ` : shape === 'triangle' ? `
                <polygon points="0,-2.2 2.2,1.8 -2.2,1.8" fill="${markerColor}" stroke="#000" stroke-width="0.3" />
              ` : shape === 'square' ? `
                <rect x="-1.5" y="-1.5" width="3" height="3" fill="${markerColor}" stroke="#ffffff" stroke-width="0.3" />
              ` : shape === 'cross' ? `
                <line x1="-1.8" y1="0" x2="1.8" y2="0" stroke="${markerColor}" stroke-width="0.8" />
                <line x1="0" y1="-1.8" x2="0" y2="1.8" stroke="${markerColor}" stroke-width="0.8" />
              ` : `
                <circle cx="0" cy="0" r="1.8" fill="${markerColor}" stroke="#ffffff" stroke-width="0.4" />
              `}
              <text x="3" y="1" fill="${markerColor}" font-size="2.2" font-family="'Courier Prime', monospace" font-weight="bold">${m.label}</text>
            </g>
          `;
        }).join('')}

        <g transform="translate(${curPos.x}, ${curPos.y})">
          <circle cx="0" cy="0" r="3.5" fill="none" stroke="var(--warning-yellow)" stroke-width="0.5" opacity="0.6">
            <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="1.8" fill="var(--warning-yellow)" stroke="#ffffff" stroke-width="0.5" />
          <text x="3" y="1.2" fill="var(--warning-yellow)" font-size="2.6" font-family="'Saira Condensed', sans-serif" font-weight="bold">SQUAD</text>
        </g>
      </svg>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 0.75rem; color: var(--smoke-gray);">
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <span><strong style="color: var(--warning-yellow);">● SQUAD:</strong> Active Position</span>
        <span><strong style="color: var(--terminal-green);">─ TRAIL:</strong> Patrol Breadcrumbs</span>
        <span><strong style="color: var(--blood-red);">◆ ENEMY:</strong> Hostile Contacts</span>
        <span><strong style="color: #ff9800;">▲ AMBUSH:</strong> Danger Zones</span>
        <span><strong style="color: #ff2222;">✚ WIA/KIA:</strong> Casualty Sites</span>
        <span><strong style="color: #4af626;">◎ LZ:</strong> Extraction Zone</span>
      </div>
      <div style="color: var(--terminal-green); font-family: monospace;">
        Intel Tier: <strong>${intelTier}</strong>
      </div>
    </div>
  `;

  container.querySelectorAll('.map-layer-item input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'layer-enemy') mapLayers.enemy = e.target.checked;
      else if (id === 'layer-ambushes') mapLayers.ambushes = e.target.checked;
      else if (id === 'layer-mortars') mapLayers.mortars = e.target.checked;
      else if (id === 'layer-minefields') mapLayers.minefields = e.target.checked;
      else if (id === 'layer-recon') mapLayers.recon = e.target.checked;
      else if (id === 'layer-casualties') mapLayers.casualties = e.target.checked;
      renderTacticalMapUI();
    });
  });
}

/**
 * Renders the Squad Psych & Dossier panel covering 9 soldier cards with trust matrices and triage status.
 */
function renderDossierUI() {
  if (!isBrowser) return;
  const container = document.getElementById('dossier-panel-content');
  const counterEl = document.getElementById('dossier-counter');
  if (!container || !squadManager) return;

  const soldiers = squadManager.getSoldiers();
  const alive = squadManager.getAliveSoldiers();
  const woundedSoldiers = woundedSoldierManager ? woundedSoldierManager.getWoundedSoldiers() : [];
  const woundedMap = new Map();
  if (woundedSoldierManager) {
    for (const [wId, rec] of woundedSoldierManager.woundedSoldiers.entries()) {
      woundedMap.set(wId, rec);
    }
  }

  if (counterEl) {
    counterEl.textContent = `${alive.length}/${soldiers.length} Ready • ${woundedSoldiers.length} Wounded • ${soldiers.length - alive.length} KIA`;
  }

  container.innerHTML = `
    <div class="dossier-grid">
      ${soldiers.map(s => {
        const sId = String(s.id).toLowerCase();
        const isDead = !s.isAlive;
        const isWounded = s.status === 'wounded';
        const woundedRec = woundedMap.get(sId);

        let healthPct = 100;
        let healthLabel = '100% HEALTHY';
        if (isDead) {
          healthPct = 0;
          healthLabel = s.status === 'abandoned' ? '0% ABANDONED' : '0% KIA';
        } else if (isWounded) {
          const sev = woundedRec?.severity || 'moderate';
          if (sev === 'light') { healthPct = 75; healthLabel = '75% (LIGHT WOUND)'; }
          else if (sev === 'moderate') { healthPct = 50; healthLabel = '50% (MODERATE WOUND)'; }
          else if (sev === 'severe') { healthPct = 25; healthLabel = '25% (SEVERE WOUND)'; }
          else if (sev === 'critical') { healthPct = 10; healthLabel = '10% (CRITICAL TRAUMA)'; }
        }

        const relationships = relationshipManager ? relationshipManager.getRelationshipsFor(s.id) : [];

        const condNames = conditionManager ? conditionManager.getConditionsFor(s.id) : (s.conditions || []);

        let triageInfo = null;
        if (isWounded) {
          let carrierName = null;
          if (woundedRec && woundedRec.carrierId) {
            const carrier = squadManager.getSoldierById(woundedRec.carrierId);
            carrierName = carrier ? carrier.name : woundedRec.carrierId;
          }
          triageInfo = {
            severity: woundedRec?.severity || 'moderate',
            bleedoutTimer: woundedRec?.bleedoutTimer ?? 3,
            isStabilized: Boolean(woundedRec?.isStabilized),
            carriedBy: carrierName
          };
        }

        let carryingCasName = null;
        if (woundedSoldierManager && woundedSoldierManager.carrierToWounded.has(sId)) {
          const targetWoundedId = woundedSoldierManager.carrierToWounded.get(sId);
          const targetWounded = squadManager.getSoldierById(targetWoundedId);
          carryingCasName = targetWounded ? targetWounded.name : targetWoundedId;
        }

        const moraleColor = s.morale > 50 ? 'var(--radio-green)' : (s.morale > 25 ? 'var(--warning-yellow)' : 'var(--blood-red)');

        return `
          <div class="dossier-card ${isDead ? 'kia' : (isWounded ? 'wounded' : '')}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
              <div>
                <div style="font-size: 1.1rem; font-weight: bold; color: ${isDead ? '#ff6b6b' : (isWounded ? 'var(--warning-yellow)' : 'var(--dust-tan)')};">
                  ${s.name} ${isDead ? '(KIA)' : (isWounded ? '(WIA)' : '')}
                </div>
                <div style="font-size: 0.8rem; color: var(--smoke-gray);">${s.role}</div>
              </div>
              <span class="status-badge" style="
                margin-top: 0;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-color: ${isDead ? 'var(--blood-red)' : (isWounded ? 'var(--warning-yellow)' : 'var(--radio-green)')};
                color: ${isDead ? '#ff6b6b' : (isWounded ? 'var(--warning-yellow)' : 'var(--terminal-green)')};
              ">
                ${isDead ? (s.status.toUpperCase()) : (isWounded ? 'WOUNDED IN ACTION' : 'FIT FOR DUTY')}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
              <div>
                <div style="display: flex; justify-content: space-between; color: var(--smoke-gray); margin-bottom: 2px;">
                  <span>VITALITY</span>
                  <span style="font-weight: bold; color: ${healthPct > 50 ? 'var(--terminal-green)' : (healthPct > 20 ? 'var(--warning-yellow)' : 'var(--blood-red)')};">${healthLabel}</span>
                </div>
                <div style="height: 5px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                  <div style="height: 100%; width: ${healthPct}%; background: ${healthPct > 50 ? 'var(--terminal-green)' : (healthPct > 20 ? 'var(--warning-yellow)' : 'var(--blood-red)')}; transition: width 0.3s ease;"></div>
                </div>
              </div>

              ${!isDead ? `
                <div>
                  <div style="display: flex; justify-content: space-between; color: var(--smoke-gray); margin-bottom: 2px;">
                    <span>MORALE</span>
                    <span style="font-weight: bold; color: ${moraleColor};">${s.morale}%</span>
                  </div>
                  <div style="height: 5px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${s.morale}%; background: ${moraleColor}; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              ` : ''}
            </div>

            <div style="font-size: 0.75rem; color: var(--dust-tan);">
              <span style="color: var(--smoke-gray);">TRAITS:</span> 
              <span style="color: var(--warning-yellow);">${(s.getTraits ? s.getTraits() : [s.trait]).join(', ')}</span>
            </div>

            <div style="font-size: 0.75rem;">
              <div style="color: var(--smoke-gray); margin-bottom: 3px;">PSYCHOLOGICAL CONDITIONS:</div>
              ${condNames.length === 0 ? `
                <span style="color: var(--smoke-gray); font-style: italic; font-size: 0.7rem;">None (Mentally Composed)</span>
              ` : condNames.map(cn => {
                const def = PSYCHOLOGICAL_CONDITIONS[cn];
                let condClass = 'negative';
                if (def && def.category === 'psychological_positive') condClass = 'positive';
                else if (def && def.category === 'situational_mixed') condClass = 'mixed';
                return `<span class="condition-pill ${condClass}" title="${def?.description || ''}">${cn}</span>`;
              }).join('')}
            </div>

            <div style="font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 2px;">
              <div style="color: var(--smoke-gray); margin-bottom: 4px; font-weight: bold;">TRUST MATRIX:</div>
              ${relationships.length === 0 ? `
                <div style="color: var(--smoke-gray); font-style: italic; font-size: 0.7rem;">No bond records logged.</div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  ${relationships.slice(0, 3).map(rel => {
                    const oId = rel.soldierId1 === sId ? rel.soldierId2 : rel.soldierId1;
                    const oSoldier = squadManager.getSoldierById(oId);
                    const oName = oSoldier ? oSoldier.name : oId;
                    const isFriend = rel.trust >= 60 || rel.type === 'friendship' || rel.type === 'mentorship';
                    const isRival = rel.trust <= 35 || rel.type === 'rivalry';
                    return `
                      <div class="trust-row">
                        <span class="${isFriend ? 'trust-friend' : (isRival ? 'trust-rival' : 'trust-neutral')}">
                          ${isFriend ? '★ ' : (isRival ? '⚔ ' : '• ')}${oName}
                        </span>
                        <span style="color: ${rel.trust >= 60 ? 'var(--terminal-green)' : (rel.trust <= 35 ? '#ff6b6b' : 'var(--smoke-gray)')};">
                          ${rel.trust}% (${rel.type})
                        </span>
                      </div>
                    `;
                  }).join('')}
                  ${relationships.length > 3 ? `<div style="color: var(--smoke-gray); font-size: 0.65rem; text-align: right;">+${relationships.length - 3} other comrade bonds</div>` : ''}
                </div>
              `}
            </div>

            ${isWounded && triageInfo ? `
              <div style="background: rgba(139, 46, 46, 0.2); border-left: 3px solid var(--warning-yellow); padding: 6px 8px; font-size: 0.75rem;">
                <div style="color: var(--warning-yellow); font-weight: bold;">TRIAGE STATUS: ${triageInfo.severity.toUpperCase()}</div>
                <div style="color: var(--dust-tan); margin-top: 2px;">
                  ${triageInfo.isStabilized ? '✓ Hemorrhage stabilized by Medic (Bleedout paused)' : (
                    triageInfo.carriedBy ? `✓ Being carried by ${triageInfo.carriedBy} (Bleedout paused)` : `⚠ Critical bleedout timer: ${triageInfo.bleedoutTimer} turn${triageInfo.bleedoutTimer === 1 ? '' : 's'}`
                  )}
                </div>
                ${s.wounds && s.wounds.length > 0 ? `<div style="color: #ff8888; font-size: 0.7rem; margin-top: 2px;">Wounds: ${s.wounds.join(', ')}</div>` : ''}
              </div>
            ` : (carryingCasName ? `
              <div style="background: rgba(61, 139, 87, 0.15); border-left: 3px solid var(--terminal-green); padding: 6px 8px; font-size: 0.75rem;">
                <span style="color: var(--terminal-green); font-weight: bold;">CARRIER PAIRING:</span>
                <div style="color: var(--dust-tan);">Carrying wounded comrade <strong>${carryingCasName}</strong></div>
                <div style="color: var(--smoke-gray); font-size: 0.7rem;">(-25% Squad Mobility Penalty • Rifle Slung)</div>
              </div>
            ` : '')}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function updateSquadUI() {
  if (!isBrowser) return;
  renderDossierUI();
}

function updateSaveStatusUI() {
  if (!isBrowser) return;
  const saveStatusEl = document.getElementById('save-status');
  const saveSummaryEl = document.getElementById('save-summary');
  const btnResume = document.getElementById('btn-resume-game');

  const hasSave = saveManager.hasSave();
  const saveData = saveManager.getSaveData();

  if (saveStatusEl) {
    if (hasSave && saveData) {
      saveStatusEl.textContent = `AUTO-SAVE: ACTIVE [${saveData.sceneId}]`;
      saveStatusEl.style.borderColor = 'var(--radio-green)';
      saveStatusEl.style.color = 'var(--terminal-green)';
    } else {
      saveStatusEl.textContent = 'AUTO-SAVE: NO SAVE FOUND';
      saveStatusEl.style.borderColor = 'var(--smoke-gray)';
      saveStatusEl.style.color = 'var(--smoke-gray)';
    }
  }

  if (saveSummaryEl) {
    if (hasSave && saveData) {
      const timeStr = saveData.timestamp ? new Date(saveData.timestamp).toLocaleTimeString() : 'Unknown';
      saveSummaryEl.textContent = `Saved: Scene "${saveData.sceneId}" at ${timeStr}`;
    } else {
      saveSummaryEl.textContent = 'No save file recorded.';
    }
  }

  if (btnResume) {
    btnResume.disabled = !hasSave;
    btnResume.style.opacity = hasSave ? '1' : '0.5';
    btnResume.style.cursor = hasSave ? 'pointer' : 'not-allowed';
    btnResume.title = hasSave ? `Resume saved state at "${saveData?.sceneId}"` : 'No saved game to resume';
  }
}

// 5. Subscribe to core events for DOM updates
function onJournalUpdated() {
  if (!isBrowser) return;
  if (activeTab === 'journal') {
    renderJournalUI();
  } else {
    unreadJournalCount++;
    const jBadge = document.getElementById('journal-tab-badge');
    if (jBadge) {
      jBadge.textContent = String(unreadJournalCount);
      jBadge.classList.remove('hidden');
    }
  }
}

messageBus.subscribe('GAME_BOOTED', (payload) => {
  if (!isBrowser) return;
  const statusEl = document.getElementById('system-status');
  if (statusEl) {
    statusEl.textContent = 'STATUS: ENGINE RUNNING (BOOTED)';
    statusEl.style.borderColor = 'var(--terminal-green)';
  }
});

messageBus.subscribe('STAT_CHANGED', () => {
  updateLedgerUI();
});

messageBus.subscribe('SQUAD_UPDATED', () => {
  updateSquadUI();
});

messageBus.subscribe('GAME_SAVED', () => {
  updateSaveStatusUI();
});

messageBus.subscribe('GAME_LOADED', () => {
  updateLedgerUI();
  updateSquadUI();
  updateSaveStatusUI();
  updateWeatherUI();
  updateRadioUI();
  updateEnemyUI();
  updateAmbushUI();
  if (activeTab === 'map') renderTacticalMapUI();
  if (activeTab === 'journal') renderJournalUI();
  if (activeTab === 'dossier') renderDossierUI();
  if (activeTab === 'radio') renderRadioUI();
});

messageBus.subscribe('SAVE_CLEARED', () => {
  updateSaveStatusUI();
});

messageBus.subscribe('CONDITION_GAINED', () => {
  updateSquadUI();
});

messageBus.subscribe('CONDITION_REMOVED', () => {
  updateSquadUI();
});

messageBus.subscribe('RELATIONSHIP_UPDATED', () => {
  updateSquadUI();
});

messageBus.subscribe('SOLDIER_WOUNDED', () => {
  updateSquadUI();
});

messageBus.subscribe('WOUNDED_DECISION_MADE', () => {
  updateSquadUI();
});

messageBus.subscribe('SOLDIER_EVACUATED', () => {
  updateSquadUI();
});

messageBus.subscribe('SOLDIER_ABANDONED', () => {
  updateSquadUI();
});

messageBus.subscribe('REPUTATION_CHANGED', () => {
  updateLedgerUI();
});

messageBus.subscribe('WEATHER_CHANGED', () => {
  updateWeatherUI();
});

messageBus.subscribe('RADIO_MESSAGE_RECEIVED', () => {
  updateRadioUI();
});

messageBus.subscribe('RADIO_DECISION', () => {
  updateRadioUI();
});

messageBus.subscribe('RADIO_TIMEOUT', () => {
  updateRadioUI();
});

messageBus.subscribe('JOURNAL_ENTRY_ADDED', () => {
  onJournalUpdated();
});

messageBus.subscribe('MEDAL_AWARDED', () => {
  onJournalUpdated();
  updateSquadUI();
});

messageBus.subscribe('MAP_UPDATED', () => {
  if (activeTab === 'map') {
    renderTacticalMapUI();
  }
});

messageBus.subscribe('MAP_MARKER_ADDED', () => {
  if (activeTab === 'map') {
    renderTacticalMapUI();
  }
});

messageBus.subscribe('INTEL_LEVEL_CHANGED', () => {
  updateLedgerUI();
  if (activeTab === 'map') {
    renderTacticalMapUI();
  }
});

messageBus.subscribe('ENEMY_STRATEGY_CHANGED', () => {
  updateEnemyUI();
});

messageBus.subscribe('AMBUSH_WARNING', () => {
  updateAmbushUI();
});

messageBus.subscribe('TENSION_RESOLVED', () => {
  updateAmbushUI();
});

messageBus.subscribe('EXTRACTION_CALCULATED', () => {
  updateExtractionUI();
});

messageBus.subscribe('EXTRACTION_BEGUN', () => {
  updateExtractionUI();
});

messageBus.subscribe('EXTRACTION_CONCLUDED', (payload) => {
  updateExtractionUI();
  renderExtractionConclusionUI(payload);
});

// 6. Subscribe to SCENE_RENDERED for narrative and choices UI rendering
messageBus.subscribe('SCENE_RENDERED', (payload) => {
  if (!isBrowser || !payload) return;

  const locationEl = document.getElementById('scene-location');
  const narrativeEl = document.getElementById('narrative-text');
  const choicesEl = document.getElementById('choices-container');
  const mapContainer = document.getElementById('map-container');
  const mapMarker = document.getElementById('map-marker');
  const detachmentMarker = document.getElementById('detachment-marker');
  const detachmentLabel = document.getElementById('detachment-label');

  if (mapContainer && mapMarker) {
    if (payload.mapX !== undefined && payload.mapY !== undefined) {
      mapContainer.style.display = 'block';
      mapMarker.style.left = `${payload.mapX}%`;
      mapMarker.style.top = `${payload.mapY}%`;
      
      // Handle Detachment Marker
      if (payload.detachment && detachmentMarker && detachmentLabel) {
        detachmentMarker.style.display = 'block';
        detachmentMarker.style.left = `${payload.detachment.mapX}%`;
        detachmentMarker.style.top = `${payload.detachment.mapY}%`;
        detachmentLabel.textContent = payload.detachment.name || '';
      } else if (detachmentMarker) {
        detachmentMarker.style.display = 'none';
      }
    } else {
      mapContainer.style.display = 'none';
    }
  }

  if (locationEl) {
    locationEl.textContent = payload.location ? `📍 ${payload.location}` : '';
  }

  if (narrativeEl) {
    narrativeEl.textContent = payload.narrative || 'No narrative description provided.';
  }

  if (choicesEl) {
    choicesEl.innerHTML = '';
    let choices = Array.isArray(payload.choices) ? payload.choices : [];

    // AUTONOMOUS INTERCEPTOR LOGIC (Fog of War)
    if (choices.length > 0) {
      const currentHeat = ledger.getStat('heat') || 0;
      const currentStress = ledger.getStat('stress') || 0;
      
      // 10% chance to trigger if Heat > 50 or Stress > 30
      if ((currentHeat > 50 || currentStress > 30) && Math.random() < 0.1) {
        choices = [{
          id: "autonomous_override",
          text: "[LOSS OF CONTROL] The stress of combat breaks your discipline. You blindly open fire into the treeline!",
          resolutionText: "You dump a full magazine into the shadows, giving away your position and wasting ammo.",
          nextScene: payload.id, // Re-load the same scene, but with consequences
          requirements: {},
          events: [{ type: "STAT_CHANGED", payload: { heat: 20, supplies: -15, stress: 5 } }]
        }];
        narrativeEl.textContent += "\n\n*** THE FOG OF WAR HAS OVERTAKEN YOU. ***";
      }
    }

    if (choices.length === 0) {
      if (payload.id === 'campaign_end' || payload.isExtraction || extractionSystem?.executed) {
        if (!extractionSystem.executed) {
          extractionSystem.executeExtraction();
        } else {
          renderExtractionConclusionUI({ summary: extractionSystem.getExtractionSummary() });
        }
      } else {
        const endMsg = document.createElement('div');
        endMsg.style.cssText = 'color: var(--smoke-gray); font-style: italic; padding: 8px;';
        endMsg.textContent = 'Mission segment concluded. No further orders available.';
        choicesEl.appendChild(endMsg);
      }
    } else {
      choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.style.cssText = `
          cursor: pointer;
          padding: 12px 16px;
          background: var(--jungle-mid);
          color: var(--dust-tan);
          border: 1px solid var(--radio-green);
          font-family: inherit;
          font-size: 0.95rem;
          text-align: left;
          transition: all 0.2s ease;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          line-height: 1.4;
        `;

        // Check soldier requirements if applicable
        let isDisabled = false;
        let reqWarning = '';
        if (choice.requirements && choice.requirements.alive) {
          const reqSoldier = squadManager.getSoldierById(choice.requirements.alive);
          if (reqSoldier && !reqSoldier.isAlive) {
            isDisabled = true;
            reqWarning = ` [UNAVAILABLE: ${reqSoldier.name} KIA]`;
          }
        }

        if (isDisabled) {
          btn.disabled = true;
          btn.style.cursor = 'not-allowed';
          btn.style.opacity = '0.5';
          btn.style.borderColor = 'var(--blood-red)';
          btn.style.color = 'var(--smoke-gray)';
        } else {
          btn.addEventListener('mouseenter', () => {
            btn.style.background = 'var(--radio-green)';
            btn.style.color = '#ffffff';
            btn.style.borderColor = 'var(--terminal-green)';
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.background = 'var(--jungle-mid)';
            btn.style.color = 'var(--dust-tan)';
            btn.style.borderColor = 'var(--radio-green)';
          });

          btn.addEventListener('click', () => {
            messageBus.publish('CHOICE_MADE', choice);
          });
        }

        btn.innerHTML = `
          <span style="color: ${isDisabled ? 'var(--blood-red)' : 'var(--warning-yellow)'}; font-weight: bold;">[${index + 1}]</span>
          <span>${choice.text || 'Continue...'}${reqWarning ? `<span style="color: var(--blood-red); font-size: 0.85rem;">${reqWarning}</span>` : ''}</span>
        `;

        choicesEl.appendChild(btn);
      });
    }
  }

  updateSaveStatusUI();
  if (activeTab === 'map') renderTacticalMapUI();
  if (activeTab === 'journal') renderJournalUI();
  if (activeTab === 'dossier') renderDossierUI();
  if (activeTab === 'radio') renderRadioUI();
});

messageBus.subscribe('CHOICE_RESOLUTION', (payload) => {
  if (!isBrowser || !payload) return;

  const choicesEl = document.getElementById('choices-container');
  if (choicesEl) {
    choicesEl.innerHTML = '';

    const reportDiv = document.createElement('div');
    reportDiv.style.cssText = `
      padding: 16px;
      background: rgba(40, 40, 40, 0.8);
      border-left: 4px solid var(--terminal-green, #4af626);
      color: var(--dust-tan, #d1c4a5);
      margin-bottom: 10px;
      font-size: 0.95rem;
      line-height: 1.5;
    `;
    
    reportDiv.textContent = payload.choice.resolutionText || "Order received and executed. The situation develops...";

    if (payload.choice.events && Array.isArray(payload.choice.events)) {
      const consequences = document.createElement('div');
      consequences.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-family: monospace; font-size: 0.85rem;';
      
      payload.choice.events.forEach(evt => {
        let msg = '';
        let color = 'var(--warning-yellow)';
        
        if (evt.type === 'STAT_CHANGED' && evt.payload) {
          const changes = Object.entries(evt.payload).map(([k,v]) => `${k.toUpperCase()} ${v > 0 ? '+'+v : v}`).join(' | ');
          msg = `[✓] RESOURCES UPDATED: ${changes}`;
        } else if (evt.type === 'CASUALTY_TAKEN' && evt.payload) {
          msg = `[!] CRITICAL CASUALTY: ${evt.payload.soldier.toUpperCase()} IS DOWN`;
          color = 'var(--blood-red)';
        }
        
        if (msg) {
          const p = document.createElement('div');
          p.style.color = color;
          p.style.marginTop = '4px';
          p.textContent = msg;
          consequences.appendChild(p);
        }
      });
      
      if (consequences.childNodes.length > 0) {
        reportDiv.appendChild(consequences);
      }
    }

    const continueBtn = document.createElement('button');
    continueBtn.className = 'choice-btn';
    continueBtn.style.cssText = `
      cursor: pointer;
      padding: 12px 16px;
      background: var(--jungle-mid);
      color: var(--dust-tan);
      border: 1px solid var(--radio-green);
      font-family: inherit;
      font-size: 0.95rem;
      text-align: center;
      transition: all 0.2s ease;
      width: 100%;
      font-weight: bold;
    `;
    
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = 'var(--radio-green)';
      continueBtn.style.color = '#ffffff';
      continueBtn.style.borderColor = 'var(--terminal-green)';
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = 'var(--jungle-mid)';
      continueBtn.style.color = 'var(--dust-tan)';
      continueBtn.style.borderColor = 'var(--radio-green)';
    });

    continueBtn.textContent = '[ Continue ]';
    continueBtn.addEventListener('click', () => {
      sceneManager.loadScene(payload.nextScene);
    });

    choicesEl.appendChild(reportDiv);
    choicesEl.appendChild(continueBtn);
  }
});

// Setup button event listeners in browser
if (isBrowser) {
  // Tab Switching Navigation
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      if (target) {
        switchTab(target);
      }
    });
  });

  // Test Event Buttons
  const btnStat = document.getElementById('btn-test-stat');
  if (btnStat) {
    btnStat.addEventListener('click', () => {
      messageBus.publish('STAT_CHANGED', { stat: 'intel', delta: 10 });
    });
  }

  const btnHeat = document.getElementById('btn-test-heat');
  if (btnHeat) {
    btnHeat.addEventListener('click', () => {
      messageBus.publish('STAT_CHANGED', { stat: 'heat', delta: 15 });
    });
  }

  const btnStress = document.getElementById('btn-test-stress');
  if (btnStress) {
    btnStress.addEventListener('click', () => {
      messageBus.publish('STAT_CHANGED', { stat: 'stress', delta: 10 });
    });
  }

  const btnCasualty = document.getElementById('btn-test-casualty');
  if (btnCasualty) {
    btnCasualty.addEventListener('click', () => {
      const alive = squadManager.getAliveSoldiers();
      if (alive.length > 0) {
        const target = alive[alive.length - 1];
        messageBus.publish('CASUALTY_TAKEN', { soldierId: target.id });
      }
    });
  }

  // Save / Flow Controls
  const btnResume = document.getElementById('btn-resume-game');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      if (saveManager.hasSave()) {
        saveManager.loadGame();
      }
    });
  }

  const btnNewGame = document.getElementById('btn-new-game');
  if (btnNewGame) {
    btnNewGame.addEventListener('click', () => {
      saveManager.clearSave();
      ledger.reset();
      squadManager.resetToDefault();
      extractionSystem.calculatedEnding = null;
      extractionSystem.executed = false;
      extractionSystem.endingId = null;
      extractionSystem.epilogue = null;
      extractionSystem.summary = null;
      sceneManager.loadScene('start');
      updateLedgerUI();
      updateSquadUI();
      updateSaveStatusUI();
      updateExtractionUI();
      renderJournalUI();
      renderTacticalMapUI();
      renderDossierUI();
    });
  }

  const btnManualSave = document.getElementById('btn-manual-save');
  if (btnManualSave) {
    btnManualSave.addEventListener('click', () => {
      saveManager.saveGame();
      updateSaveStatusUI();
    });
  }

  const btnClearSave = document.getElementById('btn-clear-save');
  if (btnClearSave) {
    btnClearSave.addEventListener('click', () => {
      saveManager.clearSave();
      updateSaveStatusUI();
    });
  }
}

// Initial UI Render
updateLedgerUI();
updateSquadUI();
updateWeatherUI();
updateRadioUI();
updateEnemyUI();
updateAmbushUI();
updateExtractionUI();
renderJournalUI();
renderTacticalMapUI();
renderDossierUI();

// 7. Boot the game engine and initialize scene flow
gameEngine.init();

// If a save exists, automatically restore the saved state; otherwise start fresh
if (saveManager.hasSave()) {
  saveManager.loadGame();
} else {
  sceneManager.loadScene('start');
}

updateSaveStatusUI();

// Export wired instances for debugging / inspection / tests
export {
  messageBus,
  ledger,
  squadManager,
  gameEngine,
  sceneManager,
  saveManager,
  relationshipManager,
  traitManager,
  journal,
  conditionManager,
  reputationManager,
  dynamicEventManager,
  weatherSystem,
  radioSystem,
  intelSystem,
  enemyCommander,
  ambushSystem,
  heroicActionManager,
  tacticalMapManager,
  woundedSoldierManager,
  battlefieldRecoverySystem,
  extractionSystem
};
