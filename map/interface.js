export const uiVariants=[
 {id:'atlas',name:'海湾漫游',title:'从收藏，走进城市。',shortTitle:'下一站，去哪？',description:'地图在身边，边看位置边选下一站。',color:'#345e87'},
 {id:'shelves',name:'收藏书架',title:'喜欢的东西，都有位置。',shortTitle:'打开你的收藏',description:'先按主题找到收藏，再慢慢展开。',color:'#286451'},
 {id:'gallery',name:'灵感画册',title:'想去的地方，先看一眼。',shortTitle:'翻翻你的喜欢',description:'用原帖照片，翻一翻你的收藏。',color:'#765074'}
];
export function selectedVariant(search=''){
 const id=new URLSearchParams(search).get('ui');return uiVariants.find(v=>v.id===id)||uiVariants[0];
}
export function setupInterface(){
 const active=selectedVariant(location.search);document.body.dataset.ui=active.id;
 document.title=active.name+' · 收藏去处';
 const mobile=matchMedia('(max-width:820px)'),headline=()=>document.querySelector('#browseTitle').textContent=mobile.matches?active.shortTitle:active.title;
 mobile.addEventListener('change',headline);headline();
 document.querySelector('#browseDescription').textContent=active.description;
 document.querySelector('.brand').href='./?ui='+active.id;
 document.querySelector('#versionCompare').href='versions.html?ui='+active.id;
 const nav=document.querySelector('#variantLinks');
 for(const variant of uiVariants){const a=document.createElement('a');a.href='?ui='+variant.id;a.textContent=variant.name;if(variant.id===active.id)a.setAttribute('aria-current','page');nav.append(a);}
 return active;
}
