# 守望先锋助手

零构建纯静态 PWA，用于浏览 `data/heroes.json` 中的英雄数据，追踪更新/补丁改动，计算 counter / ban 建议，并接入 OverFast API 做玩家战绩、地图和 Meta 速查。

## 本地运行

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

不要直接双击 `index.html`，页面需要通过 HTTP 方式 `fetch('./data/heroes.json')`。
`file://` 下 Service Worker 会安全跳过注册。

Overlay 精简模式：

```text
http://localhost:8000/?overlay=1
```

可分享深链：

```text
http://localhost:8000/#/heroes
http://localhost:8000/#/maps
http://localhost:8000/#/journal
http://localhost:8000/#/hero/genji
http://localhost:8000/#/compare/genji,ana
```

## 功能

- 界面：默认 OP.GG / OverHub 式浅色数据门户风，冷灰背景、白色数据卡、蓝色强调、表格斑马行和响应式布局；右上角可切换浅/深主题，使用 `localStorage` 的 `ow-theme` 持久化。
- 无障碍：主导航使用 tablist/tabpanel 语义并支持方向键、Home/End 切换；详情抽屉为 modal dialog，打开后焦点进入抽屉、Tab 被锁定在抽屉内、Esc/关闭后焦点回到触发元素；页面提供“跳到主内容”链接、统一 `:focus-visible` 焦点样式、表格 caption/scope/aria-sort 和动态区域 `aria-live`。
- 英雄库：职业、Tier、Ban 优先级和关键词筛选，英雄详情使用本地官方头像字段。
- 深链路由：使用 `location.hash` 支持 `#/heroes`、`#/counter`、`#/profile`、`#/maps`、`#/meta`、`#/updates`、`#/ban` 和 `#/hero/<id>`；浏览器后退/前进可切换视图并关闭/重开英雄详情。
- 英雄收藏：英雄卡和详情抽屉均可点 ★ 收藏/取消，使用 `localStorage` 的 `ow-favorites` 持久化；英雄库支持“只看收藏”，未筛选时收藏英雄置顶。
- 英雄对比：英雄卡和详情头部可加入/移出对比，最多 4 位，使用 `localStorage` 的 `ow-compare` 持久化；底部对比盘支持移除、清空和查看对比。
- 对比深链：`#/compare/<id1>,<id2>` 可恢复对比集合并落到英雄对比视图，非法 id 会跳过；对比视图用横向表格展示职业、Tier、难度、生命值、DPS/HPS、射程、机动、站位、标签、Ban 和代表克制，并高亮数值最优项。
- 队伍构筑：英雄卡和详情头部可加入/移出队伍（最多 5），用 `localStorage` 的 `ow-team` 持久化；`#/team/<id1>,<id2>` 深链恢复阵容。组队视图分析职业配比（1 坦 2 输出 2 辅）、阵容原型（突进/消耗/缠斗，按 subrole+tags 关键词）、队内配合（synergy）、整体弱点（聚合 weakAgainst 计数排序），并可「拿威胁去克制计算器」。纯本地、离线可用。
- 克制计算器对面阵容：选定敌方后顶部显示对面阵容原型（突进/消耗/缠斗）+ 职业配比 + 针对性提示（复用组队分析）。详情「克制关系」按关系上色（克制=绿/被克=红/协同=蓝）。
- 键盘快捷键：非输入态下按 `/` 跳战绩并聚焦搜索、`b` 跳英雄库并聚焦筛选；详情抽屉 `Esc` 关闭，导航 tab 支持 ←/→/Home/End。
- 更新：读取 `data/patches.json` 展示 2026 新英雄时间线、最新英雄紫苑高亮、补丁逐英雄改动、职业/type/搜索筛选和本补丁统计。
- 近期调整：最新补丁涉及的英雄卡片显示调整徽章，英雄详情新增“近期调整”分区；紫苑卡片显示 `NEW`，英雄库标题处显示当前最新英雄。
- 我该玩谁：英雄库顶部折叠面板可按职业、难度上限和风格标签推荐低难英雄，并给出新手理由。
- 克制计算器：选择或输入 1-5 个敌方英雄，按职业输出 Top counter 推荐；选择“我当前英雄”后会给出“换不换”建议。
- 战绩查询：输入 BattleTag 搜索 OverFast 候选，选中后显示玩家档案、PC/主机段位、总览、表现卡片和英雄战绩表。
- 记录：`#/journal` 可手动记录每局胜/负/平、我方英雄、地图、敌方阵容备注和复盘备注，使用 `localStorage` 的 `ow-journal` 持久化；统计总/今日胜率、当前连胜/连败、最近 10 局走势，并按英雄和地图聚合趋势。支持 JSON 导出/导入，导入默认按 `id` 去重合并且冲突保留较新记录，也可勾选替换全部；还可把当前统计绘制为本地 PNG 分享图。胜率按 `胜 / (胜 + 负)` 计算，平局单列。
- 地图：加载 OverFast `/maps`，按模式筛选 57 张地图；25 张竞技图优先使用 `data/maps_meta.json` 展示地形要点和强势英雄头像行，缺图回退本地英雄地图文本聚合。
- Meta：本地聚合 Tier 网格、Ban 三栏和职业打法速览。
- Overlay：`?overlay=1` 下只显示紧凑克制计算器和 Meta Ban 速览。
- PWA：提供 Web App Manifest、192/512/maskable PNG 图标和根级 Service Worker；安装后可从桌面/手机启动，离线时仍可刷新使用 app shell、本地英雄库、克制、对比、更新、Meta 和地图静态文本。

