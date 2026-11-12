# Architecture

Runtime architecture of the Donetick frontend: one React SPA shipped three ways (web/PWA, self-hosted web, Capacitor iOS/Android app). Line numbers are approximate (`path:line`).

Siblings: [directory-map.md](directory-map.md) (where files live), [domain-model.md](domain-model.md) (chores, things, circles), [conventions.md](conventions.md), [testing-and-ci.md](testing-and-ci.md), [gotchas.md](gotchas.md).

## Stack

| Layer | Choice |
|---|---|
| UI | React 18, MUI Joy (`@mui/joy` beta) + some `@mui/material`, emotion (RTL via `stylis-plugin-rtl`), Tailwind config present |
| Build | Vite + `@vitejs/plugin-react-swc`, `vite-plugin-pwa` (`vite.config.mjs`) |
| Routing | `react-router-dom` v6 `createBrowserRouter` (data router, but no loaders) |
| Server state | `@tanstack/react-query` v5 |
| Realtime | SSE (`event-source-polyfill` on web, native `EventSource` on Capacitor) |
| Native | Capacitor 8 (`capacitor.config.ts`), appId `com.donetick.app`, `webDir: dist` |
| Offline store | IndexedDB (web) / `@capacitor-community/sqlite` (native), same DB name `donetick_offline` |
| i18n | `i18next` (`src/i18n/config.js`, locales in `public/locales`) |
| Analytics | PostHog (`src/analytics`), OpenReplay dep present (start call is commented out in `src/App.jsx:201`) |
| Language | JS/JSX; `tsconfig.json` and `capacitor.config.ts` only |

Path alias: `@` -> `/src` (`vite.config.mjs`, resolve.alias). Many files still use relative imports.

## Entry points

1. `index.html` -> `src/main.jsx`: imports i18n + `index.css`, then picks a bundle with `React.lazy`:
   - Marketing host (`donetick.com`, `www.donetick.com`) or `?site=marketing` (works in all builds) -> `src/MarketingApp.jsx` (`src/main.jsx:9-20`).
   - Otherwise -> `src/Application.jsx` = `<Contexts><App/></Contexts>`.
2. `src/MarketingApp.jsx`: own tiny router (`/`, `/welcome`, `/privacy`, `/terms`; `*` hard-redirects to `https://app.donetick.com<path>`), own `QueryClient` with `enabled:false`. Does not load the app shell.
3. `src/contexts/Contexts.jsx`: composes providers with `reduceRight`; `src/App.jsx` is the root route element, not a child of Contexts (see Routing).

## Provider tree (outermost first)

`src/contexts/Contexts.jsx:9-18` (order matters, listed as array):

| # | Provider | Notes |
|---|---|---|
| 1 | `AlertsProvider` (`src/service/AlertsProvider.jsx`) | modal-style alerts |
| 2 | `LocalizationProvider` | must be above Theme: theme reads language for text direction + emotion cache |
| 3 | `ThemeContext` | Joy theme, skins, `themeMode` in localStorage |
| 4 | `QueryContext` | creates `QueryClient`; kicks off offline hydration + widget sync (see below) |
| 5 | `NotificationProvider` | toasts |
| 6 | `RouterContext` | `RouterProvider`; renders `App` as the route element |

Inside the router, `src/App.jsx:233-247`:

`NetworkBanner` -> `AuthProvider` (`src/hooks/useAuth.jsx`) -> `SSEProvider` -> `GlobalSearchProvider` -> `KeyboardShortcutScopeProvider` -> `PaywallProvider` -> `AppContent`.

`AppContent` (`src/App.jsx:137`): runs global hooks (`useSyncOnReconnect`, `useAnalyticsIdentity`, `useAppBadgeSync`, `useLocalNotificationSync`, `useOnboardingGate`, `useStatusBar`), then wraps `ImpersonateUserProvider` -> `TimezonePrompt` -> `NavBarTitleProvider` -> `GlobalQuickAdd` -> `NavBar` + `PageTransition(<Outlet/>)` + `MobileBottomNav`. Web-only `WebServiceWorkerManager` (PWA update snackbar, hourly update check) is skipped on native.

`App` also registers Capacitor listeners once (`registerCapacitorListeners(navigate)`, `src/App.jsx:224`) and initialises analytics + global error handlers.

