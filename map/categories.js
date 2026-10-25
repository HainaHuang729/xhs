// Theme labels are independent of cities: Hong Kong food remains food, not general travel.
const rules = [
 ['AI编程', /claude|codex|chatgpt|python|编程|代码|程序员|大模型|人工智能|vibe.?cod|github|cursor|agent|mcp\b/i],
 ['量化金融',/量化|金融|投行|交易|股票|基金|期货|期權|期权|投资|摩根|quant|对冲/i],
 ['学习工作',/论文|科研|博士|港博|港硕|留学|求职|招聘|实习|面试|简历|导师|毕业|大学|物理|天文|宇宙|中微子|学术|学习|英语|数学|课程|工作|cuhk/i],
 ['艺术看展',/看展|展览|展覽|博物馆|美术馆|艺术馆|藝術館|画廊|莫奈|美術館|艺术漫游|art.?basel/i],
 ['户外自然',/徒步|爬山|登山|碧道|绿道|栈道|綠道|海滨|海邊|海边|露营|溯溪|骑行|行山|郊野|日落|瀑布|观鸟|觀鳥/i],
 ['咖啡甜品',/咖啡|coffee|café|cafe|布丁|蛋糕|甜品|甜点|麵包|面包|烘焙|bakery|提拉米苏|巴斯克|恰巴塔|抹茶|冰淇淋|雪糕|下午茶|贝果|可颂|吐司|舒芙蕾/i],
 ['酒吧饮品',/酒吧|鸡尾酒|調酒|调酒|威士忌|whisky|cocktail|mixy|\bbar\b|奶茶|豆浆|飲品|饮品/i],
 ['吃喝探店',/美食|餐厅|餐廳|小馆|小館|食堂|吃|好食|意面|披萨|pizza|pasta|火锅|烧烤|燒肉|烧肉|烤肉|牛肉|鸡饭|雞飯|海南鸡|餃|饺|寿司|壽司|日料|咖喱|拉面|乌冬|米其林|粤菜|粵菜|大排档|大排檔|私房菜|江浙菜|东北菜|东北|卤肉饭|烧鹅|手抓饭|海鲜|三文鱼|饭店|飯店|外卖|外賣|肠粉|螺蛳粉|冬阴功|居酒屋|早茶|小龙虾|餸|面馆|麵館|餐酒|餐吧|台味/i],
 ['住宿温泉',/酒店|民宿|青旅|旅馆|溫泉|温泉|私汤|一户建|住宿|住一晚|度假村/i],
 ['机位与拍照',/机位|拍照|摄影|濾鏡|滤镜|调色|相机|镜头|婚纱照|写真|胶片|構圖|构图/i],
 ['日本旅行',/日本|东京|東京|大阪|京都|北海道|富士|冲绳|沖繩|福冈|福岡|奈良|镰仓|鎌倉/i],
 ['西藏旅行',/西藏|拉萨|阿里|川藏|波密|藏东|喜马拉雅|318|林芝/i],
 ['新疆路线',/新疆|阿勒泰|伊犁|赛里木湖|禾木|喀纳斯|安集海/i],
 ['旅行',/旅行|旅游|旅遊|景点|景點|游玩|遊玩|一日游|一日遊|citywalk|出游|出遊|周末去哪|路线|路線|攻略|漫游|漫遊|打卡|地标建筑|签证|簽證|机票/i],
 ['猫咪宠物',/猫|貓|狗|宠物|寵物|喵|布偶/i],
 ['植物园艺',/植物|绿植|綠植|盆栽|养花|養花|园艺|園藝|多肉|月季|绣球|龟背竹|花园|花園/i],
 ['家居生活',/家居|装修|裝修|收纳|收納|房间|租房|家具|厨房|廚房|沙发|沙發|床垫|床墊|保洁|清洁/i],
 ['游戏',/游戏|遊戲|密室|steam|塞尔达|原神|switch|艾尔登|星露谷|博德|ps5|黑神话/i],
 ['穿搭美妆',/古着|古著|vintage|穿搭|口红|口紅|护肤|護膚|发型|髮型|香水|化妆|化妝|裙|发色|眼影/i],
 ['影视书影音',/电影|電影|电视剧|電視劇|书单|書單|读书|讀書|小说|小說|音乐|音樂|专辑|樂隊|乐队|演唱会|演唱會/i],
 ['恋爱关系',/恋爱|戀愛|男友|女友|前任|分手|相亲|相親|婚姻|结婚|結婚|伴侣|伴侶|亲密关系|dating/i],
 ['购物器物',/户外用品|戶外用品|杂货|雜貨|hoka|购物|購物|好物|耳机|耳機|键盘|鍵盤|鼠标|顯示器|显示器|包包|手表|手錶|网盘|網盤|淘寶|淘宝|拼多多/i],
 ['人生思考',/人生|幸福|自我|情绪|情緒|孤独|孤獨|焦虑|焦慮|成长|成長|抑郁|抑鬱|边界感/i],
 ['香港生活',/香港|港岛|港島|九龙|九龍|新界|大围|大圍|沙田|🇭🇰/]
];
// Fine-grained albums follow individually reviewed content; they add no broad keyword inference.
export const refinedCategoryParents = {
 "餐厅探店": "吃喝探店",
 "西餐": "吃喝探店",
 "酒吧酒饮": "酒吧饮品",
 "海鲜火锅": "吃喝探店",
 "下厨与食谱": "美食",
 "粤菜茶餐厅": "吃喝探店",
 "江浙菜": "吃喝探店",
 "小吃面食": "吃喝探店",
 "台湾菜": "吃喝探店",
 "餐厅合集": "吃喝探店",
 "甜品烘焙": "咖啡甜品",
 "调酒饮品配方": "美食",
 "咖啡馆": "咖啡甜品",
 "融合创意菜": "吃喝探店",
 "茶饮饮品": "酒吧饮品",
 "日料": "吃喝探店",
 "烘焙甜品配方": "美食",
 "韩餐": "吃喝探店",
 "东南亚菜": "吃喝探店",
 "东北菜": "吃喝探店",
 "海南菜": "吃喝探店",
 "食物饮料测评": "美食",
 "客家菜": "吃喝探店",
 "潮汕菜": "吃喝探店",
 "闽菜": "吃喝探店",
 "新疆菜": "吃喝探店",
 "食材采买": "美食",
 "AI工具与工作流": "AI编程",
 "AI原理与技术": "AI编程",
 "游戏开发": "AI编程",
 "摄影教程": "机位与拍照",
 "摄影作品": "机位与拍照",
 "摄影器材": "机位与拍照",
 "影视综艺": "影视书影音",
 "阅读书单": "影视书影音",
 "音乐播客": "影视书影音",
 "手工DIY": "家居生活",
 "绘画设计": "艺术看展",
 "科研学术": "学习工作",
 "拍照机位": "机位与拍照",
 "编程与开发": "AI编程",
 "软件工具": "学习工作",
 "壁纸头像": "艺术看展",
 "表情包与梗图": "情绪文字",
 "趣味搞笑": "影视书影音",
 "动漫与同人": "影视书影音",
 "Cosplay写真": "机位与拍照",
 "健康与保健": "家居生活",
 "运动健身": "户外自然",
 "动物世界": "户外自然",
 "舞台演出": "艺术看展",
 "桌游棋牌": "游戏",
 "人文纪实": "影视书影音"
};
export const categoryTheme=name=>refinedCategoryParents[name]||name;
export const categoryNames=[...new Set([...rules.map(([name])=>name),'美食','情绪文字','海滨城市',...Object.keys(refinedCategoryParents),'待分类'])];
export function classifyNote(note){
 const manual=note.category_manual;
 if(manual&&categoryNames.includes(manual))return {category:manual,category_basis:'手动分类'};
 const title=String(note.title||'');
 const food=rules.filter(([c])=>['咖啡甜品','酒吧饮品','吃喝探店'].includes(c)).find(([,re])=>re.test(title));
 const hit=food&&!/量化|论文|科研|编程/.test(title)?food:rules.find(([,re])=>re.test(title));
 if(hit&&hit[0]!=='香港生活')return {category:hit[0],category_basis:'标题线索'};
 // A few strong signals in正文 are useful; generic restaurant hashtags are not used to infer travel.
 const body=String(note.content||'').slice(0,3000);
 const bodyFood=rules.filter(([c])=>['咖啡甜品','酒吧饮品','吃喝探店'].includes(c)).find(([,re])=>re.test(body));
 const bodyHit=bodyFood||rules.slice(0,10).find(([,re])=>re.test(body))||hit;
 return {category:bodyHit?.[0]||'待分类',category_basis:bodyHit?'正文线索':'线索不足'};
}

// A newer reviewed server classification must replace a cached copy. A later
// explicit edit in this browser remains authoritative until another review.
export function mergeCategoryReview(old,incoming){
 const time=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
 const reviewed=time(incoming.category_review?.reviewed_at);
 const edited=time(old?.category_edited_at);
 const previousReview=time(old?.category_review?.reviewed_at);
 const keep=Boolean(old?.category_manual)&&(edited>reviewed||(!reviewed&&(!incoming.category_manual||edited))||previousReview>reviewed);
 const source=keep?old:incoming;
 return {category_manual:source.category_manual,category:source.category,category_basis:source.category_basis,category_review:source.category_review,category_edited_at:keep?old.category_edited_at:undefined};
}
