const DASH = "—";

export const ROLE_LABELS = {
  tank: "Tank",
  damage: "Damage",
  support: "Support"
};

export const BAN_LABELS = {
  high: "高",
  medium: "中",
  low: "低"
};

export const DEPTH_LABELS = {
  front: "前排",
  mid: "中排",
  back: "后排",
  flank: "侧翼"
};

export const PATCH_TYPE_LABELS = {
  buff: "强化",
  nerf: "削弱",
  adjust: "调整",
  rework: "重做"
};

export function fallback(value, empty = DASH) {
  if (value === null || value === undefined) return empty;
  if (typeof value === "string" && value.trim() === "") return empty;
  return value;
}

export function toArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

export function normalizeHero(raw = {}) {
  const hero = { ...raw };
  hero.id = String(fallback(hero.id, "")).trim();
  hero.name = String(fallback(hero.name, hero.id || DASH));
  hero.nameZh = String(fallback(hero.nameZh, hero.name));
  hero.role = String(fallback(hero.role, "unknown"));
  hero.subrole = fallback(hero.subrole);
  hero.difficulty = Number.isFinite(Number(hero.difficulty)) ? Number(hero.difficulty) : null;
  hero.tier = fallback(hero.tier);
  hero.tags = toArray(hero.tags);
  hero.health = {
    hp: Number(hero.health?.hp) || 0,
    armor: Number(hero.health?.armor) || 0,
    shield: Number(hero.health?.shield) || 0
  };
  hero.params = hero.params || {};
  hero.abilities = {
    passive: fallback(hero.abilities?.passive),
    weapon: hero.abilities?.weapon || {},
    actives: toArray(hero.abilities?.actives),
    ultimate: hero.abilities?.ultimate || {}
  };
  hero.perks = {
    minor: toArray(hero.perks?.minor),
    major: toArray(hero.perks?.major),
    recommended: fallback(hero.perks?.recommended)
  };
  hero.position = {
    zh: fallback(hero.position?.zh),
    depth: fallback(hero.position?.depth)
  };
  hero.counters = {
    strongAgainst: toArray(hero.counters?.strongAgainst).map(String),
    weakAgainst: toArray(hero.counters?.weakAgainst).map(String),
    synergy: toArray(hero.counters?.synergy).map(String)
  };
  hero.maps = {
    strong: toArray(hero.maps?.strong),
    weak: toArray(hero.maps?.weak),
    note: fallback(hero.maps?.note)
  };
  hero.ban = {
    priority: fallback(hero.ban?.priority, "low"),
    reason: fallback(hero.ban?.reason)
  };
  hero.rankPlay = {
    bronzeGold: fallback(hero.rankPlay?.bronzeGold),
    platDiamond: fallback(hero.rankPlay?.platDiamond),
    masterGM: fallback(hero.rankPlay?.masterGM)
  };
  return hero;
}

export async function loadHeroData() {
  const response = await fetch("./data/heroes.json");
  if (!response.ok) throw new Error(`heroes.json 加载失败：${response.status}`);
  const payload = await response.json();
  const heroesRaw = Array.isArray(payload) ? payload : toArray(payload.heroes);
  const heroes = heroesRaw.map(normalizeHero).filter((hero) => hero.id);
  return {
    meta: Array.isArray(payload) ? {} : payload.meta || {},
    heroes,
    byId: new Map(heroes.map((hero) => [hero.id, hero])),
    byRole: groupBy(heroes, (hero) => hero.role),
    byTier: groupBy(heroes, (hero) => String(hero.tier))
  };
}

export async function loadWorkshop() {
  try {
    const response = await fetch("./data/workshop.json");
    if (!response.ok) throw new Error(`workshop.json 加载失败：${response.status}`);
    const payload = await response.json();
    return {
      meta: payload?._meta && typeof payload._meta === "object" ? payload._meta : {},
      categories: Array.isArray(payload?.categories) ? payload.categories : []
    };
  } catch (error) {
    console.warn(error);
    return { meta: {}, categories: [] };
  }
}

export async function loadMapMeta() {
  try {
    const response = await fetch("./data/maps_meta.json");
    if (!response.ok) throw new Error(`maps_meta.json 加载失败：${response.status}`);
    const payload = await response.json();
    const maps = payload?.maps && typeof payload.maps === "object" ? payload.maps : {};
    return new Map(Object.entries(maps).map(([key, value]) => [String(key), normalizeMapMeta(value)]));
  } catch (error) {
    console.warn(error);
    return new Map();
  }
}

