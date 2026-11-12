# Directory Map

Where things live in `donetick-FE` (React 18 + Vite + Capacitor). Counts are from `find`/`wc -l` at the commit below; LOC counts js/jsx/json/css lines only.
See also: [architecture.md](architecture.md), [domain-model.md](domain-model.md), [conventions.md](conventions.md), [testing-and-ci.md](testing-and-ci.md), [gotchas.md](gotchas.md).

## Top-level

| Dir | Files | Purpose |
|---|---|---|
| `src/` | 411 | All app code (below). Entry: `src/main.jsx` -> `src/App.jsx` / `src/Application.jsx`; `src/MarketingApp.jsx` for the landing build; `src/CapacitorListener.js` native events; `src/Config.js` runtime config |
| `e2e/` | 13 | Playwright suite with its own `package.json`: `playwright.config.js`, `global-setup.js`, `run-e2e.sh`, `fixtures/`, `tests/*.spec.js` (auth, chores, chore-edit, add-task-modal, projects-filters) |
| `tests/` | 19 | Node-run unit tests (`*.test.mjs`): board ordering/collision, theme helpers, clipboard, project board offline/card |
| `scripts/` | 9 | `release.sh`, `pull-secrets.sh`/`push-secrets.sh`, `scripts/i18n/*.mjs` (audit, find-missing, verify, apply-translations, pr-safety) |
| `android/` | 149 | Capacitor Android Gradle project |
| `ios/` | 35 | Capacitor iOS project (`App/`, `Podfile`; `Pods/` is vendored) |
| `patches/` | 1 | patch-package patch for `@capacitor-community/speech-recognition` 7.0.1 |
| `public/` | 196 | Static files: icons, `_headers`, `_redirects`, `public/locales/<lang>/*.json` (18 language dirs; namespaces auth, chores, common, filters, history, labels, points, projects, rewards, settings, things, timer) |
| `assets/` | 3 | README/marketing images only (not imported by app) |
| `fastlane/` | 3 | `Appfile`, `Fastfile`, README for mobile store delivery |
| `.github/` | 5 | `workflows/` (build, i18n-safety, cleanup-crowdin-branch), `ui-proposal/` (editor GIFs) |
| `.impeccable/` | 1 | `critique/` dated design-critique notes (markdown) |
| `docs/ai/` | - | These AI-oriented docs |

## `src/` subdirectories

| Dir | Files / LOC | Purpose and key files |
|---|---|---|
| `src/analytics/` | 5 / 612 | PostHog wrapper: `index.js` (track API), `eventSchemas.js`, `consent.js`, `posthogClient.js`, `useAnalyticsIdentity.js` |
| `src/assets/` | 5 / 0 | Images/SVG imported by components |
| `src/components/` | 37 / 5607 | App-wide shared widgets: `GlobalQuickAdd.jsx`, `NotificationTemplate.jsx`, `SSEConnectionStatus.jsx`, `SSESettings.jsx`, `RealTimeSettings.jsx`, `SubscriptionModal.jsx`, `StartupScreen.jsx`, `TimezonePrompt.jsx`, `UserProfileAvatar.jsx`. Subfolders: `animations/` (PageTransition, SkeletonLoader, StaggeredList), `common/` (AppModal, FilterBar, EmptyState, SortAndFilterMenu, Swipe* components, DurationInput; has its own README), `icons/` (Discord, Reddit) |
| `src/constants/` | 5 / 288 | `settingsSections.js` (settings nav), `theme.js`, `themePresets.js`, `startupTheme.js`, `policyUpdates.js` |
| `src/contexts/` | 12 / 1528 | React contexts: `RouterContext.jsx` (route table), `ThemeContext.jsx`, `ThemeSkinContext.js`, `PaywallContext.jsx`, `LocalizationContext.jsx`, `SSEContext.jsx`, `QueryContext.jsx` (React Query client), `ImpersonateUserContext.jsx` (child/sub-account), `NavBarTitleContext.jsx`, `KeyboardShortcutScopeContext.jsx`, `QuickAddModalContext.js`, `Contexts.jsx` |
| `src/hooks/` | 24 / 2358 | `useSSE.js` (real-time stream), `useAuth.jsx`, `useSyncOnReconnect.js`, `NetworkManager.jsx`, `useTimer.js`, `useFilter.js`, `useFileUpload.js`, `useLongPress.js`, `useLocalNotificationSync.js`, `useAppBadgeSync.js`, `useOnboardingGate.js`, `usePendingCommands.js`, `useDocumentScanner.js`, `useStatusBar.js`, `useChorePermissions.js` |
| `src/i18n/` | 2 / 57 | `config.js` (i18next setup, loads `public/locales`), `README.md` |
| `src/manifest/` | 11 / 0 | Web manifest + favicons |
| `src/queries/` | 7 / 1266 | React Query hooks: `ChoreQueries.jsx` (biggest), `UserQueries.jsx`, `TimeQueries.jsx`, `SubtaskQueries.jsx`, `ThingQueries.jsx`, `ResourceQueries.jsx`, `OfflineHydration.js` (seed cache from IndexedDB) |
| `src/search/` | 4 / 1076 | Global search: `GlobalSearchPalette.jsx`, `GlobalSearchContext.jsx`, `GlobalSearchPage.jsx`, `searchProviders.js` |
| `src/service/` | 12 / 2796 | Side-effect services: `NotificationProvider.jsx`, `AlertsProvider.jsx`, `FeedbackService.js`, `ErrorReportService.js`, `DiagnosticsSession.js`, `VoiceInputService.js`, `LocalAIService.js`, `AIPromptCache.js`, `WidgetService.js`, `NFCWriter.jsx`, `ShareTargetService.js`, `PolicyUpdateService.js` |
| `src/styles/` | 1 / 131 | `safe-area.css` (global CSS also in `src/index.css`) |
| `src/utils/` | 52 / 8048 | Non-UI logic. HTTP/auth: `Fetcher.jsx`, `ApiClient.js`, `TokenStorage.js`. Offline: `OfflineDB.js`, `SyncEngine.js`, `CommandQueue.js`, `PendingChores.js`, `OfflineFeatureToggle.js`. Chores: `Chores.jsx`, `FilterEngine.js`, `ChoreAccess.js`, `ChoreCardHelpers.jsx`, `CustomDueDate.js`. Platform: `PlatformUtils.js`, `DeviceInfo.js`, `StatusBarManager.js`, `Haptics.js`, `SafeAreaUtils.js`. Paywall: `entitlements.js`, `NativePaywall.js`. Config-lists: `BottomNavConfig.js`, `SidepanelConfig.js`, `HomeSectionsConfig.js`, `DefaultViewConfig.js`. Misc: `Onboarding.js`, `themePalette.js`, `timezone.js`, `BoardOrdering.js`, `ImageCache.js` |
| `src/views/` | 246 / 78010 | Screens and feature UI, subfolders below |

