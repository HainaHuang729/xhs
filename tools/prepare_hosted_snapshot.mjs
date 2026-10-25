import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalize,regionMatches,pointsForRegion,photosForPoint} from '../map/model.js';

// Resolve original-post overlays with the same model used by the live map.
// Only cached photographs enter the standalone snapshot.
export function prepareHostedSnapshot(payload,hasPhoto){
 const notes=normalize(payload),photos=new Set();
 const rows=notes.map(note=>{
  const available=new Set([...(note.images||[]),note.cover_image].filter(src=>typeof src==='string'&&/^\/media\/[a-f0-9]{24}\/\d+\.webp$/.test(src)&&hasPhoto(src)));
  const images=[...new Set((note.images||[]).filter(src=>available.has(src)))];
  const cover=available.has(note.cover_image)?note.cover_image:images[0]||'';
  if(cover&&!images.includes(cover))images.unshift(cover);
  for(const photo of [...images,cover].filter(Boolean))photos.add(photo);
  const total=Math.max(note.photo_total||0,note.photo_total_expected||0,(note.images||[]).length,(note.remote_images||[]).length);
  const locations=note.locations.map(point=>{
   const selection=photosForPoint(note,point),selected=selection.images.filter(src=>available.has(src));
   const {photo_index,photo,...rest}=point;
   return {...rest,photo_images:selected,photo_caption:selection.caption,photo_unavailable:point.photo_unavailable===true||!selected.length};
  });
  return {...note,images,cover_image:cover,locations,photo_saved:images.length,photo_total:total,photo_complete:total>0&&images.length>=total};
 });
 const h=rows.filter(n=>regionMatches(n,'hksz'));
 return {rows,discovery_reviews:payload.discovery_reviews||{},coverage:{...payload.coverage,imported:rows.length,classified:rows.filter(n=>n.category!=='待分类').length,hksz_total:h.length,hksz_classified:h.filter(n=>n.category!=='待分类').length,hksz_located:h.filter(n=>pointsForRegion(n,'hksz').length).length,hksz_points:h.reduce((s,n)=>s+pointsForRegion(n,'hksz').length,0),photos_saved:photos.size,photo_notes:rows.filter(n=>n.images.length).length}};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
 const root=new URL('../',import.meta.url),payload=JSON.parse(fs.readFileSync(new URL('outputs/map-data.json',root),'utf8'));
 const reviews=new URL('outputs/discovery-reviews.json',root);if(fs.existsSync(reviews))payload.discovery_reviews=JSON.parse(fs.readFileSync(reviews,'utf8'));
 const snapshot=prepareHostedSnapshot(payload,photo=>fs.existsSync(new URL('outputs'+photo,root)));
 process.stdout.write(JSON.stringify(snapshot));
}
