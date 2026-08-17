# Daliuren Blender Graybox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付尺寸准确、机构可动、节点稳定且可导出 GLB 的大六壬器物灰模，为高精度制作冻结结构和运行时资产契约。

**Architecture:** Blender Python 是灰模的唯一生成入口；场景构件由参数化函数创建，姿态由纯数据表驱动，测试在 Blender 后台模式中直接检查尺寸、父子关系、枢轴和行程。Node 脚本只负责定位 Blender、调用后台任务并验证导出的 GLB 节点与预算。

**Tech Stack:** Blender 4.5.12 LTS、Blender Python 3.11、Node.js 20+、node:test、glTF Transform 4.4.2、glTF/GLB 2.0

## Global Constraints

- Blender 可执行文件默认使用 `E:\Tools\Blender\4.5.12\blender-4.5.12-windows-x64\blender.exe`，允许以任务专用环境变量 `DALIUREN_BLENDER` 覆盖。
- `1 Blender unit = 1 meter`；场景 `unit_settings.system = "METRIC"`，`length_unit = "MILLIMETERS"`，`scale_length = 1.0`。
- 世界坐标：`+Z` 向上、`+Y` 向后、`-Y` 向前、`+X` 向右；主座底面位于 `Z = 0`。
- 灰模只验证结构、轮廓、枢轴和可读层级，不制作最终纹理和历史铭文细节。
- 所有运行时节点名使用 ASCII 稳定 ID；中文显示值放入 custom properties，不进入对象名称。
- 导出 GLB 必须包含 custom properties，并保持对象变换，不烘焙动态课例文字。

---

### Task 1: Blender 命令入口与版本守卫

**Files:**
- Create: `scripts/run-blender.mjs`
- Create: `scripts/run-blender.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolveBlenderExecutable(env, exists): string`
- Produces: `runBlender(args: readonly string[]): never | void`
- Produces npm command: `npm run asset:blender -- <Blender args>`

- [ ] **Step 1: 写失败的 Node 路径解析测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlenderExecutable } from "./run-blender.mjs";

test("uses DALIUREN_BLENDER before the pinned E drive path", () => {
  const seen = [];
  const result = resolveBlenderExecutable(
    { DALIUREN_BLENDER: "E:\\custom\\blender.exe" },
    (path) => (seen.push(path), path === "E:\\custom\\blender.exe"),
  );
  assert.equal(result, "E:\\custom\\blender.exe");
  assert.deepEqual(seen, ["E:\\custom\\blender.exe"]);
});

