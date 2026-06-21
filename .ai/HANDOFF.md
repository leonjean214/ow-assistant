# Handoff

## Phase 21 已完成

- 已实现设置与关于面板 `#/settings`，未引入框架、构建或依赖，未修改 `data/` 或 `sw.js`，未提交 git commit。
- `index.html` 新增主导航「设置」tab（`data-view="settings"`）和 `#settingsView/#settingsContent`，自动纳入既有 `.view-tab[data-view]`、hash 路由、tablist/tabpanel、overlay 短路体系。
- `src/app.js` 新增 `APP_VERSION = "1.0"`、`DEFAULT_PLATFORM_KEY = "ow-default-platform"`、设置页渲染与事件委托；`switchView("settings")` 调用 `renderSettings()`。
- 主题偏好与顶栏 `#themeToggle` 双向同步：设置页切换会更新 `document.documentElement.dataset.theme`、`ow-theme`、顶栏 `aria-pressed` 和文案；顶栏按钮点击后也会同步设置页分段控件。
- 战绩默认平台使用 `ow-default-platform`，应用启动早期读取并设置 `state.platform` 初值，同时同步 `#platformTabs`；设置页改默认平台会立即写入 localStorage 并切当前平台。
- 英雄库默认视图复用 Phase 18 的 `ow-hero-view` 和 `state.heroView`，设置页改动即时写入、同步英雄库控件，并刷新英雄库渲染。
- 关于区显示应用名、版本、GitHub 外链 `https://github.com/leonjean214/ow-assistant`（`target="_blank" rel="noopener noreferrer"`）、OverFast API / workshop.codes / 社区调研致谢，以及 PWA「检查更新」按钮。
- PWA 检查更新逻辑仅写在 `app.js`：`navigator.serviceWorker.getRegistration()?.update()` 路径带 try/catch；无 SW/不支持/失败时给友好反馈，不影响主功能。
- `src/styles.css` 新增设置页网格、设置卡、fieldset、关于区、更新状态与 820/375px 响应式规则，深浅主题复用现有 token。
- `tools/qa.mjs` 新增 Phase 21 用例：`#/settings` 路由/tab、主题双向同步、默认平台写入/刷新恢复、默认英雄视图写入/刷新生效、关于区版本/GitHub/致谢/检查更新、375px 无横向溢出。
- `README.md` 已补充 `#/settings` 深链、设置功能说明和 `src/app.js` 描述；`docs/ROADMAP.md` 已标记 Phase 21 完成。

## Phase 21 验证记录

- 静态检查：
  - `for f in src/*.js sw.js tools/qa.mjs; do node --check "$f" || exit 1; done`
  - `git diff --check`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . --glob '!node_modules/**' --glob '!*.png' --glob '!.git/**'` 无命中
- Headless Chrome/CDP 回归：
  - 启动 `python3 -m http.server 8125`
  - 启动 Chrome：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/ow-chrome-qa-phase21`
  - `BASE=http://localhost:8125 node tools/qa.mjs`
  - 结果：`89/89` 通过，`0` 个运行时错误。
  - 覆盖 Phase 21：settings hash/tab 可达，主题设置与顶栏双向同步，`ow-default-platform` 写入且刷新后应用到 `state.platform/#platformTabs`，`ow-hero-view` 写入且刷新后英雄库默认列表视图生效，关于区版本/GitHub/致谢齐全，PWA 检查更新有友好反馈，375px 设置页无横向溢出。
  - 覆盖回归：英雄库列表/排序/标签/收藏、对比深链、组队深链、克制网、Meta、克制计算器、详情抽屉、快捷键、工坊、个人中心、GEP 消息桥、overlay。

## Phase 20 已完成

- 已实现 Meta 视图增强，未引入框架、构建或依赖，未修改 `data/` 或 `sw.js`，未提交 git commit。
- `index.html` 在 `#metaView .meta-layout` 新增 `#metaSeasonNote` 和 `#metaStrongList` 稳定容器，保留既有 `#tierGrid`、`#banBoard`、`#rolePassives` hook。
- `src/app.js` 在数据加载后保存 `state.meta = data.meta || {}`；`renderMetaDashboard()` 现在渲染当前赛季/版本提示、各职业强势榜、Tier 网格、Ban 三栏和职业打法速览。
- 版本提示读取 `meta.season` 与 `meta.updated`，显示当前 Season 3：Into the Tiger's Den (Reign of Talon) / 2026-06-16 与数据更新日期。
- 各职业强势榜按 `tank/damage/support` 三列展示 Top 6，排序复用 `tierSortRank()`，S>A>B>C，缺失/无效 tier 垫底并显示「未定级」。
- 强势榜项复用 `createAvatar(hero)`、`createBadge(..., "tier-badge")`，包含头像、中英名、tier 徽章，并通过 `data-jump-hero` 打开 `openDetail()`。
- `#metaView` 新增 click 委托处理 `button[data-jump-hero]`；Tier 网格英雄项也改为 `data-jump-hero`，不影响 Ban 三栏现有 click 绑定和 `rolePassives`。
- `src/styles.css` 新增版本提示条、强势榜三列/卡片/item、未定级区和响应式规则；`375px` 下 Meta 不产生页面横向溢出。
- `tools/qa.mjs` 新增 Phase 20 用例：`#/meta` 深链、Season 3 提示、强势榜三列、头像/中英名/tier 结构、Tier 排序、强势榜和 Tier 网格点击开详情、缺 tier/空态兜底路径、375px 无横向溢出。
- `README.md` 已补充 `#/meta` 深链和 Meta 功能说明；`docs/ROADMAP.md` 已标记 Phase 20 完成。

## Phase 20 验证记录

- 静态检查：
  - `for f in src/*.js sw.js tools/qa.mjs; do node --check "$f" || exit 1; done`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . --glob '!node_modules/**' --glob '!*.png' --glob '!.git/**'` 无命中
- Headless Chrome/CDP 回归：
  - 启动 `python3 -m http.server 8125`
  - 启动 Chrome：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/ow-chrome-qa-phase20`
  - `BASE=http://localhost:8125 node tools/qa.mjs`
  - 结果：`77/77` 通过，`0` 个运行时错误。
  - 覆盖 Phase 20：Season 3 版本提示正确、各职业强势榜按 Tier 排序、强势榜项含头像/中英名/tier、强势榜和 Tier 网格可点击打开详情、缺 tier/空态兜底路径存在、375px Meta 无横向溢出。
  - 覆盖回归：英雄库列表/排序/标签/收藏、对比深链、组队深链、克制网、克制计算器、详情抽屉、主题、快捷键、工坊、个人中心、GEP 消息桥、overlay。

