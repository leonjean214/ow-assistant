# Handoff

## 已完成

- Phase 5 视觉改版已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`docs/` 或 `.ai/TASK.md`。
- `src/styles.css` 已整体重写为 OP.GG / OverHub 式浅色数据门户风：`:root` 默认浅色 token、`[data-theme="dark"]` 深色 token、冷灰背景 `#F2F3F7`、白卡、OP.GG 蓝 `#5383E8`、细边框轻阴影、蓝色激活下划线 tab、斑马/hover 数据表、tabular 数字、胜率蓝红、英雄头像 tile、补丁/time line、地图卡、段位/表现卡、overlay 紧凑卡和 768/375 响应式规则。
- `index.html` 顶栏改为 logo + 顶栏 BattleTag 搜索壳 + 主题切换按钮 + season pill + Overlay 入口；主导航独立为 OP.GG tab 条；内容区使用 `main.app-shell` 居中 `max-width:1080px`。保留了 `app.js` 依赖的所有核心 id、`.view`、`.view-tab`、`.hero-card`、`#heroGrid` 和 `data-*` 事件 hook。
- 新增 `src/theme.js` 和 head 内初始化脚本：默认浅色，读写 `localStorage` 的 `ow-theme`，切换 `documentElement.dataset.theme` 并更新按钮状态，避免主题 FOUC。
- `src/app.js` 仅给 `tier-badge` 补充 `data-tier="S|A|B|C"` 样式属性，用于严格实现 S 红、A 橙、B 绿、C 灰；未改函数签名、数据流或功能行为。
- `README.md` 已补充主题切换和新样式说明。
- Phase 4 增量已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`docs/` 或 `.ai/TASK.md`。
- `src/data.js` 新增 `loadPatches()`，只读加载 `data/patches.json`，规范化 `_meta/timeline/patches/changes`，按补丁日期倒序排序，并建立最新补丁 `hero id -> changes[]` 索引；加载失败返回空结构，不影响英雄库等已有页面。
- 顶部导航新增“更新”tab。更新页包含 2026 英雄时间线 9 项，按日期升序展示头像、中文名、职业、日期、season、note；`latestHero=shion` 显示发光高亮和“★最新”。
- 更新页补丁日志支持多个补丁，按日期倒序渲染标题、日期、season、headline、新英雄/新图、统计和逐英雄改动。每条改动包含头像、中文/英文名、type 徽章和改动文本，支持职业、type、英雄名/文本搜索筛选，点击可打开英雄详情。
- 英雄卡片新增近期调整角标：最新补丁 `changes` 涉及的英雄显示按 type 上色的徽章，`title` 提示“近期有调整”。D.Va/死神等已显示。
- 英雄详情新增“近期调整”分区，列出该英雄在最新补丁中的 type 和改动文本；源氏详情已验证显示“闪格挡 CD 10→8 秒；Meditation 治疗 35→50/秒”。
- 英雄库紫苑卡片新增 `NEW` 角标和最新英雄边框高亮；英雄库标题处新增“当前最新英雄：紫苑 Shion(S3 入虎穴)”。
- 继续保持无框架、无构建；补丁数据渲染均使用 `textContent`/DOM API，没有 `innerHTML`/`insertAdjacentHTML`/`outerHTML` 注入。
- Phase 3 增量已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`docs/` 或 `.ai/TASK.md`。
- 新增 `src/recommend-hero.js`：`recommendHeroes(filters, heroes)` 纯函数按职业、难度上限、风格标签筛低难英雄，按 tier/难度排序并生成新手理由，含 `console.assert` 自测。
- 英雄库顶部新增“我该玩谁”折叠面板，风格标签从 `heroes.json` 动态收集，结果卡可打开英雄详情。
- 克制计算器新增“我当前英雄”下拉和“换不换顾问”。顾问复用 counter 分值，莱因对法鹰/黑百合会提示偏劣势并给同职业更优解，D.Va 对同阵容会提示能打；若已加载玩家战绩，会显示当前英雄场次/胜率并软化建议。
- `src/data.js` 新增 `loadMapMeta()`，只读加载 `data/maps_meta.json`，失败返回空 Map。
- 地图详情优先使用 `maps_meta.json` 展示 archetype、terrain、favors、against、tip 和“此图强势英雄”头像行；缺少 meta 的地图继续回退 Phase 2 英雄地图文本聚合。地图卡片有 meta 时显示地形角标。
- `src/stats.js` 新增 `buildPerformanceCards(heroStats)` 纯函数和自测；战绩页加载玩家后在英雄表上方渲染本命、胜率王、伤害/治疗担当、最稳 2-4 张表现卡片。
- 页脚新增社区需求来源说明，明确未伪造 workshop 代码或不存在的数据。
- 继续保持无框架、无构建；新增动态数据渲染均使用 `textContent`/DOM API，没有新增 `innerHTML` 注入。

