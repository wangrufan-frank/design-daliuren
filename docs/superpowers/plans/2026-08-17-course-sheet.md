# Verified Course Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sixth rule stage that projects the five validated upstream stages into a canonical course snapshot, renders the approved standard text course, and copies the same facts as stable plain text.

**Architecture:** Add a focused `src/domain/course` module. A pure projection combines calendar, four-lessons, three-transmissions, and heavenly-generals results; a structural and canonical guard verifies the materialized snapshot against the real upstream chain. React renders only the guarded `CourseResult`, while a separate pure serializer produces clipboard text from that same result.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 3, Testing Library, Playwright, existing Vite build; no new dependencies.

## Global Constraints

- `course` is a projection of verified facts and must not calculate new traditional rules.
- Display the already-verified three-transmissions relation, method, subtype, and variants; do not recalculate them.
- Do not calculate or display hidden stems, spirits, unverified lesson-pattern expansions, interpretations, auspiciousness, or judgments.
- Direct snapshot dependencies are exactly `["calendar", "four-lessons", "three-transmissions", "heavenly-generals"]`.
- The snapshot rule ID is exactly `course/verified-projection-v1`.
- Desktop layout is the approved near-equal desk-style two-column layout.
- Transmissions are vertical in initial, middle, final order.
- Lessons are fourth, third, second, first.
- General text precedes the transmission/lesson label and branch content in DOM reading order.
- The right column uses the existing 4×4 enclosing twelve-palace square with a center summary; never use a 3×4 inventory grid.
- Mobile order is summary → transmissions → lessons → twelve palaces → copy, with no horizontal overflow.
- Clipboard output is stable segmented plain text with LF line endings; do not add Markdown output.
- Do not add manual editing, approval, 3D, animation, image export, printing, cloud storage, or external integration.
- Use TDD for every production change. Run each focused RED command before its implementation step and record the observed failure.
- Keep existing code style and do not refactor unrelated calendar, plate, four-lessons, three-transmissions, or heavenly-generals logic.

---

## File Structure

Create:

- `src/domain/course/types.ts` — course result, error, outcome, and snapshot contracts.
- `src/domain/course/policy.ts` — pure verified projection, fixed visual orders, and plain-text serializer.
- `src/domain/course/policy.test.ts` — projection, mapping, ordering, stability, and text-format tests.
- `src/domain/course/result-guard.ts` — strict structural guard, canonical input matcher, source derivation, and rule ID.
- `src/domain/course/compute-course.ts` — snapshot composer and stage runner with earliest-upstream invalidation.
- `src/domain/course/compute-course.test.ts` — guard failures, upstream failures, source propagation, and returned-session tests.
- `e2e/course-sheet.spec.ts` — desktop, mobile, clipboard, navigation, and offline full-flow coverage.
- `docs/rule-cases/course-v1.md` — field-to-upstream and field-to-regression traceability.

Modify:

- `src/domain/chart/types.ts` — remove the layout-only `CourseResult` contract.
- `src/domain/chart/stages.ts` — replace the layout-only course dependency list.
- `src/domain/chart/snapshots.ts` — validate real course snapshots and export a current-input snapshot guard.
- `src/domain/chart/snapshots.test.ts` — dependency, metadata, canonical mismatch, and invalidation coverage.
- `src/test/reference-session.ts` — derive a real course snapshot instead of storing layout-only values.
- `src/features/course-sheet/CourseSheet.tsx` — render the approved course and copy interaction directly from `CourseResult`.
- `src/features/course-sheet/CourseSheet.test.tsx` — structure, DOM order, square layout, copy success, and copy failure tests.
- `src/app/App.tsx` — run, select, guard, and navigate the final course stage.
- `src/app/App.test.tsx` — successful final state, failure fallback, navigation, and correction recomputation tests.
- `src/features/rule-review/RuleStageRail.tsx` — allow a fully completed rail with no current step.
- `src/features/rule-review/RuleStageRail.test.tsx` — final-state accessibility and navigation coverage.
- `src/styles/global.css` — replace layout-only course styles with the approved desktop/mobile layout.
- `e2e/heavenly-generals.spec.ts` — navigate back to heavenly generals after course becomes the terminal page.

Delete after the replacement tests are green:

- `src/features/course-sheet/view-model.ts` — redundant layout-only validation and mapping.
- `src/features/course-sheet/view-model.test.ts` — tests for the removed layout-only model.

---

### Task 1: Pure course projection, contracts, and serializer

**Files:**
- Create: `src/domain/course/types.ts`
- Create: `src/domain/course/policy.ts`
- Create: `src/domain/course/policy.test.ts`

**Interfaces:**
- Consumes: `CalendarResult`, `FourLessonsResult`, `ThreeTransmissionsResult`, `HeavenlyGeneralsResult`, and `locationName: string`.
- Produces: `deriveCourse(locationName, calendar, fourLessons, transmissions, generals): CourseResult`, `serializeCourseText(result): string`, `COURSE_LESSON_ORDER`, `COURSE_PALACE_ORDER`, and public course contracts used by Tasks 2–6.

- [ ] **Step 1: Write the failing contracts and projection tests**

Create `types.ts` with the exact public result shape:

```ts
import type { StemBranch, MonthGeneralName } from "../calendar/types";
import type { CourseSession, EarthlyBranch, RuleSnapshot, RuleStageId } from "../chart/types";
import type { FourLessonId, FourLessonLabel, FourLessonLower } from "../four-lessons/types";
import type { GeneralDirection, HeavenlyGeneral, NobleDayNight } from "../heavenly-generals/types";
import type { SixRelation, TransmissionMethod, TransmissionPosition, TransmissionSubtype, TransmissionVariant } from "../three-transmissions/types";

export interface CourseResult {
  context: {
    civilDateTime: string;
    effectiveGanzhiDate: string;
    locationName: string;
    lunarDateDisplay: string;
    pillars: { year: StemBranch; month: StemBranch; day: StemBranch; hour: StemBranch };
    monthBuild: EarthlyBranch;
    monthGeneral: { name: MonthGeneralName; branch: EarthlyBranch };
    divinationHour: EarthlyBranch;
  };
  method: { method: TransmissionMethod; subtype?: TransmissionSubtype; variants: readonly TransmissionVariant[] };
  transmissions: readonly {
    position: TransmissionPosition;
    label: "初传" | "中传" | "末传";
    branch: EarthlyBranch;
    relation: SixRelation;
    general: HeavenlyGeneral;
  }[];
  lessons: readonly {
    id: FourLessonId;
    label: FourLessonLabel;
    upper: EarthlyBranch;
    lower: FourLessonLower;
    general: HeavenlyGeneral;
  }[];
  palaces: readonly {
    earth: EarthlyBranch;
    heaven: EarthlyBranch;
    general: HeavenlyGeneral;
    noble: boolean;
  }[];
  noble: {
    dayNight: NobleDayNight;
    nobleHeaven: EarthlyBranch;
    nobleEarth: EarthlyBranch;
    direction: GeneralDirection;
  };
}

export type CourseErrorCode =
  | "INVALID_COURSE_INPUT"
  | "COURSE_GENERAL_MAPPING_INCOMPLETE"
  | "COURSE_RESULT_GUARD_FAILED"
  | "COURSE_RESULT_INCOMPLETE";
export type CourseSnapshot = RuleSnapshot<CourseResult, "course">;
export type CourseOutcome =
  | { ok: true; value: CourseResult; snapshot: CourseSnapshot }
  | { ok: false; error: { code: CourseErrorCode; message: string; upstreamStage?: Exclude<RuleStageId, "course">; cause?: unknown } };
export type CourseStageOutcome =
  | { ok: true; value: CourseResult; session: CourseSession }
  | { ok: false; error: Extract<CourseOutcome, { ok: false }>["error"]; session: CourseSession };
```

