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
  if (!error) return "未知错误";
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
        reject(new Error("等待页面元素超时"));
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
    return isVisible(element) && /笔记\s*・?\s*\d*/.test(text) && /专辑\s*・?\s*\d*/.test(text);
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
  const tab = findFavSubTab((text) => /笔记/.test(text));
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
  const tab = findFavSubTab((text) => /专辑/.test(text));
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
  if (/^(赞|评论|收藏|分享|更多|登录|打开APP|小红书|关注|已关注)$/i.test(text)) return false;
  if (/^\d+(\.\d+)?[万wWkK]?$/.test(text)) return false;
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
    const title = extractTitle(card, link) || (extractNoteId(href) ? `笔记 ${extractNoteId(href)}` : "");
    if (!titleLooksValid(title)) continue;
    notes.push({ title, href, noteId: extractNoteId(href), isCollected: true });
  }
  return mergeUnique(notes, noteKey);
}

async function scanCollectedNotes(config, onProgress = () => {}) {
  if (!isFavNotePage()) throw new Error("请先切换到收藏页的笔记子分类后再运行。");

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
      onProgress(58, `已达到标题选择上限 ${limit}，停止滚动`);
      break;
    }

    onProgress(Math.min(58, 10 + (round / Math.max(1, maxRounds)) * 48), `正在滚动收藏笔记，已捕获 ${notes.length}/${limit} 个标题`);
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
  logger.debug("扫描收藏笔记完成", { count: notes.length, limit });
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
    const name = normalizeText(nameNode?.textContent || element.textContent).replace(/\s*笔记\s*・?\s*\d+.*$/i, "");
    if (!name || /创建专辑|编辑专辑/.test(name)) continue;
    if (!albums.has(name)) albums.set(name, { id, name });
    else if (id && !albums.get(name).id) albums.get(name).id = id;
  }

  for (const node of Array.from(document.querySelectorAll('.board-name, .board-card .board-name, [class*="board-name"]'))) {
    const name = normalizeText(node.textContent).replace(/\s*笔记\s*・?\s*\d+.*$/i, "");
    if (name && !albums.has(name) && !/创建专辑|编辑专辑/.test(name)) albums.set(name, { id: "", name });
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

    onProgress(Math.min(30, 10 + round), `正在读取已有专辑，已发现 ${albums.size} 个`);
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
  logger.debug("读取已有专辑完成", { count: result.length, albums: result.slice(0, 20) });
  return result;
}

function albumIntro(album) {
  if (album.intro) return normalizeText(album.intro).slice(0, 140);
  const sample = (album.titles || []).slice(0, 3).join("、");
  return `由收藏笔记智能归类生成，包含 ${album.count || (album.titles || []).length || 0} 篇相关内容${sample ? `：${sample}` : ""}。`.slice(0, 140);
}

async function openCreateAlbumDialog() {
  let button = findVisible(".create-board, button, div, a", (text) => text === "创建专辑" || text === "创建");
  if (!button) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await sleep(700);
    button = findVisible(".create-board, button, div, a", (text) => text === "创建专辑" || text === "创建");
  }
  if (!button) throw new Error("没有找到“创建专辑”入口");

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
  if (!titleInput) throw new Error("没有找到专辑标题输入框");

  setInputValue(titleInput, album.name);
  if (introInput) setInputValue(introInput, albumIntro(album));
  setAlbumVisibility(modal, publicAlbum);
  await sleep(240);

  const done = Array.from(modal.querySelectorAll(".btn.done, button, div")).find((element) => isVisible(element) && normalizeText(element.textContent) === "完成");
  if (!done) throw new Error("没有找到完成按钮");

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
    'input[placeholder*="专辑"]',
    'input[placeholder*="标题"]',
    'input[placeholder*="名称"]'
  ].join(", ")));
  return candidates.find((element) => {
    const placeholder = normalizeText(element.getAttribute("placeholder"));
    const type = normalizeText(element.getAttribute("type")).toLowerCase();
    return isVisible(element) && type !== "hidden" && !/搜索|search/i.test(placeholder);
  }) || candidates.find(isVisible) || null;
}

function findAlbumIntroInput(modal) {
  return Array.from(modal.querySelectorAll([
    "textarea.textarea-content",
    "textarea",
    'input[placeholder*="简介"]',
    'input[placeholder*="介绍"]',
    '[contenteditable="true"]'
  ].join(", "))).find((element) => {
    const placeholder = normalizeText(element.getAttribute("placeholder"));
    return isVisible(element) && !/搜索|search/i.test(placeholder);
  }) || null;
}

