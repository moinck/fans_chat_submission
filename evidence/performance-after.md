# Performance optimized configuration

Status: **implementation complete; device measurement pending**.

Applied optimization: `MessageBubble` is memoized, row callbacks are stable, composer draft is isolated in `ChatComposer`, SQLite uses indexed cursor pages of 50, only the latest 100 rows hydrate, and FlashList virtualizes mounted rows. The deterministic 50,000-row seed is generated transactionally.

Use the exact scenario and device from `performance-before.md`; record raw memory/frame results here. No performance claim is made until measured.
