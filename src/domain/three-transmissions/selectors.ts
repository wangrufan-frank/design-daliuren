import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import type { FourLesson, FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import {
  earthUnder,
  elementOfBranch,
  elementOfStem,
  polarityOfBranch,
  polarityOfStem,
} from "./foundations";
import type {
  EvidenceDraft,
  FiveElement,
  Polarity,
  SheHaiPalaceEvidence,
  TransmissionSubtype,
  TransmissionVariant,
} from "./types";

export type VerticalDirection = "lower-overcomes-upper" | "upper-overcomes-lower";

export interface LessonCandidate {
  lesson: FourLesson;
  direction: VerticalDirection;
  upper: FourLesson["upper"];
  upperPolarity: Polarity;
}

export interface VerticalCandidatesResult {
  preferredDirection?: VerticalDirection;
  candidates: readonly LessonCandidate[];
  evidence: readonly EvidenceDraft[];
}

export type ComparisonResult =
  | { kind: "selected"; candidate: LessonCandidate; evidence: readonly EvidenceDraft[] }
  | { kind: "tied"; candidates: readonly LessonCandidate[]; evidence: readonly EvidenceDraft[] };

type SheHaiCounts = Partial<Record<EarthlyBranch, number>>;
type SheHaiPaths = Partial<Record<EarthlyBranch, readonly SheHaiPalaceEvidence[]>>;

export type SheHaiResult =
  | {
      kind: "selected";
      candidate: LessonCandidate;
      subtype?: Extract<TransmissionSubtype, "见机" | "察微" | "缀瑕">;
      variant?: Extract<TransmissionVariant, "复等">;
      counts: SheHaiCounts;
      paths: SheHaiPaths;
      evidence: readonly EvidenceDraft[];
    }
  | {
      kind: "unresolved";
      candidates: readonly LessonCandidate[];
      counts: SheHaiCounts;
      paths: SheHaiPaths;
      evidence: readonly EvidenceDraft[];
    };

interface RemoteScans {
  godOvercomesDay: readonly LessonCandidate[];
  dayOvercomesGod: readonly LessonCandidate[];
}

export type RemoteCandidatesResult =
  | {
      kind: "selected";
      subtype: "蒿矢" | "弹射";
      candidate: LessonCandidate;
      candidates: readonly LessonCandidate[];
      scans: RemoteScans;
      evidence: readonly EvidenceDraft[];
    }
  | {
      kind: "unresolved";
      subtype: "蒿矢" | "弹射";
      candidates: readonly LessonCandidate[];
      scans: RemoteScans;
      evidence: readonly EvidenceDraft[];
    }
  | {
      kind: "none";
      subtype?: undefined;
      candidates: readonly [];
      scans: RemoteScans;
      evidence: readonly EvidenceDraft[];
    };

const OVERCOMES: Readonly<Record<FiveElement, FiveElement>> = {
  木: "土", 火: "金", 土: "水", 金: "木", 水: "火",
};

function overcomes(source: FiveElement, target: FiveElement): boolean {
  return OVERCOMES[source] === target;
}

function candidateFor(lesson: FourLesson, direction: VerticalDirection): LessonCandidate {
  return {
    lesson,
    direction,
    upper: lesson.upper,
    upperPolarity: polarityOfBranch(lesson.upper),
  };
}

export function findVerticalCandidates(fourLessons: FourLessonsResult): VerticalCandidatesResult {
  const dayStem = fourLessons.dayPillar[0] as HeavenlyStem;
  const lowerOvercomesUpper: LessonCandidate[] = [];
  const upperOvercomesLower: LessonCandidate[] = [];

  for (const lesson of fourLessons.lessons) {
    const lowerElement = lesson.id === "first"
      ? elementOfStem(dayStem)
      : elementOfBranch(lesson.lower.kind === "branch" ? lesson.lower.value : lesson.lookupEarth);
    const upperElement = elementOfBranch(lesson.upper);
    if (overcomes(lowerElement, upperElement)) {
      lowerOvercomesUpper.push(candidateFor(lesson, "lower-overcomes-upper"));
    } else if (overcomes(upperElement, lowerElement)) {
      upperOvercomesLower.push(candidateFor(lesson, "upper-overcomes-lower"));
    }
  }

  const preferredDirection = lowerOvercomesUpper.length > 0
    ? "lower-overcomes-upper" as const
    : upperOvercomesLower.length > 0
      ? "upper-overcomes-lower" as const
      : undefined;
  const candidates = preferredDirection === "lower-overcomes-upper"
    ? lowerOvercomesUpper
    : upperOvercomesLower;

  return {
    preferredDirection,
    candidates,
    evidence: [{
      ruleId: "three-transmissions/vertical-relations-v1",
      phase: "candidates",
      input: `日干${dayStem}，逐课比较上下五行生克`,
      conclusion: preferredDirection
        ? `${preferredDirection}候选：${candidates.map(({ lesson }) => lesson.label).join("、")}`
        : "四课上下无贼克",
    }],
  };
}

export function selectByComparison(
  candidates: readonly LessonCandidate[],
  dayStem: HeavenlyStem,
): ComparisonResult {
  const dayPolarity = polarityOfStem(dayStem);
  const matching = candidates.filter(({ upperPolarity }) => upperPolarity === dayPolarity);
  const evidence: readonly EvidenceDraft[] = [{
    ruleId: "three-transmissions/comparison-v1",
    phase: "selection",
    input: `日干${dayStem}为${dayPolarity}，候选上神${candidates.map(({ upper }) => upper).join("、")}`,
    conclusion: matching.length === 1
      ? `唯一比用上神为${matching[0].upper}`
      : `比用后仍有${matching.length === 0 ? candidates.length : matching.length}个候选`,
  }];

  if (matching.length === 1) {
    return { kind: "selected", candidate: matching[0], evidence };
  }
  return {
    kind: "tied",
    candidates: matching.length === 0 ? [...candidates] : matching,
    evidence,
  };
}

const RESIDENT_STEMS: Record<EarthlyBranch, HeavenlyStem[]> = {
  子: [], 丑: [], 寅: [], 卯: [], 辰: [], 巳: [],
  午: [], 未: [], 申: [], 酉: [], 戌: [], 亥: [],
};
for (const [stem, earth] of Object.entries(STEM_RESIDENCES)) {
  RESIDENT_STEMS[earth].push(stem as HeavenlyStem);
}

const MENG_PALACES = new Set<EarthlyBranch>(["寅", "巳", "申", "亥"]);
const ZHONG_PALACES = new Set<EarthlyBranch>(["子", "卯", "午", "酉"]);

function sheHaiPath(
  candidate: LessonCandidate,
  plate: HeavenEarthResult,
): readonly SheHaiPalaceEvidence[] {
  const start = earthUnder(plate, candidate.upper);
  const targetElement = elementOfBranch(candidate.upper);
  const path: SheHaiPalaceEvidence[] = [];
  let total = 0;
  let index = EARTHLY_BRANCHES.indexOf(start);

  while (true) {
    const earth = EARTHLY_BRANCHES[index];
    const branchElement = elementOfBranch(earth);
    const residentStems = RESIDENT_STEMS[earth];
    const isHarm = (element: FiveElement) => candidate.direction === "lower-overcomes-upper"
      ? overcomes(element, targetElement)
      : overcomes(targetElement, element);
    const increment = Number(isHarm(branchElement))
      + residentStems.filter((stem) => isHarm(elementOfStem(stem))).length;
    total += increment;
    path.push({
      kind: "shehai-palace",
      candidateLesson: candidate.lesson.id,
      earth,
      branchElement,
      residentStems: [...residentStems],
      increment,
      total,
    });
    if (earth === candidate.upper) break;
    index = (index + 1) % EARTHLY_BRANCHES.length;
  }

  return path;
}

export function selectBySheHai(
  candidates: readonly LessonCandidate[],
  dayStem: HeavenlyStem,
  plate: HeavenEarthResult,
): SheHaiResult {
  const counts: SheHaiCounts = {};
  const paths: SheHaiPaths = {};
  const pathByCandidate = new Map<LessonCandidate, readonly SheHaiPalaceEvidence[]>();
  for (const candidate of candidates) {
    const path = sheHaiPath(candidate, plate);
    pathByCandidate.set(candidate, path);
    counts[candidate.upper] = path.at(-1)?.total ?? 0;
    paths[candidate.upper] = path;
  }

  const maximum = Math.max(...candidates.map((candidate) => pathByCandidate.get(candidate)?.at(-1)?.total ?? 0));
  const deepest = candidates.filter(
    (candidate) => (pathByCandidate.get(candidate)?.at(-1)?.total ?? 0) === maximum,
  );
  const details = candidates.flatMap((candidate) => pathByCandidate.get(candidate) ?? []);
  const evidence = (conclusion: string): readonly EvidenceDraft[] => [{
    ruleId: "three-transmissions/shehai-path-v1",
    phase: "selection",
    input: `候选上神${candidates.map(({ upper }) => upper).join("、")}逐宫涉害`,
    conclusion,
    details,
  }];
  const selected = (
    candidate: LessonCandidate,
    subtype?: "见机" | "察微" | "缀瑕",
    variant?: "复等",
  ): SheHaiResult => ({
    kind: "selected",
    candidate,
    ...(subtype ? { subtype } : {}),
    ...(variant ? { variant } : {}),
    counts,
    paths,
    evidence: evidence(`${candidate.upper}涉害取用${subtype ? `，${subtype}` : ""}`),
  });

  if (deepest.length === 1) return selected(deepest[0]);

  const withPalace = deepest.map((candidate) => ({
    candidate,
    earth: earthUnder(plate, candidate.upper),
  }));
  const meng = withPalace.filter(({ earth }) => MENG_PALACES.has(earth));
  if (meng.length === 1) return selected(meng[0].candidate, "见机");

  if (meng.length === 0) {
    const zhong = withPalace.filter(({ earth }) => ZHONG_PALACES.has(earth));
    if (zhong.length === 1) return selected(zhong[0].candidate, "察微");
  }

  const reEqualLesson = polarityOfStem(dayStem) === "yang" ? "first" : "third";
  const reEqual = deepest.filter(({ lesson }) => lesson.id === reEqualLesson);
  if (reEqual.length === 1) return selected(reEqual[0], "缀瑕", "复等");

  return {
    kind: "unresolved",
    candidates: deepest,
    counts,
    paths,
    evidence: evidence("涉害深浅、孟仲与复等课位均不能唯一裁决"),
  };
}

export function findRemoteCandidates(
  fourLessons: FourLessonsResult,
  dayStem: HeavenlyStem,
): RemoteCandidatesResult {
  const uniqueLessons: FourLesson[] = [];
  const seen = new Set<EarthlyBranch>();
  for (const lesson of fourLessons.lessons.slice(1)) {
    if (seen.has(lesson.upper)) continue;
    seen.add(lesson.upper);
    uniqueLessons.push(lesson);
  }

  const dayElement = elementOfStem(dayStem);
  const godOvercomesDay = uniqueLessons
    .filter(({ upper }) => overcomes(elementOfBranch(upper), dayElement))
    .map((lesson) => candidateFor(lesson, "upper-overcomes-lower"));
  const dayOvercomesGod = uniqueLessons
    .filter(({ upper }) => overcomes(dayElement, elementOfBranch(upper)))
    .map((lesson) => candidateFor(lesson, "lower-overcomes-upper"));
  const scans: RemoteScans = { godOvercomesDay, dayOvercomesGod };
  const candidates = godOvercomesDay.length > 0 ? godOvercomesDay : dayOvercomesGod;
  const subtype = godOvercomesDay.length > 0 ? "蒿矢" as const : "弹射" as const;
  const remoteEvidence: EvidenceDraft = {
    ruleId: "three-transmissions/remote-overcoming-v1",
    phase: "candidates",
    input: `日干${dayStem}，仅查二三四课唯一上神${uniqueLessons.map(({ upper }) => upper).join("、")}`,
    conclusion: candidates.length > 0
      ? `${godOvercomesDay.length > 0 ? "神克日" : "日克神"}候选${candidates.map(({ upper }) => upper).join("、")}，${subtype}`
      : "无遥克候选",
  };

  if (candidates.length === 0) {
    return { kind: "none", candidates: [], scans, evidence: [remoteEvidence] };
  }
  if (candidates.length === 1) {
    return {
      kind: "selected",
      subtype,
      candidate: candidates[0],
      candidates,
      scans,
      evidence: [remoteEvidence],
    };
  }

  const comparison = selectByComparison(candidates, dayStem);
  if (comparison.kind === "selected") {
    return {
      kind: "selected",
      subtype,
      candidate: comparison.candidate,
      candidates,
      scans,
      evidence: [remoteEvidence, ...comparison.evidence],
    };
  }
  return {
    kind: "unresolved",
    subtype,
    candidates: comparison.candidates,
    scans,
    evidence: [remoteEvidence, ...comparison.evidence],
  };
}
