# Task Phase 8：无障碍(a11y)全面化 + 详情抽屉焦点陷阱

> Phase 1-7 全部功能须保留不回归。本阶段不加新功能，专做**可访问性**：详情抽屉的对话框语义与焦点管理、tab 的 tablist 语义与方向键、表格/动态区的语义、skip link、全站 focus-visible 与深浅主题对比度。

## Goal
让全站键盘与读屏可用：详情抽屉成为规范 modal dialog（焦点移入/陷阱/还原）、导航 tab 成为规范 tablist（方向键切换）、数据表有正确语义、动态结果有 aria-live、提供 skip link，焦点样式全站统一。

## Context（现状）
- 纯静态零构建 SPA，type=module。`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme}.js` + `styles.css`。
- 详情抽屉：`#detailDrawer`（含 `#drawerScrim`、`#closeDrawer`、`#detailContent`），`openDetail`→`openDetailPanel`(加 `.is-open`、`aria-hidden=false`)，`closeDetail`/`closeDetailPanel`，Esc/scrim/关闭按钮已绑 `closeDetail`。详情标题渲染为 `#detailTitle`(在 detailContent 内)。
- 导航：`.view-tab[data-view]` 按钮 + `.view` section（id=`${view}View`），`switchView` 切 `.is-active`。
- 表格：战绩英雄表、对比表（`.compare-table`，已有 `th[scope=row]`）、Meta 等用 `<table>` 或网格。
- 主题：`[data-theme]` 两套 token，`--primary/--win/--loss/--good/--warn` 等。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库；不破坏现有 id/class/data-* hook 与功能。

## Requirements
1. **详情抽屉 = modal dialog**：
   - `#detailDrawer` 容器（或其内部面板）加 `role="dialog"` `aria-modal="true"` `aria-labelledby="detailTitle"`（确保 `#detailTitle` 在每次 renderDetail 都存在并先渲染）。
   - 打开时把焦点移到抽屉内（关闭按钮或标题）；记录打开前的触发元素，关闭后**焦点还原**到它（英雄卡/战绩行等）。
   - **焦点陷阱**：抽屉打开时 Tab/Shift+Tab 在抽屉内可聚焦元素间循环，不跑到背景。Esc 关闭（已支持，确认仍工作）。
   - 抽屉关闭时其内容不可被 Tab 聚焦（`.is-open` 才可交互；可用 `inert` 或在关闭时不在 DOM 焦点序列）。背景在抽屉打开时建议 `inert`/`aria-hidden`（若用 aria-hidden 注意不要把抽屉自己也藏了）。
2. **导航 tablist**：
   - tab 容器 `role="tablist"`，每个 `.view-tab` `role="tab"` + `aria-selected`（激活 true）+ `aria-controls` 指向对应 `${view}View`，`tabindex` 用 roving（激活项 0 其余 -1）。
   - 每个 `.view` section `role="tabpanel"` + `aria-labelledby` 指向对应 tab；非激活 panel 不阻断（现有 `.is-active` 控制显隐保留）。
   - 方向键 ←/→ 在 tab 间移动焦点并切换视图，Home/End 跳首尾。保持现有点击切换与 hash 路由不变。
3. **数据表语义**：给战绩英雄表、对比表、Meta 表加 `<caption>`（可视觉隐藏 `.sr-only`）；表头 `th` 带 `scope`；可排序列表头加 `aria-sort`（战绩表按当前 `state.heroSort` 设 ascending/descending/none）。
4. **动态区 aria-live**：克制计算结果、战绩搜索结果/状态、加载与错误态容器加 `aria-live="polite"`（错误态可 `assertive`），让结果变化被读屏播报。
5. **Skip link**：页面顶部加「跳到主内容」链接（聚焦才显示），指向主内容容器（给主内容加 id 如 `#main`）。
6. **focus-visible 全站统一**：所有可聚焦控件（tab、卡片、按钮、pill、输入、表格内按钮、抽屉控件）有清晰 `:focus-visible` 轮廓（`--primary`，深浅主题都可见）。补 `.sr-only` 工具类。
7. **对比度**：检查并（必要时微调 token 或文字色）使正文/次要文字、tier 徽章、胜率蓝红、pill 在浅色与深色主题下达 WCAG AA（正文 4.5:1，大字/UI 3:1）。改动只动 token 或局部色，不破坏视觉风格。

## Constraints
- 不改现有 JS 函数对外签名与数据流；可追加 a11y 相关属性设置与事件（焦点陷阱、roving tabindex、方向键）。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外）。不引框架/构建/库。
- 0 innerHTML 注入数据。复用现有 token，新增 class（如 `.sr-only`、skip-link）。
- Phase 1-7 全部功能与交互（路由/收藏/对比/overlay/筛选/详情/克制/战绩/地图/Meta/更新/推荐器）不回归。
- overlay 模式（`?overlay=1`）不被破坏；overlay 下无 topbar，skip link/tablist 不应报错。

## Implementation Plan（建议）
1. 抽屉：renderDetail 确保 `#detailTitle` 先渲染；openDetailPanel 记录 `document.activeElement`、移焦点、设 dialog 语义、背景 inert；closeDetailPanel 还原焦点、解除 inert；加 Tab 陷阱处理（keydown 内首尾元素环绕）。
2. tablist：bindEvents/初始化里给 tab 与 panel 设 role/aria/roving tabindex；加方向键 keydown 处理；switchView 末尾同步 `aria-selected`/roving tabindex。
3. 表格 caption/scope/aria-sort；动态容器 aria-live；skip link + `#main`；`.sr-only` 与 `:focus-visible` 样式；对比度微调。
4. 自测（无头 Chrome + 可用的 a11y 检查）：见验收。更新 README、`.ai/HANDOFF.md`。

## Acceptance Criteria
- 详情抽屉：打开焦点入抽屉、Tab 循环不漏到背景、Esc/关闭后焦点回到触发元素；抽屉有 `role=dialog`/`aria-modal`/`aria-labelledby`；关闭时内容不可 Tab 到。
- 导航：tab 有 tablist/tab/tabpanel 语义与 `aria-selected`；←/→/Home/End 键可切 tab；点击与 hash 路由仍正常。
- 战绩/对比/Meta 表有 caption 与 scope；战绩可排序列有 `aria-sort` 且随排序更新。
- 克制结果、战绩结果/状态、错误态有 aria-live。
- 有可聚焦显示的 skip link 跳到主内容。
- 全站控件 `:focus-visible` 清晰可见（深浅主题）；关键文字/徽章对比度达 AA。
- Phase 1-7 全功能不回归；`node --check` 全过；console 无报错；375px 无横向溢出；全项目仍 0 innerHTML 注入数据；`?overlay=1` 正常。

## Review Focus（Codex 自查）
- 焦点陷阱是否真锁住（含只有 1 个可聚焦元素、动态内容变化后的边界）；关闭后焦点还原是否对（深链直接打开详情时触发元素可能不存在→回退到合理焦点如关闭按钮或 body）。
- `aria-hidden`/`inert` 别把抽屉自身或可聚焦元素错误隐藏；overlay 模式不冲突。
- roving tabindex 与方向键不破坏点击/路由；switchView 各入口（点击/路由/深链）都同步 aria-selected。
- aria-live 容器不要因频繁重渲染导致刷屏播报。
- 对比度调整不跑偏 OP.GG 视觉风格。
