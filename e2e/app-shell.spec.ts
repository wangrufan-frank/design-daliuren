import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const VISUALS_DIRECTORY = path.resolve(
  ".superpowers/sdd/2026-08-15-calendar-month-general/visuals",
);

async function calculateCalendar(page: Page) {
  // Chromium canonicalizes zero seconds out of datetime-local values; the schema restores :00.
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
  await expect(page.getByRole("list", { name: "历法结果矩阵" })).toBeVisible();
  await expect(page.locator(".calendar-review__time-band").getByText("2024-02-10T14:30:00", { exact: true })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({
    clientWidth: page.viewportSize()!.width,
    scrollWidth: page.viewportSize()!.width,
  });
}

async function expectNoUnimplementedResult(page: Page) {
  await expect(page.locator(".course-sheet")).toHaveCount(0);
  await expect(page.getByLabel("标准文字课式")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText(/三维模型占位|3D placeholder/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /批准|审核通过/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /天地盘加临|四课生成|三传取法|天将排列/ })).toHaveCount(0);
}

async function expectContrastAtLeast(element: Locator, minimum: number) {
  const colors = await element.evaluate((node) => {
    type Rgba = { red: number; green: number; blue: number; alpha: number };

    function clamp(value: number, maximum = 1) {
      return Math.min(maximum, Math.max(0, value));
    }

    function parseCssColor(value: string): Rgba {
      const color = value.trim().toLowerCase();
      if (color === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

      const hex = color.match(/^#([\da-f]{3,8})$/i)?.[1];
      if (hex) {
        const expanded = hex.length <= 4 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
        return {
          red: Number.parseInt(expanded.slice(0, 2), 16) / 255,
          green: Number.parseInt(expanded.slice(2, 4), 16) / 255,
          blue: Number.parseInt(expanded.slice(4, 6), 16) / 255,
          alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
        };
      }

      const functional = color.match(/^rgba?\((.*)\)$/i)?.[1];
      if (!functional) throw new Error(`Unsupported computed CSS color: ${value}`);
      const [channelsPart, slashAlpha] = functional.split(/\s*\/\s*/);
      const parts = channelsPart.includes(",")
        ? channelsPart.split(/\s*,\s*/)
        : channelsPart.trim().split(/\s+/);
      const alphaPart = slashAlpha ?? parts[3];
      const channel = (part: string) => clamp(
        part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part) / 255,
      );
      const alpha = alphaPart === undefined
        ? 1
        : clamp(alphaPart.endsWith("%") ? Number.parseFloat(alphaPart) / 100 : Number.parseFloat(alphaPart));
      if (parts.length < 3 || [parts[0], parts[1], parts[2], alphaPart ?? "1"].some((part) => Number.isNaN(Number.parseFloat(part)))) {
        throw new Error(`Invalid computed CSS color: ${value}`);
      }
      return { red: channel(parts[0]), green: channel(parts[1]), blue: channel(parts[2]), alpha };
    }

    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
      if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
      return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
        blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
      };
    }

    function luminance(color: Rgba) {
      const linear = (channel: number) => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
      return 0.2126 * linear(color.red) + 0.7152 * linear(color.green) + 0.0722 * linear(color.blue);
    }

    const computedForeground = getComputedStyle(node).color;
    let background = { red: 0, green: 0, blue: 0, alpha: 0 };
    for (let current: Element | null = node; current; current = current.parentElement) {
      background = composite(background, parseCssColor(getComputedStyle(current).backgroundColor));
      if (background.alpha >= 0.999) break;
    }
    if (background.alpha < 0.999) {
      background = composite(background, { red: 1, green: 1, blue: 1, alpha: 1 });
    }
    const foreground = composite(parseCssColor(computedForeground), background);
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);

    return {
      background: getComputedStyle(node).backgroundColor,
      computedForeground,
      ratio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
    };
  });

  expect(colors.ratio, JSON.stringify(colors)).toBeGreaterThanOrEqual(minimum);
}

