import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch } from "./types";

export function deriveNatalBranch(birthYear: number): EarthlyBranch {
  const index = ((birthYear - 4) % EARTHLY_BRANCHES.length + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length;
  return EARTHLY_BRANCHES[index];
}
