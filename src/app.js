import { BAN_LABELS, DEPTH_LABELS, PATCH_TYPE_LABELS, ROLE_LABELS, fallback, findHeroId, loadHeroData, loadMapMeta, loadPatches, toArray } from "./data.js";
import { recommend, scoreHeroAgainstEnemies } from "./counter.js";
import { debounce, friendlyApiError, getMaps, getStatsSummary, getSummary, searchPlayers } from "./api.js";
import { buildPerformanceCards, formatDuration, formatRank, normalizeHeroStats, sortHeroStats, summarizeRoles } from "./stats.js";
import { recommendHeroes } from "./recommend-hero.js";

const roleNamesZh = { tank: "重装", damage: "输出", support: "支援" };
const modeLabels = {
  assault: "攻防作战",
  control: "控制",
  escort: "运载目标",
  flashpoint: "闪点",
  hybrid: "混合",
  push: "机动推进",
  clash: "冲突"
};
const roleTips = {
  tank: "重装负责开空间和吃关键资源，优先选择能稳定控图或保护后排的英雄。",
  damage: "输出围绕地图视野和敌方后排压力选角，当前更重视稳定击杀窗口。",
  support: "支援既要保核心也要提供先手控制，反打技能和生存位移价值很高。"
};
const FAVORITES_KEY = "ow-favorites";
const COMPARE_KEY = "ow-compare";
const DEFAULT_VIEW = "heroes";
const HERO_ROUTE_PREFIX = "#/hero/";
const COMPARE_ROUTE_PREFIX = "#/compare/";
const MAX_COMPARE = 4;

const state = {
  heroes: [],
  byId: new Map(),
  filters: { role: "all", tier: "all", ban: "all", search: "", favoritesOnly: false },
  favorites: new Set(),
  compare: [],
  compareMessage: "",
  selectedEnemies: [],
  currentHeroId: "",
  overlayEnemies: [],
  currentView: DEFAULT_VIEW,
  platform: "pc",
  playerRequestId: 0,
  selectedPlayer: null,
  heroStats: [],
  heroStatById: new Map(),
  heroSort: { key: "games", direction: "desc" },
  maps: [],
  mapMeta: new Map(),
  mapMode: "all",
  mapsLoaded: false,
  detailStat: null,
  patches: {
    meta: { latestHero: "", updated: "", note: "" },
    timeline: [],
    patches: [],
    latestPatch: null,
    latestChangesByHero: new Map()
  },
  patchFilters: { role: "all", type: "all", search: "" }
};

const el = {};
let isRouting = false;
let overlayMode = false;
let activeDetailHeroId = "";
let routeViews = new Set();

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  state.favorites = loadFavorites();
  try {
    const [data, mapMeta, patches] = await Promise.all([loadHeroData(), loadMapMeta(), loadPatches()]);
    state.heroes = data.heroes;
    state.byId = data.byId;
    state.compare = loadCompare();
    state.mapMeta = mapMeta;
    state.patches = patches;
    renderMetaText(data.meta);
    renderLatestHeroLine();
    renderRecommendControls();
    renderHeroRecommendations();
    renderCurrentHeroOptions();
    renderHeroGrid();
    renderCompareTray();
    renderCompareView();
    renderUpdates();
    renderEnemyChips();
    renderCounter();
    renderBanList();
    renderMetaDashboard();
    renderRecentPlayers();
    applyOverlayMode();
    initRouter();
  } catch (error) {
    console.error(error);
    el.dataMeta.textContent = "数据加载失败，请确认使用 http.server 从项目根目录打开。";
    el.heroEmpty.hidden = false;
    el.heroEmpty.textContent = "无法加载 data/heroes.json。";
  }
}

function bindElements() {
  for (const id of [
    "dataMeta", "heroCount", "heroGrid", "heroEmpty", "roleTabs", "tierFilter", "banFilter", "searchInput",
    "favoriteOnlyToggle",
    "compareTray", "compareContent", "compareCount",
    "latestHeroLine", "updatesTimeline", "patchRoleFilter", "patchTypeFilter", "patchSearchInput", "patchList", "patchEmpty",
    "heroRecommendPanel", "recommendRole", "recommendDifficulty", "recommendDifficultyLabel", "recommendTag", "recommendResults",
    "enemyInput", "currentHeroSelect", "runCounter", "clearCounter", "selectedEnemies", "enemyChips", "counterResults",
    "banList", "banCount", "detailDrawer", "drawerScrim", "closeDrawer", "detailContent",
    "profileStatus", "playerSearchInput", "platformTabs", "recentPlayers", "playerSearchState", "playerResults", "playerProfile",
    "mapCount", "mapModeTabs", "mapsState", "mapsGrid", "mapDetail", "tierGrid", "banBoard", "rolePassives",
    "overlayView", "overlayCounterMount", "overlayBan"
  ]) {
    el[id] = document.getElementById(id);
  }
  routeViews = new Set([...document.querySelectorAll(".view-tab[data-view]")].map((button) => button.dataset.view));
}

function bindEvents() {
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  el.roleTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-role]");
    if (!button) return;
    state.filters.role = button.dataset.role;
    el.roleTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderHeroGrid();
  });

  el.tierFilter.addEventListener("change", () => {
    state.filters.tier = el.tierFilter.value;
    renderHeroGrid();
  });
  el.banFilter.addEventListener("change", () => {
    state.filters.ban = el.banFilter.value;
    renderHeroGrid();
  });
  el.searchInput.addEventListener("input", () => {
    state.filters.search = el.searchInput.value.trim().toLowerCase();
    renderHeroGrid();
  });
  el.favoriteOnlyToggle.addEventListener("change", () => {
    state.filters.favoritesOnly = el.favoriteOnlyToggle.checked;
    renderHeroGrid();
  });
  el.patchRoleFilter.addEventListener("change", () => {
    state.patchFilters.role = el.patchRoleFilter.value;
    renderPatchList();
  });
  el.patchTypeFilter.addEventListener("change", () => {
    state.patchFilters.type = el.patchTypeFilter.value;
    renderPatchList();
  });
  el.patchSearchInput.addEventListener("input", () => {
    state.patchFilters.search = el.patchSearchInput.value.trim().toLowerCase();
    renderPatchList();
  });
  [el.recommendRole, el.recommendDifficulty, el.recommendTag].forEach((control) => {
    control.addEventListener("input", renderHeroRecommendations);
    control.addEventListener("change", renderHeroRecommendations);
  });

  el.heroGrid.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("button[data-favorite-hero]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteHero);
      return;
    }
    const compareButton = event.target.closest("button[data-compare-hero]");
    if (compareButton) {
      toggleCompare(compareButton.dataset.compareHero);
      return;
    }
    const card = event.target.closest("[data-hero-id]");
    if (card) openDetail(card.dataset.heroId);
  });
  el.heroGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".hero-card[data-hero-id]");
    if (!card || event.target !== card) return;
    event.preventDefault();
    openDetail(card.dataset.heroId);
  });
  el.updatesTimeline.addEventListener("click", (event) => {
    const item = event.target.closest("[data-update-hero]");
    if (item) openDetail(item.dataset.updateHero);
  });
  el.patchList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-patch-hero]");
    if (item) openDetail(item.dataset.patchHero);
  });
  el.detailContent.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("button[data-favorite-hero]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteHero);
      return;
    }
    const compareButton = event.target.closest("button[data-compare-hero]");
    if (compareButton) {
      toggleCompare(compareButton.dataset.compareHero);
      return;
    }
    const target = event.target.closest("[data-jump-hero]");
    if (!target) return;
    openDetail(target.dataset.jumpHero);
  });
  el.compareTray.addEventListener("click", (event) => {
    const remove = event.target.closest("button[data-remove-compare]");
    if (remove) {
      removeFromCompare(remove.dataset.removeCompare);
      return;
    }
    if (event.target.closest("button[data-clear-compare]")) {
      clearCompare();
      return;
    }
    if (event.target.closest("button[data-view-compare]")) switchView("compare");
  });
  el.compareContent.addEventListener("click", (event) => {
    const remove = event.target.closest("button[data-remove-compare]");
    if (remove) {
      removeFromCompare(remove.dataset.removeCompare);
      return;
    }
    const hero = event.target.closest("button[data-compare-detail]");
    if (hero) openDetail(hero.dataset.compareDetail);
  });
  el.closeDrawer.addEventListener("click", closeDetail);
  el.drawerScrim.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });

  el.enemyChips.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-enemy-id]");
    if (!button) return;
    toggleEnemy(button.dataset.enemyId);
  });
  el.runCounter.addEventListener("click", () => {
    mergeInputEnemies();
    renderCounter();
  });
  el.clearCounter.addEventListener("click", () => {
    state.selectedEnemies = [];
    el.enemyInput.value = "";
    renderEnemyChips();
    renderCounter();
  });
  el.currentHeroSelect.addEventListener("change", () => {
    state.currentHeroId = el.currentHeroSelect.value;
    renderCounter();
  });
  el.enemyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      mergeInputEnemies();
      renderCounter();
    }
  });

  el.playerSearchInput.addEventListener("input", debounce(() => runPlayerSearch(), 420));
  el.playerResults.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-player-id]");
    if (button) selectPlayer(button.dataset.playerId);
  });
  el.recentPlayers.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-player-id]");
    if (button) selectPlayer(button.dataset.playerId);
  });
  el.platformTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-platform]");
    if (!button) return;
    state.platform = button.dataset.platform;
    el.platformTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    if (state.selectedPlayer) selectPlayer(state.selectedPlayer.player_id, { keepResults: true });
  });

  el.playerProfile.addEventListener("click", (event) => {
    const sort = event.target.closest("button[data-sort]");
    if (sort) {
      const key = sort.dataset.sort;
      state.heroSort.direction = state.heroSort.key === key && state.heroSort.direction === "desc" ? "asc" : "desc";
      state.heroSort.key = key;
      renderHeroStatsTable();
      return;
    }
    const row = event.target.closest("[data-stat-hero]");
    if (row) openDetail(row.dataset.statHero, state.heroStatById.get(row.dataset.statHero));
  });

  el.mapModeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.mapMode = button.dataset.mode;
    el.mapModeTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderMapsGrid();
  });
  el.mapsGrid.addEventListener("click", (event) => {
    const card = event.target.closest("button[data-map-key]");
    if (!card) return;
    const map = state.maps.find((item) => item.key === card.dataset.mapKey);
    if (map) renderMapDetail(map);
  });
}

