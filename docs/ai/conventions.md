# Conventions

Patterns the code actually follows. Cross-refs: [architecture.md](architecture.md),
[directory-map.md](directory-map.md), [testing-and-ci.md](testing-and-ci.md),
[domain-model.md](domain-model.md), [gotchas.md](gotchas.md). Design intent:
`PRODUCT.md` (summary at the end).

## Code style (enforced by `npm run lint`)

- `lint` = `eslint && prettier -c . && npm run lint:i18n` (`package.json:23`). `lint:fix` auto-fixes. Husky pre-commit runs `lint-staged` (`.husky/pre-commit`).
- Prettier (`prettier.config.mjs`): no semicolons, single quotes, **`jsxSingleQuote: true`** (`<Box sx={...} component='section'>`), 80 cols, trailing commas, `arrowParens: 'avoid'` (`x => x`), tailwind plugin.
- ESLint (`eslint.config.mjs`): `simple-import-sort` (imports and exports), `sort-destructure-keys` (destructured props alphabetical, see `SettingsSection.jsx:6`), `eqeqeq` warn, `max-lines` 2000 (error), `@tanstack/query` plugin, react-hooks.
- Import alias `@` -> `/src` (`vite.config.mjs:135`) is used in only ~15 files; the dominant style is relative imports (`../utils/Fetcher`). Either works; match the neighbouring file.
- Plain JS/JSX; PropTypes in ~34 files (`import PropTypes from 'prop-types'`, declared at file bottom). No TS types for app code.

## Components

- Function components, `const Name = (...) => {}` with `export default Name` at the bottom; one component per file named in PascalCase (`ChoreCard.jsx`). Helpers/hooks are camelCase (`useTimer.js`, `useChoreFilters.js`).
- Screens live in `src/views/<Feature>/`, with feature-local `components/` and `hooks/` subfolders (`src/views/Chores/hooks/`, `.../components/`). Shared UI is `src/components/common/`; app-wide hooks `src/hooks/`; providers `src/contexts/`; pure helpers `src/utils/`.
- Large view files exist (`MyChores.jsx` ~60 KB, `ChoreEdit.jsx` ~2.2k lines). Prefer extracting a section component next to the view rather than growing them.
- Domain access/permission logic is a pure util (`ChoreAccess.js`, `ProjectAccess.js`, `entitlements.js`), not inline in JSX.
- UI library is **MUI Joy** (`@mui/joy`) first; icons from `@mui/icons-material` (`...Rounded` variants common). `className`/Tailwind appears in ~33 files but is secondary.
- Data fetching never happens in components directly: components call hooks from `src/queries/*` (or `src/views/Projects/ProjectQueries.js`, `src/views/Rewards/RewardQueries.jsx`), which call `src/utils/Fetcher.jsx`.

## Styling

- Joy `sx` prop with theme tokens as strings: `bgcolor: 'background.surface'`, `borderColor: 'divider'`, `borderRadius: 'xl'` (`SettingsSection.jsx:12-17`). Raw CSS vars when a string token is not possible: most used are `var(--joy-palette-primary-softBg)`, `--joy-palette-text-tertiary`, `--joy-palette-neutral-softHoverBg`, `--joy-radius-sm`, `--joy-palette-background-surface`.
- Responsive values via object syntax: `p: { xs: 2, sm: 2.5 }`. Use `minWidth: 0` on flex children that hold text.
- Theme is `src/contexts/ThemeContext.jsx` (`CssVarsProvider`, light/dark, RTL-aware emotion cache using `stylis-plugin-rtl`, component overrides). Button/IconButton sizing, radius, focus and reduced-motion live there (`:139-180`); do not re-override locally (`src/components/common/README.md`).
- Skins: `src/constants/themePresets.js` (`THEME_PRESETS`: default, forest, lavender, sand, ocean, rose, sunset, bubblegum...). Each preset = `accent`, optional `neutral`, `swatch`, and `light`/`dark` `{body, surface, popup}`. IDs are persisted under `donetick-theme-skin`; never rename one. Consumers: `ThemeSkinContext`, `src/views/Settings/ThemeSkinPicker.jsx`, startup flash avoidance `src/constants/startupTheme.js`.
- Task urgency colours come from `TASK_COLOR` (`src/utils/Colors.jsx:70`) and `getDateGroupColor` (`Chores.jsx`); status feedback colours `src/utils/feedbackTheme.js`.
- Buttons: primary `solid primary` (one per surface), secondary `outlined neutral`, tertiary `plain neutral`, destructive confirm `solid danger`; icon-only buttons need `aria-label`; use the `loading` prop against double submit (`src/components/common/README.md`). Live style guide at route `/test` (`src/views/TestView/Test.jsx`).

