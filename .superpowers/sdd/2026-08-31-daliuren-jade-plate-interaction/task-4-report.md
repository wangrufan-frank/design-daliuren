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

## P1 follow-up — slot anchors, flush seating, and sector dimensions

### RED evidence

- Focused TypeScript contract/loader tests failed because `GENERAL_INLAY_DIMENSIONS_METERS` was absent.
- `test_contract.py` failed because `general_inlay` still described a 28 mm disc.
- `test_component_contract.py` failed because every slot was centered at the origin and every inlay was parented directly to `plate/generals`.

### GREEN evidence

- Focused TypeScript contract/loader suite: 11/11 passed.
- Blender contract suite: 3/3 passed.
- Blender graybox suite: 13/13 passed (`Ran 13 tests in 27.545s`, `OK`).
- Blender component-contract suite: 10/10 passed (`Ran 10 tests in 19.010s`, `OK`).

### Follow-up self-review

- Each `general-slot/<branch>` is now a distinct fixed-seat child at the visual palace center, rotated by `visual_angle(index) - 90 degrees`.
- Both recess and piece use slot-local sector meshes; each inlay's local transform is identity, so composing the slot transform cannot double-translate or double-rotate it.
- The inlay and recess tops both equal the fixed general-seat top within the component test's six-decimal tolerance.
- The shared annular-sector descriptor is now 55.427 mm tangential × 45.989 mm radial × 4 mm deep (Blender XYZ), recorded in JSON/TypeScript as glTF X,Y,Z = `[0.055427, 0.004, 0.045989]`.

## P1 follow-up — single target-slot transform

### RED evidence

- `test_component_contract.py` failed before the fix because pieces were children of their initial source slots; the new two-target composition invariant could not be satisfied.
- The same RED run also exposed a missing `GENERAL_ANGULAR_CLEARANCE_DEG` import in the existing custom-property assignment; it was restored before the geometry parentage fix.

### GREEN evidence

- Blender component-contract suite: 11/11 passed (`Ran 11 tests in 21.630s`, `OK`).
- Blender graybox suite: 13/13 passed (`Ran 13 tests in 27.388s`, `OK`).

### Follow-up self-review

- Each `general/<key>` is a direct child of fixed `plate/generals`, with its initial local location and rotation copied from its assigned slot.
- Slot-local mesh data remains canonical. Reassigning a direct piece to either of two target slot transforms now produces that target's world translation and rotation exactly, with no source-slot multiplication.

## Visual geometry correction — v10 composition

### RED evidence

- `test_contract.py` failed: the fixed-core contract remained `126 mm`, not the required `112 mm` visual core.
- `test_graybox_structure.py` failed: the fixed branches were at the old outer `194 mm` radius with oversized branch-bed geometry.
- `test_component_contract.py` failed: `午` still had visual index 6 instead of occupying the top palace at index 0.
- `test_high_detail_geometry.py` failed because the old 12 earth branch beds were still counted as approved detail geometry.

### GREEN evidence

- Blender contract suite: 3/3 passed.
- Blender high-detail geometry suite: 8/8 passed.
- Blender graybox suite: 14/14 passed (`Ran 14 tests in 16.383s`, `OK`).
- Blender component-contract suite: 11/11 passed (`Ran 11 tests in 12.207s`, `OK`).

### Visual self-review

- Temporary source-only oblique render: `C:\Users\Lenovo\AppData\Local\Temp\jade-plate-visual-correction.png`.
- The square board fills the review frame; the round plate is centered at the reference-scale diameter. The twelve zodiac panels and the four diagonal corner pearls remain visible around it.
- Fixed earth branches are now compact `28 mm` glyphs on the `145 mm` circular ring, ordered top-down as `午 未 申 酉 戌 亥 子 丑 寅 卯 辰 巳`; `胜光` begins the adjacent `118 mm` month-general ring. No earth branch-bed or other generic plaque geometry remains to obscure the zodiac ring.
- The core contract is `112 mm`, retaining the centered Beidou/pivot detail while opening the inner general-sector annulus.

### Scope and concerns

- No generated LOD, source `.blend`, `.blend1`, or `tools/node/` content was changed or staged. The temporary render is outside the repository.
- The visual review uses the neutral graybox review rig to inspect composition and bounds; Task 5 remains responsible for regenerated material/export evidence.

## Strict visual-review follow-up — colored zodiac relief

### RED evidence

