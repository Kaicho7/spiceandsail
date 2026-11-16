#!/usr/bin/env node
'use strict';

// Generate local WebP variants for the Lighthouse/CI static build. Netlify
// builds keep using the Image CDN, which already produces AVIF/WebP on demand.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NETLIFY_BUILD = process.env.NETLIFY === 'true' ||
  Boolean(process.env.DEPLOY_PRIME_URL || process.env.URL);
const WIDTHS = [480, 768, 1200, 1600];

if (NETLIFY_BUILD) {
  console.log('local-responsive: skipped (Netlify Image CDN build)');
  process.exit(0);
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run Eleventy before generating local variants');
  process.exit(1);
}

function walk(dir, callback) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file, callback);
    else if (/\.html?$/i.test(item.name)) callback(file);
  }
}

function localImagePath(value) {
  let src = String(value || '').replace(/&amp;/g, '&');
  if (/^(?:data:|https?:|\/\/)/i.test(src)) return null;
  try { src = decodeURIComponent(src); } catch (_) {}
  src = src.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  if (src.startsWith('images/')) src = src.slice(7);
  if (!src || src.includes('..') || !/\.(?:jpe?g|png|webp)$/i.test(src)) return null;
  return '/images/' + src;
}

const referenced = new Set();
walk(DIST, file => {
  const html = fs.readFileSync(file, 'utf8');
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const src = (tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []);
    const value = src[1] !== undefined ? src[1] : src[2] !== undefined ? src[2] : src[3];
    const imagePath = localImagePath(value);
    if (imagePath) referenced.add(imagePath);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel\s*=\s*["']?preload["']?/i.test(tag) || !/\bas\s*=\s*["']?image["']?/i.test(tag)) continue;
    const href = (tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []);
    const value = href[1] !== undefined ? href[1] : href[2] !== undefined ? href[2] : href[3];
    const imagePath = localImagePath(value);
    if (imagePath) referenced.add(imagePath);
  }
});

function variantPath(imagePath, width) {
  const rel = imagePath.replace(/^\/images\//, '').replace(/\.(?:jpe?g|png|webp)$/i, '');
  return path.join('images', '__resp', rel + '-' + width + '.webp');
}

async function main() {
  const started = Date.now();
  const jobs = [];
  for (const imagePath of referenced) {
    const source = path.join(DIST, imagePath.replace(/^\//, ''));
    if (!fs.existsSync(source)) continue;
    let metadata;
    try {
      metadata = await sharp(source).metadata();
    } catch (error) {
      console.warn('local-responsive: skipped unreadable ' + imagePath + ' (' + error.message + ')');
      continue;
    }
    if (!metadata.width) continue;
    for (const width of WIDTHS) {
      if (width > metadata.width) continue;
      const out = path.join(DIST, variantPath(imagePath, width));
      if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(source).mtimeMs) continue;
      jobs.push({ source, out, width });
    }
  }

  let done = 0;
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      fs.mkdirSync(path.dirname(job.out), { recursive: true });
      try {
        await sharp(job.source)
          .resize({ width: job.width, withoutEnlargement: true })
          .webp({ quality: 72, effort: 4 })
          .toFile(job.out);
      } catch (error) {
        console.warn('local-responsive: failed ' + job.source + ' @' + job.width + ' (' + error.message + ')');
      }
      done++;
      if (done % 100 === 0) console.log('local-responsive: ' + done + '/' + jobs.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log('local-responsive: ' + referenced.size + ' referenced images; ' +
    done + ' WebP variants in ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
}

main().catch(error => {
  console.error('local-responsive failed:', error);
  process.exit(1);
});
