# Three Transmissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fourth rule stage that derives the three transmissions and their six relations from the effective heaven-earth plate and four lessons according to Lin Feng's complete Nine Gates method.

**Architecture:** Implement an ordered pure-function rule chain under `src/domain/three-transmissions`: shared tables and primitives feed ordinary candidate selection, normal special methods, and the two special-plate methods; one policy function orchestrates them and emits structured evidence. A recomputing result guard protects the snapshot boundary, then a traditional vertical React review integrates the valid snapshot into the existing stage rail.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 3, Testing Library, Vite 7, Playwright 1.62.

## Global Constraints

- Canonical method names are 贼克、比用、涉害、遥克、昴星、别责、八专、伏吟、反吟; use 反吟 in stored results.
- `three-transmissions` directly depends on `heaven-earth` and `four-lessons`, in that order.
- `heavenly-generals` adds `three-transmissions` as a workflow prerequisite so invalidating transmissions also invalidates generals and course; its future calculation need not consume the transmission value.
- The stage is automatic only; do not add manual correction or approval controls.
- Special-plate precedence is 伏吟, then 反吟, then the ordinary rule chain.
- 八专 does not inspect 遥克; 伏吟 and 反吟 do not fall back into ordinary 昴星、别责 or 八专.
- Every result contains exactly 初传、中传、末传, each with one of 父母、子孙、官鬼、妻财、兄弟.
- Evidence is structured and complete enough to show candidate rejection and every 涉害 path palace.
- Failure preserves calendar, heaven-earth, and four-lessons snapshots while invalidating three-transmissions and every downstream stage.
- Do not add dependencies or a generic configurable rule engine.
- Follow TDD: observe each focused test fail before writing the minimal implementation.

---

## File Map

Create the following focused domain files:

- `src/domain/three-transmissions/types.ts`: public result, evidence, snapshot, and outcome contracts.
- `src/domain/three-transmissions/foundations.ts`: canonical five-element, polarity, combination, punishment, clash, trine, post-horse tables and plate lookup primitives.
- `src/domain/three-transmissions/selectors.ts`: 贼克 candidate discovery, 比用 filtering, 涉害 counting, and 遥克 selection.
- `src/domain/three-transmissions/special-methods.ts`: 昴星、别责、八专、伏吟、反吟 transmission builders.
- `src/domain/three-transmissions/policy.ts`: ordered orchestration, ordinary chaining, six-relation derivation, and evidence assembly.
- `src/domain/three-transmissions/result-guard.ts`: canonical recomputation and snapshot metadata guard.
- `src/domain/three-transmissions/compute-three-transmissions.ts`: stage boundary and invalidation behavior.
- `src/features/three-transmissions-review/ThreeTransmissionsReview.tsx`: traditional vertical review UI.

Keep tests next to each production unit. Modify only the existing stage registry, snapshot validator, reference session, app shell, global styles, and relevant tests/e2e files listed in the tasks below.

---

### Task 1: Domain Contracts, Foundation Tables, and Direct Dependency

**Files:**
- Create: `src/domain/three-transmissions/types.ts`
- Create: `src/domain/three-transmissions/foundations.ts`
- Test: `src/domain/three-transmissions/foundations.test.ts`
- Modify: `src/domain/chart/stages.ts`
- Modify: `src/domain/chart/snapshots.test.ts`

**Interfaces:**
- Produces: `TransmissionMethod`, `TransmissionSubtype`, `TransmissionVariant`, `SixRelation`, `Transmission`, `ThreeTransmissionsEvidenceStep`, `ThreeTransmissionsResult`, `ThreeTransmissionsSnapshot`, `ThreeTransmissionsOutcome`, and `ThreeTransmissionsStageOutcome`.
- Produces: `elementOfStem(stem)`, `elementOfBranch(branch)`, `polarityOfStem(stem)`, `polarityOfBranch(branch)`, `relationFor(stem, branch)`, `punishmentOf(branch)`, `clashOf(branch)`, `nextTrineBranch(branch)`, `postHorseOf(branch)`, `heavenAt(plate, earth)`, and `earthUnder(plate, heaven)`.
- Consumes: `EarthlyBranch`, `HeavenlyStem`, `RuleSnapshot`, `CourseSession`, `HeavenEarthResult`, and `FourLessonId` from existing domain contracts.

- [ ] **Step 1: Write the failing foundation and dependency tests**

```ts
import { describe, expect, it } from "vitest";
import {
  clashOf,
  nextTrineBranch,
  postHorseOf,
  punishmentOf,
  relationFor,
} from "./foundations";

describe("three-transmissions foundations", () => {
  it.each([
    ["甲", "亥", "父母"],
    ["甲", "午", "子孙"],
    ["甲", "申", "官鬼"],
    ["甲", "丑", "妻财"],
    ["甲", "寅", "兄弟"],
  ] as const)("derives %s/%s as %s", (stem, branch, expected) => {
    expect(relationFor(stem, branch)).toBe(expected);
  });

  it("freezes punishment, clash, trine, and post-horse direction", () => {
    expect([punishmentOf("寅"), punishmentOf("巳"), punishmentOf("申")]).toEqual(["巳", "申", "寅"]);
    expect(punishmentOf("辰")).toBe("辰");
    expect(clashOf("子")).toBe("午");
    expect(nextTrineBranch("酉")).toBe("丑");
    expect(postHorseOf("丑")).toBe("亥");
  });
});
```

Add this assertion to `src/domain/chart/snapshots.test.ts`:

```ts
expect(stageDependencies["three-transmissions"]).toEqual(["heaven-earth", "four-lessons"]);
expect(stageDependencies["heavenly-generals"]).toEqual(["calendar", "heaven-earth", "three-transmissions"]);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- src/domain/three-transmissions/foundations.test.ts src/domain/chart/snapshots.test.ts
```

