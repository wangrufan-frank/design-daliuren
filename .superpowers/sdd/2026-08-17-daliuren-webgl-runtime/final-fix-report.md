# WebGL runtime final fix report

Recorded on 2026-08-21 for the six findings in `final-review-findings.md`.

## Fixes

| Finding | Resolution |
| --- | --- |
| Applied controller state | The controller now applies node transforms, course-copy opacity and source-line geometry/material state, general ordering/direction, and camera auto-rotation to owned Three.js objects. Development/E2E diagnostics are snapshots of that applied state, not evaluator output. Production builds omit the diagnostic attributes and frame observer. |
| Indexing failure disposal | `loadArtifact` disposes a successfully loaded `gltf.scene` when semantic indexing throws, then preserves the indexing error as the public load error cause. |
| React mapping failure | `CourseExperience` catches inconsistent artifact mapping before render, disables 3D mode, and reaches the existing ordinary-text course fallback. |
| Exact domain facts | Artifact mapping and accessible labels preserve the month-general branch, each lesson's `lookupEarth`, and the noble day/night value. Controller textures use those same values. |
| Viewport LOD | Runtime LOD selection uses viewport width and DPR. The benchmark policy requires desktop `1920 x 1080` / DPR `1` to load the current LOD0 artifact. |
| Resize lifecycle | A `ResizeObserver` now keeps canvas dimensions current and is disconnected idempotently on rejection, runtime failure, and unmount. |

The general deployment stage also follows `generalSequence` and `generalDirection` in twelve sequential slots; its direction path is visible only while deployment is in progress. Controller-owned copy, source-line, direction-line, texture, material, and geometry resources are disposed once.

## RED to GREEN evidence

Each finding was reproduced before implementation:

- Controller tests first failed because copy/source/direction objects and applied-state diagnostics did not exist; the disposal test subsequently exposed double disposal, and the pre-deployment test exposed a prematurely visible direction path.
- Timeline sequencing first produced a partial first-general rise instead of one completed slot followed by an untouched second general.
- Load cleanup first observed zero disposals after an indexing exception.
- The React fallback test first surfaced the mapping exception during render.
- Mapping/accessibility tests first observed missing branch, lookup-earth, and noble day/night values.
- Viewport LOD first selected LOD1 for a desktop viewport whose canvas was narrower, the benchmark policy expected the old LOD1 profile, and the resize test observed no observer instance.

After the minimal runtime changes, the focused suite passed:

```text
npx vitest run src/features/artifact-scene/model/map-artifact-state.test.ts src/features/artifact-scene/timeline/evaluate-pose.test.ts src/features/artifact-scene/three/load-artifact.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/ArtifactExperience.test.tsx src/features/course-experience/CourseExperience.test.tsx
6 test files passed, 74 tests passed

node --test scripts/benchmark-artifact-policy.test.mjs
3 tests passed
```

## Final verification

| Command | Result |
| --- | --- |
| `npm test` | PASS — 41 files, 527 tests |
| `npm run build` | PASS — 91 modules transformed; only the existing Vite chunk-size warning |
| production `dist` search for `data-pose-hash`, `data-source-lines`, and `__artifactFrameObserver` | PASS — no markers present |
| `npm run test:e2e -- e2e/artifact-experience.spec.ts` | PASS — 5 tests in 35.2 s |
| `npm run test:e2e` | PASS — 27 tests in 37.2 s |
| `npm run benchmark:artifact` | PASS — headed system Chrome, hardware renderer, 300 samples per profile |

The targeted E2E asserts the exact values `神后子`, lesson lookup earth `酉`, and noble day/night value `昼贵丑` in the model's accessible facts and the ordinary-text fallback. It also proves repeatable applied pose state, applied controller camera state after a real pointer drag, applied source-line state under normal/reduced motion, GLB 404 fallback, and WebGL-context-loss fallback.

## Fresh hardware benchmark

- Browser: Google Chrome `151.0.7922.172`, headed `chrome` channel.
- Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`; `hardwareRenderer: true`.
- Desktop: `1920 x 1080`, DPR `1`, LOD0, `26,200,872` bytes, 300 samples, median/p95 `4.2 / 4.2 ms`, median `238.0952 FPS`, threshold `60 FPS`, PASS.
- Mobile: `390 x 844`, DPR `3`, LOD2, `11,582,128` bytes, 300 samples, median/p95 `4.2 / 4.2 ms`, median `238.0952 FPS`, threshold `30 FPS`, PASS.

Fresh SHA-256 checks of the current artifacts:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `daliuren-artifact-lod0.glb` | `26,200,872` | `d000bd05b1279a42bc8dc4d4e710764c542d34bd9833d0445bef799903824482` |
| `daliuren-artifact-lod1.glb` | `24,437,884` | `c064776cae6ee4bda122d12e9f45b711365868cbc161551fd132b60d981894ce` |
| `daliuren-artifact-lod2.glb` | `11,582,128` | `74ebd8afa572fdec0f217e77c441c4dabf26d12b765e89104020bec4b8166a2a` |

The machine-readable run is in `docs/asset-reviews/runtime/benchmark.json`.

## Honest concern

Cold Playwright loads on this machine sometimes spend roughly 6–10 seconds decoding the first GLB/KTX2 asset. The E2E readiness assertion therefore uses a bounded 15-second condition rather than a fixed sleep. Runtime behavior and the hardware thresholds pass, but cold-start asset latency remains worth watching separately from steady-state frame performance.
