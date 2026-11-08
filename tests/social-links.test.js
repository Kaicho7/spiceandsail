const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

test('social: site.json contains valid social links configuration', () => {
  const sitePath = path.join(repoRoot, 'src', 'data', 'site.json');
  assert.ok(fs.existsSync(sitePath), 'site.json must exist');
  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  assert.ok(site.social && typeof site.social === 'object', 'site.social must be an object');
  
  const expectedChannels = ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'tripadvisor'];
  expectedChannels.forEach(channel => {
    assert.ok(channel in site.social, `site.social must include ${channel} channel`);
  });
});

test('social: footer template has accessible social links component', () => {
  const footerPath = path.join(repoRoot, 'src', '_includes', 'footer.njk');
  const footerContent = fs.readFileSync(footerPath, 'utf8');
  assert.ok(footerContent.includes('footer-social'), 'footer must contain footer-social class');
  assert.ok(footerContent.includes('site.social'), 'footer must bind to site.social');
  assert.ok(footerContent.includes('aria-label="Social media channels"'), 'footer must contain aria-label for accessibility');
});

test('social: seo.njk includes sameAs bindings for registered social channels', () => {
  const seoPath = path.join(repoRoot, 'src', '_includes', 'seo.njk');
  const seoContent = fs.readFileSync(seoPath, 'utf8');
  assert.ok(seoContent.includes('sameAs'), 'seo.njk must contain sameAs array');
  assert.ok(seoContent.includes('site.social.instagram'), 'seo.njk must check site.social.instagram');
  assert.ok(seoContent.includes('site.social.youtube'), 'seo.njk must check site.social.youtube');
  assert.ok(seoContent.includes('site.social.tiktok'), 'seo.njk must check site.social.tiktok');
});
