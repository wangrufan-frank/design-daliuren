import { expect, test, type Page } from "@playwright/test";

const EXPECTED_REFERENCE_TEXT = [
  "大六壬标准课式",
  "时间：2024-02-10T14:30:00",
  "事由：商务决策复盘",
  "地点：北京",
  "农历：二〇二四年正月初一",
  "四柱：甲辰　丙寅　甲辰　辛未",
  "月建：寅",
  "月将：神后（子）　占时：未",
  "",
  "三传取法：涉害",
  "初传：螣蛇　子　父母",
  "中传：太常　巳　子孙",
  "末传：六合　戌　妻财",
  "",
  "四课",
  "四课：天后　上神寅　下神酉",
  "三课：勾陈　上神酉　下神辰",
  "二课：螣蛇　上神子　下神未",
  "一课：天空　上神未　下神甲",
  "",
  "十二宫",
  "巳宫：六合　天盘戌　地盘巳",
  "午宫：朱雀　天盘亥　地盘午",
  "未宫：螣蛇　天盘子　地盘未",
  "申宫：贵人　天盘丑　地盘申",
  "酉宫：天后　天盘寅　地盘酉",
  "戌宫：太阴　天盘卯　地盘戌",
  "亥宫：玄武　天盘辰　地盘亥",
  "子宫：太常　天盘巳　地盘子",
  "丑宫：白虎　天盘午　地盘丑",
  "寅宫：天空　天盘未　地盘寅",
  "卯宫：青龙　天盘申　地盘卯",
  "辰宫：勾陈　天盘酉　地盘辰",
  "",
  "贵人：昼贵丑　落申宫　逆布",
].join("\n");

async function submitReferenceCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
  const mobileTools = page.getByRole("toolbar", { name: "工作台工具" });
  if (await mobileTools.count()) {
    await mobileTools.getByRole("button", { name: "文字课式", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "文字课式", exact: true }).click();
  }
}

test("renders, copies, and navigates the completed standard course", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  await expect(page.getByTestId("course-transmission")).toHaveCount(3);
  await expect(page.getByTestId("course-lesson")).toHaveCount(4);
  await expect(page.getByRole("list", { name: "标准课式十二宫方盘" }).locator(":scope > li")).toHaveCount(12);
  await page.getByRole("button", { name: "复制课式" }).click();
  await expect(page.getByRole("status")).toHaveText("课式已复制");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"))
    .toBe(EXPECTED_REFERENCE_TEXT);
  await page.getByRole("button", { name: "天将排列，已完成" }).click();
  await page.getByRole("button", { name: "查看阶段证据" }).click();
  await expect(page.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await page.getByRole("button", { name: "复制结课，已完成" }).click();
  await page.getByRole("button", { name: "文字课式", exact: true }).click();
  await expect(page.locator(".course-experience__stage").getByRole("article", { name: "标准文字课式" })).toBeVisible();
});

test("390x844 preserves approved order, hierarchy, and square without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitReferenceCourse(page);
  const mobilePanel = page.getByRole("region", { name: "移动工具面板" });
  expect(await mobilePanel.locator("[data-course-section]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-course-section"))))
    .toEqual(["summary", "transmissions", "lessons", "palaces", "copy"]);
  const plate = page.getByRole("list", { name: "标准课式十二宫方盘" });
  await expect(plate).toHaveCSS("grid-template-columns", /.+ .+ .+ .+/);
  const dimensions = await plate.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
  }));
  expect(dimensions.height).toBeCloseTo(dimensions.width, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("derives and copies the complete course after the app goes offline", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await context.setOffline(true);
  await submitReferenceCourse(page);
  await expect(page.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  await page.getByRole("button", { name: "复制课式" }).click();
  await expect(page.getByRole("status")).toHaveText("课式已复制");
});
