const test = require('node:test');
const assert = require('node:assert');
const { InMemoryStore, FailingStore, setGlobalStore } = require('../src/lib/concierge/store');

const origin = undefined;
function ev(path, bodyObj, ip) {
  return { httpMethod: 'POST', headers: { 'x-forwarded-for': ip, 'x-nf-client-connection-ip': ip },
           body: JSON.stringify(bodyObj), path };
}
const leadBody = (sid) => ({
  name: 'Test Guest', whatsapp: '+255672450934', email: 'test@example.com',
  notes: 'Test lead', consent_contact: true, consent_marketing: false,
  privacy_notice_version: 'v1.0', session_id: sid,
  honeypot: '', form_loaded_at: Date.now() - 10000
});

test('gate 1a (control): lead succeeds with a working store', async () => {
  setGlobalStore(new InMemoryStore());
  const { handler } = require('../netlify/functions/lead');
  const r = await handler(ev('/lead', leadBody('ctl-1'), '10.0.0.1'));
  assert.ok(r.statusCode >= 200 && r.statusCode < 300,
    'control lead should succeed; got ' + r.statusCode + ' ' + r.body);
  assert.ok(/SP-\d{4}-\d+/.test(r.body), 'success must contain a reference: ' + r.body);
});

test('gate 1b: forced store failure never returns success', async () => {
  setGlobalStore(new FailingStore());
  const { handler } = require('../netlify/functions/lead');
  let r, threw = false;
  try { r = await handler(ev('/lead', leadBody('fail-1'), '10.0.0.2')); } catch (e) { threw = true; }
  if (!threw) {
    assert.ok(r.statusCode >= 500, 'store failure must give 5xx, got ' + r.statusCode + ' ' + r.body);
    assert.ok(!/SP-\d{4}-\d+/.test(r.body), 'must not return a reference when nothing was stored');
  }
  setGlobalStore(new InMemoryStore());
});

test('gate 11: floors, using real catalogue slugs', () => {
  const { quotePlan } = require('../src/lib/concierge/pricing');
  const cases = [['mnemba-snorkeling', 70], ['airport-transfer-znz-to-stone-town', 35]];
  for (const [slug, floor] of cases) {
    const q = quotePlan([slug], 1, 0).perService[0];
    const text = JSON.stringify(q);
    assert.ok(!/not found in the catalogue/i.test(text), slug + ' not found in catalogue');
    if (q.totalLow === null || q.totalLow === undefined) {
      console.warn('NOTE: ' + slug + ' is price-on-request (basis=' + q.basis + ') - owner decision');
    } else {
      assert.ok(q.totalLow >= floor, slug + ' floor ' + q.totalLow + ' < ' + floor);
    }
  }
});

test('gate 12: chat gives a useful reply with no LLM key', async () => {
  delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_COMPAT_BASE_URL; delete process.env.OPENAI_COMPAT_API_KEY;
  setGlobalStore(new InMemoryStore());
  const { handler } = require('../netlify/functions/chat');
  const r = await handler(ev('/chat', { message: 'How much is the Mnemba snorkeling trip?', session_id: 'c12' }, '10.0.0.3'));
  assert.strictEqual(r.statusCode, 200, 'chat should be 200, got ' + r.statusCode + ' ' + r.body);
  const b = JSON.parse(r.body);
  const msg = b.message || (b.reply && b.reply.message) || '';
  assert.ok(typeof msg === 'string' && msg.length > 20, 'expected a useful message: ' + r.body.slice(0, 300));
});
