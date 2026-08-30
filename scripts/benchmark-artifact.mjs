import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { build, preview } from "vite";
import { ARTIFACT_BENCHMARK_PROFILES, assessWebglRenderer } from "./benchmark-artifact-policy.mjs";

const FRAME_SAMPLE_COUNT = 300;
const FRAME_SAMPLE_TIMEOUT_MS = 30_000;
const BROWSER_CHANNEL = "chrome";
const HOST = "127.0.0.1";
const PORT = 4174;
const OUTPUT_PATH = path.resolve("docs/asset-reviews/runtime/benchmark.json");
const PROFILES = ARTIFACT_BENCHMARK_PROFILES;

function percentile(sorted, fraction) {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function round(value) {
  return Number(value.toFixed(4));
}

async function closeServer(server) {
  if (!server?.httpServer.listening) return;
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}

async function completeReferenceCourse(page, baseURL) {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByLabel("日期与时间").fill("2024-02-10T14:30");
  await page.getByLabel("出生年份").fill("1990");
  await page.getByLabel("地点（选填）").fill("北京");
  await page.getByLabel("起课事由").fill("商务决策复盘");
  await page.getByRole("button", { name: "生成完整课式" }).click();
}

async function sampleProfile(browser, baseURL, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.dpr,
    isMobile: profile.name === "mobile",
    hasTouch: profile.name === "mobile",
  });
  const page = await context.newPage();
  let requestedGlb;
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (/\/daliuren-artifact-lod\d\.glb$/.test(pathname)) requestedGlb = pathname;
  });

  try {
    await completeReferenceCourse(page, baseURL);
    if (profile.name === "mobile") {
      await page.getByRole("toolbar", { name: "工作台工具" })
        .getByRole("button", { name: "时间轴", exact: true })
        .click();
    }
    const slider = page.getByRole("slider", { name: "推演时间轴" });
    await slider.waitFor({ state: "visible" });
    const initialPoseHash = await page.getByTestId("artifact-experience").getAttribute("data-pose-hash");
    await slider.fill("12500");
    await page.waitForFunction(
      (previousHash) => {
        const experience = document.querySelector("[data-testid='artifact-experience']");
        const timeline = document.querySelector("[aria-label='推演时间轴']");
        return timeline?.value === "12500"
          && experience?.getAttribute("data-pose-hash")
          && experience.getAttribute("data-pose-hash") !== previousHash;
      },
      initialPoseHash,
    );
    const runtime = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const context = canvas?.getContext("webgl2");
      const debugInfo = context?.getExtension("WEBGL_debug_renderer_info");
      return {
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        canvasPixels: canvas ? { width: canvas.width, height: canvas.height } : undefined,
        webglRenderer: context && debugInfo
          ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : "unavailable",
      };
    });
    if (runtime.viewport.width !== profile.viewport.width
      || runtime.viewport.height !== profile.viewport.height
      || Math.abs(runtime.dpr - profile.dpr) > 1e-6) {
      throw new Error(`${profile.name} runtime profile mismatch: ${JSON.stringify(runtime)}`);
    }
    const rendererAssessment = assessWebglRenderer(runtime.webglRenderer);
    if (!rendererAssessment.accepted) {
      throw new Error(`${profile.name} ${rendererAssessment.reason}: ${runtime.webglRenderer}`);
    }

    const frameTimes = await page.evaluate(({ sampleCount, timeoutMs }) => new Promise((resolve, reject) => {
      const samples = [];
      let previousTimestamp;
      const timer = window.setTimeout(() => {
        delete window.__artifactFrameObserver;
        reject(new Error(`Timed out after ${timeoutMs} ms with ${samples.length}/${sampleCount} frame samples`));
      }, timeoutMs);
      window.__artifactFrameObserver = (timestamp) => {
        if (previousTimestamp !== undefined) samples.push(timestamp - previousTimestamp);
        previousTimestamp = timestamp;
        if (samples.length === sampleCount) {
          window.clearTimeout(timer);
          delete window.__artifactFrameObserver;
          resolve(samples);
        }
      };
    }), { sampleCount: FRAME_SAMPLE_COUNT, timeoutMs: FRAME_SAMPLE_TIMEOUT_MS });

    const expectedGlb = `/models/daliuren/daliuren-artifact-lod${profile.lod}.glb`;
    if (requestedGlb !== expectedGlb) {
      throw new Error(`${profile.name} requested ${requestedGlb ?? "no GLB"}; expected ${expectedGlb}`);
    }
    const glbBytes = (await stat(path.resolve(`public${expectedGlb}`))).size;
    const sorted = [...frameTimes].sort((left, right) => left - right);
    const medianFrameTimeMs = (sorted[149] + sorted[150]) / 2;
    const medianFps = 1_000 / medianFrameTimeMs;
    return {
      name: profile.name,
      viewport: profile.viewport,
      dpr: profile.dpr,
      selectedLod: profile.lod,
      glb: expectedGlb,
      glbBytes,
      canvasPixels: runtime.canvasPixels,
      webglRenderer: runtime.webglRenderer,
      hardwareRenderer: rendererAssessment.accepted,
      medianFrameTimeMs: round(medianFrameTimeMs),
      p95FrameTimeMs: round(percentile(sorted, 0.95)),
      medianFps: round(medianFps),
      sampleCount: frameTimes.length,
      thresholdFps: profile.thresholdFps,
      passes: rendererAssessment.accepted && medianFps >= profile.thresholdFps,
    };
  } finally {
    await context.close();
  }
}

const root = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "daliuren-artifact-benchmark-"));
let browser;
let server;
let cleaning;
const previousBenchmarkFlag = process.env.VITE_ARTIFACT_BENCHMARK;

async function cleanup() {
  if (cleaning) return cleaning;
  cleaning = (async () => {
    const results = await Promise.allSettled([
      browser?.close(),
      closeServer(server),
      rm(outDir, { recursive: true, force: true }),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  })();
  return cleaning;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
}

try {
  process.env.VITE_ARTIFACT_BENCHMARK = "1";
  await build({ root, mode: "benchmark", logLevel: "warn", build: { outDir, emptyOutDir: true } });
  server = await preview({
    root,
    logLevel: "warn",
    build: { outDir },
    preview: { host: HOST, port: PORT, strictPort: true },
  });
  browser = await chromium.launch({ channel: BROWSER_CHANNEL, headless: false });
  const profiles = [];
  for (const profile of PROFILES) profiles.push(await sampleProfile(browser, `http://${HOST}:${PORT}`, profile));
  const result = {
    generatedAt: new Date().toISOString(),
    browser: { name: "Google Chrome", channel: BROWSER_CHANNEL, version: browser.version() },
    frameSampleCount: FRAME_SAMPLE_COUNT,
    profiles,
  };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  const failures = profiles.filter((profile) => !profile.passes);
  if (failures.length > 0) {
    throw new Error(failures.map((profile) => `${profile.name} median ${profile.medianFps} FPS is below ${profile.thresholdFps} FPS`).join("; "));
  }
} finally {
  if (previousBenchmarkFlag === undefined) delete process.env.VITE_ARTIFACT_BENCHMARK;
  else process.env.VITE_ARTIFACT_BENCHMARK = previousBenchmarkFlag;
  await cleanup();
}
