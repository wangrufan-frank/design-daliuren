import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RuleStageRail } from "./RuleStageRail";

it("labels reviewed, current, and locked stages without approval controls", () => {
  render(<RuleStageRail completed={["calendar"]} current="heaven-earth" />);

  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "completed");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "current");
  expect(screen.queryByRole("button", { name: /审核|批准/ })).not.toBeInTheDocument();
});
