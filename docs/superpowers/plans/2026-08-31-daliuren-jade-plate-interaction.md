# Daliuren Jade Plate Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reference-matched layered white-jade Daliuren plate whose month-general ring can be physically rotated, and whose twelve heavenly-general inlays seat only at the unique correct alignment.

**Architecture:** Keep the existing domain snapshots as the only source of `offset`, noble placement, direction, and palace assignments. Add a pure layout adapter, a cancellable interaction state machine, and deterministic motion evaluators; the Three.js controller only applies their output and translates pointer input into normalized gestures. Replace the runtime reference-surface illusion with contract-tested layered Blender geometry and independently addressable text materials.

**Tech Stack:** React 19.2.8, TypeScript 5.9.3, Three.js 0.185.1, Vite 7.3.6, Vitest 3.2.7, Testing Library, Playwright 1.62.1, Blender 4.5.12 Python unittest, glTF/KTX2 asset pipeline

**Spec:** `docs/superpowers/specs/2026-08-31-daliuren-jade-plate-interaction-design.md`

## Global Constraints

- Use `daliuren-heaven-plate-translucent-jade-generals-v10.png` as the sole visual reference; the runtime must not depend on a flattened copy of that image.
- The white-jade earthly-branch ring, black earthly-branch glyphs, center Beidou, general seat, and core are fixed; only `plate/heaven` (the month-general ring) rotates.
- The month-general ring has exactly twelve detents at `30°`; automatic rotation always travels the positive traditional direction for exactly `offset` detents and never chooses a shorter reverse path.
- Only the current effective month-general glyph becomes old gold at the unique correct detent; the other eleven remain cinnabar red.
- Noble is first; the remaining placements use the upstream `GeneralPlacement.order` and must never be reversed again in the rendering layer.
- General inlays are distinct sector-shaped translucent white-jade pieces, flush at rest, with name text changing from ash to old gold only after that piece seats.
- Landing timing is `720 ms` nominal (`700–740 ms` allowed), `390 ms` adjacent stagger, and about `5.0 s` for all twelve; exit is reverse order, `380–450 ms` per piece, `120 ms` stagger, about `1.7 s` total.
- Pointer-down alone preserves the correct state; more than `2°` actual rotation invalidates it. Wrong detents produce no error copy, flash, particles, or sound.
- Mouse/touch drag, wheel, Left/Right keys, and two one-step buttons share one snap-and-evaluate path. Fast release may add at most one detent; multi-spin inertia is forbidden.
- `prefers-reduced-motion` removes falling and bounce but preserves ordering, colors, the unique correct detent, and the final result.
- Do not modify the Daliuren domain algorithms. Do not refactor unrelated page modules. Preserve unrelated dirty-worktree changes.

## File Structure

### New files

- `src/features/artifact-scene/model/jade-plate-layout.ts`: converts validated display state into immutable render layout and node IDs.
- `src/features/artifact-scene/model/jade-plate-layout.test.ts`: proves offset, month-general identity, noble-first ordering, and forward/reverse palace order.
- `src/features/artifact-scene/interaction/month-general-machine.ts`: pure interaction reducer, detent normalization, threshold handling, and cancellable transition snapshots.
- `src/features/artifact-scene/interaction/month-general-machine.test.ts`: state-transition matrix for all input paths and interruption cases.
- `src/features/artifact-scene/timeline/evaluate-jade-plate-motion.ts`: deterministic automatic and interactive motion curves.
- `src/features/artifact-scene/timeline/evaluate-jade-plate-motion.test.ts`: exact timing, bounce, reverse exit, and reduced-motion assertions.
- `src/features/artifact-scene/three/month-general-pointer.ts`: converts pointer coordinates to an angle on the fixed plate plane.
- `src/features/artifact-scene/three/month-general-pointer.test.ts`: ray/plane and wraparound tests.
- `src/features/artifact-scene/MonthGeneralControls.tsx`: accessible left/right one-detent controls and interaction status.
- `src/features/artifact-scene/MonthGeneralControls.test.tsx`: button, keyboard-label, disabled-state, and status tests.

### Modified files

- `src/features/artifact-scene/model/types.ts`: exposes the month-general name as `MonthGeneralName` rather than untyped `string`.
- `src/features/artifact-scene/model/map-artifact-state.ts`: preserves the typed month-general value; no new rule calculation.
- `src/features/artifact-scene/timeline/types.ts`: carries month-ring angle, month-glyph gold progress, and per-general seat/gold progress.
- `src/features/artifact-scene/timeline/evaluate-pose.ts`: delegates month-ring/general motion to the new evaluator and removes the general-ring spin.
- `src/features/artifact-scene/three/ArtifactSceneController.ts`: binds the new nodes/materials, applies physical poses, and emits normalized ring gestures.
- `src/features/artifact-scene/ArtifactExperience.tsx`: owns the interaction reducer after the demo, resets it on source/seek changes, and renders controls.
- `src/features/artifact-scene/artifact-scene.css`: places restrained step controls without covering the artifact.
- `src/features/artifact-scene/model/asset-contract.ts`, `assets/daliuren/asset-contract.json`: declare month glyphs, general slots, hit ring, and revised plate roles.
- `tools/blender/geometry.py`, `tools/blender/build_graybox.py`, `tools/blender/daliuren_contract.py`: create exact annular sectors and fixed slot anchors.
- `tools/blender/high_detail_geometry.py`, `tools/blender/materials.py`, `assets/daliuren/materials/material-contract.json`: build real relief, translucent jade, cinnabar, ink, and independently switchable gold text.
- `tools/blender/build_lods.py`, `tools/blender/uv_and_bake.py`: preserve new semantic nodes and material ownership through all LODs.
- `assets/daliuren/source/daliuren-artifact-master.blend`, `assets/daliuren/textures/**`, `public/models/daliuren/daliuren-artifact-lod*.glb`: regenerated deliverable assets.
- Direct tests alongside the files above, plus `e2e/artifact-experience.spec.ts` and `docs/asset-reviews/lookdev/*`.

---

### Task 1: Derive One Immutable Jade-Plate Layout From Existing Rule Results

**Files:**
- Create: `src/features/artifact-scene/model/jade-plate-layout.ts`
- Create: `src/features/artifact-scene/model/jade-plate-layout.test.ts`
- Modify: `src/features/artifact-scene/model/types.ts:18-34`
- Modify: `src/features/artifact-scene/model/map-artifact-state.ts:143-178`
- Test: `src/features/artifact-scene/model/map-artifact-state.test.ts`

