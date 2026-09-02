# Task 6 — Three.js Physical Pose and Ring Gesture Bridge

## Delivered

- Added pure pointer-ray to fixed-plate-plane angle conversion.
- Added `applyJadePlateMotion`, interaction enablement, and normalized drag, wheel, and keyboard gesture callbacks to the scene controller.
- The controller now uses only fixed `branch/earth/*` glyphs, frozen `general-slot/<earth>` transforms, and separately cloned month/general-name text materials. It does not recolor void branches or replace translucent jade materials.
- The `interaction/month-general-ring` is configured from construction as raycast-only (`opacity=0`, `colorWrite=false`, `depthWrite=false`), captures only real annulus hits, and restores OrbitControls on release, cancellation, errors, disabling, context loss, and disposal.

## Evidence

- RED: `month-general-pointer.test.ts` initially failed because the new module was absent; controller RED exposed the old required `branch/heaven/*` runtime binding.
- GREEN: `npm test -- src/features/artifact-scene/three/month-general-pointer.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/three/load-artifact.test.ts` passed: 3 files, 36 tests.
- Diff check passed with no whitespace errors. Full suite, build, asset work, and E2E were intentionally not run per Task 6 scope.

## Self-review

- No reference-surface hiding remains; fixed seat and core reset to their frozen transforms for every jade-motion application.
- No prohibited `.blend1`, compressor temporary directories, or `tools/node/` content is staged.
- The canvas receives `tabIndex=0` only when it was not otherwise focusable, so keyboard gestures can reach the enabled bridge.

## Commit

- `feat: control month general ring in three scene`

## Concerns

- React ownership and reduction of emitted gesture events are deliberately deferred to Task 7; this task contains no React/state-machine integration.

## Review follow-up

- Pointer down, move, up, cancel, and wheel listeners now use shared capture-phase option objects; removal receives the identical option object used for registration.
- A confirmed annulus hit or enabled wheel/key gesture calls both `preventDefault()` and `stopImmediatePropagation()` before dispatching the normalized event. Disabled, non-ring, and unrelated-pointer events continue to other handlers.
- Focused regression coverage now proves bubble-phase OrbitControls listeners do not observe confirmed ring/wheel gestures; it also covers wraparound drag, cancellation, ArrowRight, first-frame annulus invisibility, callback/render recovery, disable/dispose while captured, and exactly-once capture release.
- Follow-up GREEN: `npm test -- src/features/artifact-scene/three/month-general-pointer.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/three/load-artifact.test.ts` passed: 3 files, 42 tests.

## P2 follow-up

- The wraparound regression now constructs true annulus-hit rays whose fixed-plate intersections straddle `+π` and `-π`. It asserts finite emitted start/move angles, a raw cross-boundary difference greater than `π`, and the expected small finite `signedAngleDelta` of `2 * atan(0.01 / 0.13)`.
- RED deliberately compared the raw angle subtraction to that small delta and failed, demonstrating why the prior existence-only assertion could not catch a wraparound regression. The corrected focused controller GREEN passed 32 tests.
