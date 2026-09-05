# Project Catalog - Squad Leader: Vietnam
<!-- Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817 -->

This catalog documents the modules, scripts, and documentation files within the project.

## Project Configuration

### `package.json`
- **Description**: Package manifest configured with native ES module support (`"type": "module"`) and test execution scripts for Node.js test runner.
- **Inputs**: Node.js tooling / `npm test`.
- **Outputs**: Configures module resolution and defines test runner commands.

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
- **Description**: Auto-save and state persistence manager utilizing HTML5 `localStorage`. Subscribes to `SCENE_RENDERED` to serialize progress across all 16 campaign systems (scene ID, ledger stats, squad roster, relationships, traits, journal entries, conditions, reputation, dynamic events, weather, radio, intel, enemy commander AI, ambush encounters, heroic actions/medals, tactical map markers/path, wounded soldier status/carriers, battlefield recovery history, and dynamic extraction state), saving snapshot records under key `squadLeaderSave`. Provides `loadGame()`, `saveGame()`, `hasSave()`, and `clearSave()` methods, and broadcasts `GAME_SAVED`, `GAME_LOADED`, and `SAVE_CLEARED` events.
- **Inputs**:
  - `constructor(messageBus: MessageBus, sceneManager: SceneManager, squadManager: SquadManager, ledger: Ledger, storageKey?: string, systems?: object)`: System manager instances, storage key name, and optional system references (`relationshipManager`, `traitManager`, `journal`, `conditionManager`, `reputationManager`, `dynamicEventManager`, `weatherSystem`, `radioSystem`, `intelSystem`, `enemyCommander`, `ambushSystem`, `heroicActionManager`, `tacticalMapManager`, `woundedSoldierManager`, `battlefieldRecoverySystem`, `extractionSystem`).
  - Event `SCENE_RENDERED`: Automatically triggers `saveGame()` with the rendered scene ID.
  - `saveGame(sceneId?: string)`: Manually triggers serialized state write to `localStorage`.
  - `loadGame()`: Deserializes save data, invokes `ledger.setStats()`, `squadManager.setRoster()`, `sceneManager.loadScene()`, restores all 16 system states, and publishes `GAME_LOADED`.
  - `hasSave()`: Checks if valid save record exists in `localStorage`.
  - `getSaveData()`: Parses and returns save record object.
  - `clearSave()`: Deletes save key from `localStorage` and broadcasts `SAVE_CLEARED`.
- **Outputs**: Persisted JSON game state in browser `localStorage`, restored manager states upon loading, and lifecycle event broadcasts (`GAME_SAVED`, `GAME_LOADED`, `SAVE_CLEARED`).

## Systems (Phase 1)

### `v2/src/systems/RelationshipManager.js`
- **Description**: Manages dynamic social networks between squad members, including friendships, rivalries, mentorships, and trust levels (0-100). Governs emotional fallout from casualties, triggers rival tensions under combat stress, and calculates combat/rescue bonuses.
- **Inputs**:
  - `constructor(messageBus: MessageBus, initialRelationships?: object[], squadManager?: SquadManager)`: MessageBus, optional initial graph, and SquadManager reference.
  - `setRelationship(soldierId1, soldierId2, type, value)`: Defines or updates relationship and base trust.
  - `getRelationship(soldierId1, soldierId2)`: Retrieves relationship record between two soldiers.
  - `getRelationshipsFor(soldierId)`: Retrieves all relationships involving a soldier.
  - `modifyTrust(soldierId1, soldierId2, delta)`: Modifies trust clamped [0, 100] and auto-evolves archetypes.
  - `checkCasualtyReactions(soldierId)`: Checks fallen soldier's bonds, inflicts morale penalties on friends, and emits `FRIEND_KIA`.
  - `triggerRivalConflict(soldierId1, soldierId2, reason)`: Inflicts morale penalties and triggers `RIVAL_CONFLICT`.
  - `getRescueChanceModifier(rescuerId, targetId)`: Returns combat rescue probability bonus/penalty based on trust.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `CASUALTY_TAKEN`, `SQUAD_UPDATED`, `HEROIC_ACTION`, `CHOICE_MADE`, `GAME_LOADED`.
- **Outputs**: Publishes `RELATIONSHIP_UPDATED`, `TRUST_CHANGED`, `FRIEND_KIA`, and `RIVAL_CONFLICT` events.

