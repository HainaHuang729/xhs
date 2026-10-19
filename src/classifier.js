import { normalizeText, sleep } from "./dom.js";
import { OTHER_CATEGORY_NAME, categoryKey, cleanCategoryName, isOtherName, isRegularCategory } from "./categoryNames.js";
import { logger, errorDetail, errorMessage } from "./logger.js";
import { state } from "./state.js";

function introFor(category) {
  if (category.intro) return normalizeText(category.intro).slice(0, 140);
  const sample = (category.titles || []).slice(0, 3).join("、");
  return `由收藏笔记智能归类生成，包含 ${category.count || (category.titles || []).length || 0} 篇相关内容${sample ? `：${sample}` : ""}。`.slice(0, 140);
}

function appendTitle(category, title) {
  const clean = normalizeText(title);
  if (!clean) return;
  if (!category._titleSet) Object.defineProperty(category, "_titleSet", { value: new Set(category.titles || []), enumerable: false });
  if (category._titleSet.has(clean)) return;
  category._titleSet.add(clean);
  category.titles.push(clean);
  category.count = category.titles.length;
  state.assignmentCache.set(clean, category.name);
  state.assignmentCache.set(clean.toLowerCase().replace(/\s+/g, ""), category.name);
}

function usedRegularCount(categoryMap) {
  return Array.from(categoryMap.values()).filter((category) => isRegularCategory(category) && (category.titles?.length || !category.isExisting)).length;
}

function canAddCategory(categoryMap, config) {
  return usedRegularCount(categoryMap) < config.maxCategories;
}

function createExistingCategoryMap(existingAlbumNames, config) {
  const map = new Map();
  for (const rawName of existingAlbumNames || []) {
    if (map.size >= Math.min(config.maxCategories, config.maxClassificationContextCategories)) break;
    const name = cleanCategoryName(rawName, map.size);
    if (!name || isOtherName(name)) continue;
    const key = categoryKey(name);
    if (!map.has(key)) {
      map.set(key, { name, title: name, intro: "已有小红书专辑，优先复用。", count: 0, titles: [], isExisting: true });
    }
  }
  return map;
}

function localCategoryForTitle(title, granularity) {
  const text = normalizeText(title);
  const fineRules = [
    ["西藏旅行", ["西藏", "拉萨", "阿里", "川藏", "波密", "藏东", "冰川", "喜马拉雅", "318"]],
    ["新疆路线", ["新疆", "阿勒泰", "伊犁", "赛里木湖", "禾木", "喀纳斯", "安集海"]],
    ["日本旅行", ["日本", "东京", "大阪", "京都", "北海道", "富士"]],
    ["海滨城市", ["威海", "蓝眼泪", "海边", "海滨"]],
    ["美食", ["美食", "餐厅", "咖啡", "甜品", "火锅", "烧烤", "菜谱", "食谱"]],
    ["穿搭美妆", ["穿搭", "妆", "口红", "护肤", "发型", "香水"]],
    ["学习工作", ["学习", "论文", "英语", "考研", "工作", "效率", "笔记"]],
    ["家居生活", ["家居", "装修", "收纳", "房间", "租房"]],
    ["机位与拍照", ["机位", "拍照", "摄影", "滤镜", "壁纸", "live"]]
  ];
  const coarseRules = [
    ["旅行", ["旅行", "旅游", "西藏", "拉萨", "阿里", "川藏", "新疆", "阿勒泰", "伊犁", "威海", "日本", "泰国", "国外", "海外", "海边", "攻略", "路线", "景点"]],
    ["美食", ["美食", "餐厅", "咖啡", "甜品", "火锅", "烧烤", "菜谱", "食谱"]],
    ["穿搭美妆", ["穿搭", "妆", "口红", "护肤", "发型", "香水"]],
    ["学习工作", ["学习", "论文", "英语", "考研", "工作", "效率", "笔记"]],
    ["家居生活", ["家居", "装修", "收纳", "房间", "租房"]],
    ["拍照机位", ["机位", "拍照", "摄影", "滤镜", "壁纸", "live"]]
  ];
  const rules = granularity === "fine" ? fineRules : coarseRules;
  return rules.find(([, keys]) => keys.some((key) => text.includes(key)))?.[0] || OTHER_CATEGORY_NAME;
}

