# Heavenly Generals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fifth rule stage that derives Lin Feng's day/night nobleman and the complete forward/reverse twelve-heavenly-general placement, stores a guarded auditable snapshot, and shows the same mapping on the palace, four-lessons, and three-transmissions reviews.

**Architecture:** Add a focused `src/domain/heavenly-generals` module. A pure policy consumes only the effective day stem, divination-hour branch, and canonical heaven-earth plate; the stage runner separately enforces the complete calendar → plate → four-lessons → three-transmissions workflow gate. Store one independent heavenly-generals snapshot and expose pure heaven-branch/earth-palace lookup helpers so React never re-derives or duplicates the rule.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 3, Testing Library, Playwright, existing Vite build; no new dependencies.

## Global Constraints

- The sole rule source is `E:/frank知识库/03_Knowledge/术数/六壬-遁干与贵人.md`, sourced to 林烽《大六壬详解》第三章第二节.
- Treat the nobleman-table branch as a heaven-plate branch; locate its unique earth palace through the current heaven-earth plate before assigning 贵人.
- Day branches are exactly `卯 辰 巳 午 未 申`; night branches are exactly `酉 戌 亥 子 丑 寅`.
- Nobleman on `亥 子 丑 寅 卯 辰` uses forward placement; nobleman on `巳 午 未 申 酉 戌` uses reverse placement.
- General order is exactly `贵人 螣蛇 朱雀 六合 勾陈 青龙 天空 白虎 太常 玄武 太阴 天后`.
- Domain branch cycle is exactly `子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥`; forward increments and reverse decrements the index.
- Snapshot dependencies remain exactly `["calendar", "heaven-earth", "three-transmissions"]`; four lessons are a validated transitive prerequisite, not a direct dependency.
- Do not add 遁干, general five-elements, auspiciousness, interpretation text, course generation, manual editing/approval, animation, or 3D assets.
- UI order is summary → twelve-palace plate → four lessons → three transmissions → evidence; mobile uses the same single-column order.
- The runtime guard must reject present-but-wrong semantic values and must canonical-recompute from actual upstream values.
- Use TDD for every production change. Run the focused RED command before implementation and record the observed failure.
- Keep existing code style and do not refactor unrelated calendar, plate, four-lessons, or three-transmissions logic.

---

## File Structure

Create:

- `src/domain/heavenly-generals/types.ts` — result, evidence, outcome, snapshot, and error contracts.
- `src/domain/heavenly-generals/policy.ts` — fixed tables, pure day/night and placement policy, and lookup helpers.
- `src/domain/heavenly-generals/policy.test.ts` — exhaustive table, boundary, placement, lookup, and stability tests.
- `src/domain/heavenly-generals/result-guard.ts` — structural/canonical guards and snapshot source derivation.
- `src/domain/heavenly-generals/compute-heavenly-generals.ts` — snapshot composer and stage runner.
- `src/domain/heavenly-generals/compute-heavenly-generals.test.ts` — malformed-result and upstream/failure-session tests.
- `src/features/heavenly-generals-review/HeavenlyGeneralsReview.tsx` — approved palace-first audit UI.
- `src/features/heavenly-generals-review/HeavenlyGeneralsReview.test.tsx` — structure, lookup, evidence, focus, and ARIA tests.
- `e2e/heavenly-generals.spec.ts` — desktop/mobile/offline full-flow coverage.
- `docs/rule-cases/heavenly-generals-v1.md` — source matrix linking each rule claim to exact regression tests.

Modify:

- `src/domain/chart/snapshots.ts` — validate real heavenly-generals snapshots against upstream inputs.
- `src/domain/chart/snapshots.test.ts` — dependency, metadata, canonical mismatch, and invalidation assertions.
- `src/test/reference-session.ts` — replace the layout-only heavenly-generals placeholder with the real snapshot; leave course layout-only.
- `src/features/four-lessons-review/FourLessonsReview.tsx` and test — replace the placeholder with lookup output when a valid generals result exists.
- `src/features/three-transmissions-review/ThreeTransmissionsReview.tsx` and test — replace the placeholder with lookup output when a valid generals result exists.
- `src/app/App.tsx` and `src/app/App.test.tsx` — run/select/render the new stage and advance the rail to course.
- `src/styles/global.css` — approved desktop/mobile heavenly-generals layout only.
- `e2e/three-transmissions.spec.ts` — navigate back to the now-completed three-transmissions stage before existing assertions.
- `e2e/four-lessons.spec.ts` — assert resolved generals and the new completed/current rail state.

---

### Task 1: Pure heavenly-generals policy and contracts

**Files:**
- Create: `src/domain/heavenly-generals/types.ts`
- Create: `src/domain/heavenly-generals/policy.ts`
- Create: `src/domain/heavenly-generals/policy.test.ts`

**Interfaces:**
- Consumes: `HeavenlyStem`, `EarthlyBranch`, `RuleSnapshot`, `CourseSession` from `src/domain/chart/types.ts`; `HeavenEarthResult` from `src/domain/heaven-earth/types.ts`.
- Produces: `deriveHeavenlyGenerals(dayStem, divinationHour, plate)`, `generalForEarth(result, earth)`, `generalForHeaven(result, heaven)`, fixed tables/constants, and all public result/outcome types used by Tasks 2–6.

- [ ] **Step 1: Define failing table and boundary tests**

Create `policy.test.ts` with exact table coverage:

```ts
import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import {
  DAY_BRANCHES,
  GENERAL_ORDER,
  NOBLE_BRANCHES,
  classifyDayNight,
  deriveHeavenlyGenerals,
  generalForEarth,
  generalForHeaven,
} from "./policy";
import type { HeavenlyGeneral, HeavenlyGeneralsResult } from "./types";

const EXPECTED_NOBLES = [
  ["甲", "day", "丑"], ["甲", "night", "未"],
  ["乙", "day", "子"], ["乙", "night", "申"],
  ["丙", "day", "亥"], ["丙", "night", "酉"],
  ["丁", "day", "亥"], ["丁", "night", "酉"],
  ["戊", "day", "丑"], ["戊", "night", "未"],
  ["己", "day", "子"], ["己", "night", "申"],
  ["庚", "day", "丑"], ["庚", "night", "未"],
  ["辛", "day", "午"], ["辛", "night", "寅"],
  ["壬", "day", "巳"], ["壬", "night", "卯"],
  ["癸", "day", "巳"], ["癸", "night", "卯"],
] as const;

it.each(EXPECTED_NOBLES)("maps %s/%s to noble branch %s", (stem, dayNight, branch) => {
  expect(NOBLE_BRANCHES[stem][dayNight]).toBe(branch);
});

it.each([
  ["卯", "day"], ["申", "day"], ["酉", "night"], ["寅", "night"],
] as const)("classifies boundary hour %s as %s", (hour, expected) => {
  expect(classifyDayNight(hour)).toBe(expected);
});

it("keeps the approved day set and general order exact", () => {
  expect(DAY_BRANCHES).toEqual(["卯", "辰", "巳", "午", "未", "申"]);
  expect(GENERAL_ORDER).toEqual([
    "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
    "天空", "白虎", "太常", "玄武", "太阴", "天后",
  ]);
});
```

