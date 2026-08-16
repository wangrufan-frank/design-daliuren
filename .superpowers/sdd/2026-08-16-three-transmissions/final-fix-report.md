# 三传取法 Final Fix 报告

## 范围与基线

- 工作树：`E:/design daliuren/.worktrees/three-transmissions`
- 分支：`codex/three-transmissions`
- 修复前提交：`3149e7b feat: integrate three transmissions flow`
- 依据：`final-fix-brief.md`、设计规格与实现计划；未改动明确留待用户裁决的移动端 header/transmission 顺序。
- 方法：按 finding 分组编写 focused 失败测试，再做最小实现使其通过；未增加包、通用规则引擎、手工改传或审批控制。

## Finding → 修改 → 测试

### 1. 重审不可达

- 根因：`findVerticalCandidates` 选出下克上优先类别后，丢失了同时存在的上克下候选；后续仅凭优先数组长度把唯一候选固定标为始入。
- 修改：`VerticalCandidatesResult` 同时保留完整的下克上、上克下与优先候选；普通课、伏吟、反吟统一调用 `selectVerticalInitial`。唯一优先下克上且同时存在上克下时定为贼克/重审。
- 测试：新增甲子日、丑将加子完整 policy 回归，断言贼克/重审、辰巳午，并断言证据同时列出两类候选及“按下克上优先”。

### 2. 下克上比用误标知一

- 根因：比较法只要筛到唯一候选就无条件写入知一，未区分上下克方向。
- 修改：比较选中后仅上克下候选附加知一；下克上仍为比用但不附加知一。共享选择器使普通课、伏吟、反吟执行同一规则。
- 测试：新增候选并非数组首项的普通课、伏吟、反吟回归；断言实际选中寅、比较证据明确“唯一比用上神为寅”，普通课/反吟无知一，伏吟仍使用其专属不虞细格。

### 3. 缀瑕/复等过宽

- 根因：涉害完全同深时按任意阳日一课、阴日三课兜底，超出唯一核准书例。
- 修改：`selectBySheHai` 接收完整日柱，仅允许戊辰日且最深候选中一课上神为子时返回缀瑕/复等；其他完全平局保持 unresolved，不按数组顺序兜底。
- 测试：保留戊辰/一课上神子正例；新增非戊辰完全平局反例；将原反吟中不符合“一课上神子”的旧夹具改为 unresolved 回归。

### 4. 证据契约不完整

- 根因：课体去重证据可能被垂直候选早退跳过，关系/涉害/六亲仅保留展示字符串或不完整结构，运行时 guard 只验证非空 `ruleId` 且忽略嵌套详情。
- 修改：
  - 在任何垂直候选早退前固定生成四条 `lesson-identity` 与四条 `lesson-relation` 结构化详情；记录真实上下值、五行、双向克与取舍结论。
  - `shehai-palace` 记录候选上神、当前克向、宫支/五行/是否计害、每个寄干/五行/是否计害、增量及累计。
  - 三传各生成一条 `six-relation`，记录日干/五行、传支/五行、关系方向及六亲。
  - `types.ts` 改为判别联合；UI 仅按 `shehai-palace` 判别后渲染全部涉害字段。
  - `isThreeTransmissionsResult` 使用精确 rule ID 白名单并逐判别项校验嵌套字段、枚举与元素映射，同时重算上下克、取舍结论、寄干和计害贡献、精确累计，绑定 rule/phase/transmission/details 组合，并校验证据 ID 唯一、传位引用闭合非空、必需 phase 完整；`matchesThreeTransmissionsInputs` 继续执行 canonical 深重算。
- 测试：完整 policy 契约断言 8 个 phase、4 条课关系、3 条六亲、唯一 ID、闭合引用和两次推导逐字节相同；直接对 guard 注入伪造 rule ID 及四类畸形详情；UI 断言候选上神/方向、支和寄干五行与逐项计害、增量和累计。

### 5. Stage runner 不要求真实传递上游

