# Task 8 visual-fidelity repair report

Date: 2026-09-02

Status: **FOCUSED BLOCKERS REPAIRED; FULL v10 FIDELITY NOT YET ACHIEVED.**
This report deliberately does not label the result PASS. The reference remains
`assets/daliuren/references/daliuren-heaven-plate-translucent-jade-generals-v10.png`.

## What changed

- Removed the retired whole-board `outer-board-artwork.png` runtime projection.
  `plate/earth` now stays a uniform jade material.
- Generated a dedicated `zodiac-relief-artwork.png` from v10 and built the
  twelve animals as sampled, height-varying relief meshes. Each LOD retains all
  twelve zodiac meshes and all twelve cloud-relief meshes; no LOD exclusion
  hides them.
- Rebalanced the square base, circular plate, four pearls, branch/month/general
  rings, core, Beidou center, and authored orientation against recorded v10
  anchors.
- Changed calibration anchors to the exact same cover-fit transform used by the
  Pillow overlay. Runtime camera position, target, horizontal FOV, and lens
  shifts are generated from that fit rather than the former permissive frame.
- Reframed portrait mode on an actual landscape/portrait transition, provided
  the customer has not taken manual camera control. Portrait distance is `0.82`
  of the calibrated review distance. The mobile evidence requires at least
  `8 CSS px` for the smallest earthly-branch projection while keeping the full
  square plate visible.
- Restored automatic multithreading for the pinned KTX2 encoder. Quality,
  ETC1S/UASTC assignment, mipmaps, and compression settings were not lowered.

No interaction state machine, detent mapping, landing order, or animation
timing was changed.

## Calibration and visual decision

Current cover-fit calibration metrics:

| Metric | RMS / error |
| --- | ---: |
| combined | `9.61 px` |
| board corners | `13.93 px` |
| dial center | `3.28 px` |
| pearls | `8.06 px` |
| Beidou | `3.00 px` |
| circular rim | `11.17 px` |
| earthly branches | `10.91 px` |
| month names | `6.07 px` |
| general names | `11.86 px` |

Evidence:

- `docs/asset-reviews/lookdev/overall.png`
- `docs/asset-reviews/lookdev/jade-plate-default.png`
- `docs/asset-reviews/lookdev/jade-plate-mobile.png`
- `docs/asset-reviews/lookdev/jade-plate-overlay.png`

The overlay no longer shows the former dominant grouped double image across
the square board and circular rings. Remaining objective differences are still
visible: the zodiac relief is a sampled/pixel-stepped reconstruction rather
than the reference's smooth sculpt, cloud carving is much simpler, several
Chinese glyph shapes and baselines differ locally, and the WebGL jade/gold
response lacks the reference render's subsurface depth and fine engraving.
Consequently this is not “全面一致” and is not recorded as a visual PASS.

## Rebuilt production assets

| Asset | Bytes | Result |
| --- | ---: | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `12,111,039` | rebuilt |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `24,537,848` | 65 nodes, 204,134 triangles, 0 validator errors |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `20,551,364` | 65 nodes, 163,971 triangles, 0 validator errors |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `9,954,804` | 65 nodes, 76,783 triangles, 0 validator errors |

All three LODs report identical `0.52 x 0.0632 x 0.52 m` bounds and contain
KTX2 textures. The protected untracked
`assets/daliuren/source/daliuren-artifact-master.blend1` and `tools/node/`
were not modified or staged. The interrupted compressor scratch directory was
also left untracked.

## Focused verification actually run

Only directly affected checks were run; no full matrix was repeated.

| Command / check | Result |
| --- | --- |
| Blender `test_high_detail_geometry.py` | 9/9 |
| Blender `test_materials.py` | 12/12 |
| Blender `test_lods.py` | 10/10 |
| Blender `test_contract.py` | 3/3 |
| Blender `test_component_contract.py` | 13/13 |
| Blender `test_graybox_structure.py` | 17/17 |
| Blender `test_reference_calibration.py` | 2/2; strict cover-fit thresholds |
| focused review-stage/controller Vitest | 34/34 |
| KTX2 encoder unit test | 3/3 |
| `npm run asset:validate` | all three LODs, 0 errors |
| completed desktop/mobile evidence Playwright scenario | 1/1 |

The mobile branch floor first failed at `7.822937804611176 px`; it was not
reported as a pass. The final responsive reframe keeps an explicit `>= 8 px`
gate and produces an uncropped square plate in the reviewed mobile evidence.
