# Element Atlas Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development; execute the tasks in this session.

**Goal:** 两端可用的五张有出处的元素图文卡片与图鉴。

**Architecture:** 共享 features/element-atlas 负责数据、当前课式摘要、Provider/阅读层和文字触发器；现有两端只接入 Provider 与入口。模型通过可选点击回调传递语义节点，不改变计算。

**Tech Stack:** React / TypeScript / CSS，已有 Canvas 与 Three.js，离线 JPEG。

**Spec:** docs/superpowers/specs/2026-09-06-element-atlas-design.md

## Global Constraints
- 小工具不联网，ES2017 / Chrome 61，ZIP 不超过 10 MiB。
- 所有编辑限于卡片、必要接入、资产和验证；不修改排盘与几何规则。
- 已批准的交互设计直接实施，不重复询问批准。

## Task 1: 知识与资产
- [x] 核对五项来源，正文分清史实、传统解释与现代辅助意象。
- [x] 创建 `src/features/element-atlas/entries.ts`，导出 `AtlasId = "zi" | "hai" | "noble" | "plates" | "void"` 与五个条目。
- [x] 本地 JPEG 与 `docs/asset-reviews/element-atlas-sources.md` 记录下载来源及授权。

## Task 2: 共享卡片与行为测试
- [x] 创建 `ElementAtlas.test.tsx`，先验证入口打开、Escape 关闭、焦点恢复、子亥对照、未知条目不生成按钮、更新课式后摘要变化。
- [x] 运行 `npm test -- src/features/element-atlas/ElementAtlas.test.tsx` 验证缺少功能。
- [x] 实现 `ElementAtlasProvider({children,course?:CourseResult})`、`AtlasLauncher()`、`AtlasTerm({value:string,children?:ReactNode})`、`useElementAtlas():{open(id:AtlasId):void}`。无 Provider 时 AtlasTerm 只呈现文本；未知值保持文本。
- [x] 卡片按条目渲染分层内容、对照、来源、当前课式与关闭；保持模型挂载。CSS 全部 atlas 前缀。
- [x] 同一专项测试验证通过。

## Task 3: 两端接入
- [x] App 的初始入口和 CourseExperience 结果页、小工具 MiniToolApp 接入 Provider/Launcher。
- [x] 两端文字课式为子亥、贵人、天地盘、旬空接入 AtlasTerm。
- [x] 模型点击通过可选回调映射受支持节点，滑动超过 6px 或多指不打开；新增行为测试。
- [x] 小工具构建复制 `src/features/element-atlas/assets/*.jpg` 到 `assets/atlas/`；网站使用同一文件与相对路径。

## Task 4: 交付验证
- [x] 单元测试、两端 TypeScript/构建、小工具目录/ZIP 审计。
- [x] 运行一次最终浏览器检查：起课前图鉴、单卡、对照、关闭、起课后本课信息、文字元素入口，桌面/手机截图与资源状态。
- [x] 审阅全部变更，修复实质问题后提交到隔离分支，交付预览与 ZIP，注明未发布及真机边界。

## 执行说明
知识与资产由只读资料代理核对，Canvas 导出及两端接入由独立实现代理完成，父代理实现共享阅读层与构建接入；独立审阅修正了计数用语、旧浏览器间距与保存后的键盘关闭问题。详细验证及既存失败见 docs/asset-reviews/element-atlas-validation.md。
