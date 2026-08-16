import { useRef, useState } from "react";
import type { FourLessonId, FourLessonsResult } from "../../domain/four-lessons/types";

const VISUAL_LESSON_ORDER = ["fourth", "third", "second", "first"] as const;

interface FourLessonsReviewProps {
  result: FourLessonsResult;
  onReviewCalendar: () => void;
  onReviewHeavenEarth: () => void;
}

export function FourLessonsReview({ result, onReviewCalendar, onReviewHeavenEarth }: FourLessonsReviewProps) {
  const [selectedLesson, setSelectedLesson] = useState<FourLessonId>("first");
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const lessonsById = new Map(result.lessons.map((lesson) => [lesson.id, lesson]));
  const lessons = VISUAL_LESSON_ORDER.map((id) => lessonsById.get(id)!);
  const selected = lessonsById.get(selectedLesson)!;
  const evidence = result.evidence.filter((step) => step.lesson === selectedLesson);

  function selectLesson(lesson: FourLessonId, trigger: HTMLButtonElement) {
    evidenceTrigger.current = trigger;
    setSelectedLesson(lesson);
    setEvidenceOpen(true);
  }

  function closeEvidence() {
    (evidenceTrigger.current ?? buttonRefs.current[3])?.focus();
    setEvidenceOpen(false);
  }

  return (
    <section className="four-lessons-review" aria-label="四课生成">
      <div className="four-lessons-review__lessons-region">
        <p className="four-lessons-review__orientation">右起四、三、二、一课</p>
        <ul className="four-lessons-review__lessons" aria-label="四课课体">
          {lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <button
                ref={(button) => { buttonRefs.current[index] = button; }}
                type="button"
                className="four-lessons-review__lesson"
                data-lesson={lesson.id}
                aria-pressed={selectedLesson === lesson.id}
                aria-controls="four-lessons-evidence"
                aria-label={`${lesson.label}，上神${lesson.upper}，下神${lesson.lower.value}，天将待加临`}
                onClick={(event) => selectLesson(lesson.id, event.currentTarget)}
              >
                <span className="four-lessons-review__general">待天将加临</span>
                <strong>{lesson.upper}</strong>
                <span className="four-lessons-review__lower">{lesson.lower.value}</span>
                <small>{lesson.label}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside
        id="four-lessons-evidence"
        className="four-lessons-review__evidence"
        aria-live="polite"
        aria-labelledby="four-lessons-evidence-title"
        hidden={!evidenceOpen}
      >
        <div className="four-lessons-review__evidence-heading">
          <div>
            <p>当前选中 · {selected.label}</p>
            <h3 id="four-lessons-evidence-title">{selected.label}证据</h3>
          </div>
          <button type="button" onClick={closeEvidence}>关闭证据</button>
        </div>
        <dl className="four-lessons-review__evidence-summary">
          <div><dt>日柱</dt><dd>{result.dayPillar}</dd></div>
          <div><dt>查地盘</dt><dd>{selected.lookupEarth}</dd></div>
        </dl>
        <ol>
          {evidence.map((step) => (
            <li key={`${step.ruleId}-${step.lesson}`}>
              <span className="four-lessons-review__rule-id">{step.ruleId}</span>
              <p>{step.input}</p>
              <p>{step.conclusion}</p>
            </li>
          ))}
        </ol>
        <div className="four-lessons-review__upstream-actions">
          <button type="button" onClick={onReviewCalendar}>返回历法检查</button>
          <button type="button" onClick={onReviewHeavenEarth}>查看天地盘</button>
        </div>
      </aside>
    </section>
  );
}
