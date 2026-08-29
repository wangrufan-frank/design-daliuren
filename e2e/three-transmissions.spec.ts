import { expect, test, type Locator, type Page } from "@playwright/test";

async function submitReferenceCourse(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
}

async function expectVerticalTransmissionOrder(list: Locator) {
  const items = list.locator(":scope > li");
  await expect(items).toHaveCount(3);
  const layout = await items.evaluateAll((elements) => elements.map((element) => {
    const button = element.querySelector<HTMLButtonElement>("[data-transmission]");
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      position: button?.dataset.transmission,
      top: bounds.top,
    };
  }));

  expect(layout.map(({ position }) => position)).toEqual(["initial", "middle", "final"]);
  expect(layout[1].top).toBeGreaterThanOrEqual(layout[0].bottom);
  expect(layout[2].top).toBeGreaterThanOrEqual(layout[1].bottom);
}

test("reviews three transmissions and returns to its upstream evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await page.getByRole("button", { name: /三传取法，已完成/ }).click();
  await page.getByRole("button", { name: "查看阶段证据" }).click();

  await expect(page.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  const transmissions = page.getByRole("list", { name: "三传" });
  await expectVerticalTransmissionOrder(transmissions);

  await transmissions.getByRole("button", { name: /中传/ }).click();
  await expect(page.getByRole("heading", { name: "中传证据" })).toBeVisible();
  await page.getByRole("button", { name: "查看四课" }).click();
  await expect(page.getByRole("region", { name: "四课生成" })).toBeVisible();

  await page.getByRole("button", { name: "三传取法，已完成" }).click();
  await page.getByRole("button", { name: "查看天地盘" }).click();
  await expect(page.getByRole("region", { name: "天地盘加临" })).toBeVisible();
});

test("390x844 keeps the vertical transmission order without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitReferenceCourse(page);
  await page.getByRole("button", { name: /三传取法，已完成/ }).click();
  await page.getByRole("toolbar", { name: "工作台工具" })
    .getByRole("button", { name: "阶段证据" }).click();

  const transmissions = page.getByRole("list", { name: "三传" });
  await expectVerticalTransmissionOrder(transmissions);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
