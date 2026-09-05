# Changelog: Squad Leader: Vietnam
<!-- Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817 -->

## [v3.1.0-hud-expansion] - 2026-09-05

- **Timestamp**: 2026-09-05T03:24:00-07:00 (PST)
- **Modified Files**:
  - `v2/index.html`
  - `v2/src/main.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Summary**:
  - Implemented the Advanced Interactive HUD & Dashboard Expansion for *Squad Leader: Vietnam V3*.
  - **Military Tab Navigation**:
    * Structured a 6-tab military command terminal: `[ BRIEFING & ORDERS ]`, `[ FIELD RADIO (PRC-25) ]`, `[ WAR JOURNAL ]`, `[ AOR TACTICAL MAP ]`, `[ SQUAD DOSSIER ]`, and `[ EVENT STREAM ]`.
    * Implemented alert badge system (`.tab-badge`) displaying live counters for active urgent radio transmissions and unread war journal dispatches.
    * Added responsive mobile/desktop CSS styling with active indicators, borders, and smooth state switching.
  - **Field Radio (AN/PRC-25) Console**:
    * Added tactical frequency tuner dial with interactive -0.5 MHz / +0.5 MHz stepper buttons.
    * Added quick-switch preset channel selectors: HQ [30.0 MHz], Dustoff [42.5 MHz], Battery Alpha [55.0 MHz], Spooky [68.0 MHz], Recon [74.5 MHz].
    * Added dynamic signal reception quality gauge calculated from atmospheric conditions (clear, overcast, monsoon, thunderstorm), radio modifiers, and static interference.
    * Embedded priority incoming transmission cards displaying remaining turn windows and interactive decision buttons wired directly to `RadioSystem.makeDecision()`.
    * Added reverse-chronological net communication log.
  - **War Journal & Medals Reader**:
    * Implemented category filters (`ALL`, `COMBAT`, `CASUALTIES`, `HEROISM & MEDALS`, `COMMAND`, `WEATHER`).
    * Added official military decoration citation plaques with gold borders, recipient names, action tags, and Directive 13 PST timestamps.
    * Added "In Memoriam" fallen squad honors section for KIA casualties.
    * Added chronological war diary entry cards with location badges, hashtags, and category color accents.
  - **AOR Tactical Map (Grid 881 & Highway 9)**:
    * Implemented responsive SVG vector map canvas with coordinate readouts (`AOR GRID 881`), topographic elevation lines, and animated pulse squad position beacon.
    * Added patrol breadcrumb trail rendering squad movement history with waypoints.
    * Implemented dynamic Intel-gated layer toggles: Enemy [HIGH], Ambushes [MED], Mortars [MED], Minefields [HIGH], Recon [MED], and Casualties [LOW] filtering SVG markers in real time.
  - **Squad Psych & Dossier (9-Soldier Grid)**:
    * Rendered comprehensive military dossier cards for all 9 squad members (`miller`, `brady`, `duke`, `jenkins`, `baker`, `thompson`, `torres`, `kowalski`, `washington`).
    * Displayed vitality and morale progress bars with color thresholds (green/yellow/red).
    * Rendered psychological condition pills categorized by positive, negative, and mixed situational effects with tooltip explanations.
    * Visualized trust matrix comrade bonds showing mentorships, friendships, rivalries, and trust percentages.
    * Added carrier pairings and emergency triage status displaying wound severity, medic stabilization, and bleedout countdown timers.
  - **Event Orchestration & Test Buttons**:
    * Subscribed all new UI components to MessageBus events: `RADIO_MESSAGE_RECEIVED`, `RADIO_DECISION`, `RADIO_TIMEOUT`, `JOURNAL_ENTRY_ADDED`, `MEDAL_AWARDED`, `MAP_UPDATED`, `MAP_MARKER_ADDED`, `RELATIONSHIP_UPDATED`, `CONDITION_GAINED`, `CONDITION_REMOVED`, `SOLDIER_WOUNDED`, `WOUNDED_DECISION_MADE`, `SOLDIER_EVACUATED`, and `SOLDIER_ABANDONED`.
    * Wired test event buttons for rapid simulation: `btn-test-stat` (+10 Intel), `btn-test-heat` (+15 Heat), `btn-test-stress` (+10 Stress), and `btn-test-casualty` (wounding/KIA).
- **Reason**:
  - Deliver deep tactile immersion and immediate situational awareness by connecting all 16 background architectural systems to an interactive, military-authentic visual command dashboard.
- **Impact**:
  - 100% test pass rate across all 134 automated unit/integration tests (Phase 1 through Phase 6) with 0 regressions. Clean execution in both Node.js and modern browsers.

---

## [v3.0.0-phase6] - 2026-09-05

- **Timestamp**: 2026-09-05T03:07:00-07:00 (PST)
- **Modified Files**:
  - `v2/index.html`
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `v2/src/systems/HeroicActionManager.js`
  - `v2/src/systems/IntelSystem.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Created Files**:
  - `v2/src/systems/ExtractionSystem.js`
  - `v2/test/phase6.test.js`
