# Four Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the third rule stage so a valid calendar snapshot and heaven-earth snapshot produce a guarded, auditable four-lessons snapshot and a traditional four-to-one review UI.

**Architecture:** Add a focused `src/domain/four-lessons` module whose pure policy derives the canonical one-to-four result and whose stage composer validates both upstream snapshots before replacing downstream state. Keep canonical storage order separate from visual order; React renders the snapshot only, while `validateSession` performs cross-snapshot integrity checks.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 3, Testing Library, Playwright 1.62, Vite 7, existing CSS token system.

## Global Constraints

- Use the fixed stem residences: 甲寅、乙辰、丙戊巳、丁己未、庚申、辛戌、壬亥、癸丑.
- Derive lessons only from the effective day pillar and guarded heaven-earth plate; expose no four-lessons correction control.
- Store lessons in canonical order 一、二、三、四 and render them in traditional order 四、三、二、一.
- Preserve all four positions when lesson bodies repeat.
- Do not calculate kinship, three transmissions, or heavenly generals in this stage.
- Render “待天将加临” as UI copy only; do not add a nullable general field to the domain result.
- A failed run removes `four-lessons` and every transitive downstream snapshot while retaining valid `calendar` and `heaven-earth` snapshots.
- Follow TDD for every behavior change and do not add runtime dependencies.

---

## File Structure

**Create**

- `src/domain/four-lessons/types.ts` — result, evidence, snapshot, and outcome contracts.
- `src/domain/four-lessons/policy.ts` — fixed stem residences and pure four-lessons derivation.
- `src/domain/four-lessons/policy.test.ts` — residence table, reference result, chaining, and repetition tests.
- `src/domain/four-lessons/result-guard.ts` — structural and canonical input/result guards plus source derivation.
- `src/domain/four-lessons/compute-four-lessons.ts` — snapshot composer and session-stage runner.
- `src/domain/four-lessons/compute-four-lessons.test.ts` — invalid input, forged result, source, and invalidation tests.
- `src/features/four-lessons-review/FourLessonsReview.tsx` — traditional four-card review and evidence interaction.
- `src/features/four-lessons-review/FourLessonsReview.test.tsx` — DOM order, evidence, focus, and navigation tests.
- `e2e/four-lessons.spec.ts` — desktop/mobile/offline stage regression.

**Modify**

- `src/domain/chart/stages.ts` — declare both direct dependencies of `four-lessons`.
- `src/domain/chart/snapshots.ts` — validate four-lessons metadata and cross-snapshot consistency.
- `src/domain/chart/snapshots.test.ts` — update dependency assertions and add forged four-lessons cases.
- `src/test/reference-session.ts` — replace the layout-only four-lessons fixture with the real derived snapshot.
- `src/app/App.tsx` — run, select, and render the third stage.
- `src/app/App.test.tsx` — verify orchestration, rail progression, correction reruns, and failure fallback.
- `src/styles/global.css` — style the four-card review, narrow viewport, and evidence panel.
- `e2e/heaven-earth.spec.ts` — navigate back to the now-completed heaven-earth stage before plate assertions.

---

### Task 1: Pure Four-Lessons Policy

**Files:**

- Create: `src/domain/four-lessons/types.ts`
- Create: `src/domain/four-lessons/policy.ts`
- Create: `src/domain/four-lessons/policy.test.ts`

**Interfaces:**

- Consumes: `CalendarResult`, `StemBranch`, `HeavenEarthResult`, `HeavenlyStem`, `EarthlyBranch`, `RuleSnapshot`, `CourseSession`, `ValueSource`.
- Produces: `STEM_RESIDENCES`, `FOUR_LESSONS_RULE_ID`, `FOUR_LESSONS_STEM_RESIDENCE_RULE_ID`, and `deriveFourLessons(calendar: CalendarResult, plate: HeavenEarthResult): FourLessonsResult`.

- [ ] **Step 1: Define the result and stage contracts**

Create `src/domain/four-lessons/types.ts` with these exact public shapes:

```ts
import type { StemBranch } from "../calendar/types";
import type {
  CourseSession,
  EarthlyBranch,
  HeavenlyStem,
  RuleSnapshot,
} from "../chart/types";

export type FourLessonId = "first" | "second" | "third" | "fourth";
export type FourLessonLabel = "一课" | "二课" | "三课" | "四课";
export type FourLessonLower =
  | { kind: "stem"; value: HeavenlyStem }
  | { kind: "branch"; value: EarthlyBranch };

export interface FourLesson {
  id: FourLessonId;
  label: FourLessonLabel;
  upper: EarthlyBranch;
  lower: FourLessonLower;
  lookupEarth: EarthlyBranch;
}

export interface FourLessonsEvidenceStep {
  ruleId: "four-lessons/stem-residence-v1" | "four-lessons/derive-v1";
  lesson: FourLessonId;
  input: string;
  lookupEarth: EarthlyBranch;
  conclusion: string;
}

export interface FourLessonsResult {
  dayPillar: StemBranch;
  stemResidence: { stem: HeavenlyStem; earth: EarthlyBranch };
  lessons: readonly [FourLesson, FourLesson, FourLesson, FourLesson];
  evidence: readonly FourLessonsEvidenceStep[];
}

export type FourLessonsErrorCode =
  | "INVALID_FOUR_LESSONS_INPUT"
  | "FOUR_LESSONS_RESULT_INCOMPLETE";
export type FourLessonsSnapshot = RuleSnapshot<FourLessonsResult, "four-lessons">;
export type FourLessonsOutcome =
  | { ok: true; value: FourLessonsResult; snapshot: FourLessonsSnapshot }
  | { ok: false; error: { code: FourLessonsErrorCode; message: string; cause?: unknown } };
export type FourLessonsStageOutcome =
  | { ok: true; value: FourLessonsResult; session: CourseSession }
  | {
      ok: false;
      error: { code: FourLessonsErrorCode; message: string; cause?: unknown };
      session: CourseSession;
    };
```

