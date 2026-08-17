import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { EarthlyBranch } from "../../domain/chart/types";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import { generalForHeaven } from "../../domain/heavenly-generals/policy";
import type { HeavenlyGeneralsEvidenceStep, HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";

interface HeavenlyGeneralsReviewProps {
  result: HeavenlyGeneralsResult;
  fourLessons: FourLessonsResult;
  threeTransmissions: ThreeTransmissionsResult;
  onReviewCalendar: () => void;
  onReviewHeavenEarth: () => void;
  onReviewFourLessons: () => void;
  onReviewThreeTransmissions: () => void;
}

const VISUAL_EARTH_ORDER = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;

const EVIDENCE_PHASES: Array<[HeavenlyGeneralsEvidenceStep["phase"], string]> = [
  ["day-night", "昼夜"],
  ["noble-branch", "贵人天盘"],
  ["noble-palace", "贵人落宫"],
  ["direction", "布将方向"],
  ["placement", "十二天将"],
];

export function HeavenlyGeneralsReview({
  result,
  fourLessons,
  threeTransmissions,
  onReviewCalendar,
  onReviewHeavenEarth,
  onReviewFourLessons,
  onReviewThreeTransmissions,
}: HeavenlyGeneralsReviewProps) {
  const [selectedEarth, setSelectedEarth] = useState<EarthlyBranch>(VISUAL_EARTH_ORDER[0]);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const placementsByEarth = new Map(result.placements.map((placement) => [placement.earth, placement]));
  const palaces = VISUAL_EARTH_ORDER.map((earth) => placementsByEarth.get(earth)!);
  const selectedPalace = placementsByEarth.get(selectedEarth)!;

  function selectPalace(earth: EarthlyBranch, trigger: HTMLButtonElement) {
    evidenceTrigger.current = trigger;
    setSelectedEarth(earth);
    setEvidenceOpen(true);
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    buttonRefs.current[(index + direction + palaces.length) % palaces.length]?.focus();
  }

  function closeEvidence() {
    const selectedIndex = VISUAL_EARTH_ORDER.findIndex((earth) => earth === selectedEarth);
    (evidenceTrigger.current ?? buttonRefs.current[selectedIndex])?.focus();
    setEvidenceOpen(false);
  }

  return (
    <section className="heavenly-generals-review" aria-labelledby="heavenly-generals-review-title">
      <header className="heavenly-generals-review__summary" data-heavenly-generals-section="summary">
        <p>规则阶段 05 / 06</p>
        <h2 id="heavenly-generals-review-title">贵人起例 · 十二天将布列</h2>
        <dl>
          <div><dt>日干</dt><dd>{result.dayStem}</dd></div>
          <div><dt>占时</dt><dd>{result.divinationHour}</dd></div>
          <div><dt>昼夜</dt><dd>昼夜：{result.dayNight === "day" ? "昼贵" : "夜贵"}</dd></div>
          <div><dt>贵人</dt><dd>天盘{result.nobleHeaven}临地盘{result.nobleEarth}</dd></div>
          <div><dt>布将方向</dt><dd>{result.direction === "forward" ? "顺布" : "逆布"}</dd></div>
        </dl>
      </header>

      <div className="heavenly-generals-review__plate-region" data-heavenly-generals-section="plate">
        <p className="heavenly-generals-review__orientation">上南 · 下北 · 左东 · 右西</p>
        <div className="heavenly-generals-review__plate-layout">
          <ul className="heavenly-generals-review__plate-grid heavenly-generals-review__plate" aria-label="十二天将方盘">
            {palaces.map((palace, index) => {
              const isNoble = palace.earth === result.nobleEarth;
              return (
                <li key={palace.earth}>
                  <button
                    ref={(button) => { buttonRefs.current[index] = button; }}
                    type="button"
                    className="heavenly-generals-review__palace"
                    data-earth={palace.earth}
                    data-noble={isNoble}
                    aria-label={`${palace.earth}宫，天盘${palace.heaven}，${palace.general}${isNoble ? "，贵人宫" : ""}`}
                    aria-pressed={selectedEarth === palace.earth}
                    aria-expanded={evidenceOpen && selectedEarth === palace.earth}
                    aria-controls="heavenly-generals-evidence"
                    onClick={(event) => selectPalace(palace.earth, event.currentTarget)}
                    onFocus={(event) => selectPalace(palace.earth, event.currentTarget)}
                    onKeyDown={(event) => moveFocus(event, index)}
                  >
                    <strong className="heavenly-generals-review__general">{palace.general}</strong>
                    <span className="heavenly-generals-review__branch">天盘 {palace.heaven}</span>
                    <span className="heavenly-generals-review__branch">地盘 {palace.earth}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="heavenly-generals-review__center">
            <span>贵人落宫</span>
            <strong>天盘{result.nobleHeaven}临地盘{result.nobleEarth}</strong>
            <small>{result.direction === "forward" ? "顺布十二将" : "逆布十二将"}</small>
          </div>
        </div>
      </div>

      <div className="heavenly-generals-review__four-lessons" data-heavenly-generals-section="four-lessons">
        <h3>四课天将</h3>
        <ul aria-label="四课天将">
          {fourLessons.lessons.map((lesson) => (
            <li key={lesson.id} aria-label={`${lesson.label}，上神${lesson.upper}，天将${generalForHeaven(result, lesson.upper)}`}>
              <span>{lesson.label}</span>
              <strong>{lesson.upper}</strong>
              <b>{generalForHeaven(result, lesson.upper)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="heavenly-generals-review__three-transmissions" data-heavenly-generals-section="three-transmissions">
        <h3>三传天将</h3>
        <ul aria-label="三传天将">
          {threeTransmissions.transmissions.map((transmission) => (
            <li key={transmission.position} aria-label={`${transmission.label}，${transmission.branch}，天将${generalForHeaven(result, transmission.branch)}`}>
              <span>{transmission.label}</span>
              <strong>{transmission.branch}</strong>
              <b>{generalForHeaven(result, transmission.branch)}</b>
            </li>
          ))}
        </ul>
      </div>

      <aside
        id="heavenly-generals-evidence"
        className="heavenly-generals-review__evidence"
        data-heavenly-generals-section="evidence"
        aria-live="polite"
        aria-labelledby="heavenly-generals-evidence-title"
        hidden={!evidenceOpen}
      >
        <div className="heavenly-generals-review__evidence-heading">
          <div>
            <p>当前选中 · 地盘{selectedEarth} · 天盘{selectedPalace.heaven} · {selectedPalace.general}</p>
            <h3 id="heavenly-generals-evidence-title">{selectedEarth}宫布将证据</h3>
          </div>
          <button type="button" onClick={closeEvidence}>关闭证据</button>
        </div>
        <dl className="heavenly-generals-review__evidence-summary">
          <div><dt>贵人天盘</dt><dd>{result.nobleHeaven}</dd></div>
          <div><dt>贵人地盘</dt><dd>{result.nobleEarth}</dd></div>
          <div><dt>布将方向</dt><dd>{result.direction === "forward" ? "顺布" : "逆布"}</dd></div>
          <div><dt>本宫天将</dt><dd>{selectedPalace.general}</dd></div>
        </dl>
        {EVIDENCE_PHASES.map(([phase, label]) => (
          <section key={phase} className="heavenly-generals-review__evidence-phase">
            <h4>{label}</h4>
            <ol>
              {result.evidence.filter((step) => step.phase === phase).map((step) => (
                <li key={step.id} data-selected={step.id === selectedPalace.evidenceId}>
                  <span className="heavenly-generals-review__rule-id">{step.ruleId}</span>
                  <p>{step.input}</p>
                  <p>{step.conclusion}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <div className="heavenly-generals-review__upstream-actions">
          <button type="button" onClick={onReviewCalendar}>查看历法检查</button>
          <button type="button" onClick={onReviewHeavenEarth}>查看天地盘</button>
          <button type="button" onClick={onReviewFourLessons}>查看四课</button>
          <button type="button" onClick={onReviewThreeTransmissions}>查看三传</button>
        </div>
      </aside>
    </section>
  );
}
