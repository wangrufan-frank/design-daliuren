import type { EarthlyBranch } from "../../../domain/chart/types";

export function formatVoidBranch(
  value: string,
  voidBranches: readonly [EarthlyBranch, EarthlyBranch],
): string {
  return voidBranches.some((branch) => branch === value) ? `${value}（空）` : value;
}
