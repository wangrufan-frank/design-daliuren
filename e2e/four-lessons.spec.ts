import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const EXPECTED_VISUAL_LESSONS = [
  { id: "fourth", label: "四课", upper: "寅", lower: "酉" },
  { id: "third", label: "三课", upper: "酉", lower: "辰" },
  { id: "second", label: "二课", upper: "子", lower: "未" },
  { id: "first", label: "一课", upper: "未", lower: "甲" },
] as const;

async function submitOrdinaryInput(page: Page) {
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("地点").fill("北京");
  await page.getByLabel("经度").fill("116.4074");
  await page.getByLabel("纬度").fill("39.9042");
  await page.getByRole("button", { name: "建立起课上下文" }).click();
}

function isNonLocalNetworkUrl(url: string) {
  const target = new URL(url);
  return ["http:", "https:", "ws:", "wss:"].includes(target.protocol)
    && !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname);
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

    const review = page.getByRole("region", { name: "四课生成" });
    const list = review.getByRole("list", { name: "四课课体" });
    const cards = list.getByRole("button");
    await expect(cards).toHaveCount(EXPECTED_VISUAL_LESSONS.length);

    for (const [index, lesson] of EXPECTED_VISUAL_LESSONS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute("data-lesson", lesson.id);
      await expect(card).toHaveAccessibleName(`${lesson.label}，上神${lesson.upper}，下神${lesson.lower}，天将待加临`);
      await expect(card.locator(":scope > *")).toHaveCount(4);
    }

    const first = cards.nth(3);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("complementary", { name: "一课证据" })).toContainText("甲寄寅");

    const fourth = cards.first();
    await fourth.click();
    await expect(page.getByRole("complementary", { name: "四课证据" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "一课证据" })).toHaveCount(0);
    await page.getByRole("button", { name: "关闭证据" }).click();
    await expect(fourth).toBeFocused();

    await expect(page.getByRole("button", { name: "四课生成，已完成" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("三传取法", { exact: true })).toHaveAttribute("data-status", "current");
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
    expect(offlineRequestUrls).toEqual([]);
    expect(websocketUrls.filter(isNonLocalNetworkUrl)).toEqual([]);
    expect({ offlineSentFrames, offlineWebsocketUrls }).toEqual({
      offlineSentFrames: [],
      offlineWebsocketUrls: [],
    });
  });
}
