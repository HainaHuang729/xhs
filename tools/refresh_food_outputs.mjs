// Rebuild food reports from the current canonical rows without serializing the
// normalized rows back into map-data.json. Dry run unless --apply is supplied.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {normalize, regionMatches, pointsForRegion} from '../map/model.js';
import {foodGroups, cuisineNames, foodTaxonomyVersion} from '../map/food-categories.js';

const args = process.argv.slice(2);
assert(args.every(arg => arg === '--apply'), 'Usage: node tools/refresh_food_outputs.mjs [--apply]');
const apply = args.includes('--apply');
const output = name => new URL('../outputs/' + name, import.meta.url);
const mapFile = output('map-data.json');
const mapSource = fs.readFileSync(mapFile);
const data = JSON.parse(mapSource);
const reviewSource = fs.readFileSync(output('food-category-review.json'));
const review = JSON.parse(reviewSource);
const rows = normalize(data);
const hksz = rows.filter(note => regionMatches(note, 'hksz'));
const classified = hksz.filter(note => note.food_groups.length);
const unspecified = hksz.filter(note => note.food_groups.includes('菜系') && !note.food_cuisines.length);

// A report refresh may retire a resolved item, but must not manufacture an
// explanation for a newly unresolved item. Add that reviewed reason separately.
const missingReasons = unspecified.filter(note => String(review.unresolved?.[note.id]?.reason || '').trim().length < 10);
assert.equal(missingReasons.length, 0, 'Missing reviewed unresolved reasons: ' + missingReasons.map(note => `${note.id} ${note.title}`).join('; '));
const unresolved = Object.fromEntries(unspecified.map(note => [note.id, review.unresolved[note.id]]));
const nextReview = {...review, unresolved};
assert.deepEqual(nextReview.notes, review.notes, 'reviewed note overrides preserved');
assert.deepEqual(nextReview.points, review.points, 'reviewed point overrides preserved');
const unresolvedRows = unspecified.map(note => ({
  id: note.id, title: note.title, groups: note.food_groups,
  reason: unresolved[note.id].reason, basis: note.food_classification_basis,
  locations: note.locations.map(point => point.name),
}));
const reviewedDates = [review.reviewed_at, ...rows.map(note => note.category_review?.reviewed_at)]
  .filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b));
const reviewedAt = reviewedDates.at(-1) || review.reviewed_at;
const summary = {
  reviewed_at: reviewedAt,
  scope: '香港 + 深圳',
  notes: hksz.length,
  classified_food_notes: classified.length,
  reviewed_overrides: Object.keys(review.notes || {}).length,
  reviewed_venue_overrides: (review.points || []).length,
  cuisine_unspecified: unspecified.length,
  unresolved_notes: unresolvedRows.length,
  excluded_food_notes: hksz.filter(note => Array.isArray(note.food_groups_manual) && !note.food_groups.length).length,
  groups: Object.fromEntries(foodGroups.map(group => [group, hksz.filter(note => note.food_groups.includes(group)).length])),
  cuisines: Object.fromEntries(cuisineNames.map(cuisine => [cuisine, hksz.filter(note => note.food_cuisines.includes(cuisine)).length]).filter(([, count]) => count)),
  mapped_notes: hksz.filter(note => pointsForRegion(note, 'hksz').length).length,
  map_points: hksz.reduce((sum, note) => sum + pointsForRegion(note, 'hksz').length, 0),
  taxonomy_version: foodTaxonomyVersion,
  note: '合集可归入多类；分类不代表分店或地点已确认。地点核实进度与云端发布状态分别记录；菜系未定的条目保留在 food-category-unresolved.json。',
};
const reports = new Map([
  ['food-category-summary.json', summary],
  ['food-category-index.json', classified.map(note => ({id: note.id, title: note.title, groups: note.food_groups, cuisines: note.food_cuisines, basis: note.food_classification_basis}))],
  ['food-category-unresolved.json', {reviewed_at: summary.reviewed_at, scope: summary.scope, count: unresolvedRows.length, notes: unresolvedRows}],
]);
// Only write the review source when resolved IDs actually need removal.
if (JSON.stringify(review.unresolved || {}) !== JSON.stringify(unresolved)) reports.set('food-category-review.json', nextReview);
const beforeHash = crypto.createHash('sha256').update(mapSource).digest('hex');
if (apply) {
  assert(fs.readFileSync(mapFile).equals(mapSource), 'map-data.json changed during report generation; retry after edits finish');
  assert(fs.readFileSync(output('food-category-review.json')).equals(reviewSource), 'food-category-review.json changed during report generation; retry');
  const staged = [];
  try {
    for (const [name, value] of reports) {
      const temp = output(`${name}.refresh-${process.pid}.tmp`);
      fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
      staged.push([temp, output(name)]);
    }
    for (const [temp, destination] of staged) fs.renameSync(temp, destination);
  } finally {
    for (const [temp] of staged) if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  assert(fs.readFileSync(mapFile).equals(mapSource), 'Canonical map data changed concurrently; regenerate derived reports');
}
console.log(JSON.stringify({mode: apply ? 'applied' : 'dry-run', files: [...reports.keys()], summary, removed_unresolved_ids: Object.keys(review.unresolved || {}).filter(id => !unresolved[id]), canonical_sha256: beforeHash, canonical_untouched: true}, null, 2));