function renderMetaText(meta) {
  const season = fallback(meta?.season);
  const updated = fallback(meta?.updated);
  el.dataMeta.textContent = `赛季 ${season} · 更新 ${updated}`;
}

function renderLatestHeroLine() {
  const latest = getLatestHero();
  if (!latest) {
    el.latestHeroLine.textContent = "当前最新英雄：暂无补丁数据";
    return;
  }
  const timeline = getLatestTimelineItem(latest.id);
  const season = timeline?.season ? `(${timeline.season})` : "";
  el.latestHeroLine.textContent = `当前最新英雄：${latest.nameZh} ${latest.name}${season}`;
}

function renderRecommendControls() {
  el.recommendTag.replaceChildren();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "不限";
  el.recommendTag.append(all);
  const tags = [...new Set(state.heroes.flatMap((hero) => toArray(hero.tags).map(String)))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    el.recommendTag.append(option);
  });
}

function renderHeroRecommendations() {
  const maxDifficulty = Number(el.recommendDifficulty.value) || 2;
  el.recommendDifficultyLabel.textContent = `上手难度 ≤${maxDifficulty}`;
  const results = recommendHeroes({
    role: el.recommendRole.value,
    maxDifficulty,
    tag: el.recommendTag.value
  }, state.heroes);

  el.recommendResults.replaceChildren();
  if (!results.length) {
    const empty = create("p", "empty-state");
    empty.textContent = "没有匹配的低难英雄，放宽职业、标签或难度上限再试。";
    el.recommendResults.append(empty);
    return;
  }
  results.slice(0, 8).forEach((item) => el.recommendResults.append(createBeginnerHeroCard(item)));
}

function createBeginnerHeroCard(item) {
  const hero = state.byId.get(item.id) || item;
  const card = create("button", "recommend-card");
  card.type = "button";
  card.addEventListener("click", () => openDetail(item.id));
  card.append(createAvatar(hero));
  const body = create("div");
  const title = create("div", "hero-title-row");
  const names = create("div");
  appendText(names, "strong", item.nameZh);
  appendText(names, "span", item.name);
  title.append(names, createBadge(`难度 ${item.difficulty}/5`, "tier-badge"));
  const tags = create("div", "tag-row");
  item.tags.slice(0, 3).forEach((tag) => tags.append(textBadge(tag, "tag")));
  const reason = create("p", "recommend-reason");
  reason.textContent = item.reason;
  body.append(title, tags, reason);
  card.append(body);
  return card;
}

function renderCurrentHeroOptions() {
  el.currentHeroSelect.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "先选一个本方英雄";
  el.currentHeroSelect.append(blank);
  ["tank", "damage", "support"].forEach((role) => {
    const group = document.createElement("optgroup");
    group.label = roleNamesZh[role] || ROLE_LABELS[role] || role;
    state.heroes.filter((hero) => hero.role === role).forEach((hero) => {
      const option = document.createElement("option");
      option.value = hero.id;
      option.textContent = `${hero.nameZh} / ${hero.name}`;
      group.append(option);
    });
    el.currentHeroSelect.append(group);
  });
}

function switchView(view) {
  if (!routeViews.has(view)) view = DEFAULT_VIEW;
  state.currentView = view;
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.id === `${view}View`);
  });
  if (view === "maps") loadMapsOnce();
  if (view === "compare") renderCompareView();
  activeDetailHeroId = "";
  if (!isRouting) closeDetailPanel();
  syncHashForView(view);
}

function applyOverlayMode() {
  overlayMode = new URLSearchParams(window.location.search).get("overlay") === "1";
  document.body.classList.toggle("is-overlay", overlayMode);
  if (!overlayMode) return;
  document.querySelector(".topbar").hidden = true;
  document.querySelectorAll("main > .view").forEach((section) => { section.hidden = true; });
  el.overlayView.hidden = false;
  renderOverlay();
}

function initRouter() {
  if (overlayMode) return;
  window.addEventListener("hashchange", applyRouteFromHash);
  applyRouteFromHash();
}

function applyRouteFromHash() {
  if (overlayMode) return;
  const route = parseHashRoute(window.location.hash);
  isRouting = true;
  try {
    if (route.type === "hero") {
      switchView(DEFAULT_VIEW);
      if (state.byId.has(route.heroId)) {
        const hero = state.byId.get(route.heroId);
        state.detailStat = state.heroStatById.get(route.heroId) || null;
        renderDetail(hero);
        openDetailPanel(route.heroId);
      } else {
        activeDetailHeroId = "";
        closeDetailPanel();
        replaceHash(viewHash(DEFAULT_VIEW));
      }
      return;
    }

    if (route.type === "compare") {
      setCompare(route.heroIds, { sync: false, silent: true });
      switchView("compare");
      activeDetailHeroId = "";
      closeDetailPanel();
      if (window.location.hash && route.invalid) replaceHash(compareHash());
      return;
    }

    switchView(route.view);
    activeDetailHeroId = "";
    closeDetailPanel();
    if (window.location.hash && route.invalid) replaceHash(viewHash(route.view));
  } finally {
    isRouting = false;
  }
}

function parseHashRoute(hash) {
  const value = String(hash || "").trim();
  if (value.startsWith(HERO_ROUTE_PREFIX)) {
    const rawId = safeDecode(value.slice(HERO_ROUTE_PREFIX.length)).trim();
    return rawId ? { type: "hero", heroId: rawId } : { type: "view", view: DEFAULT_VIEW, invalid: true };
  }
  if (value.startsWith(COMPARE_ROUTE_PREFIX)) {
    const rawIds = value.slice(COMPARE_ROUTE_PREFIX.length).split(",").map((part) => safeDecode(part).trim()).filter(Boolean);
    const validIds = uniqueValidHeroIds(rawIds).slice(0, MAX_COMPARE);
    return { type: "compare", heroIds: validIds, invalid: rawIds.length !== validIds.length };
  }
  if (value.startsWith("#/")) {
    const view = safeDecode(value.slice(2)).trim();
    if (routeViews.has(view)) return { type: "view", view, invalid: false };
    return { type: "view", view: DEFAULT_VIEW, invalid: true };
  }
  return { type: "view", view: DEFAULT_VIEW, invalid: Boolean(value) };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function viewHash(view) {
  if (view === "compare") return compareHash();
  return `#/${routeViews.has(view) ? view : DEFAULT_VIEW}`;
}

function heroHash(heroId) {
  return `${HERO_ROUTE_PREFIX}${encodeURIComponent(heroId)}`;
}

function compareHash() {
  return state.compare.length
    ? `${COMPARE_ROUTE_PREFIX}${state.compare.map((id) => encodeURIComponent(id)).join(",")}`
    : "#/compare";
}

function syncHashForView(view, options = {}) {
  if (overlayMode || isRouting) return;
  const next = viewHash(view);
  if (window.location.hash === next) return;
  if (options.replace) {
    replaceHash(next);
  } else {
    window.location.hash = next;
  }
}

function syncHashForHero(heroId) {
  if (overlayMode || isRouting) return;
  const next = heroHash(heroId);
  if (window.location.hash !== next) window.location.hash = next;
}

function syncHashForCompare(options = {}) {
  if (overlayMode || isRouting || state.currentView !== "compare") return;
  const next = compareHash();
  if (window.location.hash === next) return;
  if (options.replace) {
    replaceHash(next);
  } else {
    window.location.hash = next;
  }
}

function replaceHash(hash) {
  const target = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, "", target);
}

function renderHeroGrid() {
  el.heroGrid.replaceChildren();
  const heroes = filteredHeroes();
  el.heroCount.textContent = `${heroes.length} 位英雄`;
  el.heroEmpty.hidden = heroes.length !== 0;
  el.heroEmpty.textContent = state.filters.favoritesOnly && !state.favorites.size
    ? "还没有收藏英雄，点卡片右上角 ★ 添加"
    : "没有符合条件的英雄。";
  for (const hero of heroes) el.heroGrid.append(createHeroCard(hero));
}

function renderUpdates() {
  renderTimeline();
  renderPatchTypeOptions();
  renderPatchList();
}

function renderTimeline() {
  el.updatesTimeline.replaceChildren();
  const items = [...state.patches.timeline].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!items.length) {
    const empty = create("p", "empty-state");
    empty.textContent = "暂无英雄发布时间线。";
    el.updatesTimeline.append(empty);
    return;
  }
  items.forEach((item) => {
    const hero = state.byId.get(item.hero);
    const card = create("button", item.hero === state.patches.meta.latestHero ? "timeline-item is-latest" : "timeline-item");
    card.type = "button";
    card.dataset.updateHero = item.hero;
    if (!hero) card.disabled = true;
    card.append(createAvatar(hero || item));
    const body = create("div", "timeline-body");
    const head = create("div", "timeline-head");
    appendText(head, "strong", hero ? `${hero.nameZh} / ${hero.name}` : `${item.nameZh} / ${item.hero}`);
    if (item.hero === state.patches.meta.latestHero) head.append(createBadge("★最新", "latest-badge"));
    body.append(head);
    const meta = create("div", "hero-meta");
    meta.append(
      textBadge(ROLE_LABELS[item.role] || ROLE_LABELS[hero?.role] || item.role),
      textBadge(item.date),
      textBadge(item.season)
    );
    body.append(meta);
    appendText(body, "p", item.note);
    card.append(body);
    el.updatesTimeline.append(card);
  });
}

