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
    var lang=form.getAttribute("data-lang")||"en";
    var dateValue=date&&date.value?date.value:"Flexible dates";
    var guestValue=guests?guests.value:"2";
    var enquiryType=form.getAttribute("data-booking-type")||"Trip enquiry";
    if(lang==="it") enquiryType=enquiryType==="Transfer enquiry"?"Richiesta transfer":(enquiryType==="Tour enquiry"?"Richiesta tour":"Richiesta tour o transfer");
    else if(lang==="de") enquiryType=enquiryType==="Transfer enquiry"?"Transferanfrage":(enquiryType==="Tour enquiry"?"Touranfrage":"Tour- oder Transferanfrage");
    var parts;
    if(lang==="it"){
      parts=["Jambo Spice & Sail, vorrei informazioni su un'esperienza.","Tipo: "+enquiryType,"Servizio: "+serviceName,"Data preferita: "+dateValue,"Ospiti: "+guestValue];
    }else if(lang==="de"){
      parts=["Hallo Spice & Sail, ich möchte eine Tour oder einen Transfer anfragen.","Art: "+enquiryType,"Tour/Service: "+serviceName,"Wunschdatum: "+dateValue,"Gäste: "+guestValue];
    }else{
      parts=["Jambo Spice & Sail, I would like to enquire about a trip.","Type: "+enquiryType,"Service: "+serviceName,"Preferred date: "+dateValue,"Guests: "+guestValue];
    }
    var phone=form.getAttribute("data-wa-number");
    if(!phone)return;
    if(window.SNS_ANALYTICS_ENABLED===true&&typeof window.gtag==="function")window.gtag("event","booking_whatsapp_started",{event_category:"Booking",event_label:serviceName});
    window.open("https://wa.me/"+encodeURIComponent(phone)+"?text="+encodeURIComponent(parts.join("\n")),"_blank","noopener,noreferrer");
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
