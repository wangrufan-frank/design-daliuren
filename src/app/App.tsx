import { useState } from "react";
import { LunarTypescriptAdapter } from "../adapters/calendar/lunar-typescript-adapter";
import type { CourseSession } from "../domain/chart/types";
import { isCalendarResult, runCalendarStage } from "../domain/calendar/compute-calendar";
import { resetCalendarCorrection, setCalendarCorrection } from "../domain/calendar/corrections";
import {
  CalendarDomainError,
  type CalendarCorrectionField,
  type CalendarError,
} from "../domain/calendar/types";
import { CalendarReview } from "../features/calendar-review/CalendarReview";
import { CourseInputForm } from "../features/course-input/CourseInputForm";
import { RuleStageRail } from "../features/rule-review/RuleStageRail";
import "../styles/tokens.css";
import "../styles/global.css";

const calendarAdapter = new LunarTypescriptAdapter();

export function App() {
  const [session, setSession] = useState<CourseSession | null>(null);
  const [calendarError, setCalendarError] = useState<CalendarError | null>(null);
  const [inputOpen, setInputOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const calendarResult = session?.snapshots.calendar?.value;
  const hasCalendar = isCalendarResult(calendarResult);

  function replaceFrom(nextSession: CourseSession) {
    const outcome = runCalendarStage(nextSession, calendarAdapter);
    if (!outcome.ok) {
      setCalendarError(outcome.error);
      return;
    }
    setSession(outcome.session);
    setCalendarError(null);
  }

  function setCorrection(field: CalendarCorrectionField, rawValue: string) {
    if (!session) return;
    try {
      replaceFrom({ ...session, input: setCalendarCorrection(session.input, field, rawValue) });
    } catch (error) {
      if (!(error instanceof CalendarDomainError)) throw error;
      setCalendarError(error.detail);
    }
  }

  function resetCorrection(field: CalendarCorrectionField) {
    if (!session) return;
    replaceFrom({ ...session, input: resetCalendarCorrection(session.input, field) });
  }

  const correctionError = calendarError?.code === "INVALID_CALENDAR_CORRECTION" && calendarError.field
    ? { field: calendarError.field, message: calendarError.message }
    : undefined;
  const generalErrorMessage = calendarError && !correctionError ? calendarError.message : undefined;

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>大六壬演式</h1>
      </header>
      <div className="app-workspace">
        <aside className="app-panel app-input-panel" aria-label="起课输入">
          <button className="app-panel__toggle" type="button" aria-expanded={inputOpen} onClick={() => setInputOpen((value) => !value)}>
            起课输入
          </button>
          {inputOpen && <CourseInputForm onSubmit={(input) => replaceFrom({ input, snapshots: {} })} />}
        </aside>
        <section className="app-stage" aria-live="polite">
          {hasCalendar ? (
            <CalendarReview
              result={calendarResult}
              onSetCorrection={setCorrection}
              onResetCorrection={resetCorrection}
              correctionError={correctionError}
            />
          ) : (
            <>
              <h2>起课输入</h2>
              {!generalErrorMessage ? <p>输入时间与地点，建立可追溯的起课上下文。</p> : null}
            </>
          )}
          {generalErrorMessage ? <p role="alert">{generalErrorMessage}</p> : null}
        </section>
        <aside className="app-panel app-rule-panel" aria-label="推演依据">
          <button className="app-panel__toggle" type="button" aria-expanded={railOpen} onClick={() => setRailOpen((value) => !value)}>
            推演依据
          </button>
          {railOpen && (
            <RuleStageRail completed={hasCalendar ? ["calendar"] : []} current={hasCalendar ? "heaven-earth" : "calendar"} />
          )}
        </aside>
      </div>
    </main>
  );
}
