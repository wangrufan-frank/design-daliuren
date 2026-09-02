import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const GENERAL_SEQUENCE = [
  "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
  "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
  "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
].join(",");

async function completeCourse(page: Page, civilDateTime = "2024-02-10T14:30") {
  await page.goto("/");
  await page.getByLabel("日期与时间").fill(civilDateTime);
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
}

async function completeReferenceCourse(page: Page) {
  await completeCourse(page);
}

async function completeCompletedReferenceCourse(page: Page) {
  await completeCourse(page, "2026-08-14T23:57");
}

async function expectTextFallback(page: Page) {
  await expect(page.getByLabel("标准文字课式")).toContainText("初传");
  await expect(page.getByRole("button", { name: "文字课式", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "复制课式" })).toBeEnabled();
}

async function expectArtifactReady(page: Page) {
  const timeline = page.getByRole("slider", { name: "推演时间轴" });
  await expect(timeline).toBeVisible({ timeout: 30_000 });
  return timeline;
}

async function expectArtifactCanvasReady(page: Page) {
  await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  await expect(page.getByText("正在加载三维器物")).toHaveCount(0, { timeout: 30_000 });
}

async function finishArtifactDemo(page: Page) {
  await expectArtifactCanvasReady(page);
  const timeline = page.getByRole("slider", { name: "推演时间轴" });
  if (!await timeline.isVisible()) {
    await page.getByRole("toolbar", { name: "工作台工具" })
      .getByRole("button", { name: "时间轴", exact: true }).click();
  }
  await timeline.fill("27000");
  await expect(timeline).toHaveValue("27000");
  const experience = page.getByTestId("artifact-experience");
  await expect(experience).toHaveAttribute("data-month-general-phase", "seated");
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12");
  return experience;
}

async function setVisualReviewPose(page: Page, pose: "authored" | "completed") {
  await page.evaluate((nextPose) => {
    const reviewWindow = window as Window & {
      __artifactSetVisualReviewPose?: (pose: "authored" | "completed") => void;
    };
    if (!reviewWindow.__artifactSetVisualReviewPose) {
      throw new Error("Artifact visual-review pose hook is unavailable");
    }
    reviewWindow.__artifactSetVisualReviewPose(nextPose);
  }, pose);
  const canvas = page.getByLabel("大六壬三维器物");
  await expect(canvas).toHaveAttribute("data-visual-review-pose", pose);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function findMonthGeneralRingPoints(page: Page, count = 1) {
  const canvas = page.getByLabel("大六壬三维器物");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Artifact canvas has no bounds");
  const center = { x: bounds.x + bounds.width * 0.5, y: bounds.y + bounds.height * 0.558 };
  const minimumDimension = Math.min(bounds.width, bounds.height);
  const points: { x: number; y: number }[] = [];
  const projectedCardinals = [
    { x: bounds.x + bounds.width * 0.634, y: bounds.y + bounds.height * 0.611 },
    { x: bounds.x + bounds.width * 0.443, y: bounds.y + bounds.height * 0.698 },
    { x: bounds.x + bounds.width * 0.376, y: bounds.y + bounds.height * 0.508 },
    { x: bounds.x + bounds.width * 0.548, y: bounds.y + bounds.height * 0.440 },
  ];
  const segments = count > 1
    ? [0, 4, 8, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]
    : Array.from({ length: 16 }, (_, index) => index);
  await canvas.evaluate((element) => {
    element.addEventListener("pointerdown", () => {
      element.dataset.probeReached = "true";
    }, { capture: true });
  });
  for (const point of projectedCardinals) {
    await canvas.evaluate((element) => {
      delete element.dataset.probeReached;
    });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    const intercepted = await canvas.evaluate((element) => element.dataset.probeReached !== "true");
    await page.mouse.up();
    if (intercepted) {
      points.push(point);
      if (points.length === count) return { points, center };
    }
  }
  for (const radiusFraction of [0.3, 0.25, 0.2, 0.15]) {
    for (const segment of segments) {
      const angle = segment * Math.PI / 8;
      const point = {
        x: center.x + Math.cos(angle) * minimumDimension * radiusFraction,
        y: center.y + Math.sin(angle) * minimumDimension * radiusFraction * 0.7,
      };
      await canvas.evaluate((element) => {
        delete element.dataset.probeReached;
      });
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      const intercepted = await canvas.evaluate((element) => element.dataset.probeReached !== "true");
      await page.mouse.up();
      const separated = points.every((existing) => Math.hypot(existing.x - point.x, existing.y - point.y) >= minimumDimension * 0.18);
      if (intercepted && separated) {
        points.push(point);
        if (points.length === count) return { points, center };
      }
    }
  }
  throw new Error(`Could not locate ${count} month-general interaction ring points`);
}

async function findMonthGeneralRingPoint(page: Page) {
  const { points, center } = await findMonthGeneralRingPoints(page);
  return { ...points[0], center };
}

async function captureArtifactCanvas(page: Page) {
  const encoded = await page.getByLabel("大六壬三维器物").evaluate(async (element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error("Artifact surface is not a canvas");
    return new Promise<string>((resolve) => requestAnimationFrame(() => {
      resolve(element.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""));
    }));
  });
  return Buffer.from(encoded, "base64");
}

