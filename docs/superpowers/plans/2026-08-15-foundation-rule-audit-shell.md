# 大六壬项目基础与规则审核骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个可运行、可测试的 React/TypeScript 项目，固定大六壬阶段快照接口、手动修正失效规则和已确认的文字课式布局，为后续逐项实现传统规则与三维模型提供稳定边界。

**Architecture:** 规则域使用纯 TypeScript，不依赖 React；每个传统规则阶段产生不可变快照，手动修正只使该阶段及后续快照失效。React 只负责输入、阶段状态和文字课式呈现，不计算大六壬规则；本计划不伪造尚未由用户审核的传统算法。

**Tech Stack:** Node.js 24、npm、React 19、TypeScript 5、Vite 7、Vitest、Testing Library、Playwright。

## Global Constraints

- 首版只覆盖排盘计算与规则说明，不包含综合断课、应期或自动断语。
- 传统规则引擎是唯一事实来源；三维模型、证据链和两种课式不得分别计算。
- 自动值与人工修正值必须明确区分，修正后只重算受影响的下游阶段。
- 文字课式采用香灰、玄铜、铜绿和天青，不使用暖白、粉色或大面积金棕。
- 所有用户可见动作必须对应真实规则；本阶段不制作三维动画或假模型。
- 桌面端优先，布局必须支持 390px 宽移动端且无横向溢出。
- 只保留规则正确性、状态一致性、关键交互和可读性验证。

## Scope Decomposition

本规格包含五个可独立验收的子系统，按以下计划顺序实施：

1. 本计划：项目基础、规则快照契约、输入与修正、文字课式骨架。
2. 传统规则引擎：历法/月将、天地盘、四课、三传、天将；每个模块以用户确认案例为先。
3. 馆藏研究与三维资产：写实概念图、模型、PBR 材质和资源预算。
4. 三维交互与确定性动画：360 度观察、时间轴、证据链和性能降级。
5. 复制结课与导出：三维课式、跨视图高亮、图片、打印和文本导出。

后四项分别编写实施计划。只有前一项的接口和验收通过后，才开始下一项。

## File Structure

```text
package.json                         # scripts and dependency boundaries
vite.config.ts                       # Vite and Vitest configuration
tsconfig.json                        # project references
tsconfig.app.json                    # browser TypeScript settings
tsconfig.node.json                   # tooling TypeScript settings
index.html                           # Vite entry document
src/main.tsx                         # React bootstrap
src/app/App.tsx                      # phase-one application shell
src/app/App.test.tsx                 # shell behavior tests
src/styles/tokens.css                # confirmed bronze/Song color tokens
src/styles/global.css                # reset, typography, responsive base
src/domain/chart/types.ts            # stable domain types shared by all later plans
src/domain/chart/stages.ts           # stage order and dependency metadata
src/domain/chart/snapshots.ts        # reviewed-session validation and invalidation
src/domain/chart/snapshots.test.ts   # snapshot invariants
src/features/course-input/schema.ts  # input parsing and validation
src/features/course-input/schema.test.ts
src/features/course-input/CourseInputForm.tsx
src/features/course-input/CourseInputForm.test.tsx
src/features/course-sheet/view-model.ts
src/features/course-sheet/view-model.test.ts
src/features/course-sheet/CourseSheet.tsx
src/features/course-sheet/CourseSheet.test.tsx
src/features/rule-review/RuleStageRail.tsx
src/features/rule-review/RuleStageRail.test.tsx
src/test/reference-session.ts        # test-only reviewed session fixture
tests/app-shell.spec.ts              # desktop/mobile smoke tests
```

---

### Task 1: Scaffold the Tested Application Shell

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: none.
- Produces: `App(): JSX.Element`, the global token names used by every later task, and runnable `dev`, `build`, `test`, and `test:e2e` scripts.

- [ ] **Step 1: Create the package manifest in the prepared worktree**

Run:

```powershell
npm init -y
npm install react@^19.1.1 react-dom@^19.1.1
npm install -D typescript@^5.9.2 vite@^7.1.0 @vitejs/plugin-react@^4.6.0 vitest@^3.2.4 jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/jest-dom@^6.6.4 @testing-library/user-event@^14.6.1 @playwright/test@^1.54.2
```

Then set these exact scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Write the failing application-shell test**

Create `src/app/App.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the product title and the first rule stage", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    expect(screen.getByText("起课输入")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `App` does not exist.

- [ ] **Step 4: Implement the minimal shell and confirmed design tokens**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom" },
});
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "noEmit": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>大六壬演式</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/app/App.tsx`:

```tsx
import "../styles/tokens.css";
import "../styles/global.css";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>大六壬演式</h1>
      </header>
      <section aria-labelledby="stage-heading">
        <h2 id="stage-heading">起课输入</h2>
        <p>建立起课上下文后，依次审核传统规则阶段。</p>
      </section>
    </main>
  );
}
```

Create `src/styles/tokens.css`:

```css
:root {
  --ink: #121817;
  --dark-bronze: #26322f;
  --patina: #435c53;
  --ru-celadon: #879b92;
  --ash: #c2c6bb;
  --old-gold: #80704c;
  --error: #7b332f;
}
```

Create `src/styles/global.css`:

```css
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  min-width: 320px;
  background: var(--ink);
  color: var(--ash);
  font-family: "Noto Serif SC", "Songti SC", serif;
}
button, input, select { font: inherit; }
:focus-visible { outline: 2px solid var(--ru-celadon); outline-offset: 3px; }
.app-shell { width: min(100%, 1440px); margin: 0 auto; padding: 24px; }
.app-header { border-bottom: 1px solid var(--patina); }
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Run unit tests and production build**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and Vite creates `dist/` without TypeScript errors.

- [ ] **Step 6: Commit the scaffold**

```powershell
git add package.json package-lock.json vite.config.ts tsconfig*.json index.html src
git commit -m "chore: scaffold daliuren application"
```

---

### Task 2: Define Stable Rule-Stage Domain Contracts

**Files:**
- Create: `src/domain/chart/types.ts`
- Create: `src/domain/chart/stages.ts`
- Create: `src/domain/chart/snapshots.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `RuleStageId`, `CourseInput`, `RuleSnapshot<T>`, `CourseSession`, `RULE_STAGE_ORDER`, and `stageDependencies`.

- [ ] **Step 1: Write the failing stage-order test**

Create `src/domain/chart/snapshots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RULE_STAGE_ORDER, stageDependencies } from "./stages";

describe("rule stage metadata", () => {
  it("orders every calculation dependency before its consumer", () => {
    for (const [index, stage] of RULE_STAGE_ORDER.entries()) {
      for (const dependency of stageDependencies[stage]) {
        expect(RULE_STAGE_ORDER.indexOf(dependency)).toBeLessThan(index);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: FAIL because `stages.ts` does not exist.

- [ ] **Step 3: Implement the exact domain types**

Create `src/domain/chart/types.ts`:

```ts
export type EarthlyBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";

export type RuleStageId =
  | "calendar"
  | "heaven-earth"
  | "four-lessons"
  | "three-transmissions"
  | "heavenly-generals"
  | "course";

export type ValueSource = "automatic" | "manual";

export interface CourseInput {
  civilDateTime: string;
  timeZone: "Asia/Shanghai";
  locationName: string;
  longitude: number;
  latitude: number;
  corrections: Partial<{
    yearPillar: string;
    monthPillar: string;
    dayPillar: string;
    hourPillar: string;
    monthGeneral: EarthlyBranch;
    divinationHour: EarthlyBranch;
  }>;
}

export interface RuleSnapshot<T> {
  stage: RuleStageId;
  dependsOn: readonly RuleStageId[];
  ruleId: string;
  source: ValueSource;
  value: T;
}

export interface CourseSession {
  input: CourseInput;
  snapshots: Partial<Record<RuleStageId, RuleSnapshot<unknown>>>;
}

export interface CourseResult {
  lessonType: "时课排盘" | "日课排盘" | "月课排盘";
  transmissions: readonly { label: "初传" | "中传" | "末传"; value: string; relation: string; general: string }[];
  lessons: readonly { label: "四课" | "三课" | "二课" | "一课"; upper: string; lower: string; general: string }[];
  palaces: readonly { branch: EarthlyBranch; heaven: EarthlyBranch; general: string }[];
  auxiliary: Readonly<Record<string, string>>;
}
```

Create `src/domain/chart/stages.ts`:

```ts
import type { RuleStageId } from "./types";

export const RULE_STAGE_ORDER = [
  "calendar",
  "heaven-earth",
  "four-lessons",
  "three-transmissions",
  "heavenly-generals",
  "course",
] as const satisfies readonly RuleStageId[];

export const stageDependencies: Record<RuleStageId, readonly RuleStageId[]> = {
  calendar: [],
  "heaven-earth": ["calendar"],
  "four-lessons": ["heaven-earth"],
  "three-transmissions": ["four-lessons"],
  "heavenly-generals": ["calendar", "heaven-earth"],
  course: ["four-lessons", "three-transmissions", "heavenly-generals"],
};
```

- [ ] **Step 4: Run the stage-order test**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the contracts**

```powershell
git add src/domain/chart
git commit -m "feat: define rule stage contracts"
```

---

### Task 3: Validate Reviewed Snapshots and Invalidate Downstream Results

**Files:**
- Create: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Create: `src/test/reference-session.ts`

**Interfaces:**
- Consumes: `CourseSession`, `RuleSnapshot<T>`, `RuleStageId`, `RULE_STAGE_ORDER`, `stageDependencies`.
- Produces: `validateSession(session): readonly string[]` and `invalidateFrom(session, stage): CourseSession`.

- [ ] **Step 1: Add failing validation and invalidation tests**

Append to `src/domain/chart/snapshots.test.ts`:

```ts
import { invalidateFrom, validateSession } from "./snapshots";
import { referenceSession } from "../../test/reference-session";

it("rejects a snapshot whose declared dependencies are absent", () => {
  const broken = {
    ...referenceSession,
    snapshots: { "four-lessons": referenceSession.snapshots["four-lessons"] },
  };
  expect(validateSession(broken)).toContain("four-lessons 缺少依赖 heaven-earth");
});

it("removes the changed stage and every downstream stage", () => {
  const next = invalidateFrom(referenceSession, "four-lessons");
  expect(next.snapshots.calendar).toBeDefined();
  expect(next.snapshots["heaven-earth"]).toBeDefined();
  expect(next.snapshots["four-lessons"]).toBeUndefined();
  expect(next.snapshots["three-transmissions"]).toBeUndefined();
  expect(next.snapshots["heavenly-generals"]).toBeDefined();
  expect(next.snapshots.course).toBeUndefined();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: FAIL because the snapshot functions and reference fixture do not exist.

- [ ] **Step 3: Create the test-only reviewed-session fixture**

Create `src/test/reference-session.ts` with the visible values from the user-provided layout reference. Mark rule IDs as `reference-layout-only` so no test treats the values as verified traditional calculations:

```ts
import type { CourseResult, CourseSession, RuleStageId, RuleSnapshot } from "../domain/chart/types";
import { stageDependencies } from "../domain/chart/stages";

function snapshot(stage: RuleStageId, value: unknown): RuleSnapshot<unknown> {
  return { stage, dependsOn: stageDependencies[stage], ruleId: "reference-layout-only", source: "manual", value };
}

export const referenceSession: CourseSession = {
  input: {
    civilDateTime: "2026-08-14T23:57:00+08:00",
    timeZone: "Asia/Shanghai",
    locationName: "参考课式",
    longitude: 116.4074,
    latitude: 39.9042,
    corrections: {},
  },
  snapshots: {
    calendar: snapshot("calendar", { lunarDate: "丙午年七月初二", pillars: ["丙午", "丙申", "庚申", "戊子"] }),
    "heaven-earth": snapshot("heaven-earth", { centerLabel: "时课天地盘", branches: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] }),
    "four-lessons": snapshot("four-lessons", { labels: ["四课", "三课", "二课", "一课"] }),
    "three-transmissions": snapshot("three-transmissions", { labels: ["初传", "中传", "末传"] }),
    "heavenly-generals": snapshot("heavenly-generals", { count: 12 }),
    course: snapshot("course", {
      lessonType: "时课排盘",
      transmissions: [
        { label: "初传", value: "甲寅", relation: "妻财", general: "白虎" },
        { label: "中传", value: "庚申", relation: "兄弟", general: "螣蛇" },
        { label: "末传", value: "甲寅", relation: "妻财", general: "白虎" },
      ],
      lessons: [
        { label: "四课", upper: "申", lower: "寅", general: "螣蛇" },
        { label: "三课", upper: "寅", lower: "申", general: "白虎" },
        { label: "二课", upper: "申", lower: "寅", general: "螣蛇" },
        { label: "一课", upper: "寅", lower: "庚", general: "白虎" },
      ],
      palaces: [
        { branch: "巳", heaven: "亥", general: "勾陈" }, { branch: "午", heaven: "子", general: "青龙" },
        { branch: "未", heaven: "丑", general: "天空" }, { branch: "申", heaven: "寅", general: "白虎" },
        { branch: "酉", heaven: "卯", general: "太常" }, { branch: "戌", heaven: "辰", general: "玄武" },
        { branch: "亥", heaven: "巳", general: "太阴" }, { branch: "子", heaven: "午", general: "天后" },
        { branch: "丑", heaven: "未", general: "贵人" }, { branch: "寅", heaven: "申", general: "螣蛇" },
        { branch: "卯", heaven: "酉", general: "朱雀" }, { branch: "辰", heaven: "戌", general: "六合" },
      ],
      auxiliary: { 当前月将: "胜光 午", 驿马: "寅", 格局: "返吟 · 涉害" },
    } satisfies CourseResult),
  },
};
```

- [ ] **Step 4: Implement validation and invalidation**

Create `src/domain/chart/snapshots.ts`:

```ts
import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseSession, RuleStageId } from "./types";

export function validateSession(session: CourseSession): readonly string[] {
  const errors: string[] = [];
  for (const stage of RULE_STAGE_ORDER) {
    if (!session.snapshots[stage]) continue;
    for (const dependency of stageDependencies[stage]) {
      if (!session.snapshots[dependency]) errors.push(`${stage} 缺少依赖 ${dependency}`);
    }
  }
  return errors;
}

export function invalidateFrom(session: CourseSession, changed: RuleStageId): CourseSession {
  const invalid = new Set<RuleStageId>([changed]);
  for (const stage of RULE_STAGE_ORDER) {
    if (stageDependencies[stage].some((dependency) => invalid.has(dependency))) invalid.add(stage);
  }
  const snapshots = Object.fromEntries(
    Object.entries(session.snapshots).filter(([stage]) => !invalid.has(stage as RuleStageId)),
  );
  return { ...session, snapshots };
}
```

- [ ] **Step 5: Run the focused and full test suites**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit snapshot behavior**

```powershell
git add src/domain/chart src/test/reference-session.ts
git commit -m "feat: validate and invalidate rule snapshots"
```

---

### Task 4: Parse and Validate Course Input Without Calculating Rules

**Files:**
- Create: `src/features/course-input/schema.ts`
- Create: `src/features/course-input/schema.test.ts`
- Create: `src/features/course-input/CourseInputForm.tsx`
- Create: `src/features/course-input/CourseInputForm.test.tsx`

**Interfaces:**
- Consumes: `CourseInput` and `EarthlyBranch`.
- Produces: `parseCourseInput(form: FormData): CourseInput | InputErrors` and `CourseInputForm({ onSubmit })`.

- [ ] **Step 1: Write failing parser tests**

Create `src/features/course-input/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCourseInput } from "./schema";

describe("parseCourseInput", () => {
  it("rejects missing location and invalid coordinates", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "");
    form.set("longitude", "181");
    form.set("latitude", "91");
    const result = parseCourseInput(form);
    expect(result).toEqual({
      locationName: "请输入地点",
      longitude: "经度必须在 -180 到 180 之间",
      latitude: "纬度必须在 -90 到 90 之间",
    });
  });

  it("keeps manual month-general and hour corrections explicit", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "北京");
    form.set("longitude", "116.4074");
    form.set("latitude", "39.9042");
    form.set("monthGeneral", "午");
    form.set("divinationHour", "子");
    const result = parseCourseInput(form);
    expect("corrections" in result && result.corrections).toEqual({ monthGeneral: "午", divinationHour: "子" });
  });
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```powershell
npm test -- src/features/course-input/schema.test.ts
```

Expected: FAIL because `parseCourseInput` does not exist.

- [ ] **Step 3: Implement the parser with exact validation messages**

Create `src/features/course-input/schema.ts` with:

```ts
import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";

export type InputErrors = Partial<Record<"civilDateTime" | "locationName" | "longitude" | "latitude", string>>;

export function parseCourseInput(form: FormData): CourseInput | InputErrors {
  const civilDateTime = String(form.get("civilDateTime") ?? "");
  const locationName = String(form.get("locationName") ?? "").trim();
  const longitude = Number(form.get("longitude"));
  const latitude = Number(form.get("latitude"));
  const errors: InputErrors = {};
  if (!civilDateTime) errors.civilDateTime = "请输入日期与时间";
  if (!locationName) errors.locationName = "请输入地点";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = "经度必须在 -180 到 180 之间";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = "纬度必须在 -90 到 90 之间";
  if (Object.keys(errors).length) return errors;
  const monthGeneral = String(form.get("monthGeneral") ?? "") as EarthlyBranch;
  const divinationHour = String(form.get("divinationHour") ?? "") as EarthlyBranch;
  return {
    civilDateTime,
    timeZone: "Asia/Shanghai",
    locationName,
    longitude,
    latitude,
    corrections: {
      ...(monthGeneral && { monthGeneral }),
      ...(divinationHour && { divinationHour }),
    },
  };
}
```

- [ ] **Step 4: Write the failing form test**

Create `src/features/course-input/CourseInputForm.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CourseInputForm } from "./CourseInputForm";

it("shows concrete errors and does not submit invalid input", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole("button", { name: "建立起课上下文" }));
  expect(screen.getByText("请输入地点")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Implement the semantic form**

Create `CourseInputForm.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import type { CourseInput } from "../../domain/chart/types";
import { parseCourseInput, type InputErrors } from "./schema";

const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export function CourseInputForm({ onSubmit }: { onSubmit: (input: CourseInput) => void }) {
  const [errors, setErrors] = useState<InputErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseCourseInput(new FormData(event.currentTarget));
    if (!("corrections" in result)) {
      setErrors(result);
      return;
    }
    setErrors({});
    onSubmit(result);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="civilDateTime">日期与时间</label>
      <input id="civilDateTime" name="civilDateTime" type="datetime-local" aria-describedby="civilDateTime-error" />
      <p id="civilDateTime-error" role="alert">{errors.civilDateTime}</p>

      <label htmlFor="locationName">地点</label>
      <input id="locationName" name="locationName" />
      <p id="locationName-error" role="alert">{errors.locationName}</p>

      <label htmlFor="longitude">经度</label>
      <input id="longitude" name="longitude" type="number" step="any" />
      <p role="alert">{errors.longitude}</p>

      <label htmlFor="latitude">纬度</label>
      <input id="latitude" name="latitude" type="number" step="any" />
      <p role="alert">{errors.latitude}</p>

      {(["monthGeneral", "divinationHour"] as const).map((name) => (
        <label key={name}>
          {name === "monthGeneral" ? "月将" : "占时"}
          <select name={name} defaultValue="">
            <option value="">自动换算</option>
            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </label>
      ))}

      <button type="submit">建立起课上下文</button>
    </form>
  );
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm test -- src/features/course-input
npm test
git add src/features/course-input
git commit -m "feat: add course input and manual corrections"
```

Expected: all tests PASS.

---

### Task 5: Map Reviewed Snapshots to the Standard Text Course

**Files:**
- Create: `src/features/course-sheet/view-model.ts`
- Create: `src/features/course-sheet/view-model.test.ts`
- Create: `src/features/course-sheet/CourseSheet.tsx`
- Create: `src/features/course-sheet/CourseSheet.test.tsx`

**Interfaces:**
- Consumes: `CourseSession` whose snapshots have passed `validateSession`.
- Produces: `toCourseSheetModel(session): CourseSheetModel` and `CourseSheet({ model })`.

- [ ] **Step 1: Write the failing view-model test**

Create `src/features/course-sheet/view-model.test.ts`:

```ts
import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { toCourseSheetModel } from "./view-model";

it("maps the reviewed reference into the confirmed section order", () => {
  const model = toCourseSheetModel(referenceSession);
  expect(model.lessonType).toBe("时课排盘");
  expect(model.sectionOrder).toEqual(["三传格局", "四课盘局", "天地盘式", "起课辅助"]);
  expect(model.transmissions.map((item) => item.label)).toEqual(["初传", "中传", "末传"]);
  expect(model.lessons.map((item) => item.label)).toEqual(["四课", "三课", "二课", "一课"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- src/features/course-sheet/view-model.test.ts
```

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Define and implement the exact view model**

Create `view-model.ts` with:

```ts
import type { CourseResult, CourseSession } from "../../domain/chart/types";
import { validateSession } from "../../domain/chart/snapshots";

export interface CourseSheetModel {
  civilDateTime: string;
  lessonType: string;
  sectionOrder: readonly ["三传格局", "四课盘局", "天地盘式", "起课辅助"];
  transmissions: readonly { label: string; value: string; relation: string; general: string }[];
  lessons: readonly { label: string; upper: string; lower: string; general: string }[];
  palaces: readonly { branch: string; heaven: string; general: string }[];
  auxiliary: Readonly<Record<string, string>>;
}

export function toCourseSheetModel(session: CourseSession): CourseSheetModel {
  const errors = validateSession(session);
  if (errors.length) throw new Error(errors.join("；"));
  const snapshot = session.snapshots.course;
  if (!snapshot) throw new Error("缺少最终课式快照");
  const result = snapshot.value as CourseResult;
  if (!result.lessonType || result.transmissions.length !== 3 || result.lessons.length !== 4 || result.palaces.length !== 12) {
    throw new Error("最终课式快照结构无效");
  }
  return {
    civilDateTime: session.input.civilDateTime,
    lessonType: result.lessonType,
    sectionOrder: ["三传格局", "四课盘局", "天地盘式", "起课辅助"],
    transmissions: result.transmissions,
    lessons: result.lessons,
    palaces: result.palaces,
    auxiliary: result.auxiliary,
  };
}
```

- [ ] **Step 4: Write the failing component test**

Create `CourseSheet.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { toCourseSheetModel } from "./view-model";
import { CourseSheet } from "./CourseSheet";

it("renders the confirmed reference structure", () => {
  render(<CourseSheet model={toCourseSheetModel(referenceSession)} />);
  for (const heading of ["三传格局", "四课盘局", "天地盘式", "起课辅助"]) {
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect(screen.getByText("初传")).toBeVisible();
  expect(screen.getByText("四课")).toBeVisible();
});
```

- [ ] **Step 5: Implement `CourseSheet` using semantic sections**

Create `CourseSheet.tsx`:

```tsx
import type { CourseSheetModel } from "./view-model";

export function CourseSheet({ model }: { model: CourseSheetModel }) {
  return (
    <article className="course-sheet" aria-label="标准文字课式">
      <header>
        <strong>公历 · {model.civilDateTime}</strong>
        <nav aria-label="课式类型"><span aria-current="page">{model.lessonType}</span></nav>
      </header>
      <div className="course-sheet__columns">
        <div>
          <section><h2>三传格局</h2>{model.transmissions.map((item) => <p key={item.label}>{item.label}　{item.relation}　<strong>{item.value}</strong>　{item.general}</p>)}</section>
          <section><h2>四课盘局</h2><div className="course-sheet__lessons">{model.lessons.map((item) => <div key={item.label}><span>{item.label} · {item.general}</span><strong>{item.upper}<i />{item.lower}</strong></div>)}</div></section>
        </div>
        <div>
          <section><h2>天地盘式</h2><div className="course-sheet__palaces">{model.palaces.map((item) => <div key={item.branch}><span>{item.general}</span><strong>{item.heaven}</strong><small>{item.branch}</small></div>)}</div></section>
          <section><h2>起课辅助</h2>{Object.entries(model.auxiliary).map(([label, value]) => <p key={label}><span>{label}</span>　{value}</p>)}</section>
        </div>
      </div>
    </article>
  );
}
```

Append this scoped CSS to `global.css`:

```css
.course-sheet { padding: 24px; background: var(--ash); color: var(--ink); }
.course-sheet header { padding-bottom: 16px; border-bottom: 1px solid var(--ru-celadon); }
.course-sheet__columns { display: grid; grid-template-columns: 1fr 1.05fr; gap: 24px; }
.course-sheet section { margin-top: 20px; }
.course-sheet h2 { padding-left: 10px; border-left: 3px solid var(--patina); font-size: 1.05rem; }
.course-sheet__lessons, .course-sheet__palaces { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.course-sheet__lessons > div, .course-sheet__palaces > div { padding: 10px; border: 1px solid var(--ru-celadon); text-align: center; }
.course-sheet__lessons span, .course-sheet__palaces span { display: block; }
.course-sheet__lessons strong, .course-sheet__palaces strong { display: block; margin-top: 6px; font-size: 1.25rem; }
.course-sheet__lessons i { display: block; width: 60%; margin: 4px auto; border-top: 1px solid var(--ru-celadon); }
@media (max-width: 820px) {
  .course-sheet__columns { grid-template-columns: 1fr; }
  .course-sheet__lessons, .course-sheet__palaces { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

Do not add three-dimensional placeholder graphics, decorative icons, or unapproved visible copy.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm test -- src/features/course-sheet
npm test
git add src/features/course-sheet
git commit -m "feat: render confirmed text course structure"
```

Expected: all tests PASS.

---

### Task 6: Assemble the Rule-Review Application Shell

**Files:**
- Create: `src/features/rule-review/RuleStageRail.tsx`
- Create: `src/features/rule-review/RuleStageRail.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `RULE_STAGE_ORDER`, `CourseInputForm`, and `CourseSession`.
- Produces: a desktop-first shell with left input, central stage status, and right rule rail; the shell has no fabricated course or model state.

- [ ] **Step 1: Write the failing rule-rail test**

Create `RuleStageRail.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RuleStageRail } from "./RuleStageRail";

it("labels reviewed, current, and locked stages without approval controls", () => {
  render(<RuleStageRail completed={["calendar"]} current="heaven-earth" />);
  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "completed");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "current");
  expect(screen.queryByRole("button", { name: /审核|批准/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm test -- src/features/rule-review/RuleStageRail.test.tsx
```

Expected: FAIL because `RuleStageRail` does not exist.

- [ ] **Step 3: Implement the read-only rule rail**

```tsx
import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { RuleStageId } from "../../domain/chart/types";

const labels = {
  calendar: "历法与月将",
  "heaven-earth": "天地盘加临",
  "four-lessons": "四课生成",
  "three-transmissions": "三传取法",
  "heavenly-generals": "天将布列",
  course: "复制结课",
} as const;

export function RuleStageRail({ completed, current }: { completed: readonly RuleStageId[]; current: RuleStageId }) {
  return (
    <ol aria-label="传统规则阶段">
      {RULE_STAGE_ORDER.map((stage) => {
        const status = completed.includes(stage) ? "completed" : stage === current ? "current" : "locked";
        return <li key={stage}><span data-status={status}>{labels[stage]}</span></li>;
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Write the failing application-state test**

Replace the existing `App.test.tsx` content with tests that verify:

```tsx
it("starts at input without a fake model or fake course", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
  expect(screen.getByRole("button", { name: "建立起课上下文" })).toBeVisible();
  expect(screen.queryByLabelText("标准文字课式")).not.toBeInTheDocument();
  expect(screen.queryByText(/三维模型占位/)).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Assemble `App`**

Replace `src/app/App.tsx` with:

```tsx
import { useState } from "react";
import type { CourseSession } from "../domain/chart/types";
import { CourseInputForm } from "../features/course-input/CourseInputForm";
import { RuleStageRail } from "../features/rule-review/RuleStageRail";
import "../styles/tokens.css";
import "../styles/global.css";

export function App() {
  const [session, setSession] = useState<CourseSession | null>(null);
  const [inputOpen, setInputOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);

  return (
    <main className="app-shell">
      <header className="app-header"><h1>大六壬演式</h1></header>
      <div className="app-workspace">
        <aside>
          <button type="button" aria-expanded={inputOpen} onClick={() => setInputOpen((value) => !value)}>起课输入</button>
          {inputOpen && <CourseInputForm onSubmit={(input) => setSession({ input, snapshots: {} })} />}
        </aside>
        <section aria-live="polite">
          <h2>{session ? "规则确认" : "起课输入"}</h2>
          <p>{session ? "下一步：确认历法与月将规则" : "输入时间与地点，建立可追溯的起课上下文。"}</p>
        </section>
        <aside>
          <button type="button" aria-expanded={railOpen} onClick={() => setRailOpen((value) => !value)}>推演依据</button>
          {railOpen && <RuleStageRail completed={[]} current="calendar" />}
        </aside>
      </div>
    </main>
  );
}
```

Do not calculate or render fake results. The course sheet remains absent until a complete reviewed session exists in the later rule-engine plan.

- [ ] **Step 6: Run tests, build, and commit**

Run:

```powershell
npm test
npm run build
git add src/app src/features/rule-review src/styles/global.css
git commit -m "feat: assemble rule review shell"
```

Expected: all tests PASS and production build succeeds.

---

### Task 7: Verify Responsive Behavior and Keyboard Navigation

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/app-shell.spec.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the assembled application shell.
- Produces: automated desktop and mobile smoke coverage at 1440×900 and 390×844.

- [ ] **Step 1: Install the Chromium test browser**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
```

Run:

```powershell
npx playwright install chromium
```

Expected: Chromium installs successfully.

- [ ] **Step 2: Write failing desktop and mobile E2E tests**

Create `tests/app-shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} shell is readable without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);
  });
}

test("keyboard users can reach every visible control", async ({ page }) => {
  await page.goto("/");
  const labels: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    labels.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute("aria-label") ?? (document.activeElement as HTMLElement)?.innerText ?? ""));
  }
  expect(labels.some((label) => label.includes("建立起课上下文"))).toBe(true);
});
```

- [ ] **Step 3: Run E2E tests to expose layout failures**

Run:

```powershell
npx playwright test
```

Expected before responsive CSS is complete: at least the mobile overflow test FAILS.

- [ ] **Step 4: Implement exact responsive behavior**

Append to `global.css`:

```css
.app-workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr) 260px; gap: 20px; }
.app-workspace > * { min-width: 0; }
.app-workspace input, .app-workspace select, .app-workspace button { width: 100%; min-height: 44px; }
.app-workspace p, .app-workspace li, .app-workspace strong { overflow-wrap: anywhere; }
@media (max-width: 1023px) {
  .app-workspace { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .app-shell { padding: 16px; }
  .app-workspace { gap: 14px; }
  .course-sheet { padding: 16px; }
}
```

Preserve the existing browser focus rule. Do not set `outline: none` or hide overflow on `html`, `body`, forms, or course content.

- [ ] **Step 5: Run the complete verification set**

Run:

```powershell
npm test
npm run build
npx playwright test
```

Expected: unit tests PASS, build succeeds, and all Playwright tests PASS at both viewports.

- [ ] **Step 6: Commit the verified phase-one deliverable**

```powershell
git add playwright.config.ts tests src/styles/global.css
git commit -m "test: verify responsive rule shell"
```

---

## Phase-One Completion Gate

Do not begin the traditional-rule implementation plan until all conditions hold:

- `npm test`, `npm run build`, and `npx playwright test` pass.
- A valid input creates a `CourseSession` with no fabricated snapshots.
- Manual corrections remain explicit in `CourseInput.corrections`.
- Changing a reviewed stage invalidates it and every downstream snapshot.
- The text-course component renders only a test-only `reference-layout-only` session or a future real-rule view model.
- The application contains no three-dimensional placeholder, invented motion, or fake production course.

The next plan starts with the first user-reviewed traditional rule case for “历法与月将” and implements that module against its exact expected values.
