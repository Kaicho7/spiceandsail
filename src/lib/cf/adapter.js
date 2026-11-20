/**
 * Netlify-handler -> Cloudflare Pages Function adapter.
 *
 * Why this exists: the site moved from Netlify to Cloudflare Pages, but the
 * chatbot's server code (chat, lead, quote, catalogue, payment-link) was
 * written as Netlify Functions that read `event.httpMethod`, call
 * `@netlify/blobs`, and live at /.netlify/functions/*. Cloudflare Pages does
 * not run any of that, so every chat/lead/quote call 404s and the widget looks
 * dead or blank. This adapter lets the existing handlers run unchanged.
 */
'use strict';

const { setGlobalStore, createStore } = require('../concierge/store');
const { KVStore } = require('./kv-store');

// Copy Cloudflare env vars/secrets into process.env (handlers read process.env).
function syncEnv(env, request) {
  if (typeof process === 'undefined') return;
  process.env = process.env || {};
  Object.keys(env || {}).forEach(function (k) {
    if (typeof env[k] === 'string') process.env[k] = env[k];
  });
  // Allow the site's own origin (production domain, www, and *.pages.dev previews).
  const host = new URL(request.url).host;
  if (/(^|\.)spiceandsail\.com$/.test(host) || /\.pages\.dev$/.test(host)) {
    process.env.URL = 'https://' + host;
  }
}

function pickStore(env) {
  if (env && env.SNS_KV) return new KVStore(env.SNS_KV);
  // No KV binding: fail honestly (lead.js then answers 503 and the widget falls
  // back to WhatsApp) instead of pretending to save leads into throw-away memory.
  console.error('SNS_KV binding missing: leads cannot be saved. Add the KV binding in Pages > Settings > Functions.');
  return createStore('failing');
}

function toEvent(request, body) {
  const headers = {};
  request.headers.forEach(function (v, k) { headers[k.toLowerCase()] = v; });
  // security.getClientIP() reads this header first.
  if (headers['cf-connecting-ip']) headers['x-nf-client-connection-ip'] = headers['cf-connecting-ip'];
  const url = new URL(request.url);
  const qs = {};
  url.searchParams.forEach(function (v, k) { qs[k] = v; });
  return {
    httpMethod: request.method,
    headers: headers,
    body: body,
    rawUrl: request.url,
    path: url.pathname,
    queryStringParameters: qs,
    isBase64Encoded: false,
  };
}

function makeOnRequest(mod) {
  const handler = mod.handler || (mod.default && mod.default.handler);
  if (typeof handler !== 'function') throw new Error('adapter: module has no handler()');

  return async function onRequest(context) {
    const request = context.request;
    const env = context.env || {};
    try {
      syncEnv(env, request);
      setGlobalStore(pickStore(env));

      let body = null;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        body = await request.text();
      }
      const res = await handler(toEvent(request, body));
      const headers = new Headers(res.headers || {});
      headers.set('Cache-Control', 'no-store');
      return new Response(res.statusCode === 204 ? null : (res.body || ''), {
        status: res.statusCode || 200,
        headers: headers,
      });
    } catch (e) {
      console.error('function error', e && e.stack || e);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
  };
}

module.exports = { makeOnRequest, toEvent };
