// 队伍构筑分析：纯函数，不触 DOM / localStorage，便于 node 自测。
// 数据来自 normalizeHero：hero.role / subrole / tags[] / counters.{synergy,weakAgainst} / nameZh / name。

export const TEAM_ROLE_TARGET = { tank: 1, damage: 2, support: 2 };
export const ROLE_ZH = { tank: "坦克", damage: "输出", support: "辅助" };

// 原型关键词（同时扫 subrole 英文与 tags 中文/英文）。
const ARCHETYPE_KEYWORDS = {
  dive: ["dive", "flanker", "突进", "高机动", "切后排", "切入", "机动", "钻地", "无人机机动", "空中机动", "水流机动"],
  poke: ["poke", "sniper", "spam", "zone", "狙击", "远程", "弹道狙", "区域", "炮台", "turret", "守点", "对空"],
  brawl: ["brawl", "bruiser", "anchor", "main-tank", "缠斗", "近战", "近身", "站桩", "锚点", "护盾", "续航", "缠斗坦"]
};

const ARCHETYPE_ZH = { dive: "突进 Dive", poke: "远程消耗 Poke", brawl: "近身缠斗 Brawl" };

function heroText(hero) {
  return [hero.subrole, ...(hero.tags || [])].filter(Boolean).join(" ").toLowerCase();
}

export function teamArchetype(heroes = []) {
  const counts = { dive: 0, poke: 0, brawl: 0 };
  for (const hero of heroes) {
    const text = heroText(hero);
    for (const [kind, words] of Object.entries(ARCHETYPE_KEYWORDS)) {
      if (words.some((w) => text.includes(w.toLowerCase()))) counts[kind] += 1;
    }
  }
  const ranked = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const primary = ranked.length ? ranked[0][0] : null;
  return {
    counts,
    primary,
    label: primary ? ARCHETYPE_ZH[primary] : "混合 / 数据不足",
    mixed: ranked.length > 1 && ranked[0][1] === ranked[1][1]
  };
}

export function teamRoleCount(heroes = []) {
  const count = { tank: 0, damage: 0, support: 0 };
  for (const hero of heroes) if (count[hero.role] != null) count[hero.role] += 1;
  return count;
}

export function teamRoleAdvice(roleCount) {
  const advice = [];
  for (const role of ["tank", "damage", "support"]) {
    const have = roleCount[role] || 0;
    const want = TEAM_ROLE_TARGET[role];
    if (have < want) advice.push(`缺 ${want - have} 个${ROLE_ZH[role]}`);
    else if (have > want) advice.push(`${ROLE_ZH[role]}过多（${have}/${want}）`);
  }
  return advice;
}

// 队内两两配合：A.synergy 含 B 或 B.synergy 含 A。
export function teamSynergies(heroes = []) {
  const pairs = [];
  for (let i = 0; i < heroes.length; i += 1) {
    for (let j = i + 1; j < heroes.length; j += 1) {
      const a = heroes[i];
      const b = heroes[j];
      const aToB = (a.counters?.synergy || []).map(String).includes(b.id);
      const bToA = (b.counters?.synergy || []).map(String).includes(a.id);
      if (aToB || bToA) pairs.push({ a: a.id, b: b.id, aName: a.nameZh, bName: b.nameZh });
    }
  }
  return pairs;
}

// 整体威胁：聚合全队 weakAgainst，统计有几名队员惧怕该敌方英雄，降序。
export function teamThreats(heroes = [], heroesById = new Map()) {
  const counts = new Map();
  for (const hero of heroes) {
    for (const enemyId of (hero.counters?.weakAgainst || []).map(String)) {
      if (!counts.has(enemyId)) counts.set(enemyId, { enemyId, count: 0, by: [] });
      const row = counts.get(enemyId);
      row.count += 1;
      row.by.push(hero.id);
    }
  }
  return [...counts.values()]
    .map((row) => {
      const enemy = heroesById.get(row.enemyId) || null;
      return { ...row, name: enemy?.nameZh || row.enemyId, role: enemy?.role || "" };
    })
    .sort((x, y) => y.count - x.count || x.enemyId.localeCompare(y.enemyId));
}

export function analyzeTeam(team = [], heroesById = new Map()) {
  const heroes = team.map((id) => heroesById.get(id)).filter(Boolean);
  const roleCount = teamRoleCount(heroes);
  const roleAdvice = teamRoleAdvice(roleCount);
  const archetype = teamArchetype(heroes);
  const synergies = teamSynergies(heroes);
  const threats = teamThreats(heroes, heroesById);
  const advice = [];
  if (!heroes.length) advice.push("从英雄库点「入队」搭建你的阵容。");
  else {
    if (roleAdvice.length) advice.push(`职业配比：${roleAdvice.join("，")}（标准 1 坦 2 输出 2 辅）。`);
    else advice.push("职业配比健康（1 坦 2 输出 2 辅）。");
    if (archetype.primary) advice.push(`阵容偏向${archetype.label}，围绕该节奏选打法。`);
    if (synergies.length) advice.push(`有 ${synergies.length} 组强配合，注意联动。`);
    const top = threats[0];
    if (top && top.count >= 2) advice.push(`小心 ${top.name}：克制你方 ${top.count} 名英雄，考虑针对或换人。`);
  }
  return { count: heroes.length, roleCount, roleAdvice, archetype, synergies, threats, advice };
}

// ---- 自测 ----
function selfTest() {
  const byId = new Map([
    ["genji", { id: "genji", nameZh: "源氏", role: "damage", subrole: "flanker", tags: ["突进", "切后排"], counters: { synergy: ["nano"], weakAgainst: ["winston"] } }],
    ["winston", { id: "winston", nameZh: "温斯顿", role: "tank", subrole: "dive-tank", tags: ["突进坦", "高机动"], counters: { synergy: ["genji"], weakAgainst: ["reaper"] } }],
    ["ana", { id: "ana", nameZh: "安娜", role: "support", subrole: "main-heal-poke", tags: ["poke", "控制"], counters: { synergy: [], weakAgainst: ["winston"] } }],
    ["reaper", { id: "reaper", nameZh: "死神", role: "damage", subrole: "brawl-dps", tags: ["近战", "坦克杀手"], counters: { synergy: [], weakAgainst: [] } }]
  ]);
  const a = analyzeTeam(["genji", "winston", "ana", "reaper"], byId);
  console.assert(a.roleCount.tank === 1 && a.roleCount.damage === 2 && a.roleCount.support === 1, "team: 职业计数");
  console.assert(a.roleAdvice.some((s) => s.includes("辅助")), "team: 应提示缺 1 辅助");
  console.assert(a.archetype.counts.dive >= 2, "team: dive 计数（源氏/温斯顿）");
  console.assert(a.synergies.length === 1 && a.synergies[0].a === "genji", "team: 源氏-温斯顿配合");
  console.assert(a.threats[0].enemyId === "winston" && a.threats[0].count === 2, "team: 温斯顿威胁2人最靠前");
  console.assert(analyzeTeam([], byId).count === 0, "team: 空阵容不崩");
}

selfTest();
