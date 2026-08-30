# Task 8 report — final Daliuren assets and verification gate

Date: 2026-08-30 (Asia/Shanghai)

Status: COMPLETE. The graybox, master, runtime LODs, baked atlases, review renders, and benchmark evidence were rebuilt from their generating sources. Frozen-atlas comparisons are enabled and passing. No generated binary was patched directly.

## Final decisions and corrections

- Graybox/master split: graybox contains exactly the 24 runtime-functional earth/heaven branch glyphs and beds; master adds all 47 historical inscriptions for 71 total. The graybox hard ceiling is 35,000 triangles; runtime LOD budgets were not changed.
- Projection: runtime readability uses the true screen-space bounding rectangle of all eight world `Box3` corners. The desktop/mobile floors remain 20/18 CSS px. Camera, plate dimensions, and the 164 mm heaven-ring radius remain unchanged.
- Functional geometry: the 24 glyphs retain a 44 mm local mesh contract and use the approved object scale for a 49.6 mm physical span. Earth beds are 52 x 52 mm. Heaven beds are clean 52 x 51.99 mm curved profiles with 16 outer-arc segments, capped at 189.99 mm; the earth ring is the minimum-safe 194 mm.
- The proposed 48.8 mm bed was rejected RED before export because it could not contain the 49.6 mm physical glyph. The clean curved bed superseded a post-bevel profile whose sliver topology caused frozen-atlas `max_delta=90` against the limit of 64.
- The earlier 62 mm enlargement trial was fully reverted before commit. It came from a projection-axis misdiagnosis and would have pushed the 202 mm earth ring beyond the 220 mm plate half-width. Its cost was a discarded focused geometry/test cycle, not a shipped asset.
- KTX2: asset-only `alktx2==0.1.7` is hash-pinned to Windows wheel SHA-256 `a0952acacaeb7de1ef15e157fcf9de368eabe687fb1d358d50fd5c3a05c6cb05`. The NSIS installer was not run. No runtime dependency was added.
- Texture policy remains exact: ETC1S only for color slots; UASTC only for data slots. The export is atomically replaced only after successful postprocessing. LOD1 deliberately shares the LOD0 atlas family (`texture_lod = "lod2" if level == 2 else "lod0"`); therefore the checked texture roots are `lod0` and `lod2`, not a duplicated `lod1` directory.
- Legacy lookdev was reconciled to the approved fixed rig: 4300 K wide key, 40% front fill, low rectangular rim, fixed -1 EV, no animation. Its regression tests remain enabled.

## Source/toolchain commits

| Commit | Subject | Purpose |
| --- | --- | --- |
| `16ccf05` | `fix: restore deterministic daliuren asset pipeline` | Restored baking, local-bound validation, pinned encoder integration, and deterministic KTX2 postprocessing. |
| `566d1a5` | `fix: guarantee native atlas texel coverage` | Corrected UV/texel ownership coverage at source. |
| `496332a` | `test: restore final atlas and lookdev gates` | Re-enabled the final comparison and fixed-light regression gates. |
| `44775b6` | `test: isolate frozen atlas source inspection` | Kept the frozen comparison independent and deterministic. |
| `c04a483` | `fix: make final asset reviews inspectable` | Added inspectable review poses and evidence outputs. |
| `942cc07` | `test: follow the current asset node contract` | Aligned tests with the final semantic node contract. |
| `a75b203` | `fix: make functional branch glyphs readable` | Enlarged only the 24 functional glyphs/beds under the approved ruling. |
| `4635142` | `fix: satisfy branch projection floors` | Implemented the approved ring placement and projection result. |
| `bfdf4b2` | `fix: preserve stable glyph atlas authoring` | Stabilized glyph atlas authoring. |
| `215f216` | `test: tolerate bmesh bound roundoff` | Limited numeric tolerance to Blender bound roundoff. |
| `394336d` | `fix: stabilize heaven branch bed baking` | Replaced sliver-prone post-bevel heaven beds with clean curved profiles. |
| `ae4da84` | `test: budget concurrent artifact interaction` | Gave the 10-seek plus real-drag WebGL test a 60 s total budget; assertions and the separate 30 s stability hold are unchanged. |
| `3024a7c` | `fix: align artifact benchmark with current controls` | Updated the benchmark to the current submit label and opened the mobile timeline tool before sampling. |
| generated-deliverables commit | `feat: ship redesigned daliuren artifact assets` | Contains rebuilt binary assets, atlases, review renders/manifests, benchmark JSON, and this report. |

## Reproducible generation and validation log

### Asset-only encoder

Command:

```text
npm run asset:install-python-tools
```

