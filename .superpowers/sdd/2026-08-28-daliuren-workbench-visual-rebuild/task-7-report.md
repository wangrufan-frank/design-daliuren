# Task 7 实施报告

## 结果

- 实现提交：`80f967a test: lock workbench visual acceptance`
- 修改范围：仅 `src/styles/global.css`、`src/features/course-workbench/course-workbench.css`、`src/features/artifact-scene/artifact-scene.css`、`e2e/app-shell.spec.ts`、`e2e/artifact-experience.spec.ts`。
- 未修改 `progress.md`、Task 4 相机值或 Task 5 注释布局算法。

## RED

1. 先更新两份 E2E，并让 `generateCourse` / `completeReferenceCourse` 在点击“生成完整课式”后等待 `三维阶段回看` 出现，确保确定性生成过渡结束后才断言工作台。
2. 计划命令 `npx playwright test e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts --project=chromium` 退出 `1`：当前 `playwright.config.ts` 没有命名 project，Playwright 报 `Project(s) "chromium" not found. Available projects: ""`。未越界修改配置，改用等价的 Chromium CLI 参数 `--browser=chromium` 执行实际验收。
3. RED：`npx playwright test e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts --browser=chromium`，`11 passed / 8 failed`，耗时 `3.8m`。目标失败包括：
   - 桌面生成后产品名 `x=1018.875`，说明文字 `x=38.390625`，产品名没有排在首位。
   - 阶段次要说明与动作绿均为 `rgb(84, 125, 112)`。
   - `390×844` 下舞台 computed `min-height=330px`，低于要求的 `463.2px`。
   - 其余失败暴露旧 E2E 尚未按 Task 3 的移动工具门户访问证据/时间轴，以及三次 GLB 重载超过默认 30 秒；仅修正测试操作路径和测试超时。

## GREEN 与验证

- 最终 targeted Chromium：`npx playwright test e2e/app-shell.spec.ts e2e/artifact-experience.spec.ts --browser=chromium` → `19 passed (2.1m)`。
- 三次 `三维推演 → 文字课式 → 三维推演` → `36.8s`，每次 canvas 与时间轴恢复，捕获的 `Multiple active KTX2 loaders` 警告为 `[]`。
- 独立审阅后补强桌面注释卡非空保护：`npx playwright test e2e/artifact-experience.spec.ts --browser=chromium --grep "mode controls stay outside"` → `1 passed (11.9s)`；随后再次完成上述 `19/19` targeted 验证。
- `npm test` → `55 passed` test files，`607 passed` tests，耗时 `28.04s`。
- `npm run build` → exit `0`；Vite 构建完成，仅保留既有的 `>500 kB` chunk 提醒。
- `git diff --check` → exit `0`，无空白错误。

## 自检

- 起课前后视觉顺序均以“大六壬演式”产品名为先；桌面保持左/中/右三栏，中央宽于两侧，阶段轨仍在右侧纵排。
- 课式模式工具栏改为舞台上方静态文档流；E2E 验证其在 viewport 上方、与 3–6 张可见注释卡均不相交，canvas 上下边界位于 stage frame 内。
- 移动舞台使用 `height: 60vh`、`min-height: max(360px, 55vh)`、`max-height: 65vh`。
- 移动 dock 保持 `position: sticky; bottom: 0`，安全区 padding 位于 dock 本体，背景为不透明 `var(--panel)`；桌面侧栏在移动断点隐藏。
- 次要文字统一使用由墨色 `color-mix` 派生的 `--muted-ink`，未复用主动作绿。
- `390×844` 首个工作台视口可达六阶段导航与五项工具；打开文字课式后两者仍在视口内，文字课式 footer 可通过 dock 面板访问。
- 未增加运行时接口、依赖或抽象；仅删除被新移动舞台最小高度策略取代的 `330px` selector，以及静态工具栏后失效的移动 `top` 声明。
- 独立只读审阅：无 Critical；修复 1 个 Important（桌面注释相交测试空集假绿）；剩余 Minor 仅为测试无法直接证明 CSS 使用 `color-mix`，运行时实现已满足且行为断言同时区分动作绿。
