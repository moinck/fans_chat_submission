# AI Usage Disclosure

## Tools Used
- **Antigravity (Google DeepMind)** — primary AI coding assistant used throughout the project via the IDE integration.

---

## Approximate Time Breakdown

| Phase | Human time | AI-assisted time |
|---|---|---|
| Architecture & design | ~4 h | ~0.5 h (brainstorming edge cases) |
| SQLite schema & repositories | ~1.5 h | ~1.5 h (boilerplate generation) |
| Core engine logic | ~3 h | ~1 h (initial drafts, reviewed and rewritten) |
| UI components | ~2 h | ~1 h (scaffolding, styling) |
| Test suites | ~1 h | ~1 h (mock fixtures, test structure) |
| Bug fixing & polish | ~2 h | ~0.5 h (diagnosis suggestions) |
| Documentation | ~1 h | ~0.5 h (structural suggestions) |
| **Total** | **~14.5 h** | **~6 h** |

---

## How AI Was Used

AI was used to accelerate specific low-judgment tasks:

1. **Scaffolding boilerplate** — initial TypeScript interfaces, Zod schemas (`messageSchema`, `entitlementSchema`), and SQLite migration SQL were drafted by AI and then reviewed and adjusted.
2. **Seed data generation** — the SQL recursive CTE for the 50,000-row deterministic seed (`WITH RECURSIVE counter(i)…`) was AI-generated and verified manually.
3. **Test suite structure** — the four Jest integration test files were initially scaffolded by AI. All assertions and mock fixture logic were reviewed and rewritten where the AI's version made incorrect assumptions about async flow.
4. **Exploring failure modes** — used AI to enumerate edge cases in offline/retry logic (e.g., "what if `engine.sync()` is called while already flushing?"), which informed the `flushing` + `flushRequested` guard pattern.
5. **Documentation structure** — README section headings and the compliance policy section were AI-suggested; all content was written or verified by hand.

### Specific prompts used (representative examples)
- *"Write a SQLite migration that creates a client_messages table with cursor-pagination support and an outbox query."*
- *"Generate 50,000 deterministic seeded rows using a recursive CTE in SQLite."*
- *"Scaffold a Jest test that verifies a lost-response retry does not create a duplicate server-side message."*
- *"What are the edge cases in a purchase coordinator that must handle delayed backend validation?"*

---

## What AI Got Wrong / What Was Rejected

- **Incorrect async guard:** The first AI draft of `ChatSyncEngine.flush()` did not include the `flushing`/`flushRequested` re-entry guard. When two concurrent sends arrived while flushing, the AI's version would start a second concurrent flush, violating sequential ordering. This was identified and redesigned manually.
- **Premature entitlement unlock:** An early AI draft of `PurchaseCoordinator` called `publish('idle', activeEntitlement)` immediately after the store returned success, before backend validation completed. The decoupled confirmation pattern was a human architectural decision.
- **Wrong FlashList usage:** The initial AI-suggested MessageList used `onStartReached` on a non-inverted list and added `maintainVisibleContentPosition`. This caused the list to open mid-scroll (around message 49,831) and triggered premature page loads. The inverted FlashList pattern with `onEndReached` was a human correction.
- **Ignored persistence requirement:** AI-generated `MockPurchaseService` stored purchases only in an in-memory array. Persistence to SQLite (`mock_purchases` table) was identified as missing and added manually.
- **Offline persistence missing:** The AI's initial `App.tsx` startup always set `chat.online = true` and called `engine.sync()` unconditionally. The `SQLiteSettingsRepository` and conditional startup sync were a human addition.

---

## Human Engineering & Manual Work

All architectural decisions, core logic, and debugging were designed, reviewed, and finalized by me:

- **Offline Outbox & Idempotency Pattern**: Architected the local SQLite outbox queue, unique `clientId` tracking, and automatic background flushing upon reconnect to guarantee zero lost or duplicated messages.
- **Purchase vs. Entitlement Separation**: Designed the single-flight purchase coordinator with versioned backend entitlement tokens, preventing premature unlocks and handling delayed/canceled transactions properly.
- **Race Condition Resolution**: Resolved concurrency deduplication issues by tracking in-flight transaction claims in memory before awaiting local persistence. Added the `flushing`/`flushRequested` re-entry guard to `ChatSyncEngine.flush()`.
- **Persistence of offline state & purchase history**: Identified that both `online` flag and purchase history must survive process restarts; designed `SQLiteSettingsRepository` and `SQLitePurchaseHistoryRepository`.
- **Inverted FlashList chat pattern**: Diagnosed the incorrect scroll position and premature `onStartReached` firing; replaced with the standard inverted FlashList + `onEndReached` pattern.
- **Full Reset All**: Identified that the original `resetAll` left in-memory service state (connectivity, purchase history, backend mode, fault modes) untouched; rewrote to reset all runtime state atomically.
- **UI / UX Refinements**: Built and polished the responsive chat interface, interactive demo drawer for testing edge cases, keyboard handling, and styling.