## Modals

| | `AppModal` (new) | `useResponsiveModal` (legacy) |
|---|---|---|
| File | `src/components/common/AppModal.jsx` | `src/hooks/useResponsiveModal.js` |
| Use | Render directly | `const { ResponsiveModal } = useResponsiveModal()`; renders `AppModal` underneath |
| Callers | ~17 files | ~37 files |

- Props: `open, onClose, title, description, footer, size ('sm' 400|'md' 520|'lg' 680|'xl' 840), mobilePresentation ('sheet' default|'fullscreen'), role, closeOnBackdrop, showCloseButton, maxHeight, keepMounted` (`AppModal.jsx:25-47`). Mobile breakpoint 768px.
- `AppModal` owns header, close button, scrolling, safe-area padding, footer: do not add a second close button or repeat the title inside.
- Footer: `<ModalActions secondary={{label,onClick}} primary={{label,onClick,loading}} />` (`ModalActions.jsx`); secondary first, primary last.
- Destructive confirm: `size='sm'`, `role='alertdialog'`, `closeOnBackdrop={false}`. Existing confirm helpers: `useConfirmationModal` (`src/hooks/useConfirmationModal.js`), `useAcknowledgmentModal`, `PermissionDeniedModal`.
- App-level modals mostly live in `src/views/Modals/`.

## i18n

- Library: `react-i18next`, config `src/i18n/config.js` (HTTP backend loads `/locales/{{lng}}/{{ns}}.json`, fallback `en`, detection `localStorage` -> navigator, default ns `common`). Imported first in `src/main.jsx`.
- Namespaces (registered in `config.js:23-36`, files in `public/locales/en/`): `auth, common, settings, chores, labels, history, filters, things, projects, timer, points, rewards`. A new namespace must be added to **both** `config.js` `ns` and a new `public/locales/en/<ns>.json`.
- Usage: `const { t } = useTranslation('chores')` at the top of the component, then `t('some.key')`; cross-namespace `t('common:cancel')`; plurals as `key_one`/`key_other` with `{ count }`. Dotted nested keys.
- **English is source of truth**: only edit `public/locales/en/*.json`. Other locales are synced by Crowdin (`crowdin.yml`); never hand-edit them (`scripts/i18n/i18n-pr-safety.mjs` rejects destructive locale PRs).
- Gate: `npm run lint:i18n` -> `scripts/i18n/i18n-audit.mjs` fails if any `t()`/`<Trans i18nKey>` key in `src/` is missing from `en` (resolves the namespace from the file's first `useTranslation('x')`, else `common`). Dynamic keys like ``t(`overview.groups.${group}`)`` are checked by prefix. `--orphans` lists unused keys. Other scripts: `audit:i18n:strings` (hardcoded-string audit), `check:i18n-pr`.
- Settings page titles come from `src/constants/settingsSections.js` ids + `settings` namespace `sections.<id>.title/description` *(key shape partly unverified)*.
- Dates/formats/language/RTL: `useLocalization()` from `src/contexts/LocalizationContext.jsx` (`formatDate`, `isRTL`, `RTL_LANGUAGES = ar, he, fa, ur`). `moment` locales are imported in `src/i18n/config.js:1-7`; add one there when adding a language that moment needs.
- Copy tone: plain second person, no cute or scolding text (PRODUCT.md).

## State and data patterns

- Server state = react-query. Mutations `invalidateQueries({ queryKey: ['chores'] })` (and `['pendingCommands']` for offline-capable ones) in `onSuccess`. Offline writes go through `commandQueue.enqueue(CommandType.X, id, payload)` (`src/utils/CommandQueue.js`); see `useCreateChore` (`ChoreQueries.jsx:162-232`).
- Per-viewer prefs: `localStorage`, via `useStickyState(default, key)` (`src/hooks/useStickyState.js`) or small util modules (`TaskEditorPreferences.js`, `DefaultViewConfig.js`).
- Analytics: `track('event_name', {...})` from `src/analytics`; events/schemas in `src/analytics/eventSchemas.js` (add the schema when adding an event) *(schema enforcement unverified)*.
- Plan gating: `isPlusAccount(userProfile)` + `src/utils/entitlements.js`.

## How to add...

**A route.** 1) Create `src/views/<Feature>/<Name>.jsx`. 2) Import and add `{ path: '/x', element: <Name /> }` to the `children` of the `App` route in `src/contexts/RouterContext.jsx` (~`:66-270`; settings subpages are nested under `/settings` and use relative `path:`). 3) Add navigation (`src/utils/BottomNavConfig.js`, `SidepanelConfig.js`) if it needs an entry point. 4) Add `useTranslation` strings.