function assignLocally(batch, categoryMap, otherCategory, granularity, config) {
  for (const note of batch) {
    const title = normalizeText(note.title);
    if (!title) continue;

    let category = Array.from(categoryMap.values()).find((candidate) => title.includes(candidate.name) || candidate.name.includes(title));
    if (!category) {
      const localName = localCategoryForTitle(title, granularity);
      if (!isOtherName(localName)) {
        const key = categoryKey(localName);
        if (!categoryMap.has(key) && canAddCategory(categoryMap, config)) {
          categoryMap.set(key, { name: localName, title: localName, intro: "", count: 0, titles: [], isExisting: false });
        }
        category = categoryMap.get(key);
      }
    }
    appendTitle(category || otherCategory, title);
  }
}

function parseJsonLoose(value) {
  if (!value) throw new Error("LLMBridge 返回为空");
  if (typeof value === "object") return value;
  const text = String(value).trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw error;
  }
}

async function callLlm(prompt, config) {
  if (!window.LLMBridge || typeof window.LLMBridge.chat !== "function") {
    throw new Error("LLMBridge 不存在");
  }

  let timer = null;
  try {
    const result = await Promise.race([
      window.LLMBridge.chat(prompt, "json"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`LLMBridge 分批分析超过 ${Math.round(config.llmBatchTimeoutMs / 1000)} 秒`)), config.llmBatchTimeoutMs);
      })
    ]);
    return parseJsonLoose(result);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildPrompt(batch, categoryMap, batchIndex, batchCount, granularity, config) {
  const categories = Array.from(categoryMap.values());
  const context = [
    ...categories.filter((category) => category.titles?.length || !category.isExisting),
    ...categories.filter((category) => category.isExisting && !category.titles?.length)
  ].slice(0, Math.min(config.maxCategories, config.maxClassificationContextCategories));

  const contextText = context.length
    ? context.map((category, index) => {
        const sample = (category.titles || []).slice(0, 2).map((title) => normalizeText(title).slice(0, 28)).join(" / ");
        return `${index + 1}. ${category.name}${category.isExisting ? "（已有专辑）" : "（新增分类）"}${sample ? `；已归类示例：${sample}` : ""}`;
      }).join("\n")
    : "暂无已有分类。";

  const remaining = Math.max(0, config.maxCategories - usedRegularCount(categoryMap));
  const granularityInstruction =
    granularity === "fine"
      ? "当前为细粒度：允许按国家、城市、地区、路线、内容主题继续拆分。例如“日本旅行”和“泰国旅行”可以分别归为“日本旅行”“泰国旅行”；但仍要避免为单篇标题单独建类。"
      : "当前为粗粒度：优先合并为更大的通用主题，不按国家、城市或路线过度拆分。例如“日本旅行”“泰国旅行”“新疆旅行”应优先合并为“旅行”；只有主题明显不同才拆分。";
  const addInstruction =
    remaining > 0
      ? granularity === "fine"
        ? "只有当标题无法自然归入现有分类时，才可以新增更具体分类；新增分类名可以按国家、城市、地区、路线或明确主题拆分，但不要为单篇标题单独建类。"
        : "只有当标题无法自然归入现有分类时，才可以新增宽泛分类；新增分类名要适合作为专辑标题，简短自然，不要太细。"
      : "常规分类已达到上限，禁止新增常规分类；无法归入现有分类的标题必须放入“其他”。";
  const titles = batch.map((note, index) => `${index + 1}. ${note.title}`).join("\n");

  return [
    "你是小红书收藏整理助手。现在按批次整理用户收藏笔记标题，并维护一组稳定的小红书专辑分类。",
    `这是第 ${batchIndex + 1}/${batchCount} 批，每批最多 ${config.classificationBatchSize} 个标题。${granularityInstruction}`,
    `当前已有/已新增的常规分类如下。请优先复用这些分类，不要因为表达略有差异就新增分类：\n${contextText}`,
    `常规分类总上限为 ${config.maxCategories} 个，当前已有 ${usedRegularCount(categoryMap)} 个已使用分类，还可以新增 ${remaining} 个。`,
    addInstruction,
    "只做本批标题到分类名的映射，不要解释，不要复述标题全文。每个序号必须且只能归入一个分类。无法可靠归入常规分类的序号放入“其他”。",
    '只返回 JSON，结构：{"items":[{"i":1,"name":"已有或新增专辑标题"}]}。i 是标题序号，name 是分类名。',
    "",
    titles
  ].join("\n");
}

