/**
 * Price guardrail — every dollar figure in any bot reply must be
 * in the set of figures the server returned, otherwise discard
 * the reply and use the deterministic one.
 */
'use strict';

const PRICE_KEYS = new Set(['min', 'max', 'low', 'high', 'totalLow', 'totalHigh', 'amountLow', 'amountHigh']);

/** Collect all approved price numbers from tool results */
function collectApprovedPrices(node, acc) {
  if (!acc) acc = new Set();
  if (node == null) return acc;
  if (typeof node === 'number') return acc;
  if (typeof node === 'string') {
    const matches = node.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g);
    for (const m of matches) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n)) acc.add(n);
    }
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach(function (x) { collectApprovedPrices(x, acc); });
    return acc;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (PRICE_KEYS.has(k) && typeof v === 'number') acc.add(v);
      else collectApprovedPrices(v, acc);
    }
  }
  return acc;
}

/** Find price figures in text that are NOT in the approved set */
function unapprovedPricesIn(text, approved) {
  const bad = [];
  const matches = text.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g);
  for (const m of matches) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    if (!approved.has(n) && !bad.includes(n)) bad.push(n);
  }
  return bad;
}

/** Strip unapproved prices from text, replacing with safe wording */
function stripUnapprovedPrices(text, approved) {
  return text.replace(/\$\s?[\d,]+(?:\.\d+)?/g, function (m) {
    const n = Number(m.replace(/[$\s,]/g, ''));
    return approved.has(n) ? m : 'a rate our team confirms';
  });
}

/**
 * Check a bot reply against approved prices.
 * Returns { safe: boolean, cleaned: string, violations: number[] }
 */
function checkReply(replyText, toolResults) {
  const approved = new Set();
  if (Array.isArray(toolResults)) {
    toolResults.forEach(function (r) { collectApprovedPrices(r, approved); });
  } else if (toolResults) {
    collectApprovedPrices(toolResults, approved);
  }
  const violations = unapprovedPricesIn(replyText, approved);
  if (violations.length === 0) {
    return { safe: true, cleaned: replyText, violations: [] };
  }
  return {
    safe: false,
    cleaned: stripUnapprovedPrices(replyText, approved),
    violations: violations,
  };
}

module.exports = {
  collectApprovedPrices,
  unapprovedPricesIn,
  stripUnapprovedPrices,
  checkReply,
};
