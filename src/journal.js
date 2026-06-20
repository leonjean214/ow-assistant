export const JOURNAL_KEY = "ow-journal";
export const JOURNAL_LIMIT = 1000;

const RESULT_LABELS = { win: "胜", loss: "负", draw: "平" };
const RESULT_CODES = { win: "W", loss: "L", draw: "D" };
const VALID_RESULTS = new Set(["win", "loss", "draw"]);

export function loadJournal(storage = storageRef()) {
  try {
    const parsed = JSON.parse(storage.getItem(JOURNAL_KEY) || "[]");
    return normalizeJournalEntries(parsed);
  } catch {
    return [];
  }
}

export function saveJournal(entries, storage = storageRef()) {
  const normalized = normalizeJournalEntries(entries).slice(0, JOURNAL_LIMIT);
  try {
    storage.setItem(JOURNAL_KEY, JSON.stringify(normalized));
  } catch {
    // Session journal is best-effort if storage is unavailable.
  }
  return normalized;
}

export function addJournalEntry(entries, entry, storage = storageRef()) {
  const normalized = normalizeJournalEntry(entry);
  if (!normalized) return saveJournal(entries, storage);
  return saveJournal([normalized, ...normalizeJournalEntries(entries)], storage);
}

export function removeJournalEntry(entries, id, storage = storageRef()) {
  const target = String(id || "");
  return saveJournal(normalizeJournalEntries(entries).filter((entry) => entry.id !== target), storage);
}

export function clearJournal(storage = storageRef()) {
  try {
    storage.removeItem(JOURNAL_KEY);
  } catch {
    // Clearing is best-effort if storage is unavailable.
  }
  return [];
}

export function summarizeJournal(entries, heroesById = new Map(), options = {}) {
  const rows = normalizeJournalEntries(entries);
  const todayKey = localDateKey(options.now || Date.now());
  const total = countResults(rows);
  const today = countResults(rows.filter((entry) => localDateKey(entry.ts) === todayKey));
  return {
    total,
    today,
    streak: currentStreak(rows),
    recent: rows.slice(0, 10).map((entry) => ({
      id: entry.id,
      result: entry.result,
      code: RESULT_CODES[entry.result],
      label: RESULT_LABELS[entry.result]
    })),
    heroes: aggregateByHero(rows, heroesById),
    maps: aggregateByMap(rows)
  };
}

export function aggregateByHero(entries, heroesById = new Map()) {
  const groups = new Map();
  for (const entry of normalizeJournalEntries(entries)) {
    if (!entry.heroId) continue;
    if (!groups.has(entry.heroId)) groups.set(entry.heroId, createCounter(entry.heroId));
    addResult(groups.get(entry.heroId), entry.result);
  }
  return [...groups.values()].map((row) => {
    const hero = heroesById.get(row.key) || null;
    return {
      ...withWinrate(row),
      hero,
      heroId: row.key,
      name: hero?.name || row.key,
      nameZh: hero?.nameZh || row.key,
      role: hero?.role || ""
    };
  }).sort(compareAggregateRows);
}

export function aggregateByMap(entries) {
  const groups = new Map();
  for (const entry of normalizeJournalEntries(entries)) {
    const key = entry.mapKey || entry.mapName;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, createCounter(key, entry.mapName || key));
    addResult(groups.get(key), entry.result);
  }
  return [...groups.values()].map((row) => ({
    ...withWinrate(row),
    mapKey: row.key,
    mapName: row.name || row.key
  })).sort(compareAggregateRows);
}

export function normalizeJournalEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map(normalizeJournalEntry)
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts || String(b.id).localeCompare(String(a.id)))
    .slice(0, JOURNAL_LIMIT);
}

