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

test('gate 2: UI/response reference equals stored reference equals staff alert reference', async () => {
  process.env.STAFF_PASSCODE = 'gate-2-ref-check';
  setGlobalStore(new InMemoryStore());
  const { handler: leadHandler } = require('../netlify/functions/lead');
  const { handler: adminHandler } = require('../netlify/functions/admin-leads');

  const body = { ...leadBody('gate-2-1'), name: 'Gate Two Guest' };
  const createdResp = await leadHandler(ev('/lead', body, '10.0.0.21'));
  assert.ok(createdResp.statusCode >= 200 && createdResp.statusCode < 300,
    'lead accepted: ' + createdResp.statusCode + ' ' + createdResp.body);
  const created = JSON.parse(createdResp.body || '{}');
  const ref = created.reference;
  assert.ok(/^SP-\d{4}-\d+$/.test(ref), 'response reference: ' + ref);

  const listResp = await adminHandler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer gate-2-ref-check' },
    path: '/admin-leads'
  });
  assert.strictEqual(listResp.statusCode, 200, 'staff list reachable: ' + listResp.statusCode + ' ' + listResp.body);
  const stored = JSON.parse(listResp.body || '{}').leads || [];
  const found = stored.find((l) => l.reference === ref);
  assert.ok(found, 'stored lead carries the response reference: ' + ref);
  assert.strictEqual(found.reference, ref, 'stored reference equals response reference');
  assert.ok((found.whatsapp_brief || '').includes('Lead ' + ref),
    'staff alert (WhatsApp brief) references the lead: ' + ref);
  delete process.env.STAFF_PASSCODE;
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

test('gate 14a: GET /quote lists catalogue slugs, pricing basis, reply window', async () => {
  const { handler } = require('../netlify/functions/quote');
  const r = await handler({ httpMethod: 'GET', headers: {}, path: '/quote' });
  assert.strictEqual(r.statusCode, 200, 'quote GET should be 200, got ' + r.statusCode + ' ' + r.body);
  const j = JSON.parse(r.body);
  assert.ok(Array.isArray(j.services) && j.services.length > 0, 'services array expected: ' + r.body.slice(0, 200));
  for (const s of j.services) {
    assert.ok(typeof s.slug === 'string' && s.slug.length > 0, 'each service needs a slug: ' + JSON.stringify(s));
    assert.ok(typeof s.name === 'string' && s.name.length > 0, 'each service needs a name: ' + JSON.stringify(s));
    assert.ok(s.onRequest === true || s.onRequest === false, 'onRequest must be a boolean: ' + JSON.stringify(s));
    if (!s.onRequest) {
      assert.ok(/^\$[\d,]+–\$[\d,]+/.test(String(s.priceDisplay || '')), 'priced services show a range: ' + JSON.stringify(s));
    }
  }
  assert.ok(typeof j.replyWindow === 'string' && j.replyWindow.length > 0, 'replyWindow (hours wording) must come from config: ' + r.body.slice(0, 200));
  assert.ok(j.services.some((s) => s.slug === 'airport-transfer-znz-to-nungwikendwa'), 'nungwi transfer slug present');
});