Result: PASS; `alktx2==0.1.7` already satisfied from `tools/python/requirements-assets.txt`. `python -m pip show alktx2` reports version `0.1.7`, no dependencies, and installation outside runtime `package.json`. The requirements line includes the approved SHA-256 above.

Focused encoder/compressor/validator tests:

```text
node --test scripts/compress-daliuren-glbs.test.mjs scripts/validate-daliuren-glb.test.mjs scripts/benchmark-artifact-policy.test.mjs
python -m unittest tools/python/test_encode_ktx2.py
```

Result: PASS, Node 25/25 and Python 3/3. These tests lock ETC1S/UASTC assignment, atomic replacement, local mesh bounds, 35k graybox ceiling, KHR_texture_basisu, LOD dimensions/budgets, and recognized hardware policy.

### Graybox and master

Commands:

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --save assets/daliuren/source/daliuren-artifact-graybox.blend
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --master --save assets/daliuren/source/daliuren-artifact-master.blend
```

Result: PASS for both under Blender 4.5.12 LTS. The graybox has only 24 functional inscriptions; the master has those 24 plus 47 historical inscriptions. No missing/duplicate runtime node IDs were reported.

Focused geometry commands and results:

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_inscriptions.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
```

Result: PASS, 12/12 in 28.817 s and 7/7 in 24.436 s. The RED 48.8 mm bed attempt failed 12 containment/span subtests and was discarded; the final 52 x 52 / 52 x 51.99 mm profiles passed plate containment, adjacent separation, and recessed ray-cast checks.

### Export, bake, and compression

Commands:

```text
npm run asset:export-graybox
npm run asset:export-lods
```

Result: PASS. `asset:export-lods` completed the pinned tool install, production bake, raw LOD0/1/2 exports, and KTX2 postprocessing for all three GLBs. Observed bake peak memory was 11.40485 GB; Blender and compression processes exited normally. Every final LOD logged `Compressed KTX2 GLB`.

Commands:

```text
npm run asset:validate-graybox
npm run asset:validate
```

Result:

```text
graybox: nodes=50 triangles=23142 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD0:    nodes=50 triangles=88178 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD1:    nodes=50 triangles=71575 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD2:    nodes=50 triangles=54901 bounds=0.52 x 0.092 x 0.52 m 0 errors
```

The validators enforce node-local mesh dimensions, node/material IDs, KHR_texture_basisu use, branch inlays, scene bounds, triangle budgets, texture dimensions, and runtime texture ownership.

### Frozen atlas and fixed-light regressions

Command:

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
```

Result: PASS, 23/23 in 607.861 s. Both previously skipped frozen comparisons are active. Heaven LOD0/LOD2 baseColor, ORM, and normal edge comparisons all report `count=0, max_delta=0`. Owner-mask evidence: LOD0 4,037 islands / 3,961 represented / 76 misses / padding 8; LOD2 4,037 / 3,826 / 211 / padding 4 / footprint 1. Interior samples were LOD0 434 and LOD2 124. A focused native-coverage test also passed 1/1 in 65.744 s.

Commands:

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_lookdev_scene.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_review_scene.py
```

Result: PASS, 4/4 and 8/8. The approved fixed rig, camera, brightness/contrast calculations, deterministic scene setup, and leak-free/no-animation behavior remain asserted.

## Render commands and visual inspection

Commands:

```text
npm run asset:render-graybox
npm run asset:render-lookdev
```

Result: PASS. Ten graybox images and five final lookdev images were generated. Every image below was opened at original detail with local image inspection.

### Graybox — 10/10 inspected

| Path | Observation |
| --- | --- |
| `docs/asset-reviews/graybox/overall.png` | Closed is compact; generals visibly deploys four side panels and perimeter buttons. Plate layers retain real thickness and grounded shadows. |
| `docs/asset-reviews/graybox/oblique.png` | Central plates, side panels, and buttons separate clearly in depth; no floating rail, bridge, wing, pillar, collision, or coplanar surface is visible. |
| `docs/asset-reviews/graybox/mechanism.png` | Front engineering view shows real seams and clearance around the central plate and deployed panels; no geometry obscures either branch ring. |
| `docs/asset-reviews/graybox/top.png` | The earth/heaven rings, four lessons, three transmissions, and twelve generals remain distinguishable and non-overlapping. |
| `docs/asset-reviews/graybox/stage-closed.png` | Compact baseline is fully grounded and contained by the square base. |
| `docs/asset-reviews/graybox/stage-calendar.png` | Fixed endpoint preserves the compact structure; calendar facts are a subtle state change rather than an invented mechanical flourish. |
| `docs/asset-reviews/graybox/stage-plate.png` | Plate alignment remains centered and unobscured; from the fixed camera this endpoint is intentionally close to calendar. |
| `docs/asset-reviews/graybox/stage-lessons.png` | Left/right lesson panels visibly deploy without entering the central rings. |
| `docs/asset-reviews/graybox/stage-transmissions.png` | Transmission panels add a second clear expansion step without old bridge/rail geometry. |
| `docs/asset-reviews/graybox/stage-generals.png` | Perimeter general buttons complete the fullest silhouette while remaining grounded and clear of neighboring components. |

