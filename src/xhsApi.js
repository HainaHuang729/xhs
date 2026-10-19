import { logger, errorDetail, errorMessage } from "./logger.js";
import { isOtherName, isRegularCategory } from "./categoryNames.js";
import { normalizeText, sleep } from "./dom.js";
import { state } from "./state.js";
import { noteKey } from "./scanner.js";

function summarizeResponse(value) {
  if (!value || typeof value !== "object") return value;
  return {
    code: value.code ?? value.data?.code,
    success: value.success ?? value.data?.success,
    msg: value.msg || value.message || value.data?.msg || value.data?.message || "",
    keys: Object.keys(value).slice(0, 8)
  };
}

export function isLoginError(error) {
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

export function getApiModule() {
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

export async function checkLogin(config) {
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

export async function resolveBoardIdMap(requiredNames, domAlbums, config) {
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

export function buildAssignments(plan, collectedNotes) {
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

export async function moveAssignments(assignments, boardIdMap, config, onProgress = () => {}) {
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
export function installMoveProbe() {
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
