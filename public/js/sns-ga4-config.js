// Spice & Sail GA4 Configuration
// Loaded from external file to satisfy CSP without 'unsafe-inline'
// Reads measurement ID from data-measurement-id attribute on script tag

(function () {
  'use strict';

  function initGA4() {
    var scriptTag = document.querySelector('script[data-sns-ga4-config]');
    if (!scriptTag) return;

    var measurementId = scriptTag.getAttribute('data-measurement-id');
    if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;

    window.SNS_ANALYTICS_ID = measurementId;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { page_path: window.location.pathname });

    // Load GA4 script
    var loadTag = function () {
      if (document.getElementById('sns-ga4-script')) return;
      var tag = document.createElement('script');
      tag.id = 'sns-ga4-script';
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
      document.head.appendChild(tag);
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadTag, { timeout: 3000 });
    } else {
      window.setTimeout(loadTag, 1800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGA4);
  } else {
    initGA4();
  }
})();