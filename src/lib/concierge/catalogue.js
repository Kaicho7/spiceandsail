/**
 * Catalogue loader — CommonJS, bundled by esbuild.
 * Single source of truth for service data.
 */
'use strict';

const catalogue = require('../../data/concierge-catalogue.json');

const CATALOGUE_VERSION = catalogue.version || 'unknown';
const CONFIG = catalogue.config || {};

/** Look up a zone by slug. */
function getZone(slug) {
  if (!slug) return null;
  return (catalogue.zones || []).find(z => z.slug === slug) || null;
}

/** Human-readable zone name. */
function zoneName(slug) {
  const z = getZone(slug);
  return z ? z.name : slug;
}

/** Look up a service by slug. */
function getService(slug) {
  if (!slug) return null;
  return (catalogue.services || []).find(s => s.slug === slug) || null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Human-readable business-hours label derived from the single config source. */
function getBusinessHoursLabel() {
  const bh = CONFIG.businessHours;
  if (!bh || !Array.isArray(bh.days) || !bh.days.length) return 'business hours';
  const days = bh.days.slice().sort((a, b) => a - b);
  let dayLabel;
  if (days.length === 7) dayLabel = 'Every day';
  else if (days.join(',') === '1,2,3,4,5,6') dayLabel = 'Mon–Sat';
  else if (days.join(',') === '1,2,3,4,5') dayLabel = 'Mon–Fri';
  else dayLabel = days.map(day => DAY_LABELS[day] || day).join(', ');
  const pad = value => String(value).padStart(2, '0');
  const timezone = bh.tz === 'Africa/Dar_es_Salaam' ? 'EAT' : (bh.tz || '');
  const timeLabel = `${pad(bh.start)}:00–${pad(bh.end)}:00${timezone ? ' ' + timezone : ''}`;
  return `${dayLabel}, ${timeLabel}`;
}

/** Check if current time is within business hours. */
function isWithinBusinessHours(now) {
  if (!now) now = new Date();
  const bh = CONFIG.businessHours;
  if (!bh) return true;
  // Convert to EAT (UTC+3)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const eat = new Date(utc + 3 * 3600000);
  const day = eat.getDay(); // 0=Sun
  const hour = eat.getHours();
  if (!bh.days.includes(day)) return false;
  return hour >= bh.start && hour < bh.end;
}

/** Short profile summary for staff briefs. */
function profileSummary(profile) {
  if (!profile) return '';
  const parts = [];
  if (profile.tripType) parts.push(`Intent: ${profile.tripType}`);
  if (profile.travelStartDate) parts.push(`Dates: ${profile.travelStartDate}${profile.travelEndDate ? ' to ' + profile.travelEndDate : ''}`);
  if (profile.adults) parts.push(`${profile.adults} adult(s)`);
  if (profile.children) parts.push(`${profile.children} child(ren)`);
  if (profile.hotelOrArea) parts.push(`Area: ${profile.hotelOrArea}`);
  if (profile.interests && profile.interests.length) parts.push(`Interests: ${profile.interests.join(', ')}`);
  if (profile.serviceSlugs && profile.serviceSlugs.length) parts.push(`Services: ${profile.serviceSlugs.join(', ')}`);
  if (profile.specialRequests) parts.push(`Notes: ${profile.specialRequests}`);
  return parts.join(' | ');
}

module.exports = {
  catalogue,
  CATALOGUE_VERSION,
  CONFIG,
  getZone,
  zoneName,
  getService,
  getBusinessHoursLabel,
  isWithinBusinessHours,
  profileSummary,
};
