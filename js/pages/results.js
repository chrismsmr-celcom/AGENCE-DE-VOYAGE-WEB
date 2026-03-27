/**
 * TERRA VOYAGE - RESULTS PAGE
 * Affichage des résultats de recherche avec filtres et tri
 * Version corrigée pour vols et hôtels avec conversion de devises
 */

import { api } from '../core/api-client.js';
import { formatPrice, formatDate, formatFlightTimes } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

// ============================================
// CONSTANTES ET CONFIGURATION
// ============================================

// URL de l'API backend sur Render
const API_BASE_URL = 'https://agence-de-voyage-web.onrender.com/api';

// Logo par défaut en data URI
const DEFAULT_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40' viewBox='0 0 60 40'%3E%3Crect width='60' height='40' fill='%233b82f6'/%3E%3Ctext x='30' y='25' font-size='12' font-family='monospace' text-anchor='middle' fill='white'%3E✈️%3C/text%3E%3C/svg%3E";

// Image par défaut pour les hôtels
const DEFAULT_HOTEL_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f3f4f6'/%3E%3Ctext x='150' y='100' text-anchor='middle' dy='.3em' fill='%239ca3af'%3E🏨%3C/text%3E%3C/svg%3E";

// Gestionnaire de devises
const CurrencyManager = {
    currentCurrency: 'USD',
    currentSymbol: '$',
    rates: {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        CAD: 1.38,
        XAF: 655.96,
        CDF: 2850,
        BTC: 0.000015
    },
    
    symbols: {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: 'CA$',
        XAF: 'FCFA',
        CDF: 'FC',
        BTC: '₿'
    },
    
    init() {
        const saved = localStorage.getItem('preferred_currency');
        if (saved && this.rates[saved]) {
            this.currentCurrency = saved;
            this.currentSymbol = this.symbols[saved];
            this.updateDisplay();
        }
        this.initSelector();
    },
    
    initSelector() {
        const btn = document.getElementById('currencyBtn');
        const dropdown = document.getElementById('currencyDropdown');
        
        if (btn && dropdown) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });
            
            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
            
            document.querySelectorAll('.currency-option').forEach(option => {
                option.addEventListener('click', () => {
                    const currency = option.dataset.currency;
                    const rate = parseFloat(option.dataset.rate);
                    const symbol = option.querySelector('.text-sm.font-bold')?.innerText || option.dataset.symbol;
                    
                    this.setCurrency(currency, rate, symbol);
                    dropdown.classList.add('hidden');
                });
            });
        }
    },
    
    setCurrency(currency, rate, symbol) {
        this.currentCurrency = currency;
        this.currentSymbol = symbol;
        this.rates[currency] = rate;
        
        localStorage.setItem('preferred_currency', currency);
        
        this.updateDisplay();
        this.convertAllPrices();
        
        window.dispatchEvent(new CustomEvent('currencyChanged', { 
            detail: { currency, rate, symbol } 
        }));
    },
    
    updateDisplay() {
        const currencySpan = document.getElementById('currentCurrency');
        if (currencySpan) currencySpan.innerText = this.currentCurrency;
        
        const btn = document.getElementById('currencyBtn');
        if (btn) {
            const icon = btn.querySelector('.fa-dollar-sign, .fa-euro-sign, .fa-pound-sign, .fa-africa, .fa-bitcoin');
            if (icon) {
                if (this.currentCurrency === 'USD') icon.className = 'fas fa-dollar-sign text-xs';
                else if (this.currentCurrency === 'EUR') icon.className = 'fas fa-euro-sign text-xs';
                else if (this.currentCurrency === 'GBP') icon.className = 'fas fa-pound-sign text-xs';
                else if (this.currentCurrency === 'XAF' || this.currentCurrency === 'CDF') icon.className = 'fas fa-africa text-xs';
                else if (this.currentCurrency === 'BTC') icon.className = 'fab fa-bitcoin text-xs';
                else icon.className = 'fas fa-dollar-sign text-xs';
            }
        }
    },
    
    convertPrice(priceEUR) {
        if (!priceEUR) return 0;
        const rate = this.rates[this.currentCurrency];
        if (this.currentCurrency === 'BTC') return priceEUR * rate;
        return priceEUR * rate;
    },
    
    formatPrice(priceEUR) {
        const converted = this.convertPrice(priceEUR);
        const symbol = this.currentSymbol;
        
        if (this.currentCurrency === 'BTC') return `${symbol}${converted.toFixed(8)}`;
        if (this.currentCurrency === 'XAF' || this.currentCurrency === 'CDF') return `${Math.round(converted).toLocaleString()} ${symbol}`;
        return `${symbol}${converted.toFixed(2)}`;
    },
    
    convertAllPrices() {
        document.querySelectorAll('.price-amount').forEach(el => {
            const priceEUR = parseFloat(el.dataset.eur);
            if (priceEUR) el.innerText = this.formatPrice(priceEUR);
        });
    },
    
    updateAllPrices() {
        document.querySelectorAll('[data-price-eur]').forEach(el => {
            const priceEUR = parseFloat(el.dataset.priceEur);
            if (priceEUR) el.innerText = this.formatPrice(priceEUR);
        });
    }
};