Create `policy.test.ts` using the real upstream values from `referenceSession`:

```ts
import { describe, expect, it } from "vitest";
import type { CalendarSnapshot } from "../calendar/types";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { COURSE_LESSON_ORDER, COURSE_PALACE_ORDER, deriveCourse, serializeCourseText } from "./policy";

const calendar = referenceSession.snapshots.calendar as CalendarSnapshot;
const lessons = referenceSession.snapshots["four-lessons"] as FourLessonsSnapshot;
const transmissions = referenceSession.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
const generals = referenceSession.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;

function derive() {
  return deriveCourse(referenceSession.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value);
}

describe("deriveCourse", () => {
  it("projects only verified upstream facts in approved visual order", () => {
    const result = derive();
    expect(result.context).toEqual({
      civilDateTime: calendar.value.civilDateTime,
      effectiveGanzhiDate: calendar.value.effectiveGanzhiDate,
      locationName: "参考课式",
      lunarDateDisplay: calendar.value.lunarDate.display,
      pillars: {
        year: calendar.value.pillars.year.effective,
        month: calendar.value.pillars.month.effective,
        day: calendar.value.pillars.day.effective,
        hour: calendar.value.pillars.hour.effective,
      },
      monthBuild: calendar.value.monthBuild,
      monthGeneral: calendar.value.monthGeneral.effective,
      divinationHour: calendar.value.divinationHour.effective,
    });
    expect(result.method).toEqual({
      method: transmissions.value.method,
      ...(transmissions.value.subtype ? { subtype: transmissions.value.subtype } : {}),
      variants: transmissions.value.variants,
    });
    expect(result.transmissions.map(({ position, branch, relation }) => ({ position, branch, relation })))
      .toEqual(transmissions.value.transmissions.map(({ position, branch, relation }) => ({ position, branch, relation })));
    expect(result.lessons.map(({ id }) => id)).toEqual(COURSE_LESSON_ORDER);
    expect(result.palaces.map(({ earth }) => earth)).toEqual(COURSE_PALACE_ORDER);
    expect(result.palaces).toHaveLength(12);
  });

  it("is byte-stable for identical inputs", () => {
    expect(JSON.stringify(derive())).toBe(JSON.stringify(derive()));
    expect(serializeCourseText(derive())).toBe(serializeCourseText(derive()));
  });
});
```

- [ ] **Step 2: Run the projection test to verify RED**

Run:

```powershell
npm test -- src/domain/course/policy.test.ts
```

Expected: FAIL because `src/domain/course/policy.ts` does not exist.

- [ ] **Step 3: Implement the minimal verified projection**

Create `policy.ts` with these fixed orders and mapping rules:

```ts
import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch } from "../chart/types";
import type { FourLessonsResult } from "../four-lessons/types";
import { generalForHeaven } from "../heavenly-generals/policy";
import type { HeavenlyGeneralsResult } from "../heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../three-transmissions/types";
import type { CourseResult } from "./types";

export const COURSE_LESSON_ORDER = ["fourth", "third", "second", "first"] as const;
export const COURSE_PALACE_ORDER = ["巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰"] as const satisfies readonly EarthlyBranch[];

export class CourseProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseProjectionError";
  }
}

export function deriveCourse(
  locationName: string,
  calendar: CalendarResult,
  fourLessons: FourLessonsResult,
  transmissions: ThreeTransmissionsResult,
  generals: HeavenlyGeneralsResult,
): CourseResult {
  try {
    const lessonsById = new Map(fourLessons.lessons.map((lesson) => [lesson.id, lesson]));
    const placementsByEarth = new Map(generals.placements.map((placement) => [placement.earth, placement]));
    return {
      context: {
        civilDateTime: calendar.civilDateTime,
        effectiveGanzhiDate: calendar.effectiveGanzhiDate,
        locationName,
        lunarDateDisplay: calendar.lunarDate.display,
        pillars: {
          year: calendar.pillars.year.effective,
          month: calendar.pillars.month.effective,
          day: calendar.pillars.day.effective,
          hour: calendar.pillars.hour.effective,
        },
        monthBuild: calendar.monthBuild,
        monthGeneral: calendar.monthGeneral.effective,
        divinationHour: calendar.divinationHour.effective,
      },
      method: {
        method: transmissions.method,
        ...(transmissions.subtype ? { subtype: transmissions.subtype } : {}),
        variants: [...transmissions.variants],
      },
      transmissions: transmissions.transmissions.map((transmission) => ({
        position: transmission.position,
        label: transmission.label,
        branch: transmission.branch,
        relation: transmission.relation,
        general: generalForHeaven(generals, transmission.branch),
      })),
      lessons: COURSE_LESSON_ORDER.map((id) => {
        const lesson = lessonsById.get(id);
        if (!lesson) throw new CourseProjectionError(`四课结果缺少${id}`);
        return { ...lesson, general: generalForHeaven(generals, lesson.upper) };
      }),
      palaces: COURSE_PALACE_ORDER.map((earth) => {
        const placement = placementsByEarth.get(earth);
        if (!placement) throw new CourseProjectionError(`天将结果缺少${earth}宫`);
        return { earth, heaven: placement.heaven, general: placement.general, noble: earth === generals.nobleEarth };
      }),
      noble: {
        dayNight: generals.dayNight,
        nobleHeaven: generals.nobleHeaven,
        nobleEarth: generals.nobleEarth,
        direction: generals.direction,
      },
    };
  } catch (cause) {
    if (cause instanceof CourseProjectionError) throw cause;
    throw new CourseProjectionError(cause instanceof Error ? cause.message : "课式天将映射失败");
  }
}
```

- [ ] **Step 4: Add the failing exact serializer tests**

Append tests that split the output into exact lines instead of relying on whitespace-normalized DOM text:

```ts
it("serializes stable segmented plain text with LF line endings", () => {
  const result = derive();
  const text = serializeCourseText(result);
  expect(text).not.toContain("\r");
  expect(text.split("\n").slice(0, 8)).toEqual([
    "大六壬标准课式",
    `时间：${result.context.civilDateTime}`,
    `地点：${result.context.locationName}`,
    `农历：${result.context.lunarDateDisplay}`,
    `四柱：${result.context.pillars.year}　${result.context.pillars.month}　${result.context.pillars.day}　${result.context.pillars.hour}`,
    `月建：${result.context.monthBuild}`,
    `月将：${result.context.monthGeneral.name}（${result.context.monthGeneral.branch}）　占时：${result.context.divinationHour}`,
    "",
  ]);
  expect(text).toContain(`初传：${result.transmissions[0].general}　${result.transmissions[0].branch}　${result.transmissions[0].relation}`);
  expect(text.match(/宫：/g)).toHaveLength(12);
  expect(text).not.toMatch(/遁干|神煞|断语/);
});

it("omits absent subtype and variants without empty separators", () => {
  const result = derive();
  const text = serializeCourseText({ ...result, method: { method: result.method.method, variants: [] } });
  expect(text).toContain(`三传取法：${result.method.method}\n`);
  expect(text).not.toContain("[]");
  expect(text).not.toContain("undefined");
});
```

- [ ] **Step 5: Run serializer tests to verify RED**

Run:

```powershell
npm test -- src/domain/course/policy.test.ts
```

Expected: FAIL because `serializeCourseText` is not exported.

- [ ] **Step 6: Implement the serializer and run GREEN**

