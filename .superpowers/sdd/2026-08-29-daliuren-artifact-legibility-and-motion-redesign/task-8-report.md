# Task 8 report — final Daliuren assets and verification gate

Date: 2026-08-30 (Asia/Shanghai)

Status: COMPLETE after independent-review repair round 1/5. Graybox, master, baked authoring atlases, KTX2 runtime LODs, 15 review renders, runtime LOD screenshot gates, and benchmark evidence were rebuilt from their generating sources. Every final automated gate passes. No generated binary was patched directly.

## Outcome and final rulings

- Graybox/master split: graybox contains exactly the 24 functional branch glyphs/beds; master adds all 47 historical inscriptions, for 71 inscriptions total. Graybox is 25,022 triangles against the fixed 35,000 ceiling. Runtime LOD budgets were not relaxed.
- Static stage legibility: the calendar stage visibly raises the rear calendar slip into its two supports; the plate stage visibly rotates the heaven inscription ring by 60 degrees relative to the fixed earth ring. Four lessons and the initial/middle/final/method transmissions are separate, narrow, thick slips in individual shallow seats. They no longer form continuous wings, front panels, or a method rail.
- Projection: `ArtifactSceneController` projects every actual branch-mesh vertex after its world transform. It no longer projects a world AABB. Floors remain desktop 20 CSS px and mobile 18 CSS px; final measurements are 20 px desktop and 19 px mobile. The original 49.6 mm functional glyphs, 194/164 mm ring radii, plate sizes, and camera are unchanged from the approved pre-review assets.
- Camera ruling: an uncommitted 71 mm glyph / 149 mm ring experiment was stopped and fully reverted. The real issue was measuring before the default camera tween had settled. Re-measuring on the settling frame met the real-vertex floors while preserving the Task 7 protected subject areas and all frame/callout guards. The false diagnosis cost one discarded focused geometry/test cycle; it produced no committed or generated deliverable.
- Runtime dark-sector ruling: the near-black fan was not AO or KTX damage. Runtime raycasts identified the underside triangle of `plate/heaven`; the timeline rotated an exported XZ plate around Z, flipping its underside toward the camera. In-plane rotation is now around Y. The initial shared-material/AO hypothesis cost one diagnostic export plus triangle/raycast inspection; no atlas gate was weakened and no binary was patched.
- Tangents: textured LODs export explicit tangents for every normal-mapped primitive, with triangulation frozen across all beveled runtime nodes. The untextured graybox does not request tangents, eliminating irrelevant exporter warnings there.
- Atlas: the original microface ceiling is restored to `2e-7 m2`. Missing owners must be individually enumerated and proven no larger than the ceiling; aggregate missing area remains bounded. Final LOD0 and LOD2 each have 4,037 islands, 4,036 represented owners, and only microface owner 1348 as the allowed exception.
- KTX2: asset-only `alktx2==0.1.7` is hash-pinned to Windows wheel SHA-256 `a0952acacaeb7de1ef15e157fcf9de368eabe687fb1d358d50fd5c3a05c6cb05`. Color slots are ETC1S/BasisLZ; normal/ORM data slots are UASTC/Zstd. The NSIS installer was not run and no runtime dependency was added.
- Replacement: the compressor writes a same-directory candidate and calls rename-replace only after transformation succeeds. An injected interruption test proves the original remains and the candidate is removed. This report calls it rename-replace atomicity, not atomic copying.
- Validation: committed KTX2 identifiers and headers are parsed. Scheme 1 is required for ETC1S color slots and scheme 2 for UASTC/Zstd data slots; MIME and `KHR_texture_basisu` declarations alone cannot pass.
- Legacy lookdev: the regression remains enabled at the approved fixed 4300 K wide key, 40% front fill, low rectangular rim, fixed -1 EV, no animated lights, and no orbit.
- Browser budget: two full WebGL scenarios take 26–28 seconds alone and 32–37 seconds under seven-worker contention. Only those tests received the existing heavyweight 60-second total budget; every assertion and the separate real 30-second idle hold remain unchanged.

## Commits

### Original Task 8 source/toolchain work

