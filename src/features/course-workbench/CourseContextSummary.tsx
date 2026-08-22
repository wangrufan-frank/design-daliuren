import { useEffect, useState, useSyncExternalStore } from "react";
import type { CourseInput } from "../../domain/chart/types";

const COMPACT_QUERY = "(max-width: 899px)";

function compactQuery(): MediaQueryList | undefined {
  return typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? undefined
    : window.matchMedia(COMPACT_QUERY);
}

function subscribeToCompactLayout(onChange: () => void): () => void {
  const query = compactQuery();
  if (!query) return () => undefined;
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function compactSnapshot(): boolean {
  return compactQuery()?.matches ?? false;
}

const correctionLabels: Record<keyof CourseInput["corrections"], string> = {
  yearPillar: "年柱",
  monthPillar: "月柱",
  dayPillar: "日柱",
  hourPillar: "时柱",
  monthGeneral: "月将",
  divinationHour: "占时",
};

interface CourseContextSummaryProps {
  input: CourseInput;
  onRestart(): void;
}

export function CourseContextSummary({ input, onRestart }: CourseContextSummaryProps) {
  const compact = useSyncExternalStore(subscribeToCompactLayout, compactSnapshot, () => false);
  const [open, setOpen] = useState(() => !compact);
  const corrections = Object.keys(input.corrections) as (keyof CourseInput["corrections"])[];

  useEffect(() => setOpen(!compact), [compact]);

  return (
    <section className="course-context" aria-label="起课上下文">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <span>起课上下文</span>
          <small>北京时间</small>
        </summary>
        <div className="course-context__body">
          <p className="course-context__eyebrow">所问之事</p>
          <p className="course-context__reason">{input.reason}</p>
          <dl>
            <div>
              <dt>起课时间</dt>
              <dd><time dateTime={input.civilDateTime}>{input.civilDateTime.replace("T", " ")}</time></dd>
            </div>
            {input.locationName ? (
              <div>
                <dt>地点</dt>
                <dd>{input.locationName}</dd>
              </div>
            ) : null}
            <div>
              <dt>历法修正</dt>
              <dd className="course-context__corrections">
                {corrections.length === 0
                  ? <span>无人工修正</span>
                  : corrections.map((field) => <span key={field}>{correctionLabels[field]} · 人工修正</span>)}
              </dd>
            </div>
          </dl>
          <button type="button" onClick={onRestart}>重新起课</button>
        </div>
      </details>
    </section>
  );
}
