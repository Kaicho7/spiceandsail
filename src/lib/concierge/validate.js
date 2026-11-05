/**
 * Hand-written validation — no zod.
 * Validates lead submissions: name, E.164 WhatsApp, email, dates, etc.
 */
'use strict';

const MAX_NOTES_LENGTH = 2000;
const MAX_NAME_LENGTH = 200;
const MAX_PAYLOAD_BYTES = 16384; // 16 KB

// Strict field allowlist for lead submissions
const ALLOWED_FIELDS = new Set([
  'name', 'whatsapp', 'email', 'date', 'travellers', 'notes',
  'services', 'consent_contact', 'consent_marketing',
  'privacy_notice_version', 'session_id', 'honeypot', 'form_loaded_at',
]);

/** Validate E.164 phone number format */
function isValidE164(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned);
}

/** Normalise phone to E.164 */
function normalizeE164(phone) {
  if (!phone) return null;
  return phone.replace(/[\s\-().]/g, '');
}

/** Basic email validation */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Validate a lead submission payload */
function validateLead(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }

  // Check for unknown fields
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      errors.push('Unknown field: ' + key);
    }
  }

  // Name
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push('Name is required (at least 2 characters)');
  } else if (body.name.length > MAX_NAME_LENGTH) {
    errors.push('Name is too long (max ' + MAX_NAME_LENGTH + ' characters)');
  }

  // Contact: at least one of WhatsApp or email
  const hasWhatsApp = body.whatsapp && typeof body.whatsapp === 'string' && body.whatsapp.trim().length > 0;
  const hasEmail = body.email && typeof body.email === 'string' && body.email.trim().length > 0;

  if (!hasWhatsApp && !hasEmail) {
    errors.push('At least one contact method is required (WhatsApp number or email)');
  }

  if (hasWhatsApp && !isValidE164(body.whatsapp)) {
    errors.push('WhatsApp number must be in international format (e.g. +255672450934)');
  }

  if (hasEmail && !isValidEmail(body.email)) {
    errors.push('Invalid email address format');
  }

  // Date (optional but if provided must be valid)
  if (body.date) {
    const d = new Date(body.date);
    if (isNaN(d.getTime())) {
      errors.push('Invalid date format');
    }
  }

  // Travellers: 1-50
  if (body.travellers !== undefined) {
    const t = Number(body.travellers);
    if (!Number.isInteger(t) || t < 1 || t > 50) {
      errors.push('Travellers must be between 1 and 50');
    }
  }

  // Notes length
  if (body.notes && typeof body.notes === 'string' && body.notes.length > MAX_NOTES_LENGTH) {
    errors.push('Notes too long (max ' + MAX_NOTES_LENGTH + ' characters)');
  }

  // Consent contact must be true
  if (body.consent_contact !== true && body.consent_contact !== 'true') {
    errors.push('Consent to contact is required');
  }

  return { valid: errors.length === 0, errors: errors };
}

/** Check raw payload size */
function isPayloadTooLarge(rawBody) {
  if (!rawBody) return false;
  const bytes = typeof rawBody === 'string' ? Buffer.byteLength(rawBody, 'utf8') : rawBody.length;
  return bytes > MAX_PAYLOAD_BYTES;
}

module.exports = {
  validateLead,
  isValidE164,
  normalizeE164,
  isValidEmail,
  isPayloadTooLarge,
  MAX_PAYLOAD_BYTES,
  MAX_NOTES_LENGTH,
  ALLOWED_FIELDS,
};
