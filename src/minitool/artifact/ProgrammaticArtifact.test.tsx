import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { ProgrammaticArtifact } from "./ProgrammaticArtifact";

const callbacks = vi.hoisted(() => ({
  ready: undefined as (() => void) | undefined,
  unavailable: undefined as (() => void) | undefined,
}));

vi.mock("./create-parity-artifact", () => ({
  mountParityArtifact: vi.fn(
    (_canvas: HTMLCanvasElement, _source: ArtifactSourceResults, _url: string, onUnavailable: () => void, onReady: () => void) => {
      callbacks.unavailable = onUnavailable;
      callbacks.ready = onReady;
      return { resize: vi.fn(), dispose: vi.fn() };
    },
  ),
}));

beforeEach(() => {
  callbacks.ready = undefined;
  callbacks.unavailable = undefined;
});

afterEach(cleanup);

describe("ProgrammaticArtifact readiness", () => {
  it("keeps the loading state until the board texture becomes visible", () => {
    render(<ProgrammaticArtifact source={{} as ArtifactSourceResults} onUnavailable={vi.fn()} />);

    expect(screen.getByText("正在生成三维玉盘…")).toBeTruthy();
    expect(screen.queryByText("拖动天盘转地支 · 外圈旋转 · 双指缩放")).toBeNull();

    act(() => callbacks.ready!());

    expect(screen.queryByText("正在生成三维玉盘…")).toBeNull();
    expect(screen.getByText("拖动天盘转地支 · 外圈旋转 · 双指缩放")).toBeTruthy();
  });

  it("falls back from loading when the texture fails without showing ready", () => {
    const onUnavailable = vi.fn();
    render(<ProgrammaticArtifact source={{} as ArtifactSourceResults} onUnavailable={onUnavailable} />);

    act(() => callbacks.unavailable!());

    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(screen.getByText("模型不可用，已切换文字课式")).toBeTruthy();
    expect(screen.queryByText("拖动天盘转地支 · 外圈旋转 · 双指缩放")).toBeNull();
  });
});