Add pure formatting helpers and join only with `"\n"`:

```ts
const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

export function serializeCourseText(result: CourseResult): string {
  const method = [result.method.method, result.method.subtype, result.method.variants.length ? result.method.variants.join("/") : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return [
    "大六壬标准课式",
    `时间：${result.context.civilDateTime}`,
    `地点：${result.context.locationName}`,
    `农历：${result.context.lunarDateDisplay}`,
    `四柱：${result.context.pillars.year}　${result.context.pillars.month}　${result.context.pillars.day}　${result.context.pillars.hour}`,
    `月建：${result.context.monthBuild}`,
    `月将：${result.context.monthGeneral.name}（${result.context.monthGeneral.branch}）　占时：${result.context.divinationHour}`,
    "",
    `三传取法：${method}`,
    ...result.transmissions.map((item) => `${item.label}：${item.general}　${item.branch}　${item.relation}`),
    "",
    "四课",
    ...result.lessons.map((item) => `${item.label}：${item.general}　上神${item.upper}　下神${item.lower.value}`),
    "",
    "十二宫",
    ...result.palaces.map((item) => `${item.earth}宫：${item.general}　天盘${item.heaven}　地盘${item.earth}`),
    "",
    `贵人：${dayNightText[result.noble.dayNight]}贵${result.noble.nobleHeaven}　落${result.noble.nobleEarth}宫　${directionText[result.noble.direction]}布`,
  ].join("\n");
}
```

Run:

```powershell
npm test -- src/domain/course/policy.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/domain/course/types.ts src/domain/course/policy.ts src/domain/course/policy.test.ts
git commit -m "feat: project verified course facts"
```

---

### Task 2: Course guard, snapshot composer, and stage runner

**Files:**
- Create: `src/domain/course/result-guard.ts`
- Create: `src/domain/course/compute-course.ts`
- Create: `src/domain/course/compute-course.test.ts`

**Interfaces:**
- Consumes: Task 1 `deriveCourse`, `CourseResult`, and the real upstream snapshots in a `CourseSession`.
- Produces: `COURSE_SNAPSHOT_RULE_ID`, `isCourseResult`, `matchesCourseInputs`, `courseResultSource`, `computeCourse`, and `runCourseStage`.

- [ ] **Step 1: Write failing strict-guard tests**

Create `compute-course.test.ts` with a helper that derives all inputs from `referenceSession`, then cover a valid snapshot and semantic mutations:

```ts
import { describe, expect, it } from "vitest";
import type { CalendarSnapshot } from "../calendar/types";
import { validateSession } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { computeCourse, runCourseStage } from "./compute-course";
import { isCourseResult, matchesCourseInputs } from "./result-guard";

const withoutCourse: CourseSession = {
  ...referenceSession,
  snapshots: Object.fromEntries(Object.entries(referenceSession.snapshots).filter(([stage]) => stage !== "course")),
};

it("composes a guarded canonical course snapshot", () => {
  const outcome = computeCourse(
    withoutCourse.input.locationName,
    withoutCourse.snapshots.calendar as CalendarSnapshot,
    withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot,
    withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
    withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot,
  );
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error.message);
  expect(outcome.snapshot).toMatchObject({
    stage: "course",
    dependsOn: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
    ruleId: "course/verified-projection-v1",
  });
  expect(isCourseResult(outcome.value)).toBe(true);
});

it("rejects present-but-wrong semantic values", () => {
  const outcome = runCourseStage(withoutCourse);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error.message);
  const snapshot = outcome.session.snapshots.course!;
  const value = snapshot.value as any;
  const calendar = withoutCourse.snapshots.calendar as CalendarSnapshot;
  const lessons = withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot;
  const transmissions = withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
  const generals = withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;
  const wrongRelation = { ...value, transmissions: value.transmissions.map((item: any, index: number) => index ? item : { ...item, relation: item.relation === "父母" ? "子孙" : "父母" }) };
  const wrongGeneral = { ...value, palaces: value.palaces.map((item: any, index: number) => index ? item : { ...item, general: item.general === "贵人" ? "螣蛇" : "贵人" }) };
  expect(isCourseResult(wrongRelation)).toBe(true);
  expect(matchesCourseInputs(wrongRelation, withoutCourse.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value)).toBe(false);
  expect(matchesCourseInputs(wrongGeneral, withoutCourse.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value)).toBe(false);
});
```

- [ ] **Step 2: Run guard tests to verify RED**

Run:

```powershell
npm test -- src/domain/course/compute-course.test.ts
```

Expected: FAIL because the guard and composer modules do not exist.

- [ ] **Step 3: Implement the strict structural and canonical guard**

Create `result-guard.ts` with exact-key validation and canonical recomputation:

```ts
export const COURSE_SNAPSHOT_RULE_ID = "course/verified-projection-v1";

export function isCourseResult(value: unknown): value is CourseResult {
  if (!isRecord(value) || !hasExactKeys(value, ["context", "method", "transmissions", "lessons", "palaces", "noble"])) return false;
  if (!isContext(value.context) || !isMethod(value.method) || !isNoble(value.noble)) return false;
  if (!Array.isArray(value.transmissions) || value.transmissions.length !== 3) return false;
  if (!Array.isArray(value.lessons) || value.lessons.length !== 4) return false;
  if (!Array.isArray(value.palaces) || value.palaces.length !== 12) return false;
  if (!transmissionsAreCanonical(value.transmissions)) return false;
  if (!lessonsAreCanonical(value.lessons)) return false;
  if (!palacesAreCanonical(value.palaces)) return false;
  return true;
}

export function matchesCourseInputs(
  value: CourseResult,
  locationName: string,
  calendar: CalendarResult,
  lessons: FourLessonsResult,
  transmissions: ThreeTransmissionsResult,
  generals: HeavenlyGeneralsResult,
): boolean {
  if (!isCourseResult(value)) return false;
  try {
    return sameValue(value, deriveCourse(locationName, calendar, lessons, transmissions, generals));
  } catch {
    return false;
  }
}

export function courseResultSource(sources: readonly ValueSource[]): ValueSource {
  return sources.includes("manual") ? "manual" : "automatic";
}
```

Use these exact enum sets and predicate rules in the same file:

```ts
const methods = new Set(["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "反吟"]);
const subtypes = new Set(["始入", "元首", "重审", "知一", "见机", "察微", "缀瑕", "蒿矢", "弹射", "虎视", "冬蛇掩目", "不虞", "自任", "自信", "井栏"]);
const variants = new Set(["复等", "杜传"]);
const relations = new Set(["父母", "子孙", "官鬼", "妻财", "兄弟"]);
const monthGeneralNames = new Set(Object.values(ZHONG_QI_TO_MONTH_GENERAL).map(({ name }) => name));
const positions = ["initial", "middle", "final"] as const;
const transmissionLabels = ["初传", "中传", "末传"] as const;
const lessonLabels = ["四课", "三课", "二课", "一课"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function isStemBranch(value: unknown): value is StemBranch {
  if (typeof value !== "string") return false;
  const [stem, branch] = [...value];
  return value.length === 2
    && (HEAVENLY_STEMS as readonly string[]).includes(stem)
    && (EARTHLY_BRANCHES as readonly string[]).includes(branch);
}

function isContext(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["civilDateTime", "effectiveGanzhiDate", "locationName", "lunarDateDisplay", "pillars", "monthBuild", "monthGeneral", "divinationHour"])) return false;
  if (typeof value.civilDateTime !== "string" || typeof value.effectiveGanzhiDate !== "string" || typeof value.locationName !== "string" || typeof value.lunarDateDisplay !== "string") return false;
  if (!isRecord(value.pillars) || !hasExactKeys(value.pillars, ["year", "month", "day", "hour"]) || !Object.values(value.pillars).every(isStemBranch)) return false;
  if (!isRecord(value.monthGeneral) || !hasExactKeys(value.monthGeneral, ["name", "branch"]) || !monthGeneralNames.has(value.monthGeneral.name as never) || !isBranch(value.monthGeneral.branch)) return false;
  return isBranch(value.monthBuild) && isBranch(value.divinationHour);
}

function isMethod(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expectedKeys = value.subtype === undefined ? ["method", "variants"] : ["method", "subtype", "variants"];
  return hasExactKeys(value, expectedKeys)
    && methods.has(value.method as string)
    && (value.subtype === undefined || subtypes.has(value.subtype as string))
    && Array.isArray(value.variants)
    && value.variants.every((variant) => variants.has(variant as string))
    && new Set(value.variants).size === value.variants.length;
}

function transmissionsAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["position", "label", "branch", "relation", "general"])
    && item.position === positions[index]
    && item.label === transmissionLabels[index]
    && isBranch(item.branch)
    && relations.has(item.relation as string)
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string));
}

function lessonsAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["id", "label", "upper", "lower", "general"])
    && item.id === COURSE_LESSON_ORDER[index]
    && item.label === lessonLabels[index]
    && isBranch(item.upper)
    && isRecord(item.lower)
    && hasExactKeys(item.lower, ["kind", "value"])
    && ((item.lower.kind === "branch" && isBranch(item.lower.value))
      || (item.lower.kind === "stem" && typeof item.lower.value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(item.lower.value)))
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string));
}

function palacesAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["earth", "heaven", "general", "noble"])
    && item.earth === COURSE_PALACE_ORDER[index]
    && isBranch(item.heaven)
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string)
    && typeof item.noble === "boolean")
    && new Set(value.map((item) => (item as Record<string, unknown>).heaven)).size === 12
    && new Set(value.map((item) => (item as Record<string, unknown>).general)).size === 12
    && value.filter((item) => (item as Record<string, unknown>).noble).length === 1;
}

function isNoble(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["dayNight", "nobleHeaven", "nobleEarth", "direction"])
    && (value.dayNight === "day" || value.dayNight === "night")
    && isBranch(value.nobleHeaven)
    && isBranch(value.nobleEarth)
    && (value.direction === "forward" || value.direction === "reverse");
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  if (!isRecord(left) || !isRecord(right)) return false;
  return hasExactKeys(right, Object.keys(left)) && Object.entries(left).every(([key, value]) => sameValue(value, right[key]));
}
```

Import `ZHONG_QI_TO_MONTH_GENERAL`, `HEAVENLY_STEMS`, and `EARTHLY_BRANCHES` from the existing calendar constants; do not duplicate the twelve month-general names in the course module. Exact semantic comparison belongs in `matchesCourseInputs`, and every stage/session guard must call it.

- [ ] **Step 4: Implement the composer and earliest-stage invalidation**

Create `compute-course.ts` with these signatures and control flow:

```ts
const COURSE_UPSTREAM_ORDER = ["calendar", "heaven-earth", "four-lessons", "three-transmissions", "heavenly-generals"] as const;

function firstInvalidCourseUpstream(session: CourseSession): typeof COURSE_UPSTREAM_ORDER[number] | undefined {
  for (const [index, stage] of COURSE_UPSTREAM_ORDER.entries()) {
    if (!session.snapshots[stage]) return stage;
    const allowed = new Set(COURSE_UPSTREAM_ORDER.slice(0, index + 1));
    const prefix = {
      ...session,
      snapshots: Object.fromEntries(Object.entries(session.snapshots).filter(([key]) => allowed.has(key as typeof stage))),
    };
    if (validateSession(prefix).length) return stage;
  }
  return undefined;
}

export function computeCourse(
  locationName: string,
  calendar?: CalendarSnapshot,
  lessons?: FourLessonsSnapshot,
  transmissions?: ThreeTransmissionsSnapshot,
  generals?: HeavenlyGeneralsSnapshot,
): CourseOutcome {
  if (!isCalendarSnapshot(calendar)
    || lessons?.stage !== "four-lessons"
    || lessons.ruleId !== FOUR_LESSONS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(lessons.dependsOn, ["calendar", "heaven-earth"])
    || !isFourLessonsResult(lessons.value)
    || transmissions?.stage !== "three-transmissions"
    || transmissions.ruleId !== THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(transmissions.dependsOn, ["heaven-earth", "four-lessons"])
    || !isThreeTransmissionsResult(transmissions.value)
    || generals?.stage !== "heavenly-generals"
    || generals.ruleId !== HEAVENLY_GENERALS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(generals.dependsOn, ["calendar", "heaven-earth", "three-transmissions"])
    || !isHeavenlyGeneralsResult(generals.value)) {
    return { ok: false, error: { code: "INVALID_COURSE_INPUT", message: "缺少有效课式上游快照" } };
  }
  try {
    const value = deriveCourse(locationName, calendar.value, lessons.value, transmissions.value, generals.value);
    if (!isCourseResult(value) || !matchesCourseInputs(value, locationName, calendar.value, lessons.value, transmissions.value, generals.value)) {
      return { ok: false, error: { code: "COURSE_RESULT_GUARD_FAILED", message: "课式结果未通过完整性校验" } };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "course",
        dependsOn: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
        ruleId: COURSE_SNAPSHOT_RULE_ID,
        source: courseResultSource([calendar.source, lessons.source, transmissions.source, generals.source]),
        value,
      },
    };
  } catch (cause) {
    if (cause instanceof CourseProjectionError) {
      return { ok: false, error: { code: "COURSE_GENERAL_MAPPING_INCOMPLETE", message: cause.message, cause } };
    }
    return { ok: false, error: { code: "COURSE_RESULT_INCOMPLETE", message: "课式结果不完整", cause } };
  }
}

export function runCourseStage(session: CourseSession): CourseStageOutcome {
  const invalidStage = firstInvalidCourseUpstream(session);
  if (invalidStage) {
    return {
      ok: false,
      error: { code: "INVALID_COURSE_INPUT", message: `课式上游${invalidStage}无效`, upstreamStage: invalidStage },
      session: invalidateFrom(session, invalidStage),
    };
  }
  const invalidated = invalidateFrom(session, "course");
  const outcome = computeCourse(
    session.input.locationName,
    session.snapshots.calendar as CalendarSnapshot,
    session.snapshots["four-lessons"] as FourLessonsSnapshot,
    session.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
    session.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot,
  );
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return { ok: true, value: outcome.value, session: { ...invalidated, snapshots: { ...invalidated.snapshots, course: outcome.snapshot } } };
}
```

Define the metadata helper immediately above `computeCourse`:

```ts
function dependenciesEqual(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}
```

- [ ] **Step 5: Add upstream, source, and returned-session tests**

Append parameterized tests for all five invalidation boundaries and source propagation:

```ts
it.each([
  ["calendar", []],
  ["heaven-earth", ["calendar"]],
  ["four-lessons", ["calendar", "heaven-earth"]],
  ["three-transmissions", ["calendar", "heaven-earth", "four-lessons"]],
  ["heavenly-generals", ["calendar", "heaven-earth", "four-lessons", "three-transmissions"]],
] as const)("invalid %s preserves only its valid prefix", (stage, preserved) => {
  const broken: CourseSession = {
    ...withoutCourse,
    snapshots: { ...withoutCourse.snapshots, [stage]: undefined },
  };
  const outcome = runCourseStage(broken);
  expect(outcome.ok).toBe(false);
  expect(Object.keys(outcome.session.snapshots)).toEqual(preserved);
  expect(validateSession(outcome.session)).toEqual([]);
});

it("propagates a direct manual source into the composed snapshot", () => {
  const outcome = computeCourse(
    withoutCourse.input.locationName,
    withoutCourse.snapshots.calendar as CalendarSnapshot,
    withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot,
    withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
    { ...(withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot), source: "manual" },
  );
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error.message);
  expect(outcome.snapshot.source).toBe("manual");
});

it("writes the automatic course into a session that remains valid", () => {
  const outcome = runCourseStage(withoutCourse);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error(outcome.error.message);
  expect(outcome.session.snapshots.course?.source).toBe("automatic");
  expect(validateSession(outcome.session)).toEqual([]);
});
```

- [ ] **Step 6: Run GREEN and commit**

Run:

```powershell
npm test -- src/domain/course
```

Expected: PASS.

Commit:

```powershell
git add src/domain/course/result-guard.ts src/domain/course/compute-course.ts src/domain/course/compute-course.test.ts
git commit -m "feat: guard final course snapshot"
```

---

### Task 3: Chart session validation and real reference fixture

**Files:**
- Modify: `src/domain/chart/types.ts`
- Modify: `src/domain/chart/stages.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`

**Interfaces:**
- Consumes: Task 2 `CourseSnapshot`, `isCourseResult`, `matchesCourseInputs`, `courseResultSource`, and `COURSE_SNAPSHOT_RULE_ID`.
- Produces: `isCourseSnapshotForCurrentInputs` for App and a `referenceSession` whose course snapshot is fully canonical.

- [ ] **Step 1: Write failing dependency and canonical-session tests**

Add to `snapshots.test.ts`:

```ts
it("accepts the canonical reference course and exact direct dependencies", () => {
  expect(referenceSession.snapshots.course?.dependsOn).toEqual([
    "calendar", "four-lessons", "three-transmissions", "heavenly-generals",
  ]);
  expect(validateSession(referenceSession)).toEqual([]);
});

it("rejects a structurally legal course whose relation no longer matches three transmissions", () => {
  const snapshot = referenceSession.snapshots.course!;
  const value = snapshot.value as CourseResult;
  const tampered = {
    ...referenceSession,
    snapshots: {
      ...referenceSession.snapshots,
      course: {
        ...snapshot,
        value: {
          ...value,
          transmissions: value.transmissions.map((item, index) => index === 0
            ? { ...item, relation: item.relation === "父母" ? "子孙" as const : "父母" as const }
            : item),
        },
      },
    },
  };
  expect(validateSession(tampered)).toContain("course 与当前起课输入或上游快照不一致");
});
```

- [ ] **Step 2: Run session tests to verify RED**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: FAIL because the reference course still has layout-only metadata and old dependencies.

- [ ] **Step 3: Replace the layout-only chart contract and dependencies**

In `chart/types.ts`, remove the legacy `CourseResult` interface entirely. Keep `RuleSnapshots.course` as `RuleSnapshot<unknown, "course">`; domain consumers import `CourseResult` from `domain/course/types.ts`.

In `chart/stages.ts`, set:

```ts
course: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
```

- [ ] **Step 4: Add canonical course validation to the session validator**

In `snapshots.ts`, export:

```ts
export function isCourseSnapshotForCurrentInputs(
  snapshot: RuleSnapshot<unknown, "course"> | undefined,
  locationName: string | undefined,
  calendar: CalendarSnapshot | undefined,
  lessons: RuleSnapshot<unknown, "four-lessons"> | undefined,
  transmissions: RuleSnapshot<unknown, "three-transmissions"> | undefined,
  generals: RuleSnapshot<unknown, "heavenly-generals"> | undefined,
): snapshot is CourseSnapshot {
  return Boolean(
    snapshot
    && locationName !== undefined
    && snapshot.stage === "course"
    && dependenciesEqual(snapshot.dependsOn, stageDependencies.course)
    && snapshot.ruleId === COURSE_SNAPSHOT_RULE_ID
    && isCalendarSnapshot(calendar)
    && lessons && isFourLessonsResult(lessons.value)
    && transmissions && isThreeTransmissionsResult(transmissions.value)
    && generals && isHeavenlyGeneralsResult(generals.value)
    && snapshot.source === courseResultSource([calendar.source, lessons.source, transmissions.source, generals.source])
    && isCourseResult(snapshot.value)
    && matchesCourseInputs(snapshot.value, locationName, calendar.value, lessons.value, transmissions.value, generals.value)
  );
}
```

Reuse one local `dependenciesEqual` helper for the existing dependency comparisons without changing other stage semantics. Add a `stage === "course"` branch to `validateSession` that emits stable messages for rule ID, source, structure, and canonical mismatch.

- [ ] **Step 5: Derive the reference course instead of storing layout-only data**

In `reference-session.ts`, construct the course snapshot after `heavenlyGeneralsSnapshot`:

```ts
const courseValue = deriveCourse(
  referenceInput.locationName,
  calendarSnapshot.value,
  fourLessonsSnapshot.value,
  threeTransmissionsSnapshot.value,
  heavenlyGeneralsSnapshot.value,
);

const courseSnapshot = {
  stage: "course",
  dependsOn: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
  ruleId: COURSE_SNAPSHOT_RULE_ID,
  source: courseResultSource([
    calendarSnapshot.source,
    fourLessonsSnapshot.source,
    threeTransmissionsSnapshot.source,
    heavenlyGeneralsSnapshot.source,
  ]),
  value: courseValue,
} as const satisfies CourseSnapshot;
```

Replace the existing `course` property created by the local `snapshot` helper with `course: courseSnapshot`, then remove the no-longer-used layout-only `snapshot` helper and `CourseResult` import.

- [ ] **Step 6: Run GREEN and commit**

Run:

```powershell
npm test -- src/domain/chart/snapshots.test.ts src/domain/course
```

Expected: PASS.

Commit:

```powershell
git add src/domain/chart/types.ts src/domain/chart/stages.ts src/domain/chart/snapshots.ts src/domain/chart/snapshots.test.ts src/test/reference-session.ts
git commit -m "feat: connect canonical course session"
```

---

### Task 4: Approved course sheet and clipboard interaction

**Files:**
- Modify: `src/features/course-sheet/CourseSheet.tsx`
- Modify: `src/features/course-sheet/CourseSheet.test.tsx`
- Modify: `src/styles/global.css`
- Delete: `src/features/course-sheet/view-model.ts`
- Delete: `src/features/course-sheet/view-model.test.ts`

**Interfaces:**
- Consumes: Task 1 `CourseResult` and `serializeCourseText`.
- Produces: `CourseSheet({ result }: { result: CourseResult })` with `data-course-section` markers and an accessible clipboard interaction.

- [ ] **Step 1: Replace the old component test with approved-layout RED tests**

Write `CourseSheet.test.tsx` against the canonical reference result:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { CourseResult } from "../../domain/course/types";
import { serializeCourseText } from "../../domain/course/policy";
import { referenceSession } from "../../test/reference-session";
import { CourseSheet } from "./CourseSheet";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const result = referenceSession.snapshots.course!.value as CourseResult;

