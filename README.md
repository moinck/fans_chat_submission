# Fans Chat — Mobile Reliability & Offline-First Architecture

An iOS-first Expo & React Native application demonstrating production-grade reliability patterns for creator-to-fan messaging. It showcases durable offline-first outboxing, idempotent delivery, decoupled in-app billing vs. backend entitlement validation, and virtualized scrolling over 50,000 messages.

> **Zero Credentials Needed:** All network backends and store purchasing are simulated locally using SQLite and in-memory services. The entire test suite and app run out of the box without requiring external API keys.

---

## Key Highlights

- **Offline-First Durability:** Messages typed offline are committed to local SQLite before optimistic UI publication, surviving app force-quits and flushing automatically upon reconnection. The offline/online state is persisted across restarts.
- **Idempotent Delivery:** Every message is tagged with an immutable client UUID (`clientId`). Network drops and retries never produce duplicate messages on the server or client.
- **Purchase is Not Entitlement:** App Store purchase success enters an `awaiting-confirmation` state. Access is unlocked only when the backend returns a cryptographically versioned active entitlement.
- **50,000 Message Virtualization:** Seeded with 50,000 deterministic messages, targeting ≤ 16 ms/frame during scrolling using `@shopify/flash-list` (inverted), cursor pagination, and memoized rendering.
- **Interactive Fault Injection:** Built-in **Demo & Test Controls** drawer to trigger offline mode, network drops, delayed backend validation, store failures, refunds, and instant data resets.

---

## Quick Start

### Prerequisites
- Node.js `20+` or `22+`
- npm `10+`
- iOS Simulator or physical phone with the **Expo Go** app installed

### Setup & Run

```bash
# 1. Install dependencies
npm ci

# 2. Start Expo Metro bundler
npm start

# Or directly target iOS Simulator:
npm run ios
```

### Verification & Quality Gates

Run all automated checks locally:

```bash
# TypeScript compiler checks
npm run typecheck

# Code style and linting
npm run lint

# Jest integration test suites
npm run test:ci

# Expo dependency and environment validation
npx expo-doctor
```

---

## Architecture & Data Flow

```text
[ React Native Components ]  <--->  [ Zustand Store ]
              |                               |
       (User Actions)                   (State Updates)
              v                               v
[ ChatSyncEngine / Coordinators ]  --->  [ Domain Logic & Zod Validation ]
         /                  \
        v                    v
[ Client SQLite DB ]   [ Mock Server SQLite DB ]
- outbox               - accepted_messages
- client_messages      - entitlement_state
- transaction_log      - mock_purchases (persisted restore history)
- app_settings         (persisted online/offline flag)
```

### 1. Messaging Invariants
1. **Durability Before Publication:** When a user taps Send, the message is assigned a UUID `clientId`, written to the local SQLite `client_messages` table as `pending`, and only then emitted to the UI state.
2. **Deterministic Server Idempotency:** The mock server indexes messages by `clientId`. Repetitive sends return the original accepted record without creating duplicates.
3. **Monotonic Sequences:** Confirmed messages sort strictly by `serverSequence`; pending and unconfirmed messages follow in chronological order by local timestamp.
4. **Resilient Outbox Flusher:** On reconnection, `ChatSyncEngine` fetches missing remote records and flushes all pending local messages sequentially. Retryable errors (`OFFLINE`, `RESPONSE_LOST`, `SERVER_BUSY`) stay queued; fatal errors (`CONTENT_REJECTED`) mark the message as terminal so the user can edit and resend.

### 2. Purchase vs. Entitlement
- **Single-Flight Guard:** Simultaneous purchase taps are deduplicated in memory using an active transaction lock before awaiting disk writes.
- **Decoupled Verification:** A successful store transaction does not unlock the UI directly. The coordinator validates the receipt against the mock backend, issuing a monotonic versioned entitlement record.
- **Stale Update Protection:** Older or delayed backend responses cannot overwrite newer entitlement records.
- **Non-Destructive Failures:** A failed restore or cancelled purchase never revokes an existing active subscription.
- **Persistent Restore History:** Mock purchase events are written to the `mock_purchases` SQLite table, so `Restore Purchases` works correctly after a process restart.

