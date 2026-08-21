import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactTimeline } from "./ArtifactTimeline";

afterEach(cleanup);

function renderTimeline(timeMs = 0, playing = false) {
  const callbacks = {
    onSeek: vi.fn(),
    onTogglePlayback: vi.fn(),
    onResetCamera: vi.fn(),
    onShowCourse: vi.fn(),
  };
  render(<ArtifactTimeline timeMs={timeMs} playing={playing} {...callbacks} />);
  return callbacks;
}

describe("ArtifactTimeline", () => {
  it("exposes the complete deterministic control surface", async () => {
    const user = userEvent.setup();
    const callbacks = renderTimeline();

    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("min", "0");
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("max", "12500");
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("step", "1");
    await user.click(screen.getByRole("button", { name: "重置视角" }));
    await user.click(screen.getByRole("button", { name: "查看文字课式" }));

    expect(callbacks.onResetCamera).toHaveBeenCalledOnce();
    expect(callbacks.onShowCourse).toHaveBeenCalledOnce();
  });

  it("seeks the engraved scale to exact adjacent stage boundaries", async () => {
    const user = userEvent.setup();
    const callbacks = renderTimeline(5_400);

    await user.click(screen.getByRole("button", { name: "上一阶段" }));
    await user.click(screen.getByRole("button", { name: "下一阶段" }));

    expect(callbacks.onSeek).toHaveBeenNthCalledWith(1, 3_200);
    expect(callbacks.onSeek).toHaveBeenNthCalledWith(2, 7_600);
  });

  it("sends integer range seeks and playback intent without hidden replay", async () => {
    const user = userEvent.setup();
    const callbacks = renderTimeline(8_450, true);

    await user.click(screen.getByRole("button", { name: "暂停推演" }));
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "10300" } });

    expect(callbacks.onTogglePlayback).toHaveBeenCalledOnce();
    expect(callbacks.onSeek).toHaveBeenLastCalledWith(10_300);
  });
});
