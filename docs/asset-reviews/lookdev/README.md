# Daliuren Artifact Lookdev Review

## v10 runtime fidelity review — 2026-09-02

Status: **NOT A FULL-FIDELITY PASS.** The production scene now uses a calibrated
`2048 x 2048` v10 outer-board albedo and normal on the real `6 mm` square jade
plate. The photographed interaction circle and pearls are removed from that
material, while the functional branch, month-general, and general rings remain
independent geometry. The former voxel zodiac/cloud carriers are absent in all
three LODs, and every exposed heaven-ring carrier now owns the same untextured
white-jade material, eliminating the dark radial sectors.

The current overlay still shows objective residuals: the runtime board and dial
are offset and scaled against the reference by visible pixels, the functional
glyph proportions/strokes differ, and the central ring depths and material
response remain flatter than v10. These prevent a comprehensive-fidelity claim.

Focused evidence:

- `jade-plate-default.png`: authored desktop pose, `1254 x 1254` canvas.
- `jade-plate-overlay.png`: exact 50% cover-fit blend against the user v10
  reference. The unchanged anchor calibration reports `9.61 px` combined RMS;
  this is a geometry-anchor measurement, not a pixel-fidelity score.
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
| `assets/daliuren/source/daliuren-artifact-master.blend` | `e0584e0cd6522a515d179d53c74f644dcae98f7e74885f62ec0e71b4259b606e` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `0f2c6c9e0e5a3ff86ae37e3478f712da21ffb42c2668252bea123c509df9280f` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `8fdf2dc5768d987f070dc16fb049ad2d8886008d50c77be20955a84d8a378714` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `4f93eda17042dd61449efa6b957477ebd177c6139bf418c2dbae7a1ea6e5e7e1` |
| `assets/daliuren/textures/source/outer-board-v10-albedo.png` | `22a9e36dad71952de5a3f56f032dea0f514b69a9d9fe20b1d25ae87ce616f27f` |
| `assets/daliuren/textures/source/outer-board-v10-normal.png` | `00fb32c7f6c1210cdda7a289151275eecdd9ba9a6c5660d0fd1297c96cd71592` |
| `docs/asset-reviews/lookdev/overall.png` | `2226fa3d8d587c46e5159f6e1d158c399014e1a2e44e2f63f9475e2ce5540c9e` |
| `docs/asset-reviews/lookdev/jade-plate-default.png` | `20b8daff3b32f2d3b76be016fdd9571c2b217ecb2c4aedbc0ac3bc4ed73a7cdb` |
| `docs/asset-reviews/lookdev/jade-plate-mobile.png` | `4557d2f39ddcb000eb8276bd81305b64f63af36f76c9872220aff1fe71528902` |
| `docs/asset-reviews/lookdev/jade-plate-overlay.png` | `264e561d0adfed38b0801a647bf72f15490533ea25d625d4d192e4b82d1b4f09` |
| `docs/asset-reviews/lookdev/oblique.png` | `5e1b2697587fc912886e83516bd0df0dc45a44db8c8f1c42fc86df3e1ed09e30` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `0fc672b83ce8d81a3414f458ab60ac5eabdb63607c1bef77d8a052c6e636a7e7` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `71ed31d541d1f55698483c3bd6cfd85dabb56df688b0ab45d157ecf25aa2c60d` |
| `docs/asset-reviews/lookdev/legibility.png` | `97f75617168d49eef1119867cca58ab0c2c946bfdf6d57e43b0772a2583f50f7` |
