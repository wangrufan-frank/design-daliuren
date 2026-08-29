import { expect, it } from "vitest";
import {
  VOID_SURFACE_COLORS,
  formatVoidBranch,
  voidSurfaceColor,
} from "./format-void-branch";

const voids = ["子", "丑"] as const;

it("formats void branches for their plate surface", () => {
  expect(formatVoidBranch("子", voids, "heaven")).toBe("子（天盘空）");
  expect(formatVoidBranch("子", voids, "earth")).toBe("子（地盘空）");
  expect(formatVoidBranch("子", voids, "neutral")).toBe("子（空）");
  expect(formatVoidBranch("寅", voids, "heaven")).toBe("寅");
});

it("returns surface colors only for void branches on a plate", () => {
  expect(VOID_SURFACE_COLORS.earth).toBe("#8A563B");
  expect(VOID_SURFACE_COLORS.heaven).toBe("#477B9D");
  expect(voidSurfaceColor("子", voids, "earth")).toBe("#8A563B");
  expect(voidSurfaceColor("子", voids, "heaven")).toBe("#477B9D");
  expect(voidSurfaceColor("子", voids, "neutral")).toBeUndefined();
  expect(voidSurfaceColor("寅", voids, "earth")).toBeUndefined();
});
