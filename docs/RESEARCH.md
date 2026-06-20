# 调研：竞品 / 用户需求 / Win 端实时对局数据

> 2026-06-20，Claude 设计调研。来源见末尾。用于驱动后续 Phase 与 Win 端实时对局功能的架构决策。

## 1. 竞品（直接对标，定义功能标杆）

| 产品 | 形态 | 关键能力 | 启示 |
|---|---|---|---|
| **Counterwatch.gg** | 免费 Windows 客户端 | 实时读对局、喊克制 + 胜率(win chance)、记录每局、敌方换英雄带时间戳记进 feed、游戏内 overlay | 我们 overlay + 克制已有雏形，缺「实时读对局」「换英雄提醒」「session 记录」 |
| **OWCOUNTER** | 游戏内 overlay | 单键唤出、非侵入式 overlay、基于高玩/教练的克制 meta | 单键热键 overlay 是刚需交互 |
| **OWMETA** | 游戏内 overlay | 单键即时英雄推荐 + meta 洞察 | 「我该玩谁」要能一键、实时 |

**结论**：市面成熟竞品都走「Windows 客户端 + 游戏内 overlay + 实时读对局 + 一键克制/推荐」。我们目前是纯 Web SPA + `?overlay=1` 浮层，要补的正是**实时数据 + 桌面 overlay**这条线。竞品都强调「只呈现游戏内已可见/官方 API 已有的信息」（合规红线，不读内存、不作弊）。

## 2. 用户需求（知乎 / Reddit / B站 信号）

- **克制关系教学**：输出/坦克/辅助三线克制讲解需求高（已覆盖，可加「为什么克制」的解释）。
- **段位/英雄强度榜**：分段 tier、上分英雄（已覆盖，需保持时效）。
- **T位/辅助进阶攻略**：按位置的进阶打法（部分覆盖，可深化分段打法）。
- **工坊代码**：分类推荐 + 使用教程（**未覆盖，潜在新模块**，注意只引用真实代码，不伪造）。
- **post-match 高光卡片**：OW2 移除后玩家想要（游戏侧功能，我们做不了，跳过）。
- **赛后复盘/session 统计**：竞品有，玩家想要每局/每天战绩趋势。

## 3. Win 端「读取实时对局」可行性与架构

### 能不能读？能，合规方式 = Overwolf GEP
- **Overwolf Game Events Provider (GEP) 支持 Overwatch 2**：暴露击杀/死亡/助攻计数、对局状态(match start/end)、**本方队伍**的 `hero_name`/`hero_role`（v249.1.0 起；敌方队伍英雄官方计划后续加入）。默认不监听，需订阅 Game Features 才触发事件。
- **合规红线**：GEP 只提供「游戏内已可见 / 官方 API 已有」的信息，不碰内存、不自动操作 → 不违反暴雪 ToS（竞品同此口径）。
- **敌方英雄识别**：GEP 当前对敌方支持有限；竞品 Counterwatch 的做法是读**计分板上已可见**的敌方英雄（玩家按 Tab 时）。可选 OCR 计分板，但脆弱、重，**一期不做**，先用 GEP 本方数据 + 手动输入敌方（现有克制计算器入口）。

### 架构决策（推荐）：Overwolf **ow-electron** 包壳现有 SPA
- Overwolf 现支持 **ow-electron**（Overwolf 作为 Electron 框架）：可把现有零构建 SPA 直接作为渲染页装进去，**复用全部现有 UI/逻辑**，再叠加：
  1. GEP 订阅 → 拿本方英雄/对局状态/K-D-A；
  2. 游戏内 overlay 窗口（单键热键唤出，复用 `?overlay=1` 紧凑模式）；
  3. session 记录（每局结果落本地）。
- **替代方案对比**：
  - 纯浏览器扩展：拿不到游戏内数据，否决。
  - 自写 Electron + 自研读取：要么 OCR(脆弱) 要么违规读内存，否决。
  - **Overwolf ow-electron：唯一合规且能复用 SPA 的路径 → 选它。**
- **测试条件**：需在 **Windows + Overwolf 客户端 + OW2** 上跑 GEP。用户有 Win 台式机(9800X3D/RTX5090，`ssh win-desktop` 可达)，具备真机联调条件。Mac 端只能做到代码/manifest/逻辑骨架，GEP 实测必须上 Win。

### 分期落地
- **Spike**：在仓库加 `overwolf/` 子目录：ow-electron manifest + GEP 订阅最小 demo（订阅 OW2、打印本方英雄/对局事件），先在 Win 跑通拿到真实事件名/字段。
- **一期**：overlay 窗口热键唤出（复用 overlay UI）+ 本方英雄自动带入「我该玩谁」+ 对局开始/结束检测 + session 战绩记录。
- **二期**：敌方计分板英雄获取（GEP 官方更新后切官方；否则评估 OCR）→ 实时自动克制推荐 + 胜率估算。

## 4. 对纯 Web SPA 仍可做的优化（不依赖 Win）
PWA 离线、a11y、URL 路由（进行中/已做）、对比、收藏、数据时效校对、工坊代码模块、克制「为什么」解释、session 历史（localStorage）、分享卡片。

## Sources
- [Game Events Provider (GEP) — Overwolf Developers](https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro/)
- [Overwatch 2 Game events — Overwolf Developers](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/overwatch-2/)
- [overwolf.games.events API — Overwolf Developers](https://dev.overwolf.com/ow-native/reference/games/events/)
- [Counterwatch — live Overwatch companion](https://www.counterwatch.gg/app)
- [OWCOUNTER](https://owcounter.com/) · [OWMETA](https://owmeta.io/apps)
- [OverFast API (GitHub)](https://github.com/TeKrop/overfast-api)
- [守望先锋如何提升T位技术 — 知乎](https://www.zhihu.com/question/424699713) · [工坊代码分类推荐 — 知乎](https://zhuanlan.zhihu.com/p/670475811)
- [OverwatchDataAnalysis 计分板/killfeed OCR (GitHub)](https://github.com/appcell/OverwatchDataAnalysis)
