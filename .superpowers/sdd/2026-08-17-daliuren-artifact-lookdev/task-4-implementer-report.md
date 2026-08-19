# Task 4 Correction Report — Family UV Atlases and Model-Driven Runtime Textures

## Outcome

Task 4 is corrected in `E:\design daliuren\.worktrees\daliuren-artifact-lookdev` only. Commit `0c3d069` (`fix: bake model-driven artifact atlases`) replaces the rejected face-cell UVs and coordinate-noise textures with real family atlases and source-scene-driven baking. The saved master, 30 runtime PNGs, material contract, implementation, and tests are regenerated together. Task 5 has not started.

## Review findings corrected

- UV validation now aggregates every unique physical mesh by `runtime_texture_family` and runs cross-object triangle overlap, UV degeneracy, and out-of-range checks in the shared `[0,1]` atlas. All five families report zero failures.
- Meshes receive Blender smart/angle unwraps with continuous islands and preserved proportions. Whole-object islands are uniformly placed into deterministic family cells; faces are not reconstructed as regular polygons.
- Shared mesh data is explicit rather than hidden: the twelve general objects intentionally share one mesh and one UV layout, and tests assert the exact object set. Family validation counts that geometry once.
- Baking refuses a factory-default or incomplete source scene before creating output. It requires the frozen 28 runtime identities, 85 detail helpers, 71 fixed inscriptions, five material families, all four causal fields, and valid family atlas UVs.
- LOD0 pixels are rasterized through the actual master UVs from Principled/material-node values plus causal face attributes. LOD2 is an independently verified exact 2x2 box downsample of LOD0.
- Known-object tests use handwritten family/material expectations and independently located interior UV pixels. A source-scene mutation changes the affected Bronze region/hash while leaving the other four families unchanged.
- Dynamic course-value scanning is limited to the 21 dynamic surfaces and runtime bake inputs. Fixed Task 1 inscriptions remain legal, including the twelve earth branches and `胜光`.
- All 21 dynamic surfaces are 0.25 mm above their support. BVH rays at four corners and center confirm that clearance without floating or intersection.

## RED to GREEN evidence

The correction began with tests that failed against the previous implementation:

- Five family-level atlas checks exposed cross-object UV overlap that per-mesh tests could not see.
- A factory-default scene incorrectly produced generic textures instead of rejecting missing master data.
- All 15 LOD2 maps failed independent downsample comparison because they were generated from a separate coordinate formula.
- A causal-face mutation left the previous texture hash unchanged.
- All 21 dynamic-label clearance checks failed the new 0.2–0.3 mm requirement.
- Dynamic denylist tests exposed the global false-positive policy for legal fixed inscriptions.

The last GREEN run executed 15 Task 4 tests in 292.426 seconds with `OK`.

One final test failure was diagnostic rather than a production defect. Integer-rounded UV centroids landed outside two sub-pixel target triangles: the high-contact sample read uncovered background roughness 148 instead of its direct expected 94, while the zero-contact sample read an adjacent contact-0.84 triangle at 103. The test now independently scans for a pixel center inside the largest high-contact and zero-contact triangles. The physical assertion remains unchanged: polished Bronze is less rough than unpolished Bronze. The focused test passed 1/1 in 120.133 seconds before the complete suite.

## UV and saved-master audit

| Family | Objects | Unique meshes | UV triangles | Overlap | Degenerate | Out of range |
|---|---:|---:|---:|---:|---:|---:|
| M_Bronze | 78 | 67 | 97,766 | 0 | 0 | 0 |
| M_Patina | 17 | 17 | 7,084 | 0 | 0 | 0 |
| M_Celadon | 24 | 24 | 6,000 | 0 | 0 | 0 |
| M_OldGold | 12 | 12 | 1,976 | 0 | 0 | 0 |
| M_AshText | 59 | 59 | 31,600 | 0 | 0 | 0 |

The master reopens with 28 runtime identities, 85 detail helpers, 71 fixed inscriptions, and 21 dynamic labels. The explicit shared Bronze mesh belongs to exactly: azure-dragon, black-tortoise, constant, harmony, hook-array, noble, queen-of-heaven, snake, vermilion-bird, void, white-tiger, and yin.

## Model-driven bake

The baker reads the master material graph and per-face source data through the family atlas:

- `causal_contact_wear` polishes Bronze by lowering roughness.
- `causal_recess_oxidation` and patina phase alter Bronze/Patina base color, AO, and roughness in recessed regions.
- `causal_insert_boundary` and `causal_celadon_crackle` drive celadon boundary variation, crackle, orange-peel roughness, and tangent-space normal detail.
- Geometry normals and actual UV ownership supply the remaining deterministic inputs.

Metallic is physically constrained in known regions: Bronze, Patina, and Old Gold bake near 255; Celadon and Ash Text bake 0. No emissive texture is created because no runtime consumer exists.

Every map is opaque 8-bit RGB. LOD0 is 2048 by 2048; LOD2 is 1024 by 1024. Base color is sRGB; ORM and normal are Non-Color. ORM uses AO=R, roughness=G, metallic=B.

## Texture hashes