| Commit | Subject |
| --- | --- |
| `16ccf05` | `fix: restore deterministic daliuren asset pipeline` |
| `566d1a5` | `fix: guarantee native atlas texel coverage` |
| `496332a` | `test: restore final atlas and lookdev gates` |
| `44775b6` | `test: isolate frozen atlas source inspection` |
| `c04a483` | `fix: make final asset reviews inspectable` |
| `942cc07` | `test: follow the current asset node contract` |
| `a75b203` | `fix: make functional branch glyphs readable` |
| `4635142` | `fix: satisfy branch projection floors` |
| `bfdf4b2` | `fix: preserve stable glyph atlas authoring` |
| `215f216` | `test: tolerate bmesh bound roundoff` |
| `394336d` | `fix: stabilize heaven branch bed baking` |
| `ae4da84` | `test: budget concurrent artifact interaction` |
| `3024a7c` | `fix: align artifact benchmark with current controls` |

The earlier generated commit `63f4c93` was the independently reviewed baseline and is superseded by this report's regenerated deliverables.

### Independent-review repair round 1

| Commit | Subject | Scope |
| --- | --- | --- |
| `dd52ccb` | `fix: address daliuren asset review findings` | Stage geometry/poses, true vertex projection, 2e-7 atlas ceiling, LOD visibility gates, rename replacement, KTX2 header policy. |
| `cebc2af` | `fix: measure asset dimensions in component space` | Correct empty-node/descendant local bounds without admitting child/world inflation. |
| `08da821` | `fix: preserve atlas owner coverage across lods` | Deterministic microface owner accounting for LOD0/LOD2. |
| `c89bcdd` | `fix: correct runtime artifact visibility` | Correct heaven rotation axis, settled-camera measurement, explicit textured-LOD tangents, centered near-black gate. |
| `af6a785` | `fix: scope tangent export to textured lods` | Keep tangents on production LODs without requesting them from graybox. |
| `0f0264e` | `test: budget final artifact browser gates` | Preserve all browser assertions while accommodating measured full-suite GPU contention. |
| final generated commit | `feat: ship redesigned daliuren artifact assets` | Rebuilt binaries, atlases, 15 renders/manifests, benchmark JSON, and this report. |

## Reproducible generation and validation

### Asset encoder and focused toolchain

```text
npm run asset:install-python-tools
python -m pip show alktx2
node --test scripts/compress-daliuren-glbs.test.mjs scripts/validate-daliuren-glb.test.mjs scripts/benchmark-artifact-policy.test.mjs
python -m unittest tools/python/test_encode_ktx2.py
```

Result: PASS. `alktx2 0.1.7` is installed only for asset tooling from the hash-pinned requirements file. Node: 29/29 in 468.870 ms. Python: 3/3. Tests cover color/data encoding assignment, real KTX2 header/supercompression parsing, same-directory rename replacement and interruption recovery, local component bounds, graybox/LOD triangle ceilings, and recognized-hardware benchmark policy.