**Interfaces:**
- Consumes: `ArtifactDisplayState`, `HeavenlyGeneralsResult["placements"]`, `GeneralDirection`, and upstream `plate.offset`.
- Produces: `deriveJadePlateLayout(state: ArtifactDisplayState): JadePlateLayout`.

- [ ] **Step 1: Write failing layout tests**

```ts
import { expect, it } from "vitest";
import { referenceSession } from "../../../test/reference-session";
import { GENERAL_ORDER } from "../../../domain/heavenly-generals/policy";
import { mapArtifactState } from "./map-artifact-state";
import { deriveJadePlateLayout, MONTH_GENERAL_NODE_IDS } from "./jade-plate-layout";

const referenceState = mapArtifactState({
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults);

function fixtureForDirection(direction: GeneralDirection): ArtifactDisplayState {
  const earths = direction === "forward"
    ? ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
    : ["子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑"];
  return {
    ...referenceState,
    noble: { ...referenceState.noble, direction, nobleEarth: "子" },
    generals: GENERAL_ORDER.map((general, order) => ({
      order, general, earth: earths[order], heaven: earths[order], evidenceId: `test-${order}`,
    })),
  } as ArtifactDisplayState;
}

it("uses offset as the sole correct detent and keeps noble first", () => {
  const layout = deriveJadePlateLayout(referenceState);
  expect(layout.correctDetent).toBe(6);
  expect(layout.correctAngleRad).toBeCloseTo(Math.PI);
  expect(layout.activeMonthGeneralNodeId).toBe("month-general/胜光");
  expect(layout.generalSequence.map((item) => item.general)).toEqual([
    "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
    "天空", "白虎", "太常", "玄武", "太阴", "天后",
  ]);
});

it.each(["forward", "reverse"] as const)("trusts upstream %s placement order", (direction) => {
  const state = fixtureForDirection(direction);
  const layout = deriveJadePlateLayout(state);
  expect(layout.direction).toBe(direction);
  expect(layout.generalSequence[0]).toMatchObject({ general: "贵人", sequenceIndex: 0 });
  expect(layout.generalSequence.map((item) => item.earth)).toEqual(
    [...state.generals].sort((a, b) => a.order - b.order).map((item) => item.earth),
  );
});

expect(Object.keys(MONTH_GENERAL_NODE_IDS)).toHaveLength(12);
```

- [ ] **Step 2: Run the tests and verify the missing module fails**

Run: `npm test -- src/features/artifact-scene/model/jade-plate-layout.test.ts`

Expected: FAIL because `jade-plate-layout.ts` does not exist.

- [ ] **Step 3: Add the typed layout contract and minimal derivation**

```ts
export const DETENT_RADIANS = Math.PI / 6;

export const MONTH_GENERAL_NODE_IDS = {
  登明: "month-general/登明", 河魁: "month-general/河魁", 从魁: "month-general/从魁",
  传送: "month-general/传送", 小吉: "month-general/小吉", 胜光: "month-general/胜光",
  太乙: "month-general/太乙", 天罡: "month-general/天罡", 太冲: "month-general/太冲",
  功曹: "month-general/功曹", 大吉: "month-general/大吉", 神后: "month-general/神后",
} as const satisfies Record<MonthGeneralName, `month-general/${MonthGeneralName}`>;
export const GENERAL_NODE_IDS = {
  贵人: "general/noble", 螣蛇: "general/snake", 朱雀: "general/vermilion-bird", 六合: "general/harmony",
  勾陈: "general/hook-array", 青龙: "general/azure-dragon", 天空: "general/void", 白虎: "general/white-tiger",
  太常: "general/constant", 玄武: "general/black-tortoise", 太阴: "general/yin", 天后: "general/queen-of-heaven",
} as const satisfies Record<HeavenlyGeneral, `general/${string}`>;
export const GENERAL_LABEL_IDS = Object.fromEntries(
  Object.entries(GENERAL_NODE_IDS).map(([general, id]) => [general, `dynamic/${id}`]),
) as Record<HeavenlyGeneral, `dynamic/general/${string}`>;

export interface JadePlateGeneralLayout {
  sequenceIndex: number;
  nodeId: `general/${string}`;
  labelId: `dynamic/general/${string}`;
  general: HeavenlyGeneral;
  earth: EarthlyBranch;
}

export interface JadePlateLayout {
  correctDetent: number;
  correctAngleRad: number;
  activeMonthGeneralNodeId: `month-general/${MonthGeneralName}`;
  direction: GeneralDirection;
  generalSequence: readonly JadePlateGeneralLayout[];
}

export function deriveJadePlateLayout(state: ArtifactDisplayState): JadePlateLayout {
  if (!Number.isInteger(state.plate.offset) || state.plate.offset < 0 || state.plate.offset > 11) {
    throw new Error(`Invalid jade-plate offset ${state.plate.offset}`);
  }
  const ordered = [...state.generals].sort((a, b) => a.order - b.order);
  if (ordered.length !== 12 || ordered[0]?.general !== "贵人") {
    throw new Error("Jade-plate general sequence must contain twelve placements led by 贵人");
  }
  return Object.freeze({
    correctDetent: state.plate.offset,
    correctAngleRad: state.plate.offset * DETENT_RADIANS,
    activeMonthGeneralNodeId: MONTH_GENERAL_NODE_IDS[state.calendar.monthGeneral],
    direction: state.noble.direction,
    generalSequence: Object.freeze(ordered.map((placement, sequenceIndex) => Object.freeze({
      sequenceIndex,
      nodeId: GENERAL_NODE_IDS[placement.general],
      labelId: GENERAL_LABEL_IDS[placement.general],
      general: placement.general,
      earth: placement.earth,
    }))),
  });
}
```

Use `MonthGeneralName` in `ArtifactDisplayState.calendar.monthGeneral`. Copy no calculation from `heaven-earth/policy.ts` or `heavenly-generals/policy.ts`.

- [ ] **Step 4: Run focused model tests**

Run: `npm test -- src/features/artifact-scene/model/jade-plate-layout.test.ts src/features/artifact-scene/model/map-artifact-state.test.ts`

Expected: PASS; reverse fixtures still begin with 贵人 because `order`, not visual reversal, is authoritative.

- [ ] **Step 5: Commit the layout adapter**

```bash
git add src/features/artifact-scene/model/types.ts src/features/artifact-scene/model/map-artifact-state.ts src/features/artifact-scene/model/map-artifact-state.test.ts src/features/artifact-scene/model/jade-plate-layout.ts src/features/artifact-scene/model/jade-plate-layout.test.ts
git commit -m "feat: derive jade plate layout from rule results"
```

### Task 2: Implement the Cancellable Month-General Interaction State Machine

