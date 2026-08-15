import { useState } from "react";
import { CALENDAR_RULE_IDS, EARTHLY_BRANCHES, JIA_ZI } from "../../domain/calendar/constants";
import type { CalendarCorrectionField, CalendarResult } from "../../domain/calendar/types";

type CalendarField = CalendarCorrectionField | "lunarDate" | "monthBuild";

interface CalendarCell {
  id: CalendarField;
  label: string;
  automatic: string;
  effective: string;
  source: "automatic" | "manual";
}

interface CalendarReviewProps {
  result: CalendarResult;
  onSetCorrection: (field: CalendarCorrectionField, rawValue: string) => void;
  onResetCorrection: (field: CalendarCorrectionField) => void;
  correctionError?: { field: CalendarCorrectionField; message: string };
}

const FIELD_LABELS: Record<CalendarField, string> = {
  yearPillar: "年柱",
  monthPillar: "月柱",
  dayPillar: "日柱",
  hourPillar: "时柱",
  lunarDate: "农历日期",
  monthBuild: "月建",
  monthGeneral: "月将",
  divinationHour: "占时",
};

const PILLAR_FIELDS = new Set<CalendarCorrectionField>([
  "yearPillar",
  "monthPillar",
  "dayPillar",
  "hourPillar",
]);

function monthGeneral(value: CalendarResult["monthGeneral"]["automatic"]): string {
  return `${value.name}（${value.branch}）`;
}

function calendarCells(result: CalendarResult): CalendarCell[] {
  return [
    { id: "yearPillar", label: "年柱", ...result.pillars.year },
    { id: "monthPillar", label: "月柱", ...result.pillars.month },
    { id: "dayPillar", label: "日柱", ...result.pillars.day },
    { id: "hourPillar", label: "时柱", ...result.pillars.hour },
    {
      id: "lunarDate",
      label: "农历日期",
      automatic: result.lunarDate.display,
      effective: result.lunarDate.display,
      source: "automatic",
    },
    {
      id: "monthBuild",
      label: "月建",
      automatic: result.monthBuild,
      effective: result.monthBuild,
      source: "automatic",
    },
    {
      id: "monthGeneral",
      label: "月将",
      automatic: monthGeneral(result.monthGeneral.automatic),
      effective: monthGeneral(result.monthGeneral.effective),
      source: result.monthGeneral.source,
    },
    {
      id: "divinationHour",
      label: "占时",
      automatic: result.divinationHour.automatic,
      effective: result.divinationHour.effective,
      source: result.divinationHour.source,
    },
  ];
}

function isCorrectable(field: CalendarField): field is CalendarCorrectionField {
  return field !== "lunarDate" && field !== "monthBuild";
}

