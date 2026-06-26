import { CLEANUP_KEY, getConfig } from "./config.js";
import { createAlbums, readExistingAlbums } from "./albums.js";
import { classifyNotes } from "./classifier.js";
import { logger } from "./logger.js";
import { buildManualReviewPayload, buildManualReviewPrompt, manualAssignmentsToPlan } from "./manualReview.js";
import { isFavNotePage, scanCollectedNotes, switchToNoteTab } from "./scanner.js";
import { state } from "./state.js";
import { buildAssignments, installMoveProbe, moveAssignments, resolveBoardIdMap } from "./xhsApi.js";
import { closeOverlay, ensureControls, removeUi, setBusy, showAddResult, showCreateResult, showError, showPlanDialog, showProgress, updateProgress } from "./ui.js";

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

export function cleanup() {
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

export function init() {
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