### `v2/src/systems/TraitManager.js`
- **Description**: Governs discovery, activation, and management of dormant soldier traits during gameplay based on events, stress, choices, or combat actions.
- **Inputs**:
  - `constructor(messageBus: MessageBus, squadManager?: SquadManager)`: MessageBus and optional SquadManager reference.
  - `discoverTrait(soldierId, traitName, reason)`: Discovers trait, prevents duplicates, syncs with Soldier entity, and publishes event.
  - `hasTrait(soldierId, traitName)`: Checks if soldier has discovered trait.
  - `getTraitsFor(soldierId)`: Retrieves all traits for a soldier.
  - `evaluateDiscovery(context)`: Evaluates combat stress, casualties, choices, tunnels, and ambushes to unlock traits.
  - `getTraitDefinition(traitName)`: Retrieves catalog metadata for a trait.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `STAT_CHANGED`, `CASUALTY_TAKEN`, `CHOICE_MADE`, `GAME_LOADED`.
- **Outputs**: Publishes `TRAIT_DISCOVERED` with soldier details, trait metadata, and unlock reason.

### `v2/src/systems/Journal.js`
- **Description**: Automatically records wartime narrative diary entries (KIA, WIA, Heroic Acts, Ambushes, Battles, Weather, Radio logs). All user-facing dates and timestamps adhere strictly to PST (`America/Los_Angeles`) per Directive 13.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus, timezone configuration, in-game time/day.
  - `addEntry(entryData)`: Records new entry, formats timestamp, and publishes event.
  - `getEntries()`: Retrieves all recorded diary logs.
  - `getEntriesByCategory(category)`: Filters entries by category (`COMBAT`, `CASUALTY`, `HEROISM`, `WEATHER`, `INTEL`, `COMMAND`).
  - `getEntriesByTag(tag)`: Filters entries by string tag.
  - `getFormattedEntries()`: Returns human-readable formatted military log entries.
  - `setTimeZone(tz)` / `getTimeZone()`: Configures user timezone preference.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `CASUALTY_TAKEN`, `HEROIC_ACTION`, `AMBUSH_TRIGGERED`, `WEATHER_CHANGED`, `RADIO_MESSAGE_RECEIVED`, `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `JOURNAL_ENTRY_ADDED` and provides formatted wartime chronicles.

## Systems (Phase 2)

### `v2/src/systems/PsychologicalConditionManager.js`
- **Description**: Expands combat stress into enduring mental conditions (`Exhausted`, `Hypervigilant`, `Survivor's Guilt`, `Traumatized`, `Combat Hardened`, `Blooded Veteran`). Synchronizes state directly with `Soldier` domain entities, prevents duplicate conditions, evaluates stress/casualty/heroic events, and supports full serialization.
- **Inputs**:
  - `constructor(messageBus: MessageBus, squadManager?: SquadManager)`: MessageBus and optional SquadManager reference.
  - `addCondition(soldierId, conditionName, reason)`: Assigns condition, updates soldier entity, emits `CONDITION_GAINED`.
  - `removeCondition(soldierId, conditionName, reason)`: Removes condition, updates soldier entity, emits `CONDITION_REMOVED`.
  - `hasCondition(soldierId, conditionName)`: Checks if soldier has condition.
  - `getConditionsFor(soldierId)`: Returns condition names array.
  - `getConditionDefinition(conditionName)`: Retrieves metadata from catalog.
  - `evaluateConditions(context)`: Analyzes stress spikes, casualties, friend deaths, and exhaustion to assign conditions.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `STAT_CHANGED`, `CASUALTY_TAKEN`, `FRIEND_KIA`, `HEROIC_ACTION`, `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `CONDITION_GAINED` and `CONDITION_REMOVED` with soldier details and gameplay modifiers.

### `v2/src/systems/ReputationManager.js`
- **Description**: Tracks player command leadership style across 6 archetypes (`Aggressive`, `Reliable`, `Tactical`, `Protector`, `Ruthless`, `Jungle Ghost`) based on combat decisions. Clamps scores between 0 and 100, identifies dynamic `primaryReputation`, evaluates choices/casualties/heroism, and calculates doctrine perks.
- **Inputs**:
  - `constructor(messageBus: MessageBus, initialScores?: object)`: MessageBus and optional initial scores.
  - `modifyReputation(type, delta)`: Modifies score clamped [0, 100], updates primary reputation, emits `REPUTATION_CHANGED`.
  - `getScores()` / `getScore(type)`: Retrieves all or specific archetype scores.
  - `getPrimaryReputation()`: Computes currently dominant archetype.
  - `getPerks()`: Retrieves active perks for primary reputation and threshold archetypes (score >= 40).
  - `evaluateChoice(choicePayload)`: Inspects choice reputation tags and keywords (charge, flank, medic, stealth, sacrifice, hold).
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `CHOICE_MADE`, `CASUALTY_TAKEN`, `HEROIC_ACTION`, `GAME_LOADED`.
- **Outputs**: Publishes `REPUTATION_CHANGED` with updated scores, primary archetype, and unlocked doctrine perks.

### `v2/src/systems/DynamicEventManager.js`
- **Description**: Injects procedural dynamic battlefield encounters across 9 scenarios (`Friendly Patrol`, `Sniper Attack`, `Ammo Cache`, `Lost Recon Team`, `Captured Courier`, `Helicopter Support`, `Booby Trap`, `Vehicle Breakdown`, `Enemy Defector`). Evaluates heat and intel thresholds, manages cooldowns, executes branched tactical outcomes, and applies consequences over MessageBus.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus and configuration options.
  - `triggerEvent(eventId, context)`: Activates event, sets active state, publishes `DYNAMIC_EVENT_TRIGGERED`.
  - `resolveEvent(eventId, outcomeKey, customData)`: Resolves event, applies consequences (stats/casualties/morale), records history, publishes `DYNAMIC_EVENT_RESOLVED`.
  - `checkDynamicEventTrigger(scenePayload, heat, intel)`: Evaluates eligibility and rolls probability for procedural encounters.
  - `getEventDefinition(eventId)` / `getActiveEvent()` / `getEventHistory()`: Query methods.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `SCENE_RENDERED`, `CHOICE_MADE`, `STAT_CHANGED`, `GAME_LOADED`.
- **Outputs**: Publishes `DYNAMIC_EVENT_TRIGGERED` and `DYNAMIC_EVENT_RESOLVED` with outcome details and consequences.

## Systems (Phase 3)

### `v2/src/systems/WeatherSystem.js`
- **Description**: Simulates dynamic atmospheric conditions across 6 meteorological profiles (`Clear`, `Rain`, `Heavy Rain`, `Fog`, `Monsoon`, `Thunderstorm`). Calculates tactical combat and operational modifiers (stealth, visibility, movement speed, air support availability, radio reception, noise masking), handles probabilistic context-driven rolls, decrements durations on scene render, and applies environmental attrition.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus and configuration options.
  - `setWeather(type, duration)`: Sets active weather condition and optional duration; publishes `WEATHER_CHANGED`.
  - `rollWeather(context)`: Evaluates terrain (jungle, ridge, valley) and season (dry, monsoon) to roll weighted weather transitions.
  - `getCurrentWeather()`: Retrieves full metadata and modifier profile of active weather.
  - `getModifiers()`: Retrieves active numeric and boolean modifier dictionary.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `WEATHER_CHANGED` with updated atmospheric condition, duration, and tactical modifier dictionary.

### `v2/src/systems/RadioSystem.js`
- **Description**: Coordinates incoming and outgoing military transmissions with timed operational decision windows across 5 traffic channels (`HQ`, `Forward Observer`, `Medevac`, `Artillery`, `Air Support`). Manages urgent transmissions with active response windows, executes decision outcomes over MessageBus, handles timeout expirations (`RADIO_TIMEOUT`), and evaluates atmospheric interference (e.g. Thunderstorm -40% reception).
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus, optional WeatherSystem reference, and base reception.
  - `transmit(channel, message, options)`: Dispatches outgoing transmission on net, evaluates signal strength, logs history.
  - `receiveMessage(msgObj)`: Receives transmission, tags urgent decision choices, queues response lifetime, publishes `RADIO_MESSAGE_RECEIVED`.
  - `makeDecision(messageId, decisionKey)`: Resolves active urgent transmission, applies choice consequences/events, publishes `RADIO_DECISION`.
  - `checkTimeouts()`: Evaluates expired message response windows and publishes `RADIO_TIMEOUT`.
  - `getActiveMessages()` / `getMessageHistory()`: Query methods.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `SCENE_RENDERED`, `CHOICE_MADE`, `WEATHER_CHANGED`, `GAME_LOADED`.
- **Outputs**: Publishes `RADIO_MESSAGE_RECEIVED`, `RADIO_DECISION`, `RADIO_TIMEOUT`, and `RADIO_TRANSMISSION_SENT`.

### `v2/src/systems/IntelSystem.js`
- **Description**: Converts abstract ledger intel scores into qualitative battlefield awareness across 3 operational tiers (`LOW`: 0-24, `MEDIUM`: 25-59, `HIGH`: 60+). Provides tactical target revelations (enemy counts, hidden trails, fortified bunkers, weapon emplacements, ambush risk), calculates ambush probability modifiers (-35% for HIGH, -15% for MEDIUM, 0% for LOW), records recon discoveries, and monitors intel tier transitions.
- **Inputs**:
  - `constructor(messageBus: MessageBus, ledger: Ledger, options?: object)`: MessageBus, Ledger instance, and configuration options.
  - `getIntelTier(scoreOverride?)`: Retrieves active intelligence tier (`LOW`, `MEDIUM`, `HIGH`).
  - `getIntelQuality(scoreOverride?)`: Retrieves clarity percentage, tactical summary, and capability booleans.
  - `assessTarget(targetKey, baseInfo)`: Enriches target sector with qualitative revelations and effective ambush likelihood.
  - `getAmbushProbabilityModifier()`: Returns ambush percentage reduction based on active tier.
  - `recordReconDiscovery(discovery)`: Logs new recon discovery, prevents duplicates, publishes `INTEL_RECON_ACQUIRED`.
  - `getReconDiscoveries()`: Retrieves all recorded recon discoveries.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `STAT_CHANGED`, `CHOICE_MADE`, `RADIO_DECISION`, `GAME_LOADED`.
- **Outputs**: Publishes `INTEL_LEVEL_CHANGED` and `INTEL_RECON_ACQUIRED`.

## Systems (Phase 4)

### `v2/src/systems/EnemyCommander.js`
- **Description**: Autonomous NVA adversary AI that tracks player behavior, adapts operational doctrine, and adjusts aggression (0-100), awareness (0-100), adaptation (0-100), and active strategy (`Recon`, `Harassment`, `Ambush`, `Hunt`, `Full Assault`). Deploys doctrinal countermeasures against artillery (dispersed spider holes, deep bunkers) and stealth/bushwhacking (tracker dogs, ridgeline sweeps), shifting to active manhunts upon elevated heat or squad casualties.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus instance, initial metrics, and optional Ledger/SquadManager references.
  - `recordPlayerAction(actionType, details)`: Categorizes player tactical actions (artillery, airstrike, stealth, stationary, assault) and triggers doctrinal adaptations.
  - `adaptStrategy()`: Evaluates heat, squad casualties, and player tendencies to transition operational strategies.
  - `setStrategy(strategy, reason)`: Directly sets strategy and broadcasts `ENEMY_STRATEGY_CHANGED` and `ENEMY_HUNT_TRIGGERED`.
  - `modifyStat(stat, delta)`: Modifies aggression, awareness, or adaptation clamped [0, 100].
  - `getState()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `CHOICE_MADE`, `STAT_CHANGED`, `CASUALTY_TAKEN`, `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `ENEMY_ADAPTED`, `ENEMY_STRATEGY_CHANGED`, and `ENEMY_HUNT_TRIGGERED`.

### `v2/src/systems/AmbushSystem.js`
- **Description**: Suspense and encounter engine generating multi-stage ambush sequences across 4 outcomes (`False Alarm`, `Tripwire`, `RPG Attack`, `Sniper Fire`). Calculates dynamic risk probabilities factoring Heat, Intel depth, Terrain concealment, Weather interference, and Enemy Commander strategy. Manages active tension states, warning broadcasts, and outcome resolutions.
- **Inputs**:
  - `constructor(messageBus: MessageBus, systems?: object)`: MessageBus and system references (`ledger`, `intelSystem`, `weatherSystem`, `enemyCommander`).
  - `evaluateAmbushRisk(context)`: Calculates numerical risk percentage (5-95) and outcome weights based on 5 battlefield factors.
  - `rollAmbushSequence(context)`: Rolls encounter probability, sets active tension, and broadcasts `AMBUSH_WARNING`.
  - `resolveAmbush(outcomeKey, playerReaction)`: Resolves encounter with optional player reaction, dispatches consequences, and broadcasts `AMBUSH_EVADED`, `AMBUSH_TRIGGERED`, and `TENSION_RESOLVED`.
  - `getActiveTension()` / `getEncounterHistory()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `SCENE_RENDERED`, `CHOICE_MADE`, `WEATHER_CHANGED`, `ENEMY_STRATEGY_CHANGED`, `GAME_LOADED`.