- **Summary**:
  - Implemented Phase 6 architecture of Squad Leader: Vietnam V3.
  - **Dynamic Extraction Endgame (`ExtractionSystem.js`)**: Procedurally calculates and executes the LZ X-Ray extraction endgame based on cumulative campaign history across all 16 systems. Implements 6 dynamic ending archetypes:
    * `clean_extraction`: Low heat (<= 35), clear weather, intact squad, high command reputation -> Clean liftoff, door gunners suppress woodline, all survivors make it home.
    * `running_gunfight`: High heat (50-75), aggressive enemy probe -> Hot LZ, suppressive fire from huey door gunners, sprint across open field under mortar fire.
    * `helicopter_shot_down`: Extreme enemy aggression (>= 75) with anti-air or thunderstorm -> Extraction bird takes RPG hit during approach/hover, forced crash-landing in perimeter, immediate defense and secondary lift.
    * `last_stand`: Max heat (>= 80), depleted supplies (<= 15), enemy Full Assault -> Overrun LZ, defensive perimeter collapse, broken arrow call, heroic sacrifices.
    * `rear_guard_sacrifice`: Surviving wounded personnel, hostile pursuit -> One soldier stays behind to hold the tree line with machine gun, enabling extraction bird liftoff.
    * `split_evacuation`: Large squad with wounded, adverse weather, limited lift -> Huey can only take half the squad, first lift leaves wounded + medic, second bird delayed.
  - **Emergent War Story Generation**: Epilogue narratives dynamically weave in names of surviving and fallen squad members, specific heroic acts ("Washington died saving Jenkins"), weather conditions, and command doctrine.
  - **Full Execution Lifecycle**: Triggers KIA casualties on sacrifices, awards Medal of Honor / Distinguished Service Cross decorations, records military logs in Journal, and broadcasts lifecycle events (`EXTRACTION_CALCULATED`, `EXTRACTION_STARTED`, `EXTRACTION_RESOLVED`, `EXTRACTION_EVACUATED`, `EXTRACTION_FALLEN`, `EXTRACTION_HEROIC_SACRIFICE`, and `EXTRACTION_COMPLETED`).
  - **Master Save/Load Round-Trip Persistence (`SaveManager.js`)**: Integrated `ExtractionSystem` into SaveManager, completing state serialization and restoration across ALL 16 core architectural systems (`SceneManager`, `SquadManager`, `Ledger`, `RelationshipManager`, `TraitManager`, `Journal`, `PsychologicalConditionManager`, `ReputationManager`, `DynamicEventManager`, `WeatherSystem`, `RadioSystem`, `IntelSystem`, `EnemyCommander`, `AmbushSystem`, `HeroicActionManager`, `TacticalMapManager`, `WoundedSoldierManager`, `BattlefieldRecoverySystem`, `ExtractionSystem`).
  - **Main Composition Root & Endgame UI (`main.js`, `index.html`)**: Added `#extraction-status` badge to HUD header, implemented `renderExtractionConclusionUI()` modal presenting the War Story Epilogue, official citations, honored fallen heroes list, survivor roster, and campaign restart/replay controls. Cache-busted script import to `main.js?v=8`.
  - **System Ergonomics & Aliases (`HeroicActionManager.js`, `IntelSystem.js`)**: Added `getMedals()` and medal field aliases (`medal`, `citationText`) to HeroicActionManager; added `getDiscoveries()` and `getState()` to IntelSystem to ensure flawless cross-system integration.
  - **Automated Test Suite (`phase6.test.js`)**: Created 16 comprehensive automated unit and integration tests using Node.js native `node:test` runner covering all 6 ending archetypes, execution lifecycles, emergent war stories, state serialization, master save/load across all 16 systems with 100% fidelity, and full cross-system MessageBus integration.
