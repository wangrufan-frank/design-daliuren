import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";
import { ArtifactPartDirectory } from "./ArtifactPartDirectory";

afterEach(cleanup);

describe("ArtifactPartDirectory", () => {
  it("derives every displayed total from the provided descriptor count", async () => {
    const user = userEvent.setup();
    const descriptors = ARTIFACT_ANNOTATION_DESCRIPTORS.slice(0, 3);
    render(<ArtifactPartDirectory stage="calendar" descriptors={descriptors} onFocus={vi.fn()} />);

    expect(screen.getByRole("button", { name: "打开部件目录" })).toHaveTextContent("查看全部 3 项");
    await user.click(screen.getByRole("button", { name: "打开部件目录" }));

    expect(screen.getByRole("dialog", { name: "全部部件" })).toHaveTextContent("全部 3 个部件");
    await user.click(screen.getByRole("button", { name: "复制结课" }));
    expect(screen.getByText("无新增部件，可查看全部3项")).toBeVisible();
  });

  it("keeps fixed semantic owners while only moving and expanding the current group", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ArtifactPartDirectory
        stage="calendar"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "打开部件目录" }));

    const dialog = screen.getByRole("dialog", { name: "全部部件" });
    const expectedOwners = {
      "历法与月将": ["calendar/slip"],
      "天地盘加临": ["plate/earth", "plate/heaven"],
      "四课生成": ["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"],
      "三传取法": ["transmission/initial", "transmission/middle", "transmission/final"],
      "天将排列": [
        "plate/generals",
        "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
        "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
        "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
      ],
    } as const;
    const groupEntries = (root: HTMLElement, label: keyof typeof expectedOwners) => {
      const toggle = within(root).getByRole("button", { name: label });
      return [...toggle.closest("section")!.querySelectorAll<HTMLButtonElement>("button[data-part-id]")]
        .map((entry) => entry.dataset.partId);
    };

    expect(within(dialog).getAllByTestId("artifact-part-group")).toHaveLength(6);
    expect(within(within(dialog).getAllByTestId("artifact-part-group")[0]).getByRole("button", { name: "历法与月将" })).toHaveAttribute("aria-expanded", "true");
    Object.entries(expectedOwners).forEach(([label, ids]) => {
      expect(groupEntries(dialog, label as keyof typeof expectedOwners)).toEqual(ids);
      expect(within(dialog).getByRole("button", { name: label }).closest("section")).toHaveTextContent(`${ids.length} 项`);
    });
    expect(new Set([...dialog.querySelectorAll<HTMLButtonElement>("button[data-part-id]")].map((entry) => entry.dataset.partId)).size).toBe(ARTIFACT_ANNOTATION_DESCRIPTORS.length);
    expect(within(dialog).getByText(`无新增部件，可查看全部${ARTIFACT_ANNOTATION_DESCRIPTORS.length}项`)).toBeInTheDocument();

    rerender(
      <ArtifactPartDirectory
        stage="course"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={vi.fn()}
      />,
    );

    const reorderedGroups = within(dialog).getAllByTestId("artifact-part-group");
    expect(within(reorderedGroups[0]).getByRole("button", { name: "复制结课" })).toHaveAttribute("aria-expanded", "true");
    expect(within(reorderedGroups[0]).getByText(`无新增部件，可查看全部${ARTIFACT_ANNOTATION_DESCRIPTORS.length}项`)).toBeVisible();
    Object.entries(expectedOwners).forEach(([label, ids]) => {
      expect(groupEntries(dialog, label as keyof typeof expectedOwners)).toEqual(ids);
    });
  });

  it("expands non-current stage groups on demand", async () => {
    const user = userEvent.setup();
    render(
      <ArtifactPartDirectory
        stage="calendar"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "打开部件目录" }));

    const transmissions = screen.getByRole("button", { name: "三传取法" });
    expect(transmissions).toHaveAttribute("aria-expanded", "false");
    await user.click(transmissions);

    expect(transmissions).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /^初传 / })).toBeVisible();
  });

  it("focuses a selected part, closes the sheet, and keeps a visible focus indicator", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <ArtifactPartDirectory
        stage="heaven-earth"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={onFocus}
      />,
    );
    const trigger = screen.getByRole("button", { name: "打开部件目录" });
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: /月将环/ }));

    expect(onFocus).toHaveBeenCalledWith("plate/heaven");
    expect(screen.queryByRole("dialog", { name: "全部部件" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("当前聚焦：月将环");
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the dialog and restores it after Escape or the close button", async () => {
    const user = userEvent.setup();
    render(
      <ArtifactPartDirectory
        stage="calendar"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "打开部件目录" });
    await user.click(trigger);
    let dialog = screen.getByRole("dialog", { name: "全部部件" });
    expect(within(dialog).getByRole("button", { name: "关闭部件目录" })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "全部部件" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    dialog = screen.getByRole("dialog", { name: "全部部件" });
    await user.click(within(dialog).getByRole("button", { name: "关闭部件目录" }));
    expect(screen.queryByRole("dialog", { name: "全部部件" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