export function CalendarReview({ result, onSetCorrection, onResetCorrection, correctionError }: CalendarReviewProps) {
  const [activeField, setActiveField] = useState<CalendarField>("yearPillar");
  const cells = calendarCells(result);
  const activeCell = cells.find(({ id }) => id === activeField)!;
  const evidence = result.evidence.filter(
    ({ field }) => field === activeField || field === "civilDateTime",
  );
  const correctionOptions = isCorrectable(activeField)
    ? PILLAR_FIELDS.has(activeField) ? JIA_ZI : EARTHLY_BRANCHES
    : undefined;
  const activeCorrectionError = correctionError?.field === activeField ? correctionError : undefined;
  const correctionErrorId = activeCorrectionError
    ? `calendar-correction-${activeCorrectionError.field}-error`
    : undefined;

  return (
    <section className="calendar-review" aria-labelledby="calendar-review-title">
      <header className="calendar-review__header">
        <p>规则阶段 01 / 06</p>
        <h2 id="calendar-review-title">历法与月将</h2>
        <p>已形成快照 · 固定 UTC+8 北京时间</p>
      </header>

      <dl className="calendar-review__time-band">
        <div>
          <dt>民用时间</dt>
          <dd>{result.civilDateTime}</dd>
        </div>
        <div>
          <dt>干支日界</dt>
          <dd>23:00 子初换日</dd>
          <dd className="calendar-review__rule-id">{CALENDAR_RULE_IDS.ziInitial}</dd>
        </div>
        <div>
          <dt>生效干支日期</dt>
          <dd>{result.effectiveGanzhiDate}</dd>
        </div>
      </dl>

      <div className="calendar-review__main">
        <ul className="calendar-review__matrix" aria-label="历法结果矩阵">
          {cells.map((cell) => {
            const sourceLabel = cell.source === "manual" ? "人工修正" : "自动计算";
            return (
              <li key={cell.id}>
                <button
                  type="button"
                  className="calendar-review__cell"
                  data-source={cell.source}
                  aria-pressed={activeField === cell.id}
                  aria-controls="calendar-evidence"
                  aria-label={`${cell.label}，自动 ${cell.automatic}，有效 ${cell.effective}，${sourceLabel}`}
                  onClick={() => setActiveField(cell.id)}
                >
                  <span className="calendar-review__cell-label">{cell.label}</span>
                  <strong>{cell.effective}</strong>
                  <span>自动：{cell.automatic}</span>
                  <span>有效：{cell.effective}</span>
                  <span className="calendar-review__source">{sourceLabel}</span>
                </button>
                <span className="calendar-review__connector" aria-hidden="true" />
              </li>
            );
          })}
        </ul>

        <section className="calendar-review__boundaries" aria-labelledby="calendar-boundaries-title">
          <h3 id="calendar-boundaries-title">相邻节气时刻</h3>
          <dl>
            <div><dt>前一节 · {result.boundaries.previousJie.name}</dt><dd>{result.boundaries.previousJie.beijingDateTime}</dd></div>
            <div><dt>后一节 · {result.boundaries.nextJie.name}</dt><dd>{result.boundaries.nextJie.beijingDateTime}</dd></div>
            <div><dt>前一中气 · {result.boundaries.previousZhongQi.name}</dt><dd>{result.boundaries.previousZhongQi.beijingDateTime}</dd></div>
            <div><dt>后一中气 · {result.boundaries.nextZhongQi.name}</dt><dd>{result.boundaries.nextZhongQi.beijingDateTime}</dd></div>
          </dl>
        </section>
      </div>

      <aside
        id="calendar-evidence"
        className="calendar-review__evidence"
        aria-live="polite"
        aria-labelledby="calendar-evidence-title"
      >
        <p className="calendar-review__evidence-label">当前选中 · {activeCell.label}</p>
        <h3 id="calendar-evidence-title">{activeCell.label}证据</h3>
        <ol>
          {evidence.map((step) => (
            <li key={`${step.ruleId}-${step.field}`}>
              <span className="calendar-review__rule-id">{step.ruleId}</span>
              <p>{step.input}</p>
              <p>{step.conclusion}</p>
            </li>
          ))}
        </ol>

        {isCorrectable(activeField) && correctionOptions ? (
          <div className="calendar-review__correction">
            <label htmlFor={`calendar-correction-${activeField}`}>修正{FIELD_LABELS[activeField]}</label>
            <select
              id={`calendar-correction-${activeField}`}
              aria-invalid={activeCorrectionError ? true : undefined}
              aria-errormessage={correctionErrorId}
              value={activeField === "monthGeneral"
                ? result.monthGeneral.effective.branch
                : activeCell.effective}
              onChange={(event) => onSetCorrection(activeField, event.currentTarget.value)}
            >
              {correctionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {activeCorrectionError ? (
              <p id={correctionErrorId} role="alert">{activeCorrectionError.message}</p>
            ) : null}
            {activeCell.source === "manual" ? (
              <button type="button" onClick={() => onResetCorrection(activeField)}>
                恢复{FIELD_LABELS[activeField]}自动值
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