### 3. Virtualization & 50,000 Message History
- **Database Pagination:** The startup flow hydrates only the latest 100 messages. Older history loads on demand in 50-row cursor pages.
- **FlashList V2 (inverted):** Uses an inverted list so the newest message is always visible at the bottom without programmatic scrolling. Cell views are recycled with stable keys (`clientId`). Older pages load via `onEndReached` with a 10% threshold to prevent premature fetches.
- **State Isolation:** Keystrokes in `ChatComposer` remain local to the input component and do not trigger re-renders across the message list.
- **Memoized Bubbles:** `MessageBubble` instances are wrapped in `React.memo` to eliminate redundant redraws during scrolling.

---

## Built-In Demo & Test Controls

At the bottom of the screen, tap **Demo & Test Controls** to expand the interactive test harness:

| Control | Type | What It Does |
|---|---|---|
| **Go Offline / Go Online** | Action | Cuts or restores mock connectivity. Persisted across restarts. When offline, sent messages safely queue as pending. |
| **Sync Now** | Action | Manually flushes pending outbox messages and fetches remote updates. |
| **Inject 4 Incoming** | Action | Generates 4 incoming messages from Luna on the mock server. |
| **Seed 50,000 Rows** | Action | Inserts 50,000 deterministic messages into SQLite to benchmark scrolling. |
| **Send Delivery Mode** | Config | Selects behavior for the *next* message sent: `success`, `lost-response`, `retryable-failure`, or `terminal-failure`. |
| **Next Purchase Simulation** | Config | Selects the outcome for the *next* time "Subscribe" is tapped: `success`, `cancel`, or `fail`. |
| **Backend Confirmation** | Config | Toggles `immediate`, `delayed` (waits for "Confirm Pending"), or `reject`. |
| **Force Expire / Refund** | Override | Authoritatively revokes access to test paywall re-locking. |
| **Reset All** | Reset | Wipes all client/server/entitlement/purchase DB tables **and** resets all in-memory service state and config modes to defaults (online=true, sendMode=success, purchaseOutcome=success, confirmationMode=immediate). |

---

## Automated Test Suites

Run `npm run test:ci` to execute the 4 core integration suites:

1. `__tests__/chat-idempotency.test.ts`: Proves that lost responses and retries create exactly one server message.
2. `__tests__/chat-restart-recovery.test.ts`: Verifies that offline queued messages survive service recreation and flush cleanly on startup.
3. `__tests__/entitlement-delay.test.ts`: Validates that delayed backend confirmation keeps chat locked until authoritatively confirmed.
4. `__tests__/purchase-idempotency.test.ts`: Confirms duplicate transaction events are handled idempotently and failures do not clear active access.

---

## Performance Notes

> **Important:** No FPS figures are cited in this submission because the app runs in **Expo Go on a Simulator**, which does not produce representative performance data. Accurate frame-time measurement requires a **physical device + release build + Xcode Instruments** (or the React Native Performance Monitor in a release-like build). The evidence files in `evidence/performance-before.md` and `evidence/performance-after.md` document the repeatable scenario and the optimizations applied; actual numbers should be recorded there when a suitable build is available.

The architectural choices that target ≤ 16 ms/frame are:
- **Inverted FlashList** with recycled cell views and `keyExtractor` using stable `clientId` strings.
- **`React.memo` on `MessageBubble`** — eliminates re-renders for unchanged rows during scroll.
- **Isolated composer state** — `ChatComposer` manages its own draft state; keystroke events do not propagate to the message list subscription.
- **Cursor-paginated SQLite reads** — only 100 rows hydrate on startup; older pages load in 50-row batches on demand, keeping JS-thread work bounded.
- **Transactional bulk seed** — the 50,000-row seed runs inside a single SQLite transaction, preventing write-amplification and long blocking.

---

## Time Spent

Approximate breakdown across the full implementation:

| Area | Estimated Hours |
|---|---|
| Architecture design (outbox, idempotency, entitlement pattern) | ~4 h |
| SQLite schema, migrations, repositories | ~3 h |
| ChatSyncEngine & PurchaseCoordinator logic | ~4 h |
| UI components (MessageList, DebugControls, Paywall, Composer) | ~3 h |
| Integration test suites (4 suites) | ~2 h |
| Bug fixes (offline persistence, Reset All, inverted scroll) | ~2 h |
| Documentation (README, AI.md, evidence files, SECURITY.md) | ~1.5 h |
| **Total** | **~19.5 h** |

---

## Platform Limitations

Running in **Expo Go** (managed workflow) imposes the following constraints not present in a production build:

| Limitation | Impact |
|---|---|
| No native billing SDK | `MockPurchaseService` simulates App Store/Google Play. Real `expo-in-app-purchases` or RevenueCat would be required in production. |
| No push notifications | Incoming messages are simulated via the "Inject 4 Incoming" control. Production would use APNs/FCM. |
| No background fetch | Outbox flushing only runs while the app is in the foreground. A production app would use a background task (iOS `BGProcessingTask`). |
| Expo Go JavaScript engine | Hermes performance in Expo Go may differ from a production Hermes build. Frame-time numbers from Expo Go are not reliable. |
| iOS Simulator only | The app has not been tested on Android in this submission. The architecture is cross-platform but Android-specific billing flows are not implemented. |
| SQLite single shared connection | A serialised transaction queue is used to prevent nested-BEGIN errors. A production app would benefit from a dedicated write connection + WAL mode reader pool. |

---

## Figma / Design Deviations

No Figma specification was provided for this challenge. The UI was designed from scratch following standard iOS chat conventions:

- Message bubbles: right-aligned (me), left-aligned (creator), with delivery state indicators.
- Colour palette: white background, `#53B5F7` accent (send button, selected chips), `#292333` primary text.
- Status banner: inline notice bar below the header for transient system messages.
- Debug drawer: dark-themed (`#1B2330`) collapsible panel at the bottom, visually distinct from the chat UI to avoid confusion during demoing.

---

## System Design: Resumable Large-Media Uploads

When expanding this architecture to support video and voice notes (up to 500MB):

1. **Chunking & Hashing:**
   - Hash the file on-device (SHA-256) and split it into uniform 5MB chunks.
   - Store upload metadata (upload ID, chunk index, byte offsets, and part checksums) in SQLite before transferring bytes.
2. **Resumable Multipart Transfer:**
   - Request signed presigned S3/GCS multipart upload URLs per chunk.
   - Upload chunks concurrently (2–3 parallel streams).
   - If network drops, query the backend for existing verified parts (`ETags`) and upload only missing chunks upon reconnection.
3. **Background Transfers & OS Lifecycle:**
   - Utilize platform background workers (iOS `NSURLSessionUploadTask` with background configuration, Android `WorkManager`).
   - If the user force-quits the app, the task halts; upon next app launch, SQLite metadata reconciles with the server to resume seamless transfer.
4. **Integrity & Completion:**
   - Send complete multipart request with part list. Backend verifies overall checksum before making the media accessible.

---

## Store & Creator Content Compliance

- **In-App Purchases:** Digital subscriptions granting access to creator chat must use [Apple In-App Purchase](https://developer.apple.com/in-app-purchase/) and [Google Play Billing](https://developer.android.com/google/play/billing). Client receipts should always be validated server-side.
- **User-Generated Content (UGC):** Requires proactive terms of service, reporting/blocking mechanisms, and content moderation pipelines compliant with [Apple Guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#1.2) and [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876821).
- **Server Notifications:** Production implementations must consume [App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications) and [Google Real-time Developer Notifications (RTDN)](https://developer.android.com/google/play/billing/rtdn-reference) to handle external renewals, cancellations, and grace periods immediately.

---

## Known Dependency Advisories

`npm audit` reports **10 moderate severity advisories** in this project. They are all rooted in a single transitive chain and are **not actionable without breaking the SDK**:

```
uuid < 11.1.1  (GHSA-w5hq-g745-h8pq — missing buffer bounds check in v3/v5/v6)
  └── xcode >= 0.9.2
        └── @expo/config-plugins (all versions)
              └── @expo/cli, @expo/config, @expo/metro-config, …
                    └── expo ~57.0.21  ← our direct dependency
```

**Why not fixed with `npm audit fix --force`:**  
The suggested automatic fix would downgrade `expo` from `57.x` to `46.0.21`, a major breaking change that would remove SDK 57 APIs, break the SQLite and crypto modules used throughout this project, and invalidate the entire test suite.

**Actual risk surface:**  
The vulnerable `uuid` version is used exclusively inside `xcode` (an Expo build-time tool for iOS project configuration). It is **not included in the JavaScript bundle shipped to the device**. The `buf`-parameter code path in `uuid` v3/v5/v6 is not exercised by `xcode`. The practical risk in this context is negligible.

**Recommended production action:**  
Pin Expo SDK updates and monitor the [Expo changelog](https://expo.dev/changelog) for a future `@expo/config-plugins` release that bumps `xcode` to a version using `uuid >= 11.1.1`.

See [`SECURITY.md`](./SECURITY.md) for the full advisory breakdown.
#   f a n s _ c h a t _ s u b m i s s i o n  
 