# 大六壬机械主体灰模验收

本记录只验收机械主体的结构、展开关系与后续铭刻空间。当前使用统一中性灰材质与参考灯光，不代表最终材质质量；黄铜、木材、墨色、微表面细节与真实物件质感在 lookdev 阶段完成。

## 构建基线

- Blender：`4.5.12 LTS`，build hash `84afd5f785f7`
- GLB：`public/models/daliuren/daliuren-graybox.glb`
- GLB SHA-256：`D133B083A229DE75F40BD37F8FE3F3AEF6C1DF4F6613B9A0C886FE2AFB73D018`
- 渲染器：Eevee，`1920 × 1080`
- 参考灯光：4300K 近似主光、30% 补光、窄轮廓光
- 复核姿态：`closed`；`generals`（`plate_offset=5`，`general_direction=reverse`）

## 视图

| 文件 | 姿态 | 用途 |
| --- | --- | --- |
| `overall.png` | 左 `closed` / 右 `generals` | 闭合与完全展开的同图对照；展开态显示四侧物理面板与十二将按钮 |
| `oblique.png` | `generals` | 天地盘、四课面板、三传面板与十二将按钮的垂直层级 |
| `mechanism.png` | `generals` | 正面工程视角：四侧面板、三传面板与中央盘的真实接缝和间隙 |
| `top.png` | `generals` | 四课、三传、十二将与中心盘的完整平面关系，分支环无遮挡 |
| `stage-closed.png` | `closed` | 紧凑闭合基线 |
| `stage-calendar.png` | `calendar` | 历法事实阶段的固定视角端点 |
| `stage-plate.png` | `plate` | 天地盘加临阶段的固定视角端点 |
| `stage-lessons.png` | `lessons` | 左右四课面板展开 |
| `stage-transmissions.png` | `transmissions` | 三传面板加入展开关系 |
| `stage-generals.png` | `generals` | 十二将按钮加入后的完整展开态 |

## 阶段结论

| 检查项 | 结论 | 观察 |
| --- | --- | --- |
| Silhouette | PASS | `closed` 状态的物理几何保持在方形底座包络内；分屏对照可清楚区分闭合与展开轮廓。 |
| Mechanism clearance | PASS | 正面工程视图显示四侧面板、三传面板、十二将按钮与中央盘的真实接缝，关键间隙均可辨且未见穿插、共面闪烁或悬空构件。 |
| Component hierarchy | PASS | 顶视图可区分中央天地盘、四课面板、三传面板和环形十二将按钮；斜视图补充确认垂直层级，不含旧式翼板、桥架、滑轨或升柱。 |
| Inscription space | PASS | 24 个功能分支字与暗槽完整留在盘内且互不重叠，天地盘环无遮挡；历史铭文只在 master/lookdev 中出现。 |
| Stage progression | PASS | `closed`、`calendar`、`plate` 保持固定相机下的细微端点变化；`lessons`、`transmissions`、`generals` 依次展开面板与按钮，六阶段没有遮挡分支环。 |

结论：灰模结构验收通过，可进入 lookdev。最终 brass / wood / ink 材质、磨损、反射层次与成品级真实光影不在本阶段的通过范围内。
