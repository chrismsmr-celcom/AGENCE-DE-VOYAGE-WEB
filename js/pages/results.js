/**
 * TERRA VOYAGE - RESULTS PAGE
 * Affichage des résultats de recherche avec filtres et tri
 */

import { api } from '../core/api-client.js';
import { formatPrice, formatDate, formatFlightTimes } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// ============================================
// CONSTANTES ET CONFIGURATION
// ============================================

const AIRLINE_LOGOS = {
    // Europe
    'AF': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Air_France_Logo.svg/200px-Air_France_Logo.svg.png',
    'KL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/KLM_logo.svg/200px-KLM_logo.svg.png',
    'LH': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Lufthansa_Logo_2018.svg/200px-Lufthansa_Logo_2018.svg.png',
    'BA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/British_Airways_logo_%282016%29.svg/200px-British_Airways_logo_%282016%29.svg.png',
    'TK': 'https://cdn.worldvectorlogo.com/logos/turkish-airlines-logo.svg',
    'LX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Swiss_International_Air_Lines_logo.svg/200px-Swiss_International_Air_Lines_logo.svg.png',
    'OS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Austrian_Airlines_logo.svg/200px-Austrian_Airlines_logo.svg.png',
    'SN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Brussels_Airlines.svg/200px-Brussels_Airlines.svg.png',
    'IB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Iberia_logo.svg/200px-Iberia_logo.svg.png',
    'AY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Finnair_logo.svg/200px-Finnair_logo.svg.png',
    'SK': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/SAS_logo.svg/200px-SAS_logo.svg.png',
    'TP': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/TAP_Air_Portugal_Logo.svg/200px-TAP_Air_Portugal_Logo.svg.png',
    
    // Moyen-Orient
    'EK': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Emirates_logo.svg/200px-Emirates_logo.svg.png',
    'QR': 'https://cdn.worldvectorlogo.com/logos/qatar-airways-1.svg',
    'EY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Etihad_Airways_logo.svg/200px-Etihad_Airways_logo.svg.png',
    
    // Afrique
    'ET': 'https://cdn.worldvectorlogo.com/logos/logo-ethiopian-airlines.svg',
    'KQ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Kenya_Airways_logo.svg/200px-Kenya_Airways_logo.svg.png',
    'AT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Royal_Air_Maroc_logo.svg/200px-Royal_Air_Maroc_logo.svg.png',
    'MS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Egyptair_logo.svg/200px-Egyptair_logo.svg.png',
    'SA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/South_African_Airways_Logo.svg/200px-South_African_Airways_Logo.svg.png',
    
    // Amérique
    'DL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Delta_Air_Lines_Logo.svg/200px-Delta_Air_Lines_Logo.svg.png',
    'UA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/United_Airlines_logo_%282019%29.svg/200px-United_Airlines_logo_%282019%29.svg.png',
    'AA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/American_Airlines_logo_2013.svg/200px-American_Airlines_logo_2013.svg.png',
    'AC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Air_Canada_logo.svg/200px-Air_Canada_logo.svg.png',
    
    // Asie
    'SQ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Singapore_Airlines_Logo_2019.svg/200px-Singapore_Airlines_Logo_2019.svg.png',
    'CX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Cathay_Pacific_logo.svg/200px-Cathay_Pacific_logo.svg.png',
    'NH': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ANA_logo.svg/200px-ANA_logo.svg.png',
    'JL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Japan_Airlines_logo.svg/200px-Japan_Airlines_logo.svg.png',
    'KE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Korean_Air_logo.svg/200px-Korean_Air_logo.svg.png',
    'MU': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/China_Eastern_Airlines_logo.svg/200px-China_Eastern_Airlines_logo.svg.png',
    'CZ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/China_Southern_logo.svg/200px-China_Southern_logo.svg.png',
    'CA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Air_China_logo.svg/200px-Air_China_logo.svg.png'
};

