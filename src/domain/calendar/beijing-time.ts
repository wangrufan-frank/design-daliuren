import { CalendarDomainError, type BeijingDateTime } from "./types";

const pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseBeijingDateTime(value: string): BeijingDateTime {
  const match = pattern.exec(value);
  if (!match) {
    throw new CalendarDomainError({ code: "INVALID_BEIJING_DATETIME", message: "请输入有效的北京时间" });
  }

  const [, y, m, d, h, min, sec = "00"] = match;
  const [year, month, day, hour, minute, second] = [y, m, d, h, min, sec].map(Number);
  const civilEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const civil = new Date(civilEpoch);
  const same = civil.getUTCFullYear() === year
    && civil.getUTCMonth() === month - 1
    && civil.getUTCDate() === day
    && civil.getUTCHours() === hour
    && civil.getUTCMinutes() === minute
    && civil.getUTCSeconds() === second;

  if (!same) {
    throw new CalendarDomainError({ code: "INVALID_BEIJING_DATETIME", message: "请输入有效的北京时间" });
  }
  if (year < 1900 || year > 2100) {
    throw new CalendarDomainError({ code: "OUT_OF_SUPPORTED_RANGE", message: "仅支持 1900–2100 年的北京时间" });
  }

  const isoLocal = `${y}-${m}-${d}T${h}:${min}:${sec}`;
  return { isoLocal, year, month, day, hour, minute, second, utcEpochMs: civilEpoch - 8 * 60 * 60 * 1000 };
}
