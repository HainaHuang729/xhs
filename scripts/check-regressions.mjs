import assert from "node:assert/strict";
import fs from "node:fs";
import { isOtherName, isRegularCategory } from "../src/categoryNames.js";
import { manualAssignmentsToPlan } from "../src/manualReview.js";
import { buildAssignments } from "../src/xhsApi.js";

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

for (const file of ["../dist/xhs-album-builder.console.js", "../extension/xhs-album-builder.page.js"]) {
  assert.match(fs.readFileSync(new URL(file, import.meta.url), "utf8"), /^[\x00-\x7f]*$/);
}
console.log("category, assignment and ASCII build regressions passed");