## Phase 19 已完成

- 已实现「克制网」总览视图，未引入框架、构建或依赖，未提交 git commit。
- `index.html` 新增主导航 tab「克制网」和 `#matrixView`，包含职业分段控件 `#matrixRoleTabs`、搜索框 `#matrixSearchInput`、计数 `#matrixCount` 和 `#matrixContent`；自动纳入现有 `.view-tab[data-view]`、hash 路由、tablist/tabpanel、roving tabindex 体系。
- `src/app.js` 新增 `state.matrixFilter = { role:"all", search:"" }`、`renderMatrix()`、`filteredMatrixHeroes()`、`syncMatrixRoleTabs()`、`createMatrixSection()`、`createMatrixCard()`；`switchView("matrix")` 懒渲染，`#/matrix` 作为普通 view 深链处理。
- 克制网按 `tank/damage/support` 顺序分区，卡片左侧复用 `createAvatar(hero)` 展示头像和中英名，右侧直接复用 `createHeroLinkGroup("我克制"/"我怕"/"协同", ..., "strong"/"weak"/"synergy")`，保持绿/红/蓝上色和 `data-jump-hero`。
- `#matrixContent` click 委托：优先处理 `button[data-jump-hero]`，再处理 `button[data-matrix-hero]`，均调用现有 `openDetail()`；未改详情签名或已有数据流。
- 筛选支持职业 `all/tank/damage/support` 和英雄 `id/name/nameZh` 搜索；空结果显示友好空态。
- `src/styles.css` 新增矩阵工具条、职业分区、矩阵卡、标题按钮、三组关系列和 920/375px 响应式；窄屏下三组纵向堆叠，chip 换行，不产生页面横向溢出。
- `tools/qa.mjs` 新增 Phase 19 用例：`#/matrix` 深链、tab/roving a11y、三职业分区、`aria-live`、三组上色、标题/chip 打开详情、职业筛选、名称搜索、空态、375px 无横向溢出。
- `README.md` 已补充 `#/matrix` 深链、克制网功能和 `src/app.js` 描述；`docs/ROADMAP.md` 已标记 Phase 19 完成。

## Phase 19 验证记录

- 静态检查：
  - `node --check src/app.js`
  - `node --check tools/qa.mjs`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" index.html src tools --glob '!node_modules'` 无命中
- Headless Chrome/CDP 回归：
  - 启动 `python3 -m http.server 8125`
  - 启动 Chrome：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/ow-chrome-qa`
  - `BASE=http://localhost:8125 node tools/qa.mjs`
  - 结果：`68/68` 通过，`0` 个运行时错误。
  - 覆盖 Phase 19：`#/matrix` 深链激活 view/tab，tablist roving 正确，三职业分区渲染，`#matrixContent aria-live=polite`，三组关系绿/红/蓝上色，标题和 chip 均打开详情，职业筛选和名称搜索生效，空态友好，375px 无横向溢出。
  - 覆盖回归：英雄库列表/排序/标签/收藏、对比深链、组队深链、克制计算器、详情抽屉、主题、快捷键、工坊、个人中心、GEP 消息桥、overlay。

## Phase 18 已完成

- 已实现英雄库「卡片 / 列表」视图模式，未引入框架、构建或依赖，未提交 git commit。
- `index.html` 英雄库工具区新增 `#heroViewToggle` 卡片/列表分段控件，使用 `aria-pressed` 同步当前模式。
- `src/app.js` 新增 `state.heroView` 与 `localStorage` key `ow-hero-view`，读写均 try/catch 容错；`renderHeroGrid()` 按模式渲染卡片或列表，并继续复用同一份 `filteredHeroes()` 过滤/排序结果。
- 新增列表表格渲染：`<table>` + `<caption class="sr-only">` + `th[scope=col]`/行头 `scope=row`；列为英雄头像+中英名、职业、Tier、难度、总有效生命、代表标签、收藏。列表行保留 `data-hero-id`，收藏按钮继续使用 `button[data-favorite-hero]`，复用 `#heroGrid` 委托，点行开详情、点 ★ 不误开详情。
- 表头排序支持名称、Tier、难度、总有效生命；点击表头写入 `state.filters.sort` 并同步 `#heroSortFilter`，下拉变更也同步列表 `aria-sort`。难度表头在 `diff-asc`/`diff-desc` 间切换。
- `src/styles.css` 新增 OP.GG 式紧凑英雄表、斑马行、hover/focus、数字列、排序箭头和 `.hero-list-wrap { overflow-x:auto }`，375px 下页面不横向溢出，仅表格容器可横向滚动。
- `tools/qa.mjs` 新增 Phase 18 用例：列表切换+刷新保持、表格 a11y、点行详情、★ 不误开、表头排序与下拉双向同步、筛选叠加、切模式不丢状态、375px 列表滚动。
- `README.md` 已补充英雄库卡片/列表模式和 `ow-hero-view`；`docs/ROADMAP.md` 已标记 Phase 18 完成。

## Phase 18 验证记录

- 静态检查：
  - `for f in src/*.js sw.js tools/qa.mjs; do node --check "$f" || exit 1; done`
  - `git diff --check`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . --glob '!node_modules/**' --glob '!*.png' --glob '!.git/**'` 无命中
- Headless Chrome/CDP 回归：
  - 启动 `python3 -m http.server 8125`
  - 启动全新 profile：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/ow-chrome-qa-phase18`
  - `BASE=http://localhost:8125 node tools/qa.mjs`
  - 结果：`57/57` 通过，`0` 个运行时错误。
  - 覆盖 Phase 18：卡片/列表切换、刷新保持 `ow-hero-view=list`、caption/scope/aria-sort、行点击开详情、列表 ★ 收藏不误开、表头 Tier/难度/HP 排序与 `#heroSortFilter` 同步、列表筛选叠加、切模式保持筛选/排序、375px 页面无横向溢出。
  - 覆盖回归：Phase 17 排序/多标签、收藏、对比深链、组队深链、详情抽屉、主题、快捷键、工坊、个人中心、GEP 消息桥、overlay。

## Phase 17 已完成

