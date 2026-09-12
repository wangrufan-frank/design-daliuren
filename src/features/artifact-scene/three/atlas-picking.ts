import * as THREE from "three";
import { atlasEntries, type AtlasId } from "../../element-atlas/entries";

const ELEMENTS: Record<string, AtlasId> = {
  "branch/earth/子": "zi", "branch/earth/亥": "hai",
  "month-general/神后": "zi", "month-general/登明": "hai",
  "lesson/first": "core-一课", "lesson/second": "core-二课", "lesson/third": "core-三课", "lesson/fourth": "core-第四课",
  "transmission/initial": "core-初传", "transmission/middle": "core-中传", "transmission/final": "core-末传",
  "general/noble": "noble", "plate/heaven": "plates", "plate/earth": "plates",
};

for (const entry of atlasEntries) {
  if (entry.category === "地支") {
    ELEMENTS["branch/earth/" + entry.aliases[0]] = entry.id;
    ELEMENTS["month-general/" + entry.aliases[1]] = entry.id;
  }
  if (entry.category === "天将") ELEMENTS["general/" + (entry.id === "noble" ? "noble" : entry.id.slice(8))] = entry.id;
}

function visible(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  if (!(object instanceof THREE.Mesh)) return false;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some((material) => material.visible && material.opacity > 0 && material.colorWrite);
}

function elementFor(object: THREE.Object3D): { id: AtlasId; node: THREE.Object3D } | undefined {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    const id = node.userData.node_id;
    if (typeof id !== "string") continue;
    if (ELEMENTS[id]) return { id: ELEMENTS[id], node };
    if (/^(branch|general|month-general|lesson|transmission)\//.test(id)) return undefined;
  }
  return undefined;
}

export function mountAtlasPicking(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  root: THREE.Object3D,
  onSelect?: (id: AtlasId, node: THREE.Object3D) => void,
): () => void {
  if (!onSelect) return () => {};
  const pointers = new Set<number>();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let tap: { pointerId: number; x: number; y: number } | undefined;
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    pointers.add(event.pointerId);
    tap = pointers.size === 1 ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY } : undefined;
  }
  function move(event: PointerEvent) {
    if (tap?.pointerId === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 6) tap = undefined;
  }
  function end(event: PointerEvent) {
    move(event);
    const selected = event.type === "pointerup" && tap?.pointerId === event.pointerId;
    pointers.delete(event.pointerId);
    tap = undefined;
    if (!selected) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(root, true).find(({ object }) => visible(object));
    const id = hit && elementFor(hit.object);
    if (id) {
      canvas.focus();
      onSelect!(id.id, id.node);
    }
  }
  const cancelTap = () => { tap = undefined; };
  canvas.addEventListener("wheel", cancelTap, true);
  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", end, true);
  canvas.addEventListener("pointercancel", end, true);
  return () => {
    canvas.removeEventListener("wheel", cancelTap, true);
    canvas.removeEventListener("pointerdown", down, true);
    canvas.removeEventListener("pointermove", move, true);
    canvas.removeEventListener("pointerup", end, true);
    canvas.removeEventListener("pointercancel", end, true);
    pointers.clear();
    tap = undefined;
  };
}
