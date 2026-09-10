# Performance baseline

Status: **not yet measured** — no figures have been invented.

Repeatable scenario: release-like iOS build, reset, seed `50,000`, open chat, scroll for 15 seconds, type 40 characters while scrolling, and load two older 50-row pages. Record device/OS, build mode, Xcode frame hitches, and memory before drawing a conclusion.

Baseline implementation to compare, if profiling is performed: list rows without memoization and composer draft colocated with list subscription.
