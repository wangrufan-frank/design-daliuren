# Daliuren Artifact Legibility and Motion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Daliuren WebGL artifact as a bright, stable, readable three-dimensional heaven-and-earth plate with plate-aware void colors and a clear 27-second six-stage performance.

**Architecture:** Keep all divination rules and `ArtifactDisplayState` facts intact. Blender owns physical form, recessed branch inlays, materials, and stable semantic nodes; pure TypeScript timeline functions own deterministic stage timing; `ArtifactSceneController` owns camera, light, per-surface color, label opacity, and exact pose application. React keeps playback, accessibility, fallback, and annotation controls without duplicating 3D state.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.185, Vitest 3, Playwright 1.62, Blender Python, glTF/KTX2, Vite 7.

**Spec:** `docs/superpowers/specs/2026-08-29-daliuren-artifact-legibility-and-motion-redesign.md`

## Global Constraints

- Do not change calendar, heaven-earth, four-lessons, three-transmissions, heavenly-generals, or course rule algorithms.
- Earth-plate void color is exactly `#8A563B`; heaven-plate void color is exactly `#477B9D`.
- A standalone transmission branch remains neutral text with `（空）`; only explicit heaven/earth sources receive plate-specific wording and color.
- Default projected branch-glyph height is at least `20 CSS px` on desktop and `18 CSS px` on mobile.
- Stage boundaries are `0–3200`, `3200–8000`, `8000–13000`, `13000–18000`, `18000–24000`, and `24000–27000` milliseconds.
- Remove the lesson wings, transmission bridge, general rail/rising pillars, copy planes, and automatic final camera orbit.
- All persistent visual facts remain attached to three-dimensional surfaces; do not add floating HUD labels, particles, fog, neon glow, bounce, or spring motion.
- Stable playback, seeking, rotation, and a 30-second idle hold must not flicker.
- Reduced motion jumps to stable stage poses without losing branch, void, lesson, transmission, or general facts.
- Do not add runtime dependencies.

## File Responsibility Map

- `src/features/artifact-scene/model/format-void-branch.ts`: the only formatter for neutral, heaven-plate, and earth-plate void wording and color tokens.
- `tools/blender/daliuren_contract.py` and `assets/daliuren/asset-contract.json`: the authoritative physical-node, size, material, and LOD contract.
- `tools/blender/build_graybox.py`: the simple three-dimensional silhouette and semantic runtime-node layout.
- `tools/blender/inscriptions.py` and `assets/daliuren/inscriptions/fixed-inscriptions.json`: fixed earth/heaven branch meshes and historical low-contrast inscriptions.
- `tools/blender/high_detail_geometry.py`: bevels, seams, shallow slots, central bearing, and non-overlapping detail geometry.
- `tools/blender/materials.py`: bright museum-grade material palette and roughness response.
- `tools/blender/poses.py`: deterministic stable Blender review poses only.
- `tools/blender/uv_and_bake.py`, `tools/blender/build_lods.py`, `tools/blender/export_graybox.py`: baked asset and LOD output adapted to the new node contract.
- `src/features/artifact-scene/timeline/*.ts`: 27-second deterministic action, per-label reveal, physical visibility, and stage camera presets.
- `src/features/artifact-scene/three/load-artifact.ts`: validates and indexes every required physical and branch-inlay node.
- `src/features/artifact-scene/three/ArtifactSceneController.ts`: applies poses, plate-aware colors, stable materials, camera, light, and projected-glyph measurement.
- `src/features/artifact-scene/ArtifactAnnotationLayer.tsx` and `annotations/layout-annotations.ts`: keep cards outside the protected plate region.
- `src/features/artifact-scene/ArtifactExperience.tsx`: keeps playback, reduced motion, accessibility, and observable test attributes aligned with the new pose contract.
- `public/models/daliuren/*.glb`, `assets/daliuren/source/*.blend`, and `docs/asset-reviews/lookdev/*.png`: generated deliverables and visual review evidence.

---

### Task 1: Encode plate-aware void semantics

**Files:**
- Modify: `src/features/artifact-scene/model/format-void-branch.ts`
- Create: `src/features/artifact-scene/model/format-void-branch.test.ts`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`

**Interfaces:**
- Consumes: `EarthlyBranch` and `ArtifactDisplayState.calendar.voidBranches`.
- Produces: `VoidSurface`, `VOID_SURFACE_COLORS`, `formatVoidBranch(value, voidBranches, surface?)`, and `voidSurfaceColor(value, voidBranches, surface)`.

- [ ] **Step 1: Write failing formatter tests**

```ts
import { describe, expect, it } from "vitest";
import { formatVoidBranch, voidSurfaceColor } from "./format-void-branch";

const voids = ["子", "丑"] as const;