it("renders the approved reading order and enclosing palace square", () => {
  render(<CourseSheet result={result} />);
  expect(screen.getAllByTestId("course-transmission").map((node) => node.getAttribute("data-position")))
    .toEqual(["initial", "middle", "final"]);
  expect(screen.getAllByTestId("course-lesson").map((node) => node.getAttribute("data-lesson")))
    .toEqual(["fourth", "third", "second", "first"]);
  const firstTransmission = screen.getAllByTestId("course-transmission")[0];
  expect([...firstTransmission.children].map((node) => node.getAttribute("data-layer")))
    .toEqual(["general", "content"]);
  const firstLesson = screen.getAllByTestId("course-lesson")[0];
  expect(firstLesson.firstElementChild).toHaveAttribute("data-layer", "general");
  const plate = screen.getByRole("list", { name: "标准课式十二宫方盘" });
  expect(within(plate).getAllByRole("listitem")).toHaveLength(12);
  expect(screen.getByTestId("course-plate-center")).toHaveTextContent("月将");
});

it("copies the exact serializer output and reports success", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式" }));
  expect(writeText).toHaveBeenCalledWith(serializeCourseText(result));
  expect(screen.getByRole("status")).toHaveTextContent("课式已复制");
  await userEvent.click(screen.getByRole("button", { name: "已复制" }));
  expect(writeText).toHaveBeenCalledTimes(2);
});

