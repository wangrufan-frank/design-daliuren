# 元素图鉴浏览优化

范围：分类、检索、列表与详情阅读排版。尚未发布。

- 分类显示总数；按名称及别名精确匹配、前缀匹配优先排序。
- 搜索支持清空；无结果可重置分类并查看全部。
- 缩小卡片配图与详情头图，让名称、释义和本课信息更靠前。
- 背景与出处默认折叠；返回列表保留分类、搜索、分页、滚动位置和卡片焦点。

验证：

- `ElementAtlas.test.tsx` 与 `CourseSheet.atlas.test.tsx`：10 项通过。
- `npm run build`：通过；保留既有的大包体积提示。
- 浏览器搜索“天盘”，首项为别名精确匹配的“天地盘”。
- 390px 窄屏：图鉴 clientWidth 与 scrollWidth 均为 390px，清空按钮位于输入框内。
- 无结果点击“查看全部”后，分类恢复“全部 96”。
- 桌面直接点击“寅 · 功曹”并返回，scrollTop 从 720 恢复到 720，焦点恢复到该卡片。
- 自动化定位器点击会先调整滚动位置，因此返回位置采用直接点击验证。

本地截图：`output/atlas-browser-review/index-desktop.png`、`output/atlas-browser-review/detail-desktop.png`（主工作区）。
