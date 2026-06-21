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
    if (r.result?.exceptionDetails) {
      const detail = r.result.exceptionDetails;
      const message = detail.exception?.description || detail.exception?.value || detail.text;
      throw new Error("eval err: " + message);
    }
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

  await c.evals(`(async()=>{
    try{localStorage.clear()}catch(e){}
    try{for (const key of await caches.keys()) await caches.delete(key)}catch(e){}
    try{for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister()}catch(e){}
    location.href=${JSON.stringify(BASE)} + '/?qa=' + Date.now() + '#/heroes';
    return null;
  })()`);
  await sleep(2500);
  await c.evals(`(async()=>{ window.__qaHeroes = await fetch('/data/heroes.json').then((r)=>r.json()).then((data)=>data.heroes); return null; })()`);

  check("英雄库渲染", await c.evals(`document.querySelectorAll('#heroGrid .hero-card').length`) >= 40);

  const listInitial = await c.evals(`(()=>{
    document.querySelector('#heroViewToggle button[data-hero-view="list"]').click();
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-list-row'));
    const ths=Array.from(document.querySelectorAll('#heroGrid thead th'));
    return {
      stored: localStorage.getItem('ow-hero-view'),
      rows: rows.length,
      cards: document.querySelectorAll('#heroGrid .hero-card').length,
      caption: document.querySelector('#heroGrid caption')?.textContent,
      scopeOk: ths.every((th)=>th.getAttribute('scope')==='col') && document.querySelector('#heroGrid tbody th')?.getAttribute('scope')==='row',
      pressedList: document.querySelector('#heroViewToggle button[data-hero-view="list"]')?.getAttribute('aria-pressed'),
      pressedGrid: document.querySelector('#heroViewToggle button[data-hero-view="grid"]')?.getAttribute('aria-pressed')
    };
  })()`);
  check("列表模式渲染表格", listInitial.rows >= 40 && listInitial.cards === 0);
  check("列表模式持久化 ow-hero-view", listInitial.stored === "list");
  check("列表表格 a11y caption/scope", listInitial.caption === "英雄库列表" && listInitial.scopeOk === true);
  check("视图切换 aria-pressed", listInitial.pressedList === "true" && listInitial.pressedGrid === "false");

  await c.evals(`location.reload(); null`);
  await sleep(1800);
  await c.evals(`(async()=>{ window.__qaHeroes = await fetch('/data/heroes.json').then((r)=>r.json()).then((data)=>data.heroes); return null; })()`);
  check("刷新保持列表模式", (await c.evals(`document.querySelectorAll('#heroGrid .hero-list-row').length`)) >= 40 && (await c.evals(`localStorage.getItem('ow-hero-view')`)) === "list");

  const listRowOpenOk = await c.evals(`(async()=>{
    const row=document.querySelector('#heroGrid .hero-list-row');
    row.click();
    await new Promise((r)=>setTimeout(r,250));
    const opened=document.getElementById('detailDrawer').classList.contains('is-open');
    document.getElementById('closeDrawer').click();
    await new Promise((r)=>setTimeout(r,150));
    return opened;
  })()`);
  check("列表点行打开详情", listRowOpenOk === true);
  const listFavNoOpen = await c.evals(`(async()=>{
    const button=document.querySelector('#heroGrid button[data-favorite-hero]');
    const id=button.dataset.favoriteHero;
    button.click();
    await new Promise((r)=>setTimeout(r,120));
    const noOpen=!document.getElementById('detailDrawer').classList.contains('is-open');
    const storedAfterAdd=JSON.parse(localStorage.getItem('ow-favorites')||'[]').includes(id);
    document.querySelector('#heroGrid button[data-favorite-hero="'+CSS.escape(id)+'"]').click();
    await new Promise((r)=>setTimeout(r,120));
    const removed=!JSON.parse(localStorage.getItem('ow-favorites')||'[]').includes(id);
    return noOpen && storedAfterAdd && removed;
  })()`);
  check("列表点★收藏且不误开详情", listFavNoOpen === true);

  const listSortChecks = await c.evals(`(()=>{
    const hp=(hero)=>(hero.health?.hp||0)+(hero.health?.armor||0)+(hero.health?.shield||0);
    const heroes=()=>Array.from(document.querySelectorAll('#heroGrid .hero-list-row')).map((row)=>window.__qaHeroes.find((hero)=>hero.id===row.dataset.heroId));
    document.querySelector('button[data-hero-list-sort="tier"]').click();
    const rank={S:0,A:1,B:2,C:3};
    const tierOk=document.getElementById('heroSortFilter').value==='tier'
      && document.querySelector('button[data-hero-list-sort="tier"]').closest('th').getAttribute('aria-sort')==='descending'
      && heroes().every((hero,index,rows)=>index===0 || (rank[rows[index-1].tier]??9) <= (rank[hero.tier]??9));
    document.getElementById('heroSortFilter').value='hp-desc';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const hpOk=document.querySelector('button[data-hero-list-sort="hp"]').closest('th').getAttribute('aria-sort')==='descending'
      && heroes().every((hero,index,rows)=>index===0 || hp(rows[index-1]) >= hp(hero));
    document.querySelector('button[data-hero-list-sort="difficulty"]').click();
    const diffAsc=document.getElementById('heroSortFilter').value==='diff-asc'
      && document.querySelector('button[data-hero-list-sort="difficulty"]').closest('th').getAttribute('aria-sort')==='ascending';
    document.querySelector('button[data-hero-list-sort="difficulty"]').click();
    const diffDesc=document.getElementById('heroSortFilter').value==='diff-desc'
      && document.querySelector('button[data-hero-list-sort="difficulty"]').closest('th').getAttribute('aria-sort')==='descending';
    return { tierOk, hpOk, diffAsc, diffDesc };
  })()`);
  check("列表表头 Tier 排序同步下拉/aria-sort", listSortChecks.tierOk === true);
  check("排序下拉同步列表 HP aria-sort", listSortChecks.hpOk === true);
  check("列表难度表头可升降切换", listSortChecks.diffAsc === true && listSortChecks.diffDesc === true);

  const listFilterState = await c.evals(`(()=>{
    document.getElementById('tierFilter').value='S';
    document.getElementById('tierFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const listOk=Array.from(document.querySelectorAll('#heroGrid .hero-list-row')).every((row)=>window.__qaHeroes.find((hero)=>hero.id===row.dataset.heroId)?.tier==='S');
    document.querySelector('#heroViewToggle button[data-hero-view="grid"]').click();
    const gridOk=document.getElementById('tierFilter').value==='S'
      && document.getElementById('heroSortFilter').value==='diff-desc'
      && document.querySelectorAll('#heroGrid .hero-card').length===window.__qaHeroes.filter((hero)=>hero.tier==='S').length;
    document.querySelector('#heroViewToggle button[data-hero-view="list"]').click();
    const backOk=document.querySelectorAll('#heroGrid .hero-list-row').length===window.__qaHeroes.filter((hero)=>hero.tier==='S').length;
    document.getElementById('tierFilter').value='all';
    document.getElementById('tierFilter').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('heroSortFilter').value='default';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    return { listOk, gridOk, backOk };
  })()`);
  check("列表筛选叠加生效", listFilterState.listOk === true);
  check("切模式不丢筛选/排序状态", listFilterState.gridOk === true && listFilterState.backOk === true);

  await c.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  const listMobileOk = await c.evals(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth && document.querySelector('.hero-list-wrap').scrollWidth >= document.querySelector('.hero-list-wrap').clientWidth`);
  check("375px 列表仅表格容器横向滚动", listMobileOk === true);
  await c.send("Emulation.clearDeviceMetricsOverride");
  await c.evals(`document.querySelector('#heroViewToggle button[data-hero-view="grid"]').click(); null`);

  // Phase 17：英雄库排序 + 多标签筛选
  const heroOrderExpr = `Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>card.dataset.heroId)`;
  const tierRanksOk = await c.evals(`(()=>{
    const rank={S:0,A:1,B:2,C:3};
    document.getElementById('heroSortFilter').value='tier';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>window.__qaHeroes.find((hero)=>hero.id===card.dataset.heroId));
    return rows.every((hero,index)=>index===0 || (rank[rows[index-1].tier]??9) <= (rank[hero.tier]??9));
  })()`);
  check("英雄库 Tier 排序 S>A>B>C", tierRanksOk === true);
  const diffAscOk = await c.evals(`(()=>{
    document.getElementById('heroSortFilter').value='diff-asc';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>window.__qaHeroes.find((hero)=>hero.id===card.dataset.heroId));
    return rows.every((hero,index)=>index===0 || Number(rows[index-1].difficulty ?? 99) <= Number(hero.difficulty ?? 99));
  })()`);
  check("英雄库难度升序 null 垫底", diffAscOk === true);
  const diffDescOk = await c.evals(`(()=>{
    document.getElementById('heroSortFilter').value='diff-desc';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>window.__qaHeroes.find((hero)=>hero.id===card.dataset.heroId));
    return rows.every((hero,index)=>index===0 || (rows[index-1].difficulty == null ? -1 : rows[index-1].difficulty) >= (hero.difficulty == null ? -1 : hero.difficulty));
  })()`);
  check("英雄库难度降序 null 垫底", diffDescOk === true);
  const hpDescOk = await c.evals(`(()=>{
    document.getElementById('heroSortFilter').value='hp-desc';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const hp=(hero)=>(hero.health?.hp||0)+(hero.health?.armor||0)+(hero.health?.shield||0);
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>window.__qaHeroes.find((hero)=>hero.id===card.dataset.heroId));
    return rows.every((hero,index)=>index===0 || hp(rows[index-1]) >= hp(hero));
  })()`);
  check("英雄库总有效生命降序", hpDescOk === true);
  const nameOk = await c.evals(`(()=>{
    document.getElementById('heroSortFilter').value='name';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const rows=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>window.__qaHeroes.find((hero)=>hero.id===card.dataset.heroId));
    return rows.every((hero,index)=>index===0 || String(rows[index-1].nameZh||rows[index-1].name).localeCompare(String(hero.nameZh||hero.name),'zh-Hans-CN') <= 0);
  })()`);
  check("英雄库名称排序 zh-Hans-CN", nameOk === true);
  const invalidFallbackOk = await c.evals(`(()=>{
    const rank={S:0,A:1,B:2,C:3};
    const invalid={id:'qa-invalid-tier',name:'ZZZ QA',nameZh:'ZZZ测试',role:'damage',tier:'Z',difficulty:null,health:{hp:1,armor:0,shield:0},tags:['qa-null'],ban:{priority:'low'},subrole:''};
    const rows=[window.__qaHeroes[0], invalid, window.__qaHeroes.find((hero)=>['S','A','B','C'].includes(hero.tier))].sort((a,b)=>(rank[a.tier]??9)-(rank[b.tier]??9));
    return rows.at(-1).id === 'qa-invalid-tier';
  })()`);
  check("无效 tier 排序兜底垫底", invalidFallbackOk === true);

  // 收藏
  await c.evals(`document.getElementById('heroSortFilter').value='default'; document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true})); Array.from(document.querySelectorAll('#heroGrid button[data-favorite-hero]')).at(-1).click(); null`);
  check("收藏写入 ow-favorites", (await c.evals(`JSON.parse(localStorage.getItem('ow-favorites')||'[]').length`)) === 1);
  check("收藏不误开详情", (await c.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`)) === false);
  const favoriteDefaultTop = await c.evals(`(()=>{
    const fav=JSON.parse(localStorage.getItem('ow-favorites')||'[]')[0];
    document.getElementById('heroSortFilter').value='default';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    return document.querySelector('#heroGrid .hero-card')?.dataset.heroId === fav;
  })()`);
  check("默认排序仍收藏置顶", favoriteDefaultTop === true);
  const nonDefaultNoFavoritePin = await c.evals(`(()=>{
    const fav=JSON.parse(localStorage.getItem('ow-favorites')||'[]')[0];
    document.getElementById('heroSortFilter').value='name';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    return document.querySelector('#heroGrid .hero-card')?.dataset.heroId !== fav;
  })()`);
  check("非默认排序不强制收藏置顶", nonDefaultNoFavoritePin === true);

  const tagChecks = await c.evals(`(()=>{
    const buttons=Array.from(document.querySelectorAll('#heroTagFilters button[data-hero-tag]'));
    const chosen=buttons.map((button)=>button.dataset.heroTag).filter((tag)=>window.__qaHeroes.some((hero)=>hero.tags?.includes(tag)));
    const pair=chosen.find((tag)=>window.__qaHeroes.some((hero)=>hero.tags?.includes(tag) && hero.tags.some((other)=>other!==tag && chosen.includes(other))));
    const hero=window.__qaHeroes.find((item)=>item.tags?.includes(pair) && item.tags.some((other)=>other!==pair && chosen.includes(other)));
    const other=hero.tags.find((tag)=>tag!==pair && chosen.includes(tag));
    const clickTag=(tag)=>document.querySelector('#heroTagFilters button[data-hero-tag="'+CSS.escape(tag)+'"]').click();
    document.getElementById('heroSortFilter').value='default';
    document.getElementById('heroSortFilter').dispatchEvent(new Event('change',{bubbles:true}));
    clickTag(pair); clickTag(other);
    const selectedPressed=Array.from(document.querySelectorAll('#heroTagFilters button[aria-pressed="true"]')).length === 2;
    const orIds=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>card.dataset.heroId);
    document.getElementById('tagMatchToggle').click();
    const andIds=Array.from(document.querySelectorAll('#heroGrid .hero-card')).map((card)=>card.dataset.heroId);
    const expectedOr=window.__qaHeroes.filter((item)=>item.tags?.includes(pair)||item.tags?.includes(other)).length;
    const expectedAnd=window.__qaHeroes.filter((item)=>item.tags?.includes(pair)&&item.tags?.includes(other)).length;
    document.getElementById('tierFilter').value='S';
    document.getElementById('tierFilter').dispatchEvent(new Event('change',{bubbles:true}));
    const stacked=Array.from(document.querySelectorAll('#heroGrid .hero-card')).every((card)=>{
      const item=window.__qaHeroes.find((h)=>h.id===card.dataset.heroId);
      return item.tier==='S' && item.tags?.includes(pair) && item.tags?.includes(other);
    });
    document.getElementById('searchInput').value='zzzz-no-match';
    document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}));
    const emptyShown=!document.getElementById('heroEmpty').hidden && document.getElementById('heroEmpty').textContent.includes('减少标签');
    document.getElementById('clearTagFilters').click();
    const cleared=Array.from(document.querySelectorAll('#heroTagFilters button[aria-pressed="true"]')).length===0 && document.getElementById('clearTagFilters').disabled;
    document.getElementById('searchInput').value='';
    document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('tierFilter').value='all';
    document.getElementById('tierFilter').dispatchEvent(new Event('change',{bubbles:true}));
    return { selectedPressed, orOk:orIds.length===expectedOr, andOk:andIds.length===expectedAnd, stacked, emptyShown, cleared };
  })()`);
  check("多标签 pill aria-pressed", tagChecks.selectedPressed === true);
  check("多标签 OR 生效", tagChecks.orOk === true);
  check("多标签 AND 生效", tagChecks.andOk === true);
  check("多标签与其它筛选叠加", tagChecks.stacked === true);
  check("标签筛选空态友好", tagChecks.emptyShown === true);
  check("清空标签恢复控件状态", tagChecks.cleared === true);
  await c.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  check("375px 英雄库无横向溢出", (await c.evals(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth`)) === true);
  await c.send("Emulation.clearDeviceMetricsOverride");

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
    check("克制结果显示对面阵容原型", (await c.evals(`document.querySelectorAll('#counterResults .enemy-comp').length`)) === 1);
  }

  // 英雄详情深链 + 焦点 + 克制上色
  await c.evals(`location.hash='#/hero/genji'; null`); await sleep(700);
  check("英雄深链开抽屉", (await c.evals(`document.getElementById('detailDrawer').classList.contains('is-open')`)) === true);
  check("抽屉焦点在内", (await c.evals(`document.getElementById('detailDrawer').contains(document.activeElement)`)) === true);
  check("克制链接已上色", (await c.evals(`document.querySelectorAll('#detailContent .hero-link-strong, #detailContent .hero-link-weak').length`)) >= 1);
  check("源氏详情有克制为什么", (await c.evals(`document.querySelectorAll('#detailContent .counter-why').length`)) === 1);
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

  // 键盘快捷键
  await c.evals(`location.hash='#/heroes'; document.body.focus(); null`); await sleep(200);
  await c.evals(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true})); null`); await sleep(200);
  check("快捷键 / 跳战绩并聚焦搜索", (await c.evals(`document.activeElement && document.activeElement.id === 'playerSearchInput'`)) === true);
  await c.evals(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'b',bubbles:true})); null`); await sleep(200);
  check("快捷键 b 跳英雄库并聚焦筛选", (await c.evals(`document.activeElement && document.activeElement.id === 'searchInput'`)) === true);

  // 工坊代码模块
  await c.evals(`location.hash='#/workshop'; null`); await sleep(500);
  check("工坊视图激活", (await c.evals(`document.getElementById('workshopView').classList.contains('is-active')`)) === true);
  check("工坊渲染分类卡", (await c.evals(`document.querySelectorAll('#workshopContent .workshop-cat').length`)) >= 3);
  check("工坊有可复制代码按钮", (await c.evals(`document.querySelectorAll('#workshopContent button[data-copy-code]').length`)) >= 5);
  check("工坊有免责声明", (await c.evals(`document.querySelectorAll('#workshopContent .workshop-disclaimer').length`)) === 1);

  // 个人中心
  await c.evals(`location.hash='#/me'; null`); await sleep(500);
  check("个人中心视图激活", (await c.evals(`document.getElementById('meView').classList.contains('is-active')`)) === true);
  check("个人中心有资料表单", (await c.evals(`document.querySelectorAll('#meContent .me-form .field').length`)) >= 4);
  check("个人中心有概览统计", (await c.evals(`document.querySelectorAll('#meContent .me-stat').length`)) === 4);
  // 改昵称→持久化
  await c.evals(`(()=>{const i=document.querySelector('#meContent .me-form input');i.value='测试昵称';i.dispatchEvent(new Event('change',{bubbles:true}));})(); null`); await sleep(300);
  check("昵称写入 ow-profile", (await c.evals(`(JSON.parse(localStorage.getItem('ow-profile')||'{}').nickname)==='测试昵称'`)) === true);

  // Overwolf 消息桥(W1 SPA 侧)：模拟 overlay 转发本方英雄
  await c.evals(`location.hash='#/counter'; null`); await sleep(200);
  await c.evals(`window.postMessage({source:'owgep',kind:'my-hero',heroId:'genji'},'*'); null`); await sleep(300);
  check("GEP my-hero→设为克制当前英雄", (await c.evals(`document.getElementById('currentHeroSelect')?.value === 'genji'`)) === true);
  await c.evals(`window.postMessage({source:'owgep',kind:'enemies',heroIds:['winston','ana']},'*'); null`); await sleep(300);
  check("GEP enemies→灌入克制敌方", (await c.evals(`document.querySelectorAll('#selectedEnemies .selected-chip').length`)) >= 2);

  // overlay
  await c.evals(`location.href = '${BASE}/?overlay=1'; null`); await sleep(1800);
  check("overlay 模式 body.is-overlay", (await c.evals(`document.body.classList.contains('is-overlay')`)) === true);
  const overlayComp = await c.evals(`(()=>{const chip=document.querySelector('#overlayCounterMount .select-chip');if(!chip)return 'no-chip';chip.click();return document.querySelectorAll('#overlayCounterMount .enemy-comp').length})()`);
  check("overlay 选敌后显示对面阵容", overlayComp === 1, `v=${overlayComp}`);

  await sleep(300);
  console.log(out.join("\n"));
  console.log("\n=== console 错误/异常 (" + c.errors.length + ") ===");
  console.log(c.errors.length ? c.errors.join("\n") : "(无)");
  const failed = out.filter((l) => l.startsWith("FAIL")).length;
  console.log(`\n结果：${out.length - failed}/${out.length} 通过，${c.errors.length} 个运行时错误`);
  process.exit(failed || c.errors.length ? 1 : 0);
})().catch((e) => { console.error("QA 脚本错误:", e.message); process.exit(1); });
