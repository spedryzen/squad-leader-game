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
import { Journal } from './systems/Journal.js';
import { PsychologicalConditionManager } from './systems/PsychologicalConditionManager.js';
import { ReputationManager } from './systems/ReputationManager.js';
import { DynamicEventManager } from './systems/DynamicEventManager.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { RadioSystem } from './systems/RadioSystem.js';
import { IntelSystem } from './systems/IntelSystem.js';
import { EnemyCommander } from './systems/EnemyCommander.js';
import { AmbushSystem } from './systems/AmbushSystem.js';
import { HeroicActionManager } from './systems/HeroicActionManager.js';
import { TacticalMapManager } from './systems/TacticalMapManager.js';
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
          <div class="subtitle">v2 Object-Oriented Architecture Integration</div>
          <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
            <div class="status-badge" id="system-status">STATUS: INITIALIZING...</div>
            <div class="status-badge" id="save-status" style="border-color: var(--smoke-gray); color: var(--smoke-gray);">AUTO-SAVE: READY</div>
            <div class="status-badge" id="weather-status" style="border-color: var(--radio-green); color: var(--terminal-green);">WEATHER: CLEAR</div>
            <div class="status-badge" id="radio-status" style="border-color: var(--warning-yellow); color: var(--warning-yellow); display: none;">RADIO: NET READY</div>
            <div class="status-badge" id="enemy-status" style="border-color: var(--blood-red); color: #ff6b6b;">NVA: RECON</div>
            <div class="status-badge" id="ambush-status" style="border-color: var(--warning-yellow); color: var(--warning-yellow); display: none;">TENSION: ALERT</div>
            <div class="status-badge" id="extraction-status" style="border-color: var(--terminal-green); color: var(--terminal-green); display: none;">EXTRACTION: READY</div>
          </div>
        </header>

        <!-- Save & Campaign Flow Controls -->
        <div class="panel" style="padding: 14px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 0.9rem; color: var(--warning-yellow); font-weight: bold;">
              <span>CAMPAIGN CONTROLS</span>
              <span id="save-summary" style="font-size: 0.8rem; color: var(--smoke-gray); margin-left: 10px; font-weight: normal;"></span>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button id="btn-resume-game" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit; font-size: 0.85rem;">Resume Game</button>
              <button id="btn-new-game" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--warning-yellow); font-family: inherit; font-size: 0.85rem;">New Game (Reset)</button>
              <button id="btn-manual-save" style="cursor: pointer; padding: 6px 14px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit; font-size: 0.85rem;">Manual Save</button>
              <button id="btn-clear-save" style="cursor: pointer; padding: 6px 14px; background: var(--blood-red); color: #fff; border: 1px solid #fff; font-family: inherit; font-size: 0.85rem;">Clear Save</button>
            </div>
          </div>
        </div>

        <!-- Tactical Map Panel -->
        <div class="panel" id="map-container" style="position: relative; width: 100%; height: 250px; background: 
          repeating-linear-gradient(rgba(74,246,38,0.1) 0, rgba(74,246,38,0.1) 1px, transparent 1px, transparent 20px),
          repeating-linear-gradient(90deg, rgba(74,246,38,0.1) 0, rgba(74,246,38,0.1) 1px, transparent 1px, transparent 20px),
          radial-gradient(ellipse at center, var(--jungle-mid) 0%, var(--jungle-dark) 100%); 
          border: 2px solid var(--radio-green); overflow: hidden; margin-bottom: 20px; display: none;">
          <div style="position: absolute; top: 5px; left: 5px; color: var(--radio-green); font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">AOR Map - Grid 881</div>
          
          <!-- Static POI Markers -->
          <div style="position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; background: rgba(74,246,38,0.3); border: 1px solid var(--radio-green); transform: translate(-50%, -50%);"><span style="position: absolute; top: 12px; left: -20px; color: var(--smoke-gray); font-size: 0.65rem; white-space: nowrap;">Bunker 4</span></div>
          <div style="position: absolute; top: 45%; left: 60%; width: 10px; height: 10px; background: rgba(74,246,38,0.3); border: 1px dashed var(--blood-red); transform: translate(-50%, -50%);"><span style="position: absolute; top: 12px; left: -20px; color: var(--smoke-gray); font-size: 0.65rem; white-space: nowrap;">Treeline (Contact)</span></div>
          <div style="position: absolute; top: 35%; left: 30%; width: 10px; height: 10px; background: rgba(74,246,38,0.3); border: 1px solid var(--radio-green); transform: translate(-50%, -50%);"><span style="position: absolute; top: 12px; left: -20px; color: var(--smoke-gray); font-size: 0.65rem; white-space: nowrap;">Highway 9</span></div>
          <div style="position: absolute; top: 20%; left: 20%; width: 10px; height: 10px; background: rgba(74,246,38,0.3); border: 1px solid var(--warning-yellow); transform: translate(-50%, -50%);"><span style="position: absolute; top: 12px; left: -10px; color: var(--warning-yellow); font-size: 0.65rem; white-space: nowrap;">LZ X-Ray</span></div>

          <!-- Dynamic Player Marker -->
          <div id="map-marker" style="position: absolute; top: 50%; left: 50%; width: 14px; height: 14px; background: var(--warning-yellow); border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); transition: all 1s ease-in-out; box-shadow: 0 0 10px var(--warning-yellow); z-index: 10;"></div>
          
          <!-- Detachment Marker (for scouts/dogs/vehicles) -->
          <div id="detachment-marker" style="position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; background: #4af626; border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); transition: all 1s ease-in-out; box-shadow: 0 0 8px #4af626; z-index: 11; display: none;">
            <span id="detachment-label" style="position: absolute; top: 12px; left: -10px; color: #4af626; font-size: 0.65rem; white-space: nowrap; font-weight: bold;"></span>
          </div>

          <!-- Topographic contour lines effect -->
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\"><path d=\"M10,50 Q100,10 200,60 T400,30 T600,80 T800,20 T1000,50 M50,120 Q150,80 250,130 T450,100 T650,150 T850,90 T1050,120 M0,200 Q100,160 200,210 T400,180 T600,230 T800,170 T1000,200\" fill=\"none\" stroke=\"rgba(74,246,38,0.15)\" stroke-width=\"1\"/></svg>');"></div>
        </div>

        <!-- Narrative & Choices Panel (SceneManager) -->
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

        <div class="panel">
          <div class="panel-header">
            <span>Command Stats (Ledger)</span>
            <span id="ledger-summary">Heat: 0 | Intel: 0 | Supplies: 100</span>
          </div>
          <div id="stats-display" style="display: flex; gap: 15px; font-size: 0.9rem;">
            <div style="flex: 1; padding: 10px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--warning-yellow);">
              <strong>HEAT:</strong> <span id="stat-heat">0</span>
            </div>
            <div style="flex: 1; padding: 10px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--radio-green);">
              <strong>INTEL:</strong> <span id="stat-intel">0</span> <span id="intel-tier-badge" style="font-size: 0.75rem; color: var(--smoke-gray); margin-left: 4px;">[LOW]</span>
            </div>
            <div style="flex: 1; padding: 10px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--dust-tan);">
              <strong>SUPPLIES:</strong> <span id="stat-supplies">100</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span>Squad Roster (SquadManager)</span>
            <span id="squad-counter">8/8 Ready</span>
          </div>
          <div id="squad-roster"></div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span>MessageBus Live Event Stream</span>
            <span id="event-counter">0 events</span>
          </div>
          <div style="margin-bottom: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="btn-test-stat" style="cursor: pointer; padding: 6px 12px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--radio-green); font-family: inherit;">+10 Intel (Test Event)</button>
            <button id="btn-test-heat" style="cursor: pointer; padding: 6px 12px; background: var(--jungle-mid); color: var(--dust-tan); border: 1px solid var(--blood-red); font-family: inherit;">+15 Heat (Test Event)</button>
            <button id="btn-test-casualty" style="cursor: pointer; padding: 6px 12px; background: var(--blood-red); color: #fff; border: 1px solid #fff; font-family: inherit;">Simulate Casualty (Test Event)</button>
          </div>
          <ul id="event-log"></ul>
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