async function expectMinimumBranchProjection(
  page: Page,
  testInfo: TestInfo,
  lod: 0 | 1 | 2,
  floor: number,
) {
  const experience = page.getByTestId("artifact-experience");
  await expect.poll(async () => Number(await experience.getAttribute("data-min-branch-px")))
    .toBeGreaterThanOrEqual(floor);
  const value = Number(await experience.getAttribute("data-min-branch-px"));
  await expect.poll(async () => Number(await experience.getAttribute("data-min-branch-edge-px")))
    .toBeGreaterThanOrEqual(4);
  const edgeMargin = Number(await experience.getAttribute("data-min-branch-edge-px"));
  await testInfo.attach(`runtime-lod${lod}-projection.json`, {
    body: Buffer.from(JSON.stringify({ value, floor, edgeMargin, edgeFloor: 4 }, null, 2)),
    contentType: "application/json",
  });
  return value;
}

async function expectVisibleRuntimeLod(
  page: Page,
  testInfo: TestInfo,
  lod: 0 | 1 | 2,
  screenshot: Buffer,
) {
  const canvasCssSize = await page.getByLabel("大六壬三维器物").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  const experience = page.getByTestId("artifact-experience");
  const branchFrame = {
    projection: Number(await experience.getAttribute("data-min-branch-px")),
    edgeMargin: Number(await experience.getAttribute("data-min-branch-edge-px")),
  };
  const metrics = await page.evaluate(async ({ encoded, canvasCssSize }) => {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    const bitmap = await createImageBitmap(await response.blob());
    const surface = document.createElement("canvas");
    surface.width = bitmap.width;
    surface.height = bitmap.height;
    const context = surface.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    const histogram = new Uint32Array(256);
    let count = 0;
    let sum = 0;
    let squared = 0;
    for (let offset = 0; offset < pixels.length; offset += 16) {
      const luminance = Math.round(
        pixels[offset] * 0.2126
        + pixels[offset + 1] * 0.7152
        + pixels[offset + 2] * 0.0722,
      );
      histogram[luminance] += 1;
      count += 1;
      sum += luminance;
      squared += luminance * luminance;
    }
    const percentile = (fraction: number) => {
      const target = count * fraction;
      let cumulative = 0;
      for (let value = 0; value < histogram.length; value += 1) {
        cumulative += histogram[value];
        if (cumulative >= target) return value / 255;
      }
      return 1;
    };
    const mean = sum / count / 255;
    const variance = Math.max(0, squared / count - (sum / count) ** 2);
    const cornerOffsets = [
      0,
      (surface.width - 1) * 4,
      (surface.height - 1) * surface.width * 4,
      (surface.height * surface.width - 1) * 4,
    ];
    const background = [0, 1, 2].map((channel) => (
      cornerOffsets.reduce((total, offset) => total + pixels[offset + channel], 0) / cornerOffsets.length
    ));
    const foregroundByColumn = new Uint32Array(surface.width);
    const foregroundByRow = new Uint32Array(surface.height);
    const subjectBounds = {
      minimumX: surface.width,
      maximumX: 0,
      minimumY: surface.height,
      maximumY: 0,
    };
    for (let y = 0; y < surface.height; y += 1) {
      for (let x = 0; x < surface.width; x += 1) {
        const offset = (y * surface.width + x) * 4;
        const backgroundDistance = (
          Math.abs(pixels[offset] - background[0])
          + Math.abs(pixels[offset + 1] - background[1])
          + Math.abs(pixels[offset + 2] - background[2])
        );
        if (backgroundDistance <= 18) continue;
        foregroundByColumn[x] += 1;
        foregroundByRow[y] += 1;
      }
    }
    const continuousForegroundFloor = 5;
    for (let x = 0; x < surface.width; x += 1) {
      if (foregroundByColumn[x] < continuousForegroundFloor) continue;
      subjectBounds.minimumX = Math.min(subjectBounds.minimumX, x);
      subjectBounds.maximumX = Math.max(subjectBounds.maximumX, x + 1);
    }
    for (let y = 0; y < surface.height; y += 1) {
      if (foregroundByRow[y] < continuousForegroundFloor) continue;
      subjectBounds.minimumY = Math.min(subjectBounds.minimumY, y);
      subjectBounds.maximumY = Math.max(subjectBounds.maximumY, y + 1);
    }
    if (
      subjectBounds.minimumX >= subjectBounds.maximumX
      || subjectBounds.minimumY >= subjectBounds.maximumY
    ) throw new Error("Artifact projection is absent from the WebGL canvas");
    let subjectCount = 0;
    let nearBlackCount = 0;
    for (let y = subjectBounds.minimumY; y < subjectBounds.maximumY; y += 2) {
      for (let x = subjectBounds.minimumX; x < subjectBounds.maximumX; x += 2) {
        const offset = (y * surface.width + x) * 4;
        const luminance = (
          pixels[offset] * 0.2126
          + pixels[offset + 1] * 0.7152
          + pixels[offset + 2] * 0.0722
        );
        subjectCount += 1;
        if (luminance < 32) nearBlackCount += 1;
      }
    }
    return {
      mean,
      standardDeviation: Math.sqrt(variance) / 255,
      percentileRange: percentile(0.95) - percentile(0.05),
      nearBlackFraction: nearBlackCount / subjectCount,
      subjectBounds,
      subjectMarginsCss: {
        left: subjectBounds.minimumX * canvasCssSize.width / surface.width,
        right: (surface.width - subjectBounds.maximumX) * canvasCssSize.width / surface.width,
        top: subjectBounds.minimumY * canvasCssSize.height / surface.height,
        bottom: (surface.height - subjectBounds.maximumY) * canvasCssSize.height / surface.height,
      },
    };
  }, { encoded: screenshot.toString("base64"), canvasCssSize });

  await testInfo.attach(`runtime-lod${lod}-metrics.json`, {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach(`runtime-lod${lod}.png`, {
    body: screenshot,
    contentType: "image/png",
  });
  expect(metrics.mean).toBeGreaterThan(0.15);
  expect(metrics.mean).toBeLessThan(0.95);
  expect(metrics.standardDeviation).toBeGreaterThan(0.03);
  expect(metrics.percentileRange).toBeGreaterThan(0.07);
  expect(metrics.nearBlackFraction).toBeLessThan(0.18);
  expect(
    Math.min(...Object.values(metrics.subjectMarginsCss)),
    `Artifact subject margins: ${JSON.stringify(metrics.subjectMarginsCss)}; branch frame: ${JSON.stringify(branchFrame)}`,
  ).toBeGreaterThanOrEqual(4);
}

test("only the correct detent seats the generals and leaving reverses them", async ({ page }) => {
  test.setTimeout(90_000);
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      if (/^\[\.WebGL.*\]GL Driver Message/.test(message.text())) return;
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const correctDetent = Number(await experience.getAttribute("data-month-general-detent"));
  expect(correctDetent).toBeGreaterThanOrEqual(0);
  expect(correctDetent).toBeLessThan(12);
  await expect(experience).toHaveAttribute("data-general-sequence", GENERAL_SEQUENCE);
  await expect(experience).toHaveAttribute("data-seated-general-ids", GENERAL_SEQUENCE);
  const rightStep = page.getByRole("button", { name: "月将环向右一宫" });
  await rightStep.scrollIntoViewIfNeeded();
  const hitTarget = await rightStep.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return {
      actionable: hit === element || element.contains(hit),
      button: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      hit: hit?.outerHTML,
    };
  });
  expect(hitTarget.actionable, JSON.stringify(hitTarget)).toBe(true);

  for (let step = 1; step <= 11; step += 1) {
    await rightStep.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(experience).toHaveAttribute("data-month-general-detent", String((correctDetent + step) % 12));
    await expect(experience).toHaveAttribute("data-month-general-aligned", "false");
    await expect(experience).toHaveAttribute("data-active-month-gold", "0.000");
    if (step === 1) await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });
  }

  await rightStep.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(experience).toHaveAttribute("data-month-general-detent", String(correctDetent));
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12", { timeout: 6_000 });
  expect(consoleIssues).toEqual([]);
});

