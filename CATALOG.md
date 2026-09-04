<!-- Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817 -->

# Project Catalog - Squad Leader: Vietnam

This catalog documents the modules, scripts, and documentation files within the project.

## Core Architecture (v2)

### `v2/src/core/MessageBus.js`
- **Description**: Publish/Subscribe event bus for decoupled asynchronous messaging and state event propagation across game modules.
- **Inputs**: 
  - `subscribe(event: string, callback: Function)`: Event name string and callback handler.
  - `unsubscribe(event: string, callback: Function)`: Event name string and callback handler to remove.
  - `publish(event: string, payload: any)`: Event name string and optional payload data.
  - `clear()`: None.
- **Outputs**: Dispatches payload to all registered listener callbacks; returns unsubscribe function on `subscribe`.

### `v2/src/core/GameEngine.js`
- **Description**: Central orchestrator and loop manager for the v2 game architecture.
- **Inputs**:
  - `constructor(messageBus: MessageBus)`: An instance of `MessageBus`.
  - `init()`: Triggers engine initialization and lifecycle startup.
  - `stop()`: Halts running engine state.
- **Outputs**: Publishes `GAME_BOOTED` (with timestamp and engine reference) and `GAME_STOPPED` events over the message bus.

### `v2/src/core/SceneManager.js`
- **Description**: Manages narrative progression, scene loading, and decision tree branching. Listens for `CHOICE_MADE` events, executes choice side-effect events over the MessageBus, and broadcasts `CHOICE_RESOLUTION` and `SCENE_RENDERED` events.
- **Inputs**:
  - `constructor(messageBus: MessageBus, sceneData?: object)`: MessageBus instance and scene definitions dictionary.
  - Event `CHOICE_MADE`: Receives choice identifier/payload, extracts choice events, and triggers next scene navigation.
  - `loadScene(sceneId: string)`: Resolves scene definition and publishes `SCENE_RENDERED`.
  - `getScene(sceneId: string)` / `getCurrentScene()` / `getCurrentSceneId()` / `setSceneData(sceneData: object)`: Scene query and management methods.
- **Outputs**: Publishes `SCENE_RENDERED` with scene payload data and dispatches choice-specific lifecycle events over the MessageBus.

### `v2/src/core/SaveManager.js`
- **Description**: Auto-save and state persistence manager utilizing HTML5 `localStorage`. Subscribes to `SCENE_RENDERED` to serialize the current scene ID, ledger stats, and squad alive/dead roster status, saving snapshot records under key `squadLeaderSave`. Provides `loadGame()`, `saveGame()`, `hasSave()`, and `clearSave()` methods, and broadcasts `GAME_SAVED`, `GAME_LOADED`, and `SAVE_CLEARED` events.
- **Inputs**:
  - `constructor(messageBus: MessageBus, sceneManager: SceneManager, squadManager: SquadManager, ledger: Ledger, storageKey?: string)`: System manager instances and optional storage key name.
  - Event `SCENE_RENDERED`: Automatically triggers `saveGame()` with the rendered scene ID.
  - `saveGame(sceneId?: string)`: Manually triggers serialized state write to `localStorage`.
  - `loadGame()`: Deserializes save data, invokes `ledger.setStats()`, `squadManager.setRoster()`, `sceneManager.loadScene()`, and publishes `GAME_LOADED`.
  - `hasSave()`: Checks if valid save record exists in `localStorage`.
  - `getSaveData()`: Parses and returns save record object.
  - `clearSave()`: Deletes save key from `localStorage` and broadcasts `SAVE_CLEARED`.
- **Outputs**: Persisted JSON game state in browser `localStorage`, restored manager states upon loading, and lifecycle event broadcasts (`GAME_SAVED`, `GAME_LOADED`, `SAVE_CLEARED`).

## Entities (v2)

### `v2/src/entities/Soldier.js`
- **Description**: Entity class representing an individual squad member with tracking for health/life status, morale, role, and traits.
- **Inputs**:
  - `constructor(id: string|number, name: string, role: string, trait: string)`: Soldier identifiers and background stats.
  - `setAlive(status: boolean)` / `set alive(status: boolean)`: Sets alive/casualty state.
  - `adjustMorale(delta: number)`: Adjusts morale value clamped between 0 and 100.
  - `toJSON()`: Serializes soldier to plain JavaScript object.
- **Outputs**: Instantiated Soldier object with getters, setters, and serialization methods.

