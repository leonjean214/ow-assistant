# Task Phase 18：英雄库 列表/表格视图模式（OP.GG 式）

> Phase 1-17 全部功能须保留不回归。英雄库（heroes 视图）新增「卡片 / 列表」视图切换：列表模式用 OP.GG 式紧凑可排序数据表展示英雄。纯前端、Mac 可全测、0 innerHTML、零构建。

## Goal
英雄库顶部加「卡片 / 列表」切换。列表模式渲染一个紧凑表格：列 = 英雄(头像+中英名) | 职业 | Tier | 难度 | 总有效生命 | 代表标签 | 收藏★。点表头可排序（复用 Phase 17 的排序逻辑/state.filters.sort），点行打开英雄详情。视图模式持久化到 localStorage。

## Context（务必遵守）
- 纯静态零构建 SPA，ES module。英雄库渲染 `renderHeroGrid()` → `filteredHeroes()` → `createHeroCard()`，容器 `#heroGrid`。
- Phase 17 已加 `state.filters.sort`（default/tier/diff-asc/diff-desc/hp-desc/name）+ 标签筛选；`filteredHeroes()` 已做过滤+排序。**复用它**，列表模式与卡片模式共用同一份 `filteredHeroes()` 结果。
- 字段：`hero.id/nameZh/name/role/tier/difficulty/health{hp,armor,shield}/tags[]`；`ROLE_LABELS`、`createAvatar(hero)`、`isFavorite/toggleFavorite`、`createBadge(tier,"tier-badge")`、`createFavoriteButton`、helper `create/appendText`。
- 详情：点行 `openDetail(id)`。`#heroGrid` 现有 click/keydown 委托处理 data-hero-id + 收藏/对比/入队按钮，列表行也要复用同样的 data-hero-id 与按钮委托（行内放收藏★即可，复用 `button[data-favorite-hero]`）。
- a11y：表格用 `<table>` + `<caption class="sr-only">` + `th[scope=col]`；可排序表头用 `aria-sort` 跟随 `state.filters.sort`；视图切换按钮 `aria-pressed`。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook。

## Requirements
1. **视图模式状态**：`state.heroView`（`"grid"|"list"`，默认 grid），localStorage key `ow-hero-view` 持久化（try/catch 容错）。
2. **切换控件**：英雄库筛选区加「卡片/列表」两按钮（或分段控件），`aria-pressed` 标当前；切换即重渲 + 存储。
3. **列表渲染**：新增 `renderHeroList()`（或在 renderHeroGrid 内按模式分支）。用 `filteredHeroes()` 同一结果。表格列：
   - 英雄（头像 + nameZh / name，点击打开详情，行用 `data-hero-id`）
   - 职业（ROLE_LABELS）
   - Tier（tier-badge 上色）
   - 难度（`x/5` 或 —）
   - 总有效生命（hp+armor+shield，tabular 数字）
   - 标签（前 2-3 个）
   - 收藏（★ 按钮，复用 `data-favorite-hero`，不冒泡开详情）
4. **表头排序**：可排序列（Tier/难度/总有效生命/名称）表头可点，点击设置对应 `state.filters.sort` 并重渲；`aria-sort` 反映当前列方向。与顶部排序下拉双向一致（点表头也更新下拉值，反之亦然）。
5. **空态/计数**：复用 `#heroEmpty`/`#heroCount`；列表为空时表格区显示友好空态。
6. **响应式**：列表在 ≤768/375px 横向滚动不致页面溢出（表格容器 `overflow-x:auto`）。
7. 卡片模式 = 现状不变。切到列表再切回卡片，筛选/排序/收藏状态保持。

## Constraints
- 不改现有 JS 对外签名/数据流；复用 `filteredHeroes()`/`openDetail`/收藏委托；可加 `renderHeroList`、视图切换、表格样式。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。
- 0 innerHTML 注入（表格全 DOM API + CSS）。复用 token，深浅主题协调。
- Phase 1-17 全功能不回归；overlay/路由不受影响。
- `#heroGrid` 委托对 data-hero-id / data-favorite-hero / data-compare-hero / data-team-hero 的处理在列表模式仍有效（行与行内★用同样 data 属性）。

## Implementation Plan（建议）
1. state.heroView + load/save（localStorage `ow-hero-view`）。
2. index.html：英雄库工具区加 卡片/列表 切换控件（稳定 id）。
3. app.js：`renderHeroGrid()` 按 `state.heroView` 调 createHeroCard（grid）或 renderHeroList（list）；renderHeroList 用 `filteredHeroes()` 建表；表头点击改 sort（与 `#heroSortFilter` 同步）。
4. styles.css：列表表格(斑马/hover/数字右对齐/tier 上色/收藏列)、视图切换控件、响应式。
5. 自测（无头 Chrome + tools/qa.mjs 加列表用例）：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 卡片/列表可切换，刷新后保持（localStorage `ow-hero-view`）。
- 列表模式表格展示英雄/职业/Tier/难度/HP/标签/收藏，点行开详情、点★收藏不误开详情。
- 点表头排序生效且与顶部排序下拉一致，`aria-sort` 跟随；筛选/标签叠加在列表模式同样生效。
- 切模式后筛选/排序/收藏状态不丢；空态/计数正确。
- 375px 列表横向滚动不致页面溢出；深浅主题协调。
- Phase 1-17 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（含新增列表用例）。

## Review Focus（Codex 自查）
- 列表行与行内★的委托：复用 `#heroGrid` 现有 click/keydown，不破坏卡片模式；★不冒泡开详情。
- 表头排序与 `#heroSortFilter` 双向同步不打架。
- 切模式保持筛选/排序/收藏；list↔grid 无残留 DOM。
- 表格 a11y：caption/scope/aria-sort；键盘可操作。
- 0 innerHTML；375px 无页面横向溢出；overlay/路由不受影响。
