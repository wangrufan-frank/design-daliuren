import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";

const ARTIFACTS = path.resolve("artifacts/model-parity");
const DEV_BASE = "/design-daliuren";
const VIEWPORTS = [
  { name: "reference", width: 1286, height: 1223 },
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function openMiniTool(page: Page) {
  await page.goto(`${DEV_BASE}/artifacts/daliuren-minitool/index.html?visual-test=1`);
  await expect(page.getByRole("button", { name: "生成完整课式" })).toBeVisible();
}

test("does not bypass a corrupted final app bundle", async ({ page }) => {
  let corruptedRequests = 0;
  await page.route("**/artifacts/daliuren-minitool/assets/app.js", async (route) => {
    corruptedRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "throw new Error('corrupted final app bundle');",
    });
  });
  await expect(openMiniTool(page)).rejects.toThrow();
  expect(corruptedRequests).toBe(1);
});

test("renders the final model when WebGL 2 is unavailable but WebGL 1 works", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, attributes) {
      if (type === "webgl2") return null;
      return originalGetContext.call(this, type, attributes);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await openMiniTool(page);
  const artifact = await generateReferenceCourse(page);
  await expect(artifact).toHaveAttribute("data-model-ready", "true");
  const canvas = artifact.locator("canvas");
  await expect.poll(async () => Number(await canvas.getAttribute("data-render-draw-calls"))).toBeGreaterThan(0);
  const screenshotPath = testInfo.outputPath("webgl1-model.png");
  await canvas.screenshot({ path: screenshotPath });
  await assertUnclippedAndNonBlack(screenshotPath);
});

async function generateReferenceCourse(page: Page) {
  // Chromium omits zero seconds from datetime-local values; the input schema restores :00.
  await page.getByLabel("日期与时间").fill("2026-08-14T23:57");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("参考课式");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  const artifact = page.getByRole("region", { name: "三维推演模型" });
  await expect(artifact).toHaveAttribute("data-model-ready", "true", { timeout: 30_000 });
  await expect(artifact.getByText("正在生成三维玉盘…")).toHaveCount(0);
  return artifact;
}

async function waitForStableFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function assertUnclippedAndNonBlack(screenshotPath: string) {
  const { data, info } = await sharp(screenshotPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { count: number; red: number; green: number; blue: number }>();
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const key = (red >> 4) << 8 | (green >> 4) << 4 | blue >> 4;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0];
  const background = [dominant.red / dominant.count, dominant.green / dominant.count, dominant.blue / dominant.count];
  let foreground = 0;
  let black = 0;
  let edgeForeground = 0;
  let edgePixels = 0;
  const roundedCornerInset = Math.min(24, Math.floor(info.width / 10), Math.floor(info.height / 10));
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (red <= 8 && green <= 8 && blue <= 8) black += 1;
      const isForeground = Math.max(
        Math.abs(red - background[0]),
        Math.abs(green - background[1]),
        Math.abs(blue - background[2]),
      ) > 18;
      const onHorizontalEdge = (y < 3 || y >= info.height - 3)
        && x >= roundedCornerInset && x < info.width - roundedCornerInset;
      const onVerticalEdge = (x < 3 || x >= info.width - 3)
        && y >= roundedCornerInset && y < info.height - roundedCornerInset;
      if (onHorizontalEdge || onVerticalEdge) {
        edgePixels += 1;
        if (isForeground) edgeForeground += 1;
      }
      if (!isForeground) continue;
      foreground += 1;
    }
  }
  expect(foreground, `${screenshotPath} must contain a rendered model`).toBeGreaterThan(info.width * info.height * 0.08);
  expect(black / (info.width * info.height), `${screenshotPath} must not contain black material blocks`).toBeLessThan(0.02);
  expect(edgeForeground / edgePixels, `${screenshotPath} model must not touch the canvas edge`).toBeLessThan(0.01);
}

