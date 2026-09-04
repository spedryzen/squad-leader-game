# Changelog: Squad Leader: Vietnam

<!-- Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817 -->

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