it("keeps the result visible and reports clipboard failure", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式" }));
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/features/course-sheet/CourseSheet.test.tsx
```

Expected: FAIL because `CourseSheet` still accepts the layout-only model and lacks approved structure and clipboard behavior.

- [ ] **Step 3: Implement the minimal direct-result component**

Replace `CourseSheet.tsx` with this direct-result structure. Keep the mapped content in this DOM order so the test and mobile flow remain stable:

```tsx
import { useEffect, useRef, useState } from "react";
import { serializeCourseText } from "../../domain/course/policy";
import type { CourseResult } from "../../domain/course/types";

const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

export function CourseSheet({ result }: { result: CourseResult }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | undefined>(undefined);
  const methodText = [result.method.method, result.method.subtype, result.method.variants.length ? result.method.variants.join("/") : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  async function copyCourse() {
    try {
      await navigator.clipboard.writeText(serializeCourseText(result));
      setCopyState("copied");
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
    }
  }

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  return (
    <article className="course-sheet" aria-label="标准文字课式">
      <header className="course-sheet__summary" data-course-section="summary">
        <div>
          <p>第六阶段 · 已验证事实投影</p>
          <h2>大六壬 · 标准文字课式</h2>
          <span>{result.context.locationName} · {result.context.lunarDateDisplay}</span>
        </div>
        <dl>
          <div><dt>北京时间</dt><dd>{result.context.civilDateTime}</dd></div>
          <div><dt>生效干支日</dt><dd>{result.context.effectiveGanzhiDate}</dd></div>
          <div><dt>四柱</dt><dd>{Object.values(result.context.pillars).join("　")}</dd></div>
          <div><dt>月建 / 月将</dt><dd>{result.context.monthBuild} · {result.context.monthGeneral.name}{result.context.monthGeneral.branch}</dd></div>
        </dl>
      </header>
      <div className="course-sheet__body">
        <div className="course-sheet__left">
          <section className="course-sheet__transmissions" data-course-section="transmissions">
            <h3>三传 · {methodText}</h3>
            <ol>
              {result.transmissions.map((item) => (
                <li key={item.position} data-testid="course-transmission" data-position={item.position}>
                  <b data-layer="general">{item.general}</b>
                  <div data-layer="content"><span>{item.label}</span><strong>{item.branch}</strong><small>{item.relation}</small></div>
                </li>
              ))}
            </ol>
          </section>
          <section className="course-sheet__lessons" data-course-section="lessons">
            <h3>四课</h3>
            <ol>
              {result.lessons.map((item) => (
                <li key={item.id} data-testid="course-lesson" data-lesson={item.id}>
                  <b data-layer="general">{item.general}</b>
                  <span>{item.label}</span><strong>{item.upper}</strong><i /><small>{item.lower.value}</small>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <section className="course-sheet__plate-region" data-course-section="palaces">
          <p className="course-sheet__orientation">上南 · 下北 · 左东 · 右西</p>
          <div className="course-sheet__plate-layout">
            <ul className="course-sheet__plate" aria-label="标准课式十二宫方盘">
              {result.palaces.map((item) => (
                <li key={item.earth} data-earth={item.earth} data-noble={item.noble}>
                  <strong>{item.general}</strong><span>天盘 {item.heaven}</span><span>地盘 {item.earth}</span>
                </li>
              ))}
            </ul>
            <div className="course-sheet__plate-center" data-testid="course-plate-center">
              <small>月将 / 占时</small>
              <strong>{result.context.monthGeneral.name}{result.context.monthGeneral.branch} · {result.context.divinationHour}时</strong>
              <small>{dayNightText[result.noble.dayNight]}贵{result.noble.nobleHeaven} · 落{result.noble.nobleEarth}宫 · {directionText[result.noble.direction]}布</small>
            </div>
          </div>
        </section>
      </div>
      <footer className="course-sheet__copy" data-course-section="copy">
        <span>复制内容使用稳定纯文本分段</span>
        <button type="button" onClick={copyCourse}>{copyState === "copied" ? "已复制" : "复制课式"}</button>
        {copyState === "copied" ? <p role="status">课式已复制</p> : null}
        {copyState === "error" ? <p role="alert">复制失败，请重试</p> : null}
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Replace layout-only CSS with approved responsive CSS**

Replace the existing `.course-sheet` block with focused rules using the approved proportions and perimeter coordinates:

```css
.course-sheet { min-width: 0; padding: 24px; border-block: 1px solid var(--patina); background: var(--ink); color: var(--ash); }
.course-sheet__summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--patina); }
.course-sheet__summary p, .course-sheet__summary dt, .course-sheet h3, .course-sheet__orientation { color: var(--ru-celadon); font-size: .76rem; letter-spacing: .12em; }
.course-sheet__summary h2 { margin: 4px 0; color: var(--ash); font-size: clamp(1.45rem, 3vw, 2.25rem); letter-spacing: .1em; }
.course-sheet__summary dl { display: grid; gap: 8px; margin: 0; }
.course-sheet__summary dd { margin: 3px 0 0; }
.course-sheet__body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr); gap: 24px; margin-top: 20px; }
.course-sheet__left { display: grid; grid-template-rows: minmax(0, 1.2fr) minmax(0, .9fr); gap: 18px; min-width: 0; }
.course-sheet h3 { margin: 0 0 8px; font-weight: 500; }
.course-sheet ol, .course-sheet ul { margin: 0; padding: 0; list-style: none; }
.course-sheet__transmissions ol { display: grid; grid-template-rows: repeat(3, minmax(78px, 1fr)); gap: 1px; background: var(--patina); }
.course-sheet__transmissions li { display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: stretch; background: var(--ink); }
.course-sheet [data-layer="general"] { display: grid; place-content: center; border-inline-end: 1px solid var(--patina); color: var(--old-gold); font-weight: 500; letter-spacing: .08em; }
.course-sheet__transmissions [data-layer="content"] { display: grid; grid-template-columns: 70px 1fr auto; align-items: center; gap: 10px; padding: 10px 16px; }
.course-sheet__transmissions strong { font-size: clamp(1.5rem, 3vw, 2rem); }
.course-sheet__transmissions small { color: var(--ru-celadon); }
.course-sheet__lessons ol { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--patina); }
.course-sheet__lessons li { display: grid; place-items: center; gap: 6px; min-height: 142px; padding: 8px 5px 12px; background: var(--ink); }
.course-sheet__lessons [data-layer="general"] { align-self: stretch; width: 100%; padding-bottom: 7px; border-inline-end: 0; border-bottom: 1px solid var(--patina); }
.course-sheet__lessons strong { font-size: clamp(1.45rem, 3vw, 1.9rem); }
.course-sheet__lessons i { width: 55%; border-top: 1px solid var(--ru-celadon); }
.course-sheet__plate-region { min-width: 0; }
.course-sheet__orientation { margin: 0 0 8px; text-align: center; }
.course-sheet__plate-layout { position: relative; }
.course-sheet__plate { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, minmax(0, 1fr)); width: 100%; aspect-ratio: 1; gap: 1px; background: var(--patina); }
.course-sheet__plate li { display: grid; place-content: center; gap: 3px; min-width: 0; padding: 6px; background: var(--ink); text-align: center; }
.course-sheet__plate li strong { font-size: clamp(1rem, 2.3vw, 1.45rem); }
.course-sheet__plate li span { color: var(--ru-celadon); font-size: clamp(.62rem, 1.25vw, .76rem); }
.course-sheet__plate li[data-noble="true"] strong { color: var(--old-gold); }
.course-sheet__plate li:nth-child(1) { grid-area: 1 / 1; }
.course-sheet__plate li:nth-child(2) { grid-area: 1 / 2; }
.course-sheet__plate li:nth-child(3) { grid-area: 1 / 3; }
.course-sheet__plate li:nth-child(4) { grid-area: 1 / 4; }
.course-sheet__plate li:nth-child(5) { grid-area: 2 / 4; }
.course-sheet__plate li:nth-child(6) { grid-area: 3 / 4; }
.course-sheet__plate li:nth-child(7) { grid-area: 4 / 4; }
.course-sheet__plate li:nth-child(8) { grid-area: 4 / 3; }
.course-sheet__plate li:nth-child(9) { grid-area: 4 / 2; }
.course-sheet__plate li:nth-child(10) { grid-area: 4 / 1; }
.course-sheet__plate li:nth-child(11) { grid-area: 3 / 1; }
.course-sheet__plate li:nth-child(12) { grid-area: 2 / 1; }
.course-sheet__plate-center { display: grid; position: absolute; inset: 25%; place-content: center; gap: 8px; padding: 12px; border: 1px solid var(--patina); background: var(--dark-bronze); text-align: center; }
.course-sheet__plate-center strong { color: var(--old-gold); }
.course-sheet__plate-center small { color: var(--ru-celadon); }
.course-sheet__copy { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--patina); }
.course-sheet__copy button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--ru-celadon); border-radius: 0; background: transparent; color: var(--ash); cursor: pointer; }
.course-sheet__copy [role="alert"] { color: var(--error); }
@media (max-width: 760px) {
  .course-sheet { padding: 16px; }
  .course-sheet__summary, .course-sheet__body { grid-template-columns: minmax(0, 1fr); }
  .course-sheet__left { display: contents; }
  .course-sheet__transmissions { order: 1; }
  .course-sheet__lessons { order: 2; }
  .course-sheet__plate-region { order: 3; margin-top: 20px; }
  .course-sheet__lessons ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .course-sheet__copy { align-items: stretch; flex-direction: column; }
}
```

Do not add `overflow: hidden` to the document or remove the existing focus-visible rule.

- [ ] **Step 5: Delete the redundant view model and run GREEN**

Delete `view-model.ts` and `view-model.test.ts`, then remove all imports of `toCourseSheetModel`.

Run:

```powershell
npm test -- src/features/course-sheet
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/course-sheet src/styles/global.css
git commit -m "feat: render and copy standard course"
```

---

### Task 5: App terminal stage and fully completed rail

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/rule-review/RuleStageRail.tsx`
- Modify: `src/features/rule-review/RuleStageRail.test.tsx`

**Interfaces:**
- Consumes: Task 2 `runCourseStage`, Task 3 `isCourseSnapshotForCurrentInputs`, and Task 4 `CourseSheet`.
- Produces: automatic course generation, `ReviewStage` navigation through `course`, and `RuleStageRail` with optional `current`.

- [ ] **Step 1: Write failing final-stage App and rail tests**

Add tests that submit the existing reference form and assert:

```tsx
it("generates and selects the real course after heavenly generals", async () => {
  render(<App />);
  await submitCourse();
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  for (const name of ["历法与月将", "天地盘加临", "四课生成", "三传取法", "天将排列", "复制结课"]) {
    expect(screen.getByRole("button", { name: `${name}，已完成` })).toBeVisible();
  }
  expect(screen.queryByLabelText(/进行中/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("aria-current", "page");
});

it("returns to heavenly generals and back to the completed course without recomputing", async () => {
  render(<App />);
  const user = await submitCourse();
  await user.click(screen.getByRole("button", { name: "天将排列，已完成" }));
  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "复制结课，已完成" }));
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});
```

Add a rail-only test:

```tsx
render(<RuleStageRail completed={RULE_STAGE_ORDER} selected="course" />);
expect(screen.queryByText(/进行中/)).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("aria-current", "page");
```

- [ ] **Step 2: Run App and rail tests to verify RED**

Run:

```powershell
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
```

Expected: FAIL because the App stops on heavenly generals and the rail requires a current stage.

- [ ] **Step 3: Allow a rail with no current step**

Change the prop to:

```ts
interface RuleStageRailProps {
  completed: readonly RuleStageId[];
  current?: RuleStageId;
  selected?: RuleStageId;
  onSelect?: (stage: RuleStageId) => void;
}
```

Keep status precedence as completed → current → locked. With all stages completed and `current` omitted, every item remains a keyboard-focusable completed button.

- [ ] **Step 4: Wire the course stage into App**

In `App.tsx`:

- extend `ReviewStage` with `"course"`;
- extend `StageError` with `CourseStageOutcome` failure;
- read and guard the course snapshot with `isCourseSnapshotForCurrentInputs`;
- after successful `runHeavenlyGeneralsStage`, call `runCourseStage`;
- on course failure, keep its returned session, select `heavenly-generals`, and show its error;
- on success, keep its session and select `course`;
- include `course` in `completed` only when the canonical guard passes;
- compute the optional current stage with the exact expression below;
- allow selecting every completed stage including `course`;
- render `<CourseSheet result={courseResult} />` only when the canonical guard succeeds.

The success tail of `replaceFrom` must be:

```ts
const courseOutcome = runCourseStage(generalsOutcome.session);
if (!courseOutcome.ok) {
  setSession(courseOutcome.session);
  setReviewStage("heavenly-generals");
  setStageError(courseOutcome.error);
  return;
}
setSession(courseOutcome.session);
setReviewStage("course");
setStageError(null);
```

After building `completed`, derive the optional current stage exactly as follows:

```ts
const current: RuleStageId | undefined = hasCourse
  ? undefined
  : hasHeavenlyGenerals
    ? "course"
    : hasThreeTransmissions
      ? "heavenly-generals"
      : hasFourLessons
        ? "three-transmissions"
        : hasHeavenEarth
          ? "four-lessons"
          : hasCalendar
            ? "heaven-earth"
            : "calendar";
```

- [ ] **Step 5: Add failure and correction invalidation assertions**

Import the module namespace in `App.test.tsx`:

```ts
import * as courseStage from "../domain/course/compute-course";
```

Add these tests:

```tsx
it("keeps five valid upstream stages when final course projection fails", async () => {
  vi.spyOn(courseStage, "runCourseStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "COURSE_RESULT_GUARD_FAILED", message: "课式结果未通过完整性校验" },
    session,
  }));
  render(<App />);
  await submitCourse();
  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  for (const name of ["历法与月将", "天地盘加临", "四课生成", "三传取法", "天将排列"]) {
    expect(screen.getByRole("button", { name: `${name}，已完成` })).toBeVisible();
  }
  expect(screen.getByText("复制结课")).toHaveAttribute("data-status", "current");
  expect(screen.getByRole("alert")).toHaveTextContent("课式结果未通过完整性校验");
  expect(screen.queryByRole("article", { name: "标准文字课式" })).not.toBeInTheDocument();
});

it("replaces the completed course after a day-pillar correction and reset", async () => {
  render(<App />);
  const user = await submitCourse();
  expect(screen.getByRole("article", { name: "标准文字课式" })).toHaveTextContent("甲辰");
  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正日柱" }), "乙巳");
  expect(screen.getByRole("article", { name: "标准文字课式" })).toHaveTextContent("乙巳");
  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*有效 乙巳.*人工修正/ }));
  await user.click(screen.getByRole("button", { name: "恢复日柱自动值" }));
  expect(screen.getByRole("article", { name: "标准文字课式" })).toHaveTextContent("甲辰");
});
```

- [ ] **Step 6: Run GREEN and commit**

Run:

```powershell
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx src/features/course-sheet/CourseSheet.test.tsx
```

Expected: PASS.

Commit:

```powershell
git add src/app/App.tsx src/app/App.test.tsx src/features/rule-review/RuleStageRail.tsx src/features/rule-review/RuleStageRail.test.tsx
git commit -m "feat: complete course stage flow"
```

---

### Task 6: Traceability, browser coverage, and final verification

**Files:**
- Create: `docs/rule-cases/course-v1.md`
- Create: `e2e/course-sheet.spec.ts`
- Modify: `e2e/heavenly-generals.spec.ts`

**Interfaces:**
- Consumes: the complete user-visible six-stage flow.
- Produces: field provenance, desktop/mobile/offline browser coverage, and final regression evidence.

- [ ] **Step 1: Write the course traceability ledger**

Create `docs/rule-cases/course-v1.md` with these exact rows:

```md
| Course field group | Authoritative upstream | Exact regression |
| --- | --- | --- |
| Time, lunar date, pillars, month build, month general, divination hour | `CalendarResult` | `course/policy.test.ts` context projection and `calendar` canonical tests |
| Location name | submitted `CourseInput.locationName` | `course/policy.test.ts` context projection |
| Method, subtype, variants, transmission branches, six relations | `ThreeTransmissionsResult` | `course/policy.test.ts` method/transmission projection and three-transmissions policy tests |
| Four lesson upper/lower values | `FourLessonsResult` | `course/policy.test.ts` lesson projection and four-lessons policy tests |
| Transmission and lesson generals | `HeavenlyGeneralsResult` lookup by heaven branch | `course/policy.test.ts` general mapping and heavenly-generals lookup tests |
| Twelve palace earth/heaven/general mapping | `HeavenlyGeneralsResult.placements` | `course/policy.test.ts` palace projection and heavenly-generals placement tests |
| Day/night noble, noble heaven branch, noble earth palace, direction | `HeavenlyGeneralsResult` | `course/policy.test.ts` noble projection and heavenly-generals policy tests |
```

Below the table, state that `course/verified-projection-v1` adds no traditional rule and explicitly excludes hidden stems, spirits, new lesson patterns, interpretations, 3D, image export, and printing.

- [ ] **Step 2: Write failing desktop, mobile, clipboard, and offline E2E tests**

Create `e2e/course-sheet.spec.ts` with the existing form helper values:

```ts
import { expect, test, type Page } from "@playwright/test";

async function submitReferenceCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

test("renders, copies, and navigates the completed standard course", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  await expect(page.getByTestId("course-transmission")).toHaveCount(3);
  await expect(page.getByTestId("course-lesson")).toHaveCount(4);
  await expect(page.getByRole("list", { name: "标准课式十二宫方盘" }).locator(":scope > li")).toHaveCount(12);
  await page.getByRole("button", { name: "复制课式" }).click();
  await expect(page.getByRole("status")).toHaveText("课式已复制");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("大六壬标准课式\n");
  await page.getByRole("button", { name: "天将排列，已完成" }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await page.getByRole("button", { name: "复制结课，已完成" }).click();
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});

test("390x844 preserves approved order, hierarchy, and square without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitReferenceCourse(page);
  expect(await page.locator("[data-course-section]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-course-section"))))
    .toEqual(["summary", "transmissions", "lessons", "palaces", "copy"]);
  await expect(page.getByRole("list", { name: "标准课式十二宫方盘" })).toHaveCSS("grid-template-columns", /.+ .+ .+ .+/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("derives and copies the complete course after the app goes offline", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await context.setOffline(true);
  await submitReferenceCourse(page);
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  await page.getByRole("button", { name: "复制课式" }).click();
  await expect(page.getByRole("status")).toHaveText("课式已复制");
});
```

- [ ] **Step 3: Run the new E2E file to verify RED before App wiring is complete**

Run:

```powershell
npm run test:e2e -- e2e/course-sheet.spec.ts
```

Expected RED: the standard course article and completed course button are absent.

- [ ] **Step 4: Update heavenly-generals terminal-page assumptions**

In every test in `e2e/heavenly-generals.spec.ts`, immediately after `submitReferenceCourse(page)`, click:

```ts
await page.getByRole("button", { name: /天将排列，已完成/ }).click();
```

Do not weaken the existing heading, palace count, mobile order, focus, navigation, or offline assertions.

- [ ] **Step 5: Run complete verification**

Run every command separately and inspect each exit code:

```powershell
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected:

