// W0 spike：订阅 Overwatch GEP 事件，打印 + 转发给 overlay 窗口。
// ⚠️ 未在 Win 实测。required features 名称以 dev.overwolf.com「Overwatch 2 Game events」实页为准；
//    先全量订阅、打印 onInfoUpdates2 / onNewEvents 的原始结构，再据真实字段精化。见 SPIKE.md。

// 据调研，OW GEP 暴露的 features 大致含：match_info（对局状态/地图/模式）、
// kill/death/assist（击杀计数）、hero（本方 hero_name/hero_role；敌方官方逐步开放）。
// 名称未必精确——以 Win 上实际可订阅项为准。
const REQUIRED_FEATURES = ["match_info", "kill", "death", "assists", "hero", "me", "roster"];

const RETRY_MS = 2000;
let overlayWin = null;

function log(...args) {
  // 在 Overwolf 开发者工具 background 页 console 可见
  console.log("[OWGEP]", ...args);
}

function setFeatures(attempt = 0) {
  overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (info) => {
    if (info && info.success) {
      log("setRequiredFeatures OK:", info.supportedFeatures);
    } else {
      log("setRequiredFeatures 失败，重试", attempt, info);
      if (attempt < 10) setTimeout(() => setFeatures(attempt + 1), RETRY_MS);
    }
  });
}

function forward(type, payload) {
  // 转发给 overlay：overlay.html 监听 window 消息再喂给 SPA（state.overlayEnemies / 本方英雄等）
  if (!overlayWin) return;
  try { overlayWin.postMessage({ source: "owgep", type, payload }, "*"); } catch (e) { log("postMessage err", e); }
}

function hookEvents() {
  overwolf.games.events.onInfoUpdates2.addListener((data) => {
    log("info", JSON.stringify(data));      // ← Win 上看这里的真实结构，回填字段路径
    forward("info", data);
  });
  overwolf.games.events.onNewEvents.addListener((data) => {
    log("events", JSON.stringify(data));    // ← match_start/match_end/kill/death 等
    forward("events", data);
  });
}

function onGameInfo(res) {
  // 仅当运行的是 Overwatch 时启动 GEP
  const gi = res && (res.gameInfo || res);
  const running = gi && gi.isRunning && gi.classId; // classId = game id（核对是否 10844 / OW2 新 id）
  log("running game:", gi && gi.title, "id:", gi && gi.classId, "isRunning:", gi && gi.isRunning);
  if (running) { setFeatures(); }
}

function start() {
  overwolf.windows.obtainDeclaredWindow("overlay", (res) => {
    if (res && res.success) { overlayWin = res.window; overwolf.windows.restore("overlay"); }
  });
  hookEvents();
  overwolf.games.getRunningGameInfo((gi) => onGameInfo(gi));
  overwolf.games.onGameInfoUpdated.addListener((res) => {
    if (res && (res.gameChanged || res.runningChanged)) onGameInfo(res);
  });
}

if (typeof overwolf !== "undefined") {
  start();
} else {
  // 非 Overwolf 环境（如直接在浏览器打开）下安全降级，便于本地检查。
  console.warn("[OWGEP] 非 Overwolf 环境，GEP 不可用（仅 Win + Overwolf 客户端可跑）。");
}