- [ ] **Step 2: Add failing placement, lookup, and stability tests**

Use a local canonical plate helper; do not import another domain's test helper:

```ts
function makePlate(offset: number): HeavenEarthResult {
  return {
    monthGeneral: { branch: "子", name: "神后", source: "automatic" },
    divinationHour: { branch: "子", source: "automatic" },
    offset,
    palaces: EARTHLY_BRANCHES.map((earth, index) => ({
      earth,
      heaven: EARTHLY_BRANCHES[(index + offset) % 12],
    })),
    evidence: [],
  };
}

it("locates the noble heaven branch on earth before placing forward", () => {
  const result = deriveHeavenlyGenerals("甲", "卯", makePlate(0));
  expect(result.nobleHeaven).toBe("丑");
  expect(result.nobleEarth).toBe("丑");
  expect(result.direction).toBe("forward");
  expect(result.placements.slice(0, 3)).toMatchObject([
    { order: 0, general: "贵人", earth: "丑", heaven: "丑" },
    { order: 1, general: "螣蛇", earth: "寅", heaven: "寅" },
    { order: 2, general: "朱雀", earth: "卯", heaven: "卯" },
  ]);
});

it("locates the noble heaven branch on earth before placing reverse", () => {
  const result = deriveHeavenlyGenerals("辛", "子", makePlate(6));
  expect(result.nobleHeaven).toBe("寅");
  expect(result.nobleEarth).toBe("申");
  expect(result.direction).toBe("reverse");
  expect(result.placements.slice(0, 3)).toMatchObject([
    { order: 0, general: "贵人", earth: "申", heaven: "寅" },
    { order: 1, general: "螣蛇", earth: "未", heaven: "丑" },
    { order: 2, general: "朱雀", earth: "午", heaven: "子" },
  ]);
});

it("provides one shared general by earth and heaven", () => {
  const result = deriveHeavenlyGenerals("辛", "子", makePlate(6));
  for (const placement of result.placements) {
    expect(generalForEarth(result, placement.earth)).toBe(placement.general);
    expect(generalForHeaven(result, placement.heaven)).toBe(placement.general);
  }
});

it("derives byte-stable evidence", () => {
  const first = deriveHeavenlyGenerals("壬", "申", makePlate(4));
  const second = deriveHeavenlyGenerals("壬", "申", makePlate(4));
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
});

it.each([
  ["甲", "卯", 0, "丑", "forward"],
  ["辛", "子", 0, "寅", "forward"],
  ["甲", "卯", 6, "未", "reverse"],
  ["辛", "子", 6, "申", "reverse"],
] as const)("places %s/%s on offset %d from %s in %s direction", (stem, hour, offset, earth, direction) => {
  const result = deriveHeavenlyGenerals(stem, hour, makePlate(offset));
  expect(result).toMatchObject({ nobleEarth: earth, direction });
});

it("rejects a plate where the noble heaven branch is not unique", () => {
  const plate = structuredClone(makePlate(0));
  const palaces = plate.palaces as Array<{ earth: EarthlyBranch; heaven: EarthlyBranch }>;
  palaces[1].heaven = "丑";
  palaces[2].heaven = "丑";
  expect(() => deriveHeavenlyGenerals("甲", "卯", plate)).toThrow("贵人天盘支丑所临地盘宫不唯一");
});

it("rejects a noncanonical twelve-palace mapping", () => {
  const plate = structuredClone(makePlate(0));
  const palaces = plate.palaces as Array<{ earth: EarthlyBranch; heaven: EarthlyBranch }>;
  [palaces[2], palaces[3]] = [palaces[3], palaces[2]];
  expect(() => deriveHeavenlyGenerals("甲", "卯", plate)).toThrow("天地盘十二支布列无效");
});
```

- [ ] **Step 3: Run RED**

Run:

```bash
npm test -- src/domain/heavenly-generals/policy.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement exact public contracts**

Create `types.ts` with these names and discriminants:

```ts
import type { CourseSession, EarthlyBranch, HeavenlyStem, RuleSnapshot } from "../chart/types";

export type HeavenlyGeneral =
  | "贵人" | "螣蛇" | "朱雀" | "六合" | "勾陈" | "青龙"
  | "天空" | "白虎" | "太常" | "玄武" | "太阴" | "天后";
export type NobleDayNight = "day" | "night";
export type GeneralDirection = "forward" | "reverse";

export interface GeneralPlacement {
  order: number;
  general: HeavenlyGeneral;
  earth: EarthlyBranch;
  heaven: EarthlyBranch;
  evidenceId: string;
}

type EvidenceBase = { id: string; input: string; conclusion: string };
export type HeavenlyGeneralsEvidenceStep =
  | (EvidenceBase & { ruleId: "heavenly-generals/day-night-v1"; phase: "day-night"; details: { divinationHour: EarthlyBranch; dayNight: NobleDayNight } })
  | (EvidenceBase & { ruleId: "heavenly-generals/noble-branch-v1"; phase: "noble-branch"; details: { dayStem: HeavenlyStem; dayNight: NobleDayNight; dayNoble: EarthlyBranch; nightNoble: EarthlyBranch; selected: EarthlyBranch } })
  | (EvidenceBase & { ruleId: "heavenly-generals/noble-palace-v1"; phase: "noble-palace"; details: { nobleHeaven: EarthlyBranch; nobleEarth: EarthlyBranch } })
  | (EvidenceBase & { ruleId: "heavenly-generals/direction-v1"; phase: "direction"; details: { nobleEarth: EarthlyBranch; direction: GeneralDirection } })
  | (EvidenceBase & { ruleId: "heavenly-generals/placement-v1"; phase: "placement"; details: { order: number; general: HeavenlyGeneral; previousEarth?: EarthlyBranch; earth: EarthlyBranch; heaven: EarthlyBranch; direction: GeneralDirection } });