export function normalizeJournalEntry(entry = {}) {
  const result = String(entry.result || "").trim();
  if (!VALID_RESULTS.has(result)) return null;
  const heroId = String(entry.heroId || "").trim();
  if (!heroId) return null;
  const ts = Number(entry.ts);
  const safeTs = Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  const id = String(entry.id || `j-${safeTs}-${Math.random().toString(36).slice(2, 8)}`);
  return {
    id,
    ts: safeTs,
    result,
    heroId,
    mapKey: String(entry.mapKey || "").trim(),
    mapName: String(entry.mapName || "").trim(),
    role: String(entry.role || "").trim(),
    enemyNote: String(entry.enemyNote || "").trim(),
    note: String(entry.note || "").trim()
  };
}

function countResults(entries) {
  const counter = createCounter("summary");
  for (const entry of entries) addResult(counter, entry.result);
  return withWinrate(counter);
}

function currentStreak(entries) {
  const rows = normalizeJournalEntries(entries);
  const first = rows[0];
  if (!first) return { result: "", count: 0, label: "暂无记录" };
  if (first.result === "draw") return { result: "draw", count: 0, label: "最近为平局" };
  let count = 0;
  for (const entry of rows) {
    if (entry.result !== first.result) break;
    count += 1;
  }
  return {
    result: first.result,
    count,
    label: `${first.result === "win" ? "连胜" : "连败"} ${count}`
  };
}

function createCounter(key, name = "") {
  return { key, name, games: 0, wins: 0, losses: 0, draws: 0 };
}

function addResult(counter, result) {
  counter.games += 1;
  if (result === "win") counter.wins += 1;
  if (result === "loss") counter.losses += 1;
  if (result === "draw") counter.draws += 1;
}

function withWinrate(counter) {
  const decided = counter.wins + counter.losses;
  return {
    ...counter,
    decided,
    winrate: decided ? (counter.wins / decided) * 100 : 0
  };
}

function compareAggregateRows(a, b) {
  return b.games - a.games || b.winrate - a.winrate || String(a.name || a.key).localeCompare(String(b.name || b.key), "zh-Hans-CN");
}

function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function storageRef() {
  return globalThis.localStorage;
}

function selfTest() {
  const heroes = new Map([
    ["ana", { id: "ana", name: "Ana", nameZh: "安娜", role: "support" }],
    ["genji", { id: "genji", name: "Genji", nameZh: "源氏", role: "damage" }]
  ]);
  const base = new Date(2026, 5, 20, 12, 0, 0).getTime();
  const entries = [
    { id: "4", ts: base + 4, result: "win", heroId: "ana", mapKey: "kings-row", mapName: "国王大道" },
    { id: "3", ts: base + 3, result: "win", heroId: "ana", mapKey: "kings-row", mapName: "国王大道" },
    { id: "2", ts: base + 2, result: "draw", heroId: "genji", mapKey: "ilios", mapName: "伊利奥斯" },
    { id: "1", ts: base + 1, result: "loss", heroId: "genji", mapKey: "ilios", mapName: "伊利奥斯" }
  ];
  const summary = summarizeJournal(entries, heroes, { now: base });
  console.assert(summary.total.games === 4 && summary.total.winrate === 66.66666666666666, "journal: 总胜率应排除平局分母");
  console.assert(summary.today.games === 4, "journal: 今日场次应按本地日期统计");
  console.assert(summary.streak.result === "win" && summary.streak.count === 2, "journal: 应从最近一局向前计算连胜");
  console.assert(summary.recent.map((item) => item.code).join("") === "WWDL", "journal: 最近走势应按新到旧输出");
  console.assert(summary.heroes[0].heroId === "ana" && summary.heroes[0].winrate === 100, "journal: 英雄聚合应按场次和胜率排序");
  console.assert(summary.maps.find((row) => row.mapKey === "ilios").draws === 1, "journal: 地图聚合应保留平局数");
  console.assert(normalizeJournalEntries([{ result: "bad" }, entries[0]]).length === 1, "journal: 应过滤损坏记录");
  return true;
}

selfTest();
