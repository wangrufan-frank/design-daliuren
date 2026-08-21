# Artifact runtime evidence

Recorded on 2026-08-21 with system Google Chrome `151.0.7922.172` on the `chrome` Playwright channel. The browser reported `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`. The exact passing output is preserved in [`benchmark.json`](./benchmark.json).

## GLB identity

| LOD | Bytes | SHA-256 |
| --- | ---: | --- |
| `daliuren-artifact-lod0.glb` | `26,200,872` | `d000bd05b1279a42bc8dc4d4e710764c542d34bd9833d0445bef799903824482` |
| `daliuren-artifact-lod1.glb` | `24,437,884` | `c064776cae6ee4bda122d12e9f45b711365868cbc161551fd132b60d981894ce` |
| `daliuren-artifact-lod2.glb` | `11,582,128` | `74ebd8afa572fdec0f217e77c441c4dabf26d12b765e89104020bec4b8166a2a` |

These hashes were rechecked locally with `Get-FileHash -Algorithm SHA256` and match `docs/asset-reviews/lookdev/README.md`.

## Benchmark profiles

Each profile was loaded from an isolated benchmark build served by a Vite preview server owned by the benchmark script. The final `12,500 ms` pose was reached before exactly `300` frame intervals were collected through the benchmark-only frame observer.

| Profile | Viewport / DPR | Canvas pixels | Selected asset | Median frame | p95 frame | Median FPS / threshold | Result |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| desktop | `1920 x 1080` / `1` | `725 x 680` | LOD1 / `24,437,884` bytes | `4.2 ms` | `4.3 ms` | `238.0952 / 60` | PASS |
| mobile | `390 x 844` / `3` | `946 x 1020` | LOD2 / `11,582,128` bytes | `4.2 ms` | `4.3 ms` | `238.0952 / 30` | PASS |

## E2E behavior

`npm run test:e2e -- e2e/artifact-experience.spec.ts` completed with `5 passed`:

- Model semantic labels and the standard text course both retained `初传` and `贵人`; the semantic list is generated from `ArtifactDisplayState`, never WebGL pixel readback.
- Seeking `8450 -> 0 -> 8450` reproduced the same development pose hash, and a real pointer drag changed `data-auto-camera` to `false`.
- Emulated reduced motion retained `初传 / 中传 / 末传 / 贵人`, disabled auto camera, and reported source lines disabled.
- A real routed GLB `404` reached the existing text course and enabled copy action without another course submission.
- A cancelable `webglcontextlost` event was prevented and reached the same text/copy fallback without another course submission.

The ordinary production build does not expose the pose hash, source-line diagnostic, or frame observer. Only Vite development/test builds and the isolated benchmark-mode build enable those diagnostics.
