# Review — 守望先锋助手

审查人：Claude（设计+数据+审查）｜执行：Codex（前端实现）｜日期：2026-06-20

## Phase 17 审查（英雄库排序 + 多标签筛选）— 无阻塞，可交付
执行：Codex（额度恢复后）｜验证：Codex 扩 tools/qa.mjs + Claude 复核。
- 排序：Tier S>A>B>C、难度升/降(null 垫底)、总有效生命降序、名称 zh-Hans-CN；default 仍收藏置顶，非 default 不强制置顶——CDP 逐项断言通过。
- 多标签 pill：OR/AND 切换、与 role/tier/ban/search/收藏 叠加、清空、空态——通过。
- 硬指标：`node --check` 全过；0 innerHTML；**tools/qa.mjs 44/44 全过、0 运行时错误**；375px 无溢出。
- 无阻塞。

---


## Phase 13 审查（数据时效/完整性 · Claude 联网核实）— 无阻塞，可交付
执行方：**Claude**（Codex 额度耗尽期间；数据本就是 Claude 主场）。手段：WebSearch 多源核实 + node JSON 校验 + 无头加载冒烟。

核实结论：**全 52 名册均为真实 OW 英雄，非臆造**（此前担心的 Domina/Anran/Vendetta/Shion/Sierra/Mizuki/Wuyang/Emre/Jetpack Cat 经 blizzard 官网/wikipedia/dexerto/pcgamer/gamerant/gameinformer 多源确认）。Shion 技能(Kira Pistols/Execution/Evade/Joyride/Satsuriku Spree)与官方完全一致。

修正项（均有据）：
| 项 | 改前 | 改后 | 依据 |
|---|---|---|---|
| heroes.json meta.season | Season 2 / 2026-06 | Season 3：Into the Tiger's Den (Reign of Talon) / 2026-06-16 | 与 latestHero=shion(S3) 矛盾；S3 实为 6/16 上线 |
| patches timeline shion 日期 | 2026-06-15 | 2026-06-16 | 官方 S3 上线日 |
| shion 描述 | 桥本组高速近战输出 | 高机动切入枪手(双枪 Kira Pistols) | 武器为枪非近战 |
| heroes.json meta.game | …6v6 回归 | 去掉未核实的 6v6 主张 | 未能独立验证 6v6 |
| SOURCES.md | — | 新增「数据核实日志 2026-06-20」+ 版本基准更新 + 待办澄清 | 留痕可追溯 |

验证：两 JSON `JSON.parse` 通过；无头加载顶栏赛季显示已更新、52 卡渲染、紫苑在。

---


## Phase 12 审查（队伍构筑 + 阵容分析）— 无阻塞，可交付
**执行方变更**：Codex 在实现中第二次撞到自身额度上限（恢复时间 19:28），本阶段由 **Claude 直接实现**（用户指示「一个额度用完就换另一个继续」）。因 Codex 不可用，验证手段为：node 逻辑断言 + node --check + 无头 Chrome dump-dom 渲染级冒烟，**未做完整 CDP 点击流**（如实标注）。

| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug | analyzeTeam 边界(空/缺tags/无synergy) | ✅ team.js 6 条断言通过；空阵容 count=0 不崩、不除零、不强行归类 |
| ①Bug | runCounter 不存在(原始 TASK 笔误) | ✅ 改用 renderCounter()(内含 recommend)，去掉 runCounter 调用 |
| ②回归 | 三角标(收藏/对比/入队)委托互斥 | ✅ heroGrid/detailContent 委托按 favorite→compare→team 顺序判定，各自 return，均排在 openDetail 前 |
| ②回归 | team 深链/hash 同步不循环 | ✅ 沿用 isRouting guard + overlay 短路；dump-dom #/team/genji,winston,ana 恢复 3 槽+4卡+6威胁 |
| ④测试 | 渲染冒烟 | ✅ 首页 52 卡+52 入队按钮+team tab；深链分析卡/威胁/拿去克制按钮齐全；init 未崩 |
| ④测试 | 离线/缓存 | ✅ team.js 进 sw APP_SHELL + CACHE_NAME v12 |

