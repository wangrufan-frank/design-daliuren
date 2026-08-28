import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { MobileWorkbenchTools, type MobileToolId } from "./MobileWorkbenchTools";

afterEach(cleanup);

it("keeps one tool panel open and returns focus when it closes", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [activeTool, setActiveTool] = useState<MobileToolId>();
    return (
      <MobileWorkbenchTools
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
        selectedStage="course"
        onSelectStage={vi.fn()}
        context={<p>上下文内容</p>}
        parts={<p>部件内容</p>}
        timeline={<p>时间轴内容</p>}
        evidence={<p>证据内容</p>}
        course={<p>文字内容</p>}
      />
    );
  }

  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "阶段证据" }));
  expect(screen.getByRole("region", { name: "移动工具面板" })).toHaveTextContent("证据内容");

  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expect(screen.getByRole("region", { name: "移动工具面板" })).toHaveTextContent("文字内容");
  expect(screen.queryByText("证据内容")).not.toBeInTheDocument();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "文字课式" })).toHaveFocus();
});

it("marks the selected stage in the persistent mobile navigation", () => {
  render(
    <MobileWorkbenchTools
      activeTool={undefined}
      onActiveToolChange={vi.fn()}
      selectedStage="three-transmissions"
      onSelectStage={vi.fn()}
      context={null}
      parts={null}
      timeline={null}
      evidence={null}
      course={null}
    />,
  );

  expect(screen.getByRole("navigation", { name: "移动推演阶段" })).toBeVisible();
  expect(screen.getByRole("button", { name: "三传取法，已完成" })).toHaveAttribute("aria-current", "page");
});
