import {setupExploreMap} from './explore-map.js';
import {categoryNames,mergeCategoryReview,categoryTheme} from './categories.js';
import {cuisineNames,foodMatches,foodLabel,classifyFood} from './food-categories.js';
import {normalize,storageRows,safeUrl,safePhoto,photosForPoint,citiesFor,regionMatches,pointsForRegion,foodPointsForRegion} from './model.js';
import {browseGroups,browseGroupFor,groupedCategories} from './browse-groups.js';
import {setupInterface} from './interface.js';
const ui=setupInterface();
const $=s=>document.querySelector(s), storage='xhs-favorites-map-v2';
const hosted=document.querySelector('meta[name="map-hosting"]')?.content==='private-cloud';
const favoritesEndpoint=document.querySelector('meta[name="favorites-source"]')?.content||'/api/favorites';
let notes=[],filter='all',foodFilter='all',cuisineFilter='all',themeFilter='all',current=null,coverage=null,selectedId=null;
const cards=new Map();
const pageParams=new URLSearchParams(location.search);
if([...$('#region').options].some(o=>o.value===pageParams.get('region')))$('#region').value=pageParams.get('region');
try{notes=normalize(JSON.parse(localStorage.getItem(storage)||'[]'));}catch{}
const map=L.map('map',{zoomControl:true,minZoom:7,maxZoom:19}).setView([22.42,114.12],10);
const basemap=setupExploreMap(map,L);
const layer=L.layerGroup().addTo(map);
function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
function persist(){try{localStorage.setItem(storage,JSON.stringify(storageRows(notes)));}catch{alert('浏览器存储空间不足，请导出备份。');}}
function selectedRegion(){return $('#region').value;}
function regionNotes(){return notes.filter(n=>regionMatches(n,selectedRegion()));}
function selectedPoints(n){return foodPointsForRegion(n,selectedRegion(),foodFilter,cuisineFilter);}
function link(label,url){const a=text('a',label);a.href=safeUrl(url);a.target='_blank';a.rel='noreferrer';return a;}
function pointIcon(n){const theme=categoryTheme(n.category),kind=theme==='户外自然'?'outdoor':['艺术看展','机位与拍照'].includes(theme)?'art':'food';const symbol=kind==='outdoor'?'⌁':kind==='art'?'✳':theme==='咖啡甜品'?'☕':'•';return L.divIcon({className:'place-marker',html:`<span class="map-pin pin-${kind}">${symbol}</span>`,iconSize:[36,36],iconAnchor:[18,18]});}
let allMarkers=[];
function refreshMarkers(){
 layer.clearLayers();
 if(map.getZoom()>=15){for(const m of allMarkers)m.addTo(layer);return;}
 const groups=[];
 for(const marker of allMarkers){const point=map.project(marker.getLatLng(),map.getZoom());let group=groups.find(g=>g.center.distanceTo(point)<52);if(!group){group={markers:[],center:point};groups.push(group);}group.markers.push(marker);group.center=group.center.multiplyBy((group.markers.length-1)/group.markers.length).add(point.divideBy(group.markers.length));}
 // Merge touching groups too, so adjacent cells cannot cover each other's counts.
 let merged=true;while(merged){merged=false;outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)if(groups[i].center.distanceTo(groups[j].center)<52){const a=groups[i],b=groups[j],count=a.markers.length+b.markers.length;a.center=a.center.multiplyBy(a.markers.length/count).add(b.center.multiplyBy(b.markers.length/count));a.markers.push(...b.markers);groups.splice(j,1);merged=true;break outer;}}
 for(const {markers:group} of groups){
  if(group.length===1){group[0].addTo(layer);continue;}
  const center=L.latLng(group.reduce((v,m)=>v+m.getLatLng().lat,0)/group.length,group.reduce((v,m)=>v+m.getLatLng().lng,0)/group.length);
  L.marker(center,{title:group.length+' 个收藏地点，点击展开',icon:L.divIcon({className:'cluster-marker',html:`<span>${group.length}</span>`,iconSize:[44,44],iconAnchor:[22,22]})}).on('click',()=>{const zoom=map.getZoom();map.fitBounds(L.latLngBounds(group.map(m=>m.getLatLng())),{padding:[55,110],maxZoom:16,animate:false});if(map.getZoom()<=zoom)map.setZoom(zoom+1);}).addTo(layer);
 }
}
map.on('zoomend',refreshMarkers);
function fit(){const ps=allMarkers.map(m=>m.getLatLng());if(ps.length){basemap.ensureExtent(ps);map.fitBounds(L.latLngBounds(ps),{paddingTopLeft:[45,110],paddingBottomRight:[45,100],maxZoom:15,animate:false});refreshMarkers();}}
function setMobileMap(value){document.body.classList.toggle('mobile-map',value);$('#mobileList').classList.toggle('active',!value);$('#mobileMap').classList.toggle('active',value);$('#mobileList').setAttribute('aria-pressed',String(!value));$('#mobileMap').setAttribute('aria-pressed',String(value));$('#toggleBoardMap').textContent=value?'返回画册':'查看地图';map.invalidateSize();if(value&&!selectedId)fit();}
$('#mobileMap').onclick=()=>setMobileMap(true);$('#mobileList').onclick=()=>setMobileMap(false);
$('#toggleBoardMap').onclick=()=>setMobileMap(!document.body.classList.contains('mobile-map'));
window.addEventListener('resize',()=>{map.invalidateSize();refreshMarkers();});
let phoneUrl='';
$('#openPhone').onclick=async()=>{
 $('#copyPhone').textContent='复制手机访问地址';$('#phoneDialog').showModal();$('#phoneQr').replaceChildren();$('#copyPhone').hidden=true;$('#phoneLink').textContent='';
 try{let data;if(hosted){data={url:location.origin,display_url:location.origin,mode:'cloud'};}else{const res=await fetch('/api/access');if(!res.ok)throw Error('请在电脑上的地图页面获取连接二维码。');data=await res.json();}
 if(!data.url)throw Error('尚未开启手机访问，请用 npm run start:lan 重启地图服务。');
 phoneUrl=data.url;$('#phoneLink').href=phoneUrl;$('#phoneLink').textContent=data.display_url;const cloud=hosted||data.mode==='cloud';$('#phoneMessage').textContent=cloud?'手机扫码后登录同一个 ChatGPT 账号，即可随时查看。':'用手机相机扫码，打开你的收藏地图。';if($('#phoneInstructions'))$('#phoneInstructions').textContent=cloud?'网页与照片已托管，电脑关机也能查看。可在手机浏览器中添加到主屏幕。':'手机与电脑连接同一 Wi-Fi，并保持这台电脑和地图服务开启。也可以在手机浏览器中添加到主屏幕。';
 const qr=qrcode(0,'M');qr.addData(phoneUrl);qr.make();$('#phoneQr').innerHTML=qr.createSvgTag({cellSize:5,margin:4,scalable:true});$('#copyPhone').hidden=false;
 }catch(e){$('#phoneMessage').textContent=e.message;}
};
$('#closePhone').onclick=()=>$('#phoneDialog').close();
$('#copyPhone').onclick=async()=>{try{await navigator.clipboard.writeText(phoneUrl);$('#copyPhone').textContent='已复制';}catch{$('#phoneLink').textContent=phoneUrl;$('#copyPhone').textContent='请长按上方链接复制';}};
$('#openProgress').onclick=()=>{renderProgress();$('#progressDialog').showModal();};
$('#closeProgress').onclick=()=>$('#progressDialog').close();
$('#precisionHelp').onclick=()=>$('#precisionDialog').showModal();
$('#closePrecision').onclick=()=>$('#precisionDialog').close();
$('#openCategories').onclick=()=>$('#categoryDialog').showModal();
$('#openMapCategories').onclick=()=>$('#categoryDialog').showModal();
$('#closeCategories').onclick=()=>$('#categoryDialog').close();
$('#allRegionCategories').onclick=()=>{$('#region').value='all';themeFilter='all';$('#category').value='all';foodFilter='all';cuisineFilter='all';render();fit();};
$('#allCategories').onclick=()=>{chooseGroup('all');$('#categoryDialog').close();};
function resetStatusFilter(){filter='all';document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter==='all';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
function chooseGroup(id,category='all'){
 themeFilter=id;$('#category').value='all';foodFilter='all';cuisineFilter='all';resetStatusFilter();
 render();if(category!=='all'){$('#category').value=category;render();}fit();
}
function renderCategoryNavigation(scoped){
 const groups=groupedCategories(scoped),totalCategories=new Set(scoped.map(n=>n.category)).size;
 $('#categoryScope').textContent=totalCategories+' 个分类';
 const category=$('#category').value,activeGroup=browseGroups.find(g=>g.id===themeFilter);
 $('#activeCategoryLabel').textContent=category!=='all'?category:activeGroup?.name||'浏览分类目录';
 const directoryGroup=groups.find(g=>g.id===themeFilter);
 $('#categoryDialogScope').textContent=$('#region').selectedOptions[0].text+'，'+(directoryGroup?directoryGroup.name+'：'+directoryGroup.count+' 条收藏、'+directoryGroup.categories.length:scoped.length+' 条收藏、'+totalCategories)+' 个分类';
 const tabs=$('#themeTabs'),rail=$('#categoryRail');tabs.replaceChildren();rail.replaceChildren(text('p','收藏目录','rail-title'));
 for(const group of [{id:'all',name:'全部收藏',short:'全部',symbol:'▦',count:scoped.length},...groups.filter(g=>g.count)]){
  for(const [target,short]of [[tabs,true],[rail,false]]){
   const button=text('button','','theme-button');button.dataset.theme=group.id;button.setAttribute('aria-pressed',String(themeFilter===group.id));button.classList.toggle('active',themeFilter===group.id);
   if(!short)button.append(text('i',group.symbol));button.append(text('span',short?group.short:group.name),text('small',group.count));button.onclick=()=>chooseGroup(group.id);target.append(button);
  }
 }
 rail.append(text('p','分类只改变浏览范围，原帖和地点都会保留。','rail-note'));
 const directory=$('#categoryDirectory');directory.replaceChildren();
 for(const group of groups.filter(g=>g.count&&(themeFilter==='all'||g.id===themeFilter))){
  const section=text('section','','directory-group'),heading=text('button','','directory-heading');heading.append(text('span',group.symbol),text('strong',group.name),text('small',group.count+' 条'));heading.onclick=()=>{chooseGroup(group.id);$('#categoryDialog').close();};
  section.append(heading);const items=text('div','','directory-items');
  for(const cat of group.categories){const b=text('button','','directory-category');b.append(text('span',cat.name),text('small',cat.count));b.classList.toggle('active',category===cat.name);b.onclick=()=>{chooseGroup(group.id,cat.name);$('#categoryDialog').close();};items.append(b);}
  section.append(items);directory.append(section);
 }
}
$('#importLabel').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file').click();}};
function progressLine(title,detail,value,done=false){const row=text('div','','progress-line'),body=text('div','');body.append(text('span',title));if(detail)body.append(text('p',detail));row.append(body,text('strong',value,done?'done-label':'todo-label'));return row;}
function verifiedAlbumBatch(batch){
 if(batch?.status!=='verified'||!Number.isInteger(batch.note_count)||batch.note_count<1||batch.verified_count!==batch.note_count||!Array.isArray(batch.verified_note_ids)||batch.verified_note_ids.length!==batch.note_count||typeof batch.album!=='string'||!batch.album.trim()||!/^[a-f0-9]{24}$/.test(batch.board_id||''))return null;
 const ids=new Set(batch.verified_note_ids);
 return ids.size===batch.note_count&&[...ids].every(id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id))?ids:null;
}
function verifiedCurrentAlbum(note){
 const item=note.album_sync_current;
 return item?.status==='verified'&&item.note_id===note.id&&/^[a-f0-9]{24}$/.test(item.note_id||'')&&/^[a-f0-9]{24}$/.test(item.board_id||'')&&typeof item.album==='string'&&Boolean(item.album.trim())&&typeof item.verified_at==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(item.verified_at)&&Number.isFinite(Date.parse(item.verified_at))?item:null;
}
function importCoverageText(value){
 if(!value)return '目前显示本机已导入的数据，尚未取得网页计数。';
 if(Number.isInteger(value.visible_read_count)&&value.visible_read_count>=0){
  const historical=Number.isInteger(value.historical_not_visible_count)&&value.historical_not_visible_count>=0?`，含 ${value.historical_not_visible_count} 条历史收藏本轮未见`:'';
  const newer=Number.isInteger(value.visible_new_not_imported_count)&&value.visible_new_not_imported_count>0?`；另有 ${value.visible_new_not_imported_count} 条新收藏不在本批整理范围`:'';
  return `本次网页读到 ${value.visible_read_count} 条，页面显示 ${value.page_total} 条，${value.unmatched} 条尚未读取。本地累计 ${value.imported} 条${historical}${newer}。`;
 }
 return `上次网页显示 ${value.page_total} 条，已导入 ${value.imported} 条，仍有 ${value.unmatched} 条尚未匹配。`;
}
function renderProgress(){
 const h=notes.filter(n=>regionMatches(n,'hksz')),located=h.filter(n=>pointsForRegion(n,'hksz').length),pending=h.filter(n=>!pointsForRegion(n,'hksz').length);
 const synced=h.filter(n=>n.album_sync?.status==='verified').length,photoDone=h.filter(n=>n.photo_complete).length,read=h.filter(n=>n.photo_checked_at&&!n.photo_error||n.content).length;
 const albumPending=coverage?.album_sync_pending,verifiedBatch=verifiedAlbumBatch(albumPending);
 const currentAlbums=notes.filter(n=>verifiedCurrentAlbum(n));
 $('#progressLabel').textContent=currentAlbums.length?`当前专辑已核验 · ${currentAlbums.length} 篇`:verifiedBatch?`待查专辑已归档 · ${verifiedBatch.size} 篇`:albumPending?.note_count?`专辑待归档 · ${albumPending.note_count} 篇`:synced===h.length&&h.length?`主题专辑历史核验 · ${synced}`:'查看整理进度';
 const root=$('#progressContent');root.replaceChildren();
 const unclassified=notes.filter(n=>n.category==='待分类').length;
 const section=text('section','','progress-section');section.append(text('h3','本轮收藏整理'),progressLine('本地已分类','按当前本地全部收藏统计；分类不代表地点已核实',(notes.length-unclassified)+' / '+notes.length,unclassified===0),progressLine('分类待确认','现有标题和文字不足以明确归类',unclassified+' 篇',unclassified===0));
 if(currentAlbums.length)section.append(progressLine('小红书当前专辑','已逐条回读核验的归属；与下方历史记录分开统计',currentAlbums.length+' 篇',true));
 const batchSync=coverage?.album_sync_current;
 if(batchSync?.status==='verified'&&Number.isInteger(batchSync.batch_moved)&&Number.isInteger(batchSync.batch_already_correct))section.append(text('p',`最近一次已核验的归档：新增或调整 ${batchSync.batch_moved} 篇，另有 ${batchSync.batch_already_correct} 篇原本已在正确专辑中。`,'progress-note'));
 if(batchSync?.status==='verified'&&Number.isInteger(batchSync.batch_skipped)&&batchSync.batch_skipped>0)section.append(text('p',`${batchSync.batch_skipped} 篇本轮未在当前专辑中找到，保留本地分类。`,'progress-note'));
 const refined=coverage?.refined_album_classification;
 if(refined?.status==='verified'&&Number.isInteger(refined.created_album_count)&&refined.created_album_count>0)section.append(progressLine('细分类专辑','餐厅按菜系；甜品、小吃、咖啡、饮品、食谱及其他主题分别整理',refined.created_album_count+' 本新私密专辑',true));
 const localTaxonomy=coverage?.local_new_taxonomy;
 if(localTaxonomy?.status==='local-reviewed-external-pending'&&Number.isInteger(localTaxonomy.applied_note_count))section.append(progressLine('本地细分类','已按新分类整理；小红书新专辑归档尚待完成',localTaxonomy.applied_note_count+' 篇',true));
 const originalBatch=coverage?.original_review_batch;
 if(originalBatch&&Number.isInteger(originalBatch.read_count)){
  section.append(progressLine('本批原帖读取','正文、标签和封面已保存到本机',originalBatch.read_count+' 篇',true));
  section.append(progressLine('本批分类',originalBatch.awaiting_video_count?'另有 '+originalBatch.awaiting_video_count+' 篇视频主旨待复核':'本批已全部确认分类',originalBatch.classified_count+' 篇',!originalBatch.awaiting_video_count));
  if(originalBatch.external_status!=='verified')section.append(progressLine('本批小红书归档','本地分类已保存；小红书专辑尚待同步核验','待同步'));
  else if(Number.isInteger(originalBatch.external_verified_count))section.append(progressLine('本批小红书归档',originalBatch.external_skipped_count?originalBatch.external_skipped_count+' 篇历史笔记未在当前收藏中找到，保留本地分类':'已逐条回读核验专辑归属',originalBatch.external_verified_count+' 篇已核验',true));
 }
 root.append(section);
 const focus=text('section','','progress-section'),heading=text('h3','香港 + 深圳');heading.append(text('span',h.length+' 条相关收藏'));focus.append(heading);
 focus.append(progressLine('原笔记读取',h.length-read?'仍有笔记尚未读取':h.some(n=>n.body_status==='empty')?'包含 '+h.filter(n=>n.body_status==='empty').length+' 条未提供正文的笔记':'这批原笔记已读取',read+' / '+h.length,read===h.length),progressLine('主题专辑历史核验','此前回读核对的归档记录；新增待查专辑进度见下方',synced+' / '+h.length,synced===h.length),progressLine('照片图组',h.reduce((s,n)=>s+(n.photo_saved||0),0).toLocaleString()+(hosted?' 张原笔记配图已随网页保存':' 张原笔记配图已保存在本机'),photoDone+' / '+h.length,photoDone===h.length),progressLine('地点核对',pending.length+' 条尚未上图；其中 '+pending.filter(n=>n.place_hints?.length).length+' 条已有地点线索',located.length+' / '+h.length));
 const meter=text('div','','progress-meter'),fill=text('span','');fill.style.width=(h.length?located.length/h.length*100:0)+'%';meter.append(fill);focus.append(meter,text('p','部分合集只确认了其中几个地点；没有实体地点的收藏也计入未上图。','progress-note'));root.append(focus);
 const mappedPoints=h.flatMap(n=>pointsForRegion(n,'hksz')),foodPoints=mappedPoints.filter(p=>p.food_groups?.length);
 const foodProgress=text('section','','progress-section');foodProgress.append(text('h3','已上图地点的分类'));
 for(const group of ['菜系','甜品','小吃','饮品'])foodProgress.append(progressLine(group,'按具体地点统计；同一地点可属于多类',foodPoints.filter(p=>p.food_groups.includes(group)).length+' 个',true));
 const cuisinePending=foodPoints.filter(p=>p.food_groups.includes('菜系')&&!p.food_cuisines?.length).length;
 foodProgress.append(text('p',`${foodPoints.length} 个吃喝地点标记已有分类，另有 ${mappedPoints.length-foodPoints.length} 个看展、徒步等地点标记。${cuisinePending} 个餐饮地点的具体菜系仍待细分。同一门店被多篇收藏提及，会分别保留标记和原帖照片。`,'progress-note'));root.append(foodProgress);
 const rest=text('section','','progress-section');rest.append(text('h3','接下来要整理的'));
 if(albumPending){const row=progressLine('待找地址专辑',verifiedBatch?`${albumPending.album}：${verifiedBatch.size} 篇已移入并回读核验，仅自己可见`:`${albumPending.album}已创建，仅自己可见；笔记归档尚待完整回读核验`,verifiedBatch?verifiedBatch.size+' / '+albumPending.note_count:albumPending.verified_count?'待完整核验':'0 / '+albumPending.note_count,Boolean(verifiedBatch));(verifiedBatch?focus:rest).append(row);}
 rest.append(progressLine('核对未读取收藏',Number.isInteger(coverage?.visible_read_count)?'网页总数与本次实际读到的数量之差，原因尚未确认':'上次网页总数与已导入数量之间的差额，原因尚未确认',coverage?.unmatched==null?'待核对':coverage.unmatched+' 条'),progressLine('港深以外的收藏','分类与专辑进度见上方；地点和照片尚未批量核对',notes.length-h.length+' 条'));root.append(rest);
 $('#coverage').textContent=importCoverageText(coverage)+(coverage?`港深已读取 ${read} / ${h.length} 条；已标 ${h.reduce((s,n)=>s+pointsForRegion(n,'hksz').length,0)} 个地点。以上不是全账号处理完成的比例。`:'');
}
let photoSet=[],photoIndex=0;
function showPhoto(){const img=$('#largePhoto');img.src=photoSet[photoIndex];img.alt=$('#photoCaption').textContent+'，第 '+(photoIndex+1)+' 张';$('#photoCount').textContent=(photoIndex+1)+' / '+photoSet.length;$('#prevPhoto').disabled=photoIndex===0;$('#nextPhoto').disabled=photoIndex===photoSet.length-1;}
$('#closePhoto').onclick=()=>$('#photoViewer').close();$('#prevPhoto').onclick=()=>{if(photoIndex>0){photoIndex--;showPhoto();}};$('#nextPhoto').onclick=()=>{if(photoIndex<photoSet.length-1){photoIndex++;showPhoto();}};
let swipeStart=null;$('#largePhoto').onpointerdown=e=>{if(e.pointerType==='touch')swipeStart=[e.clientX,e.clientY];};$('#largePhoto').onpointerup=e=>{if(!swipeStart)return;const dx=e.clientX-swipeStart[0],dy=e.clientY-swipeStart[1];swipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)(dx<0?$('#nextPhoto'):$('#prevPhoto')).click();};$('#largePhoto').onpointercancel=()=>{swipeStart=null;};
$('#photoViewer').onkeydown=e=>{if(e.key==='ArrowRight')$('#nextPhoto').click();if(e.key==='ArrowLeft')$('#prevPhoto').click();};
function photo(src,cls='note-photo',gallery=[src],caption='原笔记配图'){
 const img=document.createElement('img');img.src=safePhoto(src);img.alt='原收藏笔记照片';img.className=cls;img.loading='lazy';img.referrerPolicy='no-referrer';img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','放大照片：'+caption);
 img.onclick=()=>{photoSet=[...new Set(gallery.map(safePhoto).filter(Boolean))];if(!photoSet.includes(safePhoto(src)))photoSet.unshift(safePhoto(src));photoIndex=Math.max(0,photoSet.indexOf(safePhoto(src)));$('#photoCaption').textContent=caption;showPhoto();$('#photoViewer').showModal();};
 img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();img.click();}};
 img.onerror=()=>img.replaceWith(text('p','照片暂不可用，可打开原笔记查看。','photo-error'));return img;
}
function selectCard(n){selectedId=n.id;for(const [id,c] of cards)c.classList.toggle('selected',id===n.id);}
function openEdit(n){
 current=n;$('#editTitle').textContent=n.title+(n.candidate_locations?.length&&!n.locations.length?'（候选分店，请先核对）':'');$('#append').checked=false;
 const p=n.locations[0]||n.candidate_locations?.[0]||{};$('#hints').replaceChildren();
 for(const hint of n.place_hints||[]){const b=text('button',hint);b.type='button';b.onclick=()=>{$('#geoquery').value=hint;};$('#hints').append(b);}
 $('#geoquery').value=n.place_hints?.[0]||p.name||'';$('#georesults').replaceChildren();$('#place').value=p.name||'';$('#lat').value=p.lat??'';$('#lng').value=p.lng??'';$('#edit').showModal();
}
function makePopup(n,p){
 const popup=text('div','','place-popup');const nav=link('打开导航 ↗','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.lat+','+p.lng));nav.className='navigate-link';popup.append(nav);
 const gallery=photosForPoint(n,p);
 if(gallery.images.length){const figure=text('figure','','point-figure');figure.append(photo(gallery.images[0],'popup-photo',gallery.images,p.name+' · '+gallery.caption),text('figcaption',gallery.caption+' · '+gallery.images.length+' 张，点击查看','point-photo-caption'));popup.append(figure);}
 else if(p.photo_unavailable)popup.append(text('p',gallery.caption,'point-photo-caption'));
 popup.append(text('strong',p.name),text('p',n.title));if(p.address)popup.append(text('p',p.address));
 if(p.branch_choice){const choice=p.branch_choice,alternative=p.selection_kind==='recommended-alternative';popup.append(text('p',(alternative?'推荐替代 · ':choice.label+' · ')+`距文锦站约 ${choice.distance_km} km（直线）`,'branch-choice'+(alternative?' alternative':'')));}
 if(foodLabel(p))popup.append(text('p',foodLabel(p),'popup-food'));
 if(p.precision)popup.append(text('p','定位精度：'+({poi:'商户地图参考点','address-estimate':'按地址估算，店门待核',building:'建筑参考点',area:'区域参考点',street:'街道参考点',intersection:'路口参考点',trailhead:'步道入口',exact:'地点'}[p.precision]||p.precision),'popup-precision'));
 if(p.precision_detail)popup.append(text('p',p.precision_detail,'popup-precision'));
 if(p.status_note)popup.append(text('p',p.status_note,'venue-status'));if(p.evidence)popup.append(text('p',p.evidence));if(p.source)popup.append(text('p',p.source));
 for(const [url,label] of [[p.status_source_url,'营运状态来源'],[p.gpx_url,'官方路线 GPX（第1段）'],[p.source_url,'核对来源'],...((p.additional_source_urls||[]).map(u=>[u,'补充来源']))])if(safeUrl(url))popup.append(link(label,url));
 return popup;
}
function showMapPoint(n,p,m){selectCard(n);if(matchMedia('(max-width:820px)').matches||ui.id==='gallery')setMobileMap(true);basemap.ensureExtent([p]);map.setView([p.lat,p.lng],16,{animate:false});if(!layer.hasLayer(m))m.addTo(layer);m.openPopup();}
function addDetails(n,card,points,pointMarkers){
 const details=text('details','','card-details');details.append(text('summary','收藏详情'));
 details.addEventListener('toggle',()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';const body=text('div','','detail-content');
 const albumBatch=coverage?.album_sync_pending,verifiedBatch=verifiedAlbumBatch(albumBatch);
 const currentAlbum=verifiedCurrentAlbum(n);
 if(verifiedBatch?.has(n.id))body.append(text('p','✓ 小红书专辑：'+albumBatch.album+' · 已移入并核验','album-note'));
 else if(currentAlbum)body.append(text('p','✓ 小红书专辑：'+currentAlbum.album+' · 已归档并核验（'+new Date(currentAlbum.verified_at).toLocaleString('zh-CN')+'）','album-note'));
 else if(n.album_sync?.status==='verified')body.append(text('p','小红书专辑历史记录：'+n.album_sync.album+' · 此前已核验','album-note'));
    if(n.food_groups?.length){body.append(text('p','吃喝分类：'+foodLabel(n),'food-detail'));if(n.food_groups.includes('菜系')&&!n.food_cuisines.length)body.append(text('p','具体菜系待细分。'));}
 for(const message of [...new Set(points.map(p=>p.status_note).filter(Boolean))])body.append(text('p',message,'venue-status'));
 if(points.length){const list=text('div','','point-list');points.forEach((p,i)=>{const b=text('button',p.name);b.onclick=()=>showMapPoint(n,p,pointMarkers[i]);list.append(b);});body.append(list);}
 for(const p of points.filter(p=>p.branch_choice)){const choice=p.branch_choice;body.append(text('p',`${p.name} · ${p.selection_kind==='recommended-alternative'?'推荐替代':choice.label} · 距文锦站约 ${choice.distance_km} km（直线）`,'branch-choice'+(p.selection_kind==='recommended-alternative'?' alternative':'')));}
 if(n.location_review_reason)body.append(text('p','地点核对：'+n.location_review_reason));
 for(const [i,url] of (n.location_review_sources||[]).entries())if(safeUrl(url)){const a=link('地址核对来源 '+(i+1),url);a.className='review-source';body.append(a);}
 if(n.place_hints?.length)body.append(text('p','地点线索：'+n.place_hints.slice(0,4).join(' / ')));
 for(const p of n.locations.filter(p=>p.nearest_branch_selection)){const v=p.nearest_branch_selection;body.append(text('p',v.status==='origin-coordinate-pending-no-ranking'?`连锁已核地点参考：${p.name}。比较起点已更改，坐标待核；旧距离已撤下，最近分店未定。`:`连锁已核地点参考：${p.name}。候选覆盖待核，最近分店未定。`));}
 for(const p of (n.candidate_locations||[]).slice(0,8))body.append(text('p',(n.locations.some(p=>p.branch_choice)?'检索候选（已按文锦站选店）：':n.location_review_status==='address-confirmed'?'已核对地址（坐标待确认）：':'候选地址（尚未落点）：')+(p.name?p.name+' / ':'')+p.address));
 if(n.images?.length>1){const gallery=text('details','','gallery');gallery.append(text('summary',`原笔记照片（${n.images.length} 张）`));const grid=text('div','','photo-grid');for(const src of n.images)if(safePhoto(src))grid.append(photo(src,'note-photo',n.images,n.title));gallery.append(grid);body.append(gallery);}
 if(n.photo_total>0)body.append(text('p',`已保存 ${n.photo_saved||0} / ${n.photo_total} 张${n.photo_complete?' · 图组完整':''}`));
 for(const [label,content] of [['查看正文',n.content],['图片文字（自动识别，待核对）',n.image_text]])if(content){const d=text('details','');d.append(text('summary',label),text('p',content));body.append(d);}
 const row=text('div','','management-row'),select=document.createElement('select');select.setAttribute('aria-label','分类：'+n.title);select.append(...categoryNames.map(c=>new Option(c,c)));select.value=n.category;
 select.onchange=()=>{n.category_manual=select.value;n.category=select.value;n.category_basis='手动分类';n.category_edited_at=new Date().toISOString();Object.assign(n,classifyFood(n));persist();render();};row.append(select);
 const edit=text('button',n.locations.length?'调整地点':'补充地点');edit.onclick=()=>openEdit(n);row.append(edit,link('地图搜索','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(n.locations[0]?.name||n.title)));body.append(row,text('p','手动调整仅保存在当前浏览器，不会自动同步到其他设备或小红书。'));
 details.append(body);});card.append(details);
}
function render(){
 layer.clearLayers();allMarkers=[];cards.clear();const q=$('#search').value.trim().toLowerCase(),scoped=regionNotes(),cat=$('#category').value,counts=new Map();
 for(const n of scoped.filter(n=>themeFilter==='all'||browseGroupFor(n.category)===themeFilter))counts.set(n.category,(counts.get(n.category)||0)+1);
 $('#category').replaceChildren(new Option('全部分类','all'),...categoryNames.filter(c=>counts.has(c)).map(c=>new Option(c+' · '+counts.get(c),c)));$('#category').value=counts.has(cat)?cat:'all';
 renderCategoryNavigation(scoped);
 const base=scoped.filter(n=>(themeFilter==='all'||browseGroupFor(n.category)===themeFilter)&&($('#category').value==='all'||n.category===$('#category').value)&&JSON.stringify([n.title,n.content,n.locations,n.food_groups,n.food_cuisines]).toLowerCase().includes(q));
 for(const button of document.querySelectorAll('[data-food]')){const group=button.dataset.food,count=group==='all'?base.length:base.filter(n=>foodMatches(n,group)).length,active=group===foodFilter;button.querySelector('small').textContent=count;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(group==='all'?'全部收藏':group)+'，'+count+' 条');}
 document.querySelector('.food-filters').hidden=!['all','food'].includes(themeFilter);
 $('#cuisineField').hidden=foodFilter!=='菜系';$('#foodHint').hidden=foodFilter==='all';
 const cuisineCounts=new Map();for(const n of base.filter(n=>foodMatches(n,'菜系')))for(const cuisine of n.food_cuisines||[])cuisineCounts.set(cuisine,(cuisineCounts.get(cuisine)||0)+1);
 const unspecified=base.filter(n=>foodMatches(n,'菜系','unspecified')).length;if(unspecified)cuisineCounts.set('unspecified',unspecified);
 if(cuisineFilter!=='all'&&!cuisineCounts.has(cuisineFilter))cuisineFilter='all';
 $('#cuisine').replaceChildren(new Option('全部菜系','all'),...cuisineNames.filter(c=>cuisineCounts.has(c)).map(c=>new Option(c+' · '+cuisineCounts.get(c),c)),...(unspecified?[new Option('菜系待细分 · '+unspecified,'unspecified')]:[]));$('#cuisine').value=cuisineFilter;
 const matched=base.filter(n=>foodMatches(n,foodFilter,cuisineFilter));
 const visible=matched.filter(n=>filter==='all'||(filter==='located'?selectedPoints(n).length:!selectedPoints(n).length));
 visible.sort((a,b)=>{const score=n=>(citiesFor(n).some(c=>c==='香港'||c==='深圳')?10:0)+(selectedPoints(n).length?4:0)+(n.cover_image?1:0);return score(b)-score(a);});
 const located=matched.filter(n=>selectedPoints(n).length).length,pointCount=visible.reduce((s,n)=>s+selectedPoints(n).length,0);
 $('#stats').textContent=`${matched.length} 条相关收藏 / ${located} 条已定位 / ${matched.length-located} 条待识别或确认`;
 $('#scopeCount').textContent=scoped.length+' 条收藏';$('#allCount').textContent=matched.length;$('#locatedCount').textContent=located;$('#pendingCount').textContent=matched.length-located;
 $('#resultCount').textContent='显示 '+visible.length+' 条收藏';$('#clearSearch').hidden=!q;
 $('#empty').hidden=pointCount>0;$('#regionSummary').textContent='未上图按收藏条数计，不代表店铺数量；合集可能仅完成部分地点。';
 $('#mapTitle').textContent=selectedRegion()==='all'?'全部收藏地图':selectedRegion()==='hksz'?'港深收藏地图':selectedRegion()==='gba'?'大湾区收藏地图':selectedRegion()+'收藏地图';
 $('#mapCount').textContent=(foodFilter==='all'?'':(cuisineFilter==='all'?foodFilter:cuisineFilter==='unspecified'?'菜系待细分':cuisineFilter)+' · ')+pointCount+' 个地点在当前结果中';
 const list=$('#list');list.replaceChildren();const cardContainer=ui.id==='gallery'?text('div','','gallery-grid'):list;if(cardContainer!==list)list.append(cardContainer);
 for(const n of visible){
  const points=selectedPoints(n),card=text('article','','card');card.classList.toggle('selected',selectedId===n.id);cards.set(n.id,card);
  const pointMarkers=points.map(p=>{const marker=L.marker([p.lat,p.lng],{icon:pointIcon(n),title:p.name,noteId:n.id}).bindPopup(makePopup(n,p),{maxWidth:290,autoPanPaddingTopLeft:[15,105],autoPanPaddingBottomRight:[15,110]});allMarkers.push(marker);marker.on('click',()=>{selectCard(n);card.scrollIntoView({block:'nearest'});});return marker;});
  const summary=text('div','','card-summary'),cover=text('div','','cover-wrap'),images=n.images||[];
  if(safePhoto(n.cover_image)){cover.append(photo(n.cover_image,'note-photo',images.length?images:[n.cover_image],n.title));if(images.length)cover.append(text('span','▧ '+images.length,'photo-badge'));}else cover.append(text('div','暂无配图','note-photo photo-error'));
  const info=text('div','','card-info'),labels=text('div','','card-labels'),label=text('span',n.category,'card-category');label.title=foodLabel(n)||n.category;labels.append(label);if(n.food_groups.length)labels.append(text('span',n.food_groups.join(' / '),'card-food-label'));info.append(labels,text('h3',n.title));
  if(n.food_cuisines.length&&!(n.food_cuisines.length===1&&n.food_cuisines[0]===n.category)){const cuisines=text('p',n.food_cuisines.slice(0,3).join(' · ')+(n.food_cuisines.length>3?' +'+(n.food_cuisines.length-3):''),'card-cuisines');cuisines.title=n.food_cuisines.join(' · ');info.append(cuisines);}
  const reviewLabels={'address-confirmed':'地址已核对 · 坐标待确认','needs-branch':'已识别店名 · 分店待确认','needs-address':'门址待确认','outside-hksz':'目的地在港深以外'};
  const hasOtherPoints=!points.length&&pointsForRegion(n,selectedRegion()).length;
  const status=points.length?`${n.location_review==='partial'?'部分已定位':'已定位'} · ${points.length} 个地点`:hasOtherPoints?'本类地点待确认':reviewLabels[n.location_review_status]|| (n.body_status==='empty'?'原笔记未提供正文':n.detail_error&&!n.content?'正文待核对':n.place_hints?.length?'已有地点线索 · 待确认':'地点待识别');
  info.append(text('span',status,'status '+(points.length?'located':'')));
  const address=hasOtherPoints?'这份合集已确认其他地点，当前分类的门店仍待核对。':points[0]?.address||points[0]?.name||n.candidate_locations?.[0]?.address||n.place_hints?.[0]||n.location_review_reason||(n.image_text?'已提取图片文字，等待核对地址。':'查看照片或正文，寻找地点线索。');info.append(text('p',address,'card-address'));
  const actions=text('div','','quick-actions'),go=text('button',points.length?'查看地图':hasOtherPoints?'收藏详情':'补充地点','map-action');go.onclick=()=>points.length?showMapPoint(n,points[0],pointMarkers[0]):hasOtherPoints?card.querySelector('.card-details').open=true:openEdit(n);actions.append(go);if(safeUrl(n.url))actions.append(link('原笔记 ↗',n.url));info.append(actions);summary.append(cover,info);card.append(summary);
  addDetails(n,card,points,pointMarkers);cardContainer.append(card);
 }
 if(!visible.length){const empty=text('div','','empty-list');empty.append(text('strong',notes.length?'没有找到这组收藏':'先导入你的收藏'),text('p',notes.length?'试试其他关键词，或重置筛选。':'在「整理进度」里导入收藏文件。'));$('#list').append(empty);}
 let discoveryKind='eat',discoveryTopic='all';
 const activeCategory=$('#category').value;
 if(foodFilter==='饮品'||['咖啡馆','茶饮饮品','酒吧酒饮'].includes(activeCategory)){discoveryKind='drink';discoveryTopic=activeCategory==='咖啡馆'?'coffee':activeCategory==='酒吧酒饮'?'bar':'all';}
 else if(themeFilter==='travel'||activeCategory==='艺术看展'){discoveryKind='play';discoveryTopic=activeCategory==='艺术看展'?'museum':'all';}
 else if(themeFilter==='photo'||['拍照机位','机位与拍照'].includes(activeCategory)){discoveryKind='relax';discoveryTopic='photo-spots';}
 else if(foodFilter==='甜品')discoveryTopic='desserts';else if(foodFilter==='小吃')discoveryTopic='noodles';else if(cuisineNames.includes(cuisineFilter))discoveryTopic='cuisine-'+cuisineFilter;else if(cuisineNames.includes(activeCategory))discoveryTopic='cuisine-'+activeCategory;
 $('#discoverLink').href='discover.html?'+new URLSearchParams({ui:ui.id,look:'focus',kind:discoveryKind,topic:discoveryTopic,region:selectedRegion()});
 refreshMarkers();renderProgress();
}

function resetFilters(){
 $('#search').value='';$('#category').value='all';themeFilter='all';filter='all';foodFilter='all';cuisineFilter='all';
 document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter==='all';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});render();fit();
}
$('#resetFilters').onclick=resetFilters;
$('#showAll').onclick=resetFilters;
$('#clearSearch').onclick=()=>{$('#search').value='';render();fit();$('#search').focus();};
 document.querySelectorAll('[data-food]').forEach(button=>button.onclick=()=>{foodFilter=button.dataset.food;cuisineFilter='all';render();fit();});
 $('#cuisine').onchange=()=>{cuisineFilter=$('#cuisine').value;render();fit();};
