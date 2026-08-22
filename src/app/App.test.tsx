import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as calendarStage from "../domain/calendar/compute-calendar";
import type { CalendarSnapshot } from "../domain/calendar/types";
import * as courseStage from "../domain/course/compute-course";
import * as heavenEarthStage from "../domain/heaven-earth/compute-heaven-earth";
import { deriveHeavenEarth } from "../domain/heaven-earth/policy";
import type { HeavenEarthSnapshot } from "../domain/heaven-earth/types";
import * as fourLessonsStage from "../domain/four-lessons/compute-four-lessons";
import * as heavenlyGeneralsStage from "../domain/heavenly-generals/compute-heavenly-generals";
import { deriveHeavenlyGenerals } from "../domain/heavenly-generals/policy";
import {
  HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  heavenlyGeneralsResultSource,
} from "../domain/heavenly-generals/result-guard";
import * as threeTransmissionsStage from "../domain/three-transmissions/compute-three-transmissions";
import { App } from "./App";

const artifactLoader = vi.hoisted(() => ({
  createRenderer: vi.fn(),
  loadArtifact: vi.fn(),
}));

vi.mock("../features/artifact-scene/three/load-artifact", () => ({
  createArtifactRenderer: (...args: unknown[]) => artifactLoader.createRenderer(...args),
  loadArtifact: (...args: unknown[]) => artifactLoader.loadArtifact(...args),
}));

beforeEach(() => {
  artifactLoader.createRenderer.mockReset();
  artifactLoader.loadArtifact.mockReset();
  artifactLoader.createRenderer.mockImplementation((canvas: HTMLCanvasElement) => ({
    domElement: canvas,
    dispose: vi.fn(),
  }));
  artifactLoader.loadArtifact.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function submitCourse(civilDateTime = "2024-02-10T14:30:00") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("日期与时间"), civilDateTime);
  await user.type(screen.getByLabelText("地点（选填）"), "北京");
  await user.type(screen.getByLabelText("起课事由"), "商务决策复盘");
  await user.click(screen.getByRole("button", { name: "建立起课上下文" }));
  return user;
}

async function openStageEvidence(user: ReturnType<typeof userEvent.setup>) {
  const toggle = screen.getByRole("button", { name: /阶段证据/ });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await user.click(toggle);
  }
}

async function openStageReview(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name }));
  await openStageEvidence(user);
}

async function openCalendarReview(user: ReturnType<typeof userEvent.setup>) {
  await openStageReview(user, /历法与月将，已完成/);
}

async function openFourLessonsReview(user: ReturnType<typeof userEvent.setup>) {
  await openStageReview(user, /四课生成，已完成/);
}

function expectCourseText(value: string) {
  for (const course of screen.getAllByRole("article", { name: "标准文字课式" })) {
    expect(course).toHaveTextContent(value);
  }
}

it("starts at input without a fake model or fake course", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
  expect(screen.getByRole("button", { name: "建立起课上下文" })).toBeVisible();
  expect(screen.getByLabelText("传统规则阶段")).toBeVisible();
  expect(screen.queryByLabelText("历法结果矩阵")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("标准文字课式")).not.toBeInTheDocument();
  expect(screen.queryByText(/三维模型占位/)).not.toBeInTheDocument();
});

