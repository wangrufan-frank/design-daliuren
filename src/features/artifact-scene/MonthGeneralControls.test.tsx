import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthGeneralControls } from "./MonthGeneralControls";

describe("MonthGeneralControls", () => {
  it("keeps both step buttons unavailable until the demonstration completes", () => {
    render(<MonthGeneralControls enabled={false} phase="locked" detent={0} onStep={vi.fn()} />);

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "月将环向右一宫" })).toBeDisabled();
  });

  it("routes both buttons through one-detent step events", async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<MonthGeneralControls enabled phase="seated" detent={6} onStep={onStep} />);

    await user.click(screen.getByRole("button", { name: "月将环向左一宫" }));
    await user.click(screen.getByRole("button", { name: "月将环向右一宫" }));

    expect(onStep).toHaveBeenNthCalledWith(1, -1);
    expect(onStep).toHaveBeenNthCalledWith(2, 1);
  });
});

afterEach(cleanup);