- 已实现英雄库排序 + 多标签筛选，未引入框架、构建或依赖，未提交 git commit。
- `index.html` 英雄库筛选区新增 `#heroSortFilter` 排序下拉；新增 `#heroTagFilters` 多标签 pill 容器、`#tagMatchToggle` OR/AND 切换和 `#clearTagFilters` 清空按钮。标签 pill 全部由 DOM API 渲染，使用 `aria-pressed` 同步选中态。
- `src/app.js` 扩展 `state.filters`：`sort/tags/tagsMatchAll`；新增 `renderTagFilters()`、`syncTagFilterControls()`、`matchesHeroTags()`、`sortFilteredHeroes()` 等逻辑。`filteredHeroes()` 现在先叠加 role/tier/ban/favorites/search/tags 过滤，再排序。
- 排序规则：`default` 保留收藏置顶 + 原始顺序；`tier` 按 S/A/B/C、无效 tier 垫底；`diff-asc/diff-desc` 均把 `null` 难度垫底；`hp-desc` 按 hp+armor+shield；`name` 按 `zh-Hans-CN` 比较 `nameZh/name`。非 default 排序不强制收藏置顶。
- 空态在标签筛选无结果时提示「没有符合条件的英雄，试试减少标签或清空筛选。」；英雄计数继续来自过滤后结果数。
- `src/styles.css` 新增标签筛选面板、pill、OR/AND 按钮和响应式布局；375px 下无横向溢出，深浅主题复用现有 token。
- `tools/qa.mjs` 新增 Phase 17 回归：排序各项、`null` 难度、无效 tier 兜底、default 收藏置顶、非 default 不置顶、多标签 OR/AND、与其它筛选叠加、空态、清空、pill `aria-pressed`、375px 无溢出；并在 QA 开始时清理 SW/Cache，避免 PWA 缓存旧脚本。
- `README.md` 已补充英雄库排序、多标签筛选和收藏置顶行为；`docs/ROADMAP.md` 已标记 Phase 17 完成。

## Phase 17 验证记录

- 静态检查：
  - `for f in src/*.js sw.js tools/qa.mjs; do node --check "$f" || exit 1; done`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . --glob '!node_modules/**' --glob '!*.png' --glob '!.git/**'` 无命中
- Headless Chrome/CDP 回归：
  - `BASE=http://localhost:8125 node tools/qa.mjs`
  - 结果：`44/44` 通过，`0` 个运行时错误。
  - 覆盖排序：Tier S>A>B>C、难度升/降且 `null` 垫底、总有效生命降序、中文名称排序、无效 tier 兜底。
  - 覆盖筛选：多标签 OR/AND、与 Tier/search 等筛选叠加、空态文案、清空标签恢复、pill `aria-pressed`。
  - 覆盖回归：收藏、对比深链、组队深链、英雄详情抽屉、主题切换、快捷键、工坊、个人中心、GEP 消息桥、overlay。
  - 375px 英雄库无横向溢出；console 错误/异常为 0。

## Phase 11 已完成

- 已实现「记录」视图 session 增强：JSON 导出/导入、合并/替换、去重冲突保新、损坏文件友好错误、战绩分享 PNG 图卡；未引入框架、构建或依赖，未提交 git commit。
- `src/journal.js` 新增纯函数 `serializeJournal(entries)`、`parseImportedJournal(text)`、`mergeJournal(existing, incoming)`；导出结构为 `{ version: 1, exportedAt, entries }`；导入接受数组或 `{ entries }`；合并按 `id` 去重，冲突保留较新 `ts`，最终仍按新到旧保留最多 1000 条；内置 `console.assert` 覆盖导出、损坏导入、过滤损坏、去重和冲突保新。
- `index.html` 的 `#/journal` 新增「导出 JSON」「导入 JSON」「替换全部」「生成分享图」工具条、隐藏 file input 和离屏 canvas。
- `src/app.js` 接入导出下载、文件导入、替换确认、即时刷新统计/表/列表、aria-live 状态；下载使用 `Blob` + `URL.createObjectURL` + 临时 `<a download>`，触发后 `revokeObjectURL`。
- 分享图卡在本地 canvas 绘制，尺寸 1080×1350，并按 `devicePixelRatio` 设置 backing store；配色从 CSS 变量读取，覆盖浅/深主题；内容包含标题、日期/赛季、总场次、总胜率、今日、当前趋势、最近 10 局走势和 Top 3 英雄；`canvas.toBlob("image/png")` 后下载，并尝试 Clipboard API 复制，失败只提示不报错。
- 空记录时导出/分享按钮禁用；直接触发时也会提示「先记录几局再导出/分享」。
- `src/styles.css` 新增记录工具条、替换开关、禁用按钮和离屏 canvas 样式，移动端 375px 无横向溢出。
- `sw.js` 已升级 `CACHE_NAME` 到 `ow-cache-v11`；未新增 `src/share-card.js`，因此无需增加新的 JS 缓存项。
- `README.md` 已补充记录导出/导入、分享图和 `src/journal.js` 说明；`docs/ROADMAP.md` 已将 Phase 11 标记为完成，并调整后续 A 线编号。

## Phase 11 验证记录

- 静态检查：
  - `for f in src/*.js sw.js; do node --check "$f" || exit 1; done`
  - `node --input-type=module -e "import('./src/journal.js').then(() => console.log('journal self-test import ok'))"`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . -g '!node_modules'` 无命中
- Headless Chrome/CDP 验收通过：
  - 空 `ow-journal` 时，`#exportJournal.disabled === true` 且 `#shareJournal.disabled === true`。
  - 导出 JSON 触发下载 `ow-journal-2026-06-20.json`，内容含 `version:1`、`exportedAt` 和 2 条 `entries`。
  - 合法导入 `{ entries }` 后即时刷新，状态提示「导入 2 条，去重后共 3 条。」；重复 `id=b` 的冲突记录保留较新 `ts` 且结果变为 `win`；`localStorage.ow-journal` 为 3 条。
  - 损坏 JSON 文件显示「导入失败：JSON 文件已损坏或格式不正确。」；原 3 条记录保持不变，不崩溃。
  - 分享图浅色主题触发下载 `ow-journal-share-2026-06-20.png`，PNG header 有效，canvas 输出 `data:image/png`，尺寸为 1080×1350。
  - 分享图深色主题 `canvas.toBlob("image/png")` 返回有效 PNG，blob size 153008，尺寸为 1080×1350。
  - Service Worker cache keys 包含 `ow-cache-v11`；DevTools offline 后刷新仍可加载 `#/journal`。
  - 375px 移动视口 `documentElement` 和 `body` 横向溢出均为 0。
  - 应用级 runtime exception、`console.error`、`console.assert` failure 数量为 0。

## Phase 10 已完成

