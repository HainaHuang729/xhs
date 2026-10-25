// Horizontal intent is shared by touch, pen and mouse. A vertical scroll must
// never change the note, even when a diagonal gesture has some horizontal travel.
export function swipeDirection({dx,dy,velocity=0,width=360}){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||!(width>0)||Math.abs(dx)<Math.abs(dy)*1.4)return 0;
 const threshold=Math.min(90,Math.max(48,width*.2));
 return Math.abs(dx)>=threshold||(Math.abs(dx)>28&&Math.abs(velocity)>.5&&Math.sign(velocity)===Math.sign(dx))?(dx<0?1:-1):0;
}
export function motionAllowed(event){return !matchMedia('(prefers-reduced-motion: reduce)').matches&&event?.type!=='keydown'&&event?.type!=='cancel'&&!(event?.type==='click'&&event.detail===0);}

export function createFocusMotion(stage,{advance,enabled,canAdvance}){
 let gesture,animations=[],overlays=[],suppressClickUntil=0;
 function stop(){for(const a of animations)a.cancel();animations=[];for(const el of overlays)el.remove();overlays=[];stage.style.minHeight='';}
 function resetCard(card){if(card){card.style.transform='';card.style.opacity='';}stage.classList.remove('is-dragging');}
 function settle(card,event){
  if(!card)return;const from=card.style.transform;resetCard(card);
  if(from&&motionAllowed(event)){const a=card.animate([{transform:from},{transform:'translateX(0) rotate(0deg)'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});animations.push(a);}
 }
 function turn(change,direction,event){
  const old=stage.querySelector(':scope > .recommended-post'),from=old?.style.transform||'translateX(0) rotate(0deg)';
  stop();resetCard(old);gesture=null;
  const height=old?.offsetHeight;change();const next=stage.querySelector(':scope > .recommended-post');
  if(event?.type==='keydown')stage.focus({preventScroll:true});
  if(!old||!next||old.dataset.noteId===next.dataset.noteId||!motionAllowed(event))return;
  old.classList.add('outgoing-post');old.setAttribute('aria-hidden','true');old.inert=true;stage.append(old);overlays.push(old);stage.style.minHeight=height+'px';
  const options={duration:260,easing:'cubic-bezier(.22,1,.36,1)'};
  const outgoing=old.animate([{transform:from,opacity:1},{transform:`translateX(${-direction*110}px) rotate(${-direction*2}deg) scale(.98)`,opacity:0}],options);
  const incoming=next.animate([{transform:`translateX(${direction*42}px) rotate(${direction*.7}deg) scale(.985)`,opacity:0},{transform:'translateX(0) rotate(0deg) scale(1)',opacity:1}],options);
  animations=[outgoing,incoming];Promise.allSettled(animations.map(a=>a.finished)).then(()=>{old.remove();if(overlays.includes(old)){overlays=overlays.filter(n=>n!==old);stage.style.minHeight='';}});
 }
 stage.addEventListener('pointerdown',e=>{
  suppressClickUntil=0;
  if(!enabled()||!canAdvance()||!e.isPrimary||e.button!==0)return;
  if(e.target.closest('a,input,select,textarea,button:not(.post-cover)'))return;
  const card=stage.querySelector(':scope > .recommended-post');if(!card)return;stop();
  gesture={id:e.pointerId,card,x:e.clientX,y:e.clientY,lastX:e.clientX,lastTime:e.timeStamp,startTime:e.timeStamp,velocity:0,dragging:false};
 });
 stage.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId||g.vertical)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.dragging){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g.vertical=true;return;}if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.4)return;g.dragging=true;stage.setPointerCapture(e.pointerId);stage.classList.add('is-dragging');}
  e.preventDefault();const elapsed=e.timeStamp-g.lastTime;if(elapsed>0)g.velocity=(e.clientX-g.lastX)/elapsed;g.lastX=e.clientX;g.lastTime=e.timeStamp;
  if(motionAllowed(e))g.card.style.transform=`translateX(${dx*.78}px) rotate(${Math.max(-4,Math.min(4,dx/70))}deg)`;
 });
 stage.addEventListener('pointerup',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);stage.classList.remove('is-dragging');
  if(g.vertical){suppressClickUntil=performance.now()+350;return;}if(!g.dragging)return;suppressClickUntil=performance.now()+350;
  const velocity=e.timeStamp-g.lastTime<85?g.velocity:0,direction=swipeDirection({dx:e.clientX-g.x,dy:e.clientY-g.y,velocity,width:g.card.offsetWidth});
  if(direction)advance(direction,e);else settle(g.card,e);
 });
 function cancelGesture(e){if(gesture?.id===e.pointerId){const card=gesture.card;gesture=null;settle(card,e);}}
 stage.addEventListener('pointercancel',cancelGesture);stage.addEventListener('lostpointercapture',cancelGesture);
 stage.addEventListener('click',e=>{if(e.detail>0&&performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 stage.addEventListener('keydown',e=>{if(!enabled()||!canAdvance()||e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('a,input,select,textarea'))return;e.preventDefault();advance(e.key==='ArrowRight'?1:-1,e);});
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{stop();resetCard(gesture?.card);gesture=null;});
 return {turn,cancel:()=>{stop();resetCard(gesture?.card);gesture=null;}};
}
