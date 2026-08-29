import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MobileWorkbenchTools, type MobileToolId } from "./MobileWorkbenchTools";

afterEach(cleanup);

function PortaledControl({ hostId, label }: { hostId: string; label: string }) {
  const [host, setHost] = useState<HTMLElement>();

  useEffect(() => {
    setHost(document.getElementById(hostId) ?? undefined);
  }, [hostId]);

  return host ? createPortal(<button type="button">{label}</button>, host) : null;
}

function PortalHarness({
  tool,
  controlLabel,
  onActiveToolChange,
}: {
  tool: "parts" | "timeline";
  controlLabel: string;
  onActiveToolChange(tool?: MobileToolId): void;
}) {
  const [activeTool, setActiveTool] = useState<MobileToolId>();
  const hostId = `${tool}-portal-host`;
  const handleActiveToolChange = (nextTool?: MobileToolId) => {
    onActiveToolChange(nextTool);
    setActiveTool(nextTool);
  };

  return (
    <>
      <PortaledControl hostId={hostId} label={controlLabel} />
      <MobileWorkbenchTools
        activeTool={activeTool}
        onActiveToolChange={handleActiveToolChange}
        selectedStage="course"
        onSelectStage={vi.fn()}
        context={null}
        parts={tool === "parts" ? <div id={hostId} /> : null}
        timeline={tool === "timeline" ? <div id={hostId} /> : null}
        evidence={null}
        course={null}
      />
    </>
  );
}

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
  expect(screen.getByText("证据内容")).not.toBeVisible();

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

it("keeps part-directory content mounted while another tool is active", async () => {
  const user = userEvent.setup();
  function PartDirectoryProbe() {
    const [expanded, setExpanded] = useState(false);
    return <button type="button" onClick={() => setExpanded(true)}>{expanded ? "部件组已展开" : "展开部件组"}</button>;
  }
  function Harness() {
    const [activeTool, setActiveTool] = useState<MobileToolId>();
    return (
      <MobileWorkbenchTools
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
        selectedStage="course"
        onSelectStage={vi.fn()}
        context={null}
        parts={<PartDirectoryProbe />}
        timeline={null}
        evidence={<p>证据内容</p>}
        course={null}
      />
    );
  }

  render(<Harness />);
  const toolbar = screen.getByRole("toolbar", { name: "工作台工具" });
  await user.click(within(toolbar).getByRole("button", { name: "部件" }));
  await user.click(screen.getByRole("button", { name: "展开部件组" }));
  await user.click(within(toolbar).getByRole("button", { name: "阶段证据" }));
  await user.click(within(toolbar).getByRole("button", { name: "部件" }));

  expect(screen.getByRole("button", { name: "部件组已展开" })).toBeVisible();
});

it("closes on Escape from a stage button and restores the opening trigger", async () => {
  const user = userEvent.setup();
  const onActiveToolChange = vi.fn();
  function Harness() {
    const [activeTool, setActiveTool] = useState<MobileToolId>();
    const handleActiveToolChange = (tool?: MobileToolId) => {
      onActiveToolChange(tool);
      setActiveTool(tool);
    };
    return (
      <MobileWorkbenchTools
        activeTool={activeTool}
        onActiveToolChange={handleActiveToolChange}
        selectedStage="course"
        onSelectStage={vi.fn()}
        context={null}
        parts={null}
        timeline={null}
        evidence={null}
        course={<p>文字内容</p>}
      />
    );
  }

  render(<Harness />);
  const toolbar = screen.getByRole("toolbar", { name: "工作台工具" });
  const courseTrigger = within(toolbar).getByRole("button", { name: "文字课式" });
  await user.click(courseTrigger);
  await user.click(within(screen.getByRole("navigation", { name: "移动推演阶段" })).getByRole("button", { name: "三传取法，已完成" }));
  onActiveToolChange.mockClear();
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(courseTrigger).toHaveFocus();
  expect(onActiveToolChange).toHaveBeenCalledOnce();
  expect(onActiveToolChange).toHaveBeenCalledWith(undefined);
});

it("closes once on Escape from a portaled timeline control and restores its trigger", async () => {
  const user = userEvent.setup();
  const onActiveToolChange = vi.fn();
  render(
    <PortalHarness
      tool="timeline"
      controlLabel="播放推演"
      onActiveToolChange={onActiveToolChange}
    />,
  );
  const timelineTrigger = within(screen.getByRole("toolbar", { name: "工作台工具" }))
    .getByRole("button", { name: "时间轴" });
  await user.click(timelineTrigger);
  await user.click(await screen.findByRole("button", { name: "播放推演" }));
  onActiveToolChange.mockClear();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(timelineTrigger).toHaveFocus();
  expect(onActiveToolChange).toHaveBeenCalledOnce();
  expect(onActiveToolChange).toHaveBeenCalledWith(undefined);
  await user.keyboard("{Escape}");
  expect(onActiveToolChange).toHaveBeenCalledOnce();
});

it("closes once on Escape from a portaled part control and restores its trigger", async () => {
  const user = userEvent.setup();
  const onActiveToolChange = vi.fn();
  render(
    <PortalHarness
      tool="parts"
      controlLabel="打开部件目录"
      onActiveToolChange={onActiveToolChange}
    />,
  );
  const partsTrigger = within(screen.getByRole("toolbar", { name: "工作台工具" }))
    .getByRole("button", { name: "部件" });
  await user.click(partsTrigger);
  await user.click(await screen.findByRole("button", { name: "打开部件目录" }));
  onActiveToolChange.mockClear();

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(partsTrigger).toHaveFocus();
  expect(onActiveToolChange).toHaveBeenCalledOnce();
  expect(onActiveToolChange).toHaveBeenCalledWith(undefined);
});
