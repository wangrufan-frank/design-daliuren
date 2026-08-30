# Task 8 report — final Daliuren assets and verification gate

Date: 2026-08-30 (Asia/Shanghai)

Status: COMPLETE after independent-review repair rounds 1–3/5. Graybox, master, baked authoring atlases, KTX2 runtime LODs, 15 review renders, three committed pure-canvas LOD captures, and benchmark evidence were verified from their generating sources. Every final automated gate passes. Rounds 2–3 changed runtime measurement, framing, evidence, and validation code only; no model or texture rebake was needed and no generated binary was patched directly.

## Outcome and final rulings

- Graybox/master split: graybox contains exactly the 24 functional branch glyphs/beds; master adds all 47 historical inscriptions, for 71 inscriptions total. Graybox is 25,022 triangles against the fixed 35,000 ceiling. Runtime LOD budgets were not relaxed.
- Static stage legibility: the calendar stage visibly raises the rear calendar slip into its two supports; the plate stage visibly rotates the heaven inscription ring by 60 degrees relative to the fixed earth ring. Four lessons and the initial/middle/final/method transmissions are separate, narrow, thick slips in individual shallow seats. They no longer form continuous wings, front panels, or a method rail.
- Projection: `ArtifactSceneController` projects every actual branch-mesh vertex after its world transform. It no longer projects a world AABB, and `ArtifactExperience` exposes the raw floating-point minimum rather than a rounded integer. Floors remain desktop 20 CSS px and mobile 18 CSS px; final settled values are LOD0 `29.26424553334844 px`, LOD1 `20.012207523729835 px`, and LOD2 `19.124706775338232 px`. A unit fixture proves `19.99` cannot pass the desktop floor. A second true-vertex metric requires every one of the 24 glyph meshes to stay at least 4 CSS px inside the canvas; the final LOD2 minimum is `56.59019821387625 px`.
- Camera ruling: the original 49.6 mm functional glyphs, 194/164 mm ring radii, plate sizes, and desktop target `[0, 0.05, 0]` remain unchanged. An uncommitted 71 mm glyph / 149 mm ring experiment was stopped and fully reverted. With true-vertex and raw-float measurement, the prior default camera left LOD1 at `19.920843395738405 px`; moving the camera 0.5% closer along the same sightline still produced `19.99549609011798 px` and correctly failed. The minimal desktop move was therefore 0.6%, from `[0.31, 0.73, 0.77]` to `[0.3081, 0.7259, 0.7654]`. It passes without changing the view direction, glyph geometry, thresholds, protected subject areas, or callout guards. Round 3 proved that distance-only portrait moves of 5%, 8%, and 10% could not simultaneously contain the base and preserve 18 px glyph projection. The smallest verified portrait-only framing uses the same azimuth, a 60 degree elevation, 1.56 times distance, and a 16 mm camera-plus-target lateral shift; FOV, aspect, object geometry, and desktop framing remain unchanged. It preserves visible sidewall thickness, yields LOD2 `19.124706775338232 px`, and gives subject CSS margins `6 / 4 / 122.09 / 83.06 px` left/right/top/bottom. The rejected trials cost focused browser runs but prevented both a false rounded pass and a cropped mobile deliverable.
- Runtime dark-sector ruling: the near-black fan was not AO or KTX damage. Runtime raycasts identified the underside triangle of `plate/heaven`; the timeline rotated an exported XZ plate around Z, flipping its underside toward the camera. In-plane rotation is now around Y. The initial shared-material/AO hypothesis cost one diagnostic export plus triangle/raycast inspection; no atlas gate was weakened and no binary was patched.
- Tangents: textured LODs export explicit tangents for every normal-mapped primitive, with triangulation frozen across all beveled runtime nodes. The untextured graybox does not request tangents, eliminating irrelevant exporter warnings there.
- Atlas: the original microface ceiling is restored to `2e-7 m2`. Missing owners must be individually enumerated and proven no larger than the ceiling; aggregate missing area remains bounded. Final LOD0 and LOD2 each have 4,037 islands, 4,036 represented owners, and only microface owner 1348 as the allowed exception.
- KTX2: asset-only `alktx2==0.1.7` is hash-pinned to Windows wheel SHA-256 `a0952acacaeb7de1ef15e157fcf9de368eabe687fb1d358d50fd5c3a05c6cb05`. Color slots are ETC1S/BasisLZ; normal/ORM data slots are UASTC/Zstd. The NSIS installer was not run and no runtime dependency was added.
- Replacement: the compressor writes a same-directory candidate and calls rename-replace only after transformation succeeds. An injected interruption test proves the original remains and the candidate is removed. This report calls it rename-replace atomicity, not atomic copying.
- Validation: committed KTX2 identifiers and headers are parsed. Every Basis texture requires `vkFormat=0`; DFD color model `163` plus supercompression scheme `1` is required for ETC1S color slots, while DFD color model `166` plus scheme `2` is required for UASTC/Zstd data slots. A synthetic valid-identifier file with `vkFormat=37` and scheme `2` is explicitly rejected, so MIME, `KHR_texture_basisu`, or scheme alone cannot pass.
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
| `c09b3be` | `feat: ship redesigned daliuren artifact assets` | Rebuilt binaries, atlases, 15 renders/manifests, benchmark JSON, and the round-1 report. |

