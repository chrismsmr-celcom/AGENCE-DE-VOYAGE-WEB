/**
 * TERRA VOYAGE - ENGINE PRINCIPAL
 * Point d'entrée unique de l'application - Version Premium
 */

import { state } from './state-manager.js';
import { api } from './api-client.js';
import { SearchBar } from '../components/search-bar.js';
import { PassengerModal } from '../components/passenger-modal.js';
import { PackageModal } from '../components/package-modal.js';
import { MobileMenu } from '../components/mobile-menu.js';
import { HeroSlider } from '../components/hero-slider.js';
import { PartnerSwiper } from '../components/partner-swiper.js';
import { formatDate, formatPrice, formatDuration } from '../utils/formatters.js';
import { sanitize, debounce } from '../utils/validators.js';

class TerraEngine {
    constructor() {
        this.components = {};
        this.isInitialized = false;
        this.pendingRequests = new Map();
    }
    
    /**
     * Initialisation du moteur
     */
    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Terra Engine initialisation...');
        
        // Initialiser le state
        state.init();
        
        // Vérifier la connexion API
        try {
            const isApiHealthy = await api.healthCheck();
            console.log('📡 API Status: ' + (isApiHealthy ? '✅ Connected' : '❌ Disconnected'));
        } catch (error) {
            console.warn('⚠️ API Health check failed:', error.message);
        }
        
        // Initialiser tous les composants
        this.initComponents();
        
        // Configurer les événements
        this.setupEventListeners();
        
        // Configurer le header scroll
        this.setupScrollHeader();
        
