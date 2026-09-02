# Task 8 completion report

Date: 2026-09-02

Resume point: `3c4f79b` (after the rejected Task 8 checkpoint `11b59ab` and reviewed Task 4/5 corrections `7030f12`, `20db781`, `77c85b6`, and `3c4f79b`).

Status: **COMPLETE.** The corrected three-LOD package passes the visual gate, physical interaction semantics, failure-safety checks, and the complete verification matrix.

## Final asset and runtime correction

- Rebuilt the canonical master with direct `BoardUV` artwork on the outer board, removed only redundant zodiac/proxy and buried legacy-seat carriers from exported LODs, and retained every semantic node used by runtime interaction.
- Added export/import UV-preservation and highest-overlapping-carrier clearance regressions for earthly branches, month names, and general names. The canonical texture rebake, raw export, and atomic KTX2 compression were each performed once for the final three LODs.
- Final package validation reports identical `0.52 x 0.0632 x 0.52 m` bounds and zero errors: LOD0 `189,389` triangles, LOD1 `148,733`, LOD2 `72,622`.
- Runtime projection uses the calibrated v10 camera/lighting/framing and a landscape-only contain adjustment for the short desktop canvas. The 1280x720 workbench keeps the complete canvas, controls, evidence action, and six-stage rail inside the viewport without clipping the artifact.
- The default-project Playwright suite is serialized (`workers: 1`) because concurrent heavyweight WebGL pages demonstrably starved animation frames and skipped observable landing milestones. Exact interaction timing/detent assertions were not loosened.

## Visual gate

Calibration uses the whole authored object rather than the board alone. Final RMS measurements are: combined `31.16 px`; board corners `39.16 px`; circular dial/rim anchors `3.93 / 38.49 px`; pearls `19.22 px`; Beidou `3.72 px`; earthly-branch ring `41.32 px`; month ring `28.11 px`; general ring `29.95 px`.

Evidence:

- Completed desktop state at page viewport `1280x720`: `docs/asset-reviews/lookdev/overall.png`, canvas `672x488`.
- Completed mobile state at page viewport `390x844`: `docs/asset-reviews/lookdev/jade-plate-mobile.png`, canvas `344x506`.
- Authored/default design-comparison pose: `docs/asset-reviews/lookdev/jade-plate-default.png`, exact `1254x1254` canvas.
- Exact 50% Pillow reference blend: `docs/asset-reviews/lookdev/jade-plate-overlay.png`, native v10 size `1286x1223`.

Visual decision: **PASS.** The square outline, circular rim, branch/month/general rings, four pearls, Beidou, zodiac order, and overall framing have no obvious dominant mismatch in the exact overlay. The exported surface has no black/coplanar carrier artifacts.

The authored/default image is deliberately a deterministic design-fidelity pose at angle `0`: fixed black earthly-branch glyphs, cinnabar month names, pale-green seated general sectors with dark names, and `午/胜光` at the top. It is **not** the completed course state. Runtime completion preserves the rule convention: correct detent `6` is a `180°` month-ring rotation; the active month name is gold, all twelve general names are gold after landing, all twelve generals are seated, and leaving alignment reverses those states. Desktop/mobile evidence uses that real completed state. LOD0, LOD1, and LOD2 expose identical completed detent, alignment, sequence, seated IDs/count, active-month gold, and twelve-name gold state.

## Verification matrix

Only rows directly invalidated by a later correction were rerun. Early focused failures exposed stale material-contract expectations, shared Blender-scene pollution, base-prefixed GLB offline classification, pre-calibration touch/projection assumptions, short-desktop containment, and parallel WebGL starvation; each was fixed before the final passing row below.

| Command | Final result |
| --- | --- |
| `npm test` | PASS: 61 files, 673 tests, 42.83 s. The final camera-only invalidation was additionally verified by `ArtifactSceneController.test.ts`, 32/32. |
| `npm run build` | PASS: TypeScript + Vite, 118 modules, 2.29 s; only the standard chunk-size advisory. |
| `npm run asset:validate` | PASS: all three LODs, identical bounds, zero errors. |
| Blender `test_contract.py` | PASS: 3/3. |
| Blender `test_component_contract.py` | PASS: 13/13. |
| Blender `test_high_detail_geometry.py` | PASS: 9/9 in 23.933 s. |
| Blender `test_materials.py` | PASS: 12/12 in 29.775 s. |
| Blender `test_uv_and_bake.py` | PASS: 25/25. |
| Blender `test_lods.py` | PASS: 10/10 in 38.115 s. |
| `npx playwright test` (default project) | PASS: 52/52 in 11.4 min. |

The final browser run covers all twelve detents, forward/reverse general directions, noble-first landing and third-piece interruption, pointer/wheel/keyboard/CDP touch, reduced motion, completed desktop/mobile evidence, exact state equality across all three LODs, a byte-identical 30-second idle hold, GLB 404 fallback, WebGL context-loss fallback, offline flows, layout, and accessibility. No artifact-caused console warning/error or page error occurred; no Chromium GPU `ReadPixels` driver noise needed to be ignored in the final run.

## Cleanup and scope

After resolving and verifying both paths inside `E:\design daliuren\.worktrees\jade-plate-interaction`, removed only:

- `docs/asset-reviews/lookdev/task-4-v10-50-overlay.png`
- `docs/asset-reviews/lookdev/task-4-v10-calibrated-source.png`

Post-cleanup `Test-Path` returned `False` for both. `assets/daliuren/source/daliuren-artifact-master.blend1`, `tools/node/`, and the existing untracked compressor workspace were preserved and are not staged.

The final commit contains the scoped runtime/E2E/calibration fixes, deterministic Blender source/tests/generated contracts/textures/GLBs, accepted review evidence, and this report.
