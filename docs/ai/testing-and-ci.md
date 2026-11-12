# Testing, lint and CI

Siblings: [architecture.md](architecture.md), [directory-map.md](directory-map.md), [domain-model.md](domain-model.md), [conventions.md](conventions.md), [gotchas.md](gotchas.md).

## Commands

| Goal             | Command                                            | Notes                                                                                                  |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dev server       | `npm run dev` (or `npm start`, adds `--host`)      | Vite, `vite.config.mjs`                                                                                |
| Build            | `npm run build`                                    | `vite build` into `dist/`. Not run here (writes to repo).                                              |
| Tests (all)      | `npm test`                                         | `node --test tests/` then `vitest run`. Both run in CI.                                                |
| Vitest only      | `npm run test:unit`                                | `vitest.config.mjs`: jsdom, `src/**/*.test.{js,jsx,ts,tsx}`, setup in `tests/setup/vitest.setup.js`    |
| Typecheck        | `npm run typecheck`                                | `tsc --noEmit`, bundler-mode `tsconfig.json`, `checkJs` off; 0 errors at the commit that introduced it |
| Node tests only  | `node --test tests/`                               | Plain Node runner, source-string and vm-harness tests                                                  |
| One test file    | `node --test tests/project-board-offline.test.mjs` |                                                                                                        |
| Lint (all)       | `npm run lint`                                     | `eslint && prettier -c . && npm run lint:i18n`                                                         |
| Lint, CI flavour | `npm run lint:ci`                                  | Same but `eslint -f gha`                                                                               |
| Autofix          | `npm run lint:fix`                                 | `eslint --fix && prettier -w .` (modifies files)                                                       |
| i18n audit       | `npm run lint:i18n`                                | `scripts/i18n/i18n-audit.mjs`                                                                          |
| i18n PR safety   | `npm run check:i18n-pr`                            | `scripts/i18n/i18n-pr-safety.mjs`, also used by CI                                                     |
| E2E (full)       | `cd e2e && ./run-e2e.sh`                           | see below                                                                                              |
| E2E (manual)     | `cd e2e && npm test`                               | needs backend + frontend already running                                                               |

Node >= 20 (`package.json` engines, `.nvmrc` = 20). `.npmrc` sets `fund=false`, `audit=false`.

## Unit tests

Two runners:

- **Node runner** (`tests/*.test.mjs`, about 0.4 s): 107 tests, all passing. The 17 that were stale against UI refactors were repaired (project card/row fixtures now match the permission rules in `src/utils/ChoreAccess.js`; the Telegram-group paywall check was dropped because that checkbox is commented out in `ChoreEdit.jsx`). Shared helpers: `tests/helpers/loadSource.mjs` (`loadSource`, `loadChorePermissions`).
- **Vitest** (`src/**/*.test.{js,jsx}`): `src/utils/ApiClient.test.js` (401 refresh/retry, concurrent 401s share one refresh, cooldown, refresh failure, expired refresh token, `skipAuthRecovery`, OAuth exchange) and `src/components/ErrorBoundary.test.jsx`. Node 26's experimental global `localStorage` shadows jsdom's, so `tests/setup/vitest.setup.js` installs an in-memory Storage.

The `ApiClient` refresh race flagged by the audit is benign: concurrent 401s queue in `failedQueue`, a second caller gets `Already refreshing` (or the 3 s cooldown) and is resolved by `processQueue`. The test deleting the `isRefreshing` guard in `refreshToken()` is the one that fails.

### Test style

Two styles coexist:

1. **Source-string assertions** (most UI tests): `readFileSync` a `.jsx` file and `assert.match(source, /regex/)`. Cheap, no React rendering, but brittle - they break on any refactor of wording/structure (the 17 stale tests were all of this kind). Used by `project-board-card`, `project-task-row`, `action-theme`, `startup-screen`, `settings-*`, `*-theme`.
2. **Behavioural with mocked modules** (best examples): load a source file, transpile with `@swc/core` `transformSync` to CommonJS, run it in `node:vm` with a hand-written `require` that returns fake modules (and asserts on unexpected imports). See `load()` and `setup()` at `tests/project-board-offline.test.mjs:9-40`. Pure utilities can be imported directly (`../src/utils/BoardOrdering.js`, see `tests/board-task-ordering.test.mjs`).

Copy `tests/project-board-offline.test.mjs` for anything touching hooks/queries/offline logic; copy `tests/board-collision-detection.test.mjs` / `board-task-ordering.test.mjs` for pure functions. Imports use `node:test` + `node:assert/strict`; files are ESM `.mjs`.

Vitest + jsdom is available for hook/component tests (no Testing Library or msw yet, no coverage tooling). CI runs `npm test`.

## Lint baseline

Config: `eslint.config.mjs` (flat config), `prettier.config.mjs`, `.prettierignore` (skips `android/`, `ios/`, `dist/`, lockfiles, `.agents/`, `.impeccable/`).

Verified by running `npx eslint -f json` over the repo (about 18 s wall, not >120 s; `eslint src/utils src/hooks` takes about 4 s):

- **0 errors, about 2300 warnings** (the prettier error at `ProjectQueries.js:533` is already fixed).
- `prettier -c .` also checks `docs/` and `CLAUDE.md`; run `npx prettier -w docs CLAUDE.md` after editing them.
- Top warnings: `react/prop-types` 1768, `react-hooks/set-state-in-effect` 83, `react/no-unescaped-entities` 66, `tailwindcss/no-custom-classname` 61, `eqeqeq` 55, `react-refresh/only-export-components` 54.
- `eslint.config.mjs:~190-200` deliberately downgrades `no-case-declarations`, `no-empty`, `no-redeclare` and several react-hooks rules to `warn` ("reduce existing errors to warnings"). New code should not add to them.
- `no-case-declarations` hits: `src/hooks/useSSE.js:107` and 12 in `src/views/components/CustomParsers.js` (lines ~421-567).

`prettier -c .` takes about 5 s. It also reports the deprecated `jsxBracketSameLine` option (harmless warning).

## Git hooks

- `.husky/pre-commit` runs `npx lint-staged`.
- `package.json` `lint-staged`: `*.{js,jsx,ts,tsx}` -> `eslint --fix` then `prettier --write`. Only JS/TS is covered; `.md`/`.json`/`.css` are not auto-formatted, so `prettier -c .` in CI can still fail on them.
- Tests are **not** run in the hook.

## CI (`.github/workflows/`)

| Workflow                               | Trigger               | What it does                                                                                                                                                                      |
| -------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build.yml` "Build validation"         | every push and PR     | Node 20, `npm i` (not `npm ci`), `npm run build`, `npm run lint:ci`, `npm run typecheck`, `npm test`.                                                                             |
| `i18n-safety.yml` "Translation safety" | `pull_request_target` | Checks out the trusted base, fetches PR head as data only, runs `scripts/i18n/i18n-pr-safety.mjs --base --head` (adds `--crowdin` for `l10n_*` branches). Never executes PR code. |
| `cleanup-crowdin-branch.yml`           | PR closed             | Deletes stale `l10n_*` service branches if no open PR uses them.                                                                                                                  |

Native builds/releases are not in CI; they run locally via `scripts/release.sh` + fastlane (see [gotchas.md](gotchas.md)).

## E2E (`e2e/`)

Separate package (`e2e/package.json`, `@playwright/test`), Chromium only, `workers: 1` (single SQLite DB), `retries: 2` only when `CI` is set (`e2e/playwright.config.js`).

- `e2e/run-e2e.sh`: kills anything on ports 2022/5180, starts the Go backend with `go run .` from `$HOME/workspace/donetick-core` (**hard-coded path; the backend repo must be checked out there**), with a throwaway SQLite config, starts `vite --port 5180` with `VITE_APP_API_URL` pointed at it, waits for both, runs `npx playwright test "$@"`, then tears everything down. Logs go to `e2e/.e2e-run/` (git-ignored via `e2e/.gitignore`).
- `e2e/global-setup.js` creates a shared test user (idempotent) and saves JWT as Playwright storage state so tests skip the login UI. Env: `E2E_FRONTEND_URL`/`E2E_BASE_URL` (default `http://localhost:5173`), `E2E_API_URL` (default `http://localhost:2021`).
- Specs in `e2e/tests/`: `add-task-modal`, `auth`, `chore-edit`, `chores`, `projects-filters`.
- Prereqs: `cd e2e && npm install && npx playwright install chromium`, Go toolchain, backend repo. Not run in verification here (needs backend, would install deps). The e2e specs predate the Tasks/Projects UI rename in places - unverified whether they all pass.
- `e2e/debug.mjs` is an ad-hoc helper script.

Last verified: 2026-11-12 at commit b05a4cd0 (plus the uncommitted "Now" roadmap work)
