// Xiaohongshu / Rednote favorites link exporter.
// Usage: log in on the web, open your favorites/collections tab, paste this
// whole script into the browser console, and press Enter.
// To stop while it is scrolling: type `window.__xhsExportStop = true` in console.

(async () => {
  const config = {
    delayMs: 1200,
    maxRounds: 300,
    maxIdleRounds: 8,
    keepQueryParams: false,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();
  const pageStartedAt = now();

  window.__xhsExportStop = false;

  const seen = new Map();

  function textOf(node) {
    return (node?.innerText || node?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value, limit = 500) {
    if (!value) return "";
    return value.length > limit ? `${value.slice(0, limit)}...` : value;
  }

  function noteUrlFromHref(href) {
    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase();
    const isSupportedHost =
      host === "xiaohongshu.com" ||
      host.endsWith(".xiaohongshu.com") ||
      host === "rednote.com" ||
      host.endsWith(".rednote.com");

    if (!isSupportedHost) return null;

    const match =
      url.pathname.match(/^\/explore\/([A-Za-z0-9_-]{8,})/) ||
      url.pathname.match(/^\/discovery\/item\/([A-Za-z0-9_-]{8,})/);

    if (!match) return null;

    const noteId = match[1];
    const cleanUrl = new URL(url.href);
    if (!config.keepQueryParams) cleanUrl.search = "";
    cleanUrl.hash = "";

    return {
      noteId,
      url: cleanUrl.href,
      sourceHref: url.href,
    };
  }

  function findCard(anchor) {
    let node = anchor;
    let best = anchor;

    for (let i = 0; i < 10 && node && node !== document.body; i += 1) {
      const rect = node.getBoundingClientRect();
      const text = textOf(node);

      if (rect.width >= 120 && rect.height >= 80 && text.length > 0) {
        best = node;
      }

      if (
        node.matches?.("article, section, li, [role='listitem'], [class*='note'], [class*='card'], [class*='feed']")
      ) {
        best = node;
        break;
      }

      node = node.parentElement;
    }

    return best;
  }

  function imageFromCard(card) {
    const img = card?.querySelector?.("img");
    if (!img) return "";
    return img.currentSrc || img.src || img.getAttribute("data-src") || "";
  }

  function titleFrom(anchor, card) {
    const anchorText = textOf(anchor);
    if (anchorText) return compactText(anchorText, 180);

    const imgAlt =
      anchor.querySelector?.("img[alt]")?.getAttribute("alt") ||
      card?.querySelector?.("img[alt]")?.getAttribute("alt") ||
      "";
    if (imgAlt) return compactText(imgAlt, 180);

    return compactText(textOf(card), 180);
  }

  function scanVisibleLinks() {
    const anchors = Array.from(document.querySelectorAll("a[href]"));

    for (const anchor of anchors) {
      const note = noteUrlFromHref(anchor.getAttribute("href"));
      if (!note) continue;

      const card = findCard(anchor);
      const existing = seen.get(note.noteId);
      const row = {
        note_id: note.noteId,
        url: note.url,
        title: titleFrom(anchor, card),
        card_text: compactText(textOf(card), 800),
        cover_image: imageFromCard(card),
        first_seen_at: existing?.first_seen_at || now(),
        page_url: location.href,
      };

      if (!existing || row.card_text.length > existing.card_text.length) {
        seen.set(note.noteId, row);
      }
    }

    return seen.size;
  }

  function csvEscape(value) {
    const stringValue = String(value ?? "");
    if (/[",\r\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function exportRows(rows) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const headers = [
      "note_id",
      "url",
      "title",
      "card_text",
      "cover_image",
      "first_seen_at",
      "page_url",
    ];

    const csv =
      "\uFEFF" +
      headers.join(",") +
      "\n" +
      rows
        .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
        .join("\n");

    download(`xhs-favorites-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    download(
      `xhs-favorites-${stamp}.json`,
      JSON.stringify(
        {
          exported_at: now(),
          started_at: pageStartedAt,
          source_page: location.href,
          count: rows.length,
          rows,
        },
        null,
        2
      ),
      "application/json;charset=utf-8"
    );
  }

  console.log("[xhs-export] Started. To stop: window.__xhsExportStop = true");

  let lastCount = 0;
  let idleRounds = 0;
  const scrollStep = Math.max(900, Math.floor(window.innerHeight * 0.9));

  for (let round = 1; round <= config.maxRounds; round += 1) {
    const count = scanVisibleLinks();
    const nearBottom =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 8;

    if (count === lastCount) {
      idleRounds += 1;
    } else {
      idleRounds = 0;
      lastCount = count;
    }

    console.log(
      `[xhs-export] round=${round}, notes=${count}, idle=${idleRounds}/${config.maxIdleRounds}`
    );

    if (window.__xhsExportStop) {
      console.log("[xhs-export] Stopped by user.");
      break;
    }

    if (nearBottom && idleRounds >= Math.min(3, config.maxIdleRounds)) {
      console.log("[xhs-export] Reached page bottom.");
      break;
    }

    if (idleRounds >= config.maxIdleRounds) {
      console.log("[xhs-export] No new notes found for a while.");
      break;
    }

    window.scrollBy({ top: scrollStep, behavior: "smooth" });
    await sleep(config.delayMs);
  }

  scanVisibleLinks();

  const rows = Array.from(seen.values());
  window.__xhsFavoritesExport = rows;

  if (rows.length === 0) {
    console.warn(
      "[xhs-export] No note links found. Make sure you are logged in and the favorites/collections tab is visible."
    );
    return;
  }

  rows.sort((a, b) => a.note_id.localeCompare(b.note_id));
  exportRows(rows);
  console.table(rows.slice(0, 20));
  console.log(
    `[xhs-export] Done. Exported ${rows.length} notes. Rows are also available at window.__xhsFavoritesExport.`
  );
})();
