// Spice & Sail cookie / analytics consent banner
// Small, dismissible, no tracking before consent. Choice stored in localStorage.

(function () {
  'use strict';

  var CONSENT_KEY = 'sns-analytics-consent';
  var banner;

  function getConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {}
  }

  function hide() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  function build() {
    banner = document.createElement('div');
    banner.className = 'sns-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie consent');

    var text = document.createElement('p');
    text.className = 'sns-consent-banner__text';
    text.innerHTML = 'We use privacy-friendly analytics to understand how the site is used. ' +
      'See our <a href="/privacy/">privacy policy</a>.';

    var actions = document.createElement('div');
    actions.className = 'sns-consent-banner__actions';

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'sns-consent-banner__btn sns-consent-banner__btn--accept';
    accept.textContent = 'Accept analytics';
    accept.addEventListener('click', function () {
      setConsent('granted');
      if (typeof window.snsGrantAnalyticsConsent === 'function') {
        window.snsGrantAnalyticsConsent();
      }
      hide();
    });

    var decline = document.createElement('button');
    decline.type = 'button';
    decline.className = 'sns-consent-banner__btn sns-consent-banner__btn--decline';
    decline.textContent = 'Decline';
    decline.addEventListener('click', function () {
      setConsent('denied');
      if (typeof window.snsDenyAnalyticsConsent === 'function') {
        window.snsDenyAnalyticsConsent();
      }
      hide();
    });

    actions.appendChild(accept);
    actions.appendChild(decline);
    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  function start() {
    if (getConsent()) return;
    if (!document.body) return;
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