## Phase 1/2 基础

- 在 Phase 1 静态 SPA 上完成 Phase 2 增量扩展，未修改 `data/heroes.json` schema、`docs/` 或 `.ai/TASK.md`。
- 只读消费 `data/heroes.json`，兼容 `{ meta, heroes }` 和裸数组两种数据形态。
- 英雄库支持职业 tab、tier、ban 优先级、中文/英文/标签搜索。
- 英雄卡片和详情使用官方 `portrait` 字段，加载失败回退首字占位。
- 英雄详情面板展示参数血量、被动/武器/主动技能/大招、Perk、站位、克制关系、地图、ban 理由和各分段打法。
- 克制计算器支持选择或输入 1-5 个敌方英雄，按职业输出 Top 推荐。
- `src/counter.js` 提供 `recommend(enemyIds, heroes)` 纯函数，并包含 `console.assert` 自测。
- 新增 `src/api.js`：OverFast fetch 封装、超时、失败归一、重试 1 次、localStorage 缓存、`junker-queen/soldier-76/wrecking-ball` 双向 key 映射。
- 新增 `src/stats.js`：英雄战绩整理、排序、职业汇总、段位中文格式化和 `console.assert` 自测。
- 战绩查询页：`/players` 搜索候选，选中后并发加载 `/summary` 和 `/stats/summary`，渲染玩家档案、PC/主机段位、总览、可排序英雄战绩表；英雄行点击打开详情并附加“你的此英雄战绩”。
- 地图页：调用 `/maps` 渲染 57 张地图，支持模式筛选，点地图后用本地 `maps.strong/weak/note` 文本关键词聚合强势/劣势英雄。
- Meta 页：本地聚合 role × tier 网格、high/medium/low Ban 三栏和职业打法速览。
- Overlay 模式：`?overlay=1` 进入紧凑浮层，只显示克制计算器和 Meta Ban 速览；正常模式右上角有入口。
- Ban 助手按 priority 排序展示建议名单和理由。
- 统一加载/错误态，接口失败显示中文提示，不白屏。外部 API 文本均用 `textContent` 写入。
- `README.md` 写明本地运行方式、功能、API 缓存和已知约束。

## 如何运行

```bash
python3 -m http.server 8000
```

打开：

```text
http://localhost:8000
```

Overlay 模式：

```text
http://localhost:8000/?overlay=1
```

## 验证记录

- Phase 5 静态检查：
  - `node --check src/app.js && node --check src/theme.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data docs .ai/TASK.md` 无输出
- Phase 5 headless Chrome/CDP 验收通过：
  - 默认浅色 token 为 `--bg:#F2F3F7`、`--primary:#5383E8`，首页英雄库渲染 52 位英雄，顶栏 `#playerSearchInput` 保留。
  - 主题切换到深色后 `localStorage.ow-theme=dark`，刷新后仍为深色；再切回浅色正常。
  - 7 个视图 `heroes/updates/counter/profile/maps/meta/ban` 均可激活，视觉统一。
  - 点击英雄卡打开详情抽屉；克制计算器输入“源氏 ana”输出 15 条推荐；更新页 latest/new/patch type 徽章正常；“我该玩谁”渲染 8 条推荐。
  - 搜索 `Jay3` 返回 12 个候选，选中后渲染 3 张段位卡和 13 行英雄战绩表。
  - 地图页渲染 57 张地图并显示地图详情；Meta 页渲染 12 个 tier 单元、3 个 ban 栏和 3 条职业速览。
  - Tier S/A/B 实际颜色分别为红/橙/绿，C 灰色 token 存在；当前数据集中没有 C tier 英雄实例。
  - `?overlay=1` 渲染 2 个紧凑 overlay 面板，独立 tab 条隐藏。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出；console/runtime 无 error/assert/exception。