function renderPatchTypeOptions() {
  const current = state.patchFilters.type;
  el.patchTypeFilter.replaceChildren();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "全部";
  el.patchTypeFilter.append(all);
  Object.entries(PATCH_TYPE_LABELS).forEach(([type, label]) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = label;
    el.patchTypeFilter.append(option);
  });
  el.patchTypeFilter.value = current;
}

function renderPatchList() {
  el.patchList.replaceChildren();
  const patches = toArray(state.patches.patches);
  el.patchEmpty.hidden = patches.length !== 0;
  if (!patches.length) {
    el.patchEmpty.textContent = "暂无补丁日志。";
    return;
  }
  patches.forEach((patch) => {
    const card = create("article", "patch-card");
    const head = create("div", "patch-head");
    const title = create("div");
    appendText(title, "h3", patch.title);
    appendText(title, "p", `${patch.date} · ${patch.season}`);
    head.append(title, createPatchStats(patch.changes));
    card.append(head);
    appendText(card, "p", patch.headline).className = "patch-headline";
    const extras = create("div", "tag-row patch-extras");
    if (patch.newHero) extras.append(textBadge(`新英雄 ${heroName(patch.newHero)}`, "tag"));
    if (patch.newMap) extras.append(textBadge(`新图 ${patch.newMap}`, "tag"));
    if (extras.children.length) card.append(extras);
    const list = create("div", "patch-change-list");
    const changes = filteredPatchChanges(patch.changes);
    changes.forEach((change) => list.append(createPatchChangeRow(change)));
    if (!changes.length) {
      const empty = create("p", "empty-state");
      empty.textContent = "当前筛选下没有改动。";
      list.append(empty);
    }
    card.append(list);
    el.patchList.append(card);
  });
}

function filteredPatchChanges(changes) {
  return toArray(changes).filter((change) => {
    const hero = state.byId.get(change.hero);
    if (state.patchFilters.role !== "all" && hero?.role !== state.patchFilters.role) return false;
    if (state.patchFilters.type !== "all" && change.type !== state.patchFilters.type) return false;
    if (!state.patchFilters.search) return true;
    const haystack = [hero?.id, hero?.name, hero?.nameZh, change.text].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(state.patchFilters.search);
  });
}

function createPatchStats(changes) {
  const stats = create("div", "patch-stats");
  const counts = countPatchTypes(changes);
  ["buff", "nerf", "adjust", "rework"].forEach((type) => {
    const count = counts[type] || 0;
    if (!count) return;
    stats.append(createPatchTypeBadge(type, `${count}${PATCH_TYPE_LABELS[type]}`));
  });
  if (!stats.children.length) stats.append(textBadge("0 条改动"));
  return stats;
}

function countPatchTypes(changes) {
  return toArray(changes).reduce((acc, change) => {
    acc[change.type] = (acc[change.type] || 0) + 1;
    return acc;
  }, {});
}

function createPatchChangeRow(change) {
  const hero = state.byId.get(change.hero);
  const row = create("button", "patch-change-row");
  row.type = "button";
  row.dataset.patchHero = change.hero;
  if (!hero) row.disabled = true;
  row.append(createAvatar(hero || { nameZh: change.hero }));
  const body = create("div", "patch-change-body");
  const head = create("div", "patch-change-head");
  appendText(head, "strong", hero ? `${hero.nameZh} / ${hero.name}` : change.hero);
  head.append(createPatchTypeBadge(change.type));
  body.append(head);
  appendText(body, "p", change.text);
  row.append(body);
  return row;
}

function filteredHeroes() {
  const heroes = state.heroes.filter((hero) => {
    if (state.filters.role !== "all" && hero.role !== state.filters.role) return false;
    if (state.filters.tier !== "all" && hero.tier !== state.filters.tier) return false;
    if (state.filters.ban !== "all" && hero.ban.priority !== state.filters.ban) return false;
    if (state.filters.favoritesOnly && !isFavorite(hero.id)) return false;
    if (!state.filters.search) return true;
    const haystack = [hero.id, hero.name, hero.nameZh, hero.subrole, hero.tier, ...hero.tags].join(" ").toLowerCase();
    return haystack.includes(state.filters.search);
  });
  if (state.filters.favoritesOnly) return heroes;
  return heroes.sort((a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)));
}

function createHeroCard(hero) {
  const card = create("div", hero.id === state.patches.meta.latestHero ? "hero-card is-new-hero" : "hero-card");
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `${hero.nameZh} ${hero.name} 详情`);
  card.dataset.heroId = hero.id;
  card.append(createFavoriteButton(hero, "card"));
  card.append(createCompareButton(hero, "card"));
  if (hero.id === state.patches.meta.latestHero) card.append(createCornerBadge("NEW", "new-corner"));
  const recentChanges = getLatestChanges(hero.id);
  if (recentChanges.length) {
    const badge = createCornerBadge(recentChangeIcon(recentChanges), `recent-corner ${recentChanges[0].type}`);
    badge.title = "近期有调整";
    card.append(badge);
  }
  card.append(createAvatar(hero));

  const body = create("div", "hero-card-body");
  const titleRow = create("div", "hero-title-row");
  const nameBox = create("div");
  appendText(nameBox, "strong", hero.nameZh);
  appendText(nameBox, "span", hero.name);
  titleRow.append(nameBox, createBadge(hero.tier, "tier-badge"));
  body.append(titleRow);

  const meta = create("div", "hero-meta");
  meta.append(
    textBadge(ROLE_LABELS[hero.role] || hero.role),
    textBadge(fallback(hero.subrole)),
    textBadge(`Ban ${BAN_LABELS[hero.ban.priority] || fallback(hero.ban.priority)}`)
  );
  body.append(meta);

  const tags = create("div", "tag-row");
  const shownTags = hero.tags.length ? hero.tags.slice(0, 3) : ["—"];
  shownTags.forEach((tag) => tags.append(textBadge(tag, "tag")));
  body.append(tags);
  card.append(body);
  return card;
}

function createFavoriteButton(hero, context) {
  const button = create("button", context === "detail" ? "favorite-btn detail-favorite" : "favorite-btn");
  button.type = "button";
  button.dataset.favoriteHero = hero.id;
  updateFavoriteButton(button, hero);
  return button;
}

function updateFavoriteButton(button, hero) {
  const active = isFavorite(hero.id);
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", `${active ? "取消收藏" : "收藏"} ${hero.nameZh}`);
  button.title = active ? "取消收藏" : "收藏";
  button.textContent = active ? "★" : "☆";
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]");
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  } catch {
    // Favorites are optional if storage is unavailable.
  }
}

function isFavorite(heroId) {
  return state.favorites.has(heroId);
}

function toggleFavorite(heroId) {
  if (!state.byId.has(heroId)) return;
  if (isFavorite(heroId)) {
    state.favorites.delete(heroId);
  } else {
    state.favorites.add(heroId);
  }
  saveFavorites();
  renderHeroGrid();
  if (activeDetailHeroId) {
    const hero = state.byId.get(activeDetailHeroId);
    const button = el.detailContent.querySelector("button[data-favorite-hero]");
    if (hero && button) updateFavoriteButton(button, hero);
  }
}

function loadCompare() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPARE_KEY) || "[]");
    return uniqueValidHeroIds(Array.isArray(parsed) ? parsed : []).slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

function saveCompare() {
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(state.compare));
  } catch {
    // Compare is optional if storage is unavailable.
  }
}

function setCompare(ids, options = {}) {
  state.compareMessage = "";
  state.compare = uniqueValidHeroIds(ids).slice(0, MAX_COMPARE);
  saveCompare();
  renderCompareTray();
  renderCompareView();
  updateCompareButton();
  if (options.sync !== false) syncHashForCompare(options);
  if (!options.silent && ids.length > MAX_COMPARE) {
    state.compareMessage = `最多同时对比 ${MAX_COMPARE} 位英雄。`;
    renderCompareTray();
    renderCompareView();
  }
}

function toggleCompare(heroId) {
  if (!state.byId.has(heroId)) return;
  if (isInCompare(heroId)) {
    removeFromCompare(heroId);
    return;
  }
  if (state.compare.length >= MAX_COMPARE) {
    state.compareMessage = `最多同时对比 ${MAX_COMPARE} 位英雄，先移除一个再添加。`;
    renderCompareTray();
    renderCompareView();
    updateCompareButton();
    return;
  }
  setCompare([...state.compare, heroId]);
}

function removeFromCompare(heroId) {
  if (!isInCompare(heroId)) return;
  setCompare(state.compare.filter((id) => id !== heroId));
}

function clearCompare() {
  if (!state.compare.length) return;
  setCompare([]);
}

function uniqueValidHeroIds(ids) {
  const seen = new Set();
  const valid = [];
  for (const id of ids) {
    const value = String(id || "").trim();
    if (!value || seen.has(value) || !state.byId.has(value)) continue;
    seen.add(value);
    valid.push(value);
  }
  return valid;
}

function isInCompare(heroId) {
  return state.compare.includes(heroId);
}

function createCompareButton(hero, context) {
  const button = create("button", context === "detail" ? "compare-btn detail-compare" : "compare-btn");
  button.type = "button";
  button.dataset.compareHero = hero.id;
  updateCompareButton(button, hero);
  return button;
}

