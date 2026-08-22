# 大六壬三维阶段回看工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有暗色、文字堆叠的结果页改造成明亮的三维阶段回看工作台：起课事由必填、移除经纬度、六阶段结构分解可回放、22 个部件采用随镜头移动的动态引线标注，并提供移动端完整部件目录。

**Architecture:** 术数计算域保持不变，只调整起课上下文和展示层。单一阶段元数据同时驱动右侧阶段轨、简短字幕、时间轴定位、相机预设和标注集合；Three.js 控制器继续只负责模型、相机、世界坐标与遮挡采样，DOM/SVG 标注层负责屏幕空间排布。每个阶段姿态由“阶段 + 归一化进度”纯函数求值，用户拖拽只取消自动镜头，不中断结构动画。

**Tech Stack:** React 19.2.8、TypeScript 5.9.3、Three.js 0.185.1、Vite 7.3.6、Vitest 3.2.7、Testing Library、Playwright 1.62.1、Blender Python unittest

**Spec:** `docs/superpowers/specs/2026-08-22-3d-stage-review-workbench-design.md`

## Global Constraints

- 不改历法、天地盘、四课、三传、天将的推演规则或结果结构；三维层不得重新计算术数事实。
- `reason` 为去除首尾空白后 1–120 个字符的必填多行文本；`locationName` 为可选记录字段；输入、快照和界面不得再出现经度、纬度。
- 地点和事由只影响最终 `course` 快照；修改任一字段不得使前五阶段快照失效。
- 六阶段顺序固定为历法与月将、天地盘加临、四课生成、三传取法、天将排列、复制结课。
- 阶段点击必须从相同输入和相同阶段生成逐字段相同的姿态；不得依赖上一次点击或上一帧累积变换。
- 标注总量固定为 22 个逻辑部件：历法签 1、地盘 1、天盘 1、四课翼 4、三传 3、十二天将 12。
- 桌面标注字号不小于 14px；移动端不小于 16px。移动端模型区只显示当前阶段 3–6 个重点标注，底部目录始终可访问全部 22 个部件。
- 相机允许水平 360°、垂直极角 20°–75°；用户开始拖拽时停止自动运镜，结构分解继续。
- `prefers-reduced-motion: reduce` 直接进入当前阶段稳定分解姿态，保留字幕、标注和证据抽屉。
- WebGL、模型、节点或标注层失败时必须保留标准文字课式和重试入口。
- 不增加动画框架、状态管理库或 React Three Fiber；沿用现有 React、Three.js 和测试工具。
- 严格按验收节点暂停：每完成一个可见切片，先展示并获得确认，再继续下一切片。

## File and Responsibility Map

**Input and snapshots**
- Modify: `src/domain/chart/types.ts`, `src/features/course-input/schema.ts`, `src/features/course-input/CourseInputForm.tsx`
- Modify: `src/domain/course/types.ts`, `src/domain/course/policy.ts`, `src/domain/course/compute-course.ts`, `src/domain/course/result-guard.ts`
- Modify: `src/domain/chart/snapshots.ts`, `src/app/App.tsx`, `src/test/reference-session.ts`

**Workbench and stage review**
- Create: `src/features/course-workbench/CourseWorkbench.tsx`, `CourseContextSummary.tsx`, `StageEvidenceDrawer.tsx`, `course-workbench.css`
- Create: `src/features/rule-review/StageReviewContent.tsx`
- Create: `src/features/artifact-scene/timeline/review-stages.ts`
- Modify: `src/features/course-experience/CourseExperience.tsx`, `src/features/artifact-scene/ArtifactExperience.tsx`, `src/features/artifact-scene/ArtifactTimeline.tsx`

**Deterministic decomposition and camera**
- Create: `src/features/artifact-scene/timeline/evaluate-stage-replay.ts`
- Modify: `src/features/artifact-scene/timeline/types.ts`, `evaluate-pose.ts`, `src/features/artifact-scene/three/ArtifactSceneController.ts`

**Dynamic annotations**
- Create: `src/features/artifact-scene/annotations/types.ts`, `descriptors.ts`, `project-annotations.ts`, `layout-annotations.ts`
- Create: `src/features/artifact-scene/ArtifactAnnotationLayer.tsx`, `ArtifactPartDirectory.tsx`
- Modify: `src/features/artifact-scene/artifact-scene.css`, `ArtifactExperience.tsx`, `ArtifactSceneController.ts`

**Quality gates**
- Modify: all affected unit/component/E2E fixtures, `package.json`, `tools/blender/tests/test_inscriptions.py`, `tools/blender/tests/test_uv_and_bake.py`
- Create: `scripts/assert-entry-budget.mjs`, `scripts/assert-entry-budget.test.mjs`, `scripts/test-blender-suite.mjs`, `scripts/test-blender-suite.test.mjs`

---

### Task 1: 起课事由、可选地点和快照失效边界

**Files:**
- Modify: `src/domain/chart/types.ts`
- Modify: `src/features/course-input/schema.ts`
- Modify: `src/features/course-input/schema.test.ts`
- Modify: `src/features/course-input/CourseInputForm.tsx`
- Modify: `src/features/course-input/CourseInputForm.test.tsx`
- Modify: `src/domain/course/types.ts`
- Modify: `src/domain/course/policy.ts`
- Modify: `src/domain/course/policy.test.ts`
- Modify: `src/domain/course/compute-course.ts`
- Modify: `src/domain/course/compute-course.test.ts`
- Modify: `src/domain/course/result-guard.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/domain/calendar/compute-calendar.test.ts`
- Modify: `src/domain/calendar/policy.test.ts`
- Modify: `src/domain/calendar/corrections.test.ts`
- Modify: `src/features/calendar-review/CalendarReview.test.tsx`
- Modify: `src/features/calendar-review/CalendarReview.geometry.test.tsx`
- Modify: `e2e/app-shell.spec.ts`, `e2e/artifact-experience.spec.ts`, `e2e/course-sheet.spec.ts`
- Modify: `e2e/four-lessons.spec.ts`, `e2e/heaven-earth.spec.ts`, `e2e/heavenly-generals.spec.ts`, `e2e/three-transmissions.spec.ts`

**Interfaces:**

```ts
export interface CourseInput {
  civilDateTime: string;
  timeZone: "Asia/Shanghai";
  locationName?: string;
  reason: string;
  corrections: Partial<{
    yearPillar: StemBranch;
    monthPillar: StemBranch;
    dayPillar: StemBranch;
    hourPillar: StemBranch;
    monthGeneral: EarthlyBranch;
    divinationHour: EarthlyBranch;
  }>;
}

export interface CourseContextInput {
  locationName?: string;
  reason: string;
}
```

- [ ] **Step 1: 写输入契约失败测试**

```ts
it("requires a trimmed reason and omits coordinates", () => {
  expect(() => parseCourseInput(formData({ reason: "   " }))).toThrow(/起课事由/);
  expect(() => parseCourseInput(formData({ reason: "甲".repeat(121) }))).toThrow(/120/);
  expect(parseCourseInput(formData({ locationName: "", reason: "  商务决策复盘  " }))).toMatchObject({
    reason: "商务决策复盘",
    locationName: undefined,
  });
});
```

In the form test, assert that `起课事由` is a required textarea, `地点（选填）` exists, and labels matching `经度|纬度` are absent.

- [ ] **Step 2: 运行输入测试并确认失败**

Run: `npm test -- src/features/course-input/schema.test.ts src/features/course-input/CourseInputForm.test.tsx`
Expected: FAIL because `reason` is not parsed and coordinate fields still render.

- [ ] **Step 3: 实现最小输入变更**

`parseCourseInput` trims both text fields, rejects a reason outside 1–120 characters, returns no coordinate keys, and omits an empty location. `CourseInputForm` renders a multiline required textarea with `maxLength={120}` and removes both coordinate inputs.

- [ ] **Step 4: 写最终课式和快照边界失败测试**

```ts
it("serializes reason and omits an empty location line", () => {
  const result = deriveCourse({ reason: "项目签约判断" }, calendar, lessons, transmissions, generals);
  expect(result.context.reason).toBe("项目签约判断");
  expect(result.copy.join("\n")).toContain("事由：项目签约判断");
  expect(result.copy.join("\n")).not.toContain("地点：");
});

it("invalidates only course when context text changes", () => {
  const changed = { ...session, input: { ...session.input, reason: "新的事由" } };
  expect(isCourseSnapshotForCurrentInputs(
    changed.snapshots.course,
    changed.input,
    changed.snapshots.calendar,
    changed.snapshots["four-lessons"],
    changed.snapshots["three-transmissions"],
    changed.snapshots["heavenly-generals"],
  )).toBe(false);
  const invalidated = invalidateFrom(changed, "course");
  expect(invalidated.snapshots.calendar).toBe(session.snapshots.calendar);
  expect(invalidated.snapshots["heavenly-generals"]).toBe(session.snapshots["heavenly-generals"]);
  expect(invalidated.snapshots.course).toBeUndefined();
});
```

- [ ] **Step 5: 实现课程上下文传播**

Change `deriveCourse` and its caller to consume `CourseContextInput`. Store `reason` and an optional `locationName` in `CourseResult.context`. The result guard accepts the optional key but rejects unknown keys. The serialized copy appends the reason and appends the location only when non-empty.

Change course snapshot matching to compare `{ reason, locationName }`. Keep calendar, plate, lessons, transmissions, and generals snapshot guards independent of both text fields.

- [ ] **Step 6: 更新参考课例和应用编排**

Set the shared fixture reason to `商务决策复盘`, remove fixture coordinates, and pass `{ reason, locationName }` only to final course computation. Update application tests to assert that editing the reason preserves all five upstream results and marks only `course` stale.

Update every listed E2E input helper to fill date, optional location and required reason; delete coordinate filling and assertions. This keeps browser tests executable from the first implementation commit onward.

- [ ] **Step 7: 验证并提交输入契约**

Run: `npm test -- src/features/course-input src/domain/course src/domain/chart/snapshots.test.ts src/app/App.test.tsx`
Expected: all selected tests pass.

```powershell
git add -- src/domain/chart src/domain/course src/features/course-input src/test/reference-session.ts src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add required course reason"
```

### Task 2: 明亮工作台外壳与起课上下文摘要

**Files:**
- Create: `src/features/course-workbench/CourseWorkbench.tsx`
- Create: `src/features/course-workbench/CourseWorkbench.test.tsx`
- Create: `src/features/course-workbench/CourseContextSummary.tsx`
- Create: `src/features/course-workbench/CourseContextSummary.test.tsx`
- Create: `src/features/course-workbench/course-workbench.css`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`

**Interfaces:**

```ts
interface CourseWorkbenchProps {
  input: CourseInput;
  source: ArtifactSourceResults;
  selectedStage: RuleStageId;
  onSelectStage(stage: RuleStageId): void;
  onRestart(): void;
}
```

- [ ] **Step 1: 写工作台布局失败测试**

Assert that a complete session renders one `main` workbench with an accessible `起课上下文` region, central `三维阶段回看` region, and `推演阶段` navigation. The context summary shows the full reason, optional location, date/time and correction markers, and contains no coordinates.

- [ ] **Step 2: 运行测试并确认工作台不存在**

Run: `npm test -- src/features/course-workbench src/app/App.test.tsx`
Expected: FAIL importing `CourseWorkbench`.

- [ ] **Step 3: 实现三栏工作台**

Use a desktop grid of `minmax(220px, 0.7fr) minmax(0, 2.6fr) minmax(240px, 0.8fr)`. Keep the center as the dominant surface. On widths below 900px, collapse the context into a summary disclosure and move stage navigation below the model.

The App continues to show the existing input/review flow while results are incomplete. After all six snapshots are valid, it renders `CourseWorkbench`; restart clears the current session through the existing state path.

- [ ] **Step 4: 提亮页面和模型灯光**

Set light theme tokens to an off-white canvas, charcoal text, jade accent and warm brass secondary accent. In `ArtifactSceneController`, use:

```ts
scene.background = new Color(0xdce5df);
keyLight.intensity = 1.35;
fillLight.intensity = 0.65;
rimLight.intensity = 0.45;
renderer.toneMappingExposure = 1.08;
```

Update the controller test to assert these values and retain the existing disposal/context-loss assertions.

- [ ] **Step 5: 验证并提交工作台外壳**

Run: `npm test -- src/features/course-workbench src/features/artifact-scene/three/ArtifactSceneController.test.ts src/app/App.test.tsx`
Expected: all selected tests pass.

Run: `npm run dev -- --host 127.0.0.1`
Expected: a complete reference session opens the bright three-column workbench and the model is readable without increasing browser brightness.

```powershell
git add -- src/features/course-workbench src/app src/styles src/features/artifact-scene/three
git commit -m "feat: add bright course workbench"
```

- [ ] **User review checkpoint 1:** 展示输入页、明亮工作台和模型灯光；收到用户确认后继续。

### Task 3: 单一阶段元数据、简短字幕和证据抽屉

**Files:**
- Create: `src/features/artifact-scene/annotations/types.ts`
- Create: `src/features/artifact-scene/timeline/review-stages.ts`
- Create: `src/features/artifact-scene/timeline/review-stages.test.ts`
- Create: `src/features/course-workbench/StageEvidenceDrawer.tsx`
- Create: `src/features/course-workbench/StageEvidenceDrawer.test.tsx`
- Create: `src/features/rule-review/StageReviewContent.tsx`
- Create: `src/features/rule-review/StageReviewContent.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactTimeline.tsx`
- Modify: `src/features/artifact-scene/ArtifactTimeline.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/course-experience/CourseExperience.tsx`
- Modify: `src/features/course-workbench/CourseWorkbench.tsx`

**Interfaces:**

```ts
export type ArtifactAnnotationId =
  | "calendar/slip" | "plate/earth" | "plate/heaven"
  | "lesson/first" | "lesson/second" | "lesson/third" | "lesson/fourth"
  | "transmission/initial" | "transmission/middle" | "transmission/final"
  | "general/noble" | "general/snake" | "general/vermilion-bird" | "general/harmony"
  | "general/hook-array" | "general/azure-dragon" | "general/void" | "general/white-tiger"
  | "general/constant" | "general/black-tortoise" | "general/yin" | "general/queen-of-heaven";

export interface ArtifactReviewStage {
  id: RuleStageId;
  label: string;
  startTimeMs: number;
  settledTimeMs: number;
  caption: readonly [string, string];
  camera: { position: readonly [number, number, number]; target: readonly [number, number, number] };
  annotationIds: readonly ArtifactAnnotationId[];
}
```

- [ ] **Step 1: 写阶段完整性失败测试**

Assert six unique stages in domain order, monotonically increasing times, exactly two caption lines per stage, and annotation IDs contained in the 22-item union. Assert that `ArtifactTimeline` renders from `ARTIFACT_REVIEW_STAGES` rather than a local stage array.

- [ ] **Step 2: 运行并确认元数据模块不存在**

Run: `npm test -- src/features/artifact-scene/timeline/review-stages.test.ts src/features/artifact-scene/ArtifactTimeline.test.tsx`
Expected: FAIL importing `review-stages`.

- [ ] **Step 3: 建立单一阶段定义**

Move current timing values into `ARTIFACT_REVIEW_STAGES`. Add the approved concise captions and one camera preset per stage. `ArtifactTimeline`, workbench stage rail and central caption all consume this array; delete their duplicate stage constants.

- [ ] **Step 4: 抽取现有文字复核内容**

`StageReviewContent` switches on `RuleStageId` and renders the existing calendar, plate, lessons, transmissions, generals or course component with the same correction callbacks. `StageEvidenceDrawer` is closed by default, has an accessible dialog/disclosure title, and mounts only the selected stage’s content when opened.

- [ ] **Step 5: 将阶段选择连到三维体验**

Add `selectedStage` to `CourseExperience` and `ArtifactExperience`. At this slice, selecting a stage seeks to its `settledTimeMs`, updates the two-line caption, and changes drawer content. The animated recap is added in Task 4.

- [ ] **Step 6: 验证并提交阶段信息架构**

Run: `npm test -- src/features/artifact-scene src/features/course-workbench src/features/rule-review src/features/course-experience`
Expected: all selected tests pass.

```powershell
git add -- src/features/artifact-scene src/features/course-workbench src/features/rule-review src/features/course-experience
git commit -m "feat: unify artifact review stages"
```

- [ ] **User review checkpoint 2:** 展示右侧六阶段轨、两行字幕和按需展开的证据抽屉；收到确认后继续。

### Task 4: 可重复的结构分解动画和双轴相机

**Files:**
- Create: `src/features/artifact-scene/timeline/evaluate-stage-replay.ts`
- Create: `src/features/artifact-scene/timeline/evaluate-stage-replay.test.ts`
- Modify: `src/features/artifact-scene/timeline/types.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.ts`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.test.ts`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`

**Interfaces:**

```ts
export interface StageReplayState {
  timelineTimeMs: number;
  decompositionProgress: number;
  complete: boolean;
}

export function evaluateStageReplay(
  stage: ArtifactReviewStage,
  elapsedMs: number,
  reducedMotion: boolean,
): StageReplayState;

export interface ArtifactNodePose {
  translationX: number;
  translationY: number;
  translationZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}
```

- [ ] **Step 1: 写时间与历史无关性失败测试**

For normal motion, assert 0–700ms replays the cumulative prior stages, 700–1600ms interpolates current structural separation, and 1600–1800ms settles. For reduced motion, assert the first evaluation returns the settled pose. Evaluate stage 4 after two different prior click sequences and require deep equality.

- [ ] **Step 2: 运行并确认回放求值器不存在**

Run: `npm test -- src/features/artifact-scene/timeline/evaluate-stage-replay.test.ts src/features/artifact-scene/timeline/evaluate-pose.test.ts`
Expected: FAIL importing `evaluate-stage-replay`.

- [ ] **Step 3: 实现六阶段分解增量**

Apply these maximum base-relative separations at progress 1:

```ts
const REVIEW_DELTAS = {
  calendar: { "calendar/slip": { translationZ: 0.035, rotationX: -0.12 } },
  "heaven-earth": { "plate/heaven": { translationZ: 0.03 } },
  "four-lessons": { "lesson/first": { translationX: -0.045 }, "lesson/second": { translationX: -0.015 }, "lesson/third": { translationX: 0.015 }, "lesson/fourth": { translationX: 0.045 } },
  "three-transmissions": { "transmission/initial": { translationY: -0.035 }, "transmission/middle": { translationY: -0.055 }, "transmission/final": { translationY: -0.075 } },
  "heavenly-generals": { "general/*": { translationZBySequence: 0.004 } },
  course: { "anchor/course-copy/lessons": { translationX: -0.025 }, "anchor/course-copy/transmissions": { translationX: 0.025 } },
} as const;
```

Expand the wildcard into the frozen twelve-general sequence during pose construction. Always reset nodes to captured base transforms before applying the absolute pose.

- [ ] **Step 4: 实现阶段相机和垂直观察范围**

Add `applyCameraPreset(preset)` to the controller. Set OrbitControls `minPolarAngle = Math.PI / 9`, `maxPolarAngle = 5 * Math.PI / 12`, and keep unrestricted azimuth. A controls `start` event cancels only the active camera tween. It must not stop the requestAnimationFrame driving decomposition.

- [ ] **Step 5: 验证并提交动画切片**

Run: `npm test -- src/features/artifact-scene/timeline src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/three/ArtifactSceneController.test.ts`
Expected: all selected tests pass.

```powershell
git add -- src/features/artifact-scene
git commit -m "feat: animate deterministic stage decomposition"
```

- [ ] **User review checkpoint 3:** 逐一点击六阶段，展示“快速累积—当前拆解—稳定观察”，并现场验证水平与上下拖动；收到确认后继续。

### Task 5: 22 部件描述、投影和稳定排布纯函数

**Files:**
- Create: `src/features/artifact-scene/annotations/descriptors.ts`
- Create: `src/features/artifact-scene/annotations/descriptors.test.ts`
- Create: `src/features/artifact-scene/annotations/project-annotations.ts`
- Create: `src/features/artifact-scene/annotations/project-annotations.test.ts`
- Create: `src/features/artifact-scene/annotations/layout-annotations.ts`
- Create: `src/features/artifact-scene/annotations/layout-annotations.test.ts`
- Modify: `src/features/artifact-scene/annotations/types.ts`

**Interfaces:**

```ts
export interface ArtifactAnnotationDescriptor {
  id: ArtifactAnnotationId;
  nodeId: string;
  label: string;
  detail: string;
  stages: readonly RuleStageId[];
}

export interface ProjectedAnchor {
  id: ArtifactAnnotationId;
  x: number;
  y: number;
  depth: number;
  behindCamera: boolean;
  occluded: boolean;
}

export interface AnnotationLayout {
  id: ArtifactAnnotationId;
  anchor: readonly [number, number];
  labelRect: { x: number; y: number; width: number; height: number };
  leaderPath: string;
  occluded: boolean;
}
```

- [ ] **Step 1: 写 22 部件契约失败测试**

Assert exactly 22 unique IDs and node IDs, all nodes are in `REQUIRED_NODE_IDS`, all six stages have 3–6 featured descriptors, and every label/detail is non-empty Chinese copy.

- [ ] **Step 2: 写投影与排布失败测试**

Use fixed matrices and a 1200×800 viewport to assert center projection, behind-camera rejection and edge clamping. Feed eight crossing anchors and assert non-overlapping label rectangles, deterministic left/right slots, leaders ending at anchors, and slot retention when an anchor moves less than 12px.

- [ ] **Step 3: 运行并确认模块不存在**

Run: `npm test -- src/features/artifact-scene/annotations`
Expected: FAIL importing descriptor, projection and layout modules.

- [ ] **Step 4: 实现描述表和纯函数**

Create the complete descriptor table in the same 22-ID order as the union. `projectArtifactAnnotations` performs homogeneous projection and returns pixel coordinates. `layoutArtifactAnnotations` assigns bounded left/right slots, uses a 12px hysteresis threshold, leaves at least 8px between cards, and produces an elbow SVG path `M anchor L bend L cardEdge`. Occluded anchors remain in layout with `occluded: true`; behind-camera anchors are omitted.

- [ ] **Step 5: 验证并提交标注核心**

Run: `npm test -- src/features/artifact-scene/annotations`
Expected: all selected tests pass and descriptor count is exactly 22.

```powershell
git add -- src/features/artifact-scene/annotations
git commit -m "feat: add artifact annotation layout core"
```

### Task 6: 随镜头移动的 DOM/SVG 引线标注层

**Files:**
- Create: `src/features/artifact-scene/ArtifactAnnotationLayer.tsx`
- Create: `src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`
- Modify: `src/features/artifact-scene/artifact-scene.css`

**Interfaces:**

```ts
export interface AnnotationFrame {
  viewport: { width: number; height: number };
  anchors: readonly ProjectedAnchor[];
}

export interface AnnotationFrameSource {
  captureAnnotationFrame(ids: readonly ArtifactAnnotationId[]): AnnotationFrame;
  focusNode(nodeId: string): void;
}
```

- [ ] **Step 1: 写控制器采样失败测试**

With a synthetic scene and camera, assert the controller returns current screen coordinates after camera movement, marks an anchor occluded when a nearer mesh intersects the camera ray, and reports a missing required node as a descriptive error without throwing from the render loop.

- [ ] **Step 2: 写标注层失败测试**

With a fake frame source and controlled animation frame, assert one semantic button/card and one SVG path per visible annotation, `aria-label` includes label and detail, camera-frame changes update card and path coordinates, and occluded items receive the dim/dashed state.

- [ ] **Step 3: 运行并确认功能不存在**

Run: `npm test -- src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx src/features/artifact-scene/three/ArtifactSceneController.test.ts`
Expected: FAIL because annotation frame capture and overlay do not exist.

- [ ] **Step 4: 实现世界锚点和遮挡采样**

Resolve each descriptor’s `nodeId`, call `getWorldPosition`, project through the current camera, and raycast from camera to anchor. Treat a hit as occluding only when its distance is at least `0.002` world units nearer and the hit object is not the anchor node or its descendant.

- [ ] **Step 5: 实现无 React 高频重渲染的覆盖层**

`ArtifactAnnotationLayer` owns one requestAnimationFrame effect. Each frame it calls the source, invokes the pure layout function, and updates card transforms plus SVG path attributes through refs. React renders semantic elements only when the annotation ID set changes. Cancel the frame on unmount.

Use 1px leaders, a 5px anchor dot, translucent light cards, 14px minimum text and 44px minimum interactive target. Occluded labels use 55% opacity and a dashed leader. Add controls for `本阶段 / 全部 / 隐藏`, defaulting to `本阶段`.

- [ ] **Step 6: 验证并提交桌面标注**

Run: `npm test -- src/features/artifact-scene`
Expected: all artifact tests pass.

```powershell
git add -- src/features/artifact-scene
git commit -m "feat: add camera tracked part callouts"
```

- [ ] **User review checkpoint 4:** 展示 22 个部件的本阶段/全部模式，旋转与上下移动镜头验证引线持续跟随；收到确认后继续。

### Task 7: 移动端重点标注与完整部件目录

**Files:**
- Create: `src/features/artifact-scene/ArtifactPartDirectory.tsx`
- Create: `src/features/artifact-scene/ArtifactPartDirectory.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/artifact-scene.css`
- Modify: `e2e/artifact-experience.spec.ts`

**Interfaces:**

```ts
interface ArtifactPartDirectoryProps {
  stage: RuleStageId;
  descriptors: readonly ArtifactAnnotationDescriptor[];
  onFocus(id: ArtifactAnnotationId): void;
}
```

- [ ] **Step 1: 写移动端目录失败测试**

Assert all 22 entries are present, grouped in six stage sections, the current stage group is expanded first, and activating an item invokes `onFocus` with its ID. At a 390×844 viewport, assert only the current stage’s 3–6 cards are visible over the canvas and directory text computes to at least 16px.

- [ ] **Step 2: 运行并确认目录不存在**

Run: `npm test -- src/features/artifact-scene/ArtifactPartDirectory.test.tsx`
Expected: FAIL importing `ArtifactPartDirectory`.

- [ ] **Step 3: 实现底部抽屉目录**

Render a native button-controlled bottom sheet with a scrollable 22-item directory. Selecting an item closes the sheet, calls the controller focus path, and leaves a visible focus indicator. Desktop keeps the sheet hidden; mobile disables the `全部` canvas density mode to prevent overlap.

- [ ] **Step 4: 添加移动端浏览器验收**

Update the shared E2E course helper to fill date, optional location and required reason only. In the artifact E2E test, use a 390×844 viewport, complete the reference session, open the directory, count 22 entries, select `天盘`, and assert the sheet closes while the canvas and standard text fallback remain available.

- [ ] **Step 5: 验证并提交移动端切片**

Run: `npm test -- src/features/artifact-scene/ArtifactPartDirectory.test.tsx`
Run: `npx playwright test e2e/artifact-experience.spec.ts --project=chromium`
Expected: unit and mobile browser tests pass.

```powershell
git add -- src/features/artifact-scene e2e/artifact-experience.spec.ts
git commit -m "feat: add mobile artifact part directory"
```

- [ ] **User review checkpoint 5:** 展示 390px 移动端重点标注、22 部件底部目录和点选聚焦；收到确认后继续。

### Task 8: 首屏三维懒加载、降级和包体门槛

**Files:**
- Modify: `src/features/course-experience/CourseExperience.tsx`
- Modify: `src/features/course-experience/CourseExperience.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`
- Create: `scripts/assert-entry-budget.mjs`
- Create: `scripts/assert-entry-budget.test.mjs`
- Modify: `package.json`
- Modify: `e2e/artifact-experience.spec.ts`

- [ ] **Step 1: 写懒加载与降级失败测试**

Assert the standard text course renders before the dynamic artifact module resolves, switching to 3D shows a labelled loading status, and rejected import/WebGL/context-loss states keep the text course plus a retry button.

- [ ] **Step 2: 实现三维入口懒加载**

Use `React.lazy` for `ArtifactExperience` inside `CourseExperience` and wrap it with a local `Suspense`. Do not lazy-load the input form, workbench shell, context summary or text course. Preserve the existing WebGL fallback contract.

- [ ] **Step 3: 写可执行包体断言**

`assert-entry-budget.mjs` locates the built `dist/assets/index-*.js`, rejects zero or multiple entry matches, and fails when its raw size exceeds 500,000 bytes. Its Node test uses temporary directories for below-limit, above-limit and ambiguous-match cases. Add:

```json
"verify:bundle-budget": "node scripts/assert-entry-budget.mjs"
```

- [ ] **Step 4: 验证首屏和降级**

Run: `node --test scripts/assert-entry-budget.test.mjs`
Run: `npm run build`
Run: `npm run verify:bundle-budget`
Run: `npx playwright test e2e/artifact-experience.spec.ts --project=chromium`
Expected: the entry chunk is below 500,000 raw bytes; the artifact chunk loads only after 3D mode is requested; fallback/context-loss tests pass.

- [ ] **Step 5: 提交性能和降级切片**

```powershell
git add -- src/features/course-experience src/features/artifact-scene scripts/assert-entry-budget.mjs scripts/assert-entry-budget.test.mjs package.json e2e/artifact-experience.spec.ts
git commit -m "perf: defer artifact runtime loading"
```

### Task 9: Blender 测试可移植性和隔离运行器

**Files:**
- Modify: `tools/blender/tests/test_inscriptions.py`
- Modify: `tools/blender/tests/test_uv_and_bake.py`
- Create: `scripts/test-blender-suite.mjs`
- Create: `scripts/test-blender-suite.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 固化 Windows 字体哈希失败测试**

Change the OFL hash helper to normalize `\r\n` to `\n` before SHA-256. Add an assertion that LF and CRLF encodings of the same license text produce the same digest while a content mutation does not.

- [ ] **Step 2: 将 ORM 差异分类为已占用与未占用纹素**

In the existing rebake comparison, classify differing pixels with the generated owner mask:

```py
owned_outside = [index for index in differing_uv_indices if owners[index] != 0 and distances[index] > edge_band]
unowned = [index for index in differing_uv_indices if owners[index] == 0]
self.assertEqual([], owned_outside)
self.assertLessEqual(len(unowned), 16)
```

Keep the existing total differing-pixel and maximum-channel-delta limits. This makes the acceptance rule explicit: no sampled/owned texel may vary outside the allowed edge band, while at most 16 unsampled atlas-background texels may vary.

- [ ] **Step 3: 连续验证 ORM 边界两次**

Run twice: `node scripts/run-blender.mjs --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py`
Expected each run: PASS; `owned_outside` is empty and `unowned` is at most 16. If either condition fails, stop this task and use `superpowers:systematic-debugging` before changing the tolerance.

- [ ] **Step 4: 写隔离运行器失败测试**

The Node test injects three fake Python test paths and a fake spawn implementation. Assert sorted execution, one fresh Blender process per file, immediate non-zero exit propagation, and no shell concatenation.

- [ ] **Step 5: 实现独立进程套件**

`test-blender-suite.mjs` enumerates `tools/blender/tests/test_*.py`, sorts paths, and invokes the existing `scripts/run-blender.mjs` once per file with `--background --factory-startup --python <file>`. Add:

```json
"test:blender": "node scripts/test-blender-suite.mjs"
```

- [ ] **Step 6: 验证并提交资产测试修复**

Run: `node --test scripts/test-blender-suite.test.mjs scripts/run-blender.test.mjs`
Run: `npm run test:blender`
Expected: every Blender module passes in its own clean process; OFL and ORM tests are green.

```powershell
git add -- tools/blender/tests/test_inscriptions.py tools/blender/tests/test_uv_and_bake.py scripts/test-blender-suite.mjs scripts/test-blender-suite.test.mjs package.json
git commit -m "test: stabilize artifact asset verification"
```

### Task 10: 全量回归、性能验收和最终展示

**Files:**
- Verify only: all files changed in Tasks 1–9

- [ ] **Step 1: 验证所有浏览器输入助手**

Run the input E2E once with a location and once with the optional location blank. Expected: both paths reach the completed workbench, and no visible input label matches `经度|纬度`.

- [ ] **Step 2: 运行静态旧字段扫描**

Run: `rg -n "longitude|latitude|经度|纬度" src e2e`
Expected: no matches in runtime code, tests or fixtures.

- [ ] **Step 3: 运行完整应用门槛**

Run: `npm test`
Expected: all Vitest and Node-discovered tests pass.

Run: `npm run build`
Expected: TypeScript and Vite build pass.

Run: `npm run verify:bundle-budget`
Expected: entry JavaScript is below 500,000 raw bytes.

Run: `npm run test:e2e`
Expected: all desktop and mobile Playwright tests pass.

- [ ] **Step 4: 运行资产与性能门槛**

Run: `npm run asset:validate`
Expected: LOD0, LOD1 and LOD2 satisfy the frozen GLB contract.

Run: `npm run test:blender`
Expected: all Blender modules pass in isolated processes.

Run: `npm run benchmark:artifact`
Expected: both desktop and mobile scenarios meet the existing benchmark policy with no regression failure.

Run: `npm run verify:calendar-sources`
Expected: frozen calendar source cases pass unchanged.

- [ ] **Step 5: 运行变更卫生检查**

Run: `git diff --check`
Expected: no whitespace errors.

Run: `git status --short`
Expected: only intentional task files are modified before the final commit.

- [ ] **Step 6: 提交全量回归更新**

```powershell
git add -- e2e src package.json scripts tools/blender/tests
git commit -m "test: cover 3d review workbench"
```

- [ ] **User review checkpoint 6:** 完整展示桌面与移动端主流程、六阶段拆解、动态引线、证据抽屉、文字降级和性能结果；用户确认后才进入分支收尾。

- [ ] **Step 7: 按开发分支收尾流程交付**

Use `superpowers:verification-before-completion` to rerun the relevant final gates from fresh output, then use `superpowers:finishing-a-development-branch` to present integration choices. Do not merge, push or delete a worktree without explicit user authorization.
