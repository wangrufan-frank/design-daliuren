import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { referenceSession } from "../../test/reference-session";
import type { AppliedParityState } from "./apply-parity-state";
import manifest from "../assets/reference-surfaces/manifest.json";
import {
  attachReferenceSurfaces,
  referenceHeavenProjection,
  REFERENCE_SURFACE_MANIFEST,
} from "./reference-surfaces";

const source = {
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults;

function fixture() {
  const root = new THREE.Group();
  root.name = "artifact/root";
  const nodes = new Map<string, THREE.Object3D>([[root.name, root]]);
  for (const id of ["plate/earth", "plate/heaven", "plate/generals", "plate/core"]) {
    const node = new THREE.Group();
    node.name = id;
    root.add(node);
    nodes.set(id, node);
  }
  for (const layer of manifest.layers.filter((candidate) => candidate.kind === "general")) {
    const node = new THREE.Group();
    node.name = layer.ownerId;
    nodes.get("plate/generals")!.add(node);
    nodes.set(layer.ownerId, node);
  }
  root.updateMatrixWorld(true);
  return { nodes, root };
}

function applied(overrides: Partial<AppliedParityState> = {}): AppliedParityState {
  return {
    heavenAngleRad: manifest.referenceHeavenAngleRad,
    activeMonthGeneralNodeId: "month-general/great-auspiciousness",
    generalSlots: manifest.layers
      .filter((layer): layer is typeof layer & { kind: "general"; baselineEarth: string } => layer.kind === "general")
      .map((layer) => ({ nodeId: layer.ownerId, earth: layer.baselineEarth })),
    courseTracePoints: source.course.transmissions.map((item, index) => ({
      earth: item.branch,
      position: [index * 0.01, 0.05, index * 0.02] as const,
    })),
    ...overrides,
  };
}

function textures() {
  return new Map([...manifest.nativeLayers, ...manifest.layers.filter(({ kind }) => kind === "heaven")]
    .map(({ texture }) => texture).filter((name, index, names) => names.indexOf(name) === index)
    .map((name) => [name, new THREE.Texture()]));
}

describe("reference-derived model surfaces", () => {
  it("attaches every split visual layer to its semantic GLB owner", () => {
    const { nodes, root } = fixture();
    const attachment = attachReferenceSurfaces({
      nodes, source, applied: applied(), manifest: REFERENCE_SURFACE_MANIFEST, textures: textures(),
    });

    expect(attachment.layers).toHaveLength(18);
    expect(attachment.layers.filter(({ kind }) => kind === "earth").every(({ owner }) => owner === nodes.get("plate/earth"))).toBe(true);
    expect(attachment.layers.filter(({ kind }) => kind === "heaven").every(({ owner }) => owner === nodes.get("plate/heaven"))).toBe(true);
    expect(nodes.get("plate/earth")!.getObjectByName("reference-native/earth/0")).toBeDefined();
    const earthMesh = nodes.get("plate/earth")!.getObjectByName("reference-native/earth/0") as THREE.Mesh<THREE.BufferGeometry>;
    expect(earthMesh.geometry.getAttribute("uv").getY(0)).toBe(0);
    expect(earthMesh.geometry.getAttribute("position").getY(0)).toBe(0);
    expect(attachment.bounds.min.y).toBe(0);
    expect(attachment.bounds.max.y).toBe(0);
    expect(nodes.get("plate/heaven")!.getObjectByName("reference-native/heaven")).toBeDefined();
    expect(nodes.get("plate/core")!.getObjectByName("reference-native/core")).toBeDefined();
    for (const layer of manifest.nativeLayers.filter((candidate) => candidate.kind === "general")) {
      const mesh = nodes.get(layer.ownerId)!.getObjectByName(layer.id) as THREE.Mesh | undefined;
      expect(mesh, layer.id).toBeDefined();
      expect(mesh!.userData.generalName).toBe(layer.name);
    }

    attachment.dispose();
  });

  it("keeps heaven graphics interactive and general pieces independently placeable", () => {
    const { nodes, root } = fixture();
    const attachment = attachReferenceSurfaces({
      nodes, source, applied: applied(), manifest: REFERENCE_SURFACE_MANIFEST, textures: textures(),
    });
    const heaven = nodes.get("plate/heaven")!;
    const heavenMesh = heaven.getObjectByName("reference-native/heaven") as THREE.Mesh<THREE.BufferGeometry>;
    const vertex = new THREE.Vector3().fromBufferAttribute(heavenMesh.geometry.getAttribute("position"), 0);
    const before = heaven.localToWorld(vertex.clone());

    heaven.rotation.y += Math.PI / 6;
    root.updateMatrixWorld(true);
    const after = heaven.localToWorld(vertex.clone());
    expect(after.distanceTo(before)).toBeGreaterThan(0.01);

    const noble = nodes.get("general/noble")!;
    const snake = nodes.get("general/snake")!;
    const snakeBefore = snake.getWorldPosition(new THREE.Vector3());
    noble.position.x += 0.1;
    root.updateMatrixWorld(true);
    expect(snake.getWorldPosition(new THREE.Vector3())).toEqual(snakeBefore);

    attachment.dispose();
  });

  it("keeps one heaven surface while morphing from exact native graphics to rectified graphics", () => {
    expect(referenceHeavenProjection(0)).toBe("native");
    expect(referenceHeavenProjection(Math.PI / 2)).toBe("rectified");
    expect(referenceHeavenProjection(Math.PI)).toBe("rectified");

    const { nodes } = fixture();
    const attachment = attachReferenceSurfaces({
      nodes, source, applied: applied(), manifest: REFERENCE_SURFACE_MANIFEST, textures: textures(),
    });
    const heaven = nodes.get("plate/heaven")!;
    const surface = heaven.getObjectByName("reference-native/heaven") as THREE.Mesh<THREE.BufferGeometry>;
    expect(surface.visible).toBe(true);
    expect(heaven.getObjectByName("reference-rectified/heaven")).toBeUndefined();
    expect(surface.morphTargetInfluences).toEqual([0]);

    heaven.rotation.y += Math.PI / 2;
    expect(attachment.update()).toBe("rectified");
    expect(surface.visible).toBe(true);
    expect(surface.morphTargetInfluences).toEqual([1]);
    attachment.dispose();
  });

  it("renders one fully opaque heaven projection at symmetric and periodic 15 degree boundaries", () => {
    const { nodes } = fixture();
    const attachment = attachReferenceSurfaces({
      nodes, source, applied: applied(), manifest: REFERENCE_SURFACE_MANIFEST, textures: textures(),
    });
    const heaven = nodes.get("plate/heaven")!;
    const surface = heaven.getObjectByName("reference-native/heaven") as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(heaven.getObjectByName("reference-rectified/heaven")).toBeUndefined();
    const initialRotation = heaven.rotation.y;
    const stateAt = (delta: number) => {
      heaven.rotation.y = initialRotation + delta;
      const projection = attachment.update();
      const visibleSurfaces = heaven.children.filter((child) => child.visible && child.userData.referenceSurface) as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshBasicMaterial
      >[];
      return {
        projection,
        visibleSurfaceCount: visibleSurfaces.length,
        effectiveOpacity: 1 - visibleSurfaces.reduce((remaining, mesh) => remaining * (1 - mesh.material.opacity), 1),
      };
    };
    const degree = Math.PI / 180;
    for (const center of [15, -15, 375, -375]) {
      const before = stateAt((center - Math.sign(center) * 0.1) * degree);
      const after = stateAt((center + Math.sign(center) * 0.1) * degree);
      expect(before.projection).toBe("blended");
      expect(after.projection).toBe("blended");
      expect(before.visibleSurfaceCount).toBe(1);
      expect(after.visibleSurfaceCount).toBe(1);
      expect(before.effectiveOpacity).toBe(1);
      expect(after.effectiveOpacity).toBe(1);
    }
    const center = stateAt(15 * degree);
    expect(center.visibleSurfaceCount).toBe(1);
    expect(center.effectiveOpacity).toBe(1);
    expect(surface.material.opacity).toBe(1);

    attachment.dispose();
  });

  it("uses the exact gold trace only for the exact reference state", () => {
    const first = fixture();
    const firstTextures = textures();
    const firstAttachment = attachReferenceSurfaces({
      nodes: first.nodes,
      source,
      applied: applied(),
      manifest: REFERENCE_SURFACE_MANIFEST,
      textures: firstTextures,
    });
    expect(firstAttachment.trace.parent).toBe(first.nodes.get("plate/core"));
    expect(firstAttachment.trace.userData.courseEarths).toEqual(source.course.transmissions.map((item) => item.branch));
    const firstTrace = firstAttachment.trace.getObjectByName("reference/course-line") as THREE.Mesh;
    expect(firstTrace).toBeInstanceOf(THREE.Mesh);
    expect((firstTrace.material as THREE.MeshBasicMaterial).map).toBe(firstTextures.get("trace-detail.png"));

    firstAttachment.dispose();
  });

  it("uses actual course control points for a scalar-rotation collision state", () => {
    const exact = fixture();
    const exactAttachment = attachReferenceSurfaces({
      nodes: exact.nodes, source, applied: applied(), manifest: REFERENCE_SURFACE_MANIFEST, textures: textures(),
    });
    const collision = fixture();
    const collisionPoints = [
      { earth: "辰", position: [-0.031, 0.0464, 0.021] as const },
      { earth: "未", position: [0.027, 0.0464, -0.024] as const },
      { earth: "辰", position: [-0.031, 0.0464, 0.021] as const },
    ];
    const collisionAttachment = attachReferenceSurfaces({
      nodes: collision.nodes,
      source,
      applied: applied({
        heavenAngleRad: manifest.referenceHeavenAngleRad - Math.PI / 18,
        courseTracePoints: collisionPoints,
      }),
      manifest: REFERENCE_SURFACE_MANIFEST,
      textures: textures(),
    });

    expect(exactAttachment.trace.getObjectByName("reference/course-line")).toBeInstanceOf(THREE.Mesh);
    expect(collisionAttachment.trace.getObjectByName("reference/course-line")).toBeUndefined();
    const line = collisionAttachment.trace.getObjectByName("dynamic/course-line") as THREE.Mesh<THREE.BufferGeometry>;
    expect(line).toBeInstanceOf(THREE.Mesh);
    expect(line.geometry.getAttribute("position").count).toBe(12);
    expect((line.material as THREE.MeshBasicMaterial).side).toBe(THREE.DoubleSide);
    expect((line.material as THREE.MeshBasicMaterial).depthTest).toBe(false);
    expect((line.material as THREE.MeshBasicMaterial).transparent).toBe(true);
    expect((line.material as THREE.MeshBasicMaterial).forceSinglePass).toBe(true);
    const traceMeshes = collisionAttachment.trace.children.filter((child) => child instanceof THREE.Mesh) as THREE.Mesh[];
    expect(traceMeshes).toHaveLength(2);
    expect((traceMeshes[1].material as THREE.MeshBasicMaterial).forceSinglePass).toBe(true);
    const positions = line.geometry.getAttribute("position");
    const a = new THREE.Vector3().fromBufferAttribute(positions, 0);
    const b = new THREE.Vector3().fromBufferAttribute(positions, 1);
    const c = new THREE.Vector3().fromBufferAttribute(positions, 2);
    expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
    collisionPoints.forEach((point, index) => {
      const node = collisionAttachment.trace.getObjectByName(`dynamic/course-node/${index}`)!;
      expect(node).toBeInstanceOf(THREE.Object3D);
      expect(node.position.x).toBeCloseTo(point.position[0]);
      expect(node.position.z).toBeCloseTo(point.position[2]);
    });

    exactAttachment.dispose();
    collisionAttachment.dispose();
  });
});