**Files:**
- Create: `src/features/artifact-scene/interaction/month-general-machine.ts`
- Create: `src/features/artifact-scene/interaction/month-general-machine.test.ts`

**Interfaces:**
- Consumes: `JadePlateLayout`, monotonic `nowMs`, normalized drag angles, and one-detent step commands.
- Produces: `createMonthGeneralState(layout)`, `reduceMonthGeneralState(state, event)`, and `MonthGeneralInteractionState`.

- [ ] **Step 1: Write the complete transition-matrix tests**

```ts
const layout: JadePlateLayout = {
  correctDetent: 6,
  correctAngleRad: Math.PI,
  activeMonthGeneralNodeId: "month-general/胜光",
  direction: "forward",
  generalSequence: GENERAL_ORDER.map((general, sequenceIndex) => ({
    sequenceIndex,
    general,
    nodeId: GENERAL_NODE_IDS[general],
    labelId: GENERAL_LABEL_IDS[general],
    earth: EARTHLY_BRANCHES[sequenceIndex],
  })),
};

const completedState = (atMs: number) => reduceMonthGeneralState(
  createMonthGeneralState(layout),
  { type: "demo-complete", nowMs: atMs },
);

const exploringState = (detent = 0): MonthGeneralInteractionState => ({
  ...completedState(27_000),
  phase: "exploring",
  aligned: false,
  angleRad: detent * DETENT_RADIANS,
  detent,
  transition: undefined,
});

it("does not invalidate a seated plate on pointer-down alone", () => {
  const seated = completedState(27_000);
  expect(reduceMonthGeneralState(seated, { type: "drag-start", angleRad: 1, nowMs: 28_000 })).toMatchObject({
    phase: "seated", aligned: true,
  });
});

it("invalidates beyond two degrees and captures a reverse exit", () => {
  const started = reduceMonthGeneralState(completedState(27_000), {
    type: "drag-start", angleRad: 1, nowMs: 28_000,
  });
  const moved = reduceMonthGeneralState(started, {
    type: "drag-move", angleRad: 1 + 2.1 * Math.PI / 180, nowMs: 28_020,
    generalProgress: Array(12).fill(1),
  });
  expect(moved).toMatchObject({ phase: "exiting", aligned: false });
  expect(moved.transition?.kind).toBe("exit");
});

it("snaps wrong positions quietly and re-enters at the unique correct detent", () => {
  const wrong = reduceMonthGeneralState(exploringState(), {
    type: "step", delta: 1, nowMs: 30_000, generalProgress: Array(12).fill(0),
  });
  expect(wrong).toMatchObject({ phase: "exploring", aligned: false });
  const correct = reduceMonthGeneralState(exploringState(layout.correctDetent - 1), {
    type: "step", delta: 1, nowMs: 30_100, generalProgress: Array(12).fill(0),
  });
  expect(correct).toMatchObject({ phase: "landing", aligned: true });
});

it("cancels a partial landing from its current progress without delayed work", () => {
  const landing: MonthGeneralInteractionState = {
    ...exploringState(layout.correctDetent),
    phase: "landing",
    aligned: true,
    transition: { kind: "landing", startedAtMs: 40_000, fromProgress: Array(12).fill(0) },
  };
  const interrupted = reduceMonthGeneralState(landing, {
    type: "step", delta: 1, nowMs: 41_400,
    generalProgress: [1, 1, 0.6, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
  });
  expect(interrupted.transition?.kind).toBe("exit");
  expect(interrupted.transition?.fromProgress.some((value) => value > 0 && value < 1)).toBe(true);
});
```

Also test angle wraparound (`359°` to `1°`), nearest-detent snapping, at-most-one inertial detent, wheel/keyboard/button events all reducing through `step`, and reset to `locked` on a new source.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/artifact-scene/interaction/month-general-machine.test.ts`

Expected: FAIL because the reducer module is missing.

- [ ] **Step 3: Implement explicit states and event types**

```ts
export type MonthGeneralPhase = "locked" | "landing" | "seated" | "exiting" | "exploring";

export interface GeneralTransition {
  kind: "landing" | "exit";
  startedAtMs: number;
  fromProgress: readonly number[];
}

export interface MonthGeneralInteractionState {
  layout: JadePlateLayout;
  phase: MonthGeneralPhase;
  angleRad: number;
  detent: number;
  aligned: boolean;
  drag?: { pointerStartRad: number; ringStartRad: number; movedRad: number };
  transition?: GeneralTransition;
}

export type MonthGeneralEvent =
  | { type: "demo-complete"; nowMs: number }
  | { type: "reset" }
  | { type: "drag-start"; angleRad: number; nowMs: number }
  | { type: "drag-move"; angleRad: number; nowMs: number; generalProgress: readonly number[] }
  | { type: "drag-end"; angularVelocityRadMs: number; nowMs: number; generalProgress: readonly number[] }
  | { type: "step"; delta: -1 | 1; nowMs: number; generalProgress: readonly number[] };
```

Use `normalizeAngle`, `signedAngleDelta`, `detentForAngle`, and `angleForDetent` helpers in the same file. Validate that every event-supplied `generalProgress` contains twelve finite values in `[0, 1]`, then copy it into `fromProgress` when an event changes direction; do not schedule timeouts. The caller obtains this snapshot from Task 3's evaluator immediately before reducing the event, which avoids a circular dependency between the reducer and motion evaluator.

- [ ] **Step 4: Run the state-machine tests**

Run: `npm test -- src/features/artifact-scene/interaction/month-general-machine.test.ts`

Expected: PASS with no fake timers and no asynchronous work.

- [ ] **Step 5: Commit the reducer**

```bash
git add src/features/artifact-scene/interaction/month-general-machine.ts src/features/artifact-scene/interaction/month-general-machine.test.ts
git commit -m "feat: add cancellable month general state machine"
```

### Task 3: Add Deterministic Five-Second Landing and Reverse-Exit Motion

**Files:**
- Create: `src/features/artifact-scene/timeline/evaluate-jade-plate-motion.ts`
- Create: `src/features/artifact-scene/timeline/evaluate-jade-plate-motion.test.ts`
- Modify: `src/features/artifact-scene/timeline/types.ts:4-21`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.ts:18-117`
- Modify: `src/features/artifact-scene/timeline/evaluate-pose.test.ts`

**Interfaces:**
- Consumes: `JadePlateLayout`, `MonthGeneralInteractionState`, elapsed time, and `reducedMotion`.
- Produces: `JadePlateMotion`, `evaluateGeneralTransition(...)`, `evaluateDemoJadePlateMotion(...)`, and `evaluateInteractiveJadePlateMotion(...)`.