- [ ] **Step 2: Write failing pure-policy tests**

Create `src/domain/four-lessons/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveHeavenEarth } from "../heaven-earth/policy";
import { referenceSession } from "../../test/reference-session";
import { deriveFourLessons, STEM_RESIDENCES } from "./policy";

describe("STEM_RESIDENCES", () => {
  it("maps all ten stems to the fixed traditional palaces", () => {
    expect(STEM_RESIDENCES).toEqual({
      甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
      己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
    });
  });
});

describe("deriveFourLessons", () => {
  it("derives the 辛酉 reference chain in canonical order", () => {
    const calendar = referenceSession.snapshots.calendar!.value;
    const result = deriveFourLessons(calendar, deriveHeavenEarth(calendar));

    expect(result.dayPillar).toBe("辛酉");
    expect(result.stemResidence).toEqual({ stem: "辛", earth: "戌" });
    expect(result.lessons).toEqual([
      { id: "first", label: "一课", upper: "辰", lower: { kind: "stem", value: "辛" }, lookupEarth: "戌" },
      { id: "second", label: "二课", upper: "戌", lower: { kind: "branch", value: "辰" }, lookupEarth: "辰" },
      { id: "third", label: "三课", upper: "卯", lower: { kind: "branch", value: "酉" }, lookupEarth: "酉" },
      { id: "fourth", label: "四课", upper: "酉", lower: { kind: "branch", value: "卯" }, lookupEarth: "卯" },
    ]);
    expect(result.evidence).toHaveLength(5);
    expect(result.evidence[0]).toMatchObject({
      ruleId: "four-lessons/stem-residence-v1",
      lesson: "first",
      lookupEarth: "戌",
    });
  });

  it("keeps four positions when the plate makes lesson bodies repeat", () => {
    const calendar = referenceSession.snapshots.calendar!.value;
    const identityPlate = deriveHeavenEarth({
      ...calendar,
      monthGeneral: { automatic: { name: "神后", branch: "子" }, effective: { name: "神后", branch: "子" }, source: "automatic" },
      divinationHour: { automatic: "子", effective: "子", source: "automatic" },
    });

    const result = deriveFourLessons(calendar, identityPlate);

    expect(result.lessons).toHaveLength(4);
    expect(result.lessons.map(({ id }) => id)).toEqual(["first", "second", "third", "fourth"]);
    expect(result.lessons[0].upper).toBe(result.lessons[1].upper);
    expect(result.lessons[2].upper).toBe(result.lessons[3].upper);
  });
});
```

- [ ] **Step 3: Run the policy test and confirm RED**

Run:

```powershell
npm test -- src/domain/four-lessons/policy.test.ts
```

Expected: FAIL because `./policy` does not exist.

- [ ] **Step 4: Implement the minimal pure policy**

Create `src/domain/four-lessons/policy.ts`. Use these exports and keep the four lookups explicit:

```ts
import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import type { FourLesson, FourLessonsResult } from "./types";

export const FOUR_LESSONS_STEM_RESIDENCE_RULE_ID = "four-lessons/stem-residence-v1";
export const FOUR_LESSONS_RULE_ID = "four-lessons/derive-v1";

export const STEM_RESIDENCES: Readonly<Record<HeavenlyStem, EarthlyBranch>> = {
  甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
  己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
};

export function deriveFourLessons(calendar: CalendarResult, plate: HeavenEarthResult): FourLessonsResult {
  const dayPillar = calendar.pillars.day.effective;
  const stem = dayPillar[0] as HeavenlyStem;
  const branch = dayPillar[1] as EarthlyBranch;
  const residence = STEM_RESIDENCES[stem];
  const heavenAt = (earth: EarthlyBranch) => {
    const palace = plate.palaces.find((item) => item.earth === earth);
    if (!palace) throw new Error(`天地盘缺少地盘${earth}宫`);
    return palace.heaven;
  };
  const firstUpper = heavenAt(residence);
  const secondUpper = heavenAt(firstUpper);
  const thirdUpper = heavenAt(branch);
  const fourthUpper = heavenAt(thirdUpper);
  const lessons: [FourLesson, FourLesson, FourLesson, FourLesson] = [
    { id: "first", label: "一课", upper: firstUpper, lower: { kind: "stem", value: stem }, lookupEarth: residence },
    { id: "second", label: "二课", upper: secondUpper, lower: { kind: "branch", value: firstUpper }, lookupEarth: firstUpper },
    { id: "third", label: "三课", upper: thirdUpper, lower: { kind: "branch", value: branch }, lookupEarth: branch },
    { id: "fourth", label: "四课", upper: fourthUpper, lower: { kind: "branch", value: thirdUpper }, lookupEarth: thirdUpper },
  ];
  return {
    dayPillar,
    stemResidence: { stem, earth: residence },
    lessons,
    evidence: [
      { ruleId: FOUR_LESSONS_STEM_RESIDENCE_RULE_ID, lesson: "first", input: `生效日干 ${stem}`, lookupEarth: residence, conclusion: `${stem}寄${residence}` },
      ...lessons.map((lesson) => ({
        ruleId: FOUR_LESSONS_RULE_ID,
        lesson: lesson.id,
        input: `${lesson.label}查地盘${lesson.lookupEarth}宫`,
        lookupEarth: lesson.lookupEarth,
        conclusion: `地盘${lesson.lookupEarth}宫所临天盘为${lesson.upper}`,
      })),
    ],
  };
}
```

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run:

```powershell
npm test -- src/domain/four-lessons/policy.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit the pure domain policy**

```powershell
git add src/domain/four-lessons/types.ts src/domain/four-lessons/policy.ts src/domain/four-lessons/policy.test.ts
git commit -m "feat: derive canonical four lessons"
```

---

### Task 2: Runtime Guard and Stage Composer

**Files:**

- Create: `src/domain/four-lessons/result-guard.ts`
- Create: `src/domain/four-lessons/compute-four-lessons.ts`
- Create: `src/domain/four-lessons/compute-four-lessons.test.ts`

**Interfaces:**

- Consumes: `deriveFourLessons`, `isCalendarSnapshot`, `isHeavenEarthResult`, `invalidateFrom`.
- Produces: `isFourLessonsResult(value: unknown): value is FourLessonsResult`, `matchesFourLessonsInputs(value, calendar, plate): boolean`, `fourLessonsResultSource(calendar, plateSnapshotSource): ValueSource`, `computeFourLessons(calendar?, plate?): FourLessonsOutcome`, and `runFourLessonsStage(session): FourLessonsStageOutcome`.

- [ ] **Step 1: Write failing composer and guard tests**

Create `src/domain/four-lessons/compute-four-lessons.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { computeFourLessons, runFourLessonsStage } from "./compute-four-lessons";
import { isFourLessonsResult } from "./result-guard";
import type { FourLesson, FourLessonsResult } from "./types";

function validResult(): FourLessonsResult {
  const outcome = computeFourLessons(
    referenceSession.snapshots.calendar,
    referenceSession.snapshots["heaven-earth"],
  );
  if (!outcome.ok) throw new Error(outcome.error.code);
  return outcome.value;
}

describe("computeFourLessons", () => {
  it("creates the guarded snapshot with both direct dependencies", () => {
    const outcome = computeFourLessons(referenceSession.snapshots.calendar, referenceSession.snapshots["heaven-earth"]);
    expect(outcome).toMatchObject({
      ok: true,
      snapshot: {
        stage: "four-lessons",
        dependsOn: ["calendar", "heaven-earth"],
        ruleId: "four-lessons/derive-v1",
        source: "automatic",
      },
    });
  });

  it.each([
    ["calendar", undefined, referenceSession.snapshots["heaven-earth"]],
    ["plate", referenceSession.snapshots.calendar, undefined],
  ])("rejects a missing %s snapshot", (_name, calendar, plate) => {
    expect(computeFourLessons(calendar, plate)).toMatchObject({
      ok: false,
      error: { code: "INVALID_FOUR_LESSONS_INPUT" },
    });
  });

  it("derives manual source from a manual day pillar", () => {
    const calendar = structuredClone(referenceSession.snapshots.calendar!);
    calendar.value.pillars.day.source = "manual";
    calendar.value.evidence = [...calendar.value.evidence, {
      ruleId: "calendar/manual-correction-v1", field: "dayPillar", input: "自动值 辛酉，人工值 辛酉", conclusion: "dayPillar 采用人工有效值 辛酉",
    }];
    calendar.source = "manual";
    expect(computeFourLessons(calendar, referenceSession.snapshots["heaven-earth"])).toMatchObject({ ok: true, snapshot: { source: "manual" } });
  });
});

