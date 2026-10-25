import {safePhoto} from './model.js';
import {motionAllowed} from './discovery-motion.js';

export function notePhotos(note){return [...new Set([note.cover_image,...(Array.isArray(note.images)?note.images:[])].map(safePhoto).filter(Boolean))];}

export function fillPostDetails(card,item,{text,link,localLink}){
 const photos=notePhotos(item.note),gallery=text('div','','detail-gallery'),viewport=text('div','','gallery-viewport');
 gallery.setAttribute('role','region');gallery.setAttribute('aria-label','原帖照片');viewport.tabIndex=0;
 viewport.setAttribute('aria-label','原帖照片，左右滑动或用方向键翻阅');
 const slides=photos.map((src,i)=>{
  const slide=text('figure','','gallery-slide'),img=document.createElement('img');img.src=src;img.alt=item.note.title+'，原帖照片 '+(i+1);img.loading=i?'lazy':'eager';img.referrerPolicy='no-referrer';img.draggable=false;
  img.onerror=()=>{img.hidden=true;slide.append(text('p','这张照片暂时无法加载，可以翻到下一张或查看原帖。','photo-unavailable'));};slide.append(img);viewport.append(slide);return slide;
 });
 if(!photos.length)viewport.append(text('p','暂无原帖配图','photo-unavailable'));
 const previous=text('button','‹','gallery-previous'),next=text('button','›','gallery-next'),caption=text('div','','gallery-caption'),counter=text('span','','gallery-counter');
 previous.setAttribute('aria-label','上一张照片');next.setAttribute('aria-label','下一张照片');previous.hidden=next.hidden=photos.length<=1;
 caption.append(text('span','原帖照片'),counter);counter.setAttribute('aria-live','polite');gallery.append(viewport,previous,next,caption);card.querySelector('.post-cover').replaceWith(gallery);
 let index=0,target=0,programmatic=false,scrollTimer;
 function update(value){index=value;counter.textContent=photos.length?(value+1)+' / '+photos.length:'0 张';slides.forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i!==value)));}
 function go(step,event){const previousTarget=target;target=(target+step+photos.length)%Math.max(1,photos.length);programmatic=true;update(target);viewport.scrollTo({left:target*viewport.clientWidth,behavior:motionAllowed(event)&&Math.abs(target-previousTarget)===1?'smooth':'auto'});}
 function finish(){clearTimeout(scrollTimer);programmatic=false;target=Math.min(Math.max(0,Math.round(viewport.scrollLeft/Math.max(1,viewport.clientWidth))),Math.max(0,photos.length-1));update(target);const aligned=target*viewport.clientWidth;if(Math.abs(viewport.scrollLeft-aligned)>1)viewport.scrollTo({left:aligned,behavior:'auto'});}
 previous.onclick=e=>go(-1,e);next.onclick=e=>go(1,e);
 gallery.addEventListener('keydown',e=>{if(photos.length>1&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();go(e.key==='ArrowRight'?1:-1,e);}});
 viewport.addEventListener('pointerdown',()=>{programmatic=false;target=index;});
 viewport.addEventListener('scroll',()=>{if(!programmatic){target=Math.round(viewport.scrollLeft/Math.max(1,viewport.clientWidth));update(Math.min(target,photos.length-1));}clearTimeout(scrollTimer);scrollTimer=setTimeout(finish,100);},{passive:true});
 viewport.addEventListener('scrollend',finish);
 const observer=new ResizeObserver(()=>viewport.scrollTo({left:index*viewport.clientWidth,behavior:'auto'}));observer.observe(viewport);update(0);
 const body=card.querySelector('.post-content');
 if(item.points.length){
  body.querySelector('.recommended-places')?.remove();body.querySelector('.open-local-post')?.remove();
  const places=text('section','','detail-places');places.setAttribute('aria-label','对应地点');places.append(text('h4',item.points.length>1?'对应地点（'+item.points.length+'）':'对应地点'));
  for(const point of item.points){const row=text('div','','detail-place'),info=text('div','');info.append(text('strong',point.name));if(point.address)info.append(text('p',point.address));row.append(info,link('看地图',localLink(item,point)));places.append(row);}body.append(places);
 }
 if(item.note.content?.trim()){
  const excerpt=text('details','','post-excerpt');excerpt.append(text('summary','原帖文字'),text('p',item.note.content.trim()));body.append(excerpt);
 }
 return ()=>{observer.disconnect();clearTimeout(scrollTimer);};
}
