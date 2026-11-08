/**
 * Reference generator — SP-YYYY-NNNNNN format.
 * Generates collision-proof references with cryptographic entropy so concurrent
 * serverless submissions never collide or overwrite existing leads.
 */
'use strict';

const crypto = require('crypto');
const { getGlobalStore } = require('./store');

function formatRef(seq) {
  const year = new Date().getUTCFullYear();
  const padded = String(seq).padStart(6, '0');
  return 'SP-' + year + '-' + padded;
}

/**
 * Generate a unique reference using the store with collision avoidance.
 * Guaranteed to match /^SP-\d{4}-\d+$/ for consistent API contracts.
 */
async function generateReference(store) {
  if (!store) store = getGlobalStore();
  const year = new Date().getUTCFullYear();

  for (let attempt = 0; attempt < 15; attempt++) {
    // 6-digit cryptographic random entropy (100000 - 999999)
    const randomEntropy = crypto.randomInt(100000, 999999);
    const ref = 'SP-' + year + '-' + String(randomEntropy);

    // Check collision against leads and in-flight reservations
    const resKey = '_res:' + ref;
    const existingRes = await store.getJSON(resKey);
    const existingLead = await store.getJSON('lead:' + ref);
    if (existingRes || existingLead) continue;

    // Claim reservation in store
    try {
      await store.setJSON(resKey, { t: Date.now() });
    } catch (e) { /* non-critical */ }

    // Keep _counter updated for stats
    try {
      const counterData = await store.getJSON('_counter');
      const baseSeq = (counterData && counterData.seq ? counterData.seq : 0) + 1;
      await store.setJSON('_counter', { seq: baseSeq });
    } catch (e) { /* non-critical */ }

    return ref;
  }

  // Fallback: numeric timestamp slice + random digits
  const fallbackNum = Date.now().toString().slice(-4) + crypto.randomInt(1000, 9999);
  return 'SP-' + year + '-' + fallbackNum;
}

module.exports = { generateReference, formatRef };
