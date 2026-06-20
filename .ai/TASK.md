# Task Phase 7：英雄并排对比 + 修复 hero-card 嵌套 button

> Phase 1-6 全部功能须保留不回归。本阶段：①新增「英雄对比」（选 2-4 个英雄并排比数值/克制）②顺手修复 Phase 6 留下的 **hero-card 嵌套 button** 语义问题（卡片是 `<button>`，里面又塞了 ★ button，HTML 不合规）。

## Goal
1. **英雄对比**：用户可把英雄加入「对比盘」（最多 4 个），在对比视图里并排看核心数值（血量/护甲/护盾、职业、tier、难度、DPS/HPS、射程、机动、站位、克制优劣势等），支持深链分享。
2. **修 hero-card 语义**：把英雄卡从 `<button>` 改为非 button 的可点击容器（`div[role="button"][tabindex="0"]` + Enter/Space 激活），使 ★ 收藏按钮、加对比按钮可合法嵌套，且键盘/读屏正常。

## Context（现状，必须遵守）
- 纯静态零构建 SPA：`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme}.js` + `styles.css`，type=module。
- 英雄卡：`createHeroCard(hero)`（app.js ~635）目前 `create("button","hero-card")`，里面有 ★（`button[data-favorite-hero]`）、NEW 角标、近期调整角标、头像、名字、tier 等。
- 卡片点击：`#heroGrid` 委托 → 先判 `button[data-favorite-hero]`（收藏）→ 否则 `closest("[data-hero-id]")` → `openDetail(id)`。
- 详情：`openDetail(id)` / `closeDetail()` / `openDetailPanel` / `closeDetailPanel`，`#detailDrawer`，详情头部已有 ★。
- 视图/路由：`switchView(view)` 切 `.view-tab.is-active`+`.view.is-active`（section id=`${view}View`）；`routeViews` 来自 `.view-tab[data-view]`；hash 路由 `#/<view>`、`#/hero/<id>`，`isRouting` guard，`?overlay=1` 短路（`overlayMode`）。新增视图要进 `.view-tab` 与 `.view` 体系才能被路由/切换识别。
- 英雄数据形状：`normalizeHero`（data.js）产出 `id,name,nameZh,role,subrole,tier,difficulty,tags,health{...},params{primary,range,mobility,dps,healingPerSec,note},counters/克制结构,ban{...}` 等。对比要展示的字段以 `normalizeHero` 实际产出为准（先读 data.js 确认字段名，缺值显示 `—`）。
- 硬约束：全项目 **0 innerHTML 注入数据**（全 `textContent`/DOM API）。

## Requirements

### A. 修 hero-card 语义（先做，给对比腾出干净结构）
1. `createHeroCard` 容器从 `button` 改为 `div`，加 `role="button"`、`tabindex="0"`、`data-hero-id` 不变、保留所有现有 class（`hero-card`/`is-new-hero` 等）与子元素。
2. 键盘可达：在 `#heroGrid` 上加 `keydown` 委托——Enter/Space 且 target 是 `.hero-card`（非内部 ★/对比按钮）时，`preventDefault()` 并 `openDetail(card.dataset.heroId)`。鼠标点击行为保持现状（委托不变）。
3. 焦点样式：`.hero-card:focus-visible` 给清晰可见的蓝色 outline/边框（用 `--primary`）。★ 与对比按钮各自仍是 `<button>`，现在合法（父级不再是 button）。
4. 验收：键盘 Tab 能聚焦卡片，Enter/Space 打开详情；★ 与对比按钮可单独 Tab 聚焦、Enter 触发各自动作且不冒泡到卡片；读屏不再出现按钮套按钮。

### B. 英雄对比
1. **对比状态**：`state.compare`（数组，保序，最多 4 个 hero id），localStorage key `ow-compare` 持久化（try/catch 容错，损坏回退空）。提供 `addToCompare/removeFromCompare/isInCompare/clearCompare` 工具。满 4 个后再加给出提示且不超限。
2. **入口按钮**：
   - 英雄卡右上角在 ★ 旁加「对比」切换按钮（`button[data-compare-hero]`，有 `aria-pressed`/`aria-label`「加入/移出对比 <名>」）。点击只切换对比、不冒泡开详情（委托里优先判 `data-compare-hero`）。已选=高亮（`--primary`）。
   - 详情抽屉头部也加同款对比切换，与卡片同步。
