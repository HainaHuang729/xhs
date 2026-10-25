import {categoryTheme} from './categories.js';

// Navigation folders only. They never replace a note's reviewed classification.
export const browseGroups=[
 {id:'food',name:'吃喝与下厨',short:'吃喝',symbol:'◒',description:'餐厅、咖啡、甜品和食谱',themes:['吃喝探店','咖啡甜品','酒吧饮品','美食']},
 {id:'travel',name:'旅行与户外',short:'出门',symbol:'⌁',description:'城市、路线与自然',themes:['旅行','日本旅行','西藏旅行','新疆路线','住宿温泉','户外自然','海滨城市','香港生活']},
 {id:'photo',name:'摄影与拍照',short:'摄影',symbol:'▣',description:'作品、机位、器材与写真',themes:['机位与拍照']},
 {id:'culture',name:'艺术与文娱',short:'文艺',symbol:'✳',description:'看展、设计、影视与阅读',themes:['艺术看展','影视书影音']},
 {id:'life',name:'生活与好物',short:'生活',symbol:'⌂',description:'猫咪、家居、植物与日常',themes:['猫咪宠物','植物园艺','家居生活','穿搭美妆','购物器物']},
 {id:'knowledge',name:'知识与工具',short:'知识',symbol:'⌘',description:'AI、编程、科研与金融',themes:['AI编程','量化金融','学习工作']},
 {id:'games',name:'游戏与棋牌',short:'游戏',symbol:'♧',description:'游戏、桌游与棋牌',themes:['游戏']},
 {id:'feelings',name:'情绪与关系',short:'心情',symbol:'♡',description:'文字、思考、关系与表情包',themes:['情绪文字','恋爱关系','人生思考']},
 {id:'other',name:'其他收藏',short:'其他',symbol:'◇',description:'尚未收进上述主题的内容',themes:['待分类']}
];
export function browseGroupFor(category){
 if(category==='动物世界')return 'life';
 const theme=categoryTheme(category);
 return browseGroups.find(g=>g.themes.includes(theme))?.id||'other';
}
export function groupedCategories(notes){
 return browseGroups.map(group=>{
  const counts=new Map();for(const note of notes)if(browseGroupFor(note.category)===group.id)counts.set(note.category,(counts.get(note.category)||0)+1);
  return {...group,count:[...counts.values()].reduce((s,n)=>s+n,0),categories:[...counts].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))};
 });
}