describe("plate-aware void presentation", () => {
  it("distinguishes heaven, earth, and neutral wording", () => {
    expect(formatVoidBranch("子", voids, "heaven")).toBe("子（天盘空）");
    expect(formatVoidBranch("子", voids, "earth")).toBe("子（地盘空）");
    expect(formatVoidBranch("子", voids, "neutral")).toBe("子（空）");
    expect(formatVoidBranch("寅", voids, "heaven")).toBe("寅");
  });

  it("returns exact colors only for void branches with a plate source", () => {
    expect(voidSurfaceColor("子", voids, "earth")).toBe("#8A563B");
    expect(voidSurfaceColor("子", voids, "heaven")).toBe("#477B9D");
    expect(voidSurfaceColor("子", voids, "neutral")).toBeUndefined();
    expect(voidSurfaceColor("寅", voids, "earth")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the formatter test and verify it fails**

Run: `npm test -- --run src/features/artifact-scene/model/format-void-branch.test.ts`

Expected: FAIL because `VoidSurface`, the third argument, and `voidSurfaceColor` do not exist.

- [ ] **Step 3: Implement the minimal shared void contract**

```ts
import type { EarthlyBranch } from "../../../domain/chart/types";

export type VoidSurface = "earth" | "heaven" | "neutral";

export const VOID_SURFACE_COLORS = {
  earth: "#8A563B",
  heaven: "#477B9D",
} as const;

export function isVoidBranch(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
): boolean {
  return voidBranches.some((branch) => branch === value);
}

export function formatVoidBranch(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
  surface: VoidSurface = "neutral",
): string {
  if (!isVoidBranch(value, voidBranches)) return value;
  if (surface === "heaven") return `${value}（天盘空）`;
  if (surface === "earth") return `${value}（地盘空）`;
  return `${value}（空）`;
}

export function voidSurfaceColor(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
  surface: VoidSurface,
): string | undefined {
  return isVoidBranch(value, voidBranches) && surface !== "neutral"
    ? VOID_SURFACE_COLORS[surface]
    : undefined;
}
```

- [ ] **Step 4: Update accessible facts with explicit source semantics**

Use these exact mappings in `AccessibleFacts`:

```tsx
const mark = (branch: string, surface: VoidSurface = "neutral") =>
  formatVoidBranch(branch, state.calendar.voidBranches, surface);

{state.lessons.map((lesson) => (
  <li key={lesson.id}>{`${lesson.label} ${lesson.general} ${mark(lesson.upper, "heaven")}/${
    lesson.lower.kind === "branch" ? mark(lesson.lower.value, "earth") : lesson.lower.value
  }；查地盘 ${lesson.lookupEarth}`}</li>
))}
{state.transmissions.map((item) => (
  <li key={item.position}>{`${item.label} ${item.general} ${mark(item.branch)} ${item.relation}`}</li>
))}
{state.generals.map((item) => (
  <li key={item.general}>{`天将 ${item.general} ${mark(item.heaven, "heaven")}/${mark(item.earth, "earth")}`}</li>
))}
```

- [ ] **Step 5: Add React assertions and run focused tests**

Add assertions for `天后 寅（天盘空）/酉`, `太阴 卯（天盘空）/戌`, and a neutral transmission `寅（空）`; retain the existing旬空 assertion.

Run: `npm test -- --run src/features/artifact-scene/model/format-void-branch.test.ts src/features/artifact-scene/ArtifactExperience.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/artifact-scene/model/format-void-branch.ts src/features/artifact-scene/model/format-void-branch.test.ts src/features/artifact-scene/ArtifactExperience.tsx src/features/artifact-scene/ArtifactExperience.test.tsx
git commit -m "feat: distinguish heaven and earth void labels"
```

---

### Task 2: Replace the mechanical graybox and asset contract

**Files:**
- Modify: `tools/blender/daliuren_contract.py`
- Modify: `tools/blender/build_graybox.py`
- Modify: `tools/blender/tests/test_contract.py`
- Modify: `tools/blender/tests/test_graybox_structure.py`
- Modify: `tools/blender/tests/test_component_contract.py`
- Modify: `assets/daliuren/asset-contract.json`
- Modify: `src/features/artifact-scene/model/asset-contract.ts`
- Modify: `src/features/artifact-scene/model/asset-contract.test.ts`
- Modify: `scripts/validate-daliuren-glb.test.mjs`

**Interfaces:**
- Consumes: the fixed `0.520 m` base and `0.380 m` heaven-plate dimensions.
- Produces: one synchronized required-node contract with independent lesson slips, transmission slips, `transmission/method`, 24 branch-inlay nodes, and `trace/course`.

- [ ] **Step 1: Write failing contract tests for the new silhouette**

In Python and TypeScript, assert the following exact changes:

```python
FORBIDDEN_NODES = {
    "transmission/bridge",
    "anchor/course-copy/lessons",
    "anchor/course-copy/transmissions",
    "anchor/course-copy/generals",
}

def test_contract_replaces_mechanical_nodes_with_inlays_and_slips(self):
    self.assertTrue(FORBIDDEN_NODES.isdisjoint(NODE_IDS))
    self.assertIn("transmission/method", NODE_IDS)
    self.assertIn("trace/course", NODE_IDS)
    for surface in ("earth", "heaven"):
        for branch in "子丑寅卯辰巳午未申酉戌亥":
            self.assertIn(f"branch/{surface}/{branch}", NODE_IDS)
```

```ts
expect(REQUIRED_NODE_IDS).not.toContain("transmission/bridge");
expect(REQUIRED_NODE_IDS).not.toContain("anchor/course-copy/lessons");
expect(REQUIRED_NODE_IDS).toContain("transmission/method");
expect(REQUIRED_NODE_IDS).toContain("trace/course");
expect(REQUIRED_NODE_IDS).toContain("branch/earth/子");
expect(REQUIRED_NODE_IDS).toContain("branch/heaven/子");
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_contract.py
npm test -- --run src/features/artifact-scene/model/asset-contract.test.ts
node --test scripts/validate-daliuren-glb.test.mjs
```

Expected: FAIL on the forbidden bridge/copy nodes and missing branch inlays.

- [ ] **Step 3: Replace dimensions and node IDs in every contract copy**

Use these physical dimensions in `daliuren_contract.py` and `asset-contract.json`:

```python
DIMENSIONS = {
    "base": (0.520, 0.520, 0.052),
    "earth_plate": (0.440, 0.440, 0.014),
    "heaven_plate": (0.380, 0.026),
    "calendar_slip": (0.300, 0.038, 0.009),
    "lesson_slip": (0.112, 0.066, 0.009),
    "transmission_slip": (0.112, 0.052, 0.010),
    "method_slip": (0.360, 0.026, 0.006),
    "general_inlay": (0.028, 0.004),
}

BRANCHES = tuple("子丑寅卯辰巳午未申酉戌亥")
BRANCH_INLAY_NODE_IDS = tuple(
    f"branch/{surface}/{branch}"
    for surface in ("earth", "heaven")
    for branch in BRANCHES
)
```

Keep `general/*` IDs because rule placements and annotations already consume them, but redefine them as low inlays rather than rising pillars.

- [ ] **Step 4: Build the minimal non-mechanical graybox**

Replace `add_transmission_bridge`, rail-driven lessons, general track construction, and copy-anchor creation with:

```python
def add_lesson_slips(root, base_height):
    positions = {
        "fourth": (-0.176, 0.132), "third": (-0.176, -0.132),
        "second": (0.176, -0.132), "first": (0.176, 0.132),
    }
    for key, (x, y) in positions.items():
        slip = add_beveled_box(
            f"lesson/{key}", DIMENSIONS["lesson_slip"],
            (x, y, base_height + 0.0185), 0.0012,
        )
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root

def add_transmission_slips(root, base_height):
    for key, x in (("initial", -0.128), ("middle", 0.0), ("final", 0.128)):
        slip = add_beveled_box(
            f"transmission/{key}", DIMENSIONS["transmission_slip"],
            (x, -0.205, base_height + 0.019), 0.0012,
        )
        slip["settled_location"] = tuple(slip.location)
        slip.parent = root
    method = add_beveled_box(
        "transmission/method", DIMENSIONS["method_slip"],
        (0.0, -0.247, base_height + 0.016), 0.0009,
    )
    method.parent = root
```

Create `general/*` as `0.004 m`-thick inlays at the twelve palace positions. Create `trace/course` as a shallow, non-coplanar groove mesh attached to `plate/earth` and hidden by its dark base material until runtime reveal.

- [ ] **Step 5: Assert real thickness and absence of mechanical geometry**

Add graybox assertions that every lesson/transmission slip has at least `0.006 m` thickness, the heaven plate has at least `0.024 m` thickness, no object name or `detail_id` contains `dovetail`, `rail`, `bridge`, `track`, or `copy`, and every moving slip lies inside the `0.520 m` base footprint when settled.

- [ ] **Step 6: Run the focused contract and graybox suites**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_contract.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_graybox_structure.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm test -- --run src/features/artifact-scene/model/asset-contract.test.ts
node --test scripts/validate-daliuren-glb.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tools/blender/daliuren_contract.py tools/blender/build_graybox.py tools/blender/tests/test_contract.py tools/blender/tests/test_graybox_structure.py tools/blender/tests/test_component_contract.py assets/daliuren/asset-contract.json src/features/artifact-scene/model/asset-contract.ts src/features/artifact-scene/model/asset-contract.test.ts scripts/validate-daliuren-glb.test.mjs
git commit -m "feat: replace mechanical artifact graybox"
```

---

### Task 3: Build readable recessed branch inlays and bright materials

**Files:**
- Modify: `assets/daliuren/asset-contract.json`
- Modify: `assets/daliuren/inscriptions/fixed-inscriptions.json`
- Modify: `tools/blender/inscriptions.py`
- Modify: `tools/blender/high_detail_geometry.py`
- Modify: `tools/blender/materials.py`
- Modify: `tools/blender/build_graybox.py`
- Modify: `tools/blender/render_lookdev_review.py`
- Modify: `tools/blender/tests/test_inscriptions.py`
- Modify: `tools/blender/tests/test_high_detail_geometry.py`
- Modify: `tools/blender/tests/test_materials.py`
- Modify: `tools/blender/tests/test_review_scene.py`

**Interfaces:**
- Consumes: `branch/earth/*` and `branch/heaven/*` node IDs from Task 2.
- Produces: `build_fixed_inscriptions(earth_plate, heaven_plate, font_path)`, 24 recessed branch meshes, non-overlapping detail geometry, and material families `M_EarthVoid` and `M_HeavenVoid`.

- [ ] **Step 1: Write failing inscription and material tests**

```python
def test_fixed_contract_has_two_complete_functional_branch_rings(self):
    items = load_fixed_inscriptions(FIXTURE)
    for role in ("earth-branch", "heaven-branch"):
        ring = [item for item in items if item.role == role]
        self.assertEqual([item.text for item in ring], list("子丑寅卯辰巳午未申酉戌亥"))
        self.assertEqual([item.angular_index for item in ring], list(range(12)))

def test_branch_inlays_are_recessed_and_runtime_addressable(self):
    build_graybox()
    objects = build_fixed_inscriptions(
        bpy.data.objects["plate/earth"],
        bpy.data.objects["plate/heaven"],
        FONT,
    )
    branches = [obj for obj in objects if obj["inscription_role"] in {"earth-branch", "heaven-branch"}]
    self.assertEqual(len(branches), 24)
    self.assertTrue(all(obj.get("node_id", "").startswith("branch/") for obj in branches))
    self.assertTrue(all(obj["surface_treatment"] == "recessed-inlay" for obj in branches))
```

Add material tests for exact sRGB colors:

```python
self.assertEqual(PALETTE["earthVoid"], "#8A563B")
self.assertEqual(PALETTE["heavenVoid"], "#477B9D")
self.assertIn("M_EarthVoid", MATERIAL_NAMES)
self.assertIn("M_HeavenVoid", MATERIAL_NAMES)
```

- [ ] **Step 2: Run the focused Blender tests and verify they fail**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_inscriptions.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_materials.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
```

Expected: FAIL on the missing heaven ring, void materials, and new builder signature.

- [ ] **Step 3: Split functional inscriptions between physical plates**

Replace the old `mechanical-scale` role with `heaven-branch`. Use exact functional sizes and radii:

```python
ROLE_ANGLES = {
    "earth-branch": 12,
    "heaven-branch": 12,
    "historical-beidou": 7,
    "historical-mansion": 28,
    "historical-month-deity": 12,
}
TEXT_SIZES = {
    "earth-branch": 0.020,
    "heaven-branch": 0.018,
    "historical-beidou": 0.0045,
    "historical-mansion": 0.0048,
    "historical-month-deity": 0.0045,
}
ROLE_PARENTS = {
    "earth-branch": "earth",
    "heaven-branch": "heaven",
    "historical-beidou": "heaven",
    "historical-mansion": "heaven",
    "historical-month-deity": "heaven",
}
```

Set earth-branch radius to `0.202 m`, heaven-branch radius to `0.164 m`, and branch depth to `0.0012 m` in the JSON fixture. Assign each converted mesh `node_id = f"branch/{surface}/{text}"` and embed it below the plate surface so only its top face is exposed.

For each functional branch mesh, duplicate the mesh as a boolean cutter, cut the matching glyph recess out of its owning plate with Blender's exact boolean solver, then retain the original as the inlay. The plate must not keep a coplanar face beneath the exposed glyph top.

- [ ] **Step 4: Remove old mechanical high-detail features**

Delete the generation of lesson dovetails, bridge tenons/stops, general tracks, pillar sockets, and related cutters. Keep only:

```python
ALLOWED_DETAIL_PREFIXES = {
    "structure/base-",
    "structure/heaven-",
    "structure/plate-",
    "structure/slip-slot-",
    "structure/bronze-inlay-",
    "wear/contact-",
}
```

Add a test that samples world-space bounds of detail meshes and rejects any pair of exposed top faces whose Z difference is below `0.0001 m` while their XY bounds overlap. This is the automated z-fighting gate.

- [ ] **Step 5: Implement the bright restrained material palette**

Use these tokens in `materials.py`:

```python
PALETTE = {
    "ink": "#18201D",
    "bronze": "#4A5A53",
    "patina": "#60736A",
    "celadon": "#91A69C",
    "ash": "#DFE8E4",
    "oldGold": "#B39B69",
    "earthVoid": "#8A563B",
    "heavenVoid": "#477B9D",
}
```

Use roughness `0.62` for bronze, `0.78` for patina, `0.48` for normal branch fill, and `0.52` for void fill. Do not add emissive nodes. Assign a separate material instance to each branch inlay so the runtime can recolor one branch without mutating its siblings.

Add `M_EarthVoid` and `M_HeavenVoid` to `runtimeAssets.materialFamilies` in `asset-contract.json`; keep the normal branch inlays on `M_OldGold` and `M_AshText` respectively.

- [ ] **Step 6: Update look-development review lighting and brightness gates**

Use a `4300K` wide key, a front fill at `35%–45%` of key energy, a low-intensity rim, fixed exposure, and no animated lights. Add `legibility.png` using the default runtime-equivalent camera and extend the render test to assert:

```python
self.assertGreater(mean_luminance, 0.18)
self.assertLess(dark_pixel_ratio, 0.28)
self.assertGreater(functional_text_contrast_ratio, 4.0)
```

Compute these values from the existing sampled render pixels; do not introduce an image-analysis dependency.

- [ ] **Step 7: Run Blender detail, material, inscription, and review suites**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_inscriptions.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_materials.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_review_scene.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/daliuren/asset-contract.json assets/daliuren/inscriptions/fixed-inscriptions.json tools/blender/inscriptions.py tools/blender/high_detail_geometry.py tools/blender/materials.py tools/blender/build_graybox.py tools/blender/render_lookdev_review.py tools/blender/tests/test_inscriptions.py tools/blender/tests/test_high_detail_geometry.py tools/blender/tests/test_materials.py tools/blender/tests/test_review_scene.py
git commit -m "feat: add readable recessed plate inscriptions"
```

---

### Task 4: Update stable Blender review poses and export pipeline

**Files:**
- Modify: `tools/blender/poses.py`
- Modify: `tools/blender/uv_and_bake.py`
- Modify: `tools/blender/build_lods.py`
- Modify: `tools/blender/export_graybox.py`
- Modify: `tools/blender/tests/test_poses.py`
- Modify: `tools/blender/tests/test_uv_and_bake.py`
- Modify: `tools/blender/tests/test_lods.py`
- Modify: `tools/blender/tests/test_native_bake.py`

**Interfaces:**
- Consumes: settled semantic nodes and materials from Tasks 2–3.
- Produces: deterministic `closed`, `calendar`, `plate`, `lessons`, `transmissions`, and `generals` preview poses and LODs with identical semantic nodes.

- [ ] **Step 1: Replace mechanical-pose expectations with stable placement tests**

```python
def test_plate_rotates_without_lifting_and_slips_settle_without_rails(self):
    apply_pose("closed")
    closed = snapshot_transforms()
    apply_pose("generals", plate_offset=5, general_direction="reverse")
    settled = snapshot_transforms()
    self.assertEqual(settled["plate/heaven"][2], closed["plate/heaven"][2])
    self.assertAlmostEqual(bpy.data.objects["plate/heaven"].rotation_euler.z, math.radians(150))
    self.assertNotIn("transmission/bridge", settled)
    for key in ("noble", "snake", "vermilion-bird", "harmony", "hook-array", "azure-dragon", "void", "white-tiger", "constant", "black-tortoise", "yin", "queen-of-heaven"):
        self.assertEqual(settled[f"general/{key}"][2], closed[f"general/{key}"][2])
```

Add stage-visibility assertions: closed hides all dynamic slips; calendar shows only the calendar slip; lessons shows calendar plus four lessons; transmissions adds three transmissions and method; generals adds all general inlays.

- [ ] **Step 2: Run pose and bake tests and verify they fail**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_poses.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_lods.py
```

Expected: FAIL because poses and bake owner maps still reference bridge, rails, copy anchors, and rising generals.

- [ ] **Step 3: Implement deterministic review-pose visibility**

Keep stable transforms in the asset and change only `hide_viewport`/`hide_render` for preview collections:

```python
STAGE_VISIBLE = {
    "closed": set(),
    "calendar": {"calendar/slip"},
    "plate": {"calendar/slip"},
    "lessons": {"calendar/slip", *LESSON_IDS},
    "transmissions": {"calendar/slip", *LESSON_IDS, *TRANSMISSION_IDS, "transmission/method"},
    "generals": {"calendar/slip", *LESSON_IDS, *TRANSMISSION_IDS, "transmission/method", *GENERAL_IDS},
}
```

`set_plate_absolute` changes only `rotation_euler.z`. Remove `_set_translation_absolute` calls for bridge and general rise.

- [ ] **Step 4: Update bake families and dynamic-label owners**

Remove `transmission/bridge` and copy anchors from bake lists. Map `dynamic/transmission/method` to `transmission/method`. Preserve individual branch-inlay material slots through every LOD; assert every LOD contains all 24 `branch/*` nodes and both void material families.

- [ ] **Step 5: Run all focused Blender export tests**

Run:

```powershell
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_poses.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_lods.py
node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_native_bake.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/blender/poses.py tools/blender/uv_and_bake.py tools/blender/build_lods.py tools/blender/export_graybox.py tools/blender/tests/test_poses.py tools/blender/tests/test_uv_and_bake.py tools/blender/tests/test_lods.py tools/blender/tests/test_native_bake.py
git commit -m "feat: update artifact poses and export pipeline"
```

---

### Task 5: Replace the 12.5-second mechanical timeline with a 27-second physical performance

**Files:**
- Modify: `src/features/artifact-scene/timeline/types.ts`
- Modify: `src/features/artifact-scene/timeline/review-stages.ts`
- Modify: `src/features/artifact-scene/timeline/review-stages.test.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.test.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-stage-replay.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-stage-replay.test.ts`

**Interfaces:**
- Consumes: unchanged `ArtifactDisplayState` and semantic node IDs from Task 2.
- Produces: `ArtifactNodePose.visible`, `ArtifactPose.labelOpacity`, `ArtifactPose.courseTraceOpacity`, `stageReplayDuration(stage)`, and exact `ARTIFACT_DURATION_MS = 27_000`.

- [ ] **Step 1: Write failing timing and pose-contract tests**

```ts
expect(ARTIFACT_REVIEW_STAGES.map(({ startTimeMs, settledTimeMs }) => [startTimeMs, settledTimeMs])).toEqual([
  [0, 3_200], [3_200, 8_000], [8_000, 13_000],
  [13_000, 18_000], [18_000, 24_000], [24_000, 27_000],
]);
expect(ARTIFACT_DURATION_MS).toBe(27_000);

const beforeLessons = evaluateArtifactPose(referenceState, 7_999, false);
expect(beforeLessons.nodes["lesson/first"].visible).toBe(false);

const finalPose = evaluateArtifactPose(referenceState, 27_000, false);
expect(finalPose.nodes["plate/heaven"].translationZ).toBe(0);
expect(finalPose.nodes["plate/heaven"].rotationZ).toBeCloseTo(6 * Math.PI / 6);
expect(finalPose.nodes["transmission/initial"].visible).toBe(true);
expect(finalPose.courseTraceOpacity).toBe(0);
expect(finalPose).not.toHaveProperty("copy");
expect(finalPose).not.toHaveProperty("cameraOrbitRequested");
```

Add a sequential general test at `18_250 ms`: forward reveals only `dynamic/general/noble`; reverse reveals only `dynamic/general/queen-of-heaven`.

- [ ] **Step 2: Run timeline tests and verify they fail**

Run: `npm test -- --run src/features/artifact-scene/timeline`

Expected: FAIL on old boundaries, copy planes, lifted plate, rising generals, and camera orbit intent.

- [ ] **Step 3: Replace the pose types**

```ts
export interface ArtifactNodePose {
  translationX: number;
  translationY: number;
  translationZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  visible?: boolean;
  targetEarth?: EarthlyBranch;
}

export interface ArtifactPose {
  nodes: Readonly<Record<string, ArtifactNodePose>>;
  labelOpacity: Readonly<Record<string, number>>;
  courseTraceOpacity: number;
  generalDirection: GeneralDirection;
  generalSequence: readonly string[];
}
```

Delete `ArtifactCopyPose` and `cameraOrbitRequested`.

- [ ] **Step 4: Implement exact stage boundaries and slow weighted motion**

Use a non-bouncing smoother step:

```ts
const smootherstep = (value: number) => value ** 3 * (value * (value * 6 - 15) + 10);
```

Use the settled stage intervals exactly as specified. For physical placement, each lesson receives a `760 ms` action followed by at least `400 ms` before the next; each transmission receives a `1_000 ms` action; each general receives a `360 ms` reveal in directional order. A slip becomes visible at the start of its action, begins `0.018 m` above its settled transform with a maximum `0.010 m` lateral offset, and ends with zero delta. Heaven-plate Z translation is always zero.

Course trace is a pulse, not a persistent copy:

```ts
function courseTraceOpacity(timeMs: number, reducedMotion: boolean): number {
  if (reducedMotion || timeMs < 24_000 || timeMs >= 26_400) return 0;
  const progress = (timeMs - 24_000) / 2_400;
  return Math.sin(Math.PI * progress) ** 2;
}
```

- [ ] **Step 5: Make stage replay preserve action duration**

Remove the compressed recap. Implement:

```ts
const HOLD_MS = 600;

export function stageReplayDuration(stage: ArtifactReviewStage): number {
  return stage.settledTimeMs - stage.startTimeMs + HOLD_MS;
}

export function evaluateStageReplay(stage: ArtifactReviewStage, elapsedMs: number, reducedMotion: boolean): StageReplayState {
  if (reducedMotion) return { timelineTimeMs: stage.settledTimeMs, decompositionProgress: 1, complete: true };
  const actionMs = stage.settledTimeMs - stage.startTimeMs;
  const elapsed = Math.min(stageReplayDuration(stage), Math.max(0, elapsedMs));
  const progress = Math.min(1, elapsed / actionMs);
  return {
    timelineTimeMs: Math.round(stage.startTimeMs + actionMs * progress),
    decompositionProgress: progress,
    complete: elapsed >= actionMs + HOLD_MS,
  };
}
```

- [ ] **Step 6: Use higher, stable camera presets**

Set all stage presets near a `55–65 mm` visual equivalent with Y elevation between `0.68` and `0.78`, target Z/Y aligned to the plate center, and position distance within `1.02–1.12 m`. Do not encode auto-orbit in any pose.

- [ ] **Step 7: Run all timeline tests**

Run: `npm test -- --run src/features/artifact-scene/timeline`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/artifact-scene/timeline
git commit -m "feat: slow and clarify artifact stage motion"
```

---

### Task 6: Apply stable branch colors, lighting, camera, and reveal state at runtime

**Files:**
- Modify: `src/features/artifact-scene/three/load-artifact.ts`
- Modify: `src/features/artifact-scene/three/load-artifact.test.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`
- Modify: `src/features/artifact-scene/three/dynamic-labels.ts`
- Modify: `src/features/artifact-scene/three/dynamic-labels.test.ts`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`

**Interfaces:**
- Consumes: `VOID_SURFACE_COLORS` from Task 1, required branch nodes from Task 2, and the new `ArtifactPose` from Task 5.
- Produces: stable material ownership, `measureMinimumBranchProjectionPx()`, plate-aware label binding, and observable `data-min-branch-px`/`data-source-lines` values.

- [ ] **Step 1: Write failing controller tests**

Create branch meshes named by required node IDs and assert:

```ts
controller.setDisplayState(completeDisplayState);

expect((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material)
  .toHaveProperty("color", expect.objectContaining({}));
expect(((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
  .toBe("8a563b");
expect(((artifact.nodes.get("branch/heaven/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
  .toBe("477b9d");
expect(((artifact.nodes.get("branch/earth/寅") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
  .not.toBe("8a563b");
```

Add tests that `applyPose` sets node visibility, dynamic-label opacity, and `trace/course` opacity; it must not create any `artifact-copy-*` mesh or set `controls.autoRotate = true`.

Add camera assertions for `near = 0.05`, `far = 4`, fixed exposure, and `measureMinimumBranchProjectionPx()` returning a positive deterministic number after resize.

- [ ] **Step 2: Run focused runtime tests and verify they fail**

Run:

```powershell
npm test -- --run src/features/artifact-scene/three/load-artifact.test.ts src/features/artifact-scene/three/dynamic-labels.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/ArtifactExperience.test.tsx
```

Expected: FAIL because copy bindings and auto-rotate still exist and branch nodes are not recolored.

- [ ] **Step 3: Keep one owned material instance per branch inlay**

During controller construction, clone each branch mesh material once and retain it until disposal:

```ts
private readonly branchMeshes = new Map<string, THREE.Mesh>();
private readonly branchMaterials = new Map<string, THREE.MeshStandardMaterial>();

for (const surface of ["earth", "heaven"] as const) {
  for (const branch of EARTHLY_BRANCHES) {
    const id = `branch/${surface}/${branch}`;
    const mesh = artifact.nodes.get(id);
    if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) {
      throw new Error(`Invalid branch inlay ${id}`);
    }
    const material = mesh.material.clone();
    mesh.material = material;
    this.branchMeshes.set(id, mesh);
    this.branchMaterials.set(id, material);
  }
}
```

In `setDisplayState`, use void colors only for void branches; reset every non-void branch to its contracted normal earth/heaven color before applying the next state. Do not mutate shared GLTF materials.

- [ ] **Step 4: Replace copy and direction-line rendering with physical reveals**

Delete `COPY_BINDINGS`, `copyGeometry`, `copyBindings`, generated copy planes, generated source lines, and `generalDirectionLine`. Store the original `trace/course` material, clone it, set it transparent with `depthWrite: true`, and drive only its opacity from `pose.courseTraceOpacity`.

Apply `pose.labelOpacity[dynamicId] ?? 1` to each dynamic label material. Set `object.visible = delta.visible` only when the field is defined. Preserve exact base transforms on every seek.

- [ ] **Step 5: Stabilize dynamic label depth**

Use one label surface and one material per physical readout. Configure:

```ts
const material = new THREE.MeshBasicMaterial({
  transparent: true,
  toneMapped: false,
  depthWrite: true,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
```

The Blender label plane must sit at least `0.0002 m` above its backing inset. Do not stack a second marker plane; markers remain inside the same canvas texture.

- [ ] **Step 6: Use fixed bright museum lighting and a tighter depth range**

Set the camera to `new THREE.PerspectiveCamera(34, 1, 0.05, 4)`, renderer exposure to `1.18`, scene background to `0xe4e6df`, environment intensity to `1.05`, key intensity `1.75`, hemisphere fill `1.28`, side fill `0.82`, and rim `0.42`. Keep every value constant across frames. Set `controls.autoRotate = false` once and never change it in `applyPose`.

- [ ] **Step 7: Measure projected branch glyph height**

Add:

```ts
measureMinimumBranchProjectionPx(): number {
  this.artifact.root.updateMatrixWorld(true);
  this.camera.updateMatrixWorld(true);
  return Math.min(...[...this.branchMeshes.values()].map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const top = new THREE.Vector3(center.x, center.y, box.max.z).project(this.camera);
    const bottom = new THREE.Vector3(center.x, center.y, box.min.z).project(this.camera);
    return Math.abs(top.y - bottom.y) * this.annotationViewport.height / 2;
  }));
}
```

The glTF contract is Y-up, so branch glyph height on the horizontal plate is measured along Z. Lock that axis with the controller unit test. Expose the rounded value as `data-min-branch-px` only in the existing observable build path; update it after resize and after applying an immediate stage camera preset.

- [ ] **Step 8: Update pose hashing and source-line observability**

Hash node transforms, visibility, label opacity, and `courseTraceOpacity`. Keep `data-source-lines="active"` only while `courseTraceOpacity > 0`; this preserves the existing e2e hook while changing its implementation from copy lines to the physical trace groove.

- [ ] **Step 9: Run focused runtime tests**

Run:

```powershell
npm test -- --run src/features/artifact-scene/three src/features/artifact-scene/ArtifactExperience.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/artifact-scene/three src/features/artifact-scene/ArtifactExperience.tsx src/features/artifact-scene/ArtifactExperience.test.tsx
git commit -m "feat: stabilize artifact lighting and plate rendering"
```

---

### Task 7: Protect the plate from annotations and update end-to-end behavior

**Files:**
- Modify: `src/features/artifact-scene/ArtifactAnnotationLayer.tsx`
- Modify: `src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx`
- Modify: `src/features/artifact-scene/annotations/layout-annotations.ts`
- Modify: `src/features/artifact-scene/annotations/layout-annotations.test.ts`
- Modify: `src/features/artifact-scene/artifact-scene.css`
- Modify: `e2e/artifact-experience.spec.ts`
- Modify: `e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `AnnotationSafeArea`, observable branch projection, 27-second timeline, and plate-aware accessible text.
- Produces: an annotation-protected plate region and e2e gates for readability, stable frames, slow stage action, and fallback.

- [ ] **Step 1: Write failing safe-area tests**

```ts
const safeArea = {
  top: 72, right: 12, bottom: 128, left: 12,
  subject: { x: 220, y: 80, width: 560, height: 440 },
};
const layouts = layoutArtifactAnnotations(anchors, { width: 1_000, height: 640 }, { safeArea });
for (const { labelRect } of layouts) {
  expect(rectanglesOverlap(labelRect, safeArea.subject)).toBe(false);
}
```

Add a component test that the default density is `stage`, `all` remains optional on desktop, and changing stages never leaves old cards inside the new protected subject rectangle.

- [ ] **Step 2: Run annotation tests and verify they fail**

Run: `npm test -- --run src/features/artifact-scene/annotations src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx`

Expected: FAIL because the current safe area protects only 46% of the viewport width.

- [ ] **Step 3: Enlarge and stabilize the protected plate region**

Use:

```ts
function safeAreaFor(viewport: AnnotationViewport, compact: boolean): AnnotationSafeArea {
  const subjectWidth = viewport.width * (compact ? 0.58 : 0.68);
  const subjectHeight = viewport.height * (compact ? 0.58 : 0.70);
  return {
    top: compact ? 56 : 72,
    right: compact ? 8 : 12,
    bottom: compact ? 16 : 128,
    left: compact ? 8 : 12,
    subject: {
      x: (viewport.width - subjectWidth) / 2,
      y: (viewport.height - subjectHeight) / 2,
      width: subjectWidth,
      height: subjectHeight,
    },
  };
}
```

Keep leader endpoints outside `safeArea.subject`; omit lower-priority occluded cards when the rails cannot fit them. Do not shrink cards below existing touch and font-size floors.

- [ ] **Step 4: Update exact end-to-end assertions**

Change old 12.5-second seeks to the new stages and assert:

```ts
await timeline.fill("27000");
await expect(timeline).toHaveValue("27000");
await expect(page.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-px", /^(2[0-9]|[3-9][0-9])/);

const facts = page.getByTestId("artifact-accessible-facts");
await expect(facts).toContainText("天盘空");
await expect(facts).toContainText("地盘空");
await expect(facts).toContainText("初传");
```

For mobile, parse `data-min-branch-px` and assert `>= 18`.

- [ ] **Step 5: Add the no-flicker idle test**

```ts
test("a settled artifact stays pixel-stable for thirty seconds", async ({ page }) => {
  test.setTimeout(90_000);
  await completeReferenceCourse(page);
  const timeline = await expectArtifactReady(page);
  await timeline.fill("27000");
  const canvas = page.getByLabel("大六壬三维器物");
  const first = await canvas.screenshot();
  await page.waitForTimeout(30_000);
  const second = await canvas.screenshot();
  expect(second.equals(first)).toBe(true);
});
```

Also seek to `8_000`, `13_000`, `18_000`, `24_000`, and `27_000` twice and assert identical `data-pose-hash` values.

- [ ] **Step 6: Run focused unit and e2e tests**

Run:

```powershell
npm test -- --run src/features/artifact-scene/annotations src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx
npx playwright test e2e/artifact-experience.spec.ts e2e/app-shell.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/artifact-scene/ArtifactAnnotationLayer.tsx src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx src/features/artifact-scene/annotations/layout-annotations.ts src/features/artifact-scene/annotations/layout-annotations.test.ts src/features/artifact-scene/artifact-scene.css e2e/artifact-experience.spec.ts e2e/app-shell.spec.ts
git commit -m "test: enforce readable stable artifact presentation"
```

---

### Task 8: Generate final assets and run the complete verification gate

**Files:**
- Modify: `assets/daliuren/source/daliuren-artifact-graybox.blend`
- Modify: `assets/daliuren/source/daliuren-artifact-master.blend`
- Modify: `public/models/daliuren/daliuren-graybox.glb`
- Modify: `public/models/daliuren/daliuren-artifact-lod0.glb`
- Modify: `public/models/daliuren/daliuren-artifact-lod1.glb`
- Modify: `public/models/daliuren/daliuren-artifact-lod2.glb`
- Modify: `assets/daliuren/textures/lod0/*`
- Modify: `assets/daliuren/textures/lod1/*`
- Modify: `assets/daliuren/textures/lod2/*`
- Modify: `docs/asset-reviews/graybox/*.png`
- Modify: `docs/asset-reviews/lookdev/*.png`
- Modify: `docs/asset-reviews/runtime/benchmark.json`

**Interfaces:**
- Consumes: every source and contract change from Tasks 1–7.
- Produces: validated GLBs, baked textures, review renders, passing unit/e2e suites, and performance evidence.

- [ ] **Step 1: Generate the graybox and master Blender files**

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --save assets/daliuren/source/daliuren-artifact-graybox.blend
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --master --save assets/daliuren/source/daliuren-artifact-master.blend
```

Expected: both `.blend` files are regenerated without missing-node or duplicate-node errors.

- [ ] **Step 2: Export all LODs and validate the contract**

Run:

```powershell
npm run asset:export-graybox
npm run asset:export-lods
npm run asset:validate-graybox
npm run asset:validate
```

Expected: PASS for node IDs, dimensions, materials, KTX2 usage, branch inlays, and LOD budgets.

- [ ] **Step 3: Render visual review evidence**

Run:

```powershell
npm run asset:render-graybox
npm run asset:render-lookdev
```

Inspect `overall.png`, `oblique.png`, `material-closeup.png`, `legibility.png`, and each stage preview. Reject and fix the generating source if any image shows unreadable earth/heaven branches, a flat silhouette, dead-black regions, mechanical wings/bridge/rails, coplanar artifacts, or obscuring annotation-like geometry.

- [ ] **Step 4: Run the complete automated verification suite**

Run:

```powershell
npm test
npm run build
npm run test:asset-runner
npx playwright test
npm run benchmark:artifact
```

Expected: all unit, build, Blender-runner, e2e, desktop 60 FPS, and mobile 30 FPS gates PASS. The benchmark must report a recognized hardware renderer rather than SwiftShader/software rendering.

- [ ] **Step 5: Review only intended changes**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only files named in this plan or generated directly by them are changed; no unrelated rule or layout modules are modified.

- [ ] **Step 6: Commit generated deliverables and evidence**

```bash
git add assets/daliuren/source assets/daliuren/textures public/models/daliuren docs/asset-reviews
git commit -m "feat: ship redesigned daliuren artifact assets"
```

- [ ] **Step 7: Record the final verification evidence**

Capture the exact passing command outputs, renderer string, desktop/mobile FPS, and the reviewed image paths in the completion report. Do not claim completion if the 30-second pixel-stability test, default branch-projection floors, or material brightness gates are skipped.
