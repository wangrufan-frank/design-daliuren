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

## Review follow-up

- General-piece LOD materials now remain `M_TranslucentJade` rather than being replaced by runtime atlas materials. Each compressed LOD directly asserts `KHR_materials_transmission` `0.12`, `KHR_materials_ior` `1.48`, and `modeled_thickness_m` `0.004` (six-decimal comparison accounts only for glTF float32 serialization).
- The interaction annulus carries the runtime `raycast-only` contract, `color_write=false`, and `depth_write=false`; its exported `M_InteractionRaycast` has `alphaMode=MASK`, `alphaCutoff=0.5`, and alpha `0`, so it is discarded before color/depth output while its node remains exportable for raycasts.
- Native coverage now aborts for all non-microface misses. The only bounded exception remains `MICRO_TRIANGLE_AREA_MAX=2e-7 m2`; RED used a deliberately collapsed visible triangle and GREEN confirmed the bake guard raises. Causal jade texture tests now prove a source face mutation changes only its assigned atlas, and normal-map samples verify native coverage plus decoded unit-length normal vectors.
- `material-contract.json` now describes jade-family causes/effects and has no bronze/patina/celadon claims. The artifact contract documents the raycast-only surface; the GLB validator excludes that non-physical material from the exact six-family set.

### Follow-up evidence

- RED: collapsed-UV coverage guard (`RuntimeError` was not raised), causal mutation (identical jade bytes), and all three old exported LOD bindings (missing `M_TranslucentJade` extras) each failed as expected.
- GREEN: coverage guard (`Ran 1 test ... OK`), causal mutation (`Ran 1 test ... OK`), source/export runtime visibility (`Ran 2 tests ... OK`), material tests (`Ran 8 tests ... OK`), UV/normal contract (`Ran 1 test ... OK`), three-LOD translucent GLB test (`Ran 1 test ... OK`), `node --test scripts/validate-daliuren-glb.test.mjs` (21 pass), and `npm run asset:validate` (all three LODs: `0 errors`).
- Rebuilt master, exported LOD0/1/2 once, and compressed them once. The compressed GLB sizes are 26,478,704 / 23,499,004 / 9,879,476 bytes for LOD0/1/2.
- Lookdev was rerun because the annulus visibility changed. It updated `overall.png` and `legibility.png`, then stopped at the existing `functional text contrast ratio must be > 4.0` gate. This concerns unrelated functional glyph contrast; no unrelated lighting or glyph-design change was made.

### Concerns

- Fresh Blender UV packing does not reproduce the frozen committed atlas hashes without a full rebake. To respect the no-full-rebake instruction, the master retains its frozen UV layout and received only the new interaction material/properties.
- No prohibited `.blend1`, `tools/node/`, or compressor temporary directory is staged.

## Final visual correction and recovery

### Root causes and fixes

- The black linked rings were self-occluding: the heaven linked-ring details and
  the general/core detail layers were coplanar with their visible carriers.
  The builder now gives those layers deterministic clearance above the dial
  foundation, general ring, and core foundation.
- The functional earth, month, and general-name glyphs were below their actual
  visible carriers after the carrier clearances changed.  Their bases now use a
  `0.1 mm` shallow relief above the evaluated carrier surface.  The source
  regression checks every functional glyph role against its visible carrier.
- `M_InkText` and `M_CinnabarText` are matte (high roughness, zero specular and
  coat), preventing lookdev highlights from washing out exposed glyph faces
  while retaining non-emissive physical text materials.

### Final evidence

- Focused structural clearance regression: `Ran 17 tests ... OK`, including
  all earth, month, and general-name carrier-clearance assertions.
- `npm run asset:validate`: LOD0 `200917`, LOD1 `160261`, and LOD2 `80466`
  triangles; all three reported `0 errors` with bounds `0.52 x 0.07605 x 0.52 m`.
- `npm run asset:render-lookdev`: completed successfully.  The final manifest
  reports `readable functional inscription` as `PASS (mean=0.567, dark=0.002,
  contrast=6.14)`, exceeding the required `> 4.0` gate.  Final overall and
  close-up renders show the pale-green jade, exposed dark earth glyphs, and no
  black ring artifact.

### Scope note

The static master-frame lookdev proves the fixed earth text and carrier
clearance.  Month and general-name final-state visibility is exercised by the
Task 8 runtime transforms rather than by that fixed master frame.

## Review P1 follow-up

- Synchronized `material-contract.json` with the six source/export families:
  pale-green jade body and inlay colors, recess/ink/cinnabar/gold colors,
  roughness, metallic values, and `Specular IOR Level`.  The recess mask is
  now named `mask_recess_oxidation`, matching its source node group and face
  attribute.  Direct material tests compare the contract fields to the source
  family values so this cannot silently drift again.
- Reduced the general-piece/recess stack from the visibly proud separation to
  staggered `0.03 mm` general and `0.01 mm` recess top clearances above the
  general-ring foundation.  They are strictly noncoplanar and visibly flush;
  the reference-supported linked-ring and core relief remains unchanged.
- Corrected earth glyph local placement under the already offset earth plate,
  avoiding a double dial-center transform.  The master was patched in place
  with an assertion that every baked material binding remained unchanged.
- The final carrier proof tests all 36 functional glyphs in world space.  Each
  earth glyph is exactly `0.1 mm` above the highest visible carrier among the
  heaven plate and all general pieces; month and general-name glyphs are
  asserted against their respective visible carriers.  This replaced an
  intermediate general-ring-only lift that still allowed the heaven plate to
  occlude earth glyphs.
- The corrected master was raw-exported and KTX2-compressed once.  Final LOD
  validation reports `0 errors` for all three LODs at `0.52 x 0.07605 x 0.52 m`;
  the final lookdev has no black ring artifact and reports functional text
  contrast `6.14` (`> 4.0`).
