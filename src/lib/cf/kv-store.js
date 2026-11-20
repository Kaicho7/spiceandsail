/**
 * Cloudflare KV store adapter. Same interface as the Netlify Blobs store in
 * src/lib/concierge/store.js, so lead.js / chat.js / security.js / reference.js
 * work unchanged.
 *
 * KV is eventually consistent: fine for leads, references and rate limits at
 * this volume. If you later need bookings/payments with strict consistency,
 * move those records to D1.
 */
'use strict';

// KV expirations must be >= 60 seconds.
function ttlFor(key) {
  if (key.startsWith('rl:')) return 7200;      // rate-limit windows
  if (key.startsWith('_res:')) return 3600;    // reference reservations
  if (key.startsWith('idem:')) return 86400;   // double-submit protection
  return undefined;                            // leads etc. are kept forever
}

class KVStore {
  constructor(kv) { this._kv = kv; }

  async get(key) { return this._kv.get(key); }

  async set(key, value, opts) {
    if (opts && opts.onlyIfNew) {
      if ((await this._kv.get(key)) !== null) return false;
    }
    const ttl = ttlFor(key);
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    await this._kv.put(key, str, ttl ? { expirationTtl: ttl } : undefined);
    return true;
  }

  async getJSON(key) {
    const v = await this._kv.get(key);
    if (v === null || v === undefined) return null;
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  async setJSON(key, value, opts) { return this.set(key, JSON.stringify(value), opts); }

  async delete(key) { await this._kv.delete(key); return true; }

  async list(prefix) {
    const out = [];
    let cursor;
    do {
      const page = await this._kv.list({ prefix: prefix || '', cursor });
      page.keys.forEach(function (k) { out.push({ key: k.name }); });
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return out;
  }
}

module.exports = { KVStore };
