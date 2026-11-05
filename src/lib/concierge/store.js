/**
 * Store adapter — two implementations:
 *   - InMemoryStore (tests)
 *   - BlobStore (production via @netlify/blobs)
 */
'use strict';

class InMemoryStore {
  constructor() { this._data = new Map(); }
  async get(key) { return this._data.get(key) || null; }
  async set(key, value, opts) {
    if (opts && opts.onlyIfNew && this._data.has(key)) return false;
    this._data.set(key, value);
    return true;
  }
  async delete(key) { this._data.delete(key); return true; }
  async list(prefix) {
    const results = [];
    for (const [k, v] of this._data) {
      if (!prefix || k.startsWith(prefix)) results.push({ key: k, value: v });
    }
    return results;
  }
  async getJSON(key) {
    const v = await this.get(key);
    if (v == null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  async setJSON(key, value, opts) {
    return this.set(key, JSON.stringify(value), opts);
  }
  // Force failure mode for testing
  _setFailing(failing) { this._failing = failing; }
}

class FailingStore extends InMemoryStore {
  async get() { throw new Error('Store unavailable'); }
  async set() { throw new Error('Store unavailable'); }
  async setJSON() { throw new Error('Store unavailable'); }
  async getJSON() { throw new Error('Store unavailable'); }
  async list() { throw new Error('Store unavailable'); }
}

// BlobStore wraps @netlify/blobs for production
class BlobStore {
  constructor(storeName, lambdaEvent) {
    this._storeName = storeName;
    this._event = lambdaEvent;
    this._store = null;
  }
  _getStore() {
    if (!this._store) {
      try {
        const { getStore } = require('@netlify/blobs');
        this._store = getStore({ name: this._storeName, consistency: 'strong' });
      } catch (e) {
        throw new Error('Netlify Blobs not available: ' + e.message);
      }
    }
    return this._store;
  }
  async get(key) {
    return this._getStore().get(key);
  }
  async set(key, value) {
    await this._getStore().set(key, value);
    return true;
  }
  async setJSON(key, value) {
    await this._getStore().setJSON(key, value);
    return true;
  }
  async getJSON(key) {
    return this._getStore().getJSON(key);
  }
  async delete(key) {
    await this._getStore().delete(key);
    return true;
  }
  async list(prefix) {
    const result = await this._getStore().list({ prefix: prefix });
    return (result.blobs || []).map(function (b) { return { key: b.key }; });
  }
}

// Global store instance for the process
let _store = null;

function createStore(type, opts) {
  if (type === 'memory') return new InMemoryStore();
  if (type === 'failing') return new FailingStore();
  if (type === 'blob') return new BlobStore(opts && opts.storeName || 'concierge-leads', opts && opts.event);
  return new InMemoryStore();
}

function getGlobalStore() {
  if (!_store) {
    // In Netlify functions, use blobs; otherwise memory
    if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
      _store = createStore('blob');
    } else {
      _store = createStore('memory');
    }
  }
  return _store;
}

function setGlobalStore(store) { _store = store; }

module.exports = { InMemoryStore, FailingStore, BlobStore, createStore, getGlobalStore, setGlobalStore };
