# 数据来源与更新指引

## 版本基准
- 游戏：**Overwatch**（2026 年初去掉 "2"，6v6 回归本体），当前 **Season 2 / 2026-06**。
- 2026 已上线新英雄：Hazard(坦)、Domina(坦)、Anran(dps)、Vendetta(dps)、Emre、Mizuki、Fika/Jetpack Cat 等（年内计划共 10 名）。

## 数据分层
- **evergreen（稳定）**：英雄基础 kit、站位、经典克制关系、地图原型、分段打法原则——多版本稳定。
- **meta（易变）**：`tier` / `ban.priority` / 部分克制权重 / perk 推荐——随补丁变动，**每个赛季/大补丁需复核**。

## 复核来源
- 官方英雄页 / 补丁说明（强度与数值权威源）。
- Perk 列表：overwatch.fandom.com/wiki/Perks、dotesports「all hero perks」、owperks.com。
- 克制矩阵：overwatchcounters.space（April 2026，50 英雄）、overpicker.com/counters（-20~20 评分）、dotesports / esports.gg counters chart。
- Tier / ban：gamsgo / epiccarry / pcgamesn / beatcopgame 的 2026 Season 2 tier list（注意各家口径差异，取交集）。
- 新英雄 kit：esports.gg、gamerant、dexerto、oneesports、fandom 对应英雄页。

## 待办（数据缺口）
- Domina / Anran / Vendetta / Emre / Mizuki 的精确数值与大招、perk 待官方页核对（当前为搜索摘要）。
- 全部英雄 perk 的双选项完整列表（现仅部分英雄填了代表性天赋）。
- 50 英雄完整克制矩阵的权重微调。

## 已融合的开源项目 / API（2026-06-20 接入）
- **OverFast API**（github.com/TeKrop/overfast-api，live: overfast-api.tekrop.fr）—— 爬暴雪官方页的非官方 API。**已融合**：52 英雄全名册校准、官方头像 `portrait` URL、官方 `officialSubrole`、7 个 2026 新英雄(emre/freja/jetpack-cat/mizuki/shion/sierra/wuyang)的官方技能+Perk+血量。这是本项目官方数据的权威源。
- **overwatch-tools/overwatch-tools.github.io** `data/matching.json` —— 带数值(-4~+4)的英雄克制+地图矩阵。**参考未直接覆盖**：其为 2023 前旧名册(含 mccree、缺新英雄)，仅作交叉校验，未覆盖本项目精校的中文克制数据。
- 其他同类(仅做功能参考,未取数据)：rishabjadhav/ow2-countertool、DavidLee36/OverwatchCountersCalculator、cheshire137/overwatch-counter-picker。
- 备选 API：timomak/Overwatch-API、Fuyukai/OWAPI、gclem/overwatch-js（多为玩家战绩向，英雄数据不如 OverFast 全）。

## 免责
克制/分段为经验性指引而非绝对；高分段更看操作、配合与具体地图点位，数据用于辅助决策。