export interface HeavenlyGeneralsResult {
  dayStem: HeavenlyStem;
  divinationHour: EarthlyBranch;
  dayNight: NobleDayNight;
  nobleHeaven: EarthlyBranch;
  nobleEarth: EarthlyBranch;
  direction: GeneralDirection;
  placements: readonly GeneralPlacement[];
  evidence: readonly HeavenlyGeneralsEvidenceStep[];
}

export type HeavenlyGeneralsErrorCode =
  | "INVALID_HEAVENLY_GENERALS_INPUT"
  | "NOBLE_BRANCH_LOOKUP_FAILED"
  | "NOBLE_PALACE_NOT_UNIQUE"
  | "HEAVENLY_GENERALS_RESULT_INCOMPLETE";
export type HeavenlyGeneralsSnapshot = RuleSnapshot<HeavenlyGeneralsResult, "heavenly-generals">;
export type HeavenlyGeneralsOutcome =
  | { ok: true; value: HeavenlyGeneralsResult; snapshot: HeavenlyGeneralsSnapshot }
  | { ok: false; error: { code: HeavenlyGeneralsErrorCode; message: string; cause?: unknown } };
export type HeavenlyGeneralsStageOutcome =
  | { ok: true; value: HeavenlyGeneralsResult; session: CourseSession }
  | { ok: false; error: { code: HeavenlyGeneralsErrorCode; message: string; cause?: unknown }; session: CourseSession };
```

- [ ] **Step 5: Implement the pure policy minimally**

Create `policy.ts` with readonly constants and no React/session imports:

```ts
export const DAY_BRANCHES = ["卯", "辰", "巳", "午", "未", "申"] as const;
export const FORWARD_NOBLE_EARTHS = ["亥", "子", "丑", "寅", "卯", "辰"] as const;
export const GENERAL_ORDER = [
  "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
  "天空", "白虎", "太常", "玄武", "太阴", "天后",
] as const satisfies readonly HeavenlyGeneral[];
export const NOBLE_BRANCHES = {
  甲: { day: "丑", night: "未" }, 乙: { day: "子", night: "申" },
  丙: { day: "亥", night: "酉" }, 丁: { day: "亥", night: "酉" },
  戊: { day: "丑", night: "未" }, 己: { day: "子", night: "申" },
  庚: { day: "丑", night: "未" }, 辛: { day: "午", night: "寅" },
  壬: { day: "巳", night: "卯" }, 癸: { day: "巳", night: "卯" },
} as const satisfies Record<HeavenlyStem, Record<NobleDayNight, EarthlyBranch>>;

export function classifyDayNight(hour: EarthlyBranch): NobleDayNight {
  return (DAY_BRANCHES as readonly EarthlyBranch[]).includes(hour) ? "day" : "night";
}

export function deriveHeavenlyGenerals(
  dayStem: HeavenlyStem,
  divinationHour: EarthlyBranch,
  plate: HeavenEarthResult,
): HeavenlyGeneralsResult {
  const dayNight = classifyDayNight(divinationHour);
  const noble = NOBLE_BRANCHES[dayStem];
  const nobleHeaven = noble[dayNight];
  const matchingPalaces = plate.palaces.filter(({ heaven }) => heaven === nobleHeaven);
  if (matchingPalaces.length !== 1) throw new Error(`贵人天盘支${nobleHeaven}所临地盘宫不唯一`);
  if (!Number.isInteger(plate.offset)
    || plate.offset < 0
    || plate.offset > 11
    || plate.palaces.length !== 12
    || !plate.palaces.every(({ earth, heaven }, index) => (
      earth === EARTHLY_BRANCHES[index]
      && heaven === EARTHLY_BRANCHES[(index + plate.offset) % 12]
    ))) throw new Error("天地盘十二支布列无效");
  const nobleEarth = matchingPalaces[0].earth;
  const direction: GeneralDirection = (FORWARD_NOBLE_EARTHS as readonly EarthlyBranch[]).includes(nobleEarth)
    ? "forward"
    : "reverse";
  const movement = direction === "forward" ? 1 : -1;
  const nobleIndex = EARTHLY_BRANCHES.indexOf(nobleEarth);
  const placementEvidenceIds = GENERAL_ORDER.map((_, order) => `hg-${String(order + 5).padStart(2, "0")}`);
  const placements = GENERAL_ORDER.map((general, order) => {
    const earthIndex = (nobleIndex + movement * order + 12) % 12;
    const earth = EARTHLY_BRANCHES[earthIndex];
    const palace = plate.palaces.find((item) => item.earth === earth);
    if (!palace) throw new Error(`天地盘缺少${earth}宫`);
    return { order, general, earth, heaven: palace.heaven, evidenceId: placementEvidenceIds[order] };
  });
  const evidence: HeavenlyGeneralsEvidenceStep[] = [
    { id: "hg-01", ruleId: "heavenly-generals/day-night-v1", phase: "day-night", input: `占时${divinationHour}`, conclusion: dayNight === "day" ? "卯至申为昼占" : "酉至寅为夜占", details: { divinationHour, dayNight } },
    { id: "hg-02", ruleId: "heavenly-generals/noble-branch-v1", phase: "noble-branch", input: `日干${dayStem}，${dayNight}`, conclusion: `取贵人天盘支${nobleHeaven}`, details: { dayStem, dayNight, dayNoble: noble.day, nightNoble: noble.night, selected: nobleHeaven } },
    { id: "hg-03", ruleId: "heavenly-generals/noble-palace-v1", phase: "noble-palace", input: `天盘${nobleHeaven}`, conclusion: `临地盘${nobleEarth}宫`, details: { nobleHeaven, nobleEarth } },
    { id: "hg-04", ruleId: "heavenly-generals/direction-v1", phase: "direction", input: `贵人临${nobleEarth}`, conclusion: direction === "forward" ? "六宫内顺布" : "六宫外逆布", details: { nobleEarth, direction } },
    ...placements.map((placement, order) => ({
      id: placement.evidenceId,
      ruleId: "heavenly-generals/placement-v1" as const,
      phase: "placement" as const,
      input: `${GENERAL_ORDER[order]}为第${order + 1}将`,
      conclusion: `${placement.general}临地盘${placement.earth}、天盘${placement.heaven}`,
      details: {
        order,
        general: placement.general,
        ...(order > 0 ? { previousEarth: placements[order - 1].earth } : {}),
        earth: placement.earth,
        heaven: placement.heaven,
        direction,
      },
    })),
  ];
  return { dayStem, divinationHour, dayNight, nobleHeaven, nobleEarth, direction, placements, evidence };
}

