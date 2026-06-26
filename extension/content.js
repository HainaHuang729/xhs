(function injectXhsAlbumBuilder() {
  if (document.documentElement.dataset.tabbitXhsAlbumBuilderExtension === "true") return;
  document.documentElement.dataset.tabbitXhsAlbumBuilderExtension = "true";

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("xhs-album-builder.page.js");
  script.async = false;
  script.onload = () => script.remove();
  script.onerror = () => {
    console.error("[Tabbit XHS] 扩展脚本注入失败");
    delete document.documentElement.dataset.tabbitXhsAlbumBuilderExtension;
  };
  (document.head || document.documentElement).appendChild(script);
})();