## 文件结构

- `index.html`：页面骨架
- `src/styles.css`：OP.GG / OverHub 式浅色数据门户主题、深色变量和响应式布局
- `src/theme.js`：浅/深主题切换与 `ow-theme` 持久化
- `src/pwa.js`：Service Worker 注册和轻量更新提示，`file://`/非安全上下文自动跳过
- `src/api.js`：OverFast 请求封装、超时、重试、localStorage 缓存和英雄 key 映射
- `src/data.js`：加载、规范化和索引英雄、地图 meta、补丁数据
- `src/counter.js`：`recommend(enemyIds, heroes)` 纯函数和 `console.assert` 自测
- `src/recommend-hero.js`：`recommendHeroes(filters, heroes)` 新手英雄推荐纯函数和 `console.assert` 自测
- `src/stats.js`：战绩整理、排序、段位格式化、表现卡片纯函数和 `console.assert` 自测
- `src/journal.js`：本地对局记录读写、导出/导入解析、去重合并、汇总、英雄/地图趋势聚合纯函数和 `console.assert` 自测
- `src/app.js`：导航、英雄库、战绩、地图、Meta、Overlay 和详情交互
- `manifest.webmanifest`：PWA 安装元数据
- `sw.js`：预缓存 app shell、本地数据和图标；离线导航回退到 `index.html`
- `icons/`：PWA 安装图标
- `data/heroes.json`：英雄数据源，只读消费
- `data/maps_meta.json`：竞技图地形要点数据源，只读消费
- `data/patches.json`：英雄时间线和补丁改动数据源，只读消费

## API 与缓存

OverFast Base URL：`https://overfast-api.tekrop.fr`

- 玩家搜索、概要和统计缓存 10 分钟。
- 地图缓存 1 天。
- 对局记录只存本机 `localStorage`，不请求外部 API；损坏或不可用时回退空记录。JSON 导入会过滤无效条目并友好提示损坏文件，分享图使用本地 canvas 生成。
- Service Worker 不拦截也不缓存 `overfast-api.tekrop.fr` 请求，外部 API 仍由 `src/api.js` 的网络请求和 `localStorage` 缓存控制。
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