it("runs the real offline stages through three transmissions, then navigates prior reviews", async () => {
  render(<App />);

  const user = await submitCourse();
  await openFourLessonsReview(user);

  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  expect(screen.getByRole("button", { name: /四课生成，已完成/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: /三传取法，已完成/ })).toHaveAttribute("data-status", "completed");

  await openCalendarReview(user);

  const matrix = screen.getByRole("list", { name: "历法结果矩阵" });
  for (const [label, value] of [
    ["年柱", "甲辰"],
    ["月柱", "丙寅"],
    ["日柱", "甲辰"],
    ["时柱", "辛未"],
  ]) {
    expect(within(matrix).getByRole("button", { name: new RegExp(`${label}.*${value}`) })).toBeVisible();
  }
  expect(within(matrix).getByRole("button", { name: /月将.*神后.*子/ })).toBeVisible();
  expect(screen.queryByRole("region", { name: "天地盘加临" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("标准文字课式")).not.toBeInTheDocument();
  expect(screen.queryByText(/三维模型占位/)).not.toBeInTheDocument();
});

it("restarts a completed workbench through a fresh empty input session", async () => {
  render(<App />);

  const user = await submitCourse();
  expect(screen.getByRole("region", { name: "起课上下文" })).toHaveTextContent("商务决策复盘");
  expect(screen.getByRole("region", { name: "三维阶段回看" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "重新起课" }));

  expect(screen.getByLabelText("日期与时间")).toHaveValue("");
  expect(screen.getByLabelText("起课事由")).toHaveValue("");
  expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "current");
});

it("opens the three-dimensional experience only for the complete guarded bundle", async () => {
  render(<App />);

  const user = await submitCourse();

  expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();
  expect(screen.getByRole("button", { name: "三维推演" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  for (const name of ["历法与月将", "天地盘加临", "四课生成", "三传取法", "天将排列", "复制结课"]) {
    expect(screen.getByRole("button", { name: `${name}，已完成` })).toBeVisible();
  }
  expect(screen.queryByLabelText(/进行中/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("aria-current", "page");
});

it("returns to heavenly generals and back to the completed course without recomputing", async () => {
  const runCourse = vi.spyOn(courseStage, "runCourseStage");
  render(<App />);
  const user = await submitCourse();

  expect(runCourse).toHaveBeenCalledTimes(1);
  await openStageReview(user, /天将排列，已完成/);
  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "复制结课，已完成" }));
  expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();
  expect(runCourse).toHaveBeenCalledTimes(1);
});

it("keeps the completed text course usable when the guarded artifact bundle is incomplete", async () => {
  const runCourse = courseStage.runCourseStage;
  vi.spyOn(courseStage, "runCourseStage").mockImplementation((session) => {
    const outcome = runCourse(session);
    if (!outcome.ok) return outcome;
    const plate = outcome.session.snapshots["heaven-earth"] as HeavenEarthSnapshot;
    return {
      ...outcome,
      session: {
        ...outcome.session,
        snapshots: {
          ...outcome.session.snapshots,
          "heaven-earth": {
            ...plate,
            value: { ...plate.value, palaces: plate.value.palaces.slice(1) },
          },
        },
      },
    };
  });
  render(<App />);

  await submitCourse();

  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
  expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
});

it("escapes from artifact loading failure to the ordinary text course", async () => {
  artifactLoader.loadArtifact.mockRejectedValueOnce(new Error("missing GLB"));
  render(<App />);
  const user = await submitCourse();

  expect(await screen.findByRole("alert")).toHaveTextContent("三维器物无法加载");
  await user.click(screen.getByRole("button", { name: "查看文字课式" }));

  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
});

it("keeps five valid upstream stages when final course projection fails", async () => {
  vi.spyOn(courseStage, "runCourseStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "COURSE_RESULT_GUARD_FAILED", message: "课式结果未通过完整性校验" },
    session,
  }));
  render(<App />);

  await submitCourse();

  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  for (const name of ["历法与月将", "天地盘加临", "四课生成", "三传取法", "天将排列"]) {
    expect(screen.getByRole("button", { name: `${name}，已完成` })).toBeVisible();
  }
  expect(screen.getByText("复制结课")).toHaveAttribute("data-status", "current");
  expect(screen.getByRole("alert")).toHaveTextContent("课式结果未通过完整性校验");
  expect(screen.queryByRole("article", { name: "标准文字课式" })).not.toBeInTheDocument();
});

it("replaces the completed course after a day-pillar correction and reset", async () => {
  render(<App />);
  const user = await submitCourse();

  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expectCourseText("甲辰");
  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正日柱" }), "乙巳");
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expectCourseText("乙巳");

  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*有效 乙巳.*人工修正/ }));
  await user.click(screen.getByRole("button", { name: "恢复日柱自动值" }));
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  expectCourseText("甲辰");
});