### Lookdev — 5/5 inspected

| Path | Observation |
| --- | --- |
| `docs/asset-reviews/lookdev/overall.png` | Celadon base/earth/heaven layers read as separate physical materials. White heaven and gold earth branches are strong on dark recessed beds, remain within their plates, and do not overlap adjacent beds. |
| `docs/asset-reviews/lookdev/oblique.png` | Four deployed panels and layered silhouettes are readable with no coplanar flicker. A rear-left elongated dark opening was checked as a deliberate inter-layer void, not an unlit face; the measured dark fraction is only 0.018. |
| `docs/asset-reviews/lookdev/material-closeup.png` | Celadon, bronze/gold, ash-white glyphs, and dark recess oxidation are distinct. Clean curved heaven-bed edges support every glyph without slivers or clipping. |
| `docs/asset-reviews/lookdev/legibility.png` | All visible functional branches remain readable at the default-equivalent camera; historical inscriptions stay lower contrast and subordinate. |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | 0° and 60° views visibly move heaven glyph positions and highlights while base/earth and the fixed lighting remain unchanged; there is no automatic orbit. |

Lookdev numerical gate: mean luminance `0.383`, dark fraction `0.018`, functional/historical contrast `10.04`; PASS. Render contract: Cycles, 64 samples with denoising, AgX Medium High Contrast, fixed -1 EV, 2560 x 1440, bloom disabled.

The human PASS observations were written back to `docs/asset-reviews/lookdev/README.md`; the graybox manifest was updated to remove stale bridge/rail wording and enumerate all six stage previews.

## Runtime and complete verification

Projection focus:

```text
npx playwright test e2e/artifact-experience.spec.ts -g "model labels and text course|mobile review keeps"
```

Result: PASS, 2/2 in 36.4 s. True eight-corner screen rectangles meet desktop >=20 px and mobile >=18 px without changing camera or thresholds.

Interaction focus:

```text
npx playwright test e2e/artifact-experience.spec.ts -g "exact stage seeks"
```

Result: PASS, 1/1 (27.4 s before the concurrency-budget patch; 25.8 s after it). The test retains all ten exact seeks, pose-hash equality checks, source-line state, and the real pointer drag assertion.

Full commands:

```text
npm test
npm run build
npm run test:asset-runner
npx playwright test
npm run benchmark:artifact
```

Results:

- `npm test`: PASS, 56 files and 622 tests in 31.99 s.
- `npm run build`: PASS, TypeScript plus Vite, 113 modules, 2.23 s. Vite emitted the existing advisory that the main minified chunk exceeds 500 kB; it is not a correctness or asset-budget failure.
- `npm run test:asset-runner`: PASS, 5/5 in 5.243 s, including real Blender failure propagation and save/reopen.
- First full Playwright run: 40/41; the exact-seek test reached its last `mouse.move` at 30.1 s under seven-worker GPU contention. The separate 30-second byte-stability test passed in that same run. The test-specific total budget was aligned with existing heavyweight WebGL tests at 60 s, with no assertion removed or floor lowered.
- Final full Playwright run: PASS, 41/41 in 3.3 min. Exact-seek consumed 32.0 s under concurrency, proving the failure was total-budget contention. The 30-second settled-canvas byte-stability hold passed in its complete 47.5 s test. KTX2 loader round trips, reduced motion, GLB 404 fallback, context-loss fallback, mobile callouts, and real pointer interaction all passed.
- First benchmark attempt correctly failed on the retired submit label. The second isolated the mobile hidden-slider contract after desktop sampling succeeded. Source was updated to the current submit label/birth-year input and to open the mobile timeline tool; no FPS or renderer policy was changed.
- Final benchmark: PASS on recognized NVIDIA hardware, details below.

## Hardware benchmark evidence

