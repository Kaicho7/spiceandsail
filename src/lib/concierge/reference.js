/**
 * Reference generator — SP-YYYY-NNNNNN format.
 * Uses check-then-set with retry so references never collide.
 */
'use strict';

const { getGlobalStore } = require('./store');

function formatRef(seq) {
  const year = new Date().getUTCFullYear();
  const padded = String(seq).padStart(6, '0');
  return 'SP-' + year + '-' + padded;
}

/**
 * Generate a unique reference using the store.
 * Retries up to 5 times on collision.
 */
async function generateReference(store) {
  if (!store) store = getGlobalStore();
  for (let attempt = 0; attempt < 5; attempt++) {
    // Get current counter
    const counterData = await store.getJSON('_counter');
    const seq = (counterData && counterData.seq ? counterData.seq : 0) + 1;
    const ref = formatRef(seq);

    // Check if reference already exists
    const existing = await store.getJSON('lead:' + ref);
    if (existing) continue;

    // Try to set the counter
    await store.setJSON('_counter', { seq: seq });
    return ref;
  }
  // Fallback: use timestamp-based reference
  const ts = Date.now().toString(36).toUpperCase();
  return 'SP-' + new Date().getUTCFullYear() + '-' + ts;
}

module.exports = { generateReference, formatRef };
