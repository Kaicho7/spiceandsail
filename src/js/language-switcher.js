document.addEventListener('DOMContentLoaded', function() {
  const langSelect = document.getElementById('langSelect');
  if (!langSelect) return;

  langSelect.addEventListener('change', function(e) {
    const selectedLang = e.target.value;
    const langPaths = {
      'en': '/',
      'it': '/it/',
      'de': '/de/',
      'fr': '/fr/',
      'pl': '/pl/',
      'ar': '/ar/',
      'ru': '/ru/'
    };

    const altAttr = langSelect.getAttribute('data-alt-' + selectedLang);
    let redirectPath = langPaths[selectedLang] || '/';
    if (altAttr) {
      try {
        const parsed = new URL(altAttr, window.location.origin);
        redirectPath = parsed.pathname || redirectPath;
      } catch (_) {
        redirectPath = altAttr;
      }
    }

    if (window.location.pathname === redirectPath) {
      return;
    }

    window.location.href = redirectPath;
  });
});