it("does not complete, render, or inject heavenly generals copied from another canonical plate", async () => {
  vi.spyOn(heavenlyGeneralsStage, "runHeavenlyGeneralsStage").mockImplementationOnce((session) => {
    const calendar = session.snapshots.calendar as CalendarSnapshot;
    const actualPlate = session.snapshots["heaven-earth"] as HeavenEarthSnapshot;
    const otherCalendar = structuredClone(calendar.value);
    otherCalendar.divinationHour.effective = otherCalendar.divinationHour.effective === "子" ? "丑" : "子";
    otherCalendar.divinationHour.source = "manual";
    const otherPlate = deriveHeavenEarth(otherCalendar);
    const value = deriveHeavenlyGenerals(
      otherCalendar.pillars.day.effective[0] as never,
      otherCalendar.divinationHour.effective,
      otherPlate,
    );
    return {
      ok: true,
      value,
      session: {
        ...session,
        snapshots: {
          ...session.snapshots,
          "heavenly-generals": {
            stage: "heavenly-generals",
            dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
            ruleId: HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
            source: heavenlyGeneralsResultSource(calendar.value, actualPlate.source),
            value,
          },
        },
      },
    };
  });
  render(<App />);

  const user = await submitCourse();

  expect(screen.getByText("天将排列")).toHaveAttribute("data-status", "current");
  expect(screen.queryByRole("button", { name: /天将排列，已完成/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "贵人起例 · 十二天将布列" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /三传取法，已完成/ }));
  expect(screen.getAllByText("待天将加临")).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "查看四课" }));
  expect(screen.getAllByText("待天将加临")).toHaveLength(4);
});

it("navigates from heavenly generals to every completed upstream review without recomputing", async () => {
  const runGenerals = vi.spyOn(heavenlyGeneralsStage, "runHeavenlyGeneralsStage");
  render(<App />);
  const user = await submitCourse();

  expect(runGenerals).toHaveBeenCalledTimes(1);
  await openStageReview(user, /三传取法，已完成/);
  expect(screen.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  await openStageReview(user, /四课生成，已完成/);
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  await openStageReview(user, /天地盘加临，已完成/);
  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  await openStageReview(user, /历法与月将，已完成/);
  expect(screen.getByRole("heading", { name: "历法与月将" })).toBeVisible();
  await openStageReview(user, /天将排列，已完成/);
  expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeVisible();
  expect(runGenerals).toHaveBeenCalledTimes(1);
});

it("navigates from three transmissions back to four lessons and the plate", async () => {
  render(<App />);

  const user = await submitCourse();
  await openFourLessonsReview(user);
  expect(screen.getByRole("region", { name: "四课生成" })).toBeInTheDocument();

  await openStageReview(user, /三传取法，已完成/);
  await user.click(screen.getByRole("button", { name: "查看天地盘" }));
  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeInTheDocument();
});

it("associates a three-transmissions failure with its stage and preserves four-lessons review", async () => {
  vi.spyOn(threeTransmissionsStage, "runThreeTransmissionsStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "THREE_TRANSMISSIONS_RESULT_INCOMPLETE", message: "三传结果不完整" },
    session,
  }));
  render(<App />);

  await submitCourse();

  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("三传结果不完整");
  expect(screen.getByText("三传取法", { selector: '[data-status="current"]' })).toBeInTheDocument();
});

it("associates a heavenly-generals failure with its stage and preserves three-transmissions review", async () => {
  vi.spyOn(heavenlyGeneralsStage, "runHeavenlyGeneralsStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "HEAVENLY_GENERALS_RESULT_INCOMPLETE", message: "天将结果不完整" },
    session,
  }));
  render(<App />);

  await submitCourse();

  expect(screen.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("天将结果不完整");
  expect(screen.getByText("天将排列", { selector: '[data-status="current"]' })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "贵人起例 · 十二天将布列" })).not.toBeInTheDocument();
});

