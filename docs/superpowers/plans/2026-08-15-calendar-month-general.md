# Calendar and Month-General Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real traditional-rule stage: deterministic Beijing-time calendar conversion, four pillars, solar-term boundaries, month build, month general, divination hour, manual corrections, reviewed snapshots, and the confirmed calendar-matrix audit UI.

**Architecture:** Wrap `lunar-typescript` behind a narrow `CalendarAdapter` that returns only lunar and solar-term primitives. Keep every result-changing decision in project-owned pure policy functions, then overlay corrections and compose a typed `calendar` snapshot. The application renders the snapshot through a dense matrix and evidence panel; no runtime network call and no downstream Liu Ren calculation is added.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest, Testing Library, Playwright, `lunar-typescript@1.8.6`; `astronomy-engine@2.1.19` is development-only for independent solar-term checks.

## Global Constraints

- Interpret every input as fixed UTC+8 Beijing time; do not apply historical `Asia/Shanghai` daylight-saving offsets and do not calculate true solar time.
- Accept second-level `datetime-local` values; normalize minute-only values by appending `:00`.
- Support inputs from `1900-01-01T00:00:00` through `2100-12-31T23:59:59`; outside the range, return `OUT_OF_SUPPORTED_RANGE` and create no snapshot.
- The lunar date changes at 00:00; the Ganzhi day changes at 23:00; 23:00–00:59 is the Zi double-hour.
- Change the year pillar at the exact Li Chun instant, the month pillar at exact Jie instants, and the month general at exact Zhongqi instants. Equality belongs to the new interval.
- Keep automatic and effective values together. A manual correction never destroys the automatic value and can be reset.
- Runtime code is offline. Independent ephemeris checks are development-only and must not be imported by the application bundle.
- Do not calculate or render heaven-earth, four-lessons, three-transmissions, heavenly-generals, a final course, or 3D placeholders.
- Do not add approval buttons or a formal review workflow. Only checks that can change rule correctness or user access belong in the product or test suite.
- Preserve the confirmed cool Song-style and bronze palette; use only existing visual tokens unless this plan explicitly adds a semantic alias.
- Install npm packages through the working proxy when required: set `HTTP_PROXY` and `HTTPS_PROXY` to `http://127.0.0.1:7891` in the same PowerShell process. Do not commit `.npmrc`.

---

## Scope Decomposition

1. Lock independently checked rule cases and stop for user review.
2. Define calendar vocabulary and fixed-UTC+8 time parsing.
3. Implement the third-party calendar adapter.
4. Implement project-owned traditional calendar policy.
5. Apply corrections and compose a reviewed snapshot.
6. Render the confirmed calendar matrix and evidence panel.
7. Integrate calculation and correction flow into the application.
8. Verify desktop, mobile, keyboard, and offline production behavior.

## File Structure

### Domain

- Create `src/domain/calendar/types.ts` — calendar results, boundaries, evidence, errors, and adapter interfaces.
- Create `src/domain/calendar/constants.ts` — stems, branches, Jiazi, Jie/month-build, Zhongqi/month-general, and rule IDs.
- Create `src/domain/calendar/beijing-time.ts` — strict parsing and comparison for fixed UTC+8 wall-clock values.
- Create `src/domain/calendar/policy.ts` — pure traditional boundary and pillar calculations.
- Create `src/domain/calendar/corrections.ts` — correction validation and automatic/effective overlay.
- Create `src/domain/calendar/compute-calendar.ts` — adapter orchestration, error conversion, and `calendar` snapshot composition.
- Modify `src/domain/chart/types.ts` — use valid `StemBranch` corrections and give the calendar snapshot a concrete value type.
- Modify `src/domain/chart/snapshots.ts` — reject malformed calendar snapshot values.

### Adapter

- Create `src/adapters/calendar/lunar-typescript-adapter.ts` — the only production import of `lunar-typescript`.
- Create `scripts/verify-calendar-cases.mjs` — development-only comparison with Astronomy Engine.

### Input and UI

- Modify `src/features/course-input/schema.ts` — seconds and range validation.
- Modify `src/features/course-input/CourseInputForm.tsx` — second-level input; corrections move to the result matrix.
- Create `src/features/calendar-review/CalendarReview.tsx` — eight-cell matrix, active evidence, correction controls, and reset.
- Modify `src/app/App.tsx` — compute and update the calendar snapshot.
- Modify `src/styles/tokens.css` — accessible bronze-gold correction accent.
- Modify `src/styles/global.css` — confirmed matrix, evidence rail, mobile bottom section, and source states.
- Modify `e2e/app-shell.spec.ts` — real calculation, correction, responsive, and keyboard coverage.

### Evidence and Tests

- Create `docs/rule-cases/calendar-v1.md` — human-readable provenance and expected values.
- Create `src/test/calendar-cases.ts` — locked machine-readable fixtures.
- Create focused tests beside every domain, adapter, form, and UI file.

---

### Task 1: Lock the User-Reviewed Calendar Cases

**Files:**
- Create: `docs/rule-cases/calendar-v1.md`
- Create: `src/test/calendar-cases.ts`
- Create: `src/test/calendar-cases.test.ts`

**Interfaces:**
- Consumes: confirmed rule choices from `docs/superpowers/specs/2026-08-15-calendar-month-general-design.md`.
- Produces: `ordinaryCalendarCase`, `ziInitialCases`, `termBoundaryCases`, and `solarTermCrossChecks` used by Tasks 3–5.

