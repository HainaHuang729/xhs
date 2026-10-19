import { APP_ID } from "./config.js";
import { isRegularCategory } from "./categoryNames.js";
import { escapeHtml, normalizeText } from "./dom.js";
import { findFavSubTabBar, isFavNotePage } from "./scanner.js";
import { state } from "./state.js";

const STYLE_ID = `${APP_ID}-style`;
const HOST_ID = `${APP_ID}-host`;
const BUTTON_ID = `${APP_ID}-button`;
const OVERLAY_ID = `${APP_ID}-overlay`;
const READY_ATTR = `data-${APP_ID}-ready`;

function optionsHtml(values, selected) {
  const merged = Array.from(new Set(values.concat(selected).map((value) => Math.max(1, Math.floor(Number(value)))).filter(Number.isFinite))).sort((a, b) => a - b);
  return merged.map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`).join("");
}

export function ensureStyles() {
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

export function ensureControls(onRun) {
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

export function setBusy(busy, label) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;
  button.disabled = !!busy;
  document.querySelectorAll(".tabbit-xhs-granularity-option, select[data-limit-key]").forEach((element) => {
    element.disabled = !!busy;
  });
  const iconHtml = busy ? '<span class="tabbit-xhs-spinner" aria-hidden="true"></span>' : "<span aria-hidden=\"true\">＋</span>";
  button.innerHTML = `${iconHtml}<span>${escapeHtml(label || "智能构建专辑")}</span>`;
}

export function closeOverlay() {
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

export function showProgress(title, message) {
  overlayShell(
    "TABBIT ALBUM BUILDER",
    title,
    message,
    '<div class="tabbit-xhs-bar"><span></span></div><p class="tabbit-xhs-log"></p>'
  );
  updateProgress(8, message);
}

export function updateProgress(percent, message) {
  const bar = document.querySelector(".tabbit-xhs-bar");
  const log = document.querySelector(".tabbit-xhs-log");
  if (bar) bar.style.setProperty("--tabbit-progress", `${Math.max(6, Math.min(100, Math.round(percent)))}%`);
  if (log) log.textContent = message;
}

export function showError(error) {
  const message = normalizeText(error?.message || error || "未知错误");
  overlayShell(
    "未完成",
    "智能构建专辑失败",
    message,
    "",
    '<div class="tabbit-xhs-actions"><button class="tabbit-xhs-action primary" type="button" data-action="close">知道了</button></div>'
  ).querySelector('[data-action="close"]')?.addEventListener("click", closeOverlay);
}

export function showPlanDialog(notes, plan, callbacks) {
  state.plan = plan;
  const categories = plan.categories || [];
  const regularCount = categories.filter(isRegularCategory).length;
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

export function showCreateResult(result, addCount, callbacks) {
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

export function showAddResult(result) {
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

export function removeUi() {
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
