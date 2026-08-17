import { useRef, useState } from "react";
import type { ThreeTransmissionsResult, TransmissionPosition } from "../../domain/three-transmissions/types";
import { generalForHeaven } from "../../domain/heavenly-generals/policy";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";

interface ThreeTransmissionsReviewProps {
  result: ThreeTransmissionsResult;
  generals?: HeavenlyGeneralsResult;
  onReviewFourLessons: () => void;
  onReviewHeavenEarth: () => void;
}

const SHARED_EVIDENCE_PHASES = new Set(["plate", "lessons", "candidates", "selection"]);

export function ThreeTransmissionsReview({
  result,
  generals,
  onReviewFourLessons,
  onReviewHeavenEarth,
}: ThreeTransmissionsReviewProps) {
  const [selectedPosition, setSelectedPosition] = useState<TransmissionPosition>("initial");
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const selected = result.transmissions.find(({ position }) => position === selectedPosition)!;
  const evidence = result.evidence.filter((step) => (
    step.transmission === selectedPosition
    || (selectedPosition === "initial" && SHARED_EVIDENCE_PHASES.has(step.phase))
  ));

  function selectTransmission(position: TransmissionPosition, trigger: HTMLButtonElement) {
    evidenceTrigger.current = trigger;
    setSelectedPosition(position);
    setEvidenceOpen(true);
  }

  function closeEvidence() {
    (evidenceTrigger.current ?? buttonRefs.current[0])?.focus();
    setEvidenceOpen(false);
  }

  return (
    <section className="three-transmissions-review" aria-label="三传取法">
      <header className="three-transmissions-review__header">
        <h2>九宗门 · 三传取法</h2>
        <dl className="three-transmissions-review__summary" aria-label="三传摘要">
          <div><dt>日柱</dt><dd>{result.dayPillar}</dd></div>
          <div><dt>主课格</dt><dd>{result.method}</dd></div>
          <div><dt>细课格</dt><dd>{result.subtype ?? "未分细格"}</dd></div>
        </dl>
      </header>
      <div className="three-transmissions-review__results-region">
        <ol className="three-transmissions-review__transmissions" aria-label="三传">
          {result.transmissions.map((transmission, index) => {
            const general = generals ? generalForHeaven(generals, transmission.branch) : "待天将加临";
            return (
              <li key={transmission.position}>
                <button
                  ref={(button) => { buttonRefs.current[index] = button; }}
                  type="button"
                  className="three-transmissions-review__transmission"
                  data-transmission={transmission.position}
                  aria-pressed={selectedPosition === transmission.position}
                  aria-expanded={evidenceOpen && selectedPosition === transmission.position}
                  aria-controls="three-transmissions-evidence"
                  aria-label={`${transmission.label}，${transmission.branch}，${transmission.relation}，天将${general}`}
                  onClick={(event) => selectTransmission(transmission.position, event.currentTarget)}
                >
                  <span>{general}</span>
                  <strong>{transmission.branch}</strong>
                  <small>{transmission.label}</small>
                  <em>{transmission.relation}</em>
                  <p>{transmission.derivation}</p>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <aside
        id="three-transmissions-evidence"
        className="three-transmissions-review__evidence"
        aria-live="polite"
        aria-labelledby="three-transmissions-evidence-title"
        hidden={!evidenceOpen}
      >
        <div className="three-transmissions-review__evidence-heading">
          <div>
            <p>当前选中 · {selected.label}</p>
            <h3 id="three-transmissions-evidence-title">{selected.label}证据</h3>
          </div>
          <button type="button" onClick={closeEvidence}>关闭证据</button>
        </div>
        <dl className="three-transmissions-review__evidence-summary">
          <div><dt>日柱</dt><dd>{result.dayPillar}</dd></div>
          <div><dt>传位</dt><dd>{selected.branch} · {selected.relation}</dd></div>
        </dl>
        <ol>
          {evidence.map((step) => (
            <li key={step.id}>
              <span className="three-transmissions-review__rule-id">{step.ruleId}</span>
              <p>{step.input}</p>
              <p>{step.conclusion}</p>
              {step.details?.filter((detail) => detail.kind === "shehai-palace").map((detail) => (
                <dl key={`${detail.candidateLesson}-${detail.earth}`} className="three-transmissions-review__shehai-palace">
                  <div>
                    <dt>{detail.candidateLesson === "first" ? "一课" : detail.candidateLesson === "second" ? "二课" : detail.candidateLesson === "third" ? "三课" : "四课"} · 上神{detail.candidateUpper} · {detail.direction === "lower-overcomes-upper" ? "下克上" : "上克下"} · {detail.earth}宫</dt>
                    <dd>{`地支${detail.earth}（${detail.branchElement}）· ${detail.branchContributes ? "计害" : "不计害"}`}</dd>
                  </div>
                  <div>
                    <dt>寄干{detail.residentStems.length > 0
                      ? detail.residentStems.map(({ stem, element, contributes }) => (
                          `${stem}（${element}，${contributes ? "计害" : "不计害"}）`
                        )).join("、")
                      : "无"}</dt>
                    <dd>涉害 +{detail.increment}</dd>
                  </div>
                  <div><dt>累计 {detail.total}</dt></div>
                </dl>
              ))}
            </li>
          ))}
        </ol>
        <div className="three-transmissions-review__upstream-actions">
          <button type="button" onClick={onReviewFourLessons}>查看四课</button>
          <button type="button" onClick={onReviewHeavenEarth}>查看天地盘</button>
        </div>
      </aside>
    </section>
  );
}
