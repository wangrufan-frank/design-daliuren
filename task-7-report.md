# Task 7 report: seamless jade-plate handoff

## Delivered

- Added `MonthGeneralControls` with two 44 px accessible one-detent buttons. They remain disabled during the automated demonstration and require no mode switch to use after it completes.
- Made `ArtifactExperience` the single owner of the month-general interaction reducer. It supplies controller drag, wheel, keyboard, and button events with the current physical progress snapshot, and applies the same interactive motion after handoff.
- The final demo frame sends `demo-complete` exactly once. Source replacement, stage replay, and seeks before the final frame replace interaction state with `locked` and disable controller input.
- Added non-production/benchmark observability for detent, alignment, sequence, seated general IDs/count, and month-gold progress. The hidden interaction status includes month general, detent, alignment, and seated count with live announcements disabled.

## Verification

- RED: `npm test -- src/features/artifact-scene/MonthGeneralControls.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx` initially failed because the controls and handoff owner did not exist.
- RED: the locked-input regression initially failed because a locked controller callback applied interactive jade motion.
- GREEN: `npm test -- src/features/artifact-scene/MonthGeneralControls.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/timeline src/features/artifact-scene/model`
  - 10 test files passed; 72 tests passed.

No asset, E2E, full-suite, or build commands were run for this task.
