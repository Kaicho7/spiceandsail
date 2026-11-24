document.addEventListener('DOMContentLoaded', function() {
  const langSelect = document.getElementById('langSelect');
  if (!langSelect) return;
  
  langSelect.addEventListener('change', function(e) {
    const selectedLang = e.target.value;
    // Map language codes to URL paths
    const langPaths = {
      'en': '/',
      'it': '/it/',
      'de': '/de/',
      'fr': '/fr/',
      'pl': '/pl/',
      'ar': '/ar/',
      'ru': '/ru/'
    };
    
    const redirectPath = langPaths[selectedLang] || '/';
    
    // Don't redirect if already on the selected language
    if (window.location.pathname === redirectPath) {
      // Just update the page content without full reload
      // For now, do a mild redirect after a short delay
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 100);
      return;
    }
    
    // Redirect to the selected language path
    window.location.href = redirectPath;
  });
});