独立复验：`node --check` 全 8 文件过；0 innerHTML；team.js `node` 自测过。

### 补测（2026-06-20，Claude 用 node v26 内置 WebSocket 驱动 CDP 完成）
**Phase 12 交互层已端到端验证，原「未做 CDP 点击流」caveat 解除。** QA 18/19 通过、**0 运行时错误**：
- 点入队按钮①②→ `ow-team` 写入/累加(1→2)、**不误开详情**；组队视图渲染 4 分析卡 + 2 填充槽；「拿威胁去克制计算器」→ 切到克制视图并载入 5 个敌方 chip；全 11 视图 tab 切换正常。
- 唯一非通过项：直接访问裸 `#/team`(无 ids) 时 hash 不补全为 `#/team/<ids>`——与 `#/compare` 裸路由行为**一致**(裸路由显示本地保存队伍，带 ids 显示指定队伍)，属设计一致性，非 bug。
- 仍存：三角标 375px 视觉重叠未做像素级核验(dump-dom/CDP 无法判视觉)，建议真机或截图复核。

---


## Phase 11 审查（session 增强：导出/导入 + 战绩分享图卡）— 无阻塞，可交付
执行：Codex｜验证：Codex CDP + journal 新断言 + Claude 独立复核。

| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug | 导入合并/去重/冲突保新 | ✅ mergeJournal 按 id 去重、`ts` 较新者胜；断言 + CDP(id=b→win,3条)验证 |
| ①Bug | 损坏文件容错 | ✅ parseImportedJournal 区分损坏/空/全无效；CDP 损坏 JSON 原数据不变不崩 |
| ①Bug | Blob 内存泄漏 | ✅ createObjectURL 后 revokeObjectURL；toBlob 失败 reject 降级 |
| ②回归 | canvas 主题/清晰度/中文 | ✅ devicePixelRatio backing store、读 CSS 变量、深浅两版有效 PNG 1080×1350 |
| ③风险 | 剪贴板/文件读取失败降级 | ✅ clipboard 失败仅提示、FileReader try/catch |
| ④测试 | 空态禁用/导出内容/1000上限 | ✅ CDP 空态 disabled、导出 version:1+entries、合并保最新1000 |

独立复验：journal.js 导入 silent(断言全过含 4 条新增)；`node --check` 全过；0 innerHTML；sw v11。share-card 内联 app.js(未新增文件，APP_SHELL 无需改)。

---


## Phase 10 审查（对局记录器 + 趋势统计）— 无阻塞，可交付
执行：Codex｜验证：Codex CDP + journal.js 断言 + Claude 独立复核（新增 src/journal.js）。

| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug | 胜率分母(平局排除)/除零 | ✅ countResults 胜/(胜+负)，平局单列；断言 winrate=66.67 验证；0 场不除零 |
| ①Bug | 连胜/连败方向与边界 | ✅ currentStreak 从 rows[0](最新)向前；断言 streak win/2 通过 |
| ①Bug | 损坏/超限(1000)容错 | ✅ normalizeJournalEntries 过滤非法 result；断言验证；try/catch 回退空 |
| ②回归 | 新 tab 被 a11y/路由/roving 覆盖 | ✅ CDP #journalTab role=tab/aria-selected/aria-controls、方向键切换正常 |
| ②回归 | 地图下拉离线可用 | ✅ 用 data/maps_meta.json 本地数据，不依赖 OverFast /maps |
| ④测试 | 录入即时更新+刷新持久+离线 | ✅ CDP 4 局→统计/表即时更新、刷新保持、sw v10 预缓存 journal.js |

独立复验：journal.js 纯净导入(无顶层 DOM)，导入时 selfTest 7 断言全过；`node --check` 全过；0 innerHTML。

### 已知风险（非阻塞）
1. journal.js 在每次 import 都跑 selfTest()(console.assert)，与 counter.js/stats.js 约定一致，仅失败时输出，开销可忽略。

---


## Phase 9 审查（PWA 可安装 + 离线）— 无阻塞，可交付
执行：Codex｜验证：Codex CDP（含离线模拟）+ Claude 独立复核（新增 manifest/sw.js/pwa.js/3图标）。

| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug/安全 | SW 误拦截 OverFast API | ✅ sw.js 双重透传(hostname==OVERFAST_HOST return + 跨源 return)；CDP Cache 无 overfast 条目、在线 API 200 |
| ①Bug | 缓存版本升级/旧缓存清理 | ✅ ow-cache-v9，activate 删非当前缓存；CDP 造 ow-cache-old 被清理 |
| ①Bug | skipWaiting 无限刷新 | ✅ 无 controllerchange 自动 reload 循环(once+刷新后已受控)；见非阻塞① UX |
| ②回归 | 离线导航回退后 hash/overlay 还原 | ✅ 离线 #/heroes/counter/compare/meta/updates/maps/?overlay=1 全可用 |
| ②回归 | file:// / 无 SW 优雅跳过 | ✅ pwa.js 安全上下文+非file:才注册，try/catch；index file:// 降级显 HTTP 提示 |
| ④测试 | 可安装/预缓存/离线渲染 | ✅ manifest 有效、图标 192/512/maskable PNG、app shell+data 预缓存、离线 52 卡 |

附带改进（合理、非回归）：离线地图回退 data/maps_meta.json（25 图静态可看）、handled 错误降 console.warn、DOMContentLoaded 已触发兼容直接 init。

### 已知风险（非阻塞）
1. sw.js install 无条件 skipWaiting，配合更新 toast 的 controllerchange→reload，新 SW 安装后会**自动刷新**而非等点击 toast。非循环、低频(仅 sw.js 变更后二次访问)，纯 UX 细节。
2. 导航/资源 cache-first：部署更新需二次加载生效（PWA 常规行为）。

---


## Phase 8 审查（a11y 全面化 + 详情抽屉焦点陷阱）— 无阻塞，可交付
执行：Codex｜验证：Codex CDP（含对比度数值）+ Claude 独立复核（+400/-97，6 文件）。

| 级别 | 项 | 结果 |
|---|---|---|
| ②回归 | 焦点陷阱真锁住 | ✅ trapDrawerFocus 首尾环绕 + 无可聚焦元素回退 dialog；CDP 连按 24 Tab/Shift+Tab 不逃逸 |
| ②回归 | 焦点还原（含深链无触发元素）| ✅ focusRestoreTarget: previousFocus→激活tab→main/body；CDP Esc 后回到触发卡片 |
| ②回归 | inert 别藏抽屉自身 | ✅ setBackgroundInert 只 inert topbar/tabs/main/footer/tray；抽屉自身 open 时非 inert；初始 setupA11y 抽屉 inert |
| ②回归 | roving tabindex/方向键不破坏点击/路由 | ✅ syncNavigationA11y 在 switchView(487) 每次同步；←/→/Home/End 绑定(137)；点击+hash 路由不变 |
| ③风险 | overlay 不冲突 | ✅ `?overlay=1` topbar/tabbar 隐藏、路由短路、skip link/tablist 不报错 |
| ④测试 | aria-sort/caption/scope/aria-live | ✅ 战绩表 aria-sort 随排序更新；三表 caption+scope；动态区 polite、错误态 assertive |
| ④测试 | 对比度 AA | ✅ CDP 实测：浅色正文16.07/次要4.89/primary5.40/蓝5.93/红4.90；深色均≥5.76，全 AA |

接线复核：setupA11y()@init:80、syncNavigationA11y()@switchView:487、handleViewTabKeydown@137、detailDialog(role=dialog/aria-modal/aria-labelledby)@index.html:314。`node --check` 全过；0 innerHTML。

### 已知风险（非阻塞）
1. `#heroGrid` 为 aria-live=polite，筛选时整网格重渲染可能播报偏多；polite 可打断、可接受，必要时后续改为只播报计数。

---


## Phase 7 审查（英雄并排对比 + hero-card 改 div 修嵌套 button）— 无阻塞，可交付
执行：Codex（中途撞 Codex 自身额度墙→恢复后续完成；审查方补了 createHeroCard 改 div + 详情对比按钮 + keydown 已在）｜验证：Codex CDP + Claude 独立复核。

| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug | `updateCompareButton()` 无参调用 | ✅ 重载设计：无参=刷新全部按钮，带参=更新单个，非 bug |
| ①Bug | 数值高亮缺值处理 | ✅ `normalizeCompareNumber` 把非有限/≤0→null，不参与 best、显示「—」 |
| ①Bug | min/max 方向 | ✅ 难度 best=min，生命/护甲/机动/DPS=max，`bestCompareValue` 正确 |
| ②回归 | hero-card 改 div 后键盘/点击 | ✅ keydown `event.target!==card` 守卫；CDP 实测 Enter 开详情、★/对比不误开 |
| ②回归 | 嵌套 button（Phase6 遗留）| ✅ CDP `querySelectorAll("button button").length===0` |
| ②回归 | overlay 被对比/路由污染 | ✅ `?overlay=1#/compare/...` 仍 is-overlay、对比视图未激活 |
| ③风险 | localStorage 损坏/超限 | ✅ try/catch 回退空；超 4 位保持 4 位 + 提示 |
| ④测试 | node/0innerHTML/375px/深链/刷新持久 | ✅ 全过，console 0 报错 |

独立复验：12 个对比函数各定义 1 次、我补的两处调用接上；`node --check` 全过；0 innerHTML。

### 已知风险（非阻塞）
1. 护甲/护盾为 0 的英雄该行显示「—」而非「0」（0 被当缺值排除高亮）——语义上可接受，纯展示细节。
2. 数值平局时多列同时 `.is-best`（如同难度），符合「最优高亮」预期。

---


## Phase 6 审查（hash 路由/深链 + 英雄收藏）— 无阻塞，可交付
执行：Codex｜验证：Codex 无头 Chrome + Claude 独立复核（git diff +390/-47，6 文件）。

按优先级核查：
| 级别 | 项 | 结果 |
|---|---|---|
| ①Bug | hashchange 写读死循环 | ✅ `isRouting` guard + `location.hash!==next` 双重防护，无循环 |
| ①Bug | ★ 冒泡误开详情 | ✅ `#heroGrid`/`detailContent` 委托里先判 `data-favorite-hero` 再 `return` |
| ①Bug | 深链 byId 未就绪 | ✅ `initRouter()` 放在数据 `await` 完成后调用 |
| ②回归 | 收藏置顶污染克制/推荐器 | ✅ `filteredHeroes` 仅 renderHeroGrid 使用；sort 作用于 filter 新数组，不改 state.heroes |
| ②回归 | overlay 被路由污染 | ✅ `overlayMode` 时 init/apply/sync 全短路；`?overlay=1#/hero/genji` 实测仍是 overlay |
| ③风险 | localStorage 不可用/损坏 | ✅ load/save try/catch，非数组回退空 Set |
| ④测试 | node --check / 0 innerHTML / 375px | ✅ 7 JS 全过、0 innerHTML、scrollWidth==clientWidth |

独立复验：`node --check` 全过；`grep innerHTML` 0 命中；`favoriteOnlyToggle` 元素已在 index.html；后退/前进键逐级关详情/退视图（push 开详情 + replace 关详情，历史不堆积）。

### 已知风险（非阻塞）
1. **嵌套 button**：★ 是 `<button>` 嵌在 hero-card 的 `<button>` 内（HTML 不合规，键盘 Tab/读屏体验欠佳）。功能靠事件委托正常。→ 建议下个 Phase 把 hero-card 改成非 button 容器（div + role/tabindex 或外层不再是 button），或把 ★ 移出卡片按钮语义。
2. **深链 vs 应用内开详情视图不一致**：`#/hero/x` 深链强制切英雄库；应用内从战绩/更新页开详情保留当前视图——同一 hash 两种背景，纯视觉差异，非 bug。
3. `openDetail` 触发 hashchange 会二次 `renderDetail`（同英雄重渲一次），性能可忽略。

---

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

## Phase 18 审查（英雄库 列表/表格视图）— 无阻塞
执行：Codex｜tools/qa.mjs **57/57 全过、0 运行时错误**；node 全过；0 innerHTML。卡片/列表切换+持久化、列表点行开详情/★不误开、表头排序与下拉双向同步、筛选叠加、375px 无溢出、表格 a11y(caption/scope/aria-sort) 均通过。

---
