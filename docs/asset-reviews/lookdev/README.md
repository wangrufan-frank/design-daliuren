# Daliuren Artifact Lookdev Review

## Render manifest

- Blender: `4.5.12 LTS`
- Engine: `CYCLES`
- Samples: `64`, Cycles denoising enabled
- Color management: `AgX`, `AgX - Medium High Contrast`
- Lighting: fixed `4300 K` wide key, `40%` front fill, low rectangular rim
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
| readable functional inscription | overall / material-closeup | PASS (mean=0.512, dark=0.063, contrast=4.17) |
| lower-contrast historical inscription | overall / material-closeup | PENDING |
| grounded contact shadow | overall / oblique | PENDING |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `96576df06c4555502cff124ca537e7944c46c984ac5e41ba687ff0f0b2de7202` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `94b54f1dadf890eb87df5186c37d789372e99ed428c4fb0e6fab17525eec8c4e` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `097a3cde7974ca1c41117bde12882b28f259e8b764d6c07bd99d7c0cd92990dc` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `798e63b3489149b6c4b39d16d0aa828b9cca1cca0889c7e215ce4eac34d96fc6` |
| `docs/asset-reviews/lookdev/overall.png` | `585b9f5244f4a1dd00d57865d30e1f84d274dc246a8f4751bd8e4a725bb000ec` |
| `docs/asset-reviews/lookdev/oblique.png` | `72b6f57f03029978aa4c6655cf2fb3448ce4dd3b27e5035e0af98440e4bc832d` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `c96eeed3d555b024a6d18b9fed971b04b95df37cd57a6d70b62d2166a8905a96` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `84b1e0561eb753d07beb692545bfd3d9dfb97ce484f7172239ee82e01651fff8` |
| `docs/asset-reviews/lookdev/legibility.png` | `0f88e7cc6e2e2b365bd35e8a9a212067eeb1736382538551652a31167c6e6a85` |
