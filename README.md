# 守望先锋助手

零构建纯静态 SPA，用于浏览 `data/heroes.json` 中的英雄数据，追踪更新/补丁改动，计算 counter / ban 建议，并接入 OverFast API 做玩家战绩、地图和 Meta 速查。

## 本地运行

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

不要直接双击 `index.html`，页面需要通过 HTTP 方式 `fetch('./data/heroes.json')`。

Overlay 精简模式：

```text
http://localhost:8000/?overlay=1
```

可分享深链：

```text
http://localhost:8000/#/heroes
http://localhost:8000/#/maps
http://localhost:8000/#/hero/genji
```

## 功能

- 界面：默认 OP.GG / OverHub 式浅色数据门户风，冷灰背景、白色数据卡、蓝色强调、表格斑马行和响应式布局；右上角可切换浅/深主题，使用 `localStorage` 的 `ow-theme` 持久化。
- 英雄库：职业、Tier、Ban 优先级和关键词筛选，英雄详情使用本地官方头像字段。
- 深链路由：使用 `location.hash` 支持 `#/heroes`、`#/counter`、`#/profile`、`#/maps`、`#/meta`、`#/updates`、`#/ban` 和 `#/hero/<id>`；浏览器后退/前进可切换视图并关闭/重开英雄详情。
- 英雄收藏：英雄卡和详情抽屉均可点 ★ 收藏/取消，使用 `localStorage` 的 `ow-favorites` 持久化；英雄库支持“只看收藏”，未筛选时收藏英雄置顶。
- 更新：读取 `data/patches.json` 展示 2026 新英雄时间线、最新英雄紫苑高亮、补丁逐英雄改动、职业/type/搜索筛选和本补丁统计。
- 近期调整：最新补丁涉及的英雄卡片显示调整徽章，英雄详情新增“近期调整”分区；紫苑卡片显示 `NEW`，英雄库标题处显示当前最新英雄。
- 我该玩谁：英雄库顶部折叠面板可按职业、难度上限和风格标签推荐低难英雄，并给出新手理由。
- 克制计算器：选择或输入 1-5 个敌方英雄，按职业输出 Top counter 推荐；选择“我当前英雄”后会给出“换不换”建议。
- 战绩查询：输入 BattleTag 搜索 OverFast 候选，选中后显示玩家档案、PC/主机段位、总览、表现卡片和英雄战绩表。
- 地图：加载 OverFast `/maps`，按模式筛选 57 张地图；25 张竞技图优先使用 `data/maps_meta.json` 展示地形要点和强势英雄头像行，缺图回退本地英雄地图文本聚合。
- Meta：本地聚合 Tier 网格、Ban 三栏和职业打法速览。
- Overlay：`?overlay=1` 下只显示紧凑克制计算器和 Meta Ban 速览。

## 文件结构

- `index.html`：页面骨架
- `src/styles.css`：OP.GG / OverHub 式浅色数据门户主题、深色变量和响应式布局
- `src/theme.js`：浅/深主题切换与 `ow-theme` 持久化
- `src/api.js`：OverFast 请求封装、超时、重试、localStorage 缓存和英雄 key 映射
- `src/data.js`：加载、规范化和索引英雄、地图 meta、补丁数据
- `src/counter.js`：`recommend(enemyIds, heroes)` 纯函数和 `console.assert` 自测
- `src/recommend-hero.js`：`recommendHeroes(filters, heroes)` 新手英雄推荐纯函数和 `console.assert` 自测
- `src/stats.js`：战绩整理、排序、段位格式化、表现卡片纯函数和 `console.assert` 自测
- `src/app.js`：导航、英雄库、战绩、地图、Meta、Overlay 和详情交互
- `data/heroes.json`：英雄数据源，只读消费
- `data/maps_meta.json`：竞技图地形要点数据源，只读消费
- `data/patches.json`：英雄时间线和补丁改动数据源，只读消费

## API 与缓存

OverFast Base URL：`https://overfast-api.tekrop.fr`

- 玩家搜索、概要和统计缓存 10 分钟。
- 地图缓存 1 天。
- 请求超时、404、网络/CORS 失败都会显示中文错误提示，不会白屏。
- API 英雄 key 会映射 `junker-queen/soldier-76/wrecking-ball` 与本地 `junkerqueen/soldier76/wreckingball`。

## Counter 规则

`recommend(enemyIds, heroes)` 会去重、忽略未知 id，并最多使用 5 个敌方英雄：

- 候选英雄的 `strongAgainst` 命中敌方英雄：`+2`
- 候选英雄的 `weakAgainst` 命中敌方英雄：`-2`
- `synergy` 暂不计分

返回值包含 `all` 排序列表和按 `tank / damage / support` 分组的 `byRole`。

## 社区需求来源

Phase 3 新增的“我该玩谁”“换不换顾问”“地图地形要点”“表现卡片”来自社区需求调研，包括 Reddit r/Overwatch、贴吧、OverHub 等。页面不会伪造 workshop 代码或不存在的数据。
