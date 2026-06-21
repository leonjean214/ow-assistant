# Task Phase 23：英雄可分享卡片（详情 → canvas PNG）

> Phase 1-22 全部功能须保留不回归。英雄详情抽屉新增「生成分享图」：把该英雄关键信息绘成 PNG 可下载/复制。复用 Phase 11 战绩分享图的 canvas 模式。纯前端、0 innerHTML、零构建。

## Context（务必遵守）
- 详情抽屉：`renderDetail(hero)`（app.js），头部有 `.detail-head-actions`（收藏/对比/入队按钮）。在头部或详情内加「生成分享图」按钮。
- Phase 11 已有 canvas 分享图实现（journal share card）：按 `devicePixelRatio` 缩放、`getComputedStyle` 读 CSS 变量适配深浅主题、`canvas.toBlob("image/png")` → 下载 + 尝试 `navigator.clipboard.write`(失败仅提示)、Blob 用完 `revokeObjectURL`。**复用同样手法**（可抽公共函数或照搬）。
- 英雄字段：`hero.nameZh/name/role/subrole/tier/difficulty/health{hp,armor,shield}/tags[]/counters{strongAgainst,weakAgainst}/abilities.ultimate`(name/nameZh) 等；`ROLE_LABELS`、`createAvatar`(头像 portrait URL 可能跨域，canvas 画头像有 CORS 风险——见下)。helper `create/appendText`、`state.byId`。
- 硬约束：0 innerHTML 注入；不引框架/库；不破坏现有 id/class/data-* hook；overlay/路由不受影响。

## Requirements
1. **入口**：详情抽屉头部 `.detail-head-actions` 加「分享图」按钮（icon/文字，aria-label）。点击对当前 `activeDetailHeroId`/当前 hero 生成卡片。
2. **卡片内容**（canvas，尺寸如 1080×1350 或 1200×630，自定）：标题「<nameZh> / <name>」、职业 + 定位 + Tier 徽章、难度、总有效生命(HP/护甲/护盾)、代表标签、大招名(若有)、克制速览(我克制 Top3 / 我怕 Top3，用英雄中文名文字即可，避免跨域头像)。配色读当前主题 CSS 变量（深浅各出对应色）。底部小字水印「OW 助手 · github.com/leonjean214/ow-assistant」。
3. **头像/CORS**：英雄头像是外链(CDN)，canvas `drawImage` 跨域会污染导致 `toBlob` 失败。**安全做法**：卡片用文字/色块/首字母占位，不画外链头像（或 try 加载 `crossOrigin="anonymous"` 成功才画、失败回退占位，确保 toBlob 不报错）。优先稳妥=不画外链头像。
4. **输出**：`toBlob` → 下载 PNG（文件名含英雄 id + 日期）+ 尝试复制剪贴板（失败仅 aria 提示）。Blob `revokeObjectURL`。失败友好提示不崩。
5. **a11y/响应式**：按钮键盘可用；生成是即时操作，状态用现有详情区或 aria-live 提示；不破坏抽屉焦点陷阱。

## Constraints
- 不改现有 JS 对外签名/数据流；可加 `createHeroShareButton`/`shareHeroCard(hero)` + 详情头部挂接 + 样式；canvas 逻辑写进 app.js（或复用 Phase 11 的公共绘制工具，免动 sw）。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。复用 token，深浅主题协调。
- Phase 1-22 全功能不回归；overlay 不受影响。

## Implementation Plan（建议）
1. detail 头部加「分享图」按钮（`.detail-head-actions` 内，复用按钮样式）。
2. app.js：`shareHeroCard(heroId)`：建 canvas(dpr 缩放)、读 CSS 变量、绘标题/职业/Tier/数值/标签/克制速览/水印→toBlob→下载+剪贴板降级；头像走占位避免 CORS。
3. styles.css：分享按钮样式（若需）。
4. 自测(无头 Chrome + tools/qa.mjs 加用例)：开 `#/hero/genji` → 点分享 → 断言 toBlob 产出非空 PNG(深浅各一)。见验收。更新 README、HANDOFF、ROADMAP 标记完成。

## Acceptance Criteria
- 详情头部有「分享图」按钮；点击生成该英雄 PNG 并触发下载（文件名含英雄 id + 日期），尝试复制剪贴板。
- canvas 绘出标题/职业/Tier/数值/标签/克制速览/水印；深浅主题各出可读一版；不因外链头像 CORS 导致 toBlob 失败。
- 不破坏详情抽屉焦点陷阱/其它按钮；失败友好提示不崩。
- Phase 1-22 全功能不回归；`node --check` 全过；console 无报错；0 innerHTML；tools/qa.mjs 全绿（含新增用例）。

## Review Focus（Codex 自查）
- canvas CORS：不画外链头像（或 crossOrigin 成功才画、失败占位），确保 toBlob 不抛。
- dpr 清晰度；读 CSS 变量在深浅主题取色正确；中文渲染正常。
- Blob revokeObjectURL；clipboard/toBlob 失败降级。
- 分享按钮不破坏抽屉焦点陷阱与现有头部按钮委托。
- 0 innerHTML；overlay/路由不受影响。
