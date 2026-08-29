import { useState } from "react";
import { LunarTypescriptAdapter } from "../adapters/calendar/lunar-typescript-adapter";
import type { CourseInput, CourseSession, RuleStageId } from "../domain/chart/types";
import {
  isCourseSnapshotForCurrentInputs,
  isHeavenlyGeneralsSnapshotForCurrentInputs,
} from "../domain/chart/snapshots";
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
import { CourseLandingPreview } from "../features/course-input/CourseLandingPreview";
import { CourseGenerationProgress } from "../features/course-input/CourseGenerationProgress";
import { isFourLessonsResult, runFourLessonsStage } from "../domain/four-lessons/compute-four-lessons";
import type { FourLessonsStageOutcome } from "../domain/four-lessons/types";
import { FourLessonsReview } from "../features/four-lessons-review/FourLessonsReview";
import { runHeavenlyGeneralsStage } from "../domain/heavenly-generals/compute-heavenly-generals";
import type { HeavenlyGeneralsStageOutcome } from "../domain/heavenly-generals/types";
import { HeavenlyGeneralsReview } from "../features/heavenly-generals-review/HeavenlyGeneralsReview";
import { HeavenEarthReview } from "../features/heaven-earth-review/HeavenEarthReview";
import { RuleStageRail } from "../features/rule-review/RuleStageRail";
import { runThreeTransmissionsStage } from "../domain/three-transmissions/compute-three-transmissions";
import { isThreeTransmissionsResult } from "../domain/three-transmissions/result-guard";
import type { ThreeTransmissionsStageOutcome } from "../domain/three-transmissions/types";
import { ThreeTransmissionsReview } from "../features/three-transmissions-review/ThreeTransmissionsReview";
import { runCourseStage } from "../domain/course/compute-course";
import type { CourseStageOutcome } from "../domain/course/types";
import { CourseSheet } from "../features/course-sheet/CourseSheet";
import { CourseExperience } from "../features/course-experience/CourseExperience";
import type { ArtifactSourceResults } from "../features/artifact-scene/model/types";
import { CourseWorkbench } from "../features/course-workbench/CourseWorkbench";
import { useReducedMotion } from "../features/artifact-scene/use-reduced-motion";
import "../styles/tokens.css";
import "../styles/global.css";

const calendarAdapter = new LunarTypescriptAdapter();
type ReviewStage = "calendar" | "heaven-earth" | "four-lessons" | "three-transmissions" | "heavenly-generals" | "course";
type StageError = CalendarError
  | Extract<HeavenEarthStageOutcome, { ok: false }>["error"]
  | Extract<FourLessonsStageOutcome, { ok: false }>["error"]
  | Extract<ThreeTransmissionsStageOutcome, { ok: false }>["error"]
  | Extract<HeavenlyGeneralsStageOutcome, { ok: false }>["error"]
  | Extract<CourseStageOutcome, { ok: false }>["error"];

function hasSameCalendarInputs(left: CourseInput, right: CourseInput): boolean {
  return left.civilDateTime === right.civilDateTime
    && left.timeZone === right.timeZone
    && left.corrections.yearPillar === right.corrections.yearPillar
    && left.corrections.monthPillar === right.corrections.monthPillar
    && left.corrections.dayPillar === right.corrections.dayPillar
    && left.corrections.hourPillar === right.corrections.hourPillar
    && left.corrections.monthGeneral === right.corrections.monthGeneral
    && left.corrections.divinationHour === right.corrections.divinationHour;
}

