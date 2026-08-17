# Daliuren Artifact Look Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在冻结的灰模节点契约上交付具有真实物件质感的高精度几何、固定铭文、PBR 材质、三级 LOD、博物馆灯光和最终 GLB。

**Architecture:** 高精度母版沿用灰模的运行时根节点与枢轴，细节以独立子网格和非破坏修改器增加，不改变已冻结的节点 ID。Blender 程序化材质保留为母版，运行时版本烘焙为金属度/粗糙度 PBR 贴图；四张固定镜头渲染和 GLB 资产检查共同构成验收门槛。

**Tech Stack:** Blender 4.5.12 LTS、Cycles、Blender Python、Noto Serif CJK SC、glTF/GLB 2.0、glTF Transform 4.4.2、Node.js 20+

## Global Constraints

- 先完成并通过 `docs/superpowers/plans/2026-08-17-daliuren-blender-graybox.md`。
- 不得重命名、删除或重新解释 `assets/daliuren/asset-contract.json` 中的运行时节点。
- 主座、天盘、四课、三传、天将的名义尺寸和全部运动行程保持不变。
- 几何承担厚度、主要倒角、刻槽、接缝、转轴、导轨、卡榫和锁位齿；贴图只承担微表面。
- 固定历史铭文可以建模或烘焙；当前课例的四柱、四课、三传和天将值不得烘焙进 GLB。
- 色板固定为砚墨 `#121817`、玄铜 `#26322F`、铜绿 `#435C53`、雨过天青 `#879B92`、香灰 `#C2C6BB`、旧金 `#80704C`。
- 朱砂只用于人工修正和错误，不进入常态资产材质。
- LOD0 ≤ `300,000` 三角面；LOD2 ≤ `80,000` 三角面。

---

### Task 1: 可分发中文字体与固定铭文契约

**Files:**
- Create: `assets/daliuren/fonts/NotoSerifCJKsc-Regular.otf`
- Create: `assets/daliuren/fonts/OFL.txt`
- Create: `assets/daliuren/inscriptions/fixed-inscriptions.json`
- Create: `tools/blender/inscriptions.py`
- Create: `tools/blender/tests/test_inscriptions.py`

**Interfaces:**
- Produces: `load_fixed_inscriptions(path) -> tuple[Inscription, ...]`
- Produces: `build_fixed_inscriptions(parent, font_path) -> list[bpy.types.Object]`
- Fixed inscription roles: `earth-branch`, `historical-beidou`, `historical-mansion`, `historical-month-deity`, `mechanical-scale`.

- [ ] **Step 1: 添加 OFL 字体与来源记录**

Download `https://github.com/notofonts/noto-cjk/releases/download/Serif2.003/09_NotoSerifCJKsc.zip`, extract `OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf` and `LICENSE`, rename the license to `OFL.txt`, and record the release URL plus the ZIP SHA-256 in `fixed-inscriptions.json` under `font`.

- [ ] **Step 2: 写铭文完整性失败测试**

```python
def test_fixed_inscriptions_have_complete_non_dynamic_sets(self):
    items = load_fixed_inscriptions(FIXTURE)
    earth = [item.text for item in items if item.role == "earth-branch"]
    mansions = [item for item in items if item.role == "historical-mansion"]
    deities = [item for item in items if item.role == "historical-month-deity"]
    self.assertEqual(earth, list("子丑寅卯辰巳午未申酉戌亥"))
    self.assertEqual(len(mansions), 28)
    self.assertEqual(len(deities), 12)
    forbidden = {"贵人", "初传", "中传", "末传", "父母", "官鬼"}
    self.assertTrue(forbidden.isdisjoint({item.text for item in items}))
```

- [ ] **Step 3: 运行并确认铭文模块缺失**

Run: Blender background command targeting `tools/blender/tests/test_inscriptions.py`.  
Expected: FAIL importing `inscriptions`.

- [ ] **Step 4: 实现固定铭文读取和建模**

`fixed-inscriptions.json` stores explicit role, text, angular index, radius, depth and contrast tier. `build_fixed_inscriptions` creates curve text, loads the bundled font, converts only fixed text to mesh, uses shallow engraving depth for history and old-gold inlay depth for functional scales. Every object stores `inscription_role` and `contrast_tier`.

- [ ] **Step 5: 验证历史层级与运行时隔离**

The test asserts historical engraving depth is smaller than functional scale depth, all text objects are children of fixed geometry, and no fixed text object is parented under `calendar/slip`, `lesson/*`, `transmission/*` or `general/*`.

Run: inscription test.  
Expected: all tests pass.

- [ ] **Step 6: 提交字体与铭文契约**

```powershell
git add assets/daliuren/fonts assets/daliuren/inscriptions tools/blender/inscriptions.py tools/blender/tests/test_inscriptions.py
git commit -m "feat: add licensed fixed inscriptions"
```

### Task 2: 高精度承力结构、接缝与机构细节

**Files:**
- Create: `tools/blender/high_detail_geometry.py`
- Create: `tools/blender/tests/test_high_detail_geometry.py`
- Modify: `tools/blender/build_graybox.py`
- Create: `assets/daliuren/source/daliuren-artifact-master.blend`

**Interfaces:**
- Produces: `upgrade_to_high_detail(root) -> bpy.types.Object`
- Preserves every runtime root transform and node ID from the graybox.

- [ ] **Step 1: 写运行时根节点不变和真实细节失败测试**

```python
def test_upgrade_preserves_runtime_contract(self):
    before = runtime_root_transforms()
    upgrade_to_high_detail(bpy.data.objects["artifact/root"])
    self.assertEqual(runtime_root_transforms(), before)

def test_visible_edges_have_real_bevels(self):
    upgrade_to_high_detail(bpy.data.objects["artifact/root"])
    for node_id in REQUIRED_BEVELED_ROOTS:
        modifiers = bpy.data.objects[node_id].modifiers
        self.assertTrue(any(mod.type == "BEVEL" and mod.width >= 0.0004 for mod in modifiers), node_id)

def test_mechanism_parts_are_geometry_not_normal_map_labels(self):
    required = {"mechanism/heaven-bearing", "mechanism/lesson-dovetails", "mechanism/bridge-stops", "mechanism/general-track"}
    self.assertTrue(required.issubset({obj.get("detail_id") for obj in bpy.data.objects}))
```

- [ ] **Step 2: 运行并确认高精度模块缺失**

Run: Blender background command targeting `test_high_detail_geometry.py`.  
Expected: FAIL importing `high_detail_geometry`.

- [ ] **Step 3: 实现非破坏高精度结构**

Add geometry for:

- main base shell thickness, removable bottom seam and restrained cast corner transitions;
- heaven plate bronze rim, inner support ribs, center bearing, twelve detents and shallow inlay beds;
- four visible dovetail rails, end stops, readout lift beds and general sockets;
- bridge support body, three direction tenons and front stop;
- recessed general chain track and twelve independent top seal interfaces;
- visible contact seams between bronze structure and celadon inserts.

All new detail meshes are children of the existing runtime root they visually belong to. No detail child receives a runtime `node_id`.

- [ ] **Step 4: 运行闭合、展开与包络回归测试**

Run:

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_poses.py
```

Expected: runtime transforms unchanged; pose and envelope tests still pass.

- [ ] **Step 5: 保存高精度母版并提交**

Generate `daliuren-artifact-master.blend` from the graybox builder plus `upgrade_to_high_detail` and fixed inscriptions.

```powershell
git add tools/blender/high_detail_geometry.py tools/blender/tests/test_high_detail_geometry.py tools/blender/build_graybox.py assets/daliuren/source/daliuren-artifact-master.blend
git commit -m "feat: model high detail artifact structure"
```

### Task 3: 五类 PBR 母版材质与因果老化遮罩

**Files:**
- Create: `tools/blender/materials.py`
- Create: `tools/blender/tests/test_materials.py`
- Create: `assets/daliuren/materials/material-contract.json`
- Modify: `assets/daliuren/source/daliuren-artifact-master.blend`

**Interfaces:**
- Produces materials: `M_Bronze`, `M_Patina`, `M_Celadon`, `M_OldGold`, `M_AshText`.
- Produces named masks: `mask_contact_wear`, `mask_recess_oxidation`, `mask_insert_dirt`, `mask_celadon_crackle`.

- [ ] **Step 1: 写材质节点与色板失败测试**

```python
def test_material_palette_and_physical_roles(self):
    build_master_materials()
    bronze = bpy.data.materials["M_Bronze"]
    celadon = bpy.data.materials["M_Celadon"]
    self.assertAlmostEqual(principled(bronze).inputs["Metallic"].default_value, 1.0)
    self.assertAlmostEqual(principled(celadon).inputs["Metallic"].default_value, 0.0)
    self.assertColorClose(base_color(bronze), srgb("#26322F"))
    self.assertColorClose(base_color(celadon), srgb("#879B92"))

def test_wear_masks_are_not_shared_as_one_uniform_noise(self):
    names = set(bpy.data.node_groups.keys())
    self.assertTrue({"mask_contact_wear", "mask_recess_oxidation", "mask_insert_dirt", "mask_celadon_crackle"}.issubset(names))
```

- [ ] **Step 2: 运行并确认材质模块缺失**

Run: Blender background command targeting `test_materials.py`.  
Expected: FAIL importing `materials`.

- [ ] **Step 3: 实现 Principled BSDF 材质**

`M_Bronze` uses metalness `1`, medium-high base roughness with a separate polished-edge reduction. `M_Patina` is a masked bronze surface variation, not a dielectric paint. `M_Celadon` is non-metallic with restrained coat/specular response and micro-normal orange-peel. `M_OldGold` is metallic and only assigned to functional inlay. `M_AshText` is non-metallic and reserved for readable fixed text.

- [ ] **Step 4: 实现有因果的老化分布**

Use curvature/contact vertex attributes and explicitly painted masks:

- contact wear on outer touch edges, detents, rails and insert slots;
- recess oxidation in grooves, underside seams and bearing roots;
- insert dirt only at bronze/celadon boundaries;
- crackle only on celadon UV islands, with no crossing into bronze.

Tests sample named material slots and verify mirrored lesson modules do not reference the same asymmetric dirt mask transform.

- [ ] **Step 5: 运行材质测试并生成球体参考板**

Render one neutral material sphere per material under the same 4300K key. Save `docs/asset-reviews/lookdev/material-board.png` at `1920 × 1080` and record material parameters in `material-contract.json`.

- [ ] **Step 6: 提交母版材质**

```powershell
git add tools/blender/materials.py tools/blender/tests/test_materials.py assets/daliuren/materials/material-contract.json assets/daliuren/source/daliuren-artifact-master.blend docs/asset-reviews/lookdev/material-board.png
git commit -m "feat: build artifact PBR materials"
```

### Task 4: UV、贴图烘焙与动态文字保留区

**Files:**
- Create: `tools/blender/uv_and_bake.py`
- Create: `tools/blender/tests/test_uv_and_bake.py`
- Create: `assets/daliuren/textures/lod0/*`
- Create: `assets/daliuren/textures/lod2/*`
- Modify: `assets/daliuren/materials/material-contract.json`

**Interfaces:**
- Produces texture sets per material family: base color, ORM, normal, emissive only where rule-highlight channels require it.
- Produces dynamic label UV regions named `dynamic/calendar`, `dynamic/lesson/*`, `dynamic/transmission/*`, `dynamic/general/*`.

- [ ] **Step 1: 写 UV 和动态区域失败测试**

```python
def test_every_export_mesh_has_non_overlapping_primary_uvs(self):
    for obj in export_meshes():
        self.assertIn("UVMap", obj.data.uv_layers)
        self.assertFalse(has_out_of_bounds_uvs(obj, "UVMap"), obj.name)

def test_dynamic_label_surfaces_are_not_baked_with_course_values(self):
    surfaces = [obj for obj in bpy.data.objects if obj.get("dynamic_label_id")]
    self.assertEqual(len(surfaces), 4 + 3 + 12 + 2)
    self.assertTrue(all(len(obj.data.materials) == 1 for obj in surfaces))
    self.assertEqual({obj.data.materials[0].name for obj in surfaces}, {"M_DynamicLabelPlaceholder"})
```

- [ ] **Step 2: 运行并确认 UV/烘焙模块缺失**

Run: Blender background command targeting `test_uv_and_bake.py`.  
Expected: FAIL importing `uv_and_bake`.

- [ ] **Step 3: 实现 UV 规则与贴图尺寸**

- LOD0 hero surfaces: at most 4096 px per shared family atlas.
- moving modules and generals: 2048 px shared atlases.
- LOD2: 1024–2048 px atlases.
- fixed inscription geometry may bake into functional/history atlases.
- dynamic label surfaces keep a blank placeholder material and stable UV orientation. The two non-module surfaces are `dynamic/calendar` and `dynamic/transmission/method`.

- [ ] **Step 4: 烘焙并验证 PBR 通道**

Bake base color, metallic/roughness/AO packed as ORM, and tangent-space normal. Run the test plus a Node image metadata check that asserts expected dimensions, color-space roles and absence of alpha on opaque bronze maps.

- [ ] **Step 5: 提交贴图与烘焙规则**

```powershell
git add tools/blender/uv_and_bake.py tools/blender/tests/test_uv_and_bake.py assets/daliuren/textures assets/daliuren/materials/material-contract.json
git commit -m "feat: bake artifact runtime textures"
```

### Task 5: LOD0/1/2、最终 GLB 与资产预算验证

**Files:**
- Create: `tools/blender/build_lods.py`
- Create: `tools/blender/tests/test_lods.py`
- Modify: `tools/blender/export_graybox.py`
- Modify: `assets/daliuren/asset-contract.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/models/daliuren/daliuren-artifact-lod0.glb`
- Create: `public/models/daliuren/daliuren-artifact-lod1.glb`
- Create: `public/models/daliuren/daliuren-artifact-lod2.glb`

**Interfaces:**
- Produces: `build_lod(level: int) -> bpy.types.Collection`
- Preserves identical runtime `node_id` sets across all LOD files.

- [ ] **Step 1: 写 LOD 身份和预算失败测试**

```python
def test_lods_preserve_runtime_identity_and_budget(self):
    lod0 = build_lod(0)
    lod1 = build_lod(1)
    lod2 = build_lod(2)
    self.assertEqual(runtime_ids(lod0), runtime_ids(lod1))
    self.assertEqual(runtime_ids(lod1), runtime_ids(lod2))
    self.assertLessEqual(triangle_count(lod0), 300_000)
    self.assertLessEqual(triangle_count(lod2), 80_000)
```

- [ ] **Step 2: 运行并确认 LOD 模块缺失**

Run: Blender background command targeting `test_lods.py`.  
Expected: FAIL importing `build_lods`.

- [ ] **Step 3: 实现分层减面**

LOD1 reduces hidden underside, secondary grooves, inner chain links and micro-bevel segments while preserving silhouette and dynamic label surfaces. LOD2 replaces chain internals and bearing detail with simple meshes, reduces radial segment counts, and removes geometry smaller than `0.8 mm` that does not carry rules or silhouette.

- [ ] **Step 4: 导出并运行三档资产验证**

Run the exporter for levels 0, 1 and 2. For each GLB, `asset:validate` checks node IDs, bounds, triangle counts, material families, dynamic label surfaces and extras schema. It also asserts no LOD removes lessons, transmissions, generals or copy anchors.

- [ ] **Step 5: 使用 KTX2 压缩运行时纹理**

Install `@gltf-transform/cli@4.4.2` as a dev dependency. For each exported GLB, first encode normal/ORM textures with UASTC, then encode base-color textures with ETC1S:

```powershell
npx gltf-transform uastc input.glb intermediate.glb --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" --level 4 --rdo --rdo-lambda 4 --zstd 18
npx gltf-transform etc1s intermediate.glb output.glb --slots "{baseColorTexture,emissiveTexture}" --quality 255
```

Run `npx gltf-transform inspect output.glb` and the project asset validator. The validator must find `KHR_texture_basisu` on textured assets, preserve all runtime nodes and confirm no texture exceeds the per-LOD size in Task 4.

- [ ] **Step 6: 提交最终 GLB**

```powershell
git add tools/blender/build_lods.py tools/blender/tests/test_lods.py tools/blender/export_graybox.py assets/daliuren/asset-contract.json public/models/daliuren/daliuren-artifact-lod*.glb package.json package-lock.json
git commit -m "feat: export artifact LOD assets"
```

### Task 6: 博物馆灯光、四类写实镜头与视觉验收

**Files:**
- Create: `tools/blender/render_lookdev_review.py`
- Create: `tools/blender/tests/test_lookdev_scene.py`
- Create: `docs/asset-reviews/lookdev/overall.png`
- Create: `docs/asset-reviews/lookdev/oblique.png`
- Create: `docs/asset-reviews/lookdev/material-closeup.png`
- Create: `docs/asset-reviews/lookdev/rotation-evidence.png`
- Create: `docs/asset-reviews/lookdev/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces Cycles review scene with key/fill/rim names and fixed camera transforms.
- Produces a review manifest with Blender version, render engine, samples, asset hashes and pass/fail evidence.

- [ ] **Step 1: 写灯光和相机失败测试**

```python
def test_museum_rig_contract(self):
    build_lookdev_scene()
    key = bpy.data.objects["light/key"]
    fill = bpy.data.objects["light/fill"]
    self.assertEqual(bpy.context.scene.render.engine, "CYCLES")
    self.assertGreaterEqual(fill.data.energy / key.data.energy, 0.25)
    self.assertLessEqual(fill.data.energy / key.data.energy, 0.35)
    for name in ("camera/overall", "camera/oblique", "camera/material-closeup", "camera/rotation-evidence"):
        self.assertGreaterEqual(bpy.data.objects[name].data.lens, 50)
        self.assertLessEqual(bpy.data.objects[name].data.lens, 70)
```

- [ ] **Step 2: 运行并确认写实审阅模块缺失**

Run: Blender background command targeting `test_lookdev_scene.py`.  
Expected: FAIL importing `render_lookdev_review`.

- [ ] **Step 3: 实现灯光和色彩管理**

Use AgX color management, `#121817` world/background, 4300K-equivalent key, 25–35% fill and narrow rim. Keep bloom disabled in reference renders. The close-up camera must frame bronze, patina, celadon, old-gold inlay and a real seam in one image.

- [ ] **Step 4: 渲染并进行四镜头人工检查**

Run: `npm run asset:render-lookdev`.  
Expected: four `2560 × 1440` PNG files.

Inspect all files. The review fails if any of these are absent: real edge thickness, continuous moving highlight, bronze/celadon reflection difference, contact-driven wear, recess oxidation, readable functional inscription, lower-contrast historical inscription, grounded contact shadow.

- [ ] **Step 5: 运行全计划验证**

```powershell
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_inscriptions.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_materials.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_lods.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_lookdev_scene.py
npm run asset:validate -- public/models/daliuren/daliuren-artifact-lod0.glb assets/daliuren/asset-contract.json
npm run asset:validate -- public/models/daliuren/daliuren-artifact-lod1.glb assets/daliuren/asset-contract.json
npm run asset:validate -- public/models/daliuren/daliuren-artifact-lod2.glb assets/daliuren/asset-contract.json
npm run build
```

Expected: all commands exit `0`; review README records four visual checks as passed.

- [ ] **Step 6: 提交写实验收**

```powershell
git add tools/blender/render_lookdev_review.py tools/blender/tests/test_lookdev_scene.py docs/asset-reviews/lookdev package.json assets/daliuren/source/daliuren-artifact-master.blend
git commit -m "docs: approve artifact look development"
```
