import {normalize,regionMatches,safeUrl,safePhoto} from './model.js';
import {mergeCategoryReview} from './categories.js';
import {selectedVariant} from './interface.js';
import {discoveryLayout} from './discovery-layouts.js';
import {createFocusMotion,motionAllowed} from './discovery-motion.js';
import {fillPostDetails,notePhotos} from './discovery-details.js';
import {discoveryDomains,discoveryCounts,discoveryFacets,recommendDiscovery,matchesDiscovery} from './discovery.js';

const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),ui=selectedVariant(location.search),layout=discoveryLayout(location.search);
document.body.dataset.ui=ui.id;document.body.dataset.look=layout.id;
document.body.classList.toggle('embedded',window.self!==window.top);
let domain=discoveryDomains.some(d=>d.id===params.get('kind'))?params.get('kind'):'eat';
let facet=discoveryFacets.some(f=>f.domain===domain&&f.id===params.get('topic'))?params.get('topic'):'all';
let notes=[],showOthers=false,pickOffset=0,firstRender=true,contentAnimation;
let turnableCount=0;
const dialogTriggers=new WeakMap();
const region=$('#discoverRegion'),located=$('#locatedOnly');
const focusMotion=createFocusMotion($('#recommendedPosts'),{advance,enabled:()=>layout.id==='focus',canAdvance:()=>turnableCount>1});
if(layout.id==='focus'){
 const toolbar=$('.pick-toolbar'),navigation=$('#focusNavigation');navigation.hidden=false;navigation.prepend(toolbar);toolbar.classList.add('focus-dock');toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','漫游翻页');
 toolbar.replaceChildren($('#previousPick'),$('#picksLabel'),$('#changePicks'));$('#recommendedPosts').tabIndex=0;$('#recommendedPosts').setAttribute('aria-label','收藏卡片，可用左右方向键切换');
}
if([...region.options].some(o=>o.value===params.get('region')))region.value=params.get('region');
located.checked=params.get('located')==='1';
const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;};
function link(label,url,cls){const a=text('a',label,cls);a.href=url;return a;}
function scopedNotes(){return notes.filter(n=>regionMatches(n,region.value));}
function openDialog(dialog,event){dialogTriggers.set(dialog,document.activeElement);dialog.classList.toggle('no-motion',!motionAllowed(event));document.documentElement.classList.add('dialog-open');dialog.showModal();}
async function closeDialog(dialog,event){
 if(!dialog.open||dialog.classList.contains('is-closing'))return;
 if(!motionAllowed(event)){dialog.close();return;}
 dialog.classList.add('is-closing');const computed=getComputedStyle(dialog);
 try{await dialog.animate([{opacity:computed.opacity,transform:computed.transform},{opacity:0,transform:'translateY(20px)'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'}).finished;}catch{}
 dialog.close();dialog.classList.remove('is-closing');
}
function chooseFacet(id){facet=id;showOthers=false;pickOffset=0;render();}
function facetButton(id,label,count,compact=false){
 const b=text('button','','facet-button');b.append(text('span',label));if(!compact)b.append(text('small',count));
 b.setAttribute('aria-pressed',String(facet===id));b.dataset.facet=id;
 b.onclick=e=>{chooseFacet(id);if($('#facetDialog').open)closeDialog($('#facetDialog'),e);animateContent(e);};return b;
}
function animateContent(event,direction=1){
 focusMotion.cancel();if(!motionAllowed(event))return;
 contentAnimation?.cancel();
 contentAnimation=$('#recommendedPosts').animate([{opacity:0,transform:`translate${layout.id==='focus'?'X':'Y'}(${direction*(layout.id==='focus'?14:7)}px)`},{opacity:1,transform:'translate(0,0)'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
}
function featuredPosts(ranked){
 const pool=ranked.filter(r=>r.canFeature),offset=pickOffset%Math.max(1,pool.length),rotated=[...pool.slice(offset),...pool.slice(0,offset)],picked=[],kinds=new Set();
 for(const item of rotated){const key=item.primaryFacet||item.facets[0];if(facet==='all'&&kinds.has(key))continue;picked.push(item);kinds.add(key);if(picked.length===layout.limit)break;}
 for(const item of rotated)if(picked.length<layout.limit&&!picked.includes(item))picked.push(item);
 return picked;
}
function localLink(item,point=item.points[0]){const q=new URLSearchParams({ui:ui.id,region:region.value,post:item.note.id});if(point)q.set('place',point.name);return './?'+q+(point?'#map':'#list');}
function placeText(item){return item.points.length?item.points.slice(0,2).map(p=>p.name).join(' / ')+(item.points.length>2?' 等 '+item.points.length+' 处':''):'地点待确认';}
function postCard(item,detail=false){
 const n=item.note,card=text('article','','recommended-post');card.dataset.noteId=n.id;
 const isGallery=layout.id==='gallery'&&!detail,opensDetail=['gallery','focus'].includes(layout.id)&&!detail;
 const cover=opensDetail?text('button','','post-cover'):link('',safeUrl(n.url),'post-cover');
 if(opensDetail){cover.setAttribute('aria-label','查看照片和详情：'+n.title);cover.onclick=e=>openPost(item,cover,e);}
 else{cover.target='_blank';cover.rel='noreferrer';cover.setAttribute('aria-label','打开原帖：'+n.title);}
 const photo=safePhoto(n.cover_image);if(photo){const img=document.createElement('img');img.src=photo;img.alt=n.title;img.loading=detail?'eager':'lazy';img.referrerPolicy='no-referrer';img.draggable=false;cover.append(img);}else cover.append(text('span','读一篇收藏','no-post-photo'));
 if(layout.id==='focus'&&!detail){const count=notePhotos(n).length;cover.append(text('span',count?'看照片 · '+count:'查看详情','photo-peek'));}
 card.append(cover);
 const body=text('div','','post-content'),kind=item.past?'往期活动':item.schedule?'日期待复核':item.question?'提问帖':discoveryFacets.find(f=>f.id===item.primaryFacet)?.label||item.facets[0]||n.category;
 body.append(text('span',kind,'post-kind'+(item.past||item.schedule?' historical':'')));
 const heading=text('h3',''),title=isGallery?text('button',n.title):link(n.title,safeUrl(n.url));
 if(isGallery)title.onclick=e=>openPost(item,title,e);else{title.target='_blank';title.rel='noreferrer';}
 heading.append(title);if(detail)heading.id='postDialogHeading';body.append(heading,text('p',item.reason,'recommendation-reason'),text('p',placeText(item),'recommended-places'));
 const actions=text('div','','post-actions'),read=link('看原帖',safeUrl(n.url),'read-post');read.target='_blank';read.rel='noreferrer';
 let placeAction;
 if(!detail&&item.points.length>1){placeAction=text('button','看地点（'+item.points.length+'）','open-local-post');placeAction.onclick=e=>openPost(item,placeAction,e,true);}
 else placeAction=link(item.points.length?'看地点':'收藏详情',localLink(item),'open-local-post');
 actions.append(read,placeAction);body.append(actions);card.append(body);return card;
}
function openPost(item,trigger,event,showPlaces=false){
 const card=postCard(item,true),dispose=fillPostDetails(card,item,{text,link,localLink});$('#postDialogContent').replaceChildren(card);openDialog($('#postDialog'),event);
 if(showPlaces)$('#postDialog').scrollTop=card.querySelector('.detail-places').offsetTop-60;
 $('#postDialog').addEventListener('close',()=>{dispose();trigger.focus({preventScroll:true});},{once:true});
}
function updateIndicator(){const active=$('#discoveryDomains [aria-pressed="true"]');if(!active)return;const indicator=$('#domainIndicator');indicator.style.width=active.offsetWidth+'px';indicator.style.transform=`translateX(${active.offsetLeft}px)`;}
function render(){
 const scoped=scopedNotes(),counts=discoveryCounts(scoped,domain),visibleFacets=counts.filter(f=>f.count),rankedAll=recommendDiscovery(scoped,domain,facet,region.value);
 const ranked=located.checked?rankedAll.filter(r=>r.points.length):rankedAll;
 const activeDomain=discoveryDomains.find(d=>d.id===domain),activeFacet=counts.find(f=>f.id===facet);
 if(facet!=='all'&&!activeFacet){facet='all';return render();}
 const totals=new Map(discoveryDomains.map(d=>[d.id,scoped.filter(n=>matchesDiscovery(n,d.id)).length]));
 if(firstRender){
  for(const d of discoveryDomains){const b=text('button',d.name,'domain-button');b.dataset.domain=d.id;b.onclick=e=>{$('#domainIndicator').style.transition=e.detail===0?'none':'';domain=d.id;facet='all';showOthers=false;pickOffset=0;render();animateContent(e);};$('#discoveryDomains').append(b);}
  firstRender=false;
 }
 for(const b of $('#discoveryDomains').querySelectorAll('button'))b.setAttribute('aria-pressed',String(domain===b.dataset.domain));
 updateIndicator();
 $('#pageHeading').textContent={eat:'今天，吃点什么？',drink:'找个地方，喝一杯。',play:'今天，出去走走。',relax:'今天，找点乐趣。'}[domain];
 $('#facetHeading').textContent={eat:'想吃什么？',drink:'想喝什么？',play:'想去哪里玩？',relax:'怎么放松一下？'}[domain];
 const quickIds={eat:['restaurants','noodles','desserts','cuisine-日料'],drink:['coffee','tea','bar','traditional-drinks'],play:['citywalk','hiking','seaside','museum'],relax:['photo-spots','escape','shops','shows']}[domain];
 const quick=quickIds.map(id=>visibleFacets.find(f=>f.id===id)).filter(Boolean);if(activeFacet&&!quick.includes(activeFacet))quick.push(activeFacet);
 const quickContainer=$('#discoveryFacets'),scroll=quickContainer.scrollLeft;
 const shortLabels={restaurants:'餐厅',noodles:'小吃面食',desserts:'甜品',coffee:'咖啡',tea:'茶饮',bar:'酒饮','traditional-drinks':'传统饮品',citywalk:'城市漫步',hiking:'徒步',seaside:'看海',museum:'看展','photo-spots':'拍照',escape:'密室',shops:'逛店',shows:'演出'};
 quickContainer.replaceChildren(facetButton('all','随便看看',totals.get(domain),true),...quick.map(f=>facetButton(f.id,shortLabels[f.id]||f.label,f.count,true)));
 const more=text('button','全部分类','more-facets');more.onclick=e=>openDialog($('#facetDialog'),e);quickContainer.append(more);quickContainer.scrollLeft=scroll;
 const dialog=$('#facetDialogItems');dialog.replaceChildren(facetButton('all','全部',totals.get(domain)));let family='';
 for(const f of visibleFacets){if(f.family!==family){family=f.family;dialog.append(text('h4',family,'facet-family'));}dialog.append(facetButton(f.id,f.label,f.count));}
 $('#regionLabel').textContent=({hksz:'港深',gba:'大湾区',all:'全部地区'}[region.value]||region.value);
 $('#openFacetDialog').setAttribute('aria-label',region.selectedOptions[0].text+'，地区和分类筛选'+(located.checked?'，仅显示有地点的帖子':''));
 $('#openFacetDialog').classList.toggle('is-filtered',located.checked||region.value!=='hksz');
 const featured=featuredPosts(ranked),others=ranked.filter(r=>!featured.includes(r)),pool=ranked.filter(r=>r.canFeature);turnableCount=pool.length;
 $('#discoverySummary').textContent=region.selectedOptions[0].text+'，'+(activeFacet?.label||activeDomain.name)+'，'+ranked.length+' 篇收藏'+(featured.length?'。当前：'+featured[0].note.title:'');
 $('#picksLabel').textContent=layout.id==='focus'&&pool.length?(pickOffset%pool.length+1)+' / '+pool.length:activeFacet?.label||'从收藏里挑几篇';
 $('#focusNavigation').hidden=layout.id!=='focus'||!featured.length;
 $('#focusNavigation .gesture-hint').hidden=pool.length<=1;
 $('.pick-toolbar').classList.toggle('single-post',pool.length<=1);
 if(layout.id==='focus'){$('#previousPick').textContent='← 上一篇';$('#picksLabel').setAttribute('aria-label','第 '+(pickOffset%Math.max(1,pool.length)+1)+' 篇，共 '+pool.length+' 篇');}
 $('#changePicks').hidden=pool.length<=layout.limit;$('#previousPick').hidden=layout.id!=='focus'||pool.length<=1;
 $('#changePicks').replaceChildren(text('span',layout.id==='focus'?'下一篇':'换一组'),text('span',layout.id==='focus'?'→':'↻'));
 $('#changePicks').setAttribute('aria-label',layout.id==='focus'?'下一篇':'换一组帖子');
 $('#recommendedPosts').replaceChildren(...featured.map(r=>postCard(r)));
 $('#discoveryEmpty').hidden=featured.length>0;
 $('#emptyReason').textContent=!ranked.length?'换个分类或地区，继续看看。':ranked.every(r=>r.past||r.schedule)?'这里暂时只有往期或日期待核的活动，原帖在下面。':'目前以提问或线索较少的帖子为主，可以先读原帖。';
 $('#clearLocated').hidden=!located.checked;
 $('#otherPostsSection').hidden=!others.length;
 const expanded=showOthers||!featured.length;$('#otherPosts').hidden=!expanded;$('#toggleOtherPosts').setAttribute('aria-expanded',String(expanded));$('#toggleOtherPosts').textContent=expanded?'收起更多收藏':'更多相关收藏';
 $('#toggleOtherPosts').hidden=!featured.length;$('#otherPosts').replaceChildren(...(expanded?others.map(r=>postCard(r)):[]));
 const q=new URLSearchParams({ui:ui.id,look:layout.id,kind:domain,region:region.value});if(facet!=='all')q.set('topic',facet);if(located.checked)q.set('located','1');history.replaceState(null,'','?'+q);
 window.dispatchEvent(new Event('discoverychange'));
 $('#compareLooks').href='discover-versions.html?'+q;
 const back='./?'+new URLSearchParams({ui:ui.id,region:region.value});$('#backToMap').href=back;$('#mapLink').href=back;
}
function advance(step,event){const pool=recommendDiscovery(scopedNotes(),domain,facet,region.value).filter(r=>r.canFeature&&(!located.checked||r.points.length));if(pool.length<=1)return;const change=()=>{pickOffset=(pickOffset+step+pool.length)%pool.length;render();};if(layout.id==='focus'){contentAnimation?.cancel();focusMotion.turn(change,Math.sign(step),event);}else{change();animateContent(event);}}
region.onchange=()=>{showOthers=false;pickOffset=0;render();};located.onchange=()=>{showOthers=false;pickOffset=0;render();};
$('#changePicks').onclick=e=>advance(layout.limit,e);$('#previousPick').onclick=e=>advance(-1,e);
$('#toggleOtherPosts').onclick=()=>{showOthers=!showOthers;render();};$('#clearLocated').onclick=e=>{located.checked=false;render();animateContent(e);};
$('#openFacetDialog').onclick=e=>openDialog($('#facetDialog'),e);
$('#closeFacetDialog').onclick=e=>closeDialog($('#facetDialog'),e);$('#applyFilters').onclick=e=>{closeDialog($('#facetDialog'),e);animateContent(e);};
$('#closePostDialog').onclick=e=>closeDialog($('#postDialog'),e);
for(const dialog of document.querySelectorAll('dialog')){
 dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.documentElement.classList.remove('dialog-open');const trigger=dialogTriggers.get(dialog);if(trigger?.isConnected)trigger.focus({preventScroll:true});else if(dialog.id==='facetDialog')$('#openFacetDialog').focus({preventScroll:true});});
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog(dialog,e);});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog,e);}});
}
new ResizeObserver(updateIndicator).observe($('#discoveryDomains'));
try{
 const endpoint=document.querySelector('meta[name="favorites-source"]')?.content||'/api/favorites';
 const response=await fetch(endpoint);if(!response.ok)throw Error('读取本地收藏失败');
 const source=normalize(await response.json()),all=new Map(source.map(n=>[n.id,n]));
 try{for(const cached of normalize(JSON.parse(localStorage.getItem('xhs-favorites-map-v2')||'[]'))){const incoming=all.get(cached.id);if(incoming)all.set(cached.id,{...incoming,...mergeCategoryReview(cached,incoming),locations:cached.location_edited?cached.locations:incoming.locations});else all.set(cached.id,cached);}}catch{}
 notes=normalize([...all.values()]);render();
}catch(error){$('#discoverySummary').classList.remove('sr-only');$('#discoverySummary').textContent=error.message+'，请确认本地地图服务正在运行。';}
