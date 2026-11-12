---
description: Refresh docs/ai/*.md and CLAUDE.md against code changes since they were last verified
---

Update the codebase map so it matches the code. Documentation only: do not modify source, configs or dependencies.

## Steps

1. Find the baseline. Read the `Last verified: <date> at commit <sha>` line at the end of each `docs/ai/*.md`. Use the oldest sha as the baseline. If a sha is unreachable (`git cat-file -t <sha>`), fall back to a full re-verification of that file.
2. Get the change set: `git diff --stat <sha>..HEAD` and `git log --oneline <sha>..HEAD`. If empty, say so, bump nothing, and stop.
3. Map changed paths to docs:
   - `src/main.jsx`, `App.jsx`, `contexts/`, `queries/`, `utils/{ApiClient,Fetcher,OfflineDB,SyncEngine,CommandQueue,TokenStorage}*`, `hooks/useSSE*`, `CapacitorListener.js`, `vite.config.mjs`, `capacitor.config.ts` → `architecture.md`
   - added, removed or renamed files/directories, or files crossing 800 lines → `directory-map.md`
   - API shapes in `Fetcher.jsx`, `queries/`, `utils/Chores.jsx` → `domain-model.md`
   - theme, modal, i18n, lint or styling patterns, new "how to add" steps → `conventions.md`
   - `package.json` scripts, `.github/`, `.husky/`, `tests/`, `e2e/`, `eslint.config.mjs` → `testing-and-ci.md`
   - fix-type commits, patches, native or build quirks → `gotchas.md`
   - progress on JS→TS, tests, design tokens → `status-and-roadmap.md` (move items from Pending to Done)
   - commands or top rules changed → `CLAUDE.md`
4. For each affected doc, re-read the relevant code, then edit only the stale parts. Verify every claim; re-run counts (`wc -l`, `grep -c`, `find`) instead of estimating. Keep file limits (docs under ~250 lines, `CLAUDE.md` under ~120). Mark unverifiable items "unverified". No secrets or `.env` values.
5. Run a path check: every backticked repo path in `docs/ai/*.md` and `CLAUDE.md` must exist. Fix or remove broken ones.
6. Only for docs you actually re-verified, update the final line to `Last verified: <today> at commit <HEAD short sha>`. Leave untouched docs' lines alone.
7. Report: docs changed, docs checked and unchanged, anything unverified, and the diff range used. Do not commit unless asked.

Extra instructions from the user (optional): $ARGUMENTS
