# Task Phase 22：全局命令面板（Cmd/Ctrl-K 快捷搜索跳转）

> Phase 1-21 全部功能须保留不回归。新增全局命令面板：`Cmd/Ctrl-K`（或顶栏入口）唤出，模糊搜索英雄/视图/玩家并一键跳转（开英雄详情 / 切视图 / 跳战绩查询）。纯前端、0 innerHTML、零构建。

## Context（务必遵守）
- 纯静态零构建 SPA，ES module。已有：`switchView(view)`、`openDetail(id)`、视图列表 `routeViews`（来自 `.view-tab[data-view]`，可拿 tab 文案做视图名）、战绩 `lookupBattletag`(若存在；否则 switchView('profile')+设 `#playerSearchInput`+runPlayerSearch)、`state.heroes`(nameZh/name/id/role)、helper `create/appendText/createAvatar/ROLE_LABELS`。
- 已有全局 keydown（document）处理 Esc/Tab 陷阱 + `/`、`b` 快捷键（含 `isTypingTarget` 守卫、overlay 短路、抽屉打开时短路）。命令面板的 Cmd/Ctrl-K 要接入这套或新增监听，注意：① 输入态也应允许 Cmd/Ctrl-K（这是带修饰键的，不与打字冲突）② overlay 模式可短路不启用。
- 详情抽屉是 modal dialog 有焦点陷阱。命令面板自身也应是可访问的浮层（role=dialog 或 listbox 模式），Esc 关闭、焦点管理得当，**不要和详情抽屉的 Tab 陷阱打架**（面板打开时优先；建议面板独立，打开时抽屉若开可先关或互斥）。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook；overlay/路由不受影响。

## Requirements
1. **唤出**：`Cmd-K`(mac)/`Ctrl-K` 打开命令面板；顶栏可加一个小入口按钮（可选，建议加，`aria-keyshortcuts="Control+K"`）。`Esc` 关闭。打开时一个输入框自动聚焦。overlay 模式下不启用。
2. **面板结构**：居中浮层(遮罩 + 卡片)，含搜索 input + 结果列表。`role="dialog" aria-modal="true" aria-label="命令面板"`；结果列表用 `role="listbox"`/`option` 或按钮列表，**键盘 ↑/↓ 选择、Enter 执行、Esc 关闭**，鼠标可点。打开时焦点入输入框，关闭后焦点还原到触发处。
3. **可搜索条目**（输入为空时给少量默认/提示，输入后过滤）：
   - **英雄**：按 nameZh/name/id 模糊匹配 → 选中 `openDetail(id)`（带头像+职业）。
   - **视图**：按 tab 文案匹配（英雄库/对比/克制网/组队/工坊/更新/克制计算器/战绩查询/记录/地图/Meta/Ban/个人中心/设置…）→ 选中 `switchView(view)`。
   - **战绩**：输入像 BattleTag（含 `#` 或无匹配英雄/视图时）给一条「搜索玩家 “xxx”」→ 选中跳战绩并搜索。
   - 匹配排序：精确/前缀优先；分组或带类型标签（英雄/视图/战绩）。
4. **过滤逻辑**：纯函数式匹配（小写包含 + 前缀加权即可），结果上限（如 20）。无结果给空态。
5. **a11y/响应式**：焦点陷阱在面板内；`aria-activedescendant` 或 roving 高亮当前项；375px 面板自适应不溢出；深浅主题协调。
6. **不破坏**：现有 `/`、`b`、Esc、Tab 陷阱、路由、overlay 照常。

## Constraints
- 不改现有 JS 对外签名/数据流；可加 `openCommandPalette/closeCommandPalette/renderCommandResults/commandMatch` 等 + keydown 接入 + 顶栏入口 + 样式。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。复用 token，深浅主题协调。
- Phase 1-21 全功能不回归；overlay(`?overlay=1`)不受影响。
- 命令面板浮层若新增到 index.html，给稳定 id（如 `#cmdPalette`/`#cmdInput`/`#cmdResults`）；逻辑写进 app.js（免动 sw）。

## Implementation Plan（建议）
1. index.html：命令面板浮层骨架(遮罩+dialog+input+results，默认 hidden)。
2. app.js：Cmd/Ctrl-K 监听(document keydown，判 metaKey/ctrlKey+key==='k')；open/close(焦点管理+记录触发元素)；input 事件→commandMatch(query) 产出条目→渲染 results；↑/↓/Enter 键盘操作；条目执行(openDetail/switchView/lookupBattletag)后关面板。
3. styles.css：遮罩、面板卡、输入、结果项(高亮/类型标签/头像)、响应式。
4. 自测(无头 Chrome + tools/qa.mjs 加 cmdk 用例)：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- Cmd/Ctrl-K 打开面板、Esc 关闭、焦点进入输入框、关闭还原焦点；overlay 下不启用。
- 输入英雄名→结果含该英雄，Enter/点击打开其详情；输入视图名→切到该视图；输入 BattleTag→给「搜索玩家」项并跳战绩搜索。
- ↑/↓ 选择 + Enter 执行；无结果空态；面板焦点不漏到背景。
- 现有 `/`、`b`、Esc、Tab 陷阱、路由、overlay 不回归。
- 375px 自适应无溢出；深浅主题协调；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（含 cmdk 用例）。

## Review Focus（Codex 自查）
- Cmd/Ctrl-K 在输入态也能开（带修饰键，不与 `/`、`b` 的 isTypingTarget 守卫冲突）；overlay 短路。
- 命令面板与详情抽屉的焦点陷阱互斥/不打架；Esc 优先关命令面板。
- 键盘 ↑/↓/Enter 与 roving/activedescendant 正确；执行后关闭并清理。
- 匹配排序合理（前缀优先）、上限与空态；BattleTag 识别启发式不误伤英雄搜索。
- 0 innerHTML；路由/overlay 不受影响；375px 无页面横向溢出。
