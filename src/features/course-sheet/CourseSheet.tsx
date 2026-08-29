import { useLayoutEffect, useRef, useState } from "react";
import { serializeCourseText } from "../../domain/course/policy";
import type { CourseResult } from "../../domain/course/types";
import { VoidBranch } from "../void-branch/VoidBranch";

const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

export function CourseSheet({ result }: { result: CourseResult }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | undefined>(undefined);
  const copyRequest = useRef(0);
  const mounted = useRef(false);
  const methodText = [
    result.method.method,
    result.method.subtype,
    result.method.variants.length ? result.method.variants.join("/") : undefined,
  ].filter((value): value is string => Boolean(value)).join(" · ");

  async function copyCourse() {
    const request = ++copyRequest.current;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = undefined;
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(serializeCourseText(result));
      if (!mounted.current || request !== copyRequest.current) return;
      setCopyState("copied");
      resetTimer.current = window.setTimeout(() => {
        if (mounted.current && request === copyRequest.current) setCopyState("idle");
        resetTimer.current = undefined;
      }, 2000);
    } catch {
      if (mounted.current && request === copyRequest.current) setCopyState("error");
    }
  }

  useLayoutEffect(() => {
    mounted.current = true;
    copyRequest.current += 1;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = undefined;
    setCopyState("idle");
    return () => {
      mounted.current = false;
      copyRequest.current += 1;
      window.clearTimeout(resetTimer.current);
      resetTimer.current = undefined;
    };
  }, [result]);

  return (
    <article className="course-sheet" aria-label="标准文字课式">
      <header className="course-sheet__summary" data-course-section="summary">
        <div>
          <p>第六阶段 · 已验证事实投影</p>
          <h2>大六壬 · 标准文字课式</h2>
          <span>{result.context.locationName} · {result.context.lunarDateDisplay}</span>
        </div>
        <dl>
          <div><dt>北京时间</dt><dd>{result.context.civilDateTime}</dd></div>
          <div><dt>生效干支日</dt><dd>{result.context.effectiveGanzhiDate}</dd></div>
          <div><dt>四柱</dt><dd>{Object.values(result.context.pillars).join("　")}</dd></div>
          <div><dt>旬空</dt><dd>{result.context.voidBranches.join("　")}</dd></div>
          <div><dt>本命</dt><dd>{result.context.natal.birthYear}年 · {result.context.natal.branch}命 · {result.context.natal.source === "manual" ? "手动选择" : "自动换算"}</dd></div>
          <div><dt>月建 / 月将</dt><dd>{result.context.monthBuild} · {result.context.monthGeneral.name}{result.context.monthGeneral.branch}</dd></div>
        </dl>
      </header>
      <div className="course-sheet__body">
        <div className="course-sheet__left">
          <section className="course-sheet__transmissions" data-course-section="transmissions">
            <h3>三传 · {methodText}</h3>
            <ol>
              {result.transmissions.map((item) => (
                <li key={item.position} data-testid="course-transmission" data-position={item.position}>
                  <b data-layer="general">{item.general}</b>
                  <div data-layer="content"><span>{item.label}</span><strong><VoidBranch value={item.branch} voidBranches={result.context.voidBranches} /></strong><small>{item.relation}</small></div>
                </li>
              ))}
            </ol>
          </section>
          <section className="course-sheet__lessons" data-course-section="lessons">
            <h3>四课</h3>
            <ol>
              {result.lessons.map((item) => (
                <li key={item.id} data-testid="course-lesson" data-lesson={item.id}>
                  <b data-layer="general">{item.general}</b>
                  <span>{item.label}</span><strong><VoidBranch value={item.upper} voidBranches={result.context.voidBranches} /></strong><i /><small><VoidBranch value={item.lower.value} voidBranches={result.context.voidBranches} /></small>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <section className="course-sheet__plate-region" data-course-section="palaces">
          <p className="course-sheet__orientation">上南 · 下北 · 左东 · 右西</p>
          <div className="course-sheet__plate-layout">
            <ul className="course-sheet__plate" aria-label="标准课式十二宫方盘">
              {result.palaces.map((item) => (
                <li key={item.earth} data-earth={item.earth} data-noble={item.noble}>
                  <strong>{item.general}</strong><span>天盘 <VoidBranch value={item.heaven} voidBranches={result.context.voidBranches} /></span><span>地盘 <VoidBranch value={item.earth} voidBranches={result.context.voidBranches} /></span>
                </li>
              ))}
            </ul>
            <div className="course-sheet__plate-center" data-testid="course-plate-center">
              <small>月将 / 占时</small>
              <strong>{result.context.monthGeneral.name}{result.context.monthGeneral.branch} · {result.context.divinationHour}时</strong>
              <small>{dayNightText[result.noble.dayNight]}贵{result.noble.nobleHeaven} · 落{result.noble.nobleEarth}宫 · {directionText[result.noble.direction]}布</small>
            </div>
          </div>
        </section>
      </div>
      <footer className="course-sheet__copy" data-course-section="copy">
        <span>复制内容使用稳定纯文本分段</span>
        <button type="button" onClick={copyCourse}>{copyState === "copied" ? "已复制" : "复制课式"}</button>
        {copyState === "copied" ? <p role="status">课式已复制</p> : null}
        {copyState === "error" ? <p role="alert">复制失败，请重试</p> : null}
      </footer>
    </article>
  );
}
