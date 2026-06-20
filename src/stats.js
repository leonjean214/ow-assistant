import { apiHeroToLocalKey } from "./api.js";

const ROLE_ORDER = ["tank", "damage", "support"];

export const DIVISION_LABELS = {
  bronze: "青铜",
  silver: "白银",
  gold: "黄金",
  platinum: "铂金",
  diamond: "钻石",
  master: "大师",
  grandmaster: "宗师",
  champion: "冠军"
};

export function normalizeHeroStats(stats = {}, byId = new Map()) {
  const heroes = stats?.heroes && typeof stats.heroes === "object" ? stats.heroes : {};
  return Object.entries(heroes)
    .map(([apiKey, value]) => {
      const id = apiHeroToLocalKey(apiKey);
      const hero = byId.get(id);
      const average = value?.average || {};
      return {
        id,
        apiKey,
        hero,
        name: hero?.name || apiKey,
        nameZh: hero?.nameZh || apiKey,
        portrait: hero?.portrait || "",
        role: hero?.role || "unknown",
        games: num(value?.games_played),
        winrate: num(value?.winrate),
        kda: num(value?.kda),
        damageAvg: num(average.damage),
        healingAvg: num(average.healing),
        timePlayed: num(value?.time_played)
      };
    })
    .filter((item) => item.games > 0)
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate);
}

export function sortHeroStats(rows, sortKey = "games", direction = "desc") {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const delta = (num(a[sortKey]) - num(b[sortKey])) * dir;
    return delta || b.games - a.games || a.name.localeCompare(b.name);
  });
}

export function summarizeRoles(stats = {}) {
  const roles = stats?.roles && typeof stats.roles === "object" ? stats.roles : {};
  return ROLE_ORDER.map((role) => ({
    role,
    winrate: num(roles[role]?.winrate),
    kda: num(roles[role]?.kda),
    games: num(roles[role]?.games_played)
  }));
}

export function buildPerformanceCards(heroStats = []) {
  const rows = Array.isArray(heroStats) ? heroStats.filter((row) => row?.id && num(row.games) > 0) : [];
  if (!rows.length) return [];

  const cards = [];
  const main = maxBy(rows, (row) => num(row.games));
  if (main) {
    cards.push(createPerformanceCard("main", "本命", main, `${num(main.games)}场`, "场次最多，说明这是你最熟的英雄池核心。"));
  }

  const winrate = maxBy(rows.filter((row) => num(row.games) >= 5), (row) => num(row.winrate));
  if (winrate) {
    cards.push(createPerformanceCard("winrate", "胜率王", winrate, `${num(winrate.winrate).toFixed(1)}%`, `至少 5 场中胜率最高，样本 ${num(winrate.games)} 场。`));
  }

  const damage = maxBy(rows, (row) => num(row.damageAvg));
  const healing = maxBy(rows, (row) => num(row.healingAvg));
  const output = num(healing?.healingAvg) > num(damage?.damageAvg) ? healing : damage;
  if (output) {
    const isHealing = output === healing && num(healing?.healingAvg) > num(damage?.damageAvg);
    cards.push(createPerformanceCard(isHealing ? "healing" : "damage", isHealing ? "治疗担当" : "伤害担当", output, String(Math.round(isHealing ? num(output.healingAvg) : num(output.damageAvg))), "场均输出最突出，适合作为你的功能定位参考。"));
  }

  const stable = maxBy(rows.filter((row) => num(row.games) >= 5), (row) => num(row.kda));
  if (stable) {
    cards.push(createPerformanceCard("stable", "最稳", stable, `KDA ${num(stable.kda).toFixed(2)}`, `至少 5 场中 KDA 最高，稳定性最好。`));
  }

  return cards.slice(0, 4);
}

function createPerformanceCard(kind, title, row, value, note) {
  return {
    kind,
    title,
    heroId: row.id,
    heroName: row.name,
    heroNameZh: row.nameZh,
    portrait: row.portrait || row.hero?.portrait || "",
    value,
    note,
    games: num(row.games),
    winrate: num(row.winrate)
  };
}

export function formatRank(rank) {
  if (!rank || !rank.division || !rank.tier) return "未定级";
  const division = DIVISION_LABELS[rank.division] || rank.division;
  return `${division} ${rank.tier}`;
}

export function formatDuration(seconds) {
  const total = num(seconds);
  if (!total) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours}小时${minutes}分`;
  return `${minutes}分`;
}

export function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selfTest() {
  const byId = new Map([
    ["soldier76", { id: "soldier76", name: "Soldier: 76", nameZh: "士兵：76", portrait: "p.png", role: "damage" }]
  ]);
  const rows = normalizeHeroStats({
    heroes: {
      "soldier-76": { games_played: 4, winrate: 75, kda: 3, time_played: 3600, average: { damage: 9000, healing: 100 } },
      ana: { games_played: 0 }
    }
  }, byId);
  console.assert(rows.length === 1 && rows[0].id === "soldier76", "stats: 应映射连字符英雄 key 并过滤 0 场次");
  console.assert(sortHeroStats([{ games: 1, winrate: 80 }, { games: 3, winrate: 10 }], "winrate")[0].winrate === 80, "stats: 应按胜率排序");
  console.assert(formatRank({ division: "gold", tier: 2 }) === "黄金 2", "stats: 应中文格式化段位");
  const cards = buildPerformanceCards([
    { id: "soldier76", name: "Soldier: 76", nameZh: "士兵：76", games: 8, winrate: 62.5, kda: 3.2, damageAvg: 9000, healingAvg: 100, portrait: "p.png" },
    { id: "mercy", name: "Mercy", nameZh: "天使", games: 4, winrate: 75, kda: 5, damageAvg: 200, healingAvg: 11000 }
  ]);
  console.assert(cards.length >= 3 && cards[0].kind === "main", "stats: 表现卡片应包含本命等高光");
  console.assert(buildPerformanceCards([]).length === 0, "stats: 空战绩应返回空表现卡片");
  return true;
}

function maxBy(items, getter) {
  let best = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = getter(item);
    if (value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

selfTest();