### Independent-review repair round 2

| Commit | Subject | Scope |
| --- | --- | --- |
| `0cc75a1` | `fix: harden artifact verification evidence` | Raw floating-point projection contract, minimal same-sightline camera correction, pure-canvas LOD capture/metrics, and KTX2 `vkFormat`/DFD validation with RED fixtures. |
| `63a018c` | `docs: record artifact verification round two` | Three committed pure-canvas PNGs, hardware benchmark JSON, runtime evidence index, and the round-2 report. |

### Independent-review repair round 3

| Commit | Subject | Scope |
| --- | --- | --- |
| `abc375e` | `fix: keep mobile artifact inside canvas` | Portrait-only camera framing, true-vertex 24-glyph edge-margin metric, subject-margin gate, initialization ordering, and RED/GREEN tests. |
| round-3 evidence commit (this commit) | `docs: record artifact verification round three` | Corrected pure-canvas LOD2 PNG, final hardware benchmark JSON, runtime evidence index, and this updated report. |

## Reproducible generation and validation

### Asset encoder and focused toolchain

```text
npm run asset:install-python-tools
python -m pip show alktx2
node --test scripts/compress-daliuren-glbs.test.mjs scripts/validate-daliuren-glb.test.mjs scripts/benchmark-artifact-policy.test.mjs
python -m unittest tools/python/test_encode_ktx2.py
```

Result: PASS. `alktx2 0.1.7` is installed only for asset tooling from the hash-pinned requirements file. Final Node toolchain run: 30/30 in 424.320 ms. Python: 3/3. Tests cover color/data encoding assignment, real KTX2 `vkFormat`/DFD/supercompression parsing, rejection of the `vkFormat=37` + scheme-2 false positive, same-directory rename replacement and interruption recovery, local component bounds, graybox/LOD triangle ceilings, and recognized-hardware benchmark policy.

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

Result: PASS, 3/3 in 1.5 min. Every capture is read directly from the WebGL `HTMLCanvasElement` on the next rendered animation frame. The mobile tool drawer is closed first, but DOM pixels cannot enter the PNG in any case. The same gate derives the artifact subject rectangle from columns/rows containing at least five foreground pixels, evaluates mean luminance, standard deviation, 5–95% range, and subject-region near-black fraction `<0.18`, and requires at least 4 CSS px of subject clearance on every edge. A separate true-mesh projection requires all 24 functional glyphs to remain at least 4 CSS px from every canvas edge.

