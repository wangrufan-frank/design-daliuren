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

## Follow-up: overloaded-side layout fix

- Added capacity-aware left/right rebalancing. Items with a previous slot inside the 12px hysteresis window keep it unless that side has no remaining capacity; default-side items move first, with deterministic anchor/id ordering.
- Added compact and dense card profiles, followed by a calculated minimum density fallback. When a viewport cannot physically contain positive-height cards with the required 8px gaps, the pure function raises an explicit range error instead of overlapping or overflowing cards.
- Added the 22 same-side-anchor regression at 1200×800. It verifies bounds, per-side 8px gaps, repeat determinism, and side retention after sub-12px motion.
- Follow-up verification: `npm test -- src/features/artifact-scene/annotations` — 3 files, 7 tests passed; `npx tsc -b --pretty false` — exit code 0.

## Follow-up: impossible-width guard

- Added a minimum-width feasibility guard for two bounded card columns: dense-profile edge insets, the 8px inter-column gap, and two positive 24px minimum cards must fit before layout begins.
- Added the `width: 1` regression, which asserts that layout raises `RangeError` rather than emitting an out-of-bounds rectangle.
- Verification: `npm test -- src/features/artifact-scene/annotations` — 3 files, 8 tests passed; `npx tsc -b --pretty false` — exit code 0.
