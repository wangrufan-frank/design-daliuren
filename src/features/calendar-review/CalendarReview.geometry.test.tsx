// @vitest-environment node

import { chromium, type Browser, type Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LunarTypescriptAdapter } from "../../adapters/calendar/lunar-typescript-adapter";
import { computeCalendar } from "../../domain/calendar/compute-calendar";
import { setCalendarCorrection } from "../../domain/calendar/corrections";
import type { CourseInput } from "../../domain/chart/types";
import { CalendarReview } from "./CalendarReview";

const adapter = new LunarTypescriptAdapter();
const input: CourseInput = {
  civilDateTime: "2024-02-10T14:30:00",
  timeZone: "Asia/Shanghai",
  locationName: "北京",
  reason: "商务决策复盘",
  corrections: {},
};

function manualResult() {
  const outcome = computeCalendar(setCalendarCorrection(input, "yearPillar", "乙巳"), adapter);
  if (!outcome.ok) throw new Error(`expected calendar fixture, got ${outcome.error.code}`);
  return outcome.value;
}

async function mount(page: Page, width: number) {
  await page.setViewportSize({ width, height: 3000 });
  await page.setContent(renderToStaticMarkup(
    <CalendarReview result={manualResult()} onSetCorrection={vi.fn()} onResetCorrection={vi.fn()} />,
  ));
  await page.addStyleTag({ path: "src/styles/tokens.css" });
  await page.addStyleTag({ path: "src/styles/global.css" });
}

async function activate(page: Page, activeIndex: number) {
  await page.locator(".calendar-review__cell").evaluateAll((cells, index) => {
    cells.forEach((cell, cellIndex) => cell.setAttribute("aria-pressed", String(cellIndex === index)));
  }, activeIndex);
}