Expected: FAIL because the three-transmissions foundation module does not exist and the dependency is still `four-lessons` only.

- [ ] **Step 3: Add the public contracts**

Define the exact stable unions in `types.ts`:

```ts
export type TransmissionMethod =
  | "贼克" | "比用" | "涉害" | "遥克" | "昴星"
  | "别责" | "八专" | "伏吟" | "反吟";

export type TransmissionSubtype =
  | "始入" | "元首" | "重审" | "知一"
  | "见机" | "察微" | "缀瑕"
  | "蒿矢" | "弹射" | "虎视" | "冬蛇掩目"
  | "不虞" | "自任" | "自信" | "井栏";

export type TransmissionVariant = "复等" | "杜传";
export type SixRelation = "父母" | "子孙" | "官鬼" | "妻财" | "兄弟";
export type TransmissionPosition = "initial" | "middle" | "final";
export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type Polarity = "yang" | "yin";

export type ThreeTransmissionsRuleId =
  | "three-transmissions/plate-classification-v1"
  | "three-transmissions/lesson-deduplication-v1"
  | "three-transmissions/vertical-relations-v1"
  | "three-transmissions/thief-overcoming-v1"
  | "three-transmissions/comparison-v1"
  | "three-transmissions/shehai-path-v1"
  | "three-transmissions/remote-overcoming-v1"
  | "three-transmissions/mao-star-v1"
  | "three-transmissions/separate-responsibility-v1"
  | "three-transmissions/eight-special-v1"
  | "three-transmissions/fuyin-v1"
  | "three-transmissions/fanyin-v1"
  | "three-transmissions/initial-v1"
  | "three-transmissions/middle-v1"
  | "three-transmissions/final-v1"
  | "three-transmissions/six-relation-v1";

export interface Transmission {
  position: TransmissionPosition;
  label: "初传" | "中传" | "末传";
  branch: EarthlyBranch;
  relation: SixRelation;
  derivation: string;
  evidenceIds: readonly string[];
}

export interface SheHaiPalaceEvidence {
  kind: "shehai-palace";
  candidateLesson: FourLessonId;
  earth: EarthlyBranch;
  branchElement: FiveElement;
  residentStems: readonly HeavenlyStem[];
  increment: number;
  total: number;
}

export interface ThreeTransmissionsEvidenceStep {
  id: string;
  ruleId: ThreeTransmissionsRuleId;
  phase: "plate" | "lessons" | "candidates" | "selection" | "initial" | "middle" | "final" | "relation";
  transmission?: TransmissionPosition;
  input: string;
  conclusion: string;
  details?: readonly SheHaiPalaceEvidence[];
}

export type EvidenceDraft = Omit<ThreeTransmissionsEvidenceStep, "id">;

export interface ThreeTransmissionsResult {
  dayPillar: StemBranch;
  plateOffset: number;
  method: TransmissionMethod;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  transmissions: readonly [Transmission, Transmission, Transmission];
  evidence: readonly ThreeTransmissionsEvidenceStep[];
}

export type ThreeTransmissionsErrorCode =
  | "INVALID_THREE_TRANSMISSIONS_INPUT"
  | "THREE_TRANSMISSIONS_RULE_UNRESOLVED"
  | "THREE_TRANSMISSIONS_RESULT_INCOMPLETE";
```

Complete the snapshot and outcome unions using `ThreeTransmissionsErrorCode`, following the successful/failed shape already used by `FourLessonsOutcome` and requiring `session` on both `ThreeTransmissionsStageOutcome` variants.

- [ ] **Step 4: Implement the canonical foundation tables and primitives**

Use literal readonly maps, including:

```ts
export const STEM_COMBINATIONS = {
  甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛",
  辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊",
} as const;

export const PUNISHMENTS = {
  子: "卯", 丑: "戌", 寅: "巳", 卯: "子",
  辰: "辰", 巳: "申", 午: "午", 未: "丑",
  申: "寅", 酉: "酉", 戌: "未", 亥: "亥",
} as const;

export const POST_HORSES = {
  申: "寅", 子: "寅", 辰: "寅",
  寅: "申", 午: "申", 戌: "申",
  巳: "亥", 酉: "亥", 丑: "亥",
  亥: "巳", 卯: "巳", 未: "巳",
} as const;
```

Derive `relationFor` only from the five-element generating and overcoming cycles; do not hard-code 120 stem/branch pairs. Implement plate lookup by searching the twelve canonical palaces and throwing a descriptive error if a branch is absent or duplicated.

- [ ] **Step 5: Update the dependency table and run GREEN**

Change only these two dependency entries:

```ts
"three-transmissions": ["heaven-earth", "four-lessons"],
"heavenly-generals": ["calendar", "heaven-earth", "three-transmissions"],
```

Run:

```bash
npm test -- src/domain/three-transmissions/foundations.test.ts src/domain/chart/snapshots.test.ts
npm run build
```