- Browser: Google Chrome `152.0.7977.64`, channel `chrome`.
- Renderer (both profiles): `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- `hardwareRenderer=true`; no SwiftShader, llvmpipe, software, unknown, or unavailable renderer was accepted.
- Desktop: 1920 x 1080, DPR 1, LOD0, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 8.4 ms, threshold 60 FPS, PASS.
- Mobile: 390 x 844, DPR 3, LOD2, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 4.3 ms, threshold 30 FPS, PASS.
- Evidence file: `docs/asset-reviews/runtime/benchmark.json`.

## Generated sizes and contracts

| Artifact | Bytes | Contract result |
| --- | ---: | --- |
| `assets/daliuren/source/daliuren-artifact-graybox.blend` | 2,907,056 | 24 functional inscriptions only. |
| `assets/daliuren/source/daliuren-artifact-master.blend` | 7,410,081 | 24 functional + 47 historical inscriptions. |
| `public/models/daliuren/daliuren-graybox.glb` | 1,187,112 | 23,142 triangles, <=35,000. |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | 12,095,300 | 88,178 triangles, KTX2, validator PASS. |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | 11,491,924 | 71,575 triangles, KTX2, validator PASS; shares LOD0 atlas class by design. |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | 6,717,576 | 54,901 triangles, KTX2, validator PASS. |
| `assets/daliuren/textures/lod0/*.png` | 30 files / 9,300,257 | Frozen atlas PASS; LOD0 and LOD1 authoring source. |
| `assets/daliuren/textures/lod2/*.png` | 30 files / 4,202,004 | Frozen atlas PASS; LOD2 authoring source. |

All four GLBs have 50 runtime nodes and final bounds `0.52 x 0.092 x 0.52 m`. The production GLBs use `KHR_texture_basisu`; browser loading passed in the full e2e and benchmark. The master SHA-256 and all lookdev image/LOD hashes recorded in `docs/asset-reviews/lookdev/README.md` were independently rechecked. The graybox README hash was corrected to the regenerated GLB (`d133b083...d018`).

## Files delivered

- Rebuilt sources: the two `.blend` files and `assets/daliuren/materials/material-contract.json`.
- Baked authoring atlases: all 30 LOD0 and 30 LOD2 PNGs.
- Runtime: graybox GLB plus LOD0/1/2 GLBs.
- Visual evidence: 10 graybox PNGs, 5 regenerated lookdev PNGs, and updated graybox/lookdev manifests.
- Runtime evidence: `docs/asset-reviews/runtime/benchmark.json`.
- Process evidence: this report and the Task 8 Ruling appended to `progress.md`.

Automatic Blender backups `daliuren-artifact-graybox.blend1` and `daliuren-artifact-master.blend1` were resolved to absolute paths, verified to be inside this worktree, and deleted. They are not recoverable as backups but both canonical `.blend` files can be regenerated by the commands above.

## Self-review

- Scope: source commits touch only the Task 8 pipeline, geometry/readability sources, validators/tests, review generation, benchmark driver, and their contracts. Generated changes are limited to the brief's assets/evidence. No push, publish, merge, runtime dependency, NSIS install, or out-of-worktree write was performed.
- Binary provenance: every `.blend`, `.glb`, atlas, and render came from the documented builders/exporters/renderers; no binary was hand-edited.
- Semantic contract: 50 node IDs in every GLB; 24 runtime branch nodes remain addressable; six stage intervals still end at 27,000 ms; void colors, reduced-motion facts, no-orbit behavior, and material ownership remain tested.
- Geometry: graybox 23,142 <35,000; LOD budgets and 0.52 x 0.092 x 0.52 m bounds pass. Functional beds are inside the plates, non-overlapping, recessed by ray cast, and visually legible.
- Textures: deterministic pin/hash, exact ETC1S/UASTC slot policy, active frozen comparisons, no seam delta on the corrected heaven beds, KHR_texture_basisu validation, browser loading, and file budgets all pass.
- Visual quality: no unreadable/dark/flat/mechanical/coplanar/occluding rejection condition remains. The deliberate rear-left void was inspected and corroborated by the dark-fraction gate.
- Verification: unit, build, asset runner, validators, frozen atlas, fixed lookdev, focused projection/interaction, full e2e including 30 s stability, and hardware benchmark all pass.

## Concerns / non-blocking observations

- With the fixed review camera, `stage-calendar.png` and `stage-plate.png` remain visually close to `stage-closed.png`; the exact facts/transforms and later visible lessons/transmissions/generals progression are covered by pose/runtime tests. No ornamental motion was added to exaggerate these endpoints.
- LOD1 intentionally reuses LOD0 authoring atlases instead of duplicating a `textures/lod1` tree. This is explicit in the builder and passed KTX2, dimensions, browser-load, size, and performance gates.
- Vite reports the existing >500 kB main-chunk advisory. It is outside this asset-generation scope and does not affect the asset budgets or measured FPS.

## Final repository gate

The generated-deliverables commit uses the exact required subject. After the commit, `git status --short`, `git diff --check`, and `git diff --stat` each produced no output. Explicit existence checks also confirmed that neither `.blend1` backup remains.
