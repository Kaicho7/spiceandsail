'use strict';

const test = require('node:test');
const assert = require('node:assert');

delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_COMPAT_BASE_URL;
delete process.env.OPENAI_COMPAT_API_KEY;

const { handler } = require('../netlify/functions/chat');

async function ask(message) {
  const res = await handler({
    httpMethod: 'POST',
    headers: { origin: 'https://spiceandsail.com' },
    body: JSON.stringify({ message, profile: {}, history: [] }),
  });
  return JSON.parse(res.body);
}

test('availability questions get a handoff, not a guessed answer', async () => {
  const body = await ask('Is Safari Blue available on 12 December for 2 adults?');
  assert.match(body.message, /Live Availability/);
  assert.match(body.whatsapp_url, /^https:\/\/wa\.me\//);
});

test('private vs shared tour questions are recognised', async () => {
  const body = await ask('Do you offer shared tours?');
  assert.match(body.message, /Private vs Shared Tours/);
});

test('family quote includes a child-pricing note', async () => {
  const body = await ask('Family of 4 price for Safari Blue');
  assert.match(body.message, /Family:/);
  assert.match(body.message, /child pricing/i);
});

test('WhatsApp booking handoff carries the guest name', async () => {
  const body = await ask('My name is John Smith, book Safari Blue for 2 adults.');
  assert.match(decodeURIComponent(body.whatsapp_url), /Name: John Smith/);
});