3. **对比盘（compare tray）**：页面底部或英雄库顶部一个常驻条，显示当前已选英雄头像/名 + 各自移除按钮 + 「清空」+「查看对比」按钮；为空时隐藏。tray 在所有视图可见或至少英雄库可见（自行权衡，英雄库可见即可）。
4. **对比视图**：新增 `compare` 视图（进 `.view-tab` 导航 + `.view` section `compareView`）。并排表格/卡列：每个英雄一列，行是各维度（头像+名/职业/tier/难度/血量(HP/护甲/护盾)/DPS/HPS/射程/机动/站位/标签/ban 优先级/代表克制）。
   - 数值行做**高亮对比**：同一行里数值最优的高亮（如最高 HP、最低难度），用 `--good`；缺值 `—` 不参与比较。能数值化的维度才比较，文本维度只并排展示。
   - 少于 2 个英雄时显示引导空态「至少选择 2 个英雄进行对比，去英雄库点卡片上的『对比』按钮」。
5. **深链**：`#/compare/<id1>,<id2>,...`（逗号分隔，encodeURIComponent 各 id）。打开后恢复对比集合并切到对比视图；非法/缺失 id 跳过不崩。`switchView('compare')` 与对比集合变化时同步 hash（沿用 Phase 6 的 `isRouting` guard / overlay 短路，避免循环）。点「查看对比」= 切到 compare 视图。
6. 移动端：对比表横向滚动不溢出页面（容器 `overflow-x:auto`），375px 无横向**页面**溢出。

## Constraints
- 不改现有 JS 函数对外签名与数据流；可在 `createHeroCard`/`renderDetail`/`switchView`/路由函数内追加逻辑。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外）。不引框架/构建/库。
- 保持 **0 innerHTML 注入数据**。
- 复用现有 CSS token 与组件风格（OP.GG 浅色 + 深色主题都要协调）；新增 class，不破坏既有 id/class/data-* hook。
- Phase 1-6 全部交互（筛选/详情/克制/战绩/地图/Meta/更新/推荐器/overlay/收藏/路由）不回归。
- `#heroGrid` 现有 click 委托对 ★ 与 `data-hero-id` 的处理保持有效；新增 compare 按钮判断要排在 openDetail 之前。

## Implementation Plan（建议）
1. 改 `createHeroCard` 容器为 `div[role=button][tabindex=0]`；加 keydown 委托；加 `.hero-card:focus-visible` 样式。
2. 对比数据层：`state.compare` + load/save/add/remove/is/clear + 初始化读 localStorage。
3. 卡片/详情加「对比」按钮；`#heroGrid` 与 `detailContent` 委托优先处理 `data-compare-hero`。
4. index.html 加 `compare` 的 `.view-tab` 与空的 `compareView` section + 对比盘 tray 容器。
5. `renderCompareTray()` + `renderCompareView()`（并排列 + 数值高亮）；对比集合变化后刷新 tray、对比视图、卡片/详情按钮态。
6. 路由：`#/compare/...` 解析/序列化，纳入 `parseHashRoute`/`switchView`/`applyRouteFromHash`，复用 isRouting guard 与 overlay 短路。
7. 自测（无头 Chrome）：见验收。更新 `README.md`、`.ai/HANDOFF.md`（补 compare hash 与对比说明）。

## Acceptance Criteria
- 英雄卡是 `div[role=button]`，键盘 Tab+Enter/Space 开详情；★ 与对比按钮可单独聚焦触发、不误开详情；DOM 无 button 套 button。
- 卡片/详情「对比」按钮可加/移英雄，刷新后保持（localStorage `ow-compare`），上限 4。
- 对比盘显示已选英雄、可逐个移除/清空/查看对比；空时隐藏。
- 对比视图并排展示 ≥2 英雄的各维度，数值行最优值高亮；<2 个有引导空态；表格横向滚动不致页面横向溢出。
- `#/compare/genji,ana` 深链恢复对比并落在对比视图；非法 id 跳过不崩；`?overlay=1` 不受影响。
- Phase 1-6 全功能不回归；`node --check` 全过；console 无报错；375px 无横向溢出；全项目仍 0 innerHTML 注入数据。

## Review Focus（Codex 自查）
- hero-card 从 button 改 div 后：点击委托、键盘激活、焦点可见、★/对比按钮不冒泡是否都对。
- compare 按钮与 ★ 在委托里的判定顺序（都要排在 openDetail 之前）。
- 对比深链与 switchView 的 hash 同步是否触发循环（isRouting guard）。
- localStorage 损坏/超限/不可用容错。
- 数值高亮：缺值 `—` 不应被当成最优/最差；"最低难度/最高 HP" 方向正确。
- overlay 模式不被对比/路由污染。
