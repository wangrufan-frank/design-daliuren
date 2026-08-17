# Daliuren WebGL Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 React 应用中加载已验证的大六壬 GLB，以六阶段快照驱动动态铭文、可逆机构时间轴、自由观察、规则显影和安全降级。

**Architecture:** 纯 TypeScript 映射器把已验证的六阶段结果转换为 `ArtifactDisplayState`，纯姿态求值器根据绝对时间计算 `ArtifactPose`；Three.js 控制器只应用姿态和贴图，不读取或重算术数规则。React 组件拥有生命周期、模式切换、时间轴和无障碍回退；GLB 加载或 WebGL 失败时继续显示现有标准文字课式。

**Tech Stack:** React 19.2.8、TypeScript 5.9.3、Three.js 0.185.1、Vite 7.3.6、Vitest 3.2.7、Testing Library、Playwright 1.62.1、glTF Transform 4.4.2

## Global Constraints

- 先完成 `docs/superpowers/plans/2026-08-17-daliuren-artifact-lookdev.md` 并冻结最终 GLB 节点契约。
- 新增依赖固定为 `three@0.185.1`；不引入 React Three Fiber、动画框架或状态管理库。
- 三维代码不得调用任何 `compute-*`、`deriveCourse` 或第三方历法接口。
- 三维入口只接收已经通过现有 snapshot guards 的结果对象。
- 时间轴总长 `12,500 ms`，阶段顺序固定为校时、天地盘、四课、三传、天将、复制结课。
- 相同展示状态与相同时间必须生成逐字段相同的姿态，不能依赖上一帧副作用。
- 用户开始拖拽时自动镜头立即停止；机构时间轴与相机控制相互独立。
- `prefers-reduced-motion: reduce` 保留最终信息，缩短运动并取消自动环绕和长距离来源线。
- 任何加载、节点、WebGL 或贴图错误都不得阻断标准文字课式。

---

### Task 1: Three.js 依赖、最终资产路径和 GLB 契约夹具

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/copy-three-basis.mjs`
- Create: `scripts/copy-three-basis.test.mjs`
- Create: `src/features/artifact-scene/model/asset-contract.ts`
- Create: `src/features/artifact-scene/model/asset-contract.test.ts`
- Copy: `public/models/daliuren/daliuren-artifact-lod0.glb`
- Copy: `public/models/daliuren/daliuren-artifact-lod1.glb`
- Copy: `public/models/daliuren/daliuren-artifact-lod2.glb`
- Create: `public/three/basis/basis_transcoder.js`
- Create: `public/three/basis/basis_transcoder.wasm`

**Interfaces:**
- Produces: `ARTIFACT_ASSET_URLS`
- Produces: `REQUIRED_NODE_IDS: readonly string[]`
- Produces: `selectArtifactLod(viewportWidth: number, devicePixelRatio: number): 0 | 1 | 2`

- [ ] **Step 1: 安装 Three.js 固定版本**

Run: `npm install three@0.185.1`  
Expected: exact dependency recorded in lockfile.

- [ ] **Step 2: 写 LOD 选择和节点契约失败测试**

```ts
it("selects LOD2 for narrow or high-density mobile viewports", () => {
  expect(selectArtifactLod(390, 3)).toBe(2);
  expect(selectArtifactLod(1280, 1)).toBe(1);
  expect(selectArtifactLod(1920, 1)).toBe(0);
});

it("contains every frozen runtime node exactly once", () => {
  expect(new Set(REQUIRED_NODE_IDS).size).toBe(REQUIRED_NODE_IDS.length);
  expect(REQUIRED_NODE_IDS).toContain("plate/heaven");
  expect(REQUIRED_NODE_IDS).toContain("general/noble");
  expect(REQUIRED_NODE_IDS).toContain("anchor/course-copy/transmissions");
});
```

- [ ] **Step 3: 运行并确认模块不存在**

Run: `npm test -- src/features/artifact-scene/model/asset-contract.test.ts`  
Expected: FAIL importing `asset-contract`.

- [ ] **Step 4: 实现固定资产契约**

```ts
export const ARTIFACT_ASSET_URLS = {
  0: "/models/daliuren/daliuren-artifact-lod0.glb",
  1: "/models/daliuren/daliuren-artifact-lod1.glb",
  2: "/models/daliuren/daliuren-artifact-lod2.glb",
} as const;

export function selectArtifactLod(width: number, dpr: number): 0 | 1 | 2 {
  if (width < 700 || dpr >= 2.5) return 2;
  if (width < 1600 || dpr >= 1.5) return 1;
  return 0;
}
```

Copy the exact `nodeIds` array from `assets/daliuren/asset-contract.json`, preserving order.

- [ ] **Step 5: 复制与校验 Three.js Basis 转码器**

`copy-three-basis.mjs` copies `basis_transcoder.js` and `basis_transcoder.wasm` from the installed Three.js examples package into `public/three/basis`. Its Node test injects a temporary source tree, asserts both files are copied byte-for-byte, and rejects a missing WASM file. Add `postinstall` and `asset:copy-basis` scripts that invoke it.

- [ ] **Step 6: 验证并提交依赖契约**

Run: targeted test.  
Expected: pass.

```powershell
git add package.json package-lock.json scripts/copy-three-basis.mjs scripts/copy-three-basis.test.mjs src/features/artifact-scene/model public/models/daliuren public/three/basis
git commit -m "build: add artifact runtime assets"
```

### Task 2: 六阶段快照到展示状态的纯映射

**Files:**
- Create: `src/features/artifact-scene/model/types.ts`
- Create: `src/features/artifact-scene/model/map-artifact-state.ts`
- Create: `src/features/artifact-scene/model/map-artifact-state.test.ts`

**Interfaces:**
- Consumes: validated `CalendarResult`, `HeavenEarthResult`, `FourLessonsResult`, `ThreeTransmissionsResult`, `HeavenlyGeneralsResult`, `CourseResult`.
- Produces: `mapArtifactState(source: ArtifactSourceResults): ArtifactDisplayState`

- [ ] **Step 1: 定义只读展示接口**

```ts
export interface ArtifactSourceResults {
  calendar: CalendarResult;
  plate: HeavenEarthResult;
  lessons: FourLessonsResult;
  transmissions: ThreeTransmissionsResult;
  generals: HeavenlyGeneralsResult;
  course: CourseResult;
}

export interface ArtifactDisplayState {
  calendar: {
    pillars: readonly [string, string, string, string];
    monthBuild: EarthlyBranch;
    monthGeneral: string;
    divinationHour: EarthlyBranch;
    manualFields: readonly string[];
  };
  plate: { offset: number; palaces: readonly { earth: EarthlyBranch; heaven: EarthlyBranch }[] };
  lessons: CourseResult["lessons"];
  transmissions: CourseResult["transmissions"];
  methodLabel: string;
  generals: HeavenlyGeneralsResult["placements"];
  noble: CourseResult["noble"];
}
```

- [ ] **Step 2: 写参考课例和篡改来源失败测试**

Using `referenceSession`, construct `ArtifactSourceResults` from its six snapshots.

```ts
it("copies every visible fact without recomputing", () => {
  const state = mapArtifactState(referenceSourceResults);
  expect(state.plate.offset).toBe(referenceSourceResults.plate.offset);
  expect(state.lessons).toEqual(referenceSourceResults.course.lessons);
  expect(state.transmissions).toEqual(referenceSourceResults.course.transmissions);
  expect(state.generals).toEqual(referenceSourceResults.generals.placements);
});

it("rejects inconsistent course facts instead of choosing one source", () => {
  const broken = {
    ...referenceSourceResults,
    course: {
      ...referenceSourceResults.course,
      transmissions: referenceSourceResults.course.transmissions.map((item, index) =>
        index === 0 ? { ...item, branch: item.branch === "子" ? "丑" : "子" } : item,
      ),
    },
  };
  expect(() => mapArtifactState(broken)).toThrow(/course transmission initial does not match upstream/);
});
```

- [ ] **Step 3: 运行并确认映射器缺失**

Run: targeted Vitest file.  
Expected: FAIL importing `map-artifact-state`.

- [ ] **Step 4: 实现直接复制与一致性断言**

The mapper builds labels by joining existing method/subtype/variants only. It validates that every course lesson/transmission/general mapping matches upstream IDs and values, then returns frozen arrays. It does not derive branches, six relations, noble direction or plate offset.

- [ ] **Step 5: 覆盖人工来源与全十二宫**

Add tests asserting all manual calendar fields are reported, exactly twelve palace mappings survive in existing visual order, exactly four lessons and three transmissions exist, and all twelve general placements are preserved.

- [ ] **Step 6: 运行测试并提交**

```powershell
npm test -- src/features/artifact-scene/model/map-artifact-state.test.ts
git add src/features/artifact-scene/model
git commit -m "feat: map rule snapshots to artifact state"
```

### Task 3: 绝对时间驱动的可逆姿态求值器

**Files:**
- Create: `src/features/artifact-scene/timeline/types.ts`
- Create: `src/features/artifact-scene/timeline/evaluate-pose.ts`
- Create: `src/features/artifact-scene/timeline/evaluate-pose.test.ts`

**Interfaces:**
- Produces: `evaluateArtifactPose(state, timeMs, reducedMotion): ArtifactPose`
- Produces: `ARTIFACT_DURATION_MS = 12_500`
- Stage windows: calendar `0–1,200`, plate `1,200–3,200`, lessons `3,200–5,400`, transmissions `5,400–7,600`, generals `7,600–10,300`, course copy `10,300–12,500`.

- [ ] **Step 1: 写关键帧、角度和历史无关失败测试**

```ts
it("locks the heaven plate to offset times 30 degrees", () => {
  const pose = evaluateArtifactPose(referenceState, 3_200, false);
  expect(pose.nodes["plate/heaven"].rotationZ).toBeCloseTo(referenceState.plate.offset * Math.PI / 6);
});

it("uses the confirmed absolute travels at the final pose", () => {
  const pose = evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, false);
  expect(pose.nodes["calendar/slip"].translationZ).toBeCloseTo(0.012);
  expect(Math.abs(pose.nodes["lesson/first"].translationX)).toBeCloseTo(0.092);
  expect(pose.nodes["transmission/bridge"].translationY).toBeCloseTo(-0.118);
  expect(pose.nodes["general/noble"].translationZ).toBeCloseTo(0.007);
});

it("returns identical structures for repeated seeks", () => {
  expect(evaluateArtifactPose(referenceState, 8_450, false)).toEqual(
    evaluateArtifactPose(referenceState, 8_450, false),
  );
});
```

- [ ] **Step 2: 运行并确认求值器缺失**

Run: targeted Vitest file.  
Expected: FAIL importing `evaluate-pose`.

- [ ] **Step 3: 实现钳位、分段进度和缓动**

```ts
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const progress = (time: number, start: number, end: number) => smoothstep(clamp01((time - start) / (end - start)));
```

Every node transform starts from the frozen closed pose and adds an absolute delta. Each general uses its existing `earth` field to select the destination palace; `order` and `direction` only drive the visible placement sequence and arrow, and must not decide which general belongs to a palace.

- [ ] **Step 4: 实现复制结课显影状态**

`ArtifactPose.copy` contains opacity and source-line progress for lessons, transmissions and generals. It never moves physical source nodes. Before `10,300 ms` all copy values are zero; at `12,500 ms` copies are visible and source lines are zero again.

- [ ] **Step 5: 实现减少动态分支**

Reduced motion snaps each completed stage to its final pose at stage boundaries, disables camera orbit requests, limits source line opacity to a short `150 ms` fade, and preserves all final labels and copy objects.

- [ ] **Step 6: 运行边界矩阵并提交**

Tests cover `-1`, every stage start/end/midpoint, `12,501`, forward/reverse generals and reduced motion.

```powershell
npm test -- src/features/artifact-scene/timeline/evaluate-pose.test.ts
git add src/features/artifact-scene/timeline
git commit -m "feat: evaluate deterministic artifact poses"
```

### Task 4: GLB 加载器、节点守卫与资源释放

**Files:**
- Create: `src/features/artifact-scene/three/load-artifact.ts`
- Create: `src/features/artifact-scene/three/load-artifact.test.ts`
- Create: `src/features/artifact-scene/three/dispose-artifact.ts`

**Interfaces:**
- Produces: `createArtifactRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer`
- Produces: `loadArtifact(url, renderer, loader?): Promise<LoadedArtifact>`
- Produces: `indexArtifactNodes(scene, requiredIds): ReadonlyMap<string, THREE.Object3D>`
- Produces: `disposeArtifact(root): void`

- [ ] **Step 1: 写缺失、重复节点和释放失败测试**

```ts
it("rejects missing and duplicate runtime ids", () => {
  const scene = new THREE.Group();
  scene.add(node("plate/heaven"), node("plate/heaven"));
  expect(() => indexArtifactNodes(scene, ["plate/heaven", "artifact/root"]))
    .toThrow(/duplicate plate\/heaven.*missing artifact\/root/);
});

it("disposes shared geometry and textures exactly once", () => {
  const { root, geometry, texture } = sharedResourceFixture();
  disposeArtifact(root);
  expect(geometry.dispose).toHaveBeenCalledTimes(1);
  expect(texture.dispose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 运行并确认 Three 工具缺失**

Run: targeted Vitest file.  
Expected: FAIL importing `load-artifact`.

- [ ] **Step 3: 实现 GLTFLoader 与 extras 索引**

`createArtifactRenderer` creates the one renderer owned by `ArtifactExperience`. `loadArtifact` uses `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js` and `KTX2Loader` from `three/examples/jsm/loaders/KTX2Loader.js`. Configure the transcoder path as `/three/basis/`, call `detectSupport(renderer)` before loading, and dispose the KTX2 loader after the GLB resolves or rejects. Index `object.userData.node_id`, reject duplicate/missing IDs in one aggregated error, and return root, node map, animations and asset URL. Loader errors preserve the original cause.

- [ ] **Step 4: 实现幂等资源释放**

Traverse meshes; store disposed geometries, materials and textures in `Set`s before calling `dispose`. Do not dispose renderer-owned environment maps here.

- [ ] **Step 5: 运行测试并提交**

```powershell
npm test -- src/features/artifact-scene/three/load-artifact.test.ts
git add src/features/artifact-scene/three
git commit -m "feat: load and validate artifact GLB"
```

### Task 5: Three.js 场景控制器与动态铭文

**Files:**
- Create: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Create: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`
- Create: `src/features/artifact-scene/three/dynamic-labels.ts`
- Create: `src/features/artifact-scene/three/dynamic-labels.test.ts`

**Interfaces:**
- Produces class: `ArtifactSceneController`
- Constructor consumes the renderer created by `createArtifactRenderer`, loaded artifact and callbacks `{ onUserControlStart, onContextLost, onError }`.
- Methods: `resize`, `setDisplayState`, `applyPose`, `focusNode`, `resetCamera`, `render`, `dispose`.

- [ ] **Step 1: 写动态标签和姿态应用失败测试**

```ts
it("renders Chinese labels at stable high-resolution canvas dimensions", () => {
  const texture = createLabelTexture("贵人", { width: 512, height: 256, color: "#C2C6BB" });
  expect(texture.image.width).toBe(512);
  expect(texture.image.height).toBe(256);
  expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
});

it("applies absolute pose against frozen base transforms", () => {
  controller.applyPose(firstPose);
  controller.applyPose(secondPose);
  controller.applyPose(firstPose);
  expect(node.position.toArray()).toEqual(firstPosition);
});
```

- [ ] **Step 2: 运行并确认控制器缺失**

Run: targeted Vitest files.  
Expected: FAIL importing controller and label functions.

- [ ] **Step 3: 实现场景、灯光与 OrbitControls**

Use `WebGLRenderer`, `PerspectiveCamera`, `OrbitControls`, ACES/AgX-compatible tone mapping available in Three.js, sRGB output, a 4300K-approximated key color, 30% fill and restrained rim. Save each runtime node's base position/quaternion/scale once after loading; every pose application resets from those values before applying deltas.

- [ ] **Step 4: 实现动态铭文表面**

Create `CanvasTexture` labels for calendar slip, four lessons, three transmissions, the bridge method plaque and twelve generals. Cache by `{ text, style, size }`, release replaced textures, set anisotropy from renderer capability, and use old-gold/celadon/ash styles from existing CSS tokens. Labels include text plus a non-color glyph/border for noble, manual and direction states.

- [ ] **Step 5: 实现用户控制优先与上下文失败**

OrbitControls `start` invokes `onUserControlStart` synchronously. Canvas listens for `webglcontextlost`, calls `preventDefault`, stops rendering and invokes `onContextLost`. `dispose` removes listeners, controls, renderer, label textures and loaded artifact resources exactly once.

- [ ] **Step 6: 运行控制器测试并提交**

```powershell
npm test -- src/features/artifact-scene/three
git add src/features/artifact-scene/three
git commit -m "feat: render interactive artifact scene"
```

### Task 6: React 生命周期、时间轴控件与减少动态

**Files:**
- Create: `src/features/artifact-scene/ArtifactExperience.tsx`
- Create: `src/features/artifact-scene/ArtifactExperience.test.tsx`
- Create: `src/features/artifact-scene/ArtifactTimeline.tsx`
- Create: `src/features/artifact-scene/ArtifactTimeline.test.tsx`
- Create: `src/features/artifact-scene/use-reduced-motion.ts`
- Create: `src/features/artifact-scene/artifact-scene.css`

**Interfaces:**
- Produces: `<ArtifactExperience source={ArtifactSourceResults} onShowCourse={() => void} />`
- Timeline controls: play/pause, previous stage, next stage, range seek, reset camera, show text course.

- [ ] **Step 1: 写生命周期和可访问控件失败测试**

```tsx
it("exposes deterministic timeline controls and text-course escape", async () => {
  render(<ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />);
  expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
  expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("max", "12500");
  await user.click(screen.getByRole("button", { name: "查看文字课式" }));
  expect(onShowCourse).toHaveBeenCalledOnce();
});

it("stops auto camera when scene reports user control", () => {
  const controller = latestController();
  controller.callbacks.onUserControlStart();
  expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-auto-camera", "false");
});
```

- [ ] **Step 2: 运行并确认组件缺失**

Run: targeted Testing Library files.  
Expected: FAIL importing components.

- [ ] **Step 3: 实现 React 挂载与帧循环**

On mount, create the renderer, select LOD, load GLB with that renderer, create the controller and start one `requestAnimationFrame` loop. If loading fails, dispose the renderer before showing fallback. On each frame, advance absolute `timeMs` only while playing, evaluate pose, apply pose and render. On source change, reset to `0`, rebuild display state and reuse the loaded asset. On unmount, cancel the frame and dispose once.

- [ ] **Step 4: 实现时间轴控件**

The range input uses integer milliseconds `0–12500`; stage buttons seek to exact stage boundaries. Playback clamps at `12500` and changes button label back to `播放推演`. Previous/next always seek, never replay hidden intervals.

- [ ] **Step 5: 实现减少动态和加载状态**

`useReducedMotion` subscribes to `matchMedia`. Reduced mode passes `true` to the pose evaluator, disables auto camera, and keeps all labels. Before load, show `正在加载三维器物`; on failure, render one alert plus the `查看文字课式` button without an empty canvas.

Expose `data-pose-hash` only in development/test builds. Compute it from the ordered numeric fields of the current `ArtifactPose`; production builds omit the attribute. Expose a development-only frame observer callback used by `scripts/benchmark-artifact.mjs`; production builds do not attach it to `window`.

- [ ] **Step 6: 运行组件测试并提交**

```powershell
npm test -- src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/ArtifactTimeline.test.tsx
git add src/features/artifact-scene
git commit -m "feat: add artifact playback experience"
```

### Task 7: 课程完成页接入、模式切换与安全回退

**Files:**
- Create: `src/features/course-experience/CourseExperience.tsx`
- Create: `src/features/course-experience/CourseExperience.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `<CourseExperience source={ArtifactSourceResults} />`
- Modes: `artifact` and `text`; initial mode is `artifact` only when every guarded snapshot exists.

- [ ] **Step 1: 写完整快照和失败回退测试**

```tsx
it("opens the three-dimensional experience only for the complete guarded bundle", async () => {
  await completeReferenceCourse(user);
  expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expect(screen.getByLabelText("标准文字课式")).toBeVisible();
});

it("keeps the text course usable when artifact loading fails", async () => {
  artifactLoader.reject(new Error("missing GLB"));
  await completeReferenceCourse(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("三维器物加载失败");
  await user.click(screen.getByRole("button", { name: "查看文字课式" }));
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
});
```

- [ ] **Step 2: 运行并确认应用仍只显示文字课式**

Run: targeted course-experience and App tests.  
Expected: FAIL because `CourseExperience` does not exist and App renders `CourseSheet` directly.

- [ ] **Step 3: 构建受守卫的 `ArtifactSourceResults`**

In `App`, only after all existing `has*` booleans are true, create one object from the already validated results. Do not cast raw snapshot values. Replace direct `CourseSheet` rendering with `CourseExperience`; keep all prior stage rail navigation unchanged.

- [ ] **Step 4: 实现模式切换和响应式布局**

`CourseExperience` renders two visible text buttons, `三维推演` and `文字课式`, with `aria-pressed`. Desktop canvas uses the main stage width and at least `520px` height. Below `820px`, controls move below the canvas and text course remains a normal document; no fixed overlay blocks stage navigation.

- [ ] **Step 5: 运行全部组件和应用测试**

Run:

```powershell
npm test -- src/features/course-experience/CourseExperience.test.tsx src/app/App.test.tsx
npm test
```

Expected: all existing and new tests pass.

- [ ] **Step 6: 提交应用接入**

```powershell
git add src/features/course-experience src/app/App.tsx src/app/App.test.tsx src/styles/global.css
git commit -m "feat: integrate three-dimensional course experience"
```

### Task 8: 端到端一致性、上下文失败和性能基准

**Files:**
- Create: `e2e/artifact-experience.spec.ts`
- Create: `scripts/benchmark-artifact.mjs`
- Create: `docs/asset-reviews/runtime/benchmark.json`
- Create: `docs/asset-reviews/runtime/README.md`
- Modify: `package.json`

**Interfaces:**
- Adds npm command: `npm run benchmark:artifact`
- Benchmark records browser, viewport, DPR, selected LOD, GLB bytes, median frame time, p95 frame time and sample count.

- [ ] **Step 1: 写三维/文字一致性 E2E**

```ts
test("model labels and text course use the same verified facts", async ({ page }) => {
  await completeReferenceCourse(page);
  await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  const labels = await page.getByTestId("artifact-accessible-facts").textContent();
  await page.getByRole("button", { name: "文字课式" }).click();
  await expect(page.getByLabel("标准文字课式")).toContainText("初传");
  expect(labels).toContain("初传");
  expect(labels).toContain("贵人");
});
```

`artifact-accessible-facts` is a visually hidden semantic list generated from `ArtifactDisplayState`, not read back from WebGL pixels.

- [ ] **Step 2: 写寻址、用户控制和减少动态 E2E**

Cover: range seek to `8450`, seek back to `0`, seek again and compare `data-pose-hash`; dispatch a real pointer drag and assert `data-auto-camera="false"`; emulate reduced motion and assert all final facts remain while source lines are disabled.

- [ ] **Step 3: 写 WebGL 上下文丢失和 GLB 404 回退 E2E**

Route the GLB to `404` in one test. In another, dispatch `webglcontextlost` on the canvas. Both tests must reach the text course and copy button without re-running course computation.

- [ ] **Step 4: 实现本机性能基准**

`benchmark-artifact.mjs` launches Chromium against the Vite preview server, waits for the final pose, samples 300 animation frames through an exposed development-only frame observer, and writes JSON. It exits non-zero when desktop `1920×1080 DPR1` median FPS is below `60` or mobile `390×844 DPR3` median FPS is below `30` on this workstation.

- [ ] **Step 5: 运行完整验证**

```powershell
npm test
npm run build
npm run test:e2e -- e2e/artifact-experience.spec.ts
npm run benchmark:artifact
npm run test:e2e
```

Expected: all tests pass; build exits `0`; benchmark writes both desktop and mobile profiles meeting thresholds.

- [ ] **Step 6: 记录运行时证据并提交**

`README.md` records exact GLB SHA-256 values, selected LOD per profile, benchmark numbers, reduced-motion result, load-failure result and the tested browser version.

```powershell
git add e2e/artifact-experience.spec.ts scripts/benchmark-artifact.mjs docs/asset-reviews/runtime package.json
git commit -m "test: verify artifact runtime experience"
```