for (const course of [
  { name: "forward", civilDateTime: "2024-02-10T06:30", direction: "顺布", nobleEarth: "辰", snakeEarth: "巳" },
  { name: "reverse", civilDateTime: "2024-02-10T14:30", direction: "逆布", nobleEarth: "申", snakeEarth: "未" },
] as const) {
  test(`${course.name} course preserves the upstream general direction`, async ({ page }) => {
    await completeCourse(page, course.civilDateTime);
    const experience = await finishArtifactDemo(page);
    const facts = page.getByTestId("artifact-accessible-facts");
    await expect(facts).toContainText(`落${course.nobleEarth}宫；${course.direction}`);
    await expect(facts).toContainText(new RegExp(`天将 螣蛇 .*\\/${course.snakeEarth}`));
    await expect(experience).toHaveAttribute("data-general-sequence", GENERAL_SEQUENCE);
    await expect(experience).toHaveAttribute("data-seated-general-ids", GENERAL_SEQUENCE);
  });
}

test("noble lands first and a third-piece interruption reverses current physical progress", async ({ page }) => {
  test.setTimeout(60_000);
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const right = page.getByRole("button", { name: "月将环向右一宫" });
  const left = page.getByRole("button", { name: "月将环向左一宫" });

  await right.click();
  await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });
  const interruption = experience.evaluate((element) => new Promise<{ first: string; atInterruption: string }>((resolve) => {
    const observed: string[] = [];
    const observer = new MutationObserver(() => {
      const ids = element.getAttribute("data-seated-general-ids") ?? "";
      if (ids && observed.at(-1) !== ids) observed.push(ids);
      if (element.getAttribute("data-seated-generals") !== "3") return;
      const atInterruption = ids;
      (document.querySelector('[aria-label="月将环向右一宫"]') as HTMLButtonElement).click();
      observer.disconnect();
      resolve({ first: observed[0] ?? "", atInterruption });
    });
    observer.observe(element, { attributes: true, attributeFilter: ["data-seated-generals", "data-seated-general-ids"] });
  }));
  await left.click();
  expect(await interruption).toEqual({
    first: "general/noble",
    atInterruption: "general/noble,general/snake,general/vermilion-bird",
  });
  await expect(experience).toHaveAttribute("data-month-general-phase", "exiting");
  await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });
});

test("pointer-down without movement preserves the completed state", async ({ page }) => {
  test.setTimeout(60_000);
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const canvas = page.getByLabel("大六壬三维器物");
  const point = await findMonthGeneralRingPoint(page);

  await canvas.evaluate((element) => {
    document.addEventListener("pointerdown", (event) => {
      element.dataset.testPointerId = String(event.pointerId);
    }, { capture: true, once: true });
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  expect(await canvas.evaluate((element) => {
    const pointerId = Number(element.dataset.testPointerId);
    return Number.isInteger(pointerId) && element.hasPointerCapture(pointerId);
  })).toBe(true);
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12");
  await page.mouse.up();

  await expect(experience).toHaveAttribute("data-month-general-phase", "seated");
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12");
});

test("wheel and keyboard steps share the same exact detent path", async ({ page }) => {
  test.setTimeout(60_000);
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const canvas = page.getByLabel("大六壬三维器物");
  const correctDetent = Number(await experience.getAttribute("data-month-general-detent"));

  await canvas.hover();
  await page.mouse.wheel(0, 120);
  await expect(experience).toHaveAttribute("data-month-general-detent", String((correctDetent + 1) % 12));
  await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });

  await canvas.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(experience).toHaveAttribute("data-month-general-detent", String(correctDetent));
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12", { timeout: 6_000 });
});

