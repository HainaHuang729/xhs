// After xhs-map-exporter.js finishes, run this on the same page.
// Small sequential sample: no private API, no cookies or credentials exported.
(async () => {
  if (!Array.isArray(window.__xhsMapRows)) throw Error('请先完成收藏导出');
  const rows = window.__xhsMapRows;
  const selected = rows.filter(n => /餐厅|探店|咖啡|早餐|披萨|旅行|旅游|酒店|京都|大阪|冲绳|香港|深圳|杭州|上海|泉州|东京|徒步/.test(n.title)).slice(0, 20);
  const box = document.createElement('div');
  box.style = 'position:fixed;top:60px;right:12px;z-index:2147483647;background:#287a88;color:white;padding:14px';document.body.append(box);
  const frame = document.createElement('iframe');
  frame.style = 'position:fixed;left:-10000px;width:1000px;height:900px';document.body.append(frame);
  window.__xhsMapDetailStop = false;
  let completed = 0;
  try {
    for (const n of selected) {
      if (window.__xhsMapDetailStop) break;
      box.textContent = `读取地点线索 ${++completed}/${selected.length}：${n.title}`;
      await new Promise(resolve => {const timer=setTimeout(resolve,20000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.src=n.url;});
      await new Promise(r => setTimeout(r,3500));
      try {
        const doc = frame.contentDocument;
        const body = doc.querySelector('#detail-desc,.note-content .desc')?.innerText || '';
        n.content = body;
        n.place_hints = [...doc.querySelectorAll('.note-content [class*="location"],.note-content [class*="poi"]')].map(e=>e.innerText.trim()).filter(Boolean);
        if (!body) n.detail_error = '未读取到正文，可能失效、未加载或访问受限';
      } catch (e) { n.detail_error = String(e.message); }
      await new Promise(r => setTimeout(r,1500));
    }
  } finally {
    frame.remove();
    const a = document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));a.download='xhs-map-details.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),30000);box.textContent=`正文样本完成：${completed} 条；已下载全部收藏和样本正文。`;
  }
})();
