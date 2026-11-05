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

test('widget source contains no innerHTML anywhere (addBubble, showStatus, status links)', () => {
  const src = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.strictEqual(src.includes('innerHTML'), false, 'concierge.js must not use innerHTML (comments excluded)');
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