test("touch drag leaves the correct detent and snaps through the shared reducer", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 } });
  const touchPage = await context.newPage();
  try {
    await completeReferenceCourse(touchPage);
    const experience = await finishArtifactDemo(touchPage);
    const correctDetent = Number(await experience.getAttribute("data-month-general-detent"));
    const canvas = touchPage.getByLabel("大六壬三维器物");
    const start = await findMonthGeneralRingPoint(touchPage);
    const session = await context.newCDPSession(touchPage);
    const radius = { x: start.x - start.center.x, y: start.y - start.center.y };
    const target = { x: start.x - radius.y, y: start.y + radius.x };
    const path = [0.33, 0.66, 1].map((progress) => ({
      x: start.x + (target.x - start.x) * progress,
      y: start.y + (target.y - start.y) * progress,
    }));
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y }] });
    for (const point of path) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    }
    await expect(experience).toHaveAttribute("data-month-general-aligned", "false");
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(experience).not.toHaveAttribute("data-month-general-detent", String(correctDetent));
    await expect(experience).toHaveAttribute("data-month-general-aligned", "false");
    await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });
  } finally {
    await context.close();
  }
});

test("mobile controls preserve the same correct state and exact one-step behavior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const correctDetent = Number(await experience.getAttribute("data-month-general-detent"));
  const right = page.getByRole("button", { name: "月将环向右一宫" });
  await expect(right).toBeVisible();
  expect((await right.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await right.click();
  await expect(experience).toHaveAttribute("data-month-general-detent", String((correctDetent + 1) % 12));
  await expect(experience).toHaveAttribute("data-month-general-aligned", "false");
});

test("captures completed desktop and mobile review evidence", async ({ page }) => {
  test.setTimeout(70_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await completeCompletedReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const canvas = page.getByLabel("大六壬三维器物");
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-active-month-gold", "1.000");
  await expect(experience).toHaveAttribute("data-general-name-gold-count", "12");
  await writeFile("docs/asset-reviews/lookdev/overall.png", await captureArtifactCanvas(page));

  await setVisualReviewPose(page, "authored");
  await expect(canvas).toHaveAttribute("data-visual-review-top-pair", "午/胜光");
  await expect(canvas).toHaveAttribute("data-visual-review-month-angle", "0");
  await expect(experience).toHaveAttribute("data-active-month-gold", "0.000");
  await expect(experience).toHaveAttribute("data-general-name-gold-count", "0");

  await canvas.evaluate((element) => {
    const viewport = element.parentElement;
    if (!viewport) throw new Error("Artifact canvas has no viewport");
    viewport.style.position = "fixed";
    viewport.style.inset = "0 auto auto 0";
    viewport.style.width = "1254px";
    viewport.style.height = "1254px";
    viewport.style.minHeight = "1254px";
    element.style.width = "1254px";
    element.style.height = "1254px";
    element.style.minHeight = "1254px";
  });
  expect(await canvas.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
  }))).toEqual({ width: 1254, height: 1254 });
  await writeFile("docs/asset-reviews/lookdev/jade-plate-default.png", await captureArtifactCanvas(page));
  await canvas.evaluate((element) => {
    const viewport = element.parentElement;
    if (!viewport) throw new Error("Artifact canvas has no viewport");
    viewport.style.removeProperty("width");
    viewport.style.removeProperty("height");
    viewport.style.removeProperty("min-height");
    viewport.style.removeProperty("position");
    viewport.style.removeProperty("inset");
    element.style.removeProperty("width");
    element.style.removeProperty("height");
    element.style.removeProperty("min-height");
  });

  await setVisualReviewPose(page, "completed");
  await expect(experience).toHaveAttribute("data-month-general-detent", "6");
  await expect(experience).toHaveAttribute("data-active-month-gold", "1.000");
  await expect(experience).toHaveAttribute("data-general-name-gold-count", "12");
  await expect(experience).toHaveAttribute("data-seated-generals", "12");

  await page.setViewportSize({ width: 390, height: 844 });
  await setVisualReviewPose(page, "completed");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(0);
  await expect.poll(async () => Number(await experience.getAttribute("data-min-branch-px")))
    .toBeGreaterThanOrEqual(8);
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await writeFile("docs/asset-reviews/lookdev/jade-plate-mobile.png", await captureArtifactCanvas(page));
});