- 已实现「记录」视图 `#/journal`，未引入框架、构建或依赖，未提交 git commit。
- 新增 `src/journal.js`：导出 `loadJournal/saveJournal/addJournalEntry/removeJournalEntry/clearJournal/summarizeJournal/aggregateByHero/aggregateByMap/normalizeJournalEntries` 等函数；`localStorage` key 为 `ow-journal`；读写 try/catch 容错，损坏数据回退空数组；最多保留 1000 条，按新到旧排序；内置 `console.assert` 自测。
- `index.html` 主导航新增「记录」tab（`data-view="journal"`）和 `journalView`，自动纳入现有 hash 路由、tablist/tabpanel、roving tabindex 和方向键体系。
- 记录表单支持胜/负/平、我方英雄、地图、敌方阵容备注和备注；英雄来自本地 `state.heroes`，地图下拉来自本地 `data/maps_meta.json`，离线可用。
- `src/app.js` 接入记录模块：保存后清表单并即时刷新统计、英雄/地图表和列表；每条记录可删除；清空全部有二次确认；状态通过 `aria-live` 提示。
- 统计卡展示总场次/总胜率、今日场次/胜率、当前连胜/连败、最近 10 局走势；胜率按 `胜 / (胜 + 负)` 计算，平局单列且在 UI 中说明。
- 英雄趋势表展示出现过的英雄、场次、胜率、胜/负/平，英雄头像/名称可打开详情；地图趋势表展示出现过的地图、场次、胜率、胜/负/平。
- `src/styles.css` 新增记录表单、统计卡、走势色块、趋势表和记录列表样式，复用现有 token，并覆盖 920/768/375px 断点。
- `sw.js` 已升级 `CACHE_NAME` 到 `ow-cache-v10`，并把 `./src/journal.js` 加入 `APP_SHELL` 预缓存。
- `README.md` 已补充 `#/journal` 深链、记录功能、`src/journal.js` 文件说明和本地记录缓存说明。
- `docs/ROADMAP.md` 已将 Phase 10「对局记录器 + 趋势统计」标记为已完成，并调整后续 A 线编号。

## Phase 10 验证记录

- 静态检查：
  - `for f in src/*.js sw.js; do node --check "$f" || exit 1; done`
  - `node src/journal.js`
  - `git diff --check`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" . -g '!node_modules' -g '!*.png'` 无命中
- Headless Chrome/CDP 验收通过：
  - `#/journal` 深链直接激活记录视图；`.view-tabs role=tablist`、`#journalTab role=tab aria-selected=true aria-controls=journalView`、`#journalView role=tabpanel aria-labelledby=journalTab` 均正确。
  - 主导航方向键正常：焦点在「记录」时 ArrowRight 切到 `maps`，ArrowLeft 回到 `journal`。
  - 表单连续录入 4 局（源氏负、源氏平、安娜胜、安娜胜）后，列表即时为 4 条，`localStorage.ow-journal` 为 4 条；统计显示总场次 4、总胜率 66.7%、今日 4 局 66.7%、当前连胜 2、最近走势 `WWDL`。
  - 英雄趋势表包含安娜 2 场 100.0%、源氏记录；地图趋势表包含国王大道和伊利奥斯记录。
  - 刷新页面后 4 条记录和 66.7% 统计保持。
  - 删除单条后列表和 storage 变为 3 条；清空全部经确认后 storage 移除、列表 0 条、空态显示「记录你的第一局，长期看胜率趋势」。
  - 损坏 `localStorage.ow-journal` 为 `{bad json` 后刷新，记录页不崩溃，回退 0 局空态。
  - Service Worker cache keys 包含 `ow-cache-v10`，`ow-cache-v10` 内可匹配 `./src/journal.js`。
  - DevTools offline 后刷新 `#/journal`，英雄下拉 53 个 option、地图下拉 26 个 option，离线保存 1 局后列表和 storage 均为 1 条。
  - 375px 移动视口 `documentElement.scrollWidth === innerWidth === 375`，无横向溢出。
  - 应用级 `console.error`、`console.assert` failure 和 runtime exception 数量为 0。

## Phase 9 已完成

- 已实现 PWA 可安装与离线 app shell，未引入框架、构建、依赖或 Workbox，未提交 git commit。
- 新增 `manifest.webmanifest`：`name/short_name/description/lang/dir/start_url/scope/display/orientation/theme_color/background_color` 完整；图标包含 `192x192`、`512x512` 和 `purpose:"maskable"`。
- 新增真实 PNG 图标：`icons/icon-192.png`、`icons/icon-512.png`、`icons/maskable-512.png`，均为可安装用 PNG。
- 新增根级 `sw.js`：版本化缓存 `ow-cache-v9`；install 预缓存 `./`、`index.html`、manifest、icons、全部 `src/*.js`、`src/styles.css` 和 `data/*.json`；activate 清理旧缓存；`skipWaiting()` + `clients.claim()`。
- SW 对同源导航/静态资源使用缓存优先并后台更新；离线导航回退缓存的 `index.html`；`overfast-api.tekrop.fr` 请求直接 return，不拦截、不缓存。
- 新增 `src/pwa.js`：仅在非 `file:`、支持 Service Worker 且安全上下文中注册 `./sw.js`；注册失败只 warning，不影响主功能；检测到新 SW installed 时显示底部“有更新，点击刷新”提示，全部用 DOM API。
- `index.html` 新增 theme-color、图标和 PWA 动态接入；`file://` 下不挂载 manifest/app module/PWA 注册脚本，显示 HTTP 运行提示，避免 Chrome file CORS 报错。
- `src/app.js` 入口兼容动态 module 加载：如果 `DOMContentLoaded` 已发生则直接 `init()`；地图页在 OverFast `/maps` 失败时回退 `data/maps_meta.json` 的本地静态地图数据，离线可看 25 张竞技图静态文本。
- 已将已处理的外部 API/数据加载失败日志降为 `console.warn`，用户仍看到原有友好错误态，避免验收中的应用级 console error。
- `README.md` 已补充 PWA、离线、Service Worker 与 OverFast 透传说明。

## Phase 9 验证记录

- 静态检查：
  - `node --check src/app.js && node --check src/api.js && node --check src/counter.js && node --check src/data.js && node --check src/pwa.js && node --check src/recommend-hero.js && node --check src/stats.js && node --check src/theme.js && node --check sw.js`
  - `rg -n "innerHTML" index.html src sw.js manifest.webmanifest README.md` 无命中
  - `file icons/*.png` 确认 192/512/maskable 均为 PNG image data