## `src/views/*`

| Dir | Files / LOC | Purpose and key files |
|---|---|---|
| `Authorization/` | 11 / 2366 | Login/signup/MFA/reset: `LoginView.jsx`, `Signup.jsx`, `MFAVerificationModal.jsx`, `ForgotPasswordView.jsx`, `UpdatePasswordView.jsx`, `Authenticating.jsx` (OAuth return), `LoginSettings.jsx` (server URL) |
| `ChoreEdit/` | 10 / 6670 | Task editor + detail: `ChoreEdit.jsx` (3072 lines), `ChoreView.jsx`, `RepeatSection.jsx`, `ThingTriggerSection.jsx`, `CompletionActionsSection.jsx`, `TimePassedCard.jsx`, `TimerSplitButton.jsx`, `Wizard*.jsx` |
| `Chores/` | 36 / 13758 | Main task list. `MyChores.jsx` (page), `ChoreCard.jsx`, `CompactChoreCard.jsx`, `ChoreListView.jsx`, `ArchivedTasks.jsx`, `SortAndGrouping.jsx`, `SmartInsightsCard.jsx`, `Sidepanel.jsx`, `UserSwitcher.jsx`, `LocalNotificationScheduler.js` |
| `Chores/components/` | 12 / 3851 | `MultiSelectToolbar.jsx`, `ChoreToolbarPrototype.jsx`, `FilterBuilderContent.jsx`, `CustomFilterChips.jsx`, `ChoreSwipe*.jsx`, `ChoreModals.jsx`, `SearchBar.jsx` |
| `Chores/hooks/` | 8 / 2363 | `useChoreActions.js` (complete/skip/delete/etc.), `useChoreFilters.js`, `useCustomFilters.js`, `useMultiSelect.js`, `useKeyboardShortcuts.js`, `useChoreViewMode.js`, `useProjectFilter.js`, `useChoreModals.js` |
| `Circles/` | 1 / 259 | `JoinCircle.jsx` (invite link). Circle admin UI is in `Settings/CircleSettings.jsx` |
| `Filters/` | 2 / 1004 | Saved filters: `FilterView.jsx`, `FilterQueries.js` |
| `History/` | 3 / 1193 | `ChoreHistory.jsx`, `HistoryCard.jsx`, `BigChip.jsx` |
| `Home/` | 9 / 1744 | Dashboard: `HomeView.jsx`, `useHomeSummary.js`, `DefaultViewRoute.jsx`, `components/` (6 files) |
| `Labels/` | 4 / 950 | `LabelView.jsx`, `LabelDetailView.jsx`, `LabelQueries.jsx` (`Labels.jsx` is empty) |
| `Landing/` | 14 / 2480 | Marketing page (`Landing.jsx`, `HomeHero.jsx`, `Demo*.jsx`, `PricingSection.jsx`, `Footer.jsx`) |
| `Modals/` | 30 / 6507 | Dialogs: `FeedbackModal`, `ErrorReportModal`, `RedeemPointsModal`, `HistoryDetailModal`, `PolicyUpdateModal`, etc. `Modals/Inputs/` (24 / 4886): `ProjectModal`, `RewardModal`, `LabelModal`, `TimerEditModal`, `BackupRestoreModal`, `NudgeModal`, `CreateThingModal`, `WriteNFCModal`, `UserDeletionModal`, `AdvancedFilterBuilder`, `IconPickerModal`, attachment modals |
| `Onboarding/` | 6 / 3104 | `OnboardingView.jsx`, `OnboardingVignettes.jsx`, `CircleSetupView.jsx`, `HeardAboutView.jsx`, `GetStartedView.jsx`, `WorkspaceReadyView.jsx` |
| `Payments/` | 2 / 108 | `PaymentSuccessView.jsx`, `PaymentFailView.jsx` |
| `PrivacyPolicy/`, `Terms/` | 1 / 147, 1 / 244 | Static legal pages |
| `Projects/` | 13 / 3841 | `ProjectView.jsx`, `ProjectQueries.js`, `ProjectAccessReview.jsx`, `ProjectVisibilityField.jsx`; `projectLayout/` (9 / 2118): `ProjectBoard.jsx` (kanban), `ProjectBoardCard.jsx`, `ProjectTaskRow.jsx`, `board*.js` helpers |
| `Rewards/` | 2 / 632 | `RewardsView.jsx`, `RewardQueries.jsx` |
| `Settings/` | 36 / 9994 | `Settings.jsx`, `SettingsLayout.jsx`, one file per section (Profile, Account, Circle, Notification, Theme, Layout, Calendar, Bridge, MFA, APIToken, Webhook, Storage, Localization, Widget, Developer, Advanced, PrivacyAnalytics...), `useVisibleSettings.js`. `Sharing.jsx`/`SharingSettings.jsx` are empty |
| `TestView/` | 3 / 628 | Dev playground |
| `Things/` | 2 / 1244 | IoT-style "things" that trigger chores: `ThingsView.jsx`, `ThingsHistory.jsx` |
| `Timer/` | 1 / 1453 | `TimerDetails.jsx` |
| `User/` | 2 / 2285 | `UserActivities.jsx`, `UserPoints.jsx` |
| `components/` | 55 / 16687 | Feature-level shared UI: `AddTaskModal.jsx`, `ChoreActionMenu.jsx`, `NavBar.jsx`, `MobileBottomNav.jsx`, `SubTask.jsx`, `CustomParsers.js` (NL date/task parsing), `CalendarCard/Dual/Monthly`, pickers (`*PickerField.jsx`, `RepeatPickerField`, `DueDatePickerModal`, `ProjectSelector`), `NetworkBanner`, `PendingBadge`, `NotFound`. `VoiceToTask/` (7 / 1718: `VoicePanel`, `useVoiceToTask`, `parseVoiceTask`, `voiceNormalizer`), `ScanToTask/` (2 / 705) |