test("reduced motion preserves detents, sequence, colors, and final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  const right = page.getByRole("button", { name: "月将环向右一宫" });
  const left = page.getByRole("button", { name: "月将环向左一宫" });

  await right.click();
  await expect(experience).toHaveAttribute("data-active-month-gold", "0.000");
  await expect(experience).toHaveAttribute("data-seated-generals", "0");
  await left.click();
  await expect(experience).toHaveAttribute("data-active-month-gold", "1.000");
  await expect(experience).toHaveAttribute("data-seated-general-ids", GENERAL_SEQUENCE);
  await expect(experience).toHaveAttribute("data-seated-generals", "12");
});

test("all three LODs render the same completed rule state", async ({ browser }) => {
  test.setTimeout(120_000);
  const states: Record<string, string | null>[] = [];
  for (const item of [
    { lod: 0, viewport: { width: 1920, height: 1080 } },
    { lod: 1, viewport: { width: 1280, height: 720 } },
    { lod: 2, viewport: { width: 390, height: 844 } },
  ] as const) {
    const context = await browser.newContext({ viewport: item.viewport });
    const lodPage = await context.newPage();
    const response = lodPage.waitForResponse(new RegExp(`daliuren-artifact-lod${item.lod}\\.glb$`));
    await completeCompletedReferenceCourse(lodPage);
    expect((await response).ok()).toBe(true);
    const experience = await finishArtifactDemo(lodPage);
    states.push(await experience.evaluate((element) => Object.fromEntries([
      "data-month-general-detent", "data-month-general-aligned", "data-general-sequence",
      "data-seated-general-ids", "data-seated-generals", "data-active-month-gold", "data-general-name-gold-count",
    ].map((name) => [name, element.getAttribute(name)]))));
    await context.close();
  }

  expect(states[1]).toEqual(states[0]);
  expect(states[2]).toEqual(states[0]);
});

test("model labels and text course use the same verified facts", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const lodResponse = page.waitForResponse(/daliuren-artifact-lod0\.glb$/);
  await completeReferenceCourse(page);
  expect((await lodResponse).ok()).toBe(true);
  await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  const timeline = await expectArtifactReady(page);
  const experience = page.getByTestId("artifact-experience");
  await timeline.fill("27000");
  await expect(timeline).toHaveValue("27000");
  await expectMinimumBranchProjection(page, testInfo, 0, 15);
  await expectVisibleRuntimeLod(
    page,
    testInfo,
    0,
    await captureArtifactCanvas(page),
  );
  const facts = page.getByTestId("artifact-accessible-facts");
  await expect(facts).toContainText("天盘空");
  await expect(facts).toContainText("地盘空");
  await expect(facts).toContainText("初传");
  await expect(facts).toContainText("贵人");
  await expect(facts).toContainText("月将 神后子");
  await expect(facts).toContainText("旬空 寅、卯");
  await expect(facts).toContainText("四课 天后 寅（天盘空）/酉；查地盘 酉");
  await expect(facts).toContainText("天将 太阴 卯（天盘空）/戌");
  await expect(facts).toContainText("贵人 昼贵丑；落申宫；逆布");
  const labels = await facts.textContent();

  await page.getByRole("button", { name: "文字课式", exact: true }).click();
  const textCourse = page.getByLabel("标准文字课式");
  await expect(textCourse).toContainText("初传");
  await expect(textCourse).toContainText("贵人");
  await expect(textCourse).toContainText("神后子");
  await expect(textCourse).toContainText("昼贵丑");
  expect(labels).toContain("初传");
  expect(labels).toContain("贵人");
});

