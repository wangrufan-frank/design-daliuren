import { expect, test, type Page } from "@playwright/test";

async function completeReferenceCourse(page: Page) {
  await page.goto("/");
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
}

async function expectTextFallback(page: Page) {
  await expect(page.getByRole("alert")).toContainText("三维器物无法加载");
  await page.getByRole("button", { name: "查看文字课式" }).click();
  await expect(page.getByLabel("标准文字课式")).toContainText("初传");
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

test("model labels and text course use the same verified facts", async ({ page }) => {
  await completeReferenceCourse(page);
  await expect(page.getByLabel("大六壬三维器物")).toBeVisible();
  await expectArtifactReady(page);
  const facts = page.getByTestId("artifact-accessible-facts");
  await expect(facts).toContainText("初传");
  await expect(facts).toContainText("贵人");
  await expect(facts).toContainText("月将 神后子");
  await expect(facts).toContainText("四课 天后 寅/酉；查地盘 酉");
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

test("absolute seeking is repeatable and a real pointer drag disables auto camera", async ({ page }) => {
  await completeReferenceCourse(page);
  const experience = page.getByTestId("artifact-experience");
  const timeline = await expectArtifactReady(page);

  await timeline.fill("8450");
  await expect(experience).toHaveAttribute("data-pose-hash", /\S+/);
  const firstPoseHash = await experience.getAttribute("data-pose-hash");
  await timeline.fill("0");
  await timeline.fill("8450");
  await expect(experience).toHaveAttribute("data-pose-hash", firstPoseHash!);
  await timeline.fill("11400");
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
  await page.getByRole("slider", { name: "推演时间轴" }).fill("11400");
  await expect(experience).toHaveAttribute("data-source-lines", "disabled");
});

test("mobile review keeps stage callouts and reaches every part through the directory", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeReferenceCourse(page);
  await expectArtifactCanvasReady(page);

  const callouts = page.locator(".artifact-annotations__card");
  const calloutCount = await callouts.count();
  expect(calloutCount).toBeGreaterThanOrEqual(3);
  expect(calloutCount).toBeLessThanOrEqual(6);
  await expect(page.getByRole("button", { name: "全部" })).toHaveCount(0);

  const tools = page.getByRole("toolbar", { name: "工作台工具" });
  await tools.getByRole("button", { name: "部件", exact: true }).click();
  const toolPanel = page.getByRole("region", { name: "移动工具面板" });
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