describe("isFourLessonsResult", () => {
  it.each([
    ["wrong order", (value: FourLessonsResult) => {
      const lessons = value.lessons as unknown as FourLesson[];
      [lessons[0], lessons[1]] = [lessons[1], lessons[0]];
    }],
    ["broken second link", (value: FourLessonsResult) => { value.lessons[1].lower = { kind: "branch", value: "子" }; }],
    ["broken fourth link", (value: FourLessonsResult) => { value.lessons[3].lookupEarth = "子"; }],
    ["missing evidence", (value: FourLessonsResult) => { value.evidence = value.evidence.slice(1); }],
  ])("rejects %s", (_name, mutate) => {
    const value = structuredClone(validResult());
    mutate(value);
    expect(isFourLessonsResult(value)).toBe(false);
  });
});

describe("runFourLessonsStage", () => {
  it("replaces four-lessons and removes all of its downstream snapshots", () => {
    const outcome = runFourLessonsStage(referenceSession);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth", "heavenly-generals", "four-lessons"]);
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
  });

  it("returns an invalidated session when either upstream snapshot is invalid", () => {
    const broken = structuredClone(referenceSession);
    delete broken.snapshots["heaven-earth"];
    const outcome = runFourLessonsStage(broken);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.session.snapshots["four-lessons"]).toBeUndefined();
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new test and confirm RED**

```powershell
npm test -- src/domain/four-lessons/compute-four-lessons.test.ts
```

Expected: FAIL because the guard and composer modules do not exist.

- [ ] **Step 3: Implement the runtime guard**

Create `src/domain/four-lessons/result-guard.ts` with small local `isRecord`, `isStem`, and `isBranch` helpers using `HEAVENLY_STEMS` and `EARTHLY_BRANCHES`. Export these exact functions:

```ts
export const FOUR_LESSONS_SNAPSHOT_RULE_ID = FOUR_LESSONS_RULE_ID;

export function isFourLessonsResult(value: unknown): value is FourLessonsResult;

export function matchesFourLessonsInputs(
  value: FourLessonsResult,
  calendar: CalendarResult,
  plate: HeavenEarthResult,
): boolean;

export function fourLessonsResultSource(
  calendar: CalendarResult,
  plateSnapshotSource: ValueSource,
): ValueSource {
  return calendar.pillars.day.source === "manual" || plateSnapshotSource === "manual"
    ? "manual"
    : "automatic";
}
```

`isFourLessonsResult` must enforce all of the following in code, not only types:

- `dayPillar` is in `JIA_ZI` and `stemResidence` matches `STEM_RESIDENCES`.
- The tuple has four entries with exact ids and labels in canonical order.
- First lower is the day stem; third lower is the day branch.
- Second lower and lookup palace equal first upper; fourth lower and lookup palace equal third upper.
- First lookup is the stem residence; third lookup equals the day branch.
- Every upper and lookup is a legal branch.
- Evidence has exactly five entries: one residence record for `first` and one derivation record per lesson, with non-empty input and conclusion.

`matchesFourLessonsInputs` must return `false` unless `value.dayPillar` equals the effective calendar day, the plate month-general/hour pair equals the effective calendar inputs, and every lesson upper equals the plate heaven at `lookupEarth`.

- [ ] **Step 4: Implement the stage composer**

Create `src/domain/four-lessons/compute-four-lessons.ts`:

```ts
import { isCalendarSnapshot } from "../calendar/result-guard";
import { invalidateFrom } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import { isHeavenEarthResult } from "../heaven-earth/result-guard";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import { deriveFourLessons } from "./policy";
import {
  FOUR_LESSONS_SNAPSHOT_RULE_ID,
  fourLessonsResultSource,
  isFourLessonsResult,
  matchesFourLessonsInputs,
} from "./result-guard";
import type { FourLessonsOutcome, FourLessonsStageOutcome } from "./types";
import type { CalendarSnapshot } from "../calendar/types";

export { isFourLessonsResult } from "./result-guard";

function isPlateSnapshotForCalendar(
  calendar: CalendarSnapshot,
  plate: HeavenEarthSnapshot | undefined,
): plate is HeavenEarthSnapshot {
  if (!plate || plate.stage !== "heaven-earth" || !isHeavenEarthResult(plate.value)) return false;
  return plate.dependsOn.length === 1
    && plate.dependsOn[0] === "calendar"
    && plate.ruleId === HEAVEN_EARTH_SNAPSHOT_RULE_ID
    && plate.source === heavenEarthResultSource(plate.value)
    && plate.value.monthGeneral.name === calendar.value.monthGeneral.effective.name
    && plate.value.monthGeneral.branch === calendar.value.monthGeneral.effective.branch
    && plate.value.monthGeneral.source === calendar.value.monthGeneral.source
    && plate.value.divinationHour.branch === calendar.value.divinationHour.effective
    && plate.value.divinationHour.source === calendar.value.divinationHour.source;
}

export function computeFourLessons(
  calendar?: CalendarSnapshot,
  plate?: HeavenEarthSnapshot,
): FourLessonsOutcome {
  if (!isCalendarSnapshot(calendar) || !isPlateSnapshotForCalendar(calendar, plate)) {
    return { ok: false, error: { code: "INVALID_FOUR_LESSONS_INPUT", message: "缺少有效的日柱或天地盘快照" } };
  }
  try {
    const value = deriveFourLessons(calendar.value, plate.value);
    if (!isFourLessonsResult(value) || !matchesFourLessonsInputs(value, calendar.value, plate.value)) {
      return { ok: false, error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整" } };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "four-lessons",
        dependsOn: ["calendar", "heaven-earth"],
        ruleId: FOUR_LESSONS_SNAPSHOT_RULE_ID,
        source: fourLessonsResultSource(calendar.value, plate.source),
        value,
      },
    };
  } catch (cause) {
    return { ok: false, error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整", cause } };
  }
}

export function runFourLessonsStage(session: CourseSession): FourLessonsStageOutcome {
  const outcome = computeFourLessons(session.snapshots.calendar, session.snapshots["heaven-earth"] as HeavenEarthSnapshot | undefined);
  const invalidated = invalidateFrom(session, "four-lessons");
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return {
    ok: true,
    value: outcome.value,
    session: { ...invalidated, snapshots: { ...invalidated.snapshots, "four-lessons": outcome.snapshot } },
  };
}
```

Import `HEAVEN_EARTH_SNAPSHOT_RULE_ID` and `heavenEarthResultSource` for `isPlateSnapshotForCalendar`. Add five test rows that mutate `dependsOn`, `ruleId`, `source`, the embedded month general, and the embedded divination hour respectively; each must expect `INVALID_FOUR_LESSONS_INPUT`.

- [ ] **Step 5: Run focused policy and composer tests**

```powershell
npm test -- src/domain/four-lessons/policy.test.ts src/domain/four-lessons/compute-four-lessons.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit guard and composer**

```powershell
git add src/domain/four-lessons/result-guard.ts src/domain/four-lessons/compute-four-lessons.ts src/domain/four-lessons/compute-four-lessons.test.ts
git commit -m "feat: guard four lessons snapshot"
```

---

### Task 3: Session Integrity and Reference Fixture

**Files:**

- Modify: `src/domain/chart/stages.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`

**Interfaces:**

- Consumes: `isFourLessonsResult`, `matchesFourLessonsInputs`, `fourLessonsResultSource`, `FOUR_LESSONS_SNAPSHOT_RULE_ID`, and `deriveFourLessons`.
- Produces: a `referenceSession` containing a real `FourLessonsSnapshot`, and `validateSession` errors for forged/stale four-lessons snapshots.

- [ ] **Step 1: Update dependency tests first**

In `src/domain/chart/snapshots.test.ts`, import `deriveFourLessons`, change the expected direct dependencies, and add cross-snapshot cases:

```ts
it("requires both direct four-lessons dependencies", () => {
  expect(stageDependencies["four-lessons"]).toEqual(["calendar", "heaven-earth"]);
});

it("rejects a four-lessons snapshot copied from different day inputs", () => {
  const broken = structuredClone(referenceSession);
  const otherCalendar = structuredClone(referenceSession.snapshots.calendar!.value);
  otherCalendar.pillars.day.effective = "庚申";
  broken.snapshots["four-lessons"]!.value = deriveFourLessons(
    otherCalendar,
    referenceSession.snapshots["heaven-earth"]!.value,
  );
  expect(validateSession(broken)).toContain("four-lessons 与生效日柱或天地盘不一致");
});

it("rejects forged four-lessons metadata", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["four-lessons"]!.ruleId = "four-lessons/forged-v1";
  expect(validateSession(broken)).toContain("four-lessons 快照规则编号无效");
});
```

Update the existing dependency table so the valid value is `["calendar", "heaven-earth"]`, and invalid rows include `[]`, `["heaven-earth"]`, and `["calendar", "heaven-earth", "course"]`. Update the missing-dependency test to assert both missing messages when both snapshots are absent.

- [ ] **Step 2: Run the snapshot test and confirm RED**

```powershell
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: FAIL because the stage metadata and fixture still use only `heaven-earth`/layout-only data.

- [ ] **Step 3: Replace the reference four-lessons placeholder**

In `src/test/reference-session.ts`, import `deriveFourLessons`, `FOUR_LESSONS_RULE_ID`, and `FourLessonsSnapshot`, then create:

```ts
const fourLessonsSnapshot = {
  stage: "four-lessons",
  dependsOn: ["calendar", "heaven-earth"],
  ruleId: FOUR_LESSONS_RULE_ID,
  source: "automatic",
  value: deriveFourLessons(calendarSnapshot.value, heavenEarthSnapshot.value),
} as const satisfies FourLessonsSnapshot;
```

Use `fourLessonsSnapshot` at `referenceSession.snapshots["four-lessons"]`. Leave the unrelated layout-only three-transmissions, heavenly-generals, and course fixtures intact.

- [ ] **Step 4: Extend stage and session validation**

Change `src/domain/chart/stages.ts`:

```ts
"four-lessons": ["calendar", "heaven-earth"],
```

In `src/domain/chart/snapshots.ts`, import the four-lessons guard exports. Add a `stage === "four-lessons"` branch that:

```ts
if (!isFourLessonsResult(snapshot.value)) {
  errors.push("four-lessons 快照结果无效");
} else {
  if (snapshot.ruleId !== FOUR_LESSONS_SNAPSHOT_RULE_ID) {
    errors.push("four-lessons 快照规则编号无效");
  }
  const calendar = session.snapshots.calendar;
  const plate = session.snapshots["heaven-earth"];
  if (isCalendarSnapshot(calendar) && plate && isHeavenEarthResult(plate.value)) {
    const expectedSource = fourLessonsResultSource(calendar.value, plate.source);
    if (snapshot.source !== expectedSource) {
      errors.push(`four-lessons 快照来源无效，应为 ${expectedSource}`);
    }
    if (!matchesFourLessonsInputs(snapshot.value, calendar.value, plate.value)) {
      errors.push("four-lessons 与生效日柱或天地盘不一致");
    }
  }
}
```

- [ ] **Step 5: Run chart and four-lessons tests**

```powershell
npm test -- src/domain/chart/snapshots.test.ts src/domain/four-lessons/policy.test.ts src/domain/four-lessons/compute-four-lessons.test.ts
```

Expected: all tests PASS. Confirm the existing invalidation test still keeps the independent `heavenly-generals` snapshot when invalidating from `four-lessons`.

- [ ] **Step 6: Commit session integrity**

```powershell
git add src/domain/chart/stages.ts src/domain/chart/snapshots.ts src/domain/chart/snapshots.test.ts src/test/reference-session.ts
git commit -m "feat: validate four lessons session"
```

---

### Task 4: Four-Lessons Review Component

**Files:**

- Create: `src/features/four-lessons-review/FourLessonsReview.tsx`
- Create: `src/features/four-lessons-review/FourLessonsReview.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**

- Consumes: `FourLessonsResult` only; it must not import `deriveFourLessons`.
- Produces: `FourLessonsReview({ result, onReviewCalendar, onReviewHeavenEarth })`.

- [ ] **Step 1: Invoke the frontend design guidance before editing UI**

Read `C:/Users/Lenovo/.codex/skills/frontend-design/SKILL.md` completely. Preserve the existing ink, bronze, celadon, old-gold, square-border visual language; do not introduce a second design system or external font/package.

- [ ] **Step 2: Write failing component tests**

Create `src/features/four-lessons-review/FourLessonsReview.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import { referenceSession } from "../../test/reference-session";
import { FourLessonsReview } from "./FourLessonsReview";

const result = referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult;

afterEach(cleanup);

describe("FourLessonsReview", () => {
  it("renders four vertical cards in traditional visual order", () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const list = screen.getByRole("list", { name: "四课课体" });
    const cards = within(list).getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("data-lesson"))).toEqual(["fourth", "third", "second", "first"]);
    expect(cards.map((card) => card.textContent)).toEqual([
      "待天将加临酉卯四课", "待天将加临卯酉三课", "待天将加临戌辰二课", "待天将加临辰辛一课",
    ]);
    for (const card of cards) expect(card.querySelectorAll(":scope > *")).toHaveLength(4);
    expect(cards[3]).toHaveAttribute("aria-pressed", "true");
  });

  it("shows selected evidence and restores focus after close", async () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const user = userEvent.setup();
    const fourth = screen.getByRole("button", { name: /四课，上神酉，下神卯/ });
    await user.click(fourth);
    expect(screen.getByRole("complementary", { name: "四课证据" })).toHaveTextContent("地盘卯宫所临天盘为酉");
    await user.click(screen.getByRole("button", { name: "关闭证据" }));
    expect(fourth).toHaveFocus();
  });

  it("explains the stem residence and exposes both upstream review actions", async () => {
    const onReviewCalendar = vi.fn();
    const onReviewHeavenEarth = vi.fn();
    render(<FourLessonsReview result={result} onReviewCalendar={onReviewCalendar} onReviewHeavenEarth={onReviewHeavenEarth} />);
    expect(screen.getByRole("complementary", { name: "一课证据" })).toHaveTextContent("辛寄戌");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "返回历法检查" }));
    await user.click(screen.getByRole("button", { name: "查看天地盘" }));
    expect(onReviewCalendar).toHaveBeenCalledOnce();
    expect(onReviewHeavenEarth).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run the component test and confirm RED**