Gotcha: `RouterContext` ignores its `children` (`src/contexts/RouterContext.jsx:331`), so the `<App/>` in `Application.jsx` is never rendered directly; the router renders it. Hooks that need router or auth context must live in `App`/`AppContent` or below.

## Routing

- Single `createBrowserRouter` in `src/contexts/RouterContext.jsx:66`; one parent route `/` -> `<App/>` with `errorElement: <Error/>` and all pages as flat children. All views are imported eagerly (no `React.lazy` per route).
- `/` -> `DefaultViewRoute` redirects to the user's default view (`src/utils/DefaultViewConfig.js`, `/home` or `/chores`).
- `/settings` -> `SettingsRoutes` with ~20 nested children (`profile`, `circle`, `webhooks`, `apitokens`, `widgets`, ...) (`RouterContext.jsx:80-177`).
- Auth/onboarding/legal pages live in the same tree as app pages: `/login`, `/signup`, `/auth/:provider` (OAuth callback), `/onboarding`, `/get-started`, `/welcome`, `/circle/join`, `/payments/success|cancel`, `/forgot-password`, `/password/update`.
- No route-guard component. Unauthenticated users are bounced by `ApiClient` (401 -> refresh fails -> `handleLogout` -> `window.location.href='/login'`). `NavBar` hides itself on `PUBLIC_PAGES` and a list of auth paths (`src/views/components/NavBar.jsx:51-70`).
- First-launch native users are redirected to onboarding by `useOnboardingGate` (`src/hooks/useOnboardingGate.js`), which allow-lists onboarding, legal, `/circle/join` and `/auth/*`.
- Deep links (NFC, push, local notifications, share intents) navigate through `routerNavigate` in `src/CapacitorListener.js:26-60`, which uses the router `navigate` injected from `App`.

## Data flow

```
view -> query/mutation hook (src/queries/*, views/*/*Queries.js)
     -> src/utils/Fetcher.jsx  (endpoint helpers, ~80 functions)
     -> src/utils/ApiClient.js (fetch + auth + 401 refresh + 10s timeout)
     -> backend  <API_URL>/api/v1/...
```

- `Fetcher.jsx` is a thin compatibility layer: `Fetch()` dispatches on `options.method` to `apiClient.get/post/put/delete` (`Fetcher.jsx:4-18`); `ActionFetch` throws on non-ok responses (`:21`). Most helpers return a raw `Response`; some `.then(r => r.json())`.
- `ApiClient` (`src/utils/ApiClient.js`) singleton `apiClient`:
  - Base URL = `customServerUrl` from Capacitor Preferences (user-set server, lets native/self-hosters point anywhere) else `API_URL` from `src/Config.js` (`VITE_APP_API_URL`; the literal `AUTO` means `<hostname>/api`) + `/api/v1` (`:45-52`).
  - Aborts after 10 s (`:235`); any thrown fetch marks the server unreachable via `networkManager.setServerUnreachable()` (`:353-356`).
  - `apiClient.upload` strips `Content-Type` for FormData; `getAssetURL` builds `/assets/<path>`.
- React Query hooks live in `src/queries/` (`ChoreQueries`, `UserQueries`, `TimeQueries`, `SubtaskQueries`, `ThingQueries`, `ResourceQueries`) and also co-located with views: `src/views/Labels/LabelQueries.jsx`, `src/views/Projects/ProjectQueries.js`, `src/views/Filters/FilterQueries.js`, `src/views/Rewards/RewardQueries.jsx`.
- `QueryContext` defaults: `staleTime` 5 min, `gcTime` 10 min, `retry: 1`, `refetchOnWindowFocus: false` (`src/contexts/QueryContext.jsx:10-18`). `useChores` overrides `refetchOnWindowFocus: true`. On native, `focusManager` is driven by Capacitor `appStateChange` (`src/CapacitorListener.js:624`).
- Key query keys (needed by SSE, hydration, widgets): `['chores', includeArchive]`, `['chore', id]`, `['userProfile', token]`, `['labels']`, `['projects']`, `['projectSections', id]`, `['filters']`, `['allCircleMembers']`, `['resource']`.
- Mutations follow a pattern: if offline feature enabled and the failure is a network error (`isNetworkError`, `ChoreQueries.jsx:~33`) or device is offline, write to `offlineDB`, enqueue a command, and optimistically patch the query cache; otherwise call the API.
- `useResource` (`['resource']`, 6 h stale) fetches server info and records the backend version for diagnostics (`src/queries/ResourceQueries.jsx`). `App` calls it on every load.

