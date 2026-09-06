import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEV_BASE = "/design-daliuren";
const EXPECTED_GENERAL_PLACEMENTS = [
  "general/noble:申",
  "general/snake:未",
  "general/vermilion-bird:午",
  "general/harmony:巳",
  "general/hook-array:辰",
  "general/azure-dragon:卯",
  "general/void:寅",
  "general/white-tiger:丑",
  "general/constant:子",
  "general/black-tortoise:亥",
  "general/yin:戌",
  "general/queen-of-heaven:酉",
] as const;

async function frame(page: import("@playwright/test").Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function pixels(input: Buffer) {
  const result = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: result.data, width: result.info.width, height: result.info.height, channels: result.info.channels };
}

function differenceBounds(before: Awaited<ReturnType<typeof pixels>>, after: Awaited<ReturnType<typeof pixels>>) {
  let changed = 0;
  let minX = before.width;
  let minY = before.height;
  let maxX = -1;
  let maxY = -1;
  const mask = new Uint8Array(before.width * before.height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * before.channels;
    const delta = Math.max(
      Math.abs(before.data[offset] - after.data[offset]),
      Math.abs(before.data[offset + 1] - after.data[offset + 1]),
      Math.abs(before.data[offset + 2] - after.data[offset + 2]),
    );
    if (delta <= 12) continue;
    const x = index % before.width;
    const y = Math.floor(index / before.width);
    mask[index] = 1;
    changed += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    changed,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    mask,
  };
}

test("renders one stable solid jade model through every heaven and general position", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, attributes) {
      if (type === "webgl2") return null;
      return original.call(this, type, attributes);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${DEV_BASE}/artifacts/daliuren-minitool/index.html?visual-test=1`);
  await page.getByLabel("日期与时间").fill("2026-08-14T23:57");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("起课事由").fill("实体模型验收");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  const artifact = page.getByRole("region", { name: "三维推演模型" });
  await expect(artifact).toHaveAttribute("data-model-ready", "true", { timeout: 30_000 });
  const canvas = artifact.getByLabel("可旋转缩放的大六壬玉盘");
  await expect.poll(async () => Number(await canvas.getAttribute("data-render-draw-calls"))).toBeGreaterThan(0);
  expect(Number(await canvas.getAttribute("data-render-draw-calls"))).toBeLessThanOrEqual(50);
  expect(await canvas.getAttribute("data-solid-mesh-count")).toBe("40");
  expect(await canvas.getAttribute("data-general-mesh-count")).toBe("24");
  expect(Number(await canvas.getAttribute("data-heaven-thickness"))).toBeGreaterThan(0.012);
  expect(Number(await canvas.getAttribute("data-general-thickness"))).toBeGreaterThan(0.0035);

  const baselinePath = testInfo.outputPath("solid-mobile.png");
  await canvas.screenshot({ path: baselinePath });
  await testInfo.attach("solid-mobile", { path: baselinePath, contentType: "image/png" });
  const baseline = await pixels(await canvas.screenshot());
  let dark = 0;
  for (let offset = 0; offset < baseline.data.length; offset += baseline.channels) {
    if (baseline.data[offset] < 8 && baseline.data[offset + 1] < 8 && baseline.data[offset + 2] < 8) dark += 1;
  }
  expect(dark / (baseline.width * baseline.height)).toBeLessThan(0.02);

  const heavenBounds = [];
  for (let index = 0; index < 12; index += 1) {
    await canvas.evaluate((element, delta) => {
      const target = element as HTMLCanvasElement & {
        __setHeavenRotation?: (value: number) => void;
        __setHeavenSurfaceVisibility?: (visible: boolean) => void;
      };
      target.__setHeavenRotation?.(delta);
      target.__setHeavenSurfaceVisibility?.(true);
    }, index * Math.PI / 6);
    await frame(page);
    const visible = await pixels(await canvas.screenshot());
    await canvas.evaluate((element) => {
      (element as HTMLCanvasElement & { __setHeavenSurfaceVisibility?: (visible: boolean) => void })
        .__setHeavenSurfaceVisibility?.(false);
    });
    await frame(page);
    const hidden = await pixels(await canvas.screenshot());
    heavenBounds.push(differenceBounds(visible, hidden));
  }
  const diameters = heavenBounds.map(({ width, height }) => Math.max(width, height));
  expect(Math.max(...diameters) / Math.min(...diameters)).toBeLessThanOrEqual(1.03);
  expect(Math.max(...heavenBounds.map(({ centerX }) => centerX)) - Math.min(...heavenBounds.map(({ centerX }) => centerX))).toBeLessThanOrEqual(2);
  expect(Math.max(...heavenBounds.map(({ centerY }) => centerY)) - Math.min(...heavenBounds.map(({ centerY }) => centerY))).toBeLessThanOrEqual(2);
  expect(await canvas.getAttribute("data-heaven-surface-projection")).toBe("rigid");

  await canvas.evaluate((element) => {
    (element as HTMLCanvasElement & { __setHeavenSurfaceVisibility?: (visible: boolean) => void })
      .__setHeavenSurfaceVisibility?.(true);
  });
  await frame(page);
  const allGenerals = await pixels(await canvas.screenshot());
  const placements = (await canvas.getAttribute("data-general-placements"))!.split(">");
  expect(placements).toEqual(EXPECTED_GENERAL_PLACEMENTS);
  const generalBounds = [];
  for (const placement of placements) {
    const nodeId = placement.split(":")[0];
    await canvas.evaluate((element, id) => {
      (element as HTMLCanvasElement & { __setGeneralSurfaceVisibility?: (ownerId: string, visible: boolean) => void })
        .__setGeneralSurfaceVisibility?.(id, false);
    }, nodeId);
    await frame(page);
    const hidden = await pixels(await canvas.screenshot());
    const contribution = differenceBounds(allGenerals, hidden);
    expect(contribution.changed, `${nodeId} must occupy its own visible jade slot`).toBeGreaterThan(4);
    generalBounds.push(contribution);
    await canvas.evaluate((element, id) => {
      (element as HTMLCanvasElement & { __setGeneralSurfaceVisibility?: (ownerId: string, visible: boolean) => void })
        .__setGeneralSurfaceVisibility?.(id, true);
    }, nodeId);
  }
  for (let left = 0; left < generalBounds.length; left += 1) {
    for (let right = left + 1; right < generalBounds.length; right += 1) {
      const distance = Math.hypot(
        generalBounds[left].centerX - generalBounds[right].centerX,
        generalBounds[left].centerY - generalBounds[right].centerY,
      );
      expect(distance).toBeGreaterThan(6);
    }
  }

  const metricsPath = path.resolve(testInfo.outputDir, "solid-model-metrics.json");
  const finalMetrics = {
    drawCalls: Number(await canvas.getAttribute("data-render-draw-calls")),
    heavenThickness: Number(await canvas.getAttribute("data-heaven-thickness")),
    generalThickness: Number(await canvas.getAttribute("data-general-thickness")),
    heavenDiameters: diameters,
    generalCenters: generalBounds.map(({ centerX, centerY }) => [centerX, centerY]),
  };
  await writeFile(metricsPath, `${JSON.stringify(finalMetrics, null, 2)}\n`);
  await testInfo.attach("solid-model-metrics", { path: metricsPath, contentType: "application/json" });
});
