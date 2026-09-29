# Restore a consistent interface across routes

## Objective and authorization

Review the complete interface and correct evidenced visual inconsistencies while
preserving the existing financial-dashboard design and all application behavior.
The user authorized implementation, commits and push to `main`. Preserve unrelated
`.atl` edits and `odd/tasks/pcloud-cli-env.md`; never read real `.env` or backups.

## Findings and design

- Chromium's built CSS registers `components, layout, reset, tokens, base`, so
  base/reset override component borders and typography. Import global CSS before
  component imports and explicitly order `reset, tokens, base, layout, components`.
  A temporary isolated probe proved the fix across all nine primary routes.
- Use existing bounded `--radius-md` shells for buttons, search, segmented groups
  and the period selector; `--radius-sm` for selected segment interiors. Wrapped
  groups must not let selected options intersect their rounded borders.
- Preserve circular icon-only controls, status chips and meaningful component
  size variants. Compound period fields need more height than simple buttons;
  coherence must not reintroduce clipping or force every element to look alike.
- Replace the drawer footer's obsolete cream constant with the shared surface.
  Existing page headings, cards, charts and navigation need no blanket redesign.
- No new dependencies, changes to financial logic, copy, data or deployment.

## Workflow and delivery

- Branch: `fix/ui-visual-consistency`; base: `dbe738cc54b1e8264d4c2e761bf7de0a6e8e081f`.
  Integrate by fast-forward and push to configured `origin/main` with the already
  authorized GitHub SSH transport. No force push or PR.
- Route: delegated direct for both tasks. Mapping/preparation exceeded four files;
  each writer owns multiple non-trivial source/test files. Parent owns this record.
- TDD: on, user's explicit session choice. Observe RED before each production fix.
  Browser runner: `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR=/tmp/saracastello-browser-libs.hDbDUm/root/usr/lib/x86_64-linux-gnu pnpm test:browser`.
  Focus using `--grep 'cascade'` for T1 and `--grep 'shared control geometry'` for T2.
- RDD: on (global). Assess each committed work unit against the last reviewed
  boundary; follow native consent/transitions only when due. Initial base above.
- Delivery strategy: `ask-on-risk`; forecast 250–360 authored lines including
  tests and this record, no generated deliverables. Running committed count: 0.
- Rollback: entry import/layer order and its regression (T1); shared-control CSS,
  drawer surface, matching regressions (T2). No application logic or private data.
- Engram mirror `odd/ui-visual-consistency/tasks` is pending: host registration
  unavailable and agent-attributed memory calls explicitly prohibited meanwhile.

## Tasks and acceptance

- [x] T1 — Restore component cascade precedence and protect it in the built app.
  - Delegated: `src/main.tsx`, `src/presentation/styles/global.css`, browser spec.
  - RED/GREEN: rendered button/input borders and intended typography survive base
    styles and route navigation. Preserve period geometry, dates and focus.
  - Checks: focused and full isolated Chromium suite, UI suite, type-check, lint,
    diff check; inspect representative final screenshots, not just the probe.
- [ ] T2 — Apply coherent shared geometry and drawer surfaces.
  - Delegated: Button, SearchField, SegmentedControl, FilterDrawer and GlobalFilters
    CSS plus browser regressions; retain the mobile icon-only filter exception.
  - RED/GREEN: matching bounded control radii, wrapped-segment containment at320,
    surface-token consistency, retained icon circles, focus and interactions.
  - Audit all nine routes, vault, drawer, comparison controls and budget dialog
    at1280/1024/390/320. Wait for vault animation and scroll lazy-rendered sections
    into view before visual inspection. No document overflow or date clipping.
  - Checks: focused/full isolated Chromium, UI, types, lint, diff; capture final
    screenshots and report unavailable browsers or states honestly.

## Evidence and progress

- Read-only mapping completed before source writes. All nine routes plus drawer,
  budget dialog and period comparison checked at four widths with synthetic data;
  baseline and cascade probe had no document overflow. Probe passed6/6 existing
  period tests. Current evidence: `/tmp/myexpenses-ui-audit/` and
  `/tmp/myexpenses-ui-probe/`; these are diagnostic artifacts, not final proof.
- Initial vault screenshots were mid-animation and lower Patterns sections need
  scrolling; final audit must close those gaps rather than claim full inspection.
- T1 RED: all3 Chromium projects failed the new cascade regression for inherited
  1rem typography and missing borders (`/tmp/myexpenses-ui-t1-red.log`). GREEN:
  cascade plus existing period regressions9/9 (`/tmp/myexpenses-ui-t1-green.log`).
- T1 full Chromium66 passed/3 intentional device-specific skips (3.7m), no failures
  (`/tmp/ui-consistency-t1-browser.log`). UI304/304 across81 files passed
  (`/tmp/ui-consistency-t1-ui.log`); type-check, lint and diff check passed.
- T1 actual-source screenshot capture3/3 passed; parent inspected desktop
  overview and320 drawer, confirming component styling while residual pill
  geometry remains for T2. `/tmp/myexpenses-ui-t1-final-artifacts/`.
- T1 implementation/test diff:55 authored lines. Commit and native assessment
  pending; T2 and final remote delivery remain pending.

## Next step

Commit/assess T1, then implement T2 and close the final visual audit before delivery.
