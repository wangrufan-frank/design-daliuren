import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { EarthlyBranch } from "../../domain/chart/types";
import type { HeavenEarthResult } from "../../domain/heaven-earth/types";

interface HeavenEarthReviewProps {
  result: HeavenEarthResult;
}

const VISUAL_EARTH_ORDER = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;

function sourceLabel(source: "automatic" | "manual") {
  return source === "manual" ? "人工修正" : "自动计算";
}

export function HeavenEarthReview({ result }: HeavenEarthReviewProps) {
  const [selectedEarth, setSelectedEarth] = useState<EarthlyBranch>(VISUAL_EARTH_ORDER[0]);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const palaceByEarth = new Map(result.palaces.map((palace) => [palace.earth, palace]));
  const palaces = VISUAL_EARTH_ORDER.map((earth) => palaceByEarth.get(earth)!);
  const selectedPalace = palaceByEarth.get(selectedEarth)!;
  const evidence = result.evidence.filter(({ field }) => field === `palace.${selectedEarth}`);

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
    evidenceTrigger.current?.focus();
    setEvidenceOpen(false);
  }

  return (
    <section className="heaven-earth-review" aria-labelledby="heaven-earth-review-title">
      <header className="heaven-earth-review__header">
        <p>规则阶段 02 / 06</p>
        <h2 id="heaven-earth-review-title">天地盘加临</h2>
        <dl>
          <div>
            <dt>月将</dt>
            <dd>{result.monthGeneral.name}（{result.monthGeneral.branch}）· {sourceLabel(result.monthGeneral.source)}</dd>
          </div>
          <div>
            <dt>占时</dt>
            <dd>{result.divinationHour.branch} · {sourceLabel(result.divinationHour.source)}</dd>
          </div>
          <div>
            <dt>转位数</dt>
            <dd>{result.offset}</dd>
          </div>
        </dl>
      </header>

      <div className="heaven-earth-review__plate-region">
        <p className="heaven-earth-review__orientation">上南 · 下北 · 左东 · 右西</p>
        <ul className="heaven-earth-review__plate-grid heaven-earth-review__plate" aria-label="天地盘十二宫">
          {palaces.map((palace, index) => {
            const isMonthGeneral = palace.heaven === result.monthGeneral.branch;
            const isDivinationHour = palace.earth === result.divinationHour.branch;
            const ariaLabel = `天盘${palace.heaven}加临地盘${palace.earth}${isDivinationHour ? "，占时宫" : ""}`;
            return (
              <li key={palace.earth}>
                <button
                  ref={(button) => { buttonRefs.current[index] = button; }}
                  type="button"
                  className="heaven-earth-review__palace"
                  data-earth={palace.earth}
                  data-month-general={isMonthGeneral}
                  data-divination-hour={isDivinationHour}
                  aria-label={ariaLabel}
                  aria-pressed={selectedEarth === palace.earth}
                  aria-controls="heaven-earth-evidence"
                  onClick={(event) => selectPalace(palace.earth, event.currentTarget)}
                  onFocus={(event) => selectPalace(palace.earth, event.currentTarget)}
                  onKeyDown={(event) => moveFocus(event, index)}
                >
                  <strong>{palace.heaven}</strong>
                  <span>地盘 {palace.earth}</span>
                  <span className="heaven-earth-review__markers" aria-hidden="true">
                    {isMonthGeneral ? <b>月将</b> : null}
                    {isDivinationHour ? <b>占时</b> : null}
                  </span>
                </button>
              </li>
            );
          })}

          <li className="heaven-earth-review__center" role="presentation">
            <span>月将加临</span>
            <strong>{result.monthGeneral.name}（{result.monthGeneral.branch}）加临占时{result.divinationHour.branch}</strong>
            <small>天盘顺布 · 转位 {result.offset}</small>
          </li>
        </ul>

        <ul className="heaven-earth-review__fallback" aria-label="十二宫文字对照">
          {palaces.map((palace) => (
            <li key={palace.earth}>
              <span>天盘 {palace.heaven}</span>
              <span>地盘 {palace.earth}</span>
            </li>
          ))}
        </ul>
      </div>

      <aside
        id="heaven-earth-evidence"
        className="heaven-earth-review__evidence"
        aria-live="polite"
        aria-labelledby="heaven-earth-evidence-title"
        hidden={!evidenceOpen}
      >
        <div className="heaven-earth-review__evidence-heading">
          <div>
            <p>当前选中 · 地盘{selectedEarth}</p>
            <h3 id="heaven-earth-evidence-title">{selectedEarth}宫证据</h3>
          </div>
          <button type="button" onClick={closeEvidence}>关闭证据</button>
        </div>
        <dl className="heaven-earth-review__evidence-summary">
          <div>
            <dt>有效月将</dt>
            <dd>{result.monthGeneral.name}（{result.monthGeneral.branch}）· {sourceLabel(result.monthGeneral.source)}</dd>
          </div>
          <div>
            <dt>有效占时</dt>
            <dd>{result.divinationHour.branch} · {sourceLabel(result.divinationHour.source)}</dd>
          </div>
          <div><dt>天盘</dt><dd>{selectedPalace.heaven}</dd></div>
          <div><dt>地盘</dt><dd>{selectedPalace.earth}</dd></div>
        </dl>
        <ol>
          {evidence.map((step) => (
            <li key={`${step.ruleId}-${step.field}`}>
              <span className="heaven-earth-review__rule-id">{step.ruleId}</span>
              <p>{step.input}</p>
              <p>{step.conclusion}</p>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
