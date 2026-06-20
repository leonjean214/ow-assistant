// 个人中心数据层。当前用 localStorage；【云同步预留】把 adapter 换成远端实现即可（见 setStorageAdapter）。
const PROFILE_KEY = "ow-profile";

// 存储适配器：实现 { get(key):string|null, set(key,val):void } 即可替换为远端（如 Supabase）。
const localAdapter = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, val) { try { window.localStorage.setItem(key, val); } catch { /* 存储不可用时忽略 */ } }
};
let adapter = localAdapter;

// 接云同步时调用：setStorageAdapter(remoteAdapter)。其余代码无需改动。
export function setStorageAdapter(next) { adapter = next || localAdapter; }

export const DEFAULT_PROFILE = { nickname: "", battletag: "", mainRole: "", avatarHeroId: "" };
export const ROLE_OPTIONS = [["", "未设置"], ["tank", "坦克"], ["damage", "输出"], ["support", "辅助"]];

export function loadProfile() {
  try {
    const raw = adapter.get(PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_PROFILE, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile) {
  try {
    adapter.set(PROFILE_KEY, JSON.stringify({ ...DEFAULT_PROFILE, ...(profile || {}) }));
  } catch { /* 忽略 */ }
}

// 个人中心要备份/聚合的全部本地 key。
export const LOCAL_KEYS = ["ow-profile", "ow-favorites", "ow-compare", "ow-team", "ow-journal", "ow-theme", "ow:recentPlayers"];

function readArray(key) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// 概览计数（不依赖其它模块内存态，直接读 localStorage，便于个人中心独立渲染）。
export function localOverview() {
  return {
    favorites: readArray("ow-favorites").length,
    compare: readArray("ow-compare").length,
    team: readArray("ow-team").length,
    journal: readArray("ow-journal").length,
    recentPlayers: readArray("ow:recentPlayers")
  };
}

// 全量本地数据备份（账号云同步前的“备份/迁移”替身）。
export function exportAllLocal() {
  const data = {};
  for (const k of LOCAL_KEYS) {
    const v = window.localStorage.getItem(k);
    if (v != null) data[k] = v;
  }
  return { app: "ow-assistant", version: 1, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text) {
  try {
    const parsed = JSON.parse(String(text || ""));
    if (!parsed || typeof parsed.data !== "object" || parsed.app !== "ow-assistant") {
      return { ok: false, error: "不是本应用的备份文件。" };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, error: "备份文件已损坏或格式不正确。" };
  }
}

export function importAllLocal(payload) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return { ok: false, count: 0 };
  let count = 0;
  for (const k of LOCAL_KEYS) {
    if (typeof data[k] === "string") {
      try { window.localStorage.setItem(k, data[k]); count += 1; } catch { /* 忽略单项失败 */ }
    }
  }
  return { ok: true, count };
}

export function clearAllLocal() {
  for (const k of LOCAL_KEYS) {
    try { window.localStorage.removeItem(k); } catch { /* 忽略 */ }
  }
}

// 自测
function selfTest() {
  const p = { ...DEFAULT_PROFILE, nickname: "x" };
  console.assert(loadProfile().nickname !== undefined, "profile: loadProfile 返回含默认字段");
  const bad = parseBackup("{bad");
  console.assert(!bad.ok && bad.error, "profile: 损坏备份返回错误");
  const ok = parseBackup(JSON.stringify({ app: "ow-assistant", data: { "ow-theme": "dark" } }));
  console.assert(ok.ok && ok.payload.data["ow-theme"] === "dark", "profile: 合法备份解析");
  void p;
}
selfTest();
