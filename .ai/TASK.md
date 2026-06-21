# Task Phase 17：英雄库排序 + 多标签筛选

> Phase 1-16 全部功能须保留不回归。本阶段增强英雄库（heroes 视图）的筛选/排序：①新增排序下拉（默认/Tier/难度/总有效生命/名称）②标签从单一搜索升级为可多选标签筛选（AND/OR）。纯前端、Mac 可全测、0 innerHTML、零构建。

## Goal
英雄库顶部筛选区新增：
1. **排序**下拉：默认（现状=收藏置顶+原顺序）、Tier 高→低、难度 低→高、难度 高→低、总有效生命 高→低、名称 A→Z。
2. **多标签筛选**：从 `data/heroes.json` 收集全部 tags，做成可多选 pill；选中后按标签过滤（默认任一命中=OR；提供一个「全部命中(AND)」开关）。与现有 role/tier/ban/search/收藏 过滤叠加。

## Context（现状，务必遵守）
- 纯静态零构建 SPA，ES module。英雄库渲染：`renderHeroGrid()` → `filteredHeroes()`（app.js）产出顺序 → `createHeroCard`。
- `state.filters = { role, tier, ban, search, favoritesOnly }`。`filteredHeroes()` 现在：按 role/tier/ban/favoritesOnly/search 过滤；未开收藏时收藏英雄置顶（`heroes.sort((a,b)=>Number(isFavorite(b.id))-Number(isFavorite(a.id)))`）。
- 英雄字段：`hero.tier`(S/A/B/C)、`hero.difficulty`(number|null)、`hero.health{hp,armor,shield}`、`hero.tags[]`、`hero.nameZh/name`。
- 筛选控件在 index.html 英雄库区（role tabs、`#tierFilter`、`#banFilter`、`#searchInput`、`#favoriteOnlyToggle`）；事件在 bindEvents，改这些 state.filters 后调 `renderHeroGrid()`。
- a11y：新控件要可键盘操作、有 label/aria；多标签 pill 用 `aria-pressed`。
- 已有 pill 样式可复用（如收藏 pill / `.tag` / `.select-chip`）。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库；不破坏现有 id/class/data-* hook。

## Requirements
1. **state 扩展**：`state.filters.sort`（字符串，默认 `"default"`）、`state.filters.tags`（数组，默认 []）、`state.filters.tagsMatchAll`（bool，默认 false=OR）。
2. **排序实现**：在 `filteredHeroes()` 过滤之后按 `sort` 排序：
   - `default`：保持现状（收藏置顶 + 原始顺序）。
   - `tier`：S>A>B>C（无效 tier 垫底），平局按原顺序。
   - `diff-asc`/`diff-desc`：难度升/降；难度为 null 的垫底。
   - `hp-desc`：总有效生命(hp+armor+shield) 降序。
   - `name`：nameZh 按 `localeCompare(zh-Hans-CN)`。
   - 非 default 排序时不强制收藏置顶（以所选排序为准）。
3. **多标签筛选**：UI 收集 `state.heroes` 全部 tags（去重排序），渲染为可多选 pill（点击 toggle，选中高亮 + `aria-pressed=true`）。`filteredHeroes()` 加：若 `tags.length`，按 `tagsMatchAll` 决定 AND/OR 命中；与其它过滤叠加（先过滤后排序）。提供「AND/OR」切换控件 + 「清空标签」。标签较多时容器可横向滚动或换行，375px 不溢出。
4. **排序下拉**：`<select>` 有 `<label>`；change 时更新 `state.filters.sort` 并 `renderHeroGrid()`。
5. **计数**：英雄库标题计数（`#heroCount`）继续反映当前结果数（已有，确认仍对）。
6. **空态**：过滤后为空时友好提示（复用现有 `#heroEmpty`，文案合理，如「没有符合条件的英雄，试试减少标签或清空筛选」）。

## Constraints
- 不改现有 JS 对外签名/数据流；可扩展 `filteredHeroes()`、bindElements/bindEvents、加新控件与样式。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/构建/库。
- 0 innerHTML 注入数据（pill/下拉全 DOM API + CSS）。复用 token，深浅主题协调。
- Phase 1-16 全部功能（路由/收藏/对比/组队/记录/工坊/个人中心/克制为什么/a11y/PWA/overlay/快捷键）不回归。
- overlay(`?overlay=1`) 不受影响。新控件纳入 a11y（label/aria-pressed/键盘）。

## Implementation Plan（建议）
1. state.filters 加 sort/tags/tagsMatchAll。
2. index.html 英雄库筛选区加：排序 `<select>` + 标签 pill 容器 + AND/OR 切换 + 清空标签按钮（给稳定 id）。
3. bindElements 注册新元素；bindEvents 绑定 change/click → 更新 state → renderHeroGrid。
4. 新函数：`renderTagFilters()`（收集 tags 渲染 pill，反映选中态）；扩展 `filteredHeroes()`（标签过滤 + 排序）。init 里调用 renderTagFilters。
5. styles.css：标签 pill 多选、排序下拉、AND/OR、清空按钮样式（深浅主题、375px）。
6. 自测（无头 Chrome）：见验收。更新 README、`.ai/HANDOFF.md`、docs/ROADMAP.md 标记完成。

## Acceptance Criteria
- 排序下拉切换各项，英雄库顺序正确变化（Tier S 在前、难度升降、HP 降序、名称排序）；default 仍收藏置顶。
- 多标签 pill 可多选，AND/OR 切换生效，与 role/tier/ban/search/收藏 叠加正确；清空标签恢复。
- 计数随筛选更新；空态文案友好。
- 新控件键盘可用、pill 有 aria-pressed；375px 无横向溢出；深浅主题协调。
- Phase 1-16 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML 注入数据。
- 用 tools/qa.mjs 跑一遍仍全过（如新增用例就一并加，保持全绿）。

## Review Focus（Codex 自查）
- 排序对 null 难度 / 无效 tier 的兜底（垫底，不报错）。
- default 排序保持收藏置顶；非 default 不再强制置顶。
- 标签 AND/OR 边界（空 tags 不过滤；全不命中→空态）。
- 与现有过滤叠加顺序：先全部过滤、再排序。
- pill 多选不影响 `#heroGrid` 现有点击/键盘委托（收藏/对比/入队/打开详情）。
- 0 innerHTML；overlay/路由不受影响。
