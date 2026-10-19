import { normalizeText } from "./dom.js";

export const OTHER_CATEGORY_NAME = "其他";

const quoteChars = /[《》"'`“”‘’]/g;
const separatorChars = /[\s:_：\-—_/|·.。,，]+/g;
const trailingIndex = /(?:[#第]?\d+|[（(]\d+[）)])$/;

function compactName(name) {
  return normalizeText(name)
    .replace(quoteChars, "")
    .replace(separatorChars, "")
    .toLowerCase();
}

function stripAlbumWords(name) {
  return name
    .replace(trailingIndex, "")
    .replace(/^(专辑|分类|合集|收藏夹|收藏|笔记|内容)/, "")
    .replace(/(专辑|分类|合集|收藏夹|收藏|笔记|内容)$/, "")
    .replace(trailingIndex, "");
}

export function categoryKey(name) {
  return compactName(name);
}

export function cleanCategoryName(name, index) {
  return normalizeText(name).replace(quoteChars, "").slice(0, 18) || `分类${index + 1}`;
}

export function isOtherName(name) {
  const compact = compactName(name);
  if (!compact) return false;

  const variants = new Set([
    "其他",
    "其它",
    "其他收藏",
    "其它收藏",
    "其他笔记",
    "其它笔记",
    "其他内容",
    "其它内容",
    "未分类",
    "未归类",
    "待分类",
    "待归类",
    "无法分类",
    "无法归类",
    "不确定",
    "杂项",
    "杂类",
    "待整理",
    "未整理"
  ]);

  const stripped = stripAlbumWords(compact);
  if (variants.has(compact) || variants.has(stripped)) return true;
  if (/^(其他|其它|未分类|未归类|待分类|待归类|无法分类|无法归类|不确定|杂项|杂类|待整理|未整理)\d*$/.test(stripped)) return true;
  if (/^(other|others|misc|miscellaneous|uncategorized|uncategorised|unclassified)(notes?|albums?|categories?|items?|content|favorites?)?\d*$/.test(stripped)) return true;
  return false;
}

export function isRegularCategory(category) {
  return !!category && !category.isOther && !isOtherName(category.name || category.title || category);
}
