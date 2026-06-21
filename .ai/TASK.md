# Task Phase 21：设置与关于面板（#/settings）

> Phase 1-20 全部功能须保留不回归。新增「设置」视图：集中偏好（主题、战绩默认平台、英雄库默认视图）+ 关于（版本、GitHub 链接、数据来源/致谢、PWA 检查更新）。与「个人中心」分工：个人中心=资料/数据备份；设置=偏好与关于。纯前端、0 innerHTML、零构建。

## Context（务必遵守）
- 视图体系：`.view-tab[data-view]` + `.view`(id=`${view}View`)、`switchView`、hash 路由、tablist a11y。新视图 `settings` + `#/settings` 按普通 view 接入（参考 me/workshop/matrix）。
- 主题：`src/theme.js` + 顶栏 `#themeToggle`（localStorage `ow-theme`）。设置里的主题选择应与顶栏开关**同步**（改一处另一处状态跟随）；可调用现有主题切换逻辑（若 theme.js 暴露函数则复用；否则操作 `document.documentElement.dataset.theme` + 写 `ow-theme` + 更新 `#themeToggle` 的 aria-pressed/文案，保持一致）。
- 战绩平台：战绩查询用 `state.platform`（"pc"|"console"），有 `#platformTabs`。设置里的「默认平台」存 localStorage `ow-default-platform`，应用启动时读取设为 `state.platform` 初值（在数据加载/init 处应用）。
- 英雄库默认视图：Phase 18 的 `state.heroView`(grid|list, localStorage `ow-hero-view`)。设置里可改默认值（即写 `ow-hero-view`）。
- PWA：`src/pwa.js` 注册 SW。设置里「检查更新」按钮可调用 `navigator.serviceWorker.getRegistration()?.update()`（try/catch，无 SW 时提示不可用）。
- helper：`create/appendText`；版本号可用常量（如 `APP_VERSION="1.0"`，在 app.js 定义）。GitHub 链接：https://github.com/leonjean214/ow-assistant 。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook；overlay/路由不受影响。

## Requirements
1. **视图与路由**：index.html 加 tab `data-view="settings"`（「设置」）+ `settingsView`(含 `#settingsContent`)。app.js：switchView 进 settings 调 `renderSettings()`；`#/settings` 普通 view 路由。
2. **偏好区**：
   - 主题：浅/深 选择（segmented 或 select），与顶栏 `#themeToggle` 双向同步。
   - 战绩默认平台：PC / 主机 选择，存 `ow-default-platform`，启动应用为 `state.platform` 初值。
   - 英雄库默认视图：卡片 / 列表，存 `ow-hero-view`（与 Phase 18 共用 key）。
3. **关于区**：应用名 + 版本（`APP_VERSION`）+ 「在 GitHub 查看源码」外链 + 数据来源/致谢（OverFast API、workshop.codes、社区调研；引用 docs/SOURCES.md 精神，一句话即可）+ 「检查更新」按钮（PWA update，结果用文案提示）。
4. **a11y/响应式**：控件有 label、键盘可用；外链 `rel="noopener noreferrer" target="_blank"`；375px 不溢出；深浅主题协调。
5. **持久化即时生效**：改默认平台/视图即写 localStorage；主题即时切换。`#settingsContent` aria-live=polite 给操作反馈（如「已设默认平台为 PC」）。

## Constraints
- 不改现有 JS 对外签名/数据流；可加 `renderSettings`、settings 视图、`APP_VERSION`、init 处读默认平台；与现有主题/平台/heroView 逻辑同步而非另起一套。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。复用 token，深浅主题协调。
- Phase 1-20 全功能不回归；overlay(`?overlay=1`)不受影响。
- 不需新 sw 缓存项（逻辑写进 app.js）。

## Implementation Plan（建议）
1. index.html：settings tab + settingsView(`#settingsContent`)。
2. app.js：`APP_VERSION`；init 读 `ow-default-platform` 设 state.platform 初值；renderSettings()（偏好控件 + 关于）；switchView 分支；控件事件→写 localStorage + 即时应用 + 与顶栏/平台 tab 同步。
3. styles.css：设置卡、控件、关于区、响应式。
4. 自测（无头 Chrome + tools/qa.mjs 加 settings 用例）：见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 「设置」tab/`#/settings` 可达；主题选择与顶栏开关双向同步；默认平台/默认视图改后写 localStorage 且刷新生效。
- 关于区显示版本 + GitHub 外链（指向 leonjean214/ow-assistant）+ 数据来源致谢；「检查更新」可点（无 SW 时友好提示）。
- 375px 无横向溢出；深浅主题协调；控件键盘可用。
- Phase 1-20 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（含新增 settings 用例）。

## Review Focus（Codex 自查）
- 主题在 设置↔顶栏 双向同步不打架；平台默认值应用到 state.platform 不破坏战绩查询。
- heroView key 与 Phase 18 共用、不冲突。
- PWA 检查更新 try/catch（无 SW/file:// 友好降级）。
- 0 innerHTML；overlay/路由不受影响；375px 无页面横向溢出。
