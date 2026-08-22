import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";
import { ArtifactPartDirectory } from "./ArtifactPartDirectory";

afterEach(cleanup);

describe("ArtifactPartDirectory", () => {
  it("lists each of the 22 parts once across six groups with the current group first and expanded", async () => {
    const user = userEvent.setup();
    render(
      <ArtifactPartDirectory
        stage="heaven-earth"
        descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
        onFocus={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "打开部件目录" }));

    const dialog = screen.getByRole("dialog", { name: "全部部件" });
    const groups = within(dialog).getAllByTestId("artifact-part-group");
    const entries = dialog.querySelectorAll<HTMLButtonElement>("button[data-part-id]");
    expect(groups).toHaveLength(6);
    expect(within(groups[0]).getByRole("button", { name: "天地盘加临" })).toHaveAttribute("aria-expanded", "true");
    expect(entries).toHaveLength(22);
    expect(new Set([...entries].map((entry) => entry.dataset.partId)).size).toBe(22);
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
    await user.click(screen.getByRole("button", { name: "打开部件目录" }));

    await user.click(screen.getByRole("button", { name: /天盘/ }));

    expect(onFocus).toHaveBeenCalledWith("plate/heaven");
    expect(screen.queryByRole("dialog", { name: "全部部件" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("当前聚焦：天盘");
  });
});
