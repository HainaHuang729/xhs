import {classifyNote} from './categories.js';
import {classifyFood,foodMatches} from './food-categories.js';
import {isAllowedLocation} from './location-policy.js';
// New readings are kept beside the immutable export. Materialize them for display
// while avoiding a second copy of every body and image URL in browser storage.
export function materializeOriginalPost(row){
 const post=row.original_post;
 if(post?.status!=='read'||post.id!==String(row.id||row.note_id||''))return row;
 const local=new Map((post.cached_images||[]).filter(p=>Number.isInteger(p.index)&&safePhoto(p.path).startsWith('/media/'+post.id+'/')).map(p=>[p.index,p.path]));
 const remote=Array.isArray(post.images)?post.images.filter(safePhoto):[];
 const hasGallery=Array.isArray(row.images)&&row.images.length>0;
 const images=hasGallery?row.images:remote.map((src,i)=>local.get(i)||src);
 const {content:body,images:unusedImages,cached_images:unusedCache,...metadata}=post;
 return {...row,original_post:metadata,content:row.content||row.body||body||'',images,
  cover_image:hasGallery?row.cover_image||images[0]:images[0]||row.cover_image,
  photo_saved:hasGallery?row.photo_saved:local.size,
  photo_total:hasGallery?row.photo_total:remote.length,
  photo_complete:hasGallery?row.photo_complete:remote.length>0&&local.size===remote.length,
  photo_checked_at:row.photo_checked_at||post.read_at,detail_checked_at:row.detail_checked_at||post.read_at,
  body_status:row.body_status||(body?'loaded':'empty')};
}
export const storageRows=notes=>notes.map(({category_review_history,detail_diagnostic,image_diagnostic,...note})=>note);
export function normalize(data){
 const rows=Array.isArray(data)?data:data.rows||data.notes||data.items||data.results;
 if(!Array.isArray(rows))throw Error('文件应为收藏数组，或包含 rows / notes / items / results 数组。');
 const reviews=Array.isArray(data)?{}:data.discovery_reviews||{};
 return rows.map((source,i)=>{
 const original=materializeOriginalPost(source),review=reviews[String(original.id||original.note_id||'')];
 const r=review?{...original,discovery_review:review}:original;
 const points=Array.isArray(r.locations)?r.locations:[r.location||r.poi||r.poi_info||r];
 const locations=points.map(p=>{const lat=p.lat??p.latitude,lng=p.lng??p.lon??p.longitude;return {...p,lat:lat==null||lat===''?NaN:Number(lat),lng:lng==null||lng===''?NaN:Number(lng),name:String(p.name||p.poi_name||p.address||'收藏地点')};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180&&!(p.lat===0&&p.lng===0)&&(!p.coordinateSystem||p.coordinateSystem==='WGS84')&&isAllowedLocation(p));
 return classifyFood({...r,...classifyNote(r),id:String(r.id||r.note_id||r.url||r.clean_url||r.title||i),title:String(r.title||r.source_title||'无标题收藏'),content:String(r.content||r.body||''),place_hints:extractHints(r),url:String(r.url||r.url_with_page_token||r.clean_url||''),locations});
 });
}
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}

