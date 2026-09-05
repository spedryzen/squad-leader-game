# Changelog: Squad Leader: Vietnam
<!-- Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817 -->

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