Expected: all focused tests PASS and TypeScript build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/domain/three-transmissions src/domain/chart/stages.ts src/domain/chart/snapshots.test.ts
git commit -m "feat: add three transmissions foundations"
```

---

### Task 2: 贼克, 比用, 涉害, and 遥克 Selectors

**Files:**
- Create: `src/domain/three-transmissions/selectors.ts`
- Test: `src/domain/three-transmissions/selectors.test.ts`
- Create: `src/domain/three-transmissions/test-helpers.ts`

**Interfaces:**
- Consumes: `FourLessonsResult`, `HeavenEarthResult`, `FiveElement`, `Polarity`, and foundation lookups from Task 1.
- Produces: `findVerticalCandidates(fourLessons)`, `selectByComparison(candidates, dayStem)`, `selectBySheHai(candidates, dayStem, plate)`, and `findRemoteCandidates(fourLessons, dayStem)`.
- Produces internal `LessonCandidate` with `lesson`, `direction: "lower-overcomes-upper" | "upper-overcomes-lower"`, `upper`, and `upperPolarity`.
- Test helpers produce these exact signatures:

```ts
makePlate(monthGeneral: EarthlyBranch, divinationHour: EarthlyBranch): HeavenEarthResult;
makeRuleInput(dayPillar: StemBranch, monthGeneral: EarthlyBranch, divinationHour: EarthlyBranch): { plate: HeavenEarthResult; fourLessons: FourLessonsResult };
makeSelectorInput(input: { dayPillar: StemBranch; lessons: readonly LessonTuple[] }): FourLessonsResult;
candidate(lesson: FourLessonId, upper: EarthlyBranch): LessonCandidate;
candidateOver(lesson: FourLessonId, upper: EarthlyBranch, currentEarth: EarthlyBranch): LessonCandidate;
makeRemoteLessons(uppers: Record<"first" | "second" | "third" | "fourth", EarthlyBranch>): FourLessonsResult;
```

`makePlate` must construct the same canonical twelve-palace forward rotation as `deriveHeavenEarth`. `makeRuleInput` must derive canonical four lessons from that plate and the supplied day pillar. `equalDepthPlate`, `completeLessons`, `threeUniqueLessons`, and `eightSpecialLessons` are fixed test-only builders that return valid typed fixtures named by the condition they establish; each builder asserts its own unique-lesson count before returning.

- [ ] **Step 1: Write failing 贼克 and 比用 tests**

```ts
it("prefers lower-overcomes-upper and ignores upper-overcomes-lower", () => {
  const input = makeSelectorInput({
    dayPillar: "戊戌",
    lessons: [
      ["first", "未", { kind: "stem", value: "戊" }],
      ["second", "酉", { kind: "branch", value: "未" }],
      ["third", "子", { kind: "branch", value: "戌" }],
      ["fourth", "寅", { kind: "branch", value: "子" }],
    ],
  });
  const result = findVerticalCandidates(input);
  expect(result.preferredDirection).toBe("lower-overcomes-upper");
  expect(result.candidates.map(({ lesson }) => lesson.id)).toEqual(["third"]);
});

it("keeps the only candidate whose polarity matches the day stem", () => {
  const selected = selectByComparison([
    candidate("second", "子"),
    candidate("third", "未"),
    candidate("fourth", "酉"),
  ], "丙");
  expect(selected.kind).toBe("selected");
  if (selected.kind === "selected") expect(selected.candidate.upper).toBe("子");
});
```

- [ ] **Step 2: Run RED for candidate discovery**

Run:

```bash
npm test -- src/domain/three-transmissions/selectors.test.ts
```

Expected: FAIL because selector exports do not exist.

- [ ] **Step 3: Implement vertical candidate discovery and 比用**

Compute first-lesson lower element from the actual day stem, and other lower elements from their branches. Return all lower-overcomes-upper candidates when any exist; otherwise return all upper-overcomes-lower candidates. Return a discriminated result from 比用:

```ts
type ComparisonResult =
  | { kind: "selected"; candidate: LessonCandidate; evidence: readonly EvidenceDraft[] }
  | { kind: "tied"; candidates: readonly LessonCandidate[]; evidence: readonly EvidenceDraft[] };
```

The tied variant must preserve all candidates when all compare or all fail to compare; it must not choose the first array entry.

- [ ] **Step 4: Write failing 涉害 path tests**

Use the book's 庚子日、申将加戌 example:

```ts
it("counts branches and resident stems while returning each traversed palace", () => {
  const plate = makePlate("申", "戌");
  const result = selectBySheHai([
    candidate("first", "午"),
    candidate("third", "戌"),
  ], "庚", plate);
  expect(result.kind).toBe("selected");
  if (result.kind !== "selected") return;
  expect(result.candidate.upper).toBe("午");
  expect(result.counts).toEqual(expect.objectContaining({ 午: 4, 戌: 2 }));
  expect(result.paths.午.flatMap(({ residentStems }) => residentStems)).toEqual(expect.arrayContaining(["庚", "辛"]));
});

it.each([
  ["孟位先取", [candidateOver("second", "午", "寅"), candidateOver("third", "戌", "子")], "见机"],
  ["无孟取仲", [candidateOver("second", "午", "卯"), candidateOver("third", "戌", "子")], "察微"],
] as const)("resolves equal depth by %s", (_label, candidates, subtype) => {
  expect(selectBySheHai(candidates, "庚", equalDepthPlate())).toEqual(expect.objectContaining({ kind: "selected", subtype }));
});
```

Add a test asserting the 戊辰日干上子 exact tie returns subtype `缀瑕` with variant `复等`, and a noncanonical complete tie returns `{ kind: "unresolved" }`.

- [ ] **Step 5: Run RED, implement 涉害, and run GREEN**

Run the focused test once before implementation. Implement an inclusive canonical branch walk from the candidate's current earth palace through its home palace. At each palace, count the earth branch plus every stem whose residence equals that palace. Store every palace detail even when its increment is zero.

Run:

```bash
npm test -- src/domain/three-transmissions/selectors.test.ts
```

Expected: PASS for direction, 比用, 涉害 count, 孟仲 tie, 缀瑕, and unresolved tie tests.

- [ ] **Step 6: Write failing and passing 遥克 tests**

```ts
it("checks only unique upper gods from lessons two through four", () => {
  const lessons = makeRemoteLessons({ first: "辰", second: "戌", third: "午", fourth: "午" });
  expect(findRemoteCandidates(lessons, "壬")).toEqual(expect.objectContaining({
    subtype: "蒿矢",
    candidates: [expect.objectContaining({ upper: "戌" })],
  }));
});

