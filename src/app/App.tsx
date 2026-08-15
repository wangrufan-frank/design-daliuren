import { useState } from "react";
import type { CourseSession } from "../domain/chart/types";
import { CourseInputForm } from "../features/course-input/CourseInputForm";
import { RuleStageRail } from "../features/rule-review/RuleStageRail";
import "../styles/tokens.css";
import "../styles/global.css";

export function App() {
  const [session, setSession] = useState<CourseSession | null>(null);
  const [inputOpen, setInputOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(true);

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
          {inputOpen && <CourseInputForm onSubmit={(input) => setSession({ input, snapshots: {} })} />}
        </aside>
        <section className="app-stage" aria-live="polite">
          <h2>{session ? "规则确认" : "起课输入"}</h2>
          <p>{session ? "下一步：确认历法与月将规则。" : "输入时间与地点，建立可追溯的起课上下文。"}</p>
        </section>
        <aside className="app-panel app-rule-panel" aria-label="推演依据">
          <button className="app-panel__toggle" type="button" aria-expanded={railOpen} onClick={() => setRailOpen((value) => !value)}>
            推演依据
          </button>
          {railOpen && <RuleStageRail completed={[]} current="calendar" />}
        </aside>
      </div>
    </main>
  );
}