- `test_high_detail_geometry.py` initially found no `zodiac-animal-relief` or `zodiac-cloud-relief` nodes and only the obsolete text-glyph treatment.
- `test_materials.py` initially found no deterministic zodiac image/bump material assignment.
- `test_interaction_visibility.py` initially found no transparent shader path for the raycast-only annulus.
- The first material review render showed that the generic dial surfaces shaded as black slabs, obscuring the intended pale-jade annulus.

### GREEN evidence

- Blender high-detail geometry suite: 9/9 passed (`Ran 9 tests in 23.821s`, `OK`).
- Blender graybox suite: 15/15 passed (`Ran 15 tests in 16.818s`, `OK`).
- Blender component-contract suite: 12/12 passed (`Ran 12 tests in 12.737s`, `OK`).
- Blender material suite: 10/10 passed (`Ran 10 tests in 24.063s`, `OK`).
- The direct interaction-material test passed 2/2 while adding the transparent raycast-only shader path.

### Visual self-review

- Deterministic perspective crops are generated by `tools/blender/generate_zodiac_motifs.py` from `daliuren-white-jade-dunhuang-zodiac-v1.png` into the twelve committed local source textures. They are applied to individually raised `zodiac/*/animal-relief` meshes and coupled with bump relief; no zodiac text-only plaque remains.
- Each square-board panel also has a separate modeled `zodiac/*/cloud-relief` mesh. The core has seven blue Beidou stars joined by six old-gold mesh links.
- The raycast annulus is transparent in rendered material mode. The dial foundation, linked rings, general seat, and core now use the pale recess jade material, leaving black to the fixed branch glyph family rather than generic slabs.
- Color source render: `C:\Users\Lenovo\AppData\Local\Temp\jade-plate-v10-color-final.png`; reviewed side-by-side with v10 at `C:\Users\Lenovo\AppData\Local\Temp\jade-plate-v10-side-by-side.png`. The review drove the removal of the dominant black dial mismatch and strengthened the animal crop color before final focused validation.

### Scope and concerns

- The review render is temporary, source-only material evidence; no LODs or final exports were generated. The dynamic source textures intentionally remain separate assets for Task 5 atlas/bake work.
- No `.blend1` or `tools/node/` content was changed or staged.

## Strict visual-review follow-up — integrated v10 outer board and dial legibility

### RED evidence

- The prior color review and side-by-side exposed clipped/split animal art on floating rectangular plaques, opaque black cloud bars, an incorrectly framed camera, and earth labels occluded by the rotating heaven dial.
- `test_materials.py` failed before this pass because `plate/earth` had only `M_JadeBody`, not a single calibrated masked outer-board projection.
- The new integrated relief bounds and typography assertions failed against the prior elevated panel meshes and undersized text.

### GREEN evidence

- Blender high-detail geometry suite: 9/9 passed (`Ran 9 tests in 24.194s`, `OK`).
- Blender graybox suite: 15/15 passed (`Ran 15 tests in 16.877s`, `OK`).
- Blender component-contract suite: 13/13 passed (`Ran 13 tests in 13.753s`, `OK`).
- Blender material suite: 11/11 passed (`Ran 11 tests in 26.850s`, `OK`).

### Visual self-review

- `tools/blender/generate_zodiac_motifs.py` now perspective-rectifies the approved `daliuren-heaven-plate-blank-v1.png` board corners into deterministic `assets/daliuren/textures/source/outer-board-artwork.png`. Its alpha mask removes only the live circular dial; the source is projected through `plate/earth` and all semantic zodiac relief surfaces using shared board coordinates, not a runtime reference plane.
- Zodiac panel/animal meshes are recessed to the board top and clouds retain only a subtle raised relief, removing the floating rectangular-plaque silhouette while retaining semantic animal/cloud geometry.
- The fixed earth glyphs stay parented to `plate/earth` but are elevated above the rotating dial, so the single fixed black branch ring is visible. Cinnabar month names and fixed-sector general labels have larger text bounds.
- Calibrated 1254-square material render: `C:\Users\Lenovo\AppData\Local\Temp\jade-plate-v10-final-source.png`. True 50% v10 overlay: `C:\Users\Lenovo\AppData\Local\Temp\jade-plate-v10-final-50-overlay.png`.

### Scope

- This remains source geometry/material evidence only. No LODs, final exports, `.blend1`, or `tools/node/` content was generated or staged.