- [ ] **Step 1: Write the locked fixture data**

Create `src/test/calendar-cases.ts`:

```ts
export const ordinaryCalendarCase = {
  input: "2024-02-10T14:30:00",
  expected: {
    lunarDisplay: "二〇二四年正月初一",
    effectiveGanzhiDate: "2024-02-10",
    pillars: { year: "甲辰", month: "丙寅", day: "甲辰", hour: "辛未" },
    monthBuild: "寅",
    monthGeneral: { name: "神后", branch: "子" },
    divinationHour: "未",
  },
} as const;

export const ziInitialCases = [
  {
    input: "2026-08-14T22:59:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-14", day: "庚申", hour: "丁亥", divinationHour: "亥" },
  },
  {
    input: "2026-08-14T23:00:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-15", day: "辛酉", hour: "戊子", divinationHour: "子" },
  },
  {
    input: "2026-08-14T23:01:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-15", day: "辛酉", hour: "戊子", divinationHour: "子" },
  },
] as const;

export const termBoundaryCases = [
  { input: "2024-02-04T16:27:06", expected: { year: "癸卯", month: "乙丑", previousJie: "小寒" } },
  { input: "2024-02-04T16:27:07", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-02-04T16:27:08", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-03-05T10:22:44", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-03-05T10:22:45", expected: { year: "甲辰", month: "丁卯", previousJie: "惊蛰" } },
  { input: "2024-03-05T10:22:46", expected: { year: "甲辰", month: "丁卯", previousJie: "惊蛰" } },
  { input: "2024-02-19T12:13:11", expected: { monthGeneral: { name: "神后", branch: "子" }, previousZhongQi: "大寒" } },
  { input: "2024-02-19T12:13:12", expected: { monthGeneral: { name: "登明", branch: "亥" }, previousZhongQi: "雨水" } },
  { input: "2024-02-19T12:13:13", expected: { monthGeneral: { name: "登明", branch: "亥" }, previousZhongQi: "雨水" } },
] as const;

export const solarTermCrossChecks = [
  { name: "立春", primary: "2024-02-04T16:27:07+08:00", independent: "2024-02-04T16:26:49.630+08:00", differenceSeconds: 17.37 },
  { name: "雨水", primary: "2024-02-19T12:13:12+08:00", independent: "2024-02-19T12:13:03.396+08:00", differenceSeconds: 8.604 },
  { name: "惊蛰", primary: "2024-03-05T10:22:45+08:00", independent: "2024-03-05T10:22:28.877+08:00", differenceSeconds: 16.123 },
] as const;
```

- [ ] **Step 2: Write the evidence-integrity test**

Create `src/test/calendar-cases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { solarTermCrossChecks, termBoundaryCases, ziInitialCases } from "./calendar-cases";

describe("calendar v1 evidence", () => {
  it("keeps independent solar-term discrepancies below sixty seconds", () => {
    expect(solarTermCrossChecks.every((item) => item.differenceSeconds <= 60)).toBe(true);
  });

  it("locks both sides and equality for every approved boundary", () => {
    expect(ziInitialCases.map((item) => item.input.slice(11))).toEqual(["22:59:00", "23:00:00", "23:01:00"]);
    expect(termBoundaryCases).toHaveLength(9);
  });
});
```

- [ ] **Step 3: Write the human-readable evidence record**

Create `docs/rule-cases/calendar-v1.md` with four tables containing every value from Step 1. State that primary solar-term times come from `lunar-typescript@1.8.6`, independent times come from `astronomy-engine@2.1.19` `SearchSunLongitude`, and the rule truth is the user-confirmed interval behavior. Include these source links verbatim:

```markdown
- https://github.com/6tail/lunar-typescript
- https://github.com/cosinekitty/astronomy
- https://ssd.jpl.nasa.gov/horizons/
```

Record the important divergence from the earlier layout reference: under the confirmed 23:00 rule, `2026-08-14T23:00:00` uses day pillar `辛酉`, not `庚申`.

- [ ] **Step 4: Verify the fixture test and commit**

Run:

```powershell
npm test -- src/test/calendar-cases.test.ts
git diff --check
git add docs/rule-cases src/test/calendar-cases.ts src/test/calendar-cases.test.ts
git commit -m "test: lock reviewed calendar rule cases"
```

Expected: 2 tests pass and the commit contains only evidence and fixtures.

- [ ] **User review checkpoint**

Stop execution. Present `docs/rule-cases/calendar-v1.md` to the user. Tasks 2–8 remain blocked until the user confirms these exact values.

---

### Task 2: Define Calendar Vocabulary and Fixed Beijing Time

**Files:**
- Create: `src/domain/calendar/types.ts`
- Create: `src/domain/calendar/constants.ts`
- Create: `src/domain/calendar/beijing-time.ts`
- Create: `src/domain/calendar/beijing-time.test.ts`
- Modify: `src/domain/chart/types.ts`
- Modify: `src/features/course-input/schema.ts`
- Modify: `src/features/course-input/schema.test.ts`
- Modify: `src/features/course-input/CourseInputForm.tsx`