export function generalForEarth(result: HeavenlyGeneralsResult, earth: EarthlyBranch): HeavenlyGeneral {
  const placement = result.placements.find((item) => item.earth === earth);
  if (!placement) throw new Error(`天将结果缺少地盘${earth}宫`);
  return placement.general;
}

export function generalForHeaven(result: HeavenlyGeneralsResult, heaven: EarthlyBranch): HeavenlyGeneral {
  const placement = result.placements.find((item) => item.heaven === heaven);
  if (!placement) throw new Error(`天将结果缺少天盘${heaven}支`);
  return placement.general;
}
```

The implementation must emit evidence in exact order: day-night, noble-branch, noble-palace, direction, then placement order 0–11. `placement.evidenceId` must point to its own placement evidence step.

- [ ] **Step 6: Run GREEN and the existing domain suite**

Run:

```bash
npm test -- src/domain/heavenly-generals/policy.test.ts src/domain/heaven-earth/policy.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/heavenly-generals/types.ts src/domain/heavenly-generals/policy.ts src/domain/heavenly-generals/policy.test.ts
git commit -m "feat: derive twelve heavenly generals"
```

---

### Task 2: Runtime guard, snapshot composer, and stage runner

**Files:**
- Create: `src/domain/heavenly-generals/result-guard.ts`
- Create: `src/domain/heavenly-generals/compute-heavenly-generals.ts`
- Create: `src/domain/heavenly-generals/compute-heavenly-generals.test.ts`

**Interfaces:**
- Consumes: Task 1 `deriveHeavenlyGenerals` and types; existing calendar/plate/four-lessons/three-transmissions guards and snapshots; `invalidateFrom`.
- Produces: `HEAVENLY_GENERALS_SNAPSHOT_RULE_ID`, `isHeavenlyGeneralsResult`, `matchesHeavenlyGeneralsInputs`, `heavenlyGeneralsResultSource`, `computeHeavenlyGenerals`, and `runHeavenlyGeneralsStage`.

- [ ] **Step 1: Write failing structural and present-but-wrong guard tests**

In `compute-heavenly-generals.test.ts`, derive a valid result and mutate one semantic value at a time:

```ts
it.each([
  ["direction", (value: HeavenlyGeneralsResult) => { value.direction = value.direction === "forward" ? "reverse" : "forward"; }],
  ["noble palace", (value: HeavenlyGeneralsResult) => { value.nobleEarth = "午"; }],
  ["general order", (value: HeavenlyGeneralsResult) => {
    (value.placements[1] as { general: HeavenlyGeneral }).general = "朱雀";
  }],
  ["placement evidence", (value: HeavenlyGeneralsResult) => {
    const step = value.evidence.find((item) => item.phase === "placement")!;
    if (step.phase === "placement") step.details.earth = "戌";
  }],
] as const)("rejects present-but-wrong %s", (_name, mutate) => {
  const forged = structuredClone(validValue);
  mutate(forged);
  expect(isHeavenlyGeneralsResult(forged)).toBe(false);
});
```

Also cover duplicate evidence IDs, dangling `evidenceId`, 11/13 placements, duplicate earth, duplicate heaven, legal rule ID in the wrong phase, and a noncanonical value that is structurally valid but fails `matchesHeavenlyGeneralsInputs`.

- [ ] **Step 2: Write failing composer and upstream-stage tests**

Use `referenceSession` and explicit mutations:

```ts
it("composes a guarded snapshot with exact dependencies", () => {
  const outcome = computeHeavenlyGenerals(calendar, plate, fourLessons, transmissions);
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) return;
  expect(outcome.snapshot).toMatchObject({
    stage: "heavenly-generals",
    dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
    ruleId: HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  });
});

const upstreamCases = [
  {
    name: "calendar",
    mutate(session: CourseSession) {
      delete session.snapshots.calendar;
    },
    expectedKeys: [],
  },
  {
    name: "heaven-earth",
    mutate(session: CourseSession) {
      const plate = session.snapshots["heaven-earth"] as HeavenEarthSnapshot;
      plate.value.monthGeneral.source = "manual";
      plate.source = "manual";
    },
    expectedKeys: ["calendar"],
  },
  {
    name: "four-lessons",
    mutate(session: CourseSession) {
      const lessons = session.snapshots["four-lessons"] as FourLessonsSnapshot;
      lessons.value.dayPillar = lessons.value.dayPillar === "甲子" ? "乙丑" : "甲子";
    },
    expectedKeys: ["calendar", "heaven-earth"],
  },
  {
    name: "three-transmissions",
    mutate(session: CourseSession) {
      const transmissions = session.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
      transmissions.value.dayPillar = transmissions.value.dayPillar === "甲子" ? "乙丑" : "甲子";
    },
    expectedKeys: ["calendar", "heaven-earth", "four-lessons"],
  },
] as const;

it.each(upstreamCases)("invalidates from the earliest invalid $name stage", ({ mutate, expectedKeys }) => {
  const broken = structuredClone(referenceSession);
  mutate(broken);
  const outcome = runHeavenlyGeneralsStage(broken);
  expect(outcome.ok).toBe(false);
  expect(Object.keys(outcome.session.snapshots)).toEqual(expectedKeys);
});