// 4. Update UI helpers
function updateLedgerUI() {
  if (!isBrowser) return;
  const stats = ledger.getStats();
  const heatEl = document.getElementById('stat-heat');
  const intelEl = document.getElementById('stat-intel');
  const suppliesEl = document.getElementById('stat-supplies');
  const summaryEl = document.getElementById('ledger-summary');
  const intelBadgeEl = document.getElementById('intel-tier-badge');

  const tier = intelSystem ? intelSystem.getIntelTier() : 'LOW';

  if (heatEl) heatEl.textContent = stats.heat;
  if (intelEl) intelEl.textContent = stats.intel;
  if (suppliesEl) suppliesEl.textContent = stats.supplies;
  if (intelBadgeEl) intelBadgeEl.textContent = `[${tier}]`;
  if (summaryEl) summaryEl.textContent = `Heat: ${stats.heat} | Intel: ${stats.intel} (${tier}) | Supplies: ${stats.supplies}`;
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
}

function updateRadioUI() {
  if (!isBrowser) return;
  const radioBadge = document.getElementById('radio-status');
  if (radioBadge && radioSystem) {
    const active = radioSystem.getActiveMessages();
    if (active.length > 0) {
      radioBadge.style.display = 'inline-block';
      radioBadge.textContent = `RADIO: ${active.length} URGENT CALL${active.length === 1 ? '' : 'S'}`;
      radioBadge.style.borderColor = 'var(--blood-red)';
      radioBadge.style.color = 'var(--blood-red)';
    } else {
      radioBadge.style.display = 'none';
    }
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

function updateSquadUI() {
  if (!isBrowser) return;
  const rosterEl = document.getElementById('squad-roster');
  const counterEl = document.getElementById('squad-counter');
  if (!rosterEl) return;

  const soldiers = squadManager.getSoldiers();
  const alive = squadManager.getAliveSoldiers();

  if (counterEl) {
    counterEl.textContent = `${alive.length}/${soldiers.length} Ready`;
  }

  rosterEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
      ${soldiers.map(s => `
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-left: 4px solid ${s.isAlive ? (s.status === 'wounded' ? 'var(--warning-yellow)' : 'var(--radio-green)') : 'var(--blood-red)'};">
          <div style="font-weight: bold; color: ${s.isAlive ? (s.status === 'wounded' ? 'var(--warning-yellow)' : 'var(--dust-tan)') : 'var(--blood-red)'}; font-size: 0.95rem;">
            ${s.name} ${s.isAlive ? (s.status === 'wounded' ? '(WOUNDED)' : '') : '(KIA)'}
          </div>
          <div style="font-size: 0.8rem; color: var(--smoke-gray); margin-top: 2px;">${s.role}</div>
          <div style="font-size: 0.75rem; color: var(--warning-yellow); margin-top: 2px;">Traits: ${(s.getTraits ? s.getTraits() : [s.trait]).join(', ')}</div>
          ${s.conditions && s.conditions.length > 0 ? `<div style="font-size: 0.75rem; color: #ff9800; margin-top: 2px;">Conditions: ${s.conditions.join(', ')}</div>` : ''}
          ${s.wounds && s.wounds.length > 0 ? `<div style="font-size: 0.75rem; color: var(--blood-red); margin-top: 2px;">Wounds: ${s.wounds.join(', ')}</div>` : ''}
          ${s.isAlive ? `
          <div style="margin-top: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--smoke-gray); margin-bottom: 2px;">
              <span>Morale</span><span>${s.morale}%</span>
            </div>
            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${s.morale}%; background: ${s.morale > 50 ? 'var(--radio-green)' : (s.morale > 25 ? 'var(--warning-yellow)' : 'var(--blood-red)')}; transition: width 0.3s ease, background-color 0.3s ease;"></div>
            </div>
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
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

messageBus.subscribe('INTEL_LEVEL_CHANGED', () => {
  updateLedgerUI();
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
