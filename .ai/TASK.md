# Task Phase 19：克制网总览视图（#/matrix）

> Phase 1-18 全部功能须保留不回归。新增「克制网」视图：按职业分区，一眼看全英雄的「我克制 / 我怕 / 协同」关系，可点跳详情。纯前端、复用现有 `counters` 数据、0 innerHTML、零构建。

## Goal
新增 `matrix` 视图（tab「克制网」+ `matrixView` + `#/matrix` 深链）：按职业(坦/输出/辅)分区，每个英雄一行/一卡，展示其 strongAgainst（我克制，绿）、weakAgainst（我怕，红）、synergy（协同，蓝）三组对手头像 chip；支持按职业筛选 + 按英雄名搜索过滤；点英雄/chip 打开对应详情。

## Context（务必遵守）
- 纯静态零构建 SPA，ES module。视图体系：`.view-tab[data-view]` + `.view`(id=`${view}View`)、`switchView`、hash 路由(parseHashRoute/applyRouteFromHash/viewHash, isRouting guard, overlay 短路)、a11y `setupNavigationA11y`(role=tab/tabpanel/roving)。**新视图与 `#/matrix` 深链要纳入这套**（参考 journal/me/workshop 的纯视图接入；matrix 无参数，按普通 view 路由即可）。
- 数据：`hero.counters.{strongAgainst[],weakAgainst[],synergy[]}`（id 数组）、`hero.role/nameZh/name`、`state.byId`、`state.heroes`。helper：`create/appendText/createAvatar/ROLE_LABELS`。已有 `createHeroLinkGroup(title, ids, kind)`（kind=strong/weak/synergy，带上色 + data-jump-hero 跳转）——**直接复用**。
- 详情跳转：chip 用 `data-jump-hero`，在 matrixView 容器上加 click 委托 `openDetail`。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook；overlay/路由不受影响。

## Requirements
1. **视图与路由**：index.html 加 tab `data-view="matrix"`（标题「克制网」）+ `matrixView` section(含 `#matrixContent` + 筛选控件)。app.js：switchView 进 matrix 调 `renderMatrix()`；parseHashRoute/applyRouteFromHash 把 `#/matrix` 当普通 view（routeViews 已含则自动）。
2. **筛选**：matrixView 顶部加 职业筛选(全部/坦/输出/辅，复用 segmented 风格) + 英雄名搜索框。`state.matrixFilter = { role:"all", search:"" }`，改动重渲。
3. **渲染 `renderMatrix()`**：按 role 顺序(tank/damage/support)分区，区内每个英雄一张卡：左侧头像+中英名(点开详情)，右侧三组 `createHeroLinkGroup`（"我克制"/"我怕"/"协同"，复用 strong/weak/synergy 上色）。按筛选(role + 名称匹配 nameZh/name/id)过滤英雄。空态友好。
4. **委托**：matrixContent 上 click 委托：先判 `button[data-jump-hero]` → openDetail；卡片标题点击也跳详情。
5. **aria-live**：`#matrixContent` 设 aria-live=polite（沿用其它视图）。新控件键盘可用。
6. **响应式**：≤768/375px 三组纵向堆叠、chip 换行，不致页面横向溢出。

## Constraints
- 不改现有 JS 对外签名/数据流；复用 `createHeroLinkGroup`/`openDetail`/`createAvatar`；可加 renderMatrix、matrix 筛选、样式。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。
- 0 innerHTML 注入（全 DOM API + CSS）。复用 token，深浅主题协调。
- Phase 1-18 全功能不回归；overlay(`?overlay=1`)不受影响。
- 新 tab 自动被 setupNavigationA11y/roving/方向键覆盖（确认初始化顺序）。
- 不需新 sw 缓存项（无新 data 文件；若新增 js 才需进 APP_SHELL+升版本——本阶段建议都写进 app.js，免动 sw）。

## Implementation Plan（建议）
1. index.html：matrix tab + matrixView(筛选 segmented + 搜索 input + `#matrixContent`)。
2. app.js：state.matrixFilter；bindElements/bindEvents 接筛选；renderMatrix()（分区+英雄卡+复用 createHeroLinkGroup）；switchView 分支；matrixContent 委托 jump-hero；init 调一次 renderMatrix(或首次进视图懒渲)。
3. styles.css：matrix 分区标题、英雄卡(头像+名+三组)、响应式。
4. 自测(无头 Chrome + tools/qa.mjs 加 matrix 用例)：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 「克制网」tab/`#/matrix` 深链可达(tablist/方向键沿用)；按职业筛选 + 名称搜索生效。
- 每个英雄展示 我克制/我怕/协同 三组（上色正确：绿/红/蓝），chip 与卡片标题点击打开对应详情。
- 空态友好；375px 无横向溢出；深浅主题协调。
- Phase 1-18 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿(含新增 matrix 用例)。

## Review Focus（Codex 自查）
- 复用 createHeroLinkGroup 的上色/跳转是否正确；matrixContent 委托不影响其它视图。
- 新 tab 被 a11y/路由/roving 覆盖；`#/matrix` 普通 view 路由不打架(isRouting guard)。
- 筛选 role+search 边界(空结果空态、缺 counters 数据的英雄显示「—」)。
- 0 innerHTML；overlay 不受影响；375px 无页面横向溢出。