| Family | LOD | Base color SHA-256 | ORM SHA-256 | Normal SHA-256 |
|---|---:|---|---|---|
| M_Bronze | 0 | `e08b39c770cd2fc3d639b56c6e9a51026be25e1e31b4f666f86870cad9792573` | `b3d125a4a29484349d4e7f99423979fa59d4553af66e314b5b15711d66004400` | `979259d2d1739cb0267fae890e38f118bc319204b818c12d5de0af424719e5c8` |
| M_Bronze | 2 | `e6d46c4dd57b496d29f9bfeacd738fa18bd634b8e9acf718984721cd5c92039e` | `d6759b1a33ec225a4eafc8c415c2a88796dcc304e977959eae577ceba8617a31` | `2f783ab82c440d892706ae80d21f22b1f41113a2c82cecc5b686a8ed8527e2fc` |
| M_Patina | 0 | `e18731787d1393a26171c99a246021eccc7fdd7025f4ef5a7e38741ea8809d22` | `656c84d436a5c79453ddba1cd1c85070237d6bb5c073cdcd21e7839cc3036a8c` | `979259d2d1739cb0267fae890e38f118bc319204b818c12d5de0af424719e5c8` |
| M_Patina | 2 | `0ccb85ca715db8208a34a032b6276a5a1e0b9bdf3313f8e728211ab726036359` | `f201feecfad20deaf1aab01d61917805d99705765c5abb5b1ae3f1a8e59c4121` | `2f783ab82c440d892706ae80d21f22b1f41113a2c82cecc5b686a8ed8527e2fc` |
| M_Celadon | 0 | `80814e0d4ca2314bf2a024550ce114e32bee44ef8920ed0d344418f4577a1ebc` | `94bb2b5ba064d406eb0aecca394b562da6ac104d7ecc09a7b4c993e9a64e3478` | `0ee4351a5fb621a2fd8abb46138c94a266f8e005cf3f2901ea111592aedab5d6` |
| M_Celadon | 2 | `f8c1b8d6335fb15d7feb20ab330c066e31c15260289058c486871a5448a5500c` | `dd9d13eca00e3393756bc0ef8a8ea67c221503f773049c9607045694defbbea5` | `a8c1e3beeace569c51b0711ecdba0378ea12d6d6d5296f7bc7058fea6d1e1537` |
| M_OldGold | 0 | `469bbe963268e10cf20adb21df42f4fb9fb2c08865c31b50d6e468f51aef7e70` | `2d28a8c74991ce5ba8a70a68ecf59ada6a4e90e14c19f339292b5d0e4355caf5` | `979259d2d1739cb0267fae890e38f118bc319204b818c12d5de0af424719e5c8` |
| M_OldGold | 2 | `724a4bf6fd1b95a9790365e6ec01d4180cb3f6bcc1ffb88aa954b11168f82ea5` | `dc747481c69d1f7fde0806267a93a1adb6dcf1f418bcb4b16c1c55fcbb8a24c6` | `2f783ab82c440d892706ae80d21f22b1f41113a2c82cecc5b686a8ed8527e2fc` |
| M_AshText | 0 | `c386b1f914cfc6cf10b9ce70a92e7145911dd5db473a534e60d262ac06f9702b` | `20323daaec4c7d8b12a495a64cb8ae7350864fc83541477e924455ee1a2c2d40` | `979259d2d1739cb0267fae890e38f118bc319204b818c12d5de0af424719e5c8` |
| M_AshText | 2 | `21a14874b046cafcae2b3e8c100071d810e14ce9258c466d94ce9747c4d34714` | `1777eb73a8a24b92d8f8f3e932bc36063a3f095d76ef8e69432a303a2b98073a` | `2f783ab82c440d892706ae80d21f22b1f41113a2c82cecc5b686a8ed8527e2fc` |

## Verification

- Task 4: 15/15 passed in 292.426 s.
- High-detail geometry: 14/14 passed in 36.993 s.
- Materials: 8/8 passed in 8.848 s.
- Inscriptions: 6/6 passed in 1.239 s.
- Poses: 13/13 passed in 1.095 s.
- Contract: 2/2 passed.
- Component contract: 8/8 passed.
- Graybox structure: 8/8 passed.
- Review scene: 4/4 passed.
- Frontend/unit integration: 32 files and 439 tests passed in 40.94 s.
- Production build passed; only the existing bundle-size warning remains.
- Asset runner: 5/5 passed.
- Calendar source verification: 3/3 passed.
- `git diff --check`: clean.

## Files changed

- `tools/blender/uv_and_bake.py`
- `tools/blender/tests/test_uv_and_bake.py`
- `assets/daliuren/materials/material-contract.json`
- `assets/daliuren/source/daliuren-artifact-master.blend`
- `assets/daliuren/textures/lod0/*.png` (15 files)
- `assets/daliuren/textures/lod2/*.png` (15 files)

## Remaining boundary

The deterministic CPU raster bake takes about two minutes at the required 2048/1024 sizes. LOD-specific runtime binding, GLB export, and KTX2 compression remain Task 5 work. No Task 5 files or behavior were introduced.
