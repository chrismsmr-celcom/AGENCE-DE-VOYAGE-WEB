/**
 * TERRA VOYAGE - RESULTS PAGE
 * Affichage des résultats de recherche avec filtres et tri
 * Version complète avec gestion des vols et hôtels
 */

import { api } from '../core/api-client.js';
import { formatPrice, formatDate, formatFlightTimes } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// ============================================
// CONSTANTES ET CONFIGURATION
// ============================================

// URL de l'API backend sur Render
const API_BASE_URL = 'https://agence-de-voyage-web.onrender.com/api';

// Logo par défaut en data URI (évite les appels externes)
const DEFAULT_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40' viewBox='0 0 60 40'%3E%3Crect width='60' height='40' fill='%233b82f6'/%3E%3Ctext x='30' y='25' font-size='12' font-family='monospace' text-anchor='middle' fill='white'%3E✈️%3C/text%3E%3C/svg%3E";

// Image par défaut pour les hôtels
const DEFAULT_HOTEL_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='150' y='100' text-anchor='middle' dy='.3em' fill='%239ca3af'%3E🏨%3C/text%3E%3C/svg%3E";

// Variables globales
let currentResults = [];
let currentSearchType = 'flight';
let currentFilters = {
    maxPrice: 1500,
    directOnly: false,
    oneStopMax: false,
    selectedAirlines: [],
    timeOfDay: { morning: false, afternoon: false, evening: false }
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Récupère le logo d'une compagnie aérienne via l'API Render
 */
function getAirlineLogo(iataCode) {
    const code = (iataCode || 'AIR').toUpperCase();
    return `${API_BASE_URL}/airline-logo/${code}`;
}

function getAirlineName(offer) {
    if (offer.owner?.name) return offer.owner.name;
    if (offer.slices?.[0]?.segments?.[0]?.operating_carrier?.name) {
        return offer.slices[0].segments[0].operating_carrier.name;
    }
    return 'Compagnie aérienne';
}

function getAirlineIATA(offer) {
    if (offer.owner?.iata_code) return offer.owner.iata_code;
    if (offer.slices?.[0]?.segments?.[0]?.operating_carrier?.iata_code) {
        return offer.slices[0].segments[0].operating_carrier.iata_code;
    }
    return null;
}

function getStops(offer) {
    return (offer.slices?.[0]?.segments?.length || 1) - 1;
}

function getFlightDuration(offer) {
    const firstSegment = offer.slices?.[0]?.segments?.[0];
    if (!firstSegment) return null;
    const duration = firstSegment.duration;
    if (duration && typeof duration === 'number' && !isNaN(duration) && duration > 0) {
        return duration;
    }
    return null;
}

function getDepartureHour(offer) {
    const firstSegment = offer.slices?.[0]?.segments?.[0];
    if (!firstSegment?.departing_at) return null;
    return new Date(firstSegment.departing_at).getHours();
}

function getTimeOfDayCategory(hour) {
    if (hour === null) return null;
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
}

// ============================================
// FILTRES VOLS
// ============================================

function applyFilters(offers) {
    return offers.filter(function(offer) {
        var price = offer.total_amount || offer.totalAmount || offer.price || 0;
        if (price > currentFilters.maxPrice) return false;
        
        var stops = getStops(offer);
        if (currentFilters.directOnly && stops > 0) return false;
        if (currentFilters.oneStopMax && stops > 1) return false;
        
        var airlineCode = getAirlineIATA(offer);
        var airlineName = getAirlineName(offer);
        if (currentFilters.selectedAirlines.length > 0) {
            var matches = currentFilters.selectedAirlines.some(function(selected) {
                return selected === airlineCode || selected === airlineName;
            });
            if (!matches) return false;
        }
        
        var hour = getDepartureHour(offer);
        var timeCategory = getTimeOfDayCategory(hour);
        var hasTimeFilter = currentFilters.timeOfDay.morning || 
                           currentFilters.timeOfDay.afternoon || 
                           currentFilters.timeOfDay.evening;
        
        if (hasTimeFilter && timeCategory) {
            if (currentFilters.timeOfDay.morning && timeCategory === 'morning') return true;
            if (currentFilters.timeOfDay.afternoon && timeCategory === 'afternoon') return true;
            if (currentFilters.timeOfDay.evening && timeCategory === 'evening') return true;
            return false;
        }
        
        return true;
    });
}

function sortOffers(offers, sortType) {
    var sorted = [...offers];
    switch(sortType) {
        case 'price_asc':
            return sorted.sort(function(a, b) {
                var pa = a.total_amount || a.totalAmount || a.price || 0;
                var pb = b.total_amount || b.totalAmount || b.price || 0;
                return pa - pb;
            });
        case 'price_desc':
            return sorted.sort(function(a, b) {
                var pa = a.total_amount || a.totalAmount || a.price || 0;
                var pb = b.total_amount || b.totalAmount || b.price || 0;
                return pb - pa;
            });
        default:
            return sorted;
    }
}

// ============================================
// FILTRES HÔTELS
// ============================================

function applyHotelFilters(hotels) {
    return hotels.filter(function(hotel) {
        var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 0;
        if (price > currentFilters.maxPrice) return false;
        return true;
    });
}

function sortHotels(hotels, sortType) {
    var sorted = [...hotels];
    switch(sortType) {
        case 'price_asc':
            return sorted.sort(function(a, b) {
                var pa = a.price_per_night || a.price || a.totalPrice || 0;
                var pb = b.price_per_night || b.price || b.totalPrice || 0;
                return pa - pb;
            });
        case 'price_desc':
            return sorted.sort(function(a, b) {
                var pa = a.price_per_night || a.price || a.totalPrice || 0;
                var pb = b.price_per_night || b.price || b.totalPrice || 0;
                return pb - pa;
            });
        default:
            return sorted;
    }
}

// ============================================
// MISE À JOUR DE L'INTERFACE
// ============================================

function updateResultsDisplay() {
    var resultsContainer = document.getElementById('results-list');
    var countLabel = document.getElementById('results-count');
    var footerCount = document.getElementById('footer-results-count');
    var emptyState = document.getElementById('empty-state');
    
    var sorted = [];
    
    if (currentSearchType === 'flight') {
        var filtered = applyFilters(currentResults);
        sorted = sortOffers(filtered, document.getElementById('sort-select')?.value || 'price_asc');
        
        if (sorted.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (resultsContainer) resultsContainer.innerHTML = '';
            if (countLabel) countLabel.innerText = '0 RÉSULTATS';
            if (footerCount) footerCount.innerText = '0 RÉSULTATS';
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        resultsContainer.innerHTML = renderFlights(sorted);
        
    } else if (currentSearchType === 'hotel') {
        var filteredHotels = applyHotelFilters(currentResults);
        sorted = sortHotels(filteredHotels, document.getElementById('sort-select')?.value || 'price_asc');
        
        if (sorted.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (resultsContainer) resultsContainer.innerHTML = '';
            if (countLabel) countLabel.innerText = '0 RÉSULTATS';
            if (footerCount) footerCount.innerText = '0 RÉSULTATS';
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        resultsContainer.innerHTML = renderHotels(sorted);
    }
    
    if (countLabel) countLabel.innerText = sorted.length + ' RÉSULTATS';
    if (footerCount) footerCount.innerText = sorted.length + ' RÉSULTATS';
}

function updateRecommendation(offers) {
    var banner = document.getElementById('recommendation-banner');
    var text = document.getElementById('recommendation-text');
    if (!banner || !text || offers.length === 0) return;
    
    if (currentSearchType === 'flight') {
        var bestOffer = offers.reduce(function(prev, curr) {
            var p1 = prev.total_amount || prev.totalAmount || prev.price || 0;
            var p2 = curr.total_amount || curr.totalAmount || curr.price || 0;
            return p1 < p2 ? prev : curr;
        });
        
        var price = bestOffer.total_amount || bestOffer.totalAmount || bestOffer.price || 0;
        var airlineName = getAirlineName(bestOffer);
        text.innerHTML = '✈️ ' + airlineName + ' - Dès ' + formatPrice(price) + ' • Meilleur rapport qualité-prix';
        banner.classList.remove('hidden');
    } else if (currentSearchType === 'hotel' && offers.length > 0) {
        var bestHotel = offers.reduce(function(prev, curr) {
            var p1 = prev.price_per_night || prev.price || prev.totalPrice || 0;
            var p2 = curr.price_per_night || curr.price || curr.totalPrice || 0;
            return p1 < p2 ? prev : curr;
        });
        
        var price = bestHotel.price_per_night || bestHotel.price || bestHotel.totalPrice || 0;
        text.innerHTML = '🏨 ' + (bestHotel.name || 'Hôtel de luxe') + ' - Dès ' + formatPrice(price) + '/nuit • Meilleur rapport qualité-prix';
        banner.classList.remove('hidden');
    }
}

function initFilters() {
    var priceRange = document.getElementById('price-range');
    var priceDisplay = document.getElementById('price-display');
    var filterDirect = document.getElementById('filter-direct');
    var filterOneStop = document.getElementById('filter-one-stop');
    var resetBtn = document.getElementById('reset-filters');
    var sortSelect = document.getElementById('sort-select');
    
    if (priceRange) {
        priceRange.addEventListener('input', function(e) {
            currentFilters.maxPrice = parseInt(e.target.value);
            if (priceDisplay) priceDisplay.innerText = currentFilters.maxPrice + '$';
            updateResultsDisplay();
        });
    }
    
    // Filtres spécifiques aux vols (masqués pour les hôtels)
    if (currentSearchType === 'flight') {
        if (filterDirect) {
            filterDirect.addEventListener('change', function(e) {
                currentFilters.directOnly = e.target.checked;
                updateResultsDisplay();
            });
        }
        
        if (filterOneStop) {
            filterOneStop.addEventListener('change', function(e) {
                currentFilters.oneStopMax = e.target.checked;
                updateResultsDisplay();
            });
        }
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            updateResultsDisplay();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            currentFilters = {
                maxPrice: 1500,
                directOnly: false,
                oneStopMax: false,
                selectedAirlines: [],
                timeOfDay: { morning: false, afternoon: false, evening: false }
            };
            if (priceRange) priceRange.value = 1500;
            if (priceDisplay) priceDisplay.innerText = '1500$';
            if (filterDirect) filterDirect.checked = false;
            if (filterOneStop) filterOneStop.checked = false;
            
            var checkboxes = document.querySelectorAll('.airline-checkbox');
            for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = false;
            updateResultsDisplay();
        });
    }
}

function initAirlineFilters(offers) {
    var container = document.getElementById('airline-filters');
    if (!container) return;
    
    var airlinesMap = {};
    for (var i = 0; i < offers.length; i++) {
        var code = getAirlineIATA(offers[i]);
        var name = getAirlineName(offers[i]);
        if (code && !airlinesMap[code]) airlinesMap[code] = name;
    }
    
    var airlines = Object.keys(airlinesMap);
    if (airlines.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Aucune compagnie</div>';
        return;
    }
    
    container.innerHTML = '';
    for (var j = 0; j < airlines.length; j++) {
        var code = airlines[j];
        var name = airlinesMap[code];
        var div = document.createElement('div');
        div.className = 'flex items-center gap-3 cursor-pointer group';
        div.innerHTML = `
            <input type="checkbox" data-airline="${code}" class="airline-checkbox w-4 h-4 rounded">
            <span class="text-sm text-gray-600 group-hover:text-blue-600">${sanitize(name)} (${code})</span>
        `;
        container.appendChild(div);
    }
    
    var checkboxes = container.querySelectorAll('.airline-checkbox');
    for (var k = 0; k < checkboxes.length; k++) {
        checkboxes[k].addEventListener('change', function(e) {
            var code = this.getAttribute('data-airline');
            if (this.checked) {
                if (currentFilters.selectedAirlines.indexOf(code) === -1) {
                    currentFilters.selectedAirlines.push(code);
                }
            } else {
                var idx = currentFilters.selectedAirlines.indexOf(code);
                if (idx !== -1) currentFilters.selectedAirlines.splice(idx, 1);
            }
            updateResultsDisplay();
        });
    }
}

// ============================================
// RENDU DES CARTES
// ============================================

function renderFlights(offers) {
    if (!offers || offers.length === 0) return '';
    
    return offers.map(function(offer, index) {
        var airlineCode = getAirlineIATA(offer);
        var airlineName = getAirlineName(offer);
        var logoUrl = getAirlineLogo(airlineCode);
        var totalAmount = offer.total_amount || offer.totalAmount || offer.price || 0;
        var currency = offer.total_currency || offer.currency || 'USD';
        
        var firstSegment = offer.slices?.[0]?.segments?.[0];
        var times = formatFlightTimes(firstSegment);
        
        var originCode = firstSegment?.origin?.iata_code || '---';
        var destCode = firstSegment?.destination?.iata_code || '---';
        var originCity = firstSegment?.origin?.city_name || 'Départ';
        var destCity = firstSegment?.destination?.city_name || 'Arrivée';
        
        var stops = getStops(offer);
        var stopsText = stops === 0 ? 'Direct' : stops + ' escale' + (stops > 1 ? 's' : '');
        var stopsClass = stops === 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        
        return `
            <div class="result-card p-6" style="animation-delay: ${index * 0.03}s">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="flex items-center gap-5 flex-1">
                        <img src="${logoUrl}" alt="${airlineName}" class="w-16 h-12 object-contain" 
                             onerror="this.src='${DEFAULT_LOGO}'">
                        <div>
                            <h3 class="font-bold text-lg text-gray-800">${sanitize(airlineName)}</h3>
                            <div class="flex items-center gap-3 mt-1 flex-wrap">
                                <span class="text-sm font-mono text-gray-500">${originCode} → ${destCode}</span>
                                <span class="text-xs px-2 py-0.5 rounded-full ${stopsClass}">${stopsText}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4 md:gap-6">
                        <div class="text-center min-w-[60px]">
                            <p class="text-xl md:text-2xl font-bold">${times.departure}</p>
                            <p class="text-[10px] text-gray-500">${sanitize(originCity)}</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-plane text-gray-400 text-sm"></i>
                            ${times.duration ? `<p class="text-[10px] text-gray-400 mt-1">${times.duration}</p>` : '<p class="text-[10px] text-gray-400 mt-1">-</p>'}
                        </div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-xl md:text-2xl font-bold">${times.arrival}</p>
                            <p class="text-[10px] text-gray-500">${sanitize(destCity)}</p>
                        </div>
                    </div>
                    
                    <div class="text-right min-w-[130px]">
                        <p class="text-2xl font-bold text-blue-600">${formatPrice(totalAmount, currency)}</p>
                        <button onclick="bookFlight('${offer.id}')" class="btn-premium w-full mt-3 px-4 py-2 text-[10px]">
                            <i class="fas fa-ticket-alt mr-1"></i> Réserver
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// RENDU DES HÔTELS (NOUVEAU)
// ============================================

function renderHotels(hotels) {
    if (!hotels || hotels.length === 0) return '';
    
    return hotels.map(function(hotel, index) {
        var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 150;
        var photo = hotel.main_photo || hotel.images?.[0] || DEFAULT_HOTEL_IMAGE;
        var rating = hotel.rating || 4;
        var name = hotel.name || 'Hôtel de Luxe';
        var address = hotel.address || hotel.city || 'Localisation premium';
        
        // Générer les étoiles
        var fullStars = Math.floor(rating);
        var stars = '';
        for (var i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400 text-sm"></i>';
        for (var i = fullStars; i < 5; i++) stars += '<i class="far fa-star text-gray-300 text-sm"></i>';
        
        return `
            <div class="result-card overflow-hidden" style="animation-delay: ${index * 0.05}s">
                <div class="flex flex-col md:flex-row">
                    <img src="${photo}" class="w-full md:w-64 h-48 object-cover" 
                         onerror="this.src='${DEFAULT_HOTEL_IMAGE}'">
                    <div class="p-6 flex-1">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-xl text-gray-800">${sanitize(name)}</h3>
                                <p class="text-gray-500 text-sm mt-1">
                                    <i class="fas fa-map-marker-alt mr-1"></i> ${sanitize(address)}
                                </p>
                            </div>
                            <div class="flex items-center gap-1">
                                ${stars}
                            </div>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            ${hotel.amenities ? hotel.amenities.slice(0, 3).map(function(amenity) {
                                return `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${sanitize(amenity)}</span>`;
                            }).join('') : '<span class="text-xs text-gray-400">Wi-Fi inclus</span>'}
                        </div>
                        <div class="flex justify-between items-end mt-4">
                            <div>
                                <span class="text-2xl font-bold text-blue-600">${formatPrice(price)}</span>
                                <span class="text-gray-500">/nuit</span>
                                ${hotel.totalPrice ? `<p class="text-xs text-gray-400">Total: ${formatPrice(hotel.totalPrice)}</p>` : ''}
                            </div>
                            <button onclick="bookHotel('${hotel.id}')" class="btn-premium px-6 py-2 text-xs">
                                <i class="fas fa-bed mr-1"></i> Voir l'offre
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// INITIALISATION
// ============================================

async function init() {
    var searchType = sessionStorage.getItem('search_type') || 'flight';
    var rawData = sessionStorage.getItem('last_search_results');
    var data = rawData ? JSON.parse(rawData) : null;
    
    var resultsContainer = document.getElementById('results-list');
    var countLabel = document.getElementById('results-count');
    var loader = document.getElementById('loader-status');
    var summaryTitle = document.getElementById('summary-title');
    var summaryDetails = document.getElementById('summary-details');
    var emptyState = document.getElementById('empty-state');
    
    var titles = { flight: 'Vols Internationaux', hotel: 'Hôtels & Résidences', car: 'Location Premium' };
    if (summaryTitle) summaryTitle.innerText = titles[searchType] || 'Résultats';
    
    var dest = sessionStorage.getItem('flight_dest') || 'Destination';
    if (summaryDetails) {
        summaryDetails.innerText = dest + ' • ' + new Date().toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'});
    }
    
    currentSearchType = searchType;
    
    var results = [];
    if (searchType === 'flight' && data?.flights) {
        results = data.flights;
    } else if (searchType === 'hotel') {
        // Gérer les deux formats possibles
        results = data?.stays || data?.hotels || [];
    }
    
    currentResults = results;
    if (loader) loader.style.display = 'none';
    
    if (results.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (countLabel) countLabel.innerText = '0 RÉSULTATS';
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (countLabel) countLabel.innerText = results.length + ' RÉSULTATS';
    
    if (searchType === 'flight') {
        initAirlineFilters(results);
        initFilters();
        updateResultsDisplay();
        updateRecommendation(results);
    } else if (searchType === 'hotel') {
        // Pour les hôtels, on initialise les filtres sans les filtres de compagnies
        initFilters();
        updateResultsDisplay();
        updateRecommendation(results);
        
        // Cacher les filtres spécifiques aux vols
        var flightFilters = document.querySelectorAll('#filter-direct, #filter-one-stop, .airline-filters-section');
        flightFilters.forEach(function(el) {
            if (el) el.style.display = 'none';
        });
    }
}

// ============================================
// EXPOSITION GLOBALE
// ============================================

window.bookFlight = function(id) {
    alert('✨ Réservation du vol en cours de préparation.\n\nNotre équipe vous contactera sous 24h.');
};

window.bookHotel = function(id) {
    alert('✨ Réservation de l\'hôtel en cours de préparation.\n\nNotre équipe vous contactera sous 24h.');
};

document.addEventListener('DOMContentLoaded', init);
