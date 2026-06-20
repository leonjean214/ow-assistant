# OverFast API 接口参考（已验证 2026-06-20）

Base: `https://overfast-api.tekrop.fr`  ｜ 公共非官方 API，返回 JSON，无需鉴权。
> 注意：前端浏览器直连需 CORS 允许。OverFast 默认开放 CORS；若个别环境被拦，TASK 里要求加「直连失败 → 提示 + 可配置代理」兜底。对 API 友好：玩家查询结果 localStorage 缓存 + 防抖。

## 1. 搜索玩家 `GET /players?name={名字}`
```jsonc
{ "total": 12, "results": [
  { "player_id": "xxxx%7Cyyyy", "name": "Jay3",
    "avatar": "https://.../x.png", "namecard": "https://.../n.png",
    "title": "Horde Champion",
    "career_url": "https://overfast-api.tekrop.fr/players/xxxx%7Cyyyy" } ] }
```
`player_id` 已 URL 编码(含 %7C)，直接拼进后续路径即可。

## 2. 玩家概要 `GET /players/{player_id}/summary`
```jsonc
{ "username": "Jay3", "avatar": "...", "namecard": "...", "title": "...",
  "endorsement": { "level": 4, "frame": "..." },
  "competitive": {
    "pc":      { "tank": {"division":"gold","tier":2,"role_icon":"...","rank_icon":"..."},
                 "damage": {"division":"silver","tier":3,...},
                 "support": {"division":"gold","tier":4,...} },
    "console": { ...同结构或 null } },
  "last_updated_at": 1234567890 }
```
division ∈ bronze/silver/gold/platinum/diamond/master/grandmaster/champion；tier 1-5(1最高)。任一可能为 null(未定级)。

## 3. 玩家统计概要 `GET /players/{player_id}/stats/summary`
```jsonc
{ "general": { "winrate": 52.65, "kda": 2.45, "games_played": 264,
               "games_won":..., "games_lost":..., "time_played":... },
  "roles": { "tank": {winrate,kda,games_played,...}, "damage": {...}, "support": {...} },
  "heroes": {
    "ana": { "games_played":5,"games_won":1,"games_lost":4,"time_played":2791,
             "winrate":20.0,"kda":1.9,
             "total": {"eliminations":38,"assists":21,"deaths":31,"damage":13908,"healing":24501},
             "average": {"eliminations":8.17,"assists":4.51,"deaths":6.66,"damage":2989.9,"healing":5267.14} },
    ... 每个英雄 key 同 data/heroes.json 的 id(注意 junker-queen/soldier-76/wrecking-ball 连字符)
  } }
```
可带 query：`?gamemode=competitive&platform=pc`。英雄 key 与本地 id 的连字符差异需做映射(junkerqueen↔junker-queen 等)。

## 4. 地图 `GET /maps`
```jsonc
[ { "key":"aatlis","name":"Aatlis","screenshot":"https://overfast-api.tekrop.fr/static/maps/aatlis.jpg",
    "gamemodes":["flashpoint"],"location":"Morocco","country_code":"MA" }, ... 57 张 ]
```

## 5. 英雄(已在 data/heroes.json 融合，无需再调)
`GET /heroes`、`GET /heroes/{key}`：name/role/subrole/portrait/hitpoints/abilities/perks。
