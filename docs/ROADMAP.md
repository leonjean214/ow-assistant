# Roadmap — 守望先锋助手

> 双 AI 分工：Claude 设计/任务单/审查，Codex 执行。调研依据见 [RESEARCH.md](RESEARCH.md)。
> 自驱循环：每个 Phase = Claude 写 TASK → Codex 执行 → Claude 审查 → 提交。一直跑到额度耗尽。

## 已完成
- **Baseline** Phase 1-5：静态 SPA（英雄库/克制/战绩/地图/Meta/更新/我该玩谁 + Overlay）+ OP.GG 浅色 + 主题切换。52 英雄。
- **Phase 6**：URL hash 路由/深链 + 英雄收藏（localStorage，只看收藏/置顶）。`9f57bc8`
- **Phase 7**：英雄并排对比（数值高亮 + 对比盘 + `#/compare` 深链）+ hero-card 改 div 修嵌套 button。`9515d3a`
- **Phase 8**：a11y 全面化 + 详情抽屉焦点陷阱 + tablist 方向键 + 表格语义 + skip link + 对比度 AA。
- **Phase 9**：PWA —— manifest + service worker 离线可用 + 安装到桌面/手机。
- **Phase 10**：对局记录器 + 趋势统计（`#/journal`，localStorage session 日志，离线可用）。
- **Phase 11**：session 增强 —— 记录 JSON 导出/导入、去重合并/替换、战绩分享图卡（canvas PNG，深浅主题，离线可用）。
- **Phase 14**：工坊代码模块（`#/workshop`，导入指南 + 免责 + 分类代码一键复制 + workshop.codes 实时源）。
- **Phase 15**：克制「为什么」evergreen 一句话（`data/counter-notes.json`，详情克制区，首批 14 英雄，可扩展）。
- **Phase 16**：个人中心（`#/me`，本地资料 + 数据概览 + 全量备份导出/导入；`src/profile.js` 可插拔适配器**预留云同步**）。
- **Phase 17**：英雄库排序 + 多标签筛选（默认收藏置顶、Tier/难度/生命/名称排序，标签 OR/AND 多选 pill，无 HTML 字符串注入）。
- **Phase 18**：英雄库卡片/列表视图切换（`ow-hero-view` 持久化，OP.GG 式可排序表格，表头与排序下拉双向同步，表格 a11y）。
- **Phase 19**：克制网总览视图（`#/matrix`，按职业分区展示「我克制/我怕/协同」关系，职业+名称筛选，chip/标题跳详情，QA 覆盖）。
- **Phase 20**：Meta 视图增强（`#/meta` 当前 Season 3 版本提示 + 各职业强势榜按 Tier 排序，强势榜/Tier 项可点详情，缺 tier/空态兜底，QA 覆盖）。
- **Phase 21**：设置与关于面板（`#/settings`，主题与顶栏双向同步、战绩默认平台 `ow-default-platform`、英雄库默认视图复用 `ow-hero-view`、关于/GitHub/PWA 检查更新，QA 覆盖）。
- **Phase 12**：队伍构筑 + 阵容分析（`#/team/<ids>`，职业配比/原型/配合/弱点 + 拿威胁去克制计算器，离线可用）。**Codex 额度耗尽期间由 Claude 直接实现**（一额度用完换另一额度继续）。

- **Phase 14**：工坊代码模块（`#/workshop`，导入指南 + 免责 + 分类代码一键复制 + workshop.codes 实时源链接；只收社区多源流行代码并标来源，离线可用）。✅ Claude 实现。

## A 线：Web SPA 优化（Mac/Codex 可独立完成，不依赖 Win）
- （A 线主体已完成；后续可做克制「为什么」逐英雄一句话、Perk 补全等内容深化。）

## B 线：Win 端实时对局（Overwolf ow-electron，需 Win 真机联调 `ssh win-desktop`）
> 架构决策见 RESEARCH.md §3：Overwolf ow-electron 包壳现有 SPA，复用全部 UI/逻辑。
- **Phase W0 / Spike**：✅ **脚手架已就绪**（`overwolf/`：manifest + background GEP 订阅 + overlay iframe 复用 `?overlay=1` + `SPIKE.md` 施工图/Win 实测计划）。⏳ **待 Win 实测**：在 `ssh win-desktop` 装 Overwolf+OW，load unpacked，回填真实 game id / supportedFeatures / 事件字段（见 SPIKE.md「实测回填」）。
- **Phase W1**：游戏内 overlay 窗口 + 本方英雄自动带入 + 对局检测 + session 落地。**SPA 侧已就绪**：`app.js handleOverlayMessage` 接 `{source:"owgep",kind:"my-hero"|"enemies"}` → 自动设克制当前英雄/灌敌方（Mac 模拟 postMessage 已测，QA 20/20）。⏳ 待 W0 在 Win 回填 GEP→schema 翻译(overlay.html translate) + 热键唤出 + 对局结束写 ow-journal。
- **Phase W2**：敌方计分板英雄获取（GEP 官方更新后用官方；否则评估 OCR）→ 实时自动克制推荐 + 胜率估算。

## 执行顺序
A 线（11→13）由 Codex 在 Mac 持续推进；B 线 W0 spike 可在 A 线间隙插入（Mac 写骨架，Win 实测）。B 线实测节点需用户在场或 Win 可达时进行。
