# donetick-FE

React 18 + Vite web app for Donetick (shared chores/tasks, projects, rewards, timers), also shipped to iOS/Android through Capacitor. Plain JS/JSX (no TypeScript yet), MUI Joy (`@mui/joy` 5.0.0-beta.52) with `sx`, `@tanstack/react-query`, `react-i18next`, offline layer (SQLite + command queue), SSE for realtime. Design intent lives in `PRODUCT.md`.

## Commands

| Goal | Command | State |
|---|---|---|
| Dev | `npm run dev` | works |
| Build | `npm run build` | works (CI runs it) |
| Lint (eslint + prettier + i18n) | `npm run lint` | 1 prettier error + ~2.3k warnings baseline; ~18s for eslint |
| Autofix | `npm run lint:fix` | modifies files |
| Unit tests | `node --test tests/` | **no `npm test` script**; 107 tests, 15 fail (stale, see `docs/ai/testing-and-ci.md`) |
| Typecheck | none | `tsconfig.json` is unusable today; see roadmap |
| E2E | `cd e2e && ./run-e2e.sh` | needs a backend; not in CI |

Node >= 20. Several `build-*`/`setup-*` scripts delete `package-lock.json`; do not run them casually (`docs/ai/gotchas.md`).

## Rules that apply to every task

1. Fetch data only through `src/queries/*` hooks that call `src/utils/Fetcher.jsx`; never call `fetch` in components.
2. Every user-facing string goes through `t()`. Edit only `public/locales/en/*.json`; other locales are Crowdin-managed. `npm run lint:i18n` must pass.
3. Style with Joy theme tokens (`bgcolor: 'background.surface'`, `var(--joy-*)`), not raw hex. Do not re-override Button/IconButton size, radius or focus locally.
4. New modals use `AppModal` (`src/components/common/AppModal.jsx`), not the legacy `useResponsiveModal`.
5. Do not bump `@mui/joy`; its beta types change between releases.
6. Never rename a theme preset ID (persisted in user storage).
7. The API models `triggerState` as a string for every thing type; serialize numerics before sending (`src/views/ChoreEdit/ThingTriggerSection.jsx`).
8. Code style is enforced: no semicolons, single quotes, `jsxSingleQuote`, sorted imports and destructured keys. Run prettier/eslint on files you touch.
9. Honour PRODUCT.md: 44px touch targets on phones, reduced motion, RTL (prefer logical properties), status-only colour.
10. Once the JS→TS migration starts, add no new `.jsx`/`.js` files; new files are `.tsx`/`.ts`.

Do not run `npm run build`-family scripts, native syncs or e2e unless the task needs them; tests under `tests/` are mostly source-string checks, so a red run may predate your change (compare with the baseline).

## Deeper docs (`docs/ai/`, index in `docs/ai/README.md`)

| File | Read when |
|---|---|
| `docs/ai/architecture.md` | touching providers, routing, data flow, offline/sync, SSE, auth, Capacitor, build modes |
| `docs/ai/directory-map.md` | looking for where something lives; sizing a change; "where do I find X" |
| `docs/ai/domain-model.md` | working with chores, projects, circles, labels, things/triggers, rewards; API shape quirks |
| `docs/ai/conventions.md` | writing components, styling, modals, i18n; "how to add a route/query/API call/setting" |
| `docs/ai/testing-and-ci.md` | running or writing tests, lint, CI, hooks |
| `docs/ai/gotchas.md` | before native/build/release work, offline/sync or auth changes |
| `docs/ai/status-and-roadmap.md` | planning: TS migration, test infra, design tokens, prioritised audit findings |

## Keeping these docs fresh

When you change architecture, conventions, commands or the roadmap, update the matching `docs/ai/*.md` and its "Last verified" line in the same change. `/refresh-docs` (`.claude/commands/refresh-docs.md`) re-verifies the docs against the git diff since their last verified commit.