test("exact stage seeks are repeatable and a real pointer drag disables auto camera", async ({ page }) => {
  test.setTimeout(60_000);
  await completeReferenceCourse(page);
  const experience = page.getByTestId("artifact-experience");
  const timeline = await expectArtifactReady(page);
  const seekTimes = ["8000", "13000", "18000", "24000", "27000"] as const;
  const hashes = new Map<string, string>();

  for (const time of seekTimes) {
    await timeline.fill(time);
    await expect(timeline).toHaveValue(time);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(experience).toHaveAttribute("data-pose-hash", /^[\da-f]{8}$/);
    hashes.set(time, (await experience.getAttribute("data-pose-hash"))!);
  }
  for (const time of seekTimes) {
    await timeline.fill(time);
    await expect(timeline).toHaveValue(time);
    await expect(experience).toHaveAttribute("data-pose-hash", hashes.get(time)!);
  }

  await timeline.fill("25200");
  await expect(experience).toHaveAttribute("data-source-lines", "active");

  const canvas = page.getByLabel("大六壬三维器物");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.6, bounds!.y + bounds!.height * 0.55, { steps: 4 });
  await page.mouse.up();
  await expect(experience).toHaveAttribute("data-auto-camera", "false");
});

test("reduced motion retains final facts and disables source lines", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeReferenceCourse(page);
  const experience = page.getByTestId("artifact-experience");
  await expectArtifactReady(page);
  const facts = page.getByTestId("artifact-accessible-facts");
  await expect(facts).toContainText("初传");
  await expect(facts).toContainText("中传");
  await expect(facts).toContainText("末传");
  await expect(facts).toContainText("贵人");
  await expect(experience).toHaveAttribute("data-auto-camera", "false");
  await page.getByRole("slider", { name: "推演时间轴" }).fill("27000");
  await expect(page.getByRole("slider", { name: "推演时间轴" })).toHaveValue("27000");
  await expect(experience).toHaveAttribute("data-source-lines", "disabled");
});

test("mobile review keeps stage callouts and reaches every part through the directory", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const lodResponse = page.waitForResponse(/daliuren-artifact-lod2\.glb$/);
  await completeReferenceCourse(page);
  expect((await lodResponse).ok()).toBe(true);
  await expectArtifactCanvasReady(page);

  const tools = page.getByRole("toolbar", { name: "工作台工具" });
  const toolPanel = page.getByRole("region", { name: "移动工具面板" });
  await tools.getByRole("button", { name: "时间轴", exact: true }).click();
  const timeline = page.getByRole("slider", { name: "推演时间轴" });
  await timeline.fill("27000");
  await expect(timeline).toHaveValue("27000");
  await expectMinimumBranchProjection(page, testInfo, 2, 5);
  await tools.getByRole("button", { name: "时间轴", exact: true }).click();
  await expect(toolPanel).toBeHidden();
  await expectVisibleRuntimeLod(
    page,
    testInfo,
    2,
    await captureArtifactCanvas(page),
  );

  const callouts = page.locator(".artifact-annotations__card");
  const calloutCount = await callouts.count();
  expect(calloutCount).toBeGreaterThanOrEqual(3);
  expect(calloutCount).toBeLessThanOrEqual(6);
  await expect(page.getByRole("button", { name: "全部" })).toHaveCount(0);

  await tools.getByRole("button", { name: "部件", exact: true }).click();
  await expect(toolPanel).toBeVisible();
  const directoryButton = toolPanel.getByRole("button", { name: "打开部件目录" });
  await expect(directoryButton).toBeVisible();
  expect(await directoryButton.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await directoryButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await directoryButton.click();

  const directory = page.getByRole("dialog", { name: "全部部件" });
  await expect(directory).toBeVisible();
  expect(await directory.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(directory.getByTestId("artifact-part-group")).toHaveCount(6);
  const entries = directory.locator("button[data-part-id]");
  await expect(entries).toHaveCount(23);
  await expect(directory.getByText("无新增部件，可查看全部23项")).toBeVisible();
  await directory.getByRole("button", { name: "天地盘加临" }).click();
  expect(await directory.locator(".artifact-part-directory__scroll").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const firstVisibleEntry = directory.locator("button[data-part-id]:visible").first();
  expect(await firstVisibleEntry.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await firstVisibleEntry.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await directory.locator('button[data-part-id="plate/heaven"]').click();
  await expect(directory).toHaveCount(0);
  const focusStatus = page.getByText("当前聚焦：月将环");
  await expect(focusStatus).toBeVisible();
  const focusStatusWidth = await focusStatus.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(focusStatusWidth.client).toBeGreaterThanOrEqual(focusStatusWidth.scroll);
  await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await tools.getByRole("button", { name: "文字课式" }).click();
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});

test("mode controls stay outside the artifact frame and visible annotation cards", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await completeReferenceCourse(page);
  await expectArtifactReady(page);

  const toolbar = page.getByRole("toolbar", { name: "课式视图" });
  const frame = page.locator(".course-workbench__stage");
  const viewport = page.locator(".artifact-experience__viewport");
  const canvas = page.getByLabel("大六壬三维器物");
  const [toolbarBounds, frameBounds, viewportBounds, canvasBounds] = await Promise.all([
    toolbar.boundingBox(),
    frame.boundingBox(),
    viewport.boundingBox(),
    canvas.boundingBox(),
  ]);
  expect(toolbarBounds).not.toBeNull();
  expect(frameBounds).not.toBeNull();
  expect(viewportBounds).not.toBeNull();
  expect(canvasBounds).not.toBeNull();
  expect(toolbarBounds!.y + toolbarBounds!.height).toBeLessThanOrEqual(viewportBounds!.y + 1);
  expect(canvasBounds!.y).toBeGreaterThanOrEqual(frameBounds!.y);
  expect(canvasBounds!.y + canvasBounds!.height).toBeLessThanOrEqual(frameBounds!.y + frameBounds!.height + 1);

  const visibleCards = page.locator(".artifact-annotations__card:visible");
  await expect(visibleCards.first()).toBeVisible();
  const visibleCardCount = await visibleCards.count();
  expect(visibleCardCount).toBeGreaterThanOrEqual(3);
  expect(visibleCardCount).toBeLessThanOrEqual(6);
  const cardBounds = await visibleCards.evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }));
  for (const card of cardBounds) {
    const overlapsToolbar = toolbarBounds!.x < card.x + card.width
      && toolbarBounds!.x + toolbarBounds!.width > card.x
      && toolbarBounds!.y < card.y + card.height
      && toolbarBounds!.y + toolbarBounds!.height > card.y;
    expect(overlapsToolbar).toBe(false);
  }
});

