import {categoryTheme} from './categories.js';
// Food tags are separate from the existing Xiaohongshu album themes.
export const foodGroups = ['菜系', '甜品', '小吃', '饮品'];
export const cuisineNames = ['粤菜', '潮汕菜', '客家菜', '川渝菜', '湘菜', '湖北菜', '江浙菜', '东北菜', '西北菜', '新疆菜', '台湾菜', '海南菜', '闽菜', '广西菜', '赣菜', '京鲁菜', '云南菜', '日料', '韩餐', '东南亚菜', '西餐', '融合菜', '素食'];
export const foodTaxonomyVersion = 2;

const cuisineRules = [
 ['粤菜', /粤菜|粵菜|广东菜|廣東菜|顺德菜|順德菜|茶餐厅|茶餐廳|烧鹅|燒鵝|烧腊|燒臘|桑拿鸡|桑拿雞|啫啫煲|猪肚鸡|豬肚雞/],
 ['潮汕菜', /潮汕菜|潮州菜|潮菜|潮汕大排档|潮汕大排檔|潮汕牛肉|潮汕卤水|潮汕滷水|潮州饭店|潮州飯店|潮汕菜馆|潮汕菜館|潮州菜馆|潮州菜館/],
 ['客家菜', /客家菜|客家土菜|客家酿|客家釀|盐焗鸡|鹽焗雞|五华鱼生|五華魚生/],
 ['川渝菜', /川菜|四川菜|重庆菜|重慶菜|川渝|川味|重庆火锅|重慶火鍋|二郎田鸡|高三姐|豆花饭|豆花飯/],
 ['湘菜', /湘菜|湖南菜|湖南味|湘椒|湘辣辣|小炒黄牛肉|小炒黃牛肉/],
 ['湖北菜', /湖北菜|湖北口味|湖北小吃|湖北特色小吃|鄂菜/],
 ['江浙菜', /江浙|浙江菜|浙菜|台州菜|宁波菜|寧波菜|上海菜|本帮菜|本幫菜|杭帮菜|杭幫菜|淮扬菜|淮揚菜|宁家十职|寧家十職/],
 ['东北菜', /东北菜|東北菜|东北人|東北人|锅包肉|鍋包肉|地三鲜|地三鮮/],
 ['西北菜', /兰州|蘭州|山西刀削面|山西刀削麵|手抓羊肉|宁夏招待所|寧夏招待所|西北菜|陕菜|陝菜/],
 ['新疆菜', /新疆菜|新疆抓饭|新疆抓飯|手抓饭|手抓飯|疆山好|疆宴/],
 ['台湾菜', /台湾菜|台灣菜|台湾小馆|台灣小館|台味|台式小吃|卤肉饭|滷肉飯|麻吉士林|阿豚台湾|阿豚台灣/],
 ['海南菜', /海南菜|东山羊|東山羊|海南鸡|海南雞|椰子鸡|椰子雞/],
 ['闽菜', /闽菜|閩菜|福建菜|闽南菜|閩南菜/],
 ['广西菜', /广西菜|廣西菜|广西米粉|廣西米粉|螺蛳粉|螺螄粉|螺狮粉|老友粉/],
 ['赣菜', /赣菜|贛菜|江西菜|欧记大排档|歐記大排檔/],
 ['京鲁菜', /北京菜|京菜|鲁菜|魯菜|北京烤鸭|北京烤鴨|京炙坊/],
 ['云南菜', /云南菜|雲南菜|滇菜|云南野生菌|雲南野生菌/],
 ['日料', /日料|日本菜|日本料理|日式(?:料理|居酒屋|烧肉|燒肉|餐酒|拉面|拉麵)|居酒屋|寿司|壽司|刺身|三文鱼|三文魚|丼|鳗鱼饭|鰻魚飯|汤咖喱|湯咖喱|LE.TA.SU|ICHIRAKU|Hollow Curry|空洞造咖|Doraya/i],
 ['韩餐', /韩餐|韓餐|韩料|韓料|韩国菜|韓國菜|韩式烤肉|韓式烤肉|土豆脊骨汤|土豆脊骨湯|东洞|東洞/],
 ['东南亚菜', /泰国菜|泰國菜|泰菜|越南菜|印尼菜|马来西亚菜|馬來西亞菜|马来菜|馬來菜|新加坡菜|冬阴功|冬陰功|打抛饭|打拋飯|Chôm Chôm|Kin Kao|莎巴/i],
 ['西餐', /西餐|西式餐|意大利(?:菜|餐|人)|意式(?:菜|餐)|法餐|法国菜|法國菜|西班牙(?:菜|餐)|墨西哥|希腊菜|希臘菜|牛排|意面|意麵|千层面|千層麵|披萨|披薩|汉堡|漢堡|brunch|pizza|pasta|steak|bistro|Pici|Fiata|Fuego|Panos|La Vache|La Paloma|Pica Pica|11 Westside|Artemis.*Apollo|gaga|Galleria|llasagnee|安迪西餐|喜喜里|La Boca|Bocado/i],
 ['素食', /素食餐|素食店|素食料理|全素餐|庆春朴门|慶春樸門/],
 ['融合菜', /融合创意菜|融合創意菜|融合料理|中西融合|元古雲境/],
];
const groupRules = [
 ['甜品', /甜品|甜点|甜點|蛋糕|布丁|巴斯克|提拉米苏|提拉米蘇|糖水|甜汤|甜湯|豆花(?!饭|飯)|豆腐花|雪糕|冰淇淋|刨冰|绵绵冰|綿綿冰|泡芙|蛋挞|蛋撻|玉米挞|玉米撻|面包|麵包|饼店|餅店|烘焙|贝果|貝果|可颂|可頌|松饼|鬆餅|舒芙蕾|西多士|奶冻|奶凍|清补凉|清補涼|bakery|pudding|dessert|cake|bread|Happy Roller|Albee|Hana|VALERIE|OUUR|偶屋|Silver Spoon|银勺|銀勺|珍藏坊|崎本|BB['’]s Studio/i],
 ['小吃', /小吃|点心|點心|街头|街頭|路边摊|路邊攤|烧烤|燒烤|烤串|烤鸡翅|烤雞翅|牛杂|牛雜|肠粉|腸粉|螺蛳粉|螺螄粉|螺狮粉|米粉|米线|米線|粿条|粿條|拉面|拉麵|乌冬|烏冬|拌面|拌麵|刀削面|刀削麵|担担面|擔擔麵|担仔面|擔仔麵|碗面|碗麵|汤粉|湯粉|汤包|湯包|小笼|小籠|饺子|餃子|云吞|雲吞|馄饨|餛飩|煎包|生煎|烧饼|燒餅|锅盔|鍋盔|馒头|饅頭|炸串|臭豆腐|炸鸡|炸雞|蚵仔煎|肉圆|肉圓|萝卜糕|蘿蔔糕|三明治|恰巴塔|早茶|肉丸|凤爪|鳳爪|沙县|沙縣|合益泰|三多面食|三多麵食|孖仔|强记|強記|佰味/],
 ['饮品', /咖啡|coffee|café|cafe|饮品|飲品|奶茶|茶饮|茶飲|茶馆|茶館|奶盖|奶蓋|豆浆|豆漿|果汁|柠檬茶|檸檬茶|凉茶|涼茶|牛乳茶|焙茶牛乳|抹茶拿铁|抹茶拿鐵|热巧克力|熱巧克力|酒吧|酒室|酒馆|酒館|鸡尾酒|雞尾酒|调酒|調酒|威士忌|cocktail|whisky|\bbar\b|MIXY|Monson|MORSE|Just Americano|Coucou|BLLB|Ideaology|山承|Infinity Room|Jrink|1点点|一点点|1點點/i],
];
const mainMeals = /餐厅|餐廳|餐馆|餐館|饭店|飯店|饭庄|飯莊|酒楼|酒樓|食堂|私房菜|小馆|小館|大排档|大排檔|晚餐|午餐|正餐|碗饭|碗飯|煲仔饭|煲仔飯|咖喱饭|咖喱飯|烤肉|烧肉|燒肉|火锅|火鍋|羊肉煲|鸡煲|雞煲|炒牛筋|海鲜|海鮮|鱼生|魚生|烧鸡|燒雞|小炒|漂亮饭|漂亮飯|荣记农庄|榮記農莊|海鲜炭烤|海鮮炭烤/;
const nonFood = /猫咪|貓咪|猫粮|貓糧|狗粮|狗糧|宠物|寵物|偷吃|吃饭姿势|拍照姿势|拍照姿勢|滤镜教程|濾鏡教程|食物摄影教程|量化|论文|論文|科研|编程|編程|代码|代碼/;
const collection = /合集|图鉴|圖鑑|盘点|盤點|清单|清單|名单|名單|榜|地图|地圖|整理|几家|幾家|(?:[2-9]|[1-9]\d|[二三四五六七八九十两兩])\d*.{0,2}[家间間碗]|三部曲|top\s*(?:[2-9]|[1-9]\d)|第[一二三四五六七八九十百\d]+[弹期篇]/i;
const genericPoint = /^(?:香港|深圳|广州|廣州|万象天地|深圳湾万象城|深圳灣萬象城|壹方天地|华侨城创意|華僑城創意|笔架山|筆架山|深港花卉|艺展中心|藝展中心|澳康达|澳康達|元创方|元創方|富德楼|富德樓|大梅沙|小梅沙|背仔角)/;
const ordered = (values, order) => order.filter(v => values.includes(v));
const textFor = n => [n.title, n.content, n.image_text].filter(Boolean).join('\n');
// These labels only exist after an explicit theme review. Use them to fill gaps
// such as a stylized "Cafe" title; never replace a reviewed tag or cuisine.
const reviewedGroupDefaults = {
 '咖啡馆':'饮品', '茶饮饮品':'饮品', '酒吧酒饮':'饮品',
 '甜品烘焙':'甜品', '小吃面食':'小吃'
};
const reviewedCuisineDefaults = {
 '西餐':'西餐', '粤菜茶餐厅':'粤菜', '江浙菜':'江浙菜', '台湾菜':'台湾菜',
 '日料':'日料', '韩餐':'韩餐', '东南亚菜':'东南亚菜', '东北菜':'东北菜',
 '海南菜':'海南菜', '客家菜':'客家菜', '潮汕菜':'潮汕菜', '闽菜':'闽菜',
 '新疆菜':'新疆菜', '融合创意菜':'融合菜'
};

function tagsFromText(value) {
 const cuisines = cuisineRules.filter(([, re]) => re.test(value)).map(([name]) => name);
 const groups = groupRules.filter(([, re]) => re.test(value)).map(([name]) => name);
 if (mainMeals.test(value) || cuisines.length) groups.unshift('菜系');
 return {groups: ordered(groups, foodGroups), cuisines};
}

export function classifyFood(note) {
 const title = String(note.title || '');
 const theme=categoryTheme(note.category);
 const eligible = !nonFood.test(title) && (['吃喝探店', '咖啡甜品', '酒吧饮品', '美食'].includes(theme) || (note.locations || []).some(p => tagsFromText(String(p.name || '')).groups.length));
 let own = eligible ? tagsFromText(textFor(note)) : {groups: [], cuisines: []};
 const manualGroups=Array.isArray(note.food_groups_manual),manualCuisines=Array.isArray(note.food_cuisines_manual);
 const reviewedGroup=reviewedGroupDefaults[note.category],reviewedCuisine=reviewedCuisineDefaults[note.category];
 if(eligible&&!manualGroups&&!own.groups.length&&reviewedGroup)own.groups=[reviewedGroup];
 if(eligible&&!manualGroups&&!manualCuisines&&!own.cuisines.length&&cuisineNames.includes(reviewedCuisine)){
  own.groups=ordered([...own.groups,'菜系'],foodGroups);own.cuisines=[reviewedCuisine];
 }
 if (Array.isArray(note.food_groups_manual)) own.groups = ordered(note.food_groups_manual, foodGroups);
 if (Array.isArray(note.food_cuisines_manual)) own.cuisines = ordered(note.food_cuisines_manual, cuisineNames);
 // A general food post can be known to concern meals without asserting a regional cuisine.
 if (eligible && !manualGroups && !own.groups.length && theme === '吃喝探店') own.groups = ['菜系'];
 const locations = (note.locations || []).map(point => {
  let tags = tagsFromText(String(point.name || ''));
  const singleVenue = note.locations.length === 1 && !collection.test(title.normalize('NFKC'));
  if (singleVenue && eligible && (!genericPoint.test(point.name) || /店名待确认|原笔记所在商场/.test(point.name))) {
   if (!tags.groups.length || Array.isArray(note.food_groups_manual)) tags = {...own};
   else tags.groups = ordered([...tags.groups, ...own.groups], foodGroups);
   if (tags.groups.includes('菜系') && !tags.cuisines.length && own.cuisines.length === 1) tags.cuisines = own.cuisines;
  }
  if (Array.isArray(note.food_groups_manual) && own.groups.length === 1 && tags.groups.length && !genericPoint.test(point.name)) tags.groups = [...own.groups];
  if (Array.isArray(point.food_groups_manual)) tags.groups = ordered(point.food_groups_manual, foodGroups);
  if (Array.isArray(point.food_cuisines_manual)) tags.cuisines = ordered(point.food_cuisines_manual, cuisineNames);
  return {...point, food_groups: tags.groups, food_cuisines: tags.cuisines,
   food_classification_basis: point.food_classification_note || (tags.groups.length ? '地点名称及单店收藏线索' : '地点类型线索不足'), food_taxonomy_version: foodTaxonomyVersion};
 });
 const groups = Array.isArray(note.food_groups_manual) ? own.groups : ordered([...own.groups, ...locations.flatMap(p => p.food_groups)], foodGroups);
 const cuisines = Array.isArray(note.food_cuisines_manual) ? own.cuisines : ordered([...own.cuisines, ...locations.flatMap(p => p.food_cuisines)], cuisineNames);
 return {...note, locations, food_groups: groups, food_cuisines: cuisines,
  food_classification_basis: note.food_classification_note || (groups.length ? '标题、正文、图片文字及地点名称线索' : '未识别为吃喝收藏'), food_taxonomy_version: foodTaxonomyVersion};
}

export function foodMatches(item, group = 'all', cuisine = 'all') {
 const cuisines=item.food_cuisines||[];
 return (group === 'all' || (item.food_groups || []).includes(group)) && (cuisine === 'all' || (cuisine === 'unspecified' ? !cuisines.length : cuisines.includes(cuisine)));
}

export function foodLabel(item) {
 return [...(item.food_groups || []), ...(item.food_cuisines || [])].join(' · ');
}