// Variables globales
let currentResults = [];
let currentSearchType = 'flight';
let currentFilters = {
    maxPrice: 5000,
    directOnly: false,
    oneStopMax: false,
    selectedAirlines: [],
    timeOfDay: { morning: false, afternoon: false, evening: false }
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function getAirlineLogo(iataCode) {
    var code = (iataCode || 'AIR').toUpperCase();
    return API_BASE_URL + '/airline-logo/' + code;
}

function getAirlineName(offer) {
    if (offer.owner && offer.owner.name) return offer.owner.name;
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0] && offer.slices[0].segments[0].operating_carrier && offer.slices[0].segments[0].operating_carrier.name) {
        return offer.slices[0].segments[0].operating_carrier.name;
    }
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0] && offer.slices[0].segments[0].marketing_carrier && offer.slices[0].segments[0].marketing_carrier.name) {
        return offer.slices[0].segments[0].marketing_carrier.name;
    }
    return 'Compagnie aérienne';
}

function getAirlineIATA(offer) {
    if (offer.owner && offer.owner.iata_code) return offer.owner.iata_code;
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0] && offer.slices[0].segments[0].operating_carrier && offer.slices[0].segments[0].operating_carrier.iata_code) {
        return offer.slices[0].segments[0].operating_carrier.iata_code;
    }
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0] && offer.slices[0].segments[0].marketing_carrier && offer.slices[0].segments[0].marketing_carrier.iata_code) {
        return offer.slices[0].segments[0].marketing_carrier.iata_code;
    }
    return null;
}

function getStops(offer) {
    var segments = (offer.slices && offer.slices[0] && offer.slices[0].segments) ? offer.slices[0].segments : [];
    return (segments.length || 1) - 1;
}

function getFlightDuration(offer) {
    var firstSegment = null;
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0]) {
        firstSegment = offer.slices[0].segments[0];
    }
    if (!firstSegment) return null;
    var duration = firstSegment.duration;
    if (duration && typeof duration === 'number' && !isNaN(duration) && duration > 0) {
        return duration;
    }
    if (firstSegment.duration_pt) {
        var match = firstSegment.duration_pt.match(/PT(\d+)H(\d+)M/);
        if (match) {
            return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
    }
    return null;
}

function getDepartureHour(offer) {
    var firstSegment = null;
    if (offer.slices && offer.slices[0] && offer.slices[0].segments && offer.slices[0].segments[0]) {
        firstSegment = offer.slices[0].segments[0];
    }
    if (!firstSegment || !firstSegment.departing_at) return null;
    return new Date(firstSegment.departing_at).getHours();
}

function getTimeOfDayCategory(hour) {
    if (hour === null) return null;
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
}

// ============================================
// FILTRES
// ============================================