export function App() {
  const [session, setSession] = useState<CourseSession | null>(null);
  const [pendingSession, setPendingSession] = useState<CourseSession | null>(null);
  const [stageError, setStageError] = useState<StageError | null>(null);
  const [reviewStage, setReviewStage] = useState<ReviewStage>("calendar");
  const [inputOpen, setInputOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);
  const reducedMotion = useReducedMotion();
  const calendarResult = session?.snapshots.calendar?.value;
  const heavenEarthResult = session?.snapshots["heaven-earth"]?.value;
  const fourLessonsResult = session?.snapshots["four-lessons"]?.value;
  const threeTransmissionsResult = session?.snapshots["three-transmissions"]?.value;
  const heavenlyGeneralsSnapshot = session?.snapshots["heavenly-generals"];
  const courseSnapshot = session?.snapshots.course;
  const hasCalendar = isCalendarResult(calendarResult);
  const hasHeavenEarth = isHeavenEarthResult(heavenEarthResult);
  const hasFourLessons = isFourLessonsResult(fourLessonsResult);
  const hasThreeTransmissions = isThreeTransmissionsResult(threeTransmissionsResult);
  const heavenlyGeneralsResult = isHeavenlyGeneralsSnapshotForCurrentInputs(
    heavenlyGeneralsSnapshot,
    session?.snapshots.calendar,
    session?.snapshots["heaven-earth"],
  ) ? heavenlyGeneralsSnapshot.value : undefined;
  const hasHeavenlyGenerals = heavenlyGeneralsResult !== undefined;
  const courseResult = isCourseSnapshotForCurrentInputs(
    courseSnapshot,
    session ? {
      reason: session.input.reason,
      natal: session.input.natal,
      ...(session.input.locationName && { locationName: session.input.locationName }),
    } : undefined,
    session?.snapshots.calendar,
    session?.snapshots["four-lessons"],
    session?.snapshots["three-transmissions"],
    session?.snapshots["heavenly-generals"],
  ) ? courseSnapshot.value : undefined;
  const hasCourse = courseResult !== undefined;
  let artifactSource: ArtifactSourceResults | undefined;
  if (hasCalendar
    && hasHeavenEarth
    && hasFourLessons
    && hasThreeTransmissions
    && hasHeavenlyGenerals
    && hasCourse) {
    artifactSource = {
      calendar: calendarResult,
      plate: heavenEarthResult,
      lessons: fourLessonsResult,
      transmissions: threeTransmissionsResult,
      generals: heavenlyGeneralsResult,
      course: courseResult,
    };
  }

  function replaceFrom(nextSession: CourseSession, showProgress = false) {
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
    const courseOutcome = runCourseStage(generalsOutcome.session);
    if (!courseOutcome.ok) {
      setSession(courseOutcome.session);
      setReviewStage("heavenly-generals");
      setStageError(courseOutcome.error);
      return;
    }
    if (showProgress) {
      setPendingSession(courseOutcome.session);
    } else {
      setSession(courseOutcome.session);
    }
    setReviewStage("course");
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

  function submitInput(input: CourseInput) {
    if (!session || !hasSameCalendarInputs(session.input, input)) {
      setPendingSession(null);
      replaceFrom({ input, snapshots: {} }, true);
      return;
    }
    const courseOutcome = runCourseStage({ ...session, input });
    if (!courseOutcome.ok) {
      setSession(courseOutcome.session);
      setReviewStage("heavenly-generals");
      setStageError(courseOutcome.error);
      return;
    }
    setSession(courseOutcome.session);
    setReviewStage("course");
    setStageError(null);
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
  if (hasCourse) completed.push("course");
  const current: RuleStageId | undefined = hasCourse
    ? undefined
    : hasHeavenlyGenerals
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

  if (pendingSession) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <h1>大六壬演式</h1>
        </header>
        <section className="app-stage" aria-live="polite">
          <CourseGenerationProgress
            reducedMotion={reducedMotion}
            onComplete={() => {
              setSession(pendingSession);
              setPendingSession(null);
            }}
          />
        </section>
      </main>
    );
  }

  if (session && artifactSource && hasCourse) {
    return (
      <CourseWorkbench
        input={session.input}
        source={artifactSource}
        selectedStage={reviewStage}
        onSelectStage={setReviewStage}
        onSetCalendarCorrection={setCorrection}
        onResetCalendarCorrection={resetCorrection}
        calendarCorrectionError={correctionError}
        stageErrorMessage={generalErrorMessage}
        onRestart={() => {
          setSession(null);
          setPendingSession(null);
          setStageError(null);
          setReviewStage("calendar");
          setInputOpen(true);
          setRailOpen(true);
        }}
      />
    );
  }

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
          {inputOpen && <CourseInputForm onSubmit={submitInput} />}
        </aside>
        <section className="app-stage" aria-live="polite">
          {reviewStage === "course" && hasCourse ? (
            artifactSource
              ? <CourseExperience source={artifactSource} />
              : <CourseSheet result={courseResult} />
          ) : reviewStage === "heavenly-generals" && hasHeavenlyGenerals && hasFourLessons && hasThreeTransmissions ? (
            <HeavenlyGeneralsReview
              result={heavenlyGeneralsResult}
              fourLessons={fourLessonsResult}
              threeTransmissions={threeTransmissionsResult}
              onReviewCalendar={() => setReviewStage("calendar")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
              onReviewFourLessons={() => setReviewStage("four-lessons")}
              onReviewThreeTransmissions={() => setReviewStage("three-transmissions")}
            />
          ) : reviewStage === "three-transmissions" && hasThreeTransmissions && hasCalendar ? (
            <ThreeTransmissionsReview
              result={threeTransmissionsResult}
              voidBranches={calendarResult.voidBranches}
              generals={hasHeavenlyGenerals ? heavenlyGeneralsResult : undefined}
              onReviewFourLessons={() => setReviewStage("four-lessons")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
            />
          ) : reviewStage === "four-lessons" && hasFourLessons && hasCalendar ? (
            <FourLessonsReview
              result={fourLessonsResult}
              voidBranches={calendarResult.voidBranches}
              generals={hasHeavenlyGenerals ? heavenlyGeneralsResult : undefined}
              onReviewCalendar={() => setReviewStage("calendar")}
              onReviewHeavenEarth={() => setReviewStage("heaven-earth")}
            />
          ) : reviewStage === "heaven-earth" && hasHeavenEarth && hasCalendar ? (
            <HeavenEarthReview result={heavenEarthResult} voidBranches={calendarResult.voidBranches} />
          ) : hasCalendar ? (
            <CalendarReview
              result={calendarResult}
              onSetCorrection={setCorrection}
              onResetCorrection={resetCorrection}
              correctionError={correctionError}
            />
          ) : (
            <>
              <CourseLandingPreview />
              <h2 className="app-stage__status">起课输入</h2>
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
                setReviewStage(stage);
              }}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