export function extractHints(note){
 if(Array.isArray(note.place_hints_reviewed))return [...new Set(note.place_hints_reviewed.map(String).map(x=>x.trim()).filter(Boolean))].slice(0,30);
 const found=[...(Array.isArray(note.place_hints)?note.place_hints:[])];
 for(const line of (String(note.content||note.body||'')+'\n'+String(note.image_text||'')).split('\n')){
  const match=line.trim().match(/^(?:📍|▫️|📌|(?:青旅名称|酒店名称|店名|地址)[：:])\s*(.+)$/u);
  if(!match)continue;
  const name=match[1].split(/[（(]/)[0].replace(/\s+价格.*$/,'').trim();
  if(name.length>=3&&name.length<=100&&!/^[东西南北中]?城区$|^.{1,3}区$|^香港🇭🇰$/.test(name))found.push(name);
 }
 for(const line of String(note.image_text||'').split('\n')){const l=line.trim();const numbered=l.match(/^\d+[.、]\s*(.{3,40}?)[（(]人均/);if(numbered)found.push(numbered[1]);if(l.length<=80&&/(?:路|街|道|巷)[一二三四五六七八九十\d\-–]+(?:号|號)/.test(l))found.push(l);}
 return [...new Set(found.map(String).map(x=>x.trim()).filter(Boolean))].slice(0,30);
}

const CITY_RULES=[
 ['香港',/香港|🇭🇰|港島|港岛|九龍|九龙|新界|沙田|大埔|大围|大圍|西贡|西貢|铜锣湾|銅鑼灣|元朗|中環|中环|尖沙咀|CUHK|港中文/i],
 ['深圳',/深圳|深港|港深|福田|罗湖|羅湖|宝安|寶安|龙华|龍華|盐田|鹽田|蛇口|华侨城|華僑城|南山区|坪山|光明区|大鹏|大鵬/i],
 ['广州',/广州|廣州|番禺|增城|从化|從化|天河|荔湾|荔灣/],['澳门',/澳门|澳門|🇲🇴|氹仔|路環|路环/],
 ['珠海',/珠海|横琴|橫琴|拱北/],['佛山',/佛山|顺德|順德|禅城|禪城/],['东莞',/东莞|東莞|松山湖/],
 ['惠州',/惠州|惠阳|惠陽|巽寮|双月湾|雙月灣/],['中山',/中山市|中山[！!｜|]|石岐|中山草莓|中山病/],['江门',/江门|江門|台山|开平|開平|新会|新會/],['肇庆',/肇庆|肇慶|鼎湖|七星岩/]
];
export function citiesFor(note){
 if(Array.isArray(note.region_review?.cities)&&note.region_review.status==='reviewed')return [...new Set(note.region_review.cities.filter(city=>CITY_RULES.some(([name])=>name===city)))];
 const title=String(note.title||''),body=String(note.content||''),address=(note.locations||[]).map(p=>p.address||'').join(' ');
 return CITY_RULES.filter(([,re])=>re.test(title+' '+body+' '+address)).map(([city])=>city);
}
export function regionMatches(note,region){
 if(region==='all')return true;
 const cities=citiesFor(note);
 if(region==='gba')return cities.length>0||/大湾区|大灣區/.test(note.title||'');
 if(region==='hksz')return cities.some(c=>c==='香港'||c==='深圳');
 return cities.includes(region);
}
export function pointsForRegion(note,region){
 const visible=note.locations.filter(p=>p.nearest_branch_selection?.display!==false&&isAllowedLocation(p));
 if(region==='all')return visible;
 // Notes can describe both GBA and overseas trips. Keep overseas points off the GBA map.
 return visible.filter(p=>{if(!(p.lat>=21.45&&p.lat<=24.4&&p.lng>=111.1&&p.lng<=115.7))return false;if(region==='gba')return true;const cities=citiesFor({title:p.name,content:p.address||''});if(region==='hksz')return cities.some(c=>c==='香港'||c==='深圳');return cities.includes(region);});
}

export function foodPointsForRegion(note,region,group='all',cuisine='all'){
 return pointsForRegion(note,region).filter(point=>foodMatches(point,group,cuisine));
}

export function safePhoto(value){
 const src=String(value||'');
 if(/^\/media\/[a-f0-9]{24}\/\d+\.webp$/.test(src))return src;
 const url=safeUrl(src);if(!url)return '';
 const parsed=new URL(url);
 return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&parsed.hostname.endsWith('.xhscdn.com')?url:'';
}

// A venue's image selection must stay inside the parent note's original gallery.
export function photosForPoint(note,point){
 if(point.photo_unavailable===true)return {images:[],caption:point.photo_caption||'本店照片待配'};
 const originals=[...new Set([...(note.images||[]),note.cover_image].map(safePhoto).filter(Boolean))];
 const allowed=new Set(originals);
 const selected=[...(Array.isArray(point.photo_images)?point.photo_images:[]),point.photo,Number.isInteger(point.photo_index)?note.images?.[point.photo_index]:null];
 const matched=[...new Set(selected.map(safePhoto).filter(src=>src&&allowed.has(src)))];
 return {images:matched.length?matched:originals,caption:point.photo_caption||'原帖配图；未单独核实所选分店实拍'};
}