- **Outputs**: Publishes `AMBUSH_WARNING`, `AMBUSH_TRIGGERED`, `AMBUSH_EVADED`, and `TENSION_RESOLVED`.

### `v2/src/systems/HeroicActionManager.js`
- **Description**: Identifies critical battlefield crises and generates emergent heroic feats (`Last Stand`, `Combat Rescue`, `Medic Save`, `Grenade Sacrifice`, `Scout Warning`, `Defensive Heroics`). Awards official military decorations (`Medal of Honor`, `Distinguished Service Cross`, `Silver Star`, `Bronze Star with 'V'`, `Purple Heart`) with permanent citations formatted in PST per Directive 13.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus, SquadManager reference, and timezone configuration.
  - `triggerHeroicAction(soldierId, actionType, details)`: Executes heroic act, generates citation, awards medal, and broadcasts `HEROIC_ACTION`.
  - `awardMedal(soldierId, medalType, citation, meta)`: Records medal decoration and broadcasts `MEDAL_AWARDED`.
  - `checkHeroicOpportunity(context)`: Evaluates crisis context to identify eligible valorous actions.
  - `getHeroicActions()` / `getMedalsForSoldier(id)` / `getAllMedals()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `CASUALTY_TAKEN`, `AMBUSH_TRIGGERED`, `CHOICE_MADE`, `GAME_LOADED`.
- **Outputs**: Publishes `HEROIC_ACTION` and `MEDAL_AWARDED`.

## Systems (Phase 5)

### `v2/src/systems/TacticalMapManager.js`
- **Description**: Coordinates tactical map data, spatial tracking, breadcrumb path history, and Intel-gated tactical markers for Grid 881 and Highway 9 across 7 marker categories (`enemy_location`, `ambush`, `mortar_impact`, `minefield`, `casualty`, `extraction_zone`, `recon_discovery`). Enforces dynamic Intel-tier visibility gating (LOW, MEDIUM, HIGH) and records squad movement breadcrumbs with timestamps adhering to Directive 13 PST.
- **Inputs**:
  - `constructor(messageBus: MessageBus, options?: object)`: MessageBus, IntelSystem reference, Ledger reference, and timezone configuration.
  - `addMarker(type, x, y, label, data)`: Adds tactical marker, sets visibility threshold, and broadcasts `MAP_MARKER_ADDED` and `MAP_UPDATED`.
  - `recordPath(x, y, sceneId)`: Appends breadcrumb to path history and broadcasts `MAP_UPDATED`.
  - `getMarkers(intelTierOverride)`: Filters markers based on active or overridden Intel tier.
  - `getPathHistory()` / `clearMarkers()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `SCENE_RENDERED`, `CASUALTY_TAKEN`, `AMBUSH_TRIGGERED`, `INTEL_RECON_ACQUIRED`, `INTEL_LEVEL_CHANGED`, `GAME_LOADED`.
