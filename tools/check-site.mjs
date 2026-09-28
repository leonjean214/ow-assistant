// tools/check-site.mjs — 零依赖静态体检脚本，只用 Node 标准库。
// 检查范围：
//   1) index.html / sw.js / overwolf 页面引用的本地资源路径是否存在
//   2) src 下 JS 的 import 是否指向存在的文件
//   3) sw.js 预缓存清单(APP_SHELL) 与「实际应被离线预缓存」的文件集合是否一致(多列/漏列都报)
//   4) manifest.webmanifest 图标路径是否存在、真实 PNG 尺寸是否与声明的 sizes 一致
//   5) data/*.json 能否解析、id 是否唯一、相互引用(克制关系/地图强势英雄/补丁英雄等)是否都指向存在的英雄
//   6) src 下每个 JS 文件跑 `node --check`(仅语法检查)
//   7) index.html 基础 a11y：img 缺 alt、button 无可访问名、表单控件无 label
//
// 用法：node tools/check-site.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];
const warnings = [];
const fail = (category, msg) => errors.push(`[${category}] ${msg}`);
const warn = (category, msg) => warnings.push(`[${category}] ${msg}`);

const readText = (absPath) => fs.readFileSync(absPath, "utf8");
const rel = (absPath) => path.relative(ROOT, absPath).split(path.sep).join("/");
const exists = (absPath) => fs.existsSync(absPath);

// ---------------------------------------------------------------------------
// 1) 本地资源引用检查
// ---------------------------------------------------------------------------

function isSkippablePath(p) {
  return (
    !p ||
    /^(https?:|mailto:|tel:|data:|blob:|javascript:|#)/.test(p) ||
    p === "." ||
    p === "./" ||
    p.startsWith("?")
  );
}

function stripQueryHash(p) {
  return p.split("#")[0].split("?")[0];
}

// 1a) HTML 文件的 src=/href= 引用，相对文档自身目录解析
function checkHtmlAttrRefs(htmlAbsPath) {
  const text = readText(htmlAbsPath);
  const dir = path.dirname(htmlAbsPath);
  const attrRegex = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = attrRegex.exec(text))) {
    let refPath = stripQueryHash(m[1]);
    if (isSkippablePath(refPath)) continue;
    if (refPath.startsWith("//")) continue; // 协议相对外链
    const abs = path.join(dir, refPath);
    if (!exists(abs)) {
      fail("resource", `${rel(htmlAbsPath)} 引用的本地资源不存在：${m[1]} (期望 ${rel(abs)})`);
    }
  }
  // index.html 里用字符串数组动态挂载的 <script type="module" src="..."> 也已被上面的
  // src="..." 正则命中一次；但数组写法是 JS 字符串字面量，不含 src= 前缀，这里补扫。
  const dynScriptRegex = /["'](\.\/[\w.\-/]+\.js)["']/g;
  while ((m = dynScriptRegex.exec(text))) {
    const abs = path.join(dir, m[1]);
    if (!exists(abs)) {
      fail("resource", `${rel(htmlAbsPath)} 动态加载脚本不存在：${m[1]} (期望 ${rel(abs)})`);
    }
  }
}

