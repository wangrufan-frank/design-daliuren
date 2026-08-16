import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { RuleStageRail } from "./RuleStageRail";

afterEach(cleanup);

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

it("navigates completed snapshots without making locked stages clickable", async () => {
  const onSelect = vi.fn();
  render(
    <RuleStageRail
      completed={["calendar", "heaven-earth"]}
      current="four-lessons"
      selected="heaven-earth"
      onSelect={onSelect}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /历法与月将，已完成/ }));

  expect(onSelect).toHaveBeenCalledWith("calendar");
  expect(screen.getByRole("button", { name: /天地盘加临，已完成/ })).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("button", { name: /四课生成/ })).not.toBeInTheDocument();
  expect(screen.getByText("四课生成")).toHaveAttribute("data-status", "current");
});

it("keeps completed rail stages keyboard focusable for the scoped focus treatment", async () => {
  const user = userEvent.setup();
  render(<RuleStageRail completed={["calendar"]} current="heaven-earth" />);

  const completedStage = screen.getByRole("button", { name: /历法与月将，已完成/ });

  await user.tab();
  expect(completedStage).toHaveFocus();
});
