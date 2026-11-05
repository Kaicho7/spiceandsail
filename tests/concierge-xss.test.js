'use strict';
/**
 * Chat/status rendering must never use innerHTML: server replies, user text
 * and error details are inserted as text nodes, links via createElement.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'js', 'concierge.js');

function makeNode(tag) {
  return {
    tag: String(tag).toUpperCase(),
    kind: 'elem',
    children: [],
    attrs: {},
    className: '',
    appendChild(child) { this.children.push(child); },
    setAttribute(k, v) { this.attrs[String(k).toLowerCase()] = String(v); },
  };
}

function loadWidget(doc) {
  const src = fs.readFileSync(SRC, 'utf8');
  const window = {};
  const document = doc || {
    addEventListener() {},
    createElement: (t) => makeNode(t),
    createTextNode: (data) => ({ kind: '#text', data }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {},
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', src)(window, document);
  return window.snsConcierge;
}

function textOf(node) {
  if (node && node.kind === '#text') return node.data;
  if (!node || !node.children) return '';
  return node.children.map(textOf).join('');
}

function tagsOf(node) {
  if (!node || !node.children) return [];
  return node.children.flatMap((k) =>
    k.kind === '#text' ? [] : [k.tag, ...tagsOf(k)]
  );
}

test('widget source contains no innerHTML assignment anywhere (addBubble, showStatus, status links)', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  assert.ok(!/innerHTML\s*=/.test(src), 'concierge.js must not assign innerHTML');
});

test('chat bubble: <img onerror> reply payload renders as literal text, no IMG element', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('<img src=x onerror=alert(1)>Hi there', 'user');
  assert.strictEqual(b.tag, 'DIV');
  assert.strictEqual(tagsOf(b).filter((t) => t === 'IMG').length, 0, 'no IMG element may be created from a reply');
  assert.ok(textOf(b).includes('<img src=x onerror=alert(1)>'), 'payload must appear as visible text, unexecuted and unmounted');
});

test('chat bubble: bot markdown link is built with createElement, internal href preserved', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('See our [privacy notice](/privacy/) for details.', 'bot');
  const a = b.children.find((n) => n.tag === 'A');
  assert.ok(a, 'link element must be created');
  assert.strictEqual(a.attrs.href, '/privacy/');
  assert.strictEqual(a.textContent, 'privacy notice');
  assert.strictEqual(a.attrs.rel, 'noopener');
});

test('chat bubble: user-typed HTML/attribute soup never mounts attributes on bubbles', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('<a href="javascript:alert(1)">click</a> <script>alert(2)</script>', 'user');
  const tags = tagsOf(b);
  assert.strictEqual(tags.filter((t) => t === 'A' || t === 'SCRIPT').length, 0, 'no A/SCRIPT element from raw user text');
  assert.ok(textOf(b).includes('javascript:alert(1)'), 'raw text preserved');
});

test('chat bubble: a javascript: URL in a markdown link is rendered as text, never a link', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('click [x](javascript:alert(1)) now', 'user');
  assert.strictEqual(tagsOf(b).filter((t) => t === 'A').length, 0, 'no anchor element for a javascript: URL');
  assert.ok(textOf(b).includes('[x](javascript:alert(1))'), 'javascript: payload stays visible as text');
});

test('chat bubble: a quote: scheme link is rendered as text, never a link', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('click [x](quote:evil) now', 'user');
  assert.strictEqual(tagsOf(b).filter((t) => t === 'A').length, 0, 'no anchor element for a quote: URL');
  assert.ok(textOf(b).includes('[x](quote:evil)'), 'quote: payload stays visible as text');
});

test('chat bubble: a percent-encoded mailto: link is built with createElement', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('mail us [here](mailto:user%40example.com)', 'bot');
  const a = b.children.find((n) => n.tag === 'A');
  assert.ok(a, 'percent-encoded mailto anchor must be created');
  assert.strictEqual(a.attrs.href, 'mailto:user%40example.com');
});

test('chat bubble: a raw mailto: address (unescaped @) stays as text, never a link', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('mail [me](mailto:a@b.c) please', 'user');
  assert.strictEqual(tagsOf(b).filter((t) => t === 'A').length, 0, 'raw mailto address must not become a link');
  assert.ok(textOf(b).includes('[me](mailto:a@b.c)'), 'raw mailto preserved as text');
});

test('chat bubble: a mailto: address with spaces stays as text', () => {
  const c = loadWidget();
  const b = c._bubbleNodes('mail [me](mailto:a b@c.d) please', 'user');
  assert.strictEqual(tagsOf(b).filter((t) => t === 'A').length, 0, 'spaced mailto address must not become a link');
  assert.ok(textOf(b).includes('[me](mailto:a b@c.d)'), 'spaced mailto preserved as text');
});

test('reply_link is scheme-guarded (https only) before becoming a link in the success status', () => {
  const src = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(src.includes('reply &&'), 'success path checks reply_link before use');
  assert.ok(src.includes('/^https:\\/\\//'), 'reply_link must pass an https:// scheme check');
});