// Variables globales
let currentResults = [];
let currentSearchType = 'flight';
let currentFilters = {
    maxPrice: 1500,
    directOnly: false,
    oneStopMax: false,
    selectedAirlines: [],
    timeOfDay: {
        morning: false,
        afternoon: false,
        evening: false
    }
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function getAirlineLogo(iataCode) {
    if (!iataCode) {
        // Logo par défaut en data URI (évite via.placeholder.com)
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40' viewBox='0 0 60 40'%3E%3Crect width='60' height='40' fill='%23f3f4f6'/%3E%3Ctext x='30' y='25' font-size='10' text-anchor='middle' fill='%239ca3af'%3E✈️%3C/text%3E%3C/svg%3E";
    }
    
    // Vérifier si le logo existe dans notre map
    if (AIRLINE_LOGOS[iataCode.toUpperCase()]) {
        return AIRLINE_LOGOS[iataCode.toUpperCase()];
    }
    
    // Fallback: générer un logo simple avec le code IATA
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40' viewBox='0 0 60 40'%3E%3Crect width='60' height='40' fill='%23f3f4f6'/%3E%3Ctext x='30' y='25' font-size='12' font-family='monospace' text-anchor='middle' fill='%233b82f6'%3E${iataCode.toUpperCase()}%3C/text%3E%3C/svg%3E`;
}

function getAirlineName(offer) {
    if (offer.owner?.name) return offer.owner.name;
    if (offer.slices?.[0]?.segments?.[0]?.operating_carrier?.name) {
        return offer.slices[0].segments[0].operating_carrier.name;
    }
    if (offer.slices?.[0]?.segments?.[0]?.marketing_carrier?.name) {
        return offer.slices[0].segments[0].marketing_carrier.name;
    }
    return 'Compagnie aérienne';
}

function getAirlineIATA(offer) {
    if (offer.owner?.iata_code) return offer.owner.iata_code;
    if (offer.slices?.[0]?.segments?.[0]?.operating_carrier?.iata_code) {
        return offer.slices[0].segments[0].operating_carrier.iata_code;
    }
    if (offer.slices?.[0]?.segments?.[0]?.marketing_carrier?.iata_code) {
        return offer.slices[0].segments[0].marketing_carrier.iata_code;
    }
    return null;
}

function getStops(offer) {
    return (offer.slices?.[0]?.segments?.length || 1) - 1;
}

function getFlightDuration(offer) {
    const firstSegment = offer.slices?.[0]?.segments?.[0];
    return firstSegment?.duration || null;
}

function getDepartureHour(offer) {
    const firstSegment = offer.slices?.[0]?.segments?.[0];
    if (!firstSegment?.departing_at) return null;
    const hour = new Date(firstSegment.departing_at).getHours();
    return hour;
}

function getTimeOfDayCategory(hour) {
    if (hour === null) return null;
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    return null;
}

// ============================================
// FILTRES
// ============================================

function applyFilters(offers) {
    return offers.filter(function(offer) {
        // Filtre budget
        var price = offer.total_amount || offer.totalAmount || offer.price || 0;
        if (price > currentFilters.maxPrice) return false;
        
        // Filtre escales
        var stops = getStops(offer);
        if (currentFilters.directOnly && stops > 0) return false;
        if (currentFilters.oneStopMax && stops > 1) return false;
        
        // Filtre compagnies
        var airlineCode = getAirlineIATA(offer);
        var airlineName = getAirlineName(offer);
        if (currentFilters.selectedAirlines.length > 0) {
            var matchesAirline = currentFilters.selectedAirlines.some(function(selected) {
                return selected === airlineCode || selected === airlineName;
            });
            if (!matchesAirline) return false;
        }
        
        // Filtre horaires
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
                var priceA = a.total_amount || a.totalAmount || a.price || 0;
                var priceB = b.total_amount || b.totalAmount || b.price || 0;
                return priceA - priceB;
            });
        case 'price_desc':
            return sorted.sort(function(a, b) {
                var priceA = a.total_amount || a.totalAmount || a.price || 0;
                var priceB = b.total_amount || b.totalAmount || b.price || 0;
                return priceB - priceA;
            });
        case 'duration_asc':
            return sorted.sort(function(a, b) {
                var durA = getFlightDuration(a) || 999999;
                var durB = getFlightDuration(b) || 999999;
                return durA - durB;
            });
        case 'duration_desc':
            return sorted.sort(function(a, b) {
                var durA = getFlightDuration(a) || 0;
                var durB = getFlightDuration(b) || 0;
                return durB - durA;
            });
        default:
            return sorted;
    }
}

// ============================================
// MISE À JOUR DE L'INTERFACE
// ============================================

