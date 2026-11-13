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

test('partner hotel stay rates quote public partner rates, not net rates', async () => {
  const body = await ask('What are your stay rates at Stone Town View Hotel?');
  assert.match(body.message, /Stone Town View Hotel/);
  assert.match(body.message, /\$29/);
  assert.doesNotMatch(body.message, /\$25/);
  assert.match(body.message, /infrastructure tax/i);
});

test('The Island Stonetown quotes its own rates, separate from Stone Town View', async () => {
  const body = await ask('The Island Stonetown kokoni room prices');
  assert.match(body.message, /The Island Stonetown/);
  assert.match(body.message, /Kokoni/);
  assert.doesNotMatch(body.message, /Triple/);
});

test('partner hotel with pending rates hands off to the team', async () => {
  const body = await ask('Le Paradis stay rates');
  assert.match(body.message, /Le Paradis/);
  assert.match(body.message, /WhatsApp/);
});

test('transfer questions mentioning a partner hotel stay on transfers', async () => {
  const body = await ask('transfer to Mkeka Spice Lodge from airport');
  assert.match(body.message, /Airport Transfers/);
  assert.doesNotMatch(body.message, /Our current partner stay rates/);
});

test('sea view questions about Kokoni are answered from verified facts', async () => {
  const body = await ask('does The Island Stonetown Kokoni have sea view rooms?');
  assert.match(body.message, /The Island Stonetown/);
  assert.match(body.message, /no sea or ocean view rooms/i);
  assert.match(body.message, /city views/i);
});

test('facility questions about a partner hotel are answered without a rate guess', async () => {
  const body = await ask('does Mkeka Spice Lodge have a swimming pool and restaurant?');
  assert.match(body.message, /Mkeka Spice Lodge/);
  assert.match(body.message, /swimming pool/i);
  assert.match(body.message, /African cuisine/i);
});

test('The One quotes the official rack-based mid-season partner rate', async () => {
  const body = await ask('The One Resort Zanzibar room rates');
  assert.match(body.message, /The One Resort Zanzibar/);
  assert.match(body.message, /\$191/);
  assert.match(body.message, /15% below the hotel's own published rack rate/i);
  assert.match(body.message, /All Inclusive is also available/i);
});

test('The One quotes High season rates for an August date', async () => {
  const body = await ask('The One Resort Zanzibar room rates for 10 August');
  assert.match(body.message, /High Season/);
  assert.match(body.message, /\$230/);
  assert.doesNotMatch(body.message, /\$191/);
});

test('The One quotes Festive season rates for Christmas', async () => {
  const body = await ask('The One Resort Zanzibar rates for 25 December');
  assert.match(body.message, /Festive Season/);
  assert.match(body.message, /\$298/);
});

test('The One quotes Green season rates for May', async () => {
  const body = await ask('How much is The One Resort in May?');
  assert.match(body.message, /Green Season/);
  assert.match(body.message, /\$136/);
});

test('early-January dates fall in Mid season (Jan-Apr range)', async () => {
  const body = await ask('The One Resort price for 15 January');
  assert.match(body.message, /Mid Season/);
  assert.match(body.message, /\$191/);
});

test('"may I" is not read as the month of May', async () => {
  const body = await ask('May I see The One Resort room rates?');
  assert.match(body.message, /Mid Season/);
  assert.doesNotMatch(body.message, /Green Season/);
});

test('extra person line carries the All Inclusive child band', async () => {
  const body = await ask('The One Resort room rates');
  assert.match(body.message, /ages 4–16 \+\$50/);
  assert.match(body.message, /under 4 free on All Inclusive/);
});
