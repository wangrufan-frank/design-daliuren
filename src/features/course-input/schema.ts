import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";

export type InputErrors = Partial<Record<
  "civilDateTime" | "locationName" | "longitude" | "latitude" | "monthGeneral" | "divinationHour",
  string
>>;

const earthlyBranches = new Set<string>(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);

function isEarthlyBranch(value: string): value is EarthlyBranch {
  return earthlyBranches.has(value);
}

function isValidCivilDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59;
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

  if (!civilDateTime) {
    errors.civilDateTime = "请输入日期与时间";
  } else if (!isValidCivilDateTime(civilDateTime)) {
    errors.civilDateTime = "请输入有效的日期与时间";
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
    civilDateTime,
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
