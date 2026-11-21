// Spice & Sail Trust Bar - Mobile sticky trust signals
// Loaded from external file to satisfy CSP without 'unsafe-inline'

(function () {
  'use strict';

  function initTrustBar() {
    var trustBar = document.getElementById('snsTrustBar');
    if (!trustBar) return;

    // Show on mobile after brief delay
    setTimeout(function () {
      if (window.innerWidth <= 768) {
        trustBar.classList.add('visible');
      }
    }, 2000);

    // Hide on scroll up, show on scroll down (optional enhancement)
    var lastScroll = window.scrollY;
    window.addEventListener('scroll', function () {
      if (window.innerWidth > 768) return;
      var currentScroll = window.scrollY;
      if (currentScroll > lastScroll && currentScroll > 100) {
        trustBar.classList.remove('visible');
      } else {
        trustBar.classList.add('visible');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrustBar);
  } else {
    initTrustBar();
  }
})();