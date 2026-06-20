# Task Phase 10：对局记录器 + 趋势统计（本地 session 日志）

> Phase 1-9 全部功能须保留不回归。新增一个**离线可用**的「记录」模块：手动记录每局结果，自动算个人胜率/连胜/按英雄按地图趋势。补齐竞品(Counterwatch 等)的 session 记录能力，且全部 localStorage、不依赖外部 API。

## Goal
新增「记录」视图：用户一局结束后快速录入（结果 胜/负/平、我方英雄、地图、可选敌方阵容备注、心情/备注），数据存 localStorage；模块顶部展示统计卡（总胜率、今日胜率、当前连胜/连败、最近 N 局走势）、按英雄胜率表、按地图胜率表；可删除单条/清空。完全离线工作。

## Context（现状）
- 纯静态零构建 SPA，ES module。`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme,pwa}.js` + `styles.css` + `sw.js`。
- 视图体系：`.view-tab[data-view]` + `.view` section(id=`${view}View`)，`switchView` 切 `.is-active`，hash 路由 `#/<view>`，a11y 用 `setupNavigationA11y`(role=tab/tabpanel/roving)。**新视图必须进这套体系**才能被导航/路由/a11y 识别。
- 英雄数据：`state.byId`(id→hero，含 nameZh/name/role/portrait)，地图数据：`state.mapMeta` + OverFast `/maps`(在线)；离线已回退 `data/maps_meta.json`。地图录入下拉用本地可得的地图名即可（maps_meta 的 key/name），避免依赖在线。
- 已有 helper：`create/appendText/textBadge/createBadge/createAvatar/fallback/ROLE_LABELS`，详情 `openDetail`。
- 已有可复用：`src/stats.js`(战绩整理)、新模块统计建议放新 `src/journal.js`(纯函数 + console.assert 自测，import 进 app.js)，与现有 stats.js 风格一致。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库；SW 已缓存 src/*.js（新增 js 要加进 `sw.js` 的 APP_SHELL 预缓存清单并升级缓存版本号）。

## Requirements
1. **数据模型**（localStorage key `ow-journal`，JSON 数组，新→旧或旧→新自定，存储有序）：每条 `{ id, ts(录入时间戳), result: "win"|"loss"|"draw", heroId, mapKey|mapName, role, enemyNote?, note? }`。读写 try/catch 容错，损坏回退空数组。条数上限保护（如 1000 条，超出丢最旧）。
2. **录入表单**（记录视图顶部）：结果按钮组(胜/负/平)、我方英雄下拉(来自 state.heroes，按职业分组或可搜索)、地图下拉(本地地图)、敌方阵容备注(可选文本)、备注(可选文本)、「保存本局」按钮。保存后清表单、即时刷新统计与列表，并给无障碍提示(aria-live)。表单可达(label/for、键盘可用)。
3. **统计卡**（`src/journal.js` 纯函数 `summarizeJournal(entries, heroesById)`）：
   - 总场次、总胜率(胜/(胜+负)，平局不计入分母或单列，说明清楚)。
   - 今日场次/胜率(按本地日期)。
   - 当前连胜/连败(从最近一局往前数同结果连续条数)。
   - 最近 10 局走势(W/L/D 序列，小色块：胜=`--win`/`--good`，负=`--loss`，平=`--text-3`)。
4. **按英雄胜率表**：每个出现过的英雄：场次、胜率、胜/负，按场次或胜率排序，胜率用现有蓝红色 + tabular 数字；点英雄头像/名可 `openDetail`。
5. **按地图胜率表**：每张出现过的地图：场次、胜率。
6. **管理**：每条记录可删除（确认或直接删 + 可撤销可选）；「清空全部」带二次确认。删除后即时刷新。
7. **空态**：无记录时友好引导「记录你的第一局，长期看胜率趋势」。
8. **导航/路由/a11y**：在主导航加「记录」tab(data-view=`journal`)、对应 `journalView` section，纳入 hash 路由(`#/journal`)、tablist/tabpanel 语义、roving tabindex(由现有 setupNavigationA11y 自动处理，确认其覆盖新 tab)。
9. **离线**：纯 localStorage，断网完全可用；把 `src/journal.js` 加入 `sw.js` 预缓存并升级 `CACHE_NAME` 版本(如 `ow-cache-v10`)。

## Constraints
- 不改现有 JS 对外签名/数据流；新增 `src/journal.js` + app.js 内挂接 + index.html 新视图结构 + styles.css 新样式。
- 只读 `data/`，不改 `data/`、`docs/`(本 TASK 除外)。不引框架/构建/库。
- 0 innerHTML 注入数据（表单/表格/色块全 DOM API）。
- 复用现有 CSS token 与组件(卡片/表格/pill/徽章)，深浅主题协调；新增 class 不破坏既有 hook。
- Phase 1-9 全部功能与交互不回归；overlay(`?overlay=1`) 不受影响(记录视图不进 overlay 也可)。
- 升级 sw.js 缓存版本后，旧缓存仍能被 activate 清理(已实现)。

## Implementation Plan（建议）
1. `src/journal.js`：load/save/add/remove/clear + `summarizeJournal` + 按英雄/地图聚合 + console.assert 自测，导出。
2. index.html：加 `journal` tab + `journalView`(表单 + 统计卡容器 + 两张表 + 管理按钮)。
3. app.js：import journal；bindElements/bindEvents 挂表单与列表事件(事件委托)；`renderJournal()`(统计卡+表+列表)；switchView 进 journal 时渲染；初始化读取。
4. styles.css：统计卡、走势色块、录入表单、记录列表样式(深浅主题)。
5. sw.js：APP_SHELL 加 `./src/journal.js`，`CACHE_NAME` 升 v10。
6. 自测(无头 Chrome)：见验收。更新 README、`.ai/HANDOFF.md`、并在 docs/ROADMAP.md 把本阶段标记完成(只动 ROADMAP 这一处 docs，允许)。

## Acceptance Criteria
- 「记录」tab/`#/journal` 深链可达，tablist 语义与方向键正常(沿用 Phase 8)。
- 录入一局→列表新增、统计卡与按英雄/按地图表即时更新；刷新页面后数据保持(localStorage `ow-journal`)。
- 统计正确：总/今日胜率、连胜连败、最近 10 局走势(可用构造数据验证 summarizeJournal 断言)。
- 删除单条/清空(二次确认)即时刷新；空态有引导。
- **离线**(DevTools offline)刷新后记录模块完全可用(读写本地)。
- `src/journal.js` 已进 sw.js 预缓存且缓存版本升级。
- Phase 1-9 全功能不回归；`node --check` 全过(含 journal.js)；`node` 跑 journal.js 自测断言通过；console 无报错；375px 无横向溢出；0 innerHTML 注入数据。

## Review Focus（Codex 自查）
- 胜率分母处理(平局是否计入)是否一致且说明清楚；0 场次不除零。
- 连胜/连败方向(从最近往前)与边界(全胜/全负/含平局)。
- localStorage 损坏/超上限/不可用容错。
- 新 tab 是否被 setupNavigationA11y/路由/roving 自动覆盖(可能需在初始化顺序上确认 setupA11y 在新 DOM 之后)。
- sw.js 版本升级后离线仍能加载 journal.js。
- 地图下拉离线可用(用本地数据，不依赖 OverFast /maps)。