test("throws with both checked paths when Blender is absent", () => {
  assert.throws(
    () => resolveBlenderExecutable({}, () => false),
    /DALIUREN_BLENDER.*E:\\Tools\\Blender\\4\.5\.12/,
  );
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node --test scripts/run-blender.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/run-blender.mjs`.

- [ ] **Step 3: 实现最小命令入口**

```js
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PINNED = "E:\\Tools\\Blender\\4.5.12\\blender-4.5.12-windows-x64\\blender.exe";

export function resolveBlenderExecutable(env = process.env, exists = existsSync) {
  const candidates = [env.DALIUREN_BLENDER, PINNED].filter(Boolean);
  const found = candidates.find((candidate) => exists(candidate));
  if (!found) throw new Error(`Blender not found. Checked DALIUREN_BLENDER and ${PINNED}`);
  return found;
}

export function runBlender(args) {
  const result = spawnSync(resolveBlenderExecutable(), args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) runBlender(process.argv.slice(2));
```

Add scripts:

```json
{
  "asset:blender": "node scripts/run-blender.mjs",
  "test:asset-runner": "node --test scripts/run-blender.test.mjs"
}
```

- [ ] **Step 4: 验证版本守卫与测试**

Run: `npm run test:asset-runner`  
Expected: 2 tests pass.

Run: `npm run asset:blender -- --version`  
Expected: first line `Blender 4.5.12 LTS`.

- [ ] **Step 5: 提交命令入口**

```powershell
git add package.json scripts/run-blender.mjs scripts/run-blender.test.mjs
git commit -m "build: add pinned Blender runner"
```

### Task 2: 冻结蓝图常量、坐标和节点契约

**Files:**
- Create: `tools/blender/daliuren_contract.py`
- Create: `tools/blender/tests/test_contract.py`

**Interfaces:**
- Produces: `DIMENSIONS: dict[str, float | tuple[float, ...]]`
- Produces: `NODE_IDS: tuple[str, ...]`
- Produces: `POSE_IDS = ("closed", "calendar", "plate", "lessons", "transmissions", "generals")`

- [ ] **Step 1: 写精确常量失败测试**

```python
import unittest
from daliuren_contract import DIMENSIONS, NODE_IDS, POSE_IDS

class ContractTest(unittest.TestCase):
    def test_dimensions_match_confirmed_blueprint(self):
        self.assertEqual(DIMENSIONS["base"], (0.520, 0.520, 0.052))
        self.assertEqual(DIMENSIONS["heaven_plate"], (0.380, 0.024))
        self.assertEqual(DIMENSIONS["lesson"], (0.152, 0.100))
        self.assertEqual(DIMENSIONS["slip_rise"], 0.012)
        self.assertEqual(DIMENSIONS["lesson_travel"], 0.092)
        self.assertEqual(DIMENSIONS["lesson_readout_rise"], 0.008)
        self.assertEqual(DIMENSIONS["bridge_travel"], 0.118)
        self.assertEqual(DIMENSIONS["general_rise"], 0.007)

    def test_runtime_ids_are_unique_ascii_paths(self):
        self.assertEqual(len(NODE_IDS), len(set(NODE_IDS)))
        self.assertTrue(all(node.isascii() and "/" in node for node in NODE_IDS))
        self.assertEqual(POSE_IDS[0], "closed")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 运行并确认缺少契约模块**

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_contract.py
```

Expected: FAIL with `ModuleNotFoundError: No module named 'daliuren_contract'`.

- [ ] **Step 3: 实现常量和完整节点 ID**

```python
DIMENSIONS = {
    "base": (0.520, 0.520, 0.052),
    "heaven_plate": (0.380, 0.024),
    "lesson": (0.152, 0.100),
    "bridge_width": 0.420,
    "slip_rise": 0.012,
    "lesson_travel": 0.092,
    "lesson_readout_rise": 0.008,
    "bridge_travel": 0.118,
    "general_rise": 0.007,
}

NODE_IDS = (
    "artifact/root", "base/body", "plate/earth", "plate/heaven",
    "calendar/slip", "lesson/first", "lesson/second",
    "lesson/third", "lesson/fourth", "transmission/bridge",
    "transmission/initial", "transmission/middle", "transmission/final",
    "general/noble", "general/snake", "general/vermilion-bird",
    "general/harmony", "general/hook-array", "general/azure-dragon",
    "general/void", "general/white-tiger", "general/constant",
    "general/black-tortoise", "general/yin", "general/queen-of-heaven",
    "anchor/course-copy/lessons", "anchor/course-copy/transmissions",
    "anchor/course-copy/generals",
)
POSE_IDS = ("closed", "calendar", "plate", "lessons", "transmissions", "generals")
```

The test adds `tools/blender` to `sys.path` using `Path(__file__).parents[1]` before import.

- [ ] **Step 4: 运行契约测试**

Run: same Blender command as Step 2.  
Expected: 2 tests pass, Blender exits `0`.

- [ ] **Step 5: 提交契约**

```powershell
git add tools/blender/daliuren_contract.py tools/blender/tests/test_contract.py
git commit -m "test: freeze artifact asset contract"
```

### Task 3: 参数化生成主座、天地盘与历史内圈占位

**Files:**
- Create: `tools/blender/geometry.py`
- Create: `tools/blender/build_graybox.py`
- Create: `tools/blender/tests/test_graybox_structure.py`

**Interfaces:**
- Produces: `build_graybox() -> bpy.types.Object`
- Produces: `add_beveled_box(node_id, size, location, bevel) -> bpy.types.Object`
- Produces: `add_disc(node_id, radius, depth, location, bevel) -> bpy.types.Object`

- [ ] **Step 1: 写主结构失败测试**

```python
class GrayboxStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = build_graybox()

    def test_base_and_heaven_plate_dimensions(self):
        base = bpy.data.objects["base/body"]
        heaven = bpy.data.objects["plate/heaven"]
        self.assertVectorAlmostEqual(base.dimensions, (0.520, 0.520, 0.052))
        self.assertAlmostEqual(heaven.dimensions.x, 0.380, places=4)
        self.assertAlmostEqual(heaven.dimensions.z, 0.024, places=4)

    def test_earth_plate_is_fixed_and_heaven_plate_has_center_pivot(self):
        self.assertTrue(bpy.data.objects["plate/earth"]["fixed"])
        self.assertEqual(tuple(bpy.data.objects["plate/heaven"].location[:2]), (0.0, 0.0))

    def test_historical_ring_is_non_runtime_reference(self):
        ring = bpy.data.objects["reference/historical-ring"]
        self.assertEqual(ring["role"], "fixed-historical-inscription")
```

- [ ] **Step 2: 运行并确认生成器缺失**

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_graybox_structure.py
```

Expected: FAIL importing `build_graybox`.

- [ ] **Step 3: 实现最小参数化几何**

`geometry.py` creates cubes/cylinders, applies scale, bevel modifier and transforms, then assigns `object["node_id"] = node_id`. `build_graybox.py` must:

```python
def build_graybox():
    clear_scene()
    configure_scene_units()
    root = new_empty("artifact/root", (0.0, 0.0, 0.0))
    base = add_beveled_box("base/body", (0.520, 0.520, 0.052), (0, 0, 0.026), 0.004)
    earth = add_beveled_box("plate/earth", (0.440, 0.440, 0.010), (0, 0, 0.057), 0.002)
    earth["fixed"] = True
    heaven = add_disc("plate/heaven", 0.190, 0.024, (0, 0, 0.074), 0.002)
    add_historical_ring(radius=0.145, z=0.087)
    parent_runtime_parts(root)
    return root
```

- [ ] **Step 4: 运行结构测试并保存第一版母文件**

Run: test command from Step 2.  
Expected: all structure tests pass.

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --save assets/daliuren/source/daliuren-artifact-graybox.blend
```

Expected: `.blend` exists and Blender exits `0`.

- [ ] **Step 5: 提交主结构**

```powershell
git add tools/blender/geometry.py tools/blender/build_graybox.py tools/blender/tests/test_graybox_structure.py assets/daliuren/source/daliuren-artifact-graybox.blend
git commit -m "feat: build artifact graybox foundation"
```

### Task 4: 四课双翼、三传前桥、校时简与十二天将分件

**Files:**
- Modify: `tools/blender/build_graybox.py`
- Create: `tools/blender/tests/test_component_contract.py`

**Interfaces:**
- Produces all `NODE_IDS` from Task 2 exactly once.
- Each moving root stores custom properties: `closed_location`, `open_location`, `motion_axis`, `travel_m`.

- [ ] **Step 1: 写分件、尺寸和身份失败测试**

```python
def test_every_runtime_node_exists_once(self):
    for node_id in NODE_IDS:
        matches = [obj for obj in bpy.data.objects if obj.get("node_id") == node_id]
        self.assertEqual(len(matches), 1, node_id)

def test_four_lesson_roots_have_confirmed_size_and_visual_order(self):
    expected = ["fourth", "third", "second", "first"]
    actual = [bpy.data.objects[f"lesson/{lesson}"]["visual_order"] for lesson in expected]
    self.assertEqual(actual, [0, 1, 2, 3])
    for lesson in expected:
        obj = bpy.data.objects[f"lesson/{lesson}"]
        self.assertAlmostEqual(obj["travel_m"], 0.092)

def test_generals_are_independent_objects(self):
    generals = [obj for obj in bpy.data.objects if obj.get("domain") == "general"]
    self.assertEqual(len(generals), 12)
    self.assertEqual(len({obj.data.name for obj in generals}), 1)
```

- [ ] **Step 2: 运行并确认节点缺失**

Run: Blender background test command targeting `test_component_contract.py`.  
Expected: FAIL because lesson, transmission, calendar and general nodes do not exist.

- [ ] **Step 3: 生成所有活动分件与锚点**

Implement:

- `calendar/slip` at rear `+Y`, with a root pivot and a separate readout plate child.
- left lessons `fourth`, `third`; right lessons `second`, `first`; each root contains upper/lower readout children and a general socket anchor.
- `transmission/bridge` at front `-Y`; three child modules use fixed initial/middle/final IDs.
- twelve general roots on a radius `0.218 m`, each sharing one graybox seal mesh datablock while retaining separate object transforms and `general_key`.
- three `anchor/course-copy/*` empties outside the physical hierarchy but parented under `artifact/root`.

- [ ] **Step 4: 运行分件与全部既有 Blender 测试**

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_graybox_structure.py
```

Expected: both commands pass.

- [ ] **Step 5: 重新生成母文件并提交**

```powershell
git add tools/blender/build_graybox.py tools/blender/tests/test_component_contract.py assets/daliuren/source/daliuren-artifact-graybox.blend
git commit -m "feat: add artifact moving components"
```

### Task 5: 确定性机构姿态与边界验证

**Files:**
- Create: `tools/blender/poses.py`
- Create: `tools/blender/tests/test_poses.py`
- Modify: `tools/blender/build_graybox.py`

**Interfaces:**
- Produces: `apply_pose(pose_id: str, plate_offset: int = 0, general_direction: str = "forward") -> None`
- Produces: `snapshot_transforms() -> dict[str, tuple[float, ...]]`

- [ ] **Step 1: 写姿态行程和可逆性失败测试**

```python
def test_confirmed_motion_distances(self):
    apply_pose("closed")
    closed = snapshot_transforms()
    apply_pose("generals", plate_offset=5, general_direction="reverse")
    opened = snapshot_transforms()
    self.assertAlmostEqual(opened["calendar/slip"][2] - closed["calendar/slip"][2], 0.012)
    self.assertAlmostEqual(abs(opened["lesson/first"][0] - closed["lesson/first"][0]), 0.092)
    self.assertAlmostEqual(closed["transmission/bridge"][1] - opened["transmission/bridge"][1], 0.118)
    self.assertAlmostEqual(opened["general/noble"][2] - closed["general/noble"][2], 0.007)
    self.assertAlmostEqual(bpy.data.objects["plate/heaven"].rotation_euler.z, math.radians(150))

def test_pose_application_has_no_history_dependency(self):
    apply_pose("generals", 7, "forward")
    first = snapshot_transforms()
    apply_pose("closed")
    apply_pose("generals", 7, "forward")
    self.assertEqual(snapshot_transforms(), first)
```

- [ ] **Step 2: 运行并确认姿态模块缺失**

Run: Blender background test command targeting `test_poses.py`.  
Expected: FAIL importing `poses`.

- [ ] **Step 3: 实现绝对姿态表**

```python
POSE_PROGRESS = {
    "closed": (0, 0, 0, 0, 0),
    "calendar": (1, 0, 0, 0, 0),
    "plate": (1, 1, 0, 0, 0),
    "lessons": (1, 1, 1, 0, 0),
    "transmissions": (1, 1, 1, 1, 0),
    "generals": (1, 1, 1, 1, 1),
}

def apply_pose(pose_id, plate_offset=0, general_direction="forward"):
    calendar, plate, lessons, transmissions, generals = POSE_PROGRESS[pose_id]
    set_calendar_absolute(calendar)
    set_plate_absolute(plate, plate_offset)
    set_lessons_absolute(lessons)
    set_transmissions_absolute(transmissions)
    set_generals_absolute(generals, general_direction)
    bpy.context.view_layer.update()
```

All setters derive transforms from frozen closed positions, never from current transforms.

- [ ] **Step 4: 添加闭合包络和穿插粗检**

The test computes world-space bounding boxes. In `closed`, every physical component must remain inside `X/Y = ±0.260 m` with `0.0005 m` tolerance. In `generals`, moving component bounding boxes must not overlap the base interior collision boxes defined in `daliuren_contract.py`.

Run: `test_poses.py`.  
Expected: all pose, reversibility and envelope tests pass.

- [ ] **Step 5: 保存六个姿态场景并提交**

The builder creates one Blender collection per pose preview and disables all except `closed` before saving.

```powershell
git add tools/blender/poses.py tools/blender/tests/test_poses.py tools/blender/build_graybox.py assets/daliuren/source/daliuren-artifact-graybox.blend
git commit -m "feat: define deterministic artifact poses"
```

### Task 6: GLB 导出与机器可读资产清单

**Files:**
- Create: `tools/blender/export_graybox.py`
- Create: `scripts/validate-daliuren-glb.mjs`
- Create: `scripts/validate-daliuren-glb.test.mjs`
- Create: `assets/daliuren/asset-contract.json`
- Modify: `package.json`
- Create: `public/models/daliuren/daliuren-graybox.glb`

**Interfaces:**
- Produces: `public/models/daliuren/daliuren-graybox.glb`
- Produces: `validateArtifactDocument(document, contract): string[]`
- Adds dev dependency: `@gltf-transform/core@4.4.2`

- [ ] **Step 1: 安装固定版本的 GLB 读取依赖**

Run: `npm install --save-dev @gltf-transform/core@4.4.2`  
Expected: `package.json` and `package-lock.json` record `4.4.2`.

- [ ] **Step 2: 写清单验证失败测试**

```js
test("reports missing nodes and duplicate runtime ids", () => {
  const fake = fakeDocument([
    { name: "plate/heaven", extras: { node_id: "plate/heaven" } },
    { name: "copy", extras: { node_id: "plate/heaven" } },
  ]);
  assert.deepEqual(validateArtifactDocument(fake, CONTRACT), [
    "duplicate node_id: plate/heaven",
    "missing node_id: artifact/root",
  ]);
});
```

- [ ] **Step 3: 运行并确认验证器缺失**

Run: `node --test scripts/validate-daliuren-glb.test.mjs`  
Expected: FAIL importing the validator.

- [ ] **Step 4: 实现导出和验证**

`export_graybox.py` opens/rebuilds the scene, applies `closed`, selects `artifact/root` descendants, and calls:

```python
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_apply=False,
    export_animations=False,
)
```

`asset-contract.json` contains schema version `1`, all runtime IDs, meter dimensions, pose IDs and triangle budgets. `validate-daliuren-glb.mjs` reads GLB with `NodeIO`, checks exact node identity, duplicate IDs, scene count, dimensions tolerance, triangle count and absence of embedded dynamic Chinese course values.

- [ ] **Step 5: 导出并验证真实灰模**

Add scripts:

```json
{
  "asset:export-graybox": "node scripts/run-blender.mjs --background --factory-startup --python tools/blender/export_graybox.py",
  "asset:validate": "node scripts/validate-daliuren-glb.mjs public/models/daliuren/daliuren-graybox.glb assets/daliuren/asset-contract.json"
}
```

Run:

```powershell
npm run asset:export-graybox
npm run asset:validate
```

Expected: validator prints node count, triangle count, bounding dimensions and `0 errors`.

- [ ] **Step 6: 提交 GLB 契约**

```powershell
git add package.json package-lock.json tools/blender/export_graybox.py scripts/validate-daliuren-glb.mjs scripts/validate-daliuren-glb.test.mjs assets/daliuren/asset-contract.json public/models/daliuren/daliuren-graybox.glb
git commit -m "feat: export validated artifact graybox"
```

### Task 7: 灰模参考灯光、四镜头渲染与阶段验收

**Files:**
- Create: `tools/blender/render_graybox_review.py`
- Create: `tools/blender/tests/test_review_scene.py`
- Create: `docs/asset-reviews/graybox/overall.png`
- Create: `docs/asset-reviews/graybox/oblique.png`
- Create: `docs/asset-reviews/graybox/mechanism.png`
- Create: `docs/asset-reviews/graybox/top.png`
- Create: `docs/asset-reviews/graybox/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces four named cameras: `review/overall`, `review/oblique`, `review/mechanism`, `review/top`.
- Produces three named lights with key/fill/rim ratios.

- [ ] **Step 1: 写审阅场景失败测试**

```python
def test_review_rig_has_confirmed_camera_and_light_contract(self):
    build_review_scene()
    self.assertEqual({c.name for c in bpy.data.cameras}, {
        "review/overall", "review/oblique", "review/mechanism", "review/top",
    })
    self.assertAlmostEqual(bpy.data.objects["light/key"].data.color[0], 1.0, places=2)
    ratio = bpy.data.objects["light/fill"].data.energy / bpy.data.objects["light/key"].data.energy
    self.assertGreaterEqual(ratio, 0.25)
    self.assertLessEqual(ratio, 0.35)
```

- [ ] **Step 2: 运行并确认审阅场景缺失**

Run: Blender background test command targeting `test_review_scene.py`.  
Expected: FAIL importing `render_graybox_review`.

- [ ] **Step 3: 实现灰模审阅场景**

Use neutral gray materials, a `4300K` key approximation, 30% fill, narrow rim, world color `#121817`, and cameras with `50–70 mm` lenses. Render `overall` in closed and open poses side by side only in the README; render the remaining images from the `generals` pose.

- [ ] **Step 4: 生成并检查四张 PNG**

Add script:

```json
{ "asset:render-graybox": "node scripts/run-blender.mjs --background --factory-startup --python tools/blender/render_graybox_review.py" }
```

Run: `npm run asset:render-graybox`  
Expected: four `1920 × 1080` PNG files, each non-empty.

Use the image viewer to inspect all four files. Reject the task if any moving part intersects, if the closed silhouette exceeds the square base, or if the four lessons and three transmissions are not distinguishable from the overall camera.

- [ ] **Step 5: 写审阅记录并运行完整验证**

`README.md` records the exact Blender version, GLB hash, reviewed pose, pass/fail for silhouette, mechanism clearance, component hierarchy and inscription space. No final material claims are made in this graybox review.

Run:

```powershell
npm run test:asset-runner
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_graybox_structure.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_poses.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_review_scene.py
npm run asset:export-graybox
npm run asset:validate
npm run asset:render-graybox
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: 提交灰模验收产物**

```powershell
git add tools/blender/render_graybox_review.py tools/blender/tests/test_review_scene.py docs/asset-reviews/graybox package.json
git commit -m "docs: add artifact graybox review"
```