- [ ] **Step 1: Write exact motion tests**

```ts
expect(evaluateDemoJadePlateMotion(layout, 0, false).monthAngleRad).toBe(0);
const monthSettledAtMs = Math.max(0, layout.correctDetent * (175 + 60) - 60);
expect(evaluateDemoJadePlateMotion(layout, monthSettledAtMs, false).monthAngleRad)
  .toBeCloseTo(layout.correctAngleRad);

const landing: GeneralTransition = {
  kind: "landing", startedAtMs: 0, fromProgress: Array(12).fill(0),
};
const before = evaluateGeneralTransition(layout, landing, 389, false);
expect(before.generals[0].seatProgress).toBeGreaterThan(0);
expect(before.generals[1].seatProgress).toBe(0);

const secondStarts = evaluateGeneralTransition(layout, landing, 390, false);
expect(secondStarts.generals[1].seatProgress).toBe(0);
expect(evaluateGeneralTransition(layout, landing, 5_010, false).generals.every((item) => item.seatProgress === 1)).toBe(true);

const contact = evaluateGeneralTransition(layout, landing, 700, false).generals[0];
expect(contact.heightMeters).toBeGreaterThanOrEqual(0);
expect(contact.heightMeters).toBeLessThanOrEqual(0.0005);
expect(evaluateGeneralTransition(layout, landing, 720, false).generals[0]).toMatchObject({
  heightMeters: 0, seatProgress: 1, goldProgress: 1,
});

const exiting: GeneralTransition = {
  kind: "exit", startedAtMs: 0, fromProgress: Array(12).fill(1),
};
const exit = evaluateGeneralTransition(layout, exiting, 120, false);
expect(exit.generals[11].seatProgress).toBeLessThan(1);
expect(exit.generals[10].seatProgress).toBe(1);
expect(evaluateGeneralTransition(layout, exiting, 1_700, false).generals.every((item) => item.visible === false)).toBe(true);
```

Add a reduced-motion case asserting immediate ordered final values and a repeated-evaluation equality case.

- [ ] **Step 2: Run tests and observe timing failures**

Run: `npm test -- src/features/artifact-scene/timeline/evaluate-jade-plate-motion.test.ts src/features/artifact-scene/timeline/evaluate-pose.test.ts`

Expected: FAIL because the existing evaluator spins `plate/generals`, reverses reverse courses, and has `360 ms` general timing.

- [ ] **Step 3: Define one physical pose contract**

```ts
export interface JadePlateGeneralMotion {
  nodeId: string;
  targetEarth: EarthlyBranch;
  visible: boolean;
  heightMeters: number;
  seatProgress: number;
  goldProgress: number;
}

export interface JadePlateMotion {
  monthAngleRad: number;
  activeMonthGeneralNodeId: `month-general/${string}`;
  activeMonthGoldProgress: number;
  generals: readonly JadePlateGeneralMotion[];
}
```

Extend `ArtifactPose` with one exact field, `jadePlate: JadePlateMotion`. `evaluateArtifactPose` returns the same motion object it used to populate node transforms. `ArtifactSceneController.applyPose` applies ordinary nodes first and then delegates material/seat synchronization to `applyJadePlateMotion(pose.jadePlate)`. Interactive rendering after handoff calls that same public method directly, so automatic and customer-driven states cannot diverge.

Use constants `MONTH_STEP_MS = 175`, `MONTH_PAUSE_MS = 60`, `LAND_MS = 720`, `LAND_STAGGER_MS = 390`, `EXIT_MS = 420`, `EXIT_STAGGER_MS = 120`, `DROP_HEIGHT_M = 0.0275`, and `MONTH_GOLD_MS = 220`. During the automatic heaven-earth stage, each of the `offset` positive detents consumes `175 ms` of motion plus a `60 ms` hold; `offset = 11` therefore advances eleven positive steps and never one negative step. Implement a three-part vertical curve: accelerated descent, deceleration inside the last `0.006 m`, and one non-negative `0.0003–0.0005 m` bounce before clamping to zero.

- [ ] **Step 4: Delegate the existing artifact pose**

In `evaluate-pose.ts`, replace the independent `generalSequence.reverse()` path and full ring spin with the new demo result:

```ts
const jade = evaluateDemoJadePlateMotion(layout, time, reducedMotion);
nodes["plate/heaven"] = node({ rotationY: jade.monthAngleRad });
nodes["plate/generals"] = node();
for (const piece of jade.generals) {
  nodes[piece.nodeId] = node({
    visible: piece.visible,
    translationY: piece.heightMeters,
    targetEarth: piece.targetEarth,
  });
}
```

Return the `jadePlate` motion field rather than encoding color in node visibility. Preserve the overall `27_000 ms` review timeline; the heavenly-general segment begins at `18_000 ms`, completes near `23_010 ms`, and the final review stage remains stable through `27_000 ms`.

- [ ] **Step 5: Run timeline tests**

Run: `npm test -- src/features/artifact-scene/timeline/evaluate-jade-plate-motion.test.ts src/features/artifact-scene/timeline/evaluate-pose.test.ts src/features/artifact-scene/timeline/evaluate-stage-replay.test.ts`

Expected: PASS; `plate/generals.rotationY` remains zero and reverse courses still begin with `general/noble`.

- [ ] **Step 6: Commit the deterministic motion layer**

```bash
git add src/features/artifact-scene/timeline src/features/artifact-scene/model/jade-plate-layout.ts
git commit -m "feat: animate physical jade general inlays"
```

### Task 4: Replace the Flat Reference Face With Contracted Layered Geometry

**Files:**
- Modify: `tools/blender/geometry.py`
- Modify: `tools/blender/daliuren_contract.py`
- Modify: `tools/blender/build_graybox.py`
- Modify: `tools/blender/high_detail_geometry.py`
- Modify: `tools/blender/tests/test_contract.py`
- Modify: `tools/blender/tests/test_graybox_structure.py`
- Modify: `tools/blender/tests/test_component_contract.py`
- Modify: `tools/blender/tests/test_high_detail_geometry.py`
- Modify: `assets/daliuren/asset-contract.json`
- Modify: `src/features/artifact-scene/model/asset-contract.ts`
- Modify: `src/features/artifact-scene/model/asset-contract.test.ts`
- Modify: `src/features/artifact-scene/three/load-artifact.test.ts`

**Interfaces:**
- Consumes: the approved concentric radii/orientation from the v10 reference and existing `node_id` export convention.
- Produces: `add_annular_sector(...)`, twelve fixed slot anchors, twelve exact inlays, twelve month glyph nodes, and `interaction/month-general-ring`.

