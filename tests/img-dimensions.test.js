'use strict';
/**
 * Gate: every local <img> in dist/*.html must carry width and height
 * attributes (CLS prevention). Preconditions: `npm run build` has run
 * (dist/ present). Run as part of `npm test` after the build in CI.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

test('every local img in built HTML has width and height attributes', () => {
  assert.ok(fs.existsSync(DIST), 'dist/ missing — run `npm run build` first');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.html$/i.test(entry.name)) {
        const html = fs.readFileSync(full, 'utf8');
        const rel = path.relative(ROOT, full);
        for (const m of html.matchAll(/<img\b[^>]*?>/gi)) {
          const tag = m[0];
          const srcM = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
          const src = srcM ? srcM[1] : '';
          if (/^(data:|https?:|\/\/)/i.test(src)) continue;
          if (!/\swidth\s*=\s*["']\d+/i.test(tag) || !/\sheight\s*=\s*["']\d+/i.test(tag)) {
            offenders.push(`${rel}: ${src}`);
          }
        }
      }
    }
  };
  walk(DIST);
  assert.deepStrictEqual(offenders, [],
    `imgs missing width/height (${offenders.length}):\n  ` + offenders.slice(0, 20).join('\n  '));
});
