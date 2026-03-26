/**
 * TERRA VOYAGE - PAGE DÉTAILS
 * Affichage des détails d'un vol ou hôtel avant réservation
 */

import { formatPrice } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// Récupérer les données de l'offre sélectionnée
const selectedOffer = JSON.parse(sessionStorage.getItem('selected_offer') || '{}');
const offerType = sessionStorage.getItem('selected_offer_type') || 'flight';

function renderFlightDetails(offer) {
    const firstSegment = offer.slices?.[0]?.segments?.[0];
    const airlineName = offer.owner?.name || firstSegment?.operating_carrier?.name || 'Compagnie';
    const airlineCode = offer.owner?.iata_code || firstSegment?.operating_carrier?.iata_code || '';

    return `
        <div class="detail-card p-8">
            <div class="flex items-center gap-4 mb-6">
                <img src="https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${airlineCode}.png" 
                     class="h-16 w-16 object-contain"
                     onerror="this.src='data:image/svg+xml,%3Csvg...%3E'">
                <div>
                    <h1 class="text-2xl font-bold">${sanitize(airlineName)}</h1>
                    <p class="text-gray-500">Vol ${offer.slices?.[0]?.segments?.[0]?.marketing_carrier_flight_number || '---'}</p>
                </div>
            </div>
            
            <div class="grid md:grid-cols-3 gap-6 py-8 border-y border-gray-100">
                <div class="text-center">
                    <p class="text-3xl font-bold">${formatFlightTime(firstSegment?.departing_at)}</p>
                    <p class="text-gray-500">${firstSegment?.origin?.city_name || 'Départ'}</p>
                    <p class="text-xs text-gray-400">${formatDate(firstSegment?.departing_at)}</p>
                </div>
                <div class="text-center">
                    <i class="fas fa-plane text-gray-400 text-2xl"></i>
                    <p class="text-sm text-gray-500 mt-2">Durée: ${formatDuration(offer.slices?.[0]?.duration)}</p>
                </div>
                <div class="text-center">
                    <p class="text-3xl font-bold">${formatFlightTime(firstSegment?.arriving_at)}</p>
                    <p class="text-gray-500">${firstSegment?.destination?.city_name || 'Arrivée'}</p>
                    <p class="text-xs text-gray-400">${formatDate(firstSegment?.arriving_at)}</p>
                </div>
            </div>
            
            <div class="mt-6 p-4 bg-gray-50 rounded-xl">
                <h3 class="font-bold mb-3">Détails des bagages</h3>
                <p>Bagage en soute: 1 inclus</p>
                <p>Bagage cabine: 1 inclus</p>
            </div>
            
            <div class="mt-8 flex justify-between items-center">
                <div>
                    <p class="text-sm text-gray-500">Total TTC</p>
                    <p class="text-3xl font-bold text-blue-600">${formatPrice(offer.total_amount || offer.intended_total_amount)}</p>
                </div>
                <button onclick="proceedToCheckout()" class="btn-primary px-8 py-3">
                    Continuer vers la réservation <i class="fas fa-arrow-right ml-2"></i>
                </button>
            </div>
        </div>
    `;
}

function renderHotelDetails(hotel) {
    return `
        <div class="detail-card">
            <img src="${hotel.main_photo || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'}" 
                 class="w-full h-64 object-cover"
                 onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'">
            <div class="p-8">
                <h1 class="text-2xl font-bold">${sanitize(hotel.name)}</h1>
                <p class="text-gray-500 mt-1"><i class="fas fa-map-marker-alt mr-1"></i> ${sanitize(hotel.address || hotel.city)}</p>
                
                <div class="flex items-center gap-2 mt-4">
                    ${renderStars(hotel.rating || 4)}
                    <span class="text-sm text-gray-500">(${hotel.review_count || 0} avis)</span>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-xl">
                    <div>
                        <p class="text-sm text-gray-500">Check-in</p>
                        <p class="font-semibold">${sessionStorage.getItem('check_in') || 'À partir de 15:00'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Check-out</p>
                        <p class="font-semibold">${sessionStorage.getItem('check_out') || 'Jusqu\'à 11:00'}</p>
                    </div>
                </div>
                
                <div class="mt-6">
                    <h3 class="font-bold mb-2">Équipements</h3>
                    <div class="flex flex-wrap gap-2">
                        ${(hotel.amenities || ['Wi-Fi', 'Climatisation', 'TV']).map(a => 
                            `<span class="bg-gray-100 px-3 py-1 rounded-full text-sm">${a}</span>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="mt-8 flex justify-between items-center">
                    <div>
                        <p class="text-sm text-gray-500">Prix par nuit</p>
                        <p class="text-3xl font-bold text-blue-600">${formatPrice(hotel.price_per_night || hotel.price)}</p>
                        <p class="text-xs text-gray-400">Total séjour: ${formatPrice((hotel.price_per_night || hotel.price) * 3)}</p>
                    </div>
                    <button onclick="proceedToCheckout()" class="btn-primary px-8 py-3">
                        Réserver maintenant <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function proceedToCheckout() {
    // Stocker les données de réservation
    sessionStorage.setItem('booking_data', JSON.stringify({
        offer: selectedOffer,
        type: offerType,
        timestamp: new Date().toISOString()
    }));
    window.location.href = './checkout.html';
}

function init() {
    const container = document.getElementById('details-container');
    
    if (!selectedOffer || Object.keys(selectedOffer).length === 0) {
        container.innerHTML = `
            <div class="text-center py-20">
                <i class="fas fa-exclamation-circle text-5xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">Aucune offre sélectionnée</p>
                <a href="./results.html" class="text-blue-600 mt-4 inline-block">← Retour aux résultats</a>
            </div>
        `;
        return;
    }
    
    if (offerType === 'flight') {
        container.innerHTML = renderFlightDetails(selectedOffer);
    } else {
        container.innerHTML = renderHotelDetails(selectedOffer);
    }
}

function formatFlightTime(dateStr) {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
}

function formatDuration(durationStr) {
    if (!durationStr) return '--';
    const match = durationStr.match(/PT(\d+)H(\d+)M/);
    if (match) return `${match[1]}h${match[2]}`;
    return durationStr;
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400 text-sm"></i>';
    for (let i = fullStars; i < 5; i++) stars += '<i class="far fa-star text-gray-300 text-sm"></i>';
    return stars;
}

init();
window.proceedToCheckout = proceedToCheckout;