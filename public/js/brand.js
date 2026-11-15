(function () {
 "use strict";
 function initBookingForms() {
  document.querySelectorAll("[data-whatsapp-booking]").forEach(function(form) {
   if(form.dataset.bookingReady==="true")return;
   form.dataset.bookingReady="true";
   form.addEventListener("submit",function(event) {
    event.preventDefault();
    var service=form.elements.service, date=form.elements.date, guests=form.elements.guests;
    var serviceName=service?String(service.value||"").trim():"";
    if(!serviceName){if(service)service.focus();return;}
    var message=["Jambo Spice & Sail, I would like to enquire about a trip.","Type: "+(form.getAttribute("data-booking-type")||"Trip enquiry"),"Service: "+serviceName,"Preferred date: "+(date&&date.value?date.value:"Flexible dates"),"Guests: "+(guests?guests.value:"2")].join("\n");
    var phone=form.getAttribute("data-wa-number");
    if(!phone)return;
    if(window.SNS_ANALYTICS_ENABLED===true&&typeof window.gtag==="function")window.gtag("event","booking_whatsapp_started",{event_category:"Booking",event_label:serviceName});
    window.open("https://wa.me/"+encodeURIComponent(phone)+"?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");
   });
  });
 }
 function initMaps() {
  document.querySelectorAll("[data-load-map]").forEach(function(button) {
   button.addEventListener("click",function() {
    var container=button.closest("[data-map-container]")||button.parentElement;
    var frame=container&&container.querySelector("iframe[data-map-src]");
    if(!frame)return;
    if(!frame.getAttribute("src"))frame.setAttribute("src",frame.getAttribute("data-map-src"));
    button.textContent="Map loaded";button.disabled=true;
   },{once:true});
  });
 }
 function init(){initBookingForms();initMaps();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
