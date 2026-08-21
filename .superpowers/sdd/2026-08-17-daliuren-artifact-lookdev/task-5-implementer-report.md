# Task 5 Implementer Report

Date: 2026-08-21
Worktree: `E:\design daliuren\.worktrees\daliuren-artifact-lookdev`
Branch: `codex/daliuren-artifact-lookdev`

## Status

Task 5 is complete: deterministic LOD construction, frozen-texture binding, three final-path GLB exports, KTX2 compression, LOD-aware validation, and regression coverage are implemented. The committed GLBs use UASTC for normal/occlusion/metallic-roughness textures and ETC1S for base-color/emissive textures, with `KHR_texture_basisu` required.

The parent-agent ruling allowed the minimal modification of `scripts/validate-daliuren-glb.mjs` and `scripts/validate-daliuren-glb.test.mjs`. The Task 5 brief omitted those files while requiring the project validator itself to enforce LOD budgets, material families, dynamic surfaces/extras, `KHR_texture_basisu`, and texture dimensions. Cost: two additional existing files are modified; the validator retains the original graybox behavior.

## RED -> GREEN evidence

1. LOD module and identity/budget:
   - RED: `node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_lods.py`
   - Exit 1: `ModuleNotFoundError: No module named 'build_lods'`.
   - GREEN after the minimal `build_lod(level)` implementation: 2 tests passed.
2. Frozen runtime texture binding:
   - RED: same command, exit 1 because the first atlas had no `baseColor`/`orm`/`normal` image nodes.
   - GREEN after binding the ten material atlases to the committed Task 4 PNGs: 3 tests passed.
3. Real GLB export:
   - RED: same command, exit 1 with `ImportError: cannot import name 'export_lod'`.
   - GREEN after adding `export_lod`: the exported LOD2 fixture contained 28 runtime extras, 21 dynamic extras, and 30 images; 4 tests passed.
4. Exported LOD2 budget:
   - RED: real exported GLB had 144,468 triangles because `export_apply=False` discarded the LOD modifiers.
   - GREEN after applying modifiers only for final LOD exports: exported LOD2 is 77,820 triangles; graybox export remains on its original non-applied path.
5. Validator runtime contract:
   - RED: three new tests failed because LOD budgets, material families, dynamic owner extras, BasisU, and texture dimensions were not checked.
   - GREEN after the minimal validator extension: 12 tests passed.
6. Asset/package contract:
   - RED: the asset contract had no LOD profiles; package scripts and the pinned CLI declaration were absent.
   - GREEN: explicit LOD profiles, runtime validation contract, and export/validation scripts are present. The unavailable CLI declaration was withdrawn after verification showed it could not be reflected in the lockfile.
7. Final bounds and graybox compatibility:
   - RED: final details expanded six component hierarchy bounds beyond graybox-only component dimensions; a first runtime validator version also applied final KTX rules to graybox.
   - GREEN: LOD profiles validate the final scene bounds while the no-LOD path preserves the old component checks. Actual graybox validation reports 0 errors.

## Files and implementation

- `tools/blender/build_lods.py`
  - Loads the frozen `assets/daliuren/source/daliuren-artifact-master.blend` without rebuilding or rebaking Task 4.
  - Clones complete object hierarchies into LOD collections.
  - LOD1 reduces bevel segments and selected high-density runtime/mechanical meshes.
  - LOD2 further reduces radial/bearing/track/seal detail without deleting runtime nodes, fixed inscriptions, copy anchors, or dynamic surfaces.
  - Binds each physical mesh to its committed material-family atlas; LOD0/1 use `textures/lod0`, LOD2 uses `textures/lod2`.
- `tools/blender/export_graybox.py`
  - Adds `--lod 0|1|2` and final-path defaults.
  - Applies modifiers only for LOD exports.
- `tools/blender/tests/test_lods.py`
  - Covers identity, budgets, dynamic surfaces, frozen atlas bindings, and real GLB export.
- `assets/daliuren/asset-contract.json`
  - Adds per-LOD file, triangle, scene-bounds, and texture-dimension profiles.
  - Freezes five physical material families and all 21 dynamic-label owner mappings.
- `scripts/validate-daliuren-glb.mjs` and `.test.mjs`
  - Adds LOD profile selection and final runtime checks while retaining graybox semantics.
