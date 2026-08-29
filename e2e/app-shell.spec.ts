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

async function generateCourse(page: Page) {
  // Chromium canonicalizes zero seconds out of datetime-local values; the schema restores :00.
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
  await expect(page.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
}

async function calculateCalendar(page: Page) {
  await generateCourse(page);
  await page.getByRole("button", { name: "天地盘加临，已完成" }).click();
  const mobileTools = page.getByRole("toolbar", { name: "工作台工具" });
  if (await mobileTools.count()) {
    await mobileTools.getByRole("button", { name: "阶段证据" }).click();
  } else {
    await page.getByRole("button", { name: "查看阶段证据" }).click();
  }
  await expect(page.getByRole("list", { name: "天地盘十二宫" })).toBeVisible();
  await returnToCalendar(page);
  await expect(page.locator(".calendar-review__time-band").getByText("2024-02-10T14:30:00", { exact: true })).toBeVisible();
}

async function returnToCalendar(page: Page) {
  await page.getByRole("button", { name: "历法与月将，已完成" }).click();
  await expect(page.getByRole("list", { name: "历法结果矩阵" })).toBeVisible();
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

function isNonLocalNetworkUrl(url: string) {
  const target = new URL(url);
  return ["http:", "https:", "ws:", "wss:"].includes(target.protocol)
    && !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname);
}

function isArtifactAssetUrl(url: string) {
  return /^\/models\/daliuren\/daliuren-artifact-lod[0-2]\.glb$/.test(new URL(url).pathname);
}

async function expectNoUnimplementedResult(page: Page) {
  const stage = page.locator(".app-stage");
  const downstreamName = /四课生成|三传取法|天将排列|复制结课/;
  await expect(stage.locator([
    ".course-sheet",
    "[aria-label='标准文字课式']",
    "[data-course-result]",
    "[data-downstream-result]",
    "canvas",
  ].join(", "))).toHaveCount(0);
  await expect(stage.getByRole("heading", { name: downstreamName })).toHaveCount(0);
  await expect(stage.getByText(/标准文字课式|四课生成|三传取法|天将排列|复制结课|三维模型占位|3D placeholder/i)).toHaveCount(0);
  await expect(stage.getByRole("button", { name: /批准|审核通过/ })).toHaveCount(0);
}

function inspectComputedColors(node: Element, options?: { activeElement?: boolean }) {
  type Rgba = { red: number; green: number; blue: number; alpha: number };

  function clamp(value: number) {
    return Math.min(1, Math.max(0, value));
  }

  function numericToken(value: string, label: string) {
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) {
      throw new Error(`Invalid ${label} in computed CSS color: ${value}`);
    }
    return Number.parseFloat(value);
  }

  function parseAlpha(value: string | undefined) {
    if (value === undefined) return 1;
    const parsed = numericToken(value, "alpha");
    return clamp(value.endsWith("%") ? parsed / 100 : parsed);
  }

  function parseCssColor(value: string): Rgba {
    const color = value.trim().toLowerCase();
    if (color === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

    const hex = color.match(/^#([\da-f]+)$/i)?.[1];
    if (hex) {
      if (![3, 4, 6, 8].includes(hex.length)) {
        throw new Error(`Invalid computed hex CSS color: ${value}`);
      }
      const expanded = hex.length <= 4 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
      return {
        red: Number.parseInt(expanded.slice(0, 2), 16) / 255,
        green: Number.parseInt(expanded.slice(2, 4), 16) / 255,
        blue: Number.parseInt(expanded.slice(4, 6), 16) / 255,
        alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      };
    }

    const functional = color.match(/^rgba?\((.*)\)$/i)?.[1];
    if (functional) {
      const [channelsPart, slashAlpha] = functional.split(/\s*\/\s*/);
      const parts = channelsPart.includes(",")
        ? channelsPart.split(/\s*,\s*/)
        : channelsPart.trim().split(/\s+/);
      if (parts.length < 3 || parts.length > 4) {
        throw new Error(`Invalid computed RGB CSS color: ${value}`);
      }
      const alphaPart = slashAlpha ?? parts[3];
      const channel = (part: string) => {
        const parsed = numericToken(part, "RGB channel");
        return clamp(part.endsWith("%") ? parsed / 100 : parsed / 255);
      };
      return {
        red: channel(parts[0]),
        green: channel(parts[1]),
        blue: channel(parts[2]),
        alpha: parseAlpha(alphaPart),
      };
    }

    const colorFunction = color.match(/^color\(\s*srgb\s+(.+)\)$/i)?.[1];
    if (colorFunction) {
      const [channelsPart, alphaPart] = colorFunction.split(/\s*\/\s*/);
      const parts = channelsPart.trim().split(/\s+/);
      if (parts.length !== 3) throw new Error(`Invalid computed color(srgb): ${value}`);
      const channel = (part: string) => {
        const parsed = numericToken(part, "sRGB channel");
        return clamp(part.endsWith("%") ? parsed / 100 : parsed);
      };
      return {
        red: channel(parts[0]),
        green: channel(parts[1]),
        blue: channel(parts[2]),
        alpha: parseAlpha(alphaPart),
      };
    }

    throw new Error(`Unsupported computed CSS color: ${value}`);
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

  const element = options?.activeElement ? document.activeElement : node;
  if (!(element instanceof Element)) throw new Error("Expected an active Element for computed color inspection");
  const style = getComputedStyle(element);
  let background = { red: 0, green: 0, blue: 0, alpha: 0 };
  for (let current: Element | null = element; current; current = current.parentElement) {
    background = composite(background, parseCssColor(getComputedStyle(current).backgroundColor));
    if (background.alpha >= 0.999) break;
  }
  if (background.alpha < 0.999) {
    background = composite(background, { red: 1, green: 1, blue: 1, alpha: 1 });
  }
  const foreground = composite(parseCssColor(style.color), background);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);

  return {
    background,
    computedForeground: style.color,
    contrastRatio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
      / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
    outlineAlpha: parseCssColor(style.outlineColor).alpha,
    outlineColor: style.outlineColor,
    outlineStyle: style.outlineStyle,
    outlineWidth: Number.parseFloat(style.outlineWidth),
    tagName: element.tagName,
    text: element.textContent?.trim(),
  };
}

async function expectContrastAtLeast(element: Locator, minimum: number) {
  const colors = await element.evaluate(inspectComputedColors);

  expect(colors.contrastRatio, JSON.stringify(colors)).toBeGreaterThanOrEqual(minimum);
}

async function expectVisibleControlsKeyboardReachable(page: Page) {
  const mobileWorkbench = Boolean(await page.getByRole("toolbar", { name: "工作台工具" }).count());
  if (mobileWorkbench) {
    await expect(page.getByLabel("大六壬三维器物")).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByRole("slider", { name: "推演时间轴" })).toBeVisible({ timeout: 15_000 });
  }
  const selector = [
    "a[href]", "area[href]", "button", "input", "select", "textarea", "summary", "[tabindex]",
    "[contenteditable]:not([contenteditable='false'])",
  ].join(", ");
  const tabbableSelector = `:is(${selector}):visible:not(:disabled):not([tabindex^='-'])`;
  const controls = page.locator(tabbableSelector);
  const controlCount = await controls.count();
  const reviewRegion = mobileWorkbench
    ? page.getByRole("region", { name: "移动工具面板" })
    : page.getByRole("region", { name: "阶段证据抽屉" });
  const reviewControlCount = await reviewRegion.locator(tabbableSelector).count();
  await controls.evaluateAll((elements) => {
    const records: Array<{
      controlIndex: number;
      outlineAlpha: number;
      outlineColor: string;
      outlineStyle: string;
      outlineWidth: number;
      tagName: string;
      text?: string;
    }> = [];
    const state = globalThis as typeof globalThis & {
      __keyboardOrderState?: { handler: (event: FocusEvent) => void; records: typeof records };
    };
    elements.forEach((element, index) => {
      (element as HTMLElement).dataset.keyboardOrderIndex = String(index);
    });
    const handler = (event: FocusEvent) => {
      const element = event.target;
      if (!(element instanceof HTMLElement) || element.dataset.keyboardOrderIndex === undefined) return;
      const style = getComputedStyle(element);
      const alphaMatch = style.outlineColor.match(/rgba\([^)]*,\s*([\d.]+)\s*\)$/i);
      records.push({
        controlIndex: Number(element.dataset.keyboardOrderIndex),
        outlineAlpha: style.outlineColor === "transparent" ? 0 : Number(alphaMatch?.[1] ?? 1),
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        tagName: element.tagName,
        text: element.textContent?.trim(),
      });
    };
    document.addEventListener("focusin", handler);
    state.__keyboardOrderState = { handler, records };
    const sentinel = document.createElement("button");
    sentinel.id = "keyboard-order-sentinel";
    sentinel.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const firstControl = elements[0];
    const anchor = firstControl.tagName === "SUMMARY" && firstControl.parentElement?.tagName === "DETAILS"
      ? firstControl.parentElement
      : firstControl;
    anchor.before(sentinel);
    sentinel.focus({ preventScroll: true });
  });
  for (let index = 0; index < controlCount; index += 1) {
    await page.keyboard.press("Tab");
  }
  const reached = await page.evaluate(() => {
    const state = (globalThis as typeof globalThis & {
      __keyboardOrderState?: { handler: (event: FocusEvent) => void; records: Array<{
        controlIndex: number;
        outlineAlpha: number;
        outlineColor: string;
        outlineStyle: string;
        outlineWidth: number;
        tagName: string;
        text?: string;
      }> };
    }).__keyboardOrderState;
    if (!state) throw new Error("Keyboard order recorder was not initialized");
    document.removeEventListener("focusin", state.handler);
    document.querySelector("#keyboard-order-sentinel")?.remove();
    document.querySelectorAll<HTMLElement>("[data-keyboard-order-index]").forEach((element) => {
      delete element.dataset.keyboardOrderIndex;
    });
    delete (globalThis as typeof globalThis & { __keyboardOrderState?: unknown }).__keyboardOrderState;
    return state.records;
  });
  expect(reached.map(({ controlIndex }) => controlIndex)).toEqual(
    Array.from({ length: controlCount }, (_, index) => index),
  );
  expect(reached).toEqual(expect.arrayContaining([
    mobileWorkbench
      ? expect.objectContaining({ tagName: "BUTTON", text: "阶段证据" })
      : expect.objectContaining({ tagName: "SUMMARY", text: expect.stringContaining("起课上下文") }),
  ]));
  for (const focused of reached) {
    expect(focused.outlineStyle, JSON.stringify(focused)).not.toBe("none");
    expect(focused.outlineWidth, JSON.stringify(focused)).toBeGreaterThan(0);
    expect(focused.outlineAlpha, JSON.stringify(focused)).toBeGreaterThan(0);
  }

  return reviewControlCount;
}

