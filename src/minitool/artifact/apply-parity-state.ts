import * as THREE from "three";
import { EARTHLY_BRANCHES } from "../../domain/calendar/constants";
import { deriveJadePlateLayout } from "../../features/artifact-scene/model/jade-plate-layout";
import { mapArtifactState } from "../../features/artifact-scene/model/map-artifact-state";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";

const DIAL_ORIENTATION_CORRECTION_RADIANS = THREE.MathUtils.degToRad(-10.25);
const COURSE_TRACE_RADIUS = 0.042;

interface TraceVertex {
  readonly point: THREE.Vector3;
  readonly vertices: number[];
}

interface TraceSection {
  readonly center: THREE.Vector3;
  readonly vertices: readonly TraceVertex[];
}

export interface AppliedParityState {
  readonly heavenAngleRad: number;
  readonly activeMonthGeneralNodeId: string;
  readonly generalSlots: readonly { nodeId: string; earth: string }[];
  readonly courseTracePoints: readonly { earth: string; position: readonly [number, number, number] }[];
}

function traceMesh(node: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry> | undefined {
  let found: THREE.Mesh<THREE.BufferGeometry> | undefined;
  node.traverse((object) => {
    if (!found && object instanceof THREE.Mesh) found = object as THREE.Mesh<THREE.BufferGeometry>;
  });
  return found;
}

function coursePoint(earth: string, y: number, heavenAngleRad: number): readonly [number, number, number] {
  const index = EARTHLY_BRANCHES.indexOf(earth as (typeof EARTHLY_BRANCHES)[number]);
  if (index < 0) throw new Error(`Unknown course earth branch ${earth}`);
  const angle = index * Math.PI / 6 + heavenAngleRad;
  return [Math.sin(angle) * COURSE_TRACE_RADIUS, y, Math.cos(angle) * COURSE_TRACE_RADIUS];
}

function traceSections(positions: THREE.BufferAttribute, indices: THREE.BufferAttribute): readonly TraceSection[] {
  const vertices = new Map<string, TraceVertex>();
  const vertexKeys: string[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, index);
    const key = point.toArray().map((value) => value.toFixed(7)).join(",");
    vertexKeys.push(key);
    const existing = vertices.get(key);
    if (existing) existing.vertices.push(index);
    else vertices.set(key, { point, vertices: [index] });
  }
  const unique = [...vertices.values()];
  const distances: number[] = [];
  for (let left = 0; left < unique.length; left += 1) {
    for (let right = left + 1; right < unique.length; right += 1) {
      const distance = unique[left].point.distanceTo(unique[right].point);
      if (distance > 0) distances.push(distance);
    }
  }
  distances.sort((left, right) => left - right);
  let split = 0;
  for (let index = 0; index < distances.length - 1; index += 1) {
    if (distances[index + 1] / distances[index] > distances[split + 1] / distances[split]) split = index;
  }
  const threshold = (distances[split] + distances[split + 1]) / 2;
  const unassigned = new Set(unique);
  const groups: TraceVertex[][] = [];
  while (unassigned.size > 0) {
    const group: TraceVertex[] = [];
    const queue = [unassigned.values().next().value as TraceVertex];
    unassigned.delete(queue[0]);
    while (queue.length > 0) {
      const vertex = queue.pop()!;
      group.push(vertex);
      for (const candidate of [...unassigned]) {
        if (vertex.point.distanceTo(candidate.point) <= threshold) {
          unassigned.delete(candidate);
          queue.push(candidate);
        }
      }
    }
    groups.push(group);
  }
  if (groups.length !== 5 || groups.some((group) => group.length !== 8)) {
    throw new Error("Course trace must contain five eight-vertex cross-sections.");
  }
  const sectionByKey = new Map<string, number>();
  groups.forEach((group, index) => group.forEach((vertex) => sectionByKey.set(vertex.point.toArray().map((value) => value.toFixed(7)).join(","), index)));
  const neighbors = groups.map(() => new Set<number>());
  for (let index = 0; index < indices.count; index += 3) {
    const sectionIds = [0, 1, 2].map((offset) => sectionByKey.get(vertexKeys[indices.getX(index + offset)]));
    const faceSections = new Set(sectionIds.filter((section): section is number => section !== undefined));
    if (faceSections.size > 2 || faceSections.size !== new Set(sectionIds).size) throw new Error("Course trace faces must connect adjacent cross-sections.");
    const [left, right] = [...faceSections];
    if (right !== undefined) {
      neighbors[left].add(right);
      neighbors[right].add(left);
    }
  }
  const endpoints = neighbors.map((items, index) => ({ items, index })).filter(({ items }) => items.size === 1);
  if (endpoints.length !== 2 || neighbors.some((items) => items.size < 1 || items.size > 2)) {
    throw new Error("Course trace cross-sections must form one path.");
  }
  const ordered: number[] = [];
  const firstVertex = (group: readonly TraceVertex[]) => Math.min(...group.reduce<number[]>(
    (all, vertex) => { all.push(...vertex.vertices); return all; },
    [],
  ));
  const firstEndpoint = endpoints.sort((left, right) => firstVertex(groups[left.index]) - firstVertex(groups[right.index]))[0];
  if (!firstEndpoint) throw new Error("Course trace cross-sections need an endpoint.");
  let current: number | undefined = firstEndpoint.index;
  let previous: number | undefined;
  while (current !== undefined) {
    ordered.push(current);
    const next: number | undefined = [...neighbors[current]].find((candidate) => candidate !== previous);
    previous = current;
    current = next;
  }
  return ordered.map((index) => {
    const group = groups[index];
    return {
      center: group.reduce((total, vertex) => total.add(vertex.point), new THREE.Vector3()).multiplyScalar(1 / group.length),
      vertices: group,
    };
  });
}

