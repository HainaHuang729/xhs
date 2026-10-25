import fs from 'node:fs';
import assert from 'node:assert/strict';
import {normalize,regionMatches,pointsForRegion} from '../map/model.js';
import {foodGroups,cuisineNames,foodTaxonomyVersion} from '../map/food-categories.js';

const file = new URL('../outputs/map-data.json', import.meta.url);
const backup = new URL('../outputs/map-data-before-food-review-round9.json', import.meta.url);
const reviewFile = new URL('../outputs/food-category-review.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file));
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
const before = structuredClone(data);
const reviewed = JSON.parse(fs.readFileSync(reviewFile));
const reviewNotes = reviewed.notes || {};
const reviewPoints = reviewed.points || [];
const unresolved = reviewed.unresolved || {};

const byId = new Map(data.rows.map(note => [note.id, note]));
for (const [id, review] of Object.entries(reviewNotes)) {
  assert(byId.has(id), `Reviewed note missing: ${id}`);
  assert(Array.isArray(review.groups), `Reviewed groups must be an array: ${id}`);
  assert(Array.isArray(review.cuisines), `Reviewed cuisines must be an array: ${id}`);
  for (const group of review.groups) assert(foodGroups.includes(group), `${id}: unknown group ${group}`);
  for (const cuisine of review.cuisines) assert(cuisineNames.includes(cuisine), `${id}: unknown cuisine ${cuisine}`);
  assert(String(review.basis || '').trim(), `Reviewed note needs a basis: ${id}`);
}
for (const tag of reviewPoints) {
  const note = byId.get(tag.note_id);
  assert(note, `Reviewed place note missing: ${tag.note_id}`);
  for (const group of tag.groups || []) assert(foodGroups.includes(group), `${tag.note_id}: unknown place group ${group}`);
  for (const cuisine of tag.cuisines || []) assert(cuisineNames.includes(cuisine), `${tag.note_id}: unknown place cuisine ${cuisine}`);
  assert(String(tag.basis || '').trim(), `Reviewed place needs a basis: ${tag.note_id}/${tag.name_prefix}`);
  const matches = (note.locations || []).filter(point => point.name.startsWith(tag.name_prefix));
  assert.equal(matches.length, 1, `Reviewed place prefix must match exactly one point: ${tag.note_id}/${tag.name_prefix}`);
}

for (const note of data.rows) {
  const review = reviewNotes[note.id];
  if (review) Object.assign(note, {food_groups_manual: review.groups, food_cuisines_manual: review.cuisines, food_classification_note: review.basis});
  for (const tag of reviewPoints.filter(point => point.note_id === note.id)) {
    const point = note.locations.find(location => location.name.startsWith(tag.name_prefix));
    assert(point, `Reviewed place missing: ${tag.name_prefix}`);
    Object.assign(point, {food_groups_manual: tag.groups, food_cuisines_manual: tag.cuisines, food_classification_note: tag.basis});
  }
}
data.rows = normalize(data);
const foodKeys = new Set(['food_groups','food_cuisines','food_groups_manual','food_cuisines_manual','food_classification_basis','food_classification_note','food_taxonomy_version']);
const withoutFood = obj => Object.fromEntries(Object.entries(obj).filter(([key]) => !foodKeys.has(key)));
for (let i = 0; i < before.rows.length; i++) {
  const old = before.rows[i], now = data.rows[i];
  for (const key of ['id','title','content','images','cover_image','album_sync','photo_saved','photo_total','category']) assert.deepEqual(now[key], old[key], `${old.id}: ${key}`);
  assert.deepEqual(now.locations.map(withoutFood), old.locations.map(withoutFood), `${old.id}: locations`);
}

const h = data.rows.filter(note => regionMatches(note, 'hksz'));
const classified = h.filter(note => note.food_groups.length);
const unspecified = h.filter(note => note.food_groups.includes('菜系') && !note.food_cuisines.length);
for (const [id, entry] of Object.entries(unresolved)) {
  const note = h.find(row => row.id === id);
  assert(note, `Unresolved note missing from Hong Kong/Shenzhen: ${id}`);
  assert(note.food_groups.includes('菜系'), `Unresolved note must still be filed under 菜系: ${id}`);
  assert.equal(note.food_cuisines.length, 0, `Unresolved note already has a cuisine: ${id}`);
  assert(!Array.isArray(note.food_cuisines_manual) || note.food_cuisines_manual.length === 0, `Unresolved note has manual cuisines: ${id}`);
  assert(String(entry.reason || '').trim().length >= 10, `Unresolved note needs a concrete reason: ${id}`);
}
const unresolvedRows = unspecified.map(note => ({
  id: note.id,
  title: note.title,
  groups: note.food_groups,
  reason: unresolved[note.id]?.reason,
  basis: note.food_classification_basis,
  locations: note.locations.map(point => point.name),
}));
assert.equal(unresolvedRows.length, Object.keys(unresolved).length, 'Every unspecified cuisine note needs one unresolved reason');
for (const row of unresolvedRows) assert(row.reason, `Missing unresolved reason: ${row.id}`);

const summary = {
  reviewed_at: reviewed.reviewed_at || '2026-10-21',
  scope: '香港 + 深圳',
  notes: h.length,
  classified_food_notes: classified.length,
  reviewed_overrides: Object.keys(reviewNotes).length,
  reviewed_venue_overrides: reviewPoints.length,
  cuisine_unspecified: unspecified.length,
  unresolved_notes: unresolvedRows.length,
  excluded_food_notes: h.filter(note => Array.isArray(note.food_groups_manual) && !note.food_groups.length).length,
  groups: Object.fromEntries(foodGroups.map(group => [group, h.filter(note => note.food_groups.includes(group)).length])),
  cuisines: Object.fromEntries(cuisineNames.map(cuisine => [cuisine, h.filter(note => note.food_cuisines.includes(cuisine)).length]).filter(([, count]) => count)),
  mapped_notes: h.filter(note => pointsForRegion(note, 'hksz').length).length,
  map_points: h.reduce((sum, note) => sum + pointsForRegion(note, 'hksz').length, 0),
  taxonomy_version: foodTaxonomyVersion,
  note: '合集可归入多类；分类不代表分店或地点已确认。地点核实进度与云端发布状态分别记录；菜系未定的条目保留在 food-category-unresolved.json。',
};
data.coverage.food_classified_hksz = summary.classified_food_notes;
data.coverage.food_classification_groups_hksz = summary.groups;
data.coverage.food_cuisine_unspecified_hksz = summary.cuisine_unspecified;
data.coverage.food_unresolved_hksz = summary.unresolved_notes;
data.coverage.food_taxonomy_version = foodTaxonomyVersion;
fs.writeFileSync(new URL('../outputs/food-category-summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(new URL('../outputs/food-category-index.json', import.meta.url), JSON.stringify(classified.map(note => ({id:note.id,title:note.title,groups:note.food_groups,cuisines:note.food_cuisines,basis:note.food_classification_basis})), null, 2) + '\n');
fs.writeFileSync(new URL('../outputs/food-category-unresolved.json', import.meta.url), JSON.stringify({reviewed_at:summary.reviewed_at,scope:summary.scope,count:unresolvedRows.length,notes:unresolvedRows}, null, 2) + '\n');
const temp = new URL('../outputs/map-data.food-next.json', import.meta.url);
fs.writeFileSync(temp, JSON.stringify(data, null, 2));
fs.renameSync(temp, file);
console.log(summary);
