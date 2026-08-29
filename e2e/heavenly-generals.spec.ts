import { expect, test, type Page } from "@playwright/test";

async function submitReferenceCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
}

test("reviews heavenly generals and returns to upstream evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await page.getByRole("button", { name: /天将排列，已完成/ }).click();
  await page.getByRole("button", { name: "查看阶段证据" }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await expect(page.getByRole("list", { name: "十二天将方盘" }).locator(":scope > li")).toHaveCount(12);
  await expect(page.getByText("待天将加临")).toHaveCount(0);
  await page.getByRole("button", { name: /宫.*贵人/ }).click();
  await expect(page.getByRole("heading", { name: /宫布将证据/ })).toBeVisible();
  await page.getByRole("button", { name: "查看三传" }).click();
  await expect(page.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  await page.getByRole("button", { name: /天将排列，已完成/ }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
});

test("390x844 preserves approved order and has no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await page.getByRole("button", { name: /天将排列，已完成/ }).click();
  await page.getByRole("toolbar", { name: "工作台工具" })
    .getByRole("button", { name: "阶段证据" }).click();
  const order = await page.locator("[data-heavenly-generals-section]").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("data-heavenly-generals-section")),
  );
  expect(order).toEqual(["summary", "plate", "four-lessons", "three-transmissions", "evidence"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("derives the complete review after the loaded app goes offline", async ({ context, page }) => {
  await page.goto("/");
  await context.setOffline(true);
  await submitReferenceCourse(page);
  await page.getByRole("button", { name: /天将排列，已完成/ }).click();
  await page.getByRole("button", { name: "查看阶段证据" }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await expect(page.getByRole("list", { name: "十二天将方盘" }).locator(":scope > li")).toHaveCount(12);
});