### Graybox and master

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --save assets/daliuren/source/daliuren-artifact-graybox.blend
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --master --save assets/daliuren/source/daliuren-artifact-master.blend
```

Result: PASS under Blender 4.5.12 LTS (`84afd5f785f7`). Both completed without missing or duplicate runtime nodes. The graybox/master inscription split is locked by source tests.

### Bake, export, compression, and validation

```text
npm run asset:export-graybox
npm run asset:export-lods
npm run asset:validate-graybox
npm run asset:validate
```

Result: PASS. `asset:export-lods` completed the native 8192/4096/2048 bake workflow, LOD0/1/2 export, pinned KTX2 encoding, and same-directory rename replacement for every final GLB. Observed bake peak memory was 11.375 GB and returned normally; no bake or compressor process hung.

Final validator output:

```text
graybox: nodes=50 triangles=25022 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD0:    nodes=50 triangles=90056 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD1:    nodes=50 triangles=73455 bounds=0.52 x 0.092 x 0.52 m 0 errors
LOD2:    nodes=50 triangles=56782 bounds=0.52 x 0.092 x 0.52 m 0 errors
```

All LODs contain `KHR_texture_basisu`, actual ETC1S color textures, actual UASTC/Zstd data textures, required node/material families, and contract-sized atlases. LOD1 intentionally consumes the LOD0 authoring atlas family rather than duplicating `assets/daliuren/textures/lod1`.

### Frozen atlas

```text
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
```

Result: PASS, 23/23 in 609.585 s. The two Task 4 frozen comparisons are active.

```text
OWNER_MASK lod0 islands=4037 represented=4036 microface_exceptions=[1348] padding=8 downsample_footprint=0 edge_band=8
OWNER_MASK lod2 islands=4037 represented=4036 microface_exceptions=[1348] padding=4 downsample_footprint=1 edge_band=5
EDGE_DIFF lod0 baseColor/orm/normal count=0 max_delta=0
EDGE_DIFF lod2 baseColor/orm/normal count=0 max_delta=0
INTERIOR_SAMPLES lod0 islands=4037 with_interior=434
INTERIOR_SAMPLES lod2 islands=4037 with_interior=124
```

The sole missing owner is individually asserted at or below `2e-7 m2`; this is not a print-only allowance.

### Complete Blender test pass

Command driver ran each script with `npm run asset:blender -- --background --factory-startup --python tools/blender/tests/<name>`.

| Script | Result |
| --- | --- |
| `test_contract.py` | 3/3, 0.000 s |
| `test_graybox_structure.py` | 12/12, 46.239 s |
| `test_high_detail_geometry.py` | 6/6, 25.865 s |
| `test_inscriptions.py` | 12/12, 29.504 s |
| `test_component_contract.py` | 7/7, 24.928 s |
| `test_materials.py` | 6/6, 16.275 s |
| `test_poses.py` | 9/9, 36.018 s |
| `test_lods.py` | 5/5, 17.529 s |
| `test_review_scene.py` | 9/9, 36.389 s |
| `test_lookdev_scene.py` | 4/4, 0.100 s |
| `test_native_bake.py` | 10/10, 0.952 s |

Result: 83/83, in addition to the 23/23 frozen suite. Stage geometry, seats, ray-cast recesses, non-overlap, static pose deltas, explicit tangents, fixed lookdev lighting, brightness/contrast, and native-bake behavior all pass.

## Render evidence and visual review

```text
npm run asset:render-graybox
npm run asset:render-lookdev
```

Result: PASS. Ten graybox and five Cycles lookdev images were regenerated from the final master and opened locally at original detail.

### Graybox — 10/10 inspected

| Image | Concrete observation |
| --- | --- |
| `docs/asset-reviews/graybox/overall.png` | Closed and generals silhouettes differ immediately; the latter adds independent narrow slips and twelve perimeter buttons without continuous side wings. |
| `docs/asset-reviews/graybox/oblique.png` | Every lesson/transmission piece has a visible side face, a separate shallow seat, and space to its neighbors; nothing reads as coplanar or floating. |
| `docs/asset-reviews/graybox/mechanism.png` | The frontal low view shows real plate/slip thickness and individual contact seams; the method slip remains compact and does not form a front guide rail. |
| `docs/asset-reviews/graybox/top.png` | Four lessons, four transmission/method slips, twelve generals, and both branch rings are individually traceable and non-overlapping. |
| `docs/asset-reviews/graybox/stage-closed.png` | Compact baseline; no rear calendar bar occupies the raised support position. |
| `docs/asset-reviews/graybox/stage-calendar.png` | The long rear calendar slip is clearly raised and carried by two rear supports, making the endpoint recognizable without its filename. |
| `docs/asset-reviews/graybox/stage-plate.png` | Heaven glyph positions visibly shift by 60 degrees relative to the unchanged earth glyph ring; the endpoint is distinguishable from calendar without an angle label. |
| `docs/asset-reviews/graybox/stage-lessons.png` | Four separate narrow lesson slips occupy four individual left/right shallow seats; no side panel surface connects them. |
| `docs/asset-reviews/graybox/stage-transmissions.png` | Initial/middle/final/method add four distinct front slips; spacing and thickness remain visible and the method does not resemble a rail. |
| `docs/asset-reviews/graybox/stage-generals.png` | Twelve circular inlays complete the final stage while every prior slip and both branch rings remain unobscured. |

### Lookdev — 5/5 inspected

| Image | Concrete observation |
| --- | --- |
| `docs/asset-reviews/lookdev/overall.png` | Celadon bodies, warm gold earth glyphs, ash-white heaven glyphs, and dark recessed beds form a clear material hierarchy; no surface is dead black or flat. |
| `docs/asset-reviews/lookdev/oblique.png` | Slip/seat contacts, plate rims, and buttons retain thickness and grounded shadows; there is no wing, bridge, rail, collision, or near-black sector. |
| `docs/asset-reviews/lookdev/material-closeup.png` | Recess oxidation stays behind clean glyph edges; broad celadon, metallic glyph, and wear responses remain distinct without texture slivers. |
| `docs/asset-reviews/lookdev/legibility.png` | All visible functional branches are readable; historical marks remain smaller/lower contrast and do not compete with the 24 functional glyphs. |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | The object state itself changes: the entire heaven glyph ring and moving rim highlight shift between 0 and 60 degrees while earth and lighting remain fixed. |

Numerical lookdev gate: mean luminance `0.374`, dark fraction `0.018`, functional/historical contrast `10.05`; PASS. Render contract: Cycles, 64 samples plus denoising, AgX Medium High Contrast, fixed -1 EV, 2560 x 1440, bloom disabled.

### Runtime LOD visibility evidence

```text
npx playwright test e2e/artifact-experience.spec.ts -g "model labels and text course|mobile review keeps|settled canvas" --workers=1 --reporter=html
```

Result: PASS, 3/3 in 1.5 min. The tracked gate evaluates mean luminance, standard deviation, 5–95% range, and centered-subject near-black fraction `<0.18`, then attaches each screenshot.

| LOD | Local evidence path | Observation |
| --- | --- | --- |
| LOD0 | `playwright-report/data/db2914cf60ef0ae109ba0bd12996c8e7709c92d4.png` | Full desktop artifact is visible; top surface is continuous, glyph rings are legible, callouts do not hide the subject, and no dark fan appears. |
| LOD1 | `playwright-report/data/f21788d590263e68b6454a1d7d14f85ec1291227.png` | Desktop stability frame preserves the same readable face/material separation with no black sector or blank atlas region. |
| LOD2 | `playwright-report/data/d877d0e7057ddf06ac321d3f08f8754aef9d32a0.png` | Mobile frame retains a visible upper artifact, readable functional ring, and non-black plate while the timeline tool remains usable. |

These HTML-report attachments are local scratch; the equivalent reproducible visibility gate and attachment generation are committed in `e2e/artifact-experience.spec.ts`.

## Complete application gate

```text
npm test
npm run build
npm run test:asset-runner
npx playwright test
npm run benchmark:artifact
```

Results:

- `npm test`: PASS, 56 files / 624 tests in 31.12 s.
- `npm run build`: PASS, TypeScript + Vite, 113 modules, 2.72 s.
- `npm run test:asset-runner`: PASS, 5/5 in 5.498 s, including real Blender failure propagation and save/reopen.
- First full Playwright repair run: 39/41 in 3.5 min. Two scenarios reached their final click at 30.2/30.3 s under seven-worker GPU contention; neither failed an assertion. Focused RED diagnosis ran the complete scenarios in 26.3/27.6 s and passed 2/2.
- After the isolated 60-second total-budget change, focused GREEN: 2/2 in 55.1 s; final full Playwright: PASS, 41/41 in 3.6 min. The same two scenarios took 32.0/36.6 s under contention. Exact-seek plus real pointer drag passed in 32.4 s.
- The separate settled-canvas test passed in 48.4 s and retained the full real 30-second byte-stability hold. LOD0/1/2 KTX2 loads, true-vertex projection floors, visible-face metrics, reduced motion, annotations, text round trips, 404 fallback, and WebGL-context-loss fallback all passed.
- `npm run benchmark:artifact`: PASS on recognized NVIDIA hardware; details below.

## Hardware benchmark

- Browser: Google Chrome `152.0.7977.64`, channel `chrome`.
- Renderer, both profiles: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- `hardwareRenderer=true`; no SwiftShader, llvmpipe, software, unknown, or unavailable renderer was accepted.
- Desktop: 1920 x 1080, DPR 1, LOD0, GLB 16,159,520 bytes, canvas 952 x 760, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 8.4 ms, threshold 60 FPS, PASS.
- Mobile: 390 x 844, DPR 3, LOD2, GLB 9,360,792 bytes, canvas 1036 x 1519, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 4.2 ms, threshold 30 FPS, PASS.
- Evidence: `docs/asset-reviews/runtime/benchmark.json`, generated at `2026-08-30T14:05:37.316Z`.

## Generated sizes and contracts

| Artifact | Bytes | Contract result |
| --- | ---: | --- |
| `assets/daliuren/source/daliuren-artifact-graybox.blend` | 3,135,210 | 24 functional inscriptions only; SHA-256 `5b1b85760a596804768cf35533783349a828ef981a44c03fc779d5468d6382ab`. |
| `assets/daliuren/source/daliuren-artifact-master.blend` | 7,627,015 | 24 functional + 47 historical inscriptions; SHA-256 `bdf657cb63d06c743e2c136c53091c6530fbad0b8f26c193a17eac3dd0351a2e`. |
| `public/models/daliuren/daliuren-graybox.glb` | 1,318,580 | 25,022 triangles, <=35,000; SHA-256 `7bc65531a138e017ca68ac12c5c6d5b1f7ece9e29eee607ffa1cb08687d28d82`. |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | 16,159,520 | 90,056 triangles; KTX2 policy and browser load PASS. |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | 14,830,456 | 73,455 triangles; KTX2 policy and 30 s stability PASS. |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | 9,360,792 | 56,782 triangles, <=80,000; KTX2 policy and mobile load PASS. |
| `assets/daliuren/textures/lod0/*.png` | 30 files / 8,808,213 | Frozen/owner coverage PASS; authoring source for LOD0 and LOD1. |
| `assets/daliuren/textures/lod2/*.png` | 30 files / 4,101,858 | Frozen/owner coverage PASS. |

All four GLBs contain 50 runtime nodes and final local-measured bounds `0.52 x 0.092 x 0.52 m`. The lookdev manifest records the final five lookdev-image hashes plus master/LOD hashes, while the graybox manifest records the regenerated graybox GLB hash; these values were rechecked after rendering.

## Files delivered

- Rebuilt sources: two canonical `.blend` files and `assets/daliuren/materials/material-contract.json`.
- Baked authoring atlases: all 30 LOD0 and 30 LOD2 PNGs; LOD1 deliberately reuses the LOD0 atlas class.
- Runtime: graybox GLB plus LOD0/1/2 KTX2 GLBs.
- Visual evidence: ten graybox PNGs, five lookdev PNGs, updated graybox/lookdev manifests, and reproducible LOD0/1/2 runtime attachment gates.
- Runtime evidence: `docs/asset-reviews/runtime/benchmark.json`.
- Process evidence: this report and the repair-round Rulings in `progress.md`.

## Self-review

- Scope: changes are limited to Task 8 geometry/pose sources, runtime visibility/projection, asset pipeline/validators/tests, generated assets, and their evidence. No publish, push, merge, NSIS install, runtime dependency, or unrelated refactor occurred.
- Provenance: every `.blend`, `.glb`, atlas, and review PNG was generated by the documented commands. No binary was hand-edited.
- Geometry: graybox 25,022 <35,000; LOD counts and `0.52 x 0.092 x 0.52 m` bounds pass. Calendar, plate rotation, individual slips/seats, recess raycasts, containment, separation, and stage differences are source-tested and visually inspected.
- Projection/presentation: actual mesh vertices meet 20/19 px. Desktop subject was measured at 456.97 x 364 px with 107.52 x 78 px margins; mobile at 199.52 x 293.71 px with 72.24 x 106.34 px margins. Task 7 frame protection and callout non-overlap tests pass.
- Textures: deterministic pin/hash, exact ETC1S/UASTC slot policy, real header validation, explicit tangents, `2e-7 m2` owner exceptions, frozen comparisons, browser loads, and file/texture budgets all pass.
- Visual quality: 15/15 final renders and 3/3 runtime LOD frames were inspected. No unreadable, dead-black, flat, mechanical-wing/rail, coplanar, floating, or obscuring rejection condition remains.
- Verification: unit, build, asset-runner, Node/Python toolchain, all Blender suites, four validators, frozen atlas, fixed lookdev, full 41 browser tests including the real 30-second hold, and recognized-hardware benchmark pass.

## Concerns / non-blocking observations

- LOD1 intentionally uses the LOD0 atlas authoring tree, so no duplicated `assets/daliuren/textures/lod1` PNG directory is generated. This behavior is explicit, validated, and browser-tested.
- Blender's glTF exporter still prints its pre-existing generic validity warning for generated cube/cylinder source meshes during the isolated LOD test. The exported files have 0 validator errors, load in Chrome for all LODs, retain explicit tangents, and pass visual/stability gates; no malformed runtime primitive was observed.
- Vite prints the existing advisory that the main minified chunk exceeds 500 kB. It is unrelated to the asset budgets and does not affect measured FPS.
- The persisted HTML runtime screenshots live in ignored local `playwright-report/` scratch; the committed e2e gate regenerates and validates them on demand.

## Repository hygiene

Both automatic Blender backups were resolved to absolute paths inside this worktree and removed:

```text
assets/daliuren/source/daliuren-artifact-graybox.blend1
assets/daliuren/source/daliuren-artifact-master.blend1
```

They are not recoverable as backups, but both canonical `.blend` files are reproducibly generated by the commands above. Final `git diff --check` passed. The generated-deliverables commit uses the exact required subject `feat: ship redesigned daliuren artifact assets`; final status is clean apart from ignored local Playwright scratch.