function updateCompareButton(button = null, hero = null) {
  const buttons = button ? [button] : [...document.querySelectorAll("button[data-compare-hero]")];
  buttons.forEach((item) => {
    const currentHero = hero || state.byId.get(item.dataset.compareHero);
    if (!currentHero) return;
    const active = isInCompare(currentHero.id);
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
    item.setAttribute("aria-label", `${active ? "移出对比" : "加入对比"} ${currentHero.nameZh}`);
    item.title = active ? "移出对比" : "加入对比";
    item.textContent = active ? "✓" : "⇄";
  });
}

function renderCompareTray() {
  el.compareTray.replaceChildren();
  if (!state.compare.length) {
    el.compareTray.hidden = true;
    return;
  }
  el.compareTray.hidden = false;
  const inner = create("div", "compare-tray-inner");
  const summary = create("div", "compare-tray-summary");
  appendText(summary, "strong", `已选 ${state.compare.length}/${MAX_COMPARE}`);
  if (state.compareMessage) appendText(summary, "span", state.compareMessage);
  const heroes = create("div", "compare-tray-heroes");
  state.compare.forEach((id) => {
    const hero = state.byId.get(id);
    if (!hero) return;
    heroes.append(createCompareChip(hero));
  });
  const actions = create("div", "compare-tray-actions");
  const view = create("button", "primary-btn");
  view.type = "button";
  view.dataset.viewCompare = "true";
  view.textContent = "查看对比";
  const clear = create("button", "ghost-btn");
  clear.type = "button";
  clear.dataset.clearCompare = "true";
  clear.textContent = "清空";
  actions.append(view, clear);
  inner.append(summary, heroes, actions);
  el.compareTray.append(inner);
}

function createCompareChip(hero) {
  const chip = create("div", "compare-chip");
  chip.append(createAvatar(hero));
  const name = create("span");
  name.textContent = hero.nameZh;
  const remove = create("button", "icon-btn");
  remove.type = "button";
  remove.dataset.removeCompare = hero.id;
  remove.setAttribute("aria-label", `移出对比 ${hero.nameZh}`);
  remove.textContent = "×";
  chip.append(name, remove);
  return chip;
}

function renderCompareView() {
  if (!el.compareContent) return;
  el.compareCount.textContent = `${state.compare.length} / ${MAX_COMPARE}`;
  el.compareContent.replaceChildren();
  if (state.compareMessage) {
    const message = create("p", "compare-message");
    message.textContent = state.compareMessage;
    el.compareContent.append(message);
  }
  const heroes = state.compare.map((id) => state.byId.get(id)).filter(Boolean);
  if (heroes.length < 2) {
    const empty = create("div", "empty-state compare-empty");
    appendText(empty, "strong", "选择至少 2 位英雄开始对比。");
    appendText(empty, "span", "可在英雄卡或详情头部点击对比按钮，最多 4 位。");
    el.compareContent.append(empty);
    return;
  }
  const wrap = create("div", "compare-table-wrap");
  const table = create("table", "compare-table");
  table.append(createCompareHead(heroes), createCompareBody(heroes));
  wrap.append(table);
  el.compareContent.append(wrap);
}

function createCompareHead(heroes) {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  const empty = document.createElement("th");
  empty.textContent = "维度";
  row.append(empty);
  heroes.forEach((hero) => {
    const th = document.createElement("th");
    const button = create("button", "compare-hero-head");
    button.type = "button";
    button.dataset.compareDetail = hero.id;
    button.append(createAvatar(hero));
    const text = create("span");
    text.textContent = `${hero.nameZh} / ${hero.name}`;
    button.append(text);
    const remove = create("button", "icon-btn");
    remove.type = "button";
    remove.dataset.removeCompare = hero.id;
    remove.setAttribute("aria-label", `移出对比 ${hero.nameZh}`);
    remove.textContent = "×";
    th.append(button, remove);
    row.append(th);
  });
  thead.append(row);
  return thead;
}

function createCompareBody(heroes) {
  const tbody = document.createElement("tbody");
  compareRows().forEach((row) => tbody.append(createCompareRow(row, heroes)));
  return tbody;
}

function compareRows() {
  return [
    { label: "职业", get: (hero) => ROLE_LABELS[hero.role] || hero.role },
    { label: "Tier", get: (hero) => `Tier ${fallback(hero.tier)}` },
    { label: "难度", numeric: true, best: "min", get: (hero) => hero.difficulty, format: (value) => `${value}/5` },
    { label: "总有效生命", numeric: true, best: "max", get: (hero) => hero.health.hp + hero.health.armor + hero.health.shield },
    { label: "血量 HP", numeric: true, best: "max", get: (hero) => hero.health.hp },
    { label: "护甲 Armor", numeric: true, best: "max", get: (hero) => hero.health.armor },
    { label: "护盾 Shield", numeric: true, best: "max", get: (hero) => hero.health.shield },
    { label: "DPS", numeric: true, best: "max", get: (hero) => firstNumber(hero.params.dps), format: (value, hero) => fallback(hero.params.dps) },
    { label: "HPS", numeric: true, best: "max", get: (hero) => firstNumber(hero.params.healingPerSec), format: (value, hero) => fallback(hero.params.healingPerSec) },
    { label: "射程", get: (hero) => hero.params.range },
    { label: "机动", numeric: true, best: "max", get: (hero) => hero.params.mobility, format: (value) => `${value}/5` },
    { label: "站位", get: (hero) => `${DEPTH_LABELS[hero.position.depth] || hero.position.depth} · ${hero.position.zh}` },
    { label: "标签", get: (hero) => hero.tags.join("、") },
    { label: "Ban 优先级", get: (hero) => BAN_LABELS[hero.ban.priority] || hero.ban.priority },
    { label: "代表克制", get: (hero) => hero.counters.strongAgainst.slice(0, 3).map(heroName).join("、") }
  ];
}

function createCompareRow(rowDef, heroes) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = rowDef.label;
  tr.append(th);
  const values = heroes.map((hero) => rowDef.numeric ? normalizeCompareNumber(rowDef.get(hero)) : null);
  const best = rowDef.numeric ? bestCompareValue(values, rowDef.best) : null;
  heroes.forEach((hero, index) => {
    const td = document.createElement("td");
    const raw = rowDef.numeric ? values[index] : rowDef.get(hero);
    const text = rowDef.numeric
      ? (raw === null ? "—" : rowDef.format ? rowDef.format(raw, hero) : String(raw))
      : fallback(raw);
    td.textContent = text;
    if (best !== null && raw === best) td.classList.add("is-best");
    tr.append(td);
  });
  return tr;
}

function normalizeCompareNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstNumber(value) {
  if (typeof value === "number") return value;
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function bestCompareValue(values, direction) {
  const valid = values.filter((value) => value !== null);
  if (!valid.length) return null;
  return direction === "min" ? Math.min(...valid) : Math.max(...valid);
}

function createAvatar(hero) {
  const avatar = create("div", "avatar");
  const initial = create("span");
  initial.textContent = (hero.nameZh || hero.name || "?").slice(0, 1).toUpperCase();
  avatar.append(initial);
  const url = safeUrl(hero.portrait || hero.avatar || hero.image);
  if (url) {
    const img = document.createElement("img");
    img.alt = `${hero.nameZh} 头像`;
    img.src = url;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    avatar.append(img);
  }
  return avatar;
}

function openDetail(heroId, heroStat = null) {
  const hero = state.byId.get(heroId);
  if (!hero) return;
  state.detailStat = heroStat || state.heroStatById.get(heroId) || null;
  renderDetail(hero);
  openDetailPanel(hero.id);
  syncHashForHero(hero.id);
}

function closeDetail() {
  const wasOpen = el.detailDrawer.classList.contains("is-open");
  activeDetailHeroId = "";
  closeDetailPanel();
  if (!wasOpen) return;
  syncHashForView(state.currentView, { replace: true });
}

function openDetailPanel(heroId) {
  activeDetailHeroId = heroId;
  el.detailDrawer.classList.add("is-open");
  el.detailDrawer.setAttribute("aria-hidden", "false");
}

function closeDetailPanel() {
  el.detailDrawer.classList.remove("is-open");
  el.detailDrawer.setAttribute("aria-hidden", "true");
}

function renderDetail(hero) {
  el.detailContent.replaceChildren();
  const heroHead = create("div", "detail-hero-head");
  heroHead.append(createAvatar(hero));
  const names = create("div");
  const title = create("h2");
  title.id = "detailTitle";
  title.textContent = hero.nameZh;
  const subtitle = create("p");
  subtitle.textContent = `${hero.name} · ${ROLE_LABELS[hero.role] || hero.role} · Tier ${fallback(hero.tier)}`;
  names.append(title, subtitle);
  heroHead.append(names);
  const headActions = create("div", "detail-head-actions");
  headActions.append(createFavoriteButton(hero, "detail"), createCompareButton(hero, "detail"));
  heroHead.append(headActions);
  el.detailContent.append(heroHead);

  if (state.detailStat) el.detailContent.append(detailSection("你的此英雄战绩", [createHeroStatSummary(state.detailStat)]));
  const recentChanges = getLatestChanges(hero.id);
  if (recentChanges.length) el.detailContent.append(detailSection("近期调整", [createRecentChangesBlock(recentChanges)]));

  el.detailContent.append(
    detailSection("参数与血量", [createHealthBlock(hero), createKeyValueGrid([
      ["定位", hero.subrole],
      ["难度", hero.difficulty ? `${hero.difficulty}/5` : "—"],
      ["主输出", hero.params.primary],
      ["射程", hero.params.range],
      ["机动性", hero.params.mobility ? `${hero.params.mobility}/5` : "—"],
      ["DPS", hero.params.dps],
      ["HPS", hero.params.healingPerSec],
      ["备注", hero.params.note]
    ])]),
    detailSection("被动 / 武器 / 技能", [createAbilityBlock(hero)]),
    detailSection("Perk", [createPerkBlock(hero)]),
    detailSection("站位", [createPositionBlock(hero)]),
    detailSection("克制关系", [createCounterBlock(hero)]),
    detailSection("地图强势 / 劣势", [createMapBlock(hero)]),
    detailSection("Ban 位", [createKeyValueGrid([
      ["优先级", BAN_LABELS[hero.ban.priority] || hero.ban.priority],
      ["理由", hero.ban.reason]
    ])]),
    detailSection("各分段打法", [createKeyValueGrid([
      ["青铜-黄金", hero.rankPlay.bronzeGold],
      ["铂金-钻石", hero.rankPlay.platDiamond],
      ["大师-GM", hero.rankPlay.masterGM]
    ])])
  );
}

function createHeroStatSummary(stat) {
  return createKeyValueGrid([
    ["场次", stat.games],
    ["胜率", `${stat.winrate.toFixed(1)}%`],
    ["KDA", stat.kda.toFixed(2)],
    ["场均伤害", Math.round(stat.damageAvg)],
    ["场均治疗", Math.round(stat.healingAvg)],
    ["游戏时长", formatDuration(stat.timePlayed)]
  ]);
}

function createRecentChangesBlock(changes) {
  const wrap = create("div", "recent-change-list");
  changes.forEach((change) => {
    const row = create("div", "recent-change-row");
    row.append(createPatchTypeBadge(change.type));
    appendText(row, "span", change.text);
    wrap.append(row);
  });
  return wrap;
}

function createHealthBlock(hero) {
  const total = hero.health.hp + hero.health.armor + hero.health.shield;
  const wrap = create("div", "health-block");
  const label = create("div", "health-label");
  label.textContent = total ? `总计 ${total} · HP ${hero.health.hp} / Armor ${hero.health.armor} / Shield ${hero.health.shield}` : "—";
  const bar = create("div", "health-bar");
  const segments = [["hp", hero.health.hp], ["armor", hero.health.armor], ["shield", hero.health.shield]];
  for (const [type, value] of segments) {
    if (!total || !value) continue;
    const seg = create("span", `health-${type}`);
    seg.style.width = `${(value / total) * 100}%`;
    bar.append(seg);
  }
  if (!bar.children.length) bar.append(create("span", "health-empty"));
  wrap.append(label, bar);
  return wrap;
}

function createAbilityBlock(hero) {
  const wrap = create("div", "stack");
  wrap.append(createKeyValueGrid([["被动", hero.abilities.passive], ["武器", formatNamed(hero.abilities.weapon)]]));
  wrap.append(createList("主动技能", hero.abilities.actives.map((ability) => {
    const cooldown = ability.cooldown === 0 || ability.cooldown ? `CD ${ability.cooldown}s` : "CD —";
    return `${formatNamed(ability)} · ${cooldown}`;
  })));
  wrap.append(createKeyValueGrid([["大招", formatNamed(hero.abilities.ultimate)]]));
  return wrap;
}

function createPerkBlock(hero) {
  const wrap = create("div", "stack");
  wrap.append(createList("小天赋 2 选 1", hero.perks.minor.map(formatNamed)));
  wrap.append(createList("大天赋 2 选 1", hero.perks.major.map(formatNamed)));
  wrap.append(createKeyValueGrid([["推荐", hero.perks.recommended]]));
  return wrap;
}

function createPositionBlock(hero) {
  const wrap = create("div", "position-box");
  const depth = create("span", "depth-badge");
  depth.textContent = DEPTH_LABELS[hero.position.depth] || hero.position.depth;
  const text = create("p");
  text.textContent = hero.position.zh;
  wrap.append(depth, text);
  return wrap;
}

function createCounterBlock(hero) {
  const wrap = create("div", "counter-groups");
  wrap.append(
    createHeroLinkGroup("我克制 strongAgainst", hero.counters.strongAgainst),
    createHeroLinkGroup("我怕 weakAgainst", hero.counters.weakAgainst),
    createHeroLinkGroup("协同 synergy", hero.counters.synergy)
  );
  return wrap;
}

function createHeroLinkGroup(title, ids) {
  const group = create("div", "link-group");
  appendText(group, "h4", title);
  const links = create("div", "link-row");
  const validIds = toArray(ids);
  if (!validIds.length) {
    links.append(textBadge("—"));
  } else {
    validIds.forEach((id) => {
      const hero = state.byId.get(id);
      const button = create("button", "hero-link");
      button.type = "button";
      button.dataset.jumpHero = id;
      button.textContent = hero ? `${hero.nameZh} / ${hero.name}` : id;
      if (!hero) button.disabled = true;
      links.append(button);
    });
  }
  group.append(links);
  return group;
}

function createMapBlock(hero) {
  const wrap = create("div", "stack");
  wrap.append(createList("强势地图", hero.maps.strong));
  wrap.append(createList("劣势地图", hero.maps.weak));
  wrap.append(createKeyValueGrid([["备注", hero.maps.note]]));
  return wrap;
}

function detailSection(title, children) {
  const section = create("section", "detail-section");
  appendText(section, "h3", title);
  children.forEach((child) => section.append(child));
  return section;
}

function createKeyValueGrid(rows) {
  const grid = create("dl", "kv-grid");
  rows.forEach(([key, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = fallback(value);
    grid.append(dt, dd);
  });
  return grid;
}

function createList(title, items) {
  const wrap = create("div", "list-block");
  appendText(wrap, "h4", title);
  const list = create("ul");
  const safeItems = toArray(items);
  if (!safeItems.length) {
    const item = document.createElement("li");
    item.textContent = "—";
    list.append(item);
  } else {
    safeItems.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = fallback(value);
      list.append(item);
    });
  }
  wrap.append(list);
  return wrap;
}

function formatNamed(item = {}) {
  const names = [item.nameZh, item.name].filter(Boolean).join(" / ");
  const desc = fallback(item.desc);
  return names ? `${names}：${desc}` : desc;
}

function renderEnemyChips() {
  el.enemyChips.replaceChildren();
  for (const hero of state.heroes) {
    const chip = create("button", "select-chip");
    chip.type = "button";
    chip.dataset.enemyId = hero.id;
    chip.classList.toggle("is-selected", state.selectedEnemies.includes(hero.id));
    chip.textContent = `${hero.nameZh} ${hero.name}`;
    el.enemyChips.append(chip);
  }
}

function toggleEnemy(heroId) {
  if (state.selectedEnemies.includes(heroId)) {
    state.selectedEnemies = state.selectedEnemies.filter((id) => id !== heroId);
  } else if (state.selectedEnemies.length < 5) {
    state.selectedEnemies = [...state.selectedEnemies, heroId];
  }
  renderEnemyChips();
  renderCounter();
}

function mergeInputEnemies() {
  const parts = el.enemyInput.value.split(/[,，、\s]+/).map((part) => part.trim()).filter(Boolean);
  state.selectedEnemies = mergeEnemyParts(state.selectedEnemies, parts);
  renderEnemyChips();
}

function mergeEnemyParts(current, parts) {
  const merged = [...current];
  for (const part of parts) {
    const id = findHeroId(part, state.heroes);
    if (id && !merged.includes(id) && merged.length < 5) merged.push(id);
  }
  return merged;
}

function renderCounter() {
  el.selectedEnemies.replaceChildren();
  if (!state.selectedEnemies.length) {
    el.selectedEnemies.append(textBadge("尚未选择敌方英雄"));
  } else {
    state.selectedEnemies.forEach((id) => {
      const hero = state.byId.get(id);
      const chip = create("button", "selected-chip");
      chip.type = "button";
      chip.textContent = `${hero?.nameZh || id} ×`;
      chip.addEventListener("click", () => toggleEnemy(id));
      el.selectedEnemies.append(chip);
    });
  }

  const result = recommend(state.selectedEnemies, state.heroes);
  renderCounterResults(el.counterResults, result);
}

function renderCounterResults(container, result) {
  container.replaceChildren();
  if (!result.enemies.length) {
    const empty = create("p", "empty-state");
    empty.textContent = "选择或输入敌方英雄后，会按职业给出 Top counter 推荐。";
    container.append(empty);
    return;
  }
  if (container === el.counterResults) container.append(createSwapAdvisor(result));
  for (const role of ["tank", "damage", "support"]) {
    const section = create("div", "result-role");
    appendText(section, "h3", `${ROLE_LABELS[role]} Top 推荐`);
    const list = create("div", "result-list");
    result.byRole[role].slice(0, 5).forEach((item) => list.append(createResultRow(item)));
    if (!list.children.length) list.append(textBadge("—"));
    section.append(list);
    container.append(section);
  }
}

