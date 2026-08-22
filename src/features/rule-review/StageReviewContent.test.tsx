import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CalendarResult } from "../../domain/calendar/types";
import type { CourseResult } from "../../domain/course/types";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import type { HeavenEarthResult } from "../../domain/heaven-earth/types";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { StageReviewContent } from "./StageReviewContent";

const source: ArtifactSourceResults = {
  calendar: referenceSession.snapshots.calendar!.value as CalendarResult,
  plate: referenceSession.snapshots["heaven-earth"]!.value as HeavenEarthResult,
  lessons: referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult,
  generals: referenceSession.snapshots["heavenly-generals"]!.value as HeavenlyGeneralsResult,
  course: referenceSession.snapshots.course!.value as CourseResult,
};

afterEach(cleanup);

it.each([
  ["calendar", () => screen.getByText("历法与月将")],
  ["heaven-earth", () => screen.getByText("天地盘加临")],
  ["four-lessons", () => screen.getByLabelText("四课生成")],
  ["three-transmissions", () => screen.getByLabelText("三传取法")],
  ["heavenly-generals", () => screen.getByText("贵人起例 · 十二天将布列")],
  ["course", () => screen.getByLabelText("标准文字课式")],
] as const)("renders the existing %s review", (stage, review) => {
  render(<StageReviewContent stage={stage} source={source} onSelectStage={vi.fn()} />);

  expect(review()).toBeVisible();
});
