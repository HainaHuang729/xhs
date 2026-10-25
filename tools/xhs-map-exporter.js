// Run in the console on your own 收藏 → 笔记 page. Exports visible note cards only.
// Stop scanning: window.__xhsMapStop = true; all collected rows are still downloaded.
(async () => {
  if (!location.hostname.endsWith('xiaohongshu.com') || !location.search.includes('tab=fav')) {
    alert('请先打开自己的收藏 → 笔记页'); return;
  }
  const root = document.querySelectorAll('.tab-content-item')[1];
  if (!root) throw Error('未找到收藏区域，页面结构可能已变化');
  const seen = new Map(), sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__xhsMapStop = false;
  const box = document.createElement('div');
  box.style = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#287a88;color:white;padding:14px;border-radius:8px';
  document.body.append(box);
  for (const e of [document.scrollingElement, ...document.querySelectorAll('div')])
    if (e && e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 200) e.scrollTop = 0;
  await sleep(800);
  let idle = 0;
  for (let round = 0; round < 1600 && !window.__xhsMapStop; round++) {
    const before = seen.size;
    for (const a of root.querySelectorAll('a[href]')) {
      const rect = a.getBoundingClientRect();
      if (!a.getClientRects().length || rect.right <= 0 || rect.left >= innerWidth || getComputedStyle(a).visibility === 'hidden') continue;
      const id = (a.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f0-9]{24})$/) || a.pathname.match(/^\/user\/profile\/[^/]+\/([a-f0-9]{24})$/))?.[1];
      if (!id) continue;
      const card = a.closest('section') || a.parentElement;
      const title = card?.querySelector('.title')?.innerText || '未命名收藏';
      if (!seen.has(id) || title.length > seen.get(id).title.length)
        seen.set(id, {id, title: title.trim(), url: a.href, locations: []});
    }
    box.textContent = `正在导出收藏：${seen.size} 条`;
    idle = before === seen.size ? idle + 1 : 0;
    if (idle > 15 && [document.scrollingElement, ...document.querySelectorAll('div')].filter(e => e && e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 200).every(e => e.scrollTop + e.clientHeight >= e.scrollHeight - 20)) break;
    for (const e of [document.scrollingElement, ...document.querySelectorAll('div')])
      if (e && e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 200) e.scrollTop += Math.max(120, Math.min(300, innerHeight * 0.55));
    await sleep(400);
  }
  window.__xhsMapRows = [...seen.values()];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window.__xhsMapRows, null, 2)], {type: 'application/json'}));
  a.download = 'xhs-map-favorites.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  box.textContent = `导出完成：${seen.size} 条。请与网页显示总数核对；失效笔记可能不在列表中。`;
})();
