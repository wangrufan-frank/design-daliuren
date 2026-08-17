import { useState } from "react";
import { LunarTypescriptAdapter } from "../adapters/calendar/lunar-typescript-adapter";
import type { CourseSession, RuleStageId } from "../domain/chart/types";
import { isCalendarResult, runCalendarStage } from "../domain/calendar/compute-calendar";
import { resetCalendarCorrection, setCalendarCorrection } from "../domain/calendar/corrections";
import {
  CalendarDomainError,
  type CalendarCorrectionField,
  type CalendarError,
} from "../domain/calendar/types";
import { isHeavenEarthResult, runHeavenEarthStage } from "../domain/heaven-earth/compute-heaven-earth";
import type { HeavenEarthStageOutcome } from "../domain/heaven-earth/types";
import { CalendarReview } from "../features/calendar-review/CalendarReview";
import { CourseInputForm } from "../features/course-input/CourseInputForm";
import { isFourLessonsResult, runFourLessonsStage } from "../domain/four-lessons/compute-four-lessons";
import type { FourLessonsStageOutcome } from "../domain/four-lessons/types";
import { FourLessonsReview } from "../features/four-lessons-review/FourLessonsReview";
import { runHeavenlyGeneralsStage } from "../domain/heavenly-generals/compute-heavenly-generals";
import { isHeavenlyGeneralsResult } from "../domain/heavenly-generals/result-guard";
import type { HeavenlyGeneralsStageOutcome } from "../domain/heavenly-generals/types";
import { HeavenlyGeneralsReview } from "../features/heavenly-generals-review/HeavenlyGeneralsReview";
import { HeavenEarthReview } from "../features/heaven-earth-review/HeavenEarthReview";
import { RuleStageRail } from "../features/rule-review/RuleStageRail";
import { runThreeTransmissionsStage } from "../domain/three-transmissions/compute-three-transmissions";
import { isThreeTransmissionsResult } from "../domain/three-transmissions/result-guard";
import type { ThreeTransmissionsStageOutcome } from "../domain/three-transmissions/types";
import { ThreeTransmissionsReview } from "../features/three-transmissions-review/ThreeTransmissionsReview";
import "../styles/tokens.css";
import "../styles/global.css";

const calendarAdapter = new LunarTypescriptAdapter();
type ReviewStage = "calendar" | "heaven-earth" | "four-lessons" | "three-transmissions" | "heavenly-generals";
type StageError = CalendarError
  | Extract<HeavenEarthStageOutcome, { ok: false }>["error"]
  | Extract<FourLessonsStageOutcome, { ok: false }>["error"]
  | Extract<ThreeTransmissionsStageOutcome, { ok: false }>["error"]
  | Extract<HeavenlyGeneralsStageOutcome, { ok: false }>["error"];

