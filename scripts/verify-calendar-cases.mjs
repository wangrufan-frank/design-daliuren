import { readFileSync } from "node:fs";
import { SearchSunLongitude } from "astronomy-engine";

const fixtureSource = readFileSync(new URL("../src/test/calendar-cases.ts", import.meta.url), "utf8");
const fixtureMatch = fixtureSource.match(/export const solarTermCrossChecks = (\[[\s\S]*?\]) as const;/);
if (!fixtureMatch) throw new Error("Unable to read solar-term cross-check fixtures");
const solarTermCrossChecks = Function(`return ${fixtureMatch[1]}`)();

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
  const differenceSeconds = Math.abs(new Date(fixture.primary).getTime() - result.date.getTime()) / 1000;
  return {
    term: fixture.name,
    primary: fixture.primary,
    independent: `${beijing.toISOString().replace("Z", "+08:00")}`,
    differenceSeconds: differenceSeconds.toFixed(3),
    pass: differenceSeconds <= 60,
  };
});

console.table(rows);
if (rows.some((row) => !row.pass)) process.exitCode = 1;
