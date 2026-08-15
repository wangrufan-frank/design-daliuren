# 天地盘加临 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从有效历法快照计算显式十二宫天地盘快照，并交付可切换阶段、可逐宫审校的响应式十二宫方盘。

**Architecture:** 新增独立 `heaven-earth` 领域模块，领域层展开并校验十二宫映射，快照作为二维界面和后续四课的唯一事实来源。React 组件只负责传统方位映射、选中宫位和证据展示；`App` 串联历法与天地盘，并通过阶段轨切换已完成阶段。

**Tech Stack:** TypeScript 5.9、React 19、Vitest 3、Testing Library、Playwright 1.62、现有 CSS token 系统；不新增运行时或开发依赖。

## Global Constraints

- 规则固定为“月将加临占时”，天盘与地盘按相同十二支顺序顺布；不支持逆布或门派变体。
- 天地盘不接受独立人工修正；只响应上游月将或占时的有效值变化。
- 十二宫快照必须显式保存全部 `{ earth, heaven }` 映射，界面不得重新排盘。
- 方盘固定上南下北、左东右西；大字为天盘支，小字为地盘支。
- 结果直接静态呈现，不增加旋转动画、时间轴、四课、三传或天将。
- 任何失败都不生成部分快照，也不保留过期天地盘。
- 移动端不得产生横向滚动，证据使用底部审校区，并提供双行文字对照。

---

## File Map

- Create `src/domain/heaven-earth/types.ts`: 天地盘结果、证据、错误和运行结果类型。
- Create `src/domain/heaven-earth/policy.ts`: 纯函数计算转位数、十二宫映射和证据。
- Create `src/domain/heaven-earth/policy.test.ts`: 三类规则案例与 144 组性质测试。
- Create `src/domain/heaven-earth/result-guard.ts`: 天地盘结果运行时校验、规则编号和来源推导。
- Create `src/domain/heaven-earth/compute-heaven-earth.ts`: 从历法快照计算并写入天地盘快照。
- Create `src/domain/heaven-earth/compute-heaven-earth.test.ts`: 错误、快照元数据和失效传播测试。
- Modify `src/domain/chart/snapshots.ts`: 在会话校验中验证真实天地盘快照。
- Modify `src/domain/chart/snapshots.test.ts`: 覆盖伪造天地盘快照。
- Modify `src/test/reference-session.ts`: 用真实结构替换布局占位天地盘快照。
- Create `docs/rule-cases/heaven-earth-v1.md`: 固化同支、相冲、普通错位案例。
- Create `src/features/heaven-earth-review/HeavenEarthReview.tsx`: 十二宫方盘、逐宫证据、键盘与移动端审校行为。
- Create `src/features/heaven-earth-review/HeavenEarthReview.test.tsx`: 结构、方位、证据和可访问性组件测试。
- Modify `src/features/rule-review/RuleStageRail.tsx`: 已完成阶段成为可切换按钮。
- Modify `src/features/rule-review/RuleStageRail.test.tsx`: 导航状态和锁定状态测试。
- Modify `src/app/App.tsx`: 串联两阶段、处理重算、错误和当前审校视图。
- Modify `src/app/App.test.tsx`: 两阶段真实流程、返回修正和失败回退测试。
- Modify `src/styles/global.css`: 方盘、证据、状态强调与响应式布局。
- Modify `e2e/app-shell.spec.ts`: 现有历法流程先通过阶段轨返回历法页，并移除“天地盘未实现”断言。
- Create `e2e/heaven-earth.spec.ts`: 桌面/移动、离线、键盘和无溢出浏览器验收。

---

### Task 1: 天地盘纯领域规则

**Files:**
- Create: `src/domain/heaven-earth/types.ts`
- Create: `src/domain/heaven-earth/policy.ts`
- Create: `src/domain/heaven-earth/policy.test.ts`
- Create: `docs/rule-cases/heaven-earth-v1.md`

**Interfaces:**
- Consumes: `CalendarResult`、`EarthlyBranch`、`MonthGeneralName`、`ValueSource`。
- Produces: `deriveHeavenEarth(calendar: CalendarResult): HeavenEarthResult`。

- [ ] **Step 1: 写入结果和错误类型**

```ts
export interface HeavenEarthInputValue {
  branch: EarthlyBranch;
  source: ValueSource;
}

export interface HeavenEarthResult {
  monthGeneral: HeavenEarthInputValue & { name: MonthGeneralName };
  divinationHour: HeavenEarthInputValue;
  offset: number;
  palaces: readonly { earth: EarthlyBranch; heaven: EarthlyBranch }[];
  evidence: readonly {
    ruleId: string;
    field: "plate" | `palace.${EarthlyBranch}`;
    input: string;
    conclusion: string;
  }[];
}

export type HeavenEarthErrorCode =
  | "INVALID_HEAVEN_EARTH_INPUT"
  | "HEAVEN_EARTH_RESULT_INCOMPLETE";

export type HeavenEarthSnapshot = RuleSnapshot<HeavenEarthResult, "heaven-earth">;

export type HeavenEarthOutcome =
  | { ok: true; value: HeavenEarthResult; snapshot: HeavenEarthSnapshot }
  | { ok: false; error: { code: HeavenEarthErrorCode; message: string; cause?: unknown } };

export type HeavenEarthStageOutcome =
  | { ok: true; value: HeavenEarthResult; session: CourseSession }
  | { ok: false; error: { code: HeavenEarthErrorCode; message: string; cause?: unknown } };
```

- [ ] **Step 2: 写失败测试，锁定三类案例**

```ts
function calendarFixture(general: EarthlyBranch, hour: EarthlyBranch): CalendarResult {
  const base = structuredClone(referenceSession.snapshots.calendar!.value);
  return {
    ...base,
    monthGeneral: {
      automatic: { name: "胜光", branch: general },
      effective: { name: "胜光", branch: general },
      source: "automatic",
    },
    divinationHour: { automatic: hour, effective: hour, source: "automatic" },
  };
}

it.each([
  { general: "子", hour: "子", offset: 0 },
  { general: "午", hour: "子", offset: 6 },
  { general: "子", hour: "未", offset: 5 },
] as const)("places $general over $hour", ({ general, hour, offset }) => {
  const result = deriveHeavenEarth(calendarFixture(general, hour));
  expect(result.offset).toBe(offset);
  expect(result.palaces.find(({ earth }) => earth === hour)?.heaven).toBe(general);
});
```

- [ ] **Step 3: 运行规则测试并确认失败**

Run: `npm test -- src/domain/heaven-earth/policy.test.ts`

Expected: FAIL，因为 `deriveHeavenEarth` 尚不存在。

- [ ] **Step 4: 实现最小顺布算法和证据**

```ts
export const HEAVEN_EARTH_RULE_ID = "heaven-earth/month-general-over-hour-v1";

export function deriveHeavenEarth(calendar: CalendarResult): HeavenEarthResult {
  const monthGeneral = calendar.monthGeneral.effective;
  const hour = calendar.divinationHour.effective;
  const generalIndex = EARTHLY_BRANCHES.indexOf(monthGeneral.branch);
  const hourIndex = EARTHLY_BRANCHES.indexOf(hour);
  const offset = (generalIndex - hourIndex + 12) % 12;
  const palaces = EARTHLY_BRANCHES.map((earth, earthIndex) => ({
    earth,
    heaven: EARTHLY_BRANCHES[(earthIndex + offset) % 12],
  }));
  const evidence = [
    {
      ruleId: HEAVEN_EARTH_RULE_ID,
      field: "plate" as const,
      input: `月将 ${monthGeneral.branch}，占时 ${hour}`,
      conclusion: `月将加临占时，天盘顺布，转位数 ${offset}`,
    },
    ...palaces.map(({ earth, heaven }, earthIndex) => ({
      ruleId: HEAVEN_EARTH_RULE_ID,
      field: `palace.${earth}` as const,
      input: `从占时宫按十二支顺序检查地盘 ${earth}，顺布距离 ${(earthIndex - hourIndex + 12) % 12}`,
      conclusion: `天盘${heaven}加临地盘${earth}`,
    })),
  ];
  return {
    monthGeneral: { ...monthGeneral, source: calendar.monthGeneral.source },
    divinationHour: { branch: hour, source: calendar.divinationHour.source },
    offset,
    palaces,
    evidence,
  };
}
```

- [ ] **Step 5: 增加 144 组性质测试**

```ts
for (const general of EARTHLY_BRANCHES) {
  for (const hour of EARTHLY_BRANCHES) {
    const result = deriveHeavenEarth(calendarFixture(general, hour));
    expect(result.palaces).toHaveLength(12);
    expect(new Set(result.palaces.map(({ earth }) => earth)).size).toBe(12);
    expect(new Set(result.palaces.map(({ heaven }) => heaven)).size).toBe(12);
    expect(result.palaces.find(({ earth }) => earth === hour)?.heaven).toBe(general);
  }
}
```

- [ ] **Step 6: 固化规则案例文档并运行测试**

在 `docs/rule-cases/heaven-earth-v1.md` 写明公式、传统方位，以及同支、午临子、子临未三组完整预期。普通错位案例明确列出全部十二宫映射。

Run: `npm test -- src/domain/heaven-earth/policy.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交纯规则**

```bash
git add src/domain/heaven-earth docs/rule-cases/heaven-earth-v1.md
git commit -m "feat: derive heaven earth plate"
```

---

### Task 2: 结果校验、快照和失效传播

**Files:**
- Create: `src/domain/heaven-earth/result-guard.ts`
- Create: `src/domain/heaven-earth/compute-heaven-earth.ts`
- Create: `src/domain/heaven-earth/compute-heaven-earth.test.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`

**Interfaces:**
- Consumes: `deriveHeavenEarth(calendar)`、`CalendarSnapshot`、`CourseSession`、`invalidateFrom`。
- Produces: `isHeavenEarthResult(value)`、`computeHeavenEarth(calendarSnapshot)`、`runHeavenEarthStage(session)`。

- [ ] **Step 1: 写快照成功、缺失依赖和非法结果测试**

```ts
it("creates a complete snapshot from calendar", () => {
  const outcome = computeHeavenEarth(referenceSession.snapshots.calendar);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) return;
  expect(outcome.snapshot).toMatchObject({
    stage: "heaven-earth",
    dependsOn: ["calendar"],
    ruleId: "heaven-earth/month-general-over-hour-v1",
    source: "automatic",
  });
  expect(outcome.value.palaces).toHaveLength(12);
});

it("rejects a missing calendar snapshot", () => {
  expect(computeHeavenEarth(undefined)).toEqual({
    ok: false,
    error: { code: "INVALID_HEAVEN_EARTH_INPUT", message: "缺少有效的历法与月将快照" },
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/domain/heaven-earth/compute-heaven-earth.test.ts`

Expected: FAIL，因为快照编排尚不存在。

- [ ] **Step 3: 实现运行时守卫和来源推导**

`isHeavenEarthResult` 必须验证：`offset` 为 `0..11` 整数、`palaces.length === 12`、天地两组各自无重复、每个值是合法地支、月将落在占时宫、证据包含整盘和十二宫字段。

```ts
export const HEAVEN_EARTH_SNAPSHOT_RULE_ID = HEAVEN_EARTH_RULE_ID;

export function heavenEarthResultSource(value: HeavenEarthResult): ValueSource {
  return value.monthGeneral.source === "manual" || value.divinationHour.source === "manual"
    ? "manual"
    : "automatic";
}
```

- [ ] **Step 4: 实现阶段计算和会话写入**

```ts
export function computeHeavenEarth(calendar?: CalendarSnapshot): HeavenEarthOutcome {
  if (!calendar || !isCalendarResult(calendar.value)) {
    return {
      ok: false,
      error: { code: "INVALID_HEAVEN_EARTH_INPUT", message: "缺少有效的历法与月将快照" },
    };
  }
  try {
    const value = deriveHeavenEarth(calendar.value);
    if (!isHeavenEarthResult(value)) {
      return {
        ok: false,
        error: { code: "HEAVEN_EARTH_RESULT_INCOMPLETE", message: "天地盘结果不完整" },
      };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "heaven-earth",
        dependsOn: ["calendar"],
        ruleId: HEAVEN_EARTH_SNAPSHOT_RULE_ID,
        source: heavenEarthResultSource(value),
        value,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: { code: "HEAVEN_EARTH_RESULT_INCOMPLETE", message: "天地盘结果不完整", cause },
    };
  }
}

export function runHeavenEarthStage(session: CourseSession): HeavenEarthStageOutcome {
  const outcome = computeHeavenEarth(session.snapshots.calendar);
  if (!outcome.ok) return outcome;
  const invalidated = invalidateFrom(session, "heaven-earth");
  return {
    ok: true,
    value: outcome.value,
    session: {
      ...invalidated,
      snapshots: { ...invalidated.snapshots, "heaven-earth": outcome.snapshot },
    },
  };
}
```

- [ ] **Step 5: 将天地盘守卫接入会话校验**

在 `validateSession` 的 `stage === "heaven-earth"` 分支验证结果、规则编号和来源；保留现有统一依赖校验。把 `referenceSession` 中的布局占位值替换为真实十二宫、输入来源和证据。

- [ ] **Step 6: 运行领域和快照测试**

Run: `npm test -- src/domain/heaven-earth src/domain/chart/snapshots.test.ts`

Expected: PASS；伪造规则编号、重复天盘支、错误来源和缺少 calendar 依赖均被拒绝。

- [ ] **Step 7: 提交快照链路**

```bash
git add src/domain/heaven-earth src/domain/chart/snapshots.ts src/domain/chart/snapshots.test.ts src/test/reference-session.ts
git commit -m "feat: compose heaven earth snapshot"
```

---

### Task 3: 十二宫二维审校组件

**Files:**
- Create: `src/features/heaven-earth-review/HeavenEarthReview.tsx`
- Create: `src/features/heaven-earth-review/HeavenEarthReview.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `result: HeavenEarthResult`。
- Produces: `<HeavenEarthReview result={result} />`，不暴露修正回调，不执行排盘。

- [ ] **Step 1: 写传统方位和内容测试**

```tsx
const calendar = referenceSession.snapshots.calendar!.value;
render(<HeavenEarthReview result={deriveHeavenEarth(calendar)} />);
const plate = screen.getByRole("list", { name: "天地盘十二宫" });
expect(within(plate).getAllByRole("listitem")).toHaveLength(12);
expect(within(plate).getByRole("button", {
  name: "天盘午加临地盘子，占时宫",
})).toBeVisible();
expect(screen.getByText("上南 · 下北 · 左东 · 右西")).toBeVisible();
```

- [ ] **Step 2: 写选宫、证据和键盘失败测试**

```tsx
const palace = screen.getByRole("button", { name: /天盘亥加临地盘巳/ });
await userEvent.click(palace);
expect(screen.getByRole("heading", { name: "巳宫证据" })).toBeVisible();
expect(screen.getByText("heaven-earth/month-general-over-hour-v1")).toBeVisible();
await userEvent.keyboard("{ArrowRight}");
expect(screen.getByRole("button", { name: /地盘午/ })).toHaveFocus();
```

- [ ] **Step 3: 运行组件测试并确认失败**

Run: `npm test -- src/features/heaven-earth-review/HeavenEarthReview.test.tsx`

Expected: FAIL，因为组件尚不存在。

- [ ] **Step 4: 实现只读方盘和证据选择**

视觉顺序固定为：

```ts
const VISUAL_EARTH_ORDER = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;
```

组件从 `result.palaces` 建立只读查找表，再按视觉顺序渲染十二个按钮。按钮使用 `data-month-general`、`data-divination-hour` 和 `aria-pressed` 表达三个独立状态；大字和小字都来自快照。

- [ ] **Step 5: 实现键盘与移动证据收合**

外围顺序中 `ArrowRight`/`ArrowDown` 前进，`ArrowLeft`/`ArrowUp` 后退并循环；关闭移动证据后用保存的按钮 ref 恢复焦点。所有证据文本从 `result.evidence` 按 `palace.${earth}` 过滤。

- [ ] **Step 6: 添加方盘样式和响应式降级**

使用现有 `--ink`、`--dark-bronze`、`--patina`、`--ru-celadon`、`--old-gold`、`--ash`。四边宫位用 CSS Grid 明确指定；中心摘要占 `grid-column: 2 / 4; grid-row: 2 / 4`。在 `max-width: 820px` 下保持 `aspect-ratio: 1`、证据转为底部区块、显示双行文字对照；不得使用横向滚动容器。

- [ ] **Step 7: 运行组件测试和构建**

Run: `npm test -- src/features/heaven-earth-review/HeavenEarthReview.test.tsx && npm run build`

Expected: PASS；TypeScript 构建无错误。

- [ ] **Step 8: 提交审校组件**

```bash
git add src/features/heaven-earth-review src/styles/global.css
git commit -m "feat: render heaven earth review plate"
```

---

### Task 4: 阶段轨导航与两阶段应用编排

**Files:**
- Modify: `src/features/rule-review/RuleStageRail.tsx`
- Modify: `src/features/rule-review/RuleStageRail.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `runCalendarStage`、`runHeavenEarthStage`、`isHeavenEarthResult`、`HeavenEarthReview`。
- Produces: `RuleStageRail` 新属性 `selected?: RuleStageId`、`onSelect?: (stage: RuleStageId) => void`；`App` 自动形成第二阶段并允许返回历法审校。

- [ ] **Step 1: 写阶段轨导航失败测试**

```tsx
const onSelect = vi.fn();
render(
  <RuleStageRail
    completed={["calendar", "heaven-earth"]}
    current="four-lessons"
    selected="heaven-earth"
    onSelect={onSelect}
  />,
);
await userEvent.click(screen.getByRole("button", { name: /历法与月将，已完成/ }));
expect(onSelect).toHaveBeenCalledWith("calendar");
expect(screen.queryByRole("button", { name: /四课生成/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: 实现最小阶段轨导航**

已有快照的阶段渲染为按钮；锁定阶段继续渲染为文本。选中审校页使用 `aria-current="page"`；规则链当前阶段仍由 `data-status="current"` 表达，避免把未完成阶段伪装成可点击页。

- [ ] **Step 3: 写应用串联失败测试**

```tsx
const user = await submitCourse();
expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
await user.click(screen.getByRole("button", { name: /历法与月将，已完成/ }));
await user.click(screen.getByRole("button", { name: /月将.*自动计算/ }));
await user.selectOptions(screen.getByRole("combobox", { name: "修正月将" }), "亥");
expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
expect(screen.getByText(/登明.*亥.*加临.*未/)).toBeVisible();
```

- [ ] **Step 4: 实现两阶段编排**

`replaceFrom` 先运行历法，再运行天地盘：

```ts
const calendarOutcome = runCalendarStage(nextSession, calendarAdapter);
if (!calendarOutcome.ok) {
  setReviewStage("calendar");
  setStageError(calendarOutcome.error);
  return;
}
const plateOutcome = runHeavenEarthStage(calendarOutcome.session);
if (!plateOutcome.ok) {
  setSession(calendarOutcome.session);
  setReviewStage("calendar");
  setStageError(plateOutcome.error);
  return;
}
setSession(plateOutcome.session);
setReviewStage("heaven-earth");
setStageError(null);
```

中心区域根据 `reviewStage` 渲染 `CalendarReview` 或 `HeavenEarthReview`。完成数组从真实快照推导；两个快照存在时规则链 `current` 为 `four-lessons`，但四课仍锁定不可点击。

- [ ] **Step 5: 覆盖失败回退和无独立修正**

测试天地盘错误时保留最新有效 calendar、停留历法视图并显示中文错误；确认天地盘页面不存在 select、拖动、旋转、批准或逐宫修正控件。

- [ ] **Step 6: 运行应用与阶段轨测试**

Run: `npm test -- src/features/rule-review/RuleStageRail.test.tsx src/app/App.test.tsx`

Expected: PASS；原历法修正和错误清理测试继续通过。

- [ ] **Step 7: 提交应用编排**

```bash
git add src/features/rule-review src/app
git commit -m "feat: navigate calendar and heaven earth stages"
```

---

### Task 5: 浏览器验收与全量交付验证

**Files:**
- Modify: `e2e/app-shell.spec.ts`
- Create: `e2e/heaven-earth.spec.ts`

**Interfaces:**
- Consumes: 完整应用 UI。
- Produces: 桌面和移动端可重复的端到端验收证据。

- [ ] **Step 1: 更新现有历法端到端流程**

提交输入后先断言天地盘出现，再点击阶段轨“历法与月将”按钮进入原历法断言。仅从 `expectNoUnimplementedResult` 中移除“天地盘加临”；四课、三传、天将、复制结课和三维占位仍必须不存在。

- [ ] **Step 2: 写天地盘端到端失败测试**

```ts
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function submitOrdinaryInput(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(page.viewportSize()!.width);
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} reviews the real heaven earth plate`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await submitOrdinaryInput(page);
    const plate = page.getByRole("list", { name: "天地盘十二宫" });
    await expect(plate.getByRole("button")).toHaveCount(12);
    await expect(plate.getByRole("button", { name: /天盘子加临地盘未/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
```

- [ ] **Step 3: 增加交互、离线和移动断言**

覆盖：逐宫证据、箭头键循环、月将与占时状态不只靠颜色、阶段轨返回历法并修正后自动回到新天地盘、离线计算无非本地网络请求、移动证据关闭后焦点恢复、双行文字对照可见、页面无横向溢出。

- [ ] **Step 4: 运行端到端测试并修正测试暴露的问题**

Run: `npm run test:e2e`

Expected: 桌面与移动用例全部 PASS；不通过时只修改与天地盘交付直接相关的代码或测试。

- [ ] **Step 5: 运行完整验证**

Run: `npm test`

Expected: 全部 Vitest 测试 PASS。

Run: `npm run build`

Expected: TypeScript project references 与 Vite production build 均成功。

Run: `npm run test:e2e`

Expected: 全部 Playwright 测试 PASS。

Run: `git diff --check`

Expected: 无空白错误。

- [ ] **Step 6: 提交浏览器验收**

```bash
git add e2e/app-shell.spec.ts e2e/heaven-earth.spec.ts
git commit -m "test: verify heaven earth review flow"
```

- [ ] **Step 7: 对照设计做最终范围检查**

确认交付仅包含：天地盘领域规则、快照、十二宫静态审校、阶段返回导航和相关测试；没有四课、三传、天将、三维资源、动画或天地盘人工修正。