function applyFilters(offers) {
    if (!offers || offers.length === 0) return [];
    return offers.filter(function(offer) {
        var price = offer.total_amount || offer.intended_total_amount || offer.totalAmount || offer.price || 0;
        if (price > currentFilters.maxPrice) return false;
        
        var stops = getStops(offer);
        if (currentFilters.directOnly && stops > 0) return false;
        if (currentFilters.oneStopMax && stops > 1) return false;
        
        var airlineCode = getAirlineIATA(offer);
        var airlineName = getAirlineName(offer);
        if (currentFilters.selectedAirlines.length > 0) {
            var matches = false;
            for (var i = 0; i < currentFilters.selectedAirlines.length; i++) {
                var selected = currentFilters.selectedAirlines[i];
                if (selected === airlineCode || selected === airlineName) {
                    matches = true;
                    break;
                }
            }
            if (!matches) return false;
        }
        
        var hour = getDepartureHour(offer);
        var timeCategory = getTimeOfDayCategory(hour);
        var hasTimeFilter = currentFilters.timeOfDay.morning || currentFilters.timeOfDay.afternoon || currentFilters.timeOfDay.evening;
        
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
    if (!offers || offers.length === 0) return [];
    var sorted = offers.slice();
    switch(sortType) {
        case 'price_asc':
            sorted.sort(function(a, b) {
                var pa = a.total_amount || a.intended_total_amount || a.price || 0;
                var pb = b.total_amount || b.intended_total_amount || b.price || 0;
                return pa - pb;
            });
            break;
        case 'price_desc':
            sorted.sort(function(a, b) {
                var pa = a.total_amount || a.intended_total_amount || a.price || 0;
                var pb = b.total_amount || b.intended_total_amount || b.price || 0;
                return pb - pa;
            });
            break;
        default:
            break;
    }
    return sorted;
}

function applyHotelFilters(hotels) {
    if (!hotels || hotels.length === 0) return [];
    return hotels.filter(function(hotel) {
        var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 0;
        if (price > currentFilters.maxPrice) return false;
        return true;
    });
}

function sortHotels(hotels, sortType) {
    if (!hotels || hotels.length === 0) return [];
    var sorted = hotels.slice();
    switch(sortType) {
        case 'price_asc':
            sorted.sort(function(a, b) {
                var pa = a.price_per_night || a.price || a.totalPrice || 0;
                var pb = b.price_per_night || b.price || b.totalPrice || 0;
                return pa - pb;
            });
            break;
        case 'price_desc':
            sorted.sort(function(a, b) {
                var pa = a.price_per_night || a.price || a.totalPrice || 0;
                var pb = b.price_per_night || b.price || b.totalPrice || 0;
                return pb - pa;
            });
            break;
        default:
            break;
    }
    return sorted;
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
        var sortSelect = document.getElementById('sort-select');
        var sortValue = sortSelect ? sortSelect.value : 'price_asc';
        sorted = sortOffers(filtered, sortValue);
        
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
        var sortSelect = document.getElementById('sort-select');
        var sortValue = sortSelect ? sortSelect.value : 'price_asc';
        sorted = sortHotels(filteredHotels, sortValue);
        
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
    if (!banner || !text || !offers || offers.length === 0) return;
    
    if (currentSearchType === 'flight') {
        var bestOffer = offers[0];
        for (var i = 1; i < offers.length; i++) {
            var p1 = bestOffer.total_amount || bestOffer.intended_total_amount || bestOffer.price || 0;
            var p2 = offers[i].total_amount || offers[i].intended_total_amount || offers[i].price || 0;
            if (p2 < p1) bestOffer = offers[i];
        }
        
        var price = bestOffer.total_amount || bestOffer.intended_total_amount || bestOffer.price || 0;
        var airlineName = getAirlineName(bestOffer);
        var formattedPrice = CurrencyManager.formatPrice(price);
        text.innerHTML = '✈️ ' + airlineName + ' - Dès ' + formattedPrice + ' • Meilleur rapport qualité-prix';
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
    
    if (filterDirect && currentSearchType === 'flight') {
        filterDirect.addEventListener('change', function(e) {
            currentFilters.directOnly = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    if (filterOneStop && currentSearchType === 'flight') {
        filterOneStop.addEventListener('change', function(e) {
            currentFilters.oneStopMax = e.target.checked;
            updateResultsDisplay();
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            updateResultsDisplay();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            currentFilters = {
                maxPrice: 5000,
                directOnly: false,
                oneStopMax: false,
                selectedAirlines: [],
                timeOfDay: { morning: false, afternoon: false, evening: false }
            };
            if (priceRange) priceRange.value = 5000;
            if (priceDisplay) priceDisplay.innerText = '5000$';
            if (filterDirect) filterDirect.checked = false;
            if (filterOneStop) filterOneStop.checked = false;
            
            var checkboxes = document.querySelectorAll('.airline-checkbox');
            for (var i = 0; i < checkboxes.length; i++) {
                if (checkboxes[i]) checkboxes[i].checked = false;
            }
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

function formatFlightTime(timeStr) {
    if (!timeStr) return '--:--';
    var date = new Date(timeStr);
    return date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function formatDurationPT(durationStr) {
    if (!durationStr) return null;
    var match = durationStr.match(/PT(\d+)H(\d+)M/);
    if (match) {
        var hours = parseInt(match[1]);
        var minutes = parseInt(match[2]);
        return hours + 'h' + (minutes > 0 ? minutes : '');
    }
    return null;
}

function viewFlightDetails(offerId) {
    var offer = null;
    for (var i = 0; i < currentResults.length; i++) {
        if (currentResults[i].id === offerId) {
            offer = currentResults[i];
            break;
        }
    }
    if (offer) {
        sessionStorage.setItem('selected_offer', JSON.stringify(offer));
        sessionStorage.setItem('selected_offer_type', 'flight');
        window.location.href = './details.html';
    } else {
        console.error('Offre non trouvée:', offerId);
    }
}

function viewHotelDetails(hotelId) {
    var hotel = null;
    for (var i = 0; i < currentResults.length; i++) {
        if (currentResults[i].id === hotelId) {
            hotel = currentResults[i];
            break;
        }
    }
    if (hotel) {
        sessionStorage.setItem('selected_offer', JSON.stringify(hotel));
        sessionStorage.setItem('selected_offer_type', 'hotel');
        window.location.href = './details.html';
    } else {
        console.error('Hôtel non trouvé:', hotelId);
    }
}

function renderFlights(offers) {
    if (!offers || offers.length === 0) return '<div class="text-center py-10 text-gray-500">Aucun vol trouvé</div>';
    
    var html = '';
    for (var idx = 0; idx < offers.length; idx++) {
        var offer = offers[idx];
        var airlineCode = getAirlineIATA(offer);
        var airlineName = getAirlineName(offer);
        var logoUrl = getAirlineLogo(airlineCode);
        var totalAmount = offer.total_amount || offer.intended_total_amount || offer.price || 0;
        var currency = offer.total_currency || offer.currency || 'EUR';
        
        var firstSlice = (offer.slices && offer.slices[0]) ? offer.slices[0] : null;
        var firstSegment = (firstSlice && firstSlice.segments && firstSlice.segments[0]) ? firstSlice.segments[0] : null;
        
        var originCode = (firstSegment && firstSegment.origin && firstSegment.origin.iata_code) ? firstSegment.origin.iata_code : '---';
        var destCode = (firstSegment && firstSegment.destination && firstSegment.destination.iata_code) ? firstSegment.destination.iata_code : '---';
        var originCity = (firstSegment && firstSegment.origin && firstSegment.origin.city_name) ? firstSegment.origin.city_name : 'Départ';
        var destCity = (firstSegment && firstSegment.destination && firstSegment.destination.city_name) ? firstSegment.destination.city_name : 'Arrivée';
        var departureTime = formatFlightTime(firstSegment ? firstSegment.departing_at : null);
        var arrivalTime = formatFlightTime(firstSegment ? firstSegment.arriving_at : null);
        
        var duration = null;
        if (firstSegment && firstSegment.duration) {
            var mins = firstSegment.duration;
            var hours = Math.floor(mins / 60);
            var minutes = mins % 60;
            duration = hours + 'h' + (minutes > 0 ? minutes : '');
        } else if (firstSlice && firstSlice.duration) {
            duration = formatDurationPT(firstSlice.duration);
        }
        
        var segmentsCount = (firstSlice && firstSlice.segments) ? firstSlice.segments.length : 1;
        var stops = segmentsCount - 1;
        var stopsText = stops === 0 ? 'Direct' : stops + ' escale' + (stops > 1 ? 's' : '');
        var stopsClass = stops === 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        
        html += `
            <div class="result-card p-6" style="animation-delay: ${idx * 0.03}s">
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
                            <p class="text-xl md:text-2xl font-bold">${departureTime}</p>
                            <p class="text-[10px] text-gray-500">${sanitize(originCity)}</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-plane text-gray-400 text-sm"></i>
                            ${duration ? `<p class="text-[10px] text-gray-400 mt-1">${duration}</p>` : '<p class="text-[10px] text-gray-400 mt-1">-</p>'}
                        </div>
                        <div class="text-center min-w-[60px]">
                            <p class="text-xl md:text-2xl font-bold">${arrivalTime}</p>
                            <p class="text-[10px] text-gray-500">${sanitize(destCity)}</p>
                        </div>
                    </div>
                    
                    <div class="text-right min-w-[130px]">
                        <p class="text-2xl font-bold text-blue-600 price-amount" data-eur="${totalAmount}">
                            ${CurrencyManager.formatPrice(totalAmount)}
                        </p>
                        <button onclick="viewFlightDetails('${offer.id}')" class="btn-premium w-full mt-3 px-4 py-2 text-[10px]">
                            <i class="fas fa-info-circle mr-1"></i> Voir détails
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

function renderHotels(hotels) {
    if (!hotels || hotels.length === 0) return '<div class="text-center py-10 text-gray-500">Aucun hôtel trouvé</div>';
    
    var html = '';
    for (var idx = 0; idx < hotels.length; idx++) {
        var hotel = hotels[idx];
        var price = hotel.price_per_night || hotel.price || hotel.totalPrice || 150;
        var photo = hotel.main_photo || (hotel.images && hotel.images[0]) || DEFAULT_HOTEL_IMAGE;
        var rating = hotel.rating || 4;
        var name = hotel.name || 'Hôtel de Luxe';
        var address = hotel.address || hotel.city || 'Localisation premium';
        
        var fullStars = Math.floor(rating);
        var stars = '';
        for (var i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400 text-sm"></i>';
        for (var i = fullStars; i < 5; i++) stars += '<i class="far fa-star text-gray-300 text-sm"></i>';
        
        html += `
            <div class="result-card overflow-hidden" style="animation-delay: ${idx * 0.05}s">
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
                            <div class="flex items-center gap-1">${stars}</div>
                        </div>
                        <div class="flex justify-between items-end mt-4">
                            <div>
                                <span class="text-2xl font-bold text-blue-600 price-amount" data-eur="${price}">
                                    ${CurrencyManager.formatPrice(price)}
                                </span>
                                <span class="text-gray-500">/nuit</span>
                            </div>
                            <button onclick="viewHotelDetails('${hotel.id}')" class="btn-premium px-6 py-2 text-xs">
                                <i class="fas fa-info-circle mr-1"></i> Voir l'offre
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

// ============================================
// INITIALISATION
// ============================================

async function init() {
    // Initialiser le gestionnaire de devises
    CurrencyManager.init();
    
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
    
    console.log('🔍 Données reçues:', data);
    console.log('🔍 Type de recherche:', searchType);
    
    if (searchType === 'flight') {
        if (data && data.flights && Array.isArray(data.flights)) {
            results = data.flights;
        } else if (data && data.data && data.data.flights && Array.isArray(data.data.flights)) {
            results = data.data.flights;
        }
        console.log('✈️ Vols trouvés:', results.length);
    } else if (searchType === 'hotel') {
        if (data && data.stays && Array.isArray(data.stays)) {
            results = data.stays;
        } else if (data && data.hotels && Array.isArray(data.hotels)) {
            results = data.hotels;
        }
        console.log('🏨 Hôtels trouvés:', results.length);
    }
    
    currentResults = results;
    if (loader) loader.style.display = 'none';
    
    if (results.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (countLabel) countLabel.innerText = '0 RÉSULTATS';
        console.warn('⚠️ Aucun résultat trouvé');
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
        initFilters();
        updateResultsDisplay();
        updateRecommendation(results);
        
        var flightFilters = document.querySelectorAll('#filter-direct, #filter-one-stop');
        for (var i = 0; i < flightFilters.length; i++) {
            if (flightFilters[i] && flightFilters[i].parentElement) {
                flightFilters[i].parentElement.style.display = 'none';
            }
        }
    }
}

// Écouter les changements de devise
window.addEventListener('currencyChanged', function() {
    CurrencyManager.updateAllPrices();
});

// ============================================
// EXPOSITION GLOBALE
// ============================================

window.viewFlightDetails = viewFlightDetails;
window.viewHotelDetails = viewHotelDetails;
window.CurrencyManager = CurrencyManager;

document.addEventListener('DOMContentLoaded', init);
