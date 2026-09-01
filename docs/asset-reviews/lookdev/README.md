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
| readable functional inscription | overall / material-closeup | PASS (mean=0.566, dark=0.002, contrast=4.81) |
| lower-contrast historical inscription | overall / material-closeup | PENDING |
| grounded contact shadow | overall / oblique | PENDING |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `f6346c9a252b80534fa923ac99fa7c2c241e70be4ae7e5d811e2c7f41e4c54a2` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `5d4d92d4a7f9fe04514cd5966d8dfb99fcf64ea95e0925507431c03e01d3894b` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `9d7bcb954c655b9ab6a92ecbc335ffeed27b877122a71549c34d3fa0d45cdf00` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `b53ba4d28aef60123cbc07e42d01c96635a5db99f1609437748c7d9e2fd33b71` |
| `docs/asset-reviews/lookdev/overall.png` | `4bb782b9606ce1922e4d1492bb76d3b645b0eb5ad4308e7793db07dee9d1c022` |
| `docs/asset-reviews/lookdev/oblique.png` | `291e9f5dd79124badf7b940da97fea5ac334a165ec1f5a0c0f6fd41e2c0d732e` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `334a0fee7da1d4d6a544dc3721db59d4eeb5a4f973b4a094158b48b9f2c122ff` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `2262a85de5180fa7d8dd868cc540fc3d6ba3203f747f870f6eb1a05cc3ccaa74` |
| `docs/asset-reviews/lookdev/legibility.png` | `b3afbde3738c0331372646eefcd55e48f29521f143bc7617b84e0bbd932ec56b` |
