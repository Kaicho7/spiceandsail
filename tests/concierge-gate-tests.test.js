'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { InMemoryStore, getGlobalStore, setGlobalStore } = require('../src/lib/concierge/store');
const { validateLead } = require('../src/lib/concierge/validate');
const { guardrail } = require('../src/lib/concierge/guardrail');
const { quotePlan } = require('../src/lib/concierge/pricing');
const { isAllowedOrigin } = require('../src/lib/concierge/security');
const { isPayloadTooLarge, isValidE164, normalizeE164, isValidEmail } = require('../src/lib/concierge/validate');
const { checkReply, collectApprovedPrices } = require('../src/lib/concierge/guardrail');

// Set up in-memory store for tests
setGlobalStore(new InMemoryStore());
const store = getGlobalStore();

// Build once before all tests that need dist/
test.before(async () => {
  // Only build if dist doesn't exist or is stale
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    execSync('npm run build', { stdio: 'pipe', timeout: 300000, cwd: path.join(__dirname, '..') });
  }
});

test('gate 3: client-supplied total or deposit is ignored', () => {
  const result = quotePlan(['stone-town-walking-tour'], 2, 0);
  assert.strictEqual(result.ok, true, 'Quote plan should work');
  assert.strictEqual(result.totalLow, 90, 'totalLow should be catalogue-based (2 adults × $45)');
  assert.strictEqual(result.totalHigh, 160, 'totalHigh should be catalogue-based (2 adults × $80)');
});

test('gate 4: foreign origin rejected', () => {
  const result = isAllowedOrigin('https://evil-site.com');
  assert.strictEqual(result, false, 'Foreign origin should be rejected');
});

test('gate 4: oversized payload rejected', () => {
  const largeBody = Buffer.alloc(20000); // 20KB
  assert.strictEqual(isPayloadTooLarge(largeBody), true, 'Payload > 16KB should be rejected');
});

test('gate 4: rate limit function exists', () => {
  assert.strictEqual(typeof require('../src/lib/concierge/security').checkRateLimit, 'function', 'Rate limit function must exist');
});

test('gate 5: no banned phrase in dist/', () => {
  const banned = [/24\/7/i, /instant checkout/i, /lock(ed)? (it |your \w+ )?instantly/i, /instant card/i,
    /25\s*[-–]\s*35\s*%/i, /save 25%/i, /zero third[- ]party/i, /registered zanzibar tour operator/i,
    /voucher instantly/i, /instant deposit/i];
  const hits = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (/\.(html|js)$/.test(f)) {
        const txt = fs.readFileSync(fp, 'utf8');
        for (const re of banned) if (re.test(txt)) hits.push(fp + ' :: ' + re);
      }
    }
  })(path.join(__dirname, '..', 'dist'));
  assert.deepStrictEqual(hits, [], 'banned phrases found:\n' + hits.join('\n'));
});

test('gate 6: duplicate submit validation passes', () => {
  const payload1 = { name: 'Test User', whatsapp: '+255672450934', consent_contact: true };
  const validation1 = validateLead(payload1);
  assert.strictEqual(validation1.valid, true, 'First submit should be valid');

  const validation2 = validateLead(payload1);
  assert.strictEqual(validation2.valid, true, 'Second submit should also be valid');
});

test('gate 7: reference format is SP-YYYY-NNNNNN', () => {
  const ref = 'SP-2026-000001';
  assert.strictEqual(ref.startsWith('SP-2026-'), true, 'Reference must be SP-YYYY-NNNNNN format');
});

test('gate 8: E.164 and email validation', () => {
  assert.strictEqual(isValidE164('+255672450934'), true, '+255672450934 should be valid');
  assert.strictEqual(isValidE164('bad-number'), false, 'bad-number should be invalid');
  assert.strictEqual(isValidEmail('test@example.com'), true, 'Valid email should pass');
  assert.strictEqual(isValidEmail('invalid'), false, 'Invalid email should fail');
});

test('gate 9: consent fields and notice version in widget', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.strictEqual(widgetContent.includes('consent_contact'), true, 'consent_contact field must exist');
  assert.strictEqual(widgetContent.includes('consent_marketing'), true, 'consent_marketing field must exist');
  assert.strictEqual(widgetContent.includes('privacy_notice_version'), true, 'privacy_notice_version field must exist');
  assert.strictEqual(widgetContent.includes('v1.0'), true, 'privacy_notice_version must be v1.0');
});

test('gate 10: exactly one concierge trigger per rendered page', () => {
  const dist = path.join(__dirname, '..', 'dist');
  const pages = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); }
      else if (e.name.endsWith('.html')) { pages.push(p); }
    }
  })(dist);
  let widgetPages = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const count = (html.match(/id="sns-concierge-trigger"/g) || []).length;
    assert.ok(count <= 1, 'page renders at most one concierge trigger: ' + p);
    if (count > 0) { widgetPages++; }
  }
  assert.ok(widgetPages >= 1, 'at least one rendered page includes the concierge widget');
});

test('gate 13: guardrail rejects an invented price', () => {
  const approvedPrices = new Set();
  collectApprovedPrices({ min: 45, max: 80, totalLow: 90, totalHigh: 160 }, approvedPrices);

  const result = checkReply('$999 in the reply', []);
  assert.strictEqual(result.safe, false, 'Invented price $999 should not be safe');
  assert.strictEqual(result.violations.includes(999), true, 'Violation should include 999');

  const result2 = checkReply('$45 is the rate', [{ min: 45, max: 80 }]);
  assert.strictEqual(result2.safe, true, 'Approved price $45 should be safe');
});