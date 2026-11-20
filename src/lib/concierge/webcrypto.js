/**
 * Web Crypto helpers — available in Cloudflare Workers, Node 20+, and browsers.
 * Used instead of require('node:crypto') so Cloudflare Pages Functions bundle
 * without depending on nodejs_compat resolution at bundle time.
 */
'use strict';

function toHex(bytes) {
  return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function randomBytesHex(n) {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return toHex(buf);
}

function randomInt(min, max) {
  const range = max - min;
  if (range <= 0) return min;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  let v;
  do {
    globalThis.crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return min + (v % range);
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

module.exports = { sha256Hex, randomBytesHex, randomInt };
