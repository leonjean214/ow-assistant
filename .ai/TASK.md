# Task Phase 6：URL Hash 路由 / 深链 + 英雄收藏

> Phase 1-5 全部功能与 OP.GG 浅色视觉已完成并须**全部保留不回归**。本阶段新增两块**纯增量**能力：①可分享的 hash 深链路由（含浏览器前进/后退）②英雄收藏（localStorage 持久化 + 收藏筛选/置顶）。**不重写现有渲染逻辑，只挂接与扩展。**

## Goal
1. 给 SPA 加 **hash 路由**：地址栏反映当前视图与正在查看的英雄详情，可直接粘贴链接打开到对应位置，浏览器前进/后退正常工作。
2. 加 **英雄收藏**：卡片与详情抽屉可一键收藏/取消，收藏持久化到 localStorage，英雄库支持「只看收藏」筛选并把收藏英雄置顶。

## Context（现状，必须遵守）
- 纯静态零构建 SPA：`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme}.js` + `styles.css`。
- 视图切换：`switchView(view)`（app.js:328）切换 `.view-tab.is-active` 和 `.view.is-active`（section id = `${view}View`），`maps` 视图懒加载。所有 tab 用 `data-view`。
- 详情：`openDetail(heroId, heroStat)`（app.js:559）给 `#detailDrawer` 加 `.is-open`；`closeDetail()` 移除。`drawerScrim`/`closeDrawer` 点击与 Esc 已绑定关闭。
- 英雄卡：`createHeroCard(hero)` 生成，卡上事件经 `#heroGrid` 委托（点卡片 → 取 `data-hero-id` → openDetail）。英雄库渲染：`renderHeroGrid()`（app.js:351，用 `filteredHeroes()` 产出顺序）。
- 过滤状态在 `state.filters`（role/tier/ban/search）；视图状态 `state.currentView`。
- Overlay 模式：`?overlay=1`，`applyOverlayMode()` 隐藏 topbar 只显浮层——**路由逻辑在 overlay 下要短路跳过，不得干扰 overlay**。
- 已有 0 innerHTML 注入数据的硬约束（全用 `textContent`/DOM API）。

## Requirements

### A. Hash 路由 / 深链
1. 路由格式（用 `location.hash`，**不要用 History pushState 改 path**，避免静态服务器 404）：
   - 视图：`#/heroes` `#/counter` `#/players` `#/maps` `#/meta` `#/updates` `#/recommend`（按现有 `data-view` 值映射；若某视图 data-view 名不同，以实际 data-view 值为准，列一张映射表在 HANDOFF）。
   - 英雄详情深链：`#/hero/<id>`（如 `#/hero/genji`），打开后台视图为英雄库 + 弹出该英雄详情抽屉。
2. **写**：`switchView` 切视图时更新 hash（用 `location.hash = ...` 或 `history.replaceState` 视情况，保证不产生多余历史项导致后退要点很多次——切 tab 用 replace 或单次 push，自行权衡，验收要求「后退键能逐步回退视图/关详情」体验合理）。`openDetail` 打开时把 hash 设为 `#/hero/<id>`（push，使后退可关闭详情）；`closeDetail` 时回退到所属视图 hash。
3. **读**：监听 `hashchange`，根据 hash 同步：切到对应视图 / 打开对应英雄详情 / 关闭详情。**避免写→触发 hashchange→再写的无限循环**（加 guard flag 或对比当前状态再动）。
4. **初始化**：`init()` 数据加载完成后，解析当前 hash 恢复到对应视图/详情；无 hash 或非法 hash → 默认 `heroes` 视图（保持现状默认行为）。非法英雄 id 不崩，回退英雄库。
5. **不破坏 overlay**：`?overlay=1` 时整个 hash 路由短路（不读不写）。
6. 现有所有内部 `switchView(...)`/`openDetail(...)` 调用点行为不变（点 tab、点卡片、点战绩英雄行打开详情等照常）。

### B. 英雄收藏 favorites
1. 存储：localStorage key `ow-favorites`，存英雄 id 数组（JSON）。读写做 try/catch 容错，损坏数据回退空集合。建议在 app.js 内集中成小工具函数（`loadFavorites/saveFavorites/toggleFavorite/isFavorite`），用 `Set` 维护内存态，放进 `state.favorites`。
2. 英雄卡：右上角加 ★ 收藏按钮（`button`，有 `aria-pressed` 与 `aria-label`「收藏/取消收藏 <英雄名>」）。点 ★ **只切换收藏，不能冒泡触发打开详情**（`event.stopPropagation()` 或在委托里按 target 判断）。已收藏=实心金/主色星，未收藏=描边星。
3. 详情抽屉头部也放一个收藏切换按钮，状态与卡片同步。
4. 英雄库筛选区加「只看收藏」开关（pill 或 checkbox，复用现有 pill 样式）。开启后 `filteredHeroes()` 只返回收藏英雄；关闭恢复。无收藏时显示空态文案「还没有收藏英雄，点卡片右上角 ★ 添加」。
5. 排序：未开「只看收藏」时，收藏英雄在结果列表中**置顶**（保持原有二级排序），让收藏优先可见。置顶逻辑要可被现有 tier/搜索筛选叠加（先过滤后置顶）。
6. 切换收藏后立即重渲染英雄库（保留当前筛选/搜索），并同步详情抽屉里的星标状态。

## Constraints
- **不改任何现有 JS 函数的对外签名与数据流**；可在 `switchView`/`openDetail`/`closeDetail`/`filteredHeroes`/`createHeroCard`/`renderDetail` 内**追加**逻辑，但不得破坏既有行为与返回。
- 路由优先放进 `src/app.js`（或新增 `src/router.js` 由 app.js import，二选一，保持 type=module 风格一致）。收藏逻辑放 app.js。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 文件除外）。不引入框架/构建/任何库。
- 保持全项目 **0 innerHTML 注入数据**（★按钮、空态等全部 `textContent`/DOM API + CSS）。
- 样式：★按钮、只看收藏 pill 用现有 CSS token（`--primary`/`--warn`/`--border` 等），新增 class，**不破坏现有 class/id/data-* hook**。深浅主题都要好看。
- Phase 1-5 全部交互不回归。

## Implementation Plan（建议步骤）
1. 收藏数据层：`state.favorites` + load/save/toggle/is 工具 + 初始化读 localStorage。
2. `createHeroCard` 加 ★ 按钮（含 aria + data 标记）；`#heroGrid` 委托里区分「点★」与「点卡片」。
3. `filteredHeroes()` 末尾叠加：只看收藏过滤 + 收藏置顶；英雄库筛选区加「只看收藏」控件并绑事件 → 重渲染。
4. `renderDetail` 头部加收藏按钮，与卡片状态同步；toggle 后刷新网格与抽屉星标。
5. 路由：解析/序列化 hash 的小函数；`switchView`/`openDetail`/`closeDetail` 内同步 hash（加 guard 防循环）；`hashchange` 监听；`init` 末尾解析初始 hash；overlay 短路。
6. 自测（无头 Chrome）：见验收。更新 `README.md` 与 `.ai/HANDOFF.md`（含 data-view→hash 映射表）。

## Acceptance Criteria
- 直接打开 `http://localhost:8000/#/maps` → 落在地图视图；`#/hero/genji` → 英雄库 + 源氏详情抽屉打开。
- 点 tab、点英雄卡、点战绩英雄行打开详情时，地址栏 hash 同步更新；浏览器**后退键**能逐步关详情 / 退回上个视图，**前进键**能重做，无需狂点。
- 写 hash 不产生无限 hashchange 循环；非法 hash 不崩、回退英雄库。
- `?overlay=1` 行为与 Phase 5 完全一致（路由不介入）。
- 英雄卡右上角 ★ 可收藏/取消，刷新页面后保持（localStorage）；点 ★ 不会误开详情。
- 「只看收藏」可只显示收藏英雄；未开启时收藏英雄置顶；空收藏有友好空态。
- 详情抽屉收藏按钮与卡片状态双向同步。
- 深/浅主题下 ★ 与收藏 pill 视觉协调。
- `node --check` 全部 JS 通过；console 无报错；375px 无横向溢出；全项目仍 0 innerHTML 注入数据。

## Review Focus（让 Codex 自查的风险点）
- hashchange 写读循环 / 后退键要点多次的坏体验。
- ★ 点击冒泡误触发 openDetail。
- 收藏置顶是否破坏了原有 tier/搜索排序与 Phase 3「我该玩谁」等其它入口。
- overlay 模式是否被路由污染。
- localStorage 不可用 / 数据损坏时的容错。
- 深链打开英雄详情时 `state.byId` 是否已就绪（必须在数据加载完成后解析初始 hash）。
