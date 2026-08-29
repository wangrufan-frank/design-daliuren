import type { EarthlyBranch } from "../../../domain/chart/types";

export type VoidSurface = "earth" | "heaven" | "neutral";

export const VOID_SURFACE_COLORS = {
  earth: "#8A563B",
  heaven: "#477B9D",
} as const;

export function isVoidBranch(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
): boolean {
  return voidBranches.some((branch) => branch === value);
}

export function formatVoidBranch(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
  surface: VoidSurface = "neutral",
): string {
  if (!isVoidBranch(value, voidBranches)) return value;
  return surface === "heaven" ? `${value}（天盘空）`
    : surface === "earth" ? `${value}（地盘空）`
      : `${value}（空）`;
}

export function voidSurfaceColor(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
  surface: VoidSurface,
): string | undefined {
  return isVoidBranch(value, voidBranches) && surface !== "neutral"
    ? VOID_SURFACE_COLORS[surface]
    : undefined;
}
