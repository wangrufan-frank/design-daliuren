const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render|mesa offscreen/i;
const RECOGNIZED_HARDWARE = /\b(?:nvidia|geforce|quadro|amd|radeon|intel|apple|adreno|mali|powervr)\b/i;

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
