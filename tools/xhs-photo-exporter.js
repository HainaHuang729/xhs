// Read the public note payload in authenticated, same-origin page HTML.
// No cookies, account state, scripts, or authentication fields are exported.
(async()=>{
 const queue=window.__xhsGbaQueue;if(!Array.isArray(queue))throw Error('Missing note queue');
 const done=[];let failures=0;window.__xhsGbaStop=false;
 const box=document.createElement('div');box.style='position:fixed;top:15px;right:15px;z-index:2147483647;background:#287a88;color:white;padding:14px;border-radius:8px';
 const label=document.createElement('p'),stop=document.createElement('button');stop.textContent='停止并保存';stop.onclick=()=>window.__xhsGbaStop=true;box.append(label,stop);document.body.append(box);
 function save(name){const a=document.createElement('a');a.download=name;a.href=URL.createObjectURL(new Blob([JSON.stringify(done)],{type:'application/json'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000)}
 try{for(let i=0;i<queue.length&&!window.__xhsGbaStop;i++){
  const n={...queue[i]};label.textContent=`补齐原图 ${i+1}/${queue.length}：${n.title}`;
  try{
   const response=await fetch(n.url,{credentials:'same-origin',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');const raw=[...doc.scripts].map(x=>x.textContent).find(s=>/^\s*window\.__INITIAL_STATE__\s*=/.test(s));if(!raw)throw Error('页面没有笔记数据');
   const payload=JSON.parse(raw.replace(/^\s*window\.__INITIAL_STATE__\s*=\s*/,'').replace(/;\s*$/,'').replace(/:\s*undefined(?=[,}])/g,':null'));
   const note=Object.values(payload.note?.noteDetailMap||{}).map(x=>x.note).find(x=>x?.noteId===n.id);if(!note)throw Error('页面未返回对应笔记');
   if(note.desc)n.content=note.desc;
   n.images=(note.imageList||[]).map(x=>x.urlDefault||x.urlPre||x.infoList?.find(v=>v.imageScene==='WB_DFT')?.url||x.infoList?.[0]?.url).filter(Boolean).map(u=>u.replace(/^http:/,'https:'));
   n.photo_total_expected=n.images.length;n.photo_checked_at=new Date().toISOString();n.detail_checked_at=n.photo_checked_at;if(n.images.length)n.cover_image=n.images[0];failures=0;
  }catch(e){n.photo_error=String(e.message);failures++;}
  done.push(n);if(done.length%10===0)save('xhs-gba-photos-'+done.length+'.json');
  if(failures>=3){label.textContent='连续未返回笔记数据，已停止并保存';break;}
  await new Promise(r=>setTimeout(r,1200));
 }}finally{save('xhs-gba-photos-final.json');label.textContent=`补图读取完成 ${done.length}/${queue.length}`;stop.remove();}
})();
