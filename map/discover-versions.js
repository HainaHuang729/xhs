import {discoveryLayouts,discoveryLayout} from './discovery-layouts.js';
import {normalize,regionMatches,safePhoto} from './model.js';
const $=s=>document.querySelector(s),frame=$('#livePreview'),query=new URLSearchParams(location.search);
let active=discoveryLayout(location.search),device='phone';
// Only pass supported navigation choices to the preview.
const context=new URLSearchParams();for(const key of ['ui','kind','topic','region','located'])if(query.has(key))context.set(key,query.get(key));
function resizePreview(){const width=device==='phone'?390:1280,height=device==='phone'?844:860,scale=Math.min(1,($('#previewOuter').clientWidth-32)/width);Object.assign(frame.style,{width:width+'px',height:height+'px',transform:`scale(${scale})`});Object.assign($('#previewStage').style,{width:width*scale+'px',height:height*scale+'px'});}
function showLayout(layout){
 try{const current=new URL(frame.contentWindow.location.href);if(current.pathname.endsWith('/discover.html'))for(const key of ['ui','kind','topic','region','located']){context.delete(key);if(current.searchParams.has(key))context.set(key,current.searchParams.get(key));}}catch{}
 active=layout;for(const b of document.querySelectorAll('[data-look]'))b.setAttribute('aria-pressed',String(b.dataset.look===active.id));
 $('#previewTitle').textContent=active.name;$('#previewDescription').textContent=active.description;
 const q=new URLSearchParams(context);q.set('look',active.id);const url='discover.html?'+q;
 frame.title=active.name+'交互预览';frame.src=url;$('#openLayout').href=url;$('#backToDiscovery').href=url;history.replaceState(null,'','?'+q);resizePreview();
}
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>showLayout(discoveryLayouts.find(l=>l.id===b.dataset.look));
for(const b of document.querySelectorAll('[data-device]'))b.onclick=()=>{device=b.dataset.device;for(const other of document.querySelectorAll('[data-device]'))other.setAttribute('aria-pressed',String(other===b));resizePreview();};
// Carry topic/region changes made in the working preview across layout switches.
function syncContext(){try{const current=new URL(frame.contentWindow.location.href);if(!current.pathname.endsWith('/discover.html'))return;const q=current.searchParams;for(const key of ['ui','kind','topic','region','located']){context.delete(key);if(q.has(key))context.set(key,q.get(key));}const next=new URLSearchParams(context);next.set('look',active.id);$('#openLayout').href='discover.html?'+next;$('#backToDiscovery').href='discover.html?'+next;history.replaceState(null,'','?'+next);}catch{}}
frame.onload=()=>{syncContext();try{frame.contentWindow.addEventListener('discoverychange',syncContext);}catch{}};
new ResizeObserver(resizePreview).observe($('#previewOuter'));showLayout(active);
try{const res=await fetch('/api/favorites');if(!res.ok)throw Error();const notes=normalize(await res.json()),photos=notes.filter(n=>regionMatches(n,'hksz')&&/咖啡|甜品|布丁|蛋糕/.test(n.title)).map(n=>safePhoto(n.cover_image)).filter(s=>s.startsWith('/media/')).slice(0,4);for(const img of document.querySelectorAll('[data-sample]'))if(photos.length)img.src=photos[+img.dataset.sample%photos.length];}catch{}
