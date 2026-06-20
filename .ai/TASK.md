# Task Phase 5：前端改版为 OP.GG / OverHub 风格

> Phase 1-4 功能已完成且要全部保留。本阶段**只做视觉/样式改版**,把深色守望先锋风改成 OP.GG 式浅色数据门户风。**严禁改动任何 JS 数据逻辑与功能行为。**

## Goal
按 `docs/DESIGN.md` 的视觉规范,重做 `src/styles.css`(可整体重写)并对 `index.html` 做必要的结构/class 调整,使全部 7 个视图(英雄库/克制计算器/战绩查询/地图/Meta/更新/我该玩谁 + Overlay)呈现统一的 OP.GG 浅色风;新增浅/深主题切换。

## Context
- 纯静态零构建 SPA。现有 `index.html` + `src/{app,api,stats,data,counter,recommend-hero}.js` + `styles.css`。
- 设计 token、布局骨架、组件规范全部见 `docs/DESIGN.md`(已写好,严格遵循)。
- 现有 JS 通过 id/class 操作 DOM(渲染卡片/表格/详情/筛选)。**改 HTML 结构时不得破坏 app.js 依赖的元素 id 和事件委托所用的 data-* 属性与关键 class**(如 `.hero-card`/`[data-hero-id]`/`.view`/`.view-tab`/`#heroGrid` 等)。若新增结构,用新 class,别动既有 hook。

## Requirements
1. **设计 token 化**:`:root` 浅色 + `[data-theme="dark"]` 深色两套 CSS 变量(见 DESIGN.md),所有颜色只引用变量。
2. **顶栏**:左 logo「OW 助手」,中间醒目全宽搜索框(复用现有战绩搜索 input,移动到顶栏;点击/输入仍触发原战绩查询逻辑——保持 input 的 id 和事件不变,仅移动位置/换壳),右侧**主题切换按钮**(浅/深,localStorage `ow-theme` 持久化,默认浅色)+ 赛季标签。
   - 若把战绩搜索框移到顶栏在结构上风险大,可在顶栏放一个"快速战绩搜索"并复用同一 search 逻辑/或保持战绩页内搜索不动、顶栏放装饰性全局搜索跳转到战绩页。优先不破坏功能。
3. **主导航 tab**:OP.GG 式(激活=蓝下划线+蓝字),保持 `data-view` 切换逻辑不变。
4. **内容区**:居中 max-width:1080px,区块改成白卡(圆角8/细边/轻阴影)。
5. **全组件按 DESIGN.md 重皮**:数据表(斑马行/hover/数字右对齐/胜率蓝红)、英雄 tile(圆角方头像网格)、tier 徽章(S红A橙B绿C灰)、buff/nerf 徽章、NEW 角标、pill 筛选、段位卡、加载/错误/空态、表现卡片、更新页时间线/补丁条、地图卡、overlay 紧凑模式(也改成浅色紧凑卡,或在 overlay 下用深色变体亦可,保持紧凑可用)。
6. **响应式**:≤768px 顶栏与 tab 折行,表格横向滚动不溢出;375px 无横向滚动。
7. **主题切换**:仅新增极小 JS(主题 toggle + 读/写 localStorage + 初始化 data-theme),可放 app.js 末尾或新 `src/theme.js`;不得改其他逻辑。

## Constraints
- **不改任何现有 JS 函数的签名/数据流/功能**;只允许新增主题切换那一小段。
- 只读 data/;不改 data/ 与 docs/(本 TASK 除外)。不引入框架/构建/CSS 库。
- 保持全项目 **0 innerHTML 注入数据**。
- Phase 1-4 全部功能与交互不回归(筛选/详情/计算器/战绩/地图/更新/推荐器/overlay 照常工作)。
- 不得删除既有元素 id / data-* / 事件 hook class。

## Implementation Plan
1. 重写 `src/styles.css`:token 两套主题 + 重置 + 顶栏/导航/卡片/表格/tile/徽章/段位卡/时间线/补丁/地图/overlay/响应式 + 加载错误态。
2. `index.html`:加主题切换按钮、顶栏搜索壳、容器 max-width 包裹;调整 class 但保留所有 id/data-*/hook class。
3. 主题 JS:初始化(读 localStorage,默认 light)+ 切换按钮事件。
4. 自测:headless 浏览器逐视图截图/检查——浅色风生效、深色切换可用且持久、7 视图样式统一、Phase1-4 功能照常(点英雄开详情、跑克制、搜 Jay3 出战绩表、更新页徽章、推荐器、overlay)、375px 无横向溢出、console 无报错。
5. 更新 README.md(提主题切换)与 `.ai/HANDOFF.md`。

## Acceptance Criteria
- 页面默认 OP.GG 式浅色:冷灰底 + 白卡 + 蓝强调,数据表斑马/胜率蓝红,tier 徽章 S红A橙B绿C灰。
- 顶栏有 logo + 搜索 + 主题切换;切深色后刷新仍是深色(localStorage 生效)。
- 全部 7 视图视觉统一;英雄 tile 为圆角方头像网格(OP.GG 感)。
- Phase 1-4 所有功能可用、无回归;console 无未捕获异常;375px 与 768px 响应式正常无横向溢出。

## Review Focus(自查)
- 有没有误删/改 app.js 依赖的 id/data-*/class 导致功能失效(重点!逐功能点一遍)。
- 主题切换初始化时机(避免闪烁 FOUC);localStorage 读取异常 try/catch。
- 深色模式下所有文字对比度可读、徽章/表格/胜率色在两主题都清晰。
- overlay 模式在新样式下仍紧凑可用。
- 移动端表格不撑破布局。
