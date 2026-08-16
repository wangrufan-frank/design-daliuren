import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { FourLesson, FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { heavenAt, relationFor } from "./foundations";
import {
  findRemoteCandidates,
  findVerticalCandidates,
  selectByComparison,
  selectBySheHai,
  type LessonCandidate,
  type VerticalCandidatesResult,
} from "./selectors";
import {
  deriveEightSpecial,
  deriveMaoStar,
  deriveSeparateResponsibility,
  type TransmissionDraft,
} from "./special-methods";
import type {
  EvidenceDraft,
  ThreeTransmissionsEvidenceStep,
  ThreeTransmissionsResult,
  Transmission,
  TransmissionPosition,
  TransmissionSubtype,
} from "./types";

export class ThreeTransmissionsRuleUnresolvedError extends Error {
  constructor(readonly evidence: readonly EvidenceDraft[]) {
    super("九宗门规则无法唯一确定初传");
    this.name = "ThreeTransmissionsRuleUnresolvedError";
  }
}

const POSITIONS = ["initial", "middle", "final"] as const satisfies readonly TransmissionPosition[];
const LABELS = ["初传", "中传", "末传"] as const;

function chainOrdinary(
  candidate: LessonCandidate,
  plate: HeavenEarthResult,
  method: TransmissionDraft["method"],
  subtype: TransmissionSubtype | undefined,
  variants: TransmissionDraft["variants"],
  evidence: readonly EvidenceDraft[],
): TransmissionDraft {
  const initial = candidate.upper;
  const middle = heavenAt(plate, initial);
  const final = heavenAt(plate, middle);
  return {
    method,
    ...(subtype ? { subtype } : {}),
    variants,
    branches: [initial, middle, final],
    derivations: [
      {
        input: `${candidate.lesson.label}上神${initial}`,
        conclusion: `${method}${subtype ?? ""}取${candidate.lesson.label}上神${initial}发用为初传`,
      },
      {
        input: `初传${initial}落地盘${initial}宫`,
        conclusion: `从地盘${initial}宫查得天盘上神${middle}，取为中传`,
      },
      {
        input: `中传${middle}落地盘${middle}宫`,
        conclusion: `从地盘${middle}宫查得天盘上神${final}，取为末传`,
      },
    ],
    evidence,
  };
}

function deriveFromVertical(
  vertical: VerticalCandidatesResult,
  dayStem: HeavenlyStem,
  plate: HeavenEarthResult,
): TransmissionDraft {
  if (vertical.candidates.length === 1) {
    const candidate = vertical.candidates[0];
    const subtype = vertical.preferredDirection === "lower-overcomes-upper" ? "始入" : "元首";
    const selectionEvidence: EvidenceDraft = {
      ruleId: "three-transmissions/thief-overcoming-v1",
      phase: "selection",
      input: `上下克候选仅${candidate.lesson.label}上神${candidate.upper}`,
      conclusion: `唯一上下克候选为${candidate.lesson.label}上神${candidate.upper}，取${candidate.upper}发用`,
    };
    return chainOrdinary(candidate, plate, "贼克", subtype, [], [
      ...vertical.evidence,
      selectionEvidence,
    ]);
  }

  const comparison = selectByComparison(vertical.candidates, dayStem);
  const comparisonEvidence = [...vertical.evidence, ...comparison.evidence];
  if (comparison.kind === "selected") {
    return chainOrdinary(comparison.candidate, plate, "比用", "知一", [], comparisonEvidence);
  }

  const sheHai = selectBySheHai(comparison.candidates, dayStem, plate);
  const evidence = [...comparisonEvidence, ...sheHai.evidence];
  if (sheHai.kind === "unresolved") throw new ThreeTransmissionsRuleUnresolvedError(evidence);
  return chainOrdinary(
    sheHai.candidate,
    plate,
    "涉害",
    sheHai.subtype,
    sheHai.variant ? [sheHai.variant] : [],
    evidence,
  );
}

function deriveOrdinary(
  plate: HeavenEarthResult,
  fourLessons: FourLessonsResult,
  dayStem: HeavenlyStem,
): TransmissionDraft {
  const vertical = findVerticalCandidates(fourLessons);
  if (vertical.candidates.length > 0) return deriveFromVertical(vertical, dayStem, plate);

  const uniqueLessonCount = countCanonicalLessons(fourLessons.lessons);
  const lessonCountEvidence: EvidenceDraft = {
    ruleId: "three-transmissions/lesson-deduplication-v1",
    phase: "lessons",
    input: fourLessons.lessons
      .map(({ lookupEarth, upper }) => `${lookupEarth}上${upper}`)
      .join("、"),
    conclusion: `四课去重后为${uniqueLessonCount}课`,
  };
  const evidenceBeforeRemote = [...vertical.evidence, lessonCountEvidence];
  if (uniqueLessonCount === 2 && stemAndBranchShareResidence(fourLessons)) {
    const draft = deriveEightSpecial(dayStem, fourLessons);
    return { ...draft, evidence: [...evidenceBeforeRemote, ...draft.evidence] };
  }

  const remote = findRemoteCandidates(fourLessons, dayStem);
  if (remote.kind === "selected") {
    const selectionEvidence: readonly EvidenceDraft[] = remote.candidates.length === 1
      ? [{
          ruleId: "three-transmissions/remote-overcoming-v1",
          phase: "selection",
          input: `遥克候选仅${remote.candidate.lesson.label}上神${remote.candidate.upper}`,
          conclusion: `唯一遥克候选为${remote.candidate.lesson.label}上神${remote.candidate.upper}，取${remote.candidate.upper}发用`,
        }]
      : [];
    return chainOrdinary(remote.candidate, plate, "遥克", remote.subtype, [], [
      ...evidenceBeforeRemote,
      ...remote.evidence,
      ...selectionEvidence,
    ]);
  }
  const evidence = [...evidenceBeforeRemote, ...remote.evidence];
  if (remote.kind === "unresolved") throw new ThreeTransmissionsRuleUnresolvedError(evidence);
  if (uniqueLessonCount === 4) {
    const draft = deriveMaoStar(dayStem, fourLessons, plate);
    return { ...draft, evidence: [...evidence, ...draft.evidence] };
  }
  if (uniqueLessonCount === 3) {
    const dayBranch = fourLessons.dayPillar[1] as EarthlyBranch;
    const draft = deriveSeparateResponsibility(dayStem, dayBranch, fourLessons, plate);
    return { ...draft, evidence: [...evidence, ...draft.evidence] };
  }
  throw new ThreeTransmissionsRuleUnresolvedError(evidence);
}

function countCanonicalLessons(lessons: readonly FourLesson[]): number {
  return new Set(lessons.map(({ lookupEarth, upper }) => `${lookupEarth}:${upper}`)).size;
}

function stemAndBranchShareResidence(fourLessons: FourLessonsResult): boolean {
  return fourLessons.lessons[0].lookupEarth === fourLessons.lessons[2].lookupEarth;
}

function finalizeEvidence(
  plate: HeavenEarthResult,
  dayStem: HeavenlyStem,
  draft: TransmissionDraft,
): readonly ThreeTransmissionsEvidenceStep[] {
  const evidence: EvidenceDraft[] = [{
    ruleId: "three-transmissions/plate-classification-v1",
    phase: "plate",
    input: `月将${plate.monthGeneral.branch}，占时${plate.divinationHour.branch}`,
    conclusion: `天地盘偏移${plate.offset}位`,
  }, ...draft.evidence];

  draft.branches.forEach((branch, index) => {
    const position = POSITIONS[index];
    const derivation = draft.derivations[index];
    evidence.push({
      ruleId: index === 0
        ? "three-transmissions/initial-v1"
        : index === 1
          ? "three-transmissions/middle-v1"
          : "three-transmissions/final-v1",
      phase: position,
      transmission: position,
      input: derivation.input,
      conclusion: derivation.conclusion,
    }, {
      ruleId: "three-transmissions/six-relation-v1",
      phase: "relation",
      transmission: position,
      input: `日干${dayStem}与${branch}比较五行`,
      conclusion: `${branch}六亲为${relationFor(dayStem, branch)}`,
    });
  });

  return evidence.map((step, index) => ({ ...step, id: `three-transmissions-${index + 1}` }));
}

function buildTransmissions(
  dayStem: HeavenlyStem,
  branches: TransmissionDraft["branches"],
  evidence: readonly ThreeTransmissionsEvidenceStep[],
): readonly [Transmission, Transmission, Transmission] {
  const build = (index: 0 | 1 | 2): Transmission => {
    const branch = branches[index];
    const position = POSITIONS[index];
    return {
      position,
      label: LABELS[index],
      branch,
      relation: relationFor(dayStem, branch),
      derivation: evidence.find(({ phase }) => phase === position)?.conclusion ?? `${LABELS[index]}为${branch}`,
      evidenceIds: evidence
        .filter((step) => step.transmission === position)
        .map(({ id }) => id),
    };
  };
  return [build(0), build(1), build(2)];
}

export function deriveThreeTransmissions(
  plate: HeavenEarthResult,
  fourLessons: FourLessonsResult,
): ThreeTransmissionsResult {
  const dayStem = fourLessons.dayPillar[0] as HeavenlyStem;
  const draft = deriveOrdinary(plate, fourLessons, dayStem);
  const evidence = finalizeEvidence(plate, dayStem, draft);
  return {
    dayPillar: fourLessons.dayPillar,
    plateOffset: plate.offset,
    method: draft.method,
    ...(draft.subtype ? { subtype: draft.subtype } : {}),
    variants: draft.variants,
    transmissions: buildTransmissions(dayStem, draft.branches, evidence),
    evidence,
  };
}
