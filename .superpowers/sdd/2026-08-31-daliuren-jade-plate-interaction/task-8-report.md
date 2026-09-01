# Task 8 checkpoint report

Date: 2026-09-01

Base: `396a1a451d2e786485ee484552fff389aef61681`

Status: **REJECTED — Task 8 is not complete.** The reference-overlay visual gate failed. The final verification matrix was therefore stopped and must be run once, from the beginning, only after the Blender geometry/material/export work is reopened and corrected.

## RED and focused verification

- Descriptor/directory RED: the new `plate/generals` descriptor, the `月将环` wording, and descriptor-derived totals initially failed their focused unit expectations.
- Focused unit GREEN: `npm test -- src/features/artifact-scene/annotations/descriptors.test.ts src/features/artifact-scene/ArtifactPartDirectory.test.tsx` passed 8/8.
- Focused component GREEN: `npm test -- src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/annotations/descriptors.test.ts src/features/artifact-scene/ArtifactPartDirectory.test.tsx` passed 47/47.
- Focused build RED exposed the TypeScript 5.9 `Object.fromEntries` cast in `jade-plate-layout.ts`; the minimal `unknown` bridge fixed it and the focused build then passed.
- The approved focused selector `--project=chromium` is invalid in this repository: Playwright reports `Project(s) "chromium" not found. Available projects: ""`. Per the Task 8 ruling, the existing default project was used; no redundant named project was added.
- Initial focused E2E RED: the new interaction cases failed on the absent benchmark attributes, while the existing GLB failure, WebGL context-loss, reduced-motion, and stable-canvas cases remained available.
- Focused E2E GREEN covered all twelve exact detents, reverse exit, forward and reverse general placement, noble-first landing, third-piece interruption, pointer-down without movement with real pointer capture, wheel, keyboard, real CDP touch drag, mobile controls, reduced motion, clean application console collection, and identical completed-rule state across LOD 0/1/2.
- Evidence capture GREEN: `npx playwright test e2e/artifact-experience.spec.ts --grep "captures completed desktop and mobile review evidence"` passed 1/1 in 29.7 s after switching to raw canvas pixels.
- The first attempted `npm test` after evidence generation failed on three stale `ArtifactAnnotationLayer` assertions that still hard-coded 22 descriptors and the old `天盘` wording. No later matrix command was run. The directly affected focused repair passed: `npm test -- src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx` passed 9/9 in 1.54 s.

## Verification matrix

The sole final matrix has **not** been executed. An attempted start was stopped after its first command because the visual gate is a hard failure.

| Command | Result |
| --- | --- |
| `npm test` | Attempted, exit 1: 3 stale `ArtifactAnnotationLayer` assertions; directly related focused file is now green. This does not count as a passing final-matrix run. |
| `npm run build` | Not run as final matrix. |
| `npm run asset:validate` | Not run as final matrix. |
| Blender `test_contract.py` | Not run as final matrix. |
| Blender `test_component_contract.py` | Not run as final matrix. |
| Blender `test_high_detail_geometry.py` | Not run as final matrix. |
| Blender `test_materials.py` | Not run as final matrix. |
| Blender `test_uv_and_bake.py` | Not run as final matrix. |
| Blender `test_lods.py` | Not run as final matrix. |
| `npx playwright test` | Not run as final matrix. |

The interrupted first-command output was captured at `.superpowers/sdd/2026-08-31-daliuren-jade-plate-interaction/task-8-logs/01-npm-test.log` locally. The ignored log is not part of the checkpoint commit.

## Evidence and overlay review

- Desktop raw canvas: `docs/asset-reviews/lookdev/overall.png` at the 1280x720 page viewport.
- Square raw canvas crop: `docs/asset-reviews/lookdev/jade-plate-default.png` (520x520).
- Mobile raw canvas: `docs/asset-reviews/lookdev/jade-plate-mobile.png` at the 390x844 page viewport.
- Reference overlay: `docs/asset-reviews/lookdev/jade-plate-overlay.png` (1286x1223), generated with the exact required 50% Pillow blend command.

Visual decision: **REJECT**.

- Square-plate outline/scale/orientation: the runtime plate is substantially smaller in frame and more oblique than v10.
- Zodiac order: the v10 zodiac relief band is absent or obscured; oversized outer earthly-branch/tile geometry occupies that visual role.
- Pearls: the reference corner-pearl placement does not align with the runtime geometry.
- Earthly branches and month generals: the runtime glyph radii and projected positions do not register with the reference rings.
- General sectors: the runtime inner sectors and outer elevated pieces do not match the reference's seated annular layout.
- Center Beidou: present and fixed, but materially smaller and less legible than the reference.
- Round-plate scale and default orientation: both show obvious overlay ghosting and fail the approved visual threshold.

These are inherited Blender geometry/lookdev/export mismatches, not a Task 8 UI integration defect. Completing Task 8 requires reopening that upstream asset work, regenerating all evidence, accepting the overlay, and only then running the full matrix once.

## Scoped interface and integration changes

- Added `plate/generals` to `ArtifactAnnotationId`, descriptor ownership, and directory mapping as `十二神将承位`; displayed totals derive from descriptor length. Existing review-stage callouts remain unchanged.
- Exposed the required benchmark-only physical state attributes, publishing actual motion progress rather than inferred final state.
- Added state-driven E2E coverage without sleeps or relaxed detent/timing tolerances.
- Removed the short-height absolute timeline rule that overlapped the month-general controls; the E2E hit-test demonstrated the integration defect.

## Cleanup

Resolved and verified all three targets as direct children of `E:\design daliuren\.worktrees\jade-plate-interaction\public\models\daliuren`, then removed only:

- `.daliuren-ktx2-4mGSND`
- `.daliuren-ktx2-9Tf2Uw`
- `.daliuren-ktx2-lqHqdY`

Post-cleanup `Test-Path` returned `False` for all three. `assets/daliuren/source/daliuren-artifact-master.blend1` and `tools/node/` were not touched or staged.

## Commit

Scoped checkpoint commit message: `test: verify jade plate physical interaction`. The containing commit preserves the Task 8 code, tests, generated evidence, and this hard-failure report; it must not be represented as Task 8 completion.
