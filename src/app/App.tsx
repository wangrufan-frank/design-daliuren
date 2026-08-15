import "../styles/tokens.css";
import "../styles/global.css";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>大六壬演式</h1>
      </header>
      <section aria-labelledby="stage-heading">
        <h2 id="stage-heading">起课输入</h2>
        <p>建立起课上下文后，依次审核传统规则阶段。</p>
      </section>
    </main>
  );
}
