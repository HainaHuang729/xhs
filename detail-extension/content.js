(function initXhsDetailExtractorButton() {
  if (document.getElementById("__xhs_detail_ext_button")) return;

  const button = document.createElement("button");
  button.id = "__xhs_detail_ext_button";
  button.type = "button";
  button.textContent = "抓取正文/评论样本";
  button.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:84px",
    "z-index:2147483647",
    "border:0",
    "border-radius:8px",
    "background:#111827",
    "color:#fff",
    "padding:10px 12px",
    "font:13px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,.22)",
    "cursor:pointer"
  ].join(";");

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "正在加载...";
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("xhs-detail-extractor.sample.js");
      script.async = false;
      script.onload = () => script.remove();
      script.onerror = () => {
        button.disabled = false;
        button.textContent = "加载失败，重试";
      };
      (document.head || document.documentElement).appendChild(script);
      button.textContent = "已启动";
    } catch (error) {
      button.disabled = false;
      button.textContent = "加载失败，重试";
      console.error("[xhs-detail-extension] failed to load extractor", error);
    }
  });

  document.documentElement.appendChild(button);
})();
