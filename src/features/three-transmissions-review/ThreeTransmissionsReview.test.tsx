import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { ThreeTransmissionsReview } from "./ThreeTransmissionsReview";

const result = referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult;
const sheHaiResult = {
  dayPillar: "庚子",
  plateOffset: 2,
  method: "涉害",
  subtype: "见机",
  variants: [],
  transmissions: [
    { position: "initial", label: "初传", branch: "午", relation: "官鬼", derivation: "涉害取午发用为初传", evidenceIds: ["initial"] },
    { position: "middle", label: "中传", branch: "辰", relation: "父母", derivation: "从地盘午宫查得天盘上神辰，取为中传", evidenceIds: ["middle"] },
    { position: "final", label: "末传", branch: "寅", relation: "妻财", derivation: "从地盘辰宫查得天盘上神寅，取为末传", evidenceIds: ["final"] },
  ],
  evidence: [
    { id: "plate", ruleId: "three-transmissions/plate-classification-v1", phase: "plate", input: "共享天地盘", conclusion: "天地盘偏移2位" },
    { id: "lessons", ruleId: "three-transmissions/lesson-deduplication-v1", phase: "lessons", input: "共享四课", conclusion: "四课去重后为4课" },
    { id: "candidates", ruleId: "three-transmissions/vertical-relations-v1", phase: "candidates", input: "共享候选", conclusion: "候选为一课、三课" },
    {
      id: "selection",
      ruleId: "three-transmissions/shehai-path-v1",
      phase: "selection",
      input: "候选午、子逐宫涉害",
      conclusion: "午四重，取午发用",
      details: [
        { kind: "shehai-palace", candidateLesson: "first", earth: "寅", branchElement: "木", residentStems: ["甲", "乙"], increment: 2, total: 2 },
        { kind: "shehai-palace", candidateLesson: "first", earth: "卯", branchElement: "木", residentStems: ["乙"], increment: 1, total: 3 },
      ],
    },
    { id: "initial", ruleId: "three-transmissions/initial-v1", phase: "initial", transmission: "initial", input: "一课上神午", conclusion: "涉害取午发用为初传" },
    { id: "initial-relation", ruleId: "three-transmissions/six-relation-v1", phase: "relation", transmission: "initial", input: "庚与午", conclusion: "午六亲为官鬼" },
    { id: "middle", ruleId: "three-transmissions/middle-v1", phase: "middle", transmission: "middle", input: "初传午", conclusion: "从地盘午宫查得天盘上神辰，取为中传" },
    { id: "middle-relation", ruleId: "three-transmissions/six-relation-v1", phase: "relation", transmission: "middle", input: "庚与辰", conclusion: "辰六亲为父母" },
    { id: "final", ruleId: "three-transmissions/final-v1", phase: "final", transmission: "final", input: "中传辰", conclusion: "从地盘辰宫查得天盘上神寅，取为末传" },
    { id: "final-relation", ruleId: "three-transmissions/six-relation-v1", phase: "relation", transmission: "final", input: "庚与寅", conclusion: "寅六亲为妻财" },
  ],
} as const satisfies ThreeTransmissionsResult;

afterEach(cleanup);