- Headless Chrome/CDP 验收通过：
  - Manifest 可读且安装字段有效：`name=守望先锋助手`、`display=standalone`、包含 192、512、maskable 图标。
  - SW 注册成功；`ow-cache-v9` 预缓存包含 `index.html`、`src/app.js`、`src/pwa.js`、`src/styles.css`、`data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`manifest.webmanifest` 和 3 个 icon；造出的 `ow-cache-old` 在 activate 后被清理。
  - Cache Storage 中无任何 `overfast-api.tekrop.fr` 条目；在线真实 `fetch('https://overfast-api.tekrop.fr/maps')` 返回 `200` 和 57 张地图，确认 SW 未拦截外部 API。
  - DevTools offline 后刷新 `#/heroes` 渲染 52 张英雄卡。
  - DevTools offline 后 `#/counter` 渲染 52 个敌方英雄 chip，克制计算器可用。
  - DevTools offline 后 `#/compare/genji,ana` 恢复对比表。
  - DevTools offline 后 `#/meta` 渲染 Meta 表。
  - DevTools offline 后 `#/updates` 渲染英雄时间线。
  - DevTools offline 后 `#/maps` 显示本地 `maps_meta` 静态回退数据。
  - DevTools offline 后 `?overlay=1` 保持 `body.is-overlay`，overlay 可见且有 52 个 chip。
  - DevTools offline 后 `#/profile` 查询玩家显示中文友好网络错误态，不白屏不崩。
  - 375px 移动视口 `scrollWidth - innerWidth <= 1`，无横向溢出。
  - `file://.../index.html` 下不挂载 manifest/app module/PWA 注册脚本，显示 `http.server` 提示。
  - 应用级 `console.error`/runtime exception 数量为 0。浏览器资源日志中出现的错误来自测试用同源 404 页面和离线时外部图片/头像资源 `ERR_INTERNET_DISCONNECTED`，不属于应用 JS 异常。

## 已完成

- Phase 8 无障碍全面化已完成，未引入框架/构建/依赖，未提交 git commit。
- `index.html` 新增 skip link（`#main`）、主导航 `role="tablist"`/tab id、主内容 `tabindex="-1"`、动态区 `aria-live`，并将详情抽屉面板标识为 `#detailDialog role="dialog" aria-modal="true" aria-labelledby="detailTitle"`。
- `src/app.js` 新增 a11y 初始化与同步：`.view-tab[data-view]` 使用 `role="tab"`、`aria-selected`、`aria-controls`、roving `tabindex`；`.view` 使用 `role="tabpanel"`、`aria-labelledby`；←/→/Home/End 可移动焦点并切换视图，点击与 hash 路由保持不变。
- 详情抽屉已实现焦点管理：打开时记录触发元素、解除抽屉 `inert`、背景区域 `inert`/`aria-hidden`、焦点移入关闭按钮；Tab/Shift+Tab 在抽屉内循环；Esc/关闭/scrim 关闭后解除背景 inert 并还原焦点，深链打开无触发元素时回退到当前 tab/main。
- 战绩表、对比表、Meta Tier 表均补 `<caption class="sr-only">`；表头/行头补 `scope`；战绩表按 `state.heroSort` 同步 `aria-sort`，点击排序后 `aria-sort` 跟随更新。
- 动态结果/状态区域补 `aria-live`：克制结果、已选敌方、战绩搜索/结果、地图状态/详情、推荐器、补丁列表、对比内容、英雄筛选结果；`setApiState(..., "error")` 自动切到 `aria-live="assertive"`。
- `src/styles.css` 新增 `.sr-only`、`.skip-link`、全站统一 `:focus-visible` 轮廓；浅/深主题 token 小幅加深，正文/次要文字、蓝红胜率、primary、tier/warn/good 等关键颜色达到 AA；Meta 表格在移动端使用卡片内横向滚动，根层禁止页面横向溢出。
- Overlay 模式保持短路：`?overlay=1` 下 topbar/tabbar 隐藏、overlay 面板显示、路由不打开详情/对比视图，skip link/tablist 不报错。

## Phase 8 验证记录

- 静态检查：
  - `for f in src/*.js; do node --check "$f" || exit 1; done`
  - `git diff --check`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" .` 无命中
- Headless Chrome/CDP 验收通过：
  - 首页英雄库渲染 52 张 `.hero-card`，52 个收藏按钮、52 个对比按钮；推荐器初始 8 张推荐卡；克制计算器输入“源氏 ana”渲染 15 条推荐。
  - 主导航 `role=tablist`，8 个 `.view-tab` 均为 `role=tab`、`aria-controls=${view}View`、roving `tabindex`；8 个 `.view` 均为 `role=tabpanel`、`aria-labelledby`；ArrowRight、End、Home 可切换并同步 `aria-selected`。
  - skip link 聚焦后可见并指向 `#main`。
  - 英雄卡键盘 Enter 打开详情抽屉；抽屉 `#detailDialog` 有 `role=dialog`、`aria-modal=true`、`aria-labelledby=detailTitle` 且 `#detailTitle` 存在；打开后焦点位于 `#closeDrawer`，背景 `#main` inert，抽屉自身非 inert。
  - 抽屉内连续 Tab 24 次和 Shift+Tab 均未逃出；Esc 关闭后 `#detailDrawer inert=true`、`aria-hidden=true`、背景解除 inert，焦点还原到触发英雄卡。
  - `#/compare/genji,ana` 对比表有 caption，thead `th scope=col`，tbody `th scope=row`，15 行数据正常。
  - Meta Tier 表有 caption，thead `th scope=col`，tbody `th scope=row`，保留 12 个 `.tier-cell`。
  - 使用 CDP mock OverFast 响应验证战绩表：caption 为“玩家英雄战绩表”，7 个列头 `scope=col`，3 个英雄行头 `scope=row`；默认 `games` 列 `aria-sort=descending`，点击胜率后 `winrate` 列变为 `aria-sort=descending`。
  - `#counterResults/#selectedEnemies/#playerSearchState/#mapsState/#compareContent/#heroGrid` 等动态区为 `aria-live=polite`；错误态验证为 `assertive`。
  - 浅色主题对比度抽样：正文 16.07、次要文字 4.89、primary 5.40、胜率蓝 5.93、失败红 4.90、白字 on primary 5.40，均达 AA。
  - 深色主题对比度抽样：正文 13.27、次要文字 6.29、primary 6.69、胜率蓝 6.05、失败红 5.76，均达 AA。
  - 375px 视口检查 `heroes/compare/updates/counter/profile/meta/ban` 视图 `scrollWidth === clientWidth`，无页面横向溢出。
  - `?overlay=1#/compare/genji,ana` 保持 `body.is-overlay`，topbar 隐藏、tabbar display none、overlay 可见、详情未打开。
  - console/runtime error 数量为 0。
