/**
 * TERRA VOYAGE - CHECKOUT PAGE
 * Gestion du paiement et de la réservation
 */

import { formatPrice, formatDate } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// Récupérer l'offre sélectionnée
const selectedOffer = JSON.parse(sessionStorage.getItem('selected_offer') || '{}');
const offerType = sessionStorage.getItem('selected_offer_type') || 'flight';

// Éléments DOM
let payButton;
let termsCheckbox;

// ============================================
// AFFICHAGE DU RÉSUMÉ
// ============================================

function formatFlightTime(timeStr) {
    if (!timeStr) return '--:--';
    var date = new Date(timeStr);
    return date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function formatDateLong(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
}

function renderFlightSummary(offer) {
    var firstSlice = offer.slices && offer.slices[0] ? offer.slices[0] : null;
    var firstSegment = firstSlice && firstSlice.segments && firstSlice.segments[0] ? firstSlice.segments[0] : null;
    
    var airlineName = offer.owner && offer.owner.name ? offer.owner.name : 'Compagnie aérienne';
    var airlineCode = offer.owner && offer.owner.iata_code ? offer.owner.iata_code : '';
    var originCity = firstSegment && firstSegment.origin && firstSegment.origin.city_name ? firstSegment.origin.city_name : 'Départ';
    var destCity = firstSegment && firstSegment.destination && firstSegment.destination.city_name ? firstSegment.destination.city_name : 'Arrivée';
    var departureTime = formatFlightTime(firstSegment ? firstSegment.departing_at : null);
    var arrivalTime = formatFlightTime(firstSegment ? firstSegment.arriving_at : null);
    var departureDate = formatDateLong(firstSegment ? firstSegment.departing_at : null);
    
    var price = offer.total_amount || offer.intended_total_amount || offer.price || 0;
    var currency = offer.total_currency || offer.currency || 'EUR';
    
    return `
        <div class="flex items-center gap-3 pb-3 border-b border-gray-100">
            <img src="https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${airlineCode}.png" 
                 class="w-12 h-12 object-contain rounded-full bg-gray-100 p-1"
                 onerror="this.src='data:image/svg+xml,%3Csvg...%3E'">
            <div>
                <p class="font-bold text-gray-800">${sanitize(airlineName)}</p>
                <p class="text-xs text-gray-500">Vol ${firstSegment ? firstSegment.marketing_carrier_flight_number : '---'}</p>
            </div>
        </div>
        <div class="flex justify-between items-center py-3">
            <div class="text-center">
                <p class="text-xl font-bold">${departureTime}</p>
                <p class="text-sm text-gray-600">${sanitize(originCity)}</p>
                <p class="text-xs text-gray-400">${departureDate}</p>
            </div>
            <i class="fas fa-plane text-gray-400"></i>
            <div class="text-center">
                <p class="text-xl font-bold">${arrivalTime}</p>
                <p class="text-sm text-gray-600">${sanitize(destCity)}</p>
            </div>
        </div>
    `;
}

function renderHotelSummary(hotel) {
    var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 0;
    var nights = 3; // À calculer depuis les dates en session
    var totalPrice = price * nights;
    
    return `
        <div class="flex gap-3 pb-3 border-b border-gray-100">
            <img src="${hotel.main_photo || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100'}" 
                 class="w-16 h-16 object-cover rounded-lg"
                 onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100'">
            <div>
                <p class="font-bold text-gray-800">${sanitize(hotel.name)}</p>
                <p class="text-xs text-gray-500">${sanitize(hotel.address || hotel.city)}</p>
                <p class="text-xs text-gray-400 mt-1">⭐ ${hotel.rating || 4}/5</p>
            </div>
        </div>
        <div class="py-3">
            <div class="flex justify-between text-sm">
                <span class="text-gray-500">Prix par nuit</span>
                <span class="font-semibold">${formatPrice(price)}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
                <span class="text-gray-500">Nombre de nuits</span>
                <span class="font-semibold">${nights} nuits</span>
            </div>
        </div>
    `;
}

function displaySummary() {
    var container = document.getElementById('offer-summary');
    var subtotalSpan = document.getElementById('subtotal');
    var taxesSpan = document.getElementById('taxes');
    var totalSpan = document.getElementById('total');
    
    if (!selectedOffer || Object.keys(selectedOffer).length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-red-500">Erreur: aucune offre sélectionnée</div>';
        return;
    }
    
    var price = 0;
    var summaryHtml = '';
    
    if (offerType === 'flight') {
        price = selectedOffer.total_amount || selectedOffer.intended_total_amount || selectedOffer.price || 0;
        summaryHtml = renderFlightSummary(selectedOffer);
    } else {
        price = selectedOffer.price_per_night || selectedOffer.price || selectedOffer.totalPrice || 0;
        summaryHtml = renderHotelSummary(selectedOffer);
        // Pour les hôtels, multiplier par le nombre de nuits (par défaut 3)
        var nights = 3;
        var searchParams = sessionStorage.getItem('search_params');
        if (searchParams) {
            var params = JSON.parse(searchParams);
            if (params.departureDate && params.returnDate) {
                var checkIn = new Date(params.departureDate);
                var checkOut = new Date(params.returnDate);
                nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                price = price * nights;
            }
        }
    }
    
    var subtotal = price;
    var taxes = Math.round(price * 0.1); // 10% de taxes
    var total = subtotal + taxes;
    
    container.innerHTML = summaryHtml;
    if (subtotalSpan) subtotalSpan.innerText = formatPrice(subtotal);
    if (taxesSpan) taxesSpan.innerText = formatPrice(taxes);
    if (totalSpan) totalSpan.innerText = formatPrice(total);
    
    return total;
}

// ============================================
// MODES DE PAIEMENT
// ============================================

function initPaymentMethods() {
    var methods = document.querySelectorAll('.payment-method');
    var cardFields = document.getElementById('card-fields');
    var paypalFields = document.getElementById('paypal-fields');
    var walletFields = document.getElementById('wallet-fields');
    
    methods.forEach(function(method) {
        method.addEventListener('click', function() {
            methods.forEach(function(m) { m.classList.remove('active'); });
            this.classList.add('active');
            
            var selectedMethod = this.getAttribute('data-method');
            
            if (selectedMethod === 'card') {
                if (cardFields) cardFields.classList.remove('hidden');
                if (paypalFields) paypalFields.classList.add('hidden');
                if (walletFields) walletFields.classList.add('hidden');
            } else if (selectedMethod === 'paypal') {
                if (cardFields) cardFields.classList.add('hidden');
                if (paypalFields) paypalFields.classList.remove('hidden');
                if (walletFields) walletFields.classList.add('hidden');
            } else if (selectedMethod === 'wallet') {
                if (cardFields) cardFields.classList.add('hidden');
                if (paypalFields) paypalFields.classList.add('hidden');
                if (walletFields) walletFields.classList.remove('hidden');
            }
        });
    });
}

// ============================================
// VALIDATION DU FORMULAIRE
// ============================================

function validateForm() {
    var fullName = document.getElementById('full-name') ? document.getElementById('full-name').value.trim() : '';
    var email = document.getElementById('email') ? document.getElementById('email').value.trim() : '';
    var phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
    var terms = document.getElementById('terms') ? document.getElementById('terms').checked : false;
    
    if (!fullName) {
        alert('Veuillez entrer votre nom complet');
        return false;
    }
    if (!email) {
        alert('Veuillez entrer votre email');
        return false;
    }
    if (!email.includes('@')) {
        alert('Email invalide');
        return false;
    }
    if (!phone) {
        alert('Veuillez entrer votre numéro de téléphone');
        return false;
    }
    if (!terms) {
        alert('Veuillez accepter les conditions générales');
        return false;
    }
    
    // Validation carte si mode carte sélectionné
    var activeMethod = document.querySelector('.payment-method.active');
    if (activeMethod && activeMethod.getAttribute('data-method') === 'card') {
        var cardNumber = document.getElementById('card-number') ? document.getElementById('card-number').value.trim() : '';
        var cardExpiry = document.getElementById('card-expiry') ? document.getElementById('card-expiry').value.trim() : '';
        var cardCvv = document.getElementById('card-cvv') ? document.getElementById('card-cvv').value.trim() : '';
        
        var cardNumberClean = cardNumber.replace(/\s/g, '');
        if (cardNumberClean.length < 15) {
            alert('Numéro de carte invalide');
            return false;
        }
        if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
            alert('Date d\'expiration invalide (MM/YY)');
            return false;
        }
        if (cardCvv.length < 3) {
            alert('CVV invalide');
            return false;
        }
    }
    
    return true;
}

