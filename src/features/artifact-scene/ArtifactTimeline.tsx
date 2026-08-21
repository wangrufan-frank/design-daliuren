import type { CSSProperties } from "react";
import { ARTIFACT_DURATION_MS } from "./timeline/evaluate-pose";

const STAGES = [
  { timeMs: 0, label: "起式" },
  { timeMs: 1_200, label: "历法" },
  { timeMs: 3_200, label: "天地盘" },
  { timeMs: 5_400, label: "四课" },
  { timeMs: 7_600, label: "三传" },
  { timeMs: 10_300, label: "天将" },
  { timeMs: ARTIFACT_DURATION_MS, label: "结课" },
] as const;

interface ArtifactTimelineProps {
  timeMs: number;
  playing: boolean;
  onSeek(timeMs: number): void;
  onTogglePlayback(): void;
  onResetCamera(): void;
  onShowCourse(): void;
}

function adjacentStage(timeMs: number, direction: -1 | 1): number {
  const times = STAGES.map((stage) => stage.timeMs);
  if (direction < 0) return [...times].reverse().find((time) => time < timeMs) ?? 0;
  return times.find((time) => time > timeMs) ?? ARTIFACT_DURATION_MS;
}

function formatTime(timeMs: number): string {
  const seconds = Math.floor(timeMs / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(timeMs % 1_000).padStart(3, "0")}`;
}

export function ArtifactTimeline({
  timeMs,
  playing,
  onSeek,
  onTogglePlayback,
  onResetCamera,
  onShowCourse,
}: ArtifactTimelineProps) {
  return (
    <section className="artifact-timeline" aria-label="器物推演控制">
      <div className="artifact-timeline__transport">
        <button type="button" onClick={onTogglePlayback}>{playing ? "暂停推演" : "播放推演"}</button>
        <button type="button" onClick={() => onSeek(adjacentStage(timeMs, -1))}>上一阶段</button>
        <button type="button" onClick={() => onSeek(adjacentStage(timeMs, 1))}>下一阶段</button>
      </div>

      <div className="artifact-timeline__scale">
        <div className="artifact-timeline__readout">
          <span>演式刻度</span>
          <output htmlFor="artifact-timeline-range">{formatTime(timeMs)}</output>
        </div>
        <input
          id="artifact-timeline-range"
          type="range"
          min={0}
          max={ARTIFACT_DURATION_MS}
          step={1}
          value={timeMs}
          aria-label="推演时间轴"
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        <div className="artifact-timeline__stages" aria-hidden="true">
          {STAGES.map((stage) => (
            <span
              key={stage.timeMs}
              style={{ "--stage-position": `${stage.timeMs / ARTIFACT_DURATION_MS * 100}%` } as CSSProperties}
            >
              <i />
              <b>{stage.label}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="artifact-timeline__actions">
        <button type="button" onClick={onResetCamera}>重置视角</button>
        <button type="button" onClick={onShowCourse}>查看文字课式</button>
      </div>
    </section>
  );
}
