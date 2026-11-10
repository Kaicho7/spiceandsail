'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

test.before(async () => {
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    execSync('npm run build', { stdio: 'pipe', timeout: 300000, cwd: path.join(__dirname, '..') });
  }
});

test('privacy: privacy.njk page exists in src/pages/', () => {
  const pages = fs.readdirSync(path.join(__dirname, '..', 'src', 'pages'));
  assert.ok(pages.includes('privacy.njk'), 'privacy.njk must exist in src/pages/');
});

test('privacy: consent_contact present in widget', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  const count = (widgetContent.match(/consent_contact/g) || []).length;
  assert.ok(count >= 1, 'consent_contact must be present in widget');
});

test('privacy: two consent checkboxes', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.strictEqual(widgetContent.includes('consent_contact'), true, 'consent_contact checkbox required');
  assert.strictEqual(widgetContent.includes('consent_marketing'), true, 'consent_marketing checkbox required');
});

test('privacy: marketing checkbox unticked by default', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.strictEqual((widgetContent.match(/consent_marketing[^>]*checked/gi) || []).length, 0, 'marketing checkbox must not be pre-checked/ticked');
});

test('privacy: contact consent is required (attribute required)', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.ok(/<input[^>]*consent_contact[^>]*\brequired\b/.test(widgetContent), 'consent_contact must have required attribute');
});

test('privacy: no banned phrases in dist/', () => {
  const result = execSync('grep -rl "24/7\\|instant checkout\\|lock instantly\\|25-35%" dist/ 2>/dev/null | wc -l', { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(parseInt(result.trim()), 0, 'No banned phrases should exist in dist/');
});

test('privacy: privacy notice version stored', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.strictEqual(widgetContent.includes('privacy_notice_version'), true, 'privacy_notice_version field must exist');
  assert.strictEqual(widgetContent.includes('v1.0'), true, 'privacy_notice_version must be v1.0');
});

test('privacy: separate WhatsApp and email fields', () => {
  const widgetContent = fs.readFileSync(path.join(__dirname, '..', 'src', '_includes', 'concierge-widget.njk'), 'utf8');
  assert.strictEqual(widgetContent.includes('sns-guest-whatsapp'), true, 'WhatsApp field must exist');
  assert.strictEqual(widgetContent.includes('sns-guest-email'), true, 'Email field must exist');
});