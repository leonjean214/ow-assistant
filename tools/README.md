# tools/ — 开发/QA 辅助脚本（不随应用发布）

零构建项目无测试框架；`qa.mjs` 用 Node ≥22 内置 `WebSocket` 直接驱动 Chrome DevTools Protocol，做**交互级**回归（点击、路由、localStorage、console 错误捕获），补足 `--dump-dom` 只能验渲染的不足。

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