- [ ] **Step 1: Replace old contract expectations with exact layered-node tests**

```python
def test_month_ring_is_the_only_rotating_plate_layer(self):
    self.assertTrue(bpy.data.objects["plate/heaven"]["rotates_independently"])
    self.assertTrue(bpy.data.objects["plate/generals"]["fixed"])
    self.assertTrue(bpy.data.objects["plate/core"]["fixed"])
    self.assertEqual(bpy.data.objects["plate/heaven"].parent, self.root)
    self.assertEqual(bpy.data.objects["plate/generals"].parent, self.root)

def test_general_inlays_match_their_sector_slots(self):
    for branch in BRANCHES:
        slot = bpy.data.objects[f"general-slot/{branch}"]
        piece = next(obj for obj in bpy.data.objects if obj.get("target_earth") == branch)
        self.assertEqual(piece["sector_inner_radius_m"], slot["sector_inner_radius_m"])
        self.assertEqual(piece["sector_outer_radius_m"], slot["sector_outer_radius_m"])
        self.assertEqual(piece["sector_angle_deg"], 30.0)
        self.assertEqual(piece["radial_clearance_m"], 0.00008)
        self.assertEqual(piece["angular_clearance_deg"], 0.12)
        self.assertAlmostEqual(piece["settled_z_m"], slot["seat_z_m"], places=6)

def test_reference_surface_is_not_runtime_geometry(self):
    self.assertIsNone(bpy.data.objects.get("detail/reference/surface"))
    self.assertIsNone(bpy.data.objects.get("detail/reference/center-disc"))
```

Add TypeScript contract assertions for all `general-slot/<branch>`, all `month-general/<name>`, and `interaction/month-general-ring`. Remove `branch/heaven/<branch>` from required runtime IDs; retain only the fixed black `branch/earth/<branch>` ring.

- [ ] **Step 2: Run contract tests and verify they fail against the flat/reference implementation**

Run:

```bash
npm test -- src/features/artifact-scene/model/asset-contract.test.ts src/features/artifact-scene/three/load-artifact.test.ts
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
```

Expected: FAIL on missing slot/month nodes, rotating general seat, square general pieces, and the still-present reference surface.

- [ ] **Step 3: Add exact annular-sector geometry**

```python
def add_annular_sector(node_id, inner_radius, outer_radius, angle_start, angle_end, depth, location, bevel):
    if not 0 < inner_radius < outer_radius:
        raise ValueError("Sector radii must satisfy 0 < inner < outer")
    if not 0 < angle_end - angle_start <= math.tau:
        raise ValueError("Sector angle must be positive and at most one turn")
    steps = max(2, math.ceil((angle_end - angle_start) / math.tau * 128))
    angles = [angle_start + (angle_end - angle_start) * index / steps for index in range(steps + 1)]
    half = depth / 2
    vertices = []
    for z in (-half, half):
        for radius in (inner_radius, outer_radius):
            vertices.extend((radius * math.cos(angle), radius * math.sin(angle), z) for angle in angles)
    count = steps + 1
    bottom_inner, bottom_outer, top_inner, top_outer = 0, count, count * 2, count * 3
    faces = []
    for index in range(steps):
        next_index = index + 1
        faces.extend((
            (top_inner + index, top_outer + index, top_outer + next_index, top_inner + next_index),
            (bottom_inner + next_index, bottom_outer + next_index, bottom_outer + index, bottom_inner + index),
            (bottom_inner + index, top_inner + index, top_inner + next_index, bottom_inner + next_index),
            (bottom_outer + next_index, top_outer + next_index, top_outer + index, bottom_outer + index),
        ))
    faces.extend((
        (bottom_inner, bottom_outer, top_outer, top_inner),
        (bottom_inner + steps, top_inner + steps, top_outer + steps, bottom_outer + steps),
    ))
    mesh = bpy.data.meshes.new(f"{node_id}/mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    obj = bpy.data.objects.new(node_id, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    return _finish_runtime_object(obj, node_id, bevel)
```

Use one shared radius/angle specification for recess cutters and pieces so a piece cannot drift from its slot. Set every palace sector to exactly `30°`; inset each piece by `0.00008 m` at both radial edges and `0.12°` at both angular edges to create only the approved fine seam, and store these values as custom properties tested above.

Freeze the reference orientation in `daliuren_contract.py` and reuse it for glyphs, slots, and pieces:

```python
VISUAL_EARTH_ORDER = tuple("午未申酉戌亥子丑寅卯辰巳")
VISUAL_MONTH_ORDER = (
    "胜光", "小吉", "传送", "从魁", "河魁", "登明",
    "神后", "大吉", "功曹", "太冲", "天罡", "太乙",
)

def visual_angle(index):
    return math.radians(90 - index * 30)
```

Index `0` is the top/south `午/胜光` palace. Do not derive this visual order from object enumeration or alphabetic sorting.

- [ ] **Step 4: Rebuild the semantic plate layers**

Keep existing public IDs where possible:

- `plate/earth`: fixed square/zodiac/earthly-branch body.
- `plate/heaven`: the only rotating month-general ring.
- `plate/generals`: fixed twelve-recess seat.
- `plate/core`: fixed Beidou and pivot.
- `general-slot/<earth>`: fixed transform anchors under `plate/generals`.
- `general/<key>`: independent sector inlays, parented to the fixed seat and initially above/hidden as required by pose.
- `month-general/<name>`: twelve independently materialized glyph meshes parented to `plate/heaven`.
- `interaction/month-general-ring`: larger coplanar annulus with `colorWrite=false` runtime material intent.

Remove `_add_reference_surface()` from `upgrade_to_high_detail()`. Keep the source image only under `assets/daliuren/references/` for review.

- [ ] **Step 5: Run the Blender and TypeScript contract suites**

Run the four commands from Step 2 plus:

```bash
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_graybox_structure.py
npm test -- src/features/artifact-scene/model/asset-contract.test.ts src/features/artifact-scene/three/load-artifact.test.ts
```

Expected: PASS; the scene contains exactly twelve slots, pieces, and month glyphs, with only `plate/heaven` marked rotatable.

- [ ] **Step 6: Commit geometry and contract source, not generated LODs yet**

```bash
git add tools/blender/geometry.py tools/blender/daliuren_contract.py tools/blender/build_graybox.py tools/blender/high_detail_geometry.py tools/blender/tests/test_contract.py tools/blender/tests/test_graybox_structure.py tools/blender/tests/test_component_contract.py tools/blender/tests/test_high_detail_geometry.py assets/daliuren/asset-contract.json src/features/artifact-scene/model/asset-contract.ts src/features/artifact-scene/model/asset-contract.test.ts src/features/artifact-scene/three/load-artifact.test.ts
git commit -m "feat: model layered jade plate geometry"
```

