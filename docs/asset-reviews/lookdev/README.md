# Daliuren Artifact Lookdev Review

## v10 runtime fidelity review — 2026-09-02

Status: **NOT A FULL-FIDELITY PASS.** The production scene now uses real zodiac
and cloud relief geometry in every LOD, not the retired whole-board artwork
projection. The calibrated overlay is materially closer and no longer has the
previous dominant board/ring double image, but local text shapes, zodiac edge
fidelity, cloud carving, and material response still differ visibly from v10.

Focused evidence:

- `jade-plate-default.png`: authored desktop pose, `1254 x 1254` canvas.
- `jade-plate-overlay.png`: exact 50% cover-fit blend against the user v10
  reference; calibrated combined RMS is `9.61 px`.
- `jade-plate-mobile.png`: completed portrait pose. Runtime must reframe after
  an orientation change and keep the minimum earthly-branch projection at
  least `8 CSS px` without cropping the square plate.

This review does not convert the legacy PENDING rows below into PASS results.

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
| readable functional inscription | overall / material-closeup | PENDING (legacy metric invalidated by regenerated runtime frame) |
| lower-contrast historical inscription | overall / material-closeup | PENDING |
| grounded contact shadow | overall / oblique | PENDING |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `69870f3279666e3f9ba66108b14a72dae93ae69fb5f5e77df833ddae93e47e24` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `ca2db1c1288a798e67e1018e1a52926aeb48f2997ffa9fcbe667eac0d69c0a88` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `f0576491bf19d04237f96ce1a226db7928aa5a16ae90d8e0dc9a6005ad18c5c3` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `3fbdbc16343a75d31e2688fa62b40bdf45cf16f278e0781c0d622aaa66345870` |
| `assets/daliuren/textures/source/zodiac-relief-artwork.png` | `ee72a3396cc348ac46670d92c11f71d3cba595cd1e926d33befe2589bc56f7a1` |
| `docs/asset-reviews/lookdev/overall.png` | `b8b8fbfa1feb140f590a3c8d6422b6195dc6e0210659e0e450db932845a55260` |
| `docs/asset-reviews/lookdev/jade-plate-default.png` | `e5eae02a845ebe263b79fb6ffc9f2da255f6e2f78c6c36c2afddeee2eedda468` |
| `docs/asset-reviews/lookdev/jade-plate-mobile.png` | `7e82fbdcaec166f2f24d31d6c0cce89f965807222203e1d4978ef97b26c87bfb` |
| `docs/asset-reviews/lookdev/jade-plate-overlay.png` | `55b1fa89ceaa902ebc29d8b4e0e5872dabee415d9978447279d3d0349386dd40` |
| `docs/asset-reviews/lookdev/oblique.png` | `5e1b2697587fc912886e83516bd0df0dc45a44db8c8f1c42fc86df3e1ed09e30` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `0fc672b83ce8d81a3414f458ab60ac5eabdb63607c1bef77d8a052c6e636a7e7` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `71ed31d541d1f55698483c3bd6cfd85dabb56df688b0ab45d157ecf25aa2c60d` |
| `docs/asset-reviews/lookdev/legibility.png` | `97f75617168d49eef1119867cca58ab0c2c946bfdf6d57e43b0772a2583f50f7` |
