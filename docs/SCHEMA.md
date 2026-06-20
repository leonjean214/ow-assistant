# 守望先锋助手 — 英雄数据 Schema

聚合维度（用户需求）：**参数 / 站位 / 被动 / 主动技能 / 克制关系 / 地图强势 / ban位 / 各分段打法**。
全部塞进每个英雄一条记录，单一数据源 `data/heroes.json`。

版本基准：**Overwatch（2026 去掉 "2"，6v6 回归）Season 2 / 2026-06**。
数据分两层：`evergreen`（英雄基础 kit/经典克制，稳定）与 `meta`（tier/ban/分段，随补丁变，见 `docs/SOURCES.md`）。

```jsonc
{
  "id": "ana",                    // 小写英文唯一键
  "name": "Ana",
  "nameZh": "安娜",
  "role": "support",              // tank | damage | support
  "subrole": "main-heal",         // 定位原型: main-heal/off-heal/main-tank/off-tank/dive/poke/flanker/hitscan/projectile 等
  "difficulty": 4,                // 1-5 上手难度
  "health": { "hp": 200, "armor": 0, "shield": 0 },

  "params": {                     // 关键参数
    "primary": "75 伤/发 半自动步枪（命中队友则治疗）",
    "range": "long",              // melee | short | mid | long
    "mobility": 1,                // 1-5
    "dps": "约 90",
    "healingPerSec": "约 70（直射）"
  },

  "abilities": {
    "passive": "辅助职业被动：脱战后自动回血",   // 职业被动 + 英雄专属被动
    "weapon": { "name": "Biotic Rifle", "nameZh": "生物步枪", "desc": "..." },
    "actives": [                  // 主动技能
      { "name": "Sleep Dart", "nameZh": "麻醉镖", "cooldown": 14, "desc": "命中使敌人沉睡 5 秒，受击即醒" },
      { "name": "Biotic Grenade", "nameZh": "生物手雷", "cooldown": 10, "desc": "范围治疗+增益/对敌反治疗" }
    ],
    "ultimate": { "name": "Nano Boost", "nameZh": "纳米激素", "cost": 0, "desc": "目标减伤50%、增伤50%" }
  },

  "perks": {                      // OW Perk 系统：小天赋(2选1) + 大天赋(2选1)
    "minor": [
      { "name": "...", "nameZh": "...", "desc": "..." },
      { "name": "...", "nameZh": "...", "desc": "..." }
    ],
    "major": [
      { "name": "...", "nameZh": "...", "desc": "..." },
      { "name": "...", "nameZh": "...", "desc": "..." }
    ],
    "recommended": "minor: A / major: B（meta 推荐）"
  },

  "position": {                   // 站位
    "zh": "中后排，借助高台与掩体提供大额治疗与反治疗，远离前线但保持视野",
    "depth": "back"               // front | mid | back | flank
  },

  "counters": {                   // 克制关系
    "strongAgainst": ["pharah", "echo"],   // 我克制
    "weakAgainst": ["genji", "tracer", "winston"], // 被克制
    "synergy": ["reinhardt", "zarya"]      // 协同
  },

  "maps": {                       // 地图强势
    "strong": ["有高台/长视野的图：花村、阿努比斯神殿、漓江塔"],
    "weak": ["近身缠斗/转角多的图：国王大道室内、卢西奥球场"],
    "note": "需要视野和射程，狭窄图被突进英雄针对"
  },

  "ban": {                        // ban 位（竞技英雄禁用）
    "priority": "medium",         // high | medium | low
    "reason": "高分段反治疗+睡眠控制价值高，但操作门槛使低分段威胁有限"
  },

  "rankPlay": {                   // 各分段打法
    "bronzeGold": "优先保证站桩治疗量，睡镖留给突进，别贪人头",
    "platDiamond": "主动用反治疗手雷打节奏，睡镖打断敌方大招",
    "masterGM": "纳米配合队友切入一波带走，预瞄睡镖反开团"
  },

  "tier": "A",                    // S | A | B | C（当前 meta）
  "tags": ["反治疗", "控制", "高技巧"]
}
```

字段省略约定：未知/不适用的字段可省（如部分英雄无 perks 数据时整段省略），前端需做空值兜底。
