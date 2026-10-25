import assert from "node:assert/strict";
import fs from "node:fs";
import { isOtherName, isRegularCategory } from "../src/categoryNames.js";
import { manualAssignmentsToPlan, buildManualReviewPayload, buildManualReviewPrompt } from "../src/manualReview.js";
import { buildAssignments } from "../src/xhsApi.js";
import { DEFAULT_CONFIG, normalizeConfig } from "../src/config.js";
import { classifyNotes } from "../src/classifier.js";

const fallbackNames = ["未分类专辑1", "其它内容", "其他收藏 02", "Uncategorized notes", "misc albums"];
for (const name of fallbackNames) {
  assert.equal(isOtherName(name), true, name);
  assert.equal(isRegularCategory({ name }), false, name);
}
for (const name of ["旅行", "美食"]) assert.equal(isOtherName(name), false, name);

const notes = [{ title: "旅行笔记", noteId: "test-travel" }, { title: "待复核笔记", noteId: "test-other" }];
for (const name of fallbackNames) {
  const plan = manualAssignmentsToPlan(
    { items: [{ i: 1, name: "旅行" }, { i: 2, name }] },
    notes, [], { maxTitlesForPrompt: 10, maxCategories: 5 }, "coarse"
  );
  assert.equal(plan.categories.filter(isRegularCategory).length, 1);
  assert.equal(plan.categories.find((category) => category.isOther).count, 1);
  const assignments = buildAssignments(plan, notes);
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].noteId, "test-travel");
}

// Older saved settings must not send valid categories to “其他”, including
// imports larger than the former hard maximum of 200 categories.
const manyAlbums = Array.from({ length: 205 }, (_, index) => `主题${String(index + 1).padStart(3, "0")}`);
const manyNotes = manyAlbums.map((name, index) => ({ title: `${name}的收藏`, noteId: `note-${index}` }));
const manyItems = manyAlbums.map((name, index) => ({ i: index + 1, name }));
const legacyConfig = { ...DEFAULT_CONFIG, maxCategories: 1, classificationBatchSize: 500 };
assert.equal(Object.hasOwn(normalizeConfig(legacyConfig), "maxCategories"), false);
const manualPlan = manualAssignmentsToPlan({ items: manyItems }, manyNotes, [], legacyConfig, "fine");
assert.deepEqual(manualPlan.categories.map((category) => category.name), manyAlbums);
assert.equal(manualPlan.categoryLimit, null);
const manualPayload = buildManualReviewPayload({ notes: manyNotes, existingAlbums: manyAlbums, config: legacyConfig, granularity: "fine" });
assert.equal(manualPayload.limits.maxCategories, null);
assert.match(buildManualReviewPrompt(manualPayload), /分类数量不设上限/);

const previousWindow = globalThis.window;
const previousDebug = console.debug;
try {
  console.debug = () => {};
  globalThis.window = { LLMBridge: { chat: async (prompt) => {
    assert.match(prompt, /分类数量不设上限/);
    return { items: manyItems };
  } } };
  const llmPlan = await classifyNotes(manyNotes, [], { config: legacyConfig, granularity: "fine" });
  assert.deepEqual(llmPlan.categories.map((category) => category.name), manyAlbums);
  assert.equal(llmPlan.categoryLimit, null);
  globalThis.window = {};
  const localPlan = await classifyNotes(manyNotes, manyAlbums, { config: legacyConfig, granularity: "fine" });
  assert.deepEqual(localPlan.categories.map((category) => category.name), manyAlbums);
  assert(localPlan.categories.every((category) => category.isExisting));
} finally {
  console.debug = previousDebug;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

for (const file of ["../dist/xhs-album-builder.console.js", "../extension/xhs-album-builder.page.js"]) {
  assert.match(fs.readFileSync(new URL(file, import.meta.url), "utf8"), /^[\x00-\x7f]*$/);
}
console.log("unlimited category, assignment and ASCII build regressions passed");
