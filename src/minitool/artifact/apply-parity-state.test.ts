import * as THREE from "three";
import { expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../../domain/calendar/constants";
import type { EarthlyBranch } from "../../domain/chart/types";
import { GENERAL_NODE_IDS } from "../../features/artifact-scene/model/jade-plate-layout";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { referenceSession } from "../../test/reference-session";
import { applyParityState } from "./apply-parity-state";
import { MINITOOL_MODEL_GROUPS } from "./model-parity-contract";
import "./generated/model-core.js";
import "./generated/model-earth.js";
import "./generated/model-generals.js";
import "./generated/model-heaven.js";
import { decodeParityModel } from "./model-data";

const source = {
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults;

function fixture() {
  const model = decodeParityModel(window.__DALIUREN_MODEL_PARTS__!);
  const nodes = new Map<string, THREE.Group>();
  for (const node of model.nodes.values()) nodes.set(node.id, new THREE.Group());
  for (const node of model.nodes.values()) {
    const object = nodes.get(node.id)!;
    const matrix = new THREE.Matrix4().fromArray(node.matrix);
    if (!node.parentId) matrix.decompose(object.position, object.quaternion, object.scale);
    else {
      const parent = nodes.get(node.parentId)!;
      matrix.premultiply(new THREE.Matrix4().fromArray(model.nodes.get(node.parentId)!.matrix).invert());
      matrix.decompose(object.position, object.quaternion, object.scale);
      parent.add(object);
    }
  }
  const meshes = model.meshes.map((data) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.position), 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    nodes.get(data.nodeId)!.add(mesh);
    return { data, mesh };
  });
  return { model, nodes, meshes };
}

function courseControlPoints(points: readonly { position: readonly [number, number, number] }[]) {
  const midpoint = (left: readonly number[], right: readonly number[]) => left.map((value, index) => (value + right[index]) / 2);
  return [points[0].position, midpoint(points[0].position, points[1].position), points[1].position,
    midpoint(points[1].position, points[2].position), points[2].position];
}

