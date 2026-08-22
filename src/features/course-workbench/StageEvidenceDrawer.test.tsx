import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { reviewStageFor } from "../artifact-scene/timeline/review-stages";
import { StageEvidenceDrawer } from "./StageEvidenceDrawer";

afterEach(cleanup);

it("keeps selected evidence unmounted until the disclosure opens", async () => {
  const user = userEvent.setup();
  render(
    <StageEvidenceDrawer stage={reviewStageFor("calendar")}>
      <p>历法证据内容</p>
    </StageEvidenceDrawer>,
  );

  const trigger = screen.getByRole("button", { name: "查看阶段证据" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("历法证据内容")).not.toBeInTheDocument();

  await user.click(trigger);

  expect(screen.getByRole("dialog", { name: "历法与月将证据" })).toBeVisible();
  expect(screen.getByText("历法证据内容")).toBeVisible();
});
