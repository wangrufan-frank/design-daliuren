import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} shell is readable without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "大六壬演式" })).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test(`${viewport.name} keyboard users can reach each visible control with a visible focus ring`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const controls = page.locator("button, input, select");
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    const visibleControlIndexes = await controls.evaluateAll((elements) =>
      elements.flatMap((element, index) => (
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden" ? [index] : []
      )),
    );
    const focusedControlIndexes = new Set<number>();

    await page.locator("body").focus();
    for (let index = 0; index < count * 3 && focusedControlIndexes.size < visibleControlIndexes.length; index += 1) {
      await page.keyboard.press("Tab");
      const focusedControl = await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement;
        return {
          id: activeElement?.id,
          index: [...document.querySelectorAll("button, input, select")].indexOf(activeElement),
          outlineColor: getComputedStyle(activeElement).outlineColor,
          outlineStyle: getComputedStyle(activeElement).outlineStyle,
          outlineWidth: Number.parseFloat(getComputedStyle(activeElement).outlineWidth),
          type: activeElement?.getAttribute("type"),
        };
      });

      if (visibleControlIndexes.includes(focusedControl.index)) {
        focusedControlIndexes.add(focusedControl.index);
        expect(focusedControl.outlineStyle, JSON.stringify(focusedControl)).toBe("solid");
        expect(focusedControl.outlineWidth, JSON.stringify(focusedControl)).toBeGreaterThan(0);
        expect(focusedControl.outlineColor, JSON.stringify(focusedControl)).not.toMatch(
          /^(transparent|rgba\(.+,\s*0(?:\.0+)?\))$/,
        );
      }
    }

    expect([...focusedControlIndexes].sort((a, b) => a - b)).toEqual(visibleControlIndexes);
  });

  test(`${viewport.name} pointer focus does not show the keyboard focus ring`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const inputToggle = page.getByRole("button", { name: "起课输入" });
    await inputToggle.click();
    expect(await inputToggle.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  });
}
