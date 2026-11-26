'use strict';
// Runs the REAL Pages Function entry points with a fake KV, the way Cloudflare calls them.
const test = require('node:test');
const assert = require('node:assert');

class FakeKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list(o) { const keys = [...this.m.keys()].filter(k => k.startsWith((o && o.prefix) || '')).map(name => ({ name })); return { keys, list_complete: true }; }
}

async function call(name, method, body, kv, headers, extraEnv) {
  const mod = await import('../functions/api/' + name + '.js');
  const req = new Request('https://spiceandsail.com/api/' + name, {
    method,
    headers: Object.assign({ 'content-type': 'application/json', origin: 'https://spiceandsail.com', 'cf-connecting-ip': '203.0.113.7' }, headers || {}),
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const env = kv === null ? Object.assign({}, extraEnv || {}) : Object.assign({ SNS_KV: kv }, extraEnv || {});
  return mod.onRequest({ request: req, env });
}

const lead = (o) => Object.assign({
  name: 'Test Guest', whatsapp: '+255672450934', consent_contact: true, consent_marketing: false,
  travellers: 3, services: 'safari-blue', date: '2026-12-20', session_id: 's1',
}, o || {});

test('GET /api/quote returns the catalogue', async () => {
  const res = await call('quote', 'GET', null, new FakeKV());
  assert.strictEqual(res.status, 200);
  const j = await res.json();
  assert.ok(JSON.stringify(j).length > 500);
});

test('POST /api/lead saves to KV and returns an SP reference', async () => {
  const kv = new FakeKV();
  const res = await call('lead', 'POST', lead(), kv);
  assert.strictEqual(res.status, 201, await res.clone().text());
  const out = await res.json();
  assert.match(out.reference, /^SP-\d{4}-\d+$/);
  assert.ok(kv.m.has('lead:' + out.reference), 'lead must be persisted in KV');
});

test('lead: old camelCase widget payload also works (normaliser)', async () => {
  const res = await call('lead', 'POST', { name: 'Old Widget', whatsapp: '+255 672 450 934', consentContact: true, adults: 2, children: 1, serviceSlugs: ['safari-blue'] }, new FakeKV());
  assert.strictEqual(res.status, 201, await res.clone().text());
});

test('lead: no KV binding fails honestly with 503 (never fake success)', async () => {
  const res = await call('lead', 'POST', lead({ name: 'No Kv' }), null);
  assert.strictEqual(res.status, 503);
});

test('lead: missing consent is rejected', async () => {
  const res = await call('lead', 'POST', lead({ consent_contact: false }), new FakeKV());
  assert.strictEqual(res.status, 400);
});

test('lead: foreign origin is rejected', async () => {
  const res = await call('lead', 'POST', lead(), new FakeKV(), { origin: 'https://evil.example' });
  assert.strictEqual(res.status, 403);
});

test('POST /api/chat answers a greeting from the catalogue', async () => {
  const res = await call('chat', 'POST', { message: 'How much is Safari Blue?', profile: {}, history: [], session_id: 's2' }, new FakeKV());
  assert.strictEqual(res.status, 200, await res.clone().text());
  const j = await res.json();
  assert.ok(j.message && j.message.length > 10);
});

test('CORS preflight returns 204', async () => {
  const res = await call('chat', 'OPTIONS', null, new FakeKV());
  assert.strictEqual(res.status, 204);
});

test('reviews: moderate requires STAFF_PASSCODE (503/401/200) and GET aggregates without serviceSlug', async () => {
  const kv = new FakeKV();
  const prevPass = process.env.STAFF_PASSCODE;
  try {
    const subRes = await call('reviews', 'POST', {
      action: 'submit',
      bookingRef: 'SP-2026-000123',
      phone: '+255707939265',
      serviceSlug: 'safari-blue',
      rating: 5,
      text: 'Wonderful day on the sandbank',
      authorName: 'Test Reviewer'
    }, kv);
    assert.strictEqual(subRes.status, 201);
    const { reviewId } = await subRes.json();
    assert.ok(reviewId);

    delete process.env.STAFF_PASSCODE;
    const unconf = await call('reviews', 'POST', {
      action: 'moderate',
      reviewId,
      serviceSlug: 'safari-blue',
      status: 'approved'
    }, kv);
    assert.strictEqual(unconf.status, 503);

    const noAuth = await call('reviews', 'POST', {
      action: 'moderate',
      reviewId,
      serviceSlug: 'safari-blue',
      status: 'approved'
    }, kv, null, { STAFF_PASSCODE: 'secret-staff-key' });
    assert.strictEqual(noAuth.status, 401);

    const badAuth = await call('reviews', 'POST', {
      action: 'moderate',
      reviewId,
      serviceSlug: 'safari-blue',
      status: 'approved'
    }, kv, { authorization: 'Bearer wrong-key' }, { STAFF_PASSCODE: 'secret-staff-key' });
    assert.strictEqual(badAuth.status, 401);

    const okAuth = await call('reviews', 'POST', {
      action: 'moderate',
      reviewId,
      serviceSlug: 'safari-blue',
      status: 'approved'
    }, kv, { authorization: 'Bearer secret-staff-key' }, { STAFF_PASSCODE: 'secret-staff-key' });
    assert.strictEqual(okAuth.status, 200);

    const getAll = await call('reviews', 'GET', null, kv);
    assert.strictEqual(getAll.status, 200);
    const listData = await getAll.json();
    assert.strictEqual(listData.approved, 1);
    assert.strictEqual(listData.avgRating, '5.0');
    assert.strictEqual(listData.reviews[0].id, reviewId);
  } finally {
    if (prevPass === undefined) delete process.env.STAFF_PASSCODE;
    else process.env.STAFF_PASSCODE = prevPass;
  }
});