it("returns from calendar to the guarded heaven-earth snapshot without recomputing", async () => {
  const runStage = vi.spyOn(heavenEarthStage, "runHeavenEarthStage");
  render(<App />);
  const user = await submitCourse();

  expect(runStage).toHaveBeenCalledTimes(1);
  await openCalendarReview(user);
  await openStageReview(user, /天地盘加临，已完成/);

  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  expect(screen.getByRole("button", { name: /天地盘加临，已完成/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: /四课生成，已完成/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /三传取法，已完成/ })).toBeVisible();
  expect(runStage).toHaveBeenCalledTimes(1);
});

it("navigates to prior snapshots without recomputing four lessons", async () => {
  const runStage = vi.spyOn(fourLessonsStage, "runFourLessonsStage");
  render(<App />);
  const user = await submitCourse();

  expect(runStage).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /天地盘加临，已完成/ }));
  await user.click(screen.getByRole("button", { name: /四课生成，已完成/ }));
  expect(runStage).toHaveBeenCalledTimes(1);
});

it("keeps valid upstream snapshots when four-lessons generation fails", async () => {
  const marker = "FOUR_LESSONS_FAILURE_SESSION_MARKER";
  vi.spyOn(fourLessonsStage, "runFourLessonsStage").mockImplementationOnce((session) => {
    const failedSession = structuredClone(session);
    const plate = failedSession.snapshots["heaven-earth"] as HeavenEarthSnapshot;
    failedSession.snapshots["heaven-earth"] = {
      ...plate,
      value: {
        ...plate.value,
        evidence: plate.value.evidence.map((step) => (
          step.field === "palace.巳" ? { ...step, conclusion: marker } : step
        )),
      },
    };
    return {
      ok: false,
      error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整" },
      session: failedSession,
    };
  });
  render(<App />);

  await submitCourse();

  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("四课结果不完整");
  expect(screen.getByText(marker)).toBeVisible();
  expect(screen.getByText("四课生成")).toHaveAttribute("data-status", "current");
});

it("completes the rail only after every valid stage snapshot exists", async () => {
  render(<App />);

  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "current");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "locked");

  await submitCourse();

  expect(screen.getByRole("button", { name: /历法与月将，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByRole("button", { name: /天地盘加临，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByRole("button", { name: /四课生成，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByRole("button", { name: /三传取法，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByRole("button", { name: /天将排列，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.getByRole("button", { name: /复制结课，已完成/ })).toHaveAttribute("data-status", "completed");
  expect(screen.queryByLabelText(/进行中/)).not.toBeInTheDocument();
});

it("rebuilds heaven-earth after a calendar correction and returns to its review", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /月将.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正月将" }), "亥");

  await openFourLessonsReview(user);
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /天地盘加临，已完成/ }));
  expect(screen.getByText(/登明.*亥.*加临.*未/)).toBeVisible();
});

it("reruns four lessons after a divination-hour correction", async () => {
  const runStage = vi.spyOn(fourLessonsStage, "runFourLessonsStage");
  render(<App />);
  const user = await submitCourse();

  expect(runStage).toHaveBeenCalledTimes(1);
  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /占时.*自动.*未.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正占时" }), "申");

  expect(runStage).toHaveBeenCalledTimes(2);
  const correctedSession = runStage.mock.calls[1]![0];
  const correctedPlate = correctedSession.snapshots["heaven-earth"] as HeavenEarthSnapshot | undefined;
  expect(correctedSession.snapshots.calendar?.value.divinationHour.effective).toBe("申");
  expect(correctedPlate?.value.divinationHour.branch).toBe("申");
  await openFourLessonsReview(user);
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
  expect(screen.getByRole("button", { name: /一课，上神午，下神甲/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /四课生成，已完成/ })).toHaveAttribute("aria-current", "page");
});

it("keeps the latest calendar and associates a heaven-earth failure with the stage", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);
  vi.spyOn(heavenEarthStage, "runHeavenEarthStage").mockImplementationOnce((session) => ({
    ok: false,
    error: { code: "HEAVEN_EARTH_RESULT_INCOMPLETE", message: "天地盘结果不完整" },
    session,
  }));
  await user.click(screen.getByRole("button", { name: /月将.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正月将" }), "亥");

  expect(screen.getByRole("list", { name: "历法结果矩阵" })).toBeVisible();
  expect(screen.getByRole("button", { name: /月将.*有效 登明.*亥.*人工修正/ })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /月将.*有效 登明.*亥.*人工修正/ }));
  expect(screen.getByRole("combobox", { name: "修正月将" })).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("alert")).toHaveTextContent("天地盘结果不完整");
  expect(screen.queryByRole("region", { name: "天地盘加临" })).not.toBeInTheDocument();
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "current");
});

it("offers no independent correction or approval controls on the heaven-earth review", async () => {
  render(<App />);

  const user = await submitCourse();
  await openStageReview(user, /天地盘加临，已完成/);

  expect(screen.getByRole("region", { name: "天地盘加临" })).toBeVisible();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /修正|恢复|批准|旋转|拖动/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/逐宫修正/)).not.toBeInTheDocument();
});

