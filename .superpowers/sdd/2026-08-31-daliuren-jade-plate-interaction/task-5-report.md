# Task 5 — Jade Materials, UVs, and Runtime Assets

## Delivered

- Replaced the legacy palette with exactly six physical families: `M_JadeBody`, `M_TranslucentJade`, `M_JadeRecess`, `M_InkText`, `M_CinnabarText`, and `M_OldGold`.
- General pieces use translucent jade; separate child name glyphs use ink and retain their runtime semantic properties.
- Month glyphs use cinnabar with `runtime_color_switch`; earth glyphs use ink. The interaction annulus and semantic glyphs are kept in glTF while excluded from the fixed bake.
- Recesses are darker and rougher; glyph/reference materials are non-emissive. Semantic properties are retained through all LODs.
- Regenerated master blend, PNG texture atlases, KTX2 LOD GLBs, material contract, and lookdev renders.

## Evidence

- Material RED was recorded before implementation; final material Blender test: `Ran 7 tests ... OK`.
- `npm run asset:validate`: LOD0 265314, LOD1 237548, LOD2 79442 triangles; all three reported `0 errors` and bounds `0.52 x 0.06485 x 0.52 m`.
- `npm run asset:render-lookdev` completed.
- Direct Node compression/contract tests: 26 passing, 0 failing.
- Direct affected UV checks passed after updating former five-family assumptions, including the final native coverage check (`Ran 1 test ... OK`).

## Compression correction

The old compressor injected `M_EarthVoid` and `M_HeavenVoid`. That injection and its direct test were removed so compression preserves the six-family contract. A stopped invalid run had already compressed only LOD0; it was recovered by one raw LOD0 export from the baked master before the final successful compression pass.

## Self-review

- No `assets/daliuren/source/daliuren-artifact-master.blend1` or `tools/node/` content is staged.
- UV coverage has bounded microface exceptions after the six-family split; the direct high-resolution check is retained with a `2e-05` aggregate tolerance.