// ============================================
// TRAITEMENT DU PAIEMENT
// ============================================

async function processPayment() {
    if (!validateForm()) return;
    
    var payButton = document.getElementById('pay-button');
    var originalText = payButton.innerHTML;
    
    // Désactiver le bouton
    payButton.disabled = true;
    payButton.innerHTML = '<span class="loader"></span> Traitement en cours...';
    
    // Récupérer les données client
    var customer = {
        name: document.getElementById('full-name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        country: document.getElementById('country').value
    };
    
    // Calculer le total
    var total = 0;
    if (offerType === 'flight') {
        total = selectedOffer.total_amount || selectedOffer.intended_total_amount || selectedOffer.price || 0;
    } else {
        total = selectedOffer.price_per_night || selectedOffer.price || selectedOffer.totalPrice || 0;
        var searchParams = sessionStorage.getItem('search_params');
        if (searchParams) {
            var params = JSON.parse(searchParams);
            if (params.departureDate && params.returnDate) {
                var checkIn = new Date(params.departureDate);
                var checkOut = new Date(params.returnDate);
                var nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                total = total * nights;
            }
        }
    }
    
    var taxes = Math.round(total * 0.1);
    var finalTotal = total + taxes;
    
    // Préparer les données de réservation
    var bookingData = {
        type: offerType,
        details: selectedOffer,
        customer: customer,
        totalPrice: finalTotal,
        paymentMethod: document.querySelector('.payment-method.active').getAttribute('data-method'),
        bookingDate: new Date().toISOString()
    };
    
    try {
        // Appel à l'API de réservation
        var response = await fetch('https://agence-de-voyage-web.onrender.com/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        
        var result = await response.json();
        
        if (result.success) {
            // Stocker la confirmation
            sessionStorage.setItem('booking_confirmation', JSON.stringify({
                booking: result.booking,
                customer: customer,
                offer: selectedOffer,
                offerType: offerType,
                totalPrice: finalTotal,
                bookingDate: new Date().toISOString()
            }));
            
            // Rediriger vers la page de confirmation
            window.location.href = './confirmation.html';
        } else {
            throw new Error(result.error || 'Erreur lors de la réservation');
        }
        
    } catch (error) {
        console.error('Erreur paiement:', error);
        alert('Erreur lors du traitement du paiement: ' + error.message + '\n\nVeuillez réessayer ou contacter notre service client.');
        
        // Réactiver le bouton
        payButton.disabled = false;
        payButton.innerHTML = originalText;
    }
}

// ============================================
// FORMATAGE DES CHAMPS DE CARTE
// ============================================

function formatCardNumber(input) {
    var value = input.value.replace(/\s/g, '').replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    var formatted = value.replace(/(\d{4})/g, '$1 ').trim();
    input.value = formatted;
}

function formatCardExpiry(input) {
    var value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
}

function formatCardCvv(input) {
    var value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    input.value = value;
}

// ============================================
// INITIALISATION
// ============================================

function init() {
    // Afficher le résumé
    displaySummary();
    
    // Initialiser les modes de paiement
    initPaymentMethods();
    
    // Formater les champs de carte
    var cardNumber = document.getElementById('card-number');
    var cardExpiry = document.getElementById('card-expiry');
    var cardCvv = document.getElementById('card-cvv');
    
    if (cardNumber) {
        cardNumber.addEventListener('input', function() { formatCardNumber(this); });
    }
    if (cardExpiry) {
        cardExpiry.addEventListener('input', function() { formatCardExpiry(this); });
    }
    if (cardCvv) {
        cardCvv.addEventListener('input', function() { formatCardCvv(this); });
    }
    
    // Bouton de paiement
    payButton = document.getElementById('pay-button');
    termsCheckbox = document.getElementById('terms');
    
    if (payButton) {
        payButton.addEventListener('click', processPayment);
    }
    
    // Activer/désactiver le bouton selon les conditions
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function() {
            if (payButton) payButton.disabled = !this.checked;
        });
        // Par défaut, le bouton est désactivé
        if (payButton) payButton.disabled = true;
    }
    
    // Vérifier si une offre est sélectionnée
    if (!selectedOffer || Object.keys(selectedOffer).length === 0) {
        document.querySelector('.checkout-card').innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-circle text-5xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Aucune offre sélectionnée</p>
                <a href="./results.html" class="text-blue-600 mt-4 inline-block">← Retour aux résultats</a>
            </div>
        `;
    }
}

// Démarrer
init();