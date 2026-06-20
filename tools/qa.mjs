// 用内置 WebSocket 驱动 Chrome CDP，对 ow-assistant 做交互 QA + console 错误捕获。
const BASE = process.env.BASE || "http://localhost:8125";
const CDP = "http://localhost:9222";

async function rpcTarget() {
  // 新建一个 tab 指向应用
  const r = await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + "/")}`, { method: "PUT" }).catch(() => null)
    || await fetch(`${CDP}/json/new?${encodeURIComponent(BASE + "/")}`);
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
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("eval err: " + r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  return { send, ready, evals: ev, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const t = await rpcTarget();
  const conn = mkConn(t.webSocketDebuggerUrl);
  await conn.ready;
  await conn.send("Runtime.enable");
  await conn.send("Page.enable");
  await conn.send("Log.enable");
  const out = [];
  const check = (name, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"} | ${name}${extra ? " | " + extra : ""}`);

  // 等数据加载
  await conn.evals(`location.hash = '#/heroes'; null`);
  await sleep(2500);
  const cards = await conn.evals(`document.querySelectorAll('#heroGrid .hero-card').length`);
  check("英雄库渲染卡片", cards >= 40, `cards=${cards}`);

  // 清空已有 team，点两个入队按钮
  await conn.evals(`try{localStorage.removeItem('ow-team')}catch(e){}; null`);
  await conn.evals(`location.hash='#/heroes'; null`); await sleep(300);
  const add1 = await conn.evals(`(()=>{const b=document.querySelector('#heroGrid button[data-team-hero]');b.click();return JSON.parse(localStorage.getItem('ow-team')||'[]').length})()`);
  check("点入队按钮①写入 ow-team", add1 === 1, `len=${add1}`);
  const detailOpenedAfterTeam = await conn.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`);
  check("点入队不误开详情", detailOpenedAfterTeam === false);
  const add2 = await conn.evals(`(()=>{const bs=[...document.querySelectorAll('#heroGrid button[data-team-hero]')];bs[3].click();return JSON.parse(localStorage.getItem('ow-team')||'[]').length})()`);
  check("点入队按钮②累加", add2 === 2, `len=${add2}`);

  // 进 team 视图
  await conn.evals(`location.hash='#/team'; null`); await sleep(600);
  const teamCards = await conn.evals(`document.querySelectorAll('#teamContent .team-card').length`);
  check("组队视图渲染分析卡(4)", teamCards === 4, `cards=${teamCards}`);
  const filled = await conn.evals(`document.querySelectorAll('#teamContent .team-slot.is-filled').length`);
  check("填充槽位=2", filled === 2, `filled=${filled}`);
  const hashAfter = await conn.evals(`location.hash`);
  check("team hash 同步", hashAfter.startsWith('#/team/'), hashAfter);

  // 拿威胁去克制计算器（若有威胁按钮）
  const hasToCounter = await conn.evals(`!!document.querySelector('#teamContent button[data-team-to-counter]')`);
  if (hasToCounter) {
    await conn.evals(`document.querySelector('#teamContent button[data-team-to-counter]').click(); null`); await sleep(500);
    const cv = await conn.evals(`document.getElementById('counterView').classList.contains('is-active')`);
    const enemies = await conn.evals(`document.querySelectorAll('#selectedEnemies .selected-chip').length`);
    check("拿去克制→切到克制视图", cv === true);
    check("克制视图载入敌方", enemies >= 1, `enemies=${enemies}`);
  } else {
    check("拿去克制按钮存在", false, "无威胁数据(可能正常)");
  }

  // 逐视图切换（点 tab）
  const views = await conn.evals(`[...document.querySelectorAll('.view-tab[data-view]')].map(b=>b.dataset.view)`);
  for (const v of views) {
    await conn.evals(`document.querySelector('.view-tab[data-view="${v}"]').click(); null`);
    await sleep(250);
    const active = await conn.evals(`document.getElementById('${v}View')?.classList.contains('is-active')`);
    check(`切到视图 ${v}`, active === true);
  }

  await sleep(400);
  console.log(out.join("\n"));
  console.log("\n=== console 错误/异常 (" + conn.errors.length + ") ===");
  console.log(conn.errors.length ? conn.errors.join("\n") : "(无)");
  const failed = out.filter((l) => l.startsWith("FAIL")).length;
  console.log(`\n结果：${out.length - failed}/${out.length} 通过，${conn.errors.length} 个运行时错误`);
  process.exit(0);
})().catch((e) => { console.error("QA 脚本错误:", e.message); process.exit(1); });