**Interfaces:**
- Consumes: `EarthlyBranch`, `HeavenlyStem`, and `CourseInput` from the existing chart domain.
- Produces: `StemBranch`, `MonthGeneralName`, `BeijingDateTime`, `ReviewedValue<T>`, `CalendarResult`, `CalendarError`, `CalendarAdapter`, `parseBeijingDateTime(value)`, `isStemBranch(value)`, `JIA_ZI`, `JIE_TO_MONTH_BUILD`, and `ZHONG_QI_TO_MONTH_GENERAL`.

- [ ] **Step 1: Write failing fixed-time and input tests**

Add to `src/domain/calendar/beijing-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBeijingDateTime } from "./beijing-time";

describe("parseBeijingDateTime", () => {
  it("normalizes missing seconds without using the machine timezone", () => {
    expect(parseBeijingDateTime("2024-02-10T14:30")).toMatchObject({
      isoLocal: "2024-02-10T14:30:00",
      year: 2024, month: 2, day: 10, hour: 14, minute: 30, second: 0,
      utcEpochMs: Date.UTC(2024, 1, 10, 6, 30, 0),
    });
  });

  it.each(["1899-12-31T23:59:59", "2101-01-01T00:00:00", "2024-02-30T10:00:00"])(
    "rejects unsupported or impossible input %s",
    (value) => expect(() => parseBeijingDateTime(value)).toThrow(),
  );
});
```

Extend `src/features/course-input/schema.test.ts` with assertions that minute-only input returns `civilDateTime: "2024-02-10T14:30:00"`, second-level input is preserved, and 1899/2101 inputs return a `civilDateTime` error.

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- src/domain/calendar/beijing-time.test.ts src/features/course-input/schema.test.ts
```

Expected: FAIL because the calendar module and second-level normalization do not exist.

- [ ] **Step 3: Define exact domain types and constants**

Create `src/domain/calendar/types.ts` with these public interfaces:

```ts
import type { CourseInput, EarthlyBranch, HeavenlyStem, RuleSnapshot } from "../chart/types";

export type StemBranch = `${HeavenlyStem}${EarthlyBranch}`;
export type MonthGeneralName = "登明" | "河魁" | "从魁" | "传送" | "小吉" | "胜光" | "太乙" | "天罡" | "太冲" | "功曹" | "大吉" | "神后";
export type CalendarCorrectionField = "yearPillar" | "monthPillar" | "dayPillar" | "hourPillar" | "monthGeneral" | "divinationHour";

export interface BeijingDateTime {
  isoLocal: string;
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  utcEpochMs: number;
}

export interface ReviewedValue<T> { automatic: T; effective: T; source: "automatic" | "manual"; }
export interface SolarTermBoundary { name: string; kind: "jie" | "zhongqi"; beijingDateTime: string; utcEpochMs: number; }
export interface LunarDateValue { year: number; month: number; day: number; isLeapMonth: boolean; display: string; }
export interface CalendarEvidenceStep { ruleId: string; field: string; input: string; conclusion: string; }

export interface CalendarPrimitives {
  lunarDate: LunarDateValue;
  civilDayPillar: StemBranch;
  liChun: SolarTermBoundary;
  previousJie: SolarTermBoundary;
  nextJie: SolarTermBoundary;
  previousZhongQi: SolarTermBoundary;
  nextZhongQi: SolarTermBoundary;
}

export interface CalendarResult {
  civilDateTime: string;
  effectiveGanzhiDate: string;
  lunarDate: LunarDateValue;
  pillars: { year: ReviewedValue<StemBranch>; month: ReviewedValue<StemBranch>; day: ReviewedValue<StemBranch>; hour: ReviewedValue<StemBranch> };
  monthBuild: EarthlyBranch;
  monthGeneral: ReviewedValue<{ name: MonthGeneralName; branch: EarthlyBranch }>;
  divinationHour: ReviewedValue<EarthlyBranch>;
  boundaries: { previousJie: SolarTermBoundary; nextJie: SolarTermBoundary; previousZhongQi: SolarTermBoundary; nextZhongQi: SolarTermBoundary };
  evidence: readonly CalendarEvidenceStep[];
}

export type CalendarErrorCode = "OUT_OF_SUPPORTED_RANGE" | "INVALID_BEIJING_DATETIME" | "CALENDAR_ADAPTER_FAILURE" | "SOLAR_TERM_BOUNDARY_FAILURE" | "INVALID_CALENDAR_CORRECTION" | "CALENDAR_RESULT_INCOMPLETE" | "CROSS_CHECK_DISCREPANCY";
export interface CalendarError { code: CalendarErrorCode; message: string; field?: CalendarCorrectionField; }
export class CalendarDomainError extends Error {
  constructor(public readonly detail: CalendarError) { super(detail.message); }
}
export type CalendarOutcome = { ok: true; value: CalendarResult; snapshot: CalendarSnapshot } | { ok: false; error: CalendarError };
export type CalendarSnapshot = RuleSnapshot<CalendarResult, "calendar">;
export interface CalendarAdapter { read(time: BeijingDateTime): CalendarPrimitives; }
export interface CalendarEngineInput { input: CourseInput; time: BeijingDateTime; primitives: CalendarPrimitives; }
```

Create `src/domain/calendar/constants.ts` with the complete arrays and maps, not generated locale strings:

```ts
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { MonthGeneralName, StemBranch } from "./types";

export const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const satisfies readonly HeavenlyStem[];
export const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const satisfies readonly EarthlyBranch[];
export const JIA_ZI = Array.from({ length: 60 }, (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}` as StemBranch);

export const JIE_TO_MONTH_BUILD = {
  立春: "寅", 惊蛰: "卯", 清明: "辰", 立夏: "巳", 芒种: "午", 小暑: "未",
  立秋: "申", 白露: "酉", 寒露: "戌", 立冬: "亥", 大雪: "子", 小寒: "丑",
} as const;

export const ZHONG_QI_TO_MONTH_GENERAL = {
  雨水: { name: "登明", branch: "亥" }, 春分: { name: "河魁", branch: "戌" },
  谷雨: { name: "从魁", branch: "酉" }, 小满: { name: "传送", branch: "申" },
  夏至: { name: "小吉", branch: "未" }, 大暑: { name: "胜光", branch: "午" },
  处暑: { name: "太乙", branch: "巳" }, 秋分: { name: "天罡", branch: "辰" },
  霜降: { name: "太冲", branch: "卯" }, 小雪: { name: "功曹", branch: "寅" },
  冬至: { name: "大吉", branch: "丑" }, 大寒: { name: "神后", branch: "子" },
} as const satisfies Record<string, { name: MonthGeneralName; branch: EarthlyBranch }>;

export const CALENDAR_RULE_IDS = {
  beijingTime: "calendar/beijing-time-v1",
  ziInitial: "calendar/zi-initial-rollover-v1",
  year: "calendar/year-at-li-chun-v1",
  month: "calendar/month-at-jie-v1",
  day: "calendar/day-cycle-v1",
  hourBranch: "calendar/hour-double-hour-v1",
  hourStem: "calendar/hour-stem-v1",
  monthGeneral: "calendar/month-general-at-zhongqi-v1",
  correction: "calendar/manual-correction-v1",
} as const;

export function isStemBranch(value: string): value is StemBranch { return (JIA_ZI as readonly string[]).includes(value); }
```

- [ ] **Step 4: Implement strict fixed-UTC+8 parsing and input normalization**

In `src/domain/calendar/beijing-time.ts`, parse with one regex that accepts optional seconds, validate via UTC component round-trip, subtract exactly eight hours for `utcEpochMs`, and throw a `CalendarError`-shaped error code for invalid/range failures. Do not call `new Date(localString)`.

Use this implementation shape:

```ts
import { CalendarDomainError, type BeijingDateTime } from "./types";

const pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseBeijingDateTime(value: string): BeijingDateTime {
  const match = pattern.exec(value);
  if (!match) throw new CalendarDomainError({ code: "INVALID_BEIJING_DATETIME", message: "请输入有效的北京时间" });
  const [, y, m, d, h, min, sec = "00"] = match;
  const [year, month, day, hour, minute, second] = [y, m, d, h, min, sec].map(Number);
  const civilEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const civil = new Date(civilEpoch);
  const same = civil.getUTCFullYear() === year && civil.getUTCMonth() === month - 1 && civil.getUTCDate() === day
    && civil.getUTCHours() === hour && civil.getUTCMinutes() === minute && civil.getUTCSeconds() === second;
  if (!same) throw new CalendarDomainError({ code: "INVALID_BEIJING_DATETIME", message: "请输入有效的北京时间" });
  if (year < 1900 || year > 2100) throw new CalendarDomainError({ code: "OUT_OF_SUPPORTED_RANGE", message: "仅支持 1900–2100 年的北京时间" });
  const isoLocal = `${y}-${m}-${d}T${h}:${min}:${sec}`;
  return { isoLocal, year, month, day, hour, minute, second, utcEpochMs: civilEpoch - 8 * 60 * 60 * 1000 };
}
```

Update `schema.ts` to call `parseBeijingDateTime`, store its `isoLocal`, and surface `请输入 1900–2100 年内的有效北京时间`. Update the form input to `step={1}`, `min="1900-01-01T00:00:00"`, and `max="2100-12-31T23:59:59"`.

Change pillar correction fields in `CourseInput` from `string` to `StemBranch`. Keep `timeZone: "Asia/Shanghai"` as the persisted domain label while all calculations use fixed UTC+8.

- [ ] **Step 5: Run focused tests, full tests, build, and commit**

Run:

```powershell
npm test -- src/domain/calendar/beijing-time.test.ts src/features/course-input/schema.test.ts
npm test
npm run build
git add src/domain/calendar src/domain/chart/types.ts src/features/course-input
git commit -m "feat: define fixed Beijing calendar contracts"
```

Expected: all tests pass and the production build succeeds.

---

### Task 3: Implement the Lunar-Typescript Adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/adapters/calendar/lunar-typescript-adapter.ts`
- Create: `src/adapters/calendar/lunar-typescript-adapter.test.ts`
- Create: `scripts/verify-calendar-cases.mjs`

**Interfaces:**
- Consumes: `BeijingDateTime`, `CalendarAdapter`, `CalendarPrimitives`, `isStemBranch`, and the locked cases.
- Produces: `LunarTypescriptAdapter implements CalendarAdapter`.

- [ ] **Step 1: Install pinned production and development dependencies**

Run in one PowerShell process:

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7891'
$env:HTTPS_PROXY='http://127.0.0.1:7891'
npm install --save-exact lunar-typescript@1.8.6
npm install --save-dev --save-exact astronomy-engine@2.1.19
```

Expected: `lunar-typescript` is under `dependencies`; `astronomy-engine` is under `devDependencies`.

- [ ] **Step 2: Write the failing real-adapter tests**

Create tests that call the real library, not a mock:

```ts
import { describe, expect, it } from "vitest";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";
import { LunarTypescriptAdapter } from "./lunar-typescript-adapter";

const adapter = new LunarTypescriptAdapter();

describe("LunarTypescriptAdapter", () => {
  it("returns only lunar and boundary primitives for the ordinary case", () => {
    const result = adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"));
    expect(result).toMatchObject({
      lunarDate: { display: "二〇二四年正月初一", isLeapMonth: false },
      civilDayPillar: "甲辰",
      previousJie: { name: "立春", beijingDateTime: "2024-02-04T16:27:07" },
      nextJie: { name: "惊蛰", beijingDateTime: "2024-03-05T10:22:45" },
      previousZhongQi: { name: "大寒", beijingDateTime: "2024-01-20T22:07:22" },
      nextZhongQi: { name: "雨水", beijingDateTime: "2024-02-19T12:13:12" },
    });
  });

  it("does not shift the civil lunar date or civil day pillar at 23:00", () => {
    const result = adapter.read(parseBeijingDateTime("2026-08-14T23:00:00"));
    expect(result.lunarDate.display).toBe("二〇二六年七月初二");
    expect(result.civilDayPillar).toBe("庚申");
  });

  it.each(["1900-01-01T00:00:00", "2100-12-31T23:59:59"])("loads adjacent boundaries at the supported edge %s", (value) => {
    const result = adapter.read(parseBeijingDateTime(value));
    expect(result.previousJie.utcEpochMs).toBeLessThanOrEqual(parseBeijingDateTime(value).utcEpochMs);
    expect(result.nextJie.utcEpochMs).toBeGreaterThan(parseBeijingDateTime(value).utcEpochMs);
    expect(result.previousZhongQi.utcEpochMs).toBeLessThanOrEqual(parseBeijingDateTime(value).utcEpochMs);
    expect(result.nextZhongQi.utcEpochMs).toBeGreaterThan(parseBeijingDateTime(value).utcEpochMs);
  });
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
npm test -- src/adapters/calendar/lunar-typescript-adapter.test.ts
```

Expected: FAIL because `LunarTypescriptAdapter` does not exist.

- [ ] **Step 4: Implement the narrow adapter**

Use only `Solar.fromYmdHms`, `getLunar`, lunar date getters, `getDayInGanZhiExact2`, `getPrevJie(false)`, `getNextJie(false)`, `getPrevQi(false)`, `getNextQi(false)`, and the annual `立春` entry from `getJieQiTable`. Convert every library `Solar` to a fixed-UTC+8 `SolarTermBoundary` by reading numeric components; never call `Solar.fromDate`.

The core must follow this shape:

```ts
import { Solar } from "lunar-typescript";
import { isStemBranch } from "../../domain/calendar/constants";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";
import type { BeijingDateTime, CalendarAdapter, SolarTermBoundary } from "../../domain/calendar/types";

function solarText(solar: Solar): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}T${pad(solar.getHour())}:${pad(solar.getMinute())}:${pad(solar.getSecond())}`;
}

function boundary(value: { getName(): string; getSolar(): Solar }, kind: "jie" | "zhongqi"): SolarTermBoundary {
  const beijingDateTime = solarText(value.getSolar());
  return { name: value.getName(), kind, beijingDateTime, utcEpochMs: parseBeijingDateTime(beijingDateTime).utcEpochMs };
}

export class LunarTypescriptAdapter implements CalendarAdapter {
  read(time: BeijingDateTime) {
    const solar = Solar.fromYmdHms(time.year, time.month, time.day, time.hour, time.minute, time.second);
    const lunar = solar.getLunar();
    const civilDayPillar = lunar.getDayInGanZhiExact2();
    if (!isStemBranch(civilDayPillar)) throw new Error("历法库返回了无效干支日");
    const liChunSolar = Solar.fromYmdHms(time.year, 7, 1, 12, 0, 0).getLunar().getJieQiTable()["立春"];
    if (!liChunSolar) throw new Error("历法库缺少立春边界");
    return {
      lunarDate: {
        year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(),
        isLeapMonth: lunar.getMonth() < 0, display: lunar.toString(),
      },
      civilDayPillar,
      liChun: boundary({ getName: () => "立春", getSolar: () => liChunSolar }, "jie"),
      previousJie: boundary(lunar.getPrevJie(false), "jie"),
      nextJie: boundary(lunar.getNextJie(false), "jie"),
      previousZhongQi: boundary(lunar.getPrevQi(false), "zhongqi"),
      nextZhongQi: boundary(lunar.getNextQi(false), "zhongqi"),
    };
  }
}
```

The adapter must throw on an unknown term name, invalid stem-branch, missing annual Li Chun, or a non-monotonic boundary. It must not return year/month/hour pillars or a month general.

- [ ] **Step 5: Add the independent verification script**

Create `scripts/verify-calendar-cases.mjs` that imports `SearchSunLongitude` from `astronomy-engine`, calculates Li Chun at 315°, Rain Water at 330°, and Jing Zhe at 345°, adds exactly eight hours for display, compares each result with `solarTermCrossChecks`, prints a compact table, and exits 1 if any difference exceeds 60 seconds.

Add this script to `package.json`:

```json
"verify:calendar-sources": "node scripts/verify-calendar-cases.mjs"
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/adapters/calendar/lunar-typescript-adapter.test.ts
npm run verify:calendar-sources
npm test
npm run build
git add package.json package-lock.json scripts src/adapters/calendar
git commit -m "feat: adapt verified lunar calendar primitives"
```

Expected: the three discrepancies are 17.370, 8.604, and 16.123 seconds within rounding tolerance; tests and build pass.

---

### Task 4: Implement the Traditional Calendar Policy

**Files:**
- Create: `src/domain/calendar/policy.ts`
- Create: `src/domain/calendar/policy.test.ts`

**Interfaces:**
- Consumes: `CalendarEngineInput`, constants from Task 2, adapter primitives from Task 3, and locked fixtures.
- Produces: `deriveAutomaticCalendar(input): AutomaticCalendarResult`, plus focused helpers `nextStemBranch`, `deriveYearPillar`, `deriveMonthPillar`, `deriveDayPillar`, `deriveHourPillar`, and `deriveMonthGeneral`.

- [ ] **Step 1: Write failing ordinary and Zi-initial tests**

Use `LunarTypescriptAdapter` to supply primitives and assert the complete automatic result for `ordinaryCalendarCase` and every item in `ziInitialCases`. Explicitly assert that the lunar display remains `二〇二六年七月初二` at 23:00 while the effective Ganzhi date becomes `2026-08-15`.

- [ ] **Step 2: Write failing exact-term boundary tests**

Table-drive all nine `termBoundaryCases`. Assert equality switches to the new interval at `16:27:07`, `10:22:45`, and `12:13:12`; do not round to a date or minute.

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
npm test -- src/domain/calendar/policy.test.ts
```

Expected: FAIL because policy functions do not exist.

- [ ] **Step 4: Implement minimal pure rules**

Implement with these exact formulas:

```ts
const yearCycleIndex = (year - 1984) % 60;
const hourBranchIndex = Math.floor((time.hour + 1) / 2) % 12;
const yinMonthStemIndex = ((yearStemIndex % 5) * 2 + 2) % 10;
const monthStemIndex = (yinMonthStemIndex + monthOffsetFromYin) % 10;
const ziHourStemIndex = (dayStemIndex % 5) * 2;
const hourStemIndex = (ziHourStemIndex + hourBranchIndex) % 10;
```

Normalize negative modulo values. Select the previous/current interval with `input.utcEpochMs >= boundary.utcEpochMs`. At hour 23, advance `civilDayPillar` by one position in `JIA_ZI` and advance only `effectiveGanzhiDate`; do not change the lunar date. Generate evidence entries for Beijing time, day rollover, year, month, day, hour branch, hour stem, and month general.

- [ ] **Step 5: Verify all mapping tables, focused tests, full tests, build, and commit**

Add one table-driven test that covers all 12 `JIE_TO_MONTH_BUILD` entries and all 12 `ZHONG_QI_TO_MONTH_GENERAL` entries. Then run:

```powershell
npm test -- src/domain/calendar/policy.test.ts
npm test
npm run build
git add src/domain/calendar/policy.ts src/domain/calendar/policy.test.ts
git commit -m "feat: calculate reviewed calendar rules"
```

Expected: all ordinary, Zi-initial, exact-term, and full mapping tests pass.

---

### Task 5: Apply Corrections and Compose the Calendar Snapshot

**Files:**
- Create: `src/domain/calendar/corrections.ts`
- Create: `src/domain/calendar/corrections.test.ts`
- Create: `src/domain/calendar/compute-calendar.ts`
- Create: `src/domain/calendar/compute-calendar.test.ts`
- Modify: `src/domain/chart/types.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`

**Interfaces:**
- Consumes: `CourseInput`, `CalendarAdapter`, automatic policy result, and existing `invalidateFrom`.
- Produces: `computeCalendar(input, adapter): CalendarOutcome`, `runCalendarStage(session, adapter): { ok: true; session: CourseSession; value: CalendarResult } | { ok: false; error: CalendarError }`, `setCalendarCorrection(input, field, rawValue): CourseInput`, `resetCalendarCorrection(input, field): CourseInput`, and `isCalendarResult(value): value is CalendarResult`.

- [ ] **Step 1: Write failing correction tests**

Cover all six fields:

```ts
it("keeps automatic values while applying and resetting one correction", () => {
  const corrected = setCalendarCorrection(baseInput, "dayPillar", "乙巳");
  const result = computeCalendar(corrected, adapter);
  expect(result.ok && result.value.pillars.day).toEqual({ automatic: "甲辰", effective: "乙巳", source: "manual" });
  expect(resetCalendarCorrection(corrected, "dayPillar").corrections.dayPillar).toBeUndefined();
});
```

Assert invalid pairs such as `甲丑`, invalid branches, and empty non-reset values throw `CalendarDomainError` with code `INVALID_CALENDAR_CORRECTION` without mutating the prior input.

- [ ] **Step 2: Write failing snapshot and error tests**

Test success metadata exactly:

```ts
expect(result.snapshot).toMatchObject({
  stage: "calendar",
  dependsOn: [],
  ruleId: "calendar/traditional-beijing-zi-v1",
  source: "automatic",
});
```

Test that one manual field changes snapshot `source` to `manual`, adapter exceptions become `CALENDAR_ADAPTER_FAILURE`, missing boundaries become `SOLAR_TERM_BOUNDARY_FAILURE`, and invalid/out-of-range input creates no snapshot. Seed fake downstream snapshots, rerun the calendar stage, and assert all calendar-dependent snapshots are removed before the new calendar snapshot is inserted.

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
npm test -- src/domain/calendar/corrections.test.ts src/domain/calendar/compute-calendar.test.ts src/domain/chart/snapshots.test.ts
```

Expected: FAIL because correction and orchestration functions do not exist.

- [ ] **Step 4: Implement correction overlay and outcome handling**

Use one `reviewed(automatic, correction)` helper. For a corrected month-general branch, derive its unique traditional name from `ZHONG_QI_TO_MONTH_GENERAL`; do not accept a free-text name. Catch adapter exceptions only at `computeCalendar`, map known input errors to stable codes, and preserve the original error as `cause` only for developer logging, not UI copy.

Implement `isCalendarResult` with runtime checks for fixed-UTC+8 time, four valid Jiazi values, valid month build, valid reviewed sources, valid month-general name/branch pair, four ordered boundaries, and non-empty evidence.

Update `RuleSnapshots` so `calendar` is statically `CalendarSnapshot` while other stage values remain `unknown`. Update `validateSession` to append `calendar 快照结果无效` when a present calendar value fails `isCalendarResult`.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/domain/calendar/corrections.test.ts src/domain/calendar/compute-calendar.test.ts src/domain/chart/snapshots.test.ts
npm test
npm run build
git add src/domain/calendar src/domain/chart
git commit -m "feat: compose corrected calendar snapshots"
```

Expected: focused and full suites pass; the build succeeds.

---

### Task 6: Render the Confirmed Calendar Matrix

**Files:**
- Create: `src/features/calendar-review/CalendarReview.tsx`
- Create: `src/features/calendar-review/CalendarReview.test.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `CalendarResult`, `CalendarCorrectionField`, `JIA_ZI`, and `EARTHLY_BRANCHES`.
- Produces: `<CalendarReview result onSetCorrection onResetCorrection />`.

- [ ] **Step 1: Write the failing semantic matrix test**

Render the ordinary result and assert:

```ts
expect(screen.getByRole("heading", { name: "历法与月将" })).toBeVisible();
expect(screen.getByLabelText("历法结果矩阵").children).toHaveLength(8);
expect(screen.getByRole("button", { name: /日柱.*甲辰.*自动/ })).toBeVisible();
expect(screen.getByText("calendar/zi-initial-rollover-v1")).toBeVisible();
expect(screen.queryByRole("button", { name: /批准|审核通过/ })).not.toBeInTheDocument();
```

Click `日柱`, assert the evidence region heading changes to `日柱证据`, choose `乙巳`, and assert `onSetCorrection("dayPillar", "乙巳")`. Render a manual value, assert both `自动：甲辰` and `有效：乙巳`, then click `恢复自动值` and assert `onResetCorrection("dayPillar")`.

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm test -- src/features/calendar-review/CalendarReview.test.tsx
```

Expected: FAIL because `CalendarReview` does not exist.

- [ ] **Step 3: Implement the matrix and evidence interaction**

Use a `<section aria-labelledby="calendar-review-title">`, an eight-item `<ul aria-label="历法结果矩阵">`, and a real button for each cell. Source badges must have accessible text `自动计算` or `人工修正`. The active field controls an `<aside aria-live="polite" aria-labelledby="calendar-evidence-title">` containing only evidence entries whose `field` matches the selected field plus the shared Beijing-time entry.

Use a `<select>` of `JIA_ZI` for pillar corrections and `EARTHLY_BRANCHES` for month-general/divination-hour corrections. Do not expose a month-general name input. Keep evidence available before editing; do not hide it behind an approval state.

- [ ] **Step 4: Implement the confirmed visual structure**

Add scoped classes for:

- `.calendar-review` two-column main/evidence layout.
- `.calendar-review__time-band` civil time, Zi-initial rule, effective date.
- `.calendar-review__matrix` four columns on desktop and two below 820px.
- `.calendar-review__cell[data-source="manual"]` old-gold border/effective value while keeping automatic text.
- `.calendar-review__evidence` right rail on desktop and normal-flow bottom panel below 820px.
- 44px minimum controls, visible `:focus-visible`, no `overflow: hidden` on the page or matrix.

Use only `--ink`, `--dark-bronze`, `--patina`, `--ru-celadon`, `--ash`, and `--old-gold`. Update `--old-gold` from `#80704c` to the approved brighter bronze-gold `#b7a36b`; its contrast is 7.24:1 on `--ink` and 5.36:1 on `--dark-bronze`, while the old token fails normal-text contrast on both.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/features/calendar-review/CalendarReview.test.tsx
npm test
npm run build
git add src/features/calendar-review src/styles/tokens.css src/styles/global.css
git commit -m "feat: render calendar evidence matrix"
```

Expected: component tests, full tests, and build pass.

---

### Task 7: Integrate Calendar Calculation Into the App

**Files:**
- Modify: `src/features/course-input/CourseInputForm.tsx`
- Modify: `src/features/course-input/CourseInputForm.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `LunarTypescriptAdapter`, `runCalendarStage`, correction helpers, `CalendarReview`, and `CourseSession`.
- Produces: an app that creates a real calendar snapshot, shows structured failures, updates corrections, and advances the read-only rail to `heaven-earth` only after a valid snapshot exists.

- [ ] **Step 1: Write failing app-flow tests**

Test these states with the real adapter:

1. Initial page has input and no matrix.
2. Valid `2024-02-10T14:30:00` input shows the matrix with `甲辰 / 丙寅 / 甲辰 / 辛未`, `神后 · 子`, and no heaven-earth result.
3. Rule rail marks `历法与月将` completed and `天地盘加临` current.
4. Changing day pillar to `乙巳` shows automatic `甲辰`, effective `乙巳`, and manual source.
5. Reset returns to automatic.
6. An out-of-range input remains in input state and displays `仅支持 1900–2100 年的北京时间`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- src/app/App.test.tsx src/features/course-input/CourseInputForm.test.tsx
```

Expected: FAIL because the app still creates an empty session and no calendar snapshot.

- [ ] **Step 3: Move correction controls out of the initial input form**

Keep only time, location, longitude, latitude, and submit in `CourseInputForm`. Existing schema support for correction fields remains for restored/external data, but ordinary form submission creates `corrections: {}`. Set `step={1}` on the time input.

- [ ] **Step 4: Integrate the real stage without fabricated fallbacks**

Create one module-level `const calendarAdapter = new LunarTypescriptAdapter()`. On submit, build `{ input, snapshots: {} }`, call `runCalendarStage`, and store either the successful session or the structured error. On correction/reset, update `session.input`, rerun the calendar stage, and replace session only on success; keep the prior valid session visible if a new correction is invalid and show the field error.

Render `CalendarReview` only when `session.snapshots.calendar` passes `isCalendarResult`. Otherwise render the existing guidance or a `role="alert"` failure. Do not render `CourseSheet` or any 3D placeholder.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/app/App.test.tsx src/features/course-input/CourseInputForm.test.tsx
npm test
npm run build
git add src/app src/features/course-input
git commit -m "feat: run calendar review in application"
```

Expected: all app states pass and build succeeds.

---

### Task 8: Verify Responsive, Keyboard, and Offline Delivery

**Files:**
- Modify: `e2e/app-shell.spec.ts`
- Modify: `playwright.config.ts` only if the existing server timeout is insufficient; do not change `testDir: "e2e"`.

**Interfaces:**
- Consumes: the integrated application.
- Produces: browser-level proof at 1440×900 and 390×844.

- [ ] **Step 1: Add real calculation helpers and failing E2E coverage**

Add a helper that fills:

```ts
await page.getByLabel("日期与时间").fill("2024-02-10T14:30:00");
await page.getByLabel("地点").fill("北京");
await page.getByLabel("经度").fill("116.4074");
await page.getByLabel("纬度").fill("39.9042");
await page.getByRole("button", { name: "建立起课上下文" }).click();
```

At both viewports assert the eight-cell matrix is visible, `documentElement.scrollWidth === documentElement.clientWidth`, and no course or 3D placeholder exists. Open the day-pillar evidence, apply `乙巳`, verify automatic/effective/source text, reset it, and verify the automatic state.

For the manual effective-value element, calculate foreground/background relative luminance in the page and assert a contrast ratio of at least 4.5:1.

Extend the existing keyboard loop so it runs after the matrix appears and reaches every visible matrix button, correction control, and reset control with a nonzero nontransparent focus outline. On mobile, assert the evidence panel follows the matrix in document order and no fixed overlay traps focus.

- [ ] **Step 2: Run E2E to verify RED or expose real layout failures**

Run:

```powershell
npm run test:e2e
```

Expected: new tests fail until the integrated matrix selectors and responsive behavior match the contract. If they pass immediately, record that the existing implementation already satisfies the added acceptance criteria and do not manufacture a CSS failure.

- [ ] **Step 3: Fix only observed responsive or accessibility failures**

Allowed fixes are scoped selectors in `global.css` and semantic attributes in `CalendarReview`. Do not use `outline: none`, page-level `overflow: hidden`, arbitrary timeouts, forced clicks, or screenshot-only assertions.

- [ ] **Step 4: Run the complete delivery gate**

Run:

```powershell
npm run verify:calendar-sources
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: source verification succeeds; all unit tests and six existing plus new E2E cases pass; build succeeds; worktree is clean except intended task changes before commit.

- [ ] **Step 5: Commit**

```powershell
git add e2e playwright.config.ts src/styles/global.css src/features/calendar-review
git commit -m "test: verify calendar review experience"
```

Expected: the commit contains only verified browser and any necessary scoped accessibility/responsive fixes.

---

## Completion Gate

The stage is complete only when:

1. The user has explicitly confirmed `docs/rule-cases/calendar-v1.md`.
2. `lunar-typescript` is isolated behind `CalendarAdapter`; `astronomy-engine` is absent from application imports.
3. Ordinary, Zi-initial, Li Chun, Jie, and Zhongqi fixtures pass with equality assigned to the new interval.
4. Automatic and effective values, correction source, reset, snapshot validation, and downstream invalidation pass.
5. The calendar matrix matches the confirmed B structure on desktop and mobile.
6. The app contains no downstream Liu Ren result or 3D placeholder.
7. `npm run verify:calendar-sources`, `npm test`, `npm run build`, and `npm run test:e2e` all exit 0.

After this gate, the next plan begins with the user-reviewed “天地盘加临” rule case and consumes only the validated `calendar` snapshot.