- 根因：runner 只读取天地盘与四课，并把 `dependsOn` 字符串当作日历存在性；移除或伪造当前 calendar 后仍能成功生成三传。
- 修改：runner 分层验证当前 calendar 快照、天地盘与该 calendar 的生效月将/占时一致性、四课与同一个 calendar/天地盘的来源及 canonical 输入一致性。按最早失效阶段调用 `invalidateFrom`：calendar 无效则清空；天地盘不匹配则仅保留 calendar；四课不匹配则保留 calendar 与天地盘。`computeThreeTransmissions` 仍只接受直接天地盘/四课输入。
- 测试：新增缺 calendar、伪造 calendar、plate/calendar 不一致、四课不一致四组 stage 回归；每个失败结果都断言未添加三传、只保留有效上游，并断言 `validateSession(outcome.session)` 为空。

### 6. 八专书例缺完整 policy 回归

- 修改：新增甲寅日、丑将加辰完整 policy 用例；先断言非伏吟/反吟且无上下克，再经公开 policy 推导八专丑亥亥；断言八专前没有遥克选择证据。
- 文档：规则案例表指针更新到该精确测试，不再用直接 special-method 或无关日柱作为证明。

### 附加测试债务

- `foundations.test.ts`：补齐天地盘地支/天支查找的缺失与重复四种错误。
- `ThreeTransmissionsReview.test.tsx`：补充初始证据面板未点传位即关闭时，焦点回到初传按钮。
- 三个传位按钮保留 `aria-pressed`，新增与当前 disclosure 状态一致的 `aria-expanded`。

## Focused RED → GREEN 证据

1. 垂直候选、重审、比用方向
   - RED：`npm test -- src/domain/three-transmissions/selectors.test.ts src/domain/three-transmissions/policy.test.ts src/domain/three-transmissions/special-plates.test.ts`
   - 结果：4 failed / 45 passed；分别暴露类别数组缺失、始入而非重审、普通课误标知一、反吟误标知一。
   - GREEN：同命令 3 files / 49 tests passed。
2. 缀瑕/复等边界
   - RED：`npm test -- src/domain/three-transmissions/selectors.test.ts src/domain/three-transmissions/special-plates.test.ts`
   - 结果：2 failed / 30 passed；新 API 下正例先 unresolved，非规范反吟未抛错。
   - GREEN：并入上述 focused 组后 3 files / 49 tests passed。
3. 结构化证据
   - RED：`npm test -- src/domain/three-transmissions/selectors.test.ts src/domain/three-transmissions/policy.test.ts`
   - 结果：2 failed / 29 passed；涉害寄干详情缺失、完整 evidence 缺 lessons phase。
   - GREEN：并入垂直候选组后 3 files / 49 tests passed。
4. Review UI
   - RED：`npm test -- src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx`
   - 结果：4 failed / 1 passed；暴露联合详情误当涉害导致崩溃、缺 `aria-expanded`、缺富涉害字段与初始关闭焦点契约。
   - GREEN：1 file / 5 tests passed。
5. Runtime guard
   - RED：`npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts`
   - 结果：5 failed / 15 passed；伪 rule ID 与四种畸形嵌套详情均错误通过。
   - 首轮 GREEN：1 file / 20 tests passed；加入 stage 用例后为 23 passed。
   - 终审补充 RED：`npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts src/domain/three-transmissions/special-plates.test.ts`，3 个预期 guard 失败稳定复现“字段存在但值错误”：翻转上下克布尔、涉害累计改为 999、把 plate step 换成合法但错位的昴星 rule ID。该轮另有 1 个测试写法失败：`objectContaining({ subtype: undefined })` 不能匹配有意省略的属性；在改生产代码前先改为直接断言 `not.toHaveProperty("subtype")`。
   - 最终 GREEN：同命令 2 files / 44 tests passed。Guard 现从共享五行基础函数重算克制，按实际寄宫校验寄干和每项贡献，逐候选精确累计，并用显式 switch 约束 rule placement。