async function createAlbums(plan, existingAlbums, publicAlbum, config, onProgress = () => {}) {
  await switchToAlbumTab();
  await sleep(800);

  const existingNames = new Set(existingAlbums.map((album) => album.name || album).filter(Boolean));
  const result = { created: [], skipped: [], failed: [] };
  const categories = (plan.categories || []).filter((album) => !album.isOther);

  for (let index = 0; index < categories.length; index += 1) {
    const album = categories[index];
    onProgress(18 + Math.round((index / Math.max(1, categories.length)) * 72), `正在处理 ${index + 1}/${categories.length}：${album.name}`);

    if (existingNames.has(album.name)) {
      result.skipped.push(album.name);
      continue;
    }

    try {
      await createAlbumViaUi(album, publicAlbum);
      result.created.push(album.name);
      existingNames.add(album.name);
    } catch (error) {
      result.failed.push({ name: album.name, error: error.message || String(error) });
      logger.error(`创建专辑失败：${album.name}`, error);
    }
  }

  logger.debug("创建专辑结果", result);
  return result;
}


// ---- src/classifier.js ----

function isOtherName(name) {
  return /^(其他|未分类|杂项|其它|其他收藏)$/i.test(normalizeText(name));
}

function categoryKey(name) {
  return normalizeText(name).replace(/[《》"'`]/g, "").toLowerCase();
}

function cleanCategoryName(name, index) {
  return normalizeText(name).replace(/[《》"'`]/g, "").slice(0, 18) || `分类${index + 1}`;
}

function introFor(category) {
  if (category.intro) return normalizeText(category.intro).slice(0, 140);
  const sample = (category.titles || []).slice(0, 3).join("、");
  return `由收藏笔记智能归类生成，包含 ${category.count || (category.titles || []).length || 0} 篇相关内容${sample ? `：${sample}` : ""}。`.slice(0, 140);
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
  return Array.from(categoryMap.values()).filter((category) => !isOtherName(category.name) && (category.titles?.length || !category.isExisting)).length;
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
      map.set(key, { name, title: name, intro: "已有小红书专辑，优先复用。", count: 0, titles: [], isExisting: true });
    }
  }
  return map;
}

function localCategoryForTitle(title, granularity) {
  const text = normalizeText(title);
  const fineRules = [
    ["西藏旅行", ["西藏", "拉萨", "阿里", "川藏", "波密", "藏东", "冰川", "喜马拉雅", "318"]],
    ["新疆路线", ["新疆", "阿勒泰", "伊犁", "赛里木湖", "禾木", "喀纳斯", "安集海"]],
    ["日本旅行", ["日本", "东京", "大阪", "京都", "北海道", "富士"]],
    ["海滨城市", ["威海", "蓝眼泪", "海边", "海滨"]],
    ["美食", ["美食", "餐厅", "咖啡", "甜品", "火锅", "烧烤", "菜谱", "食谱"]],
    ["穿搭美妆", ["穿搭", "妆", "口红", "护肤", "发型", "香水"]],
    ["学习工作", ["学习", "论文", "英语", "考研", "工作", "效率", "笔记"]],
    ["家居生活", ["家居", "装修", "收纳", "房间", "租房"]],
    ["机位与拍照", ["机位", "拍照", "摄影", "滤镜", "壁纸", "live"]]
  ];
  const coarseRules = [
    ["旅行", ["旅行", "旅游", "西藏", "拉萨", "阿里", "川藏", "新疆", "阿勒泰", "伊犁", "威海", "日本", "泰国", "国外", "海外", "海边", "攻略", "路线", "景点"]],
    ["美食", ["美食", "餐厅", "咖啡", "甜品", "火锅", "烧烤", "菜谱", "食谱"]],
    ["穿搭美妆", ["穿搭", "妆", "口红", "护肤", "发型", "香水"]],
    ["学习工作", ["学习", "论文", "英语", "考研", "工作", "效率", "笔记"]],
    ["家居生活", ["家居", "装修", "收纳", "房间", "租房"]],
    ["拍照机位", ["机位", "拍照", "摄影", "滤镜", "壁纸", "live"]]
  ];
  const rules = granularity === "fine" ? fineRules : coarseRules;
  return rules.find(([, keys]) => keys.some((key) => text.includes(key)))?.[0] || "其他";
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
  if (!value) throw new Error("LLMBridge 返回为空");
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
    throw new Error("LLMBridge 不存在");
  }

  let timer = null;
  try {
    const result = await Promise.race([
      window.LLMBridge.chat(prompt, "json"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`LLMBridge 分批分析超过 ${Math.round(config.llmBatchTimeoutMs / 1000)} 秒`)), config.llmBatchTimeoutMs);
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
        return `${index + 1}. ${category.name}${category.isExisting ? "（已有专辑）" : "（新增分类）"}${sample ? `；已归类示例：${sample}` : ""}`;
      }).join("\n")
    : "暂无已有分类。";

  const remaining = Math.max(0, config.maxCategories - usedRegularCount(categoryMap));
  const granularityInstruction =
    granularity === "fine"
      ? "当前为细粒度：允许按国家、城市、地区、路线、内容主题继续拆分。例如“日本旅行”和“泰国旅行”可以分别归为“日本旅行”“泰国旅行”；但仍要避免为单篇标题单独建类。"
      : "当前为粗粒度：优先合并为更大的通用主题，不按国家、城市或路线过度拆分。例如“日本旅行”“泰国旅行”“新疆旅行”应优先合并为“旅行”；只有主题明显不同才拆分。";
  const addInstruction =
    remaining > 0
      ? granularity === "fine"
        ? "只有当标题无法自然归入现有分类时，才可以新增更具体分类；新增分类名可以按国家、城市、地区、路线或明确主题拆分，但不要为单篇标题单独建类。"
        : "只有当标题无法自然归入现有分类时，才可以新增宽泛分类；新增分类名要适合作为专辑标题，简短自然，不要太细。"
      : "常规分类已达到上限，禁止新增常规分类；无法归入现有分类的标题必须放入“其他”。";
  const titles = batch.map((note, index) => `${index + 1}. ${note.title}`).join("\n");

  return [
    "你是小红书收藏整理助手。现在按批次整理用户收藏笔记标题，并维护一组稳定的小红书专辑分类。",
    `这是第 ${batchIndex + 1}/${batchCount} 批，每批最多 ${config.classificationBatchSize} 个标题。${granularityInstruction}`,
    `当前已有/已新增的常规分类如下。请优先复用这些分类，不要因为表达略有差异就新增分类：\n${contextText}`,
    `常规分类总上限为 ${config.maxCategories} 个，当前已有 ${usedRegularCount(categoryMap)} 个已使用分类，还可以新增 ${remaining} 个。`,
    addInstruction,
    "只做本批标题到分类名的映射，不要解释，不要复述标题全文。每个序号必须且只能归入一个分类。无法可靠归入常规分类的序号放入“其他”。",
    '只返回 JSON，结构：{"items":[{"i":1,"name":"已有或新增专辑标题"}]}。i 是标题序号，name 是分类名。',
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
    if (!isOtherName(rawName)) {
      const key = categoryKey(rawName);
      if (!categoryMap.has(key) && canAddCategory(categoryMap, config)) {
        const name = cleanCategoryName(rawName, categoryMap.size);
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
  const otherCategory = { name: "其他", title: "其他", intro: "未能可靠归入上述分类的收藏笔记，作为备注保留。", count: 0, titles: [], isOther: true };
  state.assignmentCache = new Map();

  for (let index = 0; index < batches.length; index += 1) {
    onProgress(Math.min(90, 64 + Math.round((index / Math.max(1, batches.length)) * 25)), `正在按${granularity === "fine" ? "细粒度" : "粗粒度"}分批分析 ${index + 1}/${batches.length}`);

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
      logger.warn("LLM 分批分类失败，使用本地兜底", { error: errorMessage(error), detail: errorDetail(error) });
      assignLocally(batch, categoryMap, otherCategory, granularity, config);
    }
    await sleep(80);
  }

  const categories = Array.from(categoryMap.values())
    .filter((category) => category.titles.length)
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
  logger.debug("分类结果", plan);
  return plan;
}


// ---- src/manualReview.js ----

function compactTitle(title) {
  return normalizeText(title).toLowerCase().replace(/\s+/g, "");
}

function isOtherName(name) {
  return /^(其他|未分类|杂项|其它|其他收藏)$/i.test(normalizeText(name));
}

function cleanCategoryName(name, index) {
  return normalizeText(name).replace(/[《》"'`]/g, "").slice(0, 18) || `分类${index + 1}`;
}

function categoryIntro(category) {
  const sample = (category.titles || []).slice(0, 3).join("、");
  return `由收藏笔记智能归类生成，包含 ${category.count || (category.titles || []).length || 0} 篇相关内容${sample ? `：${sample}` : ""}。`.slice(0, 140);
}

function buildManualReviewPayload({ notes, existingAlbums, config, granularity }) {
  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  return {
    version: 1,
    task: "classify_xhs_favorite_notes",
    granularity,
    rules: [
      granularity === "fine"
        ? "细粒度：可以按国家、城市、地区、路线或明确主题拆分，例如日本旅行、新疆路线。"
        : "粗粒度：优先合并为通用主题，例如日本旅行、泰国旅行、新疆旅行尽量合并为旅行。",
      `常规分类上限为 ${config.maxCategories} 个；无法可靠归类的放入“其他”。`,
      "优先复用 existingAlbums 中已有专辑名。",
      "每个序号必须且只能归入一个分类。"
    ],
    expectedOutput: {
      items: [
        { i: 1, name: "旅行" },
        { i: 2, name: "美食" }
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
  const existing = payload.existingAlbums.length ? payload.existingAlbums.join("、") : "暂无";
  const notes = payload.notes.map((note) => `${note.i}. ${note.title}`).join("\n");
  return [
    "请帮我给小红书收藏笔记做专辑分类。",
    `分类粒度：${payload.granularity === "fine" ? "细粒度" : "粗粒度"}`,
    `常规分类上限：${payload.limits.maxCategories}`,
    `已有专辑，优先复用：${existing}`,
    "要求：每个序号必须且只能归入一个分类；无法可靠归类放入“其他”；只返回 JSON，不要解释。",
    'JSON 格式：{"items":[{"i":1,"name":"旅行"},{"i":2,"name":"美食"}]}',
    "",
    notes
  ].join("\n");
}

function manualAssignmentsToPlan(input, notes, existingAlbums, config, granularity) {
  const payload = typeof input === "string" ? JSON.parse(input) : input;
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.assignments) ? payload.assignments : [];
  if (!items.length) throw new Error('导入分类 JSON 需要包含 items，例如 {"items":[{"i":1,"name":"旅行"}]}');

  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  const categories = new Map();
  const other = { name: "其他", title: "其他", intro: "", count: 0, titles: [], isOther: true };
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
    if (!isOtherName(rawName)) {
      const name = cleanCategoryName(rawName, categories.size);
      const key = compactTitle(name);
      if (!categories.has(key)) {
        const regularCount = Array.from(categories.values()).filter((candidate) => !candidate.isOther).length;
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
    .filter((category) => category.titles.length)
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
      <div class="tabbit-xhs-controls" role="group" aria-label="数量上限">
        <label class="tabbit-xhs-select"><span>分类</span><select data-limit-key="maxCategories" aria-label="分类数量上限">${optionsHtml([5, 10, 15, 20, 30, 50], state.config.maxCategories)}</select></label>
        <label class="tabbit-xhs-select"><span>标题</span><select data-limit-key="maxTitlesForPrompt" aria-label="标题选择数量上限">${optionsHtml([100, 200, 300, 500, 1000, 2000, 5000], state.config.maxTitlesForPrompt)}</select></label>
      </div>
      <div class="tabbit-xhs-granularity" role="group" aria-label="分类粒度">
        <button class="tabbit-xhs-granularity-option" type="button" data-granularity="coarse" aria-pressed="false">粗</button>
        <button class="tabbit-xhs-granularity-option" type="button" data-granularity="fine" aria-pressed="false">细</button>
      </div>
      <button id="${BUTTON_ID}" type="button" aria-label="智能构建小红书收藏专辑"><span aria-hidden="true">＋</span><span>智能构建专辑</span></button>
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
  const iconHtml = busy ? '<span class="tabbit-xhs-spinner" aria-hidden="true"></span>' : "<span aria-hidden=\"true\">＋</span>";
  button.innerHTML = `${iconHtml}<span>${escapeHtml(label || "智能构建专辑")}</span>`;
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
        <button class="tabbit-xhs-close" type="button" aria-label="关闭">×</button>
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
  const message = normalizeText(error?.message || error || "未知错误");
  overlayShell(
    "未完成",
    "智能构建专辑失败",
    message,
    "",
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action primary" type="button" data-action="close">知道了</button></div>'
  ).querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
}

function showPlanDialog(notes, plan, callbacks) {
  state.plan = plan;
  const categories = plan.categories || [];
  const regularCount = categories.filter((category) => !category.isOther).length;
  const other = categories.find((category) => category.isOther);
  const analyzed = Number(plan.analyzedTitleCount) || Math.min(notes.length, state.config.maxTitlesForPrompt);
  const total = Number(plan.totalTitleCount) || notes.length;
  const batchSize = Number(plan.batchSize) || state.config.classificationBatchSize;
  const granularityName = plan.granularity === "fine" ? "细粒度" : "粗粒度";
  const subtitle =
    `${granularityName}：已选择 ${analyzed}/${total} 个标题参与分类，按每批 ${batchSize} 个增量分析。` +
    ` 将创建 ${regularCount} 个常规分类专辑${other ? `，另有“其他”${Number(other.count) || (other.titles || []).length || 0} 篇不计入上限` : ""}，默认私有。`;

  const body = `
    <div class="tabbit-xhs-summary">
      <div class="tabbit-xhs-stat"><span>采集</span><b>${total}</b></div>
      <div class="tabbit-xhs-stat"><span>分析</span><b>${analyzed}</b></div>
      <div class="tabbit-xhs-stat"><span>已有专辑</span><b>${Number(plan.existingAlbumCount) || 0}</b></div>
      <div class="tabbit-xhs-stat"><span>分类上限</span><b>${state.config.maxCategories}</b></div>
    </div>
    <ul class="tabbit-xhs-list">
      ${categories.map((category) => `
        <li class="tabbit-xhs-item">
          <div class="tabbit-xhs-item-head"><h3>${escapeHtml(category.name)}</h3><span class="tabbit-xhs-count">${category.isOther ? "未分类" : `${Number(category.count) || (category.titles || []).length || 0} 篇`}</span></div>
          <p>${escapeHtml((category.titles || []).slice(0, 3).join(" / ") || category.intro || "收藏内容分类")}</p>
        </li>
      `).join("")}
    </ul>
    <div class="tabbit-xhs-options">
      <div><strong>公开专辑</strong><span>${state.publicAlbum ? "其他人可以查看" : "仅自己可见"}</span></div>
      <button class="tabbit-xhs-switch" type="button" role="switch" aria-checked="${state.publicAlbum ? "true" : "false"}" aria-label="公开专辑"></button>
    </div>
  `;
  const overlay = overlayShell(
    "分析完成",
    `已归类 ${analyzed} 篇收藏笔记`,
    subtitle,
    body,
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action secondary" type="button" data-action="cancel">取消</button><button class="tabbit-xhs-action primary" type="button" data-action="create">创建专辑</button></div>'
  );

  overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", closeOverlay);
  overlay.querySelector(".tabbit-xhs-switch")?.addEventListener("click", (event) => {
    state.publicAlbum = !state.publicAlbum;
    event.currentTarget.setAttribute("aria-checked", state.publicAlbum ? "true" : "false");
    const label = overlay.querySelector(".tabbit-xhs-options span");
    if (label) label.textContent = state.publicAlbum ? "其他人可以查看" : "仅自己可见";
  });
  overlay.querySelector('[data-action="create"]')?.addEventListener("click", callbacks.onCreate);
}

function showCreateResult(result, addCount, callbacks) {
  const body = `
    <ul class="tabbit-xhs-list">
      ${result.created.map((name) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(name)}</h3><span class="tabbit-xhs-count">已创建</span></div></li>`).join("")}
      ${result.skipped.map((name) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(name)}</h3><span class="tabbit-xhs-count">已存在</span></div></li>`).join("")}
      ${result.failed.map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.name)}</h3><span class="tabbit-xhs-count">失败</span></div><p>${escapeHtml(item.error)}</p></li>`).join("")}
    </ul>
  `;
  const overlay = overlayShell(
    "创建完成",
    `新增 ${result.created.length} 个专辑，跳过 ${result.skipped.length} 个`,
    result.failed.length ? `有 ${result.failed.length} 个未完成，请查看列表。` : `已按现有专辑去重。可添加 ${addCount} 篇笔记到对应专辑。`,
    body,
    `<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action secondary" type="button" data-action="close">完成</button><button class="tabbit-xhs-action primary" type="button" data-action="add" ${addCount ? "" : "disabled"}>接口一键添加</button></div>`
  );
  overlay.querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
  overlay.querySelector('[data-action="add"]')?.addEventListener("click", callbacks.onAdd);
}

function showAddResult(result) {
  const body = `
    <ul class="tabbit-xhs-list">
      ${result.added.slice(0, 30).map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.title)}</h3><span class="tabbit-xhs-count">${escapeHtml(item.category)}</span></div></li>`).join("")}
      ${result.failed.map((item) => `<li class="tabbit-xhs-item"><div class="tabbit-xhs-item-head"><h3>${escapeHtml(item.title)}</h3><span class="tabbit-xhs-count">失败</span></div><p>${escapeHtml(`${item.category}：${item.error}`)}</p></li>`).join("")}
    </ul>
  `;
  overlayShell(
    "添加完成",
    `已添加 ${result.added.length} 篇，失败 ${result.failed.length} 篇`,
    "已通过小红书前端接口封装加入对应专辑。",
    body,
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action primary" type="button" data-action="close">完成</button></div>'
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
  return /无登录|登录信息|请先登录|未登录|login|unauthorized|401|403/i.test(errorMessage(error));
}

function assertApiSuccess(value, label) {
  if (!value || typeof value !== "object") return value;
  const code = value.code ?? value.data?.code;
  const success = value.success ?? value.data?.success;
  const message = value.msg || value.message || value.data?.msg || value.data?.message || "";
  if (code === 0 || success === true || (code == null && success == null)) return value;
  throw new Error(`${label} 返回失败${code != null ? ` code=${code}` : ""}${message ? `：${message}` : ""}`);
}

function getWebpackRequire() {
  let requireFn = null;
  const chunkName = `tabbit-xhs-api-${Date.now()}`;
  const chunks = (window.webpackChunkxhs_pc_web = window.webpackChunkxhs_pc_web || []);
  chunks.push([[chunkName], {}, (runtimeRequire) => {
    requireFn = runtimeRequire;
  }]);
  if (!requireFn) throw new Error("没有获取到小红书 webpack runtime，无法调用前端接口封装");
  return requireFn;
}

function requireModule(requireFn, id) {
  try {
    return requireFn?.(id);
  } catch (error) {
    logger.warn("require 小红书模块失败", { id, error: errorMessage(error) });
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
    logger.warn("遍历 webpack cache 失败", { error: errorMessage(error), detail: errorDetail(error) });
  }

  if (!found.move && requireFn?.m) {
    for (const id of Object.keys(requireFn.m)) {
      discoverFromExports(requireModule(requireFn, id), found, seen);
      if (found.move && found.collect && found.boardUser) break;
    }
  }

  logger.debug("webpack API 探测结果", {
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
    throw new Error("没有找到小红书 note/move 内部 API。可能是小红书前端打包结构已变化，请查看 Console 的 webpack API 探测结果。");
  }
  const api = discoverApi(getWebpackRequire());
  state.apiModule = api;
  if (!api.move) {
    // TODO: 小红书改版后，可以在这里补充新的模块签名或公开接口适配。
    throw new Error("没有找到小红书 note/move 内部 API。可能是小红书前端打包结构已变化，请查看 Console 的 webpack API 探测结果。");
  }
  return api;
}

function withTimeout(promise, label, timeoutMs) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} 超过 ${Math.round(timeoutMs / 1000)} 秒`)), timeoutMs);
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
      logger.debug("API 请求完成", { label, attempt: attempt + 1, response: summarizeResponse(result) });
      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      const delay = config.apiRetryDelay * (attempt + 1);
      logger.warn("API 请求失败，准备重试", { label, attempt: attempt + 1, delay, error: errorMessage(error), detail: errorDetail(error) });
      await sleep(delay);
    }
  }
  logger.error(`API 请求最终失败：${label}`, lastError);
  throw lastError || new Error(`${label} 失败`);
}

