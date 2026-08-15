import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the product title and the first rule stage", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
    expect(screen.getByText("起课输入")).toBeVisible();
  });
});
