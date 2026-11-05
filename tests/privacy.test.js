const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');

test('privacy: privacy.njk page exists and renders', () => {
  const pages = execSync('ls src/pages/*.njk', { encoding: 'utf8' }).split('\n');
  assert.strictEqual(pages.includes('src/pages/privacy.njk'), true, 'privacy.njk must exist in src/pages/');
});

test('privacy: consent fields present in widget', () => {
  const widget = JSON.parse(execSync('grep -c "consent_contact" src/_includes/concierge-widget.njk', { encoding: 'utf8' }).split('\n')[0]);
  assert.ok(parseInt(widget) >= 1, 'consent_contact must be present in widget');
});

test('privacy: two consent checkboxes', () => {
  const widgetContent = require('fs').readFileSync('src/_includes/concierge-widget.njk', 'utf8');
  const hasContactConsent = widgetContent.includes('consent_contact');
  const hasMarketingConsent = widgetContent.includes('consent_marketing');
  assert.strictEqual(hasContactConsent, true, 'consent_contact checkbox required');
  assert.strictEqual(hasMarketingConsent, true, 'consent_marketing checkbox required');
});

test('privacy: marketing checkbox unticked by default', () => {
  const widgetContent = require('fs').readFileSync('src/_includes/concierge-widget.njk', 'utf8');
  // Marketing checkbox should not have 'checked' attribute
  assert.strictEqual((widgetContent.match(/consent_marketing[^>]*checked/gi) || []).length, 0, 'marketing checkbox must not be pre-checked/ticked');
});

test('privacy: contact consent is required (attribute required)', () => {
  const widgetContent = require('fs').readFileSync('src/_includes/concierge-widget.njk', 'utf8');
  assert.strictEqual(/<input[^>]*consent_contact[^>]*\brequired\b/.test(widgetContent), true, 'consent_contact must have required attribute');
});

test('privacy: no banned phrases in dist/', () => {
  const distContent = execSync('grep -rl "24/7\|instant checkout\|lock instantly\|25-35%" dist/ 2>/dev/null | wc -l', { encoding: 'utf8' });
  assert.strictEqual(parseInt(distContent), 0, 'No banned phrases should exist in dist/');
});

test('privacy: privacy notice version stored', () => {
  const widgetContent = require('fs').readFileSync('src/_includes/concierge-widget.njk', 'utf8');
  assert.strictEqual(widgetContent.includes('privacy_notice_version'), true, 'privacy_notice_version field must exist');
  assert.strictEqual(widgetContent.includes('v1.0'), true, 'privacy_notice_version must be v1.0');
});

test('privacy: separate WhatsApp and email fields', () => {
  const widgetContent = require('fs').readFileSync('src/_includes/concierge-widget.njk', 'utf8');
  const hasWhatsApp = widgetContent.includes('sns-guest-whatsapp');
  const hasEmail = widgetContent.includes('sns-guest-email');
  assert.strictEqual(hasWhatsApp, true, 'WhatsApp field must exist');
  assert.strictEqual(hasEmail, true, 'Email field must exist');
});