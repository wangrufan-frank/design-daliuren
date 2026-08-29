import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const EXPECTED_VISUAL_LESSONS = [
  { id: "fourth", label: "四课", upper: "寅", lower: "酉", general: "天后" },
  { id: "third", label: "三课", upper: "酉", lower: "辰", general: "勾陈" },
  { id: "second", label: "二课", upper: "子", lower: "未", general: "螣蛇" },
  { id: "first", label: "一课", upper: "未", lower: "甲", general: "天空" },
] as const;
const VOID_BRANCHES = new Set<string>(["寅", "卯"]);

async function submitOrdinaryInput(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
}

function isNonLocalNetworkUrl(url: string) {
  const target = new URL(url);
  return ["http:", "https:", "ws:", "wss:"].includes(target.protocol)
    && !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname);
}

function isArtifactAssetUrl(url: string) {
  return /^\/models\/daliuren\/daliuren-artifact-lod[0-2]\.glb$/.test(new URL(url).pathname);
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} renders selectable four lessons offline without document overflow`, async ({ context, page }) => {
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
    await page.getByRole("button", { name: "四课生成，已完成" }).click();
    const mobileTools = page.getByRole("toolbar", { name: "工作台工具" });
    if (await mobileTools.count()) {
      await mobileTools.getByRole("button", { name: "阶段证据" }).click();
    } else {
      await page.getByRole("button", { name: "查看阶段证据" }).click();
    }

    const review = page.getByRole("region", { name: "四课生成" });
    const list = review.getByRole("list", { name: "四课课体" });
    const cards = list.getByRole("button");
    await expect(cards).toHaveCount(EXPECTED_VISUAL_LESSONS.length);

    for (const [index, lesson] of EXPECTED_VISUAL_LESSONS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute("data-lesson", lesson.id);
      const upper = `${lesson.upper}${VOID_BRANCHES.has(lesson.upper) ? "（空亡）" : ""}`;
      const lower = `${lesson.lower}${VOID_BRANCHES.has(lesson.lower) ? "（空亡）" : ""}`;
      await expect(card).toHaveAccessibleName(`${lesson.label}，上神${upper}，下神${lower}，天将${lesson.general}`);
      await expect(card.locator(":scope > *")).toHaveCount(4);
    }
    const cardPositions = await cards.evaluateAll((items) => items.map((item) => {
      const { right, x, y } = item.getBoundingClientRect();
      return { offsetLeft: item.offsetLeft, right, x, y };
    }));
    for (let index = 1; index < cardPositions.length; index += 1) {
      const previous = cardPositions[index - 1];
      const current = cardPositions[index];
      expect(current.x).toBeGreaterThanOrEqual(previous.right);
      if (viewport.name === "desktop") {
        expect(current.y).toBeCloseTo(previous.y, 3);
      } else {
        expect(current.offsetLeft).toBeGreaterThan(previous.offsetLeft);
      }
    }

    const first = cards.nth(3);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const initialEvidence = page.getByRole("complementary", { name: "一课证据" });
    await expect(initialEvidence.getByRole("listitem")).toHaveCount(2);
    await expect(initialEvidence).toContainText("甲寄寅");
    await expect(initialEvidence).toContainText("一课：生效日干甲，固定寄宫寅，查地盘寅宫");
    await expect(initialEvidence).not.toContainText("地盘未宫所临天盘为子");
    await expect(initialEvidence).not.toContainText("地盘辰宫所临天盘为酉");
    await expect(initialEvidence).not.toContainText("地盘酉宫所临天盘为寅");

    const fourth = cards.first();
    await fourth.click();
    const evidence = page.locator("#four-lessons-evidence");
    const closeEvidence = page.getByRole("button", { name: "关闭证据" });
    await expect(page.getByRole("complementary", { name: "四课证据" })).toBeVisible();
    await expect(closeEvidence).toBeVisible();
    await expect(page.getByText("四课：下神来自三课上神酉，查地盘酉宫", { exact: true })).toBeVisible();
    await expect(page.getByText("地盘酉宫所临天盘为寅", { exact: true })).toBeVisible();
    await expect(page.getByText("甲寄寅", { exact: true })).toHaveCount(0);
    await expect(page.getByText("地盘寅宫所临天盘为未", { exact: true })).toHaveCount(0);
    await expect(page.getByText("地盘未宫所临天盘为子", { exact: true })).toHaveCount(0);
    await expect(page.getByText("地盘辰宫所临天盘为酉", { exact: true })).toHaveCount(0);
    await closeEvidence.click();
    await expect(evidence).toBeHidden();
    await expect(fourth).toBeFocused();

    await expect(page.getByRole("button", { name: "四课生成，已完成" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "天将排列，已完成" })).toHaveAttribute("data-status", "completed");
    await expect(page.getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("data-status", "completed");
    const listOverflow = await list.evaluate((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { clientWidth: element.clientWidth, left, right, scrollWidth: element.scrollWidth };
    });
    expect(listOverflow.left).toBeGreaterThanOrEqual(0);
    expect(listOverflow.right).toBeLessThanOrEqual(viewport.width);
    if (viewport.name === "mobile") {
      expect(listOverflow.scrollWidth).toBeGreaterThan(listOverflow.clientWidth);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

    if (viewport.name === "mobile") {
      const childRects = await cards.evaluateAll((items) => items.map((item) => [...item.children].map((child) => {
        const { bottom, top } = child.getBoundingClientRect();
        return { bottom, top };
      })));
      for (const rects of childRects) {
        for (let index = 1; index < rects.length; index += 1) {
          expect(rects[index].top).toBeGreaterThanOrEqual(rects[index - 1].bottom);
        }
      }
    }

    expect(requestUrls.filter(isNonLocalNetworkUrl)).toEqual([]);
    expect(offlineRequestUrls.filter((url) => !isArtifactAssetUrl(url))).toEqual([]);
    expect(websocketUrls.filter(isNonLocalNetworkUrl)).toEqual([]);
    expect({ offlineSentFrames, offlineWebsocketUrls }).toEqual({
      offlineSentFrames: [],
      offlineWebsocketUrls: [],
    });
  });
}
