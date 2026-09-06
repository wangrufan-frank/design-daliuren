import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  CANONICAL_MODEL_SIZE,
  compareMinitoolModel,
} from "./compare-minitool-model.mjs";

const WIDTH = 1286;
const HEIGHT = 1223;
const PEARLS = [
  { name: "north-west", x: 472, y: 356 },
  { name: "north-east", x: 949, y: 410 },
  { name: "south-west", x: 357, y: 750 },
  { name: "south-east", x: 868, y: 846 },
];

function syntheticModelSvg({ omitPearl, displacePearl } = {}) {
  const generalTiles = Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6;
    const x = 643 + Math.sin(angle) * 202 - 18;
    const y = 615 - Math.cos(angle) * 142 - 13;
    return `<rect x="${x}" y="${y}" width="36" height="26" rx="4" fill="#d9cfb8" stroke="#151515" stroke-width="3"/>`;
  }).join("");
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#d8d2c8"/>
      <rect x="105" y="142" width="1076" height="916" rx="40" fill="#eee8dc" stroke="#9f927d" stroke-width="8"/>
      <g fill="none" stroke="#9a6d27" stroke-width="8">
        <path d="M170 260h185M460 220h185M755 220h185M965 260h115"/>
        <path d="M170 925h185M460 990h185M755 990h185M965 925h115"/>
      </g>
      <g fill="#f4efe4" stroke="#897a63" stroke-width="5">
        ${PEARLS.map((pearl, index) => index === omitPearl ? "" : (
          `<circle cx="${pearl.x + (index === displacePearl ? 72 : 0)}" cy="${pearl.y}" r="34"/>`
        )).join("")}
      </g>
      <ellipse cx="643" cy="615" rx="340" ry="275" fill="#e8dfcf" stroke="#251f19" stroke-width="5"/>
      <ellipse cx="643" cy="615" rx="275" ry="215" fill="#eee8dd" stroke="#b33f2f" stroke-width="5"/>
      <ellipse cx="643" cy="615" rx="205" ry="150" fill="#e1e5dc" stroke="#4f625d" stroke-width="5"/>
      ${generalTiles}
      <ellipse cx="643" cy="615" rx="112" ry="82" fill="#ddd7ca" stroke="#9a6d27" stroke-width="4"/>
      <polyline points="590,600 620,555 680,575 700,635 650,675 600,650 590,600" fill="none" stroke="#ad741e" stroke-width="7"/>
      <g fill="#1e6591"><circle cx="590" cy="600" r="8"/><circle cx="620" cy="555" r="8"/><circle cx="680" cy="575" r="8"/><circle cx="700" cy="635" r="8"/><circle cx="650" cy="675" r="8"/><circle cx="600" cy="650" r="8"/></g>
    </svg>
  `);
}

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "minitool-model-comparator-"));
  const reference = join(directory, "reference.png");
  const identical = join(directory, "identical.png");
  const shifted = join(directory, "shifted.png");
  const missingGeneral = join(directory, "missing-general.png");
  const mask = join(directory, "mask.png");
  const pixels = await sharp(syntheticModelSvg()).png().toBuffer();
  await sharp(pixels).toFile(reference);
  await sharp(pixels).toFile(identical);
  await sharp(pixels).affine([[1, 0], [0, 1]], {
    idx: 2,
    idy: 0,
    background: "#d8d2c8",
  }).png().toFile(shifted);
  await sharp(pixels).composite([{
    input: Buffer.from('<svg width="65" height="55" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e1e5dc"/></svg>'),
    left: 805,
    top: 580,
  }]).png().toFile(missingGeneral);
  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: "white" },
  }).greyscale().png().toFile(mask);
  return { directory, identical, mask, missingGeneral, reference, shifted };
}

test("accepts an identical canonical render and reports all six local gates", async () => {
  assert.deepEqual(CANONICAL_MODEL_SIZE, { width: WIDTH, height: HEIGHT });
  const fixture = await createFixture();
  const result = await compareMinitoolModel({
    referencePath: fixture.reference,
    actualPath: fixture.identical,
    maskPath: fixture.mask,
    diffPath: join(fixture.directory, "identical-diff.png"),
  });

  assert.equal(result.pass, true, JSON.stringify(result, null, 2));
  assert.equal(result.metrics.mae, 0);
  assert.equal(result.metrics.edgeOverlap, 1);
  assert.equal(result.metrics.histogramDistance, 0);
  assert.deepEqual(result.regions.map(({ name }) => name), [
    "zodiac",
    "four-pearls",
    "earth-branches",
    "month-generals",
    "general-jades",
    "center-trace",
  ]);
  assert.deepEqual(result.regions.find(({ name }) => name === "general-jades").items.map(({ name }) => name), [
    "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后",
  ]);
  assert.equal(result.regions.find(({ name }) => name === "general-jades").items.every(({ pass }) => pass), true);
  assert.equal(result.regions.every(({ pass }) => pass), true);
});

test("rejects a two-pixel translation through the structural edge gate", async () => {
  const fixture = await createFixture();
  const result = await compareMinitoolModel({
    referencePath: fixture.reference,
    actualPath: fixture.shifted,
    maskPath: fixture.mask,
    diffPath: join(fixture.directory, "shifted-diff.png"),
  });

  assert.equal(result.pass, false);
  assert.ok(result.failures.some((failure) => failure.includes("edge overlap")), JSON.stringify(result, null, 2));
});

test("rejects one missing general jade piece through its local gate", async () => {
  const fixture = await createFixture();
  const result = await compareMinitoolModel({
    referencePath: fixture.reference,
    actualPath: fixture.missingGeneral,
    maskPath: fixture.mask,
    diffPath: join(fixture.directory, "missing-general-diff.png"),
  });

  assert.equal(result.pass, false);
  assert.ok(
    result.failures.some((failure) => failure.startsWith("general-jades/六合:")),
    JSON.stringify(result, null, 2),
  );
});

for (const [index, pearl] of PEARLS.entries()) {
  for (const change of ["removed", "displaced"]) {
    test(`rejects ${change} ${pearl.name} pearl through its own local gate`, async () => {
      const fixture = await createFixture();
      const altered = join(fixture.directory, `${change}-${pearl.name}.png`);
      await sharp(syntheticModelSvg(change === "removed"
        ? { omitPearl: index }
        : { displacePearl: index })).png().toFile(altered);
      const result = await compareMinitoolModel({
        referencePath: fixture.reference,
        actualPath: altered,
        maskPath: fixture.mask,
      });

      assert.equal(result.pass, false);
      assert.ok(
        result.failures.some((failure) => failure.startsWith(`four-pearls/${pearl.name}:`)),
        JSON.stringify(result, null, 2),
      );
    });
  }
}

test("requires explicit contain normalization for a differently sized source", async () => {
  const fixture = await createFixture();
  const smaller = join(fixture.directory, "smaller.png");
  await sharp(fixture.reference).resize(643, 612).png().toFile(smaller);

  await assert.rejects(
    compareMinitoolModel({
      referencePath: smaller,
      actualPath: fixture.identical,
      maskPath: fixture.mask,
    }),
    /explicit normalization/i,
  );
  const normalized = await compareMinitoolModel({
    referencePath: smaller,
    actualPath: fixture.identical,
    maskPath: fixture.mask,
    normalization: "contain",
  });
  assert.equal(normalized.normalization, "contain");
  assert.deepEqual(normalized.sourceDimensions.reference, { width: 643, height: 612 });
});
