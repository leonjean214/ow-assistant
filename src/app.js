import { BAN_LABELS, DEPTH_LABELS, PATCH_TYPE_LABELS, ROLE_LABELS, fallback, findHeroId, loadCounterNotes, loadHeroData, loadMapMeta, loadPatches, loadWorkshop, toArray } from "./data.js";
import { recommend, scoreHeroAgainstEnemies } from "./counter.js";
import { debounce, friendlyApiError, getMaps, getStatsSummary, getSummary, searchPlayers } from "./api.js";
import { buildPerformanceCards, formatDuration, formatRank, normalizeHeroStats, sortHeroStats, summarizeRoles } from "./stats.js";
import { recommendHeroes } from "./recommend-hero.js";
import { addJournalEntry, clearJournal, loadJournal, mergeJournal, parseImportedJournal, removeJournalEntry, saveJournal, serializeJournal, summarizeJournal } from "./journal.js";
import { analyzeTeam, teamArchetype, teamRoleCount, ROLE_ZH as TEAM_ROLE_ZH } from "./team.js";
import { loadProfile, saveProfile, localOverview, exportAllLocal, parseBackup, importAllLocal, clearAllLocal, ROLE_OPTIONS } from "./profile.js";

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
const HERO_VIEW_KEY = "ow-hero-view";
const DEFAULT_PLATFORM_KEY = "ow-default-platform";
const THEME_KEY = "ow-theme";
const APP_VERSION = "1.0";
const DEFAULT_VIEW = "heroes";
const HERO_ROUTE_PREFIX = "#/hero/";
const COMPARE_ROUTE_PREFIX = "#/compare/";
const MAX_COMPARE = 4;
const TEAM_KEY = "ow-team";
const TEAM_ROUTE_PREFIX = "#/team/";
const MAX_TEAM = 5;
const META_STRONG_LIMIT = 6;
const COMMAND_RESULT_LIMIT = 20;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const state = {
  meta: {},
  heroes: [],
  byId: new Map(),
  heroView: "grid",
  filters: { role: "all", tier: "all", ban: "all", search: "", favoritesOnly: false, sort: "default", tags: [], tagsMatchAll: false },
  matrixFilter: { role: "all", search: "" },
  favorites: new Set(),
  compare: [],
  compareMessage: "",
  team: [],
  teamMessage: "",
  workshop: { meta: {}, categories: [] },
  counterNotes: new Map(),
  profile: { nickname: "", battletag: "", mainRole: "", avatarHeroId: "" },
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
  patchFilters: { role: "all", type: "all", search: "" },
  journalEntries: [],
  journalResult: "win"
};

const el = {};
let isRouting = false;
let overlayMode = false;
let activeDetailHeroId = "";
let routeViews = new Set();
let previousDetailFocus = null;
let previousCommandFocus = null;
let commandResults = [];
let selectedCommandIndex = 0;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

async function init() {
  bindElements();
  setupA11y();
  state.platform = loadDefaultPlatform();
  syncPlatformControls();
  bindEvents();
  state.favorites = loadFavorites();
  state.heroView = loadHeroView();
  try {
    const [data, mapMeta, patches, workshop, counterNotes] = await Promise.all([loadHeroData(), loadMapMeta(), loadPatches(), loadWorkshop(), loadCounterNotes()]);
    state.meta = data.meta || {};
    state.heroes = data.heroes;
    state.byId = data.byId;
    state.compare = loadCompare();
    state.team = loadTeam();
    state.mapMeta = mapMeta;
    state.patches = patches;
    state.workshop = workshop;
    state.counterNotes = counterNotes;
    state.profile = loadProfile();
    state.journalEntries = loadJournal();
    renderMetaText(data.meta);
    renderLatestHeroLine();
    renderTagFilters();
    renderRecommendControls();
    renderHeroRecommendations();
    renderCurrentHeroOptions();
    renderJournalOptions();
    renderHeroGrid();
    renderCompareTray();
    renderCompareView();
    renderTeam();
    renderWorkshop();
    renderMe();
    renderUpdates();
    renderEnemyChips();
    renderCounter();
    renderBanList();
    renderMetaDashboard();
    renderRecentPlayers();
    renderJournal();
    applyOverlayMode();
    initRouter();
  } catch (error) {
    console.warn(error);
    el.dataMeta.textContent = "数据加载失败，请确认使用 http.server 从项目根目录打开。";
    el.heroEmpty.hidden = false;
    el.heroEmpty.textContent = "无法加载 data/heroes.json。";
  }
}