```powershell
npm test -- src/features/four-lessons-review/FourLessonsReview.test.tsx
```

Expected: FAIL because `FourLessonsReview` does not exist.

- [ ] **Step 4: Implement the review component**

Create `FourLessonsReview.tsx` with:

```tsx
const VISUAL_LESSON_ORDER = ["fourth", "third", "second", "first"] as const;

interface FourLessonsReviewProps {
  result: FourLessonsResult;
  onReviewCalendar: () => void;
  onReviewHeavenEarth: () => void;
}
```

Render a `<section className="four-lessons-review" aria-label="四课生成">`. Map `VISUAL_LESSON_ORDER` to a list named “四课课体”. Each card button must have exactly these four direct child elements in order:

```tsx
<span className="four-lessons-review__general">待天将加临</span>
<strong>{lesson.upper}</strong>
<span className="four-lessons-review__lower">{lesson.lower.value}</span>
<small>{lesson.label}</small>
```

Give each button `data-lesson`, `aria-pressed`, `aria-controls="four-lessons-evidence"`, and accessible name `${lesson.label}，上神${lesson.upper}，下神${lesson.lower.value}，天将待加临`. Initialize selection to `first`. Store refs for all four buttons; closing evidence focuses the last trigger, falling back to the first-lesson button when the initially open panel closes before any click.

