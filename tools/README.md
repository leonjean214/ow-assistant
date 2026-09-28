# tools/ — 开发/QA 辅助脚本（不随应用发布）

零构建项目无测试框架；`qa.mjs` 用 Node ≥22 内置 `WebSocket` 直接驱动 Chrome DevTools Protocol，做**交互级**回归（点击、路由、localStorage、console 错误捕获），补足 `--dump-dom` 只能验渲染的不足。`check-site.mjs` 只用 Node 标准库做**静态体检**，不需要起服务器/浏览器，改动前后都建议先跑它。

## check-site.mjs — 静态体检

```bash
node tools/check-site.mjs
```

无需本地服务器/浏览器。检查范围：

1. `index.html`/`sw.js`/`overwolf/*.html`/`src/*.js` 引用的本地资源路径是否存在（`<img>`/`<script>`/`<link>` 的 `src`/`href`、JS 里的 `import`、`fetch("./data/...")`、动态 `script.src`/`img.src` 字面量）。
2. `sw.js` 的 `APP_SHELL` 预缓存清单 vs 从 `src/app.js`+`src/pwa.js`+`src/theme.js` 出发的 import 依赖图、`src/data.js` 里的 `fetch` 数据文件、`manifest.webmanifest` 里的图标——多列（清单里有但没人用到）报 WARN，漏列（该离线可用但没进清单）报 FAIL。
3. `manifest.webmanifest` 每个图标路径是否存在、直接读 PNG 的 IHDR chunk 校验真实宽高是否与声明的 `sizes` 一致。
4. `data/*.json`（heroes / maps_meta / patches / workshop / counter-notes）能否 `JSON.parse`、id 是否唯一、`counters.{strongAgainst,weakAgainst,synergy}`/地图 `heroPicks`/补丁 `hero`/`newHero`/`_meta.latestHero` 等交叉引用是否都指向 `heroes.json` 里存在的英雄 id。
5. `src/*.js`（含 `overwolf/background.js`）逐个跑 `node --check`，只测语法不测行为。
6. `index.html` 基础 a11y：`<img>` 缺 `alt`、`<button>` 既无 `aria-label`/文本也无 `data-i18n`（无可访问名）、`<input>/<select>/<textarea>`（跳过 `type=hidden/submit/button`）既无关联 `<label>` 也无 `aria-label`/`title`。

输出按 `FAIL`/`WARN` 分类打印，有 FAIL 时进程以非 0 退出。`data-json` 一节里如果发现的是「内容本身不确定该填哪个具体英雄 id」的问题（例如某字段写的是职业/阵容类描述而非英雄 id），按约定不在此脚本里瞎猜着改，留给人工核实，PR 说明会列出。

## 运行

```bash
# 1) 起本地服务器
python3 -m http.server 8125

# 2) 起 headless Chrome 并开远程调试
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9222 --user-data-dir=/tmp/ow-chrome-qa &

# 3) 跑 QA
BASE=http://localhost:8125 node tools/qa.mjs
```

输出每项 PASS/FAIL + 捕获的运行时错误数。当前覆盖：英雄库渲染、列表模式、排序/标签筛选、收藏、对比深链、组队深链、克制网 `#/matrix`、拿威胁去克制计算器、详情抽屉、全视图 tab 切换、工坊、个人中心、overlay、console 错误。

按需在 `qa.mjs` 的 `check(...)` 序列里追加用例。