## Files over 800 lines (`wc -l`)

| Lines | File | Owns |
|---|---|---|
| 3072 | `src/views/ChoreEdit/ChoreEdit.jsx` | Full create/edit task form (wizard, assignees, repeat, notifications, things, subtasks) |
| 2243 | `src/views/components/AddTaskModal.jsx` | Quick-add modal with NL parsing, voice/scan entry |
| 1845 | `src/views/Chores/MyChores.jsx` | Main list page: data, filter/sort/group, multiselect wiring |
| 1687 | `src/views/ChoreEdit/ChoreView.jsx` | Task detail page, completion, timer, history |
| 1628 | `src/views/Onboarding/OnboardingVignettes.jsx` | Animated onboarding scenes |
| 1456 | `src/views/User/UserActivities.jsx` | User activity/stats page |
| 1453 | `src/views/Timer/TimerDetails.jsx` | Timer session detail |
| 1367 | `src/utils/Fetcher.jsx` | All REST calls + token refresh/auth fetch wrapper |
| 1362 | `src/views/Chores/hooks/useChoreActions.js` | Complete/skip/delete/archive/nudge action handlers |
| 1269 | `src/views/Settings/DeveloperSettings.jsx` | Dev/debug settings |
| 1261 | `src/views/Chores/components/MultiSelectToolbar.jsx` | Bulk-action toolbar |
| 1179 | `src/views/Chores/ArchivedTasks.jsx` | Archived list |
| 1164 | `src/utils/OfflineDB.js` | IndexedDB cache/storage layer |
| 1113 | `src/views/Projects/projectLayout/ProjectBoard.jsx` | Kanban board + drag/drop |
| 1079 | `src/views/Chores/components/ChoreToolbarPrototype.jsx` | Toolbar prototype |
| 1069 | `src/views/components/ChoreActionMenu.jsx` | Per-task context menu |
| 1065 | `src/views/components/SubTask.jsx` | Subtask UI |
| 981 | `src/views/Settings/Settings.jsx` | Settings host/overview |
| 971 | `src/views/Modals/Inputs/TimerEditModal.jsx` | Timer edit dialog |
| 892 | `src/views/History/ChoreHistory.jsx` | History page |
| 875 / 871 / 860 | `NotificationSetting.jsx` / `CircleSettings.jsx` / `BridgeSettings.jsx` (in `src/views/Settings/`) | Respective settings pages |
| 829 / 829 | `src/views/components/CustomParsers.js` / `src/views/User/UserPoints.jsx` | Date/NL parsers / points page |
| 827 | `src/hooks/useSSE.js` | Server-sent events connection, reconnect, cache invalidation |

