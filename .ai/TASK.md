# Task Phase 25：app.js 渐进模块化（重构，0 行为变化）

> Phase 1-24 全部功能须保留不回归。app.js 已 3000+ 行，本阶段把它**渐进拆分**成内聚模块以提升可维护性。**这是纯重构：不改任何行为、不加功能。验收硬门槛 = tools/qa.mjs 当前全部用例保持全绿（现 124 项）且 0 运行时错误。**

## Context（务必遵守）
- 纯静态零构建 SPA，ES module。已有独立模块：data/api/stats/counter/recommend-hero/journal/team/profile/theme/pwa。`src/app.js` 仍很大：含 `state`、`el`、init、bindElements/bindEvents、所有视图渲染(英雄库/对比/组队/克制网/记录/工坊/个人中心/设置/Meta/Ban/地图/战绩/更新/overlay/命令面板)、路由、DOM helper(create/appendText/createBadge/createAvatar/createHeroLinkGroup…)、a11y、快捷键等。
- 入口 `index.html` 只 `<script defer src="./src/theme.js">` + module 入口（app.js 经 type=module 或动态 import）。sw.js 的 APP_SHELL 预缓存所有 `src/*.js` —— **新增模块文件必须加进 sw.js APP_SHELL 并升 CACHE_NAME**。
- 硬约束：0 innerHTML 注入；不引框架/库；**不改任何对外行为/DOM 结构/id/class/data-* hook**；overlay/路由/快捷键/焦点陷阱全部照旧。

## Goal（拆分策略，安全优先）
把可安全抽离的内聚部分从 app.js 提到独立模块，app.js 变成「装配 + 跨模块协调」的瘦核心。建议抽（按低耦合优先）：
1. **`src/dom.js`**：纯 DOM helper（`create/appendText/createBadge/textBadge/createAvatar/createCornerBadge/createKeyValueGrid/detailSection/safeUrl/fallback 转发` 等无状态工具）。其它模块/app.js 改为 import。
2. **`src/router.js`**：hash 路由（parseHashRoute/applyRouteFromHash/viewHash/各 *Hash/sync*/initRouter/safeDecode）。通过参数或回调拿到 switchView/openDetail/setCompare/setTeam 等（避免循环依赖：路由模块暴露函数，app.js 注入依赖或路由 import app 的导出——选无循环的方案）。
3. **（可选，量力而行）** 把若干**自包含视图渲染**（如 workshop / matrix / me / settings 这些较独立、主要读 state + DOM helper 的）抽到 `src/views/*.js` 或单文件模块，app.js import 调用。**仅在能保持 0 行为变化且无循环依赖时做**；做不动就保留在 app.js，不强求。
- 共享 `state`/`el`：若多模块需要，可建 `src/state.js` 导出 `state`/`el` 单例供 import（最稳妥），或保留在 app.js 由参数传入。选一种一致方案，避免重复定义。

## Constraints
- **0 行为变化**：所有功能/交互/视觉与 Phase 24 完全一致。
- 不改 data/、docs/（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。
- 新增模块文件加进 `sw.js` APP_SHELL + `CACHE_NAME` 升版本(→ v16)。
- 不破坏 index.html 的脚本加载方式；保持 type=module 风格；无循环依赖（import 成环会运行期报错）。
- 宁可少拆也不要拆出 bug：每抽一块就跑一次 qa.mjs，红了就回退该步。

## Implementation Plan（建议，增量、每步验证）
1. 抽 `src/dom.js`（无状态 helper）→ 全项目改 import → 跑 qa.mjs 必须全绿。
2. （如稳）抽 `src/state.js`（state/el 单例）→ 各处 import → qa 全绿。
3. （如稳）抽 `src/router.js` → qa 全绿。
4. （如稳，逐个）抽 1-2 个自包含视图模块 → 每个后 qa 全绿。
5. 每步更新 sw.js APP_SHELL + CACHE_NAME；node --check 所有文件。
6. 自测：tools/qa.mjs 全部用例全绿、0 运行时错误；node --check 全过；0 innerHTML；手测无回归。更新 README(文件结构)、.ai/HANDOFF.md、docs/ROADMAP.md 标记完成。

## Acceptance Criteria
- app.js 行数显著下降，逻辑分到内聚模块（至少抽出 dom.js + router.js；视图模块量力而行）。
- **tools/qa.mjs 全部用例保持全绿（≥124 项）、0 运行时错误**——这是是否可交付的硬判据。
- 无循环依赖、无重复定义；新增模块进 sw APP_SHELL + 版本升级；离线仍可用。
- `node --check` 全过；console 无报错；0 innerHTML；Phase 1-24 全功能/视觉零回归。

## Review Focus（Codex 自查）
- 循环依赖（import 成环→运行期 undefined/报错）：路由/视图与 app.js 的依赖方向要单向；必要时用 state.js 单例或依赖注入。
- state/el 单例：不要出现两份 state（一份被改、一份被读）导致功能失效。
- 事件绑定/init 顺序不变；所有 id/class/data-* hook 保留。
- sw APP_SHELL 漏加新模块 → 离线白屏；务必加全 + 升版本。
- 每个抽离步骤后 qa.mjs 全绿；任何红立即回退该步。0 行为变化。
