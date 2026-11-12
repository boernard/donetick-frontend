# Gotchas

Siblings: [architecture.md](architecture.md), [directory-map.md](directory-map.md), [domain-model.md](domain-model.md), [conventions.md](conventions.md), [testing-and-ci.md](testing-and-ci.md).

## Install and build traps

| Trap                                        | Detail                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scripts that **delete `package-lock.json`** | `build-cf`, `build-selfhosted`, `test-cloudflare-build`, `build-win` (`del`), `setup-m1` (also deletes `node_modules`) all run `rm -rf package-lock.json && npm install ...` (`package.json` scripts). Never run them casually in your working tree; `git checkout package-lock.json` afterwards if you do. They exist because of the rollup/swc optional-binary bug (npm/cli#4828) when the lockfile was made on another OS. |
| Platform binaries forced in                 | Those scripts `npm install --force @rollup/rollup-linux-x64-gnu@4.34.9 @swc/core-linux-x64-gnu` (CF/Linux), `...darwin-arm64` (Apple silicon), `...win32-x64-msvc` (Windows). If `vite build` or `node --test` fails with "Cannot find module @rollup/rollup-*" or `@swc/core-*`, that is this issue (tests load `@swc/core`). `setup-apple-silicon` is the lighter variant (`--no-optional`).                                |
| `postinstall: patch-package`                | Applies `patches/@capacitor-community+speech-recognition+7.0.1.patch` (Java: adds `contextualStrings` support / changes `beginListening` signature, plus other files). Bumping `@capacitor-community/speech-recognition` from 7.0.1 breaks the patch; regenerate with `npx patch-package @capacitor-community/speech-recognition`.                                                                                            |
| `npm i` in CI                               | `build.yml` uses `npm i`, not `npm ci`, so the lockfile can drift silently.                                                                                                                                                                                                                                                                                                                                                   |
| `build` env                                 | `vite.config.mjs` reads `package.json` version and optionally uploads PostHog sourcemaps only if `POSTHOG_UPLOAD_SOURCEMAPS=true` plus API key/project/host. Do not put real values in docs or commits; `.env*` files exist (`.env`, `.env.development`, `.env.selfhosted`) - do not print them.                                                                                                                              |
| `npm run release`                           | `npm version patch && npm run build && git push origin develop --tags` - pushes immediately. `npm run merge` checks out `main`, merges `develop`, pushes.                                                                                                                                                                                                                                                                     |

## Native build / release

- Native projects are committed: `android/`, `ios/` (skipped by prettier). Web changes reach them only through `npm run build` then `npx cap sync` (`npm run android`, `npm run ios`, `npm run cap` do both). Forgetting `cap sync` means the app runs the old bundle. `capacitor.config.ts`: `webDir: 'dist'`, appId `com.donetick.app`, `android.allowMixedContent: true`.
- Version bumping: `bump-version.js` (`npm run bump[:minor|:major]`) edits `package.json`; read it before assuming it also edits native version files - unverified. `scripts/release.sh` bumps then builds both platforms (`--android`, `--ios`, `--skip-bump`, `--upload`). Details: `AUTOMATED_RELEASE.md`.
- Signing secrets come from `scripts/pull-secrets.sh` / `push-secrets.sh` (Vaultwarden). Never commit them.
- Fastlane: `fastlane/Fastfile` lanes `ios release`, `ios upload`, `android release`, `android apk`, `android upload`. `upload` fails with "Missing ...ipa/aab" unless `release` ran first.
- Commit `48a4a29` fixed CocoaPods install needing a UTF-8 locale (set `LANG`/`LC_ALL` to a UTF-8 value in release shells).
- Release builds enable R8 shrinking/obfuscation (`f935343`): a plugin class that works in debug can break in release - check `android/app/proguard-rules.pro`.
- There is a share extension (`0a0850a`) and a home-screen widget (`be4da65`); they live in `ios/`/`android/` and are not covered by the web build.

## Auth and tokens

- **Two token stores.** `src/utils/TokenStorage.js`: access token + expiry always in `localStorage` (`token`, `token_expiry`); refresh token + expiry in `localStorage` on web but **Capacitor Preferences** on native (`saveTokens` ~line 56, `getRefreshToken` ~108, `clearAllTokens` ~175). Code that reads `localStorage.getItem('token')` directly (e.g. `ApiClient.getToken()`, `useSSE.js:~427`) is fine for the access token but must never look for the refresh token there on native. `hasValidAccessToken()` (~line 41) is synchronous on purpose, for native event handlers.
- **Refresh in `src/utils/ApiClient.js`.** The prior audit's "not single-flight, returns 'Already refreshing' to concurrent callers" is **only half true**: `refreshToken()` (~line 57) itself returns `{ success:false, error:'Already refreshing' }` when `this.isRefreshing` (~73) and enforces a 3 s cooldown (`refreshCooldown`, line ~26). But `request()` (~270-340) queues concurrent 401s in `failedQueue`, only the first starts a refresh, and `processQueue()` (~137) retries them with the new token. So concurrent requests are effectively single-flight; calling `apiClient.refreshToken()` directly (as `useSSE.js:~540` does) from several places is not. In the cooldown branch the code retries with whatever token is currently stored.
- Failure modes handled deliberately: OAuth code exchange in flight (`OAuthExchangeState.js`, `OAUTH_EXCHANGE_IN_PROGRESS`) returns a non-fatal failure instead of logging out, because logout hard-navigates to `/login` and would abort the exchange. Expired refresh token triggers `handleLogout()` inside `refreshToken()` - do not call it again.
- The refresh endpoint call (`RefreshToken` in `src/utils/Fetcher.jsx:~758`) sends the refresh token in the **body** on native and relies on a cookie on web.
- **`useSSE` token logging**: `src/hooks/useSSE.js:~48-54` does `console.log('SSE: No valid authentication token', authToken, isAuthenticated)`. It only fires when `!authToken || !isAuthenticated`, so it leaks the token when a token exists but `isAuthenticated` is false (transient). Verified; low severity but do not copy the pattern.
- SSE auth differs by platform: native uses a one-time **ticket** query param (`fetchSSETicket`, native `EventSource`, because the polyfill breaks in WKWebView), web uses `EventSourcePolyfill` with `Authorization: Bearer ${localStorage.getItem('token')}` read **at connect time** - after a token refresh the open stream keeps the old header until it reconnects.
- `no-case-declarations` in `useSSE.js:107` (`case 'chore.created'` etc.): `const`/`let` inside `case` without braces. Wrap cases in `{ }` (as `chore.updated` at ~125 does) when adding event types; the rule is only a warning so lint will not catch you.

## Offline / sync

- Offline stack: `src/utils/OfflineDB.js` (SQLite via `@capacitor-community/sqlite`), `CommandQueue.js` (queued mutations), `SyncEngine.js` (drains queue), `OfflineFeatureToggle.js`, `PendingChores.js`. Overview in [architecture.md](architecture.md).
- `SyncEngine.js`: `MAX_COMMAND_RETRIES = 8`; breaks out of the drain loop when `networkManager.isOnline` is false (~148); a 409-style conflict marks the command for user attention and continues (~170); server rejections that can never succeed are dropped rather than retried (~179). After a create succeeds it must never throw (~209) - a retry would create a duplicate.
- Offline tests assert exact behaviour of these paths: see `tests/project-board-offline.test.mjs` before changing queue semantics.
- Board ordering lives in `src/utils/BoardOrdering.js`; keep ordering pure (tested by `tests/board-task-ordering.test.mjs`).

## Platform quirks

- Platform checks: `Capacitor.isNativePlatform()` is used across ~39 files; `TokenStorage.js` caches it in `_isNativePlatform`. Anything touching Preferences/SQLite/push/haptics/status bar needs a web fallback (the web build must keep working; `@capacitor/*` plugins are no-ops or throw on web).
- iOS: WKWebView breaks fetch-based EventSource (see SSE above); fields overflowed on small screens like iPhone 13 (`59adeda`); status bar / safe areas handled in `src/utils/StatusBarManager.js` and `SafeAreaUtils.js`.
- Android: `allowMixedContent: true`; swipe gestures and permissions caused bugs (`86f6bad` "no permission on swiping").
- Clipboard over plain HTTP (self-hosted) fails with `navigator.clipboard`; fixed in `4584d27` via `src/utils/Clipboard.js` fallback (tested in `tests/clipboard.test.mjs`).
- Push registration/device cleanup is order-sensitive (`3228170`; `tests/push-registration.test.mjs`); logout calls `unregisterPushNotifications` before clearing tokens (`ApiClient.handleLogout`).
- Startup screen: critical CSS is inline in `index.html` (`tests/startup-screen.test.mjs`, currently failing); keep it dependency-free.

## Lessons from recent fix commits (last 60)

| Commit               | Lesson                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `99e6a9f`            | API models `triggerState` as a string for every thing type; serialize numeric triggers before sending.                                                    |
| `86f6bad`, `607d873` | Permission checks gate swipe actions/chore actions (`ChoreAccess.js`, `ProjectAccess.js`); every new action needs the role/ownership/impersonation check. |
| `2840f70`, `7fb1e1d` | Project view default must not assume the project is loaded (`'board'` vs `'default'`); layouts bled across views.                                         |
| `b0c9d63`            | Popper-based pickers need `preventOverflow` or they clip on mobile.                                                                                       |
| `198a634`            | Recurring weekdays must be sorted in calendar order (`WeekdayUtils.js`).                                                                                  |
| `3c4637b`            | Signup display name must allow non-ASCII letters; do not add ASCII-only regexes.                                                                          |
| `5a31a03`            | Raise/verify input max values against server limits (`completionWindow`).                                                                                 |
| `4584d27`            | Browser APIs gated on secure context need fallbacks (clipboard).                                                                                          |
| `3228170`            | Push token lifecycle: register/cleanup devices on login/logout.                                                                                           |
| `ae19e5c`            | Offline sync improvements landed with ChoreActionMenu changes - action menu and queue are coupled.                                                        |
| `48a4a29`            | CocoaPods needs UTF-8 locale.                                                                                                                             |
| `f935343`            | R8 minification can break release-only.                                                                                                                   |

Also: i18n is enforced - `lint:i18n` and the PR safety check fail on locale regressions; Crowdin owns `l10n_*` branches (`crowdin.yml`). Prefer `t('key')` over literals.

Last verified: 2026-11-12 at commit 99e6a9f
