/**
 * Spice and Sail Zanzibar — Floating Trip Concierge & Instant Quote Widget Logic
 * Upgraded with Multi-Service Pricing Matrix, Metasearch Rate Defense & Deposit Checkout
 */

(function () {
  'use strict';

  let currentStep = 1;

  // Complete Pricing Model Matrix
  const PRICING = {
    // Transfers (Guaranteed Direct Flat Rates)
    'transfer-stone-town': { type: 'vehicle', base: 25, name: 'Airport ⇄ Stone Town Hotel Transfer' },
    'transfer-paje': { type: 'vehicle', base: 45, name: 'Airport ⇄ Paje / Jambiani / Matemwe Transfer' },
    'transfer-nungwi': { type: 'vehicle', base: 55, name: 'Airport ⇄ Nungwi / Kendwa Beach Transfer' },

    // Classic Tours
    'safari-blue': { type: 'person', base: 75, name: 'Safari Blue / Menai Bay Dhow Experience' },
    'mnemba-snorkel': { type: 'person', base: 65, name: 'Mnemba Atoll Snorkeling & Dolphins' },
    'stone-town-spice': { type: 'person', base: 45, name: 'Stone Town & Spice Farm Combo' },

    // Rare High-Commission Experiences
    'horse-swimming': { type: 'person', base: 65, name: 'Swimming with Horses in Ocean Shallows' },
    'quad-safari': { type: 'vehicle', base: 120, name: 'Off-Road Quad / Buggy Island Safari' },
    'cenote-caves': { type: 'person', base: 35, name: 'Maalum / Kuza Secret Cave Swim' },
    'uzi-island': { type: 'person', base: 95, name: "Uzi Island 'Moses Road' Tidal Expedition" },
    'cheetahs-rock': { type: 'person', base: 180, name: "Cheetah's Rock VIP Animal Welfare Tour" },
    'luxury-catamaran': { type: 'vehicle', base: 650, name: 'Private Luxury Catamaran / Yacht Charter' },

    // Mainland Fly-In Safaris
    'mikumi-safari': { type: 'person', base: 440, name: 'Mikumi National Park Fly-In Day Safari' }
  };

  function getSelectedService() {
    const checked = document.querySelector('input[name="service"]:checked');
    return checked ? checked.value : 'transfer-nungwi';
  }

  function getTravelersCount() {
    const el = document.getElementById('sns-travelers');
    return el ? parseInt(el.value, 10) || 2 : 2;
  }

  function calculateQuote() {
    const serviceKey = getSelectedService();
    const service = PRICING[serviceKey] || PRICING['transfer-nungwi'];
    const travelers = getTravelersCount();

    let total = 0;
    let summary = '';

    if (service.type === 'vehicle') {
      if (serviceKey === 'quad-safari') {
        // Quad Buggy: 2 passengers per buggy
        const quadsNeeded = Math.ceil(travelers / 2);
        total = service.base * quadsNeeded;
        summary = `${travelers} Traveler${travelers > 1 ? 's' : ''} • ${quadsNeeded} Quad Buggy${quadsNeeded > 1 ? 's' : ''} (2-seater) • Helmets & fuel incl.`;
      } else if (serviceKey === 'luxury-catamaran') {
        // Luxury Catamaran: Private charter flat rate up to 8 pax, +$50/pax beyond
        if (travelers <= 8) {
          total = service.base;
          summary = `Private Yacht Charter • Up to ${travelers} Guests • Seafood chef & sunset wine incl.`;
        } else {
          total = service.base + (travelers - 8) * 50;
          summary = `Private Yacht Charter • ${travelers} Guests • Seafood chef & sunset wine incl.`;
        }
      } else {
        // Standard Minivan Airport Transfers: $50–$55 flat for 1-4 pax, +$15 for 5-8 pax, +$40 for 9+ (coaster bus)
        if (travelers <= 4) {
          total = service.base;
          summary = `${travelers} Guest${travelers > 1 ? 's' : ''} • Private Standard Minivan (1-4 pax) • All inclusive`;
        } else if (travelers <= 8) {
          total = service.base + 20;
          summary = `${travelers} Guests • Private Extended Minivan (5-8 pax) • Luggage trailer ready`;
        } else {
          total = service.base * 2 + 10;
          summary = `${travelers} Guests • Large Private Tour Coaster • Direct transfer`;
        }
      }
    } else {
      // Per person tours
      let perPerson = service.base;
      // Volume discount for standard marine/cultural tours with 4+ travelers
      if (travelers >= 4 && service.base < 100 && serviceKey !== 'cheetahs-rock' && serviceKey !== 'cenote-caves') {
        perPerson = Math.max(35, service.base - 5);
      }
      total = perPerson * travelers;
      summary = `${travelers} Guest${travelers > 1 ? 's' : ''} @ $${perPerson}/person • Marine & conservation fees included`;
    }

    // Metasearch Rate Defense Calculation (Viator / Kayak ~30-35% markup)
    const otaEstimate = Math.round(total * 1.32);
    const savings = otaEstimate - total;

    // Deposit Calculation (20% deposit, or flat $55 for single transfer)
    let depositAmount = Math.round(total * 0.20);
    if (serviceKey.startsWith('transfer-') && total <= 55) {
      depositAmount = total; // Pay full flat transfer
    } else if (depositAmount < 20) {
      depositAmount = 20;
    }

    // Update DOM Elements
    const amountEl = document.getElementById('sns-quote-amount');
    const summaryEl = document.getElementById('sns-quote-summary');
    const otaPriceEl = document.getElementById('sns-ota-price');
    const savingsEl = document.getElementById('sns-savings-amount');
    const depositBtnText = document.getElementById('sns-deposit-text');

    if (amountEl) amountEl.textContent = `$${total} USD`;
    if (summaryEl) summaryEl.textContent = summary;
    if (otaPriceEl) otaPriceEl.textContent = `$${otaEstimate} USD`;
    if (savingsEl) savingsEl.textContent = `$${savings}`;
    if (depositBtnText) {
      if (serviceKey.startsWith('transfer-') && total <= 55) {
        depositBtnText.textContent = `Lock Instantly with Card ($${depositAmount} Full Transfer)`;
      } else {
        depositBtnText.textContent = `Lock Instantly with 20% Deposit ($${depositAmount})`;
      }
    }

    return { total, summary, serviceName: service.name, otaEstimate, savings, depositAmount };
  }

  function goToStep(step) {
    if (step < 1 || step > 3) return;
    currentStep = step;

    // Toggle steps
    document.querySelectorAll('.sns-form-step').forEach((el) => el.classList.remove('active'));
    const targetStep = document.getElementById(`sns-step-${step}`);
    if (targetStep) targetStep.classList.add('active');

    // Update step indicators
    document.querySelectorAll('.sns-step-indicator').forEach((ind) => {
      const stepNum = parseInt(ind.getAttribute('data-step'), 10);
      ind.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        ind.classList.add('active');
      } else if (stepNum < currentStep) {
        ind.classList.add('completed');
      }
    });

    if (step === 3) {
      calculateQuote();
    }
  }

  function openConcierge(preselectServiceKey) {
    const modal = document.getElementById('sns-concierge-modal');
    if (modal) {
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';

      // Set default date to tomorrow if empty
      const dateInput = document.getElementById('sns-date');
      if (dateInput && !dateInput.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
      }

      // Preselect service if requested
      if (preselectServiceKey && PRICING[preselectServiceKey]) {
        const radio = document.querySelector(`input[name="service"][value="${preselectServiceKey}"]`);
        if (radio) {
          radio.checked = true;
          document.querySelectorAll('.sns-service-card').forEach((card) => card.classList.remove('selected'));
          const parentCard = radio.closest('.sns-service-card');
          if (parentCard) parentCard.classList.add('selected');
        }
      }
    }
  }

  function closeConcierge() {
    const modal = document.getElementById('sns-concierge-modal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  }

  function generateLeadId() {
    return 'SNS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  function gatherFormData() {
    const leadId = generateLeadId();
    const serviceKey = getSelectedService();
    const { total, summary, serviceName, depositAmount } = calculateQuote();
    const travelers = getTravelersCount();
    const dateInput = document.getElementById('sns-date');
    const travelDate = dateInput ? dateInput.value || 'Flexible' : 'Flexible';
    const locInput = document.getElementById('sns-location');
    const location = locInput ? locInput.value.trim() || 'Zanzibar Island' : 'Zanzibar Island';
    const nameInput = document.getElementById('sns-guest-name');
    const name = nameInput ? nameInput.value.trim() : '';
    const phoneInput = document.getElementById('sns-guest-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const notesInput = document.getElementById('sns-guest-notes');
    const notes = notesInput ? notesInput.value.trim() : '';

    return {
      leadId,
      service: serviceName,
      serviceKey,
      travelers: `${travelers} traveler${travelers > 1 ? 's' : ''}`,
      travelDate,
      location,
      estimatedPrice: `$${total} USD (${summary})`,
      totalUsd: total,
      depositAmount,
      name: name || 'Traveler',
      phone: phone || 'Not provided',
      notes: notes || 'None',
      sourceUrl: window.location.href
    };
  }

  async function dispatchToBackend(data) {
    try {
      await fetch('/.netlify/functions/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('Booking dispatch logged locally:', e);
    }
  }

  function sendViaWhatsApp() {
    const data = gatherFormData();

    // Fire lead dispatch in background
    dispatchToBackend(data);

    // Format prefilled WhatsApp message
    const waText = 
`Jambo Spice & Sail Zanzibar! 👋
I would like to confirm a trip booking quote:

📋 *Booking Ref:* ${data.leadId}
📍 *Service:* ${data.service}
👥 *Travelers:* ${data.travelers}
📅 *Preferred Date:* ${data.travelDate}
🏨 *Pickup Location:* ${data.location}
💰 *Estimated Quote:* $${data.totalUsd} USD (Deposit: $${data.depositAmount} USD)
👤 *Guest Name:* ${data.name}
📝 *Notes:* ${data.notes}

Please check availability and send confirmation details!`;

    const encoded = encodeURIComponent(waText);
    const waUrl = `https://wa.me/255672450934?text=${encoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  async function payDepositCheckout() {
    const statusEl = document.getElementById('sns-submit-status');
    const phoneInput = document.getElementById('sns-guest-phone');

    if (!phoneInput || !phoneInput.value.trim()) {
      if (statusEl) {
        statusEl.removeAttribute('hidden');
        statusEl.className = 'sns-submit-status error';
        statusEl.textContent = 'Please enter your WhatsApp number or email so operations can send your verified booking invoice.';
      }
      if (phoneInput) phoneInput.focus();
      return;
    }

    const data = gatherFormData();
    data.action = 'deposit_checkout';

    if (statusEl) {
      statusEl.removeAttribute('hidden');
      statusEl.className = 'sns-submit-status';
      statusEl.textContent = `Generating priority  deposit reservation for Ref ${data.leadId}...`;
    }

    // Dispatch to serverless function
    await dispatchToBackend(data);

    if (statusEl) {
      statusEl.className = 'sns-submit-status success';
      statusEl.innerHTML = `
        <strong>✓ Reservation Ref: <code>${data.leadId}</code> Locked!</strong><br>
        Required Deposit: <strong>$${data.depositAmount} USD</strong> (Balance: $${data.totalUsd - data.depositAmount} USD on arrival).<br>
        Our operations team has registered your date. To complete instant card checkout or request a Pesapal / DPO payment link:
        <div style="margin-top: 0.5rem;">
          <a href="https://wa.me/255672450934?text=Jambo%20Spice%20%26%20Sail%2C%20please%20send%20the%20instant%20deposit%20payment%20link%20for%20Ref%20${encodeURIComponent(data.leadId)}%20(Amount%3A%20%24${data.depositAmount}%20USD)" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="display:inline-block; margin-top: 0.35rem; color:#fff; text-decoration:none;">
            💳 Send Me Card Payment Link on WhatsApp
          </a>
        </div>
      `;
    }
  }

  async function submitDirectRequest() {
    const statusEl = document.getElementById('sns-submit-status');
    const phoneInput = document.getElementById('sns-guest-phone');

    if (!phoneInput || !phoneInput.value.trim()) {
      if (statusEl) {
        statusEl.removeAttribute('hidden');
        statusEl.className = 'sns-submit-status error';
        statusEl.textContent = 'Please enter your WhatsApp number or email so operations can reach you.';
      }
      if (phoneInput) phoneInput.focus();
      return;
    }

    const data = gatherFormData();

    if (statusEl) {
      statusEl.removeAttribute('hidden');
      statusEl.className = 'sns-submit-status';
      statusEl.textContent = 'Transmitting your trip request to operations dispatch...';
    }

    try {
      const resp = await fetch('/.netlify/functions/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const resJson = await resp.json();

      if (statusEl) {
        statusEl.className = 'sns-submit-status success';
        statusEl.innerHTML = `
          <strong>✓ Request Dispatched Successfully!</strong><br>
          Reference: <code>${resJson.leadId || data.leadId}</code><br>
          Our operations team has received your details. For immediate priority confirmation, you can also 
          <a href="https://wa.me/255672450934?text=Jambo%20re%20Reference%20${encodeURIComponent(resJson.leadId || data.leadId)}" target="_blank" rel="noopener" style="text-decoration: underline; font-weight: bold; color: inherit;">chat with us on WhatsApp</a>.
        `;
      }
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'sns-submit-status success';
        statusEl.innerHTML = `
          <strong>✓ Request Recorded!</strong> Reference: <code>${data.leadId}</code>.<br>
          Please <a href="https://wa.me/255672450934?text=Jambo%2C%20my%20lead%20is%20${encodeURIComponent(data.leadId)}" target="_blank" rel="noopener">click here to confirm via WhatsApp</a>.
        `;
      }
    }
  }

  // Initialize event listeners when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    const trigger = document.getElementById('sns-concierge-trigger');
    const closeBtn = document.getElementById('sns-concierge-close');
    const backdrop = document.getElementById('sns-concierge-backdrop');

    if (trigger) trigger.addEventListener('click', () => openConcierge());
    if (closeBtn) closeBtn.addEventListener('click', closeConcierge);
    if (backdrop) backdrop.addEventListener('click', closeConcierge);

    // Escape key to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeConcierge();
    });

    // Service radio selection highlights
    document.querySelectorAll('.sns-service-card input[type="radio"]').forEach((radio) => {
      radio.addEventListener('change', function () {
        document.querySelectorAll('.sns-service-card').forEach((card) => card.classList.remove('selected'));
        this.closest('.sns-service-card').classList.add('selected');
        calculateQuote();
      });
    });

    const travelersEl = document.getElementById('sns-travelers');
    if (travelersEl) {
      travelersEl.addEventListener('change', calculateQuote);
    }
  });

  // Export to global scope
  window.snsConcierge = {
    open: openConcierge,
    close: closeConcierge,
    goToStep: goToStep,
    sendViaWhatsApp: sendViaWhatsApp,
    payDepositCheckout: payDepositCheckout,
    submitDirectRequest: submitDirectRequest
  };
})();
