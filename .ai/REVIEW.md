# Review — 守望先锋助手

审查人：Claude（设计+数据+审查）｜执行：Codex（前端实现）｜日期：2026-06-20

## 结论：无阻塞，可交付

独立验证 + Codex 自测双重通过。

## 验证项
| 项 | 结果 |
|---|---|
| heroes.json JSON 合法 | ✅ 45 英雄（14坦/20输出/11辅） |
| `recommend()` 自测断言 | ✅ 空阵容/去重/未知id/+2-2/tier平局全过 |
| 真实数据克制逻辑 | ✅ vs 源氏猎空法鹰→卡西迪+6；vs DVa西格玛→温斯顿查莉娅（dive克poke正确） |
| 全部静态文件 HTTP 200 | ✅ index/app/data/counter/styles/heroes.json |
| XSS | ✅ 0 处 innerHTML 拼数据，23 处 textContent |
| 空值兜底 | ✅ 22 处可选链/兜底，缺字段显示「—」不崩 |
| 响应式 | ✅ Codex 无头 Chrome 实测 375px 无横向溢出 |
| console 报错 | ✅ 空 |
| 8 维度详情分区 | ✅ 参数/被动技能/Perk/站位/克制/地图/ban/分段 |

## 已知风险（非阻塞）
1. **数据时效**：tier/ban/部分克制为 Season2/2026-06 经验值，随补丁变，复核见 `docs/SOURCES.md`。
2. **新英雄数据待核对**：Domina/Anran/Vendetta 的大招与精确数值为搜索摘要，标注「待核对」；Emre/Mizuki/Jetpack Cat 暂未收录（缺可靠数据）。
3. **Perk 不完整**：部分英雄仅填代表性天赋（schema 允许缺省，前端已兜底）。
4. **头像**：当前用首字母色块占位；补 avatar 字段可自动加载。

## Phase 2 审查（2026-06-20，OP.GG/Overwolf 化）— 无阻塞，可交付
执行：Codex（114k tokens 全程实现）｜验证：Codex 无头 Chrome + Claude 独立复核。

| 项 | 结果 |
|---|---|
| 5 个 JS 文件语法 | ✅ node --check 全过 |
| stats.js 纯函数自测 | ✅ node 导入+断言通过 |
| 全 XSS 复查 | ✅ **全项目 0 处 innerHTML**，API 文本全 textContent |
| api.js 兜底 | ✅ 超时/AbortController/重试1次/localStorage缓存/key连字符映射 |
| 竞态处理 | ✅ playerRequestId + abort 忽略过期响应 |
| 全资源 HTTP 200 | ✅ 含 api.js/stats.js + ?overlay=1 |
| 实测(Codex无头Chrome) | ✅ Jay3搜索→段位/13英雄战绩表→点开详情带个人战绩；57地图；Meta;overlay;375px;console无报错 |

新增能力：战绩查询(OverFast /players+/summary+/stats/summary) · 地图页(57图+本地强势聚合) · Meta仪表盘 · Overlay精简模式。
已知风险(非阻塞)：依赖 OverFast 第三方 API(其挂则战绩页降级提示)；浏览器直连需其 CORS 放行(已加失败兜底)；玩家英雄战绩表行数取决于该玩家数据。

## Phase 3 审查（2026-06-20，社区需求融合）— 无阻塞，可交付
执行：Codex（含自查自修一个难度 bug）｜验证：Codex 无头 Chrome + Claude 独立复核。
需求来源：Reddit r/Overwatch（表现卡片、新手该玩谁）、companion app/OverHub（地图点位）、counterswap 讨论（该不该换）。

| 项 | 结果 |
|---|---|
| 6 个 JS 语法 | ✅ 含新 recommend-hero.js |
| recommendHeroes 自测 | ✅ 输出+难度≤2 → 堡垒/士兵76/狂鼠,**无难度>2 泄漏(Codex 自修的 bug 已修)** |
| buildPerformanceCards | ✅ 逻辑正确(games>0/≥5场阈值/maxBy),浏览器实测出 2 卡 |
| 全 XSS | ✅ 全项目仍 0 innerHTML |
| maps_meta.json | ✅ 未被改,25 图地形要点 |
| 全资源 200 | ✅ 含 recommend-hero.js / maps_meta.json |
| 实测(Codex无头Chrome) | ✅ A 推荐器 / B 换不换(莱因劣势→建议换,DVa→能打) / C 国王大道地形要点+6头像 / D Jay3 表现卡片 |

