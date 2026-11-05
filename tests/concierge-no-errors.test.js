'use strict';
/**
 * Concierge engagement: no console / page errors.
 *
 * Opens the chat, taps every quick reply, sends a typed message via Enter and
 * via the send button, adds a card to the plan, and sends a lead — asserting
 * that NO JavaScript errors surface anywhere in the flow.
 *
 * Prerequisite: the local preview server must be running on port 8888:
 *   npm run preview:local   (in another terminal)
 *
 * Runs with: node --test
 */
const test = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8888';
const EXE = '/home/efatha/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const QUICK_REPLIES = ['Plan a trip', 'Airport transfer', 'Tours and prices', 'Safari', 'Talk to the team'];

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isJsError(text) {
  const t = String(text);
  return /ReferenceError|TypeError|SyntaxError|is not defined|is not a function|cannot read|failed to execute/i.test(t);
}

test('concierge: no console or page errors during full chat flow', async () => {
  // Fail fast with a clear message if the preview server is not running.
  let res;
  try {
    res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
  } catch (err) {
    assert.fail(
      'Preview server not reachable at ' + BASE +
      '. Start it first: npm run preview:local'
    );
  }
  assert.strictEqual(res.ok, true, 'preview server returned ' + res.status);

  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && isJsError(m.text())) errors.push('console: ' + m.text());
  });

  const wait = () => sleep(900);

  const openChat = async () => {
    await page.waitForSelector('#sns-concierge-trigger', { timeout: 10000 });
    // Invoke open() directly so the opening backdrop cannot intercept the click.
    await page.evaluate(() => window.snsConcierge.open());
    await page.waitForSelector('#sns-concierge-modal:not([hidden])', { timeout: 5000 });
    await page.waitForSelector('.sns-chat-quick-btn', { timeout: 5000 });
    await wait();
  };

  const tapReply = async (label) => {
    await page.evaluate((lbl) => {
      const btns = Array.from(document.querySelectorAll('.sns-chat-quick-btn'));
      const b = btns.find((x) => x.textContent && x.textContent.trim() === lbl && !x.hidden);
      if (b) b.click();
    }, label);
    await wait();
  };

  const typeAndEnter = async (text) => {
    await page.waitForSelector('#sns-chat-input', { timeout: 5000 });
    await page.fill('#sns-chat-input', text);
    await page.press('#sns-chat-input', 'Enter');
    await wait();
  };

  const clickSend = async (text) => {
    await page.waitForSelector('#sns-chat-input', { timeout: 5000 });
    await page.fill('#sns-chat-input', text);
    await page.click('.sns-chat-send-btn');
    await wait();
  };

  try {
    await page.goto(`${BASE}/transfers/`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    // 1. Open chat.
    await openChat();

    // 2. Tap every quick reply (reopen chat between each to reset to greeting).
    for (const label of QUICK_REPLIES) {
      await openChat();
      await tapReply(label);
    }

    // 3. Typed message via Enter.
    await openChat();
    await typeAndEnter('Hello concierge');

    // 4. Typed message via send button.
    await openChat();
    await clickSend('Send button check');

    // 5. Add a card to the plan: dates -> travellers -> interests -> Add to my plan.
    await openChat();
    await tapReply('Plan a trip');
    await page.waitForSelector('#sns-chat-input', { timeout: 5000 });
    await page.fill('#sns-chat-input', '2026-12-20');
    await page.press('#sns-chat-input', 'Enter');
    await wait();
    await tapReply('2');
    await tapReply('Beach & ocean');
    await page.waitForSelector('.sns-service-card-add', { timeout: 8000 });
    await page.click('.sns-service-card-add');
    await wait();

    // 6. Send a lead: open form via "Send to the team", fill, submit.
    await page.click('.sns-send-to-team-btn');
    await wait();
    await page.waitForSelector('#sns-guest-name', { timeout: 5000 });
    await page.fill('#sns-guest-name', 'Playwright Guest');
    await page.fill('#sns-guest-whatsapp', '+255672450934');
    await page.evaluate(() => {
      const c = document.querySelector('#consent_contact');
      if (c) c.click();
    });
    await page.click('.sns-btn-submit');
    await wait();

    // Confirm the lead was accepted (SP- reference) and no errors surfaced.
    const status = await page.evaluate(() => {
      const el = document.getElementById('sns-submit-status');
      return el ? el.textContent : '';
    });
    assert.ok(/SP-\d{4}-\d+/.test(status), 'lead submit did not show an SP- reference: ' + status);
  } finally {
    await browser.close().catch(() => {});
  }

  assert.strictEqual(errors.length, 0, 'Unexpected JS errors during concierge flow:\n' + errors.join('\n'));
});
