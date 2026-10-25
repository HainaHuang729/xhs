import assert from 'node:assert/strict';
import {normalize} from '../map/model.js';
import {discoveryDomains,discoveryFacets,discoveryEligible,matchesDiscovery,matchingDiscoveryPoints,recommendDiscovery} from '../map/discovery.js';
const source={rows:[
 {id:'cafe',title:'深圳咖啡店 Combo',category_manual:'咖啡茶饮',content:'单店咖啡介绍与交通。'.repeat(20),url:'https://example.com/cafe',locations:[{name:'甲咖啡店',address:'深圳',lat:22.55,lng:114.1,food_groups:['饮品']}]},
 {id:'museum',title:'深圳看展 博物馆',category_manual:'艺术看展',content:'展期已经结束',url:'https://example.com/museum'},
 {id:'avoid',title:'深圳餐厅踩雷',url:'https://example.com/avoid'},
],discovery_reviews:{museum:{past:'原帖展期已结束'},avoid:{avoid:true},cafe:{reason:'本地复核说明'}}};
const original=JSON.stringify(source),notes=normalize(source),before=JSON.stringify(notes);
assert.equal(new Set(discoveryFacets.map(f=>f.id)).size,discoveryFacets.length);
for(const domain of discoveryDomains){
 const result=recommendDiscovery(notes,domain.id);
 assert.equal(new Set(result.map(r=>r.note.id)).size,result.length);
 assert(result.every(r=>notes.includes(r.note)&&discoveryEligible(r.note)));
 for(let i=1;i<result.length;i++)assert(result[i-1].score>=result[i].score);
 for(const item of result)for(const point of item.points)assert(item.note.locations.includes(point));
}
assert.equal(discoveryEligible(notes.find(n=>n.id==='avoid')),false);
assert.equal(recommendDiscovery(notes,'drink','coffee')[0].reason,'本地复核说明');
const past=recommendDiscovery(notes,'play','museum').find(r=>r.note.id==='museum');assert(past?.past&&!past.canFeature);
for(const category of ['下厨与食谱','烘焙甜品配方','调酒饮品配方']){
 const recipe={id:'recipe',category,title:'深圳咖啡火锅蛋糕制作',content:'',locations:[],food_groups:['甜品','饮品'],food_cuisines:['粤菜'],url:'https://example.com/post'};
 assert(discoveryDomains.every(d=>!matchesDiscovery(recipe,d.id)));
}
const decor={category:'家居生活',title:'在家装修咖啡角',locations:[],url:'https://example.com/post'};assert.equal(matchesDiscovery(decor,'drink','coffee'),false);
const valid={category:'餐厅合集',title:'深圳咖啡和正餐合集',content:'咖啡店推荐',url:'https://example.com/post',locations:[{name:'甲咖啡店',lat:22.55,lng:114.1,address:'深圳',food_groups:['饮品']},{name:'乙饭店',lat:22.56,lng:114.11,address:'深圳',food_groups:['菜系']}]};
assert.deepEqual(matchingDiscoveryPoints(valid,'drink','coffee','hksz').map(p=>p.name),['甲咖啡店']);
assert.equal(matchingDiscoveryPoints({...valid,locations:[{...valid.locations[0],name:'甲咖啡店（暂停营业）'}]},'drink','coffee','hksz').length,0);
assert.equal(discoveryEligible({...valid,url:'javascript:alert(1)'}),false);
assert.equal(matchesDiscovery({category:'拍照机位',title:'建筑摄影',content:'深圳湾文化广场\n#深圳看展[话题]#',locations:[],url:'https://example.com/post'},'play','museum'),false);
assert.equal(matchesDiscovery({category:'艺术看展',title:'剧场里的艺术展',content:'装置艺术',locations:[],url:'https://example.com/post'},'relax','shows'),false);
const flavor={category:'甜品烘焙',title:'咖啡味冰淇淋',content:'醇香的一口',locations:[],food_groups:['甜品'],url:'https://example.com/post'};assert.equal(matchesDiscovery(flavor,'drink','coffee'),false);
assert.equal(JSON.stringify(notes),before);assert.equal(JSON.stringify(source),original);
console.log(`吃喝玩乐推荐检查通过：${discoveryFacets.length}种细分、原帖唯一、地点匹配、往期活动、私有审核覆盖与数据不变性（使用合成样本）。`);
