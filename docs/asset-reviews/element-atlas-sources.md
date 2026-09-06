# 元素图鉴首辑：知识与图像来源
核对日期：2026-09-06。正文为面向初学者的转述；不将艺术意象当成取象规则。

## 知识
- 子、亥：《六壬大全》卷二「十二神释」。电子本 https://ctext.org/wiki.pl?chapter=732070&if=en&remap=gb 。电子本存在 OCR 与访问限制，未整段搬入。阴阳用语可能因地支/支神语境不同，首辑只写二者属水。
- 贵人：项目 docs/superpowers/specs/2026-08-17-heavenly-generals-design.md 明确采用林烽口径。知识库《六壬-遁干与贵人》标注林烽《大六壬详解》第三章第二节，《六壬-十二贵神详解》标注第四章第二节。未编造版本页码。
- 天地盘：项目 docs/rule-cases/heaven-earth-v1.md 与知识库《六壬-月将加时排天盘》（林烽第二章第二、三节）。国博「铜地盘」 https://www.chnmuseum.cn/zp/zpml/csp/202008/t20200826_247426.shtml 仅用于历史背景，说明原天盘已佚。
- 旬空：《六壬大全》卷十二「旬内空亡逐类推第九六」 https://ctext.org/wiki.pl?chapter=973757&if=en ，以及项目六旬空亡规则。知识库《六壬-空亡系统论》标注林烽第五章第一节。
- 当前课式：直接读取已生成 CourseResult；不另算月将、贵人、旬空。
- 对照表的“大寒后/雨水后”描述本项目按中气换将的口径，不暗示所有术数体系共用。

## 开放馆藏图
Met API 对下列作品返回 isPublicDomain=true，图像 XMP 明确列出 CC0：
https://creativecommons.org/publicdomain/zero/1.0/
馆方开放使用说明：https://www.metmuseum.org/about-the-met/policies-and-documents/open-access

| 本地文件 | 作品与编号 | 机构页面 | 原图 |
|---|---|---|---|
| waterfall.jpg | 马远 Scholar viewing a waterfall（中文译名：高士观瀑图），南宋13世纪初，1973.120.9 | https://www.metmuseum.org/art/collection/search/40086 | https://images.metmuseum.org/CRDImages/as/original/DP154090.jpg |
| pines.jpg | 马麟 Landscape with great pine（中文展示名：松下高士图），南宋13世纪第二季度，47.18.63 | https://www.metmuseum.org/art/collection/search/36055 | https://images.metmuseum.org/CRDImages/as/original/DP153508.jpg |

处理：Sharp 缩至最大边1000像素、JPEG质量82，保留原作色彩；卡片 CSS 裁取局部；图片保存版完整等比展示。原始下载留在 output/atlas-originals，未打进产品包。画作中文名称为展示译名，以馆方英文编目及藏品编号识别。人物不宣称是天乙；水景不宣称专属于子或亥；天地盘卡的圆方结构是现代示意。
