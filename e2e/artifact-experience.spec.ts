import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function completeReferenceCourse(page: Page) {
  await page.goto("/");
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
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
  expect(metrics.percentileRange).toBeGreaterThan(0.12);
  expect(metrics.nearBlackFraction).toBeLessThan(0.18);
  expect(
    Math.min(...Object.values(metrics.subjectMarginsCss)),
    `Artifact subject margins: ${JSON.stringify(metrics.subjectMarginsCss)}; branch frame: ${JSON.stringify(branchFrame)}`,
  ).toBeGreaterThanOrEqual(4);
}

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
  await expectMinimumBranchProjection(page, testInfo, 0, 20);
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
  await expectMinimumBranchProjection(page, testInfo, 2, 18);
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
  await expect(entries).toHaveCount(22);
  await expect(directory.getByText("无新增部件，可查看全部22项")).toBeVisible();
  await directory.getByRole("button", { name: "天地盘加临" }).click();
  expect(await directory.locator(".artifact-part-directory__scroll").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const firstVisibleEntry = directory.locator("button[data-part-id]:visible").first();
  expect(await firstVisibleEntry.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await firstVisibleEntry.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await directory.locator('button[data-part-id="plate/heaven"]').click();
  await expect(directory).toHaveCount(0);
  const focusStatus = page.getByText("当前聚焦：天盘");
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
  await expectMinimumBranchProjection(page, testInfo, 1, 20);

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
