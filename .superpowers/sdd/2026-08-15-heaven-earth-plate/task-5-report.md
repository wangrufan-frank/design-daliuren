# Task 5 Report: 浏览器验收与全量交付验证

## Files

- Modified `e2e/app-shell.spec.ts`.
- Added `e2e/heaven-earth.spec.ts`.
- Added this required report.
- No production source file changed; Playwright exposed stale E2E navigation assumptions, not a production defect.

## Implementation

- The existing calendar helper now first verifies the real heaven-earth plate and returns through the completed `历法与月将` rail button before making calendar assertions.
- Existing calendar correction/reset flows return through the completed-stage rail after each successful rebuild and reselect the day cell after the calendar review remounts.
- `expectNoUnimplementedResult` now permits the delivered heaven-earth stage while continuing to reject four lessons, three transmissions, heavenly generals, copied course output, canvas/3D placeholders, and approval controls.
- The dedicated heaven-earth suite exercises the real application in Chromium at `1440x900` and `390x844`.
- Both viewport cases calculate while the browser context is offline, inspect every palace's filtered evidence, verify arrow-key wraparound, assert explicit month-general/divination-hour text, correct the month general through the completed calendar stage, and verify the rebuilt plate is selected automatically.
- The mobile case verifies all 12 fallback records are visible grid items with exactly two ordered, vertically stacked text lines, closes evidence, verifies focus restoration, and checks horizontal overflow.
- The rail case verifies both completed-stage buttons have transparent/reset native styling, inherited typography, content-box width, and visible non-color hover/focus treatments (underline plus keyboard outline).

## RED / GREEN evidence

### Existing E2E flow RED

Command:

```text
npm run test:e2e
```

Result: exit 1; 4 passed and 4 failed. Both desktop and mobile calendar/keyboard flows timed out waiting for `历法结果矩阵` immediately after submit because the completed application correctly opened `天地盘十二宫` first.

### Stage-return RED

Command:

```text
npm run test:e2e -- e2e/app-shell.spec.ts
```

Result after the first navigation update: exit 1; 4 passed and 4 failed. Successful day correction rebuilt the stages and returned to heaven-earth, so the old test attempted to inspect an unmounted calendar matrix.

After adding the completed-stage return, the same command still failed 4 cases because the remounted calendar review intentionally resets its active evidence cell; the reset control did not appear until the test reselected day pillar. The smallest test-only correction was to reselect the already visible manual day cell. No production change was made.

### Existing E2E flow GREEN

Command:

```text
npm run test:e2e -- e2e/app-shell.spec.ts
```

Result: exit 0; 8 passed.

### Dedicated heaven-earth GREEN

Command:

```text
npm run test:e2e -- e2e/heaven-earth.spec.ts
```

Initial result: exit 0; 4 passed. A later strengthening of the rail reset check first produced a test-harness RED (3 passed, 1 failed) because `width: 100%` had incorrectly been compared with the parent's padded border box. Comparing the button with the parent's CSS content box corrected the assertion.

Final result: exit 0; 4 passed.

## Final verification

### Vitest

Command:

```text
npm test
```

Result: exit 0; 19 test files passed, 194 tests passed.

### Production build

Command:

```text
npm run build
```

Result: exit 0; TypeScript project build and Vite production build succeeded, 49 modules transformed.

### Complete Playwright suite

Command:

```text
npm run test:e2e
```

Result: exit 0; 12 tests passed using 2 workers.

### Diff hygiene

Command:

```text
git diff --check
git diff --cached --check
```

Result: both commands exited 0 with no whitespace errors. Git emitted only the repository's existing LF-to-CRLF working-copy warning for `e2e/app-shell.spec.ts`.

## Real viewport and visual checks

- Desktop viewport: `1440x900`; 12 interactive palaces visible, every palace evidence conclusion checked, no horizontal overflow, completed-stage buttons checked at rest/hover/keyboard focus.
- Mobile viewport: `390x844`; 12 interactive palaces visible, every palace evidence conclusion checked, all 12 fallback records visible with two vertically stacked lines, close focus restored to the opening palace, no horizontal overflow.
- Month general and divination hour are communicated by visible labels (`神后（子）· 自动计算`, `未 · 自动计算`, `月将`, `占时`), not only by color.
- ArrowLeft wraps the first palace to the last; ArrowRight wraps back to the first; ArrowDown advances in perimeter order.
- Offline calculation generated no request after offline activation, no non-local HTTP/WebSocket URL, and no offline WebSocket frame.
- Calendar round trip changes month general from automatic `神后（子）` to manual `登明（亥）`, then automatically presents a new plate containing `天盘亥加临地盘未` with the heaven-earth rail button selected.
- No screenshot artifact was required; assertions inspect the rendered viewport geometry and Chromium computed styles directly.

## Self-review

- All new expectations exercise rendered browser behavior rather than source text or mocks.
- Palace expectations use a hand-checked literal earth/heaven mapping in traditional visual order, then require the corresponding filtered evidence conclusion; a wrong mapping, wrong palace selection, missing evidence filter, or stale conclusion fails the test.
- Offline listeners cover initial non-local traffic and all traffic after offline activation; local Vite bootstrap traffic is allowed only before offline activation.
- The mobile stacking check verifies each of 12 items independently rather than sampling one record.
- Rail reset checks are scoped to the completed-stage buttons and verify both buttons, while hover/focus checks include underline/outline so the affordance is not color-only.
- The final diff is limited to stage-navigation E2E maintenance, dedicated heaven-earth acceptance coverage, and this report. No production fix was justified.
- Delivery scope still excludes four lessons, three transmissions, heavenly generals, copied course output, 3D resources, animation, approval, and manual heaven-earth correction.

## Concerns

- No Task 5 correctness concern remains.
- Vite retains the existing non-blocking warning that the main JavaScript chunk exceeds 500 kB; code splitting is outside this task.
- Playwright/Vite logs retain the existing non-blocking `NO_COLOR`/`FORCE_COLOR` warning.