function bindElements() {
  for (const id of [
    "dataMeta", "heroCount", "heroGrid", "heroEmpty", "roleTabs", "tierFilter", "banFilter", "heroSortFilter", "searchInput",
    "heroViewToggle", "favoriteOnlyToggle", "heroTagFilters", "tagMatchToggle", "clearTagFilters",
    "cmdOpen", "cmdPalette", "cmdDialog", "cmdInput", "cmdResults", "cmdEmpty", "cmdClose",
    "compareTray", "compareContent", "compareCount",
    "matrixRoleTabs", "matrixSearchInput", "matrixContent", "matrixCount",
    "teamContent", "teamCount", "workshopContent", "meContent",
    "settingsContent", "themeToggle",
    "latestHeroLine", "updatesTimeline", "patchRoleFilter", "patchTypeFilter", "patchSearchInput", "patchList", "patchEmpty",
    "heroRecommendPanel", "recommendRole", "recommendDifficulty", "recommendDifficultyLabel", "recommendTag", "recommendResults",
    "enemyInput", "currentHeroSelect", "runCounter", "clearCounter", "selectedEnemies", "enemyChips", "counterResults",
    "banList", "banCount", "detailDrawer", "detailDialog", "drawerScrim", "closeDrawer", "detailContent",
    "profileStatus", "playerSearchInput", "platformTabs", "recentPlayers", "playerSearchState", "playerResults", "playerProfile",
    "journalCount", "journalForm", "journalResultGroup", "journalHeroSelect", "journalMapSelect", "journalEnemyNote", "journalNote",
    "saveJournal", "clearJournal", "exportJournal", "importJournal", "replaceJournalToggle", "shareJournal", "journalImportFile", "journalShareCanvas",
    "journalStatus", "journalSummary", "journalHeroTable", "journalMapTable", "journalList", "journalEmpty",
    "mapCount", "mapModeTabs", "mapsState", "mapsGrid", "mapDetail", "metaView", "metaSeasonNote", "metaStrongList", "tierGrid", "banBoard", "rolePassives",
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
  const tablist = document.querySelector(".view-tabs");
  if (tablist) tablist.addEventListener("keydown", handleViewTabKeydown);

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
  el.heroSortFilter.addEventListener("change", () => {
    setHeroSort(el.heroSortFilter.value);
    renderHeroGrid();
  });
  el.heroViewToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-hero-view]");
    if (!button || button.dataset.heroView === state.heroView) return;
    setHeroView(button.dataset.heroView);
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
  el.heroTagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-hero-tag]");
    if (!button) return;
    toggleHeroTagFilter(button.dataset.heroTag);
  });
  el.tagMatchToggle.addEventListener("click", () => {
    state.filters.tagsMatchAll = !state.filters.tagsMatchAll;
    syncTagFilterControls();
    renderHeroGrid();
  });
  el.clearTagFilters.addEventListener("click", () => {
    state.filters.tags = [];
    syncTagFilterControls();
    renderHeroGrid();
  });
  el.matrixRoleTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-matrix-role]");
    if (!button) return;
    state.matrixFilter.role = button.dataset.matrixRole;
    syncMatrixRoleTabs();
    renderMatrix();
  });
  el.matrixSearchInput.addEventListener("input", () => {
    state.matrixFilter.search = el.matrixSearchInput.value.trim().toLowerCase();
    renderMatrix();
  });
  el.matrixContent.addEventListener("click", (event) => {
    const jump = event.target.closest("button[data-jump-hero]");
    if (jump) {
      openDetail(jump.dataset.jumpHero);
      return;
    }
    const title = event.target.closest("button[data-matrix-hero]");
    if (title) openDetail(title.dataset.matrixHero);
  });
  if (el.metaView) el.metaView.addEventListener("click", (event) => {
    const jump = event.target.closest("button[data-jump-hero]");
    if (jump) openDetail(jump.dataset.jumpHero);
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
    const sortButton = event.target.closest("button[data-hero-list-sort]");
    if (sortButton) {
      setHeroSort(nextHeroListSort(sortButton.dataset.heroListSort));
      renderHeroGrid();
      return;
    }
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
    const teamButton = event.target.closest("button[data-team-hero]");
    if (teamButton) {
      toggleTeam(teamButton.dataset.teamHero);
      return;
    }
    const card = event.target.closest("[data-hero-id]");
    if (card) openDetail(card.dataset.heroId);
  });
  el.heroGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".hero-card[data-hero-id]");
    const row = event.target.closest(".hero-list-row[data-hero-id]");
    if ((!card || event.target !== card) && (!row || event.target !== row)) return;
    event.preventDefault();
    openDetail((card || row).dataset.heroId);
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
    const teamButton = event.target.closest("button[data-team-hero]");
    if (teamButton) {
      toggleTeam(teamButton.dataset.teamHero);
      return;
    }
    const shareButton = event.target.closest("button[data-share-hero]");
    if (shareButton) {
      shareHeroCard(shareButton.dataset.shareHero);
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
  el.teamContent.addEventListener("click", (event) => {
    const remove = event.target.closest("button[data-remove-team]");
    if (remove) {
      removeFromTeam(remove.dataset.removeTeam);
      return;
    }
    if (event.target.closest("button[data-clear-team]")) {
      clearTeam();
      return;
    }
    if (event.target.closest("button[data-team-to-counter]")) {
      teamThreatsToCounter();
      return;
    }
    const jump = event.target.closest("button[data-jump-hero]");
    if (jump) openDetail(jump.dataset.jumpHero);
  });
  if (el.workshopContent) el.workshopContent.addEventListener("click", (event) => {
    const copy = event.target.closest("button[data-copy-code]");
    if (copy) copyWorkshopCode(copy.dataset.copyCode, copy);
  });
  if (el.cmdOpen) el.cmdOpen.addEventListener("click", () => openCommandPalette(el.cmdOpen));
  if (el.cmdInput) {
    el.cmdInput.addEventListener("input", () => renderCommandResults(el.cmdInput.value));
  }
  if (el.cmdResults) {
    el.cmdResults.addEventListener("click", (event) => {
      const item = event.target.closest("[data-command-index]");
      if (!item) return;
      executeCommandResult(Number(item.dataset.commandIndex));
    });
    el.cmdResults.addEventListener("mousemove", (event) => {
      const item = event.target.closest("[data-command-index]");
      if (item) selectCommandResult(Number(item.dataset.commandIndex));
    });
  }
  if (el.cmdClose) el.cmdClose.addEventListener("click", () => closeCommandPalette());
  if (el.cmdPalette) {
    el.cmdPalette.addEventListener("click", (event) => {
      if (event.target.closest("[data-cmd-close]")) closeCommandPalette();
    });
  }
  el.closeDrawer.addEventListener("click", closeDetail);
  el.drawerScrim.addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (isCommandShortcut(event)) {
      if (!overlayMode) {
        event.preventDefault();
        openCommandPalette(event.target);
      }
      return;
    }
    if (isCommandPaletteOpen()) {
      if (handleCommandPaletteKeydown(event)) return;
    }
    if (event.key === "Escape") closeDetail();
    if (event.key === "Tab") trapDrawerFocus(event);
    // 全局快捷键：仅在非输入态、无修饰键、抽屉未开、非 overlay 时生效
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTypingTarget(event.target) || overlayMode) return;
    if (el.detailDrawer.classList.contains("is-open")) return;
    if (event.key === "/") {
      event.preventDefault();
      switchView("profile");
      window.requestAnimationFrame(() => el.playerSearchInput?.focus());
    } else if (event.key === "b" || event.key === "B") {
      event.preventDefault();
      switchView("heroes");
      window.requestAnimationFrame(() => el.searchInput?.focus());
    }
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
  // Overwolf/Win 浮层消息桥（W1 SPA 侧）：overlay.html 把 GEP→干净 schema 后发来。
  window.addEventListener("message", handleOverlayMessage);
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
    setPlatform(button.dataset.platform);
  });

  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      window.setTimeout(() => {
        syncSettingsThemeControls();
        announceSettings(`已切换为${currentTheme() === "dark" ? "深色" : "浅色"}主题`);
      }, 0);
    });
  }

  if (el.settingsContent) {
    el.settingsContent.addEventListener("click", handleSettingsClick);
  }

  el.journalResultGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-journal-result]");
    if (!button) return;
    setJournalResult(button.dataset.journalResult);
  });
  el.journalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveJournalForm();
  });
  el.clearJournal.addEventListener("click", () => {
    if (!state.journalEntries.length) return;
    if (!window.confirm("确定清空全部对局记录？此操作不可撤销。")) return;
    state.journalEntries = clearJournal();
    renderJournal("已清空全部记录。");
  });
  el.exportJournal.addEventListener("click", exportJournalFile);
  el.importJournal.addEventListener("click", () => {
    if (el.journalImportFile) {
      el.journalImportFile.value = "";
      el.journalImportFile.click();
    }
  });
  el.journalImportFile.addEventListener("change", importJournalFile);
  el.shareJournal.addEventListener("click", shareJournalCard);
  el.journalList.addEventListener("click", (event) => {
    const remove = event.target.closest("button[data-journal-delete]");
    if (remove) {
      state.journalEntries = removeJournalEntry(state.journalEntries, remove.dataset.journalDelete);
      renderJournal("已删除 1 条记录。");
      return;
    }
    const hero = event.target.closest("button[data-journal-hero]");
    if (hero) openDetail(hero.dataset.journalHero);
  });
  el.journalHeroTable.addEventListener("click", (event) => {
    const hero = event.target.closest("button[data-journal-hero]");
    if (hero) openDetail(hero.dataset.journalHero);
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

function setupA11y() {
  setupNavigationA11y();
  if (el.detailDrawer) {
    el.detailDrawer.inert = true;
    el.detailDrawer.setAttribute("aria-hidden", "true");
  }
  if (el.cmdPalette) {
    el.cmdPalette.setAttribute("aria-hidden", "true");
  }
  [
    [el.counterResults, "polite"],
    [el.selectedEnemies, "polite"],
    [el.playerSearchState, "polite"],
    [el.mapsState, "polite"],
    [el.compareContent, "polite"],
    [el.matrixContent, "polite"],
    [el.teamContent, "polite"],
    [el.workshopContent, "polite"],
    [el.meContent, "polite"],
    [el.recommendResults, "polite"],
    [el.patchList, "polite"],
    [el.journalStatus, "polite"],
    [el.journalSummary, "polite"]
  ].forEach(([node, politeness]) => {
    if (node) node.setAttribute("aria-live", politeness);
  });
}

function setupNavigationA11y() {
  document.querySelectorAll(".view-tab[data-view]").forEach((button) => {
    const view = button.dataset.view;
    const panel = document.getElementById(`${view}View`);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `${view}View`);
    if (!button.id) button.id = `${view}Tab`;
    if (panel) {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.tabIndex = -1;
    }
  });
  syncNavigationA11y();
}

function syncNavigationA11y() {
  document.querySelectorAll(".view-tab[data-view]").forEach((button) => {
    const active = button.dataset.view === state.currentView;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function handleViewTabKeydown(event) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = [...document.querySelectorAll(".view-tab[data-view]")];
  const currentIndex = tabs.indexOf(event.target.closest(".view-tab"));
  if (currentIndex < 0) return;
  event.preventDefault();
  let nextIndex = currentIndex;
  if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = tabs.length - 1;
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  switchView(nextTab.dataset.view);
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

function renderJournalOptions() {
  el.journalHeroSelect.replaceChildren();
  const heroBlank = document.createElement("option");
  heroBlank.value = "";
  heroBlank.textContent = "选择英雄";
  el.journalHeroSelect.append(heroBlank);
  ["tank", "damage", "support"].forEach((role) => {
    const group = document.createElement("optgroup");
    group.label = roleNamesZh[role] || ROLE_LABELS[role] || role;
    state.heroes.filter((hero) => hero.role === role).forEach((hero) => {
      const option = document.createElement("option");
      option.value = hero.id;
      option.textContent = `${hero.nameZh} / ${hero.name}`;
      group.append(option);
    });
    el.journalHeroSelect.append(group);
  });

  el.journalMapSelect.replaceChildren();
  const mapBlank = document.createElement("option");
  mapBlank.value = "";
  mapBlank.textContent = "选择地图";
  el.journalMapSelect.append(mapBlank);
  localMapOptions().forEach((map) => {
    const option = document.createElement("option");
    option.value = map.key;
    option.textContent = map.mode ? `${map.name} · ${modeLabels[map.mode] || map.mode}` : map.name;
    option.dataset.mapName = map.name;
    el.journalMapSelect.append(option);
  });
}

function localMapOptions() {
  return [...state.mapMeta.entries()]
    .map(([key, meta]) => ({ key, name: fallback(meta.nameZh, key), mode: meta.mode && meta.mode !== "—" ? meta.mode : "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function setJournalResult(result) {
  if (!["win", "loss", "draw"].includes(result)) return;
  state.journalResult = result;
  el.journalResultGroup.querySelectorAll("button[data-journal-result]").forEach((button) => {
    const active = button.dataset.journalResult === result;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function saveJournalForm() {
  const hero = state.byId.get(el.journalHeroSelect.value);
  const mapOption = el.journalMapSelect.selectedOptions[0];
  const mapKey = el.journalMapSelect.value;
  if (!hero || !mapKey) {
    renderJournal("请选择英雄和地图后再保存。");
    return;
  }
  state.journalEntries = addJournalEntry(state.journalEntries, {
    id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    result: state.journalResult,
    heroId: hero.id,
    role: hero.role,
    mapKey,
    mapName: mapOption?.dataset.mapName || mapOption?.textContent || mapKey,
    enemyNote: el.journalEnemyNote.value,
    note: el.journalNote.value
  });
  el.journalForm.reset();
  setJournalResult("win");
  renderJournal("已保存本局记录。");
}

function renderJournal(message = "") {
  if (!el.journalSummary) return;
  const summary = summarizeJournal(state.journalEntries, state.byId);
  el.journalCount.textContent = `${summary.total.games} 局`;
  syncJournalToolState(summary.total.games);
  if (message) {
    el.journalStatus.textContent = message;
  } else {
    el.journalStatus.textContent = summary.total.games ? "胜率按 胜 / (胜 + 负) 计算，平局单列。" : "";
  }
  renderJournalSummary(summary);
  renderJournalHeroTable(summary.heroes);
  renderJournalMapTable(summary.maps);
  renderJournalList();
}

function syncJournalToolState(totalGames) {
  const disabled = totalGames === 0;
  if (el.exportJournal) el.exportJournal.disabled = disabled;
  if (el.shareJournal) el.shareJournal.disabled = disabled;
}

function exportJournalFile() {
  if (!state.journalEntries.length) {
    renderJournal("先记录几局再导出。");
    return;
  }
  const payload = serializeJournal(state.journalEntries);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `ow-journal-${dateFilePart()}.json`);
  renderJournal("已生成 JSON 导出文件。");
}

async function importJournalFile() {
  const file = el.journalImportFile?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseImportedJournal(text);
    if (parsed.error) {
      renderJournal(`导入失败：${parsed.error}`);
      return;
    }
    const replaceAll = Boolean(el.replaceJournalToggle?.checked);
    if (replaceAll && state.journalEntries.length && !window.confirm("确定用导入文件替换全部本地记录？")) {
      renderJournal("已取消导入。");
      return;
    }
    state.journalEntries = replaceAll
      ? saveJournal(parsed.entries)
      : saveJournal(mergeJournal(state.journalEntries, parsed.entries));
    renderJournal(`导入 ${parsed.entries.length} 条，去重后共 ${state.journalEntries.length} 条。`);
  } catch {
    renderJournal("导入失败：无法读取这个文件。");
  } finally {
    if (el.journalImportFile) el.journalImportFile.value = "";
  }
}

async function shareJournalCard() {
  if (!state.journalEntries.length) {
    renderJournal("先记录几局再分享。");
    return;
  }
  try {
    const canvas = el.journalShareCanvas;
    drawJournalShareCard(canvas, summarizeJournal(state.journalEntries, state.byId));
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `ow-journal-share-${dateFilePart()}.png`);
    const copied = await copyBlobToClipboard(blob);
    renderJournal(copied ? "已生成分享图，并尝试复制到剪贴板。" : "已生成分享图，当前浏览器未允许复制图片。");
  } catch {
    renderJournal("生成分享图失败，请稍后重试。");
  }
}

async function shareHeroCard(heroId = activeDetailHeroId) {
  const hero = state.byId.get(heroId);
  if (!hero) {
    announceHeroShare("没有找到要分享的英雄。");
    return;
  }
  announceHeroShare("正在生成分享图...");
  try {
    const canvas = document.createElement("canvas");
    drawHeroShareCard(canvas, hero);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `ow-hero-${hero.id}-${dateFilePart()}.png`);
    const copied = await copyBlobToClipboard(blob);
    announceHeroShare(copied ? "已生成 PNG，并尝试复制到剪贴板。" : "已生成 PNG，当前浏览器未允许复制图片。");
  } catch {
    announceHeroShare("生成分享图失败，请稍后重试。");
  }
}

function drawHeroShareCard(canvas, hero) {
  const width = 1080;
  const height = 1350;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = shareCardColors();
  const roleColor = colors[hero.role] || colors.primary;
  const totalHealth = heroHealthTotal(hero);
  const ultimateName = formatShareAbilityName(hero.abilities?.ultimate);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.surface;
  roundRect(ctx, 54, 54, 972, 1242, 34);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = colors.surface2;
  roundRect(ctx, 96, 106, 168, 168, 34);
  ctx.fill();
  ctx.fillStyle = roleColor;
  roundRect(ctx, 112, 122, 136, 136, 28);
  ctx.fill();
  ctx.fillStyle = colors.onAccent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = shareFont(72, 900);
  ctx.fillText((hero.nameZh || hero.name || "?").slice(0, 1).toUpperCase(), 180, 190);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = colors.primary;
  ctx.font = shareFont(28, 900);
  ctx.fillText("OW 助手 · Hero Card", 304, 132);
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(58, 900);
  drawWrappedText(ctx, `${hero.nameZh} / ${hero.name}`, 304, 206, 630, 64, 2);
  drawSharePill(ctx, colors, 304, 244, ROLE_LABELS[hero.role] || hero.role, roleColor);
  drawSharePill(ctx, colors, 454, 244, fallback(hero.subrole), colors.surface3, colors.text);
  drawSharePill(ctx, colors, 650, 244, `Tier ${fallback(hero.tier)}`, tierShareColor(hero.tier, colors), colors.onAccent);

  drawShareMetric(ctx, colors, 96, 334, 254, 160, "难度", hero.difficulty ? `${hero.difficulty}/5` : "-", "上手门槛");
  drawShareMetric(ctx, colors, 388, 334, 254, 160, "总有效生命", `${totalHealth || "-"}`, `HP ${hero.health?.hp || 0} / 甲 ${hero.health?.armor || 0} / 盾 ${hero.health?.shield || 0}`);
  drawShareMetric(ctx, colors, 680, 334, 254, 160, "职业定位", ROLE_LABELS[hero.role] || hero.role, fallback(hero.subrole));

  drawShareSectionTitle(ctx, colors, "代表标签", 96, 580);
  const tags = toArray(hero.tags).slice(0, 6);
  if (!tags.length) {
    drawSharePill(ctx, colors, 96, 618, "暂无标签", colors.surface3, colors.text2);
  } else {
    let x = 96;
    let y = 618;
    tags.forEach((tag) => {
      const pillWidth = Math.min(258, Math.max(112, ctx.measureText(tag).width + 48));
      if (x + pillWidth > 934) {
        x = 96;
        y += 62;
      }
      drawSharePill(ctx, colors, x, y, tag, colors.surface3, colors.text);
      x += pillWidth + 16;
    });
  }

  drawShareSectionTitle(ctx, colors, "大招", 96, 800);
  ctx.fillStyle = colors.surface2;
  roundRect(ctx, 96, 830, 838, 102, 22);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(32, 900);
  drawWrappedText(ctx, ultimateName || "暂无大招数据", 128, 890, 774, 38, 2);

  drawShareSectionTitle(ctx, colors, "克制速览", 96, 1012);
  drawHeroShareCounters(ctx, colors, hero, 96, 1050, "我克制 Top3", "strongAgainst", colors.good);
  drawHeroShareCounters(ctx, colors, hero, 550, 1050, "我怕 Top3", "weakAgainst", colors.loss);

  ctx.fillStyle = colors.text3;
  ctx.font = shareFont(22, 700);
  ctx.fillText("OW 助手 · github.com/leonjean214/ow-assistant", 96, 1240);
}

function drawJournalShareCard(canvas, summary) {
  const width = 1080;
  const height = 1350;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = shareCardColors();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.surface;
  roundRect(ctx, 54, 54, 972, 1242, 34);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = colors.primary;
  ctx.font = shareFont(30, 900);
  ctx.fillText("OW 助手 · Session Journal", 96, 118);
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(64, 900);
  ctx.fillText("我的守望先锋战绩", 96, 198);
  ctx.fillStyle = colors.text2;
  ctx.font = shareFont(28, 700);
  ctx.fillText(`S16 · ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date())}`, 96, 252);

  drawShareMetric(ctx, colors, 96, 320, 410, 220, "总场次", `${summary.total.games}`, `胜 ${summary.total.wins} / 负 ${summary.total.losses} / 平 ${summary.total.draws}`);
  drawShareMetric(ctx, colors, 574, 320, 356, 220, "总胜率", percentText(summary.total), "胜 / (胜 + 负)");
  drawShareMetric(ctx, colors, 96, 586, 410, 168, "今日", `${summary.today.games} 局 · ${percentText(summary.today)}`, `胜 ${summary.today.wins} / 负 ${summary.today.losses}`);
  drawShareMetric(ctx, colors, 574, 586, 356, 168, "当前趋势", summary.streak.label, "从最近一局往前");

  ctx.fillStyle = colors.text;
  ctx.font = shareFont(34, 900);
  ctx.fillText("最近 10 局", 96, 835);
  const trend = summary.recent.length ? summary.recent : [];
  for (let index = 0; index < 10; index += 1) {
    const item = trend[index];
    const x = 96 + index * 88;
    const y = 870;
    ctx.fillStyle = item ? resultColor(item.result, colors) : colors.surface3;
    roundRect(ctx, x, y, 62, 62, 14);
    ctx.fill();
    ctx.fillStyle = item ? colors.onAccent : colors.text3;
    ctx.font = shareFont(24, 900);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item?.code || "·", x + 31, y + 31);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.fillStyle = colors.text;
  ctx.font = shareFont(34, 900);
  ctx.fillText("Top 英雄", 96, 1030);
  const heroes = summary.heroes.slice(0, 3);
  if (!heroes.length) {
    ctx.fillStyle = colors.text2;
    ctx.font = shareFont(28, 700);
    ctx.fillText("暂无英雄趋势", 96, 1092);
  }
  heroes.forEach((hero, index) => {
    const y = 1078 + index * 72;
    ctx.fillStyle = colors.surface2;
    roundRect(ctx, 96, y - 42, 838, 54, 14);
    ctx.fill();
    ctx.fillStyle = colors.primary;
    ctx.font = shareFont(24, 900);
    ctx.fillText(`#${index + 1}`, 122, y - 6);
    ctx.fillStyle = colors.text;
    ctx.font = shareFont(28, 900);
    ctx.fillText(hero.nameZh || hero.name || hero.heroId, 190, y - 6);
    ctx.fillStyle = colors.text2;
    ctx.font = shareFont(24, 800);
    ctx.fillText(`${hero.games} 局 · ${percentText(hero)}`, 702, y - 6);
  });

  ctx.fillStyle = colors.text3;
  ctx.font = shareFont(22, 700);
  ctx.fillText("本图完全在本地浏览器生成", 96, 1240);
}

function drawShareMetric(ctx, colors, x, y, width, height, label, value, note) {
  ctx.fillStyle = colors.surface2;
  roundRect(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.fillStyle = colors.text2;
  ctx.font = shareFont(24, 800);
  ctx.fillText(label, x + 32, y + 52);
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(value.length > 8 ? 42 : 58, 900);
  ctx.fillText(value, x + 32, y + 126);
  ctx.fillStyle = colors.text3;
  ctx.font = shareFont(22, 700);
  ctx.fillText(note, x + 32, y + height - 34);
}

function shareCardColors() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name, fallbackColor) => styles.getPropertyValue(name).trim() || fallbackColor;
  return {
    bg: token("--bg", "#F2F3F7"),
    surface: token("--surface", "#FFFFFF"),
    surface2: token("--surface-2", "#F7F8FA"),
    surface3: token("--surface-3", "#EEF1F6"),
    border: token("--border", "#E2E4EB"),
    text: token("--text", "#202126"),
    text2: token("--text-2", "#6E7178"),
    text3: token("--text-3", "#9AA0A6"),
    primary: token("--primary", "#2F63D7"),
    win: token("--win", "#275DCE"),
    loss: token("--loss", "#D52D44"),
    good: token("--good", "#137A43"),
    warn: token("--warn", "#9A6400"),
    tank: token("--tank", "#A85516"),
    damage: token("--damage", "#D52D44"),
    support: token("--support", "#137A43"),
    tierS: token("--tier-s", "#D52D44"),
    tierA: token("--tier-a", "#A85516"),
    tierB: token("--tier-b", "#137A43"),
    tierC: token("--tier-c", "#666C75"),
    onAccent: "#FFFFFF"
  };
}

function drawShareSectionTitle(ctx, colors, title, x, y) {
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(34, 900);
  ctx.fillText(title, x, y);
}

function drawSharePill(ctx, colors, x, y, text, bg, textColor = colors.onAccent) {
  const label = fallback(text);
  ctx.font = shareFont(24, 900);
  const width = Math.min(280, Math.max(112, ctx.measureText(label).width + 48));
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, width, 44, 22);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.fillText(label, x + 24, y + 30);
  return width;
}

function drawHeroShareCounters(ctx, colors, hero, x, y, title, key, color) {
  ctx.fillStyle = colors.surface2;
  roundRect(ctx, x, y, 384, 150, 22);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = shareFont(24, 900);
  ctx.fillText(title, x + 28, y + 44);
  const names = toArray(hero.counters?.[key]).slice(0, 3).map((id) => state.byId.get(id)?.nameZh || id);
  ctx.fillStyle = colors.text;
  ctx.font = shareFont(30, 900);
  drawWrappedText(ctx, names.length ? names.join(" / ") : "暂无", x + 28, y + 94, 328, 36, 2);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(fallback(text)).split("");
  let line = "";
  let lineCount = 0;
  for (const char of words) {
    const test = line + char;
    if (line && ctx.measureText(test).width > maxWidth) {
      lineCount += 1;
      const suffix = lineCount === maxLines ? "..." : "";
      ctx.fillText(suffix ? trimTextToWidth(ctx, line, maxWidth - ctx.measureText(suffix).width) + suffix : line, x, y);
      if (lineCount >= maxLines) return;
      line = char;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y);
}

function trimTextToWidth(ctx, text, maxWidth) {
  let value = String(text);
  while (value && ctx.measureText(value).width > maxWidth) value = value.slice(0, -1);
  return value;
}

function tierShareColor(tier, colors) {
  const value = String(tier || "").toUpperCase();
  if (value === "S") return colors.tierS;
  if (value === "A") return colors.tierA;
  if (value === "B") return colors.tierB;
  if (value === "C") return colors.tierC;
  return colors.text3;
}

function heroHealthTotal(hero) {
  return (Number(hero.health?.hp) || 0) + (Number(hero.health?.armor) || 0) + (Number(hero.health?.shield) || 0);
}

function formatShareAbilityName(ability = {}) {
  return [ability.nameZh, ability.name].filter(Boolean).join(" / ");
}

function announceHeroShare(message) {
  const status = el.detailContent?.querySelector("[data-hero-share-status]");
  if (status) status.textContent = message;
}

function resultColor(result, colors) {
  if (result === "win") return colors.win;
  if (result === "loss") return colors.loss;
  return colors.text3;
}

function shareFont(size, weight) {
  return `${weight} ${size}px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("canvas toBlob failed"));
      }
    }, "image/png");
  });
}

async function copyBlobToClipboard(blob) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function dateFilePart(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderJournalSummary(summary) {
  el.journalSummary.replaceChildren();
  el.journalSummary.append(
    createJournalMetric("总场次", `${summary.total.games}`, `胜 ${summary.total.wins} / 负 ${summary.total.losses} / 平 ${summary.total.draws}`),
    createJournalMetric("总胜率", percentText(summary.total), "平局不计入分母"),
    createJournalMetric("今日", `${summary.today.games} 局 · ${percentText(summary.today)}`, `胜 ${summary.today.wins} / 负 ${summary.today.losses}`),
    createJournalMetric("当前趋势", summary.streak.label, "从最近一局往前计算"),
    createRecentTrend(summary.recent)
  );
}

function createJournalMetric(label, value, note) {
  const card = create("div", "metric journal-metric");
  appendText(card, "span", label);
  appendText(card, "strong", value);
  appendText(card, "small", note);
  return card;
}

function createRecentTrend(recent) {
  const card = create("div", "metric journal-metric journal-trend-card");
  appendText(card, "span", "最近 10 局");
  const row = create("div", "journal-trend");
  if (!recent.length) {
    row.append(textBadge("暂无记录"));
  } else {
    recent.forEach((entry) => {
      const mark = create("span", `trend-dot result-${entry.result}`);
      mark.textContent = entry.code;
      mark.title = entry.label;
      row.append(mark);
    });
  }
  card.append(row);
  appendText(card, "small", "左侧为最近一局");
  return card;
}

function renderJournalHeroTable(rows) {
  el.journalHeroTable.replaceChildren();
  if (!rows.length) {
    el.journalHeroTable.append(journalEmptyText("暂无英雄趋势。"));
    return;
  }
  const table = createJournalStatsTable("英雄胜率趋势表", ["英雄", "场次", "胜率", "胜", "负", "平"]);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => tbody.append(createJournalHeroRow(row)));
  table.append(tbody);
  el.journalHeroTable.append(table);
}

function renderJournalMapTable(rows) {
  el.journalMapTable.replaceChildren();
  if (!rows.length) {
    el.journalMapTable.append(journalEmptyText("暂无地图趋势。"));
    return;
  }
  const table = createJournalStatsTable("地图胜率趋势表", ["地图", "场次", "胜率", "胜", "负", "平"]);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => tbody.append(createJournalMapRow(row)));
  table.append(tbody);
  el.journalMapTable.append(table);
}

function createJournalStatsTable(captionText, headings) {
  const table = create("table", "stats-table journal-table");
  const caption = create("caption", "sr-only");
  caption.textContent = captionText;
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  headings.forEach((heading) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = heading;
    tr.append(th);
  });
  thead.append(tr);
  table.append(caption, thead);
  return table;
}

function createJournalHeroRow(row) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  const button = create("button", "stat-hero");
  button.type = "button";
  button.dataset.journalHero = row.heroId;
  if (row.hero) button.append(createAvatar(row.hero));
  const name = create("span");
  name.textContent = row.nameZh;
  button.append(name);
  th.append(button);
  tr.append(th);
  appendJournalCells(tr, row);
  return tr;
}

function createJournalMapRow(row) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = row.mapName;
  tr.append(th);
  appendJournalCells(tr, row);
  return tr;
}

function appendJournalCells(tr, row) {
  appendCell(tr, row.games);
  appendCell(tr, percentText(row), winrateClass(row.winrate));
  appendCell(tr, row.wins, "good");
  appendCell(tr, row.losses, "bad");
  appendCell(tr, row.draws);
}

function renderJournalList() {
  el.journalList.replaceChildren();
  el.journalEmpty.hidden = state.journalEntries.length !== 0;
  state.journalEntries.forEach((entry) => el.journalList.append(createJournalEntryRow(entry)));
}

function createJournalEntryRow(entry) {
  const hero = state.byId.get(entry.heroId);
  const item = create("article", `journal-entry result-${entry.result}`);
  const result = createBadge(resultLabel(entry.result), `journal-result-badge result-${entry.result}`);
  const heroButton = create("button", "stat-hero journal-entry-hero");
  heroButton.type = "button";
  heroButton.dataset.journalHero = entry.heroId;
  if (hero) heroButton.append(createAvatar(hero));
  const heroNameNode = create("span");
  heroNameNode.textContent = hero?.nameZh || entry.heroId;
  heroButton.append(heroNameNode);

  const body = create("div", "journal-entry-body");
  const title = create("div", "journal-entry-title");
  title.append(result, heroButton);
  body.append(title);
  const meta = create("div", "hero-meta");
  meta.append(textBadge(formatJournalDate(entry.ts)), textBadge(entry.mapName || entry.mapKey || "未知地图"));
  if (entry.role) meta.append(textBadge(ROLE_LABELS[entry.role] || entry.role));
  body.append(meta);
  if (entry.enemyNote) appendText(body, "p", `敌方：${entry.enemyNote}`);
  if (entry.note) appendText(body, "p", entry.note);

  const remove = create("button", "icon-btn journal-delete");
  remove.type = "button";
  remove.dataset.journalDelete = entry.id;
  remove.setAttribute("aria-label", `删除 ${formatJournalDate(entry.ts)} 的记录`);
  remove.textContent = "×";
  item.append(body, remove);
  return item;
}

function journalEmptyText(text) {
  const empty = create("p", "empty-state");
  empty.textContent = text;
  return empty;
}

function percentText(row) {
  return row.decided ? `${row.winrate.toFixed(1)}%` : "—";
}

function resultLabel(result) {
  if (result === "win") return "胜";
  if (result === "loss") return "负";
  return "平";
}

function formatJournalDate(ts) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
  if (view === "matrix") renderMatrix();
  if (view === "team") renderTeam();
  if (view === "workshop") renderWorkshop();
  if (view === "me") renderMe();
  if (view === "settings") renderSettings();
  if (view === "journal") renderJournal();
  activeDetailHeroId = "";
  if (!isRouting) closeDetailPanel();
  syncNavigationA11y();
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

    if (route.type === "team") {
      setTeam(route.heroIds, { sync: false, silent: true });
      switchView("team");
      activeDetailHeroId = "";
      closeDetailPanel();
      if (window.location.hash && route.invalid) replaceHash(teamHash());
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
  if (value.startsWith(TEAM_ROUTE_PREFIX)) {
    const rawIds = value.slice(TEAM_ROUTE_PREFIX.length).split(",").map((part) => safeDecode(part).trim()).filter(Boolean);
    const validIds = uniqueValidHeroIds(rawIds).slice(0, MAX_TEAM);
    return { type: "team", heroIds: validIds, invalid: rawIds.length !== validIds.length };
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

function isTypingTarget(node) {
  if (!(node instanceof Element)) return false;
  if (node.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
}

function isCommandShortcut(event) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
}

function isCommandPaletteOpen() {
  return Boolean(el.cmdPalette && !el.cmdPalette.hidden);
}

function openCommandPalette(trigger = document.activeElement) {
  if (overlayMode || !el.cmdPalette || !el.cmdInput || !el.cmdResults) return;
  if (el.detailDrawer?.classList.contains("is-open")) closeDetail();
  previousCommandFocus = trigger instanceof Element ? trigger : document.activeElement;
  el.cmdPalette.hidden = false;
  el.cmdPalette.setAttribute("aria-hidden", "false");
  setBackgroundInert(true);
  el.cmdInput.value = "";
  renderCommandResults("");
  window.requestAnimationFrame(() => {
    el.cmdInput.focus({ preventScroll: true });
    el.cmdInput.select();
  });
}

function closeCommandPalette({ restoreFocus = true } = {}) {
  if (!isCommandPaletteOpen()) return;
  el.cmdPalette.hidden = true;
  el.cmdPalette.setAttribute("aria-hidden", "true");
  el.cmdInput.removeAttribute("aria-activedescendant");
  commandResults = [];
  selectedCommandIndex = 0;
  setBackgroundInert(false);
  const target = restoreFocus && isFocusable(previousCommandFocus) ? previousCommandFocus : null;
  previousCommandFocus = null;
  if (target) {
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

function handleCommandPaletteKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    return true;
  }
  if (event.key === "Tab") {
    trapCommandPaletteFocus(event);
    return true;
  }
  if (!el.cmdPalette.contains(event.target)) return false;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveCommandSelection(1);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveCommandSelection(-1);
    return true;
  }
  if (event.key === "Home") {
    event.preventDefault();
    selectCommandResult(0);
    return true;
  }
  if (event.key === "End") {
    event.preventDefault();
    selectCommandResult(commandResults.length - 1);
    return true;
  }
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    executeCommandResult(selectedCommandIndex);
    return true;
  }
  return false;
}

function trapCommandPaletteFocus(event) {
  const focusables = focusableElements(el.cmdPalette);
  if (!focusables.length) {
    event.preventDefault();
    el.cmdDialog?.focus({ preventScroll: true });
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!el.cmdPalette.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

function moveCommandSelection(delta) {
  if (!commandResults.length) return;
  selectCommandResult((selectedCommandIndex + delta + commandResults.length) % commandResults.length);
}

function selectCommandResult(index) {
  if (!commandResults.length) {
    selectedCommandIndex = 0;
    el.cmdInput?.removeAttribute("aria-activedescendant");
    return;
  }
  selectedCommandIndex = Math.max(0, Math.min(index, commandResults.length - 1));
  el.cmdResults.querySelectorAll("[data-command-index]").forEach((node) => {
    const selected = Number(node.dataset.commandIndex) === selectedCommandIndex;
    node.classList.toggle("is-selected", selected);
    node.setAttribute("aria-selected", String(selected));
    if (selected) {
      el.cmdInput.setAttribute("aria-activedescendant", node.id);
      node.scrollIntoView({ block: "nearest" });
    }
  });
}

function renderCommandResults(query) {
  commandResults = commandMatch(query);
  selectedCommandIndex = 0;
  el.cmdResults.replaceChildren();
  el.cmdEmpty.hidden = commandResults.length > 0;
  commandResults.forEach((item, index) => {
    el.cmdResults.append(createCommandResult(item, index));
  });
  selectCommandResult(0);
}

function commandMatch(query) {
  const value = String(query || "").trim();
  const normalized = normalizeCommandText(value);
  if (!normalized) return defaultCommandResults();

  const results = [];
  state.heroes.forEach((hero) => {
    const score = commandScore(normalized, [hero.nameZh, hero.name, hero.id]);
    if (score === Infinity) return;
    results.push({
      type: "hero",
      heroId: hero.id,
      title: hero.nameZh || hero.name || hero.id,
      subtitle: `${hero.name || hero.id} · ${ROLE_LABELS[hero.role] || hero.role}`,
      role: hero.role,
      hero,
      score
    });
  });

  commandViewItems().forEach((view) => {
    const score = commandScore(normalized, [view.title, view.view]);
    if (score === Infinity) return;
    results.push({
      type: "view",
      view: view.view,
      title: view.title,
      subtitle: "切换视图",
      score: score + 4
    });
  });

  const ranked = results.sort(compareCommandResults).slice(0, COMMAND_RESULT_LIMIT);
  if (shouldOfferPlayerSearch(value, ranked)) {
    ranked.push({
      type: "player",
      title: `搜索玩家 “${value}”`,
      subtitle: "BattleTag 战绩查询",
      query: value,
      score: 90
    });
  }
  return ranked.slice(0, COMMAND_RESULT_LIMIT);
}

function defaultCommandResults() {
  const viewOrder = ["heroes", "profile", "matrix", "counter", "team", "meta", "maps", "settings"];
  const views = commandViewItems()
    .filter((item) => viewOrder.includes(item.view))
    .sort((a, b) => viewOrder.indexOf(a.view) - viewOrder.indexOf(b.view))
    .map((item, index) => ({
      type: "view",
      view: item.view,
      title: item.title,
      subtitle: "切换视图",
      score: index
    }));
  const heroes = state.heroes.slice(0, 6).map((hero, index) => ({
    type: "hero",
    heroId: hero.id,
    title: hero.nameZh || hero.name || hero.id,
    subtitle: `${hero.name || hero.id} · ${ROLE_LABELS[hero.role] || hero.role}`,
    role: hero.role,
    hero,
    score: 20 + index
  }));
  return [...views, ...heroes].slice(0, 12);
}

function commandViewItems() {
  return [...document.querySelectorAll(".view-tab[data-view]")].map((button) => ({
    view: button.dataset.view,
    title: button.textContent.trim() || button.dataset.view
  }));
}

function normalizeCommandText(value) {
  return String(value || "").trim().toLowerCase();
}

function commandScore(query, terms) {
  return terms.reduce((best, term) => {
    const value = normalizeCommandText(term);
    if (!value) return best;
    if (value === query) return Math.min(best, 0);
    if (value.startsWith(query)) return Math.min(best, 10 + value.length - query.length);
    const index = value.indexOf(query);
    if (index >= 0) return Math.min(best, 40 + index);
    return best;
  }, Infinity);
}

function compareCommandResults(a, b) {
  if (a.score !== b.score) return a.score - b.score;
  const rank = { hero: 0, view: 1, player: 2 };
  if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type];
  return a.title.localeCompare(b.title, "zh-Hans-CN");
}

function shouldOfferPlayerSearch(query, ranked) {
  const value = String(query || "").trim();
  if (!value || value.length > 32 || /\s/.test(value)) return false;
  if (value.includes("#")) return /^[^#\s]{2,24}#\d{2,8}$/.test(value);
  if (ranked.length) return false;
  return /^[\p{L}\p{N}_-]{2,32}$/u.test(value);
}

function createCommandResult(item, index) {
  const row = create("button", "cmd-result");
  row.type = "button";
  row.id = `cmdResult-${index}`;
  row.dataset.commandIndex = String(index);
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", "false");

  if (item.type === "hero") {
    row.append(createAvatar(item.hero));
  } else {
    const icon = create("span", `cmd-result-icon cmd-result-icon-${item.type}`);
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.type === "player" ? "#" : "⌘";
    row.append(icon);
  }

  const body = create("span", "cmd-result-body");
  appendText(body, "strong", item.title);
  appendText(body, "span", item.subtitle);
  const type = create("span", `cmd-result-type cmd-result-type-${item.type}`);
  type.textContent = commandTypeLabel(item);
  row.append(body, type);
  return row;
}

function commandTypeLabel(item) {
  if (item.type === "hero") return ROLE_LABELS[item.role] || "英雄";
  if (item.type === "view") return "视图";
  return "战绩";
}

function executeCommandResult(index) {
  const item = commandResults[index];
  if (!item) return;
  closeCommandPalette({ restoreFocus: false });
  if (item.type === "hero") {
    openDetail(item.heroId);
    return;
  }
  if (item.type === "view") {
    switchView(item.view);
    window.requestAnimationFrame(() => document.querySelector(`.view-tab[data-view="${CSS.escape(item.view)}"]`)?.focus({ preventScroll: true }));
    return;
  }
  if (item.type === "player") {
    lookupBattletag(item.query);
    window.requestAnimationFrame(() => el.playerSearchInput?.focus({ preventScroll: true }));
  }
}

// W1：处理 Overwolf overlay 中继来的对局消息（干净 schema，GEP→schema 翻译在 overlay.html）。
// schema: { source:"owgep", kind:"my-hero", heroId } | { kind:"enemies", heroIds:[...] }
function handleOverlayMessage(event) {
  const d = event?.data;
  if (!d || d.source !== "owgep") return;
  if (d.kind === "my-hero" && d.heroId != null) {
    const raw = String(d.heroId);
    const id = state.byId.has(raw) ? raw : findHeroId(raw, state.heroes);
    if (id && state.byId.has(id)) {
      state.currentHeroId = id;
      if (el.currentHeroSelect) el.currentHeroSelect.value = id;
      renderCounter();
    }
    return;
  }
  if (d.kind === "enemies" && Array.isArray(d.heroIds)) {
    const ids = uniqueValidHeroIds(d.heroIds).slice(0, 5);
    if (!ids.length) return;
    if (document.body.classList.contains("is-overlay")) {
      state.overlayEnemies = ids;
      renderOverlay();
    } else {
      state.selectedEnemies = ids;
      renderEnemyChips();
      renderCounter();
    }
  }
}

function viewHash(view) {
  if (view === "compare") return compareHash();
  if (view === "team") return teamHash();
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

function teamHash() {
  return state.team.length
    ? `${TEAM_ROUTE_PREFIX}${state.team.map((id) => encodeURIComponent(id)).join(",")}`
    : "#/team";
}

function syncHashForTeam(options = {}) {
  if (overlayMode || isRouting || state.currentView !== "team") return;
  const next = teamHash();
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
  const listMode = state.heroView === "list";
  syncHeroViewControls();
  syncHeroSortFilter();
  el.heroGrid.classList.toggle("hero-grid", !listMode);
  el.heroGrid.classList.toggle("hero-list-mount", listMode);
  el.heroCount.textContent = `${heroes.length} 位英雄`;
  el.heroEmpty.hidden = heroes.length !== 0;
  el.heroEmpty.textContent = state.filters.favoritesOnly && !state.favorites.size
    ? "还没有收藏英雄，点卡片右上角 ★ 添加"
    : state.filters.tags.length
      ? "没有符合条件的英雄，试试减少标签或清空筛选。"
      : "没有符合条件的英雄。";
  if (listMode) {
    renderHeroList(heroes);
    return;
  }
  for (const hero of heroes) el.heroGrid.append(createHeroCard(hero));
}

function renderHeroList(heroes) {
  if (!heroes.length) return;
  const wrap = create("div", "hero-list-wrap");
  const table = create("table", "hero-list-table");
  const caption = create("caption", "sr-only");
  caption.textContent = "英雄库列表";
  table.append(caption, createHeroListHead(), createHeroListBody(heroes));
  wrap.append(table);
  el.heroGrid.append(wrap);
}

function createHeroListHead() {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  [
    { label: "英雄", sort: "name" },
    { label: "职业" },
    { label: "Tier", sort: "tier" },
    { label: "难度", sort: "difficulty" },
    { label: "总有效生命", sort: "hp" },
    { label: "代表标签" },
    { label: "收藏" }
  ].forEach((column) => row.append(createHeroListHeader(column)));
  thead.append(row);
  return thead;
}

function createHeroListHeader(column) {
  const th = document.createElement("th");
  th.scope = "col";
  if (!column.sort) {
    th.textContent = column.label;
    return th;
  }
  th.setAttribute("aria-sort", heroListAriaSort(column.sort));
  const button = create("button", "hero-list-sort");
  button.type = "button";
  button.dataset.heroListSort = column.sort;
  button.textContent = column.label;
  th.append(button);
  return th;
}

function createHeroListBody(heroes) {
  const tbody = document.createElement("tbody");
  heroes.forEach((hero) => tbody.append(createHeroListRow(hero)));
  return tbody;
}

function createHeroListRow(hero) {
  const tr = create("tr", hero.id === state.patches.meta.latestHero ? "hero-list-row is-new-hero" : "hero-list-row");
  tr.dataset.heroId = hero.id;
  tr.tabIndex = 0;
  tr.setAttribute("aria-label", `${hero.nameZh} ${hero.name} 详情`);
  tr.append(
    createHeroListNameCell(hero),
    createHeroListTextCell(ROLE_LABELS[hero.role] || hero.role),
    createHeroListTierCell(hero),
    createHeroListNumberCell(hero.difficulty == null ? "—" : `${hero.difficulty}/5`, "difficulty"),
    createHeroListNumberCell(String(totalHealth(hero)), "health"),
    createHeroListTagsCell(hero),
    createHeroListFavoriteCell(hero)
  );
  return tr;
}

function createHeroListNameCell(hero) {
  const th = document.createElement("th");
  th.scope = "row";
  const body = create("div", "hero-list-name");
  body.append(createAvatar(hero));
  const names = create("span", "hero-list-names");
  appendText(names, "strong", hero.nameZh);
  appendText(names, "span", hero.name);
  body.append(names);
  th.append(body);
  return th;
}

function createHeroListTextCell(text) {
  const td = document.createElement("td");
  td.textContent = fallback(text);
  return td;
}

function createHeroListTierCell(hero) {
  const td = document.createElement("td");
  td.append(createBadge(hero.tier, "tier-badge"));
  return td;
}

function createHeroListNumberCell(text, className) {
  const td = create("td", `hero-list-number ${className}`);
  td.textContent = fallback(text);
  return td;
}

function createHeroListTagsCell(hero) {
  const td = document.createElement("td");
  const tags = create("div", "tag-row hero-list-tags");
  const shownTags = hero.tags.length ? hero.tags.slice(0, 3) : ["—"];
  shownTags.forEach((tag) => tags.append(textBadge(tag, "tag")));
  td.append(tags);
  return td;
}

function createHeroListFavoriteCell(hero) {
  const td = create("td", "hero-list-favorite");
  td.append(createFavoriteButton(hero, "list"));
  return td;
}

function loadHeroView() {
  try {
    return window.localStorage.getItem(HERO_VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function saveHeroView() {
  try {
    window.localStorage.setItem(HERO_VIEW_KEY, state.heroView);
  } catch {
    // View preference is optional if storage is unavailable.
  }
}

function setHeroView(view) {
  state.heroView = view === "list" ? "list" : "grid";
  saveHeroView();
  syncHeroViewControls();
  syncSettingsHeroViewControls();
}

function syncHeroViewControls() {
  if (!el.heroViewToggle) return;
  el.heroViewToggle.querySelectorAll("button[data-hero-view]").forEach((button) => {
    const active = button.dataset.heroView === state.heroView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function loadDefaultPlatform() {
  try {
    return window.localStorage.getItem(DEFAULT_PLATFORM_KEY) === "console" ? "console" : "pc";
  } catch {
    return "pc";
  }
}

function saveDefaultPlatform(platform) {
  try {
    window.localStorage.setItem(DEFAULT_PLATFORM_KEY, platform === "console" ? "console" : "pc");
  } catch {
    // Platform preference is optional if storage is unavailable.
  }
}

function setPlatform(platform, options = {}) {
  const next = platform === "console" ? "console" : "pc";
  const changed = state.platform !== next;
  state.platform = next;
  syncPlatformControls();
  syncSettingsPlatformControls();
  if ((changed || options.forceRefresh) && options.refreshProfile !== false && state.selectedPlayer) {
    selectPlayer(state.selectedPlayer.player_id, { keepResults: true });
  }
}

function syncPlatformControls() {
  if (!el.platformTabs) return;
  el.platformTabs.querySelectorAll("button[data-platform]").forEach((button) => {
    const active = button.dataset.platform === state.platform;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyThemePreference(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  if (el.themeToggle) {
    el.themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    const label = el.themeToggle.querySelector(".theme-toggle-text");
    if (label) label.textContent = next === "dark" ? "深色" : "浅色";
  }
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Theme preference is optional if storage is unavailable.
  }
  syncSettingsThemeControls();
}

function renderSettings(message = "") {
  if (!el.settingsContent) return;
  el.settingsContent.replaceChildren();

  const grid = create("div", "settings-grid");
  grid.append(createSettingsPreferences(), createSettingsAbout());

  const feedback = create("p", "api-state settings-feedback");
  feedback.id = "settingsFeedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.textContent = message || "设置改动会自动保存到此设备。";

  el.settingsContent.append(grid, feedback);
}

function createSettingsPreferences() {
  const card = create("section", "settings-card");
  card.setAttribute("aria-labelledby", "settingsPrefsTitle");
  const title = appendText(card, "h3", "偏好");
  title.id = "settingsPrefsTitle";

  const theme = createSegmentedPreference({
    id: "settingsThemeControl",
    label: "主题",
    hint: "与顶栏主题按钮同步。",
    dataName: "settingTheme",
    activeValue: currentTheme(),
    options: [
      ["light", "浅色"],
      ["dark", "深色"]
    ]
  });

  const platform = createSegmentedPreference({
    id: "settingsPlatformControl",
    label: "战绩默认平台",
    hint: "刷新或下次打开时作为战绩查询初始平台。",
    dataName: "settingPlatform",
    activeValue: loadDefaultPlatform(),
    options: [
      ["pc", "PC"],
      ["console", "主机"]
    ]
  });

  const heroView = createSegmentedPreference({
    id: "settingsHeroViewControl",
    label: "英雄库默认视图",
    hint: "与英雄库视图偏好共用 ow-hero-view。",
    dataName: "settingHeroView",
    activeValue: state.heroView,
    options: [
      ["grid", "卡片"],
      ["list", "列表"]
    ]
  });

  card.append(theme, platform, heroView);
  return card;
}

function createSegmentedPreference({ id, label, hint, dataName, activeValue, options }) {
  const group = create("fieldset", "settings-fieldset");
  const legend = appendText(group, "legend", label);
  const buttons = create("div", "segmented settings-segmented");
  buttons.id = id;
  buttons.setAttribute("role", "group");
  buttons.setAttribute("aria-label", label);
  options.forEach(([value, text]) => {
    const button = create("button", value === activeValue ? "is-active" : "");
    button.type = "button";
    button.dataset[dataName] = value;
    button.setAttribute("aria-pressed", String(value === activeValue));
    button.textContent = text;
    buttons.append(button);
  });
  const note = appendText(group, "p", hint);
  note.id = `${id}Hint`;
  buttons.setAttribute("aria-describedby", note.id);
  legend.id = `${id}Legend`;
  group.append(buttons);
  return group;
}

function createSettingsAbout() {
  const card = create("section", "settings-card settings-about");
  card.setAttribute("aria-labelledby", "settingsAboutTitle");
  const title = appendText(card, "h3", "关于");
  title.id = "settingsAboutTitle";

  const appName = create("div", "settings-about-head");
  appendText(appName, "strong", "OW 助手");
  appendText(appName, "span", `版本 ${APP_VERSION}`);

  const link = create("a", "ghost-link settings-github");
  link.href = "https://github.com/leonjean214/ow-assistant";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "在 GitHub 查看源码";

  appendText(card, "p", "数据与灵感来自 OverFast API、workshop.codes 与守望先锋社区调研，应用仅做本地聚合与辅助展示。");

  const updateRow = create("div", "settings-update-row");
  const update = create("button", "primary-btn");
  update.id = "settingsCheckUpdate";
  update.type = "button";
  update.textContent = "检查更新";
  const status = create("p", "api-state settings-update-status");
  status.id = "settingsUpdateStatus";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "PWA 更新检查会在支持 Service Worker 时运行。";
  updateRow.append(update, status);

  card.append(appName, link, updateRow);
  return card;
}

function handleSettingsClick(event) {
  const theme = event.target.closest("button[data-setting-theme]");
  if (theme) {
    applyThemePreference(theme.dataset.settingTheme);
    announceSettings(`已切换为${currentTheme() === "dark" ? "深色" : "浅色"}主题`);
    return;
  }

  const platform = event.target.closest("button[data-setting-platform]");
  if (platform) {
    const next = platform.dataset.settingPlatform === "console" ? "console" : "pc";
    saveDefaultPlatform(next);
    setPlatform(next);
    syncSettingsPlatformControls();
    announceSettings(`已设默认平台为${next === "console" ? "主机" : "PC"}`);
    return;
  }

  const heroView = event.target.closest("button[data-setting-hero-view]");
  if (heroView) {
    setHeroView(heroView.dataset.settingHeroView);
    renderHeroGrid();
    syncSettingsHeroViewControls();
    announceSettings(`已设英雄库默认视图为${state.heroView === "list" ? "列表" : "卡片"}`);
    return;
  }

  if (event.target.closest("#settingsCheckUpdate")) {
    checkPwaUpdate();
  }
}

function syncSettingsThemeControls() {
  syncSettingsSegmented("settingsThemeControl", "settingTheme", currentTheme());
}

function syncSettingsPlatformControls() {
  syncSettingsSegmented("settingsPlatformControl", "settingPlatform", loadDefaultPlatform());
}

function syncSettingsHeroViewControls() {
  syncSettingsSegmented("settingsHeroViewControl", "settingHeroView", state.heroView);
}

function syncSettingsSegmented(id, dataName, activeValue) {
  const group = document.getElementById(id);
  if (!group) return;
  group.querySelectorAll("button").forEach((button) => {
    const active = button.dataset[dataName] === activeValue;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function announceSettings(message) {
  const feedback = document.getElementById("settingsFeedback");
  if (feedback) feedback.textContent = message;
}

async function checkPwaUpdate() {
  const button = document.getElementById("settingsCheckUpdate");
  const status = document.getElementById("settingsUpdateStatus");
  if (button) button.disabled = true;
  if (status) setApiState(status, "loading", "正在检查更新...");
  try {
    if (!("serviceWorker" in navigator)) {
      if (status) setApiState(status, "empty", "当前浏览器不支持 Service Worker，无法检查更新。");
      announceSettings("当前环境不支持 PWA 更新检查。");
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      if (status) setApiState(status, "empty", "当前页面尚未注册 Service Worker。");
      announceSettings("当前页面尚未注册 Service Worker。");
      return;
    }
    await registration.update();
    if (status) setApiState(status, "", "已检查更新；如有新版，浏览器会在后台安装。");
    announceSettings("已完成 PWA 更新检查。");
  } catch (error) {
    console.warn("PWA update check skipped:", error);
    if (status) setApiState(status, "empty", "当前环境无法检查更新，请稍后再试。");
    announceSettings("当前环境无法检查 PWA 更新。");
  } finally {
    if (button) button.disabled = false;
  }
}

function setHeroSort(sort) {
  state.filters.sort = ["default", "tier", "diff-asc", "diff-desc", "hp-desc", "name"].includes(sort) ? sort : "default";
  syncHeroSortFilter();
}

function syncHeroSortFilter() {
  if (el.heroSortFilter && el.heroSortFilter.value !== state.filters.sort) el.heroSortFilter.value = state.filters.sort;
}

function nextHeroListSort(sortKey) {
  if (sortKey === "difficulty") return state.filters.sort === "diff-asc" ? "diff-desc" : "diff-asc";
  if (sortKey === "hp") return "hp-desc";
  if (sortKey === "name") return "name";
  if (sortKey === "tier") return "tier";
  return "default";
}

function heroListAriaSort(sortKey) {
  if (sortKey === "difficulty") {
    if (state.filters.sort === "diff-asc") return "ascending";
    if (state.filters.sort === "diff-desc") return "descending";
  }
  if (sortKey === "hp" && state.filters.sort === "hp-desc") return "descending";
  if (sortKey === "name" && state.filters.sort === "name") return "ascending";
  if (sortKey === "tier" && state.filters.sort === "tier") return "descending";
  return "none";
}

function renderTagFilters() {
  if (!el.heroTagFilters) return;
  el.heroTagFilters.replaceChildren();
  heroTagOptions().forEach((tag) => {
    const button = create("button", "select-chip tag-filter-pill");
    button.type = "button";
    button.dataset.heroTag = tag;
    button.textContent = tag;
    el.heroTagFilters.append(button);
  });
  syncTagFilterControls();
}

function heroTagOptions() {
  return [...new Set(state.heroes.flatMap((hero) => toArray(hero.tags).map(String).filter(Boolean)))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function toggleHeroTagFilter(tag) {
  if (!tag) return;
  state.filters.tags = state.filters.tags.includes(tag)
    ? state.filters.tags.filter((item) => item !== tag)
    : [...state.filters.tags, tag];
  syncTagFilterControls();
  renderHeroGrid();
}

function syncTagFilterControls() {
  if (!el.heroTagFilters) return;
  const selected = new Set(state.filters.tags);
  el.heroTagFilters.querySelectorAll("button[data-hero-tag]").forEach((button) => {
    const active = selected.has(button.dataset.heroTag);
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (el.tagMatchToggle) {
    el.tagMatchToggle.setAttribute("aria-pressed", String(state.filters.tagsMatchAll));
    el.tagMatchToggle.textContent = state.filters.tagsMatchAll ? "全部命中 AND" : "任一命中 OR";
  }
  if (el.clearTagFilters) el.clearTagFilters.disabled = state.filters.tags.length === 0;
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
  const originalIndex = new Map(state.heroes.map((hero, index) => [hero.id, index]));
  const heroes = state.heroes.filter((hero) => {
    if (state.filters.role !== "all" && hero.role !== state.filters.role) return false;
    if (state.filters.tier !== "all" && hero.tier !== state.filters.tier) return false;
    if (state.filters.ban !== "all" && hero.ban.priority !== state.filters.ban) return false;
    if (state.filters.favoritesOnly && !isFavorite(hero.id)) return false;
    if (!matchesHeroTags(hero)) return false;
    if (!state.filters.search) return true;
    const haystack = [hero.id, hero.name, hero.nameZh, hero.subrole, hero.tier, ...hero.tags].join(" ").toLowerCase();
    return haystack.includes(state.filters.search);
  });
  return sortFilteredHeroes(heroes, originalIndex);
}

function matchesHeroTags(hero) {
  const selectedTags = state.filters.tags;
  if (!selectedTags.length) return true;
  const tags = new Set(toArray(hero.tags).map(String));
  return state.filters.tagsMatchAll
    ? selectedTags.every((tag) => tags.has(tag))
    : selectedTags.some((tag) => tags.has(tag));
}

function sortFilteredHeroes(heroes, originalIndex) {
  const indexOf = (hero) => originalIndex.get(hero.id) ?? Number.MAX_SAFE_INTEGER;
  const byOriginalOrder = (a, b) => indexOf(a) - indexOf(b);
  const sort = state.filters.sort;
  if (sort === "tier") {
    return heroes.sort((a, b) => tierSortRank(a.tier) - tierSortRank(b.tier) || byOriginalOrder(a, b));
  }
  if (sort === "diff-asc") {
    return heroes.sort((a, b) => difficultySortValue(a) - difficultySortValue(b) || byOriginalOrder(a, b));
  }
  if (sort === "diff-desc") {
    return heroes.sort((a, b) => compareDifficultyDesc(a, b) || byOriginalOrder(a, b));
  }
  if (sort === "hp-desc") {
    return heroes.sort((a, b) => totalHealth(b) - totalHealth(a) || byOriginalOrder(a, b));
  }
  if (sort === "name") {
    return heroes.sort((a, b) => String(a.nameZh || a.name).localeCompare(String(b.nameZh || b.name), "zh-Hans-CN") || byOriginalOrder(a, b));
  }
  if (state.filters.favoritesOnly) return heroes.sort(byOriginalOrder);
  return heroes.sort((a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)) || byOriginalOrder(a, b));
}

function tierSortRank(tier) {
  return { S: 0, A: 1, B: 2, C: 3 }[tier] ?? 9;
}

function difficultySortValue(hero) {
  if (hero?.difficulty == null) return Number.POSITIVE_INFINITY;
  const value = Number(hero?.difficulty);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function compareDifficultyDesc(a, b) {
  const av = difficultySortValue(a);
  const bv = difficultySortValue(b);
  if (av === Number.POSITIVE_INFINITY && bv === Number.POSITIVE_INFINITY) return 0;
  if (av === Number.POSITIVE_INFINITY) return 1;
  if (bv === Number.POSITIVE_INFINITY) return -1;
  return bv - av;
}

function totalHealth(hero) {
  return Number(hero?.health?.hp) + Number(hero?.health?.armor) + Number(hero?.health?.shield) || 0;
}

function renderMatrix() {
  if (!el.matrixContent) return;
  syncMatrixRoleTabs();
  el.matrixContent.replaceChildren();
  const heroes = filteredMatrixHeroes();
  if (el.matrixCount) el.matrixCount.textContent = `${heroes.length} 位英雄`;
  if (!heroes.length) {
    const empty = create("p", "empty-state matrix-empty");
    empty.textContent = "没有符合条件的英雄，换个职业或搜索词再试。";
    el.matrixContent.append(empty);
    return;
  }
  ["tank", "damage", "support"].forEach((role) => {
    if (state.matrixFilter.role !== "all" && state.matrixFilter.role !== role) return;
    const roleHeroes = heroes.filter((hero) => hero.role === role);
    if (!roleHeroes.length) return;
    el.matrixContent.append(createMatrixSection(role, roleHeroes));
  });
}

function filteredMatrixHeroes() {
  const search = state.matrixFilter.search;
  return state.heroes.filter((hero) => {
    if (state.matrixFilter.role !== "all" && hero.role !== state.matrixFilter.role) return false;
    if (!search) return true;
    return [hero.id, hero.name, hero.nameZh].filter(Boolean).join(" ").toLowerCase().includes(search);
  });
}

function syncMatrixRoleTabs() {
  if (!el.matrixRoleTabs) return;
  el.matrixRoleTabs.querySelectorAll("button[data-matrix-role]").forEach((button) => {
    const active = button.dataset.matrixRole === state.matrixFilter.role;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function createMatrixSection(role, heroes) {
  const section = create("section", "matrix-section");
  const head = create("div", "matrix-section-head");
  appendText(head, "h3", ROLE_LABELS[role] || role);
  const count = create("span", "badge");
  count.textContent = `${heroes.length} 位`;
  head.append(count);
  const list = create("div", "matrix-list");
  heroes.forEach((hero) => list.append(createMatrixCard(hero)));
  section.append(head, list);
  return section;
}

function createMatrixCard(hero) {
  const card = create("article", "matrix-card");
  card.dataset.matrixCard = hero.id;
  const heroButton = create("button", "matrix-hero");
  heroButton.type = "button";
  heroButton.dataset.matrixHero = hero.id;
  heroButton.append(createAvatar(hero));
  const names = create("span", "matrix-hero-names");
  appendText(names, "strong", hero.nameZh);
  appendText(names, "span", hero.name);
  heroButton.append(names);
  const links = create("div", "matrix-links");
  const counters = hero.counters || {};
  links.append(
    createHeroLinkGroup("我克制", counters.strongAgainst, "strong"),
    createHeroLinkGroup("我怕", counters.weakAgainst, "weak"),
    createHeroLinkGroup("协同", counters.synergy, "synergy")
  );
  card.append(heroButton, links);
  return card;
}

function createHeroCard(hero) {
  const card = create("div", hero.id === state.patches.meta.latestHero ? "hero-card is-new-hero" : "hero-card");
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `${hero.nameZh} ${hero.name} 详情`);
  card.dataset.heroId = hero.id;
  card.append(createFavoriteButton(hero, "card"));
  card.append(createCompareButton(hero, "card"));
  card.append(createTeamButton(hero, "card"));
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

// ---- 队伍构筑 ----
function loadTeam() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEAM_KEY) || "[]");
    return uniqueValidHeroIds(Array.isArray(parsed) ? parsed : []).slice(0, MAX_TEAM);
  } catch {
    return [];
  }
}

function saveTeam() {
  try {
    window.localStorage.setItem(TEAM_KEY, JSON.stringify(state.team));
  } catch {
    // 阵容为可选功能，存储不可用时忽略。
  }
}

function isInTeam(heroId) {
  return state.team.includes(heroId);
}

function setTeam(ids, options = {}) {
  state.teamMessage = "";
  state.team = uniqueValidHeroIds(ids).slice(0, MAX_TEAM);
  saveTeam();
  renderTeam();
  updateTeamButton();
  if (options.sync !== false) syncHashForTeam(options);
  if (!options.silent && ids.length > MAX_TEAM) {
    state.teamMessage = `一支队伍最多 ${MAX_TEAM} 位英雄。`;
    renderTeam();
  }
}

function toggleTeam(heroId) {
  if (!state.byId.has(heroId)) return;
  if (isInTeam(heroId)) {
    removeFromTeam(heroId);
    return;
  }
  if (state.team.length >= MAX_TEAM) {
    state.teamMessage = `一支队伍最多 ${MAX_TEAM} 位英雄，先移除一个再添加。`;
    renderTeam();
    updateTeamButton();
    return;
  }
  setTeam([...state.team, heroId]);
}

function removeFromTeam(heroId) {
  if (!isInTeam(heroId)) return;
  setTeam(state.team.filter((id) => id !== heroId));
}

function clearTeam() {
  if (!state.team.length) return;
  setTeam([]);
}

function createTeamButton(hero, context) {
  const button = create("button", context === "detail" ? "team-btn detail-team" : "team-btn");
  button.type = "button";
  button.dataset.teamHero = hero.id;
  updateTeamButton(button, hero);
  return button;
}

function createHeroShareButton(hero) {
  const button = create("button", "hero-share-btn detail-share");
  button.type = "button";
  button.dataset.shareHero = hero.id;
  button.setAttribute("aria-label", `生成 ${hero.nameZh} 分享图`);
  button.title = "生成分享图";
  button.textContent = "分享图";
  return button;
}

function updateTeamButton(button = null, hero = null) {
  const buttons = button ? [button] : [...document.querySelectorAll("button[data-team-hero]")];
  buttons.forEach((item) => {
    const currentHero = hero || state.byId.get(item.dataset.teamHero);
    if (!currentHero) return;
    const active = isInTeam(currentHero.id);
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
    item.setAttribute("aria-label", `${active ? "移出队伍" : "加入队伍"} ${currentHero.nameZh}`);
    item.title = active ? "移出队伍" : "加入队伍";
    item.textContent = active ? "✓队" : "+队";
  });
}

function renderTeam(message = "") {
  if (message) state.teamMessage = message;
  if (!el.teamContent) return;
  if (el.teamCount) el.teamCount.textContent = `${state.team.length} / ${MAX_TEAM}`;
  el.teamContent.replaceChildren();

  if (state.teamMessage) {
    const msg = create("p", "team-message");
    msg.textContent = state.teamMessage;
    el.teamContent.append(msg);
  }

  // 槽位
  const slots = create("div", "team-slots");
  for (let i = 0; i < MAX_TEAM; i += 1) {
    const id = state.team[i];
    const hero = id ? state.byId.get(id) : null;
    const slot = create("div", hero ? "team-slot is-filled" : "team-slot");
    if (hero) {
      slot.append(createAvatar(hero));
      const name = create("div", "team-slot-name");
      appendText(name, "strong", hero.nameZh);
      appendText(name, "span", ROLE_LABELS[hero.role] || hero.role);
      slot.append(name);
      const remove = create("button", "icon-btn");
      remove.type = "button";
      remove.dataset.removeTeam = hero.id;
      remove.setAttribute("aria-label", `移出队伍 ${hero.nameZh}`);
      remove.textContent = "×";
      slot.append(remove);
    } else {
      const ph = create("span", "team-slot-empty");
      ph.textContent = "空位";
      slot.append(ph);
    }
    slots.append(slot);
  }
  el.teamContent.append(slots);

  if (!state.team.length) {
    const empty = create("div", "empty-state team-empty");
    appendText(empty, "strong", "阵容为空");
    appendText(empty, "span", "从英雄库点卡片上的「+队」搭建你的阵容（最多 5 人）。");
    el.teamContent.append(empty);
    return;
  }

  const analysis = analyzeTeam(state.team, state.byId);

  // 职业配比
  const roleCard = create("div", "team-card");
  appendText(roleCard, "h3", "职业配比");
  const roleRow = create("div", "tag-row");
  ["tank", "damage", "support"].forEach((role) => {
    const have = analysis.roleCount[role] || 0;
    const want = ({ tank: 1, damage: 2, support: 2 })[role];
    const badge = textBadge(`${TEAM_ROLE_ZH[role]} ${have}/${want}`, have === want ? "tag ok" : "tag warn");
    roleRow.append(badge);
  });
  roleCard.append(roleRow);
  if (analysis.roleAdvice.length) appendText(roleCard, "p", analysis.roleAdvice.join("，"));

  // 阵容原型
  const archCard = create("div", "team-card");
  appendText(archCard, "h3", "阵容原型");
  appendText(archCard, "p", analysis.archetype.label + (analysis.archetype.mixed ? "（多原型并存）" : ""));
  const archRow = create("div", "tag-row");
  [["dive", "突进"], ["poke", "消耗"], ["brawl", "缠斗"]].forEach(([k, zh]) => {
    if (analysis.archetype.counts[k]) archRow.append(textBadge(`${zh} ${analysis.archetype.counts[k]}`, "tag"));
  });
  if (archRow.children.length) archCard.append(archRow);

  // 内部配合
  const synCard = create("div", "team-card");
  appendText(synCard, "h3", `内部配合（${analysis.synergies.length}）`);
  if (analysis.synergies.length) {
    const list = create("div", "tag-row");
    analysis.synergies.forEach((p) => list.append(textBadge(`${p.aName} + ${p.bName}`, "tag ok")));
    synCard.append(list);
  } else {
    appendText(synCard, "p", "暂无显著配合数据。");
  }

  // 整体弱点
  const threatCard = create("div", "team-card");
  appendText(threatCard, "h3", "整体弱点（敌方威胁）");
  if (analysis.threats.length) {
    const table = create("div", "team-threats");
    analysis.threats.slice(0, 6).forEach((t) => {
      const enemy = state.byId.get(t.enemyId);
      const row = create("button", "team-threat-row");
      row.type = "button";
      if (enemy) row.dataset.jumpHero = t.enemyId; else row.disabled = true;
      row.append(createAvatar(enemy || { nameZh: t.name }));
      const body = create("div");
      appendText(body, "strong", t.name);
      appendText(body, "span", `克制你方 ${t.count} 名英雄`);
      row.append(body);
      table.append(row);
    });
    threatCard.append(table);
    const toCounter = create("button", "primary-btn");
    toCounter.type = "button";
    toCounter.dataset.teamToCounter = "true";
    toCounter.textContent = "拿威胁去克制计算器";
    threatCard.append(toCounter);
  } else {
    appendText(threatCard, "p", "暂无明显被克数据。");
  }

  const grid = create("div", "team-analysis");
  grid.append(roleCard, archCard, synCard, threatCard);
  el.teamContent.append(grid);

  if (analysis.advice.length) {
    const advice = create("div", "team-advice");
    analysis.advice.forEach((line) => appendText(advice, "p", line));
    el.teamContent.append(advice);
  }

  const tools = create("div", "team-tools");
  const clear = create("button", "ghost-btn");
  clear.type = "button";
  clear.dataset.clearTeam = "true";
  clear.textContent = "清空阵容";
  tools.append(clear);
  el.teamContent.append(tools);
}

// 把全队聚合威胁送进克制计算器并运行。
function teamThreatsToCounter() {
  const analysis = analyzeTeam(state.team, state.byId);
  const enemyIds = analysis.threats.map((t) => t.enemyId).filter((id) => state.byId.has(id)).slice(0, 5);
  if (!enemyIds.length) {
    renderTeam("当前阵容没有明显威胁可分析。");
    return;
  }
  state.selectedEnemies = enemyIds;
  switchView("counter");
  renderEnemyChips();
  renderCounter();
}

// ---- 工坊代码 ----
function renderWorkshop(message = "") {
  if (!el.workshopContent) return;
  const { meta = {}, categories = [] } = state.workshop || {};
  el.workshopContent.replaceChildren();

  if (message) {
    const m = create("p", "workshop-msg");
    m.textContent = message;
    el.workshopContent.append(m);
  }

  // 导入指南
  if (meta.import) {
    const guide = create("div", "team-card");
    appendText(guide, "h3", meta.import.title || "如何导入");
    const ol = document.createElement("ol");
    ol.className = "workshop-steps";
    toArray(meta.import.steps).forEach((s) => { const li = document.createElement("li"); li.textContent = s; ol.append(li); });
    guide.append(ol);
    if (meta.import.tip) appendText(guide, "p", meta.import.tip);
    el.workshopContent.append(guide);
  }

  // 免责声明 + 实时源
  if (meta.disclaimer) {
    const warn = create("div", "workshop-disclaimer");
    appendText(warn, "p", meta.disclaimer);
    if (meta.liveSource) {
      const a = document.createElement("a");
      a.href = meta.liveSource; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.className = "hero-link";
      a.textContent = "打开 workshop.codes（实时最新）";
      warn.append(a);
    }
    el.workshopContent.append(warn);
  }

  if (!categories.length) {
    const empty = create("p", "empty-state");
    empty.textContent = "工坊数据未加载。";
    el.workshopContent.append(empty);
    return;
  }

  categories.forEach((cat) => {
    const card = create("div", "team-card workshop-cat");
    const head = create("div", "section-head");
    const titleBox = create("div");
    appendText(titleBox, "h3", cat.name);
    if (cat.desc) appendText(titleBox, "p", cat.desc);
    head.append(titleBox);
    if (cat.search) {
      const a = document.createElement("a");
      a.href = cat.search; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.className = "hero-link";
      a.textContent = "更多 ↗";
      head.append(a);
    }
    card.append(head);

    const list = create("div", "workshop-codes");
    toArray(cat.codes).forEach((c) => {
      const row = create("div", "workshop-code-row");
      const codeBtn = create("button", "workshop-code");
      codeBtn.type = "button";
      codeBtn.dataset.copyCode = c.code;
      codeBtn.setAttribute("aria-label", `复制工坊代码 ${c.code}`);
      codeBtn.textContent = c.code;
      const info = create("div", "workshop-code-info");
      appendText(info, "strong", c.name || c.code);
      if (c.note) appendText(info, "span", c.note);
      if (c.source) appendText(info, "small", `来源：${c.source}`);
      row.append(codeBtn, info);
      list.append(row);
    });
    card.append(list);
    el.workshopContent.append(card);
  });
}

// ---- 个人中心 ----
function renderMe(message = "") {
  if (!el.meContent) return;
  el.meContent.replaceChildren();
  const p = state.profile || {};

  if (message) {
    const m = create("p", "workshop-msg");
    m.textContent = message;
    el.meContent.append(m);
  }

  // 资料卡
  const card = create("div", "team-card me-profile");
  const head = create("div", "me-head");
  const avatarHero = p.avatarHeroId ? state.byId.get(p.avatarHeroId) : null;
  head.append(createAvatar(avatarHero || { nameZh: p.nickname || "我" }));
  const idBox = create("div");
  appendText(idBox, "strong", p.nickname || "未命名玩家");
  appendText(idBox, "span", p.battletag ? p.battletag : "未绑定 BattleTag");
  head.append(idBox);
  card.append(head);

  const form = create("div", "me-form");
  form.append(
    meField("昵称", textInput(p.nickname, (v) => updateProfile({ nickname: v }))),
    meField("BattleTag", battletagRow(p.battletag)),
    meField("主玩定位", roleSelect(p.mainRole, (v) => updateProfile({ mainRole: v }))),
    meField("头像英雄", avatarSelect(p.avatarHeroId, (v) => updateProfile({ avatarHeroId: v })))
  );
  card.append(form);
  el.meContent.append(card);

  // 概览
  const ov = localOverview();
  const journal = summarizeJournal(loadJournal(), state.byId);
  const overview = create("div", "team-card");
  appendText(overview, "h3", "我的数据概览");
  const grid = create("div", "me-stats");
  grid.append(
    meStat("收藏英雄", String(ov.favorites), "heroes", () => { state.filters.favoritesOnly = true; if (el.favoriteOnlyToggle) el.favoriteOnlyToggle.checked = true; renderHeroGrid(); }),
    meStat("对比中", String(ov.compare), "compare"),
    meStat("队伍", String(ov.team), "team"),
    meStat("对局记录", `${journal.total.games} 局 · ${journal.total.games ? journal.total.winrate.toFixed(0) + "% 胜" : "—"}`, "journal")
  );
  overview.append(grid);
  if (ov.recentPlayers.length) {
    appendText(overview, "h4", "最近查询玩家");
    const chips = create("div", "tag-row");
    ov.recentPlayers.slice(0, 6).forEach((name) => {
      const b = create("button", "recent-chip");
      b.type = "button";
      b.textContent = name;
      b.addEventListener("click", () => lookupBattletag(name));
      chips.append(b);
    });
    overview.append(chips);
  }
  el.meContent.append(overview);

  // 数据管理（云同步前的本地备份/迁移）
  const data = create("div", "team-card");
  appendText(data, "h3", "数据备份与迁移");
  appendText(data, "p", "全部本地数据（资料/收藏/对比/队伍/记录/主题）可导出为 JSON 备份，换设备时导入恢复。云同步功能预留中。");
  const tools = create("div", "me-actions");
  const exportBtn = create("button", "primary-btn");
  exportBtn.type = "button";
  exportBtn.textContent = "导出全部备份";
  exportBtn.addEventListener("click", exportProfileBackup);
  const importBtn = create("button", "ghost-btn");
  importBtn.type = "button";
  importBtn.textContent = "导入备份";
  importBtn.addEventListener("click", importProfileBackup);
  const clearBtn = create("button", "ghost-btn");
  clearBtn.type = "button";
  clearBtn.textContent = "清空本地数据";
  clearBtn.addEventListener("click", () => {
    if (window.confirm("确定清空本应用全部本地数据？此操作不可撤销。")) {
      clearAllLocal();
      state.profile = loadProfile();
      state.favorites = new Set();
      state.compare = [];
      state.team = [];
      state.journalEntries = [];
      renderHeroGrid();
      renderMe("已清空全部本地数据。");
    }
  });
  tools.append(exportBtn, importBtn, clearBtn);
  data.append(tools);
  el.meContent.append(data);
}

function updateProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  saveProfile(state.profile);
  renderMe();
}

function meField(label, control) {
  const wrap = create("label", "field");
  appendText(wrap, "span", label);
  wrap.append(control);
  return wrap;
}

function textInput(value, onChange) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.addEventListener("change", () => onChange(input.value.trim()));
  return input;
}

function battletagRow(value) {
  const row = create("div", "me-bt-row");
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.placeholder = "Jay3#1234";
  input.addEventListener("change", () => updateProfile({ battletag: input.value.trim() }));
  const go = create("button", "ghost-btn");
  go.type = "button";
  go.textContent = "查战绩";
  go.addEventListener("click", () => { if (input.value.trim()) lookupBattletag(input.value.trim()); });
  row.append(input, go);
  return row;
}

function roleSelect(value, onChange) {
  const sel = document.createElement("select");
  ROLE_OPTIONS.forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = label;
    if (v === (value || "")) o.selected = true;
    sel.append(o);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function avatarSelect(value, onChange) {
  const sel = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "默认占位";
  sel.append(blank);
  [...state.heroes].sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh-Hans-CN")).forEach((hero) => {
    const o = document.createElement("option");
    o.value = hero.id; o.textContent = hero.nameZh;
    if (hero.id === (value || "")) o.selected = true;
    sel.append(o);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function meStat(label, value, view, onClick) {
  const b = create("button", "me-stat");
  b.type = "button";
  appendText(b, "strong", value);
  appendText(b, "span", label);
  b.addEventListener("click", () => { if (onClick) onClick(); switchView(view); });
  return b;
}

function lookupBattletag(name) {
  switchView("profile");
  if (el.playerSearchInput) {
    el.playerSearchInput.value = name;
    runPlayerSearch();
  }
}

function exportProfileBackup() {
  try {
    const blob = new Blob([JSON.stringify(exportAllLocal(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ow-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    renderMe("已导出全部本地数据备份。");
  } catch {
    renderMe("导出失败，请稍后重试。");
  }
}

function importProfileBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      if (!parsed.ok) { renderMe(`导入失败：${parsed.error}`); return; }
      const res = importAllLocal(parsed.payload);
      // 重载内存态
      state.profile = loadProfile();
      state.favorites = loadFavorites();
      state.compare = loadCompare();
      state.team = loadTeam();
      state.journalEntries = loadJournal();
      renderHeroGrid();
      renderMe(`已导入备份，恢复 ${res.count} 项。`);
    } catch {
      renderMe("导入失败：无法读取这个文件。");
    }
  });
  input.click();
}

function copyWorkshopCode(code, button) {
  const done = (ok) => {
    if (!button) return;
    const prev = button.textContent;
    button.textContent = ok ? "已复制" : code;
    if (ok) window.setTimeout(() => { button.textContent = prev; }, 1200);
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => done(true)).catch(() => done(false));
    } else {
      done(false);
    }
  } catch {
    done(false);
  }
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
  const caption = create("caption", "sr-only");
  caption.textContent = "英雄对比表";
  table.append(caption);
  table.append(createCompareHead(heroes), createCompareBody(heroes));
  wrap.append(table);
  el.compareContent.append(wrap);
}

function createCompareHead(heroes) {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  const empty = document.createElement("th");
  empty.scope = "col";
  empty.textContent = "维度";
  row.append(empty);
  heroes.forEach((hero) => {
    const th = document.createElement("th");
    th.scope = "col";
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
  if (!el.detailDrawer.classList.contains("is-open")) {
    const active = document.activeElement;
    previousDetailFocus = active && !el.detailDrawer.contains(active) ? active : null;
  }
  activeDetailHeroId = heroId;
  el.detailDrawer.inert = false;
  el.detailDrawer.classList.add("is-open");
  el.detailDrawer.setAttribute("aria-hidden", "false");
  setBackgroundInert(true);
  window.requestAnimationFrame(() => {
    const focusTarget = el.closeDrawer || el.detailDialog || firstFocusable(el.detailDrawer);
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });
}

function closeDetailPanel() {
  const wasOpen = el.detailDrawer.classList.contains("is-open");
  el.detailDrawer.classList.remove("is-open");
  el.detailDrawer.setAttribute("aria-hidden", "true");
  el.detailDrawer.inert = true;
  setBackgroundInert(false);
  if (!wasOpen) return;
  restoreDetailFocus();
}

function setBackgroundInert(active) {
  [
    document.querySelector(".topbar"),
    document.querySelector(".view-tabs"),
    document.getElementById("main"),
    document.querySelector(".site-footer"),
    el.compareTray
  ].forEach((node) => {
    if (!node) return;
    node.inert = active;
    if (active) {
      node.setAttribute("aria-hidden", "true");
    } else {
      node.removeAttribute("aria-hidden");
    }
  });
}

function restoreDetailFocus() {
  const target = focusRestoreTarget();
  previousDetailFocus = null;
  window.requestAnimationFrame(() => {
    if (target) target.focus({ preventScroll: true });
  });
}

function focusRestoreTarget() {
  if (isFocusable(previousDetailFocus)) return previousDetailFocus;
  const activeTab = document.querySelector(".view-tab[aria-selected='true']");
  if (isFocusable(activeTab)) return activeTab;
  const main = document.getElementById("main");
  return main || document.body;
}

function trapDrawerFocus(event) {
  if (!el.detailDrawer.classList.contains("is-open")) return;
  const focusables = focusableElements(el.detailDrawer);
  if (!focusables.length) {
    event.preventDefault();
    el.detailDialog?.focus({ preventScroll: true });
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!el.detailDrawer.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}

function firstFocusable(root) {
  return focusableElements(root)[0] || null;
}

function focusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isFocusable);
}

function isFocusable(node) {
  if (!node || typeof node.focus !== "function") return false;
  if (node.disabled || node.closest("[inert]")) return false;
  const style = window.getComputedStyle(node);
  return style.visibility !== "hidden" && style.display !== "none";
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
  headActions.append(createFavoriteButton(hero, "detail"), createCompareButton(hero, "detail"), createTeamButton(hero, "detail"), createHeroShareButton(hero));
  heroHead.append(headActions);
  const shareStatus = create("p", "hero-share-status");
  shareStatus.dataset.heroShareStatus = "true";
  shareStatus.setAttribute("aria-live", "polite");
  el.detailContent.append(heroHead, shareStatus);

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
  const why = state.counterNotes.get(hero.id);
  if (why) {
    const note = create("p", "counter-why");
    appendText(note, "strong", "为什么：");
    note.append(document.createTextNode(why));
    wrap.append(note);
  }
  wrap.append(
    createHeroLinkGroup("我克制 strongAgainst", hero.counters.strongAgainst, "strong"),
    createHeroLinkGroup("我怕 weakAgainst", hero.counters.weakAgainst, "weak"),
    createHeroLinkGroup("协同 synergy", hero.counters.synergy, "synergy")
  );
  return wrap;
}

function createHeroLinkGroup(title, ids, kind = "") {
  const group = create("div", kind ? `link-group link-${kind}` : "link-group");
  appendText(group, "h4", title);
  const links = create("div", "link-row");
  const validIds = toArray(ids);
  if (!validIds.length) {
    links.append(textBadge("—"));
  } else {
    validIds.forEach((id) => {
      const hero = state.byId.get(id);
      const button = create("button", kind ? `hero-link hero-link-${kind}` : "hero-link");
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
  if (container === el.counterResults) {
    container.append(createEnemyCompSummary(result.enemies));
    container.append(createSwapAdvisor(result));
  }
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

const ENEMY_COMP_HINT = {
  dive: "对面偏突进：抱团站位、留好控制与反手技能等切入者扑上来再打。",
  poke: "对面偏远程消耗：多利用掩体、缩短距离或绕侧，别在开阔地对枪。",
  brawl: "对面偏近身缠斗：拉开距离风筝、避免被贴脸群殴，打后排和分割。"
};

function createEnemyCompSummary(enemies) {
  const heroes = toArray(enemies).map((id) => state.byId.get(id)).filter(Boolean);
  const wrap = create("div", "enemy-comp");
  appendText(wrap, "h3", "对面阵容");
  if (!heroes.length) {
    appendText(wrap, "p", "选择敌方英雄后，这里会判断对面的阵容原型与职业配比。");
    return wrap;
  }
  const arche = teamArchetype(heroes);
  const roleCount = teamRoleCount(heroes);
  const row = create("div", "tag-row");
  row.append(textBadge(arche.label, "tag"));
  ["tank", "damage", "support"].forEach((role) => {
    if (roleCount[role]) row.append(textBadge(`${TEAM_ROLE_ZH[role]} ${roleCount[role]}`, "tag"));
  });
  wrap.append(row);
  if (arche.primary && ENEMY_COMP_HINT[arche.primary]) appendText(wrap, "p", ENEMY_COMP_HINT[arche.primary]);
  return wrap;
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
    console.warn(error);
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
    console.warn(error);
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
  const caption = create("caption", "sr-only");
  caption.textContent = "玩家英雄战绩表";
  table.append(caption);
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    ["hero", "英雄"], ["games", "场次"], ["winrate", "胜率"], ["kda", "KDA"],
    ["damageAvg", "场均伤害"], ["healingAvg", "场均治疗"], ["time", "游戏时长"]
  ].forEach(([key, label]) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.setAttribute("aria-sort", sortAriaValue(key));
    if (["games", "winrate", "kda"].includes(key)) {
      const button = create("button", "table-sort");
      button.type = "button";
      button.dataset.sort = key;
      button.setAttribute("aria-label", `${label}，当前${sortAriaLabel(key)}，点击切换排序`);
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

function sortAriaValue(key) {
  if (state.heroSort.key !== key) return "none";
  return state.heroSort.direction === "asc" ? "ascending" : "descending";
}

function sortAriaLabel(key) {
  if (state.heroSort.key !== key) return "未排序";
  return state.heroSort.direction === "asc" ? "升序" : "降序";
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
  const heroCell = document.createElement("th");
  heroCell.scope = "row";
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
    console.warn(error);
    state.maps = localMapsFromMeta();
    if (state.maps.length) {
      setApiState(el.mapsState, "error", `${friendlyApiError(error, "地图加载失败")} 已显示本地地图静态数据。`);
      renderMapModeTabs();
      renderMapsGrid();
      return;
    }
    setApiState(el.mapsState, "error", friendlyApiError(error, "地图加载失败"));
  }
}

function localMapsFromMeta() {
  return [...state.mapMeta.entries()].map(([key, meta]) => ({
    key,
    name: meta.nameZh,
    location: meta.archetype,
    country_code: "",
    gamemodes: meta.mode && meta.mode !== "—" ? [meta.mode] : []
  }));
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
  renderMetaSeasonNote();
  renderMetaStrongList();
  renderTierGrid();
  renderBanBoard();
  renderRolePassives();
}

function renderMetaSeasonNote() {
  if (!el.metaSeasonNote) return;
  el.metaSeasonNote.replaceChildren();
  const note = create("section", "meta-season-note");
  note.setAttribute("aria-labelledby", "metaSeasonNoteTitle");
  const title = create("strong");
  title.id = "metaSeasonNoteTitle";
  title.textContent = formatMetaSeasonTitle();
  const detail = create("span");
  detail.textContent = "tier/ban 为当前 meta 经验值，随补丁变";
  note.append(title, detail);
  el.metaSeasonNote.append(note);
}

function formatMetaSeasonTitle() {
  const meta = state.meta || {};
  const seasonRaw = String(meta.season || "").trim();
  const updated = String(meta.updated || "").trim();
  const [seasonPart, seasonDate] = seasonRaw.split(/\s*\/\s*/);
  const season = seasonPart || "Season 未知";
  const date = seasonDate || updated;
  const dateText = date ? `（${date}）` : "";
  const updateText = updated ? ` · 数据更新 ${updated}` : "";
  return `当前 ${season}${dateText}${updateText}`;
}

function renderMetaStrongList() {
  if (!el.metaStrongList) return;
  el.metaStrongList.replaceChildren();
  const wrap = create("section", "dashboard-card meta-strong-card");
  wrap.setAttribute("aria-labelledby", "metaStrongTitle");
  const titleRow = create("div", "meta-strong-head");
  const text = create("div");
  const title = create("h3");
  title.id = "metaStrongTitle";
  title.textContent = "各职业强势榜";
  const desc = create("p");
  desc.textContent = "按 Tier 从 S 到 C 排序，未定级英雄自动垫底。";
  text.append(title, desc);
  const count = createBadge(`Top ${META_STRONG_LIMIT}`, "tier-badge");
  titleRow.append(text, count);
  wrap.append(titleRow);

  if (!state.heroes.length) {
    const empty = create("p", "empty-state meta-empty");
    empty.textContent = "暂无英雄数据，强势榜无法生成。";
    wrap.append(empty);
    el.metaStrongList.append(wrap);
    return;
  }

  const columns = create("div", "meta-strong-columns");
  ["tank", "damage", "support"].forEach((role) => {
    columns.append(createMetaStrongRole(role));
  });
  wrap.append(columns);
  el.metaStrongList.append(wrap);
}

function createMetaStrongRole(role) {
  const column = create("section", "meta-strong-role");
  const titleId = `metaStrongRole-${role}`;
  column.setAttribute("aria-labelledby", titleId);
  const head = create("div", "meta-strong-role-head");
  const title = create("h4");
  title.id = titleId;
  title.textContent = ROLE_LABELS[role] || role;
  const tip = create("span");
  tip.textContent = roleNamesZh[role] || "";
  head.append(title, tip);
  column.append(head);

  const heroes = sortedMetaHeroes(role).slice(0, META_STRONG_LIMIT);
  if (!heroes.length) {
    const empty = create("p", "meta-strong-empty");
    empty.textContent = "暂无该职业英雄。";
    column.append(empty);
    return column;
  }

  const list = create("div", "meta-strong-list");
  heroes.forEach((hero, index) => list.append(createMetaStrongItem(hero, index + 1)));
  column.append(list);
  return column;
}

function sortedMetaHeroes(role) {
  const originalIndex = new Map(state.heroes.map((hero, index) => [hero.id, index]));
  return state.heroes
    .filter((hero) => hero.role === role)
    .sort((a, b) => tierSortRank(a.tier) - tierSortRank(b.tier) || (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0));
}

function createMetaStrongItem(hero, rank) {
  const button = create("button", "meta-strong-item");
  button.type = "button";
  button.dataset.jumpHero = hero.id;
  button.title = `查看 ${hero.nameZh} 详情`;
  const rankNode = create("span", "meta-strong-rank");
  rankNode.textContent = String(rank);
  const names = create("span", "meta-strong-name");
  appendText(names, "strong", hero.nameZh);
  appendText(names, "span", hero.name);
  button.append(rankNode, createAvatar(hero), names, createBadge(metaTierLabel(hero.tier), "tier-badge"));
  return button;
}

function metaTierLabel(tier) {
  return tierSortRank(tier) > 3 ? "未定级" : tier;
}

function renderTierGrid() {
  el.tierGrid.replaceChildren();
  const wrap = create("div", "dashboard-card");
  appendText(wrap, "h3", "Tier 榜");
  const table = create("table", "meta-table tier-table");
  const caption = create("caption", "sr-only");
  caption.textContent = "Meta Tier 榜表";
  table.append(caption);
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const roleHead = document.createElement("th");
  roleHead.scope = "col";
  roleHead.textContent = "职业";
  headRow.append(roleHead);
  ["S", "A", "B", "C"].forEach((tier) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = `Tier ${tier}`;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  ["tank", "damage", "support"].forEach((role) => {
    const tr = document.createElement("tr");
    const rowHead = document.createElement("th");
    rowHead.scope = "row";
    rowHead.textContent = ROLE_LABELS[role] || role;
    tr.append(rowHead);
    ["S", "A", "B", "C"].forEach((tier) => {
      const td = document.createElement("td");
      const cell = create("div", "tier-cell");
      appendText(cell, "h4", `${ROLE_LABELS[role]} · ${tier}`);
      const row = create("div", "portrait-row");
      state.heroes.filter((hero) => hero.role === role && hero.tier === tier).forEach((hero) => {
        const button = create("button", "portrait-btn");
        button.type = "button";
        button.dataset.jumpHero = hero.id;
        button.title = hero.nameZh;
        button.append(createAvatar(hero));
        row.append(button);
      });
      if (!row.children.length) row.append(textBadge("—"));
      cell.append(row);
      td.append(cell);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);
  const unranked = state.heroes.filter((hero) => tierSortRank(hero.tier) > 3);
  if (unranked.length) {
    const unrankedBox = create("div", "tier-unranked");
    appendText(unrankedBox, "h4", "未定级");
    const row = create("div", "portrait-row");
    unranked.forEach((hero) => {
      const button = create("button", "portrait-btn");
      button.type = "button";
      button.dataset.jumpHero = hero.id;
      button.title = hero.nameZh;
      button.append(createAvatar(hero));
      row.append(button);
    });
    unrankedBox.append(row);
    wrap.append(unrankedBox);
  }
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
    if (state.overlayEnemies.length) results.prepend(createEnemyCompSummary(state.overlayEnemies));
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
  container.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
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