新增能力：A 我该玩谁(新手推荐器) · B 换不换顾问(克制×本命胜率,反"无脑换") · C 地图地形要点(curated maps_meta) · D 表现卡片(致敬旧版表彰卡)。
说明：未伪造 workshop 代码等不可靠数据；地图要点为 guide 级地形指引,非逐像素血包坐标。

## Phase 4 审查（2026-06-20，更新/补丁追踪）— 无阻塞，可交付
执行：Codex｜验证：Codex 无头 Chrome + Claude 独立复核。数据源：Blizzard 官方补丁页(curl UA 抓取)。
| 项 | 结果 |
|---|---|
| 6 JS 语法 | ✅ |
| 全 XSS | ✅ 全项目(含 index.html)仍 0 innerHTML |
| 数据完好 | ✅ patches 31改动/52英雄/25图 |
| 数据连通 | ✅ hero→change 索引31项,shion=latest在库,genji buff/reaper nerf/dva nerf 正确 |
| 全资源 200 | ✅ 含 data/patches.json |
| 实测(Codex无头Chrome) | ✅ 更新页时间线9+紫苑高亮/补丁31条/nerf筛选10/源氏详情近期调整/紫苑NEW/D.Va死神徽章/375px/console无错 |

新增：更新页(2026英雄时间线+6/16补丁逐英雄buff绿/nerf红/adjust/rework徽章,可按职业+type筛选) · 英雄卡片「近期调整」徽章 · 详情「近期调整」区 · 紫苑 NEW 高亮。
数据基准更新:最新英雄=Shion(紫苑,S3,2026-06-15);6/16补丁15强化/10削弱/5调整/1重做。后续补丁按 data/patches.json 结构往 patches[] 头部追加即可。

## Phase 5 审查（2026-06-20，OP.GG/OverHub 风格改版）— 无阻塞，可交付
执行：Codex（整体重写 styles.css + theme.js + index.html 重构）｜验证：Codex 无头 Chrome + Claude 独立复核(重点查功能 hook 未破坏)。
| 项 | 结果 |
|---|---|
| 7 JS 语法(含新 theme.js) | ✅ |
| **功能 hook 保留** | ✅ app.js 依赖的 52 个元素 id 全在;7 个 .view 区块+*View id 全在;data-view/role/platform/mode 都在(data-hero-id/sort 为JS动态生成,正常) |
| 主题系统 | ✅ theme.js localStorage `ow-theme`,默认 data-theme="light",深色持久化 |
| OP.GG token | ✅ 蓝#5383E8+浅底#F2F3F7+win/loss蓝红+tabular-nums+tier S红A橙B绿C灰+:root与[data-theme=dark]两套 |
| 全 XSS | ✅ 全项目仍 0 innerHTML |
| data/docs 未改 | ✅ |
| 全资源 200 | ✅ 含 theme.js |
| 实测(Codex无头Chrome) | ✅ 浅色默认+深色持久+7视图统一+Phase1-4功能全不回归(详情/克制/Jay3战绩/更新徽章/推荐器/地图/Meta/overlay)+375px无溢出+console无错 |

风格:深色OW橙蓝 → OP.GG式浅色数据门户(冷灰底+白卡+蓝强调+斑马表+圆角方头像tile),保留深色切换。原Phase4样式备份在 .ai/styles-phase4-backup.css。
小注:数据集暂无 C tier 英雄实例,C 灰仅 token 级验证。

## 后续可迭代
- 补全 50 英雄完整 perk 双选项。
- 接入官方/overpicker 数据校准克制权重。
- counter 计算可纳入 synergy 加权与地图维度。
