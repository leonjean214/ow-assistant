# Roadmap — 守望先锋助手

> 双 AI 分工：Claude 设计/任务单/审查，Codex 执行。调研依据见 [RESEARCH.md](RESEARCH.md)。
> 自驱循环：每个 Phase = Claude 写 TASK → Codex 执行 → Claude 审查 → 提交。一直跑到额度耗尽。

## 已完成
- **Baseline** Phase 1-5：静态 SPA（英雄库/克制/战绩/地图/Meta/更新/我该玩谁 + Overlay）+ OP.GG 浅色 + 主题切换。52 英雄。
- **Phase 6**：URL hash 路由/深链 + 英雄收藏（localStorage，只看收藏/置顶）。`9f57bc8`
- **Phase 7**：英雄并排对比（数值高亮 + 对比盘 + `#/compare` 深链）+ hero-card 改 div 修嵌套 button。`9515d3a`

## A 线：Web SPA 优化（Mac/Codex 可独立完成，不依赖 Win）
- **Phase 8**（进行中）：a11y 全面化 + 详情抽屉焦点陷阱 + tablist 方向键 + 表格语义 + skip link + 对比度 AA。
- **Phase 9**：PWA —— manifest + service worker 离线可用 + 安装到桌面/手机。
- **Phase 10**：数据时效与完整性 —— 补缺英雄/Perk、克制「为什么」一句话解释、tier/ban 复核标注来源。
- **Phase 11**：session 历史（localStorage）—— 每局/每日战绩与英雄使用趋势、可分享战绩卡片。
- **Phase 12**：工坊代码模块（仅收录真实代码 + 使用教程，绝不伪造）。

## B 线：Win 端实时对局（Overwolf ow-electron，需 Win 真机联调 `ssh win-desktop`）
> 架构决策见 RESEARCH.md §3：Overwolf ow-electron 包壳现有 SPA，复用全部 UI/逻辑。
- **Phase W0 / Spike**：仓库加 `overwolf/`：ow-electron manifest + GEP 订阅最小 demo（订阅 OW2，打印本方 hero/对局事件）。在 Win 跑通，拿真实事件名/字段回填。
- **Phase W1**：游戏内 overlay 窗口（单键热键唤出，复用 `?overlay=1` 紧凑模式）+ 本方英雄自动带入「我该玩谁」+ 对局开始/结束检测 + session 战绩落地。
- **Phase W2**：敌方计分板英雄获取（GEP 官方更新后用官方；否则评估 OCR）→ 实时自动克制推荐 + 胜率估算。

## 执行顺序
A 线（8→9→10→11→12）由 Codex 在 Mac 持续推进；B 线 W0 spike 可在 A 线间隙插入（Mac 写骨架，Win 实测）。B 线实测节点需用户在场或 Win 可达时进行。
