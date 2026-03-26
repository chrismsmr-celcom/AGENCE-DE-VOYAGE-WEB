/**
 * TERRA VOYAGE - CONFIRMATION PAGE
 * Affichage des détails de la réservation confirmée
 */

import { formatPrice, formatDate } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// Récupérer les données de confirmation
const confirmation = JSON.parse(sessionStorage.getItem('booking_confirmation') || '{}');
const booking = confirmation.booking || {};
const customer = confirmation.customer || {};
const offer = confirmation.offer || {};
const offerType = confirmation.offerType || 'flight';
const totalPrice = confirmation.totalPrice || 0;
const bookingDate = confirmation.bookingDate ? new Date(confirmation.bookingDate) : new Date();

// Numéro de réservation aléatoire
const bookingNumber = 'TRV-' + Math.random().toString(36).substring(2, 10).toUpperCase();

// ============================================
// AFFICHAGE DES DÉTAILS
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

function renderFlightDetails() {
    var firstSlice = offer.slices && offer.slices[0] ? offer.slices[0] : null;
    var firstSegment = firstSlice && firstSlice.segments && firstSlice.segments[0] ? firstSlice.segments[0] : null;
    
    var airlineName = offer.owner && offer.owner.name ? offer.owner.name : 'Compagnie aérienne';
    var airlineCode = offer.owner && offer.owner.iata_code ? offer.owner.iata_code : '';
    var originCity = firstSegment && firstSegment.origin && firstSegment.origin.city_name ? firstSegment.origin.city_name : 'Départ';
    var destCity = firstSegment && firstSegment.destination && firstSegment.destination.city_name ? firstSegment.destination.city_name : 'Arrivée';
    var departureTime = formatFlightTime(firstSegment ? firstSegment.departing_at : null);
    var arrivalTime = formatFlightTime(firstSegment ? firstSegment.arriving_at : null);
    var departureDate = formatDateLong(firstSegment ? firstSegment.departing_at : null);
    var arrivalDate = formatDateLong(firstSegment ? firstSegment.arriving_at : null);
    
    return `
        <div class="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
            <img src="https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${airlineCode}.png" 
                 class="w-14 h-14 object-contain rounded-full bg-gray-100 p-2"
                 onerror="this.src='data:image/svg+xml,%3Csvg...%3E'">
            <div>
                <p class="font-bold text-lg">${sanitize(airlineName)}</p>
                <p class="text-sm text-gray-500">Vol ${firstSegment ? firstSegment.marketing_carrier_flight_number : '---'}</p>
            </div>
        </div>
        
        <div class="grid grid-cols-3 gap-4 text-center mb-6">
            <div>
                <p class="text-2xl font-bold">${departureTime}</p>
                <p class="text-gray-600">${sanitize(originCity)}</p>
                <p class="text-xs text-gray-400">${departureDate}</p>
            </div>
            <div class="flex items-center justify-center">
                <i class="fas fa-plane text-gray-400 text-xl"></i>
            </div>
            <div>
                <p class="text-2xl font-bold">${arrivalTime}</p>
                <p class="text-gray-600">${sanitize(destCity)}</p>
                <p class="text-xs text-gray-400">${arrivalDate}</p>
            </div>
        </div>
        
        <div class="bg-gray-100 rounded-xl p-4">
            <div class="flex justify-between mb-2">
                <span class="text-gray-600">Classe</span>
                <span class="font-semibold">${offer.cabin_class_marketing_name || 'Économique'}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Bagages</span>
                <span class="font-semibold">1 bagage soute + 1 bagage cabine</span>
            </div>
        </div>
    `;
}

