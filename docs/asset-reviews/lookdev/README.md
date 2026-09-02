# Daliuren Artifact Lookdev Review

## v10 runtime fidelity review — 2026-09-02

Status: **NOT A FULL-FIDELITY PASS.** The production scene now uses a calibrated
`2048 x 2048` v10 outer-board albedo and normal on the real `6 mm` square jade
plate. The photographed interaction circle and pearls are removed from that
material, while the functional branch, month-general, and general rings remain
independent geometry. The former voxel zodiac/cloud carriers are absent in all
three LODs, and every exposed heaven-ring carrier now owns the same untextured
warm-white jade material, eliminating the dark radial sectors. Five continuous
gold ring grooves, four pearl seats, larger Beidou points and a brighter center
pivot provide the visible local craft without changing the interaction state.

The current overlay no longer has the former dominant rotational double image,
but it still shows objective residuals: the outer silhouette and circular plate
have faint scale/position double edges measured in visible pixels, the
functional glyph proportions/strokes and baselines differ, and the central ring
depths and material response remain flatter than v10. These prevent a
comprehensive-fidelity claim.

Focused evidence:

- `jade-plate-default.png`: authored desktop pose, `1254 x 1254` canvas.
- `jade-plate-overlay.png`: exact 50% cover-fit blend against the user v10
  reference. The frozen physical-camera anchor calibration reports `7.89 px`
  combined RMS: board `6.40 px`, dial center `3.03 px`, pearls `2.79 px`,
  Beidou `3.02 px`, rim `9.45 px`, branches `11.18 px`, month generals
  `6.80 px`, and heavenly generals `8.19 px`. These are geometry-anchor
  measurements, not a pixel-fidelity score; forcing every hand-measured glyph
  group below `5 px` would require non-circular per-glyph distortion and would
  break palace alignment.
- `jade-plate-mobile.png`: completed portrait pose. Runtime must reframe after
  an orientation change and keep the minimum earthly-branch projection at
  least `8 CSS px` without cropping the square plate.

The hidden inlay construction cannot be recovered from one photograph. The
model therefore retains the approved `4 mm` inlay thickness and `IOR 1.48` as
explicit physical assumptions.

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
| `assets/daliuren/source/daliuren-artifact-master.blend` | `01085c2fc5a786e7022384f94ee4143fdc456bf0256b47e3ca9d144f2face1aa` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `7b84574393c79ce17ce6806f29bbb46ec942a7a8e795f6885d60de9e844d3161` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `3b276b5da9f331820f92da2baf71f80ac944ba62179cc74b2f58e4f60db327af` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `8e63642c56a2483a598539a5ecb20bd38ceeafad1646b642652b66f30bbe516e` |
| `assets/daliuren/textures/source/outer-board-v10-albedo.png` | `8e796ac000389ca7064044202e26272d1582efcc8ebbed03a410bfec84ced90e` |
| `assets/daliuren/textures/source/outer-board-v10-normal.png` | `e56019bf2ac367b3638fdbdfd24e62480f2a06c15627581cbd547d6d08208b09` |
| `docs/asset-reviews/lookdev/overall.png` | `a6da57ba62e4654da33967b9079695e8f921e434b62f255209e1ca8d62b955b9` |
| `docs/asset-reviews/lookdev/jade-plate-default.png` | `64b243678358e545254ad234a6eacd93558d4a1dea0a094fa1e5d1785df3bb82` |
| `docs/asset-reviews/lookdev/jade-plate-mobile.png` | `4630ee1c007f76336385b56d858190021eb3a16032806d1e297b09037ff98536` |
| `docs/asset-reviews/lookdev/jade-plate-overlay.png` | `de5b32d89b43105ecf3fe31585e607f1fa27cb55b9f72f81ef37e26a7db00632` |
| `docs/asset-reviews/lookdev/oblique.png` | `5e1b2697587fc912886e83516bd0df0dc45a44db8c8f1c42fc86df3e1ed09e30` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `0fc672b83ce8d81a3414f458ab60ac5eabdb63607c1bef77d8a052c6e636a7e7` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `71ed31d541d1f55698483c3bd6cfd85dabb56df688b0ab45d157ecf25aa2c60d` |
| `docs/asset-reviews/lookdev/legibility.png` | `97f75617168d49eef1119867cca58ab0c2c946bfdf6d57e43b0772a2583f50f7` |
