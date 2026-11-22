/**
 * Store adapter — InMemoryStore (tests), FailingStore (honest failure).
 * Production Cloudflare Pages uses KVStore from src/lib/cf/kv-store.js,
 * injected by the Pages Function adapter.
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
  _setFailing(failing) { this._failing = failing; }
}

class FailingStore extends InMemoryStore {
  async get() { throw new Error('Store unavailable'); }
  async set() { throw new Error('Store unavailable'); }
  async setJSON() { throw new Error('Store unavailable'); }
  async getJSON() { throw new Error('Store unavailable'); }
  async list() { throw new Error('Store unavailable'); }
}

let _store = null;

function createStore(type) {
  if (type === 'failing') return new FailingStore();
  return new InMemoryStore();
}

function getGlobalStore() {
  if (!_store) _store = createStore('memory');
  return _store;
}

function setGlobalStore(store) { _store = store; }

module.exports = { InMemoryStore, FailingStore, createStore, getGlobalStore, setGlobalStore };
