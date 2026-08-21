import assert from "node:assert/strict";
import test from "node:test";
import * as policy from "./benchmark-artifact-policy.mjs";

const { assessWebglRenderer } = policy;

test("uses the contracted viewport LOD for the desktop hardware profile", () => {
  assert.deepEqual(policy.ARTIFACT_BENCHMARK_PROFILES?.[0], {
    name: "desktop",
    viewport: { width: 1920, height: 1080 },
    dpr: 1,
    lod: 0,
    thresholdFps: 60,
  });
});

test("accepts a recognized hardware WebGL renderer", () => {
  assert.deepEqual(
    assessWebglRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU Direct3D11)"),
    { accepted: true },
  );
});

test("rejects software and unknown WebGL renderers", () => {
  for (const renderer of [
    "ANGLE (Google, Vulkan (SwiftShader Device), SwiftShader driver)",
    "llvmpipe (LLVM 18.1.8, 256 bits)",
    "Software Rasterizer",
    "",
    "unavailable",
    "ANGLE (Mystery Adapter)",
  ]) {
    const assessment = assessWebglRenderer(renderer);
    assert.equal(assessment.accepted, false, renderer);
    assert.match(assessment.reason, /renderer/i, renderer);
  }
});
