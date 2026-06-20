# W0 Spike：Overwolf GEP 读实时对局（施工图 + Win 实测计划）

> 目标见 [../docs/RESEARCH.md](../docs/RESEARCH.md) §3、[../docs/ROADMAP.md](../docs/ROADMAP.md) B 线。
> **本目录全部为未在 Win 实测的脚手架/模板**，作用是给在 `ssh win-desktop` 上的落地一份精确起点。
> 凡标 ⚠️ 处必须在 Win 上对照 dev.overwolf.com 实页与真实事件核对后回填。

## 文件
| 文件 | 作用 | 待 Win 核对 |
|---|---|---|
| `manifest.json` | Overwolf 应用清单（background + overlay 窗口、game_targeting、GEP） | ⚠️ `game_ids`(10844 是经典 OW；OW2/2026 可能不同)、窗口字段 |
| `background.html`/`background.js` | 后台订阅 GEP、打印原始事件、转发给 overlay | ⚠️ `REQUIRED_FEATURES` 真实名、`onInfoUpdates2`/`onNewEvents` 字段路径 |
| `overlay.html` | iframe 复用 SPA `?overlay=1`，中继 GEP 消息 | ⚠️ `SPA_URL`、打包方式（iframe 远端 vs 拷 SPA 进包） |
| `icons/` | 256 图标（缺，Win 上补；可复用 ../icons 重导出） | ⚠️ 补图标文件 |

## 架构（复用现有 SPA，零重写）
```
OW 游戏 ──GEP──> background.js ──postMessage(owgep)──> overlay.html ──postMessage──> iframe(SPA ?overlay=1)
                  (本方英雄/对局/KDA)                    (中继)                 (后续:本方英雄→「我该玩谁」, 敌方→克制/对面阵容)
```
SPA 侧已具备：`?overlay=1` 紧凑浮层、克制计算器、对面阵容原型(`createEnemyCompSummary`)、组队分析。W1 只需在 SPA 加一段 `window.onmessage` 把 GEP 本方英雄灌进现有状态即可，**不改其余逻辑**。

## Win 实测步骤（在 ssh win-desktop / 本机 Win 上）
1. 装 **Overwolf 客户端**（overwolf.com），登录开发者。
2. Overwolf → 设置 → 开发者选项 → **Load unpacked extension**，选本 `overwolf/` 目录。
3. 启动 **Overwatch**；打开 Overwolf 对该 app 的 background 页 **开发者工具**，看 console：
   - `[OWGEP] running game ... id:` → **记录真实 game id**，回填 `manifest.json` 的 `game_ids`/`game_events` 与 `background.js`。
   - `setRequiredFeatures OK: [...]` 的 **supportedFeatures** → 即真实可订阅 feature 名，回填 `REQUIRED_FEATURES`。
   - 进一局后看 `info`/`events` 的 **JSON 原始结构** → 找出本方 hero_name/hero_role、match_start/match_end、kill/death 的**确切字段路径**。
4. 起 SPA（`python3 -m http.server 8000` 或部署），确认 `overlay.html` 的 `SPA_URL` 可达；进游戏看浮层显示。
5. 回填字段后，进 **W1**：background 解析本方当前英雄 → forward → SPA 监听 message → 自动带入「我该玩谁」/对面阵容；加全局热键唤出 overlay；对局结束写 `ow-journal`(复用 Phase 10 记录器)。

## 合规红线（务必遵守）
- 只用 **GEP 提供的、游戏内已可见 / 官方已开放**的信息（本方英雄、计分板可见项）。
- **不读内存、不注入、不自动操作**。敌方英雄一期靠手动输入（现有克制计算器入口）；GEP 官方开放敌方后再切官方源。

## 验收（W0 完成判据）
- Overwolf 能 load 本 app，background console 打印出 OW 的 game id、supportedFeatures、进对局后的 info/events 原始结构。
- `manifest.json` / `background.js` 的 ⚠️ 字段全部回填为真实值。
- overlay 窗口在游戏内可见并显示 SPA 浮层。
- 把真实事件结构样例追加到本文件「实测回填」区。

## 实测回填（Win 上跑通后填这里）
- game id：`待填`
- supportedFeatures：`待填`
- 本方英雄字段路径：`待填`
- 对局开始/结束事件名：`待填`
