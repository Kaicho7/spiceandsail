document.documentElement.classList.add('js');
document.addEventListener('DOMContentLoaded', function () {
  // Header scroll effect
  var header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // Mobile navigation toggle
  var navToggle = document.getElementById('navToggle');
  var navList = document.querySelector('.nav-list');
  if (navToggle && navList) {
    navToggle.addEventListener('click', function () {
      navList.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', navList.classList.contains('open'));
    });
  }

  // Close mobile menu when clicking a link
  var navLinks = document.querySelectorAll('.nav-list a');
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      navList.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Filter buttons for tours, hotels, attractions
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var filter = btn.getAttribute('data-filter');
      var section = btn.closest('section');
      var scope = section && section.querySelector('.card') ? section
        : document.querySelector('.cards.tour-grid, .cards-grid.hotel-grid, .cards-grid.attraction-grid') || section;
      if (!scope) return;
      section = section || (scope.closest('section') || scope);

      section.querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      var cards = scope.querySelectorAll('.card');
      cards.forEach(function(card) {
        var cardFilter = card.getAttribute('data-category') || card.getAttribute('data-type') || card.getAttribute('data-tier');
        if (filter === 'all' || cardFilter === filter) {
          card.style.display = '';
          card.style.animation = 'fadeInUp 0.4s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Intersection Observer for reveal animations
  var revealElements = document.querySelectorAll('.reveal, .card, .quick-link-card, .stat-item, .faq-item, .itinerary-day, .safari-include-item, .info-card, .booking-card, .quick-pick');
  
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(function(el, index) {
    el.classList.add('reveal');
    el.style.transitionDelay = (index * 0.05) + 's';
    revealObserver.observe(el);
  });


  // Contact form -> save lead server-side -> open WhatsApp
  var inquiryForm = document.querySelector('form.contact-form');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var f = inquiryForm;
      function field(name) {
        var el = f.elements[name];
        if (!el) return '';
        if (el.tagName === 'SELECT') {
          return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
        }
        return (el.value || '').trim();
      }

      var submitBtn = f.querySelector('button[type="submit"]');
      var originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      var payload = {
        name: field('name'),
        whatsapp: field('phone'),
        email: field('email') || undefined,
        travellers: field('group_size') ? Number(field('group_size')) || undefined : undefined,
        services: field('interests') ? [field('interests')] : undefined,
        notes: [field('travel_dates') ? 'Dates: ' + field('travel_dates') : '', field('message')].filter(Boolean).join('\n') || undefined,
        consent_contact: true,
        session_id: 'contact-form-' + Date.now()
      };

      fetch('/.netlify/functions/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, data: j }; }); })
      .then(function(res) {
        if (!res.ok) {
          var detail = (res.data && res.data.details) ? res.data.details.join(', ') : 'Submission failed';
          throw new Error(detail);
        }
        var msg = [
          'Hello Spice and Sail!',
          'Reference: ' + (res.data.reference || ''),
          'Name: ' + field('name'),
          'Email: ' + field('email'),
          'WhatsApp: ' + field('phone'),
          'Travel dates: ' + field('travel_dates'),
          'Interests: ' + field('interests'),
          'Group size: ' + field('group_size'),
          'Message: ' + field('message')
        ].join('\n');
        window.open('https://wa.me/255672450934?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        window.location.href = '/thank-you/?ref=' + encodeURIComponent(res.data.reference || '');
      })
      .catch(function(err) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
        var box = f.querySelector('.form-error');
        if (!box) {
          box = document.createElement('div');
          box.className = 'form-error';
          box.style.cssText = 'background:#fee;color:#c00;padding:1rem;border-radius:6px;margin-top:1rem;font-size:0.9rem;';
          f.appendChild(box);
        }
        box.textContent = 'Could not send your enquiry: ' + err.message + '. Please contact us directly on WhatsApp.';
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerOffset = 80;
        var elementPosition = target.getBoundingClientRect().top;
        var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Favorite button toggle
  document.querySelectorAll('.card-favorite').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.toggle('active');
      this.setAttribute('aria-label', this.classList.contains('active') ? 'Remove from favorites' : 'Add to favorites');
    });
  });

  // Lazy loading for images (if not using native loading="lazy")
  if ('IntersectionObserver' in window) {
    var lazyImages = document.querySelectorAll('img[data-src]');
    var imageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    lazyImages.forEach(function(img) { imageObserver.observe(img); });
  }
});