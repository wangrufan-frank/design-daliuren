# Daliuren Realistic Artifact Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按可独立验收的顺序交付大六壬三维器物资产、写实材质灯光和 WebGL 确定性推演。

**Architecture:** 工作拆为三份计划。第一份只建立 Blender 灰模、机构姿态和 GLB 资产契约；第二份在不改变契约的前提下完成高精度几何、PBR 材质、LOD 和博物馆灯光；第三份只消费已验证资产与六阶段快照，在 React 中实现 Three.js 场景、确定性时间轴、交互和降级。

**Tech Stack:** Blender 4.5.12 LTS、Blender Python 3.11、glTF/GLB 2.0、Node.js 20+、React 19、TypeScript 5.9、Three.js 0.185.1、Vitest、Playwright、glTF Transform 4.4.2

## Global Constraints

- 实施依据固定为 `docs/superpowers/specs/2026-08-17-daliuren-realistic-artifact-blueprint-design.md`。
- 三维场景不得重新计算历法、天地盘、四课、三传或天将。
- Blender 使用毫米语义、米制数值：`1 Blender unit = 1 meter`。
- 坐标固定为右手系：`+Z` 向上、`+Y` 向后、`-Y` 向前、`+X` 向右。
- 主座 `0.520 × 0.520 × 0.052 m`，天盘 `Ø 0.380 × 0.024 m`。
- 校时简上升 `0.012 m`；四课抽匣外移 `0.092 m`、读数片上升 `0.008 m`；三传前桥前移 `0.118 m`；天将升起 `0.007 m`。
- 固定历史铭文与动态功能铭文分离；动态值不得烘焙进共享 GLB。
- LOD0 不超过约 `300,000` 三角面；LOD2 不超过约 `80,000` 三角面。
- 任何三维失败都不得阻断现有规则审校与标准文字课式。
- 不增加综合断语、神煞、应期或新流派规则。

---

## Execution Order

1. [Blender 灰模与资产契约](2026-08-17-daliuren-blender-graybox.md)
   - 独立产物：可打开的 `.blend`、三档机构姿态、稳定节点清单、灰模 `.glb`、四张结构验收图。
   - 进入下一计划的门槛：尺寸、枢轴、节点、闭合/展开边界和 glTF 导出全部自动验证通过，并由用户确认灰模比例。

2. [高精度材质与博物馆灯光](2026-08-17-daliuren-artifact-lookdev.md)
   - 独立产物：高精度母版、固定铭文、五类 PBR 材质、LOD0/1/2 GLB、四类写实验收图和资产清单。
   - 进入下一计划的门槛：写实镜头确认、资产预算验证、GLB 节点契约未变化。

3. [WebGL 接入与确定性推演](2026-08-17-daliuren-webgl-runtime.md)
   - 独立产物：快照到展示状态映射、Three.js 场景、时间轴、动态铭文、交互、减少动态、加载失败回退和端到端测试。
   - 完成门槛：同一课例在规则快照、模型和文字课式逐项一致；时间轴可逆；现有全部测试继续通过。

## Cross-Plan Review Gates

- 计划一结束后只审结构，不以灰模材质判断最终质感。
- 计划二不得重命名计划一已经冻结的运行时节点；确需变化时先更新资产契约测试和本路线图。
- 计划三不得通过修改 GLB 节点来绕过映射错误；数据错误应在纯 TypeScript 映射层修复。
- 每份计划最后均运行其完整验证命令并形成单独提交，不跨计划混合提交。
