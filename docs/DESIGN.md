# 视觉规范：OP.GG / OverHub 风格改版

目标：把当前「深色守望先锋橙蓝」改成 **OP.GG 式浅色数据门户**风（干净、留白、高数据密度、蓝色强调、表格/卡片为主），融入 OverHub 的中文游戏门户卡片感。**只动样式与少量结构/class，不动 JS 数据逻辑与功能。**

## 主题
- **默认浅色**(OP.GG authentic)，提供**深色切换**(顶栏按钮，localStorage 持久化 `ow-theme`)。
- 全部 token 用 CSS 变量定义在 `:root`(浅) 与 `[data-theme="dark"]`(深) 两套，组件只引用变量。

## 颜色 token（浅色默认）
```css
--bg:        #F2F3F7;   /* 页面底，冷灰 */
--surface:   #FFFFFF;   /* 卡片/表格面 */
--surface-2: #F7F8FA;   /* 次级面/斑马行 */
--border:    #E2E4EB;   /* 细边框 */
--text:      #202126;   /* 主文字 */
--text-2:    #6E7178;   /* 次要文字 */
--text-3:    #9AA0A6;   /* 弱化/占位 */
--primary:   #5383E8;   /* OP.GG 蓝，主强调/链接/激活 */
--primary-weak:#EAF0FD; /* 蓝弱底(选中/hover) */
--win:       #3A6EE8;   /* 胜=蓝 */
--loss:      #E84057;   /* 负=红 */
--good:      #16A34A;   /* 正向(buff/高胜率) */
--warn:      #E8A317;   /* 中性提示 */
```
深色 token（`[data-theme="dark"]`）：`--bg:#15171C; --surface:#1E2026; --surface-2:#24262D; --border:#2E313A; --text:#E6E8EC; --text-2:#9CA1AC; --primary:#5B8DEF;` 其余相应调暗。

## Tier 配色（统一）
S=#E84057(红) · A=#F0883E(橙) · B=#3A9E6E(绿) · C=#8A8F98(灰)。用作 tier 徽章底色/文字。

## 排版
- 字体栈：`-apple-system, "Segoe UI", "Microsoft YaHei", Roboto, sans-serif`。
- 紧凑：正文 13-14px，次要 12px，数字用 `font-variant-numeric: tabular-nums` 且加粗。
- 标题 16-20px，section header 14px 半粗 + 小写字母间距。

## 布局骨架（OP.GG 式）
1. **顶栏 header**：左 logo「OW 助手」，中间**醒目搜索框**(战绩查询入口，圆角全宽)，右侧主题切换 + 赛季标签。高度 ~56px，白底+底部细边。
2. **主导航**：顶栏下方一条 tab 条(英雄库/克制/战绩/地图/Meta/更新/我该玩谁…)，激活项=蓝色下划线+蓝字(OP.GG tab 样式)。
3. **内容区**：居中 `max-width:1080px`，左右留白；区块为白色卡片(圆角 8px、`border:1px solid var(--border)`、极轻 shadow `0 1px 2px rgba(0,0,0,.04)`)。
4. **响应式**：≤768px 搜索框与 tab 折行，表格横向滚动或转卡片。

## 组件规范
- **卡片 card**：白底、圆角 8、细边、内距 12-16；header 一行(标题 + 计数 pill)。
- **数据表 table**：表头浅灰底、`text-2`、12px；行高 36-40；斑马行 `--surface-2`；hover 行 `--primary-weak`；数字右对齐 tabular-nums；胜率用 `--win/--loss` 文字色 + 细进度条。
- **英雄 tile**：圆角方形头像(8px)，OP.GG 式小图标网格；名字下方小字职业/tier 徽章；hover 轻微抬升+边框转蓝。
- **徽章 badge**：tier 用上面配色；buff/nerf 用 `--good/--loss` 描边胶囊；NEW 用 `--primary` 实底小角标。
- **pill 筛选**：未选=白底细边 `text-2`，选中=`--primary` 实底白字（圆角 full）。
- **段位卡(战绩)**：白卡 + 段位色条 + 大段位名 + 小字 tier，OP.GG rank 卡感。
- **空/错误/加载态**：浅灰占位 + 居中 `text-3` 文案；骨架用 `--surface-2` 脉冲。

## 不要
- 不要保留原橙色主色作为全局主调（橙仅可作 OW 点缀，如 logo 或 tank 角色色）。
- 不改任何 JS 函数签名/数据流/功能；不改 data/ 与 docs/(除本文件由我维护)。
- 不引入 UI 框架/CSS 框架/构建。
```
角色色(可选点缀)：tank=#F0883E 橙 / damage=#E84057 红 / support=#3A9E6E 绿（用于角色标签描边，OP.GG 式）。
```
