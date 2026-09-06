# 大六壬小工具离线包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个包含可交互程序化三维玉盘、完整起课与文字课式、并可通过小红书 JSBridge 保存课式图片的合规离线 ZIP。

**Architecture:** 新增与网站构建完全隔离的 `src/minitool` 入口，复用现有领域计算但不导入网站 GLB/WASM/剪贴板链路。Vite library mode 将 React、Three.js 和小工具代码打成单个 ES2017 IIFE 经典脚本；Node 校验器和 Python 标准库打包器执行静态门禁与 ZIP 根目录约束。

**Tech Stack:** React 19、Three.js 0.185、TypeScript 5.9、Vite 7、Canvas 2D、小红书 `window.xhs.miniTool` JSBridge、Node/Python 标准库审计。

**Spec:** `docs/superpowers/specs/2026-09-03-minitool-offline-package-design.md`

## Global Constraints

- 现有网站入口、GitHub Pages 构建和 GLB 模型行为不得改变。
- 小工具 ZIP 仅允许 HTML、CSS、JS、PNG/JPG/JPEG/GIF/WebP/SVG、WOFF/WOFF2、JSON。
- `index.html` 必须位于 ZIP 根目录；资源使用 `./` 相对路径；禁止模块脚本、内联脚本和外部 URL。
- 最终 JavaScript 目标为 ES2017 / Chrome 61，且不包含 WASM、Worker、网络请求、剪贴板、下载链接或动态执行代码。
- 最终 ZIP 不超过 10 MiB，目标不超过 2 MiB。
- WebGL DPR 不超过 1.5，drawing buffer 不超过约 200 万像素，三角形不超过 50k，draw call 不超过 50，纹理边长不超过 1024。
- 图片保存只调用 `writeTempFile({ data })` 与 `saveImageToPhotosAlbum({ filePath })`。
- 遵守用户的单次验证要求：测试代码先写，但不执行 RED；全部测试、构建、静态门禁、目录审计、ZIP 审计只在最终流水线运行一次。只有阻止产物生成的错误才允许必要重跑。

---

### Task 1: 小工具构建、HTML 与静态门禁

