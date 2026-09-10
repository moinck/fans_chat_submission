# Security — Dependency Advisories

## Summary

`npm audit` reports **10 moderate severity vulnerabilities** in this project. They all originate
from a single transitive chain inside Expo's build-time tooling and are **not present in the
JavaScript bundle shipped to the device**.

---

## Advisory Detail

**CVE / Advisory:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)  
**Package:** `uuid < 11.1.1`  
**Severity:** Moderate  
**Description:** Missing buffer bounds check in `uuid` v3/v5/v6 when a caller supplies the optional
`buf` output parameter. The bounds check was added in `uuid@11.1.1`.

### Full dependency chain

```
uuid < 11.1.1
  └── xcode >= 0.9.2           (Expo's iOS project-file parser)
        └── @expo/config-plugins (all versions)
              ├── @expo/cli
              ├── @expo/config
              ├── @expo/inline-modules
              ├── @expo/metro-config
              └── @expo/prebuild-config
                    └── expo ~57.0.21   ← our direct dependency
```

All 10 findings resolve to this single root path. The package manager counts each dependent
package in the chain as a separate finding (10 nodes in the dependency graph).

---

## Why We Do Not Apply `npm audit fix --force`

The npm-suggested automatic fix is:

```
Will install expo@46.0.21, which is a breaking change
```

Downgrading from **Expo SDK 57** to **SDK 46** would:

- Remove `expo-sqlite` v12+ APIs used throughout this project (WAL mode, `withTransactionAsync`, typed query helpers).
- Remove `expo-crypto` `randomUUID()` used for `clientId` generation.
- Break `jest-expo ~57.0.5` preset compatibility, causing all 4 test suites to fail.
- Require full migration of `react-native 0.86` → `0.69` and `react 19` → `18`.
- Invalidate the `expo-doctor` 21/21 pass.

This would be a complete project rewrite, not a patch.

---

## Actual Risk Assessment

| Factor | Assessment |
|---|---|
| Is the vulnerable code in the shipped bundle? | **No.** `xcode` is a build-time dev dependency. It is never bundled into the app. |
| Is the vulnerable code path exercised? | **No.** `xcode` uses `uuid` to generate UUIDs in iOS `.pbxproj` files. The optional `buf` parameter code path is not called. |
| Is this app deployed to production? | **No.** This is a local demo/simulation with no real user data. |
| Practical risk | **Negligible** in this context. |

---

## Recommended Production Action

1. **Monitor the Expo changelog** ([expo.dev/changelog](https://expo.dev/changelog)) for a future
   `@expo/config-plugins` or `xcode` release that upgrades `uuid` to `>= 11.1.1`.
2. **Do not run `npm audit fix --force`** — this breaks the project.
3. If a compatible patch is released (e.g., `expo ~57.x.y` that bumps `xcode`), apply it with
   `npm update expo` and re-run `npx expo-doctor` to verify compatibility.
4. For production deployments, evaluate whether `@expo/eas-cli` offers a patched build-tool chain.

---

## Non-Vulnerable Dependencies

All direct application dependencies have no known vulnerabilities:

| Package | Version | Status |
|---|---|---|
| `@shopify/flash-list` | 2.0.2 | ✅ Clean |
| `expo-sqlite` | ~57.0.2 | ✅ Clean |
| `expo-crypto` | ~57.0.2 | ✅ Clean |
| `expo-status-bar` | ~57.0.1 | ✅ Clean |
| `react` | 19.2.3 | ✅ Clean |
| `react-native` | 0.86.3 | ✅ Clean |
| `react-native-safe-area-context` | ~5.7.0 | ✅ Clean |
| `zod` | ^4.5.4 | ✅ Clean |
| `zustand` | ^5.0.15 | ✅ Clean |