### Task 5: Build Jade, Cinnabar, Ink, and Switchable Gold Materials; Export All LODs

**Files:**
- Modify: `tools/blender/materials.py`
- Modify: `tools/blender/uv_and_bake.py`
- Modify: `tools/blender/build_lods.py`
- Modify: `tools/blender/tests/test_materials.py`
- Modify: `tools/blender/tests/test_uv_and_bake.py`
- Modify: `tools/blender/tests/test_lods.py`
- Modify: `assets/daliuren/materials/material-contract.json`
- Modify: `assets/daliuren/source/daliuren-artifact-master.blend`
- Modify: `assets/daliuren/textures/lod0/*`
- Modify: `assets/daliuren/textures/lod2/*`
- Modify: `public/models/daliuren/daliuren-artifact-lod0.glb`
- Modify: `public/models/daliuren/daliuren-artifact-lod1.glb`
- Modify: `public/models/daliuren/daliuren-artifact-lod2.glb`
- Modify: `docs/asset-reviews/lookdev/overall.png`
- Modify: `docs/asset-reviews/lookdev/legibility.png`

**Interfaces:**
- Consumes: Task 4 semantic objects and the existing atlas/export pipeline.
- Produces: glTF materials whose runtime clones can interpolate month/general text without changing jade.

- [ ] **Step 1: Write material ownership tests**

```python
def test_jade_inlays_are_translucent_but_text_is_independent(self):
    for key in GENERAL_KEYS:
        piece = bpy.data.objects[f"general/{key}"]
        self.assertEqual(piece["material_role"], "M_TranslucentJade")
        glyph = next(child for child in piece.children if child.get("text_role") == "general-name")
        self.assertEqual(glyph["material_role"], "M_AshText")

def test_month_glyphs_begin_cinnabar_and_can_be_cloned_at_runtime(self):
    for name in MONTH_GENERAL_NAMES:
        glyph = bpy.data.objects[f"month-general/{name}"]
        self.assertEqual(glyph["material_role"], "M_CinnabarText")
        self.assertTrue(glyph["runtime_color_switch"])
```

Also assert earth glyphs use `M_InkText`, the slot walls use a slightly rougher jade material, no glyph material is emissive, and `M_ReferenceSurface` is absent from exported runtime materials.

- [ ] **Step 2: Run focused material tests and observe failure**

Run:

```bash
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_materials.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
```

Expected: FAIL because the current scene uses `M_Celadon`, `M_AshText`, and `M_ReferenceSurface` without the required ownership split.

- [ ] **Step 3: Implement the minimum physical families**

Add these explicit material families to the contract and builder:

```python
MATERIAL_NAMES = (
    "M_JadeBody", "M_TranslucentJade", "M_JadeRecess",
    "M_InkText", "M_CinnabarText", "M_OldGold",
)
```

Use non-emissive Principled inputs. Set `M_TranslucentJade` to IOR `1.48`, transmission weight `0.12`, roughness `0.24`, coat weight `0.16`, and model thickness `0.004 m`; this reveals edge thickness without making the piece glass-clear. Set `M_JadeRecess` roughness to `0.34` and its base color approximately 4% darker than `M_JadeBody`. Use `#27231F` for `M_InkText`, `#A33A25` for `M_CinnabarText`, and `#B98A38` with metallic `1.0` and roughness `0.38` for `M_OldGold`. Assign separate material slots/objects to text so runtime color changes never tint jade.

- [ ] **Step 4: Preserve semantic material nodes through baking and LOD reduction**

Update atlas partitioning so the rotating ring and twelve falling pieces use the moving class, while the fixed seat/body/core use hero atlases. Preserve `node_id`, `text_role`, `runtime_color_switch`, and `target_earth` on every LOD. Ensure the invisible interaction annulus is excluded from texture bakes but retained in glTF.

- [ ] **Step 5: Rebuild master, bake, export, compress, and validate**

Run:

```bash
npm run asset:blender -- --background --factory-startup --python tools/blender/build_graybox.py -- --master --save assets/daliuren/source/daliuren-artifact-master.blend
npm run asset:export-lods
npm run asset:validate
npm run asset:render-lookdev
```

Expected: all commands exit `0`; each GLB contains the required semantic nodes and KTX2 textures, and review renders show actual geometry with no flat reference plane.

- [ ] **Step 6: Run all directly affected Blender tests**

Run:

```bash
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_materials.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_lods.py
```

Expected: PASS with no near-coplanar exposed surfaces, duplicate node IDs, or material-family drift.

- [ ] **Step 7: Commit generated asset deliverables with their source**

```bash
git add tools/blender/materials.py tools/blender/uv_and_bake.py tools/blender/build_lods.py tools/blender/tests/test_materials.py tools/blender/tests/test_uv_and_bake.py tools/blender/tests/test_lods.py assets/daliuren/materials/material-contract.json assets/daliuren/source/daliuren-artifact-master.blend assets/daliuren/textures public/models/daliuren/daliuren-artifact-lod0.glb public/models/daliuren/daliuren-artifact-lod1.glb public/models/daliuren/daliuren-artifact-lod2.glb docs/asset-reviews/lookdev/overall.png docs/asset-reviews/lookdev/legibility.png
git commit -m "feat: export translucent jade plate assets"
```

### Task 6: Apply Physical Poses and Translate Ring Gestures in Three.js

**Files:**
- Create: `src/features/artifact-scene/three/month-general-pointer.ts`
- Create: `src/features/artifact-scene/three/month-general-pointer.test.ts`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.ts:20-25,153-288,343-431,581-638`
- Modify: `src/features/artifact-scene/three/ArtifactSceneController.test.ts`
- Modify: `src/features/artifact-scene/three/dispose-artifact.ts`

**Interfaces:**
- Consumes: `JadePlateMotion` and interaction enablement from the React owner.
- Produces: `applyJadePlateMotion(motion)`, `setMonthGeneralInteractionEnabled(enabled)`, and callback `onMonthGeneralInput(event)`.

- [ ] **Step 1: Write pointer-angle and controller behavior tests**

```ts
it("maps a pointer ray to an angle on the fixed plate plane", () => {
  expect(angleOnPlatePlane(centerRay, eastRayPoint)).toBeCloseTo(Math.PI / 2);
});

