import {categoryTheme} from './categories.js';
import {cuisineNames} from './food-categories.js';
import {pointsForRegion,safeUrl,safePhoto} from './model.js';

export const discoveryDomains=[
 {id:'eat',name:'吃',description:'菜系、正餐与甜品',symbol:'◒'},
 {id:'drink',name:'喝',description:'咖啡、茶饮与酒吧',symbol:'◡'},
 {id:'play',name:'玩',description:'城市漫步与户外',symbol:'⌁'},
 {id:'relax',name:'乐',description:'打卡、体验与放松',symbol:'✳'}
];
const foodThemes=['吃喝探店','咖啡甜品','酒吧饮品','美食'];
const recipes=new Set(['下厨与食谱','烘焙甜品配方','调酒饮品配方','食材采买']);
const outingCategories=new Set(['旅行','日本旅行','西藏旅行','新疆路线','户外自然','艺术看展','拍照机位','机位与拍照','香港生活','植物园艺','住宿温泉']);
const evidenceCache=new WeakMap(),mainCache=new WeakMap();
const bodyText=n=>String(n.content||'').replace(/#[^#]*#/g,'');
const evidenceText=n=>{if(!evidenceCache.has(n))evidenceCache.set(n,[n.title,bodyText(n),n.image_text,...(n.locations||[]).map(p=>p.name)].filter(Boolean).join('\n'));return evidenceCache.get(n);};
const mainText=n=>{if(!mainCache.has(n))mainCache.set(n,[n.title,...(n.locations||[]).map(p=>p.name)].filter(Boolean).join('\n'));return mainCache.get(n);};
const foodNote=n=>!recipes.has(n.category)&&(foodThemes.includes(categoryTheme(n.category))||(n.locations||[]).some(p=>p.food_groups?.length));
const outingNote=n=>outingCategories.has(n.category);
const contains=(n,re)=>re.test(evidenceText(n));
const hasGroup=(n,group)=>foodNote(n)&&(n.food_groups||[]).includes(group);
const pointText=p=>[p.name,p.food_classification_note].filter(Boolean).join(' ');
const isRecipe=n=>recipes.has(n.category);
const c=(id,label,domain,family,matches,pointMatches,focused)=>({id,label,domain,family,matches,pointMatches,focused});

const dessert=/糖水|冰淇淋|雪糕|刨冰|绵绵冰|綿綿冰|牛奶冰|清补凉|清補涼|gelato/i;
const cakes=/蛋糕|布丁|巴斯克|提拉米苏|提拉米蘇|舒芙蕾|瑞士卷|cake|pudding/i;
const bakery=/面包|麵包|烘焙|可颂|可頌|贝果|貝果|吐司|bakery|bread/i;
const coffee=/咖啡|coffee|café|cafe|拿铁|拿鐵|冷萃/i;
const coffeeVenue=/咖啡[馆館店厅廳屋铺舖]|咖啡探店|咖啡日记|coffee|café|cafe|combo/i;
const tea=/奶茶|茶饮|茶飲|茶馆|茶館|茶室|柠檬茶|檸檬茶|果茶|牛乳茶/;
const bar=/酒吧|酒馆|酒館|酒室|鸡尾酒|雞尾酒|威士忌|cocktail|whisky|\bbar\b/i;
const traditional=/豆浆|豆漿|凉茶|涼茶|酸梅汤|酸梅湯|甘蔗汁/;
const hotpot=/火锅|火鍋|烧肉|燒肉|烧烤|燒烤|烤串|羊肉煲|鸡煲|雞煲/;
const brunch=/早茶|点心|點心|肠粉|腸粉|烧卖|燒賣|凤爪|鳳爪/;

export const discoveryFacets=[
 ...cuisineNames.map(name=>c('cuisine-'+name,name,'eat','按菜系',n=>foodNote(n)&&(n.food_cuisines||[]).includes(name),p=>(p.food_cuisines||[]).includes(name),n=>n.category===name||(name==='粤菜'&&n.category==='粤菜茶餐厅'))),
 c('restaurants','餐厅与美食清单','eat','按口味',n=>foodNote(n)&&(categoryTheme(n.category)==='吃喝探店'||hasGroup(n,'菜系')),p=>p.food_groups?.includes('菜系'),n=>n.category==='餐厅探店'),
 c('hotpot','火锅与烧烤','eat','按口味',n=>foodNote(n)&&contains(n,hotpot),p=>hotpot.test(pointText(p)),n=>hotpot.test(mainText(n))),
 c('noodles','面食与街边小吃','eat','按口味',n=>hasGroup(n,'小吃'),p=>p.food_groups?.includes('小吃'),n=>n.category==='小吃面食'),
 c('dim-sum','早茶与点心','eat','按口味',n=>foodNote(n)&&contains(n,brunch),p=>brunch.test(pointText(p)),n=>brunch.test(n.title)),
 c('desserts','甜品与烘焙','eat','按口味',n=>hasGroup(n,'甜品'),p=>p.food_groups?.includes('甜品'),n=>n.category==='甜品烘焙'),
 c('cake','蛋糕与布丁','eat','甜品细分',n=>foodNote(n)&&contains(n,cakes),p=>cakes.test(pointText(p)),n=>cakes.test(n.title)),
 c('sweet-soup','糖水与冰品','eat','甜品细分',n=>foodNote(n)&&contains(n,dessert),p=>dessert.test(pointText(p)),n=>dessert.test(n.title)),
 c('bakery','面包与烘焙','eat','甜品细分',n=>foodNote(n)&&contains(n,bakery),p=>bakery.test(pointText(p)),n=>bakery.test(n.title)),
 c('coffee','咖啡馆','drink','喝点什么',n=>foodNote(n)&&(n.category==='咖啡馆'||(n.locations||[]).some(p=>coffee.test(pointText(p)))||coffeeVenue.test(bodyText(n))||(coffee.test(n.title)&&!/咖啡味|咖啡口味|拿铁味|咖啡冰淇淋/.test(n.title))),p=>coffee.test(pointText(p)),n=>n.category==='咖啡馆'),
 c('tea','奶茶与茶饮','drink','喝点什么',n=>foodNote(n)&&contains(n,tea),p=>tea.test(pointText(p)),n=>tea.test(n.title)),
 c('bar','酒吧与酒饮','drink','喝点什么',n=>foodNote(n)&&(n.category==='酒吧酒饮'||contains(n,bar)),p=>bar.test(pointText(p)),n=>n.category==='酒吧酒饮'),
 c('traditional-drinks','豆浆与传统饮品','drink','喝点什么',n=>foodNote(n)&&contains(n,traditional),p=>traditional.test(pointText(p)),n=>traditional.test(n.title)),
 c('citywalk','城市漫步','play','逛一逛',n=>outingNote(n)&&contains(n,/citywalk|漫步|散步|散策|扫街|掃街|一日游|半日游/i),null,n=>/citywalk|漫步|散步|散策|扫街|掃街/i.test(n.title)),
 c('museum','看展与博物馆','play','逛一逛',n=>n.category==='艺术看展'||(outingNote(n)&&contains(n,/博物馆|博物館|美术馆|美術館|看展/)),(p,n)=>/博物馆|博物館|艺术馆|藝術館|画廊|美术馆|大馆|M\+|H Queen/i.test(pointText(p))||n.category==='艺术看展',n=>n.category==='艺术看展'),
 c('hiking','徒步与绿道','play','走到户外',n=>outingNote(n)&&contains(n,/徒步|绿道|綠道|碧道|登山|行山|爬山|长徒步径/),(p,n)=>p.precision==='trailhead'||/山顶|山頂|徒步|径|徑|绿道|碧道|齊天亭|齐天亭/.test(p.name),n=>/徒步|绿道|綠道|碧道|行山/.test(n.title)),
 c('seaside','看海与日落','play','走到户外',n=>outingNote(n)&&contains(n,/海边|海邊|海滨|海濱|沙滩|沙灘|海岸|日落|晚霞|维港|維港|观山海/),p=>/海|沙滩|沙灘|港/.test(p.name),n=>/海边|海邊|海滨|海濱|日落|晚霞/.test(n.title)),
 c('parks','公园与自然观察','play','走到户外',n=>outingNote(n)&&contains(n,/公园|公園|园博园|植物园|园林|观鸟|觀鳥|白鹭|白鷺/),p=>/公园|公園|园林|园博|鸟|鳥|花卉/.test(p.name),n=>/公园|公園|园博园|观鸟|觀鳥|白鹭/.test(n.title)),
 c('cycling','骑行与水上活动','play','走到户外',n=>outingNote(n)&&contains(n,/骑行|騎行|自行车|皮划艇|皮劃艇|浮潜|浮潛|冲浪|衝浪|SUP\b/i),null,n=>/骑行|騎行|皮划艇|浮潜|冲浪/.test(n.title)),
 c('photo-spots','拍照与打卡机位','relax','找点乐趣',n=>['拍照机位','机位与拍照'].includes(n.category),null,n=>n.category==='拍照机位'),
 c('shops','书店、花市与逛店','relax','找点乐趣',n=>(outingNote(n)||['购物器物','穿搭美妆'].includes(n.category))&&contains(n,/书店|書店|市集|花市|花卉中心|古着|古著|创意园|創意園|文创|文創|小店/),p=>/书店|書店|花卉|花园|花園|花与陶|植物|文创|市集/.test(p.name),n=>/小店|市集|花市|书店|書店/.test(n.title)),
 c('escape','密室与线下游戏','relax','找点乐趣',n=>['游戏','桌游棋牌','旅行'].includes(n.category)&&contains(n,/密室|剧本杀|劇本殺|桌游店|桌游吧|桌遊店/),null,n=>/密室|剧本杀|劇本殺/.test(n.title)),
 c('shows','演出与影展','relax','找点乐趣',n=>n.category==='舞台演出'||(['音乐播客','影视综艺','旅行'].includes(n.category)&&contains(n,/演出|剧场|劇場|音乐会|音樂會|影展|演唱会|演唱會|重映/))||(n.category==='艺术看展'&&contains(n,/演出|音乐会|音樂會|影展|演唱会|演唱會/)),null,n=>/演出|影展|演唱会|重映/.test(n.title)),
 c('spa','温泉与小度假','relax','慢慢放松',n=>['住宿温泉','旅行'].includes(n.category)&&contains(n,/温泉|溫泉|私汤|私湯|度假|SPA\b/i),null,n=>/温泉|溫泉|私汤|私湯/.test(n.title)),
 c('workshops','手作与周末体验','relax','慢慢放松',n=>['旅行','手工DIY','香港生活'].includes(n.category)&&contains(n,/手作店|手作体验|手作體驗|陶艺店|工作坊|体验课|窑烤披萨|手工粘土|陶艺体验|陶藝體驗/),null,n=>/手作|体验|體驗|春游/.test(n.title))
];

export function discoveryEligible(note){
 return !isRecipe(note)&&!note.discovery_review?.avoid&&note.location_review_status!=='excluded'&&note.recommendation_status!=='avoid'&&Boolean(safeUrl(note.url));
}
export function matchesDiscovery(note,domain,facetId='all'){
 if(!discoveryEligible(note))return false;
 const facets=discoveryFacets.filter(f=>f.domain===domain);
 if(facetId==='all')return facets.some(f=>f.matches(note));
 return facets.find(f=>f.id===facetId)?.matches(note)||false;
}
export function discoveryCounts(notes,domain){const order=['按口味','甜品细分','按菜系'];return discoveryFacets.filter(f=>f.domain===domain).map(f=>({...f,count:notes.filter(n=>discoveryEligible(n)&&f.matches(n)).length})).sort((a,b)=>{if(domain!=='eat')return 0;return order.indexOf(a.family)-order.indexOf(b.family);});}
export function matchingDiscoveryPoints(note,domain,facetId='all',region='hksz'){
 const facets=discoveryFacets.filter(f=>f.domain===domain&&(facetId==='all'||f.id===facetId)&&f.matches(note));
 const single=(note.locations||[]).length===1&&!/合集|图鉴|圖鑑|盘点|清单|名单|汇总|幾家|几家|\d+家/.test(note.title);
 return pointsForRegion(note,region).filter(p=>!(/暂停营业|停業|停业|已关闭|歇业|装修中/.test(p.name)||['closed','temporarily-closed'].includes(p.business_status))).filter(p=>facets.some(f=>f.pointMatches?f.pointMatches(p,note)||(single&&f.focused?.(note)):true));
}
const question=n=>/求推荐|求推薦|求香港美食|推荐一下|推薦一下|有人一起|有人能/.test(n.title)||/^坐标深圳.*没啥名气/.test(n.title);
export function discoveryRecommendation(note,domain,facetId='all',region='hksz'){
 const facets=discoveryFacets.filter(f=>f.domain===domain&&(facetId==='all'||f.id===facetId)&&f.matches(note));
 const points=matchingDiscoveryPoints(note,domain,facetId,region),review=note.discovery_review||{},isQuestion=question(note)&&!points.length;
 const focused=facets.some(f=>f.focused?.(note));
 const hasPhoto=Boolean(safePhoto(note.cover_image)),body=String(note.content||'').replace(/#[^#]+#/g,'').trim();
 const score=(points.length?40:0)+(focused?18:0)+(review.reason?7:0)+(hasPhoto?5:0)+(body.length>150?6:body.length>40?3:0)+(points.length===1?4:0)-(isQuestion?60:0)-(review.past?120:0)-(review.schedule?90:0);
 let reason=review.reason|| (points.length?(['eat','drink'].includes(domain)?'对应地点已核实，原帖可直接对照店名与照片。':'原帖中的场所或路线已有可对照的地图位置。'):body.length>80?'原帖有具体内容或路线线索，适合继续查看。':'先看原帖照片和说明，地点仍待核实。');
 if(facetId!=='all'&&!focused&&!review.reason)reason='合集或相关原帖中有“'+facets[0]?.label+'”线索，可按需挑选。';
 if(review.past)reason=review.past;
 if(review.schedule)reason=review.schedule;
 if(isQuestion&&!review.past&&!review.schedule)reason='这是一篇提问帖，具体推荐可能在评论中。';
 return {note,points,score,reason,past:review.past||'',schedule:review.schedule||'',question:isQuestion,facets:facets.map(f=>f.label),primaryFacet:facets.find(f=>f.focused?.(note))?.id||facets[0]?.id,canFeature:!review.past&&!review.schedule&&!isQuestion};
}
export function recommendDiscovery(notes,domain,facetId='all',region='hksz'){
 return notes.filter(n=>matchesDiscovery(n,domain,facetId)).map(n=>discoveryRecommendation(n,domain,facetId,region)).sort((a,b)=>b.score-a.score||a.note.id.localeCompare(b.note.id));
}
