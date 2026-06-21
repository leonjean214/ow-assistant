import { fallback } from "./data.js";
import { getLang } from "./i18n.js";

export function create(tagName, className = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}

export function appendText(parent, tagName, text) {
  const node = document.createElement(tagName);
  node.textContent = fallback(text);
  parent.append(node);
  return node;
}

export function createBadge(text, className = "") {
  const badge = create("span", className ? `badge ${className}` : "badge");
  badge.textContent = fallback(text);
  if (className.split(/\s+/).includes("tier-badge")) {
    const tier = String(text || "").replace(/^Tier\s+/i, "").trim().slice(0, 1).toUpperCase();
    if (["S", "A", "B", "C"].includes(tier)) badge.dataset.tier = tier;
  }
  return badge;
}

export function textBadge(text, className = "") {
  return createBadge(text, className);
}

export function createCornerBadge(text, className) {
  const badge = create("span", `corner-badge ${className}`);
  badge.textContent = text;
  return badge;
}

export function createAvatar(hero) {
  const avatar = create("div", "avatar");
  const name = getLang() === "en" ? (hero.name || hero.nameZh || "?") : (hero.nameZh || hero.name || "?");
  const initial = create("span");
  initial.textContent = name.slice(0, 1).toUpperCase();
  avatar.append(initial);
  const url = safeUrl(hero.portrait || hero.avatar || hero.image);
  if (url) {
    const img = document.createElement("img");
    img.alt = getLang() === "en" ? `${name} avatar` : `${name} 头像`;
    img.src = url;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    avatar.append(img);
  }
  return avatar;
}

export function detailSection(title, children) {
  const section = create("section", "detail-section");
  appendText(section, "h3", title);
  children.forEach((child) => section.append(child));
  return section;
}

export function createKeyValueGrid(rows) {
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

export function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}
