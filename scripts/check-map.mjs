import assert from 'node:assert/strict';
import {normalize,safeUrl} from '../map/model.js';
assert.equal(normalize({rows:[{note_id:'x',title:'餐厅',poi:{lat:22,lng:114}}]})[0].locations.length,1);
for(const point of [{lat:'',lng:''},{lat:91,lng:114},{lat:22,lng:181},{lat:0,lng:0},{lat:'bad',lng:114},{lat:22,lng:114,coordinateSystem:'GCJ02'}]){
 assert.equal(normalize([{locations:[point]}])[0].locations.length,0);
}
assert.equal(normalize([{locations:[{lat:'22',lng:'114'},{lat:23,lng:115}]}])[0].locations.length,2);
assert.equal(safeUrl('javascript:alert(1)'),'');
assert.equal(safeUrl('data:text/html,test'),'');
assert.equal(safeUrl('https://www.xiaohongshu.com/explore/test'),'https://www.xiaohongshu.com/explore/test');
assert.equal(normalize({results:[{body:'正文',source_title:'标题'}]})[0].content,'正文');
assert.throws(()=>normalize({oops:[]}));
console.log('地图导入、坐标边界、多地点与链接检查通过');
const {extractHints}=await import('../map/model.js');
assert.deepEqual(extractHints({content:'📍南山区\n▫️Fuego（华侨城店）\n青旅名称：Y hotel\n📍本焕学院'}),['Fuego','Y hotel','本焕学院']);
const {citiesFor,regionMatches,pointsForRegion,safePhoto}=await import('../map/model.js');
const {photosForPoint}=await import('../map/model.js');
const galleryNote={images:['/media/000000000000000000000001/0.webp','/media/000000000000000000000001/8.webp'],cover_image:'/media/000000000000000000000001/0.webp'};
assert.deepEqual(photosForPoint(galleryNote,{photo_images:[galleryNote.images[1]],photo_caption:'原帖配图'}),{images:[galleryNote.images[1]],caption:'原帖配图'});
assert.deepEqual(photosForPoint(galleryNote,{photo_index:1}).images,[galleryNote.images[1]],'Legacy point image indexes must select that venue');
assert.deepEqual(photosForPoint(galleryNote,{photo_images:['/media/000000000000000000000002/0.webp','https://malicious.example/p.webp']}).images,galleryNote.images,'Other notes and external images cannot enter a point gallery');
assert.deepEqual(citiesFor({title:'深圳福田与香港中环的披萨'}),['香港','深圳']);
assert.equal(regionMatches({title:'广州看展'},'hksz'),false);
assert.equal(regionMatches({title:'广州看展'},'gba'),true);
assert.equal(regionMatches({title:'京都住宿'},'gba'),false);
assert.equal(pointsForRegion({locations:[{lat:26,lng:127,name:'酒店',address:'日本'}]},'gba').length,0);
assert.equal(pointsForRegion({locations:[{lat:22.28,lng:114.15,name:'餐厅',address:'香港中环'}]},'深圳').length,0);
assert.equal(safePhoto('/media/000000000000000000000002/0.webp'),'/media/000000000000000000000002/0.webp');
assert.equal(safePhoto('/media/../../private'),'');
assert.equal(safePhoto('https://malicious.example/photo.png'),'');

// Meal collections must not be filed as academic work merely because they mention CUHK.
const categorized=normalize([{title:'CUHK校外食堂沙田篇'},{title:'🇭🇰 量化研究导师计划'},{title:'深圳看展 莫奈'},{title:'语义不足 xyz'},{title:'深圳咖啡',category_manual:'学习工作'}]);
assert.equal(categorized[0].category,'吃喝探店');assert.equal(categorized[1].category,'量化金融');assert.equal(categorized[2].category,'艺术看展');assert.equal(categorized[3].category,'待分类');assert.equal(categorized[4].category,'学习工作');

// Human review overrides noisy OCR/itinerary hints, including an explicitly empty list.
assert.deepEqual(extractHints({content:"📍周五：去机场",place_hints:["去机场"],place_hints_reviewed:[]}),[]);
assert.deepEqual(extractHints({place_hints:["宣传语"],place_hints_reviewed:["园岭新村88栋108-2"]}),["园岭新村88栋108-2"]);