describe("CalendarReview connector geometry", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it.each([1440, 390])("joins all eight active leaves to the seam at %ipx", async (width) => {
    const page = await browser.newPage();
    await mount(page, width);
    const connectors = page.locator(".calendar-review__connector");
    expect(await connectors.count()).toBe(8);
    if (await connectors.count() !== 8) {
      await page.close();
      return;
    }

    for (let activeIndex = 0; activeIndex < 8; activeIndex += 1) {
      await activate(page, activeIndex);
      const metrics = await page.evaluate((index) => {
        const main = document.querySelector<HTMLElement>(".calendar-review__main")!;
        const matrix = document.querySelector<HTMLElement>(".calendar-review__matrix")!;
        const buttons = [...document.querySelectorAll<HTMLElement>(".calendar-review__cell")];
        const button = buttons[index];
        const connector = button.parentElement!.querySelector<HTMLElement>(":scope > .calendar-review__connector")!;
        const mainRect = main.getBoundingClientRect();
        const matrixRect = matrix.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const connectorRect = connector.getBoundingClientRect();
        const connectorLine = getComputedStyle(connector, "::before");
        const connectorLineLeft = connectorRect.left + Number.parseFloat(connectorLine.left);
        const connectorLineRight = connectorLineLeft + Number.parseFloat(connectorLine.width);
        const connectorFoot = getComputedStyle(connector, "::after");
        const connectorFootLeft = connectorRect.left + Number.parseFloat(connectorFoot.left);
        const connectorFootRight = connectorRect.right - Number.parseFloat(connectorFoot.right);
        const connectorFootBottom = connectorRect.bottom - Number.parseFloat(connectorFoot.bottom);
        const connectorFootTop = connectorFootBottom - Number.parseFloat(connectorFoot.height);
        const visibleConnectorIndices = [...document.querySelectorAll<HTMLElement>(".calendar-review__connector")]
          .flatMap((candidate, candidateIndex) => {
            const style = getComputedStyle(candidate);
            const before = getComputedStyle(candidate, "::before");
            const after = getComputedStyle(candidate, "::after");
            const rootVisible = style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
            const beforeDrawn = before.content !== "none" && before.backgroundColor !== "rgba(0, 0, 0, 0)";
            const afterDrawn = after.content !== "none" && after.backgroundColor !== "rgba(0, 0, 0, 0)";
            return rootVisible && (beforeDrawn || afterDrawn) ? [candidateIndex] : [];
          });
        const seamStart = mainRect.right - Number.parseFloat(getComputedStyle(main).borderRightWidth);
        const crossesButtonInterior = buttons.some((candidate, candidateIndex) => {
          if (candidateIndex === index) return false;
          const rect = candidate.getBoundingClientRect();
          const overlapsVerticalRun = rect.top < connectorRect.bottom && rect.bottom > connectorRect.top;
          if (!overlapsVerticalRun) return false;
          const style = getComputedStyle(candidate);
          const contentLeft = rect.left + Number.parseFloat(style.borderLeftWidth);
          const contentRight = rect.right - Number.parseFloat(style.borderRightWidth);
          const contentTop = rect.top + Number.parseFloat(style.borderTopWidth);
          const contentBottom = rect.bottom - Number.parseFloat(style.borderBottomWidth);
          const verticalCrosses = connectorLineRight > contentLeft + 0.5 && connectorLineLeft < contentRight - 0.5;
          const footOverlapsHorizontally = connectorFootRight > contentLeft + 0.5 && connectorFootLeft < contentRight - 0.5;
          const horizontalCrosses = footOverlapsHorizontally
            && connectorFootBottom > contentTop + 0.5
            && connectorFootTop < contentBottom - 0.5;
          return verticalCrosses || horizontalCrosses;
        });
        return {
          startErrorX: Math.abs(connectorRect.left - buttonRect.right),
          startErrorY: Math.abs(connectorRect.top - buttonRect.bottom),
          endErrorX: Math.abs(connectorRect.right - seamStart),
          endErrorY: Math.abs(connectorRect.bottom - matrixRect.bottom),
          matrixSeamError: Math.abs(matrixRect.right - seamStart),
          crossesButtonInterior,
          pointerEvents: getComputedStyle(connector).pointerEvents,
          linePointerEvents: connectorLine.pointerEvents,
          footPointerEvents: connectorFoot.pointerEvents,
          lineContent: connectorLine.content,
          lineBackground: connectorLine.backgroundColor,
          lineWidth: connectorLine.width,
          footContent: connectorFoot.content,
          footBackground: connectorFoot.backgroundColor,
          footHeight: connectorFoot.height,
          visibleConnectorIndices,
        };
      }, activeIndex);

      expect(metrics.startErrorX, `width ${width}, active ${activeIndex}`).toBeLessThanOrEqual(0.5);
      expect(metrics.startErrorY, `width ${width}, active ${activeIndex}`).toBeLessThanOrEqual(0.5);
      expect(metrics.endErrorX, `width ${width}, active ${activeIndex}`).toBeLessThanOrEqual(0.5);
      expect(metrics.endErrorY, `width ${width}, active ${activeIndex}`).toBeLessThanOrEqual(0.5);
      expect(metrics.matrixSeamError, `width ${width}, active ${activeIndex}`).toBeLessThanOrEqual(0.5);
      expect(metrics.crossesButtonInterior, `width ${width}, active ${activeIndex}`).toBe(false);
      expect(metrics.pointerEvents).toBe("none");
      expect(metrics.linePointerEvents).toBe("none");
      expect(metrics.footPointerEvents).toBe("none");
      expect(metrics.lineContent).not.toBe("none");
      expect(metrics.footContent).not.toBe("none");
      expect(metrics.lineBackground).toBe("rgb(175, 197, 188)");
      expect(metrics.footBackground).toBe("rgb(175, 197, 188)");
      expect(metrics.lineWidth).toBe("2px");
      expect(metrics.footHeight).toBe("2px");
      expect(metrics.visibleConnectorIndices).toEqual([activeIndex]);
    }

    await activate(page, 0);
    const manualStyle = await page.locator(".calendar-review__cell").first().evaluate((button) => ({
      border: getComputedStyle(button).borderColor,
      indicator: getComputedStyle(button, "::before").backgroundColor,
    }));
    expect(manualStyle).toEqual({ border: "rgb(154, 120, 66)", indicator: "rgb(84, 125, 112)" });

    await activate(page, 1);
    const automaticStyle = await page.locator(".calendar-review__cell").nth(1).evaluate((button) => ({
      border: getComputedStyle(button).borderColor,
      indicator: getComputedStyle(button, "::before").backgroundColor,
    }));
    expect(automaticStyle).toEqual({ border: "rgb(175, 197, 188)", indicator: "rgb(84, 125, 112)" });
    await page.close();
  });
});
