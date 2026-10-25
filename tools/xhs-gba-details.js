// Run via DevTools on the logged-in Xiaohongshu page.
// Set window.__xhsGbaQueue to an exported note array first.
(async () => {
  const rows = window.__xhsGbaQueue;
  if (!Array.isArray(rows)) throw Error('请先加载大湾区收藏队列');
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  window.__xhsGbaStop = false;
  const box=document.createElement('div');box.id='xhs-gba-progress';
  box.style='position:fixed;top:15px;right:15px;z-index:2147483647;background:#287a88;color:white;padding:14px;border-radius:8px;max-width:400px';document.body.append(box);
  const stop=document.createElement('button');stop.textContent='停止并保存';stop.onclick=()=>window.__xhsGbaStop=true;
  const label=document.createElement('p');box.append(label,stop);
  let frame;
  const completed=[];
  function download(name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(completed)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
  try {
    for(let i=0;i<rows.length&&!window.__xhsGbaStop;i++){
      const n={...rows[i]};label.textContent=`大湾区正文 / 照片 ${i+1}/${rows.length}：${n.title}`;
      frame=document.createElement('iframe');frame.style='position:fixed;left:0;bottom:0;width:1000px;height:900px;z-index:2147483640;background:white';document.body.append(frame);
      frame.src=n.url;
      let doc;
      for(let j=0;j<60;j++){
        await sleep(200);
        try{doc=frame.contentDocument;if(doc?.location.pathname.includes(n.id)&&doc.querySelector('#detail-desc,.note-content .desc')?.textContent?.trim())break;}catch{}
      }
      await sleep(300);
      try {
        doc=frame.contentDocument;
        const content=doc.querySelector('#detail-desc,.note-content .desc')?.textContent?.trim()||'';
        if(content){n.content=content;delete n.detail_error;}else n.detail_error='未读到正文：可能失效或访问受限';
        n.place_hints=[...(n.place_hints||[]),...Array.from(doc.querySelectorAll('.note-content [class*="location"],.note-content [class*="poi"]')).map(e=>e.innerText.trim()).filter(Boolean)];
        const roots=doc.querySelectorAll('.note-container,.note-detail-mask,#noteContainer');
        const scope=roots.length?Array.from(roots):[doc];
        const images=scope.flatMap(root=>Array.from(root.querySelectorAll('.swiper-slide img,.note-slider-img img,.media-container img,.slider-container img,img.note-image,img[class*="note-image"]')));
        n.images=[...new Set(images.map(img=>img.currentSrc||img.src).filter(src=>/^https:\/\//.test(src)))].slice(0,100);
        const og=doc.querySelector('meta[property="og:image"]')?.content;
        if(!n.images.length&&og&&/^https:\/\//.test(og))n.images=[og];
        // Read only the current note's public content and photo list from its hydrated page.
        const detail=Object.values(frame.contentWindow.__INITIAL_STATE__?.note?.noteDetailMap||{}).map(v=>v.note).find(v=>v?.noteId===n.id);
        if(detail?.desc&&!n.content){n.content=detail.desc;delete n.detail_error;}
        const album=(detail?.imageList||[]).map(img=>img.urlDefault||img.urlPre||img.infoList?.find(x=>x.imageScene==='WB_DFT')?.url||img.infoList?.[0]?.url).filter(Boolean).map(u=>u.replace(/^http:/,'https:'));
        if(album.length>n.images.length)n.images=[...new Set(album)];
        if(n.images.length)n.cover_image=n.images[0];
        n.detail_checked_at=new Date().toISOString();n.detail_diagnostic={page_title:doc.title,body_excerpt:doc.body?.innerText?.slice(-1000)||'',type:doc.querySelector('#noteContainer')?.dataset.type};

      }catch(e){n.detail_error=String(e.message);}
      frame.remove();frame=null;
      completed.push(n);window.__xhsGbaCompleted=completed;
      if(completed.length%10===0)download(`xhs-gba-progress-${completed.length}.json`);
      await sleep(1000);
    }
  }finally{
    frame?.remove();download('xhs-gba-details.json');label.textContent=`大湾区处理完成：${completed.length}/${rows.length} 条；已保存正文与照片链接。`;stop.remove();
  }
})();