## Offline layer

Gated by `isOfflineFeatureEnabled()` (`src/utils/OfflineFeatureToggle.js`): localStorage key `offline_feature_enabled`, default **on** when unset. Toggle fires a window event; there is a helper to clear Cache Storage.

| Piece | File | Role |
|---|---|---|
| `offlineDB` | `src/utils/OfflineDB.js` | Facade over two backends picked at runtime: `SQLiteBackend` (native, `:49`) and `IndexedDBBackend` (web, `:539`). Stores chores (+`sync_version`), history, `command_queue`, `sync_meta` (cursor), and a generic KV (`saveKV/getKV`) |
| `commandQueue` | `src/utils/CommandQueue.js` | Persistent queue of offline writes. `CommandType` enum (create/update/complete/skip/start/pause/delete/archive/reschedule/move-project...). `compact()` merges consecutive updates and folds updates into a pending create; `remapEntityId(tempId, realId)` swaps `temp_*` ids after create |
| `syncEngine` | `src/utils/SyncEngine.js` | `sync()` = reset stuck commands -> compact -> replay (`_replayCommands`) -> delta sync (`GET /sync/changes?since=<cursor>`, paged) -> refresh image cache. Concurrent callers are coalesced into one follow-up run (`:70-95`). `MAX_COMMAND_RETRIES = 8`; delta loop aborts at 500 pages or when the token disappears |
| `NetworkManager` | `src/hooks/NetworkManager.jsx` | Singleton `networkManager`: `deviceOnline` (Capacitor Network) and `serverReachable` (set by fetch success/failure); `isOnline` is both |
| `useSyncOnReconnect` | `src/hooks/useSyncOnReconnect.js` | Mounted in `AppContent`. Triggers `syncEngine.sync()` on network change, tab visible, `online`, native app resume; one self-rescheduling timer: 30 s with pending commands, 15 s probing unreachable server, 5 min cache refresh. After a successful sync it calls `queryClient.invalidateQueries()` (everything) |
| `OfflineHydration` | `src/queries/OfflineHydration.js` | Called (not awaited) from `QueryContext`. Seeds query cache from the offline store with `updatedAt: 1` so data renders instantly yet is refetched. Reads KV keys `user_profile`, `labels`, `projects`, `circle_members`, `filters`, `project_sections:<id>` and all chores. Key names must match the writers in the query files (`OfflineHydration.js:45-49`) |
| Pending creates | `src/utils/PendingChores.js` | `mergePendingCreates` overlays queued temp chores onto lists |
| Images | `src/utils/ImageCache.js` | Prefetch/evict images referenced by cached chores; cleared on logout |

`useChores` read path (`ChoreQueries.jsx:~64`): if online, `syncEngine.sync()`; if a sync cursor exists, return the cached list merged with pending creates; else fall back to API, then to cache on failure.

## Realtime (SSE)

- `src/hooks/useSSE.js` is wrapped by `SSEProvider` in `src/contexts/SSEContext.jsx`; consumers use `useSSEContext()` (default context value = closed). Endpoint: `<apiUrl>/realtime/sse`.
- Web: `EventSourcePolyfill` with `Authorization: Bearer` header. Native: plain `EventSource` because Capacitor's HTTP bridge can't stream; it first fetches a single-use ticket from `/realtime/sse/ticket` and passes `?ticket=` (`useSSE.js:~393-430`).
- Event handling is a `switch` on `eventData.type` (`:~100-300`): `chore.created|updated|completed|status|skipped|deleted`, `project.updated`, `project.board_updated`, `subtask.updated|completed`, `heartbeat`, `connection.established`, `error`. Handlers mix `setQueryData` (chores) and `invalidateQueries` (projects, subtasks) and show toasts.
- Reconnect: backoff table `RECONNECT_INTERVALS`, circuit breaker after 10 attempts (resets after 10 min), heartbeat monitor, reconnect is triggered via a `sse-reconnect` window event (`:~304-330`).
- SSE only connects when `useAuth()` reports a token; it calls `useUserProfile()` itself.

## Auth and tokens

- `src/hooks/useAuth.jsx` (`AuthProvider`/`useAuth`): holds `token` from `localStorage.token`, exposes `login`, `fetchUser`, `isAuthenticated`. `login` POSTs `/auth/login` directly with `fetch` (web sends `credentials: 'include'`), clears `offlineDB` (so a new user never sees old data), then `saveTokens`. The init effect is fully commented out; there is no logout there (logout lives in `ApiClient.handleLogout` and `Fetcher.logout`).
- `src/utils/TokenStorage.js`:
  - Web: access token + expiries in `localStorage` (`token`, `token_expiry`, `refresh_token_expiry`); refresh token is an HTTP-only cookie (`isRefreshTokenExpired` returns false on web).
  - Native: additionally stores refresh token + expiry in Capacitor Preferences.
  - `saveTokens` dispatches `authTokensSaved` (push registration listens); `hasValidAccessToken()` is a sync check for non-React callers; `clearAllTokens` is idempotent and removes legacy keys.
- `ApiClient` 401 handling (`ApiClient.js:269-343`): queue the failed request, call `refreshToken()` (via `RefreshToken` in `Fetcher`), retry queued requests on success. 3 s cooldown (`refreshCooldown`), single in-flight refresh, shared `logoutPromise`. Skipped while an OAuth exchange is in flight (`src/utils/OAuthExchangeState.js`) so the exchange isn't torn down.
- `performLogout` (`:170`) order: stash pending invite code -> unregister push -> clear badge -> `clearAllTokens` -> `offlineDB.clearAll` -> clear image cache -> clear widget data -> server `logout()` -> `window.location.href='/login'`. Several imports are dynamic to avoid circular imports (ApiClient <-> ImageCache/WidgetService/CapacitorListener).
- Impersonation (admin/manager acts as another circle member): `src/contexts/ImpersonateUserContext.jsx` persists `impersonation` and `impersonatedUserId` in localStorage; `ApiClient.getHeaders` adds `X-Impersonate-User-ID` from `localStorage.impersonatedUserId` (`ApiClient.js:128-131`). The provider is mounted in `AppContent` (and in `MarketingApp`). Note `startImpersonation` stores `userToImpersonate.userId` for the header while `getImpersonationHeaders()` reads `.id` (`ImpersonateUserContext.jsx:33,71`); `ApiClient` uses the localStorage value, not `getImpersonationHeaders`.
- Social login: `@capgo/capacitor-social-login` (Google/Apple enabled in `capacitor.config.ts`), `reactjs-social-login` on web; hidden when `VITE_IS_SELF_HOSTED === 'true'` (`src/views/Authorization/LoginView.jsx:~448`).
- Entitlements/paywall: `PaywallProvider`, `src/utils/entitlements.js`, `src/utils/NativePaywall.js` (RevenueCat). unverified: exact gating rules.

## Capacitor native layer

- Config: `capacitor.config.ts` sets StatusBar (`overlaysWebView: false`), PushNotifications presentation options, Badge (`persist`, no `autoClear`; badge is driven by `useAppBadgeSync`), LocalNotifications icon/sound, CapacitorSQLite with encryption disabled on both platforms, SocialLogin providers. Android `allowMixedContent: true`.
- `src/CapacitorListener.js` (`registerCapacitorListeners(navigate)`): central native wiring.
  - Deep links: `getLaunchUrl()` consumed once for cold start, `appUrlOpen` for warm; used by NFC tags and OAuth callbacks (`beginOAuthExchange`).
  - `appStateChange` -> React Query `focusManager`; `backButton` handling; `browserFinished` -> status bar restore.
  - Push: `PushNotifications` `registration` listener queues device-token registration with the backend, skipped if unchanged (`deviceRegistration` in Preferences), retries; re-registers on `authTokensSaved` and `online`. Exports `registerPushNotifications` / `unregisterPushNotifications`.
  - Local notification tap -> `navigateToChore`. Incoming shares (`@supernotes/capacitor-send-intent`, `src/service/ShareTargetService.js`) -> `/chores?share_task=1`.
