# Changelog

守望先锋助手（OW 助手）—— OP.GG 风零构建静态 PWA。开发模式：Claude 设计/任务单/审查 + Codex 执行（双 AI 分工，Codex 额度耗尽期间由 Claude 直接实现）。全程硬约束：零构建、不引框架、0 innerHTML 注入数据、每阶段过 `tools/qa.mjs` CDP 交互回归。

## Phase 1-5 — 基线（静态 SPA）
英雄库 / 克制计算器 / 战绩查询(OverFast API) / 地图 / Meta / 更新 / 我该玩谁 + Overlay；OP.GG 浅色数据门户风 + 浅深主题切换。52 英雄。

## Phase 6 — URL hash 路由 / 深链 + 英雄收藏
`#/<view>`、`#/hero/<id>` 深链 + 浏览器前进后退；★收藏（localStorage，只看收藏/置顶）。

## Phase 7 — 英雄并排对比
数值高亮对比表 + 对比盘 + `#/compare/<ids>` 深链；hero-card 改 `div[role=button]` 修嵌套 button。

## Phase 8 — 无障碍 a11y 全面化
详情抽屉 modal dialog + 焦点陷阱/还原；tablist 方向键；表格 caption/scope/aria-sort；skip link；对比度 WCAG AA。

## Phase 9 — PWA 可安装 + 离线
manifest + service worker（app shell 预缓存、离线回退、OverFast API 透传不缓存）。

## Phase 10 — 对局记录器 + 趋势统计
`#/journal` 本地胜负记录 + 胜率/连胜/最近走势/按英雄按地图聚合。

## Phase 11 — session 增强
记录 JSON 导出/导入（去重合并）+ 战绩分享图卡（canvas PNG，深浅主题）。

## Phase 12 — 队伍构筑 + 阵容分析
`#/team/<ids>`：职业配比 / 阵容原型 / 队内配合 / 整体弱点 + 拿威胁去克制计算器。

## Phase 13 — 数据时效核实（联网）
多源核实全 52 英雄均真实；修正赛季 S2→S3（Into the Tiger's Den, 2026-06-16）等。

## Phase 14 — 工坊代码模块
`#/workshop`：导入指南 + 分类代码一键复制 + workshop.codes 实时源 + 失效免责（不伪造）。

## Phase 15 — 克制「为什么」evergreen 一句话
详情克制区逐英雄克制本质说明（后补全至全 52）。

## Phase 16 — 个人中心
`#/me`：本地资料 + 数据概览 + 全量备份导出/导入；数据层可插拔适配器（预留云同步）。

## Phase 17 — 英雄库排序 + 多标签筛选
Tier/难度/生命/名称排序（默认收藏置顶）+ OR/AND 多选标签 pill。

## Phase 18 — 英雄库 列表/表格视图
卡片 / OP.GG 式可排序数据表切换（持久化）。

## Phase 19 — 克制网总览
`#/matrix`：按职业分区，全英雄「我克制/我怕/协同」一览。

## Phase 20 — Meta 视图增强
当前赛季版本提示 + 各职业强势榜（按 Tier，可跳详情）。

## Phase 21 — 设置与关于面板
`#/settings`：主题/默认平台/默认视图偏好 + 版本/GitHub/致谢 + 检查更新。

## Phase 22 — 全局命令面板
Cmd/Ctrl-K 模糊搜索英雄/视图/玩家一键跳转。

## Phase 23 — 英雄可分享卡片
详情一键生成英雄信息 PNG（canvas，深浅主题）。

## Phase 24 — 移动端 / 响应式打磨
激活 tab 自动滚入可见、触控目标 ≥40px、各视图 375px 无横向溢出。

## Phase 25 — app.js 渐进模块化（纯重构）
抽出 `src/dom.js`（无状态 helper）+ `src/router.js`（依赖注入避免循环依赖），0 行为变化。

## Phase 26 — i18n 中英双语 UI
`src/i18n.js`：界面 chrome 中/英切换 + 英雄名随语言；默认中文，持久化。

---
开发与测试基建见 `tools/qa.mjs`（Node ≥22 内置 WebSocket 驱动 Chrome CDP 交互回归，当前 129 项全绿）；数据来源/核实见 `docs/SOURCES.md`；Win 端实时对局（Overwolf）规划见 `overwolf/SPIKE.md`。
