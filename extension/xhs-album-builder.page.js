// Generated from src/*.js. Paste this whole file into the browser Console on xiaohongshu.com.
(function () {
  "use strict";

// ---- src/config.js ----
const APP_ID = "tabbit-xhs-album-builder";
const CLEANUP_KEY = "__tabbitXhsAlbumBuilderCleanup";

const DEFAULT_CONFIG = {
  maxScrollRounds: 180,
  scrollStepRatio: 0.82,
  scrollDelay: 720,
  stableRoundsToStop: 5,
  maxTitlesForPrompt: 500,
  maxCategories: 20,
  classificationBatchSize: 100,
  maxClassificationContextCategories: 20,
  llmBatchTimeoutMs: 45_000,
  apiRequestTimeoutMs: 12_000,
  apiRetryCount: 2,
  apiRetryDelay: 520,
  apiAddDelay: 120,
  apiEnsureCollectBeforeMove: false,
  defaultGranularity: "coarse"
};

const integerKeys = {
  maxScrollRounds: [1, 1000],
  stableRoundsToStop: [1, 20],
  maxTitlesForPrompt: [1, 20_000],
  maxCategories: [1, 200],
  classificationBatchSize: [20, 500],
  maxClassificationContextCategories: [1, 200],
  llmBatchTimeoutMs: [5_000, 180_000],
  apiRequestTimeoutMs: [3_000, 60_000],
  apiRetryCount: [0, 10],
  apiRetryDelay: [100, 10_000],
  apiAddDelay: [0, 10_000]
};

function getConfig() {
  const overrides = window.__tabbitXhsAlbumBuilderConfig || {};
  return normalizeConfig({ ...DEFAULT_CONFIG, ...overrides });
}

function normalizeConfig(input) {
  const config = { ...input };
  for (const [key, [min, max]] of Object.entries(integerKeys)) {
    const value = Math.floor(Number(config[key]));
    config[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : DEFAULT_CONFIG[key];
  }

  const ratio = Number(config.scrollStepRatio);
  config.scrollStepRatio = Number.isFinite(ratio) ? Math.max(0.25, Math.min(1.5, ratio)) : DEFAULT_CONFIG.scrollStepRatio;

  config.apiEnsureCollectBeforeMove = config.apiEnsureCollectBeforeMove === true;
  config.defaultGranularity = config.defaultGranularity === "fine" ? "fine" : "coarse";
  return config;
}


// ---- src/state.js ----

const state = {
  observer: null,
  scanTimer: null,
  running: false,
  adding: false,
  collected: [],
  existingAlbums: [],
  plan: null,
  apiModule: null,
  profileUserId: "",
  publicAlbum: false,
  granularity: DEFAULT_CONFIG.defaultGranularity,
  assignmentCache: new Map(),
  boardIdMap: new Map(),
  config: { ...DEFAULT_CONFIG }
};

function resetWorkflowState() {
  state.running = false;
  state.adding = false;
  state.collected = [];
  state.existingAlbums = [];
  state.plan = null;
  state.publicAlbum = false;
  state.assignmentCache = new Map();
  state.boardIdMap = new Map();
}


// ---- src/logger.js ----
function errorMessage(error) {
  if (!error) return "\u672a\u77e5\u9519\u8bef";
  return String(
    error.message ||
      error.msg ||
      error.response?.message ||
      error.response?.msg ||
      error.data?.message ||
      error.data?.msg ||
      error
  ).replace(/\s+/g, " ").trim();
}

function errorDetail(error) {
  if (!error || typeof error !== "object") return {};
  return {
    name: String(error.name || "").trim(),
    message: errorMessage(error),
    code: error.code ?? error.response?.code ?? error.data?.code,
    status: error.status ?? error.response?.status,
    stack: String(error.stack || "").split(" at ").slice(0, 3).join(" at ")
  };
}

const logger = {
  debug(label, detail = undefined) {
    if (detail === undefined) console.debug(`[Tabbit XHS] ${label}`);
    else console.debug(`[Tabbit XHS] ${label}`, detail);
  },
  warn(label, detail = undefined) {
    if (detail === undefined) console.warn(`[Tabbit XHS] ${label}`);
    else console.warn(`[Tabbit XHS] ${label}`, detail);
  },
  error(label, error) {
    console.error(`[Tabbit XHS] ${label}`, {
      error: errorMessage(error),
      detail: errorDetail(error)
    });
  }
};


// ---- src/dom.js ----
function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function visibleAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector)).filter(isVisible);
}

function findVisible(selector, predicate = () => true, root = document) {
  return visibleAll(selector, root).find((element) => predicate(normalizeText(element.textContent), element));
}

function fireClick(element) {
  if (!element) return false;
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  element.click();
  return true;
}

