# Task Phase 11：session 增强 —— 导出/导入 + 战绩分享图卡

> Phase 1-10 全部功能须保留不回归。在 Phase 10「记录」模块上增量：①记录导出/导入(JSON，跨设备/备份)；②把统计卡渲染成可下载的分享图片(canvas)。仍零构建、离线可用、0 innerHTML。

## Goal
1. **导出/导入**：把 `ow-journal` 记录导出为 JSON 文件下载；从 JSON 文件导入(合并或替换，去重)，容错损坏文件。
2. **战绩分享图卡**：「记录」视图一键把当前统计(总/今日胜率、连胜、最近 10 局走势、Top 英雄)绘制到 canvas，生成 PNG 可下载/复制，OP.GG 风格，深浅主题色。

## Context（现状）
- 纯静态零构建 SPA，ES module。记录模块在 `src/journal.js`(loadJournal/saveJournal/addJournalEntry/removeJournalEntry/clearJournal/summarizeJournal/aggregateByHero/aggregateByMap/normalizeJournalEntries 等) + app.js 的 `renderJournal*` + `journalView`(`#/journal`)。
- 数据：localStorage `ow-journal`，条目 `{id,ts,result,heroId,mapKey|mapName,role,enemyNote?,note?}`，上限 1000。
- 主题 token：`--primary #5383E8`、`--win/--loss/--good/--surface/--text` 等；`document.documentElement.dataset.theme` 为 `light|dark`。
- SW 预缓存清单在 `sw.js` APP_SHELL，新增 js 要加入并升级 `CACHE_NAME`(→ v11)。
- helper：`create/appendText/createBadge/createAvatar/fallback`；统计来自 `summarizeJournal(state.journalEntries, state.byId)`。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库。

## Requirements
1. **导出**：「记录」视图加「导出」按钮 → 生成 `Blob`(application/json) → `URL.createObjectURL` + 临时 `<a download>` 触发下载，文件名含日期(如 `ow-journal-2026-06-20.json`)。导出内容含 `{ version:1, exportedAt, entries:[...] }`。用完 `revokeObjectURL`。
2. **导入**：「导入」按钮 → 隐藏 `<input type=file accept=".json,application/json">` → 读文件 `FileReader`/`text()` → `JSON.parse` try/catch → 校验结构(数组或 `{entries}`)→ 用 `normalizeJournalEntries` 过滤 → **按 `id` 去重合并**(默认合并到现有；若 id 冲突保留较新 ts)，可提供「合并/替换」二选(简单起见：默认合并，附一个「替换全部」勾选或二次确认)。导入后落 localStorage(尊重 1000 上限，保最新)、即时刷新统计/表/列表、aria-live 提示「导入 N 条，去重后共 M 条」。损坏文件给友好错误，不崩。
3. **journal.js 增强**：加纯函数 `serializeJournal(entries)`→导出对象、`parseImportedJournal(text)`→`{entries, error}`、`mergeJournal(existing, incoming)`→去重合并按 ts，含 console.assert 自测(合并去重/损坏/冲突保新)。
4. **分享图卡**：「生成分享图」按钮 → 用 `<canvas>`(设 devicePixelRatio 缩放保清晰) 绘制：标题「我的守望先锋战绩」、赛季/日期、总场次+总胜率(大字)、今日、当前连胜、最近 10 局走势色块、Top 3 英雄(名+胜率)。配色取当前主题 token(可 `getComputedStyle` 读 CSS 变量)。绘制完 `canvas.toBlob` → 提供下载 PNG(文件名含日期)，并尝试 `navigator.clipboard.write`(失败仅提示，不报错)。卡片尺寸适合分享(如 1080×1350 或 1200×630)。
5. **空态**：无记录时导出/分享按钮禁用或点了给提示「先记录几局再导出/分享」。
6. **离线**：全部本地 + canvas，断网可用；`src/journal.js`(已在缓存)更新 + 若新增 `src/share-card.js` 要进 sw APP_SHELL 并升级版本。

## Constraints
- 不改现有 JS 对外签名/数据流；可在 journal.js 加新导出函数，app.js 挂接，index.html 加按钮/隐藏 input/canvas 容器，styles.css 加样式。
- 只读 `data/`，不改 `data/`、`docs/`(本 TASK 除外；允许在 docs/ROADMAP.md 标记本阶段完成)。不引框架/构建/库。
- 0 innerHTML 注入数据。复用 token，深浅主题协调。
- Phase 1-10 全部功能不回归；overlay 不受影响。
- 文件下载用 Blob+revokeObjectURL；剪贴板/文件读取失败都要 try/catch 友好降级。

## Implementation Plan（建议）
1. journal.js：`serializeJournal/parseImportedJournal/mergeJournal` + 自测。
2. index.html：记录视图工具条加 导出/导入(file input)/生成分享图 按钮 + 离屏或容器 canvas。
3. app.js：绑定导出(下载)、导入(读文件→merge→落库→刷新)、分享图(canvas 绘制→toBlob→下载/复制)；空态禁用。
4. (可选)`src/share-card.js` 封装 canvas 绘制；若新增则进 sw APP_SHELL + CACHE_NAME→v11。
5. styles.css：工具条/按钮/canvas 预览样式。
6. 自测(无头 Chrome)：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 导出生成含 `version/exportedAt/entries` 的 JSON 并触发下载(CDP 可验证 Blob 内容/anchor download 属性)。
- 导入合法 JSON：记录合并去重、即时刷新、localStorage 更新、提示条数；导入损坏 JSON：友好错误不崩、原数据不变。
- `mergeJournal/parseImportedJournal` 断言通过(去重、冲突保新、损坏过滤)。
- 生成分享图：canvas 绘出统计且 `toBlob` 产出 PNG(非空)，文件名含日期；深浅主题各出一版且可读。
- 无记录时导出/分享禁用或提示。
- 离线可用；新增 js(若有)进 sw 预缓存且版本升级。
- Phase 1-10 全功能不回归；`node --check` 全过；journal 自测断言通过；console 无报错；375px 无横向溢出；0 innerHTML 注入数据。

## Review Focus（Codex 自查）
- 导入去重/合并/替换语义清晰且不丢数据；1000 上限保最新。
- 损坏/超大/非 JSON 文件容错；FileReader/clipboard/toBlob 失败降级。
- canvas devicePixelRatio 清晰度；读 CSS 变量在两主题正确取色；中文字体可渲染。
- Blob URL 及时 revoke，无内存泄漏。
- 离线与 sw 版本升级后资源可加载。