## Where do I find X

| Topic | Look in |
|---|---|
| Chore completion | `src/views/Chores/hooks/useChoreActions.js`, `src/views/ChoreEdit/ChoreView.jsx`, `src/queries/ChoreQueries.jsx`, API in `src/utils/Fetcher.jsx` |
| Offline completion / queue | `src/utils/CommandQueue.js`, `SyncEngine.js`, `OfflineDB.js`, `src/hooks/useSyncOnReconnect.js` |
| Filters | `src/utils/FilterEngine.js`, `src/views/Chores/hooks/useChoreFilters.js`, `useCustomFilters.js`, `src/views/Filters/`, `src/views/Chores/components/FilterBuilderContent.jsx` |
| Notifications | `src/service/NotificationProvider.jsx`, `src/views/Chores/LocalNotificationScheduler.js`, `src/hooks/useLocalNotificationSync.js`, `src/views/Settings/NotificationSetting.jsx` |
| Timers | `src/hooks/useTimer.js`, `src/views/Timer/`, `src/views/ChoreEdit/TimerSplitButton.jsx`, `src/queries/TimeQueries.jsx` |
| Rewards / points | `src/views/Rewards/`, `src/views/User/UserPoints.jsx`, `src/views/Modals/RedeemPointsModal.jsx` |
| Labels | `src/views/Labels/`, `src/views/Modals/Inputs/LabelModal.jsx`, `src/views/components/LabelsPickerField.jsx` |
| Circles | `src/views/Settings/CircleSettings.jsx`, `src/views/Circles/JoinCircle.jsx`, `src/views/Onboarding/CircleSetupView.jsx` |
| Projects / board | `src/views/Projects/` (board in `projectLayout/`), `src/utils/BoardOrdering.js`, `ProjectAccess.js` |
| Settings | `src/views/Settings/`, nav list `src/constants/settingsSections.js`, routes in `src/contexts/RouterContext.jsx` |
| Onboarding | `src/views/Onboarding/`, `src/hooks/useOnboardingGate.js`, `src/utils/Onboarding.js` |
| Paywall / subscriptions | `src/contexts/PaywallContext.jsx`, `src/utils/entitlements.js`, `NativePaywall.js`, `src/components/SubscriptionModal.jsx`, `src/views/Payments/` |
| i18n | `src/i18n/config.js`, `public/locales/<lang>/<ns>.json`, `src/contexts/LocalizationContext.jsx`, `scripts/i18n/` |
| Theme | `src/contexts/ThemeContext.jsx`, `ThemeSkinContext.js`, `src/constants/theme*.js`, `src/utils/themePalette.js`, `src/views/Settings/Theme*.jsx` |
| Routing | `src/contexts/RouterContext.jsx`, `src/App.jsx` |
| Auth / tokens | `src/hooks/useAuth.jsx`, `src/utils/TokenStorage.js`, `src/views/Authorization/` |
| Real-time updates | `src/hooks/useSSE.js`, `src/contexts/SSEContext.jsx` |
| Task creation (quick add, voice, scan) | `src/views/components/AddTaskModal.jsx`, `VoiceToTask/`, `ScanToTask/`, `src/components/GlobalQuickAdd.jsx` |
| Things / triggers | `src/views/Things/`, `src/views/ChoreEdit/ThingTriggerSection.jsx`, `src/queries/ThingQueries.jsx` |
| Global search | `src/search/` |
| Native / widgets / NFC | `src/CapacitorListener.js`, `src/service/WidgetService.js`, `NFCWriter.jsx`, `android/`, `ios/` |

Unverified: whether `src/views/TestView/` and `.impeccable/` are shipped/used in builds; `ChoreToolbarPrototype.jsx` purpose inferred from filename.

Last verified: 2026-11-12 at commit 99e6a9f
