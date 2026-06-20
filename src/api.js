const BASE_URL = "https://overfast-api.tekrop.fr";
const CACHE_VERSION = "phase2-v1";
const PLAYER_TTL = 10 * 60 * 1000;
const MAP_TTL = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8500;

const SPECIAL_TO_API = new Map([
  ["junkerqueen", "junker-queen"],
  ["soldier76", "soldier-76"],
  ["wreckingball", "wrecking-ball"]
]);

const SPECIAL_TO_LOCAL = new Map([...SPECIAL_TO_API].map(([local, api]) => [api, local]));

export function localHeroToApiKey(id) {
  const key = String(id || "").trim().toLowerCase();
  return SPECIAL_TO_API.get(key) || key;
}

export function apiHeroToLocalKey(key) {
  const value = String(key || "").trim().toLowerCase();
  return SPECIAL_TO_LOCAL.get(value) || value.replaceAll("-", "");
}

export function debounce(fn, delay = 350) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

export async function searchPlayers(name) {
  const query = String(name || "").trim();
  if (!query) return { total: 0, results: [] };
  return cachedJson(`players:${query.toLowerCase()}`, PLAYER_TTL, `/players?name=${encodeURIComponent(query)}`);
}

export async function getSummary(playerId) {
  const id = encodePathId(playerId);
  return cachedJson(`summary:${id}`, PLAYER_TTL, `/players/${id}/summary`);
}

export async function getStatsSummary(playerId, options = {}) {
  const id = encodePathId(playerId);
  const platform = options.platform || "pc";
  return cachedJson(`stats:${id}:${platform}`, PLAYER_TTL, `/players/${id}/stats/summary?gamemode=competitive&platform=${encodeURIComponent(platform)}`);
}

export async function getMaps() {
  return cachedJson("maps", MAP_TTL, "/maps");
}

export function friendlyApiError(error, fallback = "接口暂时不可用，请稍后重试。") {
  if (error?.name === "AbortError" || /timeout/i.test(error?.message || "")) return "请求超时，请稍后再试。";
  if (/404/.test(error?.message || "")) return "没有找到对应数据，请确认 BattleTag 或稍后重试。";
  if (/Failed to fetch|NetworkError|Load failed/i.test(error?.message || "")) return "网络或 CORS 暂时不可用，请检查连接后重试。";
  return error?.message ? `${fallback}（${error.message}）` : fallback;
}

async function cachedJson(key, ttl, path) {
  const cacheKey = `ow:${CACHE_VERSION}:${key}`;
  const cached = readCache(cacheKey, ttl);
  if (cached.hit) {
    console.info(`[cache hit] ${key}`);
    return cached.value;
  }

  const value = await fetchJson(path);
  writeCache(cacheKey, value);
  return value;
}

async function fetchJson(path, attempt = 0) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt < 1 && error?.name !== "AbortError") return fetchJson(path, attempt + 1);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function readCache(key, ttl) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { hit: false };
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CACHE_VERSION || Date.now() - Number(parsed.time) > ttl) return { hit: false };
    return { hit: true, value: parsed.value };
  } catch {
    return { hit: false };
  }
}

function writeCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: CACHE_VERSION, time: Date.now(), value }));
  } catch {
    // localStorage may be full or disabled; the app should keep working without cache.
  }
}

function encodePathId(playerId) {
  return String(playerId || "").trim().replaceAll("|", "%7C");
}
