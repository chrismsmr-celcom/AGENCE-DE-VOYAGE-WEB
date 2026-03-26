/**
 * TERRA VOYAGE - SEARCH BAR COMPONENT
 */

import { api } from '../core/api-client.js';
import { debounce } from '../utils/validators.js';

export class SearchBar {
    constructor(container) {
        this.container = container;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupDatePicker();
    }
    
    cacheElements() {
        this.elements = {
            originInput: document.getElementById('originInput'),
            destInput: document.getElementById('mainInput'),
            originResults: document.getElementById('origin-results'),
            destResults: document.getElementById('dest-results'),
            // On cible la section entière pour le clic
            dateSection: document.getElementById('date-section'), 
            displayCheckin: document.getElementById('display-checkin'),
            displayCheckout: document.getElementById('display-checkout')
        };
    }
    
    setupEventListeners() {
        // Autocomplete Destination
        if (this.elements.destInput) {
            this.elements.destInput.addEventListener('input', debounce((e) => {
                this.fetchLocations(e.target.value, this.elements.destResults);
            }, 300));
        }
        
        // Autocomplete Origine
        if (this.elements.originInput) {
            this.elements.originInput.addEventListener('input', debounce((e) => {
                this.fetchLocations(e.target.value, this.elements.originResults);
            }, 300));
        }

        // Trigger du calendrier au clic sur la zone d'affichage des dates
        if (this.elements.dateSection) {
            this.elements.dateSection.addEventListener('click', () => {
                this.fp.open();
            });
        }
        
        // Fermer les résultats au clic extérieur
        document.addEventListener('click', (e) => {
            if (!this.elements.destInput?.contains(e.target)) {
                this.elements.destResults?.classList.add('hidden');
            }
            if (!this.elements.originInput?.contains(e.target)) {
                this.elements.originResults?.classList.add('hidden');
            }
        });
    }
    
   // Dans search-bar.js - Modifier fetchLocations pour inclure les villes

async fetchLocations(query, resultsContainer) {
    if (!query || query.length < 2) {
        resultsContainer?.classList.add('hidden');
        return;
    }
    
    try {
        // Chercher à la fois les aéroports ET les villes
        const [airports, cities] = await Promise.all([
            api.searchLocations(query),
            fetch(`${api.baseUrl}/geocode/city-to-iata?city=${encodeURIComponent(query)}`).then(r => r.json())
        ]);
        
        let allResults = [...(airports || [])];
        
        // Ajouter la ville si trouvée
        if (cities.success && cities.city) {
            allResults.unshift({
                name: cities.city,
                iata_code: cities.iata_codes ? cities.iata_codes[0] : '',
                municipality: cities.country || '',
                iso_country: cities.country_code || '',
                type: 'city',
                iata_codes: cities.iata_codes,
                display_name: `${cities.city} (${cities.iata_codes?.join(', ')}) - ${cities.country}`
            });
        }
        
        if (!resultsContainer) return;
        
        if (allResults.length === 0) {
            resultsContainer.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">Aucun résultat</div>';
        } else {
            resultsContainer.innerHTML = allResults.map(loc => `
                <div class="suggestion-item p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-all"
                     data-code="${loc.iata_code || (loc.iata_codes ? loc.iata_codes[0] : '')}"
                     data-name="${loc.name || loc.city}"
                     data-type="${loc.type || 'airport'}">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-semibold text-gray-800">
                                ${loc.name || loc.city}
                                ${loc.type === 'city' ? '<span class="text-[9px] text-blue-500 ml-1">🏙️ Ville</span>' : '<span class="text-[9px] text-green-500 ml-1">✈️ Aéroport</span>'}
                            </div>
                            <div class="text-xs text-gray-400 mt-0.5">
                                ${loc.municipality || ''} ${loc.iso_country ? `• ${loc.iso_country}` : ''}
                            </div>
                            ${loc.iata_codes ? `<div class="text-[10px] font-mono text-blue-500 mt-1">Aéroports: ${loc.iata_codes.join(', ')}</div>` : ''}
                            ${loc.iata_code && !loc.iata_codes ? `<div class="text-[10px] font-mono text-blue-500 mt-1">${loc.iata_code}</div>` : ''}
                        </div>
                        ${loc.iata_codes ? `<span class="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">${loc.iata_codes.length} aéroports</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        resultsContainer.classList.remove('hidden');
        
        // Attacher les événements
        resultsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const input = resultsContainer === this.elements.destResults ? 
                    this.elements.destInput : this.elements.originInput;
                if (input) {
                    const name = item.dataset.name;
                    const code = item.dataset.code;
                    const type = item.dataset.type;
                    
                    // Si c'est une ville, on garde le nom de la ville (pas le code)
                    if (type === 'city') {
                        input.value = name;
                    } else {
                        input.value = code || name;
                    }
                    
                    input.dataset.fullName = name;
                    input.dataset.type = type;
                }
                resultsContainer.classList.add('hidden');
            });
        });
        
    } catch (error) {
        console.error('Autocomplete error:', error);
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Erreur de chargement</div>';
            resultsContainer.classList.remove('hidden');
        }
    }
}    
    setupDatePicker() {
        // On crée un input fantôme si nécessaire ou on utilise un existant
        const fpInput = document.createElement('input');
        fpInput.style.display = 'none';
        document.body.appendChild(fpInput);

        this.fp = flatpickr(fpInput, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            minDate: 'today',
            locale: 'fr',
            showMonths: 2,
            onClose: (selectedDates) => {
                if (selectedDates.length > 0) {
                    const options = { day: '2-digit', month: 'short' };
                    
                    // Update affichage Aller
                    if (this.elements.displayCheckin) {
                        this.elements.displayCheckin.innerText = selectedDates[0].toLocaleDateString('fr-FR', options);
                    }
                    
                    // Update affichage Retour
                    if (selectedDates[1] && this.elements.displayCheckout) {
                        this.elements.displayCheckout.innerText = selectedDates[1].toLocaleDateString('fr-FR', options);
                    } else if (this.elements.displayCheckout) {
                        this.elements.displayCheckout.innerText = '-- ---';
                    }
                    
                    // Sync avec le state global (Optionnel selon ton architecture)
                    if (window.TerraEngine) {
                        window.TerraEngine.state.set('dates', selectedDates);
                    }
                }
            }
        });
    }
}