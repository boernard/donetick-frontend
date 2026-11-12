# Testing, lint and CI

Siblings: [architecture.md](architecture.md), [directory-map.md](directory-map.md), [domain-model.md](domain-model.md), [conventions.md](conventions.md), [gotchas.md](gotchas.md).

## Commands

| Goal             | Command                                            | Notes                                                                                                 |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Dev server       | `npm run dev` (or `npm start`, adds `--host`)      | Vite, `vite.config.mjs`                                                                               |
| Build            | `npm run build`                                    | `vite build` into `dist/`. Not run here (writes to repo).                                             |
| Unit tests       | `node --test tests/`                               | **No `npm test` script exists** (verified in `package.json`). Plain Node test runner, no jest/vitest. |
| One test file    | `node --test tests/project-board-offline.test.mjs` |                                                                                                       |
| Lint (all)       | `npm run lint`                                     | `eslint && prettier -c . && npm run lint:i18n`                                                        |
| Lint, CI flavour | `npm run lint:ci`                                  | Same but `eslint -f gha`                                                                              |
| Autofix          | `npm run lint:fix`                                 | `eslint --fix && prettier -w .` (modifies files)                                                      |
| i18n audit       | `npm run lint:i18n`                                | `scripts/i18n/i18n-audit.mjs`                                                                         |
| i18n PR safety   | `npm run check:i18n-pr`                            | `scripts/i18n/i18n-pr-safety.mjs`, also used by CI                                                    |
| E2E (full)       | `cd e2e && ./run-e2e.sh`                           | see below                                                                                             |
| E2E (manual)     | `cd e2e && npm test`                               | needs backend + frontend already running                                                              |

Node >= 20 (`package.json` engines, `.nvmrc` = 20). `.npmrc` sets `fund=false`, `audit=false`.

## Unit tests (`tests/*.test.mjs`)

Verified by running `node --test tests/` at 99e6a9f (about 0.4 s total):

- **107 tests, 92 pass, 15 fail** - the prior audit's "107 / 15 fail" is **correct**.
- Failing files (5 of 19), counts from running each file alone:

| File                                       | Failing                      | Likely cause (read from assertion output)                                                                   |
| ------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `tests/project-board-card.test.mjs`        | 5                            | Source-string assertions out of date after the card refactor (`a2a7c25`, `6e1ece8`)                         |
| `tests/project-task-row.test.mjs`          | 5                            | Same - TaskCard/ProjectTaskRow layout changed                                                               |
| `tests/action-theme.test.mjs`              | 2                            | Theme accent assertions vs. current components                                                              |
| `tests/startup-screen.test.mjs`            | 2                            | Expects `prefers-color-scheme: dark` in `index.html` startup CSS; it now uses `[data-startup-theme='dark']` |
| `tests/task-editor-compatibility.test.mjs` | 1 (file-level fail reported) | not investigated                                                                                            |

- The other 14 files (`board-*`, `clipboard`, `feedback-theme`, `navigation-theme`, `project-board-offline`, `push-registration`, `settings-*`, `theme-*`, `vite-config`) pass.
- Causes are inferred from output, not fully debugged: treat as "tests are stale vs. UI refactors", not "code is broken". Do not assume a red run is caused by your change; compare against this baseline.
- `package-lock.json` shows modified in `git status` at session start (pre-existing, unrelated).

### Test style

Two styles coexist:

1. **Source-string assertions** (most UI tests): `readFileSync` a `.jsx` file and `assert.match(source, /regex/)`. Cheap, no React rendering, but brittle - they break on any refactor of wording/structure (this is why 12 of 15 failures sit in component tests). Used by `project-board-card`, `project-task-row`, `action-theme`, `startup-screen`, `settings-*`, `*-theme`.
2. **Behavioural with mocked modules** (best examples): load a source file, transpile with `@swc/core` `transformSync` to CommonJS, run it in `node:vm` with a hand-written `require` that returns fake modules (and asserts on unexpected imports). See `load()` and `setup()` at `tests/project-board-offline.test.mjs:9-40`. Pure utilities can be imported directly (`../src/utils/BoardOrdering.js`, see `tests/board-task-ordering.test.mjs`).

Copy `tests/project-board-offline.test.mjs` for anything touching hooks/queries/offline logic; copy `tests/board-collision-detection.test.mjs` / `board-task-ordering.test.mjs` for pure functions. Imports use `node:test` + `node:assert/strict`; files are ESM `.mjs`.

No React component rendering, no DOM, no coverage tooling, no CI step runs these tests.

## Lint baseline

Config: `eslint.config.mjs` (flat config), `prettier.config.mjs`, `.prettierignore` (skips `android/`, `ios/`, `dist/`, lockfiles, `.agents/`, `.impeccable/`).

Verified by running `npx eslint -f json` over the repo (about 18 s wall, not >120 s; `eslint src/utils src/hooks` takes about 4 s):

- **1 error, 2292 warnings** - matches the prior audit.
- The single error: `prettier/prettier` at `src/views/Projects/ProjectQueries.js:533` ("Insert `··`"). `prettier -c .` also flags this file, so `npm run lint` and CI currently fail on formatting there (and on the untracked docs `.md` files if they are unformatted - run `npx prettier -c docs` before committing docs).
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
| `build.yml` "Build validation"         | every push and PR     | Node 20, `npm i` (not `npm ci`), `npm run build`, `npm run lint:ci`. Does **not** run `node --test`.                                                                              |
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

Last verified: 2026-11-12 at commit 99e6a9f
