import { normalizeText } from "./dom.js";
import { OTHER_CATEGORY_NAME, categoryKey, cleanCategoryName, isOtherName, isRegularCategory } from "./categoryNames.js";

function compactTitle(title) {
  return normalizeText(title).toLowerCase().replace(/\s+/g, "");
}

function categoryIntro(category) {
  const sample = (category.titles || []).slice(0, 3).join("、");
  return `由收藏笔记智能归类生成，包含 ${category.count || (category.titles || []).length || 0} 篇相关内容${sample ? `：${sample}` : ""}。`.slice(0, 140);
}

export function buildManualReviewPayload({ notes, existingAlbums, config, granularity }) {
  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  return {
    version: 1,
    task: "classify_xhs_favorite_notes",
    granularity,
    rules: [
      granularity === "fine"
        ? "细粒度：可以按国家、城市、地区、路线或明确主题拆分，例如日本旅行、新疆路线。"
        : "粗粒度：优先合并为通用主题，例如日本旅行、泰国旅行、新疆旅行尽量合并为旅行。",
      "分类数量不设上限；无法可靠归类的放入“其他”。",
      "优先复用 existingAlbums 中已有专辑名。",
      "每个序号必须且只能归入一个分类。"
    ],
    expectedOutput: {
      items: [
        { i: 1, name: "旅行" },
        { i: 2, name: "美食" }
      ]
    },
    limits: {
      maxCategories: null,
      maxTitlesForPrompt: config.maxTitlesForPrompt,
      selectedTitleCount: selected.length,
      totalTitleCount: (notes || []).length
    },
    existingAlbums: (existingAlbums || []).map((album) => normalizeText(album.name || album)).filter(Boolean),
    notes: selected.map((note, index) => ({
      i: index + 1,
      title: normalizeText(note.title),
      noteId: note.noteId || "",
      href: note.href || ""
    }))
  };
}

export function buildManualReviewPrompt(payload) {
  const existing = payload.existingAlbums.length ? payload.existingAlbums.join("、") : "暂无";
  const notes = payload.notes.map((note) => `${note.i}. ${note.title}`).join("\n");
  return [
    "请帮我给小红书收藏笔记做专辑分类。",
    `分类粒度：${payload.granularity === "fine" ? "细粒度" : "粗粒度"}`,
    "分类数量不设上限。",
    `已有专辑，优先复用：${existing}`,
    "要求：每个序号必须且只能归入一个分类；无法可靠归类放入“其他”；只返回 JSON，不要解释。",
    'JSON 格式：{"items":[{"i":1,"name":"旅行"},{"i":2,"name":"美食"}]}',
    "",
    notes
  ].join("\n");
}

export function manualAssignmentsToPlan(input, notes, existingAlbums, config, granularity) {
  const payload = typeof input === "string" ? JSON.parse(input) : input;
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.assignments) ? payload.assignments : [];
  if (!items.length) throw new Error('导入分类 JSON 需要包含 items，例如 {"items":[{"i":1,"name":"旅行"}]}');

  const selected = (notes || []).slice(0, config.maxTitlesForPrompt);
  const categories = new Map();
  const other = { name: OTHER_CATEGORY_NAME, title: OTHER_CATEGORY_NAME, intro: "", count: 0, titles: [], isOther: true };
  const existingNames = new Set((existingAlbums || []).map((album) => normalizeText(album.name || album)).filter(Boolean));
  const byIndex = new Map(selected.map((note, index) => [index + 1, note]));
  const handledIndexes = new Set();

  for (const item of items) {
    const index = Number(item.i ?? item.index ?? item.id);
    const note = byIndex.get(index);
    if (!note) continue;

    const title = normalizeText(note.title);
    const rawName = normalizeText(item.name || item.category || item.album);
    if (!title || !rawName) continue;

    let category = other;
    const name = cleanCategoryName(rawName, categories.size);
    if (!isOtherName(name)) {
      const key = categoryKey(name) || compactTitle(name);
      if (!categories.has(key)) {
        categories.set(key, { name, title: name, intro: "", count: 0, titles: [], isExisting: existingNames.has(name) });
      }
      category = categories.get(key) || other;
    }

    if (!category.titles.includes(title)) category.titles.push(title);
    category.count = category.titles.length;
    handledIndexes.add(index);
  }

  for (let index = 1; index <= selected.length; index += 1) {
    if (handledIndexes.has(index)) continue;
    const title = normalizeText(byIndex.get(index)?.title);
    if (title && !other.titles.includes(title)) other.titles.push(title);
  }
  other.count = other.titles.length;

  const outputCategories = Array.from(categories.values())
    .filter((category) => category.titles.length && isRegularCategory(category))
    .map((category) => ({ ...category, intro: categoryIntro(category), count: category.titles.length }));
  if (other.titles.length) outputCategories.push({ ...other, intro: categoryIntro(other), count: other.titles.length });

  return {
    categories: outputCategories,
    analyzedTitleCount: selected.length,
    totalTitleCount: (notes || []).length,
    titleSelectionLimit: config.maxTitlesForPrompt,
    categoryLimit: null,
    batchSize: selected.length,
    existingAlbumCount: (existingAlbums || []).length,
    granularity,
    source: "manual-review"
  };
}
