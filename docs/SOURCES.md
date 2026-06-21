# 数据来源与更新指引

## 版本基准
- 游戏：**Overwatch**（2026 年初去掉 "2"），当前 **Season 3：Into the Tiger's Den（Reign of Talon），2026-06-16 上线**。
- 2026 已上线新英雄：Hazard(坦,2025)、Wuyang(辅,2025)、Domina(坦)、Anran(dps)、Emre、Mizuki、Jetpack Cat(以上 S1 2026-02-10 五连发)、Sierra(dps,S2 Summit 2026-04)、Shion(dps,Hero 52,S3 2026-06-16)。Vendetta(dps,Marzia Bartalotti)为 2025-12 加入、Reign of Talon 主线角色。年内计划共 10 名(S4 8月/S5 10月/S6 12月待出)。

## 数据核实日志
- **2026-06-20（Claude 联网复核 Phase 13）**：核实全 52 名册均为**真实** OW 英雄(非臆造)。OW 去 "2" 鲸鱼、S1 2026 五新英雄(Domina/Emre/Mizuki/Anran/Jetpack Cat)、Sierra(S2)、Shion(S3 Hero52 2026-06-16) 均经多源(blizzard 官网/wikipedia/dexerto/pcgamer/gamerant/gameinformer)确认。**已修**：meta.season Season2→Season3；patches timeline shion 日期 06-15→06-16、描述"高速近战"→"高机动切入枪手(双枪 Kira Pistols)"(其武器为枪非近战)。Shion kit(Kira Pistols/Execution/Evade/Joyride/Satsuriku Spree)与官方一致。
  - 来源：dexerto.com/wikis/overwatch/overwatch-season-3-update、pcgamer Shion、en.wikipedia.org/wiki/Shion_(Overwatch)、en.wikipedia.org/wiki/Vendetta_(Overwatch)、gameinformer 2026-02-04 去"2"+五新英雄、gamerant Hero 52 Shion。

## 数据分层
- **evergreen（稳定）**：英雄基础 kit、站位、经典克制关系、地图原型、分段打法原则——多版本稳定。
- **meta（易变）**：`tier` / `ban.priority` / 部分克制权重 / perk 推荐——随补丁变动，**每个赛季/大补丁需复核**。

## 复核来源
- 官方英雄页 / 补丁说明（强度与数值权威源）。
- Perk 列表：overwatch.fandom.com/wiki/Perks、dotesports「all hero perks」、owperks.com。
- 克制矩阵：overwatchcounters.space（April 2026，50 英雄）、overpicker.com/counters（-20~20 评分）、dotesports / esports.gg counters chart。
- Tier / ban：gamsgo / epiccarry / pcgamesn / beatcopgame 的 2026 Season 2 tier list（注意各家口径差异，取交集）。
- 新英雄 kit：esports.gg、gamerant、dexerto、oneesports、fandom 对应英雄页。

## 已完成（2026-06-21 补）
- **全 52 英雄 Perk 双天赋已补全**（minor×2 + major×2，英文官方名 + 中文效果 + 推荐），含 2026 新英雄 domina/anran/vendetta；来源 pcgamer/owperks/mobalytics/dotesports/dexerto/sportskeeda/fandom 2026-06，跨源名称差异就高取信。
- **全 52 英雄「克制为什么」evergreen 一句话已补全**（`data/counter-notes.json`，基于真实 role/subrole/tags + counters 字段归纳）。

## 待办（数据缺口）
- 新英雄 Domina/Anran/Vendetta 的精确数值/大招细节仍以搜索摘要为准，待官方页逐项复核（Perk 名个别跨源有出入）。
- 52 英雄完整克制矩阵的权重微调（tier/ban 随补丁，每赛季复核）。

## 已融合的开源项目 / API（2026-06-20 接入）
- **OverFast API**（github.com/TeKrop/overfast-api，live: overfast-api.tekrop.fr）—— 爬暴雪官方页的非官方 API。**已融合**：52 英雄全名册校准、官方头像 `portrait` URL、官方 `officialSubrole`、7 个 2026 新英雄(emre/freja/jetpack-cat/mizuki/shion/sierra/wuyang)的官方技能+Perk+血量。这是本项目官方数据的权威源。
- **overwatch-tools/overwatch-tools.github.io** `data/matching.json` —— 带数值(-4~+4)的英雄克制+地图矩阵。**参考未直接覆盖**：其为 2023 前旧名册(含 mccree、缺新英雄)，仅作交叉校验，未覆盖本项目精校的中文克制数据。
- 其他同类(仅做功能参考,未取数据)：rishabjadhav/ow2-countertool、DavidLee36/OverwatchCountersCalculator、cheshire137/overwatch-counter-picker。
- 备选 API：timomak/Overwatch-API、Fuyukai/OWAPI、gclem/overwatch-js（多为玩家战绩向，英雄数据不如 OverFast 全）。

## 免责
克制/分段为经验性指引而非绝对；高分段更看操作、配合与具体地图点位，数据用于辅助决策。
