import { useElementAtlas } from "../../features/element-atlas/ElementAtlas";
import { useEffect, useRef, useState } from "react";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { mountParityArtifact } from "./create-parity-artifact";

const earthBoardUrl = "./assets/earth-board.jpg";

export function ProgrammaticArtifact({ source, onUnavailable }: { source: ArtifactSourceResults; onUnavailable: () => void }) {
  const { open: openAtlas } = useElementAtlas();
  const openAtlasRef = useRef(openAtlas);
  openAtlasRef.current = openAtlas;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!canvasRef.current) return;
    let mounted: ReturnType<typeof mountParityArtifact> | undefined;
    try {
      mounted = mountParityArtifact(canvasRef.current, source, earthBoardUrl, () => {
        setState("unavailable");
        onUnavailable();
      }, () => setState("ready"), (id) => openAtlasRef.current(id));
    } catch {
      setState("unavailable");
      onUnavailable();
    }
    return () => mounted?.dispose();
  }, [source, onUnavailable]);

  return (
    <section className="artifact" aria-label="三维推演模型" data-model-ready={state === "ready" ? "true" : "false"}>
      <canvas ref={canvasRef} tabIndex={0} className="artifact__canvas" aria-label="可旋转缩放的大六壬玉盘" />
      {state === "loading" ? <p className="artifact__status">正在生成三维玉盘…</p> : null}
      {state === "unavailable" ? <p className="artifact__status">模型不可用，已切换文字课式</p> : null}
      {state === "ready" ? <p className="artifact__hint">拖动天盘转地支 · 外圈旋转 · 双指缩放</p> : null}
    </section>
  );
}
