import { useMemo, useState } from "react";
import type { CourseResult } from "../../domain/course/types";
import { AtlasTerm } from "../../features/element-atlas/ElementAtlas";
import { renderCourseImage } from "./render-course-image";
import { saveCourseImage } from "./xhs-bridge";

const PALACE_ORDER = ["巳", "午", "未", "申", "辰", "酉", "卯", "戌", "寅", "丑", "子", "亥"] as const;
const PALACE_CLASS: Record<string, string> = {
  巳: "p-00", 午: "p-10", 未: "p-20", 申: "p-30", 辰: "p-01", 酉: "p-31",
  卯: "p-02", 戌: "p-32", 寅: "p-03", 丑: "p-13", 子: "p-23", 亥: "p-33",
};

export function MiniToolCourseSheet({ result }: { result: CourseResult }) {
  const [status, setStatus] = useState<"idle" | "generating" | "saved" | "container" | "error">("idle");
  const palaces = useMemo(() => {
    const byEarth = new Map(result.palaces.map((item) => [item.earth, item]));
    return PALACE_ORDER.map((branch) => byEarth.get(branch)!);
  }, [result]);

  async function save() {
    setStatus("generating");
    try {
      await saveCourseImage(renderCourseImage(result));
      setStatus("saved");
    } catch (error) {
      setStatus(error instanceof Error && error.message.includes("小工具容器") ? "container" : "error");
    }
  }

  return (
    <article className="course" aria-label="标准文字课式">
      <header className="course__summary">
        <p>大六壬 · 标准文字课式</p>
        <h2>{result.context.reason}</h2>
        <dl>
          <div><dt>北京时间</dt><dd>{result.context.civilDateTime}</dd></div>
          <div><dt>农历</dt><dd>{result.context.lunarDateDisplay}</dd></div>
          <div><dt><AtlasTerm value="四柱" /></dt><dd>{Object.values(result.context.pillars).map((pillar, index) => <span key={index}>{index > 0 ? "　" : ""}{pillar.split("").map((term, offset) => <AtlasTerm key={offset} value={term} />)}</span>)}</dd></div>
          <div><dt><AtlasTerm value="旬空" /></dt><dd>{result.context.voidBranches.map((branch, index) => <span key={branch}>{index > 0 ? "　" : ""}<AtlasTerm value={branch} /></span>)}</dd></div>
          <div><dt><AtlasTerm value="月建" /> / <AtlasTerm value="月将" /></dt><dd><AtlasTerm value={result.context.monthBuild} /> · <AtlasTerm value={result.context.monthGeneral.name} /><AtlasTerm value={result.context.monthGeneral.branch} /></dd></div>
          <div><dt><AtlasTerm value="占时" /> / <AtlasTerm value="本命" /></dt><dd><AtlasTerm value={result.context.divinationHour} />时 · <AtlasTerm value={result.context.natal.branch} />命</dd></div>
        </dl>
      </header>

      <section className="course__section">
        <h3><AtlasTerm value="三传" /> · <AtlasTerm value={result.method.method} />{result.method.subtype && <> · <AtlasTerm value={result.method.subtype} /></>}{result.method.variants.map((variant) => <span key={variant}> · <AtlasTerm value={variant} /></span>)}</h3>
        <ol className="course__transmissions">
          {result.transmissions.map((item) => <li key={item.position}><small><AtlasTerm value={item.label} /></small><b><AtlasTerm value={item.branch} /></b><span><AtlasTerm value={item.general} /> · <AtlasTerm value={item.relation} /></span></li>)}
        </ol>
      </section>

      <section className="course__section">
        <h3><AtlasTerm value="四课" /></h3>
        <ol className="course__lessons">
          {result.lessons.map((item) => <li key={item.id}><small><AtlasTerm value={item.id === "fourth" ? "第四课" : item.label}>{item.label}</AtlasTerm> · <AtlasTerm value={item.general} /></small><b><AtlasTerm value={item.upper} /></b><i /><span><AtlasTerm value={item.lower.value} /></span></li>)}
        </ol>
      </section>

      <section className="course__section">
        <h3>十二宫方盘</h3>
        <p className="course__orientation">上南 · 下北 · 左东 · 右西</p>
        <div className="palace-grid">
          {palaces.map((item) => <div key={item.earth} className={`palace ${PALACE_CLASS[item.earth]}${item.noble ? " palace--noble" : ""}`}><b><AtlasTerm value={item.general} /></b><span><AtlasTerm value="天盘">天</AtlasTerm> <AtlasTerm value={item.heaven} /></span><span><AtlasTerm value="地盘">地</AtlasTerm> <AtlasTerm value={item.earth} /></span></div>)}
          <div className="palace-center"><b><AtlasTerm value={result.context.monthGeneral.name} /><AtlasTerm value={result.context.monthGeneral.branch} /></b><span>{result.noble.dayNight === "day" ? "昼" : "夜"}<AtlasTerm value="贵人">贵</AtlasTerm> · {result.noble.direction === "forward" ? "顺布" : "逆布"}</span></div>
        </div>
      </section>

      <footer className="course__save">
        <button type="button" disabled={status === "generating"} onClick={save}>{status === "generating" ? "正在生成图片…" : "保存课式图片到相册"}</button>
        <p role="status">{status === "saved" ? "已保存到相册" : status === "container" ? "请在小工具容器内保存" : status === "error" ? "保存失败，请检查相册权限" : "图片包含完整四课、三传与十二宫"}</p>
      </footer>
    </article>
  );
}