- **Outputs**: Publishes `MAP_UPDATED` and `MAP_MARKER_ADDED`.

### `v2/src/systems/WoundedSoldierManager.js`
- **Description**: Governs agonizing wartime decisions when soldiers are wounded in action (WIA) rather than immediately killed. Tracks casualty status, active carriers, stabilization status, and bleedout countdown timers. Evaluates 4 command choices: `Carry Soldier` (-25% mobility, -1 firepower rifle penalty), `Call Medevac` (evacuates soldier, +25 Heat spike, requires LZ security), `Hold Position` (stabilizes wounds, squad pinned down), and `Leave Behind` (+0 mobility penalty, catastrophic -35 squad morale shock, triggers Survivor's Guilt, permanent Journal entry, trust drops to 0).
- **Inputs**:
  - `constructor(messageBus: MessageBus, systems?: object)`: MessageBus and system references (`squadManager`, `ledger`, `conditionManager`, `relationshipManager`, `journal`).
  - `woundSoldier(soldierId, severity, details)`: Registers WIA casualty with severity-based bleedout timer and broadcasts `SOLDIER_WOUNDED`.
  - `assignCarrier(woundedId, carrierId)`: Assigns able-bodied squad member to carry casualty and broadcasts `WOUNDED_DECISION_MADE`.
  - `releaseCarrier(woundedId)`: Releases carrier from casualty.
  - `callMedevac(woundedId, lzStatus)`: Evacuates soldier, spikes Heat by +25, and broadcasts `SOLDIER_EVACUATED` and `WOUNDED_DECISION_MADE`.
  - `abandonSoldier(woundedId, reason)`: Leaves soldier behind, inflicts -35 morale shock, triggers Survivor's Guilt, drops trust to 0, logs journal entry, and broadcasts `SOLDIER_ABANDONED`.
  - `stabilizeSoldier(woundedId, medicId)`: Stabilizes casualty and halts bleedout timer.
  - `getWoundedSoldiers()` / `getCarriedSoldiers()` / `getMobilityModifier()` / `getFirepowerModifier()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `CASUALTY_TAKEN`, `CHOICE_MADE`, `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `SOLDIER_WOUNDED`, `WOUNDED_DECISION_MADE`, `SOLDIER_EVACUATED`, `SOLDIER_ABANDONED`, and `SOLDIER_BLED_OUT`.

### `v2/src/systems/BattlefieldRecoverySystem.js`
- **Description**: Provides post-engagement scavenging choices weighing tactical reward against the deadly risk of lingering under NVA observation across 5 actions: `Recover Documents` (+15 to +25 Intel, +10 Heat), `Search Bodies` (+20 Supplies, -5 Morale for recruits, +15 Heat), `Salvage Weapons` (+10 Supplies, +1 Valor Point, +20 Heat), `Recover Equipment` (+15 Supplies, +5 Heat), and `Evacuate Fallen` (+10 Squad Morale floor, +25 Heat).
- **Inputs**:
  - `constructor(messageBus: MessageBus, systems?: object)`: MessageBus, Ledger, SquadManager, EnemyCommander, and Journal references.
  - `generateRecoveryOptions(context)`: Evaluates combat context and generates eligible scavenging choices; broadcasts `RECOVERY_OFFERED`.
  - `executeRecovery(optionKey)`: Applies resource rewards, increases Heat, notifies EnemyCommander of lingering, adjusts morale/valor, logs journal entry, and broadcasts `RECOVERY_EXECUTED`.
  - `getRecoveryHistory()` / `serialize()` / `deserialize(data)`: Query and persistence routines.
  - Events: `SCENE_RENDERED`, `CHOICE_MADE`, `GAME_LOADED`.
- **Outputs**: Publishes `RECOVERY_OFFERED` and `RECOVERY_EXECUTED`.

## Systems (Phase 6)

### `v2/src/systems/ExtractionSystem.js`
- **Description**: Procedurally determines and executes the campaign endgame extraction at LZ X-Ray based on cumulative campaign history across all 16 systems. Evaluates 6 dynamic ending archetypes (`clean_extraction`, `running_gunfight`, `helicopter_shot_down`, `last_stand`, `rear_guard_sacrifice`, `split_evacuation`). Generates emergent war story epilogues honoring the squad's sacrifice ("Washington died saving Jenkins"), resolves extraction consequences (KIA, medals, journal logs), compiles extraction summaries, and supports complete serialization.
- **Inputs**:
  - `constructor(messageBus: MessageBus, systems?: object, options?: object)`: MessageBus, system references (squadManager, ledger, woundedSoldierManager, intelSystem, reputationManager, weatherSystem, heroicActionManager, enemyCommander, journal), and configuration options.
  - `evaluateExtraction(contextOverrides?: object)`: Evaluates dynamic criteria across surviving soldiers, wounded personnel, Heat, Intel tier, Command Reputation, Weather, Heroic actions, and Enemy Commander aggression to compute the matching ending archetype and outcome score; broadcasts `EXTRACTION_CALCULATED`.
  - `executeExtraction(archetypeId?: string, forcedDetails?: object)`: Executes extraction lifecycle, applies casualties, triggers heroic sacrifices/medals, logs journal chronicling, and broadcasts `EXTRACTION_STARTED`, `EXTRACTION_RESOLVED`, `EXTRACTION_EVACUATED`, `EXTRACTION_FALLEN`, `EXTRACTION_HEROIC_SACRIFICE`, and `EXTRACTION_COMPLETED`.
  - `generateWarStoryEpilogue(archetypeId, details)`: Generates atmospheric emergent military narrative weaving in fallen comrades, heroic deeds, and weather/reputation context.
  - `getExtractionSummary()`: Returns complete mission conclusion breakdown including archetype, outcome score, survivors, wounded, fallen, medals, and epilogue text.
  - `serialize()` / `deserialize(data)`: State persistence routines.
  - Events: `CHOICE_MADE`, `SCENE_RENDERED`, `GAME_LOADED`.
- **Outputs**: Publishes `EXTRACTION_CALCULATED`, `EXTRACTION_STARTED`, `EXTRACTION_RESOLVED`, `EXTRACTION_EVACUATED`, `EXTRACTION_FALLEN`, `EXTRACTION_HEROIC_SACRIFICE`, and `EXTRACTION_COMPLETED`.

## Entities (v2)

### `v2/src/entities/Soldier.js`
- **Description**: Entity class representing an individual squad member with tracking for health/life status, morale, role, primary and discovered traits, wounds, and conditions.
- **Inputs**:
  - `constructor(id, name, role, trait, traits?, wounds?, conditions?, status?)`: Identifiers, traits array, physical trauma, and operational status.
  - `setAlive(status: boolean)` / `set alive(status: boolean)`: Sets alive/casualty state.
  - `adjustMorale(delta: number)`: Adjusts morale value clamped between 0 and 100.
  - `addTrait(trait)` / `hasTrait(trait)` / `getTraits()`: Trait management methods.
  - `addWound(wound)` / `removeWound(wound)` / `hasWound(wound)`: Physical trauma tracking.
  - `addCondition(condition)` / `removeCondition(condition)` / `hasCondition(condition)`: Operational status modifiers.
  - `toJSON()`: Serializes soldier to plain JavaScript object.
- **Outputs**: Instantiated Soldier object with getters, setters, and serialization methods.

### `v2/src/entities/SquadManager.js`
- **Description**: Manages squad roster lifecycle, casualty handling, squad status broadcasting, and roster restoration. Supports string IDs or object formats in `CASUALTY_TAKEN` events, handles `GAME_LOADED` events, and maintains the default squad roster (SSG Miller, CPL Brady, Duke, PFC Jenkins, DOC Baker, CPL Thompson, SP4 Torres, PFC Kowalski, LCPL Washington).
- **Inputs**:
  - `constructor(messageBus: MessageBus, initialRoster?: Soldier[])`: MessageBus instance and optional initial roster.
  - Event `CASUALTY_TAKEN`: Receives payload with soldier ID to mark soldier fallen and broadcasts rich casualty data.
  - Event `GAME_LOADED`: Restores squad roster from loaded state.
  - `setRoster(roster: Array<Soldier|object>)`: Restores roster from serialized save data preserving traits/wounds/status.
  - `resetToDefault()`: Resets roster to original starting squad.
  - `addSoldier(soldier: Soldier)`: Adds new soldier to roster.
  - `getSoldiers()` / `getAliveSoldiers()` / `getCasualties()` / `getWoundedSoldiers()` / `getSoldierById(id)`: Query methods.
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
- **Description**: Web application entrypoint HTML file hosting the DOM mount element (`#app`), military-themed typography (`Saira Condensed`, `Courier Prime`, `Share Tech Mono`), and comprehensive CSS stylesheet supporting the Advanced Interactive HUD & Dashboard Expansion. Defines styling for responsive tab navigation (`.nav-tabs`, `.nav-tab`, `.tab-badge`), tab content panes (`.tab-pane`), PRC-25 Field Radio console (frequency dial tuner, channel buttons, transmission cards, signal reception quality meter), War Journal reader (category filters, official military citation plaques, in memoriam section, tag pills), AOR Tactical Map (grid lines, elevation contours, SVG vector overlay, marker diamonds/triangles/crosses/squares, Intel-gated layer toggles), Squad Psych & Dossier 9-card grid (vitality & morale bars, condition pills, trust matrix bonds, carrier pairing and triage status), and loads `src/main.js` as an ES module with cache busting (`main.js?v=9`).
- **Inputs**: Browser HTTP request / direct file open.
- **Outputs**: Renders base HTML layout, military HUD theme styles, responsive tabs and panels, and boots ES module scripts.

### `v2/src/main.js`
- **Description**: Composition root and UI dashboard coordinator that wires together all 16 game systems with campaign scenario data and the DOM. Implements the Advanced Interactive HUD & Dashboard Expansion featuring:
  * Responsive 6-tab military command interface (`[ BRIEFING & ORDERS ]`, `[ FIELD RADIO (PRC-25) ]`, `[ WAR JOURNAL ]`, `[ AOR TACTICAL MAP ]`, `[ SQUAD DOSSIER ]`, `[ EVENT STREAM ]`) with unread badge alerts and active tab switcher.
  * Field Radio console renderer (`renderRadioUI`): Frequency tuner dial buttons (-0.5 / +0.5 MHz), channel switchers (HQ, Dustoff, Battery Alpha, Spooky, Recon), reception meter with atmospheric weather degradation, urgent transmission cards with decision buttons, and net transmission logs.
  * War Journal & Medals reader (`renderJournalUI`): Category filters (`ALL`, `COMBAT`, `CASUALTY`, `HEROISM & MEDALS`, `COMMAND`, `WEATHER`), official military medal citation plaques with Directive 13 PST timestamps, fallen honors memorial section, and chronological tactical dispatches with location tags.
  * AOR Tactical Map renderer (`renderTacticalMapUI`): SVG canvas with coordinate readouts, topographical elevation lines, animated squad position beacon, patrol breadcrumbs polyline, and Intel-gated layer toggles (Enemy, Ambushes, Mortars, Minefields, Recon, Casualties).
  * Squad Psych & Dossier renderer (`renderDossierUI`): 9 detailed soldier cards covering vitality/morale progress bars, psychological condition pills (positive/negative/mixed), trust matrix relationships (friends/rivals/bonds), carrier pairings, and emergency triage status (stabilization, bleedout countdowns).
  * Choice resolution and narrative flow with Autonomous Interceptor (Fog of War panic trigger under high Heat/Stress), endgame dynamic extraction conclusion overlay, save game management controls (Resume, New Game, Manual Save, Clear Save), and test event triggers (`btn-test-stat`, `btn-test-heat`, `btn-test-stress`, `btn-test-casualty`).
- **Inputs**: Imported core modules, systems, entities, state, data, and DOM elements from `index.html`.
- **Outputs**: Initialized OOP system instances, real-time DOM event logger stream, interactive tactical narrative UI with choice buttons, live interactive HUD tab panes, campaign save status bar and controls, endgame extraction conclusion modal, and exported module references.

## Campaign Data (v2)

### `v2/src/data/campaign_3_us.js`
- **Description**: Data module containing the 16-scene branching narrative graph for Campaign 3 (Khe Sanh) US scenario. Focuses entirely on a continuous 1-hour slice of combat on the morning of Jan 20th, covering the defense of Hill 881 South against a dawn sapper probe and mortar attack. Maintains strict spatial and chronological continuity between scenes. Includes tactical choice resolution text (`resolutionText`), soldier survival requirements, and MessageBus event publishing (`STAT_CHANGED`, `CASUALTY_TAKEN`).
- **Inputs**: None (static data export module).
- **Outputs**: Exports `campaign3US` dictionary object containing 16 fully connected scene definitions with locations, narratives, tactical choices with `resolutionText`, choice requirements, and event descriptors.

### `v2/src/data/campaign_4_lz.js`
- **Description**: Data module containing the narrative graph for Campaign 4 (LZ Extraction). Continues from Campaign 3, featuring a fighting retreat through the jungle, interactions with M113 ACAVs, and extraction at LZ X-Ray. Features map coordinates (`mapX`, `mapY`) for the tactical visual map.
- **Inputs**: None (static data export module).
- **Outputs**: Exports `campaign4LZ` dictionary object.

## Automated Testing

### `v2/test/phase1.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict`.
- **Inputs**: `npm test` or `node --test v2/test/phase1.test.js`.
- **Outputs**: Executes 27 test cases validating Soldier entity enhancements, SquadManager casualty broadcasting, RelationshipManager trust/grief/rivalries, TraitManager discovery/deduplication/evaluations, Journal PST logging/filtering, and end-to-end multi-system event choreography.

### `v2/test/phase2.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict` covering Phase 2 systems.
- **Inputs**: `npm test` or `node --test v2/test/phase2.test.js`.
- **Outputs**: Executes 21 test cases validating PsychologicalConditionManager condition assignment/deduplication/evaluations, ReputationManager 6 archetypes/primary doctrine/perks/choices, DynamicEventManager 9 procedural scenarios/resolution/probability, SaveManager v3 persistence, and cross-system event orchestration.

### `v2/test/phase3.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict` covering Phase 3 systems.
- **Inputs**: `npm test` or `node --test v2/test/phase3.test.js`.
- **Outputs**: Executes 21 test cases validating WeatherSystem 6 weather types/modifiers/rolls/transitions, RadioSystem 5 channels/urgent decisions/timeouts/weather degradation, IntelSystem 3 tiers/qualitative target assessments/recon tracking, SaveManager v3 persistence for Phase 3 systems, and cross-system MessageBus integration.

### `v2/test/phase4.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict` covering Phase 4 systems.
- **Inputs**: `npm test` or `node --test v2/test/phase4.test.js`.
- **Outputs**: Executes 26 test cases validating EnemyCommander AI aggression/awareness/adaptation/strategies/countermeasures/serialization, AmbushSystem 5-factor risk evaluation/suspense sequences/outcomes/evasion/serialization, HeroicActionManager 6 heroic acts/medal decorations/Directive 13 citations/serialization, SaveManager Phase 4 state persistence, and full cross-system MessageBus integration.

### `v2/test/phase5.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict` covering Phase 5 systems.
- **Inputs**: `npm test` or `node --test v2/test/phase5.test.js`.
- **Outputs**: Executes 23 test cases validating TacticalMapManager 7 marker types/Intel visibility filtering/path breadcrumbs/serialization, WoundedSoldierManager triage/carry/medevac/hold/abandonment/bleedout/serialization, BattlefieldRecoverySystem 5 post-combat scavenging choices/rewards/Heat escalation/serialization, SaveManager Phase 5 state persistence, and full cross-system MessageBus choreography.

### `v2/test/phase6.test.js`
- **Description**: Automated unit and integration test suite using Node.js built-in `node:test` and `node:assert/strict` covering Phase 6 systems.
- **Inputs**: `npm test` or `node --test v2/test/phase6.test.js`.
- **Outputs**: Executes 16 test cases validating ExtractionSystem 6 ending archetypes/calculation/lifecycle execution/emergent war story generation/serialization, master SaveManager round-trip persistence across all 16 systems with 100% fidelity, and full cross-system MessageBus integration.

## Utilities

### `system_ctl.sh`
- **Description**: Bash script to manage the local HTTP game server.
- **Inputs**: Commands (`start`, `stop`, `restart`, `status`).
- **Outputs**: Spawns or kills `python3 -m http.server`, manages `.server.pid`, and outputs status text.