async function checkLogin(config) {
  logger.debug("登录态检查开始");
  const response = await withTimeout(
    fetch("https://edith.xiaohongshu.com/api/sns/web/v2/user/me", {
      method: "GET",
      credentials: "include",
      mode: "cors",
      headers: { accept: "application/json, text/plain, */*" }
    }),
    "检查小红书登录态",
    config.apiRequestTimeoutMs
  );

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`检查小红书登录态返回非 JSON：${errorMessage(error)}`);
  }

  logger.debug("登录态检查返回", summarizeResponse(payload));
  if (!response.ok) throw new Error(`检查小红书登录态 HTTP ${response.status}`);
  assertApiSuccess(payload, "检查小红书登录态");
  if (isLoginError(payload)) throw new Error(`小红书登录态不可用：${errorMessage(payload)}`);
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
    logger.warn("没有解析到 profile user_id，跳过 board/user 兜底");
    return [];
  }

  const api = getApiModule();
  if (!api.boardUser) {
    logger.warn("没有找到 board/user API，跳过专辑 id 兜底");
    return [];
  }

  const result = await retry(() => api.boardUser({ user_id: userId }), "查询专辑列表", config, 1);
  assertApiSuccess(result, "查询专辑列表");
  const boards = collectBoardItems(result);
  logger.debug("board/user 专辑解析完成", { count: boards.length, names: boards.slice(0, 20).map((item) => item.name) });
  return boards;
}

