import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RuleStageRail } from "./RuleStageRail";

it("labels reviewed, current, and locked stages without approval controls", () => {
  render(<RuleStageRail completed={["calendar"]} current="heaven-earth" />);

  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "completed");
  expect(screen.getByText("历法与月将")).toHaveAttribute("aria-label", "历法与月将，已完成");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "current");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("aria-label", "天地盘加临，进行中");
  expect(screen.getByText("四课生成")).toHaveAttribute("data-status", "locked");
  expect(screen.getByText("四课生成")).toHaveAttribute("aria-label", "四课生成，待进行");
  expect(screen.queryByRole("button", { name: /审核|批准/ })).not.toBeInTheDocument();
});
