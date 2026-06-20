# Review — 守望先锋助手

审查人：Claude（设计+数据+审查）｜执行：Codex（前端实现）｜日期：2026-06-20

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
