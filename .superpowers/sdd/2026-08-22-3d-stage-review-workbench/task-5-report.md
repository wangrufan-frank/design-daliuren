# Task 5 report: annotation core

## Delivered

- Added the 22-item Chinese annotation descriptor table, with every descriptor bound to one frozen node ID.
- Added dependency-free homogeneous projection with viewport clamping, depth preservation, behind-camera marking, and occlusion passthrough.
- Added deterministic left/right card layout with 12px prior-side hysteresis, 8px card gaps, bounded elbow leaders, occlusion retention, and behind-camera omission.
- Updated featured review-stage annotations so every one of the six stages exposes 3–6 existing frozen nodes.

## Calendar stage ruling

The calendar stage has one physical calendar slip. Per the approved task ruling, it also features the physically present earth and heaven plates as contextual parts; no synthetic annotation or node ID was introduced. The heaven-earth stage likewise includes the slip as its visible calendar context. Heavenly-generals and course were reduced to representative subsets of six, while the descriptor table continues to expose all 22 items.

## Focused verification

- `npm test -- src/features/artifact-scene/annotations` — 3 files, 6 tests passed.
- `npx tsc -b --pretty false` — completed with exit code 0.
- `git diff --check` — no whitespace errors.
