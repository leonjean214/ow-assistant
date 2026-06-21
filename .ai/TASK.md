# Task Phase 24：移动端 / 响应式体验打磨（质量，非新功能）

> Phase 1-23 全部功能须保留不回归。本阶段不加功能，专做移动端/响应式打磨：导航（已 14+ tab）更好用、触控目标够大、逐视图 375px 复查并修横向溢出/拥挤。纯前端、0 innerHTML、零构建。

## Context（务必遵守）
- 纯静态零构建 SPA。导航 `.view-tabs`(role=tablist) 含 14+ 个 `.view-tab`，已 `overflow-x:auto` 横滑。视图：heroes/compare/me/team/workshop/matrix/updates/counter/profile/journal/maps/meta/ban/settings 等。
- 已有响应式断点(920/768/375)。命令面板(Cmd/Ctrl-K)已可跳转(导航补充)。
- 硬约束：0 innerHTML 注入；不引框架/库；**不破坏任何现有功能/交互/id/class/data-* hook**；overlay/路由不受影响。纯 CSS + 极小 JS（如 active tab scrollIntoView）。

## Requirements
1. **导航可用性（移动端）**：
   - 切换视图后，**当前激活 tab 自动 scrollIntoView**（横向居中或可见），让用户在窄屏知道自己在哪、不丢失。`switchView`/`syncNavigationA11y` 末尾对激活 tab 调 `scrollIntoView({inline:"center", block:"nearest"})`（仅横向，不要让页面纵向跳动；可加 behavior 平滑）。
   - tab 条左右可加**渐隐边缘提示**（CSS mask/渐变）暗示可横滑（纯 CSS，不挡点击）。
2. **触控目标**：移动端(≤768px)关键可点元素(tab、pill、按钮、表格行、卡片三角标 ★/对比/入队)最小可点区域 ≥ 40px（用 padding/min-height，不破坏视觉）；英雄卡三角标在 375px 不重叠头像/内容。
3. **逐视图 375px 复查**：heroes(卡片+列表)、compare 表、team、matrix、journal(表单+表+分享图按钮)、workshop、me、settings、counter、profile(战绩表)、maps、meta、ban、命令面板 —— 每个在 375px 宽下**无页面横向溢出**(`scrollWidth===clientWidth`)、内容不拥挤、表格用容器横向滚动而非撑破页面。发现问题就修对应 CSS。
4. **不回归**：所有功能/交互照常；仅 CSS + 必要的 scrollIntoView 小改。

## Constraints
- 不改现有 JS 对外签名/数据流；JS 仅允许加「激活 tab scrollIntoView」这类极小增强。主体是 styles.css。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。复用 token，深浅主题协调。
- Phase 1-23 全功能不回归；overlay(`?overlay=1`)不受影响。
- 不需新 sw 缓存项。

## Implementation Plan（建议）
1. `.view-tabs` 边缘渐隐(CSS mask-image 或 ::before/::after 渐变)；active tab scrollIntoView(switchView 或 syncNavigationA11y 末尾)。
2. 触控目标：≤768px 给 tab/pill/小按钮 min-height/padding；复查三角标 375px 布局(必要时缩小或重排)。
3. 逐视图 375px 审查 + 修溢出/拥挤(表格容器 overflow-x:auto、grid 降列、字号/间距)。
4. 自测(无头 Chrome + tools/qa.mjs)：对每个视图在 375px 断言 `scrollWidth===clientWidth`；切 tab 后 active tab 在可视区；现有 qa 全绿。更新 README(简述移动端打磨)、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 切视图后激活 tab 自动滚入可见区；tab 条有可横滑的视觉暗示。
- ≤768px 关键可点元素触控区 ≥40px；英雄卡三角标 375px 不重叠。
- 全部视图(含命令面板)在 375px 无页面横向溢出、不拥挤；表格横向滚动不撑破页面。
- Phase 1-23 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（可加每视图 375px 溢出断言）。

## Review Focus（Codex 自查）
- scrollIntoView 只横向、不致页面纵向跳动；不破坏键盘/路由。
- 边缘渐隐不挡 tab 点击。
- 触控 padding 不破坏桌面视觉/不致新的溢出。
- 各视图 375px 实测 `scrollWidth===clientWidth`（逐个验，含 compare/profile/journal 表格、matrix、命令面板）。
- 0 innerHTML；overlay/路由不受影响。
