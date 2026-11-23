// Spice & Sail GA4 Configuration
// Loaded from external file to satisfy CSP without 'unsafe-inline'
// Reads measurement ID from data-measurement-id attribute on script tag
// GA4 only initialises AFTER the visitor grants analytics consent.

(function () {
  'use strict';

  var CONSENT_KEY = 'sns-analytics-consent';

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

  function initGA4() {
    if (window.__snsGa4Loaded) return;
    var scriptTag = document.querySelector('script[data-sns-ga4-config]');
    if (!scriptTag) return;

    var measurementId = scriptTag.getAttribute('data-measurement-id');
    if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;

    window.__snsGa4Loaded = true;
    window.SNS_ANALYTICS_ID = measurementId;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { page_path: window.location.pathname });

    var tag = document.createElement('script');
    tag.id = 'sns-ga4-script';
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(tag);
  }

  function maybeInit() {
    if (getConsent() === 'granted') initGA4();
  }

  window.snsGrantAnalyticsConsent = function () {
    setConsent('granted');
    initGA4();
  };

  window.snsDenyAnalyticsConsent = function () {
    setConsent('denied');
  };

  function start() {
    maybeInit();
    document.dispatchEvent(new CustomEvent('sns:ga4-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