describe("ThreeTransmissionsReview", () => {
  it("renders the traditional initial-middle-final review structure", () => {
    render(
      <ThreeTransmissionsReview
        result={result}
        onReviewFourLessons={vi.fn()}
        onReviewHeavenEarth={vi.fn()}
      />,
    );

    const review = screen.getByRole("region", { name: "三传取法" });
    const header = screen.getByRole("banner");
    expect(review.firstElementChild).toBe(header);
    expect(screen.getByRole("heading", { name: /九宗门 · 三传取法/ })).toBeInTheDocument();
    expect(within(header).getByText("日柱")).toBeVisible();
    expect(within(header).getByText(result.dayPillar)).toBeVisible();
    expect(within(header).getByText("主课格")).toBeVisible();
    expect(within(header).getByText(result.method)).toBeVisible();
    expect(within(header).getByText("细课格")).toBeVisible();
    expect(within(header).getByText(result.subtype!)).toBeVisible();

    const list = screen.getByRole("list", { name: "三传" });
    const transmissions = within(list).getAllByRole("button");
    expect(list.children).toHaveLength(3);
    expect(transmissions.map((button) => button.textContent)).toEqual([
      expect.stringContaining("初传"),
      expect.stringContaining("中传"),
      expect.stringContaining("末传"),
    ]);

    for (const [index, transmission] of result.transmissions.entries()) {
      expect(within(transmissions[index]).getByText(transmission.branch)).toBeInTheDocument();
      expect(within(transmissions[index]).getByText(transmission.relation)).toBeInTheDocument();
      expect(within(transmissions[index]).getByText(transmission.derivation)).toBeVisible();
    }
    expect(screen.getAllByText("待天将加临")).toHaveLength(3);
  });

  it("keeps shared and transmission evidence isolated by the selected transmission", async () => {
    const user = userEvent.setup();
    render(
      <ThreeTransmissionsReview
        result={sheHaiResult}
        onReviewFourLessons={vi.fn()}
        onReviewHeavenEarth={vi.fn()}
      />,
    );

    const initialEvidence = screen.getByRole("complementary", { name: "初传证据" });
    expect(within(initialEvidence).getAllByRole("listitem")).toHaveLength(6);
    for (const input of ["共享天地盘", "共享四课", "共享候选", "候选午、子逐宫涉害", "一课上神午", "庚与午"]) {
      expect(within(initialEvidence).getByText(input)).toBeVisible();
    }
    expect(within(initialEvidence).queryByText("初传午")).not.toBeInTheDocument();
    expect(within(initialEvidence).queryByText("中传辰")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /中传/ }));
    const middleEvidence = screen.getByRole("complementary", { name: "中传证据" });
    expect(within(middleEvidence).getAllByRole("listitem")).toHaveLength(2);
    for (const input of ["初传午", "庚与辰"]) expect(within(middleEvidence).getByText(input)).toBeVisible();
    for (const input of ["共享天地盘", "共享四课", "共享候选", "候选午、子逐宫涉害", "一课上神午", "中传辰", "庚与寅"]) {
      expect(within(middleEvidence).queryByText(input)).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: /末传/ }));
    const finalEvidence = screen.getByRole("complementary", { name: "末传证据" });
    expect(within(finalEvidence).getAllByRole("listitem")).toHaveLength(2);
    for (const input of ["中传辰", "庚与寅"]) expect(within(finalEvidence).getByText(input)).toBeVisible();
    for (const input of ["共享天地盘", "共享四课", "共享候选", "候选午、子逐宫涉害", "一课上神午", "初传午", "庚与辰"]) {
      expect(within(finalEvidence).queryByText(input)).not.toBeInTheDocument();
    }
  });

  it("returns focus after close and exposes upstream reviews", async () => {
    const onReviewFourLessons = vi.fn();
    const onReviewHeavenEarth = vi.fn();
    const user = userEvent.setup();
    render(
      <ThreeTransmissionsReview
        result={sheHaiResult}
        onReviewFourLessons={onReviewFourLessons}
        onReviewHeavenEarth={onReviewHeavenEarth}
      />,
    );

    expect(screen.getByRole("heading", { name: "初传证据" })).toBeVisible();
    expect(screen.getByText("共享天地盘")).toBeVisible();

    const middle = screen.getByRole("button", { name: /中传/ });
    await user.click(middle);
    expect(screen.getByRole("heading", { name: "中传证据" })).toBeVisible();
    const middleEvidence = screen.getByRole("complementary", { name: "中传证据" });
    expect(within(middleEvidence).getByText(sheHaiResult.transmissions[1].derivation)).toBeVisible();
    expect(within(middleEvidence).queryByText("共享天地盘")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭证据" }));
    expect(middle).toHaveFocus();

    await user.click(middle);
    await user.click(screen.getByRole("button", { name: "查看四课" }));
    await user.click(screen.getByRole("button", { name: "查看天地盘" }));
    expect(onReviewFourLessons).toHaveBeenCalledOnce();
    expect(onReviewHeavenEarth).toHaveBeenCalledOnce();
  });

  it("renders every palace detail used for a she hai selection", () => {
    render(
      <ThreeTransmissionsReview
        result={sheHaiResult}
        onReviewFourLessons={vi.fn()}
        onReviewHeavenEarth={vi.fn()}
      />,
    );

    const evidence = screen.getByRole("complementary", { name: "初传证据" });
    for (const detail of sheHaiResult.evidence[3].details) {
      expect(within(evidence).getByText(new RegExp(`${detail.earth}宫`))).toBeVisible();
      expect(within(evidence).getByText(`寄干${detail.residentStems.join("、")}`)).toBeVisible();
      expect(within(evidence).getByText(`涉害 +${detail.increment}`)).toBeVisible();
      expect(within(evidence).getByText(`累计 ${detail.total}`)).toBeVisible();
    }
  });
});
