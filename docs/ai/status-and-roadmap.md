# Status and roadmap

Source: frontend audit of 2026-11-12 (TypeScript migration, testability/stability, design system). Figures come from that audit and may drift; re-measure before relying on them. Nothing listed under "Pending" had been started when this was written.

## Snapshot

| Area | State |
|---|---|
| Language | 286 `.jsx` (~82.9k LOC) + 116 `.js` (~17.9k LOC), 0 `.ts`/`.tsx`. Views are ~76k of ~100k LOC. |
| Type checking | None. Vite uses SWC (strips types). `tsconfig.json` exists but is unusable (`nodenext`, no `jsx`/`allowJs`/`include`). CI has no `tsc` step. |
| Tests | 19 node-runner files in `tests/`; no `test` script; not run in CI or pre-commit. Verified 2026-11-12: 107 tests, 92 pass, 15 fail (see `testing-and-ci.md`). No Vitest/jsdom/Testing Library/coverage. |
| Lint | 1 error (prettier, `src/views/Projects/ProjectQueries.js:533`) + 2,292 warnings (full `eslint src` takes ~18s) (1,768 `react/prop-types`, 83 `set-state-in-effect`, 53 `exhaustive-deps`). |
| Design system | Partial. Joy theme + presets + `AppModal`/`EmptyState` exist. No tokens for spacing/type/shadow/z-index/motion. |

## Agreed top 5 (value ÷ effort)

1. **Gate quality in CI.** Fix the prettier error, fix/delete failing tests, add a `test` script, run it plus `tsc --noEmit` in `.github/workflows/build.yml`.
2. **Make TypeScript real.** Replace `tsconfig.json` with a bundler config, add `src/vite-env.d.ts` and a `typecheck` script.
3. **Type the API layer and test the core.** Domain types in `src/types/`, split `Fetcher.jsx` by domain, then Vitest tests for token refresh, `OfflineDB` sync, SSE cache patching, task payload serializer.
4. **Design tokens + `ui/` wrapper layer.** `src/design/tokens.js`, then `src/ui/` (toast, modal, chip first); drop Tailwind and Material.
5. **Resilience.** Top-level ErrorBoundary, route-level `React.lazy` + `manualChunks`, token-refresh tests.

## Roadmap

| Horizon | Item | Effort | Unblocks |
|---|---|---|---|
| Now (≤1 wk) | Fix prettier error; fix or delete failing tests | S | trustworthy CI |
| | New tsconfig, `typecheck` script, CI step | S | all TS work |
| | Vitest + `test` script + CI step | S | new tests |
| | Strip the 94 `.js`/`.jsx` import suffixes (own PR) | S | file renames |
| | Add tests around token refresh in `src/utils/ApiClient.js` (re-verify the race first); remove the token log in `src/hooks/useSSE.js` (~line 50) | S | auth stability |
| | Top-level ErrorBoundary | S | crash recovery |
| Next (≤1 mo) | Domain types; split `Fetcher.jsx` by domain | M | typed data layer |
| | First four core tests (ApiClient refresh, OfflineDB queue/sync, SSE patching, task payload serializer) | M | safe refactors |
| | Route-level lazy loading, `manualChunks` | M | bundle size |
| | `tokens.js` + lint warnings (raw colours, z-index, shadows) | M | design system |
| | `ui/` toast, modal, chip; remove Tailwind | M | Joy insulation |
| Later | Convert layers to TS (utils → queries/hooks → contexts/service → components → views); ratchet strictness | L | type safety |
| | Split god files (`ChoreEdit`, `AddTaskModal`, `MyChores`, `ChoreView`) | L | testability |
| | RTL logical properties, contrast checks, 44px targets | M | accessibility |

## TypeScript migration plan

Proposed `tsconfig.json`: `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `allowJs: true`, `checkJs: false`, `noEmit`, `skipLibCheck`, `isolatedModules`, `strict: false`, `paths: {"@/*": ["src/*"]}`, `types: ["vite/client"]`, `include: ["src"]`. Baseline: 0 errors with `checkJs` off; 1,214 with `checkJs` on and strict off.

PR sequence:
1. Config, `src/vite-env.d.ts`, `typecheck` script, CI step.
2. Codemod removing explicit `.js`/`.jsx` import suffixes.
3. `src/types/` domain types and typed, domain-split `Fetcher`.
4. Convert layer by layer with `git mv`; per-directory `checkJs`; CI check that no new `.js`/`.jsx` appears.
5. Ratchet: `noImplicitAny`, then `strictNullChecks`, then `strict`.

Known blockers: 34 files use PropTypes (remove as converted); likely missing types for `@meauxt/react-swipeable-list` and `js-cookie`; Joy/Material both export `Theme`/`SxProps` (alias imports); Joy theme extensions need module augmentation in `src/contexts/ThemeContext.jsx`; do not bump `@mui/joy` (5.0.0-beta.52) during migration. Rough effort: 4–8 weeks for one person on non-view layers (low confidence).

## Highest-risk untested code

1. `src/utils/ApiClient.js` token refresh: `refreshToken()` returns "Already refreshing" to concurrent callers, but `request()` queues concurrent 401s and retries them, so the audit's race claim is only partly true. Still untested; verify before changing.
2. `src/utils/OfflineDB.js` + sync paths in `src/utils/Fetcher.jsx`.
3. `src/hooks/useSSE.js` (~780 lines), no tests.
4. `src/views/ChoreEdit/ChoreEdit.jsx` (~3,070 lines), `AddTaskModal`, recurrence/trigger serialization.
5. `src/views/Chores/hooks/useChoreActions.js` (~1,360 lines).

Not yet checked: react-query client options (`src/contexts/QueryContext.jsx`), circular imports, loading/error/empty states.

## Test plan

Vitest + jsdom + Testing Library + msw + v8 coverage; ~70% unit, ~25% hook/component, ~5% e2e. First five tests: ApiClient refresh; OfflineDB queue/sync; SSE cache patching; task payload serializer (`triggerState` string); `useChoreActions` with optimistic rollback.

## Design system plan

Order: tokens → lint warnings → `ui/` primitives → import codemods → warnings to errors.
- `src/design/tokens.js`: semantic colour roles, status vs label palettes, radius, 4px spacing scale, type scale, shadows, z-index, motion. `ThemeContext.jsx`, `startupTheme.js`, `constants/theme.js` derive from it.
- `src/ui/`: Button, IconButton, Input, Card, Chip, ListRow, AppModal, EmptyState, Toast. Biggest duplication: Snackbar (8 files), modals (35 files still on `useResponsiveModal`), Chip (62 files).
- Docs: expand `/test` into a gallery, write `DESIGN.md` beside `PRODUCT.md`.
- Lint: ban raw hex/rgb outside `src/design/`, ban `@mui/material`, restrict `@mui/joy` imports to `ui/`, ban literal `zIndex`/`boxShadow`, prefer logical properties.

## Open questions

- Is `triggerState` as a string the intended long-term API contract?
- Does `assignee` vs `assignedTo` mean object vs id?
- Stay on Joy long term, or move away?

## Deliberately not doing

Global `strict`/`checkJs`, swapping Joy before `ui/` exists, big-bang view conversion, more source-grep tests.

Last verified: 2026-11-12 at commit 99e6a9f
