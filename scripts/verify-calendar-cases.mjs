import { readFileSync } from "node:fs";
import { SearchSunLongitude } from "astronomy-engine";

const fixtureSource = readFileSync(process.env.CALENDAR_FIXTURE_PATH ?? new URL("../src/test/calendar-cases.ts", import.meta.url), "utf8");
const fixtureMatch = fixtureSource.match(/export const solarTermCrossChecks = (\[[\s\S]*?\]) as const;/);
if (!fixtureMatch) throw new Error("Unable to read solar-term cross-check fixtures");
const solarTermCrossChecks = Function(`return ${fixtureMatch[1]}`)();
const independentTimeToleranceMilliseconds = 1;
const discrepancyToleranceSeconds = 0.001;

const terms = new Map([
  ["立春", { longitude: 315, start: "2024-02-01T00:00:00.000Z" }],
  ["雨水", { longitude: 330, start: "2024-02-15T00:00:00.000Z" }],
  ["惊蛰", { longitude: 345, start: "2024-03-01T00:00:00.000Z" }],
]);
const rows = solarTermCrossChecks.map((fixture) => {
  const term = terms.get(fixture.name);
  if (!term) throw new Error(`No longitude for ${fixture.name}`);
  const result = SearchSunLongitude(term.longitude, new Date(term.start), 20);
  if (!result) throw new Error(`Unable to find ${fixture.name}`);

  const beijing = new Date(result.date.getTime() + 8 * 60 * 60 * 1000);
  const independent = `${beijing.toISOString().replace("Z", "+08:00")}`;
  const differenceSeconds = Math.abs(new Date(fixture.primary).getTime() - result.date.getTime()) / 1000;
  const independentDifferenceMilliseconds = Math.abs(new Date(fixture.independent).getTime() - result.date.getTime());
  const discrepancyDifferenceSeconds = Math.abs(fixture.differenceSeconds - differenceSeconds);
  return {
    term: fixture.name,
    primary: fixture.primary,
    independent,
    differenceSeconds: differenceSeconds.toFixed(3),
    independentMatch: independentDifferenceMilliseconds <= independentTimeToleranceMilliseconds,
    discrepancyMatch: discrepancyDifferenceSeconds <= discrepancyToleranceSeconds,
    pass: differenceSeconds <= 60
      && independentDifferenceMilliseconds <= independentTimeToleranceMilliseconds
      && discrepancyDifferenceSeconds <= discrepancyToleranceSeconds,
  };
});

console.table(rows);
if (rows.some((row) => !row.pass)) process.exitCode = 1;
