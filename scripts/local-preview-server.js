#!/usr/bin/env node
/**
 * Local preview server for Spice & Sail (concierge bot included).
 *
 * Builds nothing itself — pair it with `npm run build`:
 *   npm run preview:local   (runs build + this server)
 *
 * Serves dist/ at http://localhost:8888 and routes
 * /.netlify/functions/* to the real Netlify function handlers so the
 * concierge widget (/quote, /lead, /chat, /admin-leads) works exactly
 * as in production — without Netlify and without deploying.
 *
 * Env (also read from untracked .env.local, never committed):
 *   PORT              default 8888
 *   ALLOWED_ORIGINS   default http://localhost:${PORT}
 *   STAFF_PASSCODE    required for /admin-leads
 *   All other netlify function env vars are passed through.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const DIST = path.join(REPO, 'dist');
const DEFAULT_PORT = 8888;

/* ---- load untracked .env.local (gitignored via .env.*) ---- */
function loadEnvLocal() {
  const file = path.join(REPO, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const PORT = parseInt(process.env.PORT || DEFAULT_PORT, 10) || DEFAULT_PORT;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`;

function handlerModule(name) {
  return require(path.join(REPO, 'netlify/functions', name));
}

function send(res, status, body, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType || 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PATCH',
    'Access-Control-Allow-Headers': 'Content-Type,Origin,Authorization'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const origin = req.headers.origin || ALLOWED_ORIGIN;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  /* ---- function routes (real handlers) ---- */
  if (url.pathname.startsWith('/.netlify/functions/')) {
    const name = url.pathname.slice('/.netlify/functions/'.length);
    try {
      const mod = handlerModule(name);
      if (!mod || typeof mod.handler !== 'function') {
        return send(res, 404, JSON.stringify({ error: 'function not found' }));
      }
      if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
        const body = await readBody(req);
        const r = await mod.handler({
          httpMethod: req.method,
          headers: Object.assign({}, req.headers, { origin }),
          body,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams)
        });
        return send(res, r.statusCode, r.body || '', 'application/json');
      }
      const r = await mod.handler({
        httpMethod: req.method,
        headers: Object.assign({}, req.headers, { origin }),
        path: url.pathname,
        query: Object.fromEntries(url.searchParams)
      });
      return send(res, r.statusCode, r.body || '', 'application/json');
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: e.message }), 'application/json');
    }
  }

  /* ---- static files from dist/ ---- */
  let filePath = path.join(DIST, url.pathname);
  if (!filePath.startsWith(DIST + path.sep) && filePath !== DIST) {
    return send(res, 403, 'forbidden', 'text/plain');
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      return fs.stat(filePath, (err2, stat2) => serveFile(res, filePath, err2, stat2, url, DIST, send));
    }
    return serveFile(res, filePath, err, stat, url, DIST, send);
  });
});

server.listen(PORT, () => {
  console.log(`local preview listening on ${ALLOWED_ORIGIN}`);
  console.log(`serving ${DIST}`);
  console.log(`function routes: /.netlify/functions/*`);
});

function serveFile(res, filePath, err, stat, url, DIST, send) {
  if (err || !stat.isFile()) {
    const fallback = path.join(DIST, '404.html');
    fs.readFile(fallback, (er, data) => {
      if (er) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
      res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end(data);
    });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
  fs.createReadStream(filePath)
    .on('error', () => { res.writeHead(500); res.end('read error'); })
    .pipe(res);
  res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': ALLOWED_ORIGIN });
}
