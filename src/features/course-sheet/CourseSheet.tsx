import { useLayoutEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import type { CourseResult } from "../../domain/course/types";
import { VoidBranch } from "../void-branch/VoidBranch";

const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

export function CourseSheet({ result }: { result: CourseResult }) {
  const [copyState, setCopyState] = useState<"idle" | "generating" | "copied" | "preview" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const sheetRef = useRef<HTMLElement>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const resetTimer = useRef<number | undefined>(undefined);
  const copyRequest = useRef(0);
  const mounted = useRef(false);
  const isWeChat = typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
  const methodText = [
    result.method.method,
    result.method.subtype,
    result.method.variants.length ? result.method.variants.join("/") : undefined,
  ].filter((value): value is string => Boolean(value)).join(" · ");

  async function copyCourse() {
    const request = ++copyRequest.current;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = undefined;
    setCopyState("generating");
    try {
      const sheet = sheetRef.current;
      if (!sheet) throw new Error("Missing course sheet");
      const blob = await toBlob(sheet, {
        backgroundColor: "#f3efe6",
        cacheBust: true,
        skipFonts: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        filter: (node) => !(node instanceof HTMLElement && node.dataset.courseSection === "copy"),
      });
      if (!blob) throw new Error("Course image generation failed");
      if (!mounted.current || request !== copyRequest.current) return;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      let copied = false;
      if (!isWeChat && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (!mounted.current || request !== copyRequest.current) return;
      setCopyState(copied ? "copied" : "preview");
      if (!copied) return;
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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = undefined;
    setPreviewUrl(undefined);
    return () => {
      mounted.current = false;
      copyRequest.current += 1;
      window.clearTimeout(resetTimer.current);
      resetTimer.current = undefined;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = undefined;
    };
  }, [result]);

  const copyLabel = copyState === "generating"
    ? "正在生成图片"
    : copyState === "copied" ? "图片已复制" : "复制课式图片";

  return (
    <article ref={sheetRef} className="course-sheet" aria-label="标准文字课式">
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
        <span>生成完整课式图片，不包含本操作区域</span>
        <button type="button" disabled={copyState === "generating"} onClick={copyCourse}>{copyLabel}</button>
        {previewUrl ? (
          <figure className="course-sheet__image-preview">
            <figcaption role="status">
              {copyState === "copied"
                ? "课式图片已复制，也可保存下方图片"
                : isWeChat ? "微信内请长按图片保存" : "请保存或长按下方图片"}
            </figcaption>
            <img src={previewUrl} alt="生成的大六壬课式" />
            <a className="course-sheet__save" href={previewUrl} download="大六壬课式.png">保存课式图片</a>
          </figure>
        ) : null}
        {copyState === "error" ? <p role="alert">图片生成失败，请重试</p> : null}
      </footer>
    </article>
  );
}