function renderHotelDetails() {
    var price = offer.price_per_night || offer.price || offer.totalPrice || 0;
    var nights = 3;
    var searchParams = sessionStorage.getItem('search_params');
    if (searchParams) {
        var params = JSON.parse(searchParams);
        if (params.departureDate && params.returnDate) {
            var checkIn = new Date(params.departureDate);
            var checkOut = new Date(params.returnDate);
            nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        }
    }
    
    return `
        <div class="flex gap-4 mb-6 pb-4 border-b border-gray-200">
            <img src="${offer.main_photo || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100'}" 
                 class="w-20 h-20 object-cover rounded-lg"
                 onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100'">
            <div>
                <p class="font-bold text-lg">${sanitize(offer.name)}</p>
                <p class="text-sm text-gray-500">${sanitize(offer.address || offer.city)}</p>
                <div class="flex items-center gap-1 mt-1">
                    ${renderStars(offer.rating || 4)}
                    <span class="text-xs text-gray-500 ml-1">(${offer.review_count || 0} avis)</span>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gray-100 rounded-xl p-3 text-center">
                <p class="text-xs text-gray-500">Arrivée</p>
                <p class="font-semibold">15:00</p>
            </div>
            <div class="bg-gray-100 rounded-xl p-3 text-center">
                <p class="text-xs text-gray-500">Départ</p>
                <p class="font-semibold">11:00</p>
            </div>
        </div>
        
        <div class="bg-gray-100 rounded-xl p-4">
            <div class="flex justify-between mb-2">
                <span class="text-gray-600">Prix par nuit</span>
                <span class="font-semibold">${formatPrice(price)}</span>
            </div>
            <div class="flex justify-between mb-2">
                <span class="text-gray-600">Nombre de nuits</span>
                <span class="font-semibold">${nights} nuits</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-gray-200 mt-2">
                <span class="font-bold">Total séjour</span>
                <span class="font-bold text-blue-600">${formatPrice(price * nights)}</span>
            </div>
        </div>
    `;
}

function renderStars(rating) {
    var fullStars = Math.floor(rating);
    var stars = '';
    for (var i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400 text-xs"></i>';
    for (var i = fullStars; i < 5; i++) stars += '<i class="far fa-star text-gray-300 text-xs"></i>';
    return stars;
}

function displayDetails() {
    var container = document.getElementById('booking-details');
    
    if (!offer || Object.keys(offer).length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                <p>Erreur: aucune réservation trouvée</p>
                <a href="/" class="text-blue-600 mt-4 inline-block">Retour à l'accueil</a>
            </div>
        `;
        return;
    }
    
    var offerDetails = '';
    if (offerType === 'flight') {
        offerDetails = renderFlightDetails();
    } else {
        offerDetails = renderHotelDetails();
    }
    
    container.innerHTML = `
        <div class="mb-4 pb-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-sm text-gray-500">Numéro de réservation</p>
                    <p class="font-mono font-bold text-lg">${bookingNumber}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Date de réservation</p>
                    <p class="font-semibold">${bookingDate.toLocaleDateString('fr-FR')}</p>
                </div>
            </div>
        </div>
        
        ${offerDetails}
        
        <div class="mt-6 pt-4 border-t border-gray-200">
            <h3 class="font-semibold mb-3">Informations voyageur</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-500">Nom</p>
                    <p class="font-medium">${sanitize(customer.name || 'Non renseigné')}</p>
                </div>
                <div>
                    <p class="text-gray-500">Email</p>
                    <p class="font-medium">${sanitize(customer.email || 'Non renseigné')}</p>
                </div>
                <div>
                    <p class="text-gray-500">Téléphone</p>
                    <p class="font-medium">${sanitize(customer.phone || 'Non renseigné')}</p>
                </div>
                <div>
                    <p class="text-gray-500">Pays</p>
                    <p class="font-medium">${sanitize(customer.country || 'Non renseigné')}</p>
                </div>
            </div>
        </div>
        
        <div class="mt-6 pt-4 border-t border-gray-200 bg-blue-50 -mx-6 px-6 py-4 rounded-b-xl">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-sm text-gray-600">Total payé</p>
                    <p class="text-2xl font-bold text-blue-600">${formatPrice(totalPrice)}</p>
                </div>
                <div class="text-right">
                    <i class="fas fa-check-circle text-green-500 text-2xl"></i>
                    <p class="text-xs text-green-600">Paiement confirmé</p>
                </div>
            </div>
        </div>
    `;
}

// Initialisation
displayDetails();

// Nettoyer sessionStorage après affichage (optionnel)
// setTimeout(function() {
//     sessionStorage.removeItem('booking_confirmation');
//     sessionStorage.removeItem('selected_offer');
//     sessionStorage.removeItem('selected_offer_type');
// }, 5000);