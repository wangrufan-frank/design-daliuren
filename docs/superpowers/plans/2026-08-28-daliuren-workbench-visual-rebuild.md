# Daliuren Workbench Visual Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the completed calculation flow into a bright, readable, desktop-and-touch-friendly digital artifact workbench without changing any Daliuren domain rules.

**Architecture:** Keep `App` as the calculation/session owner and keep Three.js state inside `ArtifactExperience`. Add only three focused presentation units: a landing preview, a deterministic completion transition, and a mobile workbench tool dock with one mutually exclusive panel state. Improve camera/light/annotation policies as pure data or pure functions, and move KTX2 support behind one reference-counted module-level lease.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.185, Vite 7, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-daliuren-workbench-visual-rebuild-design.md`

## Global Constraints

- Do not modify calendar, heaven-earth, four-lessons, three-transmissions, heavenly-generals, or course algorithms.
- Do not add a state-management library, router, UI kit, theme framework, or new runtime dependency.
- Keep all visible controls at least `44px` high and preserve visible keyboard focus.
- Respect `prefers-reduced-motion`; reduced-motion users see the completed workbench without an animated transition.
- Desktop `1440×900` and `1280×720`, plus mobile `390×844`, must have no page-level horizontal overflow.
- Mobile must expose all six stages and the text course without requiring a scroll to the page footer.
- The browser console must not emit `Multiple active KTX2 loaders` after repeated 3D/text switches or stage changes.
- Use the existing Noto Serif asset and system fallbacks; do not add a font download.

## File Structure

- Create `src/features/course-input/CourseLandingPreview.tsx`: semantic pre-course artifact preview and result promise.
- Create `src/features/course-input/CourseGenerationProgress.tsx`: deterministic six-stage completion overlay with reduced-motion bypass.
- Create `src/features/course-input/course-entry.css`: landing preview and progress presentation.
- Create `src/features/course-workbench/MobileWorkbenchTools.tsx`: mobile stage strip and five mutually exclusive tool panels.
- Modify `src/app/App.tsx`: landing preview, submit copy, and completion-transition state only.
- Modify `src/features/course-input/CourseInputForm.tsx`: submit label only.
- Modify `src/features/course-workbench/CourseWorkbench.tsx`: stable header hierarchy and mobile tool placement.
- Modify `src/features/course-workbench/course-workbench.css`: desktop workbench refinement and touch-first mobile layout.
- Modify `src/features/course-experience/CourseExperience.tsx`: accept compact tool placement and keep one view switch location.
- Modify `src/features/artifact-scene/ArtifactExperience.tsx`: optionally hide inline timeline/part directory when mobile dock owns them.
- Modify `src/features/artifact-scene/ArtifactAnnotationLayer.tsx`: pass layout safe areas and enforce featured-count policy.
- Modify `src/features/artifact-scene/annotations/layout-annotations.ts`: reserve tool and subject safe zones.
- Modify `src/features/artifact-scene/timeline/review-stages.ts`: inspection-safe camera presets and 3–6 featured annotations.
- Modify `src/features/artifact-scene/three/ArtifactSceneController.ts`: brighter neutral museum lighting and reset camera.
- Create `src/features/artifact-scene/three/ktx2-loader-lease.ts`: one shared, reference-counted KTX2 loader.
- Modify `src/features/artifact-scene/three/load-artifact.ts`: consume and release the shared lease.
- Modify component/unit/E2E tests adjacent to every changed unit.

---

### Task 1: Landing Preview, Action Copy, and Visual Tokens

**Files:**
- Create: `src/features/course-input/CourseLandingPreview.tsx`
- Create: `src/features/course-input/course-entry.css`
- Modify: `src/features/course-input/CourseInputForm.tsx`
- Modify: `src/features/course-input/CourseInputForm.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `CourseLandingPreview(): JSX.Element` with `aria-label="课式生成预览"`.
- Preserves: `CourseInputForm({ onSubmit }: { onSubmit(input: CourseInput): void })`.

- [ ] **Step 1: Write failing landing and copy tests**

Add to `CourseInputForm.test.tsx`:

```tsx
it("names the action by the complete result it creates", () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);
  expect(screen.getByRole("button", { name: "生成完整课式" })).toBeVisible();
});
```

Update existing button lookups from `建立起课上下文` to `生成完整课式`, then add to `App.test.tsx`:

```tsx
it("explains the complete output before a course is generated", () => {
  render(<App />);
  const preview = screen.getByRole("region", { name: "课式生成预览" });
  expect(preview).toHaveTextContent("三维课式");
  expect(preview).toHaveTextContent("标准文字课式");
  expect(preview).toHaveTextContent("六阶段依据");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/features/course-input/CourseInputForm.test.tsx src/app/App.test.tsx`

Expected: FAIL because the button still says `建立起课上下文` and the `课式生成预览` region does not exist.

- [ ] **Step 3: Implement the semantic landing preview and copy**

Create `CourseLandingPreview.tsx` with real product language and no fake calculated values:

```tsx
import "./course-entry.css";

export function CourseLandingPreview() {
  return (
    <section className="course-landing-preview" aria-label="课式生成预览">
      <div className="course-landing-preview__artifact" aria-hidden="true">
        <span data-ring="heaven" />
        <span data-ring="earth" />
        <i data-axis="vertical" />
        <i data-axis="horizontal" />
      </div>
      <div className="course-landing-preview__copy">
        <p>可追溯的数字器物</p>
        <h2>从占时到课式，回看每一步依据</h2>
        <p>输入起课时间，生成可回看依据的三维课式与标准文字课式。</p>
        <ul>
          <li>三维课式</li>
          <li>标准文字课式</li>
          <li>六阶段依据</li>
        </ul>
      </div>
    </section>
  );
}
```

Render it in the empty `.app-stage`, change the form button to `生成完整课式`, and update the shared test helper.

Replace the root tokens with the six approved roles:

```css
:root {
  --canvas: #eef1ed;
  --panel: #f8f8f3;
  --ink: #f8f8f3;
  --dark-bronze: #dce5df;
  --patina: #afc5bc;
  --ru-celadon: #547d70;
  --ash: #1e2723;
  --old-gold: #9a7842;
}
```

Keep the preview CSS geometric and specific to an instrument: two offset rings, crosshair axes, no gradients, shadows, rounded cards, or ornamental motifs.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/features/course-input/CourseInputForm.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the landing change**

```powershell
git add -- src/features/course-input/CourseLandingPreview.tsx src/features/course-input/course-entry.css src/features/course-input/CourseInputForm.tsx src/features/course-input/CourseInputForm.test.tsx src/app/App.tsx src/app/App.test.tsx src/styles/tokens.css src/styles/global.css
git commit -m "feat: clarify the complete course entry"
```

### Task 2: Deterministic Six-Stage Completion Transition

**Files:**
- Create: `src/features/course-input/CourseGenerationProgress.tsx`
- Create: `src/features/course-input/CourseGenerationProgress.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/course-input/course-entry.css`

**Interfaces:**
- Produces: `CourseGenerationProgress({ onComplete, reducedMotion }: { onComplete(): void; reducedMotion: boolean }): JSX.Element`.
- `App` keeps a `pendingSession: CourseSession | null`; rule computation remains synchronous and unchanged.

- [ ] **Step 1: Write the failing progress behavior tests**

Create `CourseGenerationProgress.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CourseGenerationProgress } from "./CourseGenerationProgress";

afterEach(() => vi.useRealTimers());

it("announces the six real stages and completes once", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<CourseGenerationProgress reducedMotion={false} onComplete={onComplete} />);
  expect(screen.getByRole("status")).toHaveTextContent("历法与月将");
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  act(() => vi.advanceTimersByTime(720));
  expect(onComplete).toHaveBeenCalledOnce();
});

it("finishes immediately when reduced motion is requested", () => {
  const onComplete = vi.fn();
  render(<CourseGenerationProgress reducedMotion onComplete={onComplete} />);
  expect(onComplete).toHaveBeenCalledOnce();
});
```

Add an `App.test.tsx` assertion that valid submission shows `正在生成完整课式` before the completed workbench when timers have not advanced.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/course-input/CourseGenerationProgress.test.tsx src/app/App.test.tsx`

Expected: FAIL because the progress component and pending-session state do not exist.

- [ ] **Step 3: Implement a presentation-only transition**

Use `RULE_STAGE_ORDER` and the existing stage labels. The component changes only its highlighted visual index; its accessible status says `正在生成完整课式` and the full six-item list is always present. Use one `720ms` timer for completion and CSS delays for the six markers; do not schedule or re-run domain calculations per marker.

In `App`, compute the complete `CourseSession` exactly once, store it in `pendingSession`, and render the progress component. `onComplete` promotes `pendingSession` into `session`. Read reduced motion through the existing `useReducedMotion` hook.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/course-input/CourseGenerationProgress.test.tsx src/app/App.test.tsx`

Expected: PASS with fake timers restored after each test.

- [ ] **Step 5: Commit the transition**

```powershell
git add -- src/features/course-input/CourseGenerationProgress.tsx src/features/course-input/CourseGenerationProgress.test.tsx src/features/course-input/course-entry.css src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: show deterministic course generation progress"
```

### Task 3: Mobile Stage Dock and Mutually Exclusive Tool Panels

**Files:**
- Create: `src/features/course-workbench/MobileWorkbenchTools.tsx`
- Create: `src/features/course-workbench/MobileWorkbenchTools.test.tsx`
- Modify: `src/features/course-workbench/CourseWorkbench.tsx`
- Modify: `src/features/course-workbench/CourseWorkbench.test.tsx`
- Modify: `src/features/course-workbench/course-workbench.css`
- Modify: `src/features/course-experience/CourseExperience.tsx`
- Modify: `src/features/course-experience/CourseExperience.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`

**Interfaces:**
- Produces: `type MobileToolId = "context" | "parts" | "timeline" | "evidence" | "course"`.
- Produces: `MobileWorkbenchTools` props with `activeTool`, `onActiveToolChange`, `selectedStage`, `onSelectStage`, and render slots for the five existing content units.
- Adds optional `ArtifactExperience` flags `showTimeline?: boolean` and `showPartDirectory?: boolean`, defaulting to `true` to preserve non-workbench callers.

- [ ] **Step 1: Write failing dock and ownership tests**

Create `MobileWorkbenchTools.test.tsx`:

```tsx
it("keeps one tool panel open and returns focus when it closes", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [activeTool, setActiveTool] = useState<MobileToolId>();
    return (
      <MobileWorkbenchTools
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
        selectedStage="course"
        onSelectStage={vi.fn()}
        context={<p>上下文内容</p>}
        parts={<p>部件内容</p>}
        timeline={<p>时间轴内容</p>}
        evidence={<p>证据内容</p>}
        course={<p>文字内容</p>}
      />
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "阶段证据" }));
  expect(screen.getByRole("region", { name: "移动工具面板" })).toHaveTextContent("证据内容");
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expect(screen.getByRole("region", { name: "移动工具面板" })).toHaveTextContent("文字内容");
  expect(screen.queryByText("证据内容")).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "文字课式" })).toHaveFocus();
});
```

Add workbench assertions for `navigation` named `移动推演阶段` and a `toolbar` named `工作台工具`. Add `ArtifactExperience` tests proving `showTimeline={false}` removes `器物推演控制` and `showPartDirectory={false}` removes `部件目录` without removing the canvas.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/course-workbench/MobileWorkbenchTools.test.tsx src/features/course-workbench/CourseWorkbench.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx`

Expected: FAIL because the mobile dock and ownership props do not exist.

- [ ] **Step 3: Implement one mobile tool state and stable stage access**

`MobileWorkbenchTools` uses one controlled value, never five booleans:

```tsx
export type MobileToolId = "context" | "parts" | "timeline" | "evidence" | "course";

const TOOLS: readonly { id: MobileToolId; label: string }[] = [
  { id: "context", label: "上下文" },
  { id: "parts", label: "部件" },
  { id: "timeline", label: "时间轴" },
  { id: "evidence", label: "阶段证据" },
  { id: "course", label: "文字课式" },
];
```

Render the existing `RuleStageRail` above the tool toolbar inside a sticky mobile dock. Use CSS media queries to show the existing desktop side columns at `min-width: 900px` and the mobile dock below it. Do not duplicate domain results: the mobile panels render the same `CourseContextSummary`, `ArtifactPartDirectory`, `ArtifactTimeline`, `StageReviewContent`, and `CourseSheet` components or focused wrappers around them.

Move the three-dimensional/text mode switch into a fixed stage toolbar above the content on both breakpoints. On mobile, switching to text activates the `course` tool; closing the panel returns to 3D without resetting `selectedStage`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/course-workbench/MobileWorkbenchTools.test.tsx src/features/course-workbench/CourseWorkbench.test.tsx src/features/course-experience/CourseExperience.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the responsive architecture**

```powershell
git add -- src/features/course-workbench/MobileWorkbenchTools.tsx src/features/course-workbench/MobileWorkbenchTools.test.tsx src/features/course-workbench/CourseWorkbench.tsx src/features/course-workbench/CourseWorkbench.test.tsx src/features/course-workbench/course-workbench.css src/features/course-experience/CourseExperience.tsx src/features/course-experience/CourseExperience.test.tsx src/features/artifact-scene/ArtifactExperience.tsx src/features/artifact-scene/ArtifactExperience.test.tsx
git commit -m "feat: add touch-first workbench navigation"
```

### Task 4: Inspection-Safe Cameras and Brighter Museum Lighting

**Files:**
- Modify: `src/features/artifact-scene/timeline/review-stages.ts`
- Modify: `src/features/artifact-scene/timeline/review-stages.test.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`

**Interfaces:**
- Preserves: `ArtifactReviewStage.camera` tuple shape.
- Produces: all presets with distance `1.04–1.18`, positive elevation, and target inside the artifact body envelope.
- Preserves: `ArtifactSceneController.resetCamera(): void` and `applyCameraPreset(...)`.

- [ ] **Step 1: Tighten camera and lighting tests first**

Replace the current `0.9` distance expectation with explicit safe framing:

```ts
for (const { camera } of ARTIFACT_REVIEW_STAGES) {
  const distance = Math.hypot(...camera.position.map((value, index) => value - camera.target[index]));
  expect(distance).toBeGreaterThanOrEqual(1.04);
  expect(distance).toBeLessThanOrEqual(1.18);
  expect(camera.position[1]).toBeGreaterThan(camera.target[1] + 0.32);
  expect(Math.abs(camera.target[0])).toBeLessThanOrEqual(0.12);
  expect(Math.abs(camera.target[2])).toBeLessThanOrEqual(0.12);
}
```

Update the controller test to expect `toneMappingExposure` `1.32`, a neutral key light, hemisphere intensity `1.05`, and a separate fill directional light. Assert reset camera matches the new three-quarter initial camera.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/artifact-scene/timeline/review-stages.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts`

Expected: FAIL on camera distance, exposure, fill intensity, and light count/color.

- [ ] **Step 3: Implement minimal camera and lighting policy**

Use six distinct three-quarter presets between `1.04` and `1.18` units from their targets. Keep the target near the artifact body center and use zoom only through position distance.

In the controller use:

```ts
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.32;
const keyLight = new THREE.DirectionalLight(0xf2eee4, 1.55);
const fillLight = new THREE.HemisphereLight(0xc8d9d2, 0x52605b, 1.05);
const sideFill = new THREE.DirectionalLight(0xb8d0c7, 0.72);
const rimLight = new THREE.DirectionalLight(0xd8ddd5, 0.58);
```

Position the key front-left/high, side fill front-right/medium, and rim rear/high. Do not add emissive material overrides.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/artifact-scene/timeline/review-stages.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the camera and light policy**

```powershell
git add -- src/features/artifact-scene/timeline/review-stages.ts src/features/artifact-scene/timeline/review-stages.test.ts src/features/artifact-scene/three/ArtifactSceneController.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts
git commit -m "fix: keep artifact stages bright and inspection safe"
```

### Task 5: Annotation Limits and Reserved Safe Areas

**Files:**
- Modify: `src/features/artifact-scene/annotations/types.ts`
- Modify: `src/features/artifact-scene/annotations/layout-annotations.ts`
- Modify: `src/features/artifact-scene/annotations/layout-annotations.test.ts`
- Modify: `src/features/artifact-scene/ArtifactAnnotationLayer.tsx`
- Modify: `src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx`
- Modify: `src/features/artifact-scene/timeline/review-stages.ts`
- Modify: `src/features/artifact-scene/timeline/review-stages.test.ts`
- Modify: `src/features/artifact-scene/artifact-scene.css`

**Interfaces:**
- Extends: `AnnotationLayoutOptions` with `safeArea?: { top: number; right: number; bottom: number; left: number; subject?: { x: number; y: number; width: number; height: number } }`.
- Preserves: `layoutArtifactAnnotations(...): AnnotationLayout[]`.
- Guarantees: featured sets contain 3–4 annotations except `heavenly-generals` and `course`, which may contain up to 6.

- [ ] **Step 1: Write failing safe-area and count tests**

Add to `layout-annotations.test.ts`:

```ts
it("keeps cards outside toolbar, controls, and the subject center", () => {
  const safeArea = {
    top: 64, right: 12, bottom: 120, left: 12,
    subject: { x: 220, y: 100, width: 360, height: 420 },
  };
  const result = layoutArtifactAnnotations(anchors, { width: 804, height: 760 }, { safeArea });
  for (const { labelRect } of result) {
    expect(labelRect.y).toBeGreaterThanOrEqual(64);
    expect(labelRect.y + labelRect.height).toBeLessThanOrEqual(640);
    expect(rectanglesOverlap(labelRect, safeArea.subject)).toBe(false);
  }
});
```

Add to `review-stages.test.ts`:

```ts
for (const stage of ARTIFACT_REVIEW_STAGES) {
  expect(stage.annotationIds.length).toBeGreaterThanOrEqual(3);
  expect(stage.annotationIds.length).toBeLessThanOrEqual(stage.id === "heavenly-generals" || stage.id === "course" ? 6 : 4);
}
```

Add a layer test that `本阶段` never renders IDs outside `featuredIds`, while `全部` still renders all 22 on a non-compact viewport.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/artifact-scene/annotations/layout-annotations.test.ts src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx src/features/artifact-scene/timeline/review-stages.test.ts`

Expected: FAIL because safe areas are ignored and one stage has fewer than three or more than four default labels.

- [ ] **Step 3: Implement reserved bands and subject avoidance**

Compute usable bounds from `safeArea`. Place cards in left/right rails outside `subject`; if a side rail cannot fit a 44px card, omit the lowest-priority occluded card rather than overlap the subject or controls. Preserve stable order and hysteresis for retained cards.

Pass a desktop safe area `{ top: 72, right: 12, bottom: 128, left: 12, subject: centered 46% width × 60% height }`; compact view uses `{ top: 56, right: 8, bottom: 16, left: 8, subject: centered 34% width × 52% height }` because the timeline is in the mobile dock.

Keep `course` at six featured IDs; add the missing context-relevant ID where a stage has fewer than three. Do not add new logical descriptors.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/artifact-scene/annotations/layout-annotations.test.ts src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx src/features/artifact-scene/timeline/review-stages.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit annotation policy**

```powershell
git add -- src/features/artifact-scene/annotations/types.ts src/features/artifact-scene/annotations/layout-annotations.ts src/features/artifact-scene/annotations/layout-annotations.test.ts src/features/artifact-scene/ArtifactAnnotationLayer.tsx src/features/artifact-scene/ArtifactAnnotationLayer.test.tsx src/features/artifact-scene/timeline/review-stages.ts src/features/artifact-scene/timeline/review-stages.test.ts src/features/artifact-scene/artifact-scene.css
git commit -m "fix: keep artifact annotations out of the viewing area"
```

### Task 6: Shared KTX2 Loader Lease

**Files:**
- Create: `src/features/artifact-scene/three/ktx2-loader-lease.ts`
- Create: `src/features/artifact-scene/three/ktx2-loader-lease.test.ts`
- Modify: `src/features/artifact-scene/three/load-artifact.ts`
- Modify: `src/features/artifact-scene/three/load-artifact.test.ts`

**Interfaces:**
- Produces: `acquireKtx2Loader(renderer: THREE.WebGLRenderer): { loader: KTX2Loader; release(): void }`.
- Guarantees: one live loader instance per overlapping group of artifact loads; disposal occurs once when the final lease releases.

- [ ] **Step 1: Write failing shared-lifecycle tests**

Create `ktx2-loader-lease.test.ts` with the KTX2 constructor mocked:

```ts
it("shares one active loader and disposes it after the final release", () => {
  const first = acquireKtx2Loader(renderer);
  const second = acquireKtx2Loader(renderer);
  expect(ktx2Loaders).toHaveLength(1);
  first.release();
  expect(ktx2Loaders[0].dispose).not.toHaveBeenCalled();
  second.release();
  expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
});

it("creates a fresh loader after the previous lease group is fully released", () => {
  acquireKtx2Loader(renderer).release();
  acquireKtx2Loader(renderer).release();
  expect(ktx2Loaders).toHaveLength(2);
});
```

Update `load-artifact.test.ts` to start two unresolved `loadArtifact` calls and assert only one KTX2 instance exists until both settle.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/artifact-scene/three/ktx2-loader-lease.test.ts src/features/artifact-scene/three/load-artifact.test.ts`

Expected: FAIL because `acquireKtx2Loader` does not exist and current loads construct one loader each.

- [ ] **Step 3: Implement the minimal reference-counted lease**

Use module state with a nullable entry and idempotent releases:

```ts
type ActiveLease = { loader: KTX2Loader; references: number };
let active: ActiveLease | undefined;

export function acquireKtx2Loader(renderer: THREE.WebGLRenderer) {
  if (!active) {
    const loader = new KTX2Loader();
    loader.setTranscoderPath("/three/basis/").detectSupport(renderer);
    active = { loader, references: 0 };
  }
  const lease = active;
  lease.references += 1;
  let released = false;
  return {
    loader: lease.loader,
    release() {
      if (released) return;
      released = true;
      lease.references -= 1;
      if (lease.references === 0 && active === lease) {
        lease.loader.dispose();
        active = undefined;
      }
    },
  };
}
```

Acquire immediately before `setKTX2Loader`, release in `finally`, and preserve the original cause for support-detection, loader setup, loading, and indexing failures.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/artifact-scene/three/ktx2-loader-lease.test.ts src/features/artifact-scene/three/load-artifact.test.ts`

Expected: PASS, including failure-cause and disposal assertions.

- [ ] **Step 5: Commit the loader fix**

```powershell
git add -- src/features/artifact-scene/three/ktx2-loader-lease.ts src/features/artifact-scene/three/ktx2-loader-lease.test.ts src/features/artifact-scene/three/load-artifact.ts src/features/artifact-scene/three/load-artifact.test.ts
git commit -m "fix: share compressed texture loader lifecycle"
```

### Task 7: Responsive Visual Consistency and E2E Acceptance

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/features/course-workbench/course-workbench.css`
- Modify: `src/features/artifact-scene/artifact-scene.css`
- Modify: `e2e/app-shell.spec.ts`
- Modify: `e2e/artifact-experience.spec.ts`

**Interfaces:**
- No new runtime interface.
- Produces browser assertions for layout reachability, full-artifact framing proxies, and warning-free repeated view switching.

- [ ] **Step 1: Add failing browser acceptance assertions**

Extend `e2e/app-shell.spec.ts`:

```ts
async function generateCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
}

test("mobile exposes stages and workbench tools before the document footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await generateCourse(page);
  const stageDock = page.getByRole("navigation", { name: "移动推演阶段" });
  const tools = page.getByRole("toolbar", { name: "工作台工具" });
  await expect(stageDock).toBeInViewport();
  await expect(tools).toBeInViewport();
  await page.getByRole("button", { name: "文字课式" }).click();
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});
```

Extend `artifact-experience.spec.ts` to switch `三维推演 → 文字课式 → 三维推演` three times, assert the canvas remains visible, collect warning logs, and expect no message containing `Multiple active KTX2 loaders`.

Add computed-layout assertions that the mode toolbar does not intersect any visible annotation card and the canvas top/bottom are inside the stage frame.

- [ ] **Step 2: Run the targeted E2E tests and verify RED**

Run: `npx playwright test e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts --project=chromium`

Expected: FAIL on mobile in-viewport navigation/tool assertions and any remaining toolbar/card intersection.

- [ ] **Step 3: Finish CSS hierarchy without adding new abstractions**

Apply these layout outcomes:

- Header uses the same product-name-first order before and after generation.
- Desktop grid remains three columns and the center column receives the largest fraction.
- Mode toolbar occupies document flow above the artifact, never grid-overlays the canvas.
- Mobile stage viewport uses `min-height: 55vh; max-height: 65vh` with a usable minimum of `360px`.
- Mobile dock uses `position: sticky; bottom: 0;` plus safe-area padding and an opaque `--panel` background.
- Desktop stage rail remains right-side vertical; mobile desktop-only side rails are hidden.
- Secondary text uses a dedicated muted ink value derived with `color-mix`, not the main action green.

Delete only CSS selectors made unreachable by this change. Do not reformat unrelated review-section CSS.

- [ ] **Step 4: Re-run targeted E2E tests and verify GREEN**

Run: `npx playwright test e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts --project=chromium`

Expected: PASS at desktop and mobile viewports with no KTX2 warning.

- [ ] **Step 5: Commit visual acceptance changes**

```powershell
git add -- src/styles/global.css src/features/course-workbench/course-workbench.css src/features/artifact-scene/artifact-scene.css e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts
git commit -m "test: lock workbench visual acceptance"
```

### Task 8: Full Regression, Browser Screenshots, and Final Cleanup

**Files:**
- Modify only files already touched by Tasks 1–7 when verification exposes a direct regression.
- Do not create a new report file unless the user requests one.

**Interfaces:**
- No new interfaces.

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test`

Expected: all Vitest files pass with zero failed tests.

- [ ] **Step 2: Run production build and source checks**

Run: `npm run build`

Expected: TypeScript and Vite exit `0`.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Run the complete Playwright suite**

Run: `npm run test:e2e`

Expected: all configured Playwright projects pass.

- [ ] **Step 4: Perform real-browser screenshot review**

Start `npm run dev -- --host 127.0.0.1`, then use the in-app browser at:

- `1440×900`: landing, completed 3D course, text course, calendar evidence.
- `1280×720`: completed 3D course with controls and stages visible.
- `390×844`: 3D stage, stage switch, each of five mobile tool panels, text course.

For each 3D stage, inspect the initial frame and the settled frame for: complete artifact context, readable material response, no large information-free black surface, no toolbar/label collision, and no page-level horizontal overflow. Inspect browser logs after repeated view switches.

- [ ] **Step 5: Fix only observed regressions and repeat the proving command**

For every observed defect, first add or tighten a focused failing test, run it to see the expected failure, apply the minimum implementation change, then re-run that focused test. Repeat Steps 1–4 after the last fix.

- [ ] **Step 6: Review the requirement checklist against the spec**

Confirm each item in spec sections 11 and 13 has fresh evidence: unit tests, build, E2E, screenshots, fallback behavior, correction/reset, copy action, mobile reachability, annotation counts, stage camera framing, and warning-free loader behavior.

- [ ] **Step 7: Commit final direct fixes, if any**

```powershell
git add -- src/app/App.tsx src/styles/tokens.css src/styles/global.css src/features/course-input src/features/course-workbench src/features/course-experience src/features/artifact-scene e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts
git commit -m "fix: close workbench visual regressions"
```

Skip this commit when verification required no additional changes.
