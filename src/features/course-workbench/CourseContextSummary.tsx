import type { CourseInput } from "../../domain/chart/types";

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
  const corrections = Object.keys(input.corrections) as (keyof CourseInput["corrections"])[];

  return (
    <section className="course-context" aria-label="起课上下文">
      <details open>
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
