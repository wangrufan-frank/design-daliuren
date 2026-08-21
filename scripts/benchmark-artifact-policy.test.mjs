import assert from "node:assert/strict";
import test from "node:test";
import { assessWebglRenderer } from "./benchmark-artifact-policy.mjs";

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