- 外部 OverFast 真实 Jay3 请求在一次验收中超时并显示“请求超时，请稍后再试。”；已用 CDP mock 响应覆盖战绩表语义与排序验收，避免将外部 API 抖动误判为本地回归。

- Phase 7 英雄对比已补齐执行方缺口，未引入框架/构建/依赖，未提交 git commit。
- `index.html` 已有 `data-view="compare"` 导航、`compareView` section、`#compareContent/#compareCount` 和底部 `#compareTray` 容器。
- `src/app.js` 新增对比数据层：`state.compare` 为有序数组，最多 4 位；`localStorage` key 为 `ow-compare`；读写均有 try/catch 容错，损坏数据回退空集合。
- 英雄卡和详情头部对比按钮使用 `button[data-compare-hero]`、`aria-pressed`、`aria-label`；切换后刷新所有对比按钮态，且不会触发打开详情。
- 底部对比盘显示已选英雄头像/名，支持单个移除、清空和查看对比；为空时隐藏，超 4 位时显示提示且不超限。
- 对比视图 `#/compare/<ids>` 使用 DOM API 渲染并排表格，包含职业、Tier、难度、总有效生命、HP/Armor/Shield、DPS/HPS、射程、机动、站位、标签、Ban 优先级和代表克制；数值最优项加 `.is-best`，缺值显示 `—` 且不参与比较；外层 `.compare-table-wrap` 横向滚动。
- Hash 路由新增 `#/compare/<id1>,<id2>,...`，非法/重复 id 跳过；`switchView("compare")` 和对比集合变化会同步 hash，`?overlay=1` 下仍短路。
- `src/styles.css` 新增 `.compare-btn`、`.detail-head-actions`、`.compare-tray`、`.compare-table/.is-best/.compare-table-wrap`、`.hero-card:focus-visible`、`.compare-btn:focus-visible`，并补 920/768/375px 响应式规则。
- Phase 6 URL Hash 路由 / 深链 + 英雄收藏已完成，未修改 `data/`、`docs/` 或 `.ai/TASK.md`，未引入框架/构建/依赖。
- `src/app.js` 新增纯静态 hash 路由层：初始化在数据加载完成后解析 hash；监听 `hashchange`；`switchView()`、`openDetail()`、`closeDetail()` 在 overlay 之外同步 hash；`?overlay=1` 下路由读写整体短路，不干扰 Overlay 模式。
- 英雄详情深链 `#/hero/<id>` 会切到英雄库背景并打开对应抽屉；非法 hash 或非法 hero id 不崩溃，回退 `#/heroes`。
- `src/app.js` 新增收藏数据层：`localStorage` key 为 `ow-favorites`，内存态为 `state.favorites: Set`，读写均有 try/catch 容错，损坏数据回退空集合。
- 英雄卡右上角新增 ★/☆ 收藏按钮，包含 `aria-pressed` 和 `aria-label`；点击星标只切换收藏，不会冒泡打开详情。
- 详情抽屉头部新增收藏按钮，与英雄卡同步；切换后立即刷新英雄库并更新详情按钮状态。
- 英雄库筛选区新增“只看收藏”开关；开启后只显示收藏英雄；无收藏时显示“还没有收藏英雄，点卡片右上角 ★ 添加”；未开启时收藏英雄在当前过滤结果中置顶。
- `src/styles.css` 新增收藏星标和收藏筛选 pill 样式，复用 `--warn`、`--primary`、`--border`、`--surface` 等现有 token，并保留 375px 响应式无横向溢出。
- `README.md` 已补充深链 URL 示例、hash 路由和英雄收藏说明。

## Phase 6 data-view → hash 映射

| data-view | section id | hash |
| --- | --- | --- |
| `heroes` | `heroesView` | `#/heroes` |
| `updates` | `updatesView` | `#/updates` |
| `counter` | `counterView` | `#/counter` |
| `profile` | `profileView` | `#/profile` |
| `maps` | `mapsView` | `#/maps` |
| `meta` | `metaView` | `#/meta` |
| `ban` | `banView` | `#/ban` |
| `compare` | `compareView` | `#/compare` 或 `#/compare/genji,ana` |
| 英雄详情 | `detailDrawer` over `heroesView` | `#/hero/<id>`，例如 `#/hero/genji` |

说明：当前 DOM 中实际 `data-view` 为 `profile` 和 `ban`；任务文本中的 `players`、`recommend` 不是现有导航视图，因此未新增不存在的 hash 入口。

## Phase 7 验证记录

- 静态检查：
  - `for f in src/*.js; do node --check "$f" || exit 1; done`
  - `git diff --check`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" src index.html README.md docs data` 无命中
- Headless Chrome/CDP 验收通过：
  - 首页英雄库渲染 52 张 `.hero-card`，52 个收藏按钮和 52 个对比按钮；`document.querySelectorAll("button button").length === 0`。
  - `.hero-card` 聚焦后 Enter 打开英雄详情，hash 变为 `#/hero/reinhardt`。
  - 点击 ★ 只切换收藏态，不打开详情；点击对比按钮只加入对比，不打开详情。
  - 对比盘可添加、单个移除、清空；添加第 5 位时 `ow-compare` 保持 4 位并显示“最多同时对比 4 位英雄”提示。
  - `#/compare/genji,ana` 深链恢复 `["genji","ana"]`，激活 `compareView`，对比表 2 个英雄列，`.is-best` 数值高亮存在，`.compare-table-wrap` 为 `overflow-x:auto`。
  - 刷新后仍保持 `#/compare/genji,ana` 和 `ow-compare=["genji","ana"]`。
  - `?overlay=1#/compare/genji,ana` 保持 `body.is-overlay`，topbar 隐藏，overlay 可见，详情未打开，对比视图未激活。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime error 数量为 0。

## Phase 6 验证记录

- 静态检查：
  - `for f in src/*.js; do node --check "$f" || exit 1; done`
  - `rg -n "innerHTML|insertAdjacentHTML|outerHTML" .` 无命中
- Headless Chrome/CDP 验收通过：
  - 直接打开 `http://127.0.0.1:8000/#/maps` 激活 `mapsView`，hash 保持 `#/maps`。
  - 直接打开 `http://127.0.0.1:8000/#/hero/genji` 激活 `heroesView` 并打开源氏详情抽屉。
  - 点击 tab 到 `#/counter`、再到 `#/heroes`、点击英雄卡到 `#/hero/<id>`；浏览器后退依次关闭详情并回到 `#/counter`，前进依次回到 `#/heroes` 并重开详情。
  - 英雄卡 ★ 点击不会打开详情；`ow-favorites` 持久化；刷新后收藏状态保持。
  - “只看收藏”只显示收藏英雄；在详情中取消收藏后英雄库立即变空并显示收藏空态。
  - `?overlay=1#/hero/genji` 下 body 保持 `is-overlay`，topbar 隐藏，overlay 可见，详情未被路由打开。
  - 非法 hash `#/not-a-real-route` 回退 `#/heroes`，无崩溃。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime error 数量为 0。

