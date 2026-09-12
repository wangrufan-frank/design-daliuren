import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CourseResult } from "../../domain/course/types";
import { atlasArt, atlasCourseContext, atlasEntries, atlasIdForTerm, type AtlasEntry, type AtlasId } from "./entries";
import { renderAtlasImage } from "./render-atlas-image";
import "./element-atlas.css";

interface AtlasActions { open(id?: AtlasId): void }
const AtlasContext = createContext<AtlasActions | null>(null);
const noAtlas: AtlasActions = { open() {} };
const imageBase = import.meta.env.BASE_URL + "assets/atlas/";

export function useElementAtlas(): AtlasActions { return useContext(AtlasContext) ?? noAtlas; }
export function AtlasLauncher() {
  const { open } = useElementAtlas();
  return <button className="atlas-launcher" type="button" aria-label="元素图鉴" onClick={() => open()}><span aria-hidden="true">册</span>元素图鉴</button>;
}
export function AtlasTerm({ value, children }: { value: string; children?: ReactNode }) {
  const atlas = useContext(AtlasContext);
  const id = atlasIdForTerm(value);
  return atlas && id
    ? <button type="button" className="atlas-term" aria-label={"了解" + value} onClick={() => atlas.open(id)}>{children ?? value}</button>
    : <>{children ?? value}</>;
}
export function ElementAtlasProvider({ children, course }: { children: ReactNode; course?: CourseResult }) {
  const [screen, setScreen] = useState<AtlasId | "index" | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = useCallback((id?: AtlasId) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setScreen(id ?? "index");
  }, []);
  const close = useCallback(() => setScreen(null), []);
  const actions = useMemo(() => ({ open }), [open]);
  return <AtlasContext.Provider value={actions}>
    {children}
    {screen !== null && createPortal(<AtlasReader screen={screen} onSelect={setScreen} onClose={close} returnFocus={returnFocus.current} course={course} />, document.body)}
  </AtlasContext.Provider>;
}
function AtlasReader({ screen, onSelect, onClose, returnFocus, course }: {
  screen: AtlasId | "index"; onSelect(id: AtlasId | "index"): void; onClose(): void; returnFocus: HTMLElement | null; course?: CourseResult;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listPosition = useRef<{ top: number; id: AtlasId } | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("全部");
  const [compare, setCompare] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const search = query.trim().toLocaleLowerCase();
  function relevance(item: AtlasEntry) {
    const names = [item.title, ...item.aliases].map((name) => name.toLocaleLowerCase());
    if (names.includes(search)) return 0;
    return names.some((name) => name.startsWith(search)) ? 1 : 2;
  }
  const matching = atlasEntries.filter((item) => (filter === "全部" || item.category === filter) && [item.title, ...item.aliases, item.summary].join(" ").toLocaleLowerCase().includes(search))
    .sort((left, right) => relevance(left) - relevance(right));
  function selectTile(id: AtlasId) {
    listPosition.current = { top: panel.current?.scrollTop ?? 0, id };
    onSelect(id);
  }
  function clearSearch(all = false) {
    setQuery(""); setPage(0);
    if (all) setFilter("全部");
    searchInput.current?.focus();
  }
  const pages = Math.max(1, Math.ceil(matching.length / 12));
  const entry = atlasEntries.find((item) => item.id === screen);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = Array.from(document.body.children).filter((node) => node !== layer.current);
    const previousHidden = siblings.map((node) => node.getAttribute("aria-hidden"));
    siblings.forEach((node) => node.setAttribute("aria-hidden", "true"));
    return () => {
      document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => previousHidden[index] === null ? node.removeAttribute("aria-hidden") : node.setAttribute("aria-hidden", previousHidden[index]!));
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  useLayoutEffect(() => {
    setCompare(false);
    const reader = panel.current;
    if (!reader) return;
    const previous = screen === "index" ? listPosition.current : undefined;
    const target = previous
      ? Array.from(reader.querySelectorAll<HTMLElement>("[data-atlas-id]")).find((tile) => tile.dataset.atlasId === previous.id)
      : reader.querySelector<HTMLElement>("[data-atlas-close]");
    target?.focus({ preventScroll: true });
    reader.scrollTop = previous?.top ?? 0;
  }, [screen]);
  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')).filter((node) => !node.closest("details:not([open])") || node.tagName === "SUMMARY");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!panel.current.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  useEffect(() => {
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [onClose]);
  return <div ref={layer} className="atlas-layer">
    <div className="atlas-backdrop" onClick={onClose} aria-hidden="true" />
    <div ref={panel} className={"atlas-reader" + (entry ? " atlas-reader--entry" : "")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="atlas-topbar">
        {entry ? <button type="button" onClick={() => onSelect("index")}>← 全部图鉴</button> : <span>大六壬 · 读懂一方天地</span>}
        <button type="button" data-atlas-close aria-label="关闭图鉴" onClick={onClose}>关闭 <span aria-hidden="true">×</span></button>
      </header>
      {entry ? <>
        <AtlasCard key={entry.id} entry={entry} titleId={titleId} course={course} />
        {(entry.id === "zi" || entry.id === "hai") && <section className="atlas-comparison">
          <button type="button" className="atlas-compare-button" aria-expanded={compare} onClick={() => setCompare(!compare)}>子与亥对照 <span aria-hidden="true">{compare ? "−" : "+"}</span></button>
          {compare && <table aria-label="子与亥对照"><thead><tr><th>怎么区分</th><th>子</th><th>亥</th></tr></thead><tbody>
            <tr><th>支神名称</th><td>神后</td><td>登明</td></tr>
            <tr><th>共同属性</th><td>属水</td><td>属水</td></tr>
            <tr><th>地盘方位</th><td>北方</td><td>西北</td></tr>
            <tr><th>本工具换将</th><td>大寒后</td><td>雨水后</td></tr>
            <tr><th>天盘位置</th><td colSpan={2}>均随月将加时变化，不能按水景判断落宫。</td></tr>
          </tbody></table>}
        </section>}
        <nav className="atlas-related" aria-label="继续阅读"><span>沿着疑问，再读一页</span>{atlasEntries.filter((item) => item.id !== entry.id && item.category === entry.category).slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => onSelect(item.id)}>{item.title} ↗</button>)}</nav>
      </> : <>
        <div className="atlas-intro"><span className="atlas-kicker">式盘里的文化与知识</span><h2 id={titleId}>元素图鉴</h2><p>从一幅画，认识一个名字。<br />再回到盘中，看见它的位置。</p><span className="atlas-edition">全元素 · {atlasEntries.length} 则知识</span></div>
        <div className="atlas-search"><label htmlFor={`${titleId}-search`}>查一个名字，或它的别称</label><div className="atlas-search__field"><input ref={searchInput} id={`${titleId}-search`} type="search" aria-label="搜索元素" placeholder="如：子、神后、腾蛇、四课" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />{query && <button type="button" aria-label="清空搜索" onClick={() => clearSearch()}>清空</button>}</div></div>
        <div className="atlas-filters" role="group" aria-label="图鉴分类">{["全部", "地支", "天干", "天将", "五行", "六亲", "盘式", "取传"].map((item) => <button key={item} type="button" aria-label={item} aria-pressed={filter === item} onClick={() => { setFilter(item); setPage(0); }}>{item}<span className="atlas-category-count" aria-hidden="true">{item === "全部" ? atlasEntries.length : atlasEntries.filter((entry) => entry.category === item).length}</span></button>)}</div>
        <p className="atlas-result-count" role="status">共 {matching.length} 则{matching.length > 0 ? ` · 第 ${page + 1} / ${pages} 页` : ""}</p>
        {!matching.length && <div className="atlas-empty"><p>没有找到相关条目，请换个名称或分类。</p><button type="button" onClick={() => clearSearch(true)}>查看全部</button></div>}
        <div className="atlas-grid">{matching.slice(page * 12, (page + 1) * 12).map((item) => <button className={"atlas-tile atlas-tile--" + item.id} key={item.id} type="button" aria-label={item.title} data-atlas-id={item.id} onClick={() => selectTile(item.id)}>
          <div className="atlas-tile__image"><img src={imageBase + item.image} alt="" style={{ objectPosition: item.position }} /><span>{item.glyph}</span></div>
          <div className="atlas-tile__text"><small>{item.category}</small><b>{item.title}</b><p>{item.subtitle}</p><span aria-hidden="true">展开阅读 ↗</span></div>
        </button>)}</div>
        <nav className="atlas-pagination" aria-label="图鉴翻页"><button type="button" disabled={page === 0} onClick={() => { setPage(page - 1); panel.current?.scrollTo(0, 0); }}>上一页</button><span>{page + 1} / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => { setPage(page + 1); panel.current?.scrollTo(0, 0); }}>下一页</button></nav>
        <p className="atlas-index-note">收录盘面全部元素、九宗门与基础知识。<br />古画与文物辅助理解，知识依据与配图出处分别列出。</p>
      </>}
    </div>
  </div>;
}
function AtlasCard({ entry, titleId, course }: { entry: AtlasEntry; titleId: string; course?: CourseResult }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<string>();
  const art = atlasArt[entry.image];
  async function save() {
    setSaving(true); setStatus(""); setPreview(undefined);
    try {
      const data = await renderAtlasImage({ title: entry.title, summary: entry.summary, meaning: entry.meaning, imageUrl: imageBase + entry.image, credit: art.title + " · " + art.credit + " · 艺术配图" });
      const bridge = window.xhs?.miniTool;
      if (bridge) {
        const { filePath } = await bridge.writeTempFile({ data });
        await bridge.saveImageToPhotosAlbum({ filePath });
        setStatus("知识卡片已保存到相册。");
      } else { setPreview(data); setStatus("知识卡片已生成，可长按或右键保存下方图片。"); }
    } catch { setStatus("保存失败，请确认画作已加载，并检查相册权限后重试。"); }
    finally { setSaving(false); }
  }
  return <>
    <figure className={"atlas-hero atlas-hero--" + entry.id}>
      {!imageFailed && <img src={imageBase + entry.image} style={{ objectPosition: entry.position }} alt={art.title + "，艺术配图"} onError={() => setImageFailed(true)} />}
      <div className="atlas-hero__label"><span>{entry.category} · 六壬初识</span><h2 id={titleId}>{entry.title}</h2><p>{entry.subtitle}</p></div>
      <span className="atlas-seal" aria-hidden="true">{entry.glyph}</span>
    </figure>
    {imageFailed && <p className="atlas-image-error">画作暂不可用，仍可阅读下方释义。</p>}
    <div className="atlas-card-body">
      <p className="atlas-art-caption">{art.title} · 局部 · 艺术配图</p>
      <p className="atlas-summary">{entry.summary}</p>
      {entry.id === "plates" && <div className="atlas-plate-diagram" role="img" aria-label="天盘圆形、地盘方形的两层结构示意，不表示当前排盘"><div><span>天盘</span></div><span>地盘</span><small>两层结构示意</small></div>}
      <section className="atlas-context" aria-label="在这一课中"><h3>在这一课中</h3>{course ? atlasCourseContext(entry.id, course).map((line) => <p key={line}>{line}</p>) : <p>起课后，从盘面打开这张卡片，可查看它在本课中的位置与关系。</p>}</section>
      <div className="atlas-reading">
        <details><summary>来历与背景</summary><p>{entry.history}</p></details>
        <details><summary>六壬中的含义</summary><p>{entry.meaning}</p></details>
        <details><summary>容易混淆的地方</summary><p>{entry.caution}</p></details>
        <details><summary>知识与画作出处</summary><h3>知识依据</h3>{entry.sources.map((source) => <p key={source}>{source}</p>)}<h3>画作来源</h3><p>{art.title}<br />{art.detail}<br />{art.credit}</p><p>使用开放馆藏图并裁取局部。配图呈现传统艺术意境，不构成术式对应或历史人物身份的证据。</p></details>
      </div>
      <div className="atlas-save"><button type="button" onClick={save} disabled={saving}>{saving ? "正在生成…" : "保存知识卡片"}</button><small>保存概念与画作，不包含本课信息</small><p role="status">{status}</p>{preview && <img className="atlas-export-preview" src={preview} alt={entry.title + "知识卡片，可保存"} />}</div>
    </div>
  </>;
}