export async function loadPatches() {
  try {
    const response = await fetch("./data/patches.json");
    if (!response.ok) throw new Error(`patches.json 加载失败：${response.status}`);
    const payload = await response.json();
    return normalizePatchPayload(payload);
  } catch (error) {
    console.warn(error);
    return createEmptyPatchPayload();
  }
}

function normalizePatchPayload(payload = {}) {
  const meta = payload && typeof payload === "object" && !Array.isArray(payload) ? payload._meta || {} : {};
  const timeline = toArray(payload?.timeline).map(normalizeTimelineItem).filter((item) => item.hero);
  const patches = toArray(payload?.patches).map(normalizePatch).filter((patch) => patch.id || patch.date);
  const sortedPatches = [...patches].sort((a, b) => compareDateText(b.date || b.id, a.date || a.id));
  const latestPatch = sortedPatches[0] || null;
  const latestChangesByHero = new Map();
  if (latestPatch) {
    latestPatch.changes.forEach((change) => {
      if (!change.hero) return;
      if (!latestChangesByHero.has(change.hero)) latestChangesByHero.set(change.hero, []);
      latestChangesByHero.get(change.hero).push({ ...change, patchId: latestPatch.id, patchDate: latestPatch.date });
    });
  }
  return {
    meta: {
      latestHero: String(fallback(meta.latestHero, "")).trim(),
      updated: fallback(meta.updated),
      note: fallback(meta.note, "")
    },
    timeline,
    patches: sortedPatches,
    latestPatch,
    latestChangesByHero
  };
}

function normalizeTimelineItem(raw = {}) {
  return {
    hero: String(fallback(raw.hero, "")).trim(),
    nameZh: fallback(raw.nameZh),
    role: String(fallback(raw.role, "unknown")),
    date: fallback(raw.date),
    season: fallback(raw.season),
    note: fallback(raw.note)
  };
}

function normalizePatch(raw = {}) {
  return {
    id: String(fallback(raw.id, raw.date || "")).trim(),
    date: fallback(raw.date, raw.id),
    season: fallback(raw.season),
    title: fallback(raw.title, raw.id || raw.date),
    headline: fallback(raw.headline),
    newHero: String(fallback(raw.newHero, "")).trim(),
    newMap: fallback(raw.newMap, ""),
    changes: toArray(raw.changes).map(normalizePatchChange).filter((change) => change.hero || change.text)
  };
}

function normalizePatchChange(raw = {}) {
  const type = String(fallback(raw.type, "adjust")).trim().toLowerCase();
  return {
    hero: String(fallback(raw.hero, "")).trim(),
    type: PATCH_TYPE_LABELS[type] ? type : "adjust",
    kind: String(fallback(raw.kind, "hero")),
    text: fallback(raw.text)
  };
}

function compareDateText(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function createEmptyPatchPayload() {
  return {
    meta: { latestHero: "", updated: "", note: "" },
    timeline: [],
    patches: [],
    latestPatch: null,
    latestChangesByHero: new Map()
  };
}

function normalizeMapMeta(raw = {}) {
  return {
    nameZh: fallback(raw.nameZh),
    mode: fallback(raw.mode),
    archetype: fallback(raw.archetype),
    terrain: fallback(raw.terrain),
    favors: toArray(raw.favors).map(String),
    against: toArray(raw.against).map(String),
    heroPicks: toArray(raw.heroPicks).map((id) => String(id).trim()).filter(Boolean),
    tip: fallback(raw.tip)
  };
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function findHeroId(input, heroes) {
  const query = String(input || "").trim().toLowerCase();
  if (!query) return "";
  const exact = heroes.find((hero) => (
    hero.id.toLowerCase() === query ||
    hero.name.toLowerCase() === query ||
    hero.nameZh.toLowerCase() === query
  ));
  if (exact) return exact.id;
  const fuzzy = heroes.find((hero) => (
    hero.name.toLowerCase().includes(query) ||
    hero.nameZh.toLowerCase().includes(query)
  ));
  return fuzzy?.id || "";
}