### `v2/src/entities/SquadManager.js`
- **Description**: Manages squad roster lifecycle, casualty handling, squad status broadcasting, and roster restoration. Supports string IDs or object formats in `CASUALTY_TAKEN` events, handles `GAME_LOADED` events, and maintains the default squad roster (SSG Miller, CPL Brady, Duke, PFC Jenkins, DOC Baker, CPL Thompson, SP4 Torres, PFC Kowalski, LCPL Washington).
- **Inputs**:
  - `constructor(messageBus: MessageBus, initialRoster?: Soldier[])`: MessageBus instance and optional initial roster.
  - Event `CASUALTY_TAKEN`: Receives payload with soldier ID (`soldierId`, `id`, or `soldier`) to mark soldier as fallen.
  - Event `GAME_LOADED`: Restores squad roster from loaded state.
  - `setRoster(roster: Array<Soldier|object>)`: Restores or updates roster from serialized save data.
  - `resetToDefault()`: Resets roster to the original starting squad.
  - `addSoldier(soldier: Soldier)`: Adds new soldier to roster.
  - `getSoldiers()` / `getAliveSoldiers()` / `getCasualties()` / `getSoldierById(id)`: Query methods.
- **Outputs**: Publishes `SQUAD_UPDATED` event on MessageBus containing updated roster and casualty details.

## State Management (v2)

### `v2/src/state/Ledger.js`
- **Description**: Tracks core operational game stats including heat, intel, and supplies, reacting to state update events and save restore events.
- **Inputs**:
  - `constructor(messageBus: MessageBus, initialStats?: object)`: MessageBus instance and optional initial stat overrides.
  - Event `STAT_CHANGED`: Receives stat change descriptor (`{ stat, value/delta }` or key-value map).
  - Event `GAME_LOADED`: Restores stat properties from loaded state.
  - `setStats(stats: object)`: Bulk-updates stats from saved/loaded state and broadcasts `STAT_CHANGED`.
  - `setStat(key: string, value: any)` / `modifyStat(key: string, delta: number)`: Manual stat mutation methods.
  - `getStats()` / `getStat(key)` / `reset(newStats?: object)`: Query and reset methods.
- **Outputs**: Maintained internal state accessible via properties (`heat`, `intel`, `supplies`) and getter methods.

## Integration & UI (v2)

### `v2/index.html`
- **Description**: Web application entrypoint HTML file hosting the DOM mount element (`#app`) and loading `src/main.js` as an ES module.
- **Inputs**: Browser HTTP request / direct file open.
- **Outputs**: Renders base HTML layout and boots ES module scripts.

### `v2/src/main.js`
- **Description**: Composition root that wires together `MessageBus`, `Ledger`, `SquadManager`, `GameEngine`, `SceneManager`, and `SaveManager` instances with `campaign3US` scenario data. Listens for `SCENE_RENDERED` and `CHOICE_RESOLUTION` to dynamically present narrative briefings and interactive tactical choice buttons in the DOM, provides campaign save management UI controls (Resume, New Game, Manual Save, Clear Save), handles auto-save/restore on startup, attaches real-time visual monitors, and initiates engine startup (`gameEngine.init()`).
- **Inputs**: Imported core modules (`MessageBus`, `GameEngine`, `SceneManager`, `SaveManager`), entities (`SquadManager`), state (`Ledger`), data (`campaign3US`), and DOM elements from `index.html`.
- **Outputs**: Initialized OOP system instances, real-time DOM event logger stream, interactive tactical narrative UI with choice buttons, active squad roster view, campaign save status bar and controls, and exported module references (`messageBus`, `ledger`, `squadManager`, `gameEngine`, `sceneManager`, `saveManager`).

## Campaign Data (v2)

### `v2/src/data/campaign_3_us.js`
- **Description**: Data module containing the 16-scene branching narrative graph for Campaign 3 (Khe Sanh) US scenario. Focuses entirely on a continuous 1-hour slice of combat on the morning of Jan 20th, covering the defense of Hill 881 South against a dawn sapper probe and mortar attack. Maintains strict spatial and chronological continuity between scenes. Includes tactical choice resolution text (`resolutionText`), soldier survival requirements, and MessageBus event publishing (`STAT_CHANGED`, `CASUALTY_TAKEN`).
- **Inputs**: None (static data export module).
- **Outputs**: Exports `campaign3US` dictionary object containing 16 fully connected scene definitions with locations, narratives, tactical choices with `resolutionText`, choice requirements, and event descriptors.

### `v2/src/data/campaign_4_lz.js`
- **Description**: Data module containing the narrative graph for Campaign 4 (LZ Extraction). Continues from Campaign 3, featuring a fighting retreat through the jungle, interactions with M113 ACAVs, and extraction at LZ X-Ray. Features map coordinates (`mapX`, `mapY`) for the tactical visual map.
- **Inputs**: None (static data export module).
- **Outputs**: Exports `campaign4LZ` dictionary object.

## Utilities

### `system_ctl.sh`
- **Description**: Bash script to manage the local HTTP game server.
- **Inputs**: Commands (`start`, `stop`, `restart`, `status`).
- **Outputs**: Spawns or kills `python3 -m http.server`, manages `.server.pid`, and outputs status text.
