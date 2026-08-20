# Task 5 Implementer Report

Date: 2026-08-21
Worktree: `E:\design daliuren\.worktrees\daliuren-artifact-lookdev`
Branch: `codex/daliuren-artifact-lookdev`

## Status

Task 5 is implemented through deterministic LOD construction, frozen-texture binding, three final-path GLB exports, LOD-aware validation, and regression coverage. KTX2 compression and the resulting final validator/`inspect` passes are externally blocked because the pinned CLI cannot be downloaded from this machine. The committed GLBs are therefore the verified PNG-embedded inputs for the required UASTC -> ETC1S pass, not KTX2-compressed deliverables.

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
   - GREEN: explicit LOD profiles, runtime validation contract, export/validation scripts, and `@gltf-transform/cli: 4.4.2` declaration are present.
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
  - Adds three export commands, combined export/validation commands, graybox validation alias, and the exact CLI pin.
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

## KTX2 blocker and exact continuation

Local source checks found no `gltf-transform` executable in `Get-Command`, `where.exe`, npm global root (`F:\Claude\npm-global\node_modules`), the workspace, Codex package directories, or npm cache. Installation attempts:

1. Official registry in the default sandbox: exit 1, `ETIMEDOUT 11.18.0.98:443`.
2. Official registry with approved external network: exit 1, same timeout.
3. `https://registry.npmmirror.com`: exit 1, `ETIMEDOUT 11.18.0.99:443`.
4. Final official-registry retry with approved external network: exit 1, same timeout.

Required install command:

```powershell
npm install --save-dev @gltf-transform/cli@4.4.2 --registry=https://registry.npmjs.org
```

After connectivity is restored, run the brief's two-stage compression for each level. Use temporary outputs so the verified PNG GLB remains the input until both stages succeed:

```powershell
0..2 | ForEach-Object {
  $input = "public/models/daliuren/daliuren-artifact-lod$_.glb"
  $uastc = Join-Path $env:TEMP "daliuren-artifact-lod$_.uastc.glb"
  $ktx2 = Join-Path $env:TEMP "daliuren-artifact-lod$_.ktx2.glb"
  npx gltf-transform uastc $input $uastc --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" --level 4 --rdo --rdo-lambda 4 --zstd 18
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npx gltf-transform etc1s $uastc $ktx2 --slots "{baseColorTexture,emissiveTexture}" --quality 255
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Move-Item -Force -LiteralPath $ktx2 -Destination $input
}
npx gltf-transform inspect public/models/daliuren/daliuren-artifact-lod0.glb
npx gltf-transform inspect public/models/daliuren/daliuren-artifact-lod1.glb
npx gltf-transform inspect public/models/daliuren/daliuren-artifact-lod2.glb
npm run asset:validate
```

## Concerns

1. The three checked-in GLBs are not KTX2-compressed and therefore do not yet contain `KHR_texture_basisu`; `gltf-transform inspect` and final three-asset validator success remain blocked.
2. `package.json` declares the exact `@gltf-transform/cli` version, but `package-lock.json` is unchanged because npm never completed dependency resolution. A clean `npm ci` will require the install command above to succeed and mechanically update the lockfile.
3. Blender reports a sampler warning for the shared ORM image feeding metallic/roughness and occlusion. Exported material/image structure and all current tests pass; KTX2 `inspect` remains the final confirmation after the CLI is available.
