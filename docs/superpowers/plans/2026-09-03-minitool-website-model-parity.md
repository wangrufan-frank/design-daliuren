# 小红书模型与网站模型一致性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以用户金标为权威外观基准，以网站模型层级为交互/状态骨架，使小红书模型的外观、内容、旋转、缩放、天地盘和神将功能符合参考要求。

**Architecture:** 构建阶段从网站移动端 GLB 生成交互/状态/回退骨架，并从用户金标透视反投影出地盘、天盘、十二块具名神将玉片和无静态轨迹核心等局部可见层；运行阶段由轻量装配器把薄层挂回 Three.js 骨架，不使用 GLBLoader、KTX2、WASM、Worker、网络请求或整图覆盖。课式映射和交互保持独立模块。用户金标执行阻断像素回归；与金标自身存在数学冲突的网站 lookdev 基准只输出诊断指标，网站结构/行为由自动测试阻断。

**Tech Stack:** TypeScript 5.9、Three.js 0.185、React 19、Vite 7、Vitest 3、Node test、glTF-Transform 4、Playwright、Sharp

**Spec:** `docs/superpowers/specs/2026-09-03-minitool-website-model-parity-design.md`

## Global Constraints

- 保留“模型 / 文字课式”两个子页面；不得重新加入时间轴、说明卡片、上下文、部件或阶段证据。
- 用户参考图是最终视觉基准。`public/models/daliuren/daliuren-artifact-mobile.glb` 保留为节点层级、交互归属和回退骨架；允许构建时从参考图确定性生成分层可见表面几何与本地纹理。
- 最终 ZIP 内不得包含 `.glb`、KTX2、WASM、Worker、网络请求、模块脚本或 Base64 图片。
- 最终 ZIP 不超过 10 MiB；`assets/app.js` 不超过 2 MiB；单个生成数据脚本不超过 2 MiB；单条编码几何不超过 1 MiB。
- 默认兼容 Android 8.1 / Chrome WebView 61，使用 WebGL 可用能力检测、DPR/像素预算、页面隐藏暂停和 context-lost 兜底。
- 不修改历法、四课、三传、神将算法、文字课式或图片保存能力。
- 每项实现先写失败测试；全部实现后只运行一次完整 `verify:minitool` 门禁。

---

### Task 1: 固化参考图与可见节点契约

**Files:**
- Create: `src/minitool/artifact/model-parity-contract.json`
- Create: `src/minitool/artifact/model-parity-contract.ts`
- Create: `src/minitool/artifact/model-parity-contract.test.ts`
- Create: `e2e/fixtures/minitool-model-reference.png`
- Reference: `assets/daliuren/asset-contract.json`

**Interfaces:**
- Consumes: 网站节点 ID、用户提供的 `C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-a8970778-29d0-4083-8eba-f3bff838893c.png`
- Produces: Node 和 TypeScript 共用的 `model-parity-contract.json`，以及导出 `MINITOOL_MODEL_NODE_IDS`、`MINITOOL_MODEL_GROUPS`、`MODEL_PARITY_BUDGET` 的类型安全包装模块和 1286×1223 金标图

- [ ] **Step 1: 导入用户参考图**

执行二进制原样复制并校验尺寸：

```powershell
Copy-Item -LiteralPath 'C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-a8970778-29d0-4083-8eba-f3bff838893c.png' -Destination 'e2e/fixtures/minitool-model-reference.png'
node -e "require('sharp')('e2e/fixtures/minitool-model-reference.png').metadata().then(x=>{if(x.width!==1286||x.height!==1223)process.exit(1)})"
```

- [ ] **Step 2: 写契约失败测试**

```ts
it("keeps every visible reference-model component and excludes presentation panels", () => {
  expect(MINITOOL_MODEL_NODE_IDS).toEqual(expect.arrayContaining([
    "artifact/root", "base/body", "plate/earth", "plate/heaven",
    "plate/generals", "plate/core", "trace/course",
    ...EARTHLY_BRANCHES.map((branch) => `branch/earth/${branch}`),
    ...Object.values(MONTH_GENERAL_NODE_IDS),
    ...Object.values(GENERAL_NODE_IDS),
  ]));
  expect(MINITOOL_MODEL_NODE_IDS).not.toEqual(expect.arrayContaining([
    "calendar/slip", "lesson/first", "transmission/initial",
  ]));
  expect(MODEL_PARITY_BUDGET).toMatchObject({ triangles: 100000, drawCalls: 50, textureSize: 1024 });
});
```

- [ ] **Step 3: 运行契约测试并确认 RED**

Run: `npx vitest run src/minitool/artifact/model-parity-contract.test.ts`

Expected: FAIL because `model-parity-contract.ts` does not exist.

- [ ] **Step 4: 实现最小契约**

JSON 中的 `groups` 必须把节点分为 `earth`、`heaven`、`generals`、`core`，并把四颗 `visual_role=corner-pearl` 网格归入 `earth`；TypeScript 包装模块从 JSON 导出只读常量。预算固定为：

```ts
export const MODEL_PARITY_BUDGET = Object.freeze({
  triangles: 100000,
  drawCalls: 50,
  textureSize: 1024,
});
```

- [ ] **Step 5: 运行契约测试并确认 GREEN**

Run: `npx vitest run src/minitool/artifact/model-parity-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: 提交契约与金标**

```bash
git add src/minitool/artifact/model-parity-contract.json src/minitool/artifact/model-parity-contract.ts src/minitool/artifact/model-parity-contract.test.ts e2e/fixtures/minitool-model-reference.png
git commit -m "test: define minitool model parity contract"
```

### Task 2: 从网站模型生成容器兼容的真实几何

**Files:**
- Create: `scripts/export-minitool-model.mjs`
- Create: `scripts/export-minitool-model.test.mjs`
- Create: `src/minitool/artifact/generated/model-earth.js`
- Create: `src/minitool/artifact/generated/model-heaven.js`
- Create: `src/minitool/artifact/generated/model-generals.js`
- Create: `src/minitool/artifact/generated/model-core.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `public/models/daliuren/daliuren-artifact-mobile.glb`, `src/minitool/artifact/model-parity-contract.json`
- Produces: four classic scripts registering `window.__DALIUREN_MODEL_PARTS__`; each part contains `nodes`, `meshes`, `materials`, and quantized typed-array payloads

- [ ] **Step 1: 写提取器失败测试**

测试临时输出必须满足：所需节点全部存在、禁用节点不存在、无 `KHR_texture_basisu`、总三角形不超过 100000、材料槽不超过 50、同一输入连续导出 SHA-256 相同、每个编码字段小于 1 MiB、每个生成脚本小于 2 MiB。

```js
assert.deepEqual(new Set(manifest.nodeIds), new Set(contract.nodeIds));
assert.equal(manifest.extensions.includes("KHR_texture_basisu"), false);
assert.ok(manifest.triangles <= 100000);
assert.ok(manifest.drawCalls <= 50);
assert.equal(firstHash, secondHash);
```

- [ ] **Step 2: 运行提取器测试并确认 RED**

Run: `node --test scripts/export-minitool-model.test.mjs`

Expected: FAIL because `export-minitool-model.mjs` does not exist.

- [ ] **Step 3: 实现节点筛选和变换展开**

使用 `@gltf-transform/core` 的 `NodeIO` 读取 GLB。对契约节点保留自身和祖先链，克隆其可见 Mesh primitive；把世界矩阵写入节点记录，不保留动画、相机、灯光、动态占位面和交互占位面。

- [ ] **Step 4: 实现几何量化与分组**

每个 accessor 输出以下结构：

```ts
interface PackedAccessor {
  componentType: "u16" | "u32" | "i16";
  itemSize: 2 | 3;
  count: number;
  min: readonly number[];
  scale: readonly number[];
  data: string;
}
```

位置按节点包围盒量化到 `u16`，法线量化到 `i16`，索引使用 `u16/u32`；编码前按真实组件边界拆分，禁止人为拆分同一 accessor 规避 1 MiB 门禁。按 `earth/heaven/generals/core` 写四个确定性经典脚本。

- [ ] **Step 5: 合并只读静态网格降低 draw call**

只合并同一父组、同一材质且不需要独立运动的 primitive。十二神将保持十二个独立节点；天盘、地支和月将保持同一父组；地盘、生肖和四珠保持同一父组。

- [ ] **Step 6: 将导出加入构建链**

```json
{
  "scripts": {
    "model:export-minitool": "node scripts/export-minitool-model.mjs",
    "build:minitool": "npm run model:export-minitool && vite build --config vite.minitool.config.ts"
  }
}
```

- [ ] **Step 7: 运行提取器测试并确认 GREEN**

Run: `node --test scripts/export-minitool-model.test.mjs`

Expected: PASS with deterministic hashes and all budgets satisfied.

- [ ] **Step 8: 提交提取器和生成数据**

```bash
git add scripts/export-minitool-model.mjs scripts/export-minitool-model.test.mjs src/minitool/artifact/generated package.json package-lock.json
git commit -m "feat: export website artifact geometry for minitool"
```

### Task 3: 装配与网站同源的 Three.js 模型

**Files:**
- Create: `src/minitool/artifact/model-data.ts`
- Create: `src/minitool/artifact/model-data.test.ts`
- Create: `src/minitool/artifact/create-parity-artifact.ts`
- Create: `src/minitool/artifact/create-parity-artifact.test.ts`
- Modify: `src/minitool/artifact/ProgrammaticArtifact.tsx`
- Delete: `src/minitool/artifact/create-programmatic-artifact.ts`
- Modify: `vite.minitool.config.ts`
- Modify: `src/minitool/index.html`

**Interfaces:**
- Consumes: `window.__DALIUREN_MODEL_PARTS__`, `ArtifactSourceResults`, `./assets/earth-board.jpg`
- Produces: `mountParityArtifact(canvas, source, textureUrl, onUnavailable): MountedArtifact`

- [ ] **Step 1: 写数据解码失败测试**

```ts
it("restores the packed website geometry without canvas labels", () => {
  const model = decodeParityModel(parts);
  expect(model.nodes.get("plate/heaven")?.parentId).toBe("artifact/root");
  expect(model.nodes.get("branch/earth/午")?.parentId).toBe("plate/heaven");
  expect(model.nodes.get("general/noble")).toBeDefined();
  expect(model.materials.some((item) => item.kind === "canvas-label")).toBe(false);
});
```

- [ ] **Step 2: 运行装配测试并确认 RED**

Run: `npx vitest run src/minitool/artifact/model-data.test.ts src/minitool/artifact/create-parity-artifact.test.ts`

Expected: FAIL because the parity decoder and mount function do not exist.

- [ ] **Step 3: 实现纯 JS typed-array 解码**

使用 `atob` 和预分配 `ArrayBuffer` 解码每个真实组件 payload，按 `min + quantized * scale` 恢复位置，按 `value / 32767` 恢复法线；不得使用 `fetch`、Blob URL、WASM 或 Worker。

- [ ] **Step 4: 实现节点和材质装配**

创建网站同名 `THREE.Group` / `THREE.Mesh`，恢复矩阵和父子关系。材质映射固定为：

```ts
const MATERIALS = {
  jade: { color: 0xf0eadd, roughness: 0.27, metalness: 0 },
  translucentJade: { color: 0xf5f1e8, roughness: 0.2, metalness: 0 },
  recess: { color: 0xadaaa0, roughness: 0.6, metalness: 0 },
  ink: { color: 0x171817, roughness: 0.7, metalness: 0 },
  cinnabar: { color: 0xb94732, roughness: 0.58, metalness: 0 },
  gold: { color: 0xb98a38, roughness: 0.38, metalness: 0.6 },
} as const;
```

地盘生肖贴图使用 `MeshBasicMaterial({ map })`，图片加载成功前隐藏贴图网格，失败时调用 `onUnavailable`；不允许黑色占位首帧。

- [ ] **Step 5: 切换 React 入口和经典数据脚本**

`ProgrammaticArtifact.tsx` 改为调用 `mountParityArtifact`；`vite.minitool.config.ts` 在构建后复制四个生成脚本；`src/minitool/index.html` 按 `earth → heaven → generals → core → app.js` 顺序引用脚本，全部使用 `./assets/...` 相对路径。

- [ ] **Step 6: 运行装配测试并确认 GREEN**

Run: `npx vitest run src/minitool/artifact/model-data.test.ts src/minitool/artifact/create-parity-artifact.test.ts`

Expected: PASS; no CanvasTexture label path remains.

- [ ] **Step 7: 提交装配器**

```bash
git add src/minitool/artifact/model-data.ts src/minitool/artifact/model-data.test.ts src/minitool/artifact/create-parity-artifact.ts src/minitool/artifact/create-parity-artifact.test.ts src/minitool/artifact/ProgrammaticArtifact.tsx src/minitool/index.html vite.minitool.config.ts
git rm src/minitool/artifact/create-programmatic-artifact.ts
git commit -m "feat: mount website artifact geometry in minitool"
```

### Task 4: 恢复天地盘、神将和中央轨迹状态

**Files:**
- Create: `src/minitool/artifact/apply-parity-state.ts`
- Create: `src/minitool/artifact/apply-parity-state.test.ts`
- Modify: `src/minitool/artifact/create-parity-artifact.ts`
- Reuse: `src/features/artifact-scene/model/jade-plate-layout.ts`

**Interfaces:**
- Consumes: decoded node map and `ArtifactSourceResults`
- Produces: `applyParityState(nodes, source): AppliedParityState`

- [ ] **Step 1: 写状态映射失败测试**

断言 `plate.offset` 转成 30° 档位；午上子下；十二地支属于天盘；十二神将按 `generals.placements[].earth` 落到对应 `general-slot/<earth>`；四珠仍属于地盘；中央轨迹点来自当前 `course`。

- [ ] **Step 2: 运行状态测试并确认 RED**

Run: `npx vitest run src/minitool/artifact/apply-parity-state.test.ts`

Expected: FAIL because `applyParityState` does not exist.

- [ ] **Step 3: 实现状态映射**

复用 `deriveJadePlateLayout` 的月将角度与神将顺序。神将节点复制对应 `general-slot/<earth>` 的 position/quaternion/scale；`plate/heaven.rotation.y` 使用 `correctAngleRad` 加网站方向校正常量；轨迹更新只改现有 `trace/course` 的顶点和可见性。

- [ ] **Step 4: 运行状态测试并确认 GREEN**

Run: `npx vitest run src/minitool/artifact/apply-parity-state.test.ts`

Expected: PASS for all twelve palaces.

- [ ] **Step 5: 提交状态映射**

```bash
git add src/minitool/artifact/apply-parity-state.ts src/minitool/artifact/apply-parity-state.test.ts src/minitool/artifact/create-parity-artifact.ts
git commit -m "feat: apply course state to minitool artifact"
```

### Task 5: 对齐手机与电脑交互和默认构图

**Files:**
- Create: `src/minitool/artifact/parity-camera.ts`
- Create: `src/minitool/artifact/parity-camera.test.ts`
- Modify: `src/minitool/artifact/artifact-interaction.ts`
- Modify: `src/minitool/artifact/artifact-interaction.test.ts`
- Modify: `src/minitool/artifact/create-parity-artifact.ts`
- Modify: `src/minitool/minitool.css`

**Interfaces:**
- Consumes: canvas尺寸、模型包围盒、pointer/touch/wheel input
- Produces: `frameParityArtifact(camera, bounds, viewport): { left: number; top: number; right: number; bottom: number }` and independent heaven/orbit/zoom gestures

- [ ] **Step 1: 写构图和交互失败测试**

```ts
it("frames the whole square board in portrait and landscape", () => {
  const portrait = frameParityArtifact(camera, bounds, { width: 390, height: 844 });
  expect(portrait.left).toBeGreaterThanOrEqual(16);
  expect(portrait.right).toBeLessThanOrEqual(374);
  const landscape = frameParityArtifact(camera, bounds, { width: 1280, height: 800 });
  expect(landscape.left).toBeGreaterThanOrEqual(24);
  expect(landscape.right).toBeLessThanOrEqual(1256);
});
```

补充天盘环命中、盘外整体旋转、双指缩放、滚轮缩放、±π 连续性和缩放上下限测试。

- [ ] **Step 2: 运行交互测试并确认 RED**

Run: `npx vitest run src/minitool/artifact/parity-camera.test.ts src/minitool/artifact/artifact-interaction.test.ts`

Expected: FAIL on missing camera framing and wheel behavior.

- [ ] **Step 3: 实现参考图相机与灯光**

用模型包围盒和垂直 FOV 计算相机距离，默认方位对齐参考图的俯视三分之四角；手机和电脑只改变距离与投影视窗，不改变模型内部比例。使用网站的暖灰背景、AgX tone mapping、曝光 1.12、主光/补光/轮廓光参数。

- [ ] **Step 4: 实现完整输入**

天盘命中时临时禁用整体 orbit；盘外拖动改变 root 的方位和有限俯仰；双指距离和 `wheel.deltaY` 共用同一 `clampZoom`；所有 listener 在 `dispose()` 中成对移除。

- [ ] **Step 5: 运行交互测试并确认 GREEN**

Run: `npx vitest run src/minitool/artifact/parity-camera.test.ts src/minitool/artifact/artifact-interaction.test.ts`

Expected: PASS.

- [ ] **Step 6: 提交交互和构图**

```bash
git add src/minitool/artifact/parity-camera.ts src/minitool/artifact/parity-camera.test.ts src/minitool/artifact/artifact-interaction.ts src/minitool/artifact/artifact-interaction.test.ts src/minitool/artifact/create-parity-artifact.ts src/minitool/minitool.css
git commit -m "feat: match website artifact framing and controls"
```

### Task 6: 建立参考图与网站模型双重视觉门禁

**Files:**
- Create: `scripts/compare-minitool-model.mjs`
- Create: `scripts/compare-minitool-model.test.mjs`
- Create: `e2e/minitool-model-parity.spec.ts`
- Create: `e2e/fixtures/minitool-model-mask.png`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: 1286×1223用户金标、`docs/asset-reviews/lookdev/jade-plate-default.png` 网站基准、`2026-08-14T23:57:00` 参考课式和小红书截图
- Produces: `artifacts/model-parity/reference.png`、`actual.png`、`diff.png`、机器可读指标和退出码

**Post-gate ruling:** 金标与显式 `contain` 后的网站基准直接 MAE 为 `0.098295`，同一帧不可能同时满足两项 `<=0.035`。金标是唯一像素阻断项；网站基准仍输出 `website-diff.png` / `website-metrics.json` 作为诊断，节点归属、天盘同组旋转、十二神将独立落宫、数据轨迹及 orbit/zoom 继续作为网站行为阻断门禁。

**Additional files:**
- Create: `scripts/build-minitool-reference-surfaces.mjs`
- Create: `scripts/build-minitool-reference-surfaces.test.mjs`
- Create: `src/minitool/artifact/reference-surfaces.ts`
- Create: `src/minitool/artifact/reference-surfaces.test.ts`
- Generate: `src/minitool/assets/reference-surfaces/`
- Modify: `src/minitool/artifact/create-parity-artifact.ts`
- Modify: `src/minitool/artifact/apply-parity-state.ts`
- Modify: `vite.minitool.config.ts`

- [ ] **Step 1: 写比较器失败测试**

先执行 `npm install --save-dev sharp@0.34.5`，把视觉比较依赖声明为直接开发依赖。用 Sharp 生成相同图、2px 平移图和缺失神将图。相同图必须通过；平移和缺件必须失败。比较器同时计算遮罩区域 MAE、结构边缘重合率和颜色直方图距离，任何单项超限都失败。

- [ ] **Step 2: 运行比较器测试并确认 RED**

Run: `node --test scripts/compare-minitool-model.test.mjs`

Expected: FAIL because the comparator does not exist.

- [ ] **Step 3: 实现比较器与局部门禁**

固定 1286×1223 比较；对背景做遮罩，模型区域要求边缘重合率至少 0.98、归一化 MAE 不高于 0.035。另对生肖环、四珠、地支环、月将环、神将环和中央轨迹六个区域分别比较；任一区域缺失、纯黑像素比例异常或越界都直接失败并输出 `diff.png`。

- [ ] **Step 4: 实现浏览器视觉用例**

Playwright 使用 `2026-08-14T23:57:00`、出生年 `1990`、地点“参考课式”、事由“商务决策复盘”打开小红书模型页，等待 `data-model-ready=true` 和贴图完成，分别捕获 1286×1223、390×844、1280×800 三种视口。测试以用户金标作阻断比较，并对 `docs/asset-reviews/lookdev/jade-plate-default.png` 网站基准生成非阻断诊断；同时断言无黑块、十二神将/十二地支/四珠均可见、盘面不裁切。

- [ ] **Step 5: 运行比较器和视觉用例并调到 GREEN**

Run: `node --test scripts/compare-minitool-model.test.mjs && npx playwright test e2e/minitool-model-parity.spec.ts`

Expected: user-gold PASS with six local regions present and no visible diff beyond the declared renderer tolerance. Website metrics are always written but are diagnostic rather than a conflicting second pixel assertion. 若失败，只根据 `diff.png` 调整一个表面标定、图层、相机、灯光、材质或节点变换变量。

- [ ] **Step 5a: 构建并验证参考分层表面**

在 `scripts/build-minitool-reference-surfaces.test.mjs` 先调用尚不存在的接口并确认 RED：

```js
const first = await buildReferenceSurfaces({ referencePath, maskPath, outputDir: firstOutput });
const second = await buildReferenceSurfaces({ referencePath, maskPath, outputDir: secondOutput });
assert.deepEqual(first.canonical, { width: 1286, height: 1223 });
assert.deepEqual(first.layers.filter(({ kind }) => kind === "general").map(({ name }) => name),
  ["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"]);
assert.equal(first.layers.some(({ coverage }) => coverage > 0.8), false);
assert.deepEqual(await outputHashes(firstOutput), await outputHashes(secondOutput));
```

Run: `node --test scripts/build-minitool-reference-surfaces.test.mjs`

Expected RED: `ERR_MODULE_NOT_FOUND` for `build-minitool-reference-surfaces.mjs`.

实现并导出：

```js
export async function buildReferenceSurfaces({ referencePath, maskPath, outputDir })
```

Sharp 解码原始 1286×1223 金标和遮罩；纯 JS 四点单应性把固定地盘四边形反投影到 1024×1024 局部坐标，生成 `earth.png`、`heaven.png`、`generals.png`、`core.png` 四张确定性回退图集。同时生成均不超过 1024×1024 的原生分辨率语义细节图块：四个地盘象限、一个天盘区、十二张独立具名神将图块、核心底面和小范围透明轨迹样式层。清单记录所有裁切框、owner、神将基准地支和轨迹参考三传。核心图层用邻域玉色填充静态金线/蓝点；输出不得存在覆盖完整金标的层。

在 `package.json` 新增 `model:build-reference-surfaces`，并把它串在 `build:minitool` 的模型导出与 Vite 构建之间。运行生成器测试至 GREEN，并记录全部 PNG 的哈希和总字节数。

- [ ] **Step 5b: 挂接薄层并保留真实行为**

在 `src/minitool/artifact/reference-surfaces.test.ts` 先按生成清单调用尚不存在的接口：

```ts
const mounted = attachReferenceSurfaces({ nodes, source, applied, manifest, textures });
expect(mounted.layers.filter(({ kind }) => kind === "earth").every(({ owner }) => owner === nodes.get("plate/earth"))).toBe(true);
expect(mounted.layers.filter(({ kind }) => kind === "heaven").every(({ owner }) => owner === nodes.get("plate/heaven"))).toBe(true);
expect(mounted.layers.filter(({ kind }) => kind === "general").map(({ owner }) => owner.name)).toEqual(expectedGeneralNodeIds);
expect(mounted.trace.userData.courseEarths).toEqual(source.course.transmissions.map(({ branch }) => branch));
```

Run: `npx vitest run src/minitool/artifact/reference-surfaces.test.ts`

Expected RED: module or export missing.

实现以下接口：

```ts
export interface AttachedReferenceSurfaces {
  readonly layers: readonly { kind: string; owner: THREE.Object3D; mesh: THREE.Mesh }[];
  readonly trace: THREE.Group;
  dispose(): void;
}

export function attachReferenceSurfaces(options: {
  nodes: ReadonlyMap<string, THREE.Object3D>;
  source: ArtifactSourceResults;
  applied: AppliedParityState;
  manifest: ReferenceSurfaceManifest;
  textures: ReadonlyMap<string, THREE.Texture>;
}): AttachedReferenceSurfaces;
```

原生细节层以裁切矩形创建带 UV 的 `BufferGeometry`，把清单坐标映射到参考画布平面，再用当前 owner 世界矩阵的逆矩阵转换为局部坐标。地盘与四珠的四个象限绑定 `plate/earth`；天盘层按 `applied.heavenAngleRad - manifest.referenceHeavenAngleRad` 放置并绑定 `plate/heaven`；十二个神将图块按当前地支相对清单基准地支的 30° 差放置，并分别绑定 `general/*`；无轨迹核心绑定 `plate/core`。透明轨迹样式层同样绑定 `plate/core`，但其几何变换由 `source.course.transmissions` 与天盘角度共同计算；测试必须证明改变三传会改变轨迹顶点，而不是读取核心中的静态轨迹。

修改 `mountParityArtifact`：保留 GLB 节点和回退网格；加载所有原生语义贴图并在全部成功后一次性显示参考层、隐藏已被完整替代的旧可见网格、调用 `onReady`。所有图层共面，通过 `renderOrder`、最近邻采样、禁用 mipmap 和深度写入获得稳定像素组合；失败则保持参考层隐藏并调用现有 `onUnavailable`。修改相机为从参考画布平面定标的透视俯视相机；resize 只做原比例 contain，整体 orbit/zoom 仍复用 `mountArtifactInteraction`。

扩展聚焦测试证明：全部语义贴图完成前不 ready；地盘/四珠、天盘、十二神将和核心 owner 正确；天盘与地支/月将同组旋转；十二神将可独立落宫；动态轨迹随输入变化；pointer orbit 和 wheel zoom 仍改变真实 root/camera。运行 `reference-surfaces.test.ts`、`apply-parity-state.test.ts`、`artifact-interaction.test.ts`、`parity-camera.test.ts`、`create-parity-artifact.test.ts` 至 GREEN。

- [ ] **Step 5c: 逐层视觉 RED/GREEN**

保持比较器阈值不变。每轮只启用或调整一个层/标定变量，运行：

```bash
node --test scripts/compare-minitool-model.test.mjs
npx playwright test e2e/minitool-model-parity.spec.ts
```

Playwright 必须把金标比较作为阻断断言；网站比较仍调用同一比较器并写 `website-diff.png` / `website-metrics.json`，但不要求不可能的双像素 PASS。每轮记录整体和六个局部门禁指标。若金标未全 GREEN，提交当前最佳量化渲染与具体动态行为冲突，不改阈值。

- [ ] **Step 6: 提交视觉门禁**

```bash
git add scripts/compare-minitool-model.mjs scripts/compare-minitool-model.test.mjs e2e/minitool-model-parity.spec.ts e2e/fixtures/minitool-model-mask.png package.json package-lock.json artifacts/model-parity
git commit -m "test: enforce minitool model visual parity"
```

### Task 7: 更新小红书合规门禁并生成最终 ZIP

**Files:**
- Modify: `scripts/validate-minitool.mjs`
- Modify: `scripts/validate-minitool.test.mjs`
- Modify: `scripts/verify-minitool-artifact.mjs`
- Modify: `package.json`
- Regenerate: `artifacts/daliuren-minitool/`
- Regenerate: `artifacts/daliuren-minitool.zip`

**Interfaces:**
- Consumes: 完整实现和生成数据脚本
- Produces: 审核通过的最终 ZIP 与验证摘要

- [ ] **Step 1: 写合规失败测试**

扩展验证器，要求四个模型数据脚本存在、索引加载顺序正确、没有 `.glb`/KTX2/WASM/Worker/fetch、每个数据脚本小于 2 MiB、编码字段小于 1 MiB、清单三角形不超过 100000、draw call 不超过 50、贴图为 1024×1024 JPEG。

- [ ] **Step 2: 运行合规测试并确认 RED**

Run: `node --test scripts/validate-minitool.test.mjs`

Expected: FAIL until the verifier recognizes and checks generated model parts.

- [ ] **Step 3: 更新验证器和最终脚本**

删除对旧 `triangles: 3000`、`drawCalls: 44` 和 `create-programmatic-artifact.ts` 的硬编码检查，改为读取导出 manifest 的真实统计；`verify:minitool` 在构建前生成模型数据，在最终产物核验中加入视觉门禁。

- [ ] **Step 4: 运行合规测试并确认 GREEN**

Run: `node --test scripts/validate-minitool.test.mjs`

Expected: PASS.

- [ ] **Step 5: 执行唯一一次完整验收**

Run: `npm run verify:minitool`

Expected: all Vitest and Node tests pass; visual parity passes at all three viewports; Vite build succeeds; static validation reports 0 errors; directory and ZIP audits report 0 errors; ZIP is at most 10 MiB; final artifact verification passes.

- [ ] **Step 6: 人工核对九项视觉标准**

并排查看 `e2e/fixtures/minitool-model-reference.png`、网站基准、`artifacts/model-parity/actual.png` 和 `diff.png`，逐项确认生肖、四珠、三层盘、午上子下、十二神将、中央轨迹、暖白玉材质、无裁切和交互归属。任何肉眼可见差异都返回对应任务修复，不交付 ZIP。

- [ ] **Step 7: 提交最终产物**

```bash
git add scripts/validate-minitool.mjs scripts/validate-minitool.test.mjs scripts/verify-minitool-artifact.mjs package.json artifacts/daliuren-minitool artifacts/daliuren-minitool.zip artifacts/model-parity
git commit -m "build: package website-parity minitool artifact"
```