async function resolveBoardIdMap(requiredNames, domAlbums, config) {
  const map = new Map();
  for (const album of domAlbums || []) {
    if (album?.id && album?.name) map.set(album.name, album.id);
  }

  const missing = requiredNames.filter((name) => name && !map.has(name));
  if (missing.length) {
    logger.warn("DOM 缺少目标专辑 id，尝试 board/user 兜底", { missing });
    try {
      for (const album of await boardUserFallback(config)) {
        if (album.id && album.name) map.set(album.name, album.id);
      }
    } catch (error) {
      logger.warn("board/user 兜底失败", { error: errorMessage(error), detail: errorDetail(error) });
    }
  }

  const stillMissing = requiredNames.filter((name) => name && !map.has(name));
  if (stillMissing.length) {
    logger.warn("仍缺少目标专辑 id", { stillMissing, parsedNames: Array.from(map.keys()) });
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
    if (!note || !category || /^(其他|未分类|杂项|其它|其他收藏)$/i.test(category)) return;
    const title = normalizeText(note.title);
    const noteId = note.noteId;
    const key = `${noteId || noteKey(note) || title}::${category}`;
    if (title && !seen.has(key)) {
      seen.add(key);
      assignments.push({ title, href: note.href, noteId, category, isCollected: note.isCollected !== false });
    }
  };

  for (const category of plan.categories) {
    if (category.isOther) continue;
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
  logger.debug("构建 move 映射", { count: assignments.length, sample: assignments.slice(0, 10) });
  return assignments;
}

async function moveOne(assignment, boardIdMap, config) {
  if (!assignment.noteId) throw new Error("没有从笔记链接中解析到 noteId");
  if (!assignment.isCollected) throw new Error("跳过非收藏来源笔记，避免移动自己发布的笔记");
  const targetBoardId = boardIdMap.get(assignment.category);
  if (!targetBoardId) throw new Error(`没有找到专辑 id：${assignment.category}`);

  const api = getApiModule();
  const context = { title: assignment.title, noteId: assignment.noteId, category: assignment.category, targetBoardId };
  logger.debug("move API 调用参数", context);

  if (config.apiEnsureCollectBeforeMove) {
    if (!api.collect) throw new Error("没有找到 note/collect 内部 API，无法执行预收藏确认");
    await retry(() => api.collect({ note_id: assignment.noteId }), `收藏笔记 ${assignment.noteId}`, config, 1)
      .then((result) => assertApiSuccess(result, `收藏笔记 ${assignment.noteId}`));
  }

  const body = { target_board_id: targetBoardId, notes_id: assignment.noteId };
  const result = await retry(() => api.move(body), `移动笔记 ${assignment.noteId} 到专辑`, config);
  assertApiSuccess(result, `移动笔记 ${assignment.noteId} 到专辑`);
  return result;
}

async function moveAssignments(assignments, boardIdMap, config, onProgress = () => {}) {
  await checkLogin(config);
  getApiModule();

  const result = { added: [], failed: [] };
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index];
    onProgress(12 + Math.round((index / Math.max(1, assignments.length)) * 84), `正在添加 ${index + 1}/${assignments.length}：${assignment.title}`);
    try {
      await moveOne(assignment, boardIdMap, config);
      result.added.push(assignment);
    } catch (error) {
      if (isLoginError(error)) throw new Error(`小红书登录态失效，请重新登录后再试：${errorMessage(error)}`);
      result.failed.push({ ...assignment, error: errorMessage(error) });
      logger.error(`移动笔记失败：${assignment.title}`, error);
    }
    if (config.apiAddDelay) await sleep(config.apiAddDelay);
  }
  logger.debug("move 批处理完成", { added: result.added.length, failed: result.failed.length });
  return result;
}