function applyLlmAssignments(batch, payload, categoryMap, otherCategory, config) {
  const assignments = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.assignments) ? payload.assignments : [];
  if (!assignments.length) return false;

  const handled = new Set();
  for (const item of assignments) {
    const note = batch[Number(item.i ?? item.index ?? item.id) - 1];
    const title = normalizeText(item.title || note?.title);
    const rawName = normalizeText(item.name || item.category || item.album);
    if (!note || !title || !rawName || handled.has(title)) continue;

    let category = otherCategory;
    const name = cleanCategoryName(rawName, categoryMap.size);
    if (!isOtherName(name)) {
      const key = categoryKey(name);
      if (!categoryMap.has(key) && canAddCategory(categoryMap, config)) {
        categoryMap.set(key, { name, title: name, intro: "", count: 0, titles: [], isExisting: false });
      }
      category = categoryMap.get(key) || otherCategory;
    }

    appendTitle(category, title);
    handled.add(title);
  }

  for (const note of batch) {
    const title = normalizeText(note.title);
    if (title && !handled.has(title)) appendTitle(otherCategory, title);
  }
  return true;
}

export async function classifyNotes(notes, existingAlbumNames, options, onProgress = () => {}) {
  const { config, granularity } = options;
  const selected = notes.slice(0, config.maxTitlesForPrompt);
  const batchSize = Math.max(20, Number(config.classificationBatchSize) || 100);
  const batches = [];
  for (let index = 0; index < selected.length; index += batchSize) batches.push(selected.slice(index, index + batchSize));

  const categoryMap = createExistingCategoryMap(existingAlbumNames, config);
  const otherCategory = { name: OTHER_CATEGORY_NAME, title: OTHER_CATEGORY_NAME, intro: "未能可靠归入上述分类的收藏笔记，作为备注保留。", count: 0, titles: [], isOther: true };
  state.assignmentCache = new Map();

  for (let index = 0; index < batches.length; index += 1) {
    onProgress(Math.min(90, 64 + Math.round((index / Math.max(1, batches.length)) * 25)), `正在按${granularity === "fine" ? "细粒度" : "粗粒度"}分批分析 ${index + 1}/${batches.length}`);

    const batch = batches[index];
    if (!window.LLMBridge || typeof window.LLMBridge.chat !== "function") {
      assignLocally(batch, categoryMap, otherCategory, granularity, config);
      await sleep(40);
      continue;
    }

    try {
      const prompt = buildPrompt(batch, categoryMap, index, batches.length, granularity, config);
      const payload = await callLlm(prompt, config);
      if (!applyLlmAssignments(batch, payload, categoryMap, otherCategory, config)) {
        assignLocally(batch, categoryMap, otherCategory, granularity, config);
      }
    } catch (error) {
      logger.warn("LLM 分批分类失败，使用本地兜底", { error: errorMessage(error), detail: errorDetail(error) });
      assignLocally(batch, categoryMap, otherCategory, granularity, config);
    }
    await sleep(80);
  }

  const categories = Array.from(categoryMap.values())
    .filter((category) => category.titles.length && isRegularCategory(category))
    .map((category) => ({ ...category, intro: introFor(category), count: category.titles.length }));
  if (otherCategory.titles.length) categories.push({ ...otherCategory, intro: introFor(otherCategory), count: otherCategory.titles.length });

  const plan = {
    categories,
    analyzedTitleCount: selected.length,
    totalTitleCount: notes.length,
    titleSelectionLimit: config.maxTitlesForPrompt,
    categoryLimit: config.maxCategories,
    batchSize,
    existingAlbumCount: existingAlbumNames.length,
    granularity
  };
  logger.debug("分类结果", plan);
  return plan;
}
