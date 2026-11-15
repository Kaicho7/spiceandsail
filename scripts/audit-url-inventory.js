#!/usr/bin/env node
'use strict';

// Generate the pre-redesign inventory from the actual rendered Eleventy output.
// Run after npm run build. Uses only Node's built-in modules.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUTPUT = path.join(ROOT, 'audit', 'url-inventory-before.csv');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run npm run build first');
  process.exit(1);
}

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else if (/\.html?$/i.test(entry.name)) cb(full);
  }
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function attributes(tag) {
  const result = {};
  const re = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    const value = match[2] !== undefined ? match[2]
      : match[3] !== undefined ? match[3] : match[4];
    result[match[1].toLowerCase()] = decodeEntities(value);
  }
  return result;
}

function textOnly(html) {
  return decodeEntities(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')).trim();
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const a = attributes(tag);
    if ((a.name || '').toLowerCase() === name.toLowerCase()) return a.content || '';
  }
  return '';
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const a = attributes(tag);
    const rel = (a.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return a.href || '';
  }
  return '';
}

function collectTypes(value, out) {
  if (Array.isArray(value)) return value.forEach(item => collectTypes(item, out));
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (key === '@type') {
      (Array.isArray(item) ? item : [item]).forEach(type => {
        if (typeof type === 'string' && type.trim()) out.add(type.trim());
      });
    } else if (item && typeof item === 'object') {
      collectTypes(item, out);
    }
  }
}

function jsonLdTypes(html) {
  const out = new Set();
  const re = /<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      collectTypes(JSON.parse(match[1]), out);
    } catch (_) {
      // Preserve visibility of a malformed existing block rather than silently
      // treating its schema as absent.
      const types = match[1].matchAll(/"@type"\s*:\s*(\[[^\]]*\]|"[^"]+")/g);
      for (const typeMatch of types) {
        typeMatch[1].replace(/[\[\]"]/g, '').split(',').forEach(type => {
          if (type.trim()) out.add(type.trim());
        });
      }
    }
  }
  return [...out].join(';');
}

function pageUrl(file) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

function csv(value) {
  return '"' + String(value == null ? '' : value)
    .replace(/"/g, '""')
    .replace(/[\r\n]+/g, ' ') + '"';
}

const rows = [];
walk(DIST, file => {
  const html = fs.readFileSync(file, 'utf8');
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  rows.push({
    url: pageUrl(file),
    title: titleMatch ? textOnly(titleMatch[1]) : '',
    description: metaContent(html, 'description'),
    canonical: canonicalHref(html),
    h1: h1Match ? textOnly(h1Match[1]) : '',
    jsonld: jsonLdTypes(html),
    source: path.relative(ROOT, file).split(path.sep).join('/')
  });
});
rows.sort((a, b) => a.url.localeCompare(b.url));

const header = [
  'url', 'title', 'meta_description', 'canonical',
  'h1', 'json_ld_types', 'rendered_file'
];
const output = [
  header.join(','),
  ...rows.map(row => [
    row.url, row.title, row.description, row.canonical,
    row.h1, row.jsonld, row.source
  ].map(csv).join(','))
].join('\n') + '\n';

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);

const missing = {
  title: rows.filter(row => !row.title).length,
  description: rows.filter(row => !row.description).length,
  canonical: rows.filter(row => !row.canonical).length,
  h1: rows.filter(row => !row.h1).length
};
console.log('URL/SEO inventory:', rows.length, 'rendered pages');
console.log('Missing fields:', JSON.stringify(missing));
console.log('Wrote:', path.relative(ROOT, OUTPUT));
if (!rows.length) process.exit(1);