Filter evidence by selected lesson. For `first`, show both the residence record and derivation record; for other lessons, show their derivation record. Add the two upstream callback buttons to the evidence panel.

- [ ] **Step 5: Add scoped responsive styles**

Append `.four-lessons-review*` rules to `src/styles/global.css`:

- Two-column desktop shell matching `.heaven-earth-review`: lesson region plus evidence panel.
- Four equal lesson columns with square borders and no border radius.
- Low-contrast general placeholder, large upper/lower glyphs, celadon selected marker, and old-gold only for the reserved general label.
- At `max-width: 820px`, switch the shell to one column, make the lesson list `overflow-x: auto`, and set each card to a readable fixed minimum width without causing document-level horizontal overflow.
- Keep each card’s four direct children in one vertical grid column at every width.
- Show the close button at narrow widths and preserve visible focus styles.

- [ ] **Step 6: Run component and stylesheet-adjacent tests**

```powershell
npm test -- src/features/four-lessons-review/FourLessonsReview.test.tsx src/features/heaven-earth-review/HeavenEarthReview.test.tsx
```

Expected: all tests PASS and no heaven-earth review regression.

- [ ] **Step 7: Commit the review component**

```powershell
git add src/features/four-lessons-review/FourLessonsReview.tsx src/features/four-lessons-review/FourLessonsReview.test.tsx src/styles/global.css
git commit -m "feat: add four lessons review"
```

---

### Task 5: Application Orchestration and Stage Navigation

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**

- Consumes: `runFourLessonsStage`, `isFourLessonsResult`, `FourLessonsStageOutcome`, and `FourLessonsReview`.
- Produces: calendar → heaven-earth → four-lessons orchestration and navigation among all three completed reviews.

- [ ] **Step 1: Add failing application tests**

In `src/app/App.test.tsx`, add/import the four-lessons stage module and assert the new terminal state:

```tsx
it("runs through four lessons and advances the rail to three transmissions", async () => {
  render(<App />);
  await submitCourse();
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  expect(screen.getByRole("button", { name: /四课生成，已完成/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("三传取法")).toHaveAttribute("data-status", "current");
});

it("navigates to prior snapshots without recomputing four lessons", async () => {
  const runStage = vi.spyOn(fourLessonsStage, "runFourLessonsStage");
  render(<App />);
  const user = await submitCourse();
  expect(runStage).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /天地盘加临，已完成/ }));
  await user.click(screen.getByRole("button", { name: /四课生成，已完成/ }));
  expect(runStage).toHaveBeenCalledTimes(1);
});

it("keeps valid upstream snapshots when four-lessons generation fails", async () => {
  vi.spyOn(fourLessonsStage, "runFourLessonsStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整" },
    session,
  }));
  render(<App />);
  await submitCourse();
  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("四课结果不完整");
  expect(screen.getByText("四课生成")).toHaveAttribute("data-status", "current");
});
```

Update existing post-submit assertions so initial success expects `FourLessonsReview`; tests that inspect the plate must first click the completed “天地盘加临” rail button. Keep all existing calendar correction assertions, but expect a successful correction to return to the rebuilt four-lessons review.

- [ ] **Step 2: Run the app test and confirm RED**

```powershell
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `App` stops after heaven-earth and `ReviewStage` excludes `four-lessons`.

- [ ] **Step 3: Extend the orchestration**

In `src/app/App.tsx`:

- Change `ReviewStage` to `"calendar" | "heaven-earth" | "four-lessons"`.
- Add `FourLessonsStageOutcome` to `StageError`.
- After successful `runHeavenEarthStage`, call `runFourLessonsStage(plateOutcome.session)`.
- On four-lessons failure, keep the returned session, set review to `heaven-earth`, and show the structured error.
- On success, store the new session, select `four-lessons`, and clear errors.
- Guard the result with `isFourLessonsResult` before rendering.
- Render `FourLessonsReview` before the heaven-earth/calendar branches and wire its two callbacks to `setReviewStage`.
- Add `four-lessons` to `completed` only when its guarded snapshot exists.
- Set `current` to `three-transmissions` after four lessons, otherwise retain the existing fallback chain.
- Allow `RuleStageRail.onSelect` to select any of the three completed review stages.

Use this pipeline shape:

```ts
const plateOutcome = runHeavenEarthStage(calendarOutcome.session);
if (!plateOutcome.ok) { /* existing plate failure path */ }
const lessonsOutcome = runFourLessonsStage(plateOutcome.session);
if (!lessonsOutcome.ok) {
  setSession(lessonsOutcome.session);
  setReviewStage("heaven-earth");
  setStageError(lessonsOutcome.error);
  return;
}
setSession(lessonsOutcome.session);
setReviewStage("four-lessons");
setStageError(null);
```

- [ ] **Step 4: Run application and rail tests**

```powershell
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit application integration**

```powershell
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: integrate four lessons stage"
```

---

### Task 6: Browser Regression and Final Verification

**Files:**

- Create: `e2e/four-lessons.spec.ts`
- Modify: `e2e/heaven-earth.spec.ts`

**Interfaces:**

- Consumes: the complete user-visible third-stage flow.
- Produces: desktop/mobile/offline regression coverage and final verification evidence.

- [ ] **Step 1: Adapt heaven-earth E2E navigation**

In each `e2e/heaven-earth.spec.ts` test, after `submitOrdinaryInput(page)`, click:

```ts
await page.getByRole("button", { name: "天地盘加临，已完成" }).click();
```

Do this before locating the heaven-earth region. After a successful calendar correction, the app now returns to four lessons; click the completed heaven-earth rail button again before asserting the rebuilt plate.

- [ ] **Step 2: Write the four-lessons E2E test**

Create `e2e/four-lessons.spec.ts` with desktop and mobile viewports. Submit `2024-02-10T14:30` in Beijing and assert:

```ts
const EXPECTED_VISUAL_LESSONS = [
  { id: "fourth", label: "四课", upper: "寅", lower: "酉" },
  { id: "third", label: "三课", upper: "酉", lower: "辰" },
  { id: "second", label: "二课", upper: "子", lower: "未" },
  { id: "first", label: "一课", upper: "未", lower: "甲" },
] as const;
```

For each viewport:

- Set offline mode after the initial local page load and verify no non-local HTTP or WebSocket traffic.
- Assert the region name is “四课生成”.
- Assert four card buttons in the exact `EXPECTED_VISUAL_LESSONS` order.
- Assert each card contains four direct stacked elements and accessible name `${label}，上神${upper}，下神${lower}，天将待加临`.
- Assert first lesson is selected initially and its evidence contains `甲寄寅`.
- Click fourth lesson, verify only fourth evidence is visible, close it, and verify focus returns to fourth lesson.
- Assert “四课生成” is completed and “三传取法” is current.
- Assert `document.documentElement.scrollWidth === viewport width`.

On mobile, inspect bounding rectangles for all four direct card children and assert each next child starts at or below the prior child’s bottom. Horizontal scrolling may occur inside the lesson list, but the document itself must not overflow.

- [ ] **Step 3: Run E2E and confirm any initial failure is specific**

```powershell
npm run test:e2e -- e2e/four-lessons.spec.ts e2e/heaven-earth.spec.ts
```

Expected: all new four-lessons cases and adapted heaven-earth cases PASS. If a case fails, use its exact order, focus, stacking, or navigation assertion to correct only the responsible component, style rule, or test navigation, then rerun this same command.

- [ ] **Step 4: Run all unit/component tests**

```powershell
npm test
```

Expected: all Vitest suites PASS with zero failed tests.

- [ ] **Step 5: Run the production build**

```powershell
npm run build
```

Expected: TypeScript project build and Vite production build both exit 0.

- [ ] **Step 6: Run the complete browser suite**

```powershell
npm run test:e2e
```

Expected: all Playwright tests PASS at both configured viewport paths.

- [ ] **Step 7: Inspect the final diff**

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: `git diff --check` prints nothing; status contains only the intended Task 6 files or any narrowly scoped fixes made while satisfying the final tests.

- [ ] **Step 8: Commit final browser coverage**

```powershell
git add e2e/four-lessons.spec.ts e2e/heaven-earth.spec.ts
git add src/domain src/features src/app src/styles/global.css
git commit -m "test: cover four lessons workflow"
```

If the second `git add` finds no files because earlier tasks were committed cleanly, that is expected. Before claiming completion, rerun `git status --short` and confirm the worktree is clean.

---

## Final Acceptance Checklist

- [ ] `STEM_RESIDENCES` covers every heavenly stem exactly once and matches the approved table.
- [ ] The 辛酉 / 午加子 reference result is 辰辛、戌辰、卯酉、酉卯 in canonical one-to-four order.
- [ ] Runtime guards reject forged metadata, malformed tuples, broken chaining, stale day input, and stale plate input.
- [ ] A failed stage run returns an invalidated session that retains valid upstream snapshots.
- [ ] The UI shows four cards as 四、三、二、一 with “待天将加临” as presentation-only copy.
- [ ] Evidence selection, close-focus restoration, upstream navigation, keyboard access, and narrow-screen stacking pass automated tests.
- [ ] The stage rail shows calendar, heaven-earth, and four-lessons as completed, with three-transmissions current.
- [ ] `npm test`, `npm run build`, and `npm run test:e2e` all exit 0.
- [ ] `git diff --check` is clean and the final worktree contains no unintended files.