- Phase 5 视觉改版已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`docs/` 或 `.ai/TASK.md`。
- Phase 5 视觉改版已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`docs/` 或 `.ai/TASK.md`。
- `src/styles.css` 已整体重写为 OP.GG / OverHub 式浅色数据门户风：`:root` 默认浅色 token、`[data-theme="dark"]` 深色 token、冷灰背景 `#F2F3F7`、白卡、OP.GG 蓝 `#5383E8`、细边框轻阴影、蓝色激活下划线 tab、斑马/hover 数据表、tabular 数字、胜率蓝红、英雄头像 tile、补丁/time line、地图卡、段位/表现卡、overlay 紧凑卡和 768/375 响应式规则。
- `index.html` 顶栏改为 logo + 顶栏 BattleTag 搜索壳 + 主题切换按钮 + season pill + Overlay 入口；主导航独立为 OP.GG tab 条；内容区使用 `main.app-shell` 居中 `max-width:1080px`。保留了 `app.js` 依赖的所有核心 id、`.view`、`.view-tab`、`.hero-card`、`#heroGrid` 和 `data-*` 事件 hook。
- 新增 `src/theme.js` 和 head 内初始化脚本：默认浅色，读写 `localStorage` 的 `ow-theme`，切换 `documentElement.dataset.theme` 并更新按钮状态，避免主题 FOUC。
- `src/app.js` 仅给 `tier-badge` 补充 `data-tier="S|A|B|C"` 样式属性，用于严格实现 S 红、A 橙、B 绿、C 灰；未改函数签名、数据流或功能行为。
- `README.md` 已补充主题切换和新样式说明。
- Phase 4 增量已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`data/patches.json`、`docs/` 或 `.ai/TASK.md`。
- `src/data.js` 新增 `loadPatches()`，只读加载 `data/patches.json`，规范化 `_meta/timeline/patches/changes`，按补丁日期倒序排序，并建立最新补丁 `hero id -> changes[]` 索引；加载失败返回空结构，不影响英雄库等已有页面。
- 顶部导航新增“更新”tab。更新页包含 2026 英雄时间线 9 项，按日期升序展示头像、中文名、职业、日期、season、note；`latestHero=shion` 显示发光高亮和“★最新”。
- 更新页补丁日志支持多个补丁，按日期倒序渲染标题、日期、season、headline、新英雄/新图、统计和逐英雄改动。每条改动包含头像、中文/英文名、type 徽章和改动文本，支持职业、type、英雄名/文本搜索筛选，点击可打开英雄详情。
- 英雄卡片新增近期调整角标：最新补丁 `changes` 涉及的英雄显示按 type 上色的徽章，`title` 提示“近期有调整”。D.Va/死神等已显示。
- 英雄详情新增“近期调整”分区，列出该英雄在最新补丁中的 type 和改动文本；源氏详情已验证显示“闪格挡 CD 10→8 秒；Meditation 治疗 35→50/秒”。
- 英雄库紫苑卡片新增 `NEW` 角标和最新英雄边框高亮；英雄库标题处新增“当前最新英雄：紫苑 Shion(S3 入虎穴)”。
- 继续保持无框架、无构建；补丁数据渲染均使用 `textContent`/DOM API，没有 `innerHTML`/`insertAdjacentHTML`/`outerHTML` 注入。
- Phase 3 增量已完成，未修改 `data/heroes.json`、`data/maps_meta.json`、`docs/` 或 `.ai/TASK.md`。
- 新增 `src/recommend-hero.js`：`recommendHeroes(filters, heroes)` 纯函数按职业、难度上限、风格标签筛低难英雄，按 tier/难度排序并生成新手理由，含 `console.assert` 自测。
- 英雄库顶部新增“我该玩谁”折叠面板，风格标签从 `heroes.json` 动态收集，结果卡可打开英雄详情。
- 克制计算器新增“我当前英雄”下拉和“换不换顾问”。顾问复用 counter 分值，莱因对法鹰/黑百合会提示偏劣势并给同职业更优解，D.Va 对同阵容会提示能打；若已加载玩家战绩，会显示当前英雄场次/胜率并软化建议。
- `src/data.js` 新增 `loadMapMeta()`，只读加载 `data/maps_meta.json`，失败返回空 Map。
- 地图详情优先使用 `maps_meta.json` 展示 archetype、terrain、favors、against、tip 和“此图强势英雄”头像行；缺少 meta 的地图继续回退 Phase 2 英雄地图文本聚合。地图卡片有 meta 时显示地形角标。
- `src/stats.js` 新增 `buildPerformanceCards(heroStats)` 纯函数和自测；战绩页加载玩家后在英雄表上方渲染本命、胜率王、伤害/治疗担当、最稳 2-4 张表现卡片。
- 页脚新增社区需求来源说明，明确未伪造 workshop 代码或不存在的数据。
- 继续保持无框架、无构建；新增动态数据渲染均使用 `textContent`/DOM API，没有新增 `innerHTML` 注入。

## Phase 1/2 基础

- 在 Phase 1 静态 SPA 上完成 Phase 2 增量扩展，未修改 `data/heroes.json` schema、`docs/` 或 `.ai/TASK.md`。
- 只读消费 `data/heroes.json`，兼容 `{ meta, heroes }` 和裸数组两种数据形态。
- 英雄库支持职业 tab、tier、ban 优先级、中文/英文/标签搜索。
- 英雄卡片和详情使用官方 `portrait` 字段，加载失败回退首字占位。
- 英雄详情面板展示参数血量、被动/武器/主动技能/大招、Perk、站位、克制关系、地图、ban 理由和各分段打法。
- 克制计算器支持选择或输入 1-5 个敌方英雄，按职业输出 Top 推荐。
- `src/counter.js` 提供 `recommend(enemyIds, heroes)` 纯函数，并包含 `console.assert` 自测。
- 新增 `src/api.js`：OverFast fetch 封装、超时、失败归一、重试 1 次、localStorage 缓存、`junker-queen/soldier-76/wrecking-ball` 双向 key 映射。
- 新增 `src/stats.js`：英雄战绩整理、排序、职业汇总、段位中文格式化和 `console.assert` 自测。
- 战绩查询页：`/players` 搜索候选，选中后并发加载 `/summary` 和 `/stats/summary`，渲染玩家档案、PC/主机段位、总览、可排序英雄战绩表；英雄行点击打开详情并附加“你的此英雄战绩”。
- 地图页：调用 `/maps` 渲染 57 张地图，支持模式筛选，点地图后用本地 `maps.strong/weak/note` 文本关键词聚合强势/劣势英雄。
- Meta 页：本地聚合 role × tier 网格、high/medium/low Ban 三栏和职业打法速览。
- Overlay 模式：`?overlay=1` 进入紧凑浮层，只显示克制计算器和 Meta Ban 速览；正常模式右上角有入口。
- Ban 助手按 priority 排序展示建议名单和理由。
- 统一加载/错误态，接口失败显示中文提示，不白屏。外部 API 文本均用 `textContent` 写入。
- `README.md` 写明本地运行方式、功能、API 缓存和已知约束。

