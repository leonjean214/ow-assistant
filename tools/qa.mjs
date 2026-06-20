// 用 Node>=22 内置 WebSocket 驱动 Chrome CDP，对 ow-assistant 做交互级回归 + console 错误捕获。
// 运行见 tools/README.md。
const BASE = process.env.BASE || "http://localhost:8125";
const CDP = "http://localhost:9222";

async function rpcTarget() {
  const r = await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + "/")}`, { method: "PUT" })
    .catch(() => fetch(`${CDP}/json/new?${encodeURIComponent(BASE + "/")}`));
  return r.json();
}

function mkConn(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push("EXCEPTION: " + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text));
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push("CONSOLE.ERROR: " + msg.params.args.map((a) => a.value || a.description || "").join(" "));
    }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  const ready = new Promise((res) => ws.addEventListener("open", () => res()));
  const evals = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("eval err: " + r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  return { send, ready, evals, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const t = await rpcTarget();
  const c = mkConn(t.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  const out = [];
  const check = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} | ${name}${extra ? " | " + extra : ""}`);

  await c.evals(`try{localStorage.clear()}catch(e){}; location.hash='#/heroes'; null`);
  await sleep(2500);

  check("英雄库渲染", await c.evals(`document.querySelectorAll('#heroGrid .hero-card').length`) >= 40);

  // 收藏
  await c.evals(`document.querySelector('#heroGrid button[data-favorite-hero]').click(); null`);
  check("收藏写入 ow-favorites", (await c.evals(`JSON.parse(localStorage.getItem('ow-favorites')||'[]').length`)) === 1);
  check("收藏不误开详情", (await c.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`)) === false);

  // 对比深链
  await c.evals(`location.hash='#/compare/genji,ana'; null`); await sleep(700);
  check("对比深链激活视图", (await c.evals(`document.getElementById('compareView').classList.contains('is-active')`)) === true);
  check("对比表渲染", (await c.evals(`document.querySelectorAll('#compareContent .compare-table').length`)) === 1);

  // 组队深链 + 拿去克制
  await c.evals(`location.hash='#/team/genji,winston,ana'; null`); await sleep(700);
  check("组队深链 4 分析卡", (await c.evals(`document.querySelectorAll('#teamContent .team-card').length`)) === 4);
  if (await c.evals(`!!document.querySelector('#teamContent button[data-team-to-counter]')`)) {
    await c.evals(`document.querySelector('#teamContent button[data-team-to-counter]').click(); null`); await sleep(400);
    check("拿去克制→克制视图载入敌方", (await c.evals(`document.querySelectorAll('#selectedEnemies .selected-chip').length`)) >= 1);
  }

  // 英雄详情深链 + 焦点 + 克制上色
  await c.evals(`location.hash='#/hero/genji'; null`); await sleep(700);
  check("英雄深链开抽屉", (await c.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`)) === true);
  check("抽屉焦点在内", (await c.evals(`document.getElementById('detailDrawer').contains(document.activeElement)`)) === true);
  check("克制链接已上色", (await c.evals(`document.querySelectorAll('#detailContent .hero-link-strong, #detailContent .hero-link-weak').length`)) >= 1);
  await c.evals(`document.getElementById('closeDrawer').click(); null`); await sleep(300);
  check("关抽屉后失去 is-open", (await c.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`)) === false);

  // 主题切换
  const themeSel = `[data-theme-toggle],#themeToggle,button[aria-label*="主题"],button[title*="主题"],button[aria-label*="深色"],button[aria-label*="浅色"]`;
  if (await c.evals(`!!document.querySelector('${themeSel}')`)) {
    const before = await c.evals(`document.documentElement.dataset.theme||'light'`);
    await c.evals(`document.querySelector('${themeSel}').click(); null`); await sleep(200);
    const after = await c.evals(`document.documentElement.dataset.theme`);
    check("主题切换生效", before !== after, `${before}->${after}`);
    check("主题持久化 ow-theme", (await c.evals(`!!localStorage.getItem('ow-theme')`)) === true);
  } else {
    check("找到主题切换按钮", false, "(选择器未命中)");
  }

  // overlay
  await c.evals(`location.href = '${BASE}/?overlay=1'; null`); await sleep(1800);
  check("overlay 模式 body.is-overlay", (await c.evals(`document.body.classList.contains('is-overlay')`)) === true);

  await sleep(300);
  console.log(out.join("\n"));
  console.log("\n=== console 错误/异常 (" + c.errors.length + ") ===");
  console.log(c.errors.length ? c.errors.join("\n") : "(无)");
  const failed = out.filter((l) => l.startsWith("FAIL")).length;
  console.log(`\n结果：${out.length - failed}/${out.length} 通过，${c.errors.length} 个运行时错误`);
  process.exit(0);
})().catch((e) => { console.error("QA 脚本错误:", e.message); process.exit(1); });
