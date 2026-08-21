import { expect, test, type Page } from "@playwright/test";

async function completeReferenceCourse(page: Page) {
  await page.goto("/");
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

async function expectTextFallback(page: Page) {
  await expect(page.getByRole("alert")).toContainText("三维器物无法加载");
  await page.getByRole("button", { name: "查看文字课式" }).click();
  await expect(page.getByLabel("标准文字课式")).toContainText("初传");
  await expect(page.getByRole("button", { name: "复制课式" })).toBeEnabled();
}

async function expectArtifactReady(page: Page) {
  const timeline = page.getByRole("slider", { name: "推演时间轴" });
  await expect(timeline).toBeVisible({ timeout: 15_000 });
  return timeline;
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
