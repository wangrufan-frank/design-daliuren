import { useCallback, useState } from "react";
import type { CourseInput } from "../domain/chart/types";
import { CourseInputForm } from "../features/course-input/CourseInputForm";
import type { ArtifactSourceResults } from "../features/artifact-scene/model/types";
import { ProgrammaticArtifact } from "./artifact/ProgrammaticArtifact";
import { computeMiniToolCourse } from "./compute-course";
import { MiniToolCourseSheet } from "./course/MiniToolCourseSheet";
import { AtlasLauncher, ElementAtlasProvider } from "../features/element-atlas/ElementAtlas";

export function MiniToolApp() {
  const [source, setSource] = useState<ArtifactSourceResults | null>(null);
  const [mode, setMode] = useState<"artifact" | "text">("artifact");
  const [error, setError] = useState("");
  const showText = useCallback(() => setMode("text"), []);

  function submit(input: CourseInput) {
    const outcome = computeMiniToolCourse(input);
    if (!outcome.ok) { setError(outcome.message); return; }
    setError("");
    setSource(outcome.source);
    setMode("artifact");
  }

  if (!source) {
    return (
      <ElementAtlasProvider>
        <main className="mini-shell mini-shell--form">
          <header className="mini-intro"><p>离线演式</p><h1>大六壬</h1><span>输入北京时间，生成三维天地盘与完整文字课式</span><AtlasLauncher /></header>
          <section className="input-card"><CourseInputForm onSubmit={submit} />{error ? <p role="alert">{error}</p> : null}</section>
        </main>
      </ElementAtlasProvider>
    );
  }

  return (
    <ElementAtlasProvider course={source.course}>
      <main className="mini-shell">
        <header className="result-bar"><div><small>大六壬演式</small><b>{source.course.context.reason}</b></div><button type="button" onClick={() => setSource(null)}>重新起课</button></header>
        <nav className="mode-tabs" aria-label="结果页面">
          <button type="button" aria-current={mode === "artifact" ? "page" : undefined} onClick={() => setMode("artifact")}>三维推演</button>
          <button type="button" aria-current={mode === "text" ? "page" : undefined} onClick={() => setMode("text")}>文字课式</button>
          <AtlasLauncher />
        </nav>
        {mode === "artifact" ? <ProgrammaticArtifact source={source} onUnavailable={showText} /> : <MiniToolCourseSheet result={source.course} />}
      </main>
    </ElementAtlasProvider>
  );
}
