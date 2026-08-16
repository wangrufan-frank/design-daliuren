# 三传 v1 已审阅规则案例

## 书例来源

本节四行的规范来源均为用户提供的林烽《大六壬详解》第三章第一节“九宗门”页面。表内只记录为自动回归所需而规范化的输入与结果；测试指针给出当前 Vitest 用例名称，不把下节的构造数据视作原书引文或书例。

| 课例 | 日柱 | 月将加占时 | 预期 | Vitest 测试指针 |
| --- | --- | --- | --- | --- |
| 贼克始入 | 戊戌 | 子加戌 | 子、寅、辰 | [`deriveThreeTransmissions > derives the Lin Feng 始入 case`](../../src/domain/three-transmissions/policy.test.ts#L66) |
| 贼克元首 | 戊申 | 卯加辰 | 卯、寅、丑 | [`deriveThreeTransmissions > derives the Lin Feng 元首 case`](../../src/domain/three-transmissions/policy.test.ts#L66) |
| 涉害 | 庚子 | 申加戌 | 午、辰、寅；午四重、戌二重 | [`deriveThreeTransmissions > derives the Lin Feng 涉害克数胜出 case`](../../src/domain/three-transmissions/policy.test.ts#L66)、[`selectBySheHai > counts branches and resident stems while returning each traversed palace`](../../src/domain/three-transmissions/selectors.test.ts#L78) |
| 八专 | 甲寅 | 丑加辰 | 丑、亥、亥 | [`deriveThreeTransmissions > derives the Lin Feng Eight Special book case through full policy`](../../src/domain/three-transmissions/policy.test.ts#L169) |

## 合成规则夹具

以下各行是为了逐条审计九宗门分支而构造的最小测试夹具，不是林烽书页中的原话、完整课例或引文。它们与上表书例分开记录，预期只描述代码测试所锁定的规则行为。

| 规则夹具 | 合成输入 | 预期 | Vitest 测试指针 |
| --- | --- | --- | --- |
| 比用筛选 | 丙日；候选子、未、酉 | 同阴阳唯一取子 | [`selectByComparison > keeps the only candidate whose polarity matches the day stem`](../../src/domain/three-transmissions/selectors.test.ts#L47) |
| 涉害孟仲 | 庚日；相等候选分别加孟、仲 | 见机、察微 | [`selectBySheHai > resolves a real equal depth through the sole Meng palace`](../../src/domain/three-transmissions/selectors.test.ts#L95)、[`selectBySheHai > resolves a real equal depth through the sole Zhong palace when there is no Meng`](../../src/domain/three-transmissions/selectors.test.ts#L109) |
| 遥克蒿矢 | 壬日；二至四课上神戌、戌、午，一课上神辰 | 去重并排除一课，只以戌发用 | [`findRemoteCandidates > checks only unique upper gods from lessons two through four`](../../src/domain/three-transmissions/selectors.test.ts#L153) |
| 昴星 | 完整四课；无克无遥 | 阳虎视、阴冬蛇掩目 | [`special ordinary methods > derives both yin and yang Mao Star order`](../../src/domain/three-transmissions/policy.test.ts#L258) |
| 别责 | 三课不备；无克无遥 | 阳取合干上神、阴取三合前支 | [`special ordinary methods > uses the combined stem residence for yang Separate Responsibility`](../../src/domain/three-transmissions/policy.test.ts#L270)、[`special ordinary methods > uses the next trine branch for yin Separate Responsibility`](../../src/domain/three-transmissions/policy.test.ts#L277) |
| 伏吟 | 天地盘同位 | 不虞、自任、自信、杜传 | [`Fu Yin transmissions > uses punishment transmissions for Fu Yin with vertical overcoming`](../../src/domain/three-transmissions/special-plates.test.ts#L103)、[`Fu Yin transmissions > uses Self-Reliance and Self-Confidence when Fu Yin has no overcoming`](../../src/domain/three-transmissions/special-plates.test.ts#L115)、[`Fu Yin transmissions > switches the middle source and clashes the final after repeated self-punishment`](../../src/domain/three-transmissions/special-plates.test.ts#L124) |
| 反吟 | 天地盘正冲 | 有克递取、无克井栏 | [`Fan Yin transmissions > uses vertical selection and ordinary heaven lookup when Fan Yin has overcoming`](../../src/domain/three-transmissions/special-plates.test.ts#L159)、[`Fan Yin transmissions > uses Well-Railing for the no-overcoming Fan Yin day %s`](../../src/domain/three-transmissions/special-plates.test.ts#L176) |

九种主课格的审计覆盖为：贼克、比用、涉害、遥克、昴星、别责、八专、伏吟、反吟。伏吟与反吟的优先分派另由 `special plate classification and dispatch` 测试组独立锁定。