// Food filters must select individual venues in a mixed collection, not every point in it.
const {foodPointsForRegion}=await import('../map/model.js');
const mixed=normalize([{title:'深圳三家小店合集：蛋糕、咖啡和粤菜',locations:[
 {name:'Hana Bakery',address:'深圳',lat:22.57,lng:113.95},
 {name:'山与咖啡',address:'深圳',lat:22.56,lng:114.09},
 {name:'粤菜餐厅',address:'深圳',lat:22.55,lng:114.08},
 {name:'公园',address:'深圳',lat:22.54,lng:114.07},
]}])[0];
assert.deepEqual(foodPointsForRegion(mixed,'hksz','甜品').map(p=>p.name),['Hana Bakery']);
assert.deepEqual(foodPointsForRegion(mixed,'hksz','饮品').map(p=>p.name),['山与咖啡']);
assert.deepEqual(foodPointsForRegion(mixed,'hksz','菜系','粤菜').map(p=>p.name),['粤菜餐厅']);
assert.equal(foodPointsForRegion(mixed,'hksz').length,4);
const partialList=normalize([{title:'深圳米其林平价榜入选名单',content:'大唐靓汤、蛋糕和糖水',locations:[{name:'大唐靓汤',address:'深圳',lat:22.5,lng:114}]}])[0];
assert.equal(foodPointsForRegion(partialList,'hksz','甜品').length,0,'A partially located list must not assign all dessert tags to its only known restaurant');
const takeout=normalize([{title:'罗湖外卖第十弹',category:'吃喝探店',content:'粤菜、日料、西餐和咖啡',locations:[{name:'1点点',address:'深圳',lat:22.5,lng:114.1}]}])[0];
assert.deepEqual(takeout.locations[0].food_groups,['饮品'],'A takeout collection must not copy every note tag onto its only drink shop');
const splitCuisines=normalize([{title:'港深两家店合集',category:'吃喝探店',food_groups_manual:['菜系'],food_cuisines_manual:['粤菜','日料'],locations:[
 {name:'粤菜小馆',address:'深圳',lat:22.55,lng:114.05,food_groups_manual:['菜系'],food_cuisines_manual:['粤菜']},
 {name:'日料居酒屋',address:'香港',lat:22.28,lng:114.15,food_groups_manual:['菜系'],food_cuisines_manual:['日料']},
]}])[0];
assert.deepEqual(foodPointsForRegion(splitCuisines,'hksz','菜系','粤菜').map(p=>p.name),['粤菜小馆']);
assert.deepEqual(foodPointsForRegion(splitCuisines,'hksz','菜系','日料').map(p=>p.name),['日料居酒屋']);
assert.equal(foodPointsForRegion(splitCuisines,'hksz','菜系','unspecified').length,0);

// Reviewed intent wins over shop-name wording and incidental comparisons.
const reviewedDessert=normalize([{title:'深圳最想念的4间甜品',food_groups_manual:['甜品'],food_cuisines_manual:[],locations:[{name:'SorSod咖啡&食堂',address:'深圳',lat:22.5,lng:114}]}])[0];
assert.deepEqual(reviewedDessert.food_groups,['甜品']);
assert.equal(foodPointsForRegion(reviewedDessert,'hksz','甜品').length,1);
assert.equal(foodPointsForRegion(reviewedDessert,'hksz','菜系').length,0);
assert.deepEqual(normalize([{title:'猫咪又在偷吃了',content:'好吃'}])[0].food_groups,[]);
assert.deepEqual(normalize([{title:'深圳咖啡店',locations:[{name:'咖啡店',address:'四川大厦',lat:22.5,lng:114}]}])[0].food_cuisines,[]);
const {foodMatches}=await import('../map/food-categories.js');
assert.equal(foodMatches({food_groups:['菜系'],food_cuisines:[]},'菜系','unspecified'),true);
assert.equal(foodMatches({food_groups:['菜系'],food_cuisines:['粤菜']},'菜系','unspecified'),false);
assert.deepEqual(normalize([{title:'湖北小吃对比',category:'吃喝探店',content:'湖北口味，豆皮、热干面和藕汤'}])[0].food_cuisines,['湖北菜']);
const chaozhou=normalize([{title:'香港打冷合集',category:'吃喝探店',locations:[{name:'金兴潮州饭店',address:'香港',lat:22.28,lng:114.14}]}])[0];
assert.deepEqual(chaozhou.locations[0].food_cuisines,['潮汕菜'],'潮州饭店 should be recognized as 潮汕菜');
console.log('吃喝分类、人工复核优先及合集逐地点筛选检查通过');
