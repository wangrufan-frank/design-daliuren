import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { CalendarResult } from "../calendar/types";
import type { HeavenEarthResult } from "./types";

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