function createSwapAdvisor(result) {
  const wrap = create("div", "swap-advisor");
  appendText(wrap, "h3", "换不换顾问");
  if (!state.currentHeroId) {
    appendText(wrap, "p", "先选择“我当前英雄”，这里会判断这把是能打、该稳住，还是同职业有更优解。");
    return wrap;
  }

  const current = state.byId.get(state.currentHeroId);
  if (!current) {
    appendText(wrap, "p", "当前英雄无法识别，先换一个本地英雄再计算。");
    return wrap;
  }

  const matchup = scoreHeroAgainstEnemies(current, result.enemies, state.byId);
  const sameRole = result.byRole[current.role] || [];
  const better = sameRole.filter((item) => item.id !== current.id && item.score > matchup.score).slice(0, 2);
  const currentStat = state.heroStatById.get(current.id) || null;
  const playerLine = createPlayerFamiliarityLine(currentStat);
  const title = create("strong");
  title.textContent = `${current.nameZh} 对当前阵容得分 ${formatScore(matchup.score)}`;
  wrap.append(title);

  const message = create("p");
  if (matchup.score >= 0) {
    message.textContent = "🟢 你这英雄能打，别急着换。counterswap 不是必须，先看地图、资源和队友节奏。";
  } else if (currentStat && currentStat.games >= 10 && currentStat.winrate >= 48 && matchup.score >= -2) {
    message.textContent = "🟢 略偏劣势，但你在这个英雄上更熟练，可继续打，不必为了纸面 counter 无脑换。";
  } else if (better.length) {
    message.textContent = `🟡 偏劣势，考虑换 ${better.map((item) => item.nameZh).join(" / ")}。只在你确实会玩、队伍需要时再换。`;
  } else {
    message.textContent = "🟡 偏劣势，但同职业没有明显更优解。先调整站位和交技能节奏，别为了换而换。";
  }
  wrap.append(message);
  if (matchup.reasons.length) wrap.append(createList("命中原因", matchup.reasons));
  if (playerLine) appendText(wrap, "p", playerLine).className = "swap-note";
  if (better.length) wrap.append(createSwapOptions(better));
  return wrap;
}

function createPlayerFamiliarityLine(stat) {
  if (!stat) {
    return state.heroStats.length ? "已加载玩家战绩：你在当前英雄上暂无记录，纸面推荐要谨慎试。" : "";
  }
  const base = `已加载玩家战绩：${stat.games} 场，胜率 ${stat.winrate.toFixed(1)}%。`;
  if (stat.games >= 10) return `${base} 场次较多，熟练度会软化换人建议。`;
  if (stat.games > 0) return `${base} 样本偏少，别只看胜率。`;
  return "";
}

function createSwapOptions(items) {
  const group = create("div", "swap-options");
  appendText(group, "h4", "同职业更优解");
  items.forEach((item) => {
    const stat = state.heroStatById.get(item.id);
    const button = create("button", "mini-hero-row");
    button.type = "button";
    button.addEventListener("click", () => openDetail(item.id, stat || null));
    button.append(createAvatar(state.byId.get(item.id) || item));
    const body = create("div");
    appendText(body, "strong", `${item.nameZh} ${formatScore(item.score)}`);
    const note = stat ? `你的记录：${stat.games} 场 / ${stat.winrate.toFixed(1)}%` : state.heroStats.length ? "你不熟，谨慎" : "未加载玩家战绩";
    appendText(body, "span", note);
    button.append(body);
    group.append(button);
  });
  return group;
}

function createResultRow(item) {
  const row = create("button", "result-row");
  row.type = "button";
  row.addEventListener("click", () => openDetail(item.id));
  const name = create("div");
  appendText(name, "strong", `${item.nameZh} / ${item.name}`);
  const reason = create("span");
  reason.textContent = item.reasons.length ? item.reasons.join("；") : "无直接克制命中";
  name.append(reason);
  const score = create("b");
  score.textContent = item.score > 0 ? `+${item.score}` : String(item.score);
  row.append(name, score);
  return row;
}

function renderBanList() {
  const heroes = sortedBanHeroes();
  el.banCount.textContent = `${heroes.length} 条建议`;
  el.banList.replaceChildren();
  for (const hero of heroes) el.banList.append(createBanItem(hero));
}

function sortedBanHeroes() {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...state.heroes].sort((a, b) => (
    (priorityRank[a.ban.priority] ?? 9) - (priorityRank[b.ban.priority] ?? 9) ||
    String(a.tier).localeCompare(String(b.tier)) ||
    a.name.localeCompare(b.name)
  ));
}

function createBanItem(hero) {
  const item = create("button", "ban-item");
  item.type = "button";
  item.addEventListener("click", () => openDetail(hero.id));
  const left = create("div");
  appendText(left, "strong", `${hero.nameZh} / ${hero.name}`);
  appendText(left, "span", hero.ban.reason);
  const right = create("div", "ban-rank");
  right.append(createBadge(BAN_LABELS[hero.ban.priority] || hero.ban.priority, `ban-${hero.ban.priority}`));
  right.append(createBadge(`Tier ${fallback(hero.tier)}`, "tier-badge"));
  item.append(left, right);
  return item;
}

async function runPlayerSearch() {
  const query = el.playerSearchInput.value.trim();
  el.playerResults.replaceChildren();
  if (!query) {
    setApiState(el.playerSearchState, "");
    return;
  }
  setApiState(el.playerSearchState, "loading", "正在搜索玩家...");
  try {
    const payload = await searchPlayers(query);
    const results = toArray(payload?.results);
    setApiState(el.playerSearchState, results.length ? "" : "empty", results.length ? "" : "没有找到候选玩家。");
    renderPlayerResults(results);
  } catch (error) {
    console.error(error);
    setApiState(el.playerSearchState, "error", friendlyApiError(error, "玩家搜索失败"));
  }
}

function renderPlayerResults(results) {
  el.playerResults.replaceChildren();
  for (const player of results.slice(0, 12)) {
    el.playerResults.append(createPlayerResult(player));
  }
}

function createPlayerResult(player) {
  const button = create("button", "player-result");
  button.type = "button";
  button.dataset.playerId = player.player_id || "";
  const avatar = create("div", "player-avatar");
  const imgUrl = safeUrl(player.avatar);
  if (imgUrl) {
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = "玩家头像";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    avatar.append(img);
  }
  const body = create("div");
  appendText(body, "strong", player.name || "未知玩家");
  appendText(body, "span", player.title || "无头衔");
  button.append(avatar, body);
  return button;
}

async function selectPlayer(playerId, options = {}) {
  const id = String(playerId || "");
  if (!id) return;
  const requestId = ++state.playerRequestId;
  const known = findKnownPlayer(id);
  state.selectedPlayer = known || { player_id: id };
  if (!options.keepResults) el.playerResults.replaceChildren();
  el.playerProfile.replaceChildren();
  setApiState(el.playerSearchState, "loading", "正在加载段位与英雄战绩...");
  try {
    const [summary, stats] = await Promise.all([getSummary(id), getStatsSummary(id, { platform: state.platform })]);
    if (requestId !== state.playerRequestId) return;
    state.selectedPlayer = { ...state.selectedPlayer, ...summary, player_id: id };
    rememberPlayer(state.selectedPlayer);
    state.heroStats = normalizeHeroStats(stats, state.byId);
    state.heroStatById = new Map(state.heroStats.map((row) => [row.id, row]));
    setApiState(el.playerSearchState, "");
    renderRecentPlayers();
    renderPlayerProfile(summary, stats);
    renderCounter();
  } catch (error) {
    console.error(error);
    if (requestId !== state.playerRequestId) return;
    setApiState(el.playerSearchState, "error", friendlyApiError(error, "玩家数据加载失败"));
    renderPlayerShell(state.selectedPlayer, null);
  }
}

function renderPlayerProfile(summary, stats) {
  el.playerProfile.replaceChildren();
  el.playerProfile.append(renderPlayerShell(summary, stats));
  renderHeroStatsTable();
}

function renderPlayerShell(summary, stats) {
  const wrap = create("div", "profile-card");
  const namecard = safeUrl(summary?.namecard);
  if (namecard) wrap.style.backgroundImage = `linear-gradient(90deg, rgba(13,17,24,.92), rgba(13,17,24,.58)), url("${namecard}")`;
  const head = create("div", "profile-head");
  const avatar = create("div", "profile-avatar");
  const avatarUrl = safeUrl(summary?.avatar);
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "玩家头像";
    img.addEventListener("error", () => img.remove());
    avatar.append(img);
  }
  const titleBox = create("div");
  appendText(titleBox, "h3", summary?.username || summary?.name || state.selectedPlayer?.name || "未知玩家");
  appendText(titleBox, "p", summary?.title || "无头衔");
  const endorse = createBadge(`点赞等级 ${fallback(summary?.endorsement?.level)}`);
  head.append(avatar, titleBox, endorse);
  wrap.append(head, createRankCards(summary?.competitive?.[state.platform]));
  if (stats) wrap.append(createOverview(stats));
  return wrap;
}

function createRankCards(platformRanks) {
  const grid = create("div", "rank-grid");
  for (const role of ["tank", "damage", "support"]) {
    const card = create("div", "rank-card");
    appendText(card, "span", roleNamesZh[role] || role);
    const rank = platformRanks?.[role] || null;
    const title = create("strong");
    title.textContent = formatRank(rank);
    card.append(title);
    const icon = safeUrl(rank?.rank_icon);
    if (icon) {
      const img = document.createElement("img");
      img.src = icon;
      img.alt = "段位图标";
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      card.append(img);
    }
    grid.append(card);
  }
  return grid;
}

function createOverview(stats) {
  const wrap = create("div", "overview-grid");
  const general = stats?.general || {};
  [
    ["总胜率", `${numText(general.winrate, 1)}%`],
    ["KDA", numText(general.kda, 2)],
    ["总场次", fallback(general.games_played, 0)]
  ].forEach(([label, value]) => wrap.append(createMetric(label, value)));
  summarizeRoles(stats).forEach((role) => wrap.append(createMetric(`${roleNamesZh[role.role]}胜率`, `${role.winrate.toFixed(1)}%`)));
  return wrap;
}

function createMetric(label, value) {
  const item = create("div", "metric");
  appendText(item, "span", label);
  appendText(item, "strong", value);
  return item;
}