function realTraceSectionVertices(trace: THREE.Mesh<THREE.BufferGeometry>) {
  const positions = trace.geometry.getAttribute("position");
  const entries = new Map<string, number[]>();
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const key = new THREE.Vector3().fromBufferAttribute(positions, vertex).toArray().map((value) => value.toFixed(7)).join(",");
    entries.set(key, [...(entries.get(key) ?? []), vertex]);
  }
  const points = [...entries.entries()].map(([key, vertices]) => ({ point: new THREE.Vector3(...key.split(",").map(Number)), vertices }));
  const unassigned = new Set(points);
  const groups: typeof points[] = [];
  while (unassigned.size > 0) {
    const group: typeof points = [];
    const queue = [unassigned.values().next().value!];
    unassigned.delete(queue[0]);
    while (queue.length > 0) {
      const point = queue.pop()!;
      group.push(point);
      for (const candidate of [...unassigned]) {
        if (point.point.distanceTo(candidate.point) < 0.002) {
          unassigned.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    groups.push(group);
  }
  const groupByVertex = new Map<number, number>();
  groups.forEach((group, index) => group.forEach(({ vertices }) => vertices.forEach((vertex) => groupByVertex.set(vertex, index))));
  const neighbors = groups.map(() => new Set<number>());
  for (let face = 0; face < trace.geometry.index!.count; face += 3) {
    const [left, right] = [...new Set([0, 1, 2].map((offset) => groupByVertex.get(trace.geometry.index!.getX(face + offset))))];
    if (right !== undefined) {
      neighbors[left!].add(right);
      neighbors[right].add(left!);
    }
  }
  const endpoints = neighbors.map((items, index) => ({ items, index })).filter(({ items }) => items.size === 1)
    .sort((left, right) => Math.min(...groups[left.index].flatMap(({ vertices }) => vertices)) - Math.min(...groups[right.index].flatMap(({ vertices }) => vertices)));
  const ordered: number[] = [];
  let previous: number | undefined;
  let current: number | undefined = endpoints[0]?.index;
  while (current !== undefined) {
    ordered.push(current);
    const next: number | undefined = [...neighbors[current]].find((candidate) => candidate !== previous);
    previous = current;
    current = next;
  }
  return ordered.map((index) => groups[index].map(({ vertices }) => vertices[0]));
}

function sourceWithTransmissionBranches(branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch]): ArtifactSourceResults {
  const [firstTransmission, middleTransmission, finalTransmission] = source.transmissions.transmissions;
  const [firstCourse, middleCourse, finalCourse] = source.course.transmissions;
  const transmissions = [
    { ...firstTransmission, branch: branches[0] },
    { ...middleTransmission, branch: branches[1] },
    { ...finalTransmission, branch: branches[2] },
  ] as const;
  const withCourseBranch = (item: typeof firstCourse, branch: EarthlyBranch) => ({
    ...item,
    branch,
    general: source.generals.placements.find((placement) => placement.heaven === branch)!.general,
  });
  const courseTransmissions = [
    withCourseBranch(firstCourse, branches[0]),
    withCourseBranch(middleCourse, branches[1]),
    withCourseBranch(finalCourse, branches[2]),
  ] as const;
  return {
    ...source,
    transmissions: { ...source.transmissions, transmissions },
    course: { ...source.course, transmissions: courseTransmissions },
  };
}

it("maps real trace faces only between neighboring extracted cross-sections", () => {
  const { nodes, meshes } = fixture();
  const trace = meshes.find(({ data }) => data.nodeId === "trace/course")!.mesh;
  const originalPositions = trace.geometry.getAttribute("position");
  const duplicateVertices = new Map<string, number[]>();
  for (let vertex = 0; vertex < originalPositions.count; vertex += 1) {
    const key = new THREE.Vector3().fromBufferAttribute(originalPositions, vertex).toArray().map((value) => value.toFixed(7)).join(",");
    duplicateVertices.set(key, [...(duplicateVertices.get(key) ?? []), vertex]);
  }
  const originalIndices = [...trace.geometry.index!.array];
  const applied = applyParityState(nodes, source);
  const controls = courseControlPoints(applied.courseTracePoints);
  const positions = trace.geometry.getAttribute("position");
  const maximumFaceEdge = Math.max(...controls.slice(1).map((point, index) => new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...controls[index])))) + 0.002;

  expect(positions.count).toBe(192);
  expect(trace.geometry.index!.count).toBe(192);
  expect(applied.courseTracePoints.map((point) => point.earth)).toEqual(source.course.transmissions.map((item) => item.branch));
  expect(trace.parent!.visible).toBe(true);
  expect([...trace.geometry.index!.array]).toEqual(originalIndices);
  for (const vertices of duplicateVertices.values()) {
    if (vertices.length < 2) continue;
    const first = new THREE.Vector3().fromBufferAttribute(positions, vertices[0]);
    for (const vertex of vertices.slice(1)) {
      expect(first.distanceTo(new THREE.Vector3().fromBufferAttribute(positions, vertex))).toBeLessThan(0.0000001);
    }
  }
  for (let face = 0; face < trace.geometry.index!.count; face += 3) {
    const faceVertices = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, trace.geometry.index!.getX(face + offset)));
    expect(Math.max(
      faceVertices[0].distanceTo(faceVertices[1]),
      faceVertices[1].distanceTo(faceVertices[2]),
      faceVertices[2].distanceTo(faceVertices[0]),
    )).toBeLessThanOrEqual(maximumFaceEdge);
    const sections = [0, 1, 2].map((offset) => {
      const vertex = trace.geometry.index!.getX(face + offset);
      const position = new THREE.Vector3().fromBufferAttribute(positions, vertex);
      return controls.reduce((nearest, point, index) => (
        position.distanceToSquared(new THREE.Vector3(...point)) < position.distanceToSquared(new THREE.Vector3(...controls[nearest]))
          ? index : nearest
      ), 0);
    });
    expect(Math.max(...sections) - Math.min(...sections)).toBeLessThanOrEqual(1);
  }
});

