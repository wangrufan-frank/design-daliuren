import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { FourLesson, FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { elementOfBranch, elementOfStem, heavenAt, relationFor } from "./foundations";
import {
  findRemoteCandidates,
  type LessonCandidate,
} from "./selectors";
import {
  ThreeTransmissionsRuleUnresolvedError,
  deriveEightSpecial,
  deriveFanYin,
  deriveFuYin,
  deriveMaoStar,
  deriveSeparateResponsibility,
  isFanYin,
  isFuYin,
  selectVerticalInitial,
  type TransmissionDraft,
} from "./special-methods";
import type {
  EvidenceDraft,
  ThreeTransmissionsEvidenceStep,
  ThreeTransmissionsResult,
  Transmission,
  TransmissionPosition,
  SixRelationDirection,
  TransmissionSubtype,
} from "./types";

export { ThreeTransmissionsRuleUnresolvedError } from "./special-methods";

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

function deriveOrdinary(
  plate: HeavenEarthResult,
  fourLessons: FourLessonsResult,
  dayStem: HeavenlyStem,
): TransmissionDraft {
  const vertical = selectVerticalInitial(dayStem, fourLessons, plate);
  if (vertical.candidate) {
    return chainOrdinary(
      vertical.candidate,
      plate,
      vertical.method!,
      vertical.subtype,
      vertical.variants,
      vertical.evidence,
    );
  }

  const uniqueLessonCount = countCanonicalLessons(fourLessons.lessons);
  const evidenceBeforeRemote = [...vertical.evidence];
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
    const relation = relationFor(dayStem, branch);
    const direction: SixRelationDirection = relation === "父母"
      ? "transmission-generates-day"
      : relation === "子孙"
        ? "day-generates-transmission"
        : relation === "官鬼"
          ? "transmission-overcomes-day"
          : relation === "妻财"
            ? "day-overcomes-transmission"
            : "same-element";
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
      conclusion: `${branch}六亲为${relation}`,
      details: [{
        kind: "six-relation",
        dayStem,
        dayElement: elementOfStem(dayStem),
        transmissionBranch: branch,
        transmissionElement: elementOfBranch(branch),
        direction,
        relation,
      }],
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
  const dayBranch = fourLessons.dayPillar[1] as EarthlyBranch;
  const draft = isFuYin(plate)
    ? deriveFuYin(dayStem, fourLessons, plate)
    : isFanYin(plate)
      ? deriveFanYin(dayStem, dayBranch, fourLessons, plate)
      : deriveOrdinary(plate, fourLessons, dayStem);
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
