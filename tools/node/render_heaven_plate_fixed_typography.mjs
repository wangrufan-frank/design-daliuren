import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const workspace = process.cwd();
const input = process.argv[2] ?? path.join(
  workspace,
  "assets/daliuren/references/daliuren-heaven-plate-clean-jade-v3.png",
);
const output = process.argv[3] ?? path.join(
  workspace,
  "assets/daliuren/references/daliuren-heaven-plate-translucent-jade-generals-v10.png",
);
const fontPath = path.join(
  workspace,
  "assets/daliuren/fonts/STKaiti.ttf",
);

const branches = ["午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳"];
const monthGenerals = [
  "胜光", "小吉", "传送", "从魁", "河魁", "登明",
  "神后", "大吉", "功曹", "太冲", "天罡", "太乙",
];
const heavenlyGenerals = [
  "贵人", "腾蛇", "朱雀", "六合", "勾陈", "青龙",
  "天空", "白虎", "太常", "玄武", "太阴", "天后",
];

if (branches.length !== 12 || monthGenerals.length !== 12 || heavenlyGenerals.length !== 12) {
  throw new Error("Fixed-table count mismatch: expected 12 branches, 12 month generals, and 12 heavenly generals");
}

const metadata = await sharp(input).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error("Unable to read the base image dimensions");
}

const center = { x: 660, y: 600 };
const fontData = fs.readFileSync(fontPath).toString("base64");

const radii = {
  outer: [304, 254],
  branchInner: [238, 198],
  monthInner: [184, 150],
  thirdInner: [108, 85],
};

function point(angle, radiusX, radiusY) {
  const radians = angle * Math.PI / 180;
  return {
    x: center.x + radiusX * Math.sin(radians),
    y: center.y - radiusY * Math.cos(radians),
  };
}

function textNode({ text, angle, radiusX, radiusY, className, fontSize }) {
  const { x, y } = point(angle, radiusX, radiusY);
  const perspectiveScale = 0.92 + 0.10 * ((y - center.y) / radiusY + 1) / 2;
  const size = (fontSize * perspectiveScale).toFixed(2);
  return `<text class="${className}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" transform="rotate(${angle.toFixed(3)} ${x.toFixed(2)} ${y.toFixed(2)})">${text}</text>`;
}

function radialSegment(angle, innerRadius, outerRadius, className) {
  const start = point(angle, innerRadius[0], innerRadius[1]);
  const end = point(angle, outerRadius[0], outerRadius[1]);
  return `<line class="${className}" x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}"/>`;
}

function annularTilePath(centerAngle) {
  const startAngle = centerAngle - 13.9;
  const endAngle = centerAngle + 13.9;
  const outerRadius = [181, 147];
  const innerRadius = [111, 88];
  const outerStart = point(startAngle, outerRadius[0], outerRadius[1]);
  const outerEnd = point(endAngle, outerRadius[0], outerRadius[1]);
  const innerEnd = point(endAngle, innerRadius[0], innerRadius[1]);
  const innerStart = point(startAngle, innerRadius[0], innerRadius[1]);
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius[0]} ${outerRadius[1]} 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius[0]} ${innerRadius[1]} 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

const ringNodes = [radii.outer, radii.branchInner, radii.monthInner, radii.thirdInner]
  .map(([rx, ry]) => `<ellipse class="jade-line" cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}"/>`)
  .join("");

const rotorEdgeNodes = [radii.monthInner, radii.thirdInner]
  .map(([rx, ry]) => `
    <ellipse class="rotor-gap" cx="${center.x}" cy="${center.y}" rx="${rx}" ry="${ry}"/>
    <ellipse class="rotor-edge-highlight" cx="${center.x - 0.65}" cy="${center.y - 0.85}" rx="${rx}" ry="${ry}"/>
    <ellipse class="rotor-edge-shadow" cx="${center.x + 0.75}" cy="${center.y + 1.05}" rx="${rx}" ry="${ry}"/>
  `)
  .join("");

const twelveBoundaries = Array.from({ length: 12 }, (_, index) => 15 + index * 30);
const generalTileNodes = Array.from({ length: 12 }, (_, index) =>
  `<path class="general-tile" d="${annularTilePath(index * 30)}"/>
   <path class="general-tile-gloss" d="${annularTilePath(index * 30)}"/>`,
).join("");
const branchGridNodes = twelveBoundaries
  .map((angle) => radialSegment(angle, radii.branchInner, radii.outer, "jade-line"))
  .join("");
const monthGridNodes = twelveBoundaries
  .map((angle) => radialSegment(angle, radii.monthInner, radii.branchInner, "jade-line"))
  .join("");

const branchNodes = branches.map((text, index) => {
  const opticalInset = index >= 8;
  return textNode({
    text,
    angle: index * 30,
    radiusX: opticalInset ? 260 : 271,
    radiusY: opticalInset ? 217 : 226,
    className: "branch",
    fontSize: 38,
  });
}).join("");