// Debug hook for manual verification in Console.
function installMoveProbe() {
  window.__tabbitXhsApiMoveProbe = async function probe(input = {}) {
    const noteId = normalizeText(input.noteId || input.notes_id);
    const targetBoardId = normalizeText(input.targetBoardId || input.target_board_id);
    if (!noteId || !targetBoardId) {
      throw new Error("需要传入 noteId 和 targetBoardId，例如 window.__tabbitXhsApiMoveProbe({ noteId, targetBoardId })");
    }
    const api = getApiModule();
    const body = { target_board_id: targetBoardId, notes_id: noteId };
    logger.debug("manual move probe start", { body, moveSource: api.moveSource });
    const response = await api.move(body);
    assertApiSuccess(response, `手动探针移动笔记 ${noteId} 到专辑`);
    logger.debug("manual move probe success", summarizeResponse(response));
    return response;
  };
}


// ---- src/index.js ----

async function handleRun() {
  if (state.running) return;
  state.running = true;
  state.publicAlbum = false;
  setBusy(true, "采集中");

  try {
    if (!isFavNotePage()) throw new Error("请先切换到收藏页的笔记子分类后再运行。");

    showProgress("正在读取已有专辑", "先进入专辑页面获取已有分类名称");
    state.existingAlbums = await readExistingAlbums(state.config, updateProgress);

    updateProgress(34, `已读取 ${state.existingAlbums.length} 个已有专辑，准备回到笔记页`);
    await switchToNoteTab();

    showProgress("正在扫描收藏笔记", `已读取 ${state.existingAlbums.length} 个已有专辑，开始滚动当前页面并收集标题`);
    state.collected = await scanCollectedNotes(state.config, updateProgress);
    if (!state.collected.length) throw new Error("没有读取到收藏笔记标题");

    updateProgress(62, `已捕获 ${state.collected.length} 个标题，准备按每批 ${state.config.classificationBatchSize} 个增量分类`);
    const existingNames = state.existingAlbums.map((album) => album.name);
    state.plan = await classifyNotes(state.collected, existingNames, {
      config: state.config,
      granularity: state.granularity
    }, updateProgress);
    if (!state.plan.categories?.length) throw new Error("没有生成可创建的分类。");

    updateProgress(100, "分类完成");
    showPlanDialog(state.collected, state.plan, { onCreate: handleCreate });
  } catch (error) {
    logger.error("小红书智能构建专辑失败", error);
    showError(error);
  } finally {
    state.running = false;
    setBusy(false);
  }
}