it("uses day-overcomes-god only when no god overcomes the day", () => {
  const lessons = makeRemoteLessons({ first: "子", second: "巳", third: "午", fourth: "卯" });
  expect(findRemoteCandidates(lessons, "庚").subtype).toBe("弹射");
});
```

Observe RED, implement 神克日 before 日克神, deduplicate by upper branch, and use `selectByComparison` for multiple candidates. A tied remote comparison returns unresolved and never calls 涉害.

Run:

```bash
npm test -- src/domain/three-transmissions/selectors.test.ts
```

Expected: all selector tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/three-transmissions/selectors.ts src/domain/three-transmissions/selectors.test.ts src/domain/three-transmissions/test-helpers.ts
git commit -m "feat: implement three transmissions selectors"
```

---

### Task 3: Ordinary Rule Orchestration, 昴星, 别责, and 八专

**Files:**
- Create: `src/domain/three-transmissions/special-methods.ts`
- Create: `src/domain/three-transmissions/policy.ts`
- Test: `src/domain/three-transmissions/policy.test.ts`

**Interfaces:**
- Consumes: Task 1 foundations and Task 2 selectors.
- Produces: `deriveMaoStar(dayStem, fourLessons, plate)`, `deriveSeparateResponsibility(dayStem, dayBranch, fourLessons, plate)`, and `deriveEightSpecial(dayStem, fourLessons)`.
- Produces: `deriveThreeTransmissions(plate: HeavenEarthResult, fourLessons: FourLessonsResult): ThreeTransmissionsResult`.
- Produces: `ThreeTransmissionsRuleUnresolvedError`, carrying the structured evidence that failed to yield one initial transmission.
- The three special builders return this internal contract for the policy to finalize:

```ts
interface TransmissionDraft {
  method: TransmissionMethod;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  evidence: readonly EvidenceDraft[];
}
```

- [ ] **Step 1: Write failing ordinary book-case tests**

```ts
it.each([
  {
    name: "始入",
    input: makeRuleInput("戊戌", "子", "戌"),
    method: "贼克",
    subtype: "始入",
    branches: ["子", "寅", "辰"],
  },
  {
    name: "元首",
    input: makeRuleInput("戊申", "卯", "辰"),
    method: "贼克",
    subtype: "元首",
    branches: ["卯", "寅", "丑"],
  },
  {
    name: "涉害克数胜出",
    input: makeRuleInput("庚子", "申", "戌"),
    method: "涉害",
    subtype: undefined,
    branches: ["午", "辰", "寅"],
  },
] as const)("derives the Lin Feng $name case", ({ input, method, subtype, branches }) => {
  const result = deriveThreeTransmissions(input.plate, input.fourLessons);
  expect(result.method).toBe(method);
  if (subtype) expect(result.subtype).toBe(subtype);
  expect(result.transmissions.map(({ branch }) => branch)).toEqual(branches);
});
```

- [ ] **Step 2: Run the ordinary cases and verify RED**

Run:

```bash
npm test -- src/domain/three-transmissions/policy.test.ts
```

Expected: FAIL because the policy and special-method modules do not exist.

- [ ] **Step 3: Implement the ordinary orchestrator through 遥克**

Export the unresolved error used at the policy boundary:

```ts
export class ThreeTransmissionsRuleUnresolvedError extends Error {
  constructor(readonly evidence: readonly EvidenceDraft[]) {
    super("九宗门规则无法唯一确定初传");
    this.name = "ThreeTransmissionsRuleUnresolvedError";
  }
}
```

Use this explicit order in `deriveOrdinary`:

```ts
const vertical = findVerticalCandidates(fourLessons);
if (vertical.candidates.length > 0) return deriveFromVertical(vertical, dayStem, plate);

const uniqueLessonCount = countCanonicalLessons(fourLessons.lessons);
if (uniqueLessonCount === 2 && stemAndBranchShareResidence(fourLessons)) {
  return deriveEightSpecial(dayStem, fourLessons);
}

const remote = findRemoteCandidates(fourLessons, dayStem);
if (remote.kind === "selected") return chainOrdinary(remote, plate);
if (remote.kind === "unresolved") throw new ThreeTransmissionsRuleUnresolvedError(remote.evidence);
if (uniqueLessonCount === 4) return deriveMaoStar(dayStem, fourLessons, plate);
if (uniqueLessonCount === 3) return deriveSeparateResponsibility(dayStem, dayBranch, fourLessons, plate);
throw new ThreeTransmissionsRuleUnresolvedError(lessonCountEvidence);
```

For ordinary chained methods, set middle to `heavenAt(plate, initial)` and final to `heavenAt(plate, middle)`.

- [ ] **Step 4: Write failing 昴星, 别责, and 八专 tests**

```ts
it("derives both yin and yang Mao Star order", () => {
  const plate = makePlate("午", "子");
  const lessons = completeLessons({ first: "亥", third: "卯" });
  const yang = deriveMaoStar("甲", lessons, plate);
  expect(yang.subtype).toBe("虎视");
  expect(yang.branches).toEqual([heavenAt(plate, "酉"), lessons.lessons[2].upper, lessons.lessons[0].upper]);

  const yin = deriveMaoStar("乙", lessons, plate);
  expect(yin.subtype).toBe("冬蛇掩目");
  expect(yin.branches).toEqual([earthUnder(plate, "酉"), lessons.lessons[0].upper, lessons.lessons[2].upper]);
});

it("uses the combined stem residence for yang Separate Responsibility", () => {
  const plate = makePlate("午", "子");
  const lessons = threeUniqueLessons();
  const result = deriveSeparateResponsibility("甲", "辰", lessons, plate);
  expect(result.branches).toEqual([heavenAt(plate, STEM_RESIDENCES.己), lessons.lessons[0].upper, lessons.lessons[0].upper]);
});

it("uses the next trine branch for yin Separate Responsibility", () => {
  const plate = makePlate("午", "子");
  const lessons = threeUniqueLessons();
  const result = deriveSeparateResponsibility("乙", "酉", lessons, plate);
  expect(result.branches).toEqual(["丑", lessons.lessons[0].upper, lessons.lessons[0].upper]);
});

it("counts the starting god as one in Eight Special", () => {
  expect(deriveEightSpecial("甲", eightSpecialLessons({ first: "亥", fourth: "申" })).branches).toEqual(["丑", "亥", "亥"]);
  expect(deriveEightSpecial("乙", eightSpecialLessons({ first: "亥", fourth: "申" })).branches).toEqual(["午", "亥", "亥"]);
});
```

