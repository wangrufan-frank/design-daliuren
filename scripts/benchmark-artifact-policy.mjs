const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render|mesa offscreen/i;
const RECOGNIZED_HARDWARE = /\b(?:nvidia|geforce|quadro|amd|radeon|intel|apple|adreno|mali|powervr)\b/i;

export const ARTIFACT_BENCHMARK_PROFILES = Object.freeze([
  { name: "desktop", viewport: { width: 1920, height: 1080 }, dpr: 1, lod: 0, thresholdFps: 60 },
  { name: "mobile", viewport: { width: 390, height: 844 }, dpr: 3, lod: 2, thresholdFps: 30 },
]);

export function assessWebglRenderer(renderer) {
  const normalized = typeof renderer === "string" ? renderer.trim() : "";
  if (!normalized || /^(?:unavailable|unknown)$/i.test(normalized)) {
    return { accepted: false, reason: "WebGL renderer is empty or unavailable" };
  }
  if (SOFTWARE_RENDERER.test(normalized)) {
    return { accepted: false, reason: "Software WebGL renderer is not accepted" };
  }
  if (!RECOGNIZED_HARDWARE.test(normalized)) {
    return { accepted: false, reason: "Unknown WebGL renderer is not accepted" };
  }
  return { accepted: true };
}
