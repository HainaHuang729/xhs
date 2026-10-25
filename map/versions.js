import {uiVariants,selectedVariant} from './interface.js';
import {normalize,regionMatches,safePhoto} from './model.js';
let active=selectedVariant(location.search),device='phone';
const $=s=>document.querySelector(s),frame=$('#livePreview');
function resizePreview(){
 const width=device==='phone'?390:1280,height=device==='phone'?800:820;
 const available=$('#previewOuter').clientWidth-(innerWidth<=700?24:36),scale=Math.min(1,available/width);
 Object.assign(frame.style,{width:width+'px',height:height+'px',transform:`scale(${scale})`});
 Object.assign($('#previewStage').style,{width:width*scale+'px',height:height*scale+'px'});
}
function showVariant(variant){
 active=variant;
 for(const button of document.querySelectorAll('[data-version]'))button.setAttribute('aria-pressed',String(button.dataset.version===active.id));
 $('#previewTitle').textContent=active.name;$('#previewDescription').textContent=active.description;
 const url='./?ui='+active.id;$('#openVersion').href=url;frame.title=active.name+'交互预览';
 if(new URL(frame.src).searchParams.get('ui')!==active.id)frame.src=url+'&preview=1';
 history.replaceState(null,'','?ui='+active.id);resizePreview();
}
for(const button of document.querySelectorAll('[data-version]'))button.onclick=()=>showVariant(uiVariants.find(v=>v.id===button.dataset.version));
for(const button of document.querySelectorAll('[data-device]'))button.onclick=()=>{device=button.dataset.device;for(const b of document.querySelectorAll('[data-device]'))b.setAttribute('aria-pressed',String(b===button));resizePreview();};
new ResizeObserver(resizePreview).observe($('#previewOuter'));showVariant(active);
try{
 const res=await fetch('/api/favorites');if(!res.ok)throw Error('no local favorites');const data=await res.json();
 const photos=normalize(data).filter(n=>regionMatches(n,'hksz')&&/咖啡|甜品|布丁|蛋糕|冰淇淋/.test(n.title)).map(n=>safePhoto(n.cover_image)).filter(src=>src.startsWith('/media/')).slice(0,8);
 for(const img of document.querySelectorAll('[data-sample]'))if(photos.length)img.src=photos[Number(img.dataset.sample)%photos.length];
}catch{/* The complete interactive preview still provides its own connection state. */}