| LOD | Raw branch minimum / floor; branch edge minimum | Canvas, subject rectangle, and CSS margins L/R/T/B | Visible-face metrics | Committed evidence and observation |
| --- | --- | --- | --- | --- |
| LOD0 | `29.26424553334844 / 20 px`; edge `202.4384677565314 px` | `951 x 760`; `x=38..832, y=174..755`; `38.02 / 119.06 / 174.09 / 5.00 px` | mean `0.69235`, stddev `0.27033`, range `0.70196`, near-black `0.05767` | `docs/asset-reviews/runtime/runtime-lod0-canvas.png`: whole desktop artifact, continuous plate, readable rings, material separation, no DOM overlay or dark fan. |
| LOD1 | `20.012207523729835 / 20 px`; edge `138.4365307799565 px` | `672 x 520`; `x=37..579, y=119..516`; `37.00 / 93.00 / 119.00 / 4.00 px` | mean `0.69982`, stddev `0.26691`, range `0.67843`, near-black `0.05398` | `docs/asset-reviews/runtime/runtime-lod1-canvas.png`: stable functional rings and surface response, no blank atlas region, DOM overlay, or black sector. |
| LOD2 | `19.124706775338232 / 18 px`; edge `56.59019821387625 px` | `344 x 506`; `x=6..340, y=122..423`; `6.00 / 4.00 / 122.09 / 83.06 px` | mean `0.71917`, stddev `0.25706`, range `0.69020`, near-black `0.06642` | `docs/asset-reviews/runtime/runtime-lod2-canvas.png`: complete square base and sidewalls remain inside the portrait canvas; center disk, functional ring, lessons, and transmissions are visible without DOM obstruction or a dark sector. |

All three committed PNGs were opened locally at original detail. The first attempted direct `canvas.toDataURL()` read happened before the WebGL frame and produced a blank RED capture; deferring the read to the next animation frame produced visible evidence. Independent review then correctly found that the earlier LOD2 subject rectangle `x=0..344` proved horizontal cropping despite passing brightness checks. The new 4 CSS px subject-margin RED failed at `0 px`; the corrected portrait framing produces the GREEN evidence above. Those diagnoses cost focused browser runs and did not require a model or texture rebake.

## Complete application gate

```text
npm test
npm run build
npm run test:asset-runner
npx playwright test
npm run benchmark:artifact
```

Results:

- `npm test -- --reporter=dot`: PASS, 56 files / 626 tests in 30.73 s. The focused Controller/Experience subset passed 55/55, including the `19.99` projection rejection, portrait-camera initialization, and 24-glyph edge-margin contract.
- `npm run build`: PASS, TypeScript + Vite, 113 modules, 2.15 s.
- `npm run test:asset-runner`: PASS, 5/5 in 5.282 s, including real Blender failure propagation and save/reopen.
- First full Playwright repair run: 39/41 in 3.5 min. Two scenarios reached their final click at 30.2/30.3 s under seven-worker GPU contention; neither failed an assertion. Focused RED diagnosis ran the complete scenarios in 26.3/27.6 s and passed 2/2.
- After the isolated 60-second total-budget change, round-1 focused GREEN was 2/2 in 55.1 s. The final round-3 focused pure-canvas/projection run passed 3/3 in 1.5 min, and final full Playwright passed 41/41 in 2.9 min.
- The round-3 settled-canvas scenario retained the unchanged real 30-second byte-stability hold. LOD0/1/2 KTX2 loads, raw true-vertex projection floors, four-edge subject/glyph clearance, pure-canvas visible-face metrics, reduced motion, annotations, text round trips, 404 fallback, and WebGL-context-loss fallback all passed.
- `npm run benchmark:artifact`: PASS on recognized NVIDIA hardware; details below.

## Hardware benchmark

- Browser: Google Chrome `152.0.7977.64`, channel `chrome`.
- Renderer, both profiles: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- `hardwareRenderer=true`; no SwiftShader, llvmpipe, software, unknown, or unavailable renderer was accepted.
- Desktop: 1920 x 1080, DPR 1, LOD0, GLB 16,159,520 bytes, canvas 952 x 760, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 8.4 ms, threshold 60 FPS, PASS.
- Mobile: 390 x 844, DPR 3, LOD2, GLB 9,360,792 bytes, canvas 1036 x 1519, 300 samples, median 4.2 ms / `238.0952 FPS`, p95 4.3 ms, threshold 30 FPS, PASS.
- Evidence: `docs/asset-reviews/runtime/benchmark.json`, generated at `2026-08-30T15:47:59.297Z`.

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
- Runtime evidence: `docs/asset-reviews/runtime/benchmark.json`, `docs/asset-reviews/runtime/README.md`, and three committed pure-WebGL-canvas PNGs for LOD0/1/2.
- Process evidence: this report and the repair-round Rulings in `progress.md`.

