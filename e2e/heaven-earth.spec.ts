import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const EXPECTED_PALACES = [
  { earth: "巳", heaven: "戌" },
  { earth: "午", heaven: "亥" },
  { earth: "未", heaven: "子" },
  { earth: "申", heaven: "丑" },
  { earth: "酉", heaven: "寅" },
  { earth: "戌", heaven: "卯" },
  { earth: "亥", heaven: "辰" },
  { earth: "子", heaven: "巳" },
  { earth: "丑", heaven: "午" },
  { earth: "寅", heaven: "未" },
  { earth: "卯", heaven: "申" },
  { earth: "辰", heaven: "酉" },
] as const;

async function submitOrdinaryInput(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(page.viewportSize()!.width);
}

function isNonLocalNetworkUrl(url: string) {
  const target = new URL(url);
  return ["http:", "https:", "ws:", "wss:"].includes(target.protocol)
    && !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname);
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} reviews every derived palace offline and rebuilds after a calendar correction`, async ({ context, page }) => {
    const requestUrls: string[] = [];
    const offlineRequestUrls: string[] = [];
    const websocketUrls: string[] = [];
    const offlineWebsocketUrls: string[] = [];
    const offlineSentFrames: Array<{ payload: string | Buffer; url: string }> = [];
    let isOffline = false;

    context.on("request", (request) => {
      requestUrls.push(request.url());
      if (isOffline) offlineRequestUrls.push(request.url());
    });
    page.on("websocket", (websocket) => {
      websocketUrls.push(websocket.url());
      if (isOffline) offlineWebsocketUrls.push(websocket.url());
      websocket.on("framesent", ({ payload }) => {
        if (isOffline) offlineSentFrames.push({ payload, url: websocket.url() });
      });
    });

    await page.setViewportSize(viewport);
    await page.goto("/");
    await context.setOffline(true);
    isOffline = true;
    await submitOrdinaryInput(page);
    await page.getByRole("button", { name: "天地盘加临，已完成" }).click();

    const review = page.getByRole("region", { name: "天地盘加临" });
    const plate = review.getByRole("list", { name: "天地盘十二宫" });
    const palaces = plate.getByRole("button");
    await expect(palaces).toHaveCount(12);
    await expect(plate.getByRole("button", { name: /天盘子加临地盘未/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const header = review.locator(".heaven-earth-review__header");
    await expect(header.getByText("神后（子）· 自动计算", { exact: true })).toBeVisible();
    await expect(header.getByText("未 · 自动计算", { exact: true })).toBeVisible();
    const markedPalace = plate.getByRole("button", { name: "天盘子加临地盘未，占时宫" });
    await expect(markedPalace.getByText("月将", { exact: true })).toBeVisible();
    await expect(markedPalace.getByText("占时", { exact: true })).toBeVisible();

    for (const [index, { earth, heaven }] of EXPECTED_PALACES.entries()) {
      const palace = palaces.nth(index);
      await expect(palace).toHaveAttribute("data-earth", earth);
      await expect(palace).toHaveAccessibleName(
        `天盘${heaven}加临地盘${earth}${earth === "未" ? "，占时宫" : ""}`,
      );

      await palace.click();
      const evidence = page.getByRole("complementary", { name: `${earth}宫证据` });
      await expect(evidence.locator("ol > li")).toHaveCount(1);
      await expect(evidence.getByText("heaven-earth/month-general-over-hour-v1", { exact: true })).toBeVisible();
      await expect(evidence.getByText(`天盘${heaven}加临地盘${earth}`, { exact: true })).toBeVisible();
    }

    await palaces.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(palaces.last()).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(palaces.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(palaces.nth(1)).toBeFocused();

    await page.getByRole("button", { name: "历法与月将，已完成" }).click();
    const matrix = page.getByRole("list", { name: "历法结果矩阵" });
    await expect(matrix).toBeVisible();
    await matrix.getByRole("button", { name: /月将，自动 神后（子），有效 神后（子），自动计算/ }).click();
    await page.getByRole("combobox", { name: "修正月将" }).selectOption("亥");
    await page.getByRole("button", { name: "天地盘加临，已完成" }).click();

    const rebuiltPlate = page.getByRole("list", { name: "天地盘十二宫" });
    await expect(rebuiltPlate.getByRole("button", { name: /天盘亥加临地盘未/ })).toBeVisible();
    await expect(page.locator(".heaven-earth-review__header").getByText("登明（亥）· 人工修正", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "天地盘加临，已完成" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalOverflow(page);

    expect(requestUrls.filter(isNonLocalNetworkUrl)).toEqual([]);
    expect(offlineRequestUrls).toEqual([]);
    expect(websocketUrls.filter(isNonLocalNetworkUrl)).toEqual([]);
    expect({ offlineSentFrames, offlineWebsocketUrls }).toEqual({
      offlineSentFrames: [],
      offlineWebsocketUrls: [],
    });
  });
}

test("mobile fallback keeps all twelve palace comparisons on two stacked lines and restores close focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await submitOrdinaryInput(page);
  await page.getByRole("button", { name: "天地盘加临，已完成" }).click();

  const fallback = page.getByRole("list", { name: "十二宫文字对照" });
  const records = fallback.getByRole("listitem");
  await expect(records).toHaveCount(12);
  await expect(fallback).toBeVisible();

  const layouts = await records.evaluateAll((items) => items.map((item) => {
    const lines = item.querySelectorAll(":scope > p");
    const first = lines[0]?.getBoundingClientRect();
    const second = lines[1]?.getBoundingClientRect();
    return {
      display: getComputedStyle(item).display,
      firstText: lines[0]?.textContent?.trim(),
      lineCount: lines.length,
      secondText: lines[1]?.textContent?.trim(),
      stacked: Boolean(first && second && second.top >= first.bottom),
    };
  }));
  expect(layouts).toHaveLength(12);
  for (const [index, layout] of layouts.entries()) {
    const palace = EXPECTED_PALACES[index];
    expect(layout).toMatchObject({ display: "grid", lineCount: 2, stacked: true });
    expect(layout.firstText).toBe(`天盘 ${palace.heaven}`);
    expect(layout.secondText).toBe(`地盘 ${palace.earth}`);
  }

  const palace = page.getByRole("list", { name: "天地盘十二宫" }).getByRole("button", { name: /天盘戌加临地盘巳/ });
  await palace.click();
  await page.getByRole("button", { name: "关闭证据" }).click();
  await expect(palace).toBeFocused();
  await expect(page.locator("#heaven-earth-evidence")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("completed-stage rail buttons reset native chrome and expose hover and keyboard focus treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await submitOrdinaryInput(page);
  await page.getByRole("button", { name: "天地盘加临，已完成" }).click();

  const rail = page.getByRole("list", { name: "传统规则阶段" });
  const stageButtons = rail.getByRole("button");
  await expect(stageButtons).toHaveCount(3);

  const resetStyles = await stageButtons.evaluateAll((buttons) => buttons.map((button) => {
    const style = getComputedStyle(button);
    const parentStyle = getComputedStyle(button.parentElement!);
    const parentContentWidth = button.parentElement!.getBoundingClientRect().width
      - Number.parseFloat(parentStyle.paddingLeft)
      - Number.parseFloat(parentStyle.paddingRight);
    return {
      appearance: style.appearance,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
      cursor: style.cursor,
      fontFamilyMatchesParent: style.fontFamily === parentStyle.fontFamily,
      fontSizeMatchesParent: style.fontSize === parentStyle.fontSize,
      margin: style.margin,
      padding: style.padding,
      textAlign: style.textAlign,
      widthMatchesParent: Math.abs(button.getBoundingClientRect().width - parentContentWidth) < 0.1,
    };
  }));
  for (const style of resetStyles) {
    expect(style).toEqual({
      appearance: "none",
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderRadius: "0px",
      borderWidth: "0px",
      cursor: "pointer",
      fontFamilyMatchesParent: true,
      fontSizeMatchesParent: true,
      margin: "0px",
      padding: "0px",
      textAlign: "left",
      widthMatchesParent: true,
    });
  }

  for (let index = 0; index < 3; index += 1) {
    const button = stageButtons.nth(index);
    const restingColor = await button.evaluate((element) => getComputedStyle(element).color);
    await button.hover();
    const hovered = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, decoration: style.textDecorationLine };
    });
    expect(hovered.color).not.toBe(restingColor);
    expect(hovered.decoration).toContain("underline");
  }

  await page.getByRole("button", { name: "推演依据" }).focus();
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press("Tab");
    const button = stageButtons.nth(index);
    await expect(button).toBeFocused();
    const focused = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        decoration: style.textDecorationLine,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focused.decoration).toContain("underline");
    expect(focused.outlineStyle).not.toBe("none");
    expect(focused.outlineWidth).toBeGreaterThan(0);
  }
});
