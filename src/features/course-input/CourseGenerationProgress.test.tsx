import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CourseGenerationProgress } from "./CourseGenerationProgress";

afterEach(() => vi.useRealTimers());

it("announces the six real stages and completes once", () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<CourseGenerationProgress reducedMotion={false} onComplete={onComplete} />);

  expect(screen.getByRole("status")).toHaveTextContent("历法与月将");
  expect(screen.getAllByRole("listitem")).toHaveLength(6);

  act(() => vi.advanceTimersByTime(720));

  expect(onComplete).toHaveBeenCalledOnce();
});

it("finishes immediately when reduced motion is requested", () => {
  const onComplete = vi.fn();
  render(<CourseGenerationProgress reducedMotion onComplete={onComplete} />);

  expect(onComplete).toHaveBeenCalledOnce();
});