it("captures the ring without starting orbit controls", () => {
  const { canvas, controls, callbacks, controller } = fixtureWithJadeNodes();
  controller.setMonthGeneralInteractionEnabled(true);
  dispatchPointer(canvas, "pointerdown", ringPoint);
  expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-start" }));
  expect(controls.enabled).toBe(false);
});

it("applies angle, height, visibility, and independent text color", () => {
  controller.applyJadePlateMotion(fullMotion);
  expect(monthRing.rotation.y).toBeCloseTo(fullMotion.monthAngleRad);
  expect(generalPieces[0].position.y).toBeCloseTo(slotY + fullMotion.generals[0].heightMeters);
  expect(monthGlyphMaterials.get("month-general/胜光")!.color.getHexString()).toBe(oldGoldHex);
  expect((generalPieces[0].material as THREE.Material)).toBe(jadeMaterial);
});
```

Also test pointer capture/release, wraparound drag, wheel `deltaY` sign, Left/Right keys, disabled input during demo, listener cleanup, and OrbitControls restoration.

- [ ] **Step 2: Run the focused Three.js tests**

Run: `npm test -- src/features/artifact-scene/three/month-general-pointer.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts`

Expected: FAIL on missing callbacks, material bindings, and input listeners.

- [ ] **Step 3: Implement ray-plane angle conversion without DOM state**

```ts
export function angleOnPlatePlane(
  ray: THREE.Ray,
  plane: THREE.Plane,
  center: THREE.Vector3,
): number | undefined {
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return undefined;
  const local = hit.sub(center);
  return Math.atan2(local.x, local.z);
}
```

The controller raycasts `interaction/month-general-ring` first. It captures the pointer only on that annulus, disables orbit controls for the ring gesture, and restores them on `pointerup`, `pointercancel`, disposal, or error.

- [ ] **Step 4: Bind independently owned runtime materials**

Clone each `M_CinnabarText` month glyph material and each general-name material once in the constructor. Interpolate only material color/metalness/roughness using the motion progress; do not replace the translucent jade piece material. Remove `isReplacedByReferenceSurface()` and the runtime hiding of legitimate face geometry.

- [ ] **Step 5: Apply fixed slot destinations and physical height**

Use `general-slot/<earth>` base transforms, not general identity/index, as destination transforms. Reset from frozen base transforms on every call, apply ring Y rotation, place each piece at its target slot, then add its vertical height. Keep `plate/generals` and `plate/core` at their frozen transforms.

- [ ] **Step 6: Run controller tests**

Run: `npm test -- src/features/artifact-scene/three/month-general-pointer.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/three/load-artifact.test.ts`

Expected: PASS; disposal restores all original materials and removes all pointer, wheel, keyboard, context, and control listeners exactly once.

- [ ] **Step 7: Commit the renderer/input bridge**

```bash
git add src/features/artifact-scene/three/month-general-pointer.ts src/features/artifact-scene/three/month-general-pointer.test.ts src/features/artifact-scene/three/ArtifactSceneController.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts src/features/artifact-scene/three/dispose-artifact.ts
git commit -m "feat: control month general ring in three scene"
```

### Task 7: Hand Off Seamlessly From Demo to Customer Interaction

**Files:**
- Create: `src/features/artifact-scene/MonthGeneralControls.tsx`
- Create: `src/features/artifact-scene/MonthGeneralControls.test.tsx`
- Modify: `src/features/artifact-scene/ArtifactExperience.tsx:108-480`
- Modify: `src/features/artifact-scene/ArtifactExperience.test.tsx`
- Modify: `src/features/artifact-scene/artifact-scene.css`

**Interfaces:**
- Consumes: controller gesture events, `MonthGeneralInteractionState`, and the shared reducer.
- Produces: one continuous demo-to-interactive experience and two accessible step buttons.

- [ ] **Step 1: Write component-level handoff tests**

```tsx
it("keeps controls disabled before completion and enables them without a mode switch", async () => {
  renderExperience();
  expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeDisabled();
  finishDemoFrame();
  expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /试玩|进入操作|重置月将环/ })).not.toBeInTheDocument();
});