async function handleCreate() {
  if (state.running || !state.plan?.categories?.length) return;
  state.running = true;
  setBusy(true, "创建中");

  try {
    showProgress("正在创建专辑", "正在进入专辑页面并检查已有专辑");
    const freshAlbums = await readExistingAlbums(state.config, updateProgress);
    state.existingAlbums = freshAlbums.length ? freshAlbums : state.existingAlbums;
    const result = await createAlbums(state.plan, state.existingAlbums, state.publicAlbum, state.config, updateProgress);
    updateProgress(100, "创建流程完成");

    const assignments = buildAssignments(state.plan, state.collected);
    showCreateResult(result, assignments.length, { onAdd: handleAdd });
  } catch (error) {
    logger.error("创建专辑流程失败", error);
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
    showError(new Error("没有可添加到专辑的笔记映射。请先完成分类和创建专辑。"));
    return;
  }

  state.adding = true;
  setBusy(true, "添加中");
  showProgress("正在通过接口添加笔记", `准备处理 ${assignments.length} 篇笔记`);

  try {
    updateProgress(6, "正在读取专辑 id");
    const requiredNames = Array.from(new Set(assignments.map((item) => item.category).filter(Boolean)));
    const albums = await readExistingAlbums(state.config, updateProgress);
    const boardIdMap = await resolveBoardIdMap(requiredNames, albums, state.config);
    const result = await moveAssignments(assignments, boardIdMap, state.config, updateProgress);
    updateProgress(100, "接口添加流程完成");
    showAddResult(result);
  } catch (error) {
    logger.error("添加笔记到专辑失败", error);
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
  logger.debug("小红书智能构建专辑按钮已启用", { config: state.config });
}

function getManualPayload() {
  if (!state.collected.length) {
    throw new Error("还没有扫描结果。请先点击“智能构建专辑”，等它读取标题后再导出。");
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
    console.debug("[Tabbit XHS] 已复制人工复核 prompt");
    return prompt;
  };

  window.__tabbitXhsAlbumBuilderApplyPlan = function applyPlan(input) {
    if (!state.collected.length) {
      throw new Error("还没有扫描结果，无法导入分类。请先运行扫描。");
    }
    state.plan = manualAssignmentsToPlan(input, state.collected, state.existingAlbums, state.config, state.granularity);
    logger.debug("导入人工复核分类结果", state.plan);
    showPlanDialog(state.collected, state.plan, { onCreate: handleCreate });
    return state.plan;
  };
}


  init();
})();
