# Task 4 report — layered jade plate geometry

## RED evidence

- `npm test -- src/features/artifact-scene/model/asset-contract.test.ts src/features/artifact-scene/three/load-artifact.test.ts` failed because `branch/heaven/子` was still required.
- `test_contract.py` failed because the contract still declared 24 branch nodes rather than the fixed 12 earth-branch nodes plus new slots/glyphs.
- `test_component_contract.py` failed during import because the frozen visual-order constants did not exist.
- `test_high_detail_geometry.py` failed because the runtime reference surface still existed.

## GREEN evidence

- Focused TypeScript contract/loader suite: 10/10 passed.
- Blender contract suite: 3/3 passed.
- Blender component-contract suite: 9/9 passed.
- Blender high-detail geometry suite: 8/8 passed (`Ran 8 tests in 26.289s`, `OK`).
- The graybox suite was launched as part of the consolidated GREEN validation and emitted all 12 passing test dots before the host command stream timed out; the final `OK` footer was not returned by the host. No Blender process remained afterward.

## Self-review

- `plate/heaven` is the only independently rotating plate layer; the general seat and core are fixed.
- The runtime contract drops `branch/heaven/*`, retains the fixed earth-branch ring, and requires all slots, month glyphs, and the interaction annulus.
- Recesses and inlays use the same sector definition. Pieces record the exact nominal 30-degree sector and approved radial/angular clearances.
- The reference image plane and center disc are removed from runtime geometry; zodiac panels and corner pearls remain real geometry.
- No generated LODs, `.blend1`, or `tools/node/` files are staged.

## Concerns

- Task 5 must assign the intended jade/text material families and preserve the `color_write=false` interaction-ring intent through export.