- Native hooks in `src/hooks`: `useStatusBar` (+ `src/utils/StatusBarManager.js`), `useAppBadgeSync`, `useLocalNotificationSync`, `useDocumentScanner`.
- Home-screen widgets: `src/service/WidgetService.js` registers the `WidgetBridge` Capacitor plugin; `initWidgetSync` (called from `QueryContext`) subscribes to the query cache and, debounced 1.5 s, pushes a snapshot when `chores`, `userProfile`, `allCircleMembers`, `projects` or `filters` queries update. Native implementations: `ios/App/App/WidgetBridgePlugin.swift`, `ios/App/DonetickWidget/`, `android/app/src/main/java/com/donetick/app/widget/*` (Today, Week, People, Project, QuickActions, QuickCapture providers). iOS also has a `ios/App/DonetickShare/` share extension (unverified: contents not read). Widget opacity/theme are device-local in localStorage.
- Other native plugins (see `package.json`): sqlite, network, preferences, filesystem, share, haptics, device, in-app-review, speech-recognition (patched, see `patches/`, applied by `postinstall: patch-package`), NFC and document-scanner (`@capgo`), OCR, RevenueCat, local LLM.
- Native vs web branching uses `Capacitor.isNativePlatform()` (also cached helpers in `TokenStorage.js`, `OfflineDB.js`).

## Build modes and environments

| Mode | Command | Env file loaded | Notes |
|---|---|---|---|
| Dev | `npm run dev` / `npm start` (`--host`) | `.env`, `.env.development` | console/debugger kept |
| Default build | `npm run build` (`vite build`) | `.env` (production) | `esbuild.drop: ['console','debugger']` in builds (`vite.config.mjs`) |
| Self-hosted | `npm run build-selfhosted` (`vite build --mode selfhosted`) | `.env.selfhosted` | `VITE_IS_SELF_HOSTED` hides social login and shows self-host settings |
| Cloudflare Pages | `npm run build-cf`, driven by `wrangler.toml` (`[build] command`, output `dist`) | `.env` | Deletes `package-lock.json`, reinstalls and force-installs Linux rollup/swc binaries before building |
| Windows / Apple Silicon | `build-win`, `setup-m1`, `setup-apple-silicon` | - | Platform-specific native rollup/swc installs |
| Native | `npm run ios` / `android` (`build` + `npx cap sync <platform>`), `cap`, `android:dev` (live reload) | `.env` | Needs `dist/` first |

- Env files present (names only): `.env`, `.env.development`, `.env.selfhosted`. Variables referenced in code: `VITE_APP_API_URL` (`AUTO` supported), `VITE_APP_REDIRECT_URL`, `VITE_APP_GOOGLE_CLIENT_ID`, `VITE_APP_IOS_CLIENT_ID`, `VITE_IS_SELF_HOSTED`, `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST`, `VITE_REACT_APP_REVENUECAT_API_KEY_IOS|ANDROID`, `VITE_FEEDBACK_WEBHOOK_URL`, `VITE_ERROR_REPORT_WEBHOOK_URL`, `VITE_BRIDGE_WEB_URL`. `VITE_APP_VERSION` is injected from `package.json` via `define`. `VITE_IS_LANDING_DEFAULT` and `VITE_OPENREPLAY_PROJECT_KEY` appear in env files but no reader was found in `src/` (unverified: may be dead).
- PWA (`vite-plugin-pwa`): `registerType: 'prompt'`, no `skipWaiting`/`clientsClaim` (new worker activates only after the user taps refresh in the snackbar), `navigateFallback: /index.html` denying `/api/` and `/swagger`, 6 MB cache file limit, manifest defined inline in `vite.config.mjs`.
- PostHog sourcemap upload plugin is added only for `vite build` when `POSTHOG_UPLOAD_SOURCEMAPS=true` and key/project/host are set (`vite.config.mjs:10-30`).
- Static hosting files: `public/_redirects` (rewrites `/.well-known/apple-app-site-association`), `public/_headers`, `public/.well-known/` (universal links / app links).
- Release scripts: `bump-version.js`, `npm run release` (patch version, build, push tags to `develop`), `merge`; see `AUTOMATED_RELEASE.md`. CI and lint: see [testing-and-ci.md](testing-and-ci.md) (`.github/workflows/build.yml` runs `npm i`, build, `lint:ci`).

Last verified: 2026-11-12 at commit 99e6a9f