// 1b) JS 文件：import 语句相对模块自身目录解析；fetch()/*.src= 等运行时字符串字面量
//     相对「页面根目录」解析（浏览器里就是加载该页面的那个 HTML 所在目录）
function checkJsRefs(jsAbsPath, pageRootAbsDir) {
  const text = readText(jsAbsPath);
  const dir = path.dirname(jsAbsPath);

  const importRegex = /\bimport\s+(?:[^"'()]*?\sfrom\s+)?["'](\.[^"']+)["']/g;
  let m;
  while ((m = importRegex.exec(text))) {
    const abs = path.join(dir, m[1]);
    if (!exists(abs)) {
      fail("resource", `${rel(jsAbsPath)} import 的模块不存在：${m[1]} (期望 ${rel(abs)})`);
    }
  }

  // fetch("./data/xxx.json") / img.src = "./icons/xxx.png" / script.src = "./src/xxx.js" 等
  const literalRegex = /["'](\.\/(?:data|icons|src|overwolf)\/[\w.\-/]+\.\w+)["']/g;
  while ((m = literalRegex.exec(text))) {
    const abs = path.join(pageRootAbsDir, m[1]);
    if (!exists(abs)) {
      fail("resource", `${rel(jsAbsPath)} 引用的本地资源不存在：${m[1]} (期望 ${rel(abs)})`);
    }
  }
}

const rootIndexHtml = path.join(ROOT, "index.html");
const rootSwJs = path.join(ROOT, "sw.js");
checkHtmlAttrRefs(rootIndexHtml);
checkHtmlAttrRefs(path.join(ROOT, "overwolf/background.html"));
checkHtmlAttrRefs(path.join(ROOT, "overwolf/overlay.html"));

const srcDir = path.join(ROOT, "src");
const srcFiles = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.join(srcDir, f));
for (const f of srcFiles) checkJsRefs(f, ROOT);
checkJsRefs(path.join(ROOT, "overwolf/background.js"), path.join(ROOT, "overwolf"));

// sw.js 本身：检查其字符串字面量资源路径是否存在（不含 APP_SHELL，APP_SHELL 单独在第 3 节比对）
{
  const text = readText(rootSwJs);
  const literalRegex = /["'](\.\/(?:data|icons|src)\/[\w.\-/]+\.\w+)["']/g;
  let m;
  while ((m = literalRegex.exec(text))) {
    const abs = path.join(ROOT, m[1]);
    if (!exists(abs)) fail("resource", `sw.js 引用的本地资源不存在：${m[1]}`);
  }
}

// ---------------------------------------------------------------------------
// 2) sw.js 预缓存清单(APP_SHELL) vs 期望的离线资源集合
// ---------------------------------------------------------------------------

function extractAppShell(swText) {
  const m = swText.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  const items = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  return items;
}

function buildJsImportGraph(entryRelPaths) {
  const seen = new Set();
  const queue = [...entryRelPaths];
  while (queue.length) {
    const rp = queue.shift();
    if (seen.has(rp)) continue;
    seen.add(rp);
    const abs = path.join(ROOT, rp);
    if (!exists(abs)) continue;
    const text = readText(abs);
    const importRegex = /\bimport\s+(?:[^"'()]*?\sfrom\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = importRegex.exec(text))) {
      const depAbs = path.join(path.dirname(abs), m[1]);
      const depRel = rel(depAbs);
      if (!seen.has(depRel)) queue.push(depRel);
    }
  }
  return seen;
}

const appShell = extractAppShell(readText(rootSwJs));
if (!appShell) {
  fail("sw-precache", "sw.js 中未找到 APP_SHELL 数组，无法校验预缓存清单");
} else {
  // 期望预缓存的入口脚本：index.html 动态挂载的 ./src/app.js、./src/pwa.js，以及 <script defer> 的 ./src/theme.js
  const jsGraph = buildJsImportGraph(["src/app.js", "src/pwa.js", "src/theme.js"]);

  // 期望预缓存的数据文件：src/data.js 里所有 fetch("./data/xxx.json")
  const dataText = readText(path.join(srcDir, "data.js"));
  const expectedData = new Set(
    [...dataText.matchAll(/fetch\(["'](\.\/data\/[\w.\-]+\.json)["']\)/g)].map((x) => x[1].replace(/^\.\//, ""))
  );

  // 期望预缓存的图标：manifest.webmanifest 里的所有 icons + index.html 直接引用的 favicon
  const manifestJson = JSON.parse(readText(path.join(ROOT, "manifest.webmanifest")));
  const expectedIcons = new Set((manifestJson.icons || []).map((i) => i.src.replace(/^\.\//, "")));

  const expected = new Set([
    "./",
    "index.html",
    "manifest.webmanifest",
    "src/styles.css",
    ...jsGraph,
    ...expectedData,
    ...expectedIcons,
  ]);
  // 统一去掉前导 "./" 方便比较
  const normalize = (p) => p.replace(/^\.\//, "");
  const expectedNorm = new Set([...expected].map(normalize));
  const appShellNorm = appShell.map(normalize);
  const appShellSet = new Set(appShellNorm);

  // 清单里出现了但物理文件不存在
  for (const item of appShell) {
    const clean = normalize(item);
    if (clean === "" ) continue; // "./" 根路径本身
    const abs = path.join(ROOT, clean);
    if (!exists(abs)) fail("sw-precache", `sw.js APP_SHELL 列出的文件不存在：${item}`);
  }

  // 漏列：期望预缓存但清单里没有
  for (const item of expectedNorm) {
    if (item === "" ) continue;
    if (!appShellSet.has(item)) fail("sw-precache", `sw.js APP_SHELL 漏列了应离线可用的文件：./${item}`);
  }
  // 多列：清单里有但不在期望集合里（可能是废弃文件、拼错路径或未被任何入口引用的孤儿脚本）
  for (const item of appShellNorm) {
    if (item === "") continue;
    if (!expectedNorm.has(item)) warn("sw-precache", `sw.js APP_SHELL 多列了不在预期离线资源集合内的文件：./${item}（若确实需要请忽略，否则考虑删除）`);
  }
}

// ---------------------------------------------------------------------------
// 3) manifest 图标路径与尺寸
// ---------------------------------------------------------------------------

function readPngSize(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.length < 24 || buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

{
  const manifestAbs = path.join(ROOT, "manifest.webmanifest");
  const manifestJson = JSON.parse(readText(manifestAbs));
  for (const icon of manifestJson.icons || []) {
    const abs = path.join(ROOT, icon.src.replace(/^\.\//, ""));
    if (!exists(abs)) {
      fail("manifest-icon", `manifest.webmanifest 图标路径不存在：${icon.src}`);
      continue;
    }
    const declared = (icon.sizes || "").match(/^(\d+)x(\d+)$/);
    if (!declared) {
      warn("manifest-icon", `manifest.webmanifest 图标 ${icon.src} 的 sizes 字段格式异常：${icon.sizes}`);
      continue;
    }
    const [, w, h] = declared.map(Number.isNaN ? String : (x) => x);
    const declaredW = Number(declared[1]);
    const declaredH = Number(declared[2]);
    const actual = readPngSize(abs);
    if (!actual) {
      fail("manifest-icon", `${icon.src} 不是合法 PNG（无法读取 IHDR 尺寸）`);
    } else if (actual.width !== declaredW || actual.height !== declaredH) {
      fail(
        "manifest-icon",
        `manifest.webmanifest 中 ${icon.src} 声明尺寸 ${icon.sizes}，实际 PNG 尺寸为 ${actual.width}x${actual.height}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4) data/*.json 解析 + id 唯一 + 互相引用
// ---------------------------------------------------------------------------

function loadJson(relPath) {
  const abs = path.join(ROOT, relPath);
  try {
    return JSON.parse(readText(abs));
  } catch (e) {
    fail("data-json", `${relPath} 不是合法 JSON：${e.message}`);
    return null;
  }
}

const heroesData = loadJson("data/heroes.json");
const mapsData = loadJson("data/maps_meta.json");
const patchesData = loadJson("data/patches.json");
const workshopData = loadJson("data/workshop.json");
const notesData = loadJson("data/counter-notes.json");

let heroIds = new Set();
if (heroesData) {
  const heroes = heroesData.heroes || [];
  const idCount = new Map();
  for (const h of heroes) {
    if (!h.id) {
      fail("data-json", `data/heroes.json 存在缺少 id 字段的英雄条目：${h.name || h.nameZh || "(未知)"}`);
      continue;
    }
    idCount.set(h.id, (idCount.get(h.id) || 0) + 1);
  }
  for (const [id, count] of idCount) {
    if (count > 1) fail("data-json", `data/heroes.json 英雄 id 重复：${id}（出现 ${count} 次）`);
  }
  heroIds = new Set(heroes.map((h) => h.id).filter(Boolean));

  for (const h of heroes) {
    if (!h.id) continue;
    const counters = h.counters || {};
    for (const field of ["strongAgainst", "weakAgainst", "synergy"]) {
      for (const otherId of counters[field] || []) {
        if (!heroIds.has(otherId)) {
          fail(
            "data-json",
            `data/heroes.json 英雄 ${h.id} 的 counters.${field} 引用了不存在的英雄 id：${otherId}`
          );
        }
        if (otherId === h.id) {
          warn("data-json", `data/heroes.json 英雄 ${h.id} 的 counters.${field} 把自己列为关系对象`);
        }
      }
    }
  }
}

if (mapsData && heroIds.size) {
  const maps = mapsData.maps || {};
  for (const [mapId, mapInfo] of Object.entries(maps)) {
    for (const heroId of mapInfo.heroPicks || []) {
      if (!heroIds.has(heroId)) {
        fail("data-json", `data/maps_meta.json 地图 ${mapId} 的 heroPicks 引用了不存在的英雄 id：${heroId}`);
      }
    }
  }
}

if (patchesData && heroIds.size) {
  const timelineIds = new Map();
  for (const entry of patchesData.timeline || []) {
    if (entry.hero) {
      timelineIds.set(entry.hero, (timelineIds.get(entry.hero) || 0) + 1);
      if (!heroIds.has(entry.hero)) {
        fail("data-json", `data/patches.json timeline 引用了不存在的英雄 id：${entry.hero}`);
      }
    }
  }
  for (const [heroId, count] of timelineIds) {
    if (count > 1) warn("data-json", `data/patches.json timeline 中英雄 ${heroId} 出现 ${count} 次（发布时间线通常每位英雄一条）`);
  }

  const patchIds = new Map();
  for (const patch of patchesData.patches || []) {
    if (patch.id) patchIds.set(patch.id, (patchIds.get(patch.id) || 0) + 1);
    for (const change of patch.changes || []) {
      if (change.hero && !heroIds.has(change.hero)) {
        fail("data-json", `data/patches.json 补丁 ${patch.id || "(无 id)"} 的改动引用了不存在的英雄 id：${change.hero}`);
      }
    }
    if (patch.newHero && !heroIds.has(patch.newHero)) {
      fail("data-json", `data/patches.json 补丁 ${patch.id || "(无 id)"} 的 newHero 引用了不存在的英雄 id：${patch.newHero}`);
    }
  }
  for (const [id, count] of patchIds) {
    if (count > 1) fail("data-json", `data/patches.json 补丁 id 重复：${id}（出现 ${count} 次）`);
  }
  if (patchesData._meta?.latestHero && !heroIds.has(patchesData._meta.latestHero)) {
    fail("data-json", `data/patches.json _meta.latestHero 引用了不存在的英雄 id：${patchesData._meta.latestHero}`);
  }
}

if (notesData && heroIds.size) {
  const notes = notesData.notes || {};
  for (const heroId of Object.keys(notes)) {
    if (!heroIds.has(heroId)) {
      fail("data-json", `data/counter-notes.json 存在不属于任何英雄的 id：${heroId}`);
    }
  }
  const missingNotes = [...heroIds].filter((id) => !notes[id]);
  if (missingNotes.length) {
    warn("data-json", `data/counter-notes.json 缺少以下英雄的克制为什么说明：${missingNotes.join(", ")}`);
  }
}

if (workshopData) {
  const catIds = new Map();
  const codeSet = new Map();
  for (const cat of workshopData.categories || []) {
    if (cat.id) catIds.set(cat.id, (catIds.get(cat.id) || 0) + 1);
    for (const code of cat.codes || []) {
      if (!code.code) continue;
      const key = code.code;
      codeSet.set(key, (codeSet.get(key) || 0) + 1);
    }
  }
  for (const [id, count] of catIds) {
    if (count > 1) fail("data-json", `data/workshop.json 分类 id 重复：${id}（出现 ${count} 次）`);
  }
  for (const [code, count] of codeSet) {
    if (count > 1) warn("data-json", `data/workshop.json 工坊代码 ${code} 在多个分类中重复出现（出现 ${count} 次）`);
  }
}

// ---------------------------------------------------------------------------
// 5) src 下每个 JS 文件跑 node --check（仅语法检查）
// ---------------------------------------------------------------------------

for (const f of srcFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    fail("syntax", `${rel(f)} 语法检查失败：${e.stderr?.toString().trim() || e.message}`);
  }
}
try {
  execFileSync(process.execPath, ["--check", path.join(ROOT, "overwolf/background.js")], { stdio: "pipe" });
} catch (e) {
  fail("syntax", `overwolf/background.js 语法检查失败：${e.stderr?.toString().trim() || e.message}`);
}

// ---------------------------------------------------------------------------
// 6) index.html 基础 a11y：img 缺 alt / button 无可访问名 / 表单控件无 label
// ---------------------------------------------------------------------------

function checkA11y(htmlAbsPath) {
  const text = readText(htmlAbsPath);
  const file = rel(htmlAbsPath);

  // img 缺 alt
  const imgRegex = /<img\b([^>]*)>/g;
  let m;
  while ((m = imgRegex.exec(text))) {
    if (!/\balt\s*=/.test(m[1])) {
      fail("a11y", `${file} 存在缺少 alt 属性的 <img>：${m[0].slice(0, 80)}`);
    }
  }

  // button 无可访问名：既无 aria-label/aria-labelledby，也无静态文本，也不是靠 data-i18n 在运行时填充文案
  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  while ((m = buttonRegex.exec(text))) {
    const attrs = m[1];
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    const hasAriaLabel = /\baria-label(ledby)?\s*=/.test(attrs);
    const hasI18n = /\bdata-i18n(-aria-label)?\s*=/.test(attrs) || /\bdata-i18n\b/.test(m[2]);
    if (!hasAriaLabel && !hasI18n && inner.length === 0) {
      fail("a11y", `${file} 存在无可访问名的 <button>：${m[0].slice(0, 100)}`);
    }
  }

  // 表单控件需要 label（或 aria-label/aria-labelledby），忽略 type=hidden
  const labelForIds = new Set([...text.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/g)].map((x) => x[1]));
  const controlRegex = /<(input|select|textarea)\b([^>]*)>/g;
  while ((m = controlRegex.exec(text))) {
    const tag = m[1];
    const attrs = m[2];
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "text";
    if (tag === "input" && (type === "hidden" || type === "submit" || type === "button")) continue;
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : null;
    const hasAriaLabel = /\baria-label(ledby)?\s*=/.test(attrs);
    const hasTitle = /\btitle\s*=/.test(attrs);
    const wrappedByLabel = id && labelForIds.has(id);
    // 也允许祖先是 <label> 包裹（无 for，直接嵌套），此处做粗略邻近文本判断：
    // 找到该控件前 200 字符内是否处于未闭合的 <label ...> 内
    let wrappingLabel = false;
    if (!wrappedByLabel && id) {
      const before = text.slice(Math.max(0, m.index - 400), m.index);
      const openLabel = before.lastIndexOf("<label");
      const closeLabel = before.lastIndexOf("</label>");
      wrappingLabel = openLabel > -1 && openLabel > closeLabel;
    }
    if (!hasAriaLabel && !hasTitle && !wrappedByLabel && !wrappingLabel) {
      fail(
        "a11y",
        `${file} 存在缺少可访问 label 的 <${tag}>${id ? ` id="${id}"` : ""}：${m[0].slice(0, 100)}`
      );
    }
  }
}

checkA11y(rootIndexHtml);

// ---------------------------------------------------------------------------
// 汇总输出
// ---------------------------------------------------------------------------

console.log(`\n=== check-site.mjs 体检结果 ===`);
console.log(`ERROR: ${errors.length}  WARN: ${warnings.length}\n`);
for (const e of errors) console.log("FAIL |", e);
for (const w of warnings) console.log("WARN |", w);
if (!errors.length && !warnings.length) console.log("全部检查通过，无发现问题。");

process.exit(errors.length ? 1 : 0);
