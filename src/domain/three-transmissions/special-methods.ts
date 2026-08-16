import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import type { FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import {
  STEM_COMBINATIONS,
  clashOf,
  earthUnder,
  heavenAt,
  nextTrineBranch,
  polarityOfStem,
  postHorseOf,
  punishmentOf,
} from "./foundations";
import {
  findVerticalCandidates,
  selectByComparison,
  selectBySheHai,
  type LessonCandidate,
} from "./selectors";
import type {
  EvidenceDraft,
  TransmissionMethod,
  TransmissionSubtype,
  TransmissionVariant,
} from "./types";

export interface TransmissionDraft {
  method: TransmissionMethod;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  derivations: readonly [
    { input: string; conclusion: string },
    { input: string; conclusion: string },
    { input: string; conclusion: string },
  ];
  evidence: readonly EvidenceDraft[];
}

export class ThreeTransmissionsRuleUnresolvedError extends Error {
  constructor(readonly evidence: readonly EvidenceDraft[]) {
    super("九宗门规则无法唯一确定初传");
    this.name = "ThreeTransmissionsRuleUnresolvedError";
  }
}

interface VerticalInitialSelection {
  candidate?: LessonCandidate;
  method?: Extract<TransmissionMethod, "贼克" | "比用" | "涉害">;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  evidence: readonly EvidenceDraft[];
}

function selectVerticalInitial(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): VerticalInitialSelection {
  const vertical = findVerticalCandidates(fourLessons);
  if (vertical.candidates.length === 0) return { variants: [], evidence: vertical.evidence };
  if (vertical.candidates.length === 1) {
    const candidate = vertical.candidates[0];
    const subtype = vertical.preferredDirection === "lower-overcomes-upper" ? "始入" : "元首";
    return {
      candidate,
      method: "贼克",
      subtype,
      variants: [],
      evidence: [...vertical.evidence, {
        ruleId: "three-transmissions/thief-overcoming-v1",
        phase: "selection",
        input: `上下克候选仅${candidate.lesson.label}上神${candidate.upper}`,
        conclusion: `唯一上下克候选为${candidate.lesson.label}上神${candidate.upper}，取${candidate.upper}发用`,
      }],
    };
  }

  const comparison = selectByComparison(vertical.candidates, dayStem);
  const comparisonEvidence = [...vertical.evidence, ...comparison.evidence];
  if (comparison.kind === "selected") {
    return {
      candidate: comparison.candidate,
      method: "比用",
      subtype: "知一",
      variants: [],
      evidence: comparisonEvidence,
    };
  }

  const sheHai = selectBySheHai(comparison.candidates, dayStem, plate);
  const evidence = [...comparisonEvidence, ...sheHai.evidence];
  if (sheHai.kind === "unresolved") throw new ThreeTransmissionsRuleUnresolvedError(evidence);
  return {
    candidate: sheHai.candidate,
    method: "涉害",
    ...(sheHai.subtype ? { subtype: sheHai.subtype } : {}),
    variants: sheHai.variant ? [sheHai.variant] : [],
    evidence,
  };
}

export function isFuYin(plate: HeavenEarthResult): boolean {
  return EARTHLY_BRANCHES.every((earth) => (
    plate.palaces.filter((palace) => palace.earth === earth).length === 1
    && plate.palaces.find((palace) => palace.earth === earth)?.heaven === earth
  ));
}

export function isFanYin(plate: HeavenEarthResult): boolean {
  return plate.offset === 6 && EARTHLY_BRANCHES.every((earth) => (
    plate.palaces.filter((palace) => palace.earth === earth).length === 1
    && plate.palaces.find((palace) => palace.earth === earth)?.heaven === clashOf(earth)
  ));
}

export function deriveFuYin(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const vertical = selectVerticalInitial(dayStem, fourLessons, plate);
  const isYang = polarityOfStem(dayStem) === "yang";
  const hasOvercoming = vertical.candidate !== undefined;
  const initial = vertical.candidate?.upper
    ?? (isYang ? fourLessons.lessons[0].upper : fourLessons.lessons[2].upper);
  const punishedInitial = punishmentOf(initial);
  const initialSelfPunishes = punishedInitial === initial;
  const middle = initialSelfPunishes
    ? (isYang ? fourLessons.lessons[2].upper : fourLessons.lessons[0].upper)
    : punishedInitial;
  const punishedMiddle = punishmentOf(middle);
  const middleSelfPunishes = punishedMiddle === middle;
  const final = middleSelfPunishes ? clashOf(middle) : punishedMiddle;
  const subtype = hasOvercoming ? "不虞" : isYang ? "自任" : "自信";
  const initialDerivation = {
    input: hasOvercoming
      ? `伏吟四课上下有克，${vertical.candidate!.lesson.label}上神${initial}发用`
      : `伏吟四课上下无克，${isYang ? "阳日取一课" : "阴日取三课"}上神${initial}`,
    conclusion: `伏吟${subtype}取${initial}为初传`,
  };
  const middleDerivation = initialSelfPunishes
    ? {
        input: `初传${initial}自刑，${isYang ? "阳日改取三课" : "阴日改取一课"}上神${middle}`,
        conclusion: `初传自刑换取${middle}为中传，标记杜传`,
      }
    : {
        input: `初传${initial}刑${middle}`,
        conclusion: `伏吟以初传所刑${middle}为中传`,
      };
  const finalDerivation = middleSelfPunishes
    ? {
        input: `中传${middle}再次自刑，改取其冲神${final}`,
        conclusion: `中传再次自刑，取冲神${final}为末传`,
      }
    : {
        input: `中传${middle}刑${final}`,
        conclusion: `伏吟以中传所刑${final}为末传`,
      };
  return {
    method: "伏吟",
    subtype,
    variants: [...vertical.variants, ...(initialSelfPunishes ? ["杜传" as const] : [])],
    branches: [initial, middle, final],
    derivations: [initialDerivation, middleDerivation, finalDerivation],
    evidence: [...vertical.evidence, {
      ruleId: "three-transmissions/fuyin-v1",
      phase: "selection",
      input: "十二宫天地盘同位",
      conclusion: `按伏吟${subtype}法取三传`,
    }, ...(["initial", "middle", "final"] as const).map((phase, index) => ({
      ruleId: "three-transmissions/fuyin-v1" as const,
      phase,
      transmission: phase,
      input: [initialDerivation, middleDerivation, finalDerivation][index].input,
      conclusion: [initialDerivation, middleDerivation, finalDerivation][index].conclusion,
    }))],
  };
}

export function deriveFanYin(
  dayStem: HeavenlyStem,
  dayBranch: EarthlyBranch,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const vertical = selectVerticalInitial(dayStem, fourLessons, plate);
  const hasOvercoming = vertical.candidate !== undefined;
  const dayPillar = `${dayStem}${dayBranch}`;
  const wellRailingDays = new Set(["丁丑", "丁未", "己丑", "己未", "辛丑", "辛未"]);
  if (!hasOvercoming && !wellRailingDays.has(dayPillar)) {
    throw new ThreeTransmissionsRuleUnresolvedError([...vertical.evidence, {
      ruleId: "three-transmissions/fanyin-v1",
      phase: "selection",
      input: `反吟四课上下无克，日柱${dayPillar}`,
      conclusion: "日柱不属反吟无克井栏六日，无法取用",
    }]);
  }

  const initial = hasOvercoming ? vertical.candidate!.upper : postHorseOf(dayBranch);
  const middle = hasOvercoming ? heavenAt(plate, initial) : fourLessons.lessons[2].upper;
  const final = hasOvercoming ? heavenAt(plate, middle) : fourLessons.lessons[0].upper;
  const initialDerivation = hasOvercoming
    ? {
        input: `反吟四课上下有克，${vertical.candidate!.lesson.label}上神${initial}发用`,
        conclusion: `反吟取上下克所选${initial}为初传`,
      }
    : {
        input: `反吟无克井栏日${dayPillar}，日支${dayBranch}驿马为${initial}`,
        conclusion: `井栏取日支驿马${initial}为初传`,
      };
  const middleDerivation = hasOvercoming
    ? {
        input: `初传${initial}落地盘${initial}宫`,
        conclusion: `反吟从地盘${initial}宫查得天盘上神${middle}为中传`,
      }
    : {
        input: `井栏固定取三课上神${middle}`,
        conclusion: `井栏取三课上神${middle}为中传`,
      };
  const finalDerivation = hasOvercoming
    ? {
        input: `中传${middle}落地盘${middle}宫`,
        conclusion: `反吟从地盘${middle}宫查得天盘上神${final}为末传`,
      }
    : {
        input: `井栏固定取一课上神${final}`,
        conclusion: `井栏取一课上神${final}为末传`,
      };
  return {
    method: "反吟",
    ...(hasOvercoming
      ? (vertical.subtype ? { subtype: vertical.subtype } : {})
      : { subtype: "井栏" as const }),
    variants: vertical.variants,
    branches: [initial, middle, final],
    derivations: [initialDerivation, middleDerivation, finalDerivation],
    evidence: [...vertical.evidence, {
      ruleId: "three-transmissions/fanyin-v1",
      phase: "selection",
      input: "十二宫天地盘相冲",
      conclusion: hasOvercoming
        ? `反吟有克，按${vertical.method}${vertical.subtype ?? ""}取用`
        : `反吟无克六日${dayPillar}，按井栏取用`,
    }, ...(["initial", "middle", "final"] as const).map((phase, index) => ({
      ruleId: "three-transmissions/fanyin-v1" as const,
      phase,
      transmission: phase,
      input: [initialDerivation, middleDerivation, finalDerivation][index].input,
      conclusion: [initialDerivation, middleDerivation, finalDerivation][index].conclusion,
    }))],
  };
}

export function deriveMaoStar(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const firstUpper = fourLessons.lessons[0].upper;
  const thirdUpper = fourLessons.lessons[2].upper;
  const isYang = polarityOfStem(dayStem) === "yang";
  const initial = isYang ? heavenAt(plate, "酉") : earthUnder(plate, "酉");
  return {
    method: "昴星",
    subtype: isYang ? "虎视" : "冬蛇掩目",
    variants: [],
    branches: isYang
      ? [initial, thirdUpper, firstUpper]
      : [initial, firstUpper, thirdUpper],
    derivations: isYang
      ? [
          {
            input: `阳日虎视查酉地盘上神${initial}`,
            conclusion: `阳日虎视取酉上神${initial}为初传`,
          },
          {
            input: `阳日虎视取三课上神${thirdUpper}`,
            conclusion: `阳日虎视取三课上神${thirdUpper}为中传`,
          },
          {
            input: `阳日虎视取一课日上神${firstUpper}`,
            conclusion: `阳日虎视取一课日上神${firstUpper}为末传`,
          },
        ]
      : [
          {
            input: `阴日冬蛇掩目查酉天盘所临地盘${initial}`,
            conclusion: `阴日冬蛇掩目取酉下神${initial}为初传`,
          },
          {
            input: `阴日冬蛇掩目取一课日上神${firstUpper}`,
            conclusion: `阴日冬蛇掩目取一课日上神${firstUpper}为中传`,
          },
          {
            input: `阴日冬蛇掩目取三课上神${thirdUpper}`,
            conclusion: `阴日冬蛇掩目取三课上神${thirdUpper}为末传`,
          },
        ],
    evidence: [{
      ruleId: "three-transmissions/mao-star-v1",
      phase: "selection",
      input: `日干${dayStem}，酉位与一三课上神定三传`,
      conclusion: `${isYang ? "阳日虎视" : "阴日冬蛇掩目"}，初传${initial}`,
    }],
  };
}

export function deriveSeparateResponsibility(
  dayStem: HeavenlyStem,
  dayBranch: EarthlyBranch,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const isYang = polarityOfStem(dayStem) === "yang";
  const combinedStem = STEM_COMBINATIONS[dayStem];
  const initial = isYang
    ? heavenAt(plate, STEM_RESIDENCES[combinedStem])
    : nextTrineBranch(dayBranch);
  const firstUpper = fourLessons.lessons[0].upper;
  return {
    method: "别责",
    variants: [],
    branches: [initial, firstUpper, firstUpper],
    derivations: [
      {
        input: isYang
          ? `阳日别责取五合${combinedStem}寄宫${STEM_RESIDENCES[combinedStem]}上神${initial}`
          : `阴日别责取日支${dayBranch}三合下一支${initial}`,
        conclusion: `${isYang ? "阳日" : "阴日"}别责取${initial}为初传`,
      },
      {
        input: `别责固定取一课日上神${firstUpper}`,
        conclusion: `别责中传固定取一课日上神${firstUpper}`,
      },
      {
        input: `别责固定取一课日上神${firstUpper}`,
        conclusion: `别责末传固定取一课日上神${firstUpper}`,
      },
    ],
    evidence: [{
      ruleId: "three-transmissions/separate-responsibility-v1",
      phase: "selection",
      input: isYang
        ? `日干${dayStem}取五合${combinedStem}寄宫上神`
        : `日支${dayBranch}取三合下一支`,
      conclusion: `别责初传${initial}，中末皆取日上神${firstUpper}`,
    }],
  };
}

export function deriveEightSpecial(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
): TransmissionDraft {
  const isYang = polarityOfStem(dayStem) === "yang";
  const startingGod = isYang
    ? fourLessons.lessons[0].upper
    : fourLessons.lessons[3].upper;
  const startIndex = EARTHLY_BRANCHES.indexOf(startingGod);
  const initial = EARTHLY_BRANCHES[
    (startIndex + (isYang ? 2 : -2) + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length
  ];
  const firstUpper = fourLessons.lessons[0].upper;
  return {
    method: "八专",
    variants: [],
    branches: [initial, firstUpper, firstUpper],
    derivations: [
      {
        input: `${isYang ? "阳日从一课日上神顺数三位" : "阴日从四课上神逆数三位"}，起点计一`,
        conclusion: `${isYang ? "阳日" : "阴日"}八专取${initial}为初传`,
      },
      {
        input: `八专固定取一课日上神${firstUpper}`,
        conclusion: `八专中传固定取一课日上神${firstUpper}`,
      },
      {
        input: `八专固定取一课日上神${firstUpper}`,
        conclusion: `八专末传固定取一课日上神${firstUpper}`,
      },
    ],
    evidence: [{
      ruleId: "three-transmissions/eight-special-v1",
      phase: "selection",
      input: `${isYang ? "阳日从日上神顺数三位" : "阴日从四课上神逆数三位"}`,
      conclusion: `起点计一，八专初传${initial}，中末皆取日上神${firstUpper}`,
    }],
  };
}