function renderHeroStatsTable() {
  renderPerformanceCards();
  let tableWrap = el.playerProfile.querySelector(".stats-table-wrap");
  if (!tableWrap) {
    tableWrap = create("div", "stats-table-wrap");
    el.playerProfile.append(tableWrap);
  }
  tableWrap.replaceChildren();
  const rows = sortHeroStats(state.heroStats, state.heroSort.key, state.heroSort.direction);
  if (!rows.length) {
    const empty = create("p", "empty-state");
    empty.textContent = "暂无可展示的英雄战绩。";
    tableWrap.append(empty);
    return;
  }
  const table = create("table", "stats-table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    ["hero", "英雄"], ["games", "场次"], ["winrate", "胜率"], ["kda", "KDA"],
    ["damageAvg", "场均伤害"], ["healingAvg", "场均治疗"], ["time", "游戏时长"]
  ].forEach(([key, label]) => {
    const th = document.createElement("th");
    if (["games", "winrate", "kda"].includes(key)) {
      const button = create("button", "table-sort");
      button.type = "button";
      button.dataset.sort = key;
      button.textContent = state.heroSort.key === key ? `${label} ${state.heroSort.direction === "desc" ? "↓" : "↑"}` : label;
      th.append(button);
    } else {
      th.textContent = label;
    }
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => tbody.append(createHeroStatRow(row)));
  table.append(thead, tbody);
  tableWrap.append(table);
}

function renderPerformanceCards() {
  let cardWrap = el.playerProfile.querySelector(".performance-cards");
  if (!cardWrap) {
    cardWrap = create("div", "performance-cards");
    const tableWrap = el.playerProfile.querySelector(".stats-table-wrap");
    if (tableWrap) {
      el.playerProfile.insertBefore(cardWrap, tableWrap);
    } else {
      el.playerProfile.append(cardWrap);
    }
  }
  cardWrap.replaceChildren();
  const cards = buildPerformanceCards(state.heroStats);
  if (!cards.length) {
    cardWrap.remove();
    return;
  }
  cards.forEach((card) => cardWrap.append(createPerformanceCard(card)));
}

function createPerformanceCard(card) {
  const button = create("button", `performance-card performance-${card.kind}`);
  button.type = "button";
  button.addEventListener("click", () => openDetail(card.heroId, state.heroStatById.get(card.heroId) || null));
  const hero = state.byId.get(card.heroId);
  const portrait = safeUrl(card.portrait || hero?.portrait);
  if (portrait) button.style.backgroundImage = `linear-gradient(135deg, rgba(13,17,24,.82), rgba(13,17,24,.42)), url("${portrait}")`;
  const label = create("span");
  label.textContent = cardTitleIcon(card.kind, card.title);
  const value = create("strong");
  value.textContent = card.value;
  const heroName = create("b");
  heroName.textContent = card.heroNameZh || card.heroName || card.heroId;
  const note = create("p");
  note.textContent = card.note;
  button.append(label, value, heroName, note);
  return button;
}

function cardTitleIcon(kind, title) {
  const icons = { main: "🎮", winrate: "📈", damage: "💥", healing: "💚", stable: "🛡️" };
  return `${icons[kind] || "★"} ${title}`;
}

function createHeroStatRow(row) {
  const tr = document.createElement("tr");
  tr.dataset.statHero = row.id;
  const heroCell = document.createElement("td");
  const heroBox = create("button", "stat-hero");
  heroBox.type = "button";
  heroBox.dataset.statHero = row.id;
  if (row.portrait) heroBox.append(createAvatar(row.hero || row));
  const name = create("span");
  name.textContent = row.nameZh;
  heroBox.append(name);
  heroCell.append(heroBox);
  tr.append(heroCell);
  appendCell(tr, row.games);
  appendCell(tr, `${row.winrate.toFixed(1)}%`, winrateClass(row.winrate));
  appendCell(tr, row.kda.toFixed(2));
  appendCell(tr, Math.round(row.damageAvg));
  appendCell(tr, Math.round(row.healingAvg));
  appendCell(tr, formatDuration(row.timePlayed));
  return tr;
}

function appendCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = fallback(value);
  row.append(cell);
}

function winrateClass(value) {
  if (value >= 55) return "good";
  if (value <= 45) return "bad";
  return "";
}

function rememberPlayer(player) {
  try {
    const list = getRecentPlayers().filter((item) => item.player_id !== player.player_id);
    list.unshift({
      player_id: player.player_id,
      name: player.username || player.name || "未知玩家",
      avatar: player.avatar || "",
      title: player.title || ""
    });
    window.localStorage.setItem("ow:recentPlayers", JSON.stringify(list.slice(0, 6)));
  } catch {
    // Recent searches are optional.
  }
}

function getRecentPlayers() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("ow:recentPlayers") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderRecentPlayers() {
  const recent = getRecentPlayers();
  el.recentPlayers.replaceChildren();
  if (!recent.length) return;
  appendText(el.recentPlayers, "span", "最近查询");
  recent.forEach((player) => {
    const button = create("button", "recent-chip");
    button.type = "button";
    button.dataset.playerId = player.player_id;
    button.textContent = player.name || "未知玩家";
    el.recentPlayers.append(button);
  });
}

function findKnownPlayer(playerId) {
  const all = [...getRecentPlayers()];
  const resultButtons = [...el.playerResults.querySelectorAll("[data-player-id]")];
  for (const button of resultButtons) all.push({ player_id: button.dataset.playerId, name: button.textContent.trim() });
  return all.find((item) => item.player_id === playerId) || null;
}

async function loadMapsOnce() {
  if (state.mapsLoaded) return;
  state.mapsLoaded = true;
  setApiState(el.mapsState, "loading", "正在加载地图...");
  try {
    const maps = await getMaps();
    state.maps = Array.isArray(maps) ? maps : [];
    setApiState(el.mapsState, state.maps.length ? "" : "empty", state.maps.length ? "" : "没有可展示的地图。");
    renderMapModeTabs();
    renderMapsGrid();
  } catch (error) {
    console.error(error);
    setApiState(el.mapsState, "error", friendlyApiError(error, "地图加载失败"));
  }
}

function renderMapModeTabs() {
  const modes = new Set();
  state.maps.forEach((map) => toArray(map.gamemodes).forEach((mode) => modes.add(mode)));
  const active = el.mapModeTabs.querySelector('[data-mode="all"]');
  el.mapModeTabs.replaceChildren(active || createModeButton("all"));
  [...modes].sort().forEach((mode) => el.mapModeTabs.append(createModeButton(mode)));
}

function createModeButton(mode) {
  const button = create("button", mode === state.mapMode ? "is-active" : "");
  button.type = "button";
  button.dataset.mode = mode;
  button.textContent = mode === "all" ? "全部" : modeLabels[mode] || mode;
  return button;
}

function renderMapsGrid() {
  el.mapsGrid.replaceChildren();
  const maps = state.maps.filter((map) => state.mapMode === "all" || toArray(map.gamemodes).includes(state.mapMode));
  el.mapCount.textContent = `${maps.length} 张地图`;
  maps.forEach((map) => el.mapsGrid.append(createMapCard(map)));
  if (maps[0]) renderMapDetail(maps[0]);
}

function createMapCard(map) {
  const card = create("button", "map-card");
  card.type = "button";
  card.dataset.mapKey = map.key || "";
  const meta = getMapMeta(map);
  const shot = create("div", "map-shot");
  const src = safeUrl(map.screenshot);
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "地图截图";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    shot.append(img);
  }
  const body = create("div", "map-card-body");
  appendText(body, "strong", `${countryFlag(map.country_code)} ${fallback(map.name)}`);
  const tags = create("div", "tag-row");
  toArray(map.gamemodes).forEach((mode) => tags.append(textBadge(modeLabels[mode] || mode, "tag")));
  if (meta) tags.append(textBadge(shortArchetype(meta.archetype), "tag map-meta-tag"));
  appendText(body, "span", map.location || "未知地点");
  body.append(tags);
  card.append(shot, body);
  return card;
}

function renderMapDetail(map) {
  el.mapDetail.replaceChildren();
  const meta = getMapMeta(map);
  const title = create("div", "section-head");
  const left = create("div");
  appendText(left, "p", "Map Matchup").className = "eyebrow";
  appendText(left, "h3", `${countryFlag(map.country_code)} ${meta?.nameZh || fallback(map.name)}`);
  title.append(left, createBadge(toArray(map.gamemodes).map((mode) => modeLabels[mode] || mode).join(" / ") || "—"));
  if (meta) {
    el.mapDetail.append(title, createMapMetaDetail(meta));
    return;
  }
  const aggregate = aggregateMapHeroes(map);
  const grid = create("div", "map-reco-grid");
  grid.append(createMapRecoColumn("强势英雄", aggregate.strong), createMapRecoColumn("劣势英雄", aggregate.weak));
  el.mapDetail.append(title, grid);
}

function createMapMetaDetail(meta) {
  const wrap = create("div", "map-meta-detail");
  wrap.append(createKeyValueGrid([
    ["地形类型", meta.archetype],
    ["地形要点", meta.terrain],
    ["利于打法", meta.favors.join("、")],
    ["不利打法", meta.against.join("、")],
    ["提示", meta.tip]
  ]));
  const heroSection = create("div", "map-picks");
  appendText(heroSection, "h4", "此图强势英雄");
  const row = create("div", "portrait-row");
  meta.heroPicks.forEach((id) => {
    const hero = state.byId.get(id);
    if (!hero) return;
    const button = create("button", "portrait-btn");
    button.type = "button";
    button.title = hero.nameZh;
    button.addEventListener("click", () => openDetail(hero.id));
    button.append(createAvatar(hero));
    row.append(button);
  });
  if (!row.children.length) row.append(textBadge("暂无头像数据"));
  heroSection.append(row);
  wrap.append(heroSection);
  return wrap;
}

function getMapMeta(map) {
  const key = String(map?.key || "");
  return state.mapMeta.get(key) || null;
}