it("reruns the full stage for a day-pillar correction and reset", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);

  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正日柱" }), "乙巳");

  await openCalendarReview(user);

  let dayPillar = screen.getByRole("button", { name: /日柱.*自动 甲辰.*有效 乙巳.*人工修正/ });
  expect(within(dayPillar).getByText("自动：甲辰")).toBeVisible();
  expect(within(dayPillar).getByText("有效：乙巳")).toBeVisible();
  expect(within(dayPillar).getByText("人工修正")).toBeVisible();

  await user.click(dayPillar);
  await user.click(screen.getByRole("button", { name: "恢复日柱自动值" }));

  await openCalendarReview(user);

  dayPillar = screen.getByRole("button", { name: /日柱.*自动 甲辰.*有效 甲辰.*自动计算/ });
  expect(within(dayPillar).getByText("有效：甲辰")).toBeVisible();
  expect(screen.queryByRole("button", { name: "恢复日柱自动值" })).not.toBeInTheDocument();
});

it("keeps the prior valid snapshot on a failed correction and clears the error after success", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);

  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰.*自动计算/ }));
  const correction = screen.getByRole("combobox", { name: "修正日柱" });
  correction.append(new Option("甲丑", "甲丑"));
  fireEvent.change(correction, { target: { value: "甲丑" } });

  const error = screen.getByRole("alert");
  const failedSelect = screen.getByRole("combobox", { name: "修正日柱" });
  expect(error).toHaveAttribute("id", "calendar-correction-dayPillar-error");
  expect(error).toHaveTextContent("人工修正值无效");
  expect(failedSelect).toHaveAttribute("aria-invalid", "true");
  expect(failedSelect).toHaveAttribute("aria-errormessage", error.id);
  expect(screen.getByRole("list", { name: "历法结果矩阵" })).toBeVisible();
  expect(screen.getByRole("button", { name: /日柱.*自动 甲辰.*有效 甲辰.*自动计算/ })).toBeVisible();

  await user.click(screen.getByRole("button", { name: /月柱.*自动 丙寅/ }));
  expect(screen.getByRole("combobox", { name: "修正月柱" })).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByText("人工修正值无效")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正日柱" }), "乙巳");

  await openCalendarReview(user);

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /日柱.*自动 甲辰.*有效 乙巳.*人工修正/ })).toBeVisible();
});