6. 传递上游 stage
   - RED：`npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts`
   - 结果：4 failed / 19 passed；坏四课被保留、缺失/伪造 calendar 错误成功、plate 不匹配时保留过多下游。
   - GREEN：`npm test -- src/domain/three-transmissions/compute-three-transmissions.test.ts src/domain/chart/snapshots.test.ts`，2 files / 49 tests passed。
7. 额外债务与八专书例
   - foundations 四个错误查找测试在现有纯函数边界上首次即通过，作为既有错误契约的 characterization tests。
   - 八专测试最初把“不会扫描遥克”误写成“独立遥克选择器无候选”；focused 运行证明该夹具独立扫描确有候选。按 brief 的 policy 顺序语义修正为断言最终证据中不存在遥克扫描，未改动生产逻辑。
   - `npm test -- src/domain/three-transmissions/foundations.test.ts src/domain/three-transmissions/policy.test.ts src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx` 最终 3 files / 33 tests passed。

## 最终验证

按 brief 指定顺序执行：

- `npm test`：28 test files passed，339 tests passed，0 failed（约 20.43s）。
- `npm run build`：成功；TypeScript 与 Vite 构建通过，60 modules transformed。仅有现存的单 bundle 大于 500 kB 提示。
- `npm run test:e2e`：16 passed，0 failed（约 5.4s）。仅有 `NO_COLOR`/`FORCE_COLOR` 环境提示。
- `git diff --check`：通过，无空白错误；PowerShell/Git 仅提示工作副本 LF 将按配置转为 CRLF。
- `git status --short`：实现提交前仅列出下述 15 个 brief 直接相关的已修改文件；最终提交后为空。

## 修改文件

- `docs/rule-cases/three-transmissions-v1.md`
- `src/domain/three-transmissions/compute-three-transmissions.test.ts`
- `src/domain/three-transmissions/compute-three-transmissions.ts`
- `src/domain/three-transmissions/foundations.test.ts`
- `src/domain/three-transmissions/foundations.ts`
- `src/domain/three-transmissions/policy.test.ts`
- `src/domain/three-transmissions/policy.ts`
- `src/domain/three-transmissions/result-guard.ts`
- `src/domain/three-transmissions/selectors.test.ts`
- `src/domain/three-transmissions/selectors.ts`
- `src/domain/three-transmissions/special-methods.ts`
- `src/domain/three-transmissions/special-plates.test.ts`
- `src/domain/three-transmissions/types.ts`
- `src/features/three-transmissions-review/ThreeTransmissionsReview.test.tsx`
- `src/features/three-transmissions-review/ThreeTransmissionsReview.tsx`
- `.superpowers/sdd/2026-08-16-three-transmissions/final-fix-report.md`（本报告；目录被 `.gitignore` 忽略，使用显式 force-add 提交）

## 提交

- 实现提交：`ef6f483d0251301fcb26d1237f3110c71168a041 fix: close three transmissions final review`
- 报告提交：本文件必须先记录实现提交，故报告随后一笔 intentional docs commit 提交；其哈希见最终交付消息。

## Self-review 与 concerns

- 领域边界：证据保持具体判别联合与纯函数校验；未引入通用规则引擎。三传 snapshot 仍只声明直接依赖天地盘与四课，传递一致性只在 stage runner 检查。
- 范围：未触碰移动端 header/transmission 排序；未改布局 CSS；未添加依赖或无关重构。
- 一致性：普通课/伏吟/反吟共享垂直选取，避免再次出现细格分歧；stage 的失败 session 都通过 `validateSession`。
- 已知非阻塞提示：生产 bundle 大小提示与 Playwright 颜色环境提示均不影响构建/测试；`git diff --check` 的 LF→CRLF 信息是当前 Git 工作副本配置提示，不是空白错误。
- 无未解决的语义冲突。八专夹具中“独立遥克选择器会找到候选”与“policy 必须在八专分支前不扫描遥克”是顺序语义差异，测试已按 brief 明确要求覆盖后者。
