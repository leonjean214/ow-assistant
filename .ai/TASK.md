# Task Phase 9：PWA —— 可安装 + 离线可用

> Phase 1-8 全部功能须保留不回归。本阶段把 SPA 变成 PWA：可安装到桌面/手机、断网仍能用（app shell + 本地数据离线缓存）。**仍是零构建，纯静态文件。**

## Goal
加 Web App Manifest + Service Worker：①浏览器可「安装」本应用；②离线时英雄库/克制/对比/地图静态部分/Meta/更新等**不依赖外部 API 的功能**照常工作（缓存 index.html、所有 src/*.js、styles.css、data/*.json）；③在线时正常，外部 OverFast 战绩/地图 API 请求**不被 SW 干扰**（继续走网络 + api.js 现有 localStorage 缓存）。

## Context（现状）
- 纯静态零构建：`index.html` + `src/{app,api,stats,data,counter,recommend-hero,theme}.js`(ES module) + `styles.css` + `data/{heroes,maps_meta,patches}.json`。本地 `python3 -m http.server 8000` 运行。
- 主题：head 内联脚本 + `src/theme.js`，token 含 `--primary`(#5383E8) 等；浅色底 `#F2F3F7`。
- 外部 API：`src/api.js` 调 `https://overfast-api.tekrop.fr`，已有超时/重试/localStorage 缓存。
- 已有 `?overlay=1` 与 hash 路由。
- 硬约束：0 innerHTML 注入数据；不引框架/构建/库。

## Requirements
1. **Manifest**（`manifest.webmanifest`，`index.html` `<link rel="manifest">` 引入）：
   - `name`「守望先锋助手」、`short_name`「OW助手」、`description`、`lang:"zh-CN"`、`dir:"ltr"`。
   - `start_url:"."`（或 `./index.html`，注意 GitHub Pages/子路径相对路径）、`scope:"."`、`display:"standalone"`、`orientation:"any"`。
   - `theme_color` 与 `background_color` 取现有浅色风（如 `#5383E8` / `#F2F3F7`），与 `index.html` `<meta name="theme-color">` 一致（可按主题给两个）。
   - `icons`：至少 192×192、512×512，含一个 `purpose:"maskable"`。**需提供真实可安装图标文件**（可用脚本生成 PNG，或 SVG + PNG 组合，确保 Chrome 安装条件满足）。图标放 `icons/` 目录，主题色方块 + 「OW」字样即可，简洁。
2. **Service Worker**（`sw.js`，放项目根以获得根 scope）：
   - 安装时预缓存 **app shell**：`index.html`、`./`、所有 `src/*.js`、`styles.css`、`manifest.webmanifest`、`icons/*`、`data/*.json`。
   - 取数策略：
     - 同源导航/静态资源（html/js/css/json/icon）：**cache-first 带后台更新（stale-while-revalidate）**，缓存命中即用，后台拉新写回。
     - **外部 OverFast API（`overfast-api.tekrop.fr`）：SW 不拦截，直接走网络**（fetch 透传，避免与 api.js 的 localStorage 缓存冲突、避免缓存易变的战绩数据）。
     - 离线且无缓存时，导航请求回退到缓存的 `index.html`。
   - 版本化缓存名（如 `ow-cache-v1`），`activate` 时清理旧版本缓存。
   - 用 `self.skipWaiting()` + `clients.claim()` 让更新尽快生效（但避免无限刷新循环）。
3. **注册**（`index.html` 或新 `src/pwa.js`）：
   - 仅在 `'serviceWorker' in navigator` 且非 `file:`（http/https/localhost）时 `register('./sw.js')`，相对路径以适配子目录部署。失败 try/catch 不影响主功能。
   - 不破坏现有 module 加载与主题初始化。
4. **离线体验**：断网刷新仍能进英雄库/克制/对比/Meta/更新/地图静态文本；依赖 OverFast 的战绩查询/地图列表在离线时给现有的友好错误态（不白屏、不崩）。
5. **更新提示（可选、轻量）**：检测到新 SW 安装就绪时，可在底部给一个「有更新，点击刷新」轻提示（用现有样式 token，DOM API 创建，0 innerHTML）。没有也可，但要保证更新不会让用户卡在旧版本。

## Constraints
- 零构建、纯静态；不引框架/构建/库（不要 Workbox 之类）。
- 不改现有 JS 对外签名/数据流；可新增 `sw.js`、`src/pwa.js`、`manifest.webmanifest`、`icons/`。
- 0 innerHTML 注入数据。
- **SW 绝不缓存/拦截 OverFast API**；不缓存 `?overlay=1` 导致 overlay 状态错乱（导航回退到 index.html 即可，hash/query 由前端处理）。
- Phase 1-8 全部功能与交互（路由/收藏/对比/a11y/overlay/筛选/详情/克制/战绩/地图/Meta/更新/推荐器）不回归。
- 注意本地 `http.server` 下 SW 可注册（http://localhost 视为安全上下文）；`file://` 下要安全跳过不报错。

## Implementation Plan（建议）
1. 生成 `icons/`（192/512 + maskable，主题色 + OW 字样）。
2. 写 `manifest.webmanifest`，`index.html` 引入 + `theme-color` meta。
3. 写 `sw.js`：预缓存清单、install/activate/fetch（SWR + 外部 API 透传 + 离线导航回退 + 旧缓存清理）。
4. 注册 SW（`src/pwa.js` 或 index 内联小脚本），安全上下文判断 + try/catch。
5. （可选）更新提示。
6. 自测（无头 Chrome + 离线模拟）：见验收。更新 README、`.ai/HANDOFF.md`。

## Acceptance Criteria
- Chrome DevTools/Lighthouse 判定可安装（manifest 有效 + 图标齐 + SW 注册成功 + 安全上下文）。
- SW install 后 app shell 与 data/*.json 进缓存；`activate` 清理旧版本缓存。
- **离线**（DevTools offline）刷新：英雄库渲染 52 张卡、克制计算器、对比、Meta、更新页、地图静态文本可用；依赖 OverFast 的战绩/地图列表显示友好错误态不崩。
- 在线时 OverFast 战绩查询照常（SW 未拦截外部 API）。
- `?overlay=1` 离线/在线均正常；hash 路由/深链不被 SW 破坏。
- `file://` 打开不因 SW 注册报错。
- Phase 1-8 全功能不回归；`node --check` 全过(含新 js)；console 无报错（SW 注册日志可有）；375px 无横向溢出；0 innerHTML 注入数据。

## Review Focus（Codex 自查）
- SW 是否误拦截/缓存了 OverFast API（必须透传网络）。
- 缓存版本升级时旧缓存清理 + 不陷入 skipWaiting 无限刷新。
- 离线导航回退 index.html 后，hash 路由/overlay 仍能正确还原视图。
- 相对路径 `register('./sw.js')` 与 manifest `start_url/scope` 在子目录部署可用。
- 图标真能让 Chrome 满足安装条件（尺寸/purpose/类型）。
- `file://` 与缺 SW 支持时优雅跳过。
