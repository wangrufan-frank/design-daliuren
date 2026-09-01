# Task 5 material re-review follow-up

## Delivered

- Preserved `M_TranslucentJade` physical export semantics and verified the three LODs.
- Limited invisible raycast handling to the contract-declared interaction annulus; validators now require its exact node/material binding, MASK alpha discard, and write-disable extras.
- Restored native coverage failure behavior, with only the documented low-relief base/trace/shallow-slot fallback.
- Restored jade micro-normal generation and a non-flat normal regression assertion.
- Darkened physical ink glyphs for readable branch contrast; final lookdev reports contrast `4.17` (> `4.0`).

## Evidence

- `node --test scripts/validate-daliuren-glb.test.mjs`: 22 passing.
- `npm run asset:validate`: LOD0 `265138`, LOD1 `237372`, LOD2 `79266` triangles; all report `0 errors`.
- `tools/blender/tests/test_interaction_visibility.py`: 2 passing source/export assertions.
- `npm run asset:render-lookdev`: completed and rewrote all review images plus `docs/asset-reviews/lookdev/README.md` hashes.

## Artifacts

- Updated master blend, native texture atlases/material contract, compressed LOD0–LOD2 GLBs, and lookdev review frames/manifest.

## Self-review / concerns

- Coverage fallback remains intentionally narrow and source-identified; a new unlisted visible coverage miss aborts the bake.
- Compressor work directories, `tools/node/`, and the Blender `.blend1` backup are deliberately untracked and unstaged.

## Final P1 coverage-guard follow-up

- Removed the generic `surface_treatment='shallow-slot'` bypass. Coverage exceptions now name only the 14 measured fixed support meshes and enforce a per-object miss count, triangle-area ceiling, aggregate-area ceiling, plus global ceilings of 282 misses and `0.0053211718 m²`.
- The tiny `1e-10 m²` comparison epsilon only absorbs floating-point representation at recorded decimal boundaries; it does not permit a material-tagged mesh, an unlisted object, or a materially larger miss.
- TDD evidence: the focused RED test showed a `base/body` triangle tagged `shallow-slot` could evade the old guard. The final focused GREEN Blender run completed `tools/blender/tests/test_uv_coverage_guard.py`: 3 tests, `OK` (274.567 s).
- No master, textures, GLBs, compression output, or lookdev files were regenerated for this validator-only change.

## Final P2 coverage-envelope follow-up

- Added an exact per-object normalized envelope assertion before the coverage upper-bound checks. It pins every allowlisted support mesh's eligible triangle count and its maximum/aggregate physical area in `1e-7 m²` bins, so a named mesh cannot silently lose, gain, or replace a coverage candidate.
- The direct RED assertion failed with the measured envelope; the focused GREEN `tools/blender/tests/test_uv_coverage_guard.py` then passed 3 tests in `283.186 s`.
- This was test/report-only: no asset operations or generated artifact changes.
