import type { CourseInput, EarthlyBranch } from "../../domain/chart/types";

export type InputErrors = Partial<Record<"civilDateTime" | "locationName" | "longitude" | "latitude", string>>;

export function parseCourseInput(form: FormData): CourseInput | InputErrors {
  const civilDateTime = String(form.get("civilDateTime") ?? "");
  const locationName = String(form.get("locationName") ?? "").trim();
  const longitude = Number(form.get("longitude"));
  const latitude = Number(form.get("latitude"));
  const errors: InputErrors = {};

  if (!civilDateTime) errors.civilDateTime = "请输入日期与时间";
  if (!locationName) errors.locationName = "请输入地点";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = "经度必须在 -180 到 180 之间";
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = "纬度必须在 -90 到 90 之间";
  }
  if (Object.keys(errors).length) return errors;

  const monthGeneral = String(form.get("monthGeneral") ?? "") as EarthlyBranch;
  const divinationHour = String(form.get("divinationHour") ?? "") as EarthlyBranch;

  return {
    civilDateTime,
    timeZone: "Asia/Shanghai",
    locationName,
    longitude,
    latitude,
    corrections: {
      ...(monthGeneral && { monthGeneral }),
      ...(divinationHour && { divinationHour }),
    },
  };
}
