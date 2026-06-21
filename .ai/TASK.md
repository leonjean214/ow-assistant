# Task Phase 26：i18n 中英双语（UI 界面）

> Phase 1-25 全部功能须保留不回归。给应用加中/英语言切换：UI **界面 chrome**（导航、标题、按钮、标签、占位符、提示/空态/消息）双语；英雄/游戏**数据**用现有字段(英文 `hero.name` vs 中文 `hero.nameZh`)随语言显示。语言持久化、可在设置与（可选）顶栏切换。纯前端、0 innerHTML、零构建。

## 范围与边界（重要，避免半成品）
- **要翻译**：所有硬编码 UI chrome 文案——导航 tab 名、各视图标题/eyebrow、筛选/排序控件 label 与选项、按钮文字、输入框 placeholder、系统提示/空态/aria-label、命令面板、设置/关于、overlay 文案等。
- **数据随字段切换**：英雄名在 EN 下用 `hero.name`、ZH 下用 `hero.nameZh`（已普遍是 `nameZh / name` 并列展示的可保留并列）。职业用 ROLE_LABELS 的中/英。
- **明确不翻译（数据内容，源为中文，本期保持，README 注明）**：`data/*.json` 里的长文本（英雄技能描述 desc、克制为什么 counter-notes、工坊说明、maps_meta tip、patches note 等）。EN 模式下这些数据文本仍显示中文原文——这是数据层范围，本期不做数据翻译，避免半成品。i18n 只覆盖**界面 chrome + 英雄名/职业等有双字段的项**。

## Context（务必遵守）
- 纯静态零构建 SPA，ES module。UI 文案大量硬编码在 index.html(静态文本) 与 src/app.js(动态创建的 textContent)。`ROLE_LABELS` 在 data.js。
- 主题/设置：Phase 21 设置视图(`#/settings`) 有偏好控件；语言开关放这里(+ 可选顶栏)。已有 `state` 单例、`create/appendText` helper、`switchView`、`renderXxx` 各视图渲染。
- 硬约束：0 innerHTML 注入；不引框架/库；**不破坏任何功能/交互/id/class/data-* hook**；qa.mjs 必须保持全绿(注意：qa 用例里有中文断言文案，翻译后**默认语言仍是中文**所以断言应仍通过；若改了默认语言或文案需相应更新 qa，但**默认必须 zh** 以不破坏现有断言)。

## Requirements
1. **`src/i18n.js`**：导出 `STRINGS = { zh:{...}, en:{...} }`（同 key 两套）、`t(key, vars?)`、`getLang()/setLang(lang)`（localStorage `ow-lang`，默认 `zh`）、`applyLang()`（设 `document.documentElement.lang` = zh-CN/en + 触发重渲）。i18n.js 加进 sw APP_SHELL + 升 CACHE_NAME(→v17)。
2. **接入**：把硬编码 UI 文案替换为 `t("key")`。index.html 静态文本：可给元素 `data-i18n="key"`，启动时 `applyLang()` 遍历填 textContent（DOM API，非 innerHTML）；app.js 动态文案改用 `t()`。
3. **语言切换**：设置视图加「语言 / Language」中/英选择；切换即 `setLang` + 重渲当前视图 + 更新静态文案 + 持久化。默认 `zh`（保持现状=现有 qa 断言不破）。
4. **英雄名/职业**：渲染英雄名处按 lang 选 nameZh/name（并列展示的可保留）；ROLE_LABELS 提供中/英（或 i18n key）。
5. **不回归**：默认中文下，界面与 Phase 25 完全一致（qa 全绿）；切英文后界面 chrome 变英文、英雄名变英文、数据长文本仍中文（已注明）。
6. **a11y/响应式**：语言控件可键盘操作；英文文案不致溢出(375px)；`lang` 属性正确。

## Constraints
- 不改现有 JS 对外签名/数据流；可加 i18n.js、data-i18n、t() 调用、语言控件。
- 只读 `data/`，不改 `data/`、`docs/`（本 TASK 除外；可在 docs/ROADMAP.md 标记完成）。不引框架/库。
- 0 innerHTML 注入。复用 token，深浅主题协调。
- **默认语言必须 zh**（保持现有 qa.mjs 中文断言通过）。
- 新模块进 sw APP_SHELL + CACHE_NAME→v17。
- Phase 1-25 全功能不回归；overlay/路由/命令面板/快捷键照旧。

## Implementation Plan（建议，增量、每步 qa）
1. src/i18n.js：STRINGS(zh/en) + t/getLang/setLang/applyLang；先放核心 chrome key。
2. index.html 静态文本加 data-i18n；app.js 动态文案换 t()；ROLE_LABELS 双语。
3. 设置加语言开关；applyLang 在 init 调用(默认 zh)。
4. sw v17 + APP_SHELL 加 i18n.js。
5. 每步跑 qa.mjs(默认 zh 应仍全绿)；补 1-2 条「切到 en 后 tab/标题变英文、切回 zh 恢复」用例。
6. node --check 全过；0 innerHTML；README 注明 i18n 范围(界面双语、数据长文本暂中文)；HANDOFF；ROADMAP 标记完成。

## Acceptance Criteria
- 默认中文，界面与现状一致，tools/qa.mjs 现有用例全绿、0 运行时错误。
- 设置可切「English」：导航/标题/按钮/标签/占位/提示等界面 chrome 变英文，英雄名变英文(hero.name)，刷新保持(ow-lang)；切回中文恢复。
- 数据长文本(技能/克制为什么/工坊等)在 EN 下仍中文（README 已注明范围）——这是预期非 bug。
- `node --check` 全过；console 无报错；0 innerHTML；375px 英文不溢出；i18n.js 进 sw v17 离线可用。
- 新增「切英文/切回中文」qa 用例通过。

## Review Focus（Codex 自查）
- 默认 zh 不变 → 现有中文断言 qa 全绿（这是硬底线）。
- 漏译排查：尽量覆盖界面 chrome；遗漏的英文下仍中文不算崩，但尽量全。
- data-i18n 遍历用 textContent（0 innerHTML）。
- 切语言后所有已渲染视图正确刷新（含动态创建文案）；lang 属性更新。
- sw v17 加 i18n.js；离线可用。375px 英文不溢出。
