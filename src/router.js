const HERO_ROUTE_PREFIX = "#/hero/";
const COMPARE_ROUTE_PREFIX = "#/compare/";
const TEAM_ROUTE_PREFIX = "#/team/";

export function createRouter({
  defaultView,
  maxCompare,
  maxTeam,
  getRouteViews,
  isOverlayMode,
  hasHero,
  getHero,
  getHeroStat,
  setDetailStat,
  setActiveDetailHeroId,
  getCompareIds,
  getTeamIds,
  getCurrentView,
  uniqueValidHeroIds,
  switchView,
  renderDetail,
  openDetailPanel,
  closeDetailPanel,
  setCompare,
  setTeam
}) {
  let isRouting = false;

  function initRouter() {
    if (isOverlayMode()) return;
    window.addEventListener("hashchange", applyRouteFromHash);
    applyRouteFromHash();
  }

  function applyRouteFromHash() {
    if (isOverlayMode()) return;
    const route = parseHashRoute(window.location.hash);
    isRouting = true;
    try {
      if (route.type === "hero") {
        switchView(defaultView);
        if (hasHero(route.heroId)) {
          const hero = getHero(route.heroId);
          setDetailStat(getHeroStat(route.heroId) || null);
          renderDetail(hero);
          openDetailPanel(route.heroId);
        } else {
          setActiveDetailHeroId("");
          closeDetailPanel();
          replaceHash(viewHash(defaultView));
        }
        return;
      }

      if (route.type === "compare") {
        setCompare(route.heroIds, { sync: false, silent: true });
        switchView("compare");
        setActiveDetailHeroId("");
        closeDetailPanel();
        if (window.location.hash && route.invalid) replaceHash(compareHash());
        return;
      }

      if (route.type === "team") {
        setTeam(route.heroIds, { sync: false, silent: true });
        switchView("team");
        setActiveDetailHeroId("");
        closeDetailPanel();
        if (window.location.hash && route.invalid) replaceHash(teamHash());
        return;
      }

      switchView(route.view);
      setActiveDetailHeroId("");
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
      return rawId ? { type: "hero", heroId: rawId } : { type: "view", view: defaultView, invalid: true };
    }
    if (value.startsWith(COMPARE_ROUTE_PREFIX)) {
      const rawIds = value.slice(COMPARE_ROUTE_PREFIX.length).split(",").map((part) => safeDecode(part).trim()).filter(Boolean);
      const validIds = uniqueValidHeroIds(rawIds).slice(0, maxCompare);
      return { type: "compare", heroIds: validIds, invalid: rawIds.length !== validIds.length };
    }
    if (value.startsWith(TEAM_ROUTE_PREFIX)) {
      const rawIds = value.slice(TEAM_ROUTE_PREFIX.length).split(",").map((part) => safeDecode(part).trim()).filter(Boolean);
      const validIds = uniqueValidHeroIds(rawIds).slice(0, maxTeam);
      return { type: "team", heroIds: validIds, invalid: rawIds.length !== validIds.length };
    }
    if (value.startsWith("#/")) {
      const view = safeDecode(value.slice(2)).trim();
      if (getRouteViews().has(view)) return { type: "view", view, invalid: false };
      return { type: "view", view: defaultView, invalid: true };
    }
    return { type: "view", view: defaultView, invalid: Boolean(value) };
  }

  function viewHash(view) {
    if (view === "compare") return compareHash();
    if (view === "team") return teamHash();
    return `#/${getRouteViews().has(view) ? view : defaultView}`;
  }

  function heroHash(heroId) {
    return `${HERO_ROUTE_PREFIX}${encodeURIComponent(heroId)}`;
  }

  function compareHash() {
    const compare = getCompareIds();
    return compare.length
      ? `${COMPARE_ROUTE_PREFIX}${compare.map((id) => encodeURIComponent(id)).join(",")}`
      : "#/compare";
  }

  function syncHashForView(view, options = {}) {
    if (isOverlayMode() || isRouting) return;
    const next = viewHash(view);
    if (window.location.hash === next) return;
    if (options.replace) {
      replaceHash(next);
    } else {
      window.location.hash = next;
    }
  }

  function syncHashForHero(heroId) {
    if (isOverlayMode() || isRouting) return;
    const next = heroHash(heroId);
    if (window.location.hash !== next) window.location.hash = next;
  }

  function syncHashForCompare(options = {}) {
    if (isOverlayMode() || isRouting || getCurrentView() !== "compare") return;
    const next = compareHash();
    if (window.location.hash === next) return;
    if (options.replace) {
      replaceHash(next);
    } else {
      window.location.hash = next;
    }
  }

  function teamHash() {
    const team = getTeamIds();
    return team.length
      ? `${TEAM_ROUTE_PREFIX}${team.map((id) => encodeURIComponent(id)).join(",")}`
      : "#/team";
  }

  function syncHashForTeam(options = {}) {
    if (isOverlayMode() || isRouting || getCurrentView() !== "team") return;
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

  return {
    initRouter,
    isRouting: () => isRouting,
    syncHashForView,
    syncHashForHero,
    syncHashForCompare,
    syncHashForTeam
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
