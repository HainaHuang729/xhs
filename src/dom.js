export function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

export function visibleAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector)).filter(isVisible);
}

export function findVisible(selector, predicate = () => true, root = document) {
  return visibleAll(selector, root).find((element) => predicate(normalizeText(element.textContent), element));
}

export function fireClick(element) {
  if (!element) return false;
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  element.click();
  return true;
}

export function setInputValue(element, value) {
  if (!element) return;
  const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function waitFor(probe, timeoutMs = 6000, intervalMs = 120) {
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

export function escapeHtml(value) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mergeUnique(items, keyOf, limit = Infinity) {
  const map = new Map();
  for (const item of items) {
    if (map.size >= limit) break;
    const key = keyOf(item);
    if (key && !map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

export function updateUrlParams(params) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  history.pushState(null, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}
