# Task 1 Report

状态：DONE

## 改动摘要

- 新增 `src/domain/four-lessons/types.ts`，定义四课结果、证据、快照及阶段契约。
- 新增 `src/domain/four-lessons/policy.ts`，实现十天干寄宫映射、天地盘四次显式查宫及五步证据链。
- 新增 `src/domain/four-lessons/policy.test.ts`，覆盖寄宫全映射、辛酉参考链及重复课体仍保留四个位置。

## RED

命令：`npm test -- src/domain/four-lessons/policy.test.ts`

证据：失败，Vitest 报告无法解析 `./policy`，因为该模块尚不存在；测试套件未收集测试。

## GREEN

命令：`npm test -- src/domain/four-lessons/policy.test.ts`

证据：`1` 个测试文件通过，`3` 个测试通过，退出码 `0`。

## 自检

- `npm run build`：通过，TypeScript 编译及 Vite 构建成功；仅有既有产物体积提示。
- `npm test`：通过，`20` 个测试文件、`210` 个测试全部通过。
- `git diff --check`：通过，无空白错误。

## 提交哈希

见本报告对应提交。

## 关注点

实现按简报保留四次显式查宫；未新增守卫、阶段编排或 UI。构建仍提示 bundle 超过 500 kB，但与本任务无关。
