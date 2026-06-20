# Task Phase 12：队伍构筑 + 阵容分析

> Phase 1-11 全部功能须保留不回归。新增「组队」模块：选最多 5 个英雄拼阵容，自动分析职业配比、阵容原型(dive/poke/brawl)、内部配合、整体被克弱点并给建议。基于现有英雄数据 + counter.js，离线可用、0 innerHTML。

## Goal
新增「组队」视图：用户从英雄库选英雄进「我的阵容」(最多 5，标准 1 坦 2 输出 2 辅)，实时分析：①职业配比是否健康；②阵容原型(突进/远程消耗/近身缠斗，按英雄标签/特征聚合)；③内部配合(picked 英雄间的 synergy 连线/提示)；④整体弱点(聚合 picked 的 weakAgainst → 哪些敌方英雄克制本阵容)与补强建议；⑤可一键把当前阵容的敌方威胁丢进克制计算器。深链 `#/team/<ids>`。

## Context（现状）
- 纯静态零构建 SPA，ES module。`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme,journal,pwa}.js` + `styles.css` + `sw.js`。
- 英雄数据 `normalizeHero`(data.js)：`id/name/nameZh/role(tank|damage|support)/subrole/tier/tags[]/counters{strongAgainst[],weakAgainst[],synergy[]}/ban` 等。`state.byId`、`state.heroes`。
- 克制：`src/counter.js` 有 `recommend(enemyIds, heroes)`、`scoreHeroAgainstEnemies`。克制视图状态 `state.selectedEnemies`，`renderCounter`/`runCounter`。
- 视图体系：`.view-tab[data-view]` + `.view`(id=`${view}View`)，`switchView`，hash 路由(parseHashRoute/applyRouteFromHash/syncHash*，有 `isRouting` guard、overlay 短路)，a11y `setupNavigationA11y`(role=tab/tabpanel/roving)。**新视图与深链要纳入这套**(参考 Phase 7 `#/compare/<ids>` 的实现方式，team 深链同理)。
- helper：`create/appendText/createBadge/createAvatar/fallback/ROLE_LABELS`。
- 收藏/对比已有持久化(localStorage)。组队可持久化 `ow-team`(可选)或仅靠深链，建议持久化最近阵容。
- SW APP_SHELL 在 sw.js，新增 js 要加入并升级 `CACHE_NAME`(→ v12)。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库。

## Requirements
1. **阵容状态**：`state.team`(有序数组，最多 5 个有效 hero id)，localStorage `ow-team` 持久化(try/catch 容错)。`addToTeam/removeFromTeam/isInTeam/clearTeam/setTeam`。满 5 提示不超限。
2. **入口**：英雄卡/详情头部加「入队」切换按钮(`button[data-team-hero]`，aria-pressed/aria-label，点击不冒泡开详情，委托优先判定，**排在 openDetail 之前，且与已有 favorite/compare 按钮判定不冲突**)；已入队高亮。组队视图也能从一个英雄选择器加人。
3. **组队视图**(新 `team` tab + `teamView`)：
   - 「我的阵容」槽位区(5 槽，显示已选英雄头像/名/职业 + 移除；空槽占位)。
   - **职业配比卡**：坦/输出/辅 数量 vs 标准(1/2/2)，偏离给提示(如「缺 1 辅助」「坦克过多」)。
   - **阵容原型**：用 `src/team.js` 纯函数按英雄 tags/特征归类 dive/poke/brawl 倾向，输出主原型 + 占比(标签关键词映射，缺标签英雄不强行归类)。
   - **内部配合**：列出 picked 英雄两两间的 synergy(若 A.counters.synergy 含 B 或反向)，给「强配合」提示；无则提示「暂无显著配合数据」。
   - **整体弱点**：聚合所有 picked 的 `weakAgainst`，统计被多少 picked 英雄惧怕 → Top 敌方威胁列表(头像+名+被几名队员克)，并给「建议针对/换人」文字。
   - 「拿去克制计算器」按钮：把 Top 威胁(或全部聚合 weakAgainst) 灌入 `state.selectedEnemies` 并切到克制视图运行(复用现有 runCounter 流程，不破坏其逻辑)。
