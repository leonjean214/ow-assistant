# Task Phase 20：Meta 视图增强

> Phase 1-19 全部功能须保留不回归。增强现有 Meta 视图（`#/meta`，目前=Tier 网格 + Ban 三栏 + 职业打法速览）：新增「各职业强势榜（按 Tier 排序的 Top 英雄，可点跳详情）」+ 顶部当前版本/赛季提示。纯前端、复用现有数据、0 innerHTML、零构建。

## Context（务必遵守）
- Meta 视图渲染：`renderMetaDashboard()`（app.js），容器含 `#tierGrid`、`#banBoard`、`#rolePassives`（见 index.html metaView）。
- 数据：`state.heroes`(含 role/tier/nameZh/name/ban)、`state.byId`、赛季在 `data/heroes.json` meta（已由 renderMetaText 写到 `#dataMeta`：「赛季 Season 3：Into the Tiger's Den ... · 更新 ...」）。helper：`create/appendText/createAvatar/createBadge(tier,"tier-badge")/ROLE_LABELS`、`openDetail`。
- tier 排序：S>A>B>C（无效垫底）。
- 详情跳转：用 `data-jump-hero` + 在容器委托 openDetail（metaView 是否已有 jump 委托？若无则加；不要破坏现有 tierGrid/banBoard 交互）。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook；overlay/路由不受影响。

## Requirements
1. **当前版本提示条**：Meta 视图顶部加一条赛季/版本提示（读 `data/heroes.json` meta.season + updated，或复用已加载的 state.meta；若 app 未存 meta，可从 `#dataMeta` 文案或新存 `state.meta`——优先 `state.meta`，在数据加载时存一份）。文案如「当前 Season 3：Into the Tiger's Den（2026-06-16）· tier/ban 为当前 meta 经验值，随补丁变」。
2. **各职业强势榜**：新增分区，按 tank/damage/support 三列（或三块），每职业列出该职业英雄按 Tier 排序的 Top N（N=6 或全部，自定但≥5），每项=头像+中英名+tier 徽章，点击 `openDetail`。
3. **可跳转**：强势榜与（若可行）现有 tierGrid 的英雄项支持点击开详情（用 data-jump-hero 委托，别破坏现有）。
4. **空态/兜底**：无英雄数据时友好占位；缺 tier 的英雄归入「未定级」或垫底。
5. **a11y/响应式**：新分区有标题/语义；≤768/375px 三列堆叠不溢出；深浅主题协调。

## Constraints
- 不改现有 JS 对外签名/数据流；可扩展 `renderMetaDashboard` 或加 `renderMetaStrongList`、metaView 容器、样式；若需存 `state.meta` 在数据加载处补一行。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入（全 DOM API + CSS）。复用 token，深浅主题协调。
- Phase 1-19 全功能不回归；overlay(`?overlay=1`)不受影响。
- 不需新 sw 缓存项（无新文件；逻辑写进 app.js）。

## Implementation Plan（建议）
1. （如需）数据加载处存 `state.meta = data.meta`。
2. index.html metaView 加：版本提示条容器 + 强势榜容器（给稳定 id，如 `#metaSeasonNote`、`#metaStrongList`）。
3. app.js：renderMetaDashboard 内或新函数填这两块；强势榜按 role×tier 排序取 Top；英雄项 data-jump-hero；metaView 容器 click 委托 openDetail（若未有）。
4. styles.css：版本提示条、强势榜三列卡、英雄项、响应式。
5. 自测（无头 Chrome + tools/qa.mjs 加 meta 用例）：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- Meta 视图顶部显示当前赛季/版本提示（Season 3 文案正确）。
- 各职业强势榜按 Tier 排序展示 Top 英雄（头像+名+tier 徽章），点击开详情。
- 缺 tier 兜底；空态友好；375px 无横向溢出；深浅主题协调。
- Phase 1-19 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（含新增 meta 用例）。

## Review Focus（Codex 自查）
- 强势榜 role×tier 排序与缺 tier 兜底正确。
- meta 视图新委托不破坏 tierGrid/banBoard 现有交互。
- state.meta 来源可靠（数据加载存或安全回退）。
- 0 innerHTML；overlay/路由不受影响；375px 无页面横向溢出。