test("product name keeps the first visual position after generation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();

  await generateCourse(page);
  const header = page.locator(".course-workbench__header");
  const productName = header.getByRole("heading", { name: "大六壬演式" });
  const descriptor = header.getByText("传统术式 · 六阶段回看", { exact: true });
  const [productBounds, descriptorBounds] = await Promise.all([
    productName.boundingBox(),
    descriptor.boundingBox(),
  ]);
  expect(productBounds).not.toBeNull();
  expect(descriptorBounds).not.toBeNull();
  expect(productBounds!.x).toBeLessThan(descriptorBounds!.x);
  expect(productBounds!.y).toBeLessThanOrEqual(descriptorBounds!.y);
});

test("desktop keeps a center-led three-column workbench and a vertical stage rail", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await generateCourse(page);

  const context = page.locator(".course-workbench__grid > .course-context");
  const stage = page.locator(".course-workbench__stage");
  const stageRail = page.locator(".course-workbench__stages");
  const [contextBounds, stageBounds, railBounds] = await Promise.all([
    context.boundingBox(),
    stage.boundingBox(),
    stageRail.boundingBox(),
  ]);
  expect(contextBounds).not.toBeNull();
  expect(stageBounds).not.toBeNull();
  expect(railBounds).not.toBeNull();
  expect(contextBounds!.x).toBeLessThan(stageBounds!.x);
  expect(stageBounds!.x).toBeLessThan(railBounds!.x);
  expect(stageBounds!.width).toBeGreaterThan(contextBounds!.width);
  expect(stageBounds!.width).toBeGreaterThan(railBounds!.width);

  const stageButtons = stageRail.getByRole("button");
  const [firstStage, secondStage] = await Promise.all([
    stageButtons.nth(0).boundingBox(),
    stageButtons.nth(1).boundingBox(),
  ]);
  expect(firstStage).not.toBeNull();
  expect(secondStage).not.toBeNull();
  expect(secondStage!.y).toBeGreaterThan(firstStage!.y);
  expect(Math.abs(secondStage!.x - firstStage!.x)).toBeLessThanOrEqual(1);

  const secondaryColor = await page.locator(".course-experience__caption p + p").evaluate(
    (element) => getComputedStyle(element).color,
  );
  const actionColor = await page.getByRole("toolbar", { name: "课式视图" })
    .getByRole("button", { name: "文字课式" }).evaluate(
      (element) => getComputedStyle(element).color,
  );
  expect(secondaryColor).not.toBe(actionColor);
});