async function measurePixelChange(
  beforePath: string,
  afterPath: string,
  includes: (x: number, y: number, width: number, height: number) => boolean = () => true,
) {
  const [before, after] = await Promise.all([
    sharp(beforePath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(afterPath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  expect(after.info.width).toBe(before.info.width);
  expect(after.info.height).toBe(before.info.height);
  let total = 0;
  let changed = 0;
  let pixels = 0;
  for (let index = 0; index < before.info.width * before.info.height; index += 1) {
    const x = index % before.info.width;
    const y = Math.floor(index / before.info.width);
    if (!includes(x, y, before.info.width, before.info.height)) continue;
    const offset = index * before.info.channels;
    const difference = Math.max(
      Math.abs(before.data[offset] - after.data[offset]),
      Math.abs(before.data[offset + 1] - after.data[offset + 1]),
      Math.abs(before.data[offset + 2] - after.data[offset + 2]),
    );
    total += difference;
    if (difference > 18) changed += 1;
    pixels += 1;
  }
  return { mae: total / pixels / 255, changedRatio: changed / pixels };
}

async function captureCanvas(page: Page, name: string, testInfo: TestInfo) {
  await waitForStableFrame(page);
  const output = path.join(ARTIFACTS, name);
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  await assertRuntimeDrawCalls(canvas);
  await canvas.screenshot({ path: output });
  await testInfo.attach(name, { path: output, contentType: "image/png" });
  return output;
}

async function assertRuntimeDrawCalls(canvas: ReturnType<Page["getByLabel"]>) {
  const value = await canvas.getAttribute("data-render-draw-calls");
  expect(value, "renderer.info.render.calls must be published for the final frame").not.toBeNull();
  const drawCalls = Number(value);
  expect(drawCalls, "real rendered frame must stay inside the 50 draw-call budget").toBeLessThanOrEqual(50);
  return drawCalls;
}

async function countTraceColors(imagePath: string) {
  const { data, info } = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let blue = 0;
  let gold = 0;
  for (let y = Math.floor(info.height * 0.38); y < Math.ceil(info.height * 0.62); y += 1) {
    for (let x = Math.floor(info.width * 0.42); x < Math.ceil(info.width * 0.58); x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blueChannel = data[offset + 2];
      if (blueChannel > red + 4 && blueChannel > green + 2 && blueChannel > 70) blue += 1;
      if (red > green * 1.15 && green > blueChannel * 1.4 && red > 100) gold += 1;
    }
  }
  return { blue, gold };
}

interface RawPixels {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
}

interface GeneralContribution {
  readonly changedPixels: number;
  readonly centroid: readonly [number, number];
  readonly mask: Uint8Array;
}

async function readPixels(input: string | Buffer): Promise<RawPixels> {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function measureRawPixelChange(before: RawPixels, after: RawPixels) {
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  let total = 0;
  let changed = 0;
  for (let index = 0; index < before.width * before.height; index += 1) {
    const offset = index * before.channels;
    const difference = Math.max(
      Math.abs(before.data[offset] - after.data[offset]),
      Math.abs(before.data[offset + 1] - after.data[offset + 1]),
      Math.abs(before.data[offset + 2] - after.data[offset + 2]),
    );
    total += difference;
    if (difference > 18) changed += 1;
  }
  const pixels = before.width * before.height;
  return { mae: total / pixels / 255, changedRatio: changed / pixels };
}

async function measureHeavenBoundary(page: Page, beforeDelta: number, afterDelta: number) {
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const setRotation = (rotationDelta: number) => canvas.evaluate((element, delta) => {
    const setter = (element as HTMLCanvasElement & {
      __setHeavenRotation?: (value: number) => void;
    }).__setHeavenRotation;
    if (!setter) throw new Error("Heaven rotation test hook is unavailable.");
    setter(delta);
  }, rotationDelta);
  await setRotation(beforeDelta);
  await waitForStableFrame(page);
  const beforeDrawCalls = await assertRuntimeDrawCalls(canvas);
  const beforeProjection = await canvas.getAttribute("data-heaven-surface-projection");
  const before = await readPixels(await canvas.screenshot());
  await setRotation(afterDelta);
  await waitForStableFrame(page);
  const afterDrawCalls = await assertRuntimeDrawCalls(canvas);
  const afterProjection = await canvas.getAttribute("data-heaven-surface-projection");
  const after = await readPixels(await canvas.screenshot());
  return {
    beforeDelta,
    afterDelta,
    beforeProjection,
    afterProjection,
    beforeDrawCalls,
    afterDrawCalls,
    ...measureRawPixelChange(before, after),
  };
}

function percentile(values: number[], fraction: number) {
  values.sort((left, right) => left - right);
  return values[Math.floor((values.length - 1) * fraction)] ?? 0;
}

async function measureHeavenQuality(page: Page, rotationDelta: number) {
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const control = (action: "rotate" | "visible", value: number | boolean) => canvas.evaluate((element, detail) => {
    const target = element as HTMLCanvasElement & {
      __setHeavenRotation?: (delta: number) => void;
      __setHeavenSurfaceVisibility?: (visible: boolean) => void;
    };
    if (detail.action === "rotate") target.__setHeavenRotation?.(detail.value as number);
    else target.__setHeavenSurfaceVisibility?.(detail.value as boolean);
  }, { action, value });
  await control("rotate", rotationDelta);
  await waitForStableFrame(page);
  const drawCalls = await assertRuntimeDrawCalls(canvas);
  const projection = await canvas.getAttribute("data-heaven-surface-projection");
  const visible = await readPixels(await canvas.screenshot());
  await control("visible", false);
  await waitForStableFrame(page);
  const hidden = await readPixels(await canvas.screenshot());
  await control("visible", true);
  await waitForStableFrame(page);

  const contribution = new Uint8Array(visible.width * visible.height);
  const contrast: number[] = [];
  for (let index = 0; index < contribution.length; index += 1) {
    const offset = index * visible.channels;
    const difference = Math.max(
      Math.abs(visible.data[offset] - hidden.data[offset]),
      Math.abs(visible.data[offset + 1] - hidden.data[offset + 1]),
      Math.abs(visible.data[offset + 2] - hidden.data[offset + 2]),
    );
    contribution[index] = difference;
    if (difference > 2) contrast.push(difference);
  }
  const edges: number[] = [];
  for (let y = 0; y < visible.height - 1; y += 1) {
    for (let x = 0; x < visible.width - 1; x += 1) {
      const index = y * visible.width + x;
      const horizontal = Math.abs(contribution[index] - contribution[index + 1]);
      const vertical = Math.abs(contribution[index] - contribution[index + visible.width]);
      if (horizontal > 2) edges.push(horizontal);
      if (vertical > 2) edges.push(vertical);
    }
  }
  return {
    rotationDelta,
    projection,
    drawCalls,
    contrastP90: percentile(contrast, 0.9),
    edgeP90: percentile(edges, 0.9),
  };
}

async function measureGeneralContribution(
  page: Page,
  visible: RawPixels,
  nodeId: string,
): Promise<GeneralContribution> {
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const setVisible = (value: boolean) => canvas.evaluate((element, detail) => {
    const setter = (element as HTMLCanvasElement & {
      __setGeneralSurfaceVisibility?: (ownerId: string, visible: boolean) => void;
    }).__setGeneralSurfaceVisibility;
    if (!setter) throw new Error("General surface test hook is unavailable.");
    setter(detail.nodeId, detail.visible);
  }, { nodeId, visible: value });
  await setVisible(false);
  await waitForStableFrame(page);
  const hidden = await readPixels(await canvas.screenshot());
  await setVisible(true);
  await waitForStableFrame(page);

  expect(hidden.width).toBe(visible.width);
  expect(hidden.height).toBe(visible.height);
  const mask = new Uint8Array(visible.width * visible.height);
  let changedPixels = 0;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * visible.channels;
    const difference = Math.max(
      Math.abs(visible.data[offset] - hidden.data[offset]),
      Math.abs(visible.data[offset + 1] - hidden.data[offset + 1]),
      Math.abs(visible.data[offset + 2] - hidden.data[offset + 2]),
    );
    if (difference <= 18) continue;
    mask[index] = 1;
    changedPixels += 1;
    sumX += index % visible.width;
    sumY += Math.floor(index / visible.width);
  }
  expect(changedPixels, `${nodeId} must contribute visible pixels`).toBeGreaterThan(100);
  return { changedPixels, centroid: [sumX / changedPixels, sumY / changedPixels], mask };
}

function contributionMotion(before: GeneralContribution, after: GeneralContribution) {
  let overlap = 0;
  for (let index = 0; index < before.mask.length; index += 1) {
    if (before.mask[index] && after.mask[index]) overlap += 1;
  }
  return {
    centroidDistance: Math.hypot(
      before.centroid[0] - after.centroid[0],
      before.centroid[1] - after.centroid[1],
    ),
    overlapRatio: overlap / Math.min(before.changedPixels, after.changedPixels),
  };
}

async function measureHeavenContribution(page: Page, rotationDelta: number) {
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const control = (action: "rotate" | "visible", value: number | boolean) => canvas.evaluate((element, detail) => {
    const target = element as HTMLCanvasElement & {
      __setHeavenRotation?: (rotationDelta: number) => void;
      __setHeavenSurfaceVisibility?: (visible: boolean) => void;
    };
    if (detail.action === "rotate") target.__setHeavenRotation?.(detail.value as number);
    else target.__setHeavenSurfaceVisibility?.(detail.value as boolean);
  }, { action, value });
  await control("rotate", rotationDelta);
  await waitForStableFrame(page);
  const drawCalls = await assertRuntimeDrawCalls(canvas);
  expect(await canvas.getAttribute("data-heaven-surface-projection")).toBe("rigid");
  const visible = await readPixels(await canvas.screenshot());
  await control("visible", false);
  await waitForStableFrame(page);
  const hidden = await readPixels(await canvas.screenshot());
  await control("visible", true);
  await waitForStableFrame(page);

  let changedPixels = 0;
  let minX = visible.width;
  let minY = visible.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < visible.width * visible.height; index += 1) {
    const offset = index * visible.channels;
    const difference = Math.max(
      Math.abs(visible.data[offset] - hidden.data[offset]),
      Math.abs(visible.data[offset + 1] - hidden.data[offset + 1]),
      Math.abs(visible.data[offset + 2] - hidden.data[offset + 2]),
    );
    if (difference <= 18) continue;
    const x = index % visible.width;
    const y = Math.floor(index / visible.width);
    changedPixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  expect(changedPixels).toBeGreaterThan(1_000);
  return {
    changedPixels,
    aspect: (maxX - minX + 1) / (maxY - minY + 1),
    drawCalls,
  };
}

test("captures the texture-ready model at all acceptance viewports without clipping", async ({ browser }, testInfo) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    await openMiniTool(page);
    const artifact = await generateReferenceCourse(page);
    await page.addStyleTag({ content: ".artifact__hint{display:none!important}" });
    await waitForStableFrame(page);
    await assertRuntimeDrawCalls(artifact.locator("canvas"));
    const output = path.join(ARTIFACTS, `viewport-${viewport.name}.png`);
    await artifact.locator("canvas").screenshot({ path: output });
    await assertUnclippedAndNonBlack(output);
    await testInfo.attach(`viewport-${viewport.name}`, { path: output, contentType: "image/png" });
    await page.close();
  }
});

test("keeps zero, periodic zero, and 15 degree heaven transitions pixel-continuous", async ({ page }, testInfo) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openMiniTool(page);
  await generateReferenceCourse(page);
  await page.addStyleTag({ content: ".artifact__hint{display:none!important}" });

  const degree = Math.PI / 180;
  const cases = [
    { name: "positive-nanoradian", before: 0, after: 1e-9, maxChangedRatio: 1e-4, maxMae: 1e-4 },
    { name: "negative-nanoradian", before: 0, after: -1e-9, maxChangedRatio: 1e-4, maxMae: 1e-4 },
    { name: "positive-periodic-nanoradian", before: Math.PI * 2, after: Math.PI * 2 + 1e-9, maxChangedRatio: 1e-4, maxMae: 1e-4 },
    { name: "negative-periodic-nanoradian", before: -Math.PI * 2, after: -Math.PI * 2 - 1e-9, maxChangedRatio: 1e-4, maxMae: 1e-4 },
    { name: "positive-origin", before: 0, after: 0.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
    { name: "negative-origin", before: 0, after: -0.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
    { name: "positive", before: 14.9 * degree, after: 15.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
    { name: "negative", before: -14.9 * degree, after: -15.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
    { name: "positive-periodic", before: 374.9 * degree, after: 375.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
    { name: "negative-periodic", before: -374.9 * degree, after: -375.1 * degree, maxChangedRatio: 0.012, maxMae: 0.004 },
  ] as const;
  const metrics = [];
  for (const boundary of cases) {
    const result = await measureHeavenBoundary(page, boundary.before, boundary.after);
    expect(result.changedRatio, `${boundary.name} changed-pixel ratio`).toBeLessThan(boundary.maxChangedRatio);
    expect(result.mae, `${boundary.name} MAE`).toBeLessThan(boundary.maxMae);
    metrics.push({ name: boundary.name, ...result });
  }
  const metricsPath = path.join(ARTIFACTS, "heaven-transition-metrics.json");
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  await testInfo.attach("heaven-transition-metrics", { path: metricsPath, contentType: "application/json" });
});

test("keeps the 15 degree heaven midpoint opaque and sharp", async ({ page }, testInfo) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openMiniTool(page);
  await generateReferenceCourse(page);
  await page.addStyleTag({ content: ".artifact__hint{display:none!important}" });

  const samples = {
    native: await measureHeavenQuality(page, 0),
    midpoint: await measureHeavenQuality(page, Math.PI / 12),
    rotated: await measureHeavenQuality(page, Math.PI / 6),
  };
  const contrastRetention = samples.midpoint.contrastP90
    / Math.min(samples.native.contrastP90, samples.rotated.contrastP90);
  const edgeRetention = samples.midpoint.edgeP90
    / Math.min(samples.native.edgeP90, samples.rotated.edgeP90);
  expect(contrastRetention, "midpoint opacity").toBeGreaterThanOrEqual(0.9);
  expect(edgeRetention, "midpoint edge clarity").toBeGreaterThanOrEqual(0.9);

  const metricsPath = path.join(ARTIFACTS, "heaven-midpoint-quality-metrics.json");
  await writeFile(metricsPath, `${JSON.stringify({ samples, contrastRetention, edgeRetention }, null, 2)}\n`);
  await testInfo.attach("heaven-midpoint-quality-metrics", { path: metricsPath, contentType: "application/json" });
});

test("keeps the solid heaven ring rigid through 90 and 180 degree rotation", async ({ page }, testInfo) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openMiniTool(page);
  await generateReferenceCourse(page);
  await page.addStyleTag({ content: ".artifact__hint{display:none!important}" });

  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  await page.mouse.move(centerX + box!.width * 0.2, centerY);
  await page.mouse.down();
  expect(await canvas.getAttribute("data-last-gesture")).toBe("heaven");
  await page.mouse.move(centerX, centerY + box!.height * 0.2, { steps: 12 });
  await waitForStableFrame(page);
  expect(Math.abs(Number(await canvas.getAttribute("data-heaven-rotation-delta")))).toBeGreaterThan(1.2);
  expect(await canvas.getAttribute("data-heaven-surface-projection")).toBe("rigid");
  await page.mouse.move(centerX - box!.width * 0.2, centerY, { steps: 12 });
  await waitForStableFrame(page);
  expect(Math.abs(Number(await canvas.getAttribute("data-heaven-rotation-delta")))).toBeGreaterThan(2.7);
  expect(await canvas.getAttribute("data-heaven-surface-projection")).toBe("rigid");
  await page.mouse.up();

  const quarterTurn = await measureHeavenContribution(page, Math.PI / 2);
  const halfTurn = await measureHeavenContribution(page, Math.PI);
  expect(quarterTurn.aspect).toBeGreaterThan(0.85);
  expect(quarterTurn.aspect).toBeLessThan(1.15);
  expect(halfTurn.aspect).toBeGreaterThan(0.85);
  expect(halfTurn.aspect).toBeLessThan(1.15);
  expect(Math.abs(quarterTurn.aspect - halfTurn.aspect)).toBeLessThan(0.15);
  const metricsPath = path.join(ARTIFACTS, "heaven-rotation-metrics.json");
  await writeFile(metricsPath, `${JSON.stringify({ quarterTurn, halfTurn }, null, 2)}\n`);
  await testInfo.attach("heaven-rotation-metrics", { path: metricsPath, contentType: "application/json" });
});

test("renders state changes, independent dial motion, orbit depth, and zoom as real pixels", async ({ browser }, testInfo) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openMiniTool(page);
  await generateReferenceCourse(page);
  await page.addStyleTag({ content: ".artifact__hint{display:none!important}" });
  const baseline = await captureCanvas(page, "dynamic-default.png", testInfo);
  const canvas = page.getByLabel("可旋转缩放的大六壬玉盘");
  const defaultDrawCalls = await assertRuntimeDrawCalls(canvas);
  const defaultGeneralPlacements = await canvas.getAttribute("data-general-placements");
  expect(defaultGeneralPlacements?.split(">")).toHaveLength(12);
  const defaultGeneralIds = defaultGeneralPlacements!.split(">").map((placement) => placement.split(":")[0]);
  const baselinePixels = await readPixels(baseline);
  const defaultContributions = new Map<string, GeneralContribution>();
  for (const nodeId of defaultGeneralIds) {
    defaultContributions.set(nodeId, await measureGeneralContribution(page, baselinePixels, nodeId));
  }
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  await page.mouse.move(centerX + box!.width * 0.2, centerY);
  await page.mouse.down();
  const gesture = await canvas.getAttribute("data-last-gesture");
  expect(gesture).toBe("heaven");
  await page.mouse.move(centerX + box!.width * 0.18, centerY + box!.height * 0.06, { steps: 8 });
  await page.mouse.up();
  const heavenRotated = await captureCanvas(page, "dynamic-heaven.png", testInfo);
  const heavenDrawCalls = await assertRuntimeDrawCalls(canvas);
  const heavenDelta = await measurePixelChange(baseline, heavenRotated);
  expect(heavenDelta.changedRatio).toBeGreaterThan(0.01);
  const earthDelta = await measurePixelChange(baseline, heavenRotated, (x, y, width, height) => {
    const dx = (x - width / 2) / (width * 0.24);
    const dy = (y - height / 2) / (height * 0.34);
    return dx * dx + dy * dy > 1;
  });
  expect(earthDelta.changedRatio).toBeLessThan(0.003);

  await page.mouse.move(box!.x + box!.width * 0.08, centerY);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.2, centerY + box!.height * 0.11, { steps: 8 });
  await page.mouse.up();
  const orbited = await captureCanvas(page, "dynamic-orbit-depth.png", testInfo);
  const orbitDrawCalls = await assertRuntimeDrawCalls(canvas);
  const orbitDelta = await measurePixelChange(heavenRotated, orbited);
  expect(orbitDelta.changedRatio).toBeGreaterThan(0.12);
  expect(orbitDelta.mae).toBeGreaterThan(0.035);

  await canvas.hover({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await page.mouse.wheel(0, -180);
  const zoomed = await captureCanvas(page, "dynamic-zoom.png", testInfo);
  const zoomDrawCalls = await assertRuntimeDrawCalls(canvas);
  const zoomDelta = await measurePixelChange(orbited, zoomed);
  expect(zoomDelta.changedRatio).toBeGreaterThan(0.05);
  await page.close();

  const alternate = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openMiniTool(alternate);
  await alternate.getByLabel("日期与时间").fill("2026-08-15T09:15");
  await alternate.getByLabel("出生年份").fill("1990");
  await alternate.getByLabel("地点（选填）").fill("动态课式");
  await alternate.getByLabel("起课事由").fill("动态视觉验证");
  await alternate.getByRole("button", { name: "生成完整课式" }).click();
  const artifact = alternate.getByRole("region", { name: "三维推演模型" });
  await expect(artifact).toHaveAttribute("data-model-ready", "true", { timeout: 30_000 });
  const alternateCanvas = alternate.getByLabel("可旋转缩放的大六壬玉盘");
  await expect(alternateCanvas).toHaveAttribute("data-course-trace-count", "3");
  await expect(alternateCanvas).toHaveAttribute("data-course-trace-topology", /.+>.+>.+/);
  const alternateGeneralPlacements = await alternateCanvas.getAttribute("data-general-placements");
  const defaultPlacements = defaultGeneralPlacements!.split(">");
  const alternatePlacements = alternateGeneralPlacements!.split(">");
  expect(alternatePlacements).toHaveLength(12);
  expect(alternatePlacements.filter((placement, index) => placement !== defaultPlacements[index])).toHaveLength(12);
  await alternate.addStyleTag({ content: ".artifact__hint{display:none!important}" });
  const alternateState = await captureCanvas(alternate, "dynamic-alternate-course.png", testInfo);
  const alternateDrawCalls = await assertRuntimeDrawCalls(alternateCanvas);
  const alternatePixels = await readPixels(alternateState);
  const generalSurfaceEvidence = [];
  for (const nodeId of defaultGeneralIds) {
    const before = defaultContributions.get(nodeId)!;
    const after = await measureGeneralContribution(alternate, alternatePixels, nodeId);
    const motion = contributionMotion(before, after);
    expect(motion.centroidDistance, `${nodeId} must leave its old pixel position`).toBeGreaterThan(70);
    expect(motion.overlapRatio, `${nodeId} must not remain rendered in its old region`).toBeLessThan(0.1);
    generalSurfaceEvidence.push({
      nodeId,
      defaultChangedPixels: before.changedPixels,
      alternateChangedPixels: after.changedPixels,
      ...motion,
    });
  }
  const generalEvidencePath = path.join(ARTIFACTS, "general-surface-metrics.json");
  await writeFile(generalEvidencePath, `${JSON.stringify(generalSurfaceEvidence, null, 2)}\n`);
  await testInfo.attach("general-surface-metrics", { path: generalEvidencePath, contentType: "application/json" });
  const traceColors = await countTraceColors(alternateState);
  const endpoints = await alternateCanvas.getAttribute("data-course-trace-endpoints");
  expect(traceColors.blue, `trace endpoints ${endpoints}`).toBeGreaterThan(15);
  expect(traceColors.gold, `trace endpoints ${endpoints}`).toBeGreaterThan(20);
  const stateDelta = await measurePixelChange(baseline, alternateState);
  expect(stateDelta.changedRatio).toBeGreaterThan(0.01);
  expect(stateDelta.mae).toBeGreaterThan(0.002);
  const generalDelta = await measurePixelChange(baseline, alternateState, (x, y, width, height) => {
    const outerX = (x - width / 2) / (width * 0.2);
    const outerY = (y - height / 2) / (height * 0.28);
    const innerX = (x - width / 2) / (width * 0.105);
    const innerY = (y - height / 2) / (height * 0.15);
    return outerX * outerX + outerY * outerY <= 1 && innerX * innerX + innerY * innerY >= 1;
  });
  expect(generalDelta.changedRatio).toBeGreaterThan(0.02);
  await alternateCanvas.evaluate((element, rotationDelta) => {
    const setter = (element as HTMLCanvasElement & {
      __setHeavenRotation?: (value: number) => void;
    }).__setHeavenRotation;
    if (!setter) throw new Error("Heaven rotation test hook is unavailable.");
    setter(rotationDelta);
  }, Math.PI / 12);
  await waitForStableFrame(alternate);
  expect(await alternateCanvas.getAttribute("data-heaven-surface-projection")).toBe("rigid");
  const alternateTransitionDrawCalls = await assertRuntimeDrawCalls(alternateCanvas);
  const drawCallMetricsPath = path.join(ARTIFACTS, "runtime-draw-call-metrics.json");
  await writeFile(drawCallMetricsPath, `${JSON.stringify({
    default: defaultDrawCalls,
    heaven: heavenDrawCalls,
    orbit: orbitDrawCalls,
    zoom: zoomDrawCalls,
    alternateCourse: alternateDrawCalls,
    alternateCourseTransition: alternateTransitionDrawCalls,
  }, null, 2)}\n`);
  await testInfo.attach("runtime-draw-call-metrics", { path: drawCallMetricsPath, contentType: "application/json" });
  await alternate.close();
});