- **Reason**:
  - Deliver the climactic final chapter of Squad Leader: Vietnam V3, ensuring every choice, casualty, heroic action, and environmental challenge culminates in a meaningful, emergent narrative ending with complete persistence across all systems.
- **Impact**:
  - 100% test pass rate across all 134 automated tests (27 Phase 1 + 21 Phase 2 + 21 Phase 3 + 26 Phase 4 + 23 Phase 5 + 16 Phase 6) with zero regressions on existing systems.

---

## [v3.0.0-phase5] - 2026-09-05

- **Timestamp**: 2026-09-05T02:54:00-07:00 (PST)
- **Modified Files**:
  - `v2/src/entities/Soldier.js`
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Created Files**:
  - `v2/src/systems/TacticalMapManager.js`
  - `v2/src/systems/WoundedSoldierManager.js`
  - `v2/src/systems/BattlefieldRecoverySystem.js`
  - `v2/test/phase5.test.js`
- **Summary**:
  - Implemented Phase 5 architecture of Squad Leader: Vietnam V3.
  - **Advanced Tactical Map (`TacticalMapManager.js`)**: Coordinates tactical map data, spatial tracking, breadcrumb path history, and Intel-gated tactical markers across 7 categories (`enemy_location`, `ambush`, `mortar_impact`, `minefield`, `casualty`, `extraction_zone`, `recon_discovery`). Enforces dynamic Intel-tier visibility gating: LOW Intel reveals casualties and broad extraction zones; MEDIUM Intel reveals mortar craters, recon findings, and ambush zones; HIGH Intel reveals exact spider holes, minefields, and bunkers. Tracks squad movement breadcrumbs with timestamps adhering to Directive 13 PST, and publishes `MAP_UPDATED` and `MAP_MARKER_ADDED`.
  - **Wounded Soldier Decision System (`WoundedSoldierManager.js`)**: Governs agonizing wartime decisions when soldiers are wounded in action (WIA) rather than immediately killed. Tracks casualty status, active carriers, stabilization state, and bleedout countdown timers. Evaluates 4 high-stakes command decisions: `Carry Soldier` (prevents bleedout, incurs -25% mobility penalty and -1 firepower rifle penalty), `Call Medevac` (evacuates soldier to safety, spikes Heat by +25, requires LZ security), `Hold Position` (field medic stabilizes wounds in place, squad pinned down), and `Leave Behind` (squad retains max mobility, catastrophic -35 squad morale shock, triggers Survivor's Guilt, permanent Journal entry, trust drops to 0). Publishes `SOLDIER_WOUNDED`, `WOUNDED_DECISION_MADE`, `SOLDIER_EVACUATED`, `SOLDIER_ABANDONED`, and `SOLDIER_BLED_OUT`.
  - **Battlefield Recovery System (`BattlefieldRecoverySystem.js`)**: Provides post-engagement scavenging choices weighing tactical reward against the deadly risk of lingering under NVA observation across 5 actions: `Recover Documents` (+15 to +25 Intel, +10 Heat), `Search Bodies` (+20 Supplies, -5 Morale for recruits, +15 Heat), `Salvage Weapons` (+10 Supplies, +1 Valor Point, +20 Heat), `Recover Equipment` (+15 Supplies, +5 Heat), and `Evacuate Fallen` (+10 Squad Morale floor, +25 Heat). Notifies EnemyCommander of lingering and coordinates Heat escalation. Publishes `RECOVERY_OFFERED` and `RECOVERY_EXECUTED`.
  - **SaveManager & Composition Root Integration (`SaveManager.js`, `main.js`)**: Extended state persistence to serialize and restore tactical map markers and path history, active wounded casualties and carrier assignments, and recovery history upon `loadGame()`. Wired Phase 5 systems into `main.js` and exported them.
  - **Automated Test Suite (`phase5.test.js`)**: Created 23 comprehensive automated unit and integration tests using Node.js native `node:test` runner.
- **Reason**:
  - Provide spatial battlefield visualization with dynamic Fog of War, harrowing life-or-death squad triage decisions, and agonizing risk/reward post-engagement scavenging choices for Squad Leader: Vietnam V3 Phase 5.
- **Impact**:
  - 100% test pass rate across all 118 automated tests (27 Phase 1 + 21 Phase 2 + 21 Phase 3 + 26 Phase 4 + 23 Phase 5) with zero regressions on existing systems.

---

- **Timestamp**: 2026-09-05T02:49:00-07:00 (PST)
- **Modified Files**:
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Created Files**:
  - `v2/src/systems/EnemyCommander.js`
  - `v2/src/systems/AmbushSystem.js`
  - `v2/src/systems/HeroicActionManager.js`
  - `v2/test/phase4.test.js`
- **Summary**:
  - Implemented Phase 4 architecture of Squad Leader: Vietnam V3.
  - **Enemy Commander Autonomous AI (`EnemyCommander.js`)**: Implemented autonomous NVA adversary AI tracking player behavior, adapting operational doctrine across 5 strategies (`Recon`, `Harassment`, `Ambush`, `Hunt`, `Full Assault`), adjusting aggression, awareness, and adaptation metrics (0-100), deploying countermeasures against heavy fire (spider holes, deep bunkers) and stealth/bushwhacking (trackers, ridgeline sweeps), and publishing `ENEMY_ADAPTED`, `ENEMY_STRATEGY_CHANGED`, and `ENEMY_HUNT_TRIGGERED`.
  - **Tension & Ambush System (`AmbushSystem.js`)**: Implemented suspense encounter engine simulating 4 distinct outcomes (`False Alarm`, `Tripwire`, `RPG Attack`, `Sniper Fire`). Dynamically calculates encounter risk based on 5 battlefield factors (Heat, Intel depth, Terrain, Weather, and Enemy Strategy). Manages multi-stage suspense sequences, warning cues, tactical evasion, and outcome consequences (`AMBUSH_WARNING`, `AMBUSH_TRIGGERED`, `AMBUSH_EVADED`, `TENSION_RESOLVED`).
  - **Heroic Action System (`HeroicActionManager.js`)**: Built system identifying critical battlefield crises and triggering 6 emergent heroic feats (`Last Stand`, `Combat Rescue`, `Medic Save`, `Grenade Sacrifice`, `Scout Warning`, `Defensive Heroics`). Awards 5 military decorations (`Medal of Honor`, `Distinguished Service Cross`, `Silver Star`, `Bronze Star with 'V'`, `Purple Heart`), generating permanent official citation text with PST timestamps adhering strictly to Directive 13, publishing `HEROIC_ACTION` and `MEDAL_AWARDED`.
  - **SaveManager & Composition Root Integration (`SaveManager.js`, `main.js`)**: Extended save persistence to serialize and restore Enemy Commander state, active ambush tension/history, and heroic actions/medals. Added dynamic NVA Strategy and Ambush Tension badges to the HUD dashboard.
  - **Automated Test Suite (`phase4.test.js`)**: Created 26 unit and integration tests using native `node:test` runner.
- **Reason**:
  - Deliver dynamic adversarial intelligence, suspenseful jungle ambush encounters, and emotional war-story valor with permanent military citations for Squad Leader: Vietnam V3 Phase 4.
- **Impact**:
  - 100% test pass rate across all 95 automated tests (27 Phase 1 + 21 Phase 2 + 21 Phase 3 + 26 Phase 4) with zero regressions on existing systems.

---

## [v3.0.0-phase3] - 2026-09-05

- **Timestamp**: 2026-09-05T02:43:00-07:00 (PST)
- **Modified Files**:
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Created Files**:
  - `v2/src/systems/WeatherSystem.js`
  - `v2/src/systems/RadioSystem.js`
  - `v2/src/systems/IntelSystem.js`
  - `v2/test/phase3.test.js`
- **Summary**:
  - Implemented Phase 3 architecture of Squad Leader: Vietnam V3.
  - **Dynamic Weather System (`WeatherSystem.js`)**: Simulates 6 meteorological profiles (`Clear`, `Rain`, `Heavy Rain`, `Fog`, `Monsoon`, `Thunderstorm`). Applies tactical combat and movement modifiers (+15% to +25% stealth, -20% to -35% visibility, -15% to -25% movement speed, -30% artillery accuracy, air support grounding, noise masking, supplies/morale attrition), context-sensitive weather rolling, duration management, and publishes `WEATHER_CHANGED`.
  - **Radio Communication System (`RadioSystem.js`)**: Coordinates tactical transmissions across 5 nets (`HQ`, `Forward Observer`, `Medevac`, `Artillery`, `Air Support`). Implements urgent transmissions with decision options and active response lifetimes, evaluates timeout transitions (`RADIO_TIMEOUT`), dispatches choice resolution consequences (`RADIO_DECISION`), models atmospheric weather interference (Thunderstorms degrade radio reception by -40%), and tracks full transmission logs.
  - **Intelligence Expansion System (`IntelSystem.js`)**: Converts numerical ledger intel into qualitative situational awareness across 3 operational tiers (`LOW`: 0-24, `MEDIUM`: 25-59, `HIGH`: 60+). Provides target sector assessments (revealing enemy counts, hidden trails, fortified bunkers, machine gun emplacements, and ambush likelihood), calculates ambush risk modifiers (-35% for HIGH, -15% for MEDIUM, 0% for LOW), tracks recon discoveries (`INTEL_RECON_ACQUIRED`), and monitors tier threshold transitions (`INTEL_LEVEL_CHANGED`).
  - **SaveManager & Composition Root Integration (`SaveManager.js`, `main.js`)**: Upgraded SaveManager version 3 schema to serialize weather state, active urgent radio messages, communication history, and recon discoveries. Wired all Phase 3 systems into `main.js`, added live Weather and Radio status indicators to HUD header, and added Intel Tier badge to command stats.
  - **Automated Test Suite (`phase3.test.js`)**: Created 21 automated unit and integration tests using Node.js native `node:test` runner.
- **Reason**:
  - Provide tactical atmospheric friction, realistic command communication response windows, and deep intelligence progression to heighten immersion and strategic decision-making in the Vietnam theater.
- **Impact**:
  - 100% test pass rate across 69 automated tests (27 Phase 1 + 21 Phase 2 + 21 Phase 3) with zero regressions on existing systems.

---

## [v3.0.0-phase2] - 2026-09-05

- **Timestamp**: 2026-09-05T02:40:00-07:00 (PST)
- **Modified Files**:
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `CATALOG.md`
  - `CHANGELOG.md`
- **Created Files**:
  - `v2/src/systems/PsychologicalConditionManager.js`
  - `v2/src/systems/ReputationManager.js`
  - `v2/src/systems/DynamicEventManager.js`
  - `v2/test/phase2.test.js`
- **Summary**:
  - Implemented Phase 2 architecture of Squad Leader: Vietnam V3.
  - **Psychological Conditions System (`PsychologicalConditionManager.js`)**: Expands transient combat stress into enduring psychological and physiological conditions (`Exhausted`, `Hypervigilant`, `Survivor's Guilt`, `Traumatized`, `Combat Hardened`, `Blooded Veteran`). Synchronizes state directly with Soldier domain entities, prevents duplicates, evaluates combat stress, casualties, friend deaths, and heroic feats, and publishes `CONDITION_GAINED` and `CONDITION_REMOVED`.
  - **Command Reputation System (`ReputationManager.js`)**: Tracks player leadership doctrine across 6 archetypes (`Aggressive`, `Reliable`, `Tactical`, `Protector`, `Ruthless`, `Jungle Ghost`). Clamps archetype scores [0 - 100], computes dynamic `primaryReputation`, evaluates tactical choices using semantic keywords and explicit reputation payloads, unlocks doctrine perks, and publishes `REPUTATION_CHANGED`.
  - **Random Dynamic Events (`DynamicEventManager.js`)**: Procedurally injects 9 dynamic battlefield incidents (`Friendly Patrol`, `Sniper Attack`, `Ammo Cache`, `Lost Recon Team`, `Captured Courier`, `Helicopter Support`, `Booby Trap`, `Vehicle Breakdown`, `Enemy Defector`). Evaluates heat/intel trigger conditions, manages scene cooldowns, executes branched tactical outcomes, and applies consequences over MessageBus.
  - **SaveManager & Composition Root Integration (`SaveManager.js`, `main.js`)**: Upgraded save schema to version 3, serializing conditions, reputation, and dynamic event histories. Wired all Phase 2 systems into `main.js` and rendered active conditions on soldier UI cards.
  - **Automated Test Suite (`phase2.test.js`)**: Created 21 automated unit and integration tests using Node.js native `node:test` runner.
- **Reason**:
  - Deepen battlefield psychological consequences, empower diverse tactical playstyles through persistent command reputations, and dramatically expand campaign replayability via procedural dynamic events.
- **Impact**:
  - 100% test pass rate across 48 automated tests (27 Phase 1 + 21 Phase 2) with zero regressions on existing systems.

---

## [v3.0.0-phase1] - 2026-09-05

- **Timestamp**: 2026-09-05T02:30:00-07:00 (PST)
- **Modified Files**:
  - `v2/src/entities/Soldier.js`
  - `v2/src/entities/SquadManager.js`
  - `v2/src/core/SaveManager.js`
  - `v2/src/main.js`
  - `CATALOG.md`
- **Created Files**:
  - `package.json`
  - `v2/src/systems/RelationshipManager.js`
  - `v2/src/systems/TraitManager.js`
  - `v2/src/systems/Journal.js`
  - `v2/test/phase1.test.js`
- **Summary**:
  - Implemented Phase 1 architecture of Squad Leader: Vietnam V3.
  - **Dynamic Soldier Relationships (`RelationshipManager.js`)**: Implemented social graph modeling interpersonal friendships, rivalries, mentorships, and trust levels (0-100). Integrated casualty grief reactions (`FRIEND_KIA`), rival combat disputes (`RIVAL_CONFLICT`), heroic bonding (`HEROIC_ACTION`), and rescue probability calculations.
  - **Hidden Traits System (`TraitManager.js`)**: Built discovery engine for 6 positive traits (`Calm Under Fire`, `Lucky`, `Sharpshooter`, `Inspiring Leader`, `Jungle Hunter`, `Combat Lifesaver`) and 6 negative traits (`Panic Prone`, `Reckless`, `Trigger Happy`, `Homesick`, `Superstitious`, `Claustrophobic`). Evaluates context across stress, casualties, booby traps, and subterranean environments.
  - **Campaign Journal (`Journal.js`)**: Implemented wartime chronicle logger capturing combat casualties, valorous actions, ambushes, weather changes, and radio traffic. Built with strict user-configurable timezone support defaulting to `PST` (`America/Los_Angeles`) per Directive 13.
  - **Domain Model Enhancements (`Soldier.js`, `SquadManager.js`)**: Added support for dynamic traits arrays, physical trauma/wounds, combat conditions, status tracking (`healthy`, `wounded`, `kia`), and rich casualty event broadcasting while preserving 100% backward compatibility.
  - **Persistence & Composition Root (`SaveManager.js`, `main.js`)**: Updated save routines to serialize/restore relationships, discovered traits, and journal history. Enhanced squad roster UI with status badges, trait lists, and active wound tracking.
  - **Automated Test Suite (`phase1.test.js`)**: Created 27 automated unit and integration tests using Node.js native `node:test` runner.
- **Reason**:
  - Establish deep psychological, interpersonal, and narrative depth for the Vietnam tactical simulation, transforming abstract soldiers into distinct individuals with bonds, hidden potentials, and emotional vulnerabilities.
- **Impact**:
  - 100% test pass rate across all Phase 1 systems with zero regressions on existing campaign data or core engine loops.

---

## [v2.0.0] - 2026-08-19

### Added
- **Core Engine (OOP)**: Completely rewrote the game foundation using ES Modules, a Pub/Sub `MessageBus`, and distinct classes (`GameEngine`, `SceneManager`, `SquadManager`, `Ledger`).
- **Data Architecture**: Replaced the legacy single-file HTML layout with a decoupled `campaign_3_us.js` JSON data structure.
- **Narrative Expansion**: Added 25 new scenes simulating the 77-day siege of Khe Sanh, replacing the 3-scene loop.
- **Action Resolution Mechanics**: Choices now pause the engine and present a "Resolution" text explaining the immediate consequence of an order before rendering the next scene.
- **Auto-Save System**: Implemented `SaveManager.js` to persist `sceneId`, `Ledger` stats, and `SquadManager` roster states to HTML5 `localStorage` on every scene render.
- **New Characters**: Added CPL Brady (K-9 Handler) and Duke (Scout Dog) to the default roster.
- **Dynamic UI**: Added color-coded Morale progress bars for each soldier in the Squad Roster UI.

### Changed
- **UI Theme**: Updated `index.html` to a clean, military-style HUD matching the new engine.
- **Requirement Gating**: Choices can now be locked if specific squad members (e.g., the Radio Operator) are KIA.

### Removed
- Legacy static React UI from `squad-leader-final_2.html` (maintained in root for legacy reference, but fully superseded by `/v2/`).
