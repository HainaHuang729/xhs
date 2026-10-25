export const discoveryLayouts=[
 {id:'list',name:'清爽清单',description:'小图配短文，一眼看完几个去处。',limit:3},
 {id:'focus',name:'单卡漫游',description:'一次只看一篇，左右切换慢慢选。',limit:1},
 {id:'gallery',name:'轻量画册',description:'先看照片，点开再看帖子和地点。',limit:6}
];
export function discoveryLayout(search=''){return discoveryLayouts.find(l=>l.id===new URLSearchParams(search).get('look'))||discoveryLayouts.find(l=>l.id==='focus');}
