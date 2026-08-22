# Task 6 report: camera-tracked annotation layer

## Delivered

- Added controller-side annotation sampling for the frozen 22-part descriptor table. Each sample resolves the required node, captures its current world position, projects through the current camera, and raycasts the artifact for nearer mesh occlusion with the required `0.002` world-unit tolerance.
- Added a descriptive, deduplicated annotation-error channel. A missing required node is omitted from the frame and reported without stopping rendering or replacing the 3D experience with its fatal fallback.
- Added a memoized DOM/SVG annotation layer. React creates semantic card, leader, and anchor nodes only when the selected ID set changes; one owned animation-frame loop updates card transforms, path attributes, anchor coordinates, visibility, and occlusion classes through refs.
- Added `本阶段 / 全部 / 隐藏` density controls, defaulting to `本阶段`. `全部` renders all 22 descriptors through the existing deterministic Task 5 crowd-balancing layout, while each card can focus its physical scene node.
- Added the Tian-guang museum visual treatment: 1px celadon elbow leaders, 5px anchor dots, translucent light specimen cards, 14px text, at least 44px interactive targets, and 55% opacity plus dashed leaders for occluded parts.
- Preserved stage replay captions, evidence drawer, text-course escape, reduced motion behavior, PMREM lighting, `toneMapped: false` dynamic labels, controller ownership, and disposal behavior.

## Independent-review fixes

- Aligned layout geometry with the annotation card's CSS minimum target: every returned density is at least 44px tall, same-side cards retain an 8px gap, and a viewport shorter than the minimum required stack now throws a descriptive `RangeError` instead of compressing cards into overlapping DOM targets.
- Made node focus interrupt an active stage camera tween before changing the camera and controls target, so later renders preserve the selected-node focus.

## Red/green evidence

- Layout RED: `npm test -- src/features/artifact-scene/annotations/layout-annotations.test.ts` — 2 focused regressions failed as intended: the fitting 691px viewport returned 40px cards, and a 563px viewport did not throw.
- Layout GREEN: the same command — 1 file, 6 tests passed after enforcing the 44px minimum and rejecting insufficient height.
- Focus RED: `npm test -- src/features/artifact-scene/three/ArtifactSceneController.test.ts -t "keeps a focused node after a later render interrupts a stage camera tween"` — 1 test failed because the later render restored the stage preset camera.
- Focus GREEN: the same command — 1 focused test passed after `focusNode()` began canceling the active tween before changing camera state.

## Focused verification

- `npm test -- src/features/artifact-scene/annotations/layout-annotations.test.ts src/features/artifact-scene/three/ArtifactSceneController.test.ts` — 2 files, 25 tests passed.
- `npm test -- src/features/artifact-scene` — 14 files, 113 tests passed.
- `npm run build` — TypeScript and Vite production build completed; Vite retained the existing large-chunk advisory.
- `git diff --check` — no whitespace errors; Git only reported the repository's LF-to-CRLF checkout notices.

## Visual inspection

- In the local 3D experience, default stage mode showed the expected six course-stage parts. `全部` exposed 22/22 visible cards.
- At the inspected 658x691 artifact viewport, all 22 cards stayed inside the viewport with no pairwise overlap. Computed card height was approximately 44px, card text was 14px, leaders were 1px, and anchor radius was 2.5px.
- Occlusion sampling marked 19 currently hidden anchors; their cards/dots were dimmed and their leaders used the dashed treatment.
- A diagonal orbit/vertical drag changed the sampled leader path. Selecting the four-lessons stage changed it again during the camera tween and again during the structure replay, confirming continuous camera and decomposition tracking without React frame-state updates.
- Browser console inspection found no application errors. Three.js emitted its existing multiple-active-KTX2-loader warning during the development-session reload cycle.

## Self-review

- No dependency, package-script, rule, asset-contract, lighting, or unrelated layout changes were introduced.
- Per-frame controller work reuses a frozen descriptor map and one raycaster. The overlay cancels its owned frame on unmount and the experience continues to dispose its controller exactly once.
- The only retained concern is the existing Vite large-bundle advisory and development-only KTX2-loader warning; neither was introduced or expanded within Task 6 scope.