## 如何运行

```bash
python3 -m http.server 8000
```

打开：

```text
http://localhost:8000
```

Overlay 模式：

```text
http://localhost:8000/?overlay=1
```

## 验证记录

- Phase 5 静态检查：
  - `node --check src/app.js && node --check src/theme.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data docs .ai/TASK.md` 无输出
- Phase 5 headless Chrome/CDP 验收通过：
  - 默认浅色 token 为 `--bg:#F2F3F7`、`--primary:#5383E8`，首页英雄库渲染 52 位英雄，顶栏 `#playerSearchInput` 保留。
  - 主题切换到深色后 `localStorage.ow-theme=dark`，刷新后仍为深色；再切回浅色正常。
  - 7 个视图 `heroes/updates/counter/profile/maps/meta/ban` 均可激活，视觉统一。
  - 点击英雄卡打开详情抽屉；克制计算器输入“源氏 ana”输出 15 条推荐；更新页 latest/new/patch type 徽章正常；“我该玩谁”渲染 8 条推荐。
  - 搜索 `Jay3` 返回 12 个候选，选中后渲染 3 张段位卡和 13 行英雄战绩表。
  - 地图页渲染 57 张地图并显示地图详情；Meta 页渲染 12 个 tier 单元、3 个 ban 栏和 3 条职业速览。
  - Tier S/A/B 实际颜色分别为红/橙/绿，C 灰色 token 存在；当前数据集中没有 C tier 英雄实例。
  - `?overlay=1` 渲染 2 个紧凑 overlay 面板，独立 tab 条隐藏。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出；console/runtime 无 error/assert/exception。
- Phase 4 静态检查：
  - `node --check src/app.js`
  - `node --check src/data.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data/heroes.json data/maps_meta.json data/patches.json docs/SCHEMA.md docs/API.md docs/SOURCES.md .ai/TASK.md` 无输出
- Phase 4 headless Chrome/CDP 验收通过：
  - 首页英雄库渲染 52 位英雄，最新英雄文案为“当前最新英雄：紫苑 Shion(S3 入虎穴)”。
  - 更新页时间线 9 项，紫苑项为 `.is-latest` 且包含“★最新”。
  - 更新页补丁日志初始渲染 31 条改动，统计为 `15强化10削弱5调整1重做`。
  - type 筛选 `nerf` 后渲染 10 条，所有徽章为 nerf 样式。
  - 搜索“源氏”后 1 条改动，点击打开详情，详情包含“近期调整”和“闪格挡”改动文本。
  - 英雄库搜索 `shion` 后紫苑卡片存在 `NEW` 角标；D.Va/死神卡片存在近期调整徽章。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime 无 error/assert/exception。
- Phase 3 静态检查：
  - `node --check src/app.js`
  - `node --check src/data.js && node --check src/counter.js && node --check src/stats.js && node --check src/recommend-hero.js`
  - `rg "innerHTML|insertAdjacentHTML|outerHTML" -n src index.html` 无命中
  - `git diff -- data/heroes.json data/maps_meta.json docs/SCHEMA.md docs/API.md .ai/TASK.md` 无输出
- Phase 3 headless Chrome/CDP 验收通过：
  - A：输出职业、难度≤2 推荐包含堡垒、士兵：76、狂鼠，且无未知难度 0/5。
  - B：敌方含 `pharah/widowmaker` 时，莱因哈特提示偏劣势并建议同职业更优解；D.Va 提示能打、别急着换。
  - C：国王大道显示“近身缠斗/室内转角多”、地形要点和 6 个强势英雄头像。
  - D：搜索并选中 Jay3 后出现 2 张表现卡片。
  - 375px 视口 `scrollWidth === clientWidth`，无横向溢出。
  - console/runtime 无 error/assert/exception。
- 已启动 `python3 -m http.server 8000`。
- 已用 Chrome headless/CDP 自动化验证：
  - 首页英雄库渲染 52 位英雄，Phase 1 克制计算器可输出 15 条职业推荐。
  - 战绩查询搜索 `Jay3` 返回 12 个候选；选中候选后渲染段位/总览/13 行英雄战绩；点击英雄行能打开详情并显示“你的此英雄战绩”。
  - 地图页渲染 57 张地图，地图详情包含强势英雄聚合。
  - Meta 页渲染 12 个 tier 单元、3 个 ban 栏、3 条职业速览。
  - `?overlay=1` 渲染紧凑克制结果和 8 条 Ban 速览。
  - 375px 视口无横向溢出，console 无 error/exception。

## 已知问题

- Phase 5：当前英雄数据只有 S/A/B tier，没有 C tier 英雄可实测展示；CSS 变量和选择器已包含 C 灰色。
- Phase 4 补丁追踪目前依赖 curated `data/patches.json`；新增补丁需要继续按同结构追加数据。若某条 change 的 hero id 不在英雄库中，该条仍会显示文本但头像/详情跳转会回退或禁用。
- OverFast 是非官方公共 API；如果接口限流、CORS 或网络失败，页面会显示中文错误提示，但无法离线生成真实玩家战绩。
- 地图强势/劣势聚合基于本地 `maps.strong/weak/note` 文本关键词匹配。英文地图名和中文旧地图名不完全一致时，会主要依赖模式/地形词匹配。
- Counter 仍按 schema 中的 `strongAgainst` / `weakAgainst` 计算，`synergy` 暂不计分。
- “换不换顾问”只使用本地 counter 关系和玩家英雄场次/胜率做软化提示，不会判断实时地图、队伍沟通、绝活熟练度以外的上下文。
