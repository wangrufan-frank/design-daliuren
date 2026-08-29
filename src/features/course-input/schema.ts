import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";
import { deriveNatalBranch } from "../../domain/chart/natal";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";
import { CalendarDomainError } from "../../domain/calendar/types";

export type InputErrors = Partial<Record<
  "civilDateTime" | "birthYear" | "natalBranch" | "reason" | "monthGeneral" | "divinationHour",
  string
>>;

const earthlyBranchOrder = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const earthlyBranches = new Set<string>(earthlyBranchOrder);

function isEarthlyBranch(value: string): value is EarthlyBranch {
  return earthlyBranches.has(value);
}

export function parseCourseInput(form: FormData): CourseInput | InputErrors {
  const civilDateTime = String(form.get("civilDateTime") ?? "");
  const locationName = String(form.get("locationName") ?? "").trim();
  const birthYearRaw = String(form.get("birthYear") ?? "").trim();
  const natalBranchRaw = String(form.get("natalBranch") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const monthGeneral = String(form.get("monthGeneral") ?? "");
  const divinationHour = String(form.get("divinationHour") ?? "");
  const errors: InputErrors = {};
  let normalizedCivilDateTime = civilDateTime;
  const birthYear = Number(birthYearRaw);
  const currentYear = new Date().getFullYear();

  if (!civilDateTime) {
    errors.civilDateTime = "请输入日期与时间";
  } else {
    try {
      normalizedCivilDateTime = parseBeijingDateTime(civilDateTime).isoLocal;
    } catch (error) {
      errors.civilDateTime = error instanceof CalendarDomainError && error.detail.code === "OUT_OF_SUPPORTED_RANGE"
        ? error.detail.message
        : "请输入 1900–2100 年内的有效北京时间";
    }
  }
  if (!/^\d{4}$/.test(birthYearRaw) || !Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
    errors.birthYear = "请输入 1900 年至今年之间的出生年份";
  }
  if (natalBranchRaw && !isEarthlyBranch(natalBranchRaw)) errors.natalBranch = "本命必须是十二地支之一";
  if (!reason) errors.reason = "请输入起课事由";
  else if (reason.length > 120) errors.reason = "起课事由不能超过 120 字";
  if (monthGeneral && !isEarthlyBranch(monthGeneral)) errors.monthGeneral = "月将必须是十二地支之一";
  if (divinationHour && !isEarthlyBranch(divinationHour)) errors.divinationHour = "占时必须是十二地支之一";
  if (Object.keys(errors).length) return errors;

  return {
    civilDateTime: normalizedCivilDateTime,
    timeZone: "Asia/Shanghai",
    ...(locationName && { locationName }),
    reason,
    natal: {
      birthYear,
      branch: isEarthlyBranch(natalBranchRaw) ? natalBranchRaw : deriveNatalBranch(birthYear),
      source: isEarthlyBranch(natalBranchRaw) ? "manual" : "automatic",
    },
    corrections: {
      ...(isEarthlyBranch(monthGeneral) && { monthGeneral }),
      ...(isEarthlyBranch(divinationHour) && { divinationHour }),
    },
  };
}
