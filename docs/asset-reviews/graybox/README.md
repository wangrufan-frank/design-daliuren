# 大六壬机械主体灰模验收

本记录只验收机械主体的结构、展开关系与后续铭刻空间。当前使用统一中性灰材质与参考灯光，不代表最终材质质量；黄铜、木材、墨色、微表面细节与真实物件质感在 lookdev 阶段完成。

## 构建基线

- Blender：`4.5.12 LTS`，build hash `84afd5f785f7`
- GLB：`public/models/daliuren/daliuren-graybox.glb`
- GLB SHA-256：`5C8682F788CD1FFFAFD88DC5F20B9889622CA450BA7B307FBAD94FF99A520CC9`
- 渲染器：Eevee，`1920 × 1080`
- 参考灯光：4300K 近似主光、30% 补光、窄轮廓光
- 复核姿态：`closed`；`generals`（`plate_offset=5`，`general_direction=reverse`）

## 视图

| 文件 | 姿态 | 用途 |
| --- | --- | --- |
| `overall.png` | 左 `closed` / 右 `generals` | 闭合与完全展开的同图对照 |
| `oblique.png` | `generals` | 四课抽屉、十二将与天地盘层级 |
| `mechanism.png` | `generals` | 正面工程视角：三传桥架、左右课位滑轨与中央盘边缘间隙 |
| `top.png` | `generals` | 四课、三传、十二将与中心盘的完整平面关系 |

## 阶段结论

| 检查项 | 结论 | 观察 |
| --- | --- | --- |
| Silhouette | PASS | `closed` 状态的物理几何保持在方形底座包络内；分屏对照可清楚区分闭合与展开轮廓。 |
| Mechanism clearance | PASS | 正面工程视图同时显示三传桥架、左右课位滑轨和中央盘边缘，关键接缝均可辨且未见相互穿插；底座内部碰撞盒另由姿态测试覆盖。 |
| Component hierarchy | PASS | 顶视图可区分中央天地盘、四组双层课位、三枚传位和环形十二将；斜视图补充确认垂直层级。 |
| Inscription space | PASS | 天盘中央、历史固定环、四课读数面与三传模块均保留连续平面；审阅场景未嵌入动态课例文字。 |

结论：灰模结构验收通过，可进入 lookdev。最终 brass / wood / ink 材质、磨损、反射层次与成品级真实光影不在本阶段的通过范围内。
