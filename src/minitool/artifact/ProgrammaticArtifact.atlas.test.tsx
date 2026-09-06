import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ElementAtlasProvider } from "../../features/element-atlas/ElementAtlas";
import type { AtlasId } from "../../features/element-atlas/entries";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { referenceSession } from "../../test/reference-session";
import { ProgrammaticArtifact } from "./ProgrammaticArtifact";

const mounted = vi.hoisted(() => ({ selected: undefined as ((id: AtlasId) => void) | undefined, count: 0, disposed: 0 }));
vi.mock("./create-parity-artifact", () => ({
  mountParityArtifact: (_canvas: HTMLCanvasElement, _source: ArtifactSourceResults, _url: string, _unavailable: () => void, ready: () => void, selected: (id: AtlasId) => void) => {
    mounted.selected = selected;
    mounted.count += 1;
    ready();
    return { resize: () => {}, dispose: () => { mounted.disposed += 1; } };
  },
}));
afterEach(cleanup);

it("opens the picked card and keeps the rendered model mounted while reading and closing", async () => {
  const user = userEvent.setup();
  const source = { course: referenceSession.snapshots.course!.value } as ArtifactSourceResults;
  mounted.count = 0;
  mounted.disposed = 0;
  render(<ElementAtlasProvider course={source.course}><ProgrammaticArtifact source={source} onUnavailable={() => {}} /></ElementAtlasProvider>);
  expect(screen.getByLabelText("三维推演模型")).toHaveAttribute("data-model-ready", "true");
  expect(mounted.selected).toBeTypeOf("function");
  act(() => mounted.selected!("zi"));
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mounted.count).toBe(1);
  expect(mounted.disposed).toBe(0);
});