function updateResultsDisplay() {
    var filtered = applyFilters(currentResults);
    var sorted = sortOffers(filtered, document.getElementById('sort-select')?.value || 'price_asc');
    
    var resultsContainer = document.getElementById('results-list');
    var countLabel = document.getElementById('results-count');
    var footerCount = document.getElementById('footer-results-count');
    var emptyState = document.getElementById('empty-state');
    var resultsList = document.getElementById('results-list');
    
    // Mise à jour des compteurs
    if (countLabel) countLabel.innerText = sorted.length + ' RÉSULTATS';
    if (footerCount) footerCount.innerText = sorted.length + ' RÉSULTATS';
    
    // Affichage ou masquage de l'état vide
    if (sorted.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (resultsList) resultsList.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (resultsList) resultsList.classList.remove('hidden');
    
    // Rendu des résultats
    if (currentSearchType === 'flight') {
        resultsContainer.innerHTML = renderFlights(sorted);
    } else if (currentSearchType === 'hotel') {
        resultsContainer.innerHTML = renderHotels(sorted);
    }
    
    // Mettre à jour la recommandation
    updateRecommendation(sorted);
}

function updateRecommendation(offers) {
    var banner = document.getElementById('recommendation-banner');
    var text = document.getElementById('recommendation-text');
    
    if (!banner || !text) return;
    
    // Trouver la meilleure offre (prix le plus bas)
    if (offers.length > 0) {
        var bestOffer = offers.reduce(function(prev, curr) {
            var pricePrev = prev.total_amount || prev.totalAmount || prev.price || 0;
            var priceCurr = curr.total_amount || curr.totalAmount || curr.price || 0;
            return pricePrev < priceCurr ? prev : curr;
        });
        
        var price = bestOffer.total_amount || bestOffer.totalAmount || bestOffer.price || 0;
        var airlineName = getAirlineName(bestOffer);
        
        text.innerHTML = '✈️ ' + airlineName + ' - Dès ' + formatPrice(price) + ' • Meilleur rapport qualité-prix';
        banner.classList.remove('hidden');
    }
}

function initFilters() {
    var priceRange = document.getElementById('price-range');
    var priceDisplay = document.getElementById('price-display');
    var filterDirect = document.getElementById('filter-direct');
    var filterOneStop = document.getElementById('filter-one-stop');
    var filterMorning = document.getElementById('filter-morning');
    var filterAfternoon = document.getElementById('filter-afternoon');
    var filterEvening = document.getElementById('filter-evening');
    var resetBtn = document.getElementById('reset-filters');
    var sortSelect = document.getElementById('sort-select');
    
    // Filtre budget
    if (priceRange) {
        priceRange.addEventListener('input', function(e) {
            var value = parseInt(e.target.value);
            currentFilters.maxPrice = value;
            if (priceDisplay) priceDisplay.innerText = value + '$';
            updateResultsDisplay();
        });
    }
    
    // Filtre direct
    if (filterDirect) {
        filterDirect.addEventListener('change', function(e) {
            currentFilters.directOnly = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    // Filtre 1 escale max
    if (filterOneStop) {
        filterOneStop.addEventListener('change', function(e) {
            currentFilters.oneStopMax = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    // Filtres horaires
    if (filterMorning) {
        filterMorning.addEventListener('change', function(e) {
            currentFilters.timeOfDay.morning = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    if (filterAfternoon) {
        filterAfternoon.addEventListener('change', function(e) {
            currentFilters.timeOfDay.afternoon = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    if (filterEvening) {
        filterEvening.addEventListener('change', function(e) {
            currentFilters.timeOfDay.evening = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    // Tri
    if (sortSelect) {
        sortSelect.addEventListener('change', function(e) {
            updateResultsDisplay();
        });
    }
    
    // Réinitialisation
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            currentFilters = {
                maxPrice: 1500,
                directOnly: false,
                oneStopMax: false,
                selectedAirlines: [],
                timeOfDay: {
                    morning: false,
                    afternoon: false,
                    evening: false
                }
            };
            
            if (priceRange) priceRange.value = 1500;
            if (priceDisplay) priceDisplay.innerText = '1500$';
            if (filterDirect) filterDirect.checked = false;
            if (filterOneStop) filterOneStop.checked = false;
            if (filterMorning) filterMorning.checked = false;
            if (filterAfternoon) filterAfternoon.checked = false;
            if (filterEvening) filterEvening.checked = false;
            
            // Réinitialiser les checkboxes compagnies
            var airlineCheckboxes = document.querySelectorAll('.airline-checkbox');
            for (var i = 0; i < airlineCheckboxes.length; i++) {
                airlineCheckboxes[i].checked = false;
            }
            
            updateResultsDisplay();
        });
    }
}

function initAirlineFilters(offers) {
    var container = document.getElementById('airline-filters');
    if (!container) return;
    
    // Extraire les compagnies uniques
    var airlinesMap = {};
    for (var i = 0; i < offers.length; i++) {
        var code = getAirlineIATA(offers[i]);
        var name = getAirlineName(offers[i]);
        if (code && !airlinesMap[code]) {
            airlinesMap[code] = name;
        }
    }
    
    var airlines = Object.keys(airlinesMap);
    
    if (airlines.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Aucune compagnie disponible</div>';
        return;
    }
    
    container.innerHTML = '';
    for (var j = 0; j < airlines.length; j++) {
        var code = airlines[j];
        var name = airlinesMap[code];
        var div = document.createElement('div');
        div.className = 'flex items-center gap-3 cursor-pointer group';
        div.innerHTML = `
            <input type="checkbox" data-airline="${code}" data-airline-name="${name}" class="airline-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
            <span class="text-sm text-gray-600 group-hover:text-blue-600 transition">${sanitize(name)} (${code})</span>
        `;
        container.appendChild(div);
    }
    
    // Ajouter les écouteurs d'événements
    var checkboxes = container.querySelectorAll('.airline-checkbox');
    for (var k = 0; k < checkboxes.length; k++) {
        checkboxes[k].addEventListener('change', function(e) {
            var code = this.getAttribute('data-airline');
            var name = this.getAttribute('data-airline-name');
            
            if (this.checked) {
                if (currentFilters.selectedAirlines.indexOf(code) === -1) {
                    currentFilters.selectedAirlines.push(code);
                }
            } else {
                var index = currentFilters.selectedAirlines.indexOf(code);
                if (index !== -1) {
                    currentFilters.selectedAirlines.splice(index, 1);
                }
            }
            updateResultsDisplay();
        });
    }
}

// ============================================
// RENDU DES CARTES
// ============================================

function renderFlights(offers) {
    if (!offers || offers.length === 0) {
        return '';
    }
    
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
            <div class="result-card p-6 animate-slide-up" style="animation-delay: ${index * 0.03}s">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="flex items-center gap-5 flex-1">
                        <img src="${logoUrl}" alt="${airlineName}" 
                             class="w-16 h-12 object-contain"
                             onerror="this.src='https://via.placeholder.com/60x40?text=${airlineCode || 'AIR'}'">
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
                            ${times.duration ? '<p class="text-[10px] text-gray-400 mt-1">' + times.duration + '</p>' : ''}
                        </div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-xl md:text-2xl font-bold">${times.arrival}</p>
                            <p class="text-[10px] text-gray-500">${sanitize(destCity)}</p>
                        </div>
                    </div>
                    
                    <div class="text-right min-w-[130px]">
                        <p class="text-2xl font-bold text-blue-600">${formatPrice(totalAmount, currency)}</p>
                        <button onclick="bookFlight('${offer.id}')" 
                                class="btn-premium w-full mt-3 px-4 py-2 text-[10px]">
                            <i class="fas fa-ticket-alt mr-1"></i> Réserver
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderHotels(hotels) {
    if (!hotels || hotels.length === 0) {
        return '';
    }
    
    return hotels.map(function(hotel, index) {
        var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 150;
        var photo = hotel.main_photo || hotel.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400';
        var rating = hotel.rating || 4;
        
        return `
            <div class="result-card overflow-hidden animate-slide-up" style="animation-delay: ${index * 0.05}s">
                <div class="flex flex-col md:flex-row">
                    <img src="${photo}" class="w-full md:w-64 h-48 object-cover" 
                         onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'">
                    <div class="p-6 flex-1">
                        <h3 class="font-bold text-xl text-gray-800">${sanitize(hotel.name)}</h3>
                        <p class="text-gray-500 text-sm mt-1">
                            <i class="fas fa-map-marker-alt mr-1"></i> ${sanitize(hotel.address || 'Localisation premium')}
                        </p>
                        <div class="flex items-center gap-1 mt-2">
                            ${renderStars(rating)}
                        </div>
                        <div class="flex justify-between items-end mt-4">
                            <div>
                                <span class="text-2xl font-bold text-blue-600">${formatPrice(price)}</span>
                                <span class="text-gray-500">/nuit</span>
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

function renderStars(rating) {
    var fullStars = Math.floor(rating);
    var stars = '';
    for (var i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400 text-sm"></i>';
    for (var i = fullStars; i < 5; i++) stars += '<i class="far fa-star text-gray-300 text-sm"></i>';
    return stars;
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
    
    var titles = {
        flight: 'Vols Internationaux',
        hotel: 'Hôtels & Résidences',
        car: 'Location Premium'
    };
    
    if (summaryTitle) summaryTitle.innerText = titles[searchType] || 'Résultats';
    
    var dest = sessionStorage.getItem('flight_dest') || 'Destination';
    if (summaryDetails) {
        summaryDetails.innerText = dest + ' • ' + new Date().toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'});
    }
    
    currentSearchType = searchType;
    
    var results = [];
    if (searchType === 'flight' && data?.flights) {
        results = data.flights;
    } else if (searchType === 'hotel' && data?.hotels) {
        results = data.hotels;
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
    
    // Initialiser les filtres
    if (searchType === 'flight') {
        initAirlineFilters(results);
        initFilters();
        updateResultsDisplay();
    } else if (searchType === 'hotel') {
        resultsContainer.innerHTML = renderHotels(results);
    }
}

// ============================================
// EXPOSITION GLOBALE
// ============================================

window.bookFlight = function(id) {
    alert('✨ Réservation du vol ' + id + ' en cours de préparation.\n\nNotre équipe vous contactera sous 24h.');
};

window.bookHotel = function(id) {
    alert('✨ Réservation de l\'hôtel ' + id + ' en cours de préparation.\n\nNotre équipe vous contactera sous 24h.');
};

document.addEventListener('DOMContentLoaded', init);