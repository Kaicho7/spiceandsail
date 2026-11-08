'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { handler: leadHandler } = require('../netlify/functions/lead');
const { handler: chatHandler } = require('../netlify/functions/chat');
const { generateReference } = require('../src/lib/concierge/reference');
const { InMemoryStore, setGlobalStore } = require('../src/lib/concierge/store');
const catalogue = require('../src/data/concierge-catalogue.json');

function mockEvent(path, body, ip) {
  return {
    httpMethod: 'POST',
    path: path || '/lead',
    headers: {
      origin: 'https://spiceandsail.com',
      'client-ip': ip || '198.51.100.42'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

test('audit fix A04: lead.js reply_link must target Spice & Sail (255672450934), never the guest number', async () => {
  setGlobalStore(new InMemoryStore());
  const guestPhone = '+14155552671'; // guest US number
  const guestEmail = 'guest.traveler@example.com';
  
  const payload = {
    name: 'Jane Doe',
    whatsapp: guestPhone,
    email: guestEmail,
    travellers: 2,
    date: '2026-12-15',
    services: ['safari-blue'],
    notes: 'Airport arrival 14:00',
    consent_contact: true,
    consent_marketing: false,
    privacy_notice_version: 'v1.0'
  };

  const response = await leadHandler(mockEvent('/lead', payload));
  assert.strictEqual(response.statusCode, 201, 'lead submission must return 201 Created');
  const resBody = JSON.parse(response.body);
  
  assert.ok(resBody.reference, 'must return a reference');
  assert.ok(resBody.reply_link, 'must return a reply_link');
  
  // CRITICAL: reply_link must target the business desk 255672450934, NOT the guest's 14155552671
  assert.ok(
    resBody.reply_link.startsWith('https://wa.me/255672450934'),
    'reply_link must point to wa.me/255672450934 but got: ' + resBody.reply_link
  );
  assert.ok(
    !resBody.reply_link.includes('14155552671'),
    'reply_link must NOT message the guest phone number'
  );
  assert.ok(
    resBody.reply_link.includes(resBody.reference),
    'reply_link must include the reference number'
  );
});

test('audit fix A01: concurrent reference generation has zero collisions', async () => {
  const store = new InMemoryStore();
  const CONCURRENT_REQUESTS = 30;
  
  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(generateReference(store));
  }
  
  const refs = await Promise.all(promises);
  assert.strictEqual(refs.length, CONCURRENT_REQUESTS);
  
  // Verify all references match format SP-YYYY-NNNNNN
  for (const ref of refs) {
    assert.match(ref, /^SP-\d{4}-\d+$/, 'ref must match SP-YYYY-NNNNNN: ' + ref);
  }
  
  // Verify zero collisions
  const uniqueRefs = new Set(refs);
  assert.strictEqual(
    uniqueRefs.size,
    CONCURRENT_REQUESTS,
    `Collision detected! Expected ${CONCURRENT_REQUESTS} unique refs, got ${uniqueRefs.size}`
  );
});

test('audit fix A10: catalogue and chat deposit policy reconciliation', async () => {
  // 1. Catalogue configuration
  assert.strictEqual(catalogue.config.depositPercent, 0, 'Transfers must have 0% advance deposit');
  assert.strictEqual(catalogue.config.seaTourDepositPercent, 20, 'Sea tours must have 20% advance deposit');
  assert.strictEqual(catalogue.config.safariDepositPercent, 30, 'Safaris must have 30% advance deposit');
  assert.ok(catalogue.config.depositPolicy, 'Deposit policy object must be defined');

  // 2. Chat response transparency
  const chatEvent = mockEvent('/chat', {
    message: 'How do I book? Do I need to pay a deposit?',
    profile: {}
  });

  const chatResp = await chatHandler(chatEvent);
  assert.strictEqual(chatResp.statusCode, 200);
  const chatBody = JSON.parse(chatResp.body);
  
  assert.ok(
    chatBody.message.includes('Zero advance deposit') || chatBody.message.includes('Zero Advance Deposit') || chatBody.message.includes('zero prepayment'),
    'Chat must clarify zero prepayment for transfers'
  );
  assert.ok(
    chatBody.message.includes('deposit'),
    'Chat must transparently disclose deposit policy'
  );
  assert.ok(
    chatBody.message.includes('Weather Guarantee') || chatBody.message.includes('weather'),
    'Chat must disclose weather policy'
  );
});

test('audit fix A08: chat separates discussed_services from focused booking service', async () => {
  // Simulate 3 turns discussing different tours
  let profile = {};
  
  // Turn 1: user asks about Mnemba
  let res = await chatHandler(mockEvent('/chat', { message: 'Tell me about Mnemba Atoll', profile }));
  profile = JSON.parse(res.body).profile;
  assert.deepStrictEqual(profile.serviceSlugs, ['mnemba-snorkeling']);
  
  // Turn 2: user asks about Jozani
  res = await chatHandler(mockEvent('/chat', { message: 'What about Jozani Forest?', profile }));
  profile = JSON.parse(res.body).profile;
  assert.deepStrictEqual(profile.serviceSlugs, ['jozani-forest']);
  assert.ok(profile.discussed_services.includes('mnemba-snorkeling'));
  assert.ok(profile.discussed_services.includes('jozani-forest'));
  
  // Turn 3: user decides to book Safari Blue
  res = await chatHandler(mockEvent('/chat', { message: 'I want to book Safari Blue', profile }));
  const finalBody = JSON.parse(res.body);
  assert.ok(finalBody.whatsapp_url, 'Should return WhatsApp URL for booking intent');
  
  // URL should target Safari Blue, NOT a concatenation of Mnemba + Jozani + Safari Blue
  const decodedUrl = decodeURIComponent(finalBody.whatsapp_url);
  assert.ok(decodedUrl.includes('Safari Blue'), 'WhatsApp URL must mention Safari Blue');
  assert.ok(!decodedUrl.includes('Jozani'), 'WhatsApp booking link must not bundle discarded Jozani tour');
  assert.ok(!decodedUrl.includes('Mnemba'), 'WhatsApp booking link must not bundle discarded Mnemba tour');
});