- [ ] **Step 5: Implement the three special ordinary methods and run GREEN**

昴星 uses the approved yin/yang initial, middle, and final order. 别责 uses the five-combination partner's residence for yang days and `nextTrineBranch(dayBranch)` for yin days; both repeat first upper for middle/final. 八专 uses canonical branch index `+2` from first upper for yang and `-2` from fourth upper for yin; both repeat first upper for middle/final.

Run:

```bash
npm test -- src/domain/three-transmissions/policy.test.ts
```

Expected: all ordinary and special ordinary cases PASS.

- [ ] **Step 6: Add six-relation and evidence completeness assertions**

```ts
const input = makeRuleInput("戊戌", "子", "戌");
const result = deriveThreeTransmissions(input.plate, input.fourLessons);
expect(result.transmissions.map(({ position, label }) => [position, label])).toEqual([
  ["initial", "初传"], ["middle", "中传"], ["final", "末传"],
]);
expect(result.transmissions.every(({ relation }) => ["父母", "子孙", "官鬼", "妻财", "兄弟"].includes(relation))).toBe(true);
expect(result.evidence.some(({ phase }) => phase === "plate")).toBe(true);
expect(result.evidence.filter(({ phase }) => phase === "relation")).toHaveLength(3);
```

Run the focused policy test and confirm PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/three-transmissions/special-methods.ts src/domain/three-transmissions/policy.ts src/domain/three-transmissions/policy.test.ts
git commit -m "feat: derive ordinary three transmissions"
```

---

### Task 4: 伏吟 and 反吟 Special Plates

**Files:**
- Modify: `src/domain/three-transmissions/special-methods.ts`
- Modify: `src/domain/three-transmissions/policy.ts`
- Test: `src/domain/three-transmissions/special-plates.test.ts`

**Interfaces:**
- Produces: `isFuYin(plate)`, `isFanYin(plate)`, `deriveFuYin(dayStem, fourLessons, plate)`, and `deriveFanYin(dayStem, dayBranch, fourLessons, plate)`.
- Updates: `deriveThreeTransmissions` to dispatch 伏吟 before 反吟 before ordinary rules.
- Test fixtures return `[HeavenEarthResult, FourLessonsResult]` in policy argument order:

```ts
fuYinWithOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult];
fuYinWithoutOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult];
fuYinSelfPunishmentCase(dayPillar: "壬辰"): [HeavenEarthResult, FourLessonsResult];
fanYinWithOvercoming(): [HeavenEarthResult, FourLessonsResult];
fanYinWithoutOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult];
noncanonicalFanYinNoOvercoming(): [HeavenEarthResult, FourLessonsResult];
```

- [ ] **Step 1: Write failing plate-classification and precedence tests**

```ts
it("classifies only all-twelve same-position plates as Fu Yin", () => {
  expect(isFuYin(makePlate("子", "子"))).toBe(true);
  expect(isFuYin(makePlate("丑", "子"))).toBe(false);
});

it("classifies only six-palace opposition as Fan Yin", () => {
  expect(isFanYin(makePlate("午", "子"))).toBe(true);
  expect(isFanYin(makePlate("巳", "子"))).toBe(false);
});

it("dispatches a same-position plate to Fu Yin before ordinary methods", () => {
  const input = makeRuleInput("甲寅", "子", "子");
  expect(deriveThreeTransmissions(input.plate, input.fourLessons).method).toBe("伏吟");
});
```

- [ ] **Step 2: Run RED, implement classifiers and dispatch, run the focused tests**

Require all twelve palace comparisons; do not infer special plates from offset alone. Run:

```bash
npm test -- src/domain/three-transmissions/special-plates.test.ts
```

Expected after implementation: classification and precedence tests PASS.

- [ ] **Step 3: Write failing 伏吟 transmission tests**

```ts
it("uses punishment transmissions for Fu Yin with vertical overcoming", () => {
  const result = deriveThreeTransmissions(...fuYinWithOvercoming("乙卯"));
  expect(result).toEqual(expect.objectContaining({ method: "伏吟", subtype: "不虞" }));
  expect(result.transmissions[1].branch).toBe(punishmentOf(result.transmissions[0].branch));
});

it("uses Self-Reliance and Self-Confidence when Fu Yin has no overcoming", () => {
  expect(deriveThreeTransmissions(...fuYinWithoutOvercoming("甲辰")).subtype).toBe("自任");
  expect(deriveThreeTransmissions(...fuYinWithoutOvercoming("丁辰")).subtype).toBe("自信");
});

it("switches the middle source and clashes the final after repeated self-punishment", () => {
  const result = deriveThreeTransmissions(...fuYinSelfPunishmentCase("壬辰"));
  expect(result.variants).toContain("杜传");
  expect(result.transmissions[2].branch).toBe(clashOf(result.transmissions[1].branch));
});
```

- [ ] **Step 4: Implement 伏吟 and run GREEN**

With vertical overcoming, reuse the same 贼克/比用/涉害 selector but keep method `伏吟` and subtype `不虞`. Without overcoming, choose first upper on yang days and third upper on yin days. Apply punishment; when initial self-punishes, switch to third upper for yang or first upper for yin and add `杜传`; when the substituted middle also self-punishes, clash it for final.

Run the special-plate test and confirm PASS.

- [ ] **Step 5: Write failing 反吟 tests**

```ts
it("uses vertical selection and ordinary heaven lookup when Fan Yin has overcoming", () => {
  const [plate, lessons] = fanYinWithOvercoming();
  const result = deriveThreeTransmissions(plate, lessons);
  expect(result.method).toBe("反吟");
  expect(result.transmissions[1].branch).toBe(heavenAt(plate, result.transmissions[0].branch));
});

it.each(["丁丑", "丁未", "己丑", "己未", "辛丑", "辛未"] as const)(
  "uses Well-Railing for the no-overcoming Fan Yin day %s",
  (dayPillar) => {
    const [plate, lessons] = fanYinWithoutOvercoming(dayPillar);
    const result = deriveThreeTransmissions(plate, lessons);
    expect(result.subtype).toBe("井栏");
    expect(result.transmissions.map(({ branch }) => branch)).toEqual([
      postHorseOf(dayPillar[1] as EarthlyBranch),
      lessons.lessons[2].upper,
      lessons.lessons[0].upper,
    ]);
  },
);

it("rejects a noncanonical no-overcoming Fan Yin day", () => {
  expect(() => deriveThreeTransmissions(...noncanonicalFanYinNoOvercoming())).toThrowError(ThreeTransmissionsRuleUnresolvedError);
});
```

- [ ] **Step 6: Implement 反吟 and run GREEN**

With vertical overcoming, reuse full vertical selection and take middle/final by `heavenAt`. Without overcoming, enforce the six-day set, then use post horse, third upper, first upper. Preserve detailed vertical evidence when present.

Run:

```bash
npm test -- src/domain/three-transmissions/special-plates.test.ts src/domain/three-transmissions/policy.test.ts
```

Expected: all special and ordinary policy tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/three-transmissions/special-methods.ts src/domain/three-transmissions/policy.ts src/domain/three-transmissions/special-plates.test.ts
git commit -m "feat: derive Fu Yin and Fan Yin transmissions"
```

---

### Task 5: Result Guard, Compute Boundary, and Session Validation

**Files:**
- Create: `src/domain/three-transmissions/result-guard.ts`
- Create: `src/domain/three-transmissions/compute-three-transmissions.ts`
- Test: `src/domain/three-transmissions/compute-three-transmissions.test.ts`
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`

**Interfaces:**
- Produces: `THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID`, `isThreeTransmissionsResult(value)`, `matchesThreeTransmissionsInputs(value, plate, fourLessons)`, and `threeTransmissionsResultSource(plateSource, fourLessonsSource)`.
- Produces: `computeThreeTransmissions(plate?, fourLessons?)` and `runThreeTransmissionsStage(session)`.
- Consumes: `deriveThreeTransmissions`, existing heaven-earth/four-lessons guards, and `invalidateFrom`.

At test setup, derive the fixtures from `referenceSession` so their provenance is explicit:

```ts
const validPlateSnapshot = referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot;
const validFourLessonsSnapshot = referenceSession.snapshots["four-lessons"] as FourLessonsSnapshot;
const validPlate = validPlateSnapshot.value;
const validFourLessons = validFourLessonsSnapshot.value;
const validThreeTransmissions = deriveThreeTransmissions(validPlate, validFourLessons);
const forgedFourLessonsSnapshot = {
  ...structuredClone(validFourLessonsSnapshot),
  value: { ...structuredClone(validFourLessonsSnapshot.value), dayPillar: "甲子" as const },
};
```

- [ ] **Step 1: Write failing compute-boundary tests**

```ts
it("creates an automatic snapshot with both direct dependencies", () => {
  const outcome = computeThreeTransmissions(validPlateSnapshot, validFourLessonsSnapshot);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) return;
  expect(outcome.snapshot).toEqual(expect.objectContaining({
    stage: "three-transmissions",
    dependsOn: ["heaven-earth", "four-lessons"],
    ruleId: "three-transmissions/nine-gates-v1",
    source: "automatic",
  }));
});

it("rejects missing, forged, or mutually inconsistent upstream snapshots", () => {
  expect(computeThreeTransmissions(undefined, validFourLessonsSnapshot)).toEqual(expect.objectContaining({ ok: false }));
  expect(computeThreeTransmissions(validPlateSnapshot, forgedFourLessonsSnapshot)).toEqual(expect.objectContaining({
    ok: false,
    error: expect.objectContaining({ code: "INVALID_THREE_TRANSMISSIONS_INPUT" }),
  }));
});
```

- [ ] **Step 2: Run RED and implement the compute boundary**

Validate both snapshot metadata and the relationship between the four lessons and plate before calling policy. Map `ThreeTransmissionsRuleUnresolvedError` to `THREE_TRANSMISSIONS_RULE_UNRESOLVED`; map incomplete canonical output to `THREE_TRANSMISSIONS_RESULT_INCOMPLETE`.

Run the focused test and verify the success and invalid-input cases PASS.

- [ ] **Step 3: Write failing canonical guard tests**

```ts
it.each([
  ["method", (value: MutableThreeTransmissionsResult) => { value.method = value.method === "昴星" ? "贼克" : "昴星"; }],
  ["order", (value: MutableThreeTransmissionsResult) => { value.transmissions = [value.transmissions[1], value.transmissions[0], value.transmissions[2]]; }],
  ["relation", (value: MutableThreeTransmissionsResult) => { value.transmissions[0].relation = value.transmissions[0].relation === "兄弟" ? "父母" : "兄弟"; }],
  ["evidence", (value: MutableThreeTransmissionsResult) => { value.evidence = value.evidence.slice(1); }],
] as const)("rejects a forged %s", (_name, mutate) => {
  const value = structuredClone(validThreeTransmissions) as MutableThreeTransmissionsResult;
  mutate(value);
  expect(matchesThreeTransmissionsInputs(value, validPlate, validFourLessons)).toBe(false);
});
```

Define the test-only mutable shape explicitly:

```ts
type MutableTransmission = Omit<Transmission, "relation" | "evidenceIds"> & {
  relation: SixRelation;
  evidenceIds: string[];
};
type MutableThreeTransmissionsResult = Omit<ThreeTransmissionsResult, "variants" | "transmissions" | "evidence"> & {
  variants: TransmissionVariant[];
  transmissions: [MutableTransmission, MutableTransmission, MutableTransmission];
  evidence: ThreeTransmissionsEvidenceStep[];
};
```

- [ ] **Step 4: Implement recomputing guard and run GREEN**

The guard must derive the canonical result from current inputs and compare day pillar, offset, method, subtype, variants, all three transmission objects, and the required evidence identity/content. Do not accept a result merely because it has three valid branches.

Run:

```bash
npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts
```

Expected: guard mutation matrix PASS.

- [ ] **Step 5: Write failing invalidation and session-validation tests**

```ts
it("keeps upstream and removes the failed stage plus all downstream snapshots", () => {
  const outcome = runThreeTransmissionsStage(sessionWithInvalidFourLessons);
  expect(outcome.ok).toBe(false);
  expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth", "four-lessons"]);
});

it("rejects a three-transmissions snapshot copied from another plate", () => {
  const errors = validateSession(sessionWithCopiedTransmissions);
  expect(errors).toContain("three-transmissions 与生效天地盘或四课不一致");
});
```

- [ ] **Step 6: Integrate session validation and reference data**

Add the same metadata/source/canonical-input checks used by prior stages to the `three-transmissions` branch in `validateSession`. Replace the reference session's layout-only three-transmissions placeholder with the real snapshot returned by `deriveThreeTransmissions`; keep downstream layout-only snapshots untouched.

Run:

```bash
npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts src/domain/chart/snapshots.test.ts
```

Expected: all compute, invalidation, dependency, and session guard tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/three-transmissions src/domain/chart/snapshots.ts src/domain/chart/snapshots.test.ts src/test/reference-session.ts
git commit -m "feat: add three transmissions stage boundary"
```

---

### Task 6: Traditional Vertical Three-Transmissions Review

**Files:**
- Create: `src/features/three-transmissions-review/ThreeTransmissionsReview.tsx`
- Test: `src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `ThreeTransmissionsResult`.
- Produces: `ThreeTransmissionsReview({ result, onReviewFourLessons, onReviewHeavenEarth })`.
- User interaction: three transmission buttons select evidence; close restores focus to the selecting button; upstream buttons invoke the provided callbacks.

- [ ] **Step 1: Write failing semantic render tests**

```tsx
render(
  <ThreeTransmissionsReview
    result={result}
    onReviewFourLessons={onReviewFourLessons}
    onReviewHeavenEarth={onReviewHeavenEarth}
  />,
);

expect(screen.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeInTheDocument();
expect(screen.getByText(`${result.method}${result.subtype ? ` · ${result.subtype}` : ""}`)).toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /传/ }).slice(0, 3).map((button) => button.textContent)).toEqual([
  expect.stringContaining("初传"),
  expect.stringContaining("中传"),
  expect.stringContaining("末传"),
]);
for (const transmission of result.transmissions) {
  expect(screen.getByText(transmission.branch)).toBeInTheDocument();
  expect(screen.getByText(transmission.relation)).toBeInTheDocument();
}
```

- [ ] **Step 2: Run RED, implement semantic markup, run the focused test**

Use a heading/header, one ordered list with exactly three direct list items, and a button inside each item. Keep DOM order initial, middle, final. Render `待天将加临` as a noninteractive label.

- [ ] **Step 3: Write failing evidence and focus tests**

```tsx
const middle = screen.getByRole("button", { name: /中传/ });
await user.click(middle);
expect(screen.getByRole("heading", { name: "中传证据" })).toBeInTheDocument();
expect(screen.getByText(result.transmissions[1].derivation)).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: "关闭证据" }));
expect(middle).toHaveFocus();

await user.click(screen.getByRole("button", { name: "查看四课" }));
expect(onReviewFourLessons).toHaveBeenCalledOnce();
await user.click(screen.getByRole("button", { name: "查看天地盘" }));
expect(onReviewHeavenEarth).toHaveBeenCalledOnce();
```

Add a 涉害 fixture assertion that every `shehai-palace` detail renders its earth branch, resident stems, increment, and total.

- [ ] **Step 4: Implement evidence filtering and focus restoration**

Default selection is initial and evidence is initially open. Filter evidence by `transmission` while always including shared `plate`, `lessons`, `candidates`, and `selection` phases for initial. Store the clicked button ref and use the initial button as the close fallback.

- [ ] **Step 5: Add desktop and narrow-screen CSS**

Create a two-column desktop grid matching current review pages. The left result area contains a top-to-bottom three-row list; the right evidence area uses the existing patina dividers and rule-id treatment. At the current narrow breakpoint, switch to one column, remove the inline divider, add a block-start divider before evidence, and keep every transmission record one inner column with no horizontal overflow.

Run:

```bash
npm test -- src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx
npm run build
```

Expected: component tests PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/three-transmissions-review src/styles/global.css
git commit -m "feat: add three transmissions review"
```

---

### Task 7: App Flow, Stage Rail, Rule Cases, and Browser Regression

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/rule-review/RuleStageRail.tsx`
- Modify: `src/features/rule-review/RuleStageRail.test.tsx`
- Create: `e2e/three-transmissions.spec.ts`
- Create: `docs/rule-cases/three-transmissions-v1.md`

**Interfaces:**
- Consumes: `runThreeTransmissionsStage`, `isThreeTransmissionsResult`, and `ThreeTransmissionsReview`.
- Produces: full offline flow through three-transmissions and review navigation among calendar, heaven-earth, four-lessons, and three-transmissions.

- [ ] **Step 1: Write failing app-flow tests**

```tsx
it("runs through three transmissions and advances the current stage to heavenly generals", async () => {
  render(<App />);
  await submitValidCourse(user);
  expect(await screen.findByRole("heading", { name: /九宗门 · 三传取法/ })).toBeInTheDocument();
  expect(screen.getByText("天将加临", { selector: '[data-status="current"]' })).toBeInTheDocument();
});

it("navigates from three transmissions back to four lessons and the plate", async () => {
  render(<App />);
  await submitValidCourse(user);
  await user.click(screen.getByRole("button", { name: "查看四课" }));
  expect(screen.getByRole("region", { name: "四课生成" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /三传取法.*已完成/ }));
  await user.click(screen.getByRole("button", { name: "查看天地盘" }));
  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeInTheDocument();
});
```

Add a mocked stage-failure test asserting the error belongs to three-transmissions and the UI can still review four lessons.

- [ ] **Step 2: Run RED and integrate the app stage**

Run:

```bash
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
```

Expected: FAIL because App stops at four lessons and three-transmissions is not a reviewable stage.

After a successful four-lessons stage, call `runThreeTransmissionsStage`; store its returned session, select `three-transmissions`, and set current to `heavenly-generals`. Extend `ReviewStage` and completed-stage calculation. Render the new review only after `isThreeTransmissionsResult` succeeds. Make completed three-transmissions rail entries keyboard-selectable.

- [ ] **Step 3: Run app tests and confirm GREEN**

Run:

```bash
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
```

Expected: app flow, failure preservation, rail status, and navigation tests PASS.

- [ ] **Step 4: Record source cases**

Create `docs/rule-cases/three-transmissions-v1.md` with source, input, expected result, and test pointer rows for at least:

```markdown
| 课例 | 日柱 | 月将加占时 | 预期 |
| --- | --- | --- | --- |
| 贼克始入 | 戊戌 | 子加戌 | 子、寅、辰 |
| 贼克元首 | 戊申 | 卯加辰 | 卯、寅、丑 |
| 涉害 | 庚子 | 申加戌 | 午、辰、寅；午四重、戌二重 |
| 八专 | 甲寅 | 丑加辰 | 丑、亥、亥 |
```

State that the canonical source is the user-provided pages from Lin Feng, Chapter 3, Section 1, and link each row to its Vitest test name. Add these explicitly marked synthetic rule rows so all nine methods are auditable without presenting them as quotations from the book:

```markdown
| 比用筛选 | 丙日；候选子、未、酉 | 同阴阳唯一取子 | selectors: keeps the only candidate |
| 涉害孟仲 | 庚日；相等候选分别加孟/仲 | 见机 / 察微 | selectors: resolves equal depth |
| 遥克蒿矢 | 壬日；二至四课上神戌、午、午 | 戌发用 | selectors: checks only unique upper gods |
| 昴星 | 完整四课；无克无遥 | 阳虎视、阴冬蛇掩目 | policy: derives both yin and yang Mao Star order |
| 别责 | 三课不备；无克无遥 | 阳取合干上神、阴取三合前支 | policy: Separate Responsibility tests |
| 伏吟 | 天地盘同位 | 不虞 / 自任 / 自信 / 杜传 | special-plates: Fu Yin tests |
| 反吟 | 天地盘正冲 | 有克递取 / 无克井栏 | special-plates: Fan Yin tests |
```

- [ ] **Step 5: Write the failing Playwright journey**

```ts
async function submitReferenceCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

test("reviews three transmissions and returns to its upstream evidence", async ({ page }) => {
  await page.goto("/");
  await submitReferenceCourse(page);
  await expect(page.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /初传/ })).toBeVisible();
  await page.getByRole("button", { name: /中传/ }).click();
  await expect(page.getByRole("heading", { name: "中传证据" })).toBeVisible();
  await page.getByRole("button", { name: "查看四课" }).click();
  await expect(page.getByRole("region", { name: "四课生成" })).toBeVisible();
});
```

Include a 390×844 viewport assertion that the review has no document-level horizontal overflow and the three list items remain in initial/middle/final DOM order.

- [ ] **Step 6: Run browser regression and fix only scoped failures**

Run:

```bash
npx playwright test e2e/three-transmissions.spec.ts
```

Expected: desktop journey and narrow-screen layout PASS.

- [ ] **Step 7: Run full verification**

Run in this order:

```bash
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all Vitest suites PASS, production build succeeds, all Playwright tests PASS, `git diff --check` has no output, and status lists only the intended Task 7 files before commit.

- [ ] **Step 8: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/features/rule-review/RuleStageRail.tsx src/features/rule-review/RuleStageRail.test.tsx e2e/three-transmissions.spec.ts docs/rule-cases/three-transmissions-v1.md
git commit -m "feat: integrate three transmissions flow"
```

---

## Final Review Checklist

- The spec's nine methods all map to focused policy tests.
- 伏吟 and 反吟 precedence is asserted independently of ordinary method eligibility.
- 八专 skips 遥克, and 遥克 excludes first lesson and deduplicates upper gods.
- 涉害 evidence includes every traversed palace, branch, resident stem, increment, and cumulative count.
- Three lessons are immutable in initial/middle/final order and all six relations are canonically recomputed.
- Snapshot dependency, source, upstream consistency, invalidation, and downstream cleanup are tested.
- The review follows the approved vertical layout, exposes complete evidence, restores focus, and works at 390×844.
- No manual correction, approval control, new package, generic rule engine, or unrelated refactor is introduced.