it("keeps valid upstream when the derived result fails its guard", () => {
  vi.spyOn(resultGuard, "isHeavenlyGeneralsResult").mockReturnValueOnce(false);
  const outcome = runHeavenlyGeneralsStage(referenceSession);
  expect(outcome).toMatchObject({
    ok: false,
    error: { code: "HEAVENLY_GENERALS_RESULT_INCOMPLETE" },
  });
  expect(Object.keys(outcome.session.snapshots)).toEqual([
    "calendar", "heaven-earth", "four-lessons", "three-transmissions",
  ]);
});
```

Import the guard as `import * as resultGuard from "./result-guard"` so the failure injection observes the real runner boundary.

- [ ] **Step 3: Run RED**

```bash
npm test -- src/domain/heavenly-generals/compute-heavenly-generals.test.ts
```

Expected: FAIL because guard and composer exports do not exist.

- [ ] **Step 4: Implement the strict result guard**

Create `result-guard.ts`:

```ts
export const HEAVENLY_GENERALS_SNAPSHOT_RULE_ID = "heavenly-generals/lin-feng-noble-v1";

export function isHeavenlyGeneralsResult(value: unknown): value is HeavenlyGeneralsResult {
  if (!isRecord(value)
    || !isStem(value.dayStem)
    || !isBranch(value.divinationHour)
    || (value.dayNight !== "day" && value.dayNight !== "night")
    || !isBranch(value.nobleHeaven)
    || !isBranch(value.nobleEarth)
    || (value.direction !== "forward" && value.direction !== "reverse")
    || !Array.isArray(value.placements)
    || value.placements.length !== 12
    || !Array.isArray(value.evidence)
    || value.evidence.length !== 16) return false;

  if (!value.placements.every((placement, order) => isRecord(placement)
    && placement.order === order
    && GENERAL_ORDER[order] === placement.general
    && isBranch(placement.earth)
    && isBranch(placement.heaven)
    && typeof placement.evidenceId === "string")) return false;
  if (!value.evidence.every((step) => isRecord(step)
    && typeof step.id === "string"
    && typeof step.ruleId === "string"
    && typeof step.phase === "string"
    && typeof step.input === "string"
    && typeof step.conclusion === "string"
    && isRecord(step.details))) return false;
  const result = value as unknown as HeavenlyGeneralsResult;
  if (new Set(result.placements.map(({ earth }) => earth)).size !== 12
    || new Set(result.placements.map(({ heaven }) => heaven)).size !== 12
    || new Set(result.placements.map(({ general }) => general)).size !== 12
    || new Set(result.evidence.map(({ id }) => id)).size !== 16) return false;

  const syntheticPalaces = EARTHLY_BRANCHES.map((earth) => {
    const placement = result.placements.find((item) => item.earth === earth);
    if (!placement) throw new Error(`缺少地盘${earth}宫`);
    return { earth, heaven: placement.heaven };
  });
  const offset = EARTHLY_BRANCHES.indexOf(syntheticPalaces[0].heaven);
  const syntheticPlate: HeavenEarthResult = {
    monthGeneral: { branch: "子", name: "神后", source: "automatic" },
    divinationHour: { branch: result.divinationHour, source: "automatic" },
    offset,
    palaces: syntheticPalaces,
    evidence: [],
  };
  try {
    return sameValue(result, deriveHeavenlyGenerals(
      result.dayStem,
      result.divinationHour,
      syntheticPlate,
    ));
  } catch {
    return false;
  }
}

export function matchesHeavenlyGeneralsInputs(
  value: HeavenlyGeneralsResult,
  dayStem: HeavenlyStem,
  divinationHour: EarthlyBranch,
  plate: HeavenEarthResult,
): boolean {
  if (!isHeavenlyGeneralsResult(value)) return false;
  try {
    return sameValue(value, deriveHeavenlyGenerals(dayStem, divinationHour, plate));
  } catch {
    return false;
  }
}

export function heavenlyGeneralsResultSource(
  calendar: CalendarResult,
  plateSource: ValueSource,
): ValueSource {
  return calendar.pillars.day.source === "manual"
    || calendar.divinationHour.source === "manual"
    || plateSource === "manual"
    ? "manual"
    : "automatic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStem(value: unknown): value is HeavenlyStem {
  return typeof value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function sameArray(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && sameArray(left, right);
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}
```

Import `HEAVENLY_STEMS` and `EARTHLY_BRANCHES` from calendar constants. The synthetic plate is only an internal-consistency check; `matchesHeavenlyGeneralsInputs` must still recompute against the actual upstream plate.

Do not accept arbitrary nonempty rule IDs, arbitrary detail objects, or `total >= expected`-style weak checks. Every stored semantic field must equal its recomputed value.

- [ ] **Step 5: Implement composer and ordered upstream validation**

Create `compute-heavenly-generals.ts` with exact signatures:

```ts
export function computeHeavenlyGenerals(
  calendar?: CalendarSnapshot,
  plate?: HeavenEarthSnapshot,
  fourLessons?: FourLessonsSnapshot,
  transmissions?: ThreeTransmissionsSnapshot,
): HeavenlyGeneralsOutcome;

export function runHeavenlyGeneralsStage(session: CourseSession): HeavenlyGeneralsStageOutcome;
```

The runner must validate in this order:

1. actual current calendar snapshot;
2. plate metadata, source, and effective month-general/divination-hour match;
3. four-lessons metadata/source/canonical match to that calendar and plate;
4. three-transmissions metadata/source/canonical match to that plate and four lessons;
5. derive and guard heavenly-generals.

Use `invalidateFrom(session, earliestInvalidStage)` for upstream failures and `invalidateFrom(session, "heavenly-generals")` before both failure return and successful insertion.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- src/domain/heavenly-generals/policy.test.ts src/domain/heavenly-generals/compute-heavenly-generals.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/heavenly-generals/result-guard.ts src/domain/heavenly-generals/compute-heavenly-generals.ts src/domain/heavenly-generals/compute-heavenly-generals.test.ts
git commit -m "feat: add heavenly generals stage boundary"
```

---

### Task 3: Session validation and real reference snapshot

**Files:**
- Modify: `src/domain/chart/snapshots.ts`
- Modify: `src/domain/chart/snapshots.test.ts`
- Modify: `src/test/reference-session.ts`

**Interfaces:**
- Consumes: Task 2 guard/source exports and `deriveHeavenlyGenerals`.
- Produces: a `referenceSession` with a real `HeavenlyGeneralsSnapshot`; `validateSession` rejects invalid heavenly-generals metadata, value, source, and upstream mismatch.

- [ ] **Step 1: Write failing session-validation tests**

Add exact assertions:

```ts
it("accepts the complete real reference session", () => {
  expect(validateSession(referenceSession)).toEqual([]);
});

it("rejects forged heavenly-generals metadata", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["heavenly-generals"]!.ruleId = "heavenly-generals/forged-v1";
  expect(validateSession(broken)).toContain("heavenly-generals 快照规则编号无效");
});

it("rejects heavenly generals copied from another plate", () => {
  const broken = structuredClone(referenceSession);
  const generals = broken.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;
  generals.value.nobleEarth = generals.value.nobleEarth === "子" ? "丑" : "子";
  expect(validateSession(broken)).toContain("heavenly-generals 与生效日干、占时或天地盘不一致");
});

it("removes heavenly-generals and course when three transmissions change", () => {
  const next = invalidateFrom(referenceSession, "three-transmissions");
  expect(next.snapshots["heavenly-generals"]).toBeUndefined();
  expect(next.snapshots.course).toBeUndefined();
});
```

Retain the existing exact dependency assertion:

```ts
expect(stageDependencies["heavenly-generals"]).toEqual([
  "calendar", "heaven-earth", "three-transmissions",
]);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- src/domain/chart/snapshots.test.ts
```

Expected: FAIL because the current reference value is layout-only and `validateSession` has no heavenly-generals branch.

- [ ] **Step 3: Replace the reference placeholder with a real snapshot**

In `reference-session.ts`:

```ts
const heavenlyGeneralsSnapshot = {
  stage: "heavenly-generals",
  dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
  ruleId: HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  source: heavenlyGeneralsResultSource(calendarSnapshot.value, heavenEarthSnapshot.source),
  value: deriveHeavenlyGenerals(
    calendarSnapshot.value.pillars.day.effective[0] as HeavenlyStem,
    calendarSnapshot.value.divinationHour.effective,
    heavenEarthSnapshot.value,
  ),
} as const satisfies HeavenlyGeneralsSnapshot;
```

Use it at `snapshots["heavenly-generals"]`. Keep `course` as the unrelated layout-only fixture.

- [ ] **Step 4: Add the heavenly-generals branch to `validateSession`**

After the three-transmissions branch, validate:

```ts
if (stage === "heavenly-generals") {
  if (!isHeavenlyGeneralsResult(snapshot.value)) {
    errors.push("heavenly-generals 快照结果无效");
  } else {
    if (snapshot.ruleId !== HEAVENLY_GENERALS_SNAPSHOT_RULE_ID) {
      errors.push("heavenly-generals 快照规则编号无效");
    }
    const calendar = session.snapshots.calendar;
    const plate = session.snapshots["heaven-earth"];
    const fourLessons = session.snapshots["four-lessons"];
    const transmissions = session.snapshots["three-transmissions"];
    if (isCalendarSnapshot(calendar)
      && plate && isHeavenEarthResult(plate.value)
      && fourLessons && isFourLessonsResult(fourLessons.value)
      && transmissions && isThreeTransmissionsResult(transmissions.value)) {
      const expectedSource = heavenlyGeneralsResultSource(calendar.value, plate.source);
      if (snapshot.source !== expectedSource) {
        errors.push(`heavenly-generals 快照来源无效，应为 ${expectedSource}`);
      }
      const dayStem = calendar.value.pillars.day.effective[0] as HeavenlyStem;
      if (!matchesHeavenlyGeneralsInputs(
        snapshot.value,
        dayStem,
        calendar.value.divinationHour.effective,
        plate.value,
      )) errors.push("heavenly-generals 与生效日干、占时或天地盘不一致");
    }
  }
}
```

Do not weaken the shared exact `dependsOn` comparison.

- [ ] **Step 5: Run GREEN and regression suite**

```bash
npm test -- src/domain/chart/snapshots.test.ts src/domain/heavenly-generals/compute-heavenly-generals.test.ts src/test/calendar-cases.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/chart/snapshots.ts src/domain/chart/snapshots.test.ts src/test/reference-session.ts
git commit -m "feat: validate heavenly generals snapshots"
```

---

### Task 4: Palace-first review UI and shared upstream annotations

**Files:**
- Create: `src/features/heavenly-generals-review/HeavenlyGeneralsReview.tsx`
- Create: `src/features/heavenly-generals-review/HeavenlyGeneralsReview.test.tsx`
- Modify: `src/features/four-lessons-review/FourLessonsReview.tsx`
- Modify: `src/features/four-lessons-review/FourLessonsReview.test.tsx`
- Modify: `src/features/three-transmissions-review/ThreeTransmissionsReview.tsx`
- Modify: `src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `HeavenlyGeneralsResult`, `FourLessonsResult`, `ThreeTransmissionsResult`, `generalForHeaven`.
- Produces: `HeavenlyGeneralsReview` and optional `generals?: HeavenlyGeneralsResult` props on the two upstream review components.

- [ ] **Step 1: Write failing review structure and lookup tests**

Build the fixture from the real `referenceSession` and assert:

```tsx
render(
  <HeavenlyGeneralsReview
    result={generals}
    fourLessons={fourLessons}
    threeTransmissions={transmissions}
    onReviewCalendar={() => {}}
    onReviewHeavenEarth={() => {}}
    onReviewFourLessons={() => {}}
    onReviewThreeTransmissions={() => {}}
  />,
);

expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeInTheDocument();
const palaces = screen.getByRole("list", { name: "十二天将方盘" });
expect(within(palaces).getAllByRole("listitem")).toHaveLength(12);
expect(screen.getByText(`昼夜：${generals.dayNight === "day" ? "昼贵" : "夜贵"}`)).toBeInTheDocument();

for (const lesson of fourLessons.lessons) {
  expect(screen.getByLabelText(new RegExp(`${lesson.label}.*${generalForHeaven(generals, lesson.upper)}`))).toBeVisible();
}
for (const transmission of transmissions.transmissions) {
  expect(screen.getByLabelText(new RegExp(`${transmission.label}.*${generalForHeaven(generals, transmission.branch)}`))).toBeVisible();
}
```

Use the existing visual earth order exactly:

```ts
const VISUAL_EARTH_ORDER = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;
```

- [ ] **Step 2: Write failing interaction/accessibility tests**

```tsx
const palaceButton = screen.getByRole("button", { name: /申宫.*贵人/ });
await user.click(palaceButton);
expect(palaceButton).toHaveAttribute("aria-pressed", "true");
expect(palaceButton).toHaveAttribute("aria-expanded", "true");
expect(screen.getByRole("heading", { name: /申宫布将证据/ })).toBeVisible();
await user.click(screen.getByRole("button", { name: "关闭证据" }));
expect(palaceButton).toHaveFocus();

it("returns focus to the initial palace when evidence closes before selection", async () => {
  const user = userEvent.setup();
  render(
    <HeavenlyGeneralsReview
      result={generals}
      fourLessons={fourLessons}
      threeTransmissions={transmissions}
      onReviewCalendar={() => {}}
      onReviewHeavenEarth={() => {}}
      onReviewFourLessons={() => {}}
      onReviewThreeTransmissions={() => {}}
    />,
  );
  await user.click(screen.getByRole("button", { name: "关闭证据" }));
  expect(screen.getAllByRole("button", { name: /宫/ })[0]).toHaveFocus();
});
```

Assert the noble palace carries `data-noble="true"`, evidence contains all five phase labels, and there is no manual correction/approval button.

- [ ] **Step 3: Write failing placeholder-replacement tests for prior stages**

Add `generals={generals}` to FourLessonsReview and ThreeTransmissionsReview renders and assert exact accessible names contain the resolved general. Add one no-`generals` characterization assertion proving the pre-stage placeholder remains `待天将加临`.

- [ ] **Step 4: Run RED**

```bash
npm test -- src/features/heavenly-generals-review/HeavenlyGeneralsReview.test.tsx src/features/four-lessons-review/FourLessonsReview.test.tsx src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx
```

Expected: FAIL because the new component and props do not exist.

- [ ] **Step 5: Implement the review component and minimal upstream props**

Use this public prop contract:

```ts
interface HeavenlyGeneralsReviewProps {
  result: HeavenlyGeneralsResult;
  fourLessons: FourLessonsResult;
  threeTransmissions: ThreeTransmissionsResult;
  onReviewCalendar: () => void;
  onReviewHeavenEarth: () => void;
  onReviewFourLessons: () => void;
  onReviewThreeTransmissions: () => void;
}
```

The component may call `generalForHeaven` only for lookup. It must not call `deriveHeavenlyGenerals`, classify day/night, or reconstruct direction.

Add to existing upstream components:

```ts
generals?: HeavenlyGeneralsResult;
```

Render `generals ? generalForHeaven(generals, branch) : "待天将加临"` in visible text and accessible names. Do not modify `FourLessonsResult` or `ThreeTransmissionsResult`.

- [ ] **Step 6: Add scoped responsive styling**

Add only `.heavenly-generals-review*` rules plus the minimum selector additions needed for resolved general text in existing cards. Requirements:

- desktop square palace geometry follows existing heaven-earth review;
- noble palace uses the existing old-gold token, not a new literal palette;
- summary → plate → four lessons → three transmissions → evidence DOM order;
- `@media (max-width: 820px)` makes each content group a single column;
- no transforms, keyframes, or animation;
- native buttons keep existing focus-visible treatment.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- src/features/heavenly-generals-review/HeavenlyGeneralsReview.test.tsx src/features/four-lessons-review/FourLessonsReview.test.tsx src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/heavenly-generals-review src/features/four-lessons-review src/features/three-transmissions-review src/styles/global.css
git commit -m "feat: add heavenly generals review"
```

---

### Task 5: Application pipeline and stage navigation

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/rule-review/RuleStageRail.test.tsx`

**Interfaces:**
- Consumes: Task 2 `runHeavenlyGeneralsStage`, Task 4 `HeavenlyGeneralsReview`, Task 2 guard, existing stage rail.
- Produces: a complete real app flow ending on heavenly-generals review with `course` current.

- [ ] **Step 1: Write failing happy-path and navigation tests**

Add/import the real stage and assert:

```tsx
import * as heavenlyGeneralsStage from "../domain/heavenly-generals/compute-heavenly-generals";

it("runs through heavenly generals and advances the current stage to course", async () => {
  render(<App />);
  await submitCourse();
  expect(await screen.findByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /天将排列，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByText("复制结课", { selector: '[data-status="current"]' })).toBeInTheDocument();
});

it("navigates from heavenly generals to every completed upstream review without recomputing", async () => {
  const runGenerals = vi.spyOn(heavenlyGeneralsStage, "runHeavenlyGeneralsStage");
  render(<App />);
  const user = await submitCourse();
  expect(runGenerals).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /三传取法，已完成/ }));
  expect(screen.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /四课生成，已完成/ }));
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /天地盘加临，已完成/ }));
  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /历法与月将，已完成/ }));
  expect(screen.getByRole("heading", { name: "历法与月将" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /天将排列，已完成/ }));
  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  expect(runGenerals).toHaveBeenCalledTimes(1);
});
```

Update the existing terminal-state test that currently expects three transmissions to be selected after submit; it must now expect the heavenly-generals heading, then click the completed three-transmissions rail button before asserting its contents.

- [ ] **Step 2: Write failing stage-error preservation test**

Mock `runHeavenlyGeneralsStage` at the real session boundary:

```ts
vi.spyOn(heavenlyGeneralsStage, "runHeavenlyGeneralsStage").mockImplementationOnce((session) => ({
  ok: false,
  error: { code: "HEAVENLY_GENERALS_RESULT_INCOMPLETE", message: "天将结果不完整" },
  session,
}));
```

Assert the alert belongs to this failure, three transmissions remains reviewable, the rail keeps `heavenly-generals` current, and no fake heavenly-generals review renders.

- [ ] **Step 3: Run RED**

```bash
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
```

Expected: FAIL because App stops at three transmissions and cannot select heavenly-generals.

- [ ] **Step 4: Integrate the stage minimally**

In `App.tsx`:

- extend `ReviewStage` with `"heavenly-generals"`;
- extend `StageError` with the new failure variant;
- read and guard the heavenly-generals snapshot;
- after successful `runThreeTransmissionsStage`, call `runHeavenlyGeneralsStage`;
- on failure, keep its returned session, select `three-transmissions`, and show its error;
- on success, keep its session and select `heavenly-generals`;
- include heavenly-generals in `completed` and set `current` to `course`;
- allow completed heavenly-generals selection in the rail callback;
- render `HeavenlyGeneralsReview` only after the guard succeeds;
- pass the guarded general result to FourLessonsReview and ThreeTransmissionsReview so their placeholders resolve after this stage exists.

Do not add course generation.

- [ ] **Step 5: Run GREEN and full component regression**

```bash
npm test -- src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx src/features/heavenly-generals-review/HeavenlyGeneralsReview.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/features/rule-review/RuleStageRail.test.tsx
git commit -m "feat: integrate heavenly generals flow"
```

---

### Task 6: Rule-case ledger, browser coverage, and final verification

**Files:**
- Create: `docs/rule-cases/heavenly-generals-v1.md`
- Create: `e2e/heavenly-generals.spec.ts`
- Modify: `e2e/three-transmissions.spec.ts`
- Modify: `e2e/four-lessons.spec.ts`

**Interfaces:**
- Consumes: the complete user-visible fifth-stage flow.
- Produces: source-to-test traceability and desktop/mobile/offline regression coverage.

- [ ] **Step 1: Write the rule-case ledger**

Create a table with these exact rows and direct test pointers:

```md
| Rule claim | Source | Exact regression |
| --- | --- | --- |
| Ten-stem day/night noble table | 林烽《大六壬详解》第三章第二节 | `policy.test.ts` 20-row table |
| 卯 through 申 are day; 酉 through 寅 are night | same | four boundary tests |
| Noble table branch is a heaven branch located through the plate | approved interpretation of same source | offset 0 and offset 6 tests |
| 亥子丑寅卯辰 forward, 巳午未申酉戌 reverse | same | two forward and two reverse tests |
| General order 贵蛇朱六勾青空白常玄阴后 | same | exact constant and 12-placement tests |
```

Also record the explicit exclusions: 遁干, interpretation, course, animation.

- [ ] **Step 2: Write the failing desktop/mobile E2E tests**

Create `e2e/heavenly-generals.spec.ts`:

```ts
test("reviews heavenly generals and returns to upstream evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await expect(page.getByRole("list", { name: "十二天将方盘" }).locator(":scope > li")).toHaveCount(12);
  await expect(page.getByText("待天将加临")).toHaveCount(0);
  await page.getByRole("button", { name: /宫.*贵人/ }).click();
  await expect(page.getByRole("heading", { name: /宫布将证据/ })).toBeVisible();
  await page.getByRole("button", { name: "查看三传" }).click();
  await expect(page.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  await page.getByRole("button", { name: /天将排列，已完成/ }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
});

test("390x844 preserves approved order and has no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitReferenceCourse(page);
  const order = await page.locator("[data-heavenly-generals-section]").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-heavenly-generals-section")),
  );
  expect(order).toEqual(["summary", "plate", "four-lessons", "three-transmissions", "evidence"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("derives the complete review after the loaded app goes offline", async ({ context, page }) => {
  await page.goto("/");
  await context.setOffline(true);
  await submitReferenceCourse(page);
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await expect(page.getByRole("list", { name: "十二天将方盘" }).locator(":scope > li")).toHaveCount(12);
});
```

Use the existing submit helper values in all three tests.

- [ ] **Step 3: Update prior E2E terminal-screen assumptions**

In both tests in `e2e/three-transmissions.spec.ts`, immediately after each `submitReferenceCourse(page)` call, click:

```ts
await page.getByRole("button", { name: /三传取法，已完成/ }).click();
```

before the existing three-transmissions assertions. Do not weaken existing layout, focus, offline, or stage-navigation assertions.

In `e2e/four-lessons.spec.ts`, extend `EXPECTED_VISUAL_LESSONS` with the generals produced by the approved policy for the fixed 2024-02-10 14:30 fixture:

```ts
const EXPECTED_VISUAL_LESSONS = [
  { id: "fourth", label: "四课", upper: "寅", lower: "酉", general: "天后" },
  { id: "third", label: "三课", upper: "酉", lower: "辰", general: "勾陈" },
  { id: "second", label: "二课", upper: "子", lower: "未", general: "螣蛇" },
  { id: "first", label: "一课", upper: "未", lower: "甲", general: "天空" },
] as const;
```

Assert each accessible name ends with `天将${lesson.general}`. Replace the former rail expectation with:

```ts
await expect(page.getByRole("button", { name: "天将排列，已完成" })).toHaveAttribute("data-status", "completed");
await expect(page.getByText("复制结课", { exact: true })).toHaveAttribute("data-status", "current");
```

- [ ] **Step 4: Run E2E RED then GREEN**

Run before implementation wiring is complete to capture RED:

```bash
npm run test:e2e -- e2e/heavenly-generals.spec.ts
```

Expected RED: heading/stage not present.

After Tasks 1–5 and E2E updates, run:

```bash
npm run test:e2e
```

Expected: all browser tests PASS.

- [ ] **Step 5: Run full verification**

Run each command separately and inspect exit codes:

```bash
npm test
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected:

- all Vitest files pass with zero failures;
- TypeScript and Vite build succeed; the existing >500 kB chunk warning is non-blocking;
- all Playwright tests pass;
- no whitespace errors;
- status contains only intentional plan-scope changes before commit, then is empty after commit.

- [ ] **Step 6: Commit**

```bash
git add docs/rule-cases/heavenly-generals-v1.md e2e/heavenly-generals.spec.ts e2e/three-transmissions.spec.ts e2e/four-lessons.spec.ts
git commit -m "test: cover heavenly generals flow"
```

---

## Final Review Checklist

- [ ] The noble branch is looked up by day stem and approved day/night boundary.
- [ ] The noble branch is located as a heaven branch on the current plate before direction is chosen.
- [ ] Forward/reverse placement uses the canonical branch cycle and exact general order.
- [ ] All twelve earth palaces, heaven branches, and generals are unique and complete.
- [ ] Four lessons and three transmissions use lookup helpers against one result; upstream snapshots are unchanged.
- [ ] Evidence contains exactly 1 + 1 + 1 + 1 + 12 steps with stable IDs and closed placement references.
- [ ] Structural and canonical guards reject missing fields and present-but-wrong semantic fields.
- [ ] Stage failures invalidate from the earliest bad snapshot and every returned session validates.
- [ ] The approved summary → plate → four lessons → three transmissions → evidence order holds on desktop and mobile.
- [ ] No manual controls, 遁干, interpretation, course generation, animation, new dependency, or unrelated refactor was added.
- [ ] Full tests, build, E2E, diff check, and clean status are freshly verified.