$('#file').onchange=async e=>{try{const incoming=normalize(JSON.parse(await e.target.files[0].text()));const all=new Map(notes.map(n=>[n.id,n]));for(const n of incoming){const old=all.get(n.id);all.set(n.id,{...old,...n,candidate_locations:n.candidate_locations||[],...mergeCategoryReview(old,n),content:n.content||old?.content||'',place_hints:n.place_hints||old?.place_hints||[],locations:n.locations.length?n.locations:old?.locations||[]});}notes=normalize([...all.values()]);persist();render();fit();}catch(err){alert('导入失败：'+err.message);}e.target.value='';};
$('#category').onchange=()=>{render();fit();};$('#region').onchange=()=>{render();fit();};let searchDelay;$('#search').oninput=()=>{clearTimeout(searchDelay);searchDelay=setTimeout(render,160);};document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();fit();});
$('#save').onclick=e=>{if(!$('#edit form').reportValidity())return;const lat=Number($('#lat').value),lng=Number($('#lng').value);if(lat===0&&lng===0){e.preventDefault();alert('请确认坐标，不能使用 0,0 占位值。');return;}const point={name:$('#place').value,lat,lng,coordinateSystem:'WGS84',source:'手动确认'};current.location_edited=true;current.locations=$('#append').checked?[...current.locations,point]:[point,...current.locations.slice(1)];persist();render();map.setView([lat,lng],15);};
$('#fit').onclick=fit;$('#export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(notes,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='xhs-map-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};render();fit();

let lastGeosearch=0;
$('#geosearch').onclick=async()=>{
 const q=$('#geoquery').value.trim();if(!q)return;
 const out=$('#georesults'),button=$('#geosearch');
 if(Date.now()-lastGeosearch<1500){out.textContent='请稍后再查询。';return;}
 lastGeosearch=Date.now();button.disabled=true;out.textContent='正在查找地点…';
 try{
 const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q='+encodeURIComponent(q),{signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('地点服务暂不可用（'+res.status+'）');
 const results=await res.json();out.replaceChildren();
 for(const p of results){const row=text('div','','candidate');row.append(text('p',p.display_name));const b=text('button','使用这个地点');b.type='button';b.onclick=()=>{$('#place').value=p.name||p.display_name.split(',')[0];$('#lat').value=p.lat;$('#lng').value=p.lon;out.textContent='已填写候选坐标，请确认后保存。';};row.append(b);out.append(row);}
 if(!results.length)out.textContent='没有找到。尝试当地语言店名、完整地址，或手动填写坐标。';
 }catch(e){out.textContent=e.message+'。可使用列表中的地图搜索或手动填坐标。';}finally{button.disabled=false;}
};
let lastRevision=null;
async function syncFavorites(){
if(document.querySelector('dialog[open]'))return;
try{
 const res=await fetch(favoritesEndpoint);if(res.ok){const revision=res.headers.get('ETag');if(revision&&revision===lastRevision)return;const firstSync=lastRevision===null;lastRevision=revision;const payload=await res.json();coverage=payload.coverage||null;const incoming=normalize(payload);const all=new Map(notes.map(n=>[n.id,n]));for(const n of incoming){const old=all.get(n.id);all.set(n.id,{...old,...n,candidate_locations:n.candidate_locations||[],...mergeCategoryReview(old,n),content:n.content||old?.content||'',place_hints:n.place_hints||old?.place_hints||[],locations:(old?.location_edited||old?.locations?.some(p=>p.source==='手动确认'))?old.locations:(n.locations.length?n.locations:old?.locations||[])});}notes=normalize([...all.values()]);persist();const scroll=$('#list').scrollTop;render();$('#list').scrollTop=scroll;if(firstSync)fit();}else throw Error('本地服务暂不可用');
}catch{$('#progressLabel').textContent=hosted?'云端数据 · 暂未连接':'本地数据 · 暂未连接';}
}
if(location.hash==='#map'||(ui.id==='atlas'&&matchMedia('(max-width:820px)').matches&&location.hash!=='#list'))setMobileMap(true);
await syncFavorites();setInterval(syncFavorites,45000);
const linkedId=pageParams.get('post');
if(/^[a-f0-9]{24}$/.test(linkedId||'')){
 const n=notes.find(n=>n.id===linkedId),card=cards.get(linkedId);
 if(n&&card){
  const points=selectedPoints(n),point=points.find(p=>p.name===pageParams.get('place'))||points[0];
  if(point&&location.hash==='#map'){const marker=allMarkers.find(m=>m.options.noteId===n.id&&m.options.title===point.name&&Math.abs(m.getLatLng().lat-point.lat)<1e-8&&Math.abs(m.getLatLng().lng-point.lng)<1e-8);if(marker)showMapPoint(n,point,marker);}
  else{setMobileMap(false);selectCard(n);card.querySelector('.card-details').open=true;}
  card.scrollIntoView({block:'start'});
 }
}