it("clears a field correction error after reset and after a new successful submit", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);

  await user.click(screen.getByRole("button", { name: /日柱.*自动 甲辰.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正日柱" }), "乙巳");

  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*有效 乙巳.*人工修正/ }));

  let correction = screen.getByRole("combobox", { name: "修正日柱" });
  correction.append(new Option("甲丑", "甲丑"));
  fireEvent.change(correction, { target: { value: "甲丑" } });
  expect(screen.getByRole("alert")).toHaveTextContent("人工修正值无效");

  await user.click(screen.getByRole("button", { name: "恢复日柱自动值" }));

  await openCalendarReview(user);
  await user.click(screen.getByRole("button", { name: /日柱.*有效 甲辰.*自动计算/ }));

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /日柱.*有效 甲辰.*自动计算/ })).toBeVisible();

  correction = screen.getByRole("combobox", { name: "修正日柱" });
  correction.append(new Option("甲丑", "甲丑"));
  fireEvent.change(correction, { target: { value: "甲丑" } });
  expect(screen.getByRole("alert")).toHaveTextContent("人工修正值无效");

  await user.click(screen.getByRole("button", { name: "重新起课" }));
  await user.type(screen.getByLabelText("日期与时间"), "2024-02-10T14:30:00");
  await user.type(screen.getByLabelText("起课事由"), "商务决策复盘");
  await user.click(screen.getByRole("button", { name: "建立起课上下文" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await openFourLessonsReview(user);
  expect(screen.getByRole("region", { name: "四课生成" })).toBeVisible();
});

it("keeps an out-of-range submission in the input state with the stable domain message", async () => {
  render(<App />);

  await submitCourse("2101-01-01T00:00:00");

  expect(screen.getByRole("alert")).toHaveTextContent("仅支持 1900–2100 年的北京时间");
  expect(screen.getByRole("heading", { name: "起课输入" })).toBeVisible();
  expect(screen.queryByLabelText("历法结果矩阵")).not.toBeInTheDocument();
  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "current");
});

it("clears prior snapshots when a new parsed submission fails the calendar stage", async () => {
  render(<App />);
  const user = await submitCourse();

  await user.click(screen.getByRole("button", { name: "重新起课" }));
  vi.spyOn(calendarStage, "runCalendarStage").mockReturnValueOnce({
    ok: false,
    error: { code: "CALENDAR_ADAPTER_FAILURE", message: "历法数据读取失败" },
  });
  const dateTime = screen.getByLabelText("日期与时间");
  await user.clear(dateTime);
  await user.type(dateTime, "2024-02-11T14:30:00");
  await user.type(screen.getByLabelText("起课事由"), "新的起课事由");
  await user.click(screen.getByRole("button", { name: "建立起课上下文" }));

  expect(screen.getByRole("alert")).toHaveTextContent("历法数据读取失败");
  expect(screen.queryByLabelText("历法结果矩阵")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "天地盘加临" })).not.toBeInTheDocument();
  expect(screen.getByText("历法与月将")).toHaveAttribute("data-status", "current");
  expect(screen.getByText("天地盘加临")).toHaveAttribute("data-status", "locked");
});

it("preserves prior snapshots when a snapshot-bearing correction fails the calendar stage", async () => {
  render(<App />);
  const user = await submitCourse();

  await openCalendarReview(user);
  vi.spyOn(calendarStage, "runCalendarStage").mockReturnValueOnce({
    ok: false,
    error: { code: "CALENDAR_ADAPTER_FAILURE", message: "历法数据读取失败" },
  });
  await user.click(screen.getByRole("button", { name: /月将.*自动计算/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: "修正月将" }), "亥");

  expect(screen.getByRole("alert")).toHaveTextContent("历法数据读取失败");
  expect(screen.getByRole("list", { name: "历法结果矩阵" })).toBeVisible();
  expect(screen.getByRole("button", { name: /月将.*有效 神后.*子.*自动计算/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /天地盘加临，已完成/ })).toHaveAttribute("data-status", "completed");
});

it("collapses each shell panel and unmounts its content", async () => {
  const user = userEvent.setup();
  render(<App />);

  const inputToggle = screen.getByRole("button", { name: "起课输入" });
  await user.click(inputToggle);
  expect(inputToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("日期与时间")).not.toBeInTheDocument();

  const railToggle = screen.getByRole("button", { name: "推演依据" });
  await user.click(railToggle);
  expect(railToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("传统规则阶段")).not.toBeInTheDocument();
});
