/**
 * Security module — origin allowlist, rate limiting, bot detection.
 * Origin check: exact URL parsing, never substring match.
 * Rate limit: per-IP and per-session using the store.
 */
'use strict';

const { getGlobalStore } = require('./store');

// Per-instance fallback buckets. Used only when the shared store fails, so an
// outage cannot turn the rate limiter into an unlimited allowance.
const memoryBuckets = new Map();

function memoryRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  for (const [bucketKey, bucket] of memoryBuckets) {
    if (now - bucket.start > windowMs) memoryBuckets.delete(bucketKey);
  }
  const data = memoryBuckets.get(key);
  if (!data || now - data.start > windowMs) {
    memoryBuckets.set(key, { count: 1, start: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (data.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  data.count++;
  return { allowed: true, remaining: maxRequests - data.count };
}

// Allowed origins from env + Netlify deploy URLs
function getAllowedOrigins() {
  const origins = new Set();
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    envOrigins.split(',').forEach(function (o) { origins.add(o.trim().replace(/\/$/, '')); });
  }
  // Netlify provides these
  if (process.env.URL) origins.add(process.env.URL.replace(/\/$/, ''));
  if (process.env.DEPLOY_URL) origins.add(process.env.DEPLOY_URL.replace(/\/$/, ''));
  if (process.env.DEPLOY_PRIME_URL) origins.add(process.env.DEPLOY_PRIME_URL.replace(/\/$/, ''));
  // Always allow the main site
  origins.add('https://spiceandsail.com');
  return origins;
}

/** Check if an origin is allowed — exact URL match, never substring */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch (e) {
    return false;
  }
  const normalized = parsed.origin; // protocol + host, no path
  const allowed = getAllowedOrigins();
  return allowed.has(normalized);
}

/** Build CORS headers — echo only an allowed origin, never '*' */
function corsHeaders(requestOrigin) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  };
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    headers['Vary'] = 'Origin';
  }
  return headers;
}

/**
 * Per-IP rate limit.
 * Returns { allowed: boolean, remaining: number }
 */
async function checkRateLimit(ip, windowKey, maxRequests, windowMs, store) {
  if (!store) store = getGlobalStore();
  const key = 'rl:' + windowKey + ':' + ip;
  try {
    const data = await store.getJSON(key);
    const now = Date.now();
    if (!data || now - data.start > windowMs) {
      await store.setJSON(key, { count: 1, start: now });
      return { allowed: true, remaining: maxRequests - 1 };
    }
    if (data.count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    data.count++;
    await store.setJSON(key, data);
    return { allowed: true, remaining: maxRequests - data.count };
  } catch (e) {
    // Store failed: fall back to a per-instance bucket instead of failing open.
    return memoryRateLimit(key, maxRequests, windowMs);
  }
}

/**
 * Honeypot + minimum fill time bot check.
 * Honeypot: a hidden field that bots fill; humans leave empty.
 * Min fill time: form must take at least N seconds to fill.
 */
function checkBotSignals(body) {
  // Honeypot field should be empty
  if (body.honeypot && body.honeypot.trim().length > 0) {
    return { isBot: true, reason: 'honeypot' };
  }

  // Minimum fill time: 3 seconds
  if (body.form_loaded_at) {
    const loadedAt = Number(body.form_loaded_at);
    const now = Date.now();
    if (!isNaN(loadedAt) && now - loadedAt < 3000) {
      return { isBot: true, reason: 'too_fast' };
    }
  }

  return { isBot: false, reason: null };
}

/** Extract client IP from Netlify event */
function getClientIP(event) {
  if (!event) return '0.0.0.0';
  if (event.headers) {
    return event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] ||
      '0.0.0.0';
  }
  return '0.0.0.0';
}

module.exports = {
  isAllowedOrigin,
  corsHeaders,
  checkRateLimit,
  checkBotSignals,
  getClientIP,
  getAllowedOrigins,
};
