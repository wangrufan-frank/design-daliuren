import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { toCourseSheetModel } from "./view-model";
import { CourseSheet } from "./CourseSheet";

it("renders the confirmed reference structure", () => {
  render(<CourseSheet model={toCourseSheetModel(referenceSession)} />);
  for (const heading of ["三传格局", "四课盘局", "天地盘式", "起课辅助"]) {
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect(screen.getByText("初传")).toBeVisible();
  expect(screen.getByText("四课")).toBeVisible();
});