4. **`src/team.js`**(纯函数 + console.assert 自测，import 进 app.js)：`analyzeTeam(team, heroesById)` 返回 `{ roleCount, roleAdvice, archetype, synergies, threats, advice }`；`teamArchetype(heroes)`；`teamThreats(heroes)`(聚合 weakAgainst 计数排序)。不触 DOM/localStorage(便于 node 自测)。
5. **深链** `#/team/<id1>,<id2>,...`：恢复阵容并切 team 视图，非法/缺失 id 跳过不崩；`switchView('team')`/阵容变化同步 hash(沿用 isRouting guard / overlay 短路)。
6. **空态**：阵容为空时引导「从英雄库点『入队』搭建你的阵容」。
7. **离线**：纯本地数据；`src/team.js` 进 sw APP_SHELL + `CACHE_NAME→v12`。

## Constraints
- 不改现有 JS 对外签名/数据流；可加 `src/team.js`、app.js 挂接、index.html 新视图/按钮、styles.css 样式。复用 counter.js 现有函数，不改其签名。
- 只读 `data/`，不改 `data/`、`docs/`(本 TASK 除外；允许 docs/ROADMAP.md 标记完成)。不引框架/构建/库。
- 0 innerHTML 注入数据。复用 token，深浅主题协调；新增 class 不破坏既有 hook。
- 英雄卡现在有 favorite + compare 两个角标按钮，再加 team 按钮要保证三者点击委托互不冲突、布局不挤(375px 不溢出)、键盘可分别聚焦、都不冒泡开详情。
- Phase 1-11 全部功能(路由/收藏/对比/记录/a11y/PWA/overlay/克制/战绩等)不回归。overlay 不被 team/路由污染。

## Implementation Plan（建议）
1. `src/team.js`：analyzeTeam/teamArchetype/teamThreats + 自测。
2. 阵容数据层(state.team + load/save/add/remove/is/clear/set)。
3. 英雄卡/详情加 team 按钮；委托三按钮(favorite/compare/team)判定顺序清晰。
4. index.html：team tab + teamView(槽位/职业卡/原型/配合/弱点/按钮)。
5. app.js：renderTeam()(分析+渲染)，switchView 进 team 渲染，深链 parseHashRoute/applyRouteFromHash 加 team 分支(参考 compare)，「拿去克制计算器」接 runCounter。
6. styles.css：槽位、分析卡、威胁表、三角标布局。
7. sw.js：APP_SHELL 加 team.js，CACHE_NAME→v12。
8. 自测(无头 Chrome)：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 「组队」tab/`#/team/<ids>` 深链可达(tablist/方向键沿用 Phase 8)；非法 id 跳过不崩。
- 入队/移除/清空即时更新分析，刷新后保持(localStorage `ow-team`)，上限 5。
- 职业配比、阵容原型、内部配合、整体弱点(威胁计数排序)正确展示；空/数据不足有合理文案。
- 「拿去克制计算器」把威胁灌入克制视图并出推荐(不破坏克制原逻辑)。
- 英雄卡三角标(收藏/对比/入队)点击互不冲突、都不误开详情、键盘各自可聚焦、375px 不溢出。
- `src/team.js` 进 sw 预缓存且版本升级；离线可用。
- Phase 1-11 全功能不回归；`node --check` 全过(含 team.js)；team.js 自测断言通过；console 无报错；375px 无横向溢出；0 innerHTML 注入数据。

## Review Focus（Codex 自查）
- 三角标(favorite/compare/team)委托判定顺序与互斥；不冒泡 openDetail。
- analyzeTeam 对 0/部分/满员、缺 tags、无 synergy/weakAgainst 的边界(不除零、不强行归类)。
- 威胁聚合计数与排序方向(被越多队员惧怕越靠前)。
- team 深链与 switchView hash 同步不循环(isRouting guard)；overlay 短路。
- 「拿去克制计算器」复用 runCounter 不破坏 selectedEnemies 上限/去重逻辑。
- localStorage 容错；sw 版本升级后 team.js 离线可加载。
