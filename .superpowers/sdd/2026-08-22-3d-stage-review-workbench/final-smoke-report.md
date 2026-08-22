# Final Smoke Report

Date: 2026-08-23

## Scope

- Updated legacy App and Playwright review paths for the closed-by-default `阶段证据抽屉` while preserving the existing detailed-content assertions.
- Updated CalendarReview geometry color baselines for the approved light theme.
- Preserved the completed workbench when a recalculation fails and surfaced the general failure as an alert.
- Darkened only `--old-gold` from `#a77d3d` to `#926e36`, the closest whole-RGB same-hue/saturation step found to reach WCAG 4.5:1 against the `#fcfbf7` panel (measured ratio `4.5010578`).
- Kept `artifact-experience` paths unchanged.

## RED evidence and root causes

- App suite initially failed 14 of 29 tests because detailed stage review content had moved into the closed evidence drawer.
- The six legacy E2E specifications initially failed 16 tests and passed 6 for the same navigation assumption.
- CalendarReview geometry initially failed both tests because the old dark-theme connector and interaction colors no longer matched the approved light theme.
- A direct CourseWorkbench regression test failed because a completed course retained its prior snapshot after a calendar-provider failure but did not render the general error alert.
- The existing contrast assertion exposed `#a77d3d` at only `3.593:1` against `#fcfbf7`.

## Changes

- App tests open the evidence drawer only when it is closed, so switching later stages reuses the open drawer.
- E2E tests explicitly open the drawer after stage selection. Course-sheet assertions are scoped to the workbench article when the same course also appears in the drawer, and mobile keyboard setup starts from the first control in the new DOM order.
- CalendarReview geometry expectations now use the actual light-theme values: connector/foot `rgb(169, 184, 177)`, active indicator `rgb(63, 118, 103)`, and manual border `rgb(146, 110, 54)`.
- CourseWorkbench accepts and displays a general stage error with `role="alert"` without replacing its existing content; App passes the completed-workbench error through.
- The keyboard E2E helper uses real Tab presses across every visible tabbable control, records the complete document order and visible outlines in-browser, and keeps the reset-count assertion scoped to the evidence drawer it describes.

## Verification

- Focused unit tests: 34 passed (`App`, `CourseWorkbench`, CalendarReview geometry).
- Six updated E2E specifications: 22 passed.
- Full unit suite: 52 files, 582 tests passed.
- Full Playwright suite: 28 tests passed, including all 6 `artifact-experience` tests.
- Production build: passed (`tsc -b && vite build`).
- `git diff --check`: passed.

The build retains the pre-existing Vite chunk-size warning; it produced no build error.
