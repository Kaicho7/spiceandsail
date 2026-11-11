'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { stripPII } = require('../src/lib/concierge/llm');

test('stripPII preserves Zanzibar place names', () => {
  assert.match(stripPII('How far is Stone Town from Nungwi Beach?'), /Stone Town/);
  assert.match(stripPII('Is Safari Blue departing from Fumba?'), /Safari Blue/);
  assert.match(stripPII('I am in Stone Town and want Safari Blue.'), /I am in Stone Town/);
});

test('stripPII redacts explicit names, phones, and emails', () => {
  const out = stripPII('My name is John Smith, call +255 712 345 678 or john@example.com');
  assert.match(out, /\[name\]/);
  assert.match(out, /\[phone\]/);
  assert.match(out, /\[email\]/);
  assert.doesNotMatch(out, /John Smith/);
});