- Phase 4 静态检查：
  - `node --check src/app.js`
  - `node --check src/data.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data/heroes.json data/maps_meta.json data/patches.json docs/SCHEMA.md docs/API.md docs/SOURCES.md .ai/TASK.md` 无输出
- Phase 4 headless Chrome/CDP 验收通过：
  - 首页英雄库渲染 52 位英雄，最新英雄文案为“当前最新英雄：紫苑 Shion(S3 入虎穴)”。
  - 更新页时间线 9 项，紫苑项为 `.is-latest` 且包含“★最新”。
  - 更新页补丁日志初始渲染 31 条改动，统计为 `15强化10削弱5调整1重做`。
  - type 筛选 `nerf` 后渲染 10 条，所有徽章为 nerf 样式。
  - 搜索“源氏”后 1 条改动，点击打开详情，详情包含“近期调整”和“闪格挡”改动文本。
  - 英雄库搜索 `shion` 后紫苑卡片存在 `NEW` 角标；D.Va/死神卡片存在近期调整徽章。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime 无 error/assert/exception。
- Phase 3 静态检查：
  - `node --check src/app.js`
  - `node --check src/data.js && node --check src/counter.js && node --check src/stats.js && node --check src/recommend-hero.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data/heroes.json data/maps_meta.json docs/SCHEMA.md docs/API.md .ai/TASK.md` 无输出
- Phase 3 headless Chrome/CDP 验收通过：
  - A：输出职业、难度≤2 推荐包含堡垒、士兵：76、狂鼠，且无未知难度 0/5。
  - B：敌方含 `pharah/widowmaker` 时，莱因哈特提示偏劣势并建议同职业更优解；D.Va 提示能打、别急着换。
  - C：国王大道显示“近身缠斗/室内转角多”、地形要点和 6 个强势英雄头像。
  - D：搜索并选中 Jay3 后出现 2 张表现卡片。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime 无 error/assert/exception。
- 已启动 `python3 -m http.server 8000`。
- 已用 Chrome headless/CDP 自动化验证：
  - 首页英雄库渲染 52 位英雄，Phase 1 克制计算器可输出 15 条职业推荐。
  - 战绩查询搜索 `Jay3` 返回 12 个候选；选中候选后渲染段位/总览/13 行英雄战绩；点击英雄行能打开详情并显示“你的此英雄战绩”。
  - 地图页渲染 57 张地图，地图详情包含强势英雄聚合。
  - Meta 页渲染 12 个 tier 单元、3 个 ban 栏、3 条职业速览。
  - `?overlay=1` 渲染紧凑克制结果和 8 条 Ban 速览。
  - 375px 视口无横向溢出，console 无 error/exception。

## 已知问题

- Phase 5：当前英雄数据只有 S/A/B tier，没有 C tier 英雄可实测展示；CSS 变量和选择器已包含 C 灰色。
- Phase 4 补丁追踪目前依赖 curated `data/patches.json`；新增补丁需要继续按同结构追加数据。若某条 change 的 hero id 不在英雄库中，该条仍会显示文本但头像/详情跳转会回退或禁用。
- OverFast 是非官方公共 API；如果接口限流、CORS 或网络失败，页面会显示中文错误提示，但无法离线生成真实玩家战绩。
- 地图强势/劣势聚合基于本地 `maps.strong/weak/note` 文本关键词匹配。英文地图名和中文旧地图名不完全一致时，会主要依赖模式/地形词匹配。
- Counter 仍按 schema 中的 `strongAgainst` / `weakAgainst` 计算，`synergy` 暂不计分。
- “换不换顾问”只使用本地 counter 关系和玩家英雄场次/胜率做软化提示，不会判断实时地图、队伍沟通、绝活熟练度以外的上下文。
