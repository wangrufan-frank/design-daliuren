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
| real edge thickness | overall / oblique | PASS — plate rims, moving panels, and inlay beds retain separated silhouettes and contact shadows. |
| continuous moving highlight | rotation-evidence | PASS — the 0° / 60° heaven-plate views move glyphs and specular highlights while the fixed base and lighting remain unchanged. |
| bronze/celadon reflection difference | material-closeup | PASS — bronze reads warmer and sharper than the broader, cooler celadon reflection. |
| contact-driven wear | oblique / material-closeup | PASS — wear follows exposed rims and seams without flattening the face colors. |
| recess oxidation | oblique / material-closeup | PASS — dark oxidation stays inside the clean recessed beds with no sliver or coplanar artifacts. |
| readable functional inscription | overall / material-closeup | PASS (mean=0.383, dark=0.018, contrast=10.04) |
| lower-contrast historical inscription | overall / material-closeup | PASS — historical marks remain intentionally subordinate to the bright 24 functional branch glyphs. |
| grounded contact shadow | overall / oblique | PASS — every visible layer and deployed panel casts a stable contact shadow; no broad face renders dead black. |

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `assets/daliuren/source/daliuren-artifact-master.blend` | `286416d53a0f7f67fba65f0c1565ff3a5a9f74ad77bcb2268e03ceae685de615` |
| `public/models/daliuren/daliuren-artifact-lod0.glb` | `1978c061070f189eb04d9e682b00011b860127422a51aaa98a5426ccab119c2e` |
| `public/models/daliuren/daliuren-artifact-lod1.glb` | `7e659323dbeade43f0b4d4f6672c1d8e9e7e8aa8cac3eb5e63e369f87b4702f7` |
| `public/models/daliuren/daliuren-artifact-lod2.glb` | `388bf89cd3c4988ff143be07b75a01091f12f658bd2ce0023e49bb9d87010050` |
| `docs/asset-reviews/lookdev/overall.png` | `1bc33c8acd071c7dbb6cc2734a5e39cf7aa8f2c44c31dd7fa5f090cf260cf48b` |
| `docs/asset-reviews/lookdev/oblique.png` | `bf91edcb1f528b0109f7cca5ec0012b1485fc85e3714a40868a3ee19e5ac51a5` |
| `docs/asset-reviews/lookdev/material-closeup.png` | `d8ac7a15cc46cf5424cb0b1fd1071b80d90f61039b6c4ba472484e0486e43dc2` |
| `docs/asset-reviews/lookdev/rotation-evidence.png` | `23f2d0f59f3699b193d9a64a44ea0e8740cfe35eb845eea43e43461a4add9c26` |
| `docs/asset-reviews/lookdev/legibility.png` | `1eb2f89a63a30fb177b289a23d1dee695e4bc27acbd1fbbc0e1607a6c760172b` |