test("repeated text round trips keep one usable canvas without KTX2 loader warnings", async ({ page }) => {
  test.setTimeout(120_000);
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await completeReferenceCourse(page);
  await expectArtifactReady(page);

  const modes = page.getByRole("toolbar", { name: "课式视图" });
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await modes.getByRole("button", { name: "文字课式" }).click();
    await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
    await modes.getByRole("button", { name: "三维推演" }).click();
    await expectArtifactReady(page);
    await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  }

  expect(warnings.filter((message) => message.includes("Multiple active KTX2 loaders"))).toEqual([]);
});

test("the settled canvas is byte-stable across a 30-second idle hold", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const lodResponse = page.waitForResponse(/daliuren-artifact-lod1\.glb$/);
  await completeReferenceCourse(page);
  expect((await lodResponse).ok()).toBe(true);
  await expectArtifactCanvasReady(page);
  const timeline = await expectArtifactReady(page);
  await timeline.fill("27000");
  await expect(timeline).toHaveValue("27000");
  await expectMinimumBranchProjection(page, testInfo, 1, 15);

  const before = await captureArtifactCanvas(page);
  await expectVisibleRuntimeLod(page, testInfo, 1, before);
  await page.waitForTimeout(30_000);
  const after = await captureArtifactCanvas(page);

  expect(after.equals(before)).toBe(true);
});

test("a GLB 404 falls back to the existing text course", async ({ page }) => {
  await page.route("**/models/daliuren/daliuren-artifact-lod*.glb", (route) => route.fulfill({ status: 404 }));
  await completeReferenceCourse(page);
  await expectTextFallback(page);
});

test("WebGL context loss falls back to the existing text course", async ({ page }) => {
  await completeReferenceCourse(page);
  const canvas = page.getByLabel("大六壬三维器物");
  await expectArtifactReady(page);
  const canceled = await canvas.evaluate((element) => {
    const event = new Event("webglcontextlost", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(canceled).toBe(true);
  await expectTextFallback(page);
});