function shortArchetype(value) {
  return String(fallback(value)).split(/[\/、，,]/)[0] || "地形要点";
}

function aggregateMapHeroes(map) {
  const keywords = mapKeywords(map);
  const strong = [];
  const weak = [];
  state.heroes.forEach((hero) => {
    const strongScore = textScore([...hero.maps.strong, hero.maps.note], keywords);
    const weakScore = textScore([...hero.maps.weak], keywords);
    if (strongScore) strong.push({ hero, score: strongScore });
    if (weakScore) weak.push({ hero, score: weakScore });
  });
  return {
    strong: strong.sort((a, b) => b.score - a.score).slice(0, 8),
    weak: weak.sort((a, b) => b.score - a.score).slice(0, 8)
  };
}

function mapKeywords(map) {
  const modes = toArray(map.gamemodes);
  const keywords = [map.name, map.location, ...modes].filter(Boolean).map((item) => String(item).toLowerCase());
  const terrainByMode = {
    escort: ["长视野", "高台", "开阔", "推进"],
    hybrid: ["高台", "转角", "推进"],
    control: ["近身", "狭窄", "团战"],
    flashpoint: ["开阔", "机动", "高台"],
    push: ["长线", "转角", "机动"],
    clash: ["狭窄", "高台", "正面"]
  };
  modes.forEach((mode) => keywords.push(...toArray(terrainByMode[mode])));
  return keywords;
}

function textScore(texts, keywords) {
  const blob = texts.filter(Boolean).join(" ").toLowerCase();
  return keywords.reduce((score, keyword) => score + (keyword && blob.includes(keyword) ? 1 : 0), 0);
}

function createMapRecoColumn(title, items) {
  const column = create("div", "map-reco");
  appendText(column, "h4", title);
  if (!items.length) {
    column.append(textBadge("暂无明确匹配"));
    return column;
  }
  items.forEach(({ hero, score }) => {
    const button = create("button", "mini-hero-row");
    button.type = "button";
    button.addEventListener("click", () => openDetail(hero.id));
    button.append(createAvatar(hero));
    const body = create("div");
    appendText(body, "strong", hero.nameZh);
    appendText(body, "span", `匹配 ${score} 个关键词 · Tier ${fallback(hero.tier)}`);
    button.append(body);
    column.append(button);
  });
  return column;
}

function renderMetaDashboard() {
  renderTierGrid();
  renderBanBoard();
  renderRolePassives();
}

function renderTierGrid() {
  el.tierGrid.replaceChildren();
  const wrap = create("div", "dashboard-card");
  appendText(wrap, "h3", "Tier 榜");
  const grid = create("div", "tier-grid");
  ["tank", "damage", "support"].forEach((role) => {
    ["S", "A", "B", "C"].forEach((tier) => {
      const cell = create("div", "tier-cell");
      appendText(cell, "h4", `${ROLE_LABELS[role]} · ${tier}`);
      const row = create("div", "portrait-row");
      state.heroes.filter((hero) => hero.role === role && hero.tier === tier).forEach((hero) => {
        const button = create("button", "portrait-btn");
        button.type = "button";
        button.title = hero.nameZh;
        button.addEventListener("click", () => openDetail(hero.id));
        button.append(createAvatar(hero));
        row.append(button);
      });
      if (!row.children.length) row.append(textBadge("—"));
      cell.append(row);
      grid.append(cell);
    });
  });
  wrap.append(grid);
  el.tierGrid.append(wrap);
}

function renderBanBoard() {
  el.banBoard.replaceChildren();
  const wrap = create("div", "dashboard-card");
  appendText(wrap, "h3", "Ban 优先级");
  const columns = create("div", "ban-columns");
  ["high", "medium", "low"].forEach((priority) => {
    const column = create("div", "ban-column");
    appendText(column, "h4", `${BAN_LABELS[priority]}优先级`);
    state.heroes.filter((hero) => hero.ban.priority === priority).slice(0, 8).forEach((hero) => {
      const button = create("button", "ban-mini");
      button.type = "button";
      button.addEventListener("click", () => openDetail(hero.id));
      button.textContent = `${hero.nameZh} · ${hero.ban.reason}`;
      column.append(button);
    });
    columns.append(column);
  });
  wrap.append(columns);
  el.banBoard.append(wrap);
}

function renderRolePassives() {
  el.rolePassives.replaceChildren();
  const wrap = create("div", "dashboard-card");
  appendText(wrap, "h3", "职业被动 / 打法速览");
  const list = create("div", "role-tips");
  Object.entries(roleTips).forEach(([role, text]) => {
    const item = create("div", "role-tip");
    appendText(item, "strong", ROLE_LABELS[role] || role);
    appendText(item, "span", text);
    list.append(item);
  });
  wrap.append(list);
  el.rolePassives.append(wrap);
}

function renderOverlay() {
  el.overlayCounterMount.replaceChildren();
  el.overlayBan.replaceChildren();
  const picker = create("div", "overlay-panel");
  appendText(picker, "h3", "克制计算器");
  const field = create("label", "field");
  appendText(field, "span", "敌方英雄");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "例：源氏 ana";
  field.append(input);
  const actions = create("div", "mini-actions");
  const run = create("button", "primary-btn");
  run.type = "button";
  run.textContent = "计算";
  const clear = create("button", "ghost-btn");
  clear.type = "button";
  clear.textContent = "清空";
  actions.append(run, clear);
  const selected = create("div", "selected-list");
  const chips = create("div", "chip-grid overlay-chips");
  const results = create("div", "counter-results");
  picker.append(field, actions, selected, chips, results);
  el.overlayCounterMount.append(picker);

  const rerender = () => {
    selected.replaceChildren();
    state.overlayEnemies.forEach((id) => selected.append(textBadge(state.byId.get(id)?.nameZh || id)));
    chips.replaceChildren();
    state.heroes.forEach((hero) => {
      const chip = create("button", "select-chip");
      chip.type = "button";
      chip.classList.toggle("is-selected", state.overlayEnemies.includes(hero.id));
      chip.textContent = hero.nameZh;
      chip.addEventListener("click", () => {
        state.overlayEnemies = state.overlayEnemies.includes(hero.id)
          ? state.overlayEnemies.filter((item) => item !== hero.id)
          : [...state.overlayEnemies, hero.id].slice(0, 5);
        rerender();
      });
      chips.append(chip);
    });
    renderCounterResults(results, recommend(state.overlayEnemies, state.heroes));
  };
  run.addEventListener("click", () => {
    state.overlayEnemies = mergeEnemyParts(state.overlayEnemies, input.value.split(/[,，、\s]+/).filter(Boolean));
    rerender();
  });
  clear.addEventListener("click", () => {
    state.overlayEnemies = [];
    input.value = "";
    rerender();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") run.click();
  });
  rerender();

  const ban = create("div", "overlay-panel");
  appendText(ban, "h3", "Meta Ban 速览");
  sortedBanHeroes().filter((hero) => hero.ban.priority !== "low").slice(0, 8).forEach((hero) => {
    const item = create("button", "ban-mini");
    item.type = "button";
    item.addEventListener("click", () => openDetail(hero.id));
    item.textContent = `${BAN_LABELS[hero.ban.priority]} · ${hero.nameZh}`;
    ban.append(item);
  });
  el.overlayBan.append(ban);
}

function setApiState(container, type, message = "") {
  container.replaceChildren();
  container.className = type ? `api-state ${type}` : "api-state";
  if (!message) return;
  if (type === "loading") container.append(create("span", "spinner"));
  appendText(container, "span", message);
}

function createBadge(text, className = "") {
  const badge = create("span", className ? `badge ${className}` : "badge");
  badge.textContent = fallback(text);
  if (className.split(/\s+/).includes("tier-badge")) {
    const tier = String(text || "").replace(/^Tier\s+/i, "").trim().slice(0, 1).toUpperCase();
    if (["S", "A", "B", "C"].includes(tier)) badge.dataset.tier = tier;
  }
  return badge;
}

function textBadge(text, className = "") {
  return createBadge(text, className);
}

function createPatchTypeBadge(type, text = "") {
  const safeType = PATCH_TYPE_LABELS[type] ? type : "adjust";
  const badge = createBadge(text || `${patchTypeIcon(safeType)} ${PATCH_TYPE_LABELS[safeType]}`, `patch-type type-${safeType}`);
  return badge;
}

function patchTypeIcon(type) {
  if (type === "buff") return "↑";
  if (type === "nerf") return "↓";
  if (type === "rework") return "◆";
  return "●";
}

function recentChangeIcon(changes) {
  const primary = toArray(changes)[0]?.type || "adjust";
  return patchTypeIcon(primary);
}

function createCornerBadge(text, className) {
  const badge = create("span", `corner-badge ${className}`);
  badge.textContent = text;
  return badge;
}

function getLatestChanges(heroId) {
  return state.patches.latestChangesByHero.get(heroId) || [];
}

function getLatestHero() {
  return state.byId.get(state.patches.meta.latestHero) || null;
}

function getLatestTimelineItem(heroId) {
  return state.patches.timeline.find((item) => item.hero === heroId) || null;
}

function heroName(heroId) {
  const hero = state.byId.get(heroId);
  return hero ? `${hero.nameZh} ${hero.name}` : heroId;
}

function appendText(parent, tagName, text) {
  const node = document.createElement(tagName);
  node.textContent = fallback(text);
  parent.append(node);
  return node;
}

function create(tagName, className = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function countryFlag(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return "🏳";
  return [...value].map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397)).join("");
}

function numText(value, digits) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "0";
}

function formatScore(score) {
  const value = Number(score) || 0;
  return value > 0 ? `+${value}` : String(value);
}