const monthNodes = monthGenerals.map((text, index) => textNode({
  text,
  angle: index * 30,
  radiusX: 210,
  radiusY: 174,
  className: "month-general",
  fontSize: 18,
})).join("");

const heavenlyGeneralNodes = heavenlyGenerals.map((text, index) => textNode({
  text,
  angle: index * 30,
  radiusX: 146,
  radiusY: 116,
  className: "heavenly-general",
  fontSize: 17,
})).join("");

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${metadata.width}" height="${metadata.height}" viewBox="0 0 ${metadata.width} ${metadata.height}">
  <defs>
    <linearGradient id="translucentJade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.46"/>
      <stop offset="42%" stop-color="#e2f0ea" stop-opacity="0.30"/>
      <stop offset="72%" stop-color="#c8ddd4" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#f7fbf8" stop-opacity="0.42"/>
    </linearGradient>
    <style>
      @font-face {
        font-family: "Daliuren Serif";
        src: url("data:font/otf;base64,${fontData}") format("opentype");
      }
      text {
        font-family: "Daliuren Serif", serif;
        text-anchor: middle;
        dominant-baseline: central;
        font-weight: 400;
      }
      .branch {
        fill: #211f1b;
        stroke: #211f1b;
        stroke-width: 0.18px;
        paint-order: stroke fill;
        font-weight: 400;
      }
      .month-general {
        fill: #a64031;
        stroke: #d2a95b;
        stroke-width: 0.42px;
        paint-order: stroke fill;
        font-weight: 600;
      }
      .heavenly-general {
        fill: #68563b;
        stroke: #c6a967;
        stroke-width: 0.36px;
        paint-order: stroke fill;
        font-weight: 600;
        opacity: 0.97;
      }
      .general-tile {
        fill: url(#translucentJade);
        stroke: #80988e;
        stroke-width: 1.2px;
      }
      .general-tile-gloss {
        fill: none;
        stroke: #fffefa;
        stroke-width: 0.9px;
        opacity: 0.72;
      }
      .jade-line {
        fill: none;
        stroke: #a8987d;
        stroke-width: 1.55px;
        opacity: 0.72;
      }
      .jade-line.fine {
        stroke-width: 1.05px;
        opacity: 0.62;
      }
      .rotor-gap,
      .rotor-edge-highlight,
      .rotor-edge-shadow {
        fill: none;
      }
      .rotor-gap {
        stroke: #655a4d;
        stroke-width: 3.4px;
        opacity: 0.36;
      }
      .rotor-edge-highlight {
        stroke: #fffdf6;
        stroke-width: 1.35px;
        opacity: 0.82;
      }
      .rotor-edge-shadow {
        stroke: #756757;
        stroke-width: 1.55px;
        opacity: 0.58;
      }
      .constellation-line {
        fill: none;
        stroke: #b88a3c;
        stroke-width: 1.4px;
        opacity: 0.82;
      }
      .constellation-star {
        fill: #24508c;
        stroke: #bc8b38;
        stroke-width: 1.25px;
      }
    </style>
    <filter id="engraved" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0.55" dy="0.7" stdDeviation="0.4" flood-color="#75634b" flood-opacity="0.28"/>
      <feDropShadow dx="-0.35" dy="-0.45" stdDeviation="0.3" flood-color="#fffdf6" flood-opacity="0.50"/>
    </filter>
    <filter id="tileBevel" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0.9" dy="1.1" stdDeviation="0.85" flood-color="#587168" flood-opacity="0.32"/>
      <feDropShadow dx="-0.65" dy="-0.8" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.82"/>
    </filter>
  </defs>
  <g filter="url(#tileBevel)">
    ${generalTileNodes}
  </g>
  <g filter="url(#engraved)">
    ${ringNodes}
    ${branchGridNodes}
    ${monthGridNodes}
  </g>
  <g>
    ${rotorEdgeNodes}
  </g>
  <g filter="url(#engraved)">
    ${branchNodes}
    ${monthNodes}
    ${heavenlyGeneralNodes}
  </g>
  <g filter="url(#engraved)">
    <polyline class="constellation-line" points="618,554 596,582 608,623 641,646 704,637 719,574"/>
    <line class="constellation-line" x1="608" y1="623" x2="635" y2="588"/>
    <circle class="constellation-star" cx="618" cy="554" r="4.2"/>
    <circle class="constellation-star" cx="596" cy="582" r="4.2"/>
    <circle class="constellation-star" cx="608" cy="623" r="4.2"/>
    <circle class="constellation-star" cx="641" cy="646" r="4.2"/>
    <circle class="constellation-star" cx="704" cy="637" r="4.2"/>
    <circle class="constellation-star" cx="719" cy="574" r="4.2"/>
    <circle class="constellation-star" cx="635" cy="588" r="4.2"/>
  </g>
</svg>`);

await sharp(input)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .png()
  .toFile(output);

console.log(output);