## Self-review

- Scope: changes are limited to Task 8 geometry/pose sources, runtime visibility/projection, asset pipeline/validators/tests, generated assets, and their evidence. No publish, push, merge, NSIS install, runtime dependency, or unrelated refactor occurred.
- Provenance: every `.blend`, `.glb`, atlas, and review PNG was generated by the documented commands. No binary was hand-edited.
- Geometry: graybox 25,022 <35,000; LOD counts and `0.52 x 0.092 x 0.52 m` bounds pass. Calendar, plate rotation, individual slips/seats, recess raycasts, containment, separation, and stage differences are source-tested and visually inspected.
- Projection/presentation: actual mesh vertices are measured and exposed without rounding. Final LOD0/1/2 minima are `29.26424553334844`, `20.012207523729835`, and `19.124706775338232 px`; all meet their unchanged 20/20/18 px floors. The desktop camera moved only 0.6% along the existing sightline after the raw LOD1 result exposed a real shortfall. Portrait-only elevation/distance/lateral framing keeps the complete LOD2 subject at least 4 CSS px inside the canvas while all 24 glyph meshes remain at least `56.59019821387625 px` inside. Task 7 protected-frame and annotation non-overlap tests pass.
- Textures: deterministic pin/hash, exact ETC1S/UASTC slot policy, `vkFormat=0`, DFD color-model validation, explicit tangents, `2e-7 m2` owner exceptions, frozen comparisons, browser loads, and file/texture budgets all pass.
- Visual quality: 15/15 final renders and 3/3 committed pure-canvas runtime LOD frames were inspected. Round 2's statement that no cropped rejection condition remained was incorrect: its LOD2 bounds touched both horizontal edges. The corrected LOD2 image contains the full square base and visible sidewalls with 6/4 CSS px horizontal clearance; no unreadable, cropped, dead-black, flat, mechanical-wing/rail, coplanar, floating, or DOM-obscured rejection condition remains in the final evidence.
- Verification: unit, build, asset-runner, Node/Python toolchain, all Blender suites, four validators, frozen atlas, fixed lookdev, full 41 browser tests including the real 30-second hold, and recognized-hardware benchmark pass.

## Concerns / non-blocking observations

- LOD1 intentionally uses the LOD0 atlas authoring tree, so no duplicated `assets/daliuren/textures/lod1` PNG directory is generated. This behavior is explicit, validated, and browser-tested.
- Blender's glTF exporter still prints its pre-existing generic validity warning for generated cube/cylinder source meshes during the isolated LOD test. The exported files have 0 validator errors, load in Chrome for all LODs, retain explicit tangents, and pass visual/stability gates; no malformed runtime primitive was observed.
- Vite prints the existing advisory that the main minified chunk exceeds 500 kB. It is unrelated to the asset budgets and does not affect measured FPS.
- The HTML report remains ignored local scratch, but it is no longer the sole visual evidence: the three reviewed pure-canvas PNGs are committed under `docs/asset-reviews/runtime/` and are reproducible through the committed e2e gate.

## Repository hygiene

Both automatic Blender backups were resolved to absolute paths inside this worktree and removed:

```text
assets/daliuren/source/daliuren-artifact-graybox.blend1
assets/daliuren/source/daliuren-artifact-master.blend1
```

They are not recoverable as backups, but both canonical `.blend` files are reproducibly generated by the commands above. Final `git diff --check` passed. The generated-deliverables commit uses the exact required subject `feat: ship redesigned daliuren artifact assets`; the round-2 and round-3 evidence commits are documentation/evidence-only. Final tracked status is clean; ignored local Playwright scratch is not part of the deliverable.
