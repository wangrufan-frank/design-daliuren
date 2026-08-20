# Daliuren Artifact Lookdev Review

## Render manifest

- Blender: `4.5.12 LTS`
- Engine: `CYCLES`
- Samples: `64`, Cycles denoising enabled
- Color management: `AgX`, `AgX - Medium High Contrast`
- Lighting: `4300 K` key, `30%` fill, narrow rectangular rim; material close-up uses a local `-1 EV` / reduced-energy setup
- Resolution: `2560 x 1440` PNG, opaque background, bloom disabled

## Review frames

### overall

![overall](./overall.png)

### oblique

![oblique](./oblique.png)

### material-closeup

![material-closeup](./material-closeup.png)

### rotation-evidence

![rotation-evidence](./rotation-evidence.png)

Manual inspection at native `2560 x 1440` on 2026-08-21:

| Frame | Result | Observed evidence |
| --- | --- | --- |
| overall | PASS | Full silhouette, physical plate and base thickness, weight, readable functional marks and a grounded contact shadow. |
| oblique | PASS | Bevel highlights remain continuous across the rim, rails, dovetails, stops, seams and polished contact edges. |
| material-closeup | PASS | Controlled exposure separates dark bronze, green patina, pale celadon and warm old-gold; the black/green physical contact seam remains visible without clipped highlights. |
| rotation-evidence | PASS | Fixed-camera 0/60-degree states show highlight and inscription migration with consistent occlusion and no texture crossing. |

## Visual evidence

| Evidence | Frame | Result |
| --- | --- | --- |
| real edge thickness | overall / oblique | PASS |
| continuous moving highlight | rotation-evidence | PASS |
| bronze/celadon reflection difference | material-closeup | PASS |
| contact-driven wear | oblique / material-closeup | PASS |
| recess oxidation | oblique / material-closeup | PASS |
| readable functional inscription | overall / material-closeup | PASS |
| lower-contrast historical inscription | overall / material-closeup | PASS |
| grounded contact shadow | overall / oblique | PASS |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `78cadcfcf27c97bbe62831124c3daa5a2397c9fdde4613bb685143ed3186ba0e` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `f11c44864d44054d34c285cbbb4b96e47c8bb279269730c4cf7097e252bf6366` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `52b9b23fab2b833720f2d6895d23f1241718b8f40b39c73cb2dc50b97051c994` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `2245aa3d6f9525b3654c33a11bcfa87b632780c50967aac60de5d0548ef45083` |
| `docs/asset-reviews/lookdev/overall.png` | `2c30496395e26a9f9b264e75e7f9ff086f00b6559ed5ec14af556a903dac754f` |
| `docs/asset-reviews/lookdev/oblique.png` | `5336b978517950f6a0491be52ee0e202d0ac6873cfe67a5dd23b70ef727fd723` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `c586559cc761e827da8e6946df624533e63896f45368f89b2b03715314a18d82` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `6f8eeeaae4f90adeb81159cd66c543c33565a93bf894088ee25d30ac752494cc` |
