function list(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function uniqueValidEnemyIds(enemyIds, byId) {
  const seen = new Set();
  const ids = [];
  for (const rawId of Array.isArray(enemyIds) ? enemyIds : []) {
    const id = String(rawId || "").trim();
    if (!id || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 5) break;
  }
  return ids;
}

export function recommend(enemyIds, heroes) {
  const roster = Array.isArray(heroes) ? heroes : [];
  const byId = new Map(roster.filter((hero) => hero?.id).map((hero) => [String(hero.id), hero]));
  const enemies = uniqueValidEnemyIds(enemyIds, byId);

  const recommendations = roster
    .filter((hero) => hero?.id && !enemies.includes(hero.id))
    .map((hero) => {
      const matchup = scoreHeroAgainstEnemies(hero, enemies, byId);

      return {
        id: hero.id,
        name: hero.name,
        nameZh: hero.nameZh,
        role: hero.role,
        tier: hero.tier,
        score: matchup.score,
        reasons: matchup.reasons
      };
    })
    .sort((a, b) => b.score - a.score || tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name));

  return {
    enemies,
    all: recommendations,
    byRole: {
      tank: recommendations.filter((hero) => hero.role === "tank"),
      damage: recommendations.filter((hero) => hero.role === "damage"),
      support: recommendations.filter((hero) => hero.role === "support")
    }
  };
}

export function scoreHeroAgainstEnemies(hero, enemyIds, byId = new Map()) {
  let score = 0;
  const reasons = [];
  if (!hero?.id) return { score, reasons };
  const strongAgainst = list(hero.counters?.strongAgainst);
  const weakAgainst = list(hero.counters?.weakAgainst);

  for (const enemyId of Array.isArray(enemyIds) ? enemyIds : []) {
    const id = String(enemyId || "").trim();
    if (!id) continue;
    const enemy = byId.get(id);
    const enemyName = enemy?.nameZh || enemy?.name || id;
    if (strongAgainst.includes(id)) {
      score += 2;
      reasons.push(`克制 ${enemyName} +2`);
    }
    if (weakAgainst.includes(id)) {
      score -= 2;
      reasons.push(`被 ${enemyName} 克制 -2`);
    }
  }

  return { score, reasons };
}

function tierRank(tier) {
  return { S: 0, A: 1, B: 2, C: 3 }[tier] ?? 9;
}

export function runRecommendSelfTests() {
  const fixtures = [
    { id: "ana", name: "Ana", nameZh: "安娜", role: "support", tier: "A", counters: { strongAgainst: ["hog"], weakAgainst: ["genji"] } },
    { id: "genji", name: "Genji", nameZh: "源氏", role: "damage", tier: "A", counters: { strongAgainst: ["ana"], weakAgainst: ["winston"] } },
    { id: "winston", name: "Winston", nameZh: "温斯顿", role: "tank", tier: "S", counters: { strongAgainst: ["genji"], weakAgainst: ["reaper"] } },
    { id: "hog", name: "Roadhog", nameZh: "路霸", role: "tank", tier: "B", counters: { strongAgainst: [], weakAgainst: ["ana"] } }
  ];

  const empty = recommend([], fixtures);
  console.assert(empty.enemies.length === 0, "recommend: 空敌方阵容应返回空 enemies");
  console.assert(empty.all.length === 4, "recommend: 空敌方阵容仍应返回候选列表");

  const vsGenji = recommend(["genji", "genji", "unknown"], fixtures);
  console.assert(vsGenji.enemies.length === 1 && vsGenji.enemies[0] === "genji", "recommend: 应去重并忽略未知 id");
  console.assert(vsGenji.byRole.tank[0].id === "winston" && vsGenji.byRole.tank[0].score === 2, "recommend: 温斯顿应克制源氏 +2");
  console.assert(vsGenji.byRole.support[0].id === "ana" && vsGenji.byRole.support[0].score === -2, "recommend: 安娜被源氏克制 -2");

  return true;
}

runRecommendSelfTests();
