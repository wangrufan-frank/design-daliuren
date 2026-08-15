import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";

export type InputErrors = Partial<Record<
  "civilDateTime" | "locationName" | "longitude" | "latitude" | "monthGeneral" | "divinationHour",
  string
>>;

const earthlyBranches = new Set<string>(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);

function isEarthlyBranch(value: string): value is EarthlyBranch {
  return earthlyBranches.has(value);
}

export function parseCourseInput(form: FormData): CourseInput | InputErrors {
  const civilDateTime = String(form.get("civilDateTime") ?? "");
  const locationName = String(form.get("locationName") ?? "").trim();
  const longitudeValue = String(form.get("longitude") ?? "").trim();
  const latitudeValue = String(form.get("latitude") ?? "").trim();
  const monthGeneral = String(form.get("monthGeneral") ?? "");
  const divinationHour = String(form.get("divinationHour") ?? "");
  const longitude = Number(longitudeValue);
  const latitude = Number(latitudeValue);
  const errors: InputErrors = {};
  let normalizedCivilDateTime = civilDateTime;

  if (!civilDateTime) {
    errors.civilDateTime = "请输入日期与时间";
  } else {
    try {
      normalizedCivilDateTime = parseBeijingDateTime(civilDateTime).isoLocal;
    } catch {
      errors.civilDateTime = "请输入 1900–2100 年内的有效北京时间";
    }
  }
  if (!locationName) errors.locationName = "请输入地点";
  if (!longitudeValue) {
    errors.longitude = "请输入经度";
  } else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = "经度必须在 -180 到 180 之间";
  }
  if (!latitudeValue) {
    errors.latitude = "请输入纬度";
  } else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = "纬度必须在 -90 到 90 之间";
  }
  if (monthGeneral && !isEarthlyBranch(monthGeneral)) errors.monthGeneral = "月将必须是十二地支之一";
  if (divinationHour && !isEarthlyBranch(divinationHour)) errors.divinationHour = "占时必须是十二地支之一";
  if (Object.keys(errors).length) return errors;

  return {
    civilDateTime: normalizedCivilDateTime,
    timeZone: "Asia/Shanghai",
    locationName,
    longitude,
    latitude,
    corrections: {
      ...(isEarthlyBranch(monthGeneral) && { monthGeneral }),
      ...(isEarthlyBranch(divinationHour) && { divinationHour }),
    },
  };
}