async function expectVisibleControlsKeyboardReachable(page: Page) {
  const selector = "button, input, select";
  const expectedIndexes = await page.locator(selector).evaluateAll((elements) => elements.flatMap(
    (element, index) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
      ? [index]
      : [],
  ));

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });

  const reachedIndexes: number[] = [];
  for (let press = 0; press < expectedIndexes.length * 4 && reachedIndexes.length < expectedIndexes.length; press += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate((controlSelector) => {
      const activeElement = document.activeElement as HTMLElement;
      const style = getComputedStyle(activeElement);
      const alphaMatch = style.outlineColor.match(/^rgba\(.*?,\s*([\d.]+)\s*\)$/i)
        ?? style.outlineColor.match(/^rgb\(.*?\/\s*([\d.]+%?)\s*\)$/i);
      const outlineAlpha = style.outlineColor === "transparent"
        ? 0
        : alphaMatch
          ? alphaMatch[1].endsWith("%") ? Number.parseFloat(alphaMatch[1]) / 100 : Number.parseFloat(alphaMatch[1])
          : 1;
      return {
        index: [...document.querySelectorAll(controlSelector)].indexOf(activeElement),
        outlineAlpha,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        tagName: activeElement?.tagName,
        text: activeElement?.textContent?.trim(),
      };
    }, selector);

    if (!expectedIndexes.includes(focused.index)) continue;
    expect(focused.outlineStyle, JSON.stringify(focused)).not.toBe("none");
    expect(focused.outlineWidth, JSON.stringify(focused)).toBeGreaterThan(0);
    expect(focused.outlineAlpha, JSON.stringify(focused)).toBeGreaterThan(0);
    if (!reachedIndexes.includes(focused.index)) {
      expect(focused.index, JSON.stringify(focused)).toBe(expectedIndexes[reachedIndexes.length]);
      reachedIndexes.push(focused.index);
    }
  }

  expect(reachedIndexes).toEqual(expectedIndexes);
  return expectedIndexes.length;
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} shell is readable without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    expect(page.viewportSize()).toEqual({ width: viewport.width, height: viewport.height });
    expect(await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({
      width: viewport.width,
      height: viewport.height,
    });
    await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test(`${viewport.name} real calendar flow remains complete after going offline`, async ({ context, page }) => {
    const requestUrls: string[] = [];
    const offlineRequestUrls: string[] = [];
    let isOffline = false;
    context.on("request", (request) => {
      requestUrls.push(request.url());
      if (isOffline) offlineRequestUrls.push(request.url());
    });

    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    isOffline = true;
    await context.setOffline(true);

    await calculateCalendar(page);
    const matrix = page.getByRole("list", { name: "历法结果矩阵" });
    await expect(matrix.locator(":scope > li")).toHaveCount(8);
    await expectNoHorizontalOverflow(page);
    await expectNoUnimplementedResult(page);

    const automaticDay = matrix.getByRole("button", {
      name: /日柱，自动 甲辰，有效 甲辰，自动计算/,
    });
    await automaticDay.click();
    await page.getByRole("combobox", { name: "修正日柱" }).selectOption("乙巳");

    const manualDay = matrix.getByRole("button", {
      name: /日柱，自动 甲辰，有效 乙巳，人工修正/,
    });
    await expect(manualDay.getByText("自动：甲辰", { exact: true })).toBeVisible();
    await expect(manualDay.getByText("有效：乙巳", { exact: true })).toBeVisible();
    await expect(manualDay.getByText("人工修正", { exact: true })).toBeVisible();
    await expectContrastAtLeast(manualDay.locator("strong"), 4.5);

    if (process.env.CAPTURE_CALENDAR_VISUALS === "1") {
      mkdirSync(VISUALS_DIRECTORY, { recursive: true });
      await page.screenshot({
        fullPage: true,
        path: path.join(VISUALS_DIRECTORY, `calendar-review-${viewport.name}.png`),
      });
    }

    await page.getByRole("button", { name: "恢复日柱自动值" }).click();
    await expect(matrix.getByRole("button", {
      name: /日柱，自动 甲辰，有效 甲辰，自动计算/,
    })).toBeVisible();
    await expect(page.getByRole("button", { name: "恢复日柱自动值" })).toHaveCount(0);

    const nonLocalRequests = requestUrls.filter((url) => {
      const target = new URL(url);
      return ["http:", "https:", "ws:", "wss:"].includes(target.protocol)
        && !["127.0.0.1", "localhost", "::1"].includes(target.hostname);
    });
    expect(nonLocalRequests).toEqual([]);
    expect(offlineRequestUrls).toEqual([]);

    if (viewport.name === "mobile") {
      const mainRegion = page.locator(".calendar-review__main");
      const evidence = page.locator("#calendar-evidence");
      const flow = await mainRegion.evaluate((main, evidenceElement) => {
        const aside = evidenceElement as HTMLElement;
        const mainBounds = main.getBoundingClientRect();
        const evidenceBounds = aside.getBoundingClientRect();
        return {
          followsMain: Boolean(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING),
          mainBottom: mainBounds.bottom,
          evidenceTop: evidenceBounds.top,
          position: getComputedStyle(aside).position,
        };
      }, await evidence.elementHandle());
      expect(flow.followsMain).toBe(true);
      expect(flow.evidenceTop).toBeGreaterThanOrEqual(flow.mainBottom - 1);
      expect(flow.position).not.toMatch(/fixed|sticky/);
    }
  });

  test(`${viewport.name} keyboard users reach the matrix, correction, and reset controls in document order`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await calculateCalendar(page);

    await page.getByRole("button", { name: /日柱，自动 甲辰/ }).click();
    const automaticControlCount = await expectVisibleControlsKeyboardReachable(page);

    await page.getByRole("combobox", { name: "修正日柱" }).selectOption("乙巳");
    const reset = page.getByRole("button", { name: "恢复日柱自动值" });
    await expect(reset).toBeVisible();
    const manualControlCount = await expectVisibleControlsKeyboardReachable(page);
    expect(manualControlCount).toBe(automaticControlCount + 1);

    if (viewport.name === "mobile") {
      const evidence = page.locator("#calendar-evidence");
      await reset.focus();
      await page.keyboard.press("Tab");
      expect(await evidence.evaluate((aside) => !aside.contains(document.activeElement))).toBe(true);
      await expect(page.getByRole("button", { name: "推演依据" })).toBeFocused();
    }
  });

  test(`${viewport.name} pointer focus does not show the keyboard focus ring`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const inputToggle = page.getByRole("button", { name: "起课输入" });
    await inputToggle.click();
    expect(await inputToggle.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  });
}
