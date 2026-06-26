import { fireClick, isVisible, mergeUnique, normalizeText, sleep, updateUrlParams, visibleAll } from "./dom.js";
import { logger } from "./logger.js";

const tabBarSelector = ".tab-content-item .sub-tab-list, .tab-content-item .reds-tabs-list, .feeds-tab-container .sub-tab-list";
const noteLinkSelector = [
  "section.note-item a[href]",
  ".note-item a[href]",
  "a.title[href]",
  'a[href*="/explore/"]',
  'a[href*="/discovery/item/"]',
  'a[href*="/board/"]'
].join(", ");

export function isXhsPage() {
  return /xiaohongshu\.com$/i.test(location.hostname) || /xiaohongshu\.com/i.test(location.hostname);
}

export function isFavNotePage() {
  const url = new URL(location.href);
  return isXhsPage() && url.searchParams.get("tab") === "fav" && url.searchParams.get("subTab") === "note";
}

export function findFavSubTabBar() {
  return Array.from(document.querySelectorAll(tabBarSelector)).find((element) => {
    const text = normalizeText(element.textContent);
    return isVisible(element) && /笔记\s*・?\s*\d*/.test(text) && /专辑\s*・?\s*\d*/.test(text);
  });
}

export function findFavSubTab(matcher) {
  const bar = findFavSubTabBar();
  if (!bar) return null;
  return Array.from(bar.querySelectorAll('.reds-tab-item, [role="tab"], button, a')).find((element) => {
    return isVisible(element) && matcher(normalizeText(element.textContent), element);
  });
}

export async function switchToNoteTab() {
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

export async function switchToAlbumTab() {
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

export function extractNoteId(href) {
  const value = String(href || "");
  const match =
    value.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/) ||
    value.match(/\/user\/profile\/[A-Za-z0-9_-]+\/([A-Za-z0-9]+)/) ||
    value.match(/\/board\/[A-Za-z0-9_-]+\/([A-Za-z0-9]+)/) ||
    value.match(/[?&](?:note_id|noteId|notes_id|notesId)=([A-Za-z0-9]+)/);
  return match ? match[1] : "";
}

export function noteKey(note) {
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

export function collectVisibleNotes() {
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

export async function scanCollectedNotes(config, onProgress = () => {}) {
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