**Files:**
- Create: `vite.minitool.config.ts`
- Create: `src/minitool/index.html`
- Create: `scripts/validate-minitool.mjs`
- Create: `tools/python/package_minitool.py`
- Create: `scripts/validate-minitool.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: 后续任务提供的 `src/minitool/main.tsx` 与 `src/minitool/assets/earth-board.jpg`。
- Produces: `npm run build:minitool`、`npm run validate:minitool`、`npm run package:minitool`；输出目录 `artifacts/daliuren-minitool/` 和 ZIP `artifacts/daliuren-minitool.zip`。

- [ ] **Step 1: 写静态门禁测试**

创建临时合规/违规目录，调用 `validateMiniToolDirectory(path)`，断言违规目录会报告 `type="module"`、绝对路径、`.wasm`、`navigator.clipboard` 和 `download=`，合规目录返回空数组。测试名称为 `rejects container-forbidden files, markup, and APIs`。

- [ ] **Step 2: 实现 Vite IIFE 构建配置**

配置 `base: "./"`、`build.target: ["es2017", "chrome61"]`、library entry `src/minitool/main.tsx`、`formats: ["iife"]`、固定 `assets/app.js` 与 `assets/style.css`，关闭 source map。构建完成后复制 `src/minitool/index.html` 到产物根目录，并确保 HTML 仅包含：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>大六壬演式</title>
  <link rel="stylesheet" href="./assets/style.css">
</head>
<body>
  <div id="root"></div>
  <script src="./assets/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: 实现静态校验器**

`validateMiniToolDirectory(root): string[]` 递归检查允许后缀、根入口、禁止目录/文件、HTML 结构、相对资源、经典脚本和文本中的禁用模式。禁用模式至少包含：`fetch(`、`XMLHttpRequest`、`WebAssembly`、`new Worker`、`navigator.clipboard`、`window.open`、`eval(`、`new Function`、`download=`、`type="module"`、`http://`、`https://`、`.glb`、`.wasm`。

- [ ] **Step 4: 实现确定性 ZIP 打包器**

`package_minitool.py SOURCE ZIP` 使用 `zipfile.ZipFile(..., ZIP_DEFLATED)` 压缩 SOURCE 的内容而非 SOURCE 文件夹，统一 POSIX 路径，拒绝符号链接，并在写入后断言首层存在 `index.html`。

- [ ] **Step 5: 添加 npm 命令**

```json
"build:minitool": "vite build --config vite.minitool.config.ts",
"validate:minitool": "node scripts/validate-minitool.mjs artifacts/daliuren-minitool",
"package:minitool": "python tools/python/package_minitool.py artifacts/daliuren-minitool artifacts/daliuren-minitool.zip"
```

不在本任务运行测试或构建；最终流水线统一执行。

### Task 2: 复用领域计算的小工具应用壳

**Files:**
- Create: `src/minitool/compute-course.ts`
- Create: `src/minitool/compute-course.test.ts`
- Create: `src/minitool/MiniToolApp.tsx`
- Create: `src/minitool/MiniToolApp.test.tsx`
- Create: `src/minitool/main.tsx`

**Interfaces:**
- Consumes: `CourseInput`、各阶段 `run*Stage` 函数、`LunarTypescriptAdapter`。
- Produces: `computeMiniToolCourse(input): { ok: true; source: ArtifactSourceResults } | { ok: false; message: string }` 与 `<MiniToolApp />`。

- [ ] **Step 1: 写计算适配器测试**

使用现有 `referenceSession.input`，断言成功结果包含 4 课、3 传、12 神将、12 宫，并断言无效输入返回 `{ ok: false }` 而非抛出。

- [ ] **Step 2: 实现单一计算流水线**

按 `runCalendarStage → runHeavenEarthStage → runFourLessonsStage → runThreeTransmissionsStage → runHeavenlyGeneralsStage → runCourseStage` 顺序运行；任一步失败立即返回其 `error.message`；成功时组装 `ArtifactSourceResults`。

- [ ] **Step 3: 写应用壳行为测试**

断言初始显示起课表单；成功提交后默认显示“三维推演”，可切换“文字课式”，点击“重新起课”返回表单。测试通过可访问名称操作，不断言实现细节。

- [ ] **Step 4: 实现应用壳**

`MiniToolApp` 仅维护 `source`、`error`、`mode: "artifact" | "text"`。复用 `CourseInputForm`；成功后渲染 `<ProgrammaticArtifact source={source} />` 或 `<MiniToolCourseSheet result={source.course} />`。不导入网站 `ArtifactExperience`、`CourseExperience` 或 `CourseSheet`。

- [ ] **Step 5: 实现入口**

`main.tsx` 导入 `minitool.css`，在 `#root` 上创建 React root 并渲染 `MiniToolApp`。不使用 top-level await。

### Task 3: 程序化三维玉盘

**Files:**
- Create: `src/minitool/artifact/artifact-blueprint.ts`
- Create: `src/minitool/artifact/artifact-blueprint.test.ts`
- Create: `src/minitool/artifact/create-programmatic-artifact.ts`
- Create: `src/minitool/artifact/ProgrammaticArtifact.tsx`
- Create: `src/minitool/assets/earth-board.jpg`

**Interfaces:**
- Consumes: `ArtifactSourceResults`，其中 `source.plate.offset` 驱动天盘角度，`source.course.palaces` 与 `source.generals.placements` 驱动地支和神将标签。
- Produces: `createArtifactBlueprint(source)` 的纯数据蓝图；`mountProgrammaticArtifact(canvas, source, textureUrl)` 返回 `{ resize, dispose }`；`ProgrammaticArtifact` 管理生命周期。

- [ ] **Step 1: 写蓝图预算测试**

断言蓝图包含 `base`、`earth`、`heaven`、12 个 branch label、12 个独立 general tile、4 个 bead；天盘角度等于 `offset * Math.PI / 6`；预算字段满足 `triangles <= 50000`、`drawCalls <= 50`、`textureSize <= 1024`。

- [ ] **Step 2: 实现纯数据蓝图**

蓝图只做数据映射和角度计算，不导入 Three.js。所有十二项使用固定数组顺序，避免依赖对象遍历顺序。

- [ ] **Step 3: 生成地盘纹理**

复用 `tools/python/resize_mobile_texture.py`，把 `assets/daliuren/textures/source/outer-board-v10-albedo.png` 转为 `src/minitool/assets/earth-board.jpg`，尺寸 1024×1024、JPEG quality 86。

- [ ] **Step 4: 实现几何与材质**

使用 Three.js 核心创建圆角方形底座、地盘、天盘、12 个分离环形扇区神将玉块和 4 颗球形玉珠。地盘纹理通过本地 JPEG 加载；其他玉质使用浅青白 `MeshStandardMaterial`、低金属度和中等粗糙度。禁止阴影、后处理、环境贴图、GLTFLoader、KTX2Loader。

- [ ] **Step 5: 实现标签与联动**

使用 128×128 内存 Canvas 创建地支和神将文字纹理；天盘地支随 heaven group 一起旋转。初始化角度直接应用蓝图 `heavenAngleRad`，不另加校正偏移。

- [ ] **Step 6: 实现触摸控制与生命周期**

Pointer Events 支持鼠标/单指旋转；两个 pointer 距离控制缩放。DPR 取 `min(devicePixelRatio, 1.5)`，再按 200 万像素上限下调。`visibilitychange` 暂停 RAF；慢帧窗口触发 DPR 1；`webglcontextlost` 停止并调用 `onUnavailable`；dispose 移除监听并释放纹理、材质、几何体和 renderer。

- [ ] **Step 7: 实现 React 包装**

组件在 WebGL 不可用或 context lost 时显示“模型不可用，已切换文字课式”，并调用应用壳切换回文字课式；加载期间显示明确状态，不无限重试。

### Task 4: 文字课式 Canvas 与 JSBridge 相册保存

**Files:**
- Create: `src/minitool/course/render-course-image.ts`
- Create: `src/minitool/course/render-course-image.test.ts`
- Create: `src/minitool/course/xhs-bridge.ts`
- Create: `src/minitool/course/xhs-bridge.test.ts`
- Create: `src/minitool/course/MiniToolCourseSheet.tsx`
- Create: `src/minitool/course/MiniToolCourseSheet.test.tsx`
- Create: `src/minitool/xhs.d.ts`

**Interfaces:**
- Consumes: `CourseResult`。
- Produces: `renderCourseImage(result): string`，返回完整 PNG data URI；`saveCourseImage(dataUri): Promise<void>`；`MiniToolCourseSheet`。

- [ ] **Step 1: 写 Canvas 渲染测试**

以可注入 canvas/context 工厂记录绘制操作，断言标题、四柱、三传、四课、12 宫全部进入绘制序列，并断言输出以 `data:image/png;base64,` 开头且解码估算不超过 1 MiB。

- [ ] **Step 2: 实现紧凑课式图绘制**

使用 720×1280 Canvas、系统中文字体、深青铜底与汝窑青/旧金文本。固定布局绘制摘要、四课三传和 4×4 十二宫方盘；不读取 DOM、不导入 `html-to-image`、不创建超过 1 MiB 的静态 Base64。

- [ ] **Step 3: 写 JSBridge 契约测试**

模拟 `window.xhs.miniTool`，断言先调用 `writeTempFile({ data: fullDataUri })`，再调用 `saveImageToPhotosAlbum({ filePath })`；缺少 bridge 时返回明确错误；不传未声明字段。

- [ ] **Step 4: 实现 JSBridge 适配器和类型**

严格定义并调用：

```ts
const { filePath } = await window.xhs.miniTool.writeTempFile({ data });
await window.xhs.miniTool.saveImageToPhotosAlbum({ filePath });
```

不得包含浏览器剪贴板、`a[download]`、`window.open` 或网络兜底。

- [ ] **Step 5: 实现文字课式组件**

渲染完整摘要、三传、四课和十二宫方盘。按钮由用户点击触发生成与保存；状态覆盖“正在生成”“已保存到相册”“保存失败，请检查相册权限”和“请在小工具容器内保存”。

### Task 5: Chrome 61 样式与最终单次流水线

**Files:**
- Create: `src/minitool/minitool.css`
- Create: `scripts/verify-minitool-artifact.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1–4 全部产物。
- Produces: `npm run verify:minitool` 单次最终流水线与 `artifacts/daliuren-minitool.zip`。

- [ ] **Step 1: 编写 Chrome 61 基线样式**

核心布局使用 Flex、基础 Grid、物理边距和 `grid-gap`。固定值先于增强值；安全区使用普通 padding 后覆盖 `var(--safe-area-inset-*, env(...))`。关键按钮始终可见；滚动容器包含 `-webkit-overflow-scrolling: touch`；不使用 Flex gap、`:has()`、container query 或现代颜色作为唯一实现。

- [ ] **Step 2: 实现最终产物核验器**

核验器读取构建目录和 ZIP，检查：允许后缀、根入口、禁止模式、JS 文件大小、ZIP 大小、地盘 JPEG 1024 边长、无 source map、无额外目录层、JSBridge 方法名、WebGL DPR/像素/预算声明与 context lost/visibility 处理。任何错误设置非零退出码。

- [ ] **Step 3: 添加单次最终流水线**

```json
"verify:minitool": "vitest run src/minitool && node --test scripts/validate-minitool.test.mjs && npm run build:minitool && npm run validate:minitool && python .codex/minitool-zip-builder/scripts/audit_artifact.py artifacts/daliuren-minitool && npm run package:minitool && python .codex/minitool-zip-builder/scripts/audit_artifact.py artifacts/daliuren-minitool.zip && node scripts/verify-minitool-artifact.mjs"
```

- [ ] **Step 4: 执行一次最终流水线**

Run: `npm run verify:minitool`

Expected: 所有单元测试通过；构建成功；静态门禁 0 errors；目录审计 PASS；ZIP 审计 PASS；最终核验器 PASS；生成 `artifacts/daliuren-minitool.zip`。

- [ ] **Step 5: 检查工作区与交付摘要**

记录 ZIP 字节数、文件清单、审计 warning/error 数、未实测项。不得宣称 Chrome 61 CSS、JSBridge、帧率或真机性能已通过；明确标记这些项目未实测。