it.each([
  ["初传", ["丑", "丑", "亥"]],
  ["八专", ["卯", "丑", "丑"]],
  ["八专逆序", ["丑", "亥", "亥"]],
  ["别责", ["子", "卯", "卯"]],
  ["全同", ["丑", "丑", "丑"]],
] as const)("keeps the real trace thick for repeated %s transmissions", (_method, branches) => {
  const { nodes, meshes } = fixture();
  const trace = meshes.find(({ data }) => data.nodeId === "trace/course")!.mesh;
  const sectionVertices = realTraceSectionVertices(trace);
  const applied = applyParityState(nodes, sourceWithTransmissionBranches(branches));
  const positions = trace.geometry.getAttribute("position");
  const centers = sectionVertices.map((vertices) => vertices.reduce(
    (total, vertex) => total.add(new THREE.Vector3().fromBufferAttribute(positions, vertex)),
    new THREE.Vector3(),
  ).multiplyScalar(1 / vertices.length));
  const controls = courseControlPoints(applied.courseTracePoints).map((point) => new THREE.Vector3(...point));

  expect(applied.courseTracePoints.map((point) => point.earth)).toEqual(branches);
  expect(centers).toHaveLength(5);
  expect(sectionVertices.map((vertices) => vertices.length)).toEqual([8, 8, 8, 8, 8]);
  expect(new Set(Array.from({ length: positions.count }, (_, vertex) => (
    new THREE.Vector3().fromBufferAttribute(positions, vertex).toArray().map((value) => value.toFixed(7)).join(",")
  ))).size).toBe(40);
  for (let left = 0; left < centers.length; left += 1) {
    for (let right = left + 1; right < centers.length; right += 1) {
      expect(centers[left].distanceTo(centers[right])).toBeGreaterThan(0.0001);
    }
  }
  for (let start = 0; start < controls.length; ) {
    let end = start;
    while (end + 1 < controls.length && controls[end + 1].distanceToSquared(controls[start]) <= Number.EPSILON) end += 1;
    if (end > start) {
      const direction = centers[start + 1].clone().sub(centers[start]).normalize();
      for (let index = start + 1; index <= end; index += 1) {
        expect(centers[index].clone().sub(centers[index - 1]).dot(direction)).toBeGreaterThan(0.0001);
      }
      for (let left = start; left < end - 1; left += 1) {
        for (let right = left + 2; right <= end; right += 1) {
          expect(centers[right].clone().sub(centers[left]).dot(direction)).toBeGreaterThan(0.0001);
        }
      }
    }
    start = end + 1;
  }
  for (let face = 0; face < trace.geometry.index!.count; face += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, trace.geometry.index!.getX(face + offset)));
    expect(b.clone().sub(a).cross(c.clone().sub(a)).length()).toBeGreaterThan(0.00000001);
    expect(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))).toBeLessThan(0.05);
  }
});

it("applies the website dial convention and all twelve general slots without changing fixed earth geometry", () => {
  const { model, nodes, meshes } = fixture();
  const earth = nodes.get("plate/earth")!;
  const heaven = nodes.get("plate/heaven")!;
  const coreGold = meshes.find(({ data }) => data.nodeId === "plate/core" && data.materialId.includes("OldGold"))!.mesh;
  const coreJade = meshes.find(({ data }) => data.nodeId === "plate/core" && data.materialId === "M_TranslucentJade")!.mesh;
  const coreGoldPositions = [...coreGold.geometry.getAttribute("position").array];
  const coreJadePositions = [...coreJade.geometry.getAttribute("position").array];
  const applied = applyParityState(nodes, source);

  expect(applied.heavenAngleRad).toBeCloseTo(Math.PI - THREE.MathUtils.degToRad(10.25));
  expect(heaven.rotation.y).toBeCloseTo(Math.PI - THREE.MathUtils.degToRad(10.25));
  expect(applied.generalSlots).toHaveLength(12);
  expect(EARTHLY_BRANCHES.map((branch) => nodes.get(`branch/earth/${branch}`)?.parent)).toEqual(
    EARTHLY_BRANCHES.map(() => heaven),
  );
  expect([...model.nodes.keys()].filter((id) => id.includes("pearl"))).toEqual([]);
  expect(model.nodes.get("plate/earth")?.parentId).toBe("artifact/root");
  expect(MINITOOL_MODEL_GROUPS.earth.visualRoles).toContain("corner-pearl");
  expect(model.meshes.filter((mesh) => mesh.nodeId === "plate/earth").map((mesh) => mesh.materialId)).toEqual(expect.arrayContaining([
    "M_TranslucentJade", "RT_lod2_M_JadeBody_hero",
  ]));
  expect([...coreGold.geometry.getAttribute("position").array]).toEqual(coreGoldPositions);
  expect([...coreJade.geometry.getAttribute("position").array]).toEqual(coreJadePositions);
  expect(earth.parent).toBe(nodes.get("artifact/root"));

  for (const placement of source.generals.placements) {
    const general = nodes.get(GENERAL_NODE_IDS[placement.general])!;
    const slot = nodes.get(`general-slot/${placement.earth}`)!;
    expect(general.position).toEqual(slot.position);
    expect(general.quaternion.toArray()).toEqual(slot.quaternion.toArray());
    expect(general.scale).toEqual(slot.scale);
  }
});