- `package.json`
  - Adds three export commands, combined export/validation commands, and a graybox validation alias. The exact CLI remains in the continuation install command below until registry access is restored.
- `package-lock.json`
  - Not updated: all allowed installation attempts ended in registry connection timeout before npm could resolve or mechanically update the lockfile.
- `public/models/daliuren/daliuren-artifact-lod{0,1,2}.glb`
  - Present as validated, PNG-embedded compression inputs.

## Asset statistics

| Asset | Bytes | Triangles | Runtime IDs | Dynamic surfaces | Images | Texture extension | Bounds (m) |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| LOD0 | 23,250,584 | 203,460 | 28 | 21 | 30 | PNG / none | 0.52 x 0.0905 x 0.52 |
| LOD1 | 21,487,108 | 142,324 | 28 | 21 | 30 | PNG / none | 0.52 x 0.0905 x 0.52 |
| LOD2 | 10,427,708 | 77,820 | 28 | 21 | 30 | PNG / none | 0.52 x 0.0905 x 0.52 |

All three assets contain the identical frozen 28-ID set, including four lessons, transmission bridge/initial/middle/final, twelve generals, and the three course-copy anchors. Each contains all 21 dynamic-label surfaces with matching `owner_node_id`. Physical assets cover five material families across ten atlases; each atlas has base-color, ORM, and normal images.

SHA-256:

- LOD0: `f11c44864d44054d34c285cbbb4b96e47c8bb279269730c4cf7097e252bf6366`
- LOD1: `52b9b23fab2b833720f2d6895d23f1241718b8f40b39c73cb2dc50b97051c994`
- LOD2: `2245aa3d6f9525b3654c33a11bcfa87b632780c50967aac60de5d0548ef45083`

## Commands and results

- `node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_lods.py`
  - Exit 0; 4/4 passed.
- `node --test scripts/validate-daliuren-glb.test.mjs`
  - Exit 0; 15/15 passed.
- `npm run asset:export-lods`
  - Exit 0; all three GLBs exported.
  - Blender emits its known sampler warning when an ORM image feeds both metallic/roughness and the glTF occlusion socket; the material/image assertions and exports succeed.
- `npm run asset:validate-graybox`
  - Exit 0; 28 nodes, 7,848 triangles, 0 errors.
- Final-path LOD validator runs before KTX2:
  - LOD0: 28 nodes, 203,460 triangles, correct bounds; 31 expected compression errors.
  - LOD1: 28 nodes, 142,324 triangles, correct bounds; 31 expected compression errors.
  - LOD2: 28 nodes, 77,820 triangles, correct bounds; 31 expected compression errors.
  - Each error set is exactly one missing `KHR_texture_basisu` extension plus 30 `image/png` MIME errors; there are no identity, budget, bounds, material-family, dynamic-surface, extras, or texture-dimension errors.
- `npm run build`
  - Exit 0; 68 modules transformed. Existing Vite chunk-size warning remains.
- `npm test`
  - Exit 0; 32 files and 439 tests passed.
- `node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py`
  - Exit 0; 14/14 passed.
- `node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_contract.py`
  - Exit 0; 2/2 passed.
- `git diff --check`
  - Exit 0; only Git's existing LF-to-CRLF checkout warnings.

## KTX2 completion

- Installed and pinned `@gltf-transform/cli@4.4.2`; `package.json` and `package-lock.json` are consistent.
- Used Khronos KTX-Software 4.4.2 from the checksum-verified official Windows package.
- Compressed each LOD through temporary UASTC and ETC1S outputs before replacing the final assets.
- `gltf-transform inspect` reports `KHR_texture_basisu` in both `extensionsUsed` and `extensionsRequired`, with KTX2 MIME for all 30 images.
- Final sizes are 26,200,872 bytes (LOD0), 24,437,884 bytes (LOD1), and 11,582,128 bytes (LOD2).
- `npm run asset:validate` reports 0 errors for all three assets.

## Concerns

1. Blender reports a sampler warning for the shared ORM image feeding metallic/roughness and occlusion. Exported material/image structure, KTX2 inspection, and all current tests pass.
2. The npm install reported two high-severity audit findings in the development dependency tree; no automatic dependency rewrite was applied.
