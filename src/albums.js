import { findVisible, fireClick, isVisible, normalizeText, setInputValue, sleep, waitFor } from "./dom.js";
import { categoryKey, isRegularCategory } from "./categoryNames.js";
import { logger } from "./logger.js";
import { switchToAlbumTab } from "./scanner.js";

const albumCardSelector = 'a[href*="/board/"], .board-card, [class*="board-card"], [class*="board-item"]';
const xhsModalSelector = ".reds-modal-open .modal, .reds-modal-open [role='dialog'], .modal";

export function extractBoardId(href) {
  const value = String(href || "");
  const match = value.match(/\/board\/([A-Za-z0-9]+)/) || value.match(/[?&]boardId=([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
}

export function readAlbumsFromDom() {
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

export async function readExistingAlbums(config, onProgress = () => {}) {
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

export async function createAlbumViaUi(album, publicAlbum) {
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

export async function createAlbums(plan, existingAlbums, publicAlbum, config, onProgress = () => {}) {
  await switchToAlbumTab();
  await sleep(800);

  const existingNames = new Set(existingAlbums.map((album) => album.name || album).filter(Boolean));
  const existingKeys = new Set(Array.from(existingNames).map(categoryKey).filter(Boolean));
  const result = { created: [], skipped: [], failed: [] };
  const categories = (plan.categories || []).filter(isRegularCategory);

  for (let index = 0; index < categories.length; index += 1) {
    const album = categories[index];
    onProgress(18 + Math.round((index / Math.max(1, categories.length)) * 72), `正在处理 ${index + 1}/${categories.length}：${album.name}`);

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
      logger.error(`创建专辑失败：${album.name}`, error);
    }
  }

  logger.debug("创建专辑结果", result);
  return result;
}
