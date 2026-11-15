#!/usr/bin/env node
"use strict";
// Adds responsive AVIF/WebP sources from local assets using Netlify Image CDN.
// It never downloads, replaces, renames or deletes image files.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const useNetlifyCdn = Boolean(process.env.NETLIFY || process.env.URL || process.env.DEPLOY_PRIME_URL);
const widths = [320, 480, 800, 1200, 1600];
if (!fs.existsSync(DIST)) {
  console.error("dist/ not found — run Eleventy first");
  process.exit(1);
}
function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, callback);
    else if (/\.html?$/i.test(entry.name)) callback(full);
  }
}
function readAttr(tag, key) {
  const prefix = key.toLowerCase() + '="';
  const at = tag.toLowerCase().indexOf(prefix);
  if (at < 0) return "";
  const start = at + prefix.length;
  const end = tag.indexOf('"', start);
  return end < 0 ? "" : tag.slice(start, end);
}
function writeAttr(tag, key, value) {
  const prefix = key.toLowerCase() + '="';
  const at = tag.toLowerCase().indexOf(prefix);
  if (at >= 0) {
    const start = at + prefix.length;
    const end = tag.indexOf('"', start);
    if (end >= 0) return tag.slice(0, start) + value + tag.slice(end);
  }
  const close = tag.lastIndexOf("/>");
  if (close >= 0) return tag.slice(0, close) + " " + key + '="' + value + '"' + tag.slice(close);
  const end = tag.lastIndexOf(">");
  return end < 0 ? tag : tag.slice(0, end) + " " + key + '="' + value + '"' + tag.slice(end);
}
function localAsset(src) {
  try {
    const parsed = new URL(src.replace(/&amp;/g, "&"), "https://local.invalid");
    let value = parsed.searchParams.get("url") || parsed.pathname;
    value = decodeURIComponent(value).replace(/^\/+/, "");
    if (value.startsWith("images/")) value = value.slice("images/".length);
    return value.split(/[?#]/)[0];
  } catch (_) {
    return "";
  }
}
function responsiveSet(asset, format) {
  const original = "/images/" + asset;
  return widths.map(function(width) {
    return "/.netlify/images?url=" + encodeURIComponent(original) + "&fm=" + format + "&w=" + width + "&q=80 " + width + "w";
  }).join(", ");
}
let scanned = 0;
let responsive = 0;
let adjusted = 0;
let skipped = 0;
walk(DIST, function(file) {
  let html = fs.readFileSync(file, "utf8");
  scanned++;
  let firstContentImage = false;
  let modified = false;
  html = html.replace(/<img\b[^>]*>/gi, function(original, offset) {
    // The dedicated responsiveImage macro already emitted picture/source elements.
    const before = html.slice(0, offset);
    if (before.lastIndexOf("<picture") > before.lastIndexOf("</picture")) {
      const pictureSource = readAttr(original, "src");
      const pictureAsset = getAsset(pictureSource);
      if (pictureAsset && !/(?:logo|favicon|icon|avatar)/i.test(pictureAsset)) firstContentImage = true;
      return original;
    }
    let tag = original;
    const src = readAttr(tag, "src");
    if (!src || /^(data:|https?:|\/\/)/i.test(src)) {
      skipped++;
      return tag;
    }
    const asset = localAsset(src);
    if (!asset || /\.svg$/i.test(asset)) {
      skipped++;
      return tag;
    }
    const decorative = /(?:logo|favicon|icon|avatar)/i.test(asset);
    const isHero = !decorative && !firstContentImage;
    if (isHero) firstContentImage = true;
    if (!readAttr(tag, "loading") || (isHero && readAttr(tag, "loading") === "lazy")) {
      tag = writeAttr(tag, "loading", isHero ? "eager" : "lazy");
    }
    if (!readAttr(tag, "decoding")) tag = writeAttr(tag, "decoding", "async");
    if (!readAttr(tag, "sizes")) tag = writeAttr(tag, "sizes", "(max-width: 48rem) 100vw, 50vw");
    if (isHero && !readAttr(tag, "fetchpriority")) tag = writeAttr(tag, "fetchpriority", "high");
    if (!readAttr(tag, "width") || !readAttr(tag, "height") || !readAttr(tag, "alt")) {
      skipped++;
      if (tag !== original) modified = true;
      return tag;
    }
    if (!useNetlifyCdn) {
      if (tag !== original) modified = true;
      adjusted++;
      return tag;
    }
    const sizes = readAttr(tag, "sizes");
    const picture = '<picture><source type="image/avif" srcset="' + responsiveSet(asset, "avif") + '" sizes="' + sizes + '"><source type="image/webp" srcset="' + responsiveSet(asset, "webp") + '" sizes="' + sizes + '">' + tag + '</picture>';
    responsive++;
    modified = true;
    return picture;
  });
  if (modified) fs.writeFileSync(file, html);
});
console.log("responsive-images: " + responsive + " responsive images, " + adjusted + " local image tags checked, " + skipped + " skipped across " + scanned + " HTML files; Netlify CDN=" + useNetlifyCdn);