function setInputValue(element, value) {
  if (!element) return;
  const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function waitFor(probe, timeoutMs = 6000, intervalMs = 120) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      let value;
      try {
        value = probe();
      } catch (error) {
        reject(error);
        return;
      }
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("\u7b49\u5f85\u9875\u9762\u5143\u7d20\u8d85\u65f6"));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mergeUnique(items, keyOf, limit = Infinity) {
  const map = new Map();
  for (const item of items) {
    if (map.size >= limit) break;
    const key = keyOf(item);
    if (key && !map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function updateUrlParams(params) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  history.pushState(null, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}


// ---- src/categoryNames.js ----

const OTHER_CATEGORY_NAME = "\u5176\u4ed6";

const quoteChars = /[\u300a\u300b"'`\u201c\u201d\u2018\u2019]/g;
const separatorChars = /[\s:_\uff1a\-\u2014_/|\u00b7.\u3002,\uff0c]+/g;
const trailingIndex = /(?:[#\u7b2c]?\d+|[\uff08(]\d+[\uff09)])$/;

function compactName(name) {
  return normalizeText(name)
    .replace(quoteChars, "")
    .replace(separatorChars, "")
    .toLowerCase();
}

function stripAlbumWords(name) {
  return name
    .replace(trailingIndex, "")
    .replace(/^(\u4e13\u8f91|\u5206\u7c7b|\u5408\u96c6|\u6536\u85cf\u5939|\u6536\u85cf|\u7b14\u8bb0|\u5185\u5bb9)/, "")
    .replace(/(\u4e13\u8f91|\u5206\u7c7b|\u5408\u96c6|\u6536\u85cf\u5939|\u6536\u85cf|\u7b14\u8bb0|\u5185\u5bb9)$/, "")
    .replace(trailingIndex, "");
}

function categoryKey(name) {
  return compactName(name);
}

function cleanCategoryName(name, index) {
  return normalizeText(name).replace(quoteChars, "").slice(0, 18) || `\u5206\u7c7b${index + 1}`;
}

function isOtherName(name) {
  const compact = compactName(name);
  if (!compact) return false;

  const variants = new Set([
    "\u5176\u4ed6",
    "\u5176\u5b83",
    "\u5176\u4ed6\u6536\u85cf",
    "\u5176\u5b83\u6536\u85cf",
    "\u5176\u4ed6\u7b14\u8bb0",
    "\u5176\u5b83\u7b14\u8bb0",
    "\u5176\u4ed6\u5185\u5bb9",
    "\u5176\u5b83\u5185\u5bb9",
    "\u672a\u5206\u7c7b",
    "\u672a\u5f52\u7c7b",
    "\u5f85\u5206\u7c7b",
    "\u5f85\u5f52\u7c7b",
    "\u65e0\u6cd5\u5206\u7c7b",
    "\u65e0\u6cd5\u5f52\u7c7b",
    "\u4e0d\u786e\u5b9a",
    "\u6742\u9879",
    "\u6742\u7c7b",
    "\u5f85\u6574\u7406",
    "\u672a\u6574\u7406"
  ]);

  const stripped = stripAlbumWords(compact);
  if (variants.has(compact) || variants.has(stripped)) return true;
  if (/^(\u5176\u4ed6|\u5176\u5b83|\u672a\u5206\u7c7b|\u672a\u5f52\u7c7b|\u5f85\u5206\u7c7b|\u5f85\u5f52\u7c7b|\u65e0\u6cd5\u5206\u7c7b|\u65e0\u6cd5\u5f52\u7c7b|\u4e0d\u786e\u5b9a|\u6742\u9879|\u6742\u7c7b|\u5f85\u6574\u7406|\u672a\u6574\u7406)\d*$/.test(stripped)) return true;
  if (/^(other|others|misc|miscellaneous|uncategorized|uncategorised|unclassified)(notes?|albums?|categories?|items?|content|favorites?)?\d*$/.test(stripped)) return true;
  return false;
}

function isRegularCategory(category) {
  return !!category && !category.isOther && !isOtherName(category.name || category.title || category);
}


// ---- src/scanner.js ----

const tabBarSelector = ".tab-content-item .sub-tab-list, .tab-content-item .reds-tabs-list, .feeds-tab-container .sub-tab-list";
const noteLinkSelector = [
  "section.note-item a[href]",
  ".note-item a[href]",
  "a.title[href]",
  'a[href*="/explore/"]',
  'a[href*="/discovery/item/"]',
  'a[href*="/board/"]'
].join(", ");

function isXhsPage() {
  return /xiaohongshu\.com$/i.test(location.hostname) || /xiaohongshu\.com/i.test(location.hostname);
}

function isFavNotePage() {
  const url = new URL(location.href);
  return isXhsPage() && url.searchParams.get("tab") === "fav" && url.searchParams.get("subTab") === "note";
}

function findFavSubTabBar() {
  return Array.from(document.querySelectorAll(tabBarSelector)).find((element) => {
    const text = normalizeText(element.textContent);
    return isVisible(element) && /\u7b14\u8bb0\s*\u30fb?\s*\d*/.test(text) && /\u4e13\u8f91\s*\u30fb?\s*\d*/.test(text);
  });
}

function findFavSubTab(matcher) {
  const bar = findFavSubTabBar();
  if (!bar) return null;
  return Array.from(bar.querySelectorAll('.reds-tab-item, [role="tab"], button, a')).find((element) => {
    return isVisible(element) && matcher(normalizeText(element.textContent), element);
  });
}

async function switchToNoteTab() {
  const tab = findFavSubTab((text) => /\u7b14\u8bb0/.test(text));
  if (tab) {
    tab.scrollIntoView({ block: "center", inline: "center" });
    fireClick(tab);
    await sleep(900);
    return;
  }
  updateUrlParams({ tab: "fav", subTab: "note" });
  await sleep(1200);
}

async function switchToAlbumTab() {
  const tab = findFavSubTab((text) => /\u4e13\u8f91/.test(text));
  if (tab) {
    tab.scrollIntoView({ block: "center", inline: "center" });
    fireClick(tab);
    await sleep(900);
    return;
  }
  updateUrlParams({ tab: "fav", subTab: "board" });
  await sleep(1200);
}

function extractNoteId(href) {
  const value = String(href || "");
  const match =
    value.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/) ||
    value.match(/\/user\/profile\/[A-Za-z0-9_-]+\/([A-Za-z0-9]+)/) ||
    value.match(/\/board\/[A-Za-z0-9_-]+\/([A-Za-z0-9]+)/) ||
    value.match(/[?&](?:note_id|noteId|notes_id|notesId)=([A-Za-z0-9]+)/);
  return match ? match[1] : "";
}

function noteKey(note) {
  return note.noteId || String(note.href || "").split("#")[0].split("?")[0] || normalizeText(note.title);
}

function isCollectedHref(href) {
  if (!extractNoteId(href)) return false;
  try {
    const url = new URL(href, location.origin);
    if (normalizeText(url.searchParams.get("xsec_source")).toLowerCase().includes("collect")) return true;
    return isFavNotePage() && /\/(?:explore|discovery\/item|board)\//.test(url.href);
  } catch {
    return /xsec_source=[^&#]*collect/i.test(String(href)) || isFavNotePage();
  }
}

function titleLooksValid(title) {
  const text = normalizeText(title);
  if (!text || text.length < 2 || text.length > 160) return false;
  if (/^(\u8d5e|\u8bc4\u8bba|\u6536\u85cf|\u5206\u4eab|\u66f4\u591a|\u767b\u5f55|\u6253\u5f00APP|\u5c0f\u7ea2\u4e66|\u5173\u6ce8|\u5df2\u5173\u6ce8)$/i.test(text)) return false;
  if (/^\d+(\.\d+)?[\u4e07wWkK]?$/.test(text)) return false;
  return true;
}

function extractTitle(card, link) {
  const selectors = ["a.title", ".title", '[class*="title"]', '[class*="Title"]', "[title]", "[aria-label]"];
  for (const selector of selectors) {
    for (const element of Array.from(card?.querySelectorAll?.(selector) || [])) {
      const title = normalizeText(element.textContent || element.getAttribute("title") || element.getAttribute("aria-label"));
      if (titleLooksValid(title)) return title;
    }
  }
  const imageAlt = normalizeText(card?.querySelector?.("img")?.alt);
  if (titleLooksValid(imageAlt)) return imageAlt;
  const fallback = normalizeText(link?.textContent || link?.getAttribute?.("title") || link?.getAttribute?.("aria-label"));
  return titleLooksValid(fallback) ? fallback : "";
}

function resolveNoteHref(link) {
  const anchors = [];
  if (link?.matches?.("a[href]")) anchors.push(link);
  const card = link?.closest?.('section.note-item, .note-item, [class*="note-item"], [class*="NoteItem"], [data-note-id], [data-id], article, li, section');
  if (card) anchors.push(...Array.from(card.querySelectorAll("a[href]")));

  let firstWithNoteId = "";
  for (const anchor of anchors) {
    const href = anchor.href || anchor.getAttribute("href") || "";
    if (!extractNoteId(href)) continue;
    if (isCollectedHref(href)) return href;
    if (!firstWithNoteId) firstWithNoteId = href;
  }
  return firstWithNoteId;
}

function collectVisibleNotes() {
  if (!isFavNotePage()) return [];
  const notes = [];
  for (const link of visibleAll(noteLinkSelector)) {
    const href = resolveNoteHref(link);
    if (!isCollectedHref(href)) continue;
    const card = link.closest('section.note-item, .note-item, [class*="note-item"], [class*="NoteItem"], [data-note-id], [data-id], article, li, section') || link;
    const title = extractTitle(card, link) || (extractNoteId(href) ? `\u7b14\u8bb0 ${extractNoteId(href)}` : "");
    if (!titleLooksValid(title)) continue;
    notes.push({ title, href, noteId: extractNoteId(href), isCollected: true });
  }
  return mergeUnique(notes, noteKey);
}

async function scanCollectedNotes(config, onProgress = () => {}) {
  if (!isFavNotePage()) throw new Error("\u8bf7\u5148\u5207\u6362\u5230\u6536\u85cf\u9875\u7684\u7b14\u8bb0\u5b50\u5206\u7c7b\u540e\u518d\u8fd0\u884c\u3002");

  const originalY = window.scrollY;
  const limit = Math.max(1, Number(config.maxTitlesForPrompt) || 500);
  const maxRounds = Math.max(config.maxScrollRounds, Math.ceil(limit / 12) + 20);
  let notes = collectVisibleNotes().slice(0, limit);
  let previousCount = notes.length;
  let stableRounds = 0;
  let unchangedHeightRounds = 0;
  let previousY = window.scrollY;
  let previousHeight = document.documentElement.scrollHeight;

  for (let round = 0; round < maxRounds; round += 1) {
    if (notes.length >= limit) {
      onProgress(58, `\u5df2\u8fbe\u5230\u6807\u9898\u9009\u62e9\u4e0a\u9650 ${limit}\uff0c\u505c\u6b62\u6eda\u52a8`);
      break;
    }

    onProgress(Math.min(58, 10 + (round / Math.max(1, maxRounds)) * 48), `\u6b63\u5728\u6eda\u52a8\u6536\u85cf\u7b14\u8bb0\uff0c\u5df2\u6355\u83b7 ${notes.length}/${limit} \u4e2a\u6807\u9898`);
    window.scrollBy({ top: Math.max(520, Math.floor(window.innerHeight * config.scrollStepRatio)), behavior: "smooth" });
    await sleep(config.scrollDelay);

    notes = mergeUnique(notes.concat(collectVisibleNotes()), noteKey, limit);

    const currentY = window.scrollY;
    const currentHeight = document.documentElement.scrollHeight;
    const atBottom = window.innerHeight + currentY >= currentHeight - 160;
    const countStable = notes.length === previousCount;
    const heightStable = Math.abs(currentHeight - previousHeight) < 4;

    stableRounds = atBottom && countStable && heightStable ? stableRounds + 1 : 0;
    unchangedHeightRounds = Math.abs(currentY - previousY) > 8 || !heightStable ? 0 : unchangedHeightRounds + 1;
    previousCount = notes.length;
    previousY = currentY;
    previousHeight = currentHeight;

    if (stableRounds >= Math.max(2, config.stableRoundsToStop) || (atBottom && unchangedHeightRounds >= 2)) break;
  }

  window.scrollTo({ top: originalY, behavior: "smooth" });
  logger.debug("\u626b\u63cf\u6536\u85cf\u7b14\u8bb0\u5b8c\u6210", { count: notes.length, limit });
  return notes;
}


// ---- src/albums.js ----

const albumCardSelector = 'a[href*="/board/"], .board-card, [class*="board-card"], [class*="board-item"]';
const xhsModalSelector = ".reds-modal-open .modal, .reds-modal-open [role='dialog'], .modal";

function extractBoardId(href) {
  const value = String(href || "");
  const match = value.match(/\/board\/([A-Za-z0-9]+)/) || value.match(/[?&]boardId=([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
}

function readAlbumsFromDom() {
  const albums = new Map();
  for (const element of Array.from(document.querySelectorAll(albumCardSelector))) {
    if (!isVisible(element)) continue;
    const anchor = element.matches?.('a[href*="/board/"]') ? element : element.querySelector?.('a[href*="/board/"]');
    const id = extractBoardId(anchor?.href || anchor?.getAttribute?.("href"));
    const nameNode = element.querySelector?.('.board-name, [class*="board-name"], .name, [class*="name"]');
    const name = normalizeText(nameNode?.textContent || element.textContent).replace(/\s*\u7b14\u8bb0\s*\u30fb?\s*\d+.*$/i, "");
    if (!name || /\u521b\u5efa\u4e13\u8f91|\u7f16\u8f91\u4e13\u8f91/.test(name)) continue;
    if (!albums.has(name)) albums.set(name, { id, name });
    else if (id && !albums.get(name).id) albums.get(name).id = id;
  }

  for (const node of Array.from(document.querySelectorAll('.board-name, .board-card .board-name, [class*="board-name"]'))) {
    const name = normalizeText(node.textContent).replace(/\s*\u7b14\u8bb0\s*\u30fb?\s*\d+.*$/i, "");
    if (name && !albums.has(name) && !/\u521b\u5efa\u4e13\u8f91|\u7f16\u8f91\u4e13\u8f91/.test(name)) albums.set(name, { id: "", name });
  }

  return Array.from(albums.values());
}

async function readExistingAlbums(config, onProgress = () => {}) {
  await switchToAlbumTab();
  await sleep(700);

  const originalY = window.scrollY;
  const albums = new Map();
  let previousCount = 0;
  let stableRounds = 0;
  const rounds = Math.min(config.maxScrollRounds, 22);

  for (let round = 0; round < rounds; round += 1) {
    for (const album of readAlbumsFromDom()) {
      if (!albums.has(album.name)) albums.set(album.name, album);
      else if (album.id && !albums.get(album.name).id) albums.get(album.name).id = album.id;
    }

    onProgress(Math.min(30, 10 + round), `\u6b63\u5728\u8bfb\u53d6\u5df2\u6709\u4e13\u8f91\uff0c\u5df2\u53d1\u73b0 ${albums.size} \u4e2a`);
    stableRounds = albums.size === previousCount ? stableRounds + 1 : 0;
    previousCount = albums.size;

    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 96;
    if ((atBottom && stableRounds >= 1) || stableRounds >= 4) break;

    window.scrollBy({ top: Math.max(520, Math.floor(window.innerHeight * config.scrollStepRatio)), behavior: "smooth" });
    await sleep(config.scrollDelay);
  }

  window.scrollTo({ top: originalY, behavior: "smooth" });
  await sleep(350);

  const result = Array.from(albums.values());
  logger.debug("\u8bfb\u53d6\u5df2\u6709\u4e13\u8f91\u5b8c\u6210", { count: result.length, albums: result.slice(0, 20) });
  return result;
}

function albumIntro(album) {
  if (album.intro) return normalizeText(album.intro).slice(0, 140);
  const sample = (album.titles || []).slice(0, 3).join("\u3001");
  return `\u7531\u6536\u85cf\u7b14\u8bb0\u667a\u80fd\u5f52\u7c7b\u751f\u6210\uff0c\u5305\u542b ${album.count || (album.titles || []).length || 0} \u7bc7\u76f8\u5173\u5185\u5bb9${sample ? `\uff1a${sample}` : ""}\u3002`.slice(0, 140);
}

async function openCreateAlbumDialog() {
  let button = findVisible(".create-board, button, div, a", (text) => text === "\u521b\u5efa\u4e13\u8f91" || text === "\u521b\u5efa");
  if (!button) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await sleep(700);
    button = findVisible(".create-board, button, div, a", (text) => text === "\u521b\u5efa\u4e13\u8f91" || text === "\u521b\u5efa");
  }
  if (!button) throw new Error("\u6ca1\u6709\u627e\u5230\u201c\u521b\u5efa\u4e13\u8f91\u201d\u5165\u53e3");

  button.scrollIntoView({ block: "center", inline: "center" });
  await sleep(120);
  fireClick(button);
  return waitFor(() => Array.from(document.querySelectorAll(xhsModalSelector)).find((element) => {
    return !element.closest("#tabbit-xhs-album-builder-overlay") && isVisible(element);
  }), 6000);
}

function setAlbumVisibility(modal, shouldPublic) {
  const switchNode = modal.querySelector('.dot-container.switch, [class*="dot-container"][class*="switch"], [role="switch"]');
  if (!switchNode) return;
  const isPublic = switchNode.classList.contains("turn-on") || switchNode.getAttribute("aria-checked") === "true";
  if (isPublic !== shouldPublic) fireClick(switchNode);
}

async function createAlbumViaUi(album, publicAlbum) {
  const modal = await openCreateAlbumDialog();
  const titleInput = findAlbumTitleInput(modal);
  const introInput = findAlbumIntroInput(modal);
  if (!titleInput) throw new Error("\u6ca1\u6709\u627e\u5230\u4e13\u8f91\u6807\u9898\u8f93\u5165\u6846");

  setInputValue(titleInput, album.name);
  if (introInput) setInputValue(introInput, albumIntro(album));
  setAlbumVisibility(modal, publicAlbum);
  await sleep(240);

  const done = Array.from(modal.querySelectorAll(".btn.done, button, div")).find((element) => isVisible(element) && normalizeText(element.textContent) === "\u5b8c\u6210");
  if (!done) throw new Error("\u6ca1\u6709\u627e\u5230\u5b8c\u6210\u6309\u94ae");

  fireClick(done);
  await waitFor(() => !Array.from(document.querySelectorAll(xhsModalSelector)).some((element) => {
    return !element.closest("#tabbit-xhs-album-builder-overlay") && isVisible(element);
  }), 9000).catch(() => null);
  await sleep(950);
}

function findAlbumTitleInput(modal) {
  const candidates = Array.from(modal.querySelectorAll([
    'input.input-content',
    'input[type="text"]',
    "input:not([type])",
    'input[placeholder*="\u4e13\u8f91"]',
    'input[placeholder*="\u6807\u9898"]',
    'input[placeholder*="\u540d\u79f0"]'
  ].join(", ")));
  return candidates.find((element) => {
    const placeholder = normalizeText(element.getAttribute("placeholder"));
    const type = normalizeText(element.getAttribute("type")).toLowerCase();
    return isVisible(element) && type !== "hidden" && !/\u641c\u7d22|search/i.test(placeholder);
  }) || candidates.find(isVisible) || null;
}

function findAlbumIntroInput(modal) {
  return Array.from(modal.querySelectorAll([
    "textarea.textarea-content",
    "textarea",
    'input[placeholder*="\u7b80\u4ecb"]',
    'input[placeholder*="\u4ecb\u7ecd"]',
    '[contenteditable="true"]'
  ].join(", "))).find((element) => {
    const placeholder = normalizeText(element.getAttribute("placeholder"));
    return isVisible(element) && !/\u641c\u7d22|search/i.test(placeholder);
  }) || null;
}

async function createAlbums(plan, existingAlbums, publicAlbum, config, onProgress = () => {}) {
  await switchToAlbumTab();
  await sleep(800);

  const existingNames = new Set(existingAlbums.map((album) => album.name || album).filter(Boolean));
  const existingKeys = new Set(Array.from(existingNames).map(categoryKey).filter(Boolean));
  const result = { created: [], skipped: [], failed: [] };
  const categories = (plan.categories || []).filter(isRegularCategory);

  for (let index = 0; index < categories.length; index += 1) {
    const album = categories[index];
    onProgress(18 + Math.round((index / Math.max(1, categories.length)) * 72), `\u6b63\u5728\u5904\u7406 ${index + 1}/${categories.length}\uff1a${album.name}`);

    const key = categoryKey(album.name);
    if (existingNames.has(album.name) || existingKeys.has(key)) {
      result.skipped.push(album.name);
      continue;
    }

    try {
      await createAlbumViaUi(album, publicAlbum);
      result.created.push(album.name);
      existingNames.add(album.name);
      existingKeys.add(key);
    } catch (error) {
      result.failed.push({ name: album.name, error: error.message || String(error) });
      logger.error(`\u521b\u5efa\u4e13\u8f91\u5931\u8d25\uff1a${album.name}`, error);
    }
  }

  logger.debug("\u521b\u5efa\u4e13\u8f91\u7ed3\u679c", result);
  return result;
}


// ---- src/classifier.js ----

function introFor(category) {
  if (category.intro) return normalizeText(category.intro).slice(0, 140);
  const sample = (category.titles || []).slice(0, 3).join("\u3001");
  return `\u7531\u6536\u85cf\u7b14\u8bb0\u667a\u80fd\u5f52\u7c7b\u751f\u6210\uff0c\u5305\u542b ${category.count || (category.titles || []).length || 0} \u7bc7\u76f8\u5173\u5185\u5bb9${sample ? `\uff1a${sample}` : ""}\u3002`.slice(0, 140);
}

function appendTitle(category, title) {
  const clean = normalizeText(title);
  if (!clean) return;
  if (!category._titleSet) Object.defineProperty(category, "_titleSet", { value: new Set(category.titles || []), enumerable: false });
  if (category._titleSet.has(clean)) return;
  category._titleSet.add(clean);
  category.titles.push(clean);
  category.count = category.titles.length;
  state.assignmentCache.set(clean, category.name);
  state.assignmentCache.set(clean.toLowerCase().replace(/\s+/g, ""), category.name);
}

function usedRegularCount(categoryMap) {
  return Array.from(categoryMap.values()).filter((category) => isRegularCategory(category) && (category.titles?.length || !category.isExisting)).length;
}

function canAddCategory(categoryMap, config) {
  return usedRegularCount(categoryMap) < config.maxCategories;
}

function createExistingCategoryMap(existingAlbumNames, config) {
  const map = new Map();
  for (const rawName of existingAlbumNames || []) {
    if (map.size >= Math.min(config.maxCategories, config.maxClassificationContextCategories)) break;
    const name = cleanCategoryName(rawName, map.size);
    if (!name || isOtherName(name)) continue;
    const key = categoryKey(name);
    if (!map.has(key)) {
      map.set(key, { name, title: name, intro: "\u5df2\u6709\u5c0f\u7ea2\u4e66\u4e13\u8f91\uff0c\u4f18\u5148\u590d\u7528\u3002", count: 0, titles: [], isExisting: true });
    }
  }
  return map;
}

function localCategoryForTitle(title, granularity) {
  const text = normalizeText(title);
  const fineRules = [
    ["\u897f\u85cf\u65c5\u884c", ["\u897f\u85cf", "\u62c9\u8428", "\u963f\u91cc", "\u5ddd\u85cf", "\u6ce2\u5bc6", "\u85cf\u4e1c", "\u51b0\u5ddd", "\u559c\u9a6c\u62c9\u96c5", "318"]],
    ["\u65b0\u7586\u8def\u7ebf", ["\u65b0\u7586", "\u963f\u52d2\u6cf0", "\u4f0a\u7281", "\u8d5b\u91cc\u6728\u6e56", "\u79be\u6728", "\u5580\u7eb3\u65af", "\u5b89\u96c6\u6d77"]],
    ["\u65e5\u672c\u65c5\u884c", ["\u65e5\u672c", "\u4e1c\u4eac", "\u5927\u962a", "\u4eac\u90fd", "\u5317\u6d77\u9053", "\u5bcc\u58eb"]],
    ["\u6d77\u6ee8\u57ce\u5e02", ["\u5a01\u6d77", "\u84dd\u773c\u6cea", "\u6d77\u8fb9", "\u6d77\u6ee8"]],
    ["\u7f8e\u98df", ["\u7f8e\u98df", "\u9910\u5385", "\u5496\u5561", "\u751c\u54c1", "\u706b\u9505", "\u70e7\u70e4", "\u83dc\u8c31", "\u98df\u8c31"]],
    ["\u7a7f\u642d\u7f8e\u5986", ["\u7a7f\u642d", "\u5986", "\u53e3\u7ea2", "\u62a4\u80a4", "\u53d1\u578b", "\u9999\u6c34"]],
    ["\u5b66\u4e60\u5de5\u4f5c", ["\u5b66\u4e60", "\u8bba\u6587", "\u82f1\u8bed", "\u8003\u7814", "\u5de5\u4f5c", "\u6548\u7387", "\u7b14\u8bb0"]],
    ["\u5bb6\u5c45\u751f\u6d3b", ["\u5bb6\u5c45", "\u88c5\u4fee", "\u6536\u7eb3", "\u623f\u95f4", "\u79df\u623f"]],
    ["\u673a\u4f4d\u4e0e\u62cd\u7167", ["\u673a\u4f4d", "\u62cd\u7167", "\u6444\u5f71", "\u6ee4\u955c", "\u58c1\u7eb8", "live"]]
  ];
  const coarseRules = [
    ["\u65c5\u884c", ["\u65c5\u884c", "\u65c5\u6e38", "\u897f\u85cf", "\u62c9\u8428", "\u963f\u91cc", "\u5ddd\u85cf", "\u65b0\u7586", "\u963f\u52d2\u6cf0", "\u4f0a\u7281", "\u5a01\u6d77", "\u65e5\u672c", "\u6cf0\u56fd", "\u56fd\u5916", "\u6d77\u5916", "\u6d77\u8fb9", "\u653b\u7565", "\u8def\u7ebf", "\u666f\u70b9"]],
    ["\u7f8e\u98df", ["\u7f8e\u98df", "\u9910\u5385", "\u5496\u5561", "\u751c\u54c1", "\u706b\u9505", "\u70e7\u70e4", "\u83dc\u8c31", "\u98df\u8c31"]],
    ["\u7a7f\u642d\u7f8e\u5986", ["\u7a7f\u642d", "\u5986", "\u53e3\u7ea2", "\u62a4\u80a4", "\u53d1\u578b", "\u9999\u6c34"]],
    ["\u5b66\u4e60\u5de5\u4f5c", ["\u5b66\u4e60", "\u8bba\u6587", "\u82f1\u8bed", "\u8003\u7814", "\u5de5\u4f5c", "\u6548\u7387", "\u7b14\u8bb0"]],
    ["\u5bb6\u5c45\u751f\u6d3b", ["\u5bb6\u5c45", "\u88c5\u4fee", "\u6536\u7eb3", "\u623f\u95f4", "\u79df\u623f"]],
    ["\u62cd\u7167\u673a\u4f4d", ["\u673a\u4f4d", "\u62cd\u7167", "\u6444\u5f71", "\u6ee4\u955c", "\u58c1\u7eb8", "live"]]
  ];
  const rules = granularity === "fine" ? fineRules : coarseRules;
  return rules.find(([, keys]) => keys.some((key) => text.includes(key)))?.[0] || OTHER_CATEGORY_NAME;
}

function assignLocally(batch, categoryMap, otherCategory, granularity, config) {
  for (const note of batch) {
    const title = normalizeText(note.title);
    if (!title) continue;

    let category = Array.from(categoryMap.values()).find((candidate) => title.includes(candidate.name) || candidate.name.includes(title));
    if (!category) {
      const localName = localCategoryForTitle(title, granularity);
      if (!isOtherName(localName)) {
        const key = categoryKey(localName);
        if (!categoryMap.has(key) && canAddCategory(categoryMap, config)) {
          categoryMap.set(key, { name: localName, title: localName, intro: "", count: 0, titles: [], isExisting: false });
        }
        category = categoryMap.get(key);
      }
    }
    appendTitle(category || otherCategory, title);
  }
}

function parseJsonLoose(value) {
  if (!value) throw new Error("LLMBridge \u8fd4\u56de\u4e3a\u7a7a");
  if (typeof value === "object") return value;
  const text = String(value).trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw error;
  }
}

async function callLlm(prompt, config) {
  if (!window.LLMBridge || typeof window.LLMBridge.chat !== "function") {
    throw new Error("LLMBridge \u4e0d\u5b58\u5728");
  }

  let timer = null;
  try {
    const result = await Promise.race([
      window.LLMBridge.chat(prompt, "json"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`LLMBridge \u5206\u6279\u5206\u6790\u8d85\u8fc7 ${Math.round(config.llmBatchTimeoutMs / 1000)} \u79d2`)), config.llmBatchTimeoutMs);
      })
    ]);
    return parseJsonLoose(result);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildPrompt(batch, categoryMap, batchIndex, batchCount, granularity, config) {
  const categories = Array.from(categoryMap.values());
  const context = [
    ...categories.filter((category) => category.titles?.length || !category.isExisting),
    ...categories.filter((category) => category.isExisting && !category.titles?.length)
  ].slice(0, Math.min(config.maxCategories, config.maxClassificationContextCategories));

  const contextText = context.length
    ? context.map((category, index) => {
        const sample = (category.titles || []).slice(0, 2).map((title) => normalizeText(title).slice(0, 28)).join(" / ");
        return `${index + 1}. ${category.name}${category.isExisting ? "\uff08\u5df2\u6709\u4e13\u8f91\uff09" : "\uff08\u65b0\u589e\u5206\u7c7b\uff09"}${sample ? `\uff1b\u5df2\u5f52\u7c7b\u793a\u4f8b\uff1a${sample}` : ""}`;
      }).join("\n")
    : "\u6682\u65e0\u5df2\u6709\u5206\u7c7b\u3002";

  const remaining = Math.max(0, config.maxCategories - usedRegularCount(categoryMap));
  const granularityInstruction =
    granularity === "fine"
      ? "\u5f53\u524d\u4e3a\u7ec6\u7c92\u5ea6\uff1a\u5141\u8bb8\u6309\u56fd\u5bb6\u3001\u57ce\u5e02\u3001\u5730\u533a\u3001\u8def\u7ebf\u3001\u5185\u5bb9\u4e3b\u9898\u7ee7\u7eed\u62c6\u5206\u3002\u4f8b\u5982\u201c\u65e5\u672c\u65c5\u884c\u201d\u548c\u201c\u6cf0\u56fd\u65c5\u884c\u201d\u53ef\u4ee5\u5206\u522b\u5f52\u4e3a\u201c\u65e5\u672c\u65c5\u884c\u201d\u201c\u6cf0\u56fd\u65c5\u884c\u201d\uff1b\u4f46\u4ecd\u8981\u907f\u514d\u4e3a\u5355\u7bc7\u6807\u9898\u5355\u72ec\u5efa\u7c7b\u3002"
      : "\u5f53\u524d\u4e3a\u7c97\u7c92\u5ea6\uff1a\u4f18\u5148\u5408\u5e76\u4e3a\u66f4\u5927\u7684\u901a\u7528\u4e3b\u9898\uff0c\u4e0d\u6309\u56fd\u5bb6\u3001\u57ce\u5e02\u6216\u8def\u7ebf\u8fc7\u5ea6\u62c6\u5206\u3002\u4f8b\u5982\u201c\u65e5\u672c\u65c5\u884c\u201d\u201c\u6cf0\u56fd\u65c5\u884c\u201d\u201c\u65b0\u7586\u65c5\u884c\u201d\u5e94\u4f18\u5148\u5408\u5e76\u4e3a\u201c\u65c5\u884c\u201d\uff1b\u53ea\u6709\u4e3b\u9898\u660e\u663e\u4e0d\u540c\u624d\u62c6\u5206\u3002";
  const addInstruction =
    remaining > 0
      ? granularity === "fine"
        ? "\u53ea\u6709\u5f53\u6807\u9898\u65e0\u6cd5\u81ea\u7136\u5f52\u5165\u73b0\u6709\u5206\u7c7b\u65f6\uff0c\u624d\u53ef\u4ee5\u65b0\u589e\u66f4\u5177\u4f53\u5206\u7c7b\uff1b\u65b0\u589e\u5206\u7c7b\u540d\u53ef\u4ee5\u6309\u56fd\u5bb6\u3001\u57ce\u5e02\u3001\u5730\u533a\u3001\u8def\u7ebf\u6216\u660e\u786e\u4e3b\u9898\u62c6\u5206\uff0c\u4f46\u4e0d\u8981\u4e3a\u5355\u7bc7\u6807\u9898\u5355\u72ec\u5efa\u7c7b\u3002"
        : "\u53ea\u6709\u5f53\u6807\u9898\u65e0\u6cd5\u81ea\u7136\u5f52\u5165\u73b0\u6709\u5206\u7c7b\u65f6\uff0c\u624d\u53ef\u4ee5\u65b0\u589e\u5bbd\u6cdb\u5206\u7c7b\uff1b\u65b0\u589e\u5206\u7c7b\u540d\u8981\u9002\u5408\u4f5c\u4e3a\u4e13\u8f91\u6807\u9898\uff0c\u7b80\u77ed\u81ea\u7136\uff0c\u4e0d\u8981\u592a\u7ec6\u3002"
      : "\u5e38\u89c4\u5206\u7c7b\u5df2\u8fbe\u5230\u4e0a\u9650\uff0c\u7981\u6b62\u65b0\u589e\u5e38\u89c4\u5206\u7c7b\uff1b\u65e0\u6cd5\u5f52\u5165\u73b0\u6709\u5206\u7c7b\u7684\u6807\u9898\u5fc5\u987b\u653e\u5165\u201c\u5176\u4ed6\u201d\u3002";
  const titles = batch.map((note, index) => `${index + 1}. ${note.title}`).join("\n");

  return [
    "\u4f60\u662f\u5c0f\u7ea2\u4e66\u6536\u85cf\u6574\u7406\u52a9\u624b\u3002\u73b0\u5728\u6309\u6279\u6b21\u6574\u7406\u7528\u6237\u6536\u85cf\u7b14\u8bb0\u6807\u9898\uff0c\u5e76\u7ef4\u62a4\u4e00\u7ec4\u7a33\u5b9a\u7684\u5c0f\u7ea2\u4e66\u4e13\u8f91\u5206\u7c7b\u3002",
    `\u8fd9\u662f\u7b2c ${batchIndex + 1}/${batchCount} \u6279\uff0c\u6bcf\u6279\u6700\u591a ${config.classificationBatchSize} \u4e2a\u6807\u9898\u3002${granularityInstruction}`,
    `\u5f53\u524d\u5df2\u6709/\u5df2\u65b0\u589e\u7684\u5e38\u89c4\u5206\u7c7b\u5982\u4e0b\u3002\u8bf7\u4f18\u5148\u590d\u7528\u8fd9\u4e9b\u5206\u7c7b\uff0c\u4e0d\u8981\u56e0\u4e3a\u8868\u8fbe\u7565\u6709\u5dee\u5f02\u5c31\u65b0\u589e\u5206\u7c7b\uff1a\n${contextText}`,
    `\u5e38\u89c4\u5206\u7c7b\u603b\u4e0a\u9650\u4e3a ${config.maxCategories} \u4e2a\uff0c\u5f53\u524d\u5df2\u6709 ${usedRegularCount(categoryMap)} \u4e2a\u5df2\u4f7f\u7528\u5206\u7c7b\uff0c\u8fd8\u53ef\u4ee5\u65b0\u589e ${remaining} \u4e2a\u3002`,
    addInstruction,
    "\u53ea\u505a\u672c\u6279\u6807\u9898\u5230\u5206\u7c7b\u540d\u7684\u6620\u5c04\uff0c\u4e0d\u8981\u89e3\u91ca\uff0c\u4e0d\u8981\u590d\u8ff0\u6807\u9898\u5168\u6587\u3002\u6bcf\u4e2a\u5e8f\u53f7\u5fc5\u987b\u4e14\u53ea\u80fd\u5f52\u5165\u4e00\u4e2a\u5206\u7c7b\u3002\u65e0\u6cd5\u53ef\u9760\u5f52\u5165\u5e38\u89c4\u5206\u7c7b\u7684\u5e8f\u53f7\u653e\u5165\u201c\u5176\u4ed6\u201d\u3002",
    '\u53ea\u8fd4\u56de JSON\uff0c\u7ed3\u6784\uff1a{"items":[{"i":1,"name":"\u5df2\u6709\u6216\u65b0\u589e\u4e13\u8f91\u6807\u9898"}]}\u3002i \u662f\u6807\u9898\u5e8f\u53f7\uff0cname \u662f\u5206\u7c7b\u540d\u3002',
    "",
    titles
  ].join("\n");
}

function applyLlmAssignments(batch, payload, categoryMap, otherCategory, config) {
  const assignments = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.assignments) ? payload.assignments : [];
  if (!assignments.length) return false;

  const handled = new Set();
  for (const item of assignments) {
    const note = batch[Number(item.i ?? item.index ?? item.id) - 1];
    const title = normalizeText(item.title || note?.title);
    const rawName = normalizeText(item.name || item.category || item.album);
    if (!note || !title || !rawName || handled.has(title)) continue;

    let category = otherCategory;
    const name = cleanCategoryName(rawName, categoryMap.size);
    if (!isOtherName(name)) {
      const key = categoryKey(name);
      if (!categoryMap.has(key) && canAddCategory(categoryMap, config)) {
        categoryMap.set(key, { name, title: name, intro: "", count: 0, titles: [], isExisting: false });
      }
      category = categoryMap.get(key) || otherCategory;
    }

    appendTitle(category, title);
    handled.add(title);
  }

  for (const note of batch) {
    const title = normalizeText(note.title);
    if (title && !handled.has(title)) appendTitle(otherCategory, title);
  }
  return true;
}

async function classifyNotes(notes, existingAlbumNames, options, onProgress = () => {}) {
  const { config, granularity } = options;
  const selected = notes.slice(0, config.maxTitlesForPrompt);
  const batchSize = Math.max(20, Number(config.classificationBatchSize) || 100);
  const batches = [];
  for (let index = 0; index < selected.length; index += batchSize) batches.push(selected.slice(index, index + batchSize));

  const categoryMap = createExistingCategoryMap(existingAlbumNames, config);
  const otherCategory = { name: OTHER_CATEGORY_NAME, title: OTHER_CATEGORY_NAME, intro: "\u672a\u80fd\u53ef\u9760\u5f52\u5165\u4e0a\u8ff0\u5206\u7c7b\u7684\u6536\u85cf\u7b14\u8bb0\uff0c\u4f5c\u4e3a\u5907\u6ce8\u4fdd\u7559\u3002", count: 0, titles: [], isOther: true };
  state.assignmentCache = new Map();

  for (let index = 0; index < batches.length; index += 1) {
    onProgress(Math.min(90, 64 + Math.round((index / Math.max(1, batches.length)) * 25)), `\u6b63\u5728\u6309${granularity === "fine" ? "\u7ec6\u7c92\u5ea6" : "\u7c97\u7c92\u5ea6"}\u5206\u6279\u5206\u6790 ${index + 1}/${batches.length}`);

    const batch = batches[index];
    if (!window.LLMBridge || typeof window.LLMBridge.chat !== "function") {
      assignLocally(batch, categoryMap, otherCategory, granularity, config);
      await sleep(40);
      continue;
    }

    try {
      const prompt = buildPrompt(batch, categoryMap, index, batches.length, granularity, config);
      const payload = await callLlm(prompt, config);
      if (!applyLlmAssignments(batch, payload, categoryMap, otherCategory, config)) {
        assignLocally(batch, categoryMap, otherCategory, granularity, config);
      }
    } catch (error) {
      logger.warn("LLM \u5206\u6279\u5206\u7c7b\u5931\u8d25\uff0c\u4f7f\u7528\u672c\u5730\u515c\u5e95", { error: errorMessage(error), detail: errorDetail(error) });
      assignLocally(batch, categoryMap, otherCategory, granularity, config);
    }
    await sleep(80);
  }

  const categories = Array.from(categoryMap.values())
    .filter((category) => category.titles.length && isRegularCategory(category))
    .map((category) => ({ ...category, intro: introFor(category), count: category.titles.length }));
  if (otherCategory.titles.length) categories.push({ ...otherCategory, intro: introFor(otherCategory), count: otherCategory.titles.length });

  const plan = {
    categories,
    analyzedTitleCount: selected.length,
    totalTitleCount: notes.length,
    titleSelectionLimit: config.maxTitlesForPrompt,
    categoryLimit: config.maxCategories,
    batchSize,
    existingAlbumCount: existingAlbumNames.length,
    granularity
  };
  logger.debug("\u5206\u7c7b\u7ed3\u679c", plan);
  return plan;
}


// ---- src/manualReview.js ----

function compactTitle(title) {
  return normalizeText(title).toLowerCase().replace(/\s+/g, "");
}

function categoryIntro(category) {
  const sample = (category.titles || []).slice(0, 3).join("\u3001");
  return `\u7531\u6536\u85cf\u7b14\u8bb0\u667a\u80fd\u5f52\u7c7b\u751f\u6210\uff0c\u5305\u542b ${category.count || (category.titles || []).length || 0} \u7bc7\u76f8\u5173\u5185\u5bb9${sample ? `\uff1a${sample}` : ""}\u3002`.slice(0, 140);
}

function buildManualReviewPayload({ notes, existingAlbums, config, granularity }) {
  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  return {
    version: 1,
    task: "classify_xhs_favorite_notes",
    granularity,
    rules: [
      granularity === "fine"
        ? "\u7ec6\u7c92\u5ea6\uff1a\u53ef\u4ee5\u6309\u56fd\u5bb6\u3001\u57ce\u5e02\u3001\u5730\u533a\u3001\u8def\u7ebf\u6216\u660e\u786e\u4e3b\u9898\u62c6\u5206\uff0c\u4f8b\u5982\u65e5\u672c\u65c5\u884c\u3001\u65b0\u7586\u8def\u7ebf\u3002"
        : "\u7c97\u7c92\u5ea6\uff1a\u4f18\u5148\u5408\u5e76\u4e3a\u901a\u7528\u4e3b\u9898\uff0c\u4f8b\u5982\u65e5\u672c\u65c5\u884c\u3001\u6cf0\u56fd\u65c5\u884c\u3001\u65b0\u7586\u65c5\u884c\u5c3d\u91cf\u5408\u5e76\u4e3a\u65c5\u884c\u3002",
      `\u5e38\u89c4\u5206\u7c7b\u4e0a\u9650\u4e3a ${config.maxCategories} \u4e2a\uff1b\u65e0\u6cd5\u53ef\u9760\u5f52\u7c7b\u7684\u653e\u5165\u201c\u5176\u4ed6\u201d\u3002`,
      "\u4f18\u5148\u590d\u7528 existingAlbums \u4e2d\u5df2\u6709\u4e13\u8f91\u540d\u3002",
      "\u6bcf\u4e2a\u5e8f\u53f7\u5fc5\u987b\u4e14\u53ea\u80fd\u5f52\u5165\u4e00\u4e2a\u5206\u7c7b\u3002"
    ],
    expectedOutput: {
      items: [
        { i: 1, name: "\u65c5\u884c" },
        { i: 2, name: "\u7f8e\u98df" }
      ]
    },
    limits: {
      maxCategories: config.maxCategories,
      maxTitlesForPrompt: config.maxTitlesForPrompt,
      selectedTitleCount: selected.length,
      totalTitleCount: (notes || []).length
    },
    existingAlbums: (existingAlbums || []).map((album) => normalizeText(album.name || album)).filter(Boolean),
    notes: selected.map((note, index) => ({
      i: index + 1,
      title: normalizeText(note.title),
      noteId: note.noteId || "",
      href: note.href || ""
    }))
  };
}

function buildManualReviewPrompt(payload) {
  const existing = payload.existingAlbums.length ? payload.existingAlbums.join("\u3001") : "\u6682\u65e0";
  const notes = payload.notes.map((note) => `${note.i}. ${note.title}`).join("\n");
  return [
    "\u8bf7\u5e2e\u6211\u7ed9\u5c0f\u7ea2\u4e66\u6536\u85cf\u7b14\u8bb0\u505a\u4e13\u8f91\u5206\u7c7b\u3002",
    `\u5206\u7c7b\u7c92\u5ea6\uff1a${payload.granularity === "fine" ? "\u7ec6\u7c92\u5ea6" : "\u7c97\u7c92\u5ea6"}`,
    `\u5e38\u89c4\u5206\u7c7b\u4e0a\u9650\uff1a${payload.limits.maxCategories}`,
    `\u5df2\u6709\u4e13\u8f91\uff0c\u4f18\u5148\u590d\u7528\uff1a${existing}`,
    "\u8981\u6c42\uff1a\u6bcf\u4e2a\u5e8f\u53f7\u5fc5\u987b\u4e14\u53ea\u80fd\u5f52\u5165\u4e00\u4e2a\u5206\u7c7b\uff1b\u65e0\u6cd5\u53ef\u9760\u5f52\u7c7b\u653e\u5165\u201c\u5176\u4ed6\u201d\uff1b\u53ea\u8fd4\u56de JSON\uff0c\u4e0d\u8981\u89e3\u91ca\u3002",
    'JSON \u683c\u5f0f\uff1a{"items":[{"i":1,"name":"\u65c5\u884c"},{"i":2,"name":"\u7f8e\u98df"}]}',
    "",
    notes
  ].join("\n");
}

function manualAssignmentsToPlan(input, notes, existingAlbums, config, granularity) {
  const payload = typeof input === "string" ? JSON.parse(input) : input;
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.assignments) ? payload.assignments : [];
  if (!items.length) throw new Error('\u5bfc\u5165\u5206\u7c7b JSON \u9700\u8981\u5305\u542b items\uff0c\u4f8b\u5982 {"items":[{"i":1,"name":"\u65c5\u884c"}]}');

  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  const categories = new Map();
  const other = { name: OTHER_CATEGORY_NAME, title: OTHER_CATEGORY_NAME, intro: "", count: 0, titles: [], isOther: true };
  const existingNames = new Set((existingAlbums || []).map((album) => normalizeText(album.name || album)).filter(Boolean));
  const byIndex = new Map(selected.map((note, index) => [index + 1, note]));
  const handledIndexes = new Set();

  for (const item of items) {
    const index = Number(item.i ?? item.index ?? item.id);
    const note = byIndex.get(index);
    if (!note) continue;

    const title = normalizeText(note.title);
    const rawName = normalizeText(item.name || item.category || item.album);
    if (!title || !rawName) continue;

    let category = other;
    const name = cleanCategoryName(rawName, categories.size);
    if (!isOtherName(name)) {
      const key = categoryKey(name) || compactTitle(name);
      if (!categories.has(key)) {
        const regularCount = Array.from(categories.values()).filter(isRegularCategory).length;
        if (regularCount < config.maxCategories || existingNames.has(name)) {
          categories.set(key, { name, title: name, intro: "", count: 0, titles: [], isExisting: existingNames.has(name) });
        }
      }
      category = categories.get(key) || other;
    }

    if (!category.titles.includes(title)) category.titles.push(title);
    category.count = category.titles.length;
    handledIndexes.add(index);
  }

  for (let index = 1; index <= selected.length; index += 1) {
    if (handledIndexes.has(index)) continue;
    const title = normalizeText(byIndex.get(index)?.title);
    if (title && !other.titles.includes(title)) other.titles.push(title);
  }
  other.count = other.titles.length;

  const outputCategories = Array.from(categories.values())
    .filter((category) => category.titles.length && isRegularCategory(category))
    .map((category) => ({ ...category, intro: categoryIntro(category), count: category.titles.length }));
  if (other.titles.length) outputCategories.push({ ...other, intro: categoryIntro(other), count: other.titles.length });

  return {
    categories: outputCategories,
    analyzedTitleCount: selected.length,
    totalTitleCount: (notes || []).length,
    titleSelectionLimit: config.maxTitlesForPrompt,
    categoryLimit: config.maxCategories,
    batchSize: selected.length,
    existingAlbumCount: (existingAlbums || []).length,
    granularity,
    source: "manual-review"
  };
}


// ---- src/ui.js ----

const STYLE_ID = `${APP_ID}-style`;
const HOST_ID = `${APP_ID}-host`;
const BUTTON_ID = `${APP_ID}-button`;
const OVERLAY_ID = `${APP_ID}-overlay`;
const READY_ATTR = `data-${APP_ID}-ready`;

function optionsHtml(values, selected) {
  const merged = Array.from(new Set(values.concat(selected).map((value) => Math.max(1, Math.floor(Number(value)))).filter(Number.isFinite))).sort((a, b) => a - b);
  return merged.map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`).join("");
}

function ensureStyles() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${HOST_ID} {
      position: absolute !important;
      top: 9px !important;
      right: 2px !important;
      z-index: 42 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 8px !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif !important;
    }
    .tabbit-xhs-controls, .tabbit-xhs-granularity {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      height: 34px !important;
      padding: 3px 6px !important;
      border: 0.5px solid rgba(255,255,255,.68) !important;
      border-radius: 999px !important;
      background: rgba(255,255,255,.72) !important;
      box-shadow: 0 12px 30px rgba(20,24,32,.12), inset 0 1px 0 rgba(255,255,255,.78) !important;
      backdrop-filter: blur(18px) saturate(1.55) !important;
      -webkit-backdrop-filter: blur(18px) saturate(1.55) !important;
      pointer-events: auto !important;
    }
    .tabbit-xhs-select {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      height: 28px !important;
      padding: 0 4px 0 8px !important;
      border-radius: 999px !important;
      background: rgba(255,255,255,.42) !important;
    }
    .tabbit-xhs-select span {
      font: 700 12px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif !important;
      color: rgba(50,58,72,.64) !important;
      white-space: nowrap !important;
    }
    .tabbit-xhs-select select {
      height: 24px !important;
      min-width: 54px !important;
      border: 0 !important;
      background: transparent !important;
      color: rgba(18,24,34,.88) !important;
      font: 720 12px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif !important;
      cursor: pointer !important;
      outline: none !important;
    }
    .tabbit-xhs-granularity-option, #${BUTTON_ID}, .tabbit-xhs-action, .tabbit-xhs-close, .tabbit-xhs-switch {
      appearance: none !important;
      -webkit-appearance: none !important;
      border: 0 !important;
      cursor: pointer !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif !important;
    }
    .tabbit-xhs-granularity-option {
      width: 34px !important;
      height: 28px !important;
      border-radius: 999px !important;
      background: transparent !important;
      color: rgba(50,58,72,.66) !important;
      font-size: 12px !important;
      font-weight: 700 !important;
    }
    .tabbit-xhs-granularity-option.is-active {
      background: rgba(255,255,255,.76) !important;
      color: rgba(255,45,85,.92) !important;
      box-shadow: 0 5px 14px rgba(20,24,32,.12), inset 0 1px 0 rgba(255,255,255,.86) !important;
    }
    #${BUTTON_ID} {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 7px !important;
      height: 34px !important;
      min-width: 138px !important;
      padding: 0 14px 0 12px !important;
      border: 0.5px solid rgba(255,255,255,.72) !important;
      border-radius: 999px !important;
      background: linear-gradient(135deg, rgba(255,45,85,.22), rgba(0,122,255,.16) 56%, rgba(52,199,89,.12)), rgba(255,255,255,.82) !important;
      color: rgba(18,24,34,.92) !important;
      box-shadow: 0 14px 36px rgba(20,24,32,.16), inset 0 1px 0 rgba(255,255,255,.82) !important;
      font-size: 13px !important;
      font-weight: 680 !important;
      white-space: nowrap !important;
      pointer-events: auto !important;
    }
    #${BUTTON_ID}:hover { transform: translateY(-1px) scale(1.018) !important; }
    #${BUTTON_ID}[disabled], .tabbit-xhs-granularity-option[disabled], .tabbit-xhs-select select[disabled] {
      cursor: default !important;
      opacity: .62 !important;
    }
    .tabbit-xhs-spinner {
      width: 14px !important;
      height: 14px !important;
      border-radius: 999px !important;
      border: 1.7px solid rgba(18,24,34,.18) !important;
      border-top-color: rgba(255,45,85,.94) !important;
      animation: tabbitXhsAlbumSpin 820ms linear infinite !important;
    }
    #${OVERLAY_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 24px !important;
      background: rgba(18,22,30,.22) !important;
      backdrop-filter: blur(8px) saturate(1.18) !important;
      -webkit-backdrop-filter: blur(8px) saturate(1.18) !important;
    }
    .tabbit-xhs-sheet {
      width: min(560px, calc(100vw - 32px)) !important;
      max-height: min(760px, calc(100vh - 48px)) !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      border: 0.5px solid rgba(255,255,255,.70) !important;
      border-radius: 22px !important;
      background: rgba(255,255,255,.90) !important;
      box-shadow: 0 30px 86px rgba(20,24,32,.26), inset 0 1px 0 rgba(255,255,255,.86) !important;
      color: rgba(18,24,34,.92) !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", sans-serif !important;
    }
    .tabbit-xhs-head {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 34px !important;
      gap: 12px !important;
      align-items: start !important;
      padding: 20px 20px 14px !important;
      border-bottom: 0.5px solid rgba(0,0,0,.08) !important;
    }
    .tabbit-xhs-kicker { margin: 0 0 7px !important; font-size: 11px !important; font-weight: 720 !important; color: rgba(255,45,85,.78) !important; }
    .tabbit-xhs-title { margin: 0 !important; font-size: 19px !important; line-height: 1.28 !important; font-weight: 760 !important; }
    .tabbit-xhs-subtitle { margin: 8px 0 0 !important; font-size: 13px !important; line-height: 1.55 !important; color: rgba(50,58,72,.72) !important; }
    .tabbit-xhs-close {
      width: 34px !important;
      height: 34px !important;
      border-radius: 999px !important;
      background: rgba(255,255,255,.60) !important;
      color: rgba(18,24,34,.68) !important;
    }
    .tabbit-xhs-body { padding: 16px 20px 18px !important; overflow: auto !important; }
    .tabbit-xhs-bar { position: relative !important; height: 8px !important; overflow: hidden !important; border-radius: 999px !important; background: rgba(18,24,34,.08) !important; }
    .tabbit-xhs-bar span { position: absolute !important; inset: 0 auto 0 0 !important; width: var(--tabbit-progress, 8%) !important; border-radius: inherit !important; background: linear-gradient(90deg, rgba(255,45,85,.88), rgba(0,122,255,.74)) !important; transition: width 260ms cubic-bezier(.2,.8,.2,1) !important; }
    .tabbit-xhs-log { margin: 10px 0 0 !important; font-size: 13px !important; line-height: 1.5 !important; color: rgba(48,56,70,.76) !important; }
    .tabbit-xhs-summary { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 10px !important; margin-bottom: 14px !important; }
    .tabbit-xhs-stat, .tabbit-xhs-item, .tabbit-xhs-options { border: 0.5px solid rgba(0,0,0,.06) !important; border-radius: 16px !important; background: rgba(255,255,255,.58) !important; }
    .tabbit-xhs-stat { padding: 10px 12px !important; }
    .tabbit-xhs-stat span { display: block !important; margin-bottom: 4px !important; font-size: 11px !important; color: rgba(54,62,76,.58) !important; }
    .tabbit-xhs-stat b { display: block !important; font-size: 20px !important; line-height: 1 !important; }
    .tabbit-xhs-list { display: grid !important; gap: 10px !important; margin: 0 !important; padding: 0 !important; list-style: none !important; }
    .tabbit-xhs-item { padding: 12px 13px !important; }
    .tabbit-xhs-item-head { display: flex !important; justify-content: space-between !important; gap: 12px !important; margin-bottom: 7px !important; }
    .tabbit-xhs-item h3 { margin: 0 !important; min-width: 0 !important; font-size: 14px !important; line-height: 1.35 !important; font-weight: 730 !important; }
    .tabbit-xhs-count { flex: 0 0 auto !important; display: inline-flex !important; align-items: center !important; height: 24px !important; padding: 0 9px !important; border-radius: 999px !important; background: rgba(255,45,85,.10) !important; color: rgba(255,45,85,.82) !important; font-size: 12px !important; font-weight: 680 !important; }
    .tabbit-xhs-item p { margin: 0 !important; font-size: 12px !important; line-height: 1.5 !important; color: rgba(50,58,72,.68) !important; }
    .tabbit-xhs-options { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 14px !important; margin-top: 16px !important; padding: 12px 13px !important; }
    .tabbit-xhs-options strong { display: block !important; font-size: 13px !important; }
    .tabbit-xhs-options span { display: block !important; margin-top: 4px !important; font-size: 12px !important; color: rgba(50,58,72,.62) !important; }
    .tabbit-xhs-switch { width: 48px !important; height: 28px !important; padding: 2px !important; border-radius: 999px !important; background: rgba(120,120,128,.28) !important; }
    .tabbit-xhs-switch::before { content: "" !important; display: block !important; width: 24px !important; height: 24px !important; border-radius: 999px !important; background: rgba(255,255,255,.96) !important; box-shadow: 0 2px 8px rgba(20,24,32,.18) !important; transition: transform 180ms cubic-bezier(.2,.8,.2,1) !important; }
    .tabbit-xhs-switch[aria-checked="true"] { background: rgba(52,199,89,.82) !important; }
    .tabbit-xhs-switch[aria-checked="true"]::before { transform: translateX(20px) !important; }
    .tabbit-xhs-actions { display: flex !important; justify-content: flex-end !important; gap: 10px !important; padding: 14px 20px 20px !important; border-top: 0.5px solid rgba(0,0,0,.08) !important; }
    .tabbit-xhs-action { min-width: 88px !important; height: 38px !important; padding: 0 16px !important; border-radius: 999px !important; font-size: 13px !important; font-weight: 690 !important; }
    .tabbit-xhs-action.secondary { background: rgba(255,255,255,.64) !important; color: rgba(18,24,34,.74) !important; }
    .tabbit-xhs-action.primary { background: linear-gradient(135deg, rgba(255,45,85,.92), rgba(255,84,112,.88)) !important; color: #fff !important; box-shadow: 0 10px 22px rgba(255,45,85,.24) !important; }
    .tabbit-xhs-action[disabled] { opacity: .62 !important; cursor: default !important; }
    @keyframes tabbitXhsAlbumSpin { to { transform: rotate(360deg); } }
    @media (max-width: 760px) {
      #${HOST_ID} { position: relative !important; top: auto !important; right: auto !important; justify-content: flex-start !important; flex-wrap: wrap !important; margin: 8px 0 0 16px !important; }
      .tabbit-xhs-summary { grid-template-columns: 1fr 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

function updateGranularityButtons(host) {
  host.querySelectorAll(".tabbit-xhs-granularity-option").forEach((button) => {
    const active = button.dataset.granularity === state.granularity;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function ensureControls(onRun) {
  ensureStyles();
  const tabBar = findFavSubTabBar();
  const existing = document.getElementById(HOST_ID);
  if (!tabBar) {
    if (existing) existing.style.display = "none";
    return;
  }

  if (window.getComputedStyle(tabBar).position === "static") {
    tabBar.dataset.tabbitPrevPosition = "static";
    tabBar.style.position = "relative";
  }

  let host = existing;
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.innerHTML = `
      <div class="tabbit-xhs-controls" role="group" aria-label="\u6570\u91cf\u4e0a\u9650">
        <label class="tabbit-xhs-select"><span>\u5206\u7c7b</span><select data-limit-key="maxCategories" aria-label="\u5206\u7c7b\u6570\u91cf\u4e0a\u9650">${optionsHtml([5, 10, 15, 20, 30, 50], state.config.maxCategories)}</select></label>
        <label class="tabbit-xhs-select"><span>\u6807\u9898</span><select data-limit-key="maxTitlesForPrompt" aria-label="\u6807\u9898\u9009\u62e9\u6570\u91cf\u4e0a\u9650">${optionsHtml([100, 200, 300, 500, 1000, 2000, 5000], state.config.maxTitlesForPrompt)}</select></label>
      </div>
      <div class="tabbit-xhs-granularity" role="group" aria-label="\u5206\u7c7b\u7c92\u5ea6">
        <button class="tabbit-xhs-granularity-option" type="button" data-granularity="coarse" aria-pressed="false">\u7c97</button>
        <button class="tabbit-xhs-granularity-option" type="button" data-granularity="fine" aria-pressed="false">\u7ec6</button>
      </div>
      <button id="${BUTTON_ID}" type="button" aria-label="\u667a\u80fd\u6784\u5efa\u5c0f\u7ea2\u4e66\u6536\u85cf\u4e13\u8f91"><span aria-hidden="true">\uff0b</span><span>\u667a\u80fd\u6784\u5efa\u4e13\u8f91</span></button>
    `;

    host.querySelectorAll("select[data-limit-key]").forEach((select) => {
      select.addEventListener("change", () => {
        if (state.running) {
          select.value = String(state.config[select.dataset.limitKey]);
          return;
        }
        state.config[select.dataset.limitKey] = Math.max(1, Math.floor(Number(select.value)));
      });
    });
    host.querySelectorAll(".tabbit-xhs-granularity-option").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.running) return;
        state.granularity = button.dataset.granularity === "fine" ? "fine" : "coarse";
        updateGranularityButtons(host);
      });
    });
    host.querySelector(`#${BUTTON_ID}`).addEventListener("click", onRun);
  }

  if (host.parentElement !== tabBar) tabBar.appendChild(host);
  host.style.display = isFavNotePage() ? "flex" : "none";
  host.querySelector('select[data-limit-key="maxCategories"]').value = String(state.config.maxCategories);
  host.querySelector('select[data-limit-key="maxTitlesForPrompt"]').value = String(state.config.maxTitlesForPrompt);
  updateGranularityButtons(host);
  tabBar.setAttribute(READY_ATTR, "true");
}

function setBusy(busy, label) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;
  button.disabled = !!busy;
  document.querySelectorAll(".tabbit-xhs-granularity-option, select[data-limit-key]").forEach((element) => {
    element.disabled = !!busy;
  });
  const iconHtml = busy ? '<span class="tabbit-xhs-spinner" aria-hidden="true"></span>' : "<span aria-hidden=\"true\">\uff0b</span>";
  button.innerHTML = `${iconHtml}<span>${escapeHtml(label || "\u667a\u80fd\u6784\u5efa\u4e13\u8f91")}</span>`;
}

function closeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function overlayShell(kicker, title, subtitle, bodyHtml, actionsHtml = "") {
  closeOverlay();
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="tabbit-xhs-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="tabbit-xhs-head">
        <div>
          <p class="tabbit-xhs-kicker">${escapeHtml(kicker)}</p>
          <h2 class="tabbit-xhs-title">${escapeHtml(title)}</h2>
          <p class="tabbit-xhs-subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <button class="tabbit-xhs-close" type="button" aria-label="\u5173\u95ed">\u00d7</button>
      </div>
      <div class="tabbit-xhs-body">${bodyHtml}</div>
      ${actionsHtml}
    </div>
  `;
  overlay.querySelector(".tabbit-xhs-close")?.addEventListener("click", closeOverlay);
  document.body.appendChild(overlay);
  return overlay;
}

function showProgress(title, message) {
  overlayShell(
    "TABBIT ALBUM BUILDER",
    title,
    message,
    '<div class="tabbit-xhs-bar"><span></span></div><p class="tabbit-xhs-log"></p>'
  );
  updateProgress(8, message);
}

function updateProgress(percent, message) {
  const bar = document.querySelector(".tabbit-xhs-bar");
  const log = document.querySelector(".tabbit-xhs-log");
  if (bar) bar.style.setProperty("--tabbit-progress", `${Math.max(6, Math.min(100, Math.round(percent)))}%`);
  if (log) log.textContent = message;
}

function showError(error) {
  const message = normalizeText(error?.message || error || "\u672a\u77e5\u9519\u8bef");
  overlayShell(
    "\u672a\u5b8c\u6210",
    "\u667a\u80fd\u6784\u5efa\u4e13\u8f91\u5931\u8d25",
    message,
    "",
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action primary" type="button" data-action="close">\u77e5\u9053\u4e86</button></div>'
  ).querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
}

function showPlanDialog(notes, plan, callbacks) {
  state.plan = plan;
  const categories = plan.categories || [];
  const regularCount = categories.filter(isRegularCategory).length;
  const other = categories.find((category) => category.isOther);
  const analyzed = Number(plan.analyzedTitleCount) || Math.min(notes.length, state.config.maxTitlesForPrompt);
  const total = Number(plan.totalTitleCount) || notes.length;
  const batchSize = Number(plan.batchSize) || state.config.classificationBatchSize;
  const granularityName = plan.granularity === "fine" ? "\u7ec6\u7c92\u5ea6" : "\u7c97\u7c92\u5ea6";
  const subtitle =
    `${granularityName}\uff1a\u5df2\u9009\u62e9 ${analyzed}/${total} \u4e2a\u6807\u9898\u53c2\u4e0e\u5206\u7c7b\uff0c\u6309\u6bcf\u6279 ${batchSize} \u4e2a\u589e\u91cf\u5206\u6790\u3002` +
    ` \u5c06\u521b\u5efa ${regularCount} \u4e2a\u5e38\u89c4\u5206\u7c7b\u4e13\u8f91${other ? `\uff0c\u53e6\u6709\u201c\u5176\u4ed6\u201d${Number(other.count) || (other.titles || []).length || 0} \u7bc7\u4e0d\u8ba1\u5165\u4e0a\u9650` : ""}\uff0c\u9ed8\u8ba4\u79c1\u6709\u3002`;

  const body = `
    <div class="tabbit-xhs-summary">
      <div class="tabbit-xhs-stat"><span>\u91c7\u96c6</span><b>${total}</b></div>
      <div class="tabbit-xhs-stat"><span>\u5206\u6790</span><b>${analyzed}</b></div>
      <div class="tabbit-xhs-stat"><span>\u5df2\u6709\u4e13\u8f91</span><b>${Number(plan.existingAlbumCount) || 0}</b></div>
      <div class="tabbit-xhs-stat"><span>\u5206\u7c7b\u4e0a\u9650</span><b>${state.config.maxCategories}</b></div>
    </div>
    <ul class="tabbit-xhs-list">
      ${categories.map((category) => `
        <li class="tabbit-xhs-item">
          <div class="tabbit-xhs-item-head"><h3>${escapeHtml(category.name)}</h3><span class="tabbit-xhs-count">${category.isOther ? "\u672a\u5206\u7c7b" : `${Number(category.count) || (category.titles || []).length || 0} \u7bc7`}</span></div>
          <p>${escapeHtml((category.titles || []).slice(0, 3).join(" / ") || category.intro || "\u6536\u85cf\u5185\u5bb9\u5206\u7c7b")}</p>
        </li>
      `).join("")}
    </ul>
    <div class="tabbit-xhs-options">
      <div><strong>\u516c\u5f00\u4e13\u8f91</strong><span>${state.publicAlbum ? "\u5176\u4ed6\u4eba\u53ef\u4ee5\u67e5\u770b" : "\u4ec5\u81ea\u5df1\u53ef\u89c1"}</span></div>
      <button class="tabbit-xhs-switch" type="button" role="switch" aria-checked="${state.publicAlbum ? "true" : "false"}" aria-label="\u516c\u5f00\u4e13\u8f91"></button>
    </div>
  `;
  const overlay = overlayShell(
    "\u5206\u6790\u5b8c\u6210",
    `\u5df2\u5f52\u7c7b ${analyzed} \u7bc7\u6536\u85cf\u7b14\u8bb0`,
    subtitle,
    body,
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action secondary" type="button" data-action="cancel">\u53d6\u6d88</button><button class="tabbit-xhs-action primary" type="button" data-action="create">\u521b\u5efa\u4e13\u8f91</button></div>'
  );

  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", closeOverlay);
  overlay.querySelector(".tabbit-xhs-switch")?.addEventListener("click", (event) => {
    state.publicAlbum = !state.publicAlbum;
    event.currentTarget.setAttribute("aria-checked", state.publicAlbum ? "true" : "false");
    const label = overlay.querySelector(".tabbit-xhs-options span");
    if (label) label.textContent = state.publicAlbum ? "\u5176\u4ed6\u4eba\u53ef\u4ee5\u67e5\u770b" : "\u4ec5\u81ea\u5df1\u53ef\u89c1";
  });
  overlay.querySelector('[data-action="create"]')?.addEventListener("click", callbacks.onCreate);
}

function showCreateResult(result, addCount, callbacks) {
  const body = `
    <ul class="tabbit-xhs-list">
      ${result.created.map((name) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(name)}</h3><span class="tabbit-xhs-count">\u5df2\u521b\u5efa</span></div></li>`).join("")}
      ${result.skipped.map((name) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(name)}</h3><span class="tabbit-xhs-count">\u5df2\u5b58\u5728</span></div></li>`).join("")}
      ${result.failed.map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.name)}</h3><span class="tabbit-xhs-count">\u5931\u8d25</span></div><p>${escapeHtml(item.error)}</p></li>`).join("")}
    </ul>
  `;
  const overlay = overlayShell(
    "\u521b\u5efa\u5b8c\u6210",
    `\u65b0\u589e ${result.created.length} \u4e2a\u4e13\u8f91\uff0c\u8df3\u8fc7 ${result.skipped.length} \u4e2a`,
    result.failed.length ? `\u6709 ${result.failed.length} \u4e2a\u672a\u5b8c\u6210\uff0c\u8bf7\u67e5\u770b\u5217\u8868\u3002` : `\u5df2\u6309\u73b0\u6709\u4e13\u8f91\u53bb\u91cd\u3002\u53ef\u6dfb\u52a0 ${addCount} \u7bc7\u7b14\u8bb0\u5230\u5bf9\u5e94\u4e13\u8f91\u3002`,
    body,
    `<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action secondary" type="button" data-action="close">\u5b8c\u6210</button><button class="tabbit-xhs-action primary" type="button" data-action="add" ${addCount ? "" : "disabled"}>\u63a5\u53e3\u4e00\u952e\u6dfb\u52a0</button></div>`
  );
  overlay.querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
  overlay.querySelector('[data-action="add"]')?.addEventListener("click", callbacks.onAdd);
}

function showAddResult(result) {
  const body = `
    <ul class="tabbit-xhs-list">
      ${result.added.slice(0, 30).map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.title)}</h3><span class="tabbit-xhs-count">${escapeHtml(item.category)}</span></div></li>`).join("")}
      ${result.failed.map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.title)}</h3><span class="tabbit-xhs-count">\u5931\u8d25</span></div><p>${escapeHtml(`${item.category}\uff1a${item.error}`)}</p></li>`).join("")}
    </ul>
  `;
  overlayShell(
    "\u6dfb\u52a0\u5b8c\u6210",
    `\u5df2\u6dfb\u52a0 ${result.added.length} \u7bc7\uff0c\u5931\u8d25 ${result.failed.length} \u7bc7`,
    "\u5df2\u901a\u8fc7\u5c0f\u7ea2\u4e66\u524d\u7aef\u63a5\u53e3\u5c01\u88c5\u52a0\u5165\u5bf9\u5e94\u4e13\u8f91\u3002",
    body,
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action primary" type="button" data-action="close">\u5b8c\u6210</button></div>'
  ).querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
}

function removeUi() {
  document.getElementById(HOST_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.querySelectorAll(`[${READY_ATTR}]`).forEach((element) => {
    element.removeAttribute(READY_ATTR);
    if (element.dataset.tabbitPrevPosition === "static") {
      element.style.position = "";
      delete element.dataset.tabbitPrevPosition;
    }
  });
}


// ---- src/xhsApi.js ----

function summarizeResponse(value) {
  if (!value || typeof value !== "object") return value;
  return {
    code: value.code ?? value.data?.code,
    success: value.success ?? value.data?.success,
    msg: value.msg || value.message || value.data?.msg || value.data?.message || "",
    keys: Object.keys(value).slice(0, 8)
  };
}

function isLoginError(error) {
  return /\u65e0\u767b\u5f55|\u767b\u5f55\u4fe1\u606f|\u8bf7\u5148\u767b\u5f55|\u672a\u767b\u5f55|login|unauthorized|401|403/i.test(errorMessage(error));
}

function assertApiSuccess(value, label) {
  if (!value || typeof value !== "object") return value;
  const code = value.code ?? value.data?.code;
  const success = value.success ?? value.data?.success;
  const message = value.msg || value.message || value.data?.msg || value.data?.message || "";
  if (code === 0 || success === true || (code == null && success == null)) return value;
  throw new Error(`${label} \u8fd4\u56de\u5931\u8d25${code != null ? ` code=${code}` : ""}${message ? `\uff1a${message}` : ""}`);
}

function getWebpackRequire() {
  let requireFn = null;
  const chunkName = `tabbit-xhs-api-${Date.now()}`;
  const chunks = (window.webpackChunkxhs_pc_web = window.webpackChunkxhs_pc_web || []);
  chunks.push([[chunkName], {}, (runtimeRequire) => {
    requireFn = runtimeRequire;
  }]);
  if (!requireFn) throw new Error("\u6ca1\u6709\u83b7\u53d6\u5230\u5c0f\u7ea2\u4e66 webpack runtime\uff0c\u65e0\u6cd5\u8c03\u7528\u524d\u7aef\u63a5\u53e3\u5c01\u88c5");
  return requireFn;
}

function requireModule(requireFn, id) {
  try {
    return requireFn?.(id);
  } catch (error) {
    logger.warn("require \u5c0f\u7ea2\u4e66\u6a21\u5757\u5931\u8d25", { id, error: errorMessage(error) });
    return null;
  }
}

function discoverFromExports(exportsValue, found, seen) {
  if (!exportsValue || seen.has(exportsValue)) return;
  seen.add(exportsValue);

  const candidates = [];
  if (typeof exportsValue === "function") candidates.push(["default", exportsValue]);
  if (typeof exportsValue === "object") {
    for (const key of Object.keys(exportsValue)) candidates.push([key, exportsValue[key]]);
  }

  for (const [key, candidate] of candidates) {
    if (typeof candidate !== "function") continue;
    const source = Function.prototype.toString.call(candidate);
    if (!found.move && /\/api\/sns\/web\/v1\/note\/move|note\/move/.test(source)) {
      found.move = candidate;
      found.moveSource = key;
    }
    if (!found.collect && /\/api\/sns\/web\/v1\/note\/collect|note\/collect/.test(source)) {
      found.collect = candidate;
      found.collectSource = key;
    }
    if (!found.boardUser && /\/api\/sns\/web\/v1\/board\/user|board\/user/.test(source)) {
      found.boardUser = candidate;
      found.boardUserSource = key;
    }
    if (found.move && found.collect && found.boardUser) break;
  }
}

function discoverApi(requireFn) {
  const module25717 = requireModule(requireFn, 25717);
  const found = {
    raw: module25717 || null,
    move: module25717?.d0 || null,
    collect: module25717?.B1 || null,
    boardUser: module25717?.yC || null,
    moveSource: module25717?.d0 ? "module25717.d0" : "",
    collectSource: module25717?.B1 ? "module25717.B1" : "",
    boardUserSource: module25717?.yC ? "module25717.yC" : ""
  };

  const seen = new Set();
  try {
    Object.values(requireFn?.c || {}).forEach((entry) => discoverFromExports(entry?.exports, found, seen));
  } catch (error) {
    logger.warn("\u904d\u5386 webpack cache \u5931\u8d25", { error: errorMessage(error), detail: errorDetail(error) });
  }

  if (!found.move && requireFn?.m) {
    for (const id of Object.keys(requireFn.m)) {
      discoverFromExports(requireModule(requireFn, id), found, seen);
      if (found.move && found.collect && found.boardUser) break;
    }
  }

  logger.debug("webpack API \u63a2\u6d4b\u7ed3\u679c", {
    hasMove: !!found.move,
    hasCollect: !!found.collect,
    hasBoardUser: !!found.boardUser,
    moveSource: found.moveSource,
    collectSource: found.collectSource,
    boardUserSource: found.boardUserSource,
    checked: seen.size
  });
  return found;
}

function getApiModule() {
  if (state.apiModule?.move) return state.apiModule;
  if (state.apiModule && !state.apiModule.move) {
    throw new Error("\u6ca1\u6709\u627e\u5230\u5c0f\u7ea2\u4e66 note/move \u5185\u90e8 API\u3002\u53ef\u80fd\u662f\u5c0f\u7ea2\u4e66\u524d\u7aef\u6253\u5305\u7ed3\u6784\u5df2\u53d8\u5316\uff0c\u8bf7\u67e5\u770b Console \u7684 webpack API \u63a2\u6d4b\u7ed3\u679c\u3002");
  }
  const api = discoverApi(getWebpackRequire());
  state.apiModule = api;
  if (!api.move) {
    // TODO: \u5c0f\u7ea2\u4e66\u6539\u7248\u540e\uff0c\u53ef\u4ee5\u5728\u8fd9\u91cc\u8865\u5145\u65b0\u7684\u6a21\u5757\u7b7e\u540d\u6216\u516c\u5f00\u63a5\u53e3\u9002\u914d\u3002
    throw new Error("\u6ca1\u6709\u627e\u5230\u5c0f\u7ea2\u4e66 note/move \u5185\u90e8 API\u3002\u53ef\u80fd\u662f\u5c0f\u7ea2\u4e66\u524d\u7aef\u6253\u5305\u7ed3\u6784\u5df2\u53d8\u5316\uff0c\u8bf7\u67e5\u770b Console \u7684 webpack API \u63a2\u6d4b\u7ed3\u679c\u3002");
  }
  return api;
}

function withTimeout(promise, label, timeoutMs) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} \u8d85\u8fc7 ${Math.round(timeoutMs / 1000)} \u79d2`)), timeoutMs);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function retry(fn, label, config, retries = config.apiRetryCount) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await withTimeout(fn(), label, config.apiRequestTimeoutMs);
      logger.debug("API \u8bf7\u6c42\u5b8c\u6210", { label, attempt: attempt + 1, response: summarizeResponse(result) });
      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      const delay = config.apiRetryDelay * (attempt + 1);
      logger.warn("API \u8bf7\u6c42\u5931\u8d25\uff0c\u51c6\u5907\u91cd\u8bd5", { label, attempt: attempt + 1, delay, error: errorMessage(error), detail: errorDetail(error) });
      await sleep(delay);
    }
  }
  logger.error(`API \u8bf7\u6c42\u6700\u7ec8\u5931\u8d25\uff1a${label}`, lastError);
  throw lastError || new Error(`${label} \u5931\u8d25`);
}

async function checkLogin(config) {
  logger.debug("\u767b\u5f55\u6001\u68c0\u67e5\u5f00\u59cb");
  const response = await withTimeout(
    fetch("https://edith.xiaohongshu.com/api/sns/web/v2/user/me", {
      method: "GET",
      credentials: "include",
      mode: "cors",
      headers: { accept: "application/json, text/plain, */*" }
    }),
    "\u68c0\u67e5\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001",
    config.apiRequestTimeoutMs
  );

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`\u68c0\u67e5\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001\u8fd4\u56de\u975e JSON\uff1a${errorMessage(error)}`);
  }

  logger.debug("\u767b\u5f55\u6001\u68c0\u67e5\u8fd4\u56de", summarizeResponse(payload));
  if (!response.ok) throw new Error(`\u68c0\u67e5\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001 HTTP ${response.status}`);
  assertApiSuccess(payload, "\u68c0\u67e5\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001");
  if (isLoginError(payload)) throw new Error(`\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001\u4e0d\u53ef\u7528\uff1a${errorMessage(payload)}`);
  return payload;
}

function extractProfileUserId() {
  if (state.profileUserId) return state.profileUserId;
  const fromPath = location.pathname.match(/\/user\/profile\/([^/?#]+)/);
  if (fromPath) {
    state.profileUserId = decodeURIComponent(fromPath[1]);
    return state.profileUserId;
  }
  const href = Array.from(document.querySelectorAll('a[href*="/user/profile/"]')).map((link) => link.href || link.getAttribute("href") || "").find(Boolean);
  const fromLink = String(href || "").match(/\/user\/profile\/([^/?#]+)/);
  if (fromLink) state.profileUserId = decodeURIComponent(fromLink[1]);
  return state.profileUserId;
}

function collectBoardItems(value, output = []) {
  if (!value || output.length > 300) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectBoardItems(item, output));
    return output;
  }
  if (typeof value !== "object") return output;

  const id = normalizeText(value.id || value.boardId || value.board_id);
  const name = normalizeText(value.name || value.title || value.boardName || value.board_name);
  if (id && name) output.push({ id, name });
  Object.keys(value).forEach((key) => {
    if (/board|list|data|items/i.test(key)) collectBoardItems(value[key], output);
  });
  return output;
}

async function boardUserFallback(config) {
  const userId = extractProfileUserId();
  if (!userId) {
    logger.warn("\u6ca1\u6709\u89e3\u6790\u5230 profile user_id\uff0c\u8df3\u8fc7 board/user \u515c\u5e95");
    return [];
  }

  const api = getApiModule();
  if (!api.boardUser) {
    logger.warn("\u6ca1\u6709\u627e\u5230 board/user API\uff0c\u8df3\u8fc7\u4e13\u8f91 id \u515c\u5e95");
    return [];
  }

  const result = await retry(() => api.boardUser({ user_id: userId }), "\u67e5\u8be2\u4e13\u8f91\u5217\u8868", config, 1);
  assertApiSuccess(result, "\u67e5\u8be2\u4e13\u8f91\u5217\u8868");
  const boards = collectBoardItems(result);
  logger.debug("board/user \u4e13\u8f91\u89e3\u6790\u5b8c\u6210", { count: boards.length, names: boards.slice(0, 20).map((item) => item.name) });
  return boards;
}

async function resolveBoardIdMap(requiredNames, domAlbums, config) {
  const map = new Map();
  for (const album of domAlbums || []) {
    if (album?.id && album?.name) map.set(album.name, album.id);
  }

  const missing = requiredNames.filter((name) => name && !map.has(name));
  if (missing.length) {
    logger.warn("DOM \u7f3a\u5c11\u76ee\u6807\u4e13\u8f91 id\uff0c\u5c1d\u8bd5 board/user \u515c\u5e95", { missing });
    try {
      for (const album of await boardUserFallback(config)) {
        if (album.id && album.name) map.set(album.name, album.id);
      }
    } catch (error) {
      logger.warn("board/user \u515c\u5e95\u5931\u8d25", { error: errorMessage(error), detail: errorDetail(error) });
    }
  }

  const stillMissing = requiredNames.filter((name) => name && !map.has(name));
  if (stillMissing.length) {
    logger.warn("\u4ecd\u7f3a\u5c11\u76ee\u6807\u4e13\u8f91 id", { stillMissing, parsedNames: Array.from(map.keys()) });
  }
  state.boardIdMap = map;
  return map;
}

function buildAssignments(plan, collectedNotes) {
  if (!plan?.categories?.length || !collectedNotes?.length) return [];

  const byTitle = new Map();
  const byCompactTitle = new Map();
  const analyzedNotes = collectedNotes.slice(0, Number(plan.analyzedTitleCount) || collectedNotes.length);
  for (const note of analyzedNotes) {
    const title = normalizeText(note.title);
    if (!title) continue;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(note);
    const compact = title.toLowerCase().replace(/\s+/g, "");
    if (!byCompactTitle.has(compact)) byCompactTitle.set(compact, []);
    byCompactTitle.get(compact).push(note);
  }

  const seen = new Set();
  const assignments = [];
  const pushAssignment = (note, category) => {
    if (!note || !category || isOtherName(category)) return;
    const title = normalizeText(note.title);
    const noteId = note.noteId;
    const key = `${noteId || noteKey(note) || title}::${category}`;
    if (title && !seen.has(key)) {
      seen.add(key);
      assignments.push({ title, href: note.href, noteId, category, isCollected: note.isCollected !== false });
    }
  };

  for (const category of plan.categories) {
    if (!isRegularCategory(category)) continue;
    for (const rawTitle of category.titles || []) {
      const title = normalizeText(rawTitle);
      const note = (byTitle.get(title) || []).shift() || (byCompactTitle.get(title.toLowerCase().replace(/\s+/g, "")) || []).shift();
      pushAssignment(note, category.name);
    }
  }

  for (const note of analyzedNotes) {
    const title = normalizeText(note.title);
    pushAssignment(note, state.assignmentCache.get(title) || state.assignmentCache.get(title.toLowerCase().replace(/\s+/g, "")));
  }
  logger.debug("\u6784\u5efa move \u6620\u5c04", { count: assignments.length, sample: assignments.slice(0, 10) });
  return assignments;
}

async function moveOne(assignment, boardIdMap, config) {
  if (!assignment.noteId) throw new Error("\u6ca1\u6709\u4ece\u7b14\u8bb0\u94fe\u63a5\u4e2d\u89e3\u6790\u5230 noteId");
  if (!assignment.isCollected) throw new Error("\u8df3\u8fc7\u975e\u6536\u85cf\u6765\u6e90\u7b14\u8bb0\uff0c\u907f\u514d\u79fb\u52a8\u81ea\u5df1\u53d1\u5e03\u7684\u7b14\u8bb0");
  const targetBoardId = boardIdMap.get(assignment.category);
  if (!targetBoardId) throw new Error(`\u6ca1\u6709\u627e\u5230\u4e13\u8f91 id\uff1a${assignment.category}`);

  const api = getApiModule();
  const context = { title: assignment.title, noteId: assignment.noteId, category: assignment.category, targetBoardId };
  logger.debug("move API \u8c03\u7528\u53c2\u6570", context);

  if (config.apiEnsureCollectBeforeMove) {
    if (!api.collect) throw new Error("\u6ca1\u6709\u627e\u5230 note/collect \u5185\u90e8 API\uff0c\u65e0\u6cd5\u6267\u884c\u9884\u6536\u85cf\u786e\u8ba4");
    await retry(() => api.collect({ note_id: assignment.noteId }), `\u6536\u85cf\u7b14\u8bb0 ${assignment.noteId}`, config, 1)
      .then((result) => assertApiSuccess(result, `\u6536\u85cf\u7b14\u8bb0 ${assignment.noteId}`));
  }

  const body = { target_board_id: targetBoardId, notes_id: assignment.noteId };
  const result = await retry(() => api.move(body), `\u79fb\u52a8\u7b14\u8bb0 ${assignment.noteId} \u5230\u4e13\u8f91`, config);
  assertApiSuccess(result, `\u79fb\u52a8\u7b14\u8bb0 ${assignment.noteId} \u5230\u4e13\u8f91`);
  return result;
}

async function moveAssignments(assignments, boardIdMap, config, onProgress = () => {}) {
  await checkLogin(config);
  getApiModule();

  const result = { added: [], failed: [] };
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index];
    onProgress(12 + Math.round((index / Math.max(1, assignments.length)) * 84), `\u6b63\u5728\u6dfb\u52a0 ${index + 1}/${assignments.length}\uff1a${assignment.title}`);
    try {
      await moveOne(assignment, boardIdMap, config);
      result.added.push(assignment);
    } catch (error) {
      if (isLoginError(error)) throw new Error(`\u5c0f\u7ea2\u4e66\u767b\u5f55\u6001\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u540e\u518d\u8bd5\uff1a${errorMessage(error)}`);
      result.failed.push({ ...assignment, error: errorMessage(error) });
      logger.error(`\u79fb\u52a8\u7b14\u8bb0\u5931\u8d25\uff1a${assignment.title}`, error);
    }
    if (config.apiAddDelay) await sleep(config.apiAddDelay);
  }
  logger.debug("move \u6279\u5904\u7406\u5b8c\u6210", { added: result.added.length, failed: result.failed.length });
  return result;
}

// Debug hook for manual verification in Console.
function installMoveProbe() {
  window.__tabbitXhsApiMoveProbe = async function probe(input = {}) {
    const noteId = normalizeText(input.noteId || input.notes_id);
    const targetBoardId = normalizeText(input.targetBoardId || input.target_board_id);
    if (!noteId || !targetBoardId) {
      throw new Error("\u9700\u8981\u4f20\u5165 noteId \u548c targetBoardId\uff0c\u4f8b\u5982 window.__tabbitXhsApiMoveProbe({ noteId, targetBoardId })");
    }
    const api = getApiModule();
    const body = { target_board_id: targetBoardId, notes_id: noteId };
    logger.debug("manual move probe start", { body, moveSource: api.moveSource });
    const response = await api.move(body);
    assertApiSuccess(response, `\u624b\u52a8\u63a2\u9488\u79fb\u52a8\u7b14\u8bb0 ${noteId} \u5230\u4e13\u8f91`);
    logger.debug("manual move probe success", summarizeResponse(response));
    return response;
  };
}


// ---- src/index.js ----

async function handleRun() {
  if (state.running) return;
  state.running = true;
  state.publicAlbum = false;
  setBusy(true, "\u91c7\u96c6\u4e2d");

  try {
    if (!isFavNotePage()) throw new Error("\u8bf7\u5148\u5207\u6362\u5230\u6536\u85cf\u9875\u7684\u7b14\u8bb0\u5b50\u5206\u7c7b\u540e\u518d\u8fd0\u884c\u3002");

    showProgress("\u6b63\u5728\u8bfb\u53d6\u5df2\u6709\u4e13\u8f91", "\u5148\u8fdb\u5165\u4e13\u8f91\u9875\u9762\u83b7\u53d6\u5df2\u6709\u5206\u7c7b\u540d\u79f0");
    state.existingAlbums = await readExistingAlbums(state.config, updateProgress);

    updateProgress(34, `\u5df2\u8bfb\u53d6 ${state.existingAlbums.length} \u4e2a\u5df2\u6709\u4e13\u8f91\uff0c\u51c6\u5907\u56de\u5230\u7b14\u8bb0\u9875`);
    await switchToNoteTab();

    showProgress("\u6b63\u5728\u626b\u63cf\u6536\u85cf\u7b14\u8bb0", `\u5df2\u8bfb\u53d6 ${state.existingAlbums.length} \u4e2a\u5df2\u6709\u4e13\u8f91\uff0c\u5f00\u59cb\u6eda\u52a8\u5f53\u524d\u9875\u9762\u5e76\u6536\u96c6\u6807\u9898`);
    state.collected = await scanCollectedNotes(state.config, updateProgress);
    if (!state.collected.length) throw new Error("\u6ca1\u6709\u8bfb\u53d6\u5230\u6536\u85cf\u7b14\u8bb0\u6807\u9898");

    updateProgress(62, `\u5df2\u6355\u83b7 ${state.collected.length} \u4e2a\u6807\u9898\uff0c\u51c6\u5907\u6309\u6bcf\u6279 ${state.config.classificationBatchSize} \u4e2a\u589e\u91cf\u5206\u7c7b`);
    const existingNames = state.existingAlbums.map((album) => album.name);
    state.plan = await classifyNotes(state.collected, existingNames, {
      config: state.config,
      granularity: state.granularity
    }, updateProgress);
    if (!state.plan.categories?.length) throw new Error("\u6ca1\u6709\u751f\u6210\u53ef\u521b\u5efa\u7684\u5206\u7c7b\u3002");

    updateProgress(100, "\u5206\u7c7b\u5b8c\u6210");
    showPlanDialog(state.collected, state.plan, { onCreate: handleCreate });
  } catch (error) {
    logger.error("\u5c0f\u7ea2\u4e66\u667a\u80fd\u6784\u5efa\u4e13\u8f91\u5931\u8d25", error);
    showError(error);
  } finally {
    state.running = false;
    setBusy(false);
  }
}

async function handleCreate() {
  if (state.running || !state.plan?.categories?.length) return;
  state.running = true;
  setBusy(true, "\u521b\u5efa\u4e2d");

  try {
    showProgress("\u6b63\u5728\u521b\u5efa\u4e13\u8f91", "\u6b63\u5728\u8fdb\u5165\u4e13\u8f91\u9875\u9762\u5e76\u68c0\u67e5\u5df2\u6709\u4e13\u8f91");
    const freshAlbums = await readExistingAlbums(state.config, updateProgress);
    state.existingAlbums = freshAlbums.length ? freshAlbums : state.existingAlbums;
    const result = await createAlbums(state.plan, state.existingAlbums, state.publicAlbum, state.config, updateProgress);
    updateProgress(100, "\u521b\u5efa\u6d41\u7a0b\u5b8c\u6210");

    const assignments = buildAssignments(state.plan, state.collected);
    showCreateResult(result, assignments.length, { onAdd: handleAdd });
  } catch (error) {
    logger.error("\u521b\u5efa\u4e13\u8f91\u6d41\u7a0b\u5931\u8d25", error);
    showError(error);
  } finally {
    state.running = false;
    setBusy(false);
  }
}

async function handleAdd() {
  if (state.adding || state.running) return;
  const assignments = buildAssignments(state.plan, state.collected);
  if (!assignments.length) {
    showError(new Error("\u6ca1\u6709\u53ef\u6dfb\u52a0\u5230\u4e13\u8f91\u7684\u7b14\u8bb0\u6620\u5c04\u3002\u8bf7\u5148\u5b8c\u6210\u5206\u7c7b\u548c\u521b\u5efa\u4e13\u8f91\u3002"));
    return;
  }

  state.adding = true;
  setBusy(true, "\u6dfb\u52a0\u4e2d");
  showProgress("\u6b63\u5728\u901a\u8fc7\u63a5\u53e3\u6dfb\u52a0\u7b14\u8bb0", `\u51c6\u5907\u5904\u7406 ${assignments.length} \u7bc7\u7b14\u8bb0`);

  try {
    updateProgress(6, "\u6b63\u5728\u8bfb\u53d6\u4e13\u8f91 id");
    const requiredNames = Array.from(new Set(assignments.map((item) => item.category).filter(Boolean)));
    const albums = await readExistingAlbums(state.config, updateProgress);
    const boardIdMap = await resolveBoardIdMap(requiredNames, albums, state.config);
    const result = await moveAssignments(assignments, boardIdMap, state.config, updateProgress);
    updateProgress(100, "\u63a5\u53e3\u6dfb\u52a0\u6d41\u7a0b\u5b8c\u6210");
    showAddResult(result);
  } catch (error) {
    logger.error("\u6dfb\u52a0\u7b14\u8bb0\u5230\u4e13\u8f91\u5931\u8d25", error);
    showError(error);
  } finally {
    state.adding = false;
    setBusy(false);
  }
}

function cleanup() {
  state.observer?.disconnect();
  clearTimeout(state.scanTimer);
  window.removeEventListener("popstate", scheduleControls);
  window.removeEventListener("hashchange", scheduleControls);
  closeOverlay();
  removeUi();
  delete window[CLEANUP_KEY];
  delete window.__tabbitXhsAlbumBuilderExport;
  delete window.__tabbitXhsAlbumBuilderPrompt;
  delete window.__tabbitXhsAlbumBuilderCopyPrompt;
  delete window.__tabbitXhsAlbumBuilderApplyPlan;
  delete window.__tabbitXhsAlbumBuilderVersion;
}

function scheduleControls() {
  clearTimeout(state.scanTimer);
  state.scanTimer = setTimeout(() => ensureControls(handleRun), 180);
}

function init() {
  if (window[CLEANUP_KEY]) window[CLEANUP_KEY]();
  state.config = getConfig();
  state.granularity = state.config.defaultGranularity;
  state.publicAlbum = false;

  window[CLEANUP_KEY] = cleanup;
  window.__tabbitXhsAlbumBuilderVersion = "0.1.1-manual-review";
  installManualReviewHooks();
  installMoveProbe();
  ensureControls(handleRun);
  state.observer = new MutationObserver(scheduleControls);
  state.observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleControls);
  window.addEventListener("hashchange", scheduleControls);
  logger.debug("\u5c0f\u7ea2\u4e66\u667a\u80fd\u6784\u5efa\u4e13\u8f91\u6309\u94ae\u5df2\u542f\u7528", { config: state.config });
}

function getManualPayload() {
  if (!state.collected.length) {
    throw new Error("\u8fd8\u6ca1\u6709\u626b\u63cf\u7ed3\u679c\u3002\u8bf7\u5148\u70b9\u51fb\u201c\u667a\u80fd\u6784\u5efa\u4e13\u8f91\u201d\uff0c\u7b49\u5b83\u8bfb\u53d6\u6807\u9898\u540e\u518d\u5bfc\u51fa\u3002");
  }
  return buildManualReviewPayload({
    notes: state.collected,
    existingAlbums: state.existingAlbums,
    config: state.config,
    granularity: state.granularity
  });
}

function installManualReviewHooks() {
  window.__tabbitXhsAlbumBuilderExport = function exportPayload() {
    const payload = getManualPayload();
    console.debug("[Tabbit XHS] manual review payload", payload);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  };

  window.__tabbitXhsAlbumBuilderPrompt = function exportPrompt() {
    const prompt = buildManualReviewPrompt(getManualPayload());
    console.log(prompt);
    return prompt;
  };

  window.__tabbitXhsAlbumBuilderCopyPrompt = async function copyPrompt() {
    const prompt = buildManualReviewPrompt(getManualPayload());
    await navigator.clipboard.writeText(prompt);
    console.debug("[Tabbit XHS] \u5df2\u590d\u5236\u4eba\u5de5\u590d\u6838 prompt");
    return prompt;
  };

  window.__tabbitXhsAlbumBuilderApplyPlan = function applyPlan(input) {
    if (!state.collected.length) {
      throw new Error("\u8fd8\u6ca1\u6709\u626b\u63cf\u7ed3\u679c\uff0c\u65e0\u6cd5\u5bfc\u5165\u5206\u7c7b\u3002\u8bf7\u5148\u8fd0\u884c\u626b\u63cf\u3002");
    }
    state.plan = manualAssignmentsToPlan(input, state.collected, state.existingAlbums, state.config, state.granularity);
    logger.debug("\u5bfc\u5165\u4eba\u5de5\u590d\u6838\u5206\u7c7b\u7ed3\u679c", state.plan);
    showPlanDialog(state.collected, state.plan, { onCreate: handleCreate });
    return state.plan;
  };
}


  init();
})();
