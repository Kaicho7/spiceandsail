// Phase 2 — deduplication + canonical catalog generation.
//
// Reads .vision/image_vision.jsonl (436 vision scan records), groups images
// into duplicate sets:
//   - exact duplicates: same md5 (verified against actual file hashes)
//   - near duplicates: dHash — SKIPPED. The dHash values in the vision file
//     collide across unrelated content (e.g. distance-0 between a lion photo
//     and a beach photo), and transitive union-find chaining at any threshold
//     merges hundreds of unrelated images into one group. Exact-md5 grouping
//     is the only reliable signal here, so near-dup detection is disabled.
//
// Selects one canonical representative per group (highest quality_score, then
// largest byte count, then first-seen file) and writes a canonical catalog JSON
// with SEO filenames, alt text, category/activity tags, and the full duplicate
// membership of each group.
//
// Output: src/data/canonical-image-catalog.json
// Run:    node scripts/dedup-images.js

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const VISION_FILE = path.join(ROOT, '.vision', 'image_vision.jsonl');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'canonical-image-catalog.json');

function readRecords() {
  const text = fs.readFileSync(VISION_FILE, 'utf8');
  const records = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    records.push(JSON.parse(trimmed));
  }
  return records;
}

function main() {
  const records = readRecords();
  const n = records.length;

  // Build exact-md5 groups. md5 collisions were verified against the actual
  // files on disk, so same-md5 == same image content.
  const byMd5 = new Map();
  for (let i = 0; i < n; i += 1) {
    const md5 = records[i].md5;
    if (byMd5.has(md5)) byMd5.get(md5).push(i);
    else byMd5.set(md5, [i]);
  }

  const groups = [...byMd5.values()].filter((idxs) => idxs.length > 1);
  const singletonGroups = [...byMd5.values()].filter((idxs) => idxs.length === 1);
  const allGroups = groups.concat(singletonGroups);

  // Select canonical representative per group: highest quality_score, then
  // largest bytes, then earliest index.
  function canonicalIdx(idxs) {
    return idxs.reduce((best, cur) => {
      const b = records[best];
      const c = records[cur];
      if (c.quality_score !== b.quality_score)
        return c.quality_score > b.quality_score ? cur : best;
      if (c.bytes !== b.bytes) return c.bytes > b.bytes ? cur : best;
      return cur < best ? cur : best;
    }, idxs[0]);
  }

  const imageEntries = [];
  let exactGroups = 0;

  for (const idxs of allGroups) {
    const canon = canonicalIdx(idxs);
    const c = records[canon];
    const members = idxs.map((i) => records[i].file).sort();
    const isDup = members.length > 1;
    const exact = isDup; // every multi-member group here is exact-md5

    if (isDup && exact) exactGroups += 1;

    imageEntries.push({
      canonical_file: c.file,
      seo_filename: c.seo_filename || c.file,
      alt_text: c.alt_text || '',
      category: c.category || 'other',
      activity: c.activity || 'other',
      place_guess: c.place_guess || '',
      place_confidence: c.place_confidence || 0,
      quality_score: c.quality_score,
      quality_notes: c.quality_notes || '',
      width: c.width,
      height: c.height,
      bytes: c.bytes,
      is_hotel_interior: c.is_hotel_interior,
      has_people: c.has_people,
      is_graphic_or_screenshot: c.is_graphic_or_screenshot,
      duplicate_count: members.length,
      is_duplicate: isDup,
      dedup_method: exact ? 'exact' : 'unique',
      duplicates: members,
    });
  }

  // Sort: duplicates first (by count desc), then uniques, alphabetical within.
  imageEntries.sort((a, b) => {
    if (a.is_duplicate !== b.is_duplicate) return b.is_duplicate ? 1 : -1;
    if (a.is_duplicate && b.is_duplicate) return b.duplicate_count - a.duplicate_count;
    return a.canonical_file.localeCompare(b.canonical_file);
  });

  const totalDuplicates = imageEntries.filter((e) => e.is_duplicate).length;
  const totalDupMembers = imageEntries
    .filter((e) => e.is_duplicate)
    .reduce((s, e) => s + e.duplicate_count, 0);
  const spaceSaved = totalDupMembers - totalDuplicates;

  const catalog = {
    generated_at: new Date().toISOString(),
    source: '.vision/image_vision.jsonl',
    dedup_threshold_dhash: null,
    near_dup_disabled: true,
    near_dup_disabled_reason:
      'dHash values collide across unrelated content; transitive chaining merges unrelated images. Exact-md5 grouping only.',
    total_scanned: n,
    total_canonical: imageEntries.length,
    exact_duplicate_groups: exactGroups,
    near_duplicate_groups: 0,
    total_duplicate_canonicals: totalDuplicates,
    total_duplicate_members: totalDupMembers,
    images_removable: spaceSaved,
    images: imageEntries,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2) + '\n');

  console.log(`scanned ${n} images`);
  console.log(`canonical entries: ${imageEntries.length}`);
  console.log(`exact-duplicate groups: ${exactGroups}`);
  console.log(`near-duplicate groups: 0 (disabled)`);
  console.log(`duplicate canonicals: ${totalDuplicates}`);
  console.log(`duplicate members: ${totalDupMembers}`);
  console.log(`images removable: ${spaceSaved}`);
  console.log(`wrote ${OUT_FILE}`);
}

main();
