# 大六壬器物主体灰模验收

本记录只验收器物主体的结构、承位关系与后续铭刻空间。当前使用统一中性灰材质与参考灯光，不代表最终材质质量；黄铜、木材、墨色、微表面细节与真实物件质感在 lookdev 阶段完成。

## 构建基线

- Blender：`4.5.12 LTS`，build hash `84afd5f785f7`
- GLB：`public/models/daliuren/daliuren-graybox.glb`
- GLB SHA-256：`7BC65531A138E017CA68AC12C5C6D5B1F7ECE9E29EEE607FFA1CB08687D28D82`
- 渲染器：Eevee，`1920 × 1080`
- 参考灯光：4300K 近似主光、30% 补光、窄轮廓光
- 复核姿态：`closed`；`generals`（`plate_offset=5`，`general_direction=reverse`）

## 视图

| 文件 | 姿态 | 用途 |
| --- | --- | --- |
| `overall.png` | 左 `closed` / 右 `generals` | 闭合与完全展开的同图对照；展开态显示逐枚落座的四课/三传薄签与十二将按钮 |
| `oblique.png` | `generals` | 天地盘、独立窄薄签、浅槽与十二将按钮的垂直层级 |
| `mechanism.png` | `generals` | 正面工程视角：逐枚薄签、独立浅槽与中央盘的真实接缝和间隙 |
| `top.png` | `generals` | 四课、三传、十二将与中心盘的完整平面关系，分支环无遮挡 |
| `stage-closed.png` | `closed` | 紧凑闭合基线 |
| `stage-calendar.png` | `calendar` | 后侧历签伸出承位的固定视角端点 |
| `stage-plate.png` | `plate` | 天盘转动 60°、字位相对地盘明显错开的固定视角端点 |
| `stage-lessons.png` | `lessons` | 四枚窄薄签分别落入左右四个浅槽 |
| `stage-transmissions.png` | `transmissions` | 初/中/末/法四枚窄薄签分别落入前侧浅槽 |
| `stage-generals.png` | `generals` | 十二将按钮加入后的完整展开态 |

## 阶段结论

| 检查项 | 结论 | 观察 |
| --- | --- | --- |
| Silhouette | PASS | `closed` 状态的物理几何保持在方形底座包络内；分屏对照可清楚区分闭合与展开轮廓。 |
| Mechanism clearance | PASS | 正面工程视图显示每枚薄签与其浅槽之间的真实接缝，关键间隙均可辨且未见穿插、共面闪烁或悬空构件。 |
| Component hierarchy | PASS | 顶视图可逐枚区分中央天地盘、四课薄签、三传薄签和环形十二将按钮；斜视图确认薄签窄、彼此独立且有真实厚度，不形成连续侧翼、前伸面板或导轨。 |
| Inscription space | PASS | 24 个功能分支字与暗槽完整留在盘内且互不重叠，天地盘环无遮挡；历史铭文只在 master/lookdev 中出现。 |
| Stage progression | PASS | 固定相机下可不依赖角标判别前三阶段：`closed` 无后侧长签，`calendar` 的历签清楚伸至后侧承位，`plate` 再以天盘字位相对地盘的 60°错位形成独立端点；其后四课、三传薄签及十二将按钮逐级加入，六阶段均不遮挡分支环。 |

结论：灰模结构验收通过，可进入 lookdev。最终 brass / wood / ink 材质、磨损、反射层次与成品级真实光影不在本阶段的通过范围内。
