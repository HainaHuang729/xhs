import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalize, regionMatches, pointsForRegion, foodPointsForRegion} from '../map/model.js';
import {foodGroups, cuisineNames, foodTaxonomyVersion} from '../map/food-categories.js';

const data = JSON.parse(fs.readFileSync(new URL('../outputs/map-data.json', import.meta.url)));
const review = JSON.parse(fs.readFileSync(new URL('../outputs/food-category-review.json', import.meta.url)));
const summary = JSON.parse(fs.readFileSync(new URL('../outputs/food-category-summary.json', import.meta.url)));
const index = JSON.parse(fs.readFileSync(new URL('../outputs/food-category-index.json', import.meta.url)));
const unresolvedFile = JSON.parse(fs.readFileSync(new URL('../outputs/food-category-unresolved.json', import.meta.url)));
const rows = normalize(data);
const hksz = rows.filter(note => regionMatches(note, 'hksz'));
const classified = hksz.filter(note => note.food_groups.length);
const unresolved = hksz.filter(note => note.food_groups.includes('菜系') && !note.food_cuisines.length);

for (const note of hksz) {
  assert.equal(note.food_taxonomy_version, foodTaxonomyVersion, `${note.id}: taxonomy version`);
  for (const group of note.food_groups) assert(foodGroups.includes(group), `${note.id}: unknown group ${group}`);
  for (const cuisine of note.food_cuisines) assert(cuisineNames.includes(cuisine), `${note.id}: unknown cuisine ${cuisine}`);
  if (Array.isArray(note.food_groups_manual)) assert.deepEqual(note.food_groups, note.food_groups_manual, `${note.id}: manual groups not applied`);
  if (Array.isArray(note.food_cuisines_manual)) assert.deepEqual(note.food_cuisines, note.food_cuisines_manual, `${note.id}: manual cuisines not applied`);
  for (const point of note.locations) {
    for (const group of point.food_groups || []) assert(foodGroups.includes(group), `${note.id}/${point.name}: unknown point group ${group}`);
    for (const cuisine of point.food_cuisines || []) assert(cuisineNames.includes(cuisine), `${note.id}/${point.name}: unknown point cuisine ${cuisine}`);
    if (Array.isArray(point.food_groups_manual)) assert.deepEqual(point.food_groups, point.food_groups_manual, `${note.id}/${point.name}: manual point groups not applied`);
    if (Array.isArray(point.food_cuisines_manual)) assert.deepEqual(point.food_cuisines, point.food_cuisines_manual, `${note.id}/${point.name}: manual point cuisines not applied`);
  }
}

assert.equal(summary.classified_food_notes, classified.length, 'summary classified count');
assert.equal(summary.cuisine_unspecified, unresolved.length, 'summary unspecified count');
assert.equal(summary.unresolved_notes, unresolved.length, 'summary unresolved count');
assert.equal(unresolvedFile.count, unresolved.length, 'unresolved file count');
assert.deepEqual(unresolvedFile.notes.map(note => note.id).sort(), unresolved.map(note => note.id).sort(), 'unresolved ids');
assert.deepEqual(index.map(note => note.id).sort(), classified.map(note => note.id).sort(), 'index ids');
assert.deepEqual(Object.keys(review.unresolved || {}).sort(), unresolved.map(note => note.id).sort(), 'review unresolved reasons');
for (const note of unresolved) assert(String(review.unresolved[note.id]?.reason || '').trim().length >= 10, `${note.id}: missing unresolved reason`);

for (const [id, entry] of Object.entries(review.unresolved || {})) {
  const note = hksz.find(row => row.id === id);
  assert(note, `${id}: unresolved note missing`);
  assert(note.food_groups.includes('菜系') && !note.food_cuisines.length, `${id}: unresolved note already has a cuisine`);
  assert(!Array.isArray(note.food_cuisines_manual) || !note.food_cuisines_manual.length, `${id}: unresolved note has manual cuisines`);
  assert(String(entry.reason || '').trim().length >= 10, `${id}: unresolved reason too short`);
}

for (const entry of review.points || []) {
  const note = rows.find(row => row.id === entry.note_id);
  assert(note, `${entry.note_id}: reviewed place note missing`);
  const points = note.locations.filter(point => point.name.startsWith(entry.name_prefix));
  assert.equal(points.length, 1, `${entry.note_id}/${entry.name_prefix}: expected exactly one point`);
}

assert.equal(summary.taxonomy_version, foodTaxonomyVersion, 'taxonomy version');
assert.deepEqual(summary.groups, Object.fromEntries(foodGroups.map(group => [group, hksz.filter(note => note.food_groups.includes(group)).length])), 'group counts');
assert.deepEqual(summary.cuisines, Object.fromEntries(cuisineNames.map(cuisine => [cuisine, hksz.filter(note => note.food_cuisines.includes(cuisine)).length]).filter(([, count]) => count)), 'cuisine counts');
assert.equal(summary.map_points, hksz.reduce((sum, note) => sum + pointsForRegion(note, 'hksz').length, 0), 'map point count');

// Cuisine filters must not leak a note's other cuisines onto a point.
for (const note of classified) {
  if (note.food_groups.includes('菜系') && note.food_cuisines.length) {
    const matched = foodPointsForRegion(note, 'hksz', '菜系');
    for (const point of matched) {
      assert(point.food_groups.includes('菜系'), `${note.id}/${point.name}: missing 菜系 group`);
      if (point.food_cuisines.length) assert(point.food_cuisines.some(cuisine => note.food_cuisines.includes(cuisine)), `${note.id}/${point.name}: point cuisine outside note`);
    }
  }
}

console.log(`吃喝分类检查通过：${hksz.length} 条港深收藏，${classified.length} 条有分类，${unresolved.length} 条菜系待细分（均有原因），${summary.map_points} 个地点。`);