- all Vitest files pass with zero failures;
- TypeScript and Vite build succeed; the existing bundle-size warning remains non-blocking;
- all Playwright tests pass;
- no whitespace errors;
- status contains only the intentional Task 6 files before commit and is clean after commit.

- [ ] **Step 6: Commit**

```powershell
git add docs/rule-cases/course-v1.md e2e/course-sheet.spec.ts e2e/heavenly-generals.spec.ts
git commit -m "test: cover completed course flow"
```

---

## Final Review Checklist

- [ ] `course` contains only facts from the approved direct upstreams and submitted location name.
- [ ] The result exposes context, method, transmissions, lessons, palaces, and noble groups with exact keys.
- [ ] Three-transmissions relation, method, subtype, and variants are copied rather than recalculated.
- [ ] Transmissions and lessons query one heavenly-generals result by heaven branch.
- [ ] Twelve palaces preserve the approved `巳 午 未 申 酉 戌 亥 子 丑 寅 卯 辰` visual order.
- [ ] Structural guards reject missing, extra, duplicated, misordered, and invalid-enum fields.
- [ ] Canonical guards reject present-but-wrong context, relation, method, lesson, palace, general, noble, source, rule ID, and dependency values.
- [ ] Stage failures invalidate from the earliest bad upstream and every returned session validates.
- [ ] A projection failure removes only `course` and retains all five valid upstreams.
- [ ] Desktop uses the approved near-equal two-column desk layout.
- [ ] Transmissions are vertical and every general precedes its transmission/lesson content in DOM order.
- [ ] The palace is a 4×4 enclosing square with a center summary, not a 3×4 list.
- [ ] Mobile order is summary → transmissions → lessons → palaces → copy with no overflow.
- [ ] Plain text uses only LF, exact stable sections, twelve palace lines, and no Markdown.
- [ ] Clipboard success and failure are accessible and never mutate the session.
- [ ] All six stages are completed and selectable with no false current step.
- [ ] No hidden stems, spirits, new lesson-pattern rules, interpretations, 3D, image export, printing, new dependency, or unrelated refactor was added.
- [ ] Full tests, build, E2E, diff check, and clean status are freshly verified.
