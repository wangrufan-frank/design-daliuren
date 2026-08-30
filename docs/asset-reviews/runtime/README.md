# Artifact runtime evidence

Recorded on 2026-08-30 with system Google Chrome `152.0.7977.64` on the `chrome` Playwright channel. The browser reported `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)`. The exact benchmark output is preserved in [`benchmark.json`](./benchmark.json).

## GLB identity

| LOD | Bytes | SHA-256 |
| --- | ---: | --- |
| `daliuren-artifact-lod0.glb` | `16,159,520` | `f3860779e53ab0a3419870f873a241836dcb61d582b99ad325a663035fe2d116` |
| `daliuren-artifact-lod1.glb` | `14,830,456` | `2ff55e9f2dc488fe809247d6c56478cb77b1709fce3ad9481156601fb2745213` |
| `daliuren-artifact-lod2.glb` | `9,360,792` | `3e7a7fa918391065fadaab66c7f959b5a3094ecb4c0b4901d3d495c2068862f6` |

The hashes were rechecked locally with `Get-FileHash -Algorithm SHA256` after the final source export. All three production GLBs pass the validator's KTX2 `vkFormat=0`, DFD color-model, and supercompression-scheme policy and load in Chrome.

## Hardware benchmark

Each profile was loaded from an isolated benchmark build served by a Vite preview server owned by the benchmark script. The final `12,500 ms` pose was reached before exactly `300` frame intervals were collected through the benchmark-only frame observer. Empty, unknown, software, SwiftShader, and llvmpipe renderer strings are rejected before sampling.

| Profile | Viewport / DPR | Canvas pixels | Selected asset | Median frame | p95 frame | Median FPS / threshold | Result |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| desktop | `1920 x 1080` / `1` | `952 x 760` | LOD0 / `16,159,520` bytes | `4.2 ms` | `8.4 ms` | `238.0952 / 60` | PASS |
| mobile | `390 x 844` / `3` | `1036 x 1519` | LOD2 / `9,360,792` bytes | `4.2 ms` | `4.3 ms` | `238.0952 / 30` | PASS |

Both profiles reported `hardwareRenderer: true` for the NVIDIA/D3D11 renderer.

## Pure WebGL canvas evidence

The three PNGs below are read directly from `HTMLCanvasElement` on the next rendered animation frame. No DOM, annotation, timeline, or tool-drawer pixels can enter them; the mobile drawer is also closed before capture. The subject rectangle is derived from canvas pixels that differ from the known scene background, and every LOD uses the same capture and metric path.

| LOD | Raw minimum branch projection | Minimum branch edge margin | Canvas | Subject rectangle; CSS margins L/R/T/B | Mean / standard deviation | 5–95% range | Near-black ratio | Evidence |
| --- | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| LOD0 | `29.26424553334844 px` (floor `20`) | `202.4384677565314 px` (floor `4`) | `951 x 760` | `x=38..832, y=174..755`; `38.02 / 119.06 / 174.09 / 5.00 px` | `0.69235 / 0.27033` | `0.70196` | `0.05767` | [`runtime-lod0-canvas.png`](./runtime-lod0-canvas.png) |
| LOD1 | `20.012207523729835 px` (floor `20`) | `138.4365307799565 px` (floor `4`) | `672 x 520` | `x=37..579, y=119..516`; `37.00 / 93.00 / 119.00 / 4.00 px` | `0.69982 / 0.26691` | `0.67843` | `0.05398` | [`runtime-lod1-canvas.png`](./runtime-lod1-canvas.png) |
| LOD2 | `19.124706775338232 px` (floor `18`) | `56.59019821387625 px` (floor `4`) | `344 x 506` | `x=6..340, y=122..423`; `6.00 / 4.00 / 122.09 / 83.06 px` | `0.71917 / 0.25706` | `0.69020` | `0.06642` | [`runtime-lod2-canvas.png`](./runtime-lod2-canvas.png) |

Local original-resolution inspection found no timeline/callout contamination and no near-black fan in any image. LOD0 preserves the whole desktop artifact and material hierarchy; LOD1 preserves the functional rings and stable surface response. The corrected portrait LOD2 frame contains the complete square base and its sidewalls with `6 px` left and `4 px` right CSS clearance; the center disk, functional branch ring, lessons, and transmissions remain readable. The tests independently require at least `4 CSS px` around both the detected artifact subject and every projected vertex of all 24 functional glyph meshes.

## Browser behavior

The final full Playwright run passed `41/41` in `2.9 min`. Projection values are exposed and asserted as raw floating-point measurements: `19.99` is explicitly rejected by the desktop `20 px` floor. The settled-canvas scenario loads LOD0, LOD1, and LOD2, applies the same pure-canvas visibility metrics, and performs the unchanged real `30 s` byte-stability hold. Text-course semantics, deterministic seeking, pointer takeover, reduced motion, annotation protection, routed-GLB failure fallback, and WebGL-context-loss fallback also pass.

Production builds do not expose the pose hash, source-line diagnostic, or frame observer. Only Vite development/test builds and the isolated benchmark-mode build enable those diagnostics.
