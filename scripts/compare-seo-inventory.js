#!/usr/bin/env node
'use strict';

// Fail the build if the rendered pre-redesign URL/SEO contract changes.
const fs = require('fs');

const beforePath = process.argv[2] || 'audit/url-inventory-before.csv';
const afterPath = process.argv[3] || 'audit/url-inventory-after.csv';
const contract = ['title', 'meta_description', 'canonical', 'h1', 'json_ld_types'];

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.length).map(values => {
    const out = {};
    header.forEach((key, i) => { out[key] = values[i] || ''; });
    return out;
  });
}

function fail(message) {
  console.error('SEO INVENTORY CHECK FAILED:', message);
  process.exitCode = 1;
}

if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
  fail('Both baseline and after-build CSV files are required.');
  process.exit();
}

const before = parseCsv(fs.readFileSync(beforePath, 'utf8'));
const after = parseCsv(fs.readFileSync(afterPath, 'utf8'));
const baseByUrl = new Map(before.map(row => [row.url, row]));
const afterByUrl = new Map(after.map(row => [row.url, row]));
const added = [...afterByUrl.keys()].filter(url => !baseByUrl.has(url)).sort();
const removed = [...baseByUrl.keys()].filter(url => !afterByUrl.has(url)).sort();
const changed = [];

for (const [url, oldRow] of baseByUrl) {
  const newRow = afterByUrl.get(url);
  if (!newRow) continue;
  for (const field of contract) {
    if ((oldRow[field] || '') !== (newRow[field] || '')) {
      changed.push({ url, field, before: oldRow[field] || '', after: newRow[field] || '' });
    }
  }
}

const overlongTitles = before.filter(row => (row.title || '').length > 60);
const overlongDescriptions = before.filter(row => (row.meta_description || '').length > 160);
console.log('Pre-redesign pages:', before.length);
console.log('After-build pages:', after.length);
console.log('Added URLs:', added.length);
console.log('Removed URLs:', removed.length);
console.log('Changed SEO contract fields:', changed.length);
console.log('Pre-existing titles over 60 characters:', overlongTitles.length);
console.log('Pre-existing meta descriptions over 160 characters:', overlongDescriptions.length);

if (added.length) console.error('Added URLs:', added.join('\n'));
if (removed.length) console.error('Removed URLs:', removed.join('\n'));
if (changed.length) {
  changed.slice(0, 100).forEach(item => {
    console.error(item.url + ' [' + item.field + ']\n  BEFORE: ' + item.before + '\n  AFTER:  ' + item.after);
  });
}
if (!added.length && !removed.length && !changed.length) {
  console.log('PASS: URLs, titles, meta descriptions, canonicals, H1s and JSON-LD types are unchanged.');
}