export function App() {
  const [session, setSession] = useState<CourseSession | null>(null);
  const [stageError, setStageError] = useState<StageError | null>(null);
  const [reviewStage, setReviewStage] = useState<ReviewStage>("calendar");
  const [inputOpen, setInputOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const calendarResult = session?.snapshots.calendar?.value;
  const heavenEarthResult = session?.snapshots["heaven-earth"]?.value;
  const fourLessonsResult = session?.snapshots["four-lessons"]?.value;
  const threeTransmissionsResult = session?.snapshots["three-transmissions"]?.value;
  const heavenlyGeneralsResult = session?.snapshots["heavenly-generals"]?.value;
  const hasCalendar = isCalendarResult(calendarResult);
  const hasHeavenEarth = isHeavenEarthResult(heavenEarthResult);
  const hasFourLessons = isFourLessonsResult(fourLessonsResult);
  const hasThreeTransmissions = isThreeTransmissionsResult(threeTransmissionsResult);
  const hasHeavenlyGenerals = isHeavenlyGeneralsResult(heavenlyGeneralsResult);

  function replaceFrom(nextSession: CourseSession) {
    const calendarOutcome = runCalendarStage(nextSession, calendarAdapter);
    if (!calendarOutcome.ok) {
      setSession(nextSession);
      setReviewStage("calendar");
      setStageError(calendarOutcome.error);
      return;
    }
    const plateOutcome = runHeavenEarthStage(calendarOutcome.session);
    if (!plateOutcome.ok) {
      setSession(plateOutcome.session);
      setReviewStage("calendar");
      setStageError(plateOutcome.error);
      return;
    }
    const lessonsOutcome = runFourLessonsStage(plateOutcome.session);
    if (!lessonsOutcome.ok) {
      setSession(lessonsOutcome.session);
      setReviewStage("heaven-earth");
      setStageError(lessonsOutcome.error);
      return;
    }
    const transmissionsOutcome = runThreeTransmissionsStage(lessonsOutcome.session);
    if (!transmissionsOutcome.ok) {
      setSession(transmissionsOutcome.session);
      setReviewStage("four-lessons");
      setStageError(transmissionsOutcome.error);
      return;
    }
    const generalsOutcome = runHeavenlyGeneralsStage(transmissionsOutcome.session);
    if (!generalsOutcome.ok) {
      setSession(generalsOutcome.session);
      setReviewStage("three-transmissions");
      setStageError(generalsOutcome.error);
      return;
    }
    setSession(generalsOutcome.session);
    setReviewStage("heavenly-generals");
    setStageError(null);
  }

  function setCorrection(field: CalendarCorrectionField, rawValue: string) {
    if (!session) return;
    try {
      replaceFrom({ ...session, input: setCalendarCorrection(session.input, field, rawValue) });
    } catch (error) {
      if (!(error instanceof CalendarDomainError)) throw error;
      setStageError(error.detail);
    }
  }

  function resetCorrection(field: CalendarCorrectionField) {
    if (!session) return;
    replaceFrom({ ...session, input: resetCalendarCorrection(session.input, field) });
  }

  const correctionError = stageError?.code === "INVALID_CALENDAR_CORRECTION" && stageError.field
    ? { field: stageError.field, message: stageError.message }
    : undefined;
  const generalErrorMessage = stageError && !correctionError ? stageError.message : undefined;
  const completed: RuleStageId[] = hasCalendar ? ["calendar"] : [];
  if (hasHeavenEarth) completed.push("heaven-earth");
  if (hasFourLessons) completed.push("four-lessons");
  if (hasThreeTransmissions) completed.push("three-transmissions");
  if (hasHeavenlyGenerals) completed.push("heavenly-generals");
  const current: RuleStageId = hasHeavenlyGenerals
    ? "course"
    : hasThreeTransmissions
    ? "heavenly-generals"
    : hasFourLessons
      ? "three-transmissions"
      : hasHeavenEarth
        ? "four-lessons"
        : hasCalendar
          ? "heaven-earth"
          : "calendar";

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
          {reviewStage === "heavenly-generals" && hasHeavenlyGenerals && hasFourLessons && hasThreeTransmissions ? (
            <HeavenlyGeneralsReview
              result={heavenlyGeneralsResult}
              fourLessons={fourLessonsResult}
              threeTransmissions={threeTransmissionsResult}
              onReviewCalendar={() => setReviewStage("calendar")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
              onReviewFourLessons={() => setReviewStage("four-lessons")}
              onReviewThreeTransmissions={() => setReviewStage("three-transmissions")}
            />
          ) : reviewStage === "three-transmissions" && hasThreeTransmissions ? (
            <ThreeTransmissionsReview
              result={threeTransmissionsResult}
              generals={hasHeavenlyGenerals ? heavenlyGeneralsResult : undefined}
              onReviewFourLessons={() => setReviewStage("four-lessons")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
            />
          ) : reviewStage === "four-lessons" && hasFourLessons ? (
            <FourLessonsReview
              result={fourLessonsResult}
              generals={hasHeavenlyGenerals ? heavenlyGeneralsResult : undefined}
              onReviewCalendar={() => setReviewStage("calendar")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
            />
          ) : reviewStage === "heaven-earth" && hasHeavenEarth ? (
            <HeavenEarthReview result={heavenEarthResult} />
          ) : hasCalendar ? (
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
            <RuleStageRail
              completed={completed}
              current={current}
              selected={hasCalendar ? reviewStage : undefined}
              onSelect={(stage) => {
                if (stage === "calendar" || stage === "heaven-earth" || stage === "four-lessons" || stage === "three-transmissions" || stage === "heavenly-generals") setReviewStage(stage);
              }}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
