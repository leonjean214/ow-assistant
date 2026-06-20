const TIER_RANK = { S: 0, A: 1, B: 2, C: 3 };

export function recommendHeroes(filters = {}, heroes = []) {
  const role = String(filters.role || "all");
  const maxDifficulty = clampDifficulty(filters.maxDifficulty ?? filters.difficulty ?? 2);
  const tag = String(filters.tag || filters.style || "all").trim();
  const roster = Array.isArray(heroes) ? heroes : [];

  return roster
    .filter((hero) => hero?.id)
    .filter((hero) => role === "all" || hero.role === role)
    .filter((hero) => heroDifficulty(hero) <= maxDifficulty)
    .filter((hero) => !tag || tag === "all" || safeTags(hero).includes(tag))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || Number(a.difficulty) - Number(b.difficulty) || String(a.name).localeCompare(String(b.name)))
    .map((hero) => ({
      id: hero.id,
      name: hero.name,
      nameZh: hero.nameZh,
      role: hero.role,
      tier: hero.tier,
      difficulty: heroDifficulty(hero),
      tags: safeTags(hero),
      portrait: hero.portrait || "",
      reason: beginnerReason(hero)
    }));
}

function beginnerReason(hero) {
  const difficulty = heroDifficulty(hero);
  const tags = safeTags(hero).slice(0, 2).join("、") || "定位清晰";
  const rankTip = hero?.rankPlay?.bronzeGold || "先稳定完成本职工作，再逐步练进阶技巧。";
  return `难度 ${difficulty}/5，标签偏${tags}；低分段可先做到：${rankTip}`;
}

function safeTags(hero) {
  return Array.isArray(hero?.tags) ? hero.tags.map(String).filter(Boolean) : [];
}

function tierRank(tier) {
  return TIER_RANK[tier] ?? 9;
}

function clampDifficulty(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(5, Math.max(1, parsed));
}

function heroDifficulty(hero) {
  const parsed = Number(hero?.difficulty);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(5, parsed) : 5;
}

function selfTest() {
  const fixtures = [
    { id: "soldier76", name: "Soldier: 76", nameZh: "士兵：76", role: "damage", difficulty: 1, tier: "B", tags: ["hitscan", "新手友好"], rankPlay: { bronzeGold: "跟团输出，记得开治疗站。" } },
    { id: "junkrat", name: "Junkrat", nameZh: "狂鼠", role: "damage", difficulty: 2, tier: "B", tags: ["区域封锁"], rankPlay: { bronzeGold: "守门口和窄口。" } },
    { id: "ana", name: "Ana", nameZh: "安娜", role: "support", difficulty: 4, tier: "A", tags: ["控制"], rankPlay: { bronzeGold: "先保队友。" } },
    { id: "mercy", name: "Mercy", nameZh: "天使", role: "support", difficulty: 1, tier: "A", tags: ["治疗"], rankPlay: { bronzeGold: "少冒险复活。" } }
  ];
  const damage = recommendHeroes({ role: "damage", maxDifficulty: 2 }, fixtures);
  console.assert(damage.length === 2 && damage.some((hero) => hero.id === "junkrat"), "recommendHeroes: 应按职业和难度筛出低难输出");
  const support = recommendHeroes({ role: "support", maxDifficulty: 2, tag: "治疗" }, fixtures);
  console.assert(support.length === 1 && support[0].id === "mercy", "recommendHeroes: 应按标签筛选并排除高难英雄");
  const empty = recommendHeroes({ role: "tank", maxDifficulty: 1 }, fixtures);
  console.assert(Array.isArray(empty) && empty.length === 0, "recommendHeroes: 无匹配时应返回空数组");
  return true;
}

selfTest();