**A query.** Add `export const useThing = id => useQuery({ queryKey: ['thing', id], queryFn: async () => { const r = await GetThing(id); if (!r.ok) throw new Error('...'); return r.json() }, enabled: !!id })` in the matching `src/queries/*Queries.jsx`. Check whether the Fetcher function returns Response or parsed JSON ([domain-model.md](domain-model.md#fetcher-return-conventions)). Reuse an existing key family so existing `invalidateQueries` calls hit it.

**A mutation.** `useMutation({ mutationFn, onSuccess })` with `useQueryClient()`; throw on `!resp.ok` (or use an `ActionFetch`-based function which throws for you); invalidate affected keys. If it must work offline, follow `useCreateChore`/`useUpdateChore` (enqueue in `CommandQueue`, optimistic `setQueryData`, add a `CommandType`, handle in `SyncEngine.js`) *(handler wiring unverified; read `SyncEngine.js`)*.

**An API call in Fetcher.** In `src/utils/Fetcher.jsx` add `const DoThing = (id, body) => ActionFetch(\`/things/${id}/do\`, { method: 'POST', headers: HEADERS(), body: JSON.stringify(body) })` (use `Fetch` for reads, `ActionFetch` for mutations). **Then add the name to the alphabetical `export { ... }` block at the bottom (~`:1232`)**, otherwise it is not importable. Paths are relative to the API base; `Fetch` supports GET/POST/PUT/DELETE.

**A translation key.** Add the key to `public/locales/en/<ns>.json` (nested objects; `_one/_other` for plurals), use `t('key')` with the namespace named in `useTranslation('<ns>')`, run `npm run lint:i18n`. Do not touch other languages.

**A setting.** Per-user server settings: add a field through `UpdateUserDetails`/profile or the notification-preferences endpoints. A new settings *page*: create `src/views/Settings/XSettings.jsx` (wrap in `SettingsSection`), add `{ path, element }` under `/settings` in `RouterContext.jsx`, add an entry to `SETTINGS_SECTIONS` in `src/constants/settingsSections.js` (`id, icon, group` or `parent`, flags `parentOnly/nativeOnly/selfHostedOnly/isBeta`), and `settings` strings `sections.<id>`. Device-local toggles: `useStickyState` or a tiny util like `TaskEditorPreferences.js`.

**A modal.** `<AppModal open onClose title footer={<ModalActions .../>}>`; pick `size`/`mobilePresentation`; keep open state in the parent; destructive -> alertdialog options above; all strings via `t()`.

## PRODUCT.md rules that affect code (read `PRODUCT.md` for the full text)

- Mobile first (web + Capacitor): honour safe-area insets (`src/utils/SafeAreaUtils.js`, `AppModal` does it); **touch targets >= 44px** on phones (set in the Joy theme overrides, `ThemeContext.jsx:139-177`).
- **Reduced motion**: every animation needs a `@media (prefers-reduced-motion: reduce)` branch that nulls both `transition` and `transform` (pattern at `ThemeContext.jsx:154`, `AppModal.jsx:134`, `useAnimations.js:8`).
- **RTL**: use logical properties (`insetInlineStart`, `ms`/`me`, `ps`/`pe`), not `left/right`; the emotion RTL plugin mirrors the rest.
- **Status-only colour**: saturation only for overdue, pending approval, running timer; everything else ink/neutral. Status is never hue alone (add icon or word); contrast WCAG AA.
- A section with nothing to say does not render (no "N/A" rows); primary action always reachable; options hidden until asked; offline shows as "will sync" inline; no dashboards/stat tiles/gamification.

Last verified: 2026-11-12 at commit 99e6a9f
