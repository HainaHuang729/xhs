// Xiaohongshu detail extractor, sample mode.
// Run on your xiaohongshu.com favorites page.
// Optional before running:
// window.__xhsDetailConfig = { maxNotes: 10, maxCommentsPerNote: 30, commentScrollRounds: 8 };
// Or provide explicit URLs:
// window.__xhsDetailUrls = ["https://www.xiaohongshu.com/..."];

(async () => {
  const config = {
    maxNotes: 5,
    maxCommentsPerNote: 20,
    iframeLoadTimeoutMs: 30000,
    detailSettleMs: 3500,
    commentScrollRounds: 5,
    scrollDelayMs: 900,
    ...window.__xhsDetailConfig,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => new Date().toISOString();

  function normalize(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function noteIdFromUrl(value) {
    const urlText = String(value || "");
    const match =
      urlText.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9_-]{8,})/) ||
      urlText.match(/\/user\/profile\/[A-Za-z0-9_-]+\/([A-Za-z0-9_-]{8,})/) ||
      urlText.match(/\/board\/[A-Za-z0-9_-]+\/([A-Za-z0-9_-]{8,})/) ||
      urlText.match(/[?&](?:note_id|noteId|notes_id|notesId)=([A-Za-z0-9_-]{8,})/);
    return match ? match[1] : "";
  }

  function cleanUrl(value) {
    try {
      const url = new URL(value, location.href);
      url.hash = "";
      return url.href;
    } catch {
      return String(value || "");
    }
  }

  function collectVisibleNoteLinks(limit) {
    const rows = [];
    const seen = new Set();

    for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
      let url;
      try {
        url = new URL(anchor.getAttribute("href"), location.href);
      } catch {
        continue;
      }

      if (!/xiaohongshu\.com$/i.test(url.hostname) && !/\.xiaohongshu\.com$/i.test(url.hostname)) {
        continue;
      }

      const noteId = noteIdFromUrl(url.href);
      if (!noteId || seen.has(noteId)) continue;
      if (location.href.includes("tab=fav") && !url.href.includes("xsec_source=pc_collect")) {
        continue;
      }

      const text = normalize(anchor.innerText || anchor.textContent || anchor.getAttribute("title"));
      seen.add(noteId);
      rows.push({
        note_id: noteId,
        source_title: text,
        url: cleanUrl(url.href),
      });

      if (rows.length >= limit) break;
    }

    return rows;
  }

  function makeStatus() {
    const id = "__xhs_detail_status";
    document.getElementById(id)?.remove();
    const box = document.createElement("div");
    box.id = id;
    box.style.cssText = [
      "position:fixed",
      "right:16px",
      "top:16px",
      "z-index:2147483647",
      "width:310px",
      "max-height:46vh",
      "overflow:auto",
      "background:rgba(18,18,22,.94)",
      "color:#fff",
      "font:12px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "border:1px solid rgba(255,255,255,.18)",
      "border-radius:8px",
      "padding:12px",
      "box-shadow:0 10px 30px rgba(0,0,0,.25)",
      "white-space:pre-wrap",
    ].join(";");
    document.body.appendChild(box);
    return (message) => {
      box.textContent = `[xhs-detail] ${message}`;
    };
  }

  const status = makeStatus();

  function makeFrame() {
    document.getElementById("__xhs_detail_frame")?.remove();
    const frame = document.createElement("iframe");
    frame.id = "__xhs_detail_frame";
    frame.style.cssText = [
      "position:fixed",
      "left:-10000px",
      "top:0",
      "width:430px",
      "height:900px",
      "opacity:.01",
      "pointer-events:none",
      "border:0",
      "z-index:-1",
    ].join(";");
    document.body.appendChild(frame);
    return frame;
  }

  async function loadFrame(frame, url) {
    await new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      frame.onload = done;
      frame.src = url;
      setTimeout(done, config.iframeLoadTimeoutMs);
    });

    const start = Date.now();
    while (Date.now() - start < config.detailSettleMs) {
      try {
        const doc = frame.contentDocument;
        if (doc?.body && normalize(doc.body.innerText).length > 40) break;
      } catch {
        break;
      }
      await sleep(300);
    }
  }

  async function scrollFrame(frame) {
    for (let i = 0; i < config.commentScrollRounds; i += 1) {
      try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        win?.scrollBy?.({ top: Math.max(520, Math.floor(win.innerHeight * 0.82)), behavior: "smooth" });
        doc?.documentElement?.scrollBy?.(0, 700);
        doc?.body?.scrollBy?.(0, 700);
      } catch {
        return;
      }
      await sleep(config.scrollDelayMs);
    }
  }

  function meta(doc, selector) {
    return normalize(doc.querySelector(selector)?.getAttribute("content"));
  }

  function unique(values, limit = 200) {
    const out = [];
    const seen = new Set();
    for (const value of values) {
      const text = normalize(value);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
      if (out.length >= limit) break;
    }
    return out;
  }

  function textCandidates(doc, selector, limit = 80) {
    const out = [];
    for (const element of Array.from(doc.querySelectorAll(selector))) {
      const text = normalize(element.innerText || element.textContent || element.getAttribute("title") || element.getAttribute("aria-label"));
      if (text) out.push(text);
      if (out.length >= limit) break;
    }
    return out;
  }

  const exactNoise = new Set([
    "赞",
    "评论",
    "收藏",
    "分享",
    "更多",
    "登录",
    "打开APP",
    "小红书",
    "关注",
    "已关注",
    "回复",
    "展开",
    "收起",
  ]);

  function usefulText(text, min = 2, max = 2000) {
    const value = normalize(text);
    if (value.length < min || value.length > max) return false;
    if (exactNoise.has(value)) return false;
    if (/^\d+(\.\d+)?[wWkK万]?$/.test(value)) return false;
    return true;
  }

  function extractTitle(doc) {
    const candidates = unique([
      meta(doc, 'meta[property="og:title"]'),
      meta(doc, 'meta[name="twitter:title"]'),
      doc.title,
      ...textCandidates(doc, "h1,h2,#detail-title,.title,[class*='title'],[class*='Title']", 40),
    ]).filter((text) => usefulText(text, 2, 180));

    return candidates.find((text) => !/小红书|你的生活兴趣社区/.test(text)) || candidates[0] || "";
  }

  function extractBody(doc, title) {
    const candidates = unique([
      meta(doc, 'meta[property="og:description"]'),
      meta(doc, 'meta[name="description"]'),
      ...textCandidates(
        doc,
        [
          "#detail-desc",
          "[class*='desc']",
          "[class*='Desc']",
          "[class*='note-content']",
          "[class*='NoteContent']",
          "[class*='note-text']",
          "[class*='content']",
          "[class*='Content']",
          "article p",
        ].join(","),
        160
      ),
    ]).filter((text) => {
      if (!usefulText(text, 4, 5000)) return false;
      if (title && text === title) return false;
      if (/登录|打开APP|立即打开|相关推荐|暂无评论/.test(text) && text.length < 80) return false;
      return true;
    });

    const cleaned = candidates
      .map((text) => {
        let value = text;
        if (title && value.startsWith(title)) value = normalize(value.slice(title.length));
        value = value
          .replace(/^推荐\s*/u, "推荐 ")
          .replace(/猜你想搜[\s\S]*$/u, "")
          .replace(/编辑于\s+\S+[\s\S]*$/u, "")
          .replace(/共\s*\d+\s*条评论[\s\S]*$/u, "")
          .replace(/说点什么[\s\S]*$/u, "");
        return normalize(value);
      })
      .filter((text) => usefulText(text, 4, 3000));

    const bodyCandidates = unique(cleaned.concat(candidates)).filter((text) => usefulText(text, 4, 5000));

    bodyCandidates.sort((a, b) => {
      const score = (text) => {
        let value = Math.min(text.length, 1200);
        if (/[#＃]/.test(text)) value += 80;
        if (/[，。！？、]/.test(text)) value += 50;
        if (/共\s*\d+\s*条评论|说点什么|发送\s*取消|可以添加到收藏夹/.test(text)) value -= 900;
        if (/猜你想搜|编辑于/.test(text)) value -= 120;
        return value;
      };
      return score(b) - score(a);
    });

    return {
      body: bodyCandidates[0] || "",
      body_candidates: bodyCandidates.slice(0, 8),
    };
  }

  function extractComments(doc, title, body) {
    const raw = unique([
      ...textCandidates(
        doc,
        [
          "[class*='comment'] [class*='content']",
          "[class*='comment'] [class*='Content']",
          "[class*='comment'] [class*='text']",
          "[class*='Comment'] [class*='text']",
          "[class*='comment-item'] [class*='content']",
          "[class*='CommentItem'] [class*='content']",
          "[class*='commentItem'] [class*='content']",
          "[class*='comment'] span",
        ].join(","),
        260
      ),
    ]).filter((text) => {
      if (!usefulText(text, 2, 900)) return false;
      if (title && text === title) return false;
      if (body && text === body) return false;
      if (body && body.includes(text) && text.length > 20) return false;
      if (/^共\s*\d+\s*条评论$/.test(text)) return false;
      if (/评论区|还没有评论|说点什么|发送|取消|可以添加到收藏夹/.test(text) && text.length < 30) return false;
      if (/共\s*\d+\s*条评论/.test(text)) return false;
      if (/赞\s*\d+.*回复.*赞/.test(text) && text.length > 180) return false;
      return true;
    });

    return raw.slice(0, config.maxCommentsPerNote);
  }

  function extractDetail(frame, input) {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (error) {
      return {
        ...input,
        final_url: "",
        error: `Cannot access iframe document: ${error?.message || error}`,
        title: "",
        body: "",
        body_candidates: [],
        comments: [],
      };
    }

    if (!doc?.body) {
      return {
        ...input,
        final_url: "",
        error: "No iframe document body",
        title: "",
        body: "",
        body_candidates: [],
        comments: [],
      };
    }

    const title = extractTitle(doc);
    const bodyResult = extractBody(doc, title);
    const comments = extractComments(doc, title, bodyResult.body);
    const pageText = normalize(doc.body.innerText || doc.body.textContent);

    return {
      ...input,
      final_url: frame.contentWindow?.location?.href || "",
      extracted_at: now(),
      title,
      body: bodyResult.body,
      body_candidates: bodyResult.body_candidates,
      comments,
      comments_count: comments.length,
      text_excerpt: pageText.slice(0, 1200),
      error: "",
    };
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

  function csvEscape(value) {
    const stringValue = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
    if (/[",\r\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
    return stringValue;
  }

  function exportResults(results) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const json = JSON.stringify(
      {
        exported_at: now(),
        source_page: location.href,
        config,
        count: results.length,
        results,
      },
      null,
      2
    );
    download(`xhs-details-sample-${stamp}.json`, json, "application/json;charset=utf-8");

    const headers = ["note_id", "url", "final_url", "title", "body", "comments_count", "comments", "error"];
    const csv =
      "\uFEFF" +
      headers.join(",") +
      "\n" +
      results.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n");
    download(`xhs-details-sample-${stamp}.csv`, csv, "text/csv;charset=utf-8");
  }

  let inputs = [];
  if (Array.isArray(window.__xhsDetailUrls) && window.__xhsDetailUrls.length) {
    inputs = window.__xhsDetailUrls.slice(0, config.maxNotes).map((url) => ({
      note_id: noteIdFromUrl(url),
      source_title: "",
      url: cleanUrl(url),
    }));
  } else {
    inputs = collectVisibleNoteLinks(config.maxNotes);
  }

  if (!inputs.length) {
    status("No note links found on this page.");
    console.warn("[xhs-detail] No note links found. Run this on the favorites note page or set window.__xhsDetailUrls.");
    return;
  }

  const frame = makeFrame();
  const results = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const item = inputs[index];
    status(`Opening ${index + 1}/${inputs.length}\n${item.source_title || item.note_id}\n${item.url}`);
    try {
      await loadFrame(frame, item.url);
      await scrollFrame(frame);
      const detail = extractDetail(frame, item);
      results.push(detail);
      console.log("[xhs-detail] extracted", detail);
    } catch (error) {
      results.push({
        ...item,
        final_url: "",
        extracted_at: now(),
        title: "",
        body: "",
        body_candidates: [],
        comments: [],
        comments_count: 0,
        text_excerpt: "",
        error: String(error?.message || error),
      });
    }
  }

  window.__xhsDetailResults = results;
  exportResults(results);
  status(`Done. Extracted ${results.length} notes.\nResults: window.__xhsDetailResults`);
  console.table(
    results.map((row) => ({
      note_id: row.note_id,
      title: row.title,
      body_len: row.body?.length || 0,
      comments: row.comments_count,
      error: row.error,
    }))
  );
})();