function tangentAt(points: readonly THREE.Vector3[], index: number, fallback?: THREE.Vector3): THREE.Vector3 {
  for (let span = 1; span < points.length; span += 1) {
    const before = points[Math.max(0, index - span)];
    const after = points[Math.min(points.length - 1, index + span)];
    const tangent = after.clone().sub(before).setY(0);
    if (tangent.lengthSq() > Number.EPSILON) return tangent.normalize();
  }
  if (fallback) return fallback.clone();
  throw new Error("Course trace cross-sections need a horizontal tangent.");
}

function tangentForCoincidentRun(
  points: readonly THREE.Vector3[],
  start: number,
  end: number,
  fallback: THREE.Vector3,
): THREE.Vector3 {
  for (let distance = 1; distance < points.length; distance += 1) {
    const before = points[start - distance];
    if (before) {
      const tangent = points[start].clone().sub(before).setY(0);
      if (tangent.lengthSq() > Number.EPSILON) return tangent.normalize();
    }
    const after = points[end + distance];
    if (after) {
      const tangent = after.clone().sub(points[end]).setY(0);
      if (tangent.lengthSq() > Number.EPSILON) return tangent.normalize();
    }
  }
  return fallback.clone();
}

function separateCoincidentControls(
  targets: THREE.Vector3[],
  sections: readonly TraceSection[],
  centers: readonly THREE.Vector3[],
) {
  let radius = 0;
  for (const section of sections) {
    for (const vertex of section.vertices) radius = Math.max(radius, vertex.point.distanceTo(section.center));
  }
  const minimumSpan = radius * 2;
  const original = targets.map((target) => target.clone());
  for (let start = 0; start < original.length; ) {
    let end = start;
    while (end + 1 < original.length && original[end + 1].distanceToSquared(original[start]) <= Number.EPSILON) end += 1;
    if (end > start) {
      const direction = tangentForCoincidentRun(original, start, end, tangentAt(centers, 0));
      for (let index = start + 1; index <= end; index += 1) {
        targets[index].copy(original[start]).addScaledVector(direction, minimumSpan * (index - start));
      }
    }
    start = end + 1;
  }
}

function applyCourseTrace(trace: THREE.Object3D | undefined, earths: readonly string[], heavenAngleRad: number) {
  if (!trace) return [];
  const mesh = traceMesh(trace);
  const positions = mesh?.geometry.getAttribute("position");
  const indices = mesh?.geometry.index;
  if (!mesh || !(positions instanceof THREE.BufferAttribute) || !(indices instanceof THREE.BufferAttribute) || earths.length === 0) {
    trace.visible = false;
    return [];
  }
  const sections = traceSections(positions, indices);
  const y = sections.reduce((total, section) => total + section.center.y, 0) / sections.length;
  const points = earths.map((earth) => ({ earth, position: coursePoint(earth, y, heavenAngleRad) }));
  const centers = sections.map((section) => section.center);
  const targets = [
    new THREE.Vector3(...points[0].position),
    new THREE.Vector3(...points[0].position).lerp(new THREE.Vector3(...points[1].position), 0.5),
    new THREE.Vector3(...points[1].position),
    new THREE.Vector3(...points[1].position).lerp(new THREE.Vector3(...points[2].position), 0.5),
    new THREE.Vector3(...points[2].position),
  ];
  separateCoincidentControls(targets, sections, centers);
  sections.forEach((section, index) => {
    const sourceTangent = tangentAt(centers, index);
    const sourceSide = new THREE.Vector3(-sourceTangent.z, 0, sourceTangent.x);
    const targetTangent = tangentAt(targets, index, sourceTangent);
    const targetSide = new THREE.Vector3(-targetTangent.z, 0, targetTangent.x);
    for (const vertex of section.vertices) {
      const offset = vertex.point.clone().sub(section.center);
      const mapped = targets[index].clone()
        .addScaledVector(targetTangent, offset.dot(sourceTangent))
        .addScaledVector(targetSide, offset.dot(sourceSide));
      mapped.y += offset.y;
      vertex.vertices.forEach((vertexIndex) => positions.setXYZ(vertexIndex, mapped.x, mapped.y, mapped.z));
    }
  });
  positions.needsUpdate = true;
  trace.visible = true;
  return points;
}

export function applyParityState(
  nodes: ReadonlyMap<string, THREE.Object3D>,
  source: ArtifactSourceResults,
): AppliedParityState {
  const state = mapArtifactState(source);
  const layout = deriveJadePlateLayout(state);
  const heavenAngleRad = layout.correctAngleRad + DIAL_ORIENTATION_CORRECTION_RADIANS;
  const heaven = nodes.get("plate/heaven");
  if (heaven) heaven.rotation.y = heavenAngleRad;

  for (const placement of layout.generalSequence) {
    const general = nodes.get(placement.nodeId);
    const slot = nodes.get(`general-slot/${placement.earth}`);
    if (!general || !slot) continue;
    general.position.copy(slot.position);
    general.quaternion.copy(slot.quaternion);
    general.scale.copy(slot.scale);
  }

  return {
    heavenAngleRad,
    activeMonthGeneralNodeId: layout.activeMonthGeneralNodeId,
    generalSlots: layout.generalSequence.map(({ nodeId, earth }) => ({ nodeId, earth })),
    courseTracePoints: applyCourseTrace(nodes.get("trace/course"), source.course.transmissions.map((item) => item.branch), heavenAngleRad),
  };
}