        this.isInitialized = true;
        console.log('✨ Terra Engine prêt !');
    }
    
    /**
     * Initialisation de tous les composants
     */
    initComponents() {
        // Barre de recherche
        const searchContainer = document.querySelector('.search-bar-container');
        if (searchContainer) {
            this.components.searchBar = new SearchBar(searchContainer);
        }
        
        // Modal passagers
        const passengerTrigger = document.querySelector('[onclick*="togglePassengers"]');
        const passengerModal = document.getElementById('passenger-modal');
        if (passengerTrigger && passengerModal) {
            this.components.passengerModal = new PassengerModal(passengerTrigger, passengerModal);
        }
        
        // Modal packages
        this.components.packageModal = new PackageModal();
        
        // Menu mobile
        this.components.mobileMenu = new MobileMenu();
        
        // Slider hero
        this.components.heroSlider = new HeroSlider();
        
        // Swiper partenaires
        this.components.partnerSwiper = new PartnerSwiper();
        
        // Initialisation du date picker
        this.setupDatePicker();
        
        console.log('✅ Composants initialisés:', Object.keys(this.components));
    }
    
    /**
     * Initialise le sélecteur de dates avec Flatpickr
     */
    setupDatePicker() {
        var datePickerInput = document.getElementById('date-picker-input');
        if (!datePickerInput) {
            console.warn('⚠️ Élément date-picker-input non trouvé');
            return;
        }
        
        if (typeof flatpickr === 'undefined') {
            console.error('❌ Flatpickr non chargé');
            return;
        }
        
        var self = this;
        
        // Créer l'instance flatpickr
        window.flatpickrInstance = flatpickr(datePickerInput, {
            locale: 'fr',
            dateFormat: 'Y-m-d',
            altFormat: 'd/m/Y',
            altInput: true,
            minDate: 'today',
            mode: 'range',
            position: 'auto',
            clickOpens: false,
            
            onReady: function() {
                console.log('✅ Date picker prêt');
                
                // Connecter les zones cliquables
                var departureTrigger = document.getElementById('departure-trigger');
                var returnTrigger = document.getElementById('return-trigger');
                
                if (departureTrigger) {
                    departureTrigger.addEventListener('click', function() {
                        self.openDatePicker('departure');
                    });
                }
                
                if (returnTrigger) {
                    returnTrigger.addEventListener('click', function() {
                        self.openDatePicker('return');
                    });
                }
            },
            
            onChange: function(selectedDates) {
                console.log('Dates sélectionnées:', selectedDates);
                
                if (!selectedDates || selectedDates.length === 0) return;
                
                // Date de départ
                var departureDate = selectedDates[0];
                var departureFormatted = departureDate.toISOString().split('T')[0];
                
                // Mettre à jour le state
                state.set('departureDate', departureFormatted);
                
                // Mettre à jour l'affichage
                var checkinDisplay = document.getElementById('display-checkin');
                if (checkinDisplay) {
                    checkinDisplay.innerText = departureDate.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short'
                    });
                }
                
                // Date de retour (si sélectionnée)
                if (selectedDates.length === 2) {
                    var returnDate = selectedDates[1];
                    var returnFormatted = returnDate.toISOString().split('T')[0];
                    
                    state.set('returnDate', returnFormatted);
                    
                    var checkoutDisplay = document.getElementById('display-checkout');
                    if (checkoutDisplay) {
                        checkoutDisplay.innerText = returnDate.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short'
                        });
                    }
                } else {
                    state.set('returnDate', '');
                    var checkoutDisplay = document.getElementById('display-checkout');
                    if (checkoutDisplay) {
                        checkoutDisplay.innerText = 'Flexible';
                    }
                }
            },
            
            onClose: function() {
                console.log('📅 Date picker fermé');
            }
        });
        
        console.log('✅ Date picker initialisé avec succès');
    }
    
    /**
     * Configuration des écouteurs d'événements
     */
    setupEventListeners() {
        var self = this;
        
        // Écouter les changements de mode
        state.subscribe('currentMode', function(mode) {
            self.onModeChange(mode);
        });
        
        // Écouter les changements de passagers
        state.subscribe('passengers', function() {
            self.updatePassengerSummary();
        });
        
        // Écouter les changements de classe
        state.subscribe('travelClass', function() {
            self.updatePassengerSummary();
        });
        
        // Écouter les changements de dates
        state.subscribe('departureDate', function(date) {
            self.updateDateDisplay('departure', date);
        });
        
        state.subscribe('returnDate', function(date) {
            self.updateDateDisplay('return', date);
        });
        
        // Gestion du clic extérieur pour fermer les modals
        document.addEventListener('click', function(e) {
            self.handleOutsideClick(e);
        });
        
        // Gestion de la touche Échap
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                self.closeAllModals();
            }
        });
    }
    
    /**
     * Callback lors du changement de mode
     */
    onModeChange(mode) {
        console.log('📱 Mode changé:', mode);
        var isFlight = mode === 'flights';
        var flightOptions = document.getElementById('flight-options');
        if (flightOptions) {
            if (isFlight) {
                flightOptions.classList.remove('hidden');
            } else {
                flightOptions.classList.add('hidden');
            }
        }
    }
    
    /**
     * Gestion des clics à l'extérieur
     */
    handleOutsideClick(event) {
        // Fermer les résultats d'autocomplete
        var autocompleteResults = document.querySelectorAll('#dest-results, #origin-results');
        for (var i = 0; i < autocompleteResults.length; i++) {
            var results = autocompleteResults[i];
            var inputId = results.id === 'dest-results' ? 'mainInput' : 'originInput';
            var input = document.getElementById(inputId);
            if (results && !results.contains(event.target) && input !== event.target) {
                results.classList.add('hidden');
            }
        }
        
        // Fermer le modal passagers si clic extérieur
        var passengerModal = document.getElementById('passenger-modal');
        var passengerTrigger = document.querySelector('[onclick*="togglePassengers"]');
        if (passengerModal && !passengerModal.classList.contains('hidden') &&
            !passengerModal.contains(event.target) &&
            passengerTrigger && !passengerTrigger.contains(event.target)) {
            passengerModal.classList.add('hidden');
        }
    }
    
    /**
     * Ferme tous les modals ouverts
     */
    closeAllModals() {
        var modals = document.querySelectorAll('.passenger-dropdown, #packageModal');
        for (var i = 0; i < modals.length; i++) {
            modals[i].classList.add('hidden');
        }
    }
    
    /**
     * Met à jour l'affichage des dates
     */
    updateDateDisplay(type, date) {
        var elementId = type === 'departure' ? 'display-checkin' : 'display-checkout';
        var element = document.getElementById(elementId);
        var dayElementId = type === 'departure' ? 'display-checkin-day' : 'display-checkout-day';
        var dayElement = document.getElementById(dayElementId);
        
        if (!element) return;
        
        if (date) {
            var d = new Date(date);
            element.innerText = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            if (dayElement) {
                dayElement.innerText = d.toLocaleDateString('fr-FR', { weekday: 'long' });
                dayElement.classList.remove('hidden');
            }
        } else {
            element.innerText = type === 'departure' ? 'Choisir une date' : 'Flexible';
            if (dayElement) dayElement.innerText = '';
        }
    }
    
    /**
     * Changement de mode (Vols / Hôtels / Voitures)
     */
    changeMode(mode) {
        state.set('currentMode', mode);
        
        // Mettre à jour l'UI des onglets
        var tabs = document.querySelectorAll('.travala-tab');
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            var isActive = tab.id === 'tab-' + mode;
            if (isActive) {
                tab.classList.add('active');
                tab.classList.add('border-blue-600', 'text-blue-600');
                tab.classList.remove('text-gray-500');
            } else {
                tab.classList.remove('active');
                tab.classList.remove('border-blue-600', 'text-blue-600');
                tab.classList.add('text-gray-500');
            }
        }
        
        // Afficher/masquer les options selon le mode
        var isFlight = mode === 'flights';
        var flightOptions = document.getElementById('flight-options');
        var boxOrigin = document.getElementById('box-origin');
        var multiContainer = document.getElementById('multi-city-container');
        
        if (flightOptions) {
            if (isFlight) {
                flightOptions.classList.remove('hidden');
            } else {
                flightOptions.classList.add('hidden');
            }
        }
        
        if (boxOrigin) {
            if (isFlight) {
                boxOrigin.classList.remove('hidden');
            } else {
                boxOrigin.classList.add('hidden');
            }
        }
        
        if (multiContainer) {
            multiContainer.classList.add('hidden');
        }
        
        // Réinitialiser les dates
        this.resetDatePicker();
        
        // Mettre à jour les labels
        var labelMain = document.getElementById('label-main');
        var mainInput = document.getElementById('mainInput');
        var destIcon = document.getElementById('dest-icon');
        
        if (labelMain) {
            var labels = {
                flights: 'Destination (IATA)',
                stays: 'Destination / Ville',
                cars: 'Lieu de retrait'
            };
            labelMain.innerText = labels[mode] || 'Rechercher';
        }
        
        if (destIcon) {
            var icons = {
                flights: 'fas fa-plane',
                stays: 'fas fa-hotel',
                cars: 'fas fa-car'
            };
            destIcon.className = (icons[mode] || 'fas fa-map-marker-alt') + ' text-gray-400 text-xs';
        }
        
        if (mainInput) {
            var placeholders = {
                flights: 'Paris (CDG), New York (JFK)...',
                stays: 'Paris, New York, Tokyo...',
                cars: 'Aéroport, gare, ville...'
            };
            mainInput.placeholder = placeholders[mode] || 'Rechercher...';
            mainInput.value = '';
        }
        
        // Déclencher un événement personnalisé
        var event = new CustomEvent('modeChanged', { detail: { mode: mode } });
        document.dispatchEvent(event);
    }
    
    /**
     * Réinitialise le sélecteur de dates
     */
    resetDatePicker() {
        if (window.flatpickrInstance) {
            window.flatpickrInstance.clear();
        }
        
        state.set('departureDate', '', true);
        state.set('returnDate', '', true);
        
        var checkinDisplay = document.getElementById('display-checkin');
        var checkoutDisplay = document.getElementById('display-checkout');
        var checkinDay = document.getElementById('display-checkin-day');
        var checkoutDay = document.getElementById('display-checkout-day');
        
        if (checkinDisplay) checkinDisplay.innerText = 'Choisir une date';
        if (checkoutDisplay) checkoutDisplay.innerText = 'Flexible';
        if (checkinDay) checkinDay.innerText = '';
        if (checkoutDay) checkoutDay.innerText = '';
    }
    
    /**
     * Définit le type de voyage
     */
    setTripType(type) {
        state.set('tripType', type);
        
        // Mettre à jour l'UI des boutons
        var tripBtns = document.querySelectorAll('.trip-type-btn');
        for (var i = 0; i < tripBtns.length; i++) {
            var btn = tripBtns[i];
            var isActive = btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf(type) !== -1;
            if (isActive) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        var returnBox = document.getElementById('box-return');
        var multiContainer = document.getElementById('multi-city-container');
        
        if (type === 'round_trip') {
            if (returnBox) returnBox.classList.remove('opacity-50');
            if (multiContainer) multiContainer.classList.add('hidden');
        } else if (type === 'one_way') {
            if (returnBox) returnBox.classList.add('opacity-50');
            if (multiContainer) multiContainer.classList.add('hidden');
            // Réinitialiser la date de retour
            state.set('returnDate', '');
        } else if (type === 'multi') {
            if (multiContainer) multiContainer.classList.remove('hidden');
        }
        
        // Déclencher un événement
        var event = new CustomEvent('tripTypeChanged', { detail: { type: type } });
        document.dispatchEvent(event);
    }
    
    /**
     * Met à jour le résumé des passagers
     */
    updatePassengerSummary() {
        var passengers = state.get('passengers');
        var travelClass = state.get('travelClass');
        var total = passengers.adult + passengers.child + passengers.infant;
        
        var summary = document.getElementById('passenger-summary');
        if (summary) {
            summary.innerText = total + ' Voyageur' + (total > 1 ? 's' : '');
        }
        
        var classSummary = document.getElementById('class-summary');
        if (classSummary) {
            classSummary.innerText = 'Classe ' + travelClass;
        }
        
        // Mettre à jour le summary complet dans le modal
        var fullSummary = document.getElementById('passenger-summary-full');
        if (fullSummary) {
            var parts = [];
            if (passengers.adult > 0) parts.push(passengers.adult + ' Adulte' + (passengers.adult > 1 ? 's' : ''));
            if (passengers.child > 0) parts.push(passengers.child + ' Enfant' + (passengers.child > 1 ? 's' : ''));
            if (passengers.infant > 0) parts.push(passengers.infant + ' Bébé' + (passengers.infant > 1 ? 's' : ''));
            fullSummary.innerText = parts.join(', ');
        }
    }
    
    /**
     * Met à jour la quantité de passagers
     */
    updateQty(type, delta, event) {
        if (event) event.stopPropagation();
        
        var passengers = JSON.parse(JSON.stringify(state.get('passengers')));
        var newValue = passengers[type] + delta;
        
        // Validation des limites
        var maxPassengers = 9;
        var currentTotal = passengers.adult + passengers.child + passengers.infant;
        
        if (delta > 0 && currentTotal >= maxPassengers) {
            this.showNotification('Maximum 9 voyageurs par réservation', 'warning');
            return;
        }
        
        if (delta < 0 && newValue < (type === 'adult' ? 1 : 0)) return;
        
        passengers[type] = newValue;
        state.set('passengers', passengers);
        
        // Animation du compteur
        var qtySpan = document.getElementById('qty-' + type);
        if (qtySpan) {
            qtySpan.classList.add('scale-125');
            var self = this;
            setTimeout(function() {
                qtySpan.classList.remove('scale-125');
            }, 200);
            qtySpan.innerText = newValue;
        }
    }
    
    /**
     * Définit la classe de voyage
     */
    setCabin(cabinCode) {
        var cabinNames = {
            economy: 'Économique',
            premium_economy: 'Eco. Premium',
            business: 'Affaires',
            first: 'Première'
        };
        
        state.set('travelClassCode', cabinCode);
        state.set('travelClass', cabinNames[cabinCode]);
        
        // Mettre à jour l'UI des boutons avec animation
        var cabinBtns = document.querySelectorAll('.cabin-btn');
        for (var i = 0; i < cabinBtns.length; i++) {
            var btn = cabinBtns[i];
            btn.classList.remove('active-cabin', 'bg-blue-600', 'text-white', 'border-blue-600');
            btn.classList.add('border-gray-200', 'text-gray-600');
            
            if (btn.id === 'cabin-' + cabinCode) {
                btn.classList.add('active-cabin', 'bg-blue-600', 'text-white', 'border-blue-600');
                btn.classList.remove('border-gray-200', 'text-gray-600');
                
                // Animation
                btn.classList.add('scale-105');
                var self = this;
                setTimeout(function() {
                    btn.classList.remove('scale-105');
                }, 200);
            }
        }
        
        // Déclencher un événement
        var event = new CustomEvent('cabinChanged', { detail: { cabin: cabinCode } });
        document.dispatchEvent(event);
    }
    
    /**
     * Ouvre le sélecteur de dates
     */
    openDatePicker(type) {
        if (window.flatpickrInstance) {
            window.flatpickrInstance.open();
            
            // Si c'est le retour et que c'est un aller simple, suggérer une date après le départ
            if (type === 'return' && state.get('tripType') === 'round_trip') {
                var departureDate = state.get('departureDate');
                if (departureDate) {
                    var minDate = new Date(departureDate);
                    minDate.setDate(minDate.getDate() + 1);
                    window.flatpickrInstance.set('minDate', minDate);
                }
            }
        } else {
            console.warn('Flatpickr non initialisé');
        }
    }
    
    /**
     * Effectue la recherche
     */
    // Dans terra-engine.js - Modifier performSearch()

async performSearch() {
    const originInput = document.getElementById('originInput');
    const mainInput = document.getElementById('mainInput');
    const searchBtn = document.querySelector('.search-btn');
    
    let destination = mainInput?.value?.trim();
    let origin = originInput?.value?.trim() || 'Kinshasa';
    
    if (!destination) {
        this.showNotification('Veuillez sélectionner une destination', 'warning');
        mainInput?.focus();
        return;
    }
    
    // Animation du bouton
    if (searchBtn) {
        searchBtn.classList.add('loading');
        searchBtn.disabled = true;
    }
    
    // Afficher un indicateur de traduction
    this.showNotification(`🔍 Traduction de "${origin}" et "${destination}" en codes aéroport...`, 'info');
    
    try {
        const passengers = state.get('passengers');
        
        const searchData = {
            origin: origin,
            destination: destination,
            departureDate: state.get('departureDate'),
            returnDate: state.get('returnDate'),
            adults: passengers.adult,
            children: passengers.child,
            infants: passengers.infant,
            class: state.get('travelClassCode'),
            tripType: state.get('tripType')
        };
        
        // Utiliser le nouvel endpoint multi-aéroports
        const response = await fetch(`${api.baseUrl}/flights/search-multi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchData)
        });
        
        const results = await response.json();
        
        if (results.search_details) {
            console.log('Traduction:', results.search_details);
            this.showNotification(`📍 ${origin} → ${results.search_details.origin_codes.join(', ')} | ${destination} → ${results.search_details.destination_codes.join(', ')}`, 'success');
        }
        
        sessionStorage.setItem('last_search_results', JSON.stringify(results));
        sessionStorage.setItem('search_type', 'flight');
        sessionStorage.setItem('flight_dest', destination);
        sessionStorage.setItem('search_params', JSON.stringify(searchData));
        
        window.location.href = './results.html';
        
    } catch (error) {
        console.error('Search error:', error);
        this.showNotification('Erreur lors de la recherche', 'error');
        
        if (searchBtn) {
            searchBtn.classList.remove('loading');
            searchBtn.disabled = false;
        }
    }
}
    
    /**
     * Affiche une notification toast
     */
    showNotification(message, type) {
        type = type || 'info';
        var colors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };
        
        var icons = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-exclamation-circle'
        };
        
        var toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 ' + colors[type] + ' text-white px-6 py-3 rounded-xl shadow-xl z-50 transition-all duration-300 transform translate-y-0 opacity-100';
        toast.innerHTML = '<i class="fas ' + icons[type] + ' mr-2"></i>' + sanitize(message);
        document.body.appendChild(toast);
        
        // Animation de disparition
        var self = this;
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 4000);
    }
    
    /**
     * Configuration du header au scroll
     */
    setupScrollHeader() {
        var header = document.getElementById('mainHeader');
        if (!header) return;
        
        window.addEventListener('scroll', function() {
            var currentScroll = window.scrollY;
            
            if (currentScroll > 50) {
                header.classList.add('nav-scrolled');
                header.classList.remove('nav-transparent');
            } else {
                header.classList.remove('nav-scrolled');
                header.classList.add('nav-transparent');
            }
        });
    }
    
    /**
     * Ajoute une ligne multi-villes
     */
    addMultiCityRow() {
        var container = document.getElementById('multi-city-list');
        if (!container) return;
        
        var newRow = document.createElement('div');
        newRow.className = 'flex flex-col sm:flex-row gap-3 items-start sm:items-center animate-fade-in p-3 bg-gray-50 rounded-xl';
        newRow.innerHTML = `
            <div class="flex-1 w-full">
                <label class="text-[9px] text-gray-400 uppercase tracking-wider">Départ</label>
                <input type="text" placeholder="Aéroport de départ" class="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div class="flex-1 w-full">
                <label class="text-[9px] text-gray-400 uppercase tracking-wider">Arrivée</label>
                <input type="text" placeholder="Aéroport d'arrivée" class="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div class="flex-1 w-full">
                <label class="text-[9px] text-gray-400 uppercase tracking-wider">Date</label>
                <input type="date" class="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <button onclick="this.closest('div').remove()" class="mt-2 sm:mt-6 text-red-500 hover:text-red-700 p-2">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(newRow);
        
        // Animation de défilement vers la nouvelle ligne
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    /**
     * Ouvre le modal des packages (délégué au composant)
     */
    openPackageModal(packageId) {
        if (this.components.packageModal) {
            this.components.packageModal.open(packageId);
        } else {
            console.error('PackageModal non initialisé');
        }
    }
    
    /**
     * Ouvre le modal des passagers
     */
    togglePassengers(event) {
        if (event) event.stopPropagation();
        
        var modal = document.getElementById('passenger-modal');
        if (modal) {
            modal.classList.toggle('hidden');
            
            if (!modal.classList.contains('hidden')) {
                // Mettre à jour les compteurs
                this.updatePassengerSummary();
            }
        }
    }
}

// Export d'une instance unique
export var terraEngine = new TerraEngine();

// Initialisation automatique
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        terraEngine.init();
    });
} else {
    terraEngine.init();
}

// Exposer globalement pour les appels inline
window.TerraEngine = terraEngine;
window.toggleMenu = function() {
    if (terraEngine.components.mobileMenu) {
        terraEngine.components.mobileMenu.toggle();
    }
};
window.openPackageModal = function(id) {
    terraEngine.openPackageModal(id);
};
window.closePackageModal = function() {
    if (terraEngine.components.packageModal) {
        terraEngine.components.packageModal.close();
    }
};

// Exposer les fonctions principales
window.changeMode = function(mode) {
    terraEngine.changeMode(mode);
};
window.setTripType = function(type) {
    terraEngine.setTripType(type);
};
window.updateQty = function(type, delta, event) {
    terraEngine.updateQty(type, delta, event);
};
window.setCabin = function(cabin) {
    terraEngine.setCabin(cabin);
};
window.performSearch = function() {
    terraEngine.performSearch();
};
window.addMultiCityRow = function() {
    terraEngine.addMultiCityRow();
};
window.togglePassengers = function(event) {
    terraEngine.togglePassengers(event);
};
window.openDatePicker = function(type) {
    terraEngine.openDatePicker(type);
};