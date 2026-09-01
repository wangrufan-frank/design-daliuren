# Daliuren Artifact Lookdev Review

## Render manifest

- Blender: `4.5.12 LTS`
- Engine: `CYCLES`
- Samples: `64`, Cycles denoising enabled
- Color management: `AgX`, `AgX - Medium High Contrast`
- Lighting: fixed `5200 K` wide key, `40%` front fill, low rectangular rim
- Exposure: fixed `-1.0 EV` for every frame; no animated lights
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

### legibility

![legibility](./legibility.png)

## Visual evidence

| Evidence | Frame | Result |
| --- | --- | --- |
| real edge thickness | overall / oblique | PENDING |
| continuous moving highlight | rotation-evidence | PENDING |
| jade, ink, cinnabar, and old-gold material separation | material-closeup | PENDING |
| contact-driven wear | oblique / material-closeup | PENDING |
| recess oxidation | oblique / material-closeup | PENDING |
| readable functional inscription | overall / material-closeup | PASS (mean=0.567, dark=0.002, contrast=6.14) |
| lower-contrast historical inscription | overall / material-closeup | PENDING |
| grounded contact shadow | overall / oblique | PENDING |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `94ad738528e0a11c0bcf76f4a76398eddd9ca3ef4d4a2ed9b88f9f2ebfc5544e` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `752e11e091ede0b6f57ac61dbf5f9546bde5bfd94c67d6ee3c0dc3972c288db7` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `ddfad5fc04fd9d9998501240dba1afd0c72a038edb3b86edd7dc540310c0a222` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `2e9f2eed714b34a4175f677c4da44ef6c8ab8dd897419dde0aab5f94eab1f8ec` |
| `docs/asset-reviews/lookdev/overall.png` | `d9f5f61ce2c994a8e107cd69ac30c1a2357b40679917e7cc8afd1833077b8a69` |
| `docs/asset-reviews/lookdev/oblique.png` | `5e1b2697587fc912886e83516bd0df0dc45a44db8c8f1c42fc86df3e1ed09e30` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `0fc672b83ce8d81a3414f458ab60ac5eabdb63607c1bef77d8a052c6e636a7e7` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `71ed31d541d1f55698483c3bd6cfd85dabb56df688b0ab45d157ecf25aa2c60d` |
| `docs/asset-reviews/lookdev/legibility.png` | `97f75617168d49eef1119867cca58ab0c2c946bfdf6d57e43b0772a2583f50f7` |