test("mobile exposes stages and workbench tools before the document footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, left: 0, bottom: 24, right: 0 },
  });
  await page.goto("/");
  await generateCourse(page);

  const stageNames = [
    "历法与月将，已完成",
    "天地盘加临，已完成",
    "四课生成，已完成",
    "三传取法，已完成",
    "天将排列，已完成",
    "复制结课，已完成",
  ] as const;
  const toolNames = ["上下文", "部件", "时间轴", "阶段证据", "文字课式"] as const;
  const dock = page.getByRole("region", { name: "移动工作台" });
  const stageDock = page.getByRole("navigation", { name: "移动推演阶段" });
  const tools = page.getByRole("toolbar", { name: "工作台工具" });
  for (const name of stageNames) {
    await expect(stageDock.getByRole("button", { name, exact: true })).toBeVisible();
  }
  for (const name of toolNames) {
    await expect(tools.getByRole("button", { name, exact: true })).toBeVisible();
  }

  async function expectFullyInsideViewport(locator: Locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-0.5);
    expect(box!.y).toBeGreaterThanOrEqual(-0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844.5);
  }
  await expectFullyInsideViewport(stageDock);
  await expectFullyInsideViewport(tools);

  const dockStyle = await dock.evaluate((element) => {
    const style = getComputedStyle(element);
    const backgroundChannels = style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    return {
      backgroundAlpha: backgroundChannels[3] ?? 1,
      bottom: style.bottom,
      paddingBottom: Number.parseFloat(style.paddingBottom),
      position: style.position,
    };
  });
  expect(dockStyle).toEqual({
    backgroundAlpha: 1,
    bottom: "0px",
    paddingBottom: 24,
    position: "sticky",
  });

  const coursePanelId = await tools.getByRole("button", { name: "文字课式" }).getAttribute("aria-controls");
  expect(coursePanelId).not.toBeNull();
  const courseFooter = page.locator(`[id="${coursePanelId}"]`).locator(".course-sheet__copy");
  const footerHandle = await courseFooter.elementHandle();
  expect(footerHandle).not.toBeNull();
  expect(await dock.evaluate((element, footer) => Boolean(
    element.compareDocumentPosition(footer as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
  ), footerHandle)).toBe(true);

  const viewport = page.locator(".artifact-experience__viewport");
  const viewportLayout = await viewport.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      maxHeight: Number.parseFloat(style.maxHeight),
      minHeight: Number.parseFloat(style.minHeight),
    };
  });
  expect(viewportLayout.minHeight).toBeGreaterThanOrEqual(Math.max(360, 844 * 0.55) - 1);
  expect(viewportLayout.maxHeight).toBeLessThanOrEqual(844 * 0.65 + 1);
  expect(viewportLayout.height).toBeGreaterThanOrEqual(Math.max(360, 844 * 0.55) - 1);
  expect(viewportLayout.height).toBeLessThanOrEqual(844 * 0.65 + 1);

  await tools.getByRole("button", { name: "文字课式" }).click();
  const textCourse = page.getByRole("article", { name: "标准文字课式" });
  await expect(textCourse).toBeVisible();
  await expectFullyInsideViewport(stageDock);
  await expectFullyInsideViewport(tools);
  for (const name of stageNames) {
    await expect(stageDock.getByRole("button", { name, exact: true })).toBeVisible();
  }
  for (const name of toolNames) {
    await expect(tools.getByRole("button", { name, exact: true })).toBeVisible();
  }
});

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
    await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    await context.setOffline(true);
    isOffline = true;

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
    await returnToCalendar(page);

    const manualDay = matrix.getByRole("button", {
      name: /日柱，自动 甲辰，有效 乙巳，人工修正/,
    });
    await expect(manualDay.getByText("自动：甲辰", { exact: true })).toBeVisible();
    await expect(manualDay.getByText("有效：乙巳", { exact: true })).toBeVisible();
    await expect(manualDay.getByText("人工修正", { exact: true })).toBeVisible();
    await expectContrastAtLeast(manualDay.locator("strong"), 4.5);
    await manualDay.click();

    if (process.env.CAPTURE_CALENDAR_VISUALS === "1") {
      mkdirSync(VISUALS_DIRECTORY, { recursive: true });
      await page.screenshot({
        fullPage: true,
        path: path.join(VISUALS_DIRECTORY, `calendar-review-${viewport.name}.png`),
      });
    }

    await page.getByRole("button", { name: "恢复日柱自动值" }).click();
    await returnToCalendar(page);
    await expect(matrix.getByRole("button", {
      name: /日柱，自动 甲辰，有效 甲辰，自动计算/,
    })).toBeVisible();
    await expect(page.getByRole("button", { name: "恢复日柱自动值" })).toHaveCount(0);

    const nonLocalRequests = requestUrls.filter(isNonLocalNetworkUrl);
    const nonLocalWebsockets = websocketUrls.filter(isNonLocalNetworkUrl);
    expect(nonLocalRequests).toEqual([]);
    expect(offlineRequestUrls.filter((url) => !isArtifactAssetUrl(url))).toEqual([]);
    expect({
      nonLocalWebsockets,
      offlineSentFrames,
      offlineWebsocketUrls,
    }).toEqual({
      nonLocalWebsockets: [],
      offlineSentFrames: [],
      offlineWebsocketUrls: [],
    });

    if (viewport.name === "mobile") {
      const mainRegion = page.locator(".calendar-review__main");
      const evidence = page.locator("#calendar-evidence");
      const flow = await mainRegion.evaluate((main, evidenceElement) => {
        const aside = evidenceElement as HTMLElement;
        const mainBounds = main.getBoundingClientRect();
        const evidenceBounds = aside.getBoundingClientRect();
        const followingMarker = document.createElement("span");
        followingMarker.style.cssText = "display:block;height:0;min-height:0;padding:0;border:0";
        aside.after(followingMarker);
        const followingTop = followingMarker.getBoundingClientRect().top;
        followingMarker.remove();
        return {
          evidenceBottom: evidenceBounds.bottom,
          followsMain: Boolean(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING),
          followingTop,
          hasLayoutBox: aside.offsetParent !== null && evidenceBounds.height > 0,
          mainBottom: mainBounds.bottom,
          evidenceTop: evidenceBounds.top,
          parentDisplay: getComputedStyle(aside.parentElement!).display,
          position: getComputedStyle(aside).position,
        };
      }, await evidence.elementHandle());
      expect(flow.followsMain).toBe(true);
      expect(flow.evidenceTop).toBeGreaterThanOrEqual(flow.mainBottom - 1);
      expect(["static", "relative"]).toContain(flow.position);
      expect(flow.parentDisplay).toBe("grid");
      expect(flow.hasLayoutBox).toBe(true);
      expect(flow.followingTop).toBeGreaterThanOrEqual(flow.evidenceBottom - 1);
    }
  });

  test(`${viewport.name} keyboard users reach the matrix, correction, and reset controls in document order`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await calculateCalendar(page);

    await page.getByRole("button", { name: /日柱，自动 甲辰/ }).click();
    const automaticControlCount = await expectVisibleControlsKeyboardReachable(page);

    await page.getByRole("combobox", { name: "修正日柱" }).selectOption("乙巳");
    await returnToCalendar(page);
    await page.getByRole("list", { name: "历法结果矩阵" }).getByRole("button", {
      name: /日柱，自动 甲辰，有效 乙巳，人工修正/,
    }).click();
    const reset = page.getByRole("button", { name: "恢复日柱自动值" });
    await expect(reset).toBeVisible();
    const manualControlCount = await expectVisibleControlsKeyboardReachable(page);
    expect(manualControlCount).toBe(automaticControlCount + 1);

    if (viewport.name === "mobile") {
      const evidence = page.locator("#calendar-evidence");
      await reset.focus();
      await page.keyboard.press("Tab");
      expect(await evidence.evaluate((aside) => !aside.contains(document.activeElement))).toBe(true);
      await expect(page.getByRole("toolbar", { name: "工作台工具" })
        .getByRole("button", { name: "上下文" })).toBeFocused();
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