it("routes both buttons through the same step event", async () => {
  const onStep = vi.fn();
  render(<MonthGeneralControls enabled phase="seated" detent={6} onStep={onStep} />);
  await user.click(screen.getByRole("button", { name: "月将环向右一宫" }));
  expect(onStep).toHaveBeenCalledWith(1);
});
```

Add tests that a new `source` or a seek before `ARTIFACT_DURATION_MS` resets to `locked`, completion dispatches exactly one `demo-complete`, reduced motion reaches the same interactive final state, and an interrupted landing renders exit from the current progress.

- [ ] **Step 2: Run focused React tests and verify failure**

Run: `npm test -- src/features/artifact-scene/MonthGeneralControls.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx`

Expected: FAIL because no controls or interaction owner exists.

- [ ] **Step 3: Add the controls without a new mode**

```tsx
export function MonthGeneralControls({ enabled, phase, detent, onStep }: Props) {
  return (
    <div className="month-general-controls" role="group" aria-label="月将环操作">
      <button type="button" disabled={!enabled} aria-label="月将环向左一宫" onClick={() => onStep(-1)}>‹</button>
      <p className="artifact-visually-hidden" role="status">
        {enabled ? `月将环位于第${detent + 1}宫，${phaseLabel[phase]}` : "自动演示中，月将环暂不可操作"}
      </p>
      <button type="button" disabled={!enabled} aria-label="月将环向右一宫" onClick={() => onStep(1)}>›</button>
    </div>
  );
}
```

Use `44 px` minimum hit targets. Visually place the controls beside/below the round plate, not over its text or zodiac reliefs.

- [ ] **Step 4: Make `ArtifactExperience` the sole interaction owner**

Create the layout once from `displayState`. Keep interaction state in a ref plus the minimum React snapshot needed for controls/observability. On each frame:

1. Before demo completion, apply `evaluateArtifactPose` only and keep controller interaction disabled.
2. At `ARTIFACT_DURATION_MS`, dispatch `demo-complete` once and enable controller input.
3. After handoff, evaluate the reducer state at the current monotonic timestamp and call `applyJadePlateMotion`.
4. On controller gesture or button step, reduce from a current progress snapshot and render immediately.
5. On source replacement, stage replay, or seek before the final time, reset/lock interaction and cancel the current transition by replacing state—never by clearing timeout IDs.

- [ ] **Step 5: Preserve reduced-motion and accessible facts**

For reduced motion, the automatic final frame still dispatches `demo-complete`; landing/exit poses jump to their correct ordered endpoints. Extend accessible facts/status with the active month-general, current detent, alignment state, and seated count without announcing every animation frame.

- [ ] **Step 6: Run React and timeline regression tests**

Run:

```bash
npm test -- src/features/artifact-scene/MonthGeneralControls.test.tsx src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/timeline src/features/artifact-scene/model
```

Expected: PASS; no reset/try-mode button is present and all input sources converge on the same reducer.

- [ ] **Step 7: Commit the experience integration**

```bash
git add src/features/artifact-scene/MonthGeneralControls.tsx src/features/artifact-scene/MonthGeneralControls.test.tsx src/features/artifact-scene/ArtifactExperience.tsx src/features/artifact-scene/ArtifactExperience.test.tsx src/features/artifact-scene/artifact-scene.css
git commit -m "feat: hand off jade plate demo to interaction"
```

### Task 8: Verify Twelve Detents, Both General Directions, Visual Fidelity, and Failure Safety

**Files:**
- Modify: `e2e/artifact-experience.spec.ts`
- Modify: `src/features/artifact-scene/annotations/descriptors.ts`
- Modify: `src/features/artifact-scene/annotations/descriptors.test.ts`
- Modify: `src/features/artifact-scene/ArtifactPartDirectory.tsx`
- Modify: `src/features/artifact-scene/ArtifactPartDirectory.test.tsx`
- Modify: `docs/asset-reviews/lookdev/overall.png`
- Create: `docs/asset-reviews/lookdev/jade-plate-default.png`
- Create: `docs/asset-reviews/lookdev/jade-plate-mobile.png`
- Create: `docs/asset-reviews/lookdev/jade-plate-overlay.png`

**Interfaces:**
- Consumes: the complete feature and benchmark-only observable attributes.
- Produces: repeatable E2E evidence for detents, sequence, cancellation, mobile, reduced motion, errors, and reference comparison.

- [ ] **Step 1: Add stable non-production observability**

Under the existing `observableBuild()` guard, expose:

```tsx
data-month-general-phase={interaction.phase}
data-month-general-detent={interaction.detent}
data-month-general-aligned={String(interaction.aligned)}
data-seated-generals={motion.generals.filter((item) => item.seatProgress === 1).length}
data-seated-general-ids={motion.generals.filter((item) => item.seatProgress === 1).map((item) => item.nodeId).join(",")}
data-general-sequence={layout.generalSequence.map((item) => item.nodeId).join(",")}
data-active-month-gold={motion.activeMonthGoldProgress.toFixed(3)}
```

Update artifact annotations and the part directory to call `plate/heaven` “月将环” and `plate/generals` “十二神将承位”; remove wording that implies the whole heaven plate or general seat rotates. Keep counts generated from descriptor length rather than hard-coded “22”.

- [ ] **Step 2: Write failing E2E cases**

```ts
test("only the correct detent seats the generals and leaving reverses them", async ({ page }) => {
  await completeReferenceCourse(page);
  const experience = await finishArtifactDemo(page);
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12");

  await page.getByRole("button", { name: "月将环向右一宫" }).click();
  await expect(experience).toHaveAttribute("data-month-general-aligned", "false");
  await expect(experience).toHaveAttribute("data-active-month-gold", "0.000");
  await expect(experience).toHaveAttribute("data-seated-generals", "0", { timeout: 2_500 });

  await page.getByRole("button", { name: "月将环向左一宫" }).click();
  await expect(experience).toHaveAttribute("data-month-general-aligned", "true");
  await expect(experience).toHaveAttribute("data-seated-generals", "12", { timeout: 6_000 });
});
```

Add cases for all twelve detents, a forward course, a reverse course, noble-first landing, pointer-down without movement, interruption around the third/fourth piece, wheel, keys, touch drag, mobile viewport, reduced motion, GLB load failure, and WebGL context loss.

- [ ] **Step 3: Run focused E2E and verify the new expectations initially fail**

Run: `npm run build && npx playwright test e2e/artifact-experience.spec.ts --project=chromium`

Expected before final fixes: at least one new interaction/observability assertion fails; existing loading and fallback cases remain green.

- [ ] **Step 4: Fix only integration defects exposed by E2E**

Confine fixes to the feature files from Tasks 1–7. Do not loosen timing bounds, replace exact detent checks with broad tolerances, or add sleeps; wait on observable state attributes.

- [ ] **Step 5: Produce reference-review evidence**

At `1280×720` and `390×844`, capture the completed correct state. Save a square canvas-element capture as `docs/asset-reviews/lookdev/jade-plate-default.png`, then create the 50% overlay with Pillow:

```bash
python -c "from PIL import Image,ImageOps; r=Image.open(r'assets/daliuren/references/daliuren-heaven-plate-translucent-jade-generals-v10.png').convert('RGBA'); s=Image.open(r'docs/asset-reviews/lookdev/jade-plate-default.png').convert('RGBA'); s=ImageOps.fit(s,r.size,method=Image.Resampling.LANCZOS); Image.blend(r,s,0.5).save(r'docs/asset-reviews/lookdev/jade-plate-overlay.png')"
```

Review and reject the result if it shows any obvious mismatch in square-plate outline, round-plate scale, zodiac order, corner pearls, earthly-branch positions, month-general positions, general sectors, center Beidou, or default orientation.

- [ ] **Step 6: Run the complete verification matrix**

Run:

```bash
npm test
npm run build
npm run asset:validate
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_component_contract.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_high_detail_geometry.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_materials.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_uv_and_bake.py
npm run asset:blender -- --background --factory-startup --python tools/blender/tests/test_lods.py
npx playwright test
```

Expected: every command exits `0`; browser console has no uncaught errors/warnings caused by the artifact; all three LODs render the same rule state.

- [ ] **Step 7: Inspect the final diff for scope and generated-asset consistency**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only files named in this plan plus deterministic generated textures/GLBs/review images are changed; no unrelated dirty file is staged.

- [ ] **Step 8: Commit final E2E and review evidence**

```bash
git add e2e/artifact-experience.spec.ts src/features/artifact-scene/annotations/descriptors.ts src/features/artifact-scene/annotations/descriptors.test.ts src/features/artifact-scene/ArtifactPartDirectory.tsx src/features/artifact-scene/ArtifactPartDirectory.test.tsx docs/asset-reviews/lookdev/jade-plate-default.png docs/asset-reviews/lookdev/jade-plate-mobile.png docs/asset-reviews/lookdev/jade-plate-overlay.png
git commit -m "test: verify jade plate physical interaction"
```

## Completion Gate

The work is complete only when all Task 8 verification commands pass and the overlay review shows no obvious reference mismatch. A passing unit suite without regenerated GLBs, a visually correct final frame without reversible interaction tests, or a correct interaction using the flat v10 surface does not satisfy this plan.
