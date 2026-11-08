'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

test('international: currencies.json contains valid configuration for USD, EUR, GBP, PLN, TZS', () => {
  const p = path.join(ROOT, 'src', 'data', 'currencies.json');
  assert.ok(fs.existsSync(p), 'currencies.json must exist');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(data.base, 'USD');
  assert.ok(data.rates.USD && data.rates.USD.rate === 1.0);
  assert.ok(data.rates.EUR && data.rates.EUR.rate > 0);
  assert.ok(data.rates.GBP && data.rates.GBP.rate > 0);
  assert.ok(data.rates.PLN && data.rates.PLN.rate > 0);
  assert.ok(data.rates.TZS && data.rates.TZS.rate > 1000);
});

test('international: translations.json covers all 5 requested languages', () => {
  const p = path.join(ROOT, 'src', 'data', 'translations.json');
  assert.ok(fs.existsSync(p), 'translations.json must exist');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const langs = ['en', 'it', 'de', 'fr', 'pl'];
  for (const l of langs) {
    assert.ok(data.languages[l], 'Language ' + l + ' must be defined in translations.json');
  }

  const requiredKeys = ['nav_home', 'nav_tours', 'nav_transfers', 'nav_hotels', 'btn_check_rates', 'whatsapp_greeting'];
  for (const k of requiredKeys) {
    assert.ok(data.strings[k], 'Key ' + k + ' must be defined');
    for (const l of langs) {
      assert.ok(data.strings[k][l], 'Key ' + k + ' must have translation for ' + l);
    }
  }
});

test('international: header template includes language and currency selectors and luxury nav structure', () => {
  const p = path.join(ROOT, 'src', '_includes', 'header.njk');
  const html = fs.readFileSync(p, 'utf8');
  assert.ok(html.includes('id="langSelect"'), 'header must contain #langSelect');
  assert.ok(html.includes('id="currencySelect"'), 'header must contain #currencySelect');
  assert.ok(html.includes('value="en"') && html.includes('value="it"') && html.includes('value="de"') && html.includes('value="fr"') && html.includes('value="pl"'));
  assert.ok(html.includes('value="USD"') && html.includes('value="EUR"') && html.includes('value="GBP"') && html.includes('value="PLN"') && html.includes('value="TZS"'));
  
  // Luxury nav structure & brand translate protection
  assert.ok(html.includes('translate="no"') && html.includes('notranslate'), 'Brand name must be protected from translation');
  assert.ok(html.includes('id="navToggle"') && html.includes('id="navMenu"') && html.includes('id="navOverlay"'), 'Must have mobile drawer and overlay elements');
  assert.ok(html.includes('has-dropdown') && html.includes('dropdown-menu'), 'Must have consolidated dropdown navigation');
});

test('international: i18n-currency.js exists and is syntactically valid', () => {
  const p = path.join(ROOT, 'public', 'js', 'i18n-currency.js');
  assert.ok(fs.existsSync(p), 'public/js/i18n-currency.js must exist');
  const code = fs.readFileSync(p, 'utf8');
  assert.ok(code.includes('RATES') && code.includes('LANGS') && code.includes('formatRangeConverted'));
  // Syntax check
  assert.doesNotThrow(() => new Function(code), 'i18n-currency.js must be syntactically valid');
});

test('international: multilingual driver/guide policy is documented in transfers, faq, and chat', () => {
  const transfersHtml = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'transfers.njk'), 'utf8');
  assert.ok(transfersHtml.includes('calc-driver-lang'), 'transfers calculator must have driver language selector');
  assert.ok(transfersHtml.includes('Italian') && transfersHtml.includes('German') && transfersHtml.includes('French') && transfersHtml.includes('Polish'));

  const faqHtml = fs.readFileSync(path.join(ROOT, 'src', '_includes', 'tour-faq.njk'), 'utf8');
  assert.ok(faqHtml.includes('multilingual drivers and tour guides'), 'tour faq must document multilingual guides/drivers');
  assert.ok(faqHtml.includes('Italian, German, French, and Polish') && faqHtml.includes('advance request'));

  const aboutHtml = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'about.njk'), 'utf8');
  assert.ok(aboutHtml.includes('Multilingual Guides &amp; Drivers'), 'about page must highlight multilingual team');

  const chatCode = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'chat.js'), 'utf8');
  assert.ok(chatCode.includes("intent === 'language'"), 'chat.js must handle language intent');
});

test('international: transfers page and airport-to-nungwi do not have hardcoded USD next to dynamic prices', () => {
  const transfersHtml = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'transfers.njk'), 'utf8');
  assert.ok(!transfersHtml.includes('>USD (per private vehicle'), 'transfers.njk must not hardcode >USD next to calculator price');
  assert.ok(transfersHtml.includes('id="calc-curr-code"'), 'transfers.njk must contain dynamic currency code element');

  const nungwiHtml = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'transfers', 'airport-to-nungwi.njk'), 'utf8');
  assert.ok(!nungwiHtml.includes('catPrice "airport-transfer-znz-to-nungwikendwa" %} USD'), 'airport-to-nungwi.njk must not append literal USD to catPrice');
});

