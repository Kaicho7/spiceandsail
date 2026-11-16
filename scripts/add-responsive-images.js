#!/usr/bin/env node
'use strict';

// Add one responsive picture source set to local raster images in the rendered
// site. Netlify Image CDN creates AVIF/WebP variants on demand; local builds
// retain the same source file while still receiving sizes/decoding defaults.
// Intrinsic width/height and canonical alt text are applied by the existing
// post-build scripts that run after this helper.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NETLIFY_BUILD = process.env.NETLIFY === 'true' ||
  Boolean(process.env.DEPLOY_PRIME_URL || process.env.URL);
const WIDTHS = [480, 768, 1200, 1600];

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run Eleventy before adding responsive images');
  process.exit(1);
}

function walk(dir, callback) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file, callback);
    else if (/\.html?$/i.test(item.name)) callback(file);
  }
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = match[2] !== undefined ? match[2]
      : match[3] !== undefined ? match[3] : match[4];
  }
  return attrs;
}

function encodeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function sourceImagePath(src) {
  let value = String(src || '').replace(/&amp;/g, '&');
  if (/^(?:data:|https?:|\/\/)/i.test(value)) return null;
  if (/^\/?\.netlify\/images\?/i.test(value)) {
    const query = value.split('?')[1] || '';
    const params = new URLSearchParams(query);
    value = params.get('url') || '';
  }
  try { value = decodeURIComponent(value); } catch (_) {}
  value = value.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  if (value.startsWith('images/')) value = value.slice(7);
  if (!value || value.includes('..') || !/\.(?:jpe?g|png|webp)$/i.test(value)) return null;
  return '/images/' + value;
}

function netlifyVariant(imagePath, format, width) {
  return '/.netlify/images?url=' + encodeURIComponent(imagePath) +
    '&fm=' + format + '&w=' + width + '&q=82';
}

function makeSrcSet(imagePath, format) {
  return WIDTHS.map(width => netlifyVariant(imagePath, format, width) + ' ' + width + 'w').join(', ');
}

function localVariant(imagePath, width) {
  const rel = imagePath.replace(/^\/images\//, '').replace(/\.(?:jpe?g|png|webp)$/i, '');
  return '/images/__resp/' + rel + '-' + width + '.webp';
}

function localSrcSet(imagePath) {
  const entries = [];
  for (const width of WIDTHS) {
    const url = localVariant(imagePath, width);
    if (fs.existsSync(path.join(DIST, url.replace(/^\//, '')))) {
      entries.push(url + ' ' + width + 'w');
    }
  }
  return entries.length ? entries.join(', ') : null;
}

function setAttr(tag, name, value) {
  const replacement = ' ' + name + '="' + encodeHtml(value) + '"';
  const doubleQuoted = new RegExp('\\s' + name + '\\s*=\\s*"[^"]*"', 'i');
  const singleQuoted = new RegExp("\\s" + name + "\\s*=\\s*'[^']*'", 'i');
  const unquoted = new RegExp('\\s' + name + '\\s*=\\s*[^\\s>]+', 'i');
  if (doubleQuoted.test(tag)) return tag.replace(doubleQuoted, replacement);
  if (singleQuoted.test(tag)) return tag.replace(singleQuoted, replacement);
  if (unquoted.test(tag)) return tag.replace(unquoted, replacement);
  return tag.replace(/\s*\/?>$/, replacement + '$&');
}

let scanned = 0;
let enhanced = 0;
let localFallback = 0;
walk(DIST, file => {
  const original = fs.readFileSync(file, 'utf8');
  let changed = false;
  const sizesByImage = new Map();
  let output = original.replace(/<img\b[^>]*>/gi, (tag, offset, whole) => {
    scanned++;
    // Skip an image already inside a picture wrapper.
    const before = whole.slice(0, offset);
    if (before.lastIndexOf('<picture') > before.lastIndexOf('</picture>')) return tag;
    const attrs = parseAttrs(tag);
    const imagePath = sourceImagePath(attrs.src);
    if (!imagePath) return tag;

    let next = tag;
    const className = attrs.class || '';
    const isHero = /(^|\s)(tour-hero-image|home-hero-image|transfer-hero-image)(\s|$)/i.test(className);
    const isCard = /card|thumb|gallery|tile|grid/i.test(className);
    const defaultSizes = isCard
      ? '(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 33vw'
      : '(max-width: 700px) 100vw, (max-width: 1200px) 80vw, 60vw';
    if (!attrs.sizes) next = setAttr(next, 'sizes', defaultSizes);
    if (!sizesByImage.has(imagePath)) sizesByImage.set(imagePath, attrs.sizes || defaultSizes);
    if (!attrs.decoding) next = setAttr(next, 'decoding', 'async');
    if (isHero) {
      next = setAttr(next, 'loading', 'eager');
      next = setAttr(next, 'fetchpriority', 'high');
    } else if (attrs.loading !== 'eager') {
      next = setAttr(next, 'loading', 'lazy');
    }

    if (!NETLIFY_BUILD) {
      const localSet = localSrcSet(imagePath);
      if (localSet) {
        next = setAttr(next, 'srcset', localSet);
        enhanced++;
      } else {
        localFallback++;
      }
      changed = changed || next !== tag;
      return next;
    }

    // Use the original local image path as the immutable fallback. The browser
    // selects a single AVIF/WebP candidate using the declared sizes value.
    const avif = '<source type="image/avif" srcset="' + encodeHtml(makeSrcSet(imagePath, 'avif')) + '" sizes="' + encodeHtml(attrs.sizes || defaultSizes) + '">';
    const webp = '<source type="image/webp" srcset="' + encodeHtml(makeSrcSet(imagePath, 'webp')) + '" sizes="' + encodeHtml(attrs.sizes || defaultSizes) + '">';
    changed = true;
    enhanced++;
    return '<picture class="sns-responsive-picture">' + avif + webp + next + '</picture>';
  });

  if (!NETLIFY_BUILD) {
    let preloadChanged = false;
    output = output.replace(/<link\b[^>]*>/gi, tag => {
      if (!/\brel\s*=\s*["']?preload["']?/i.test(tag) ||
          !/\bas\s*=\s*["']?image["']?/i.test(tag)) return tag;
      const attrs = parseAttrs(tag);
      const imagePath = sourceImagePath(attrs.href);
      if (!imagePath) return tag;
      const localSet = localSrcSet(imagePath);
      if (!localSet) return tag;
      let next = setAttr(tag, 'imagesrcset', localSet);
      next = setAttr(next, 'imagesizes', sizesByImage.get(imagePath) || '100vw');
      if (next !== tag) preloadChanged = true;
      return next;
    });
    changed = changed || preloadChanged;
  }

  if (changed) fs.writeFileSync(file, output);
});

console.log('responsive-images: scanned ' + scanned + ' img tags; responsive srcsets ' +
  enhanced + '; local fallbacks ' + localFallback);
