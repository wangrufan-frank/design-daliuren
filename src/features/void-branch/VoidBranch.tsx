import type { EarthlyBranch } from "../../domain/chart/types";

interface VoidBranchProps {
  value: string;
  voidBranches: readonly [EarthlyBranch, EarthlyBranch];
}

export function VoidBranch({ value, voidBranches }: VoidBranchProps) {
  const isVoid = voidBranches.includes(value as EarthlyBranch);
  return (
    <>
      {value}
      {isVoid ? <span className="void-branch__mark" aria-label="空亡">空</span> : null}
    </>
  );
}

export function voidAccessibleSuffix(value: string, voidBranches: VoidBranchProps["voidBranches"]): string {
  return voidBranches.includes(value as EarthlyBranch) ? "（空亡）" : "";
}
