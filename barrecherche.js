/**
 * TERRA VOYAGE - CORE ENGINE (V2.3 - Unified & Optimized)
 * Fix: Full Integration, IATA Mapping & Search Redirection
 */

const TerraEngine = {
    state: {
        currentMode: 'stays',
        passengers: { adult: 1, child: 0, infant: 0 },
        travelClass: 'Standard', // Nom affiché
        travelClassCode: 'economy', // Code envoyé à l'API
        tripType: 'round_trip',
        multiCityCount: 0,
        departureDate: '',
        returnDate: ''
    },

    config: {
        classes: {
            flights: ['Économie', 'Premium', 'Business', 'First'],
            stays: ['Standard', 'Luxe', 'Palace', 'Tout Inclus'],
            cars: ['Citadine', 'Berline', 'SUV', 'Prestige']
        },
        // Traduction pour Duffel / Hotelbeds
        internalMapping: {
            'Économie': 'economy', 'Premium': 'premium_economy', 'Business': 'business', 'First': 'first',
            'Standard': 'standard', 'Luxe': 'luxury'
        }
    },

    // --- NAVIGATION ---
    changeMode(mode) {
        this.state.currentMode = mode;
        
        document.querySelectorAll('.travala-tab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `tab-${mode}`);
        });

        const isFlight = mode === 'flights';
        this.toggleDisplay('box-origin', isFlight);
        this.toggleDisplay('flight-options', isFlight);
        this.toggleDisplay('multi-city-container', isFlight && this.state.tripType === 'multi');

        const labelMain = document.getElementById('label-main');
        if (labelMain) labelMain.innerText = isFlight ? "Arrivée (IATA)" : "Destination";

        this.renderClassButtons(mode);
    },

    // --- LOGIQUE DE RECHERCHE & REDIRECTION ---
    performSearch() {
        const originInput = document.getElementById('originInput');
        const mainInput = document.getElementById('mainInput');
        
        const dest = mainInput?.value.trim().toUpperCase();
        const origin = originInput?.value.trim().toUpperCase() || 'PAR';

        if (!dest || !this.state.departureDate) {
            this.showAlert("Veuillez remplir la destination et la date.");
            return;
        }

        const params = new URLSearchParams({
            mode: this.state.currentMode,
            dest: dest,
            origin: origin,
            departureDate: this.state.departureDate,
            returnDate: this.state.returnDate || '',
            adults: this.state.passengers.adult,
            class: this.state.travelClassCode,
            tripType: this.state.tripType
        });

        window.location.href = `resultats.html?${params.toString()}`;
    },

    // --- FLIGHT LOGIC ---
    setTripType(type) {
        this.state.tripType = type;
        const isMulti = type === 'multi';

        document.querySelectorAll('#flight-options label span').forEach(span => {
            const input = span.parentElement.querySelector('input');
            if (input) {
                const isActive = input.value === type;
                span.classList.toggle('text-blue-600', isActive);
                span.classList.toggle('text-gray-400', !isActive);
            }
        });

        this.toggleDisplay('multi-city-container', isMulti);
        if (isMulti && this.state.multiCityCount === 0) this.addMultiCityRow();

        const boxReturn = document.getElementById('box-return');
        if (boxReturn) {
            const disabled = type === 'one_way' || isMulti;
            boxReturn.style.opacity = disabled ? '0.2' : '1';
            boxReturn.style.pointerEvents = disabled ? 'none' : 'auto';
        }
    },

    // --- MULTI-CITY ---
    addMultiCityRow() {
        if (this.state.multiCityCount >= 4) return;
        this.state.multiCityCount++;
        const container = document.getElementById('multi-city-list');
        if (!container) return;

        const row = document.createElement('div');
        row.className = "flex flex-col md:flex-row items-stretch gap-2 animate-fadeIn mb-2";
        row.id = `row-mc-${this.state.multiCityCount}`;
        row.innerHTML = `
            <div class="flex-[1.5] bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <label class="block text-[8px] uppercase text-gray-400 font-bold mb-1">Escale ${this.state.multiCityCount}</label>
                <input type="text" placeholder="Destination IATA" class="w-full bg-transparent border-none p-0 text-xs font-bold focus:ring-0 uppercase">
            </div>
            <div class="flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm cursor-pointer">
                <label class="block text-[8px] uppercase text-gray-400 font-bold mb-1">Date</label>
                <span class="text-xs font-bold text-blue-600 italic">Choisir date</span>
            </div>
            <button type="button" onclick="TerraEngine.removeMultiCityRow('${row.id}')" class="px-2 text-gray-300 hover:text-red-500 transition-colors">
                <i class="fas fa-times-circle"></i>
            </button>`;
        container.appendChild(row);
    },

    removeMultiCityRow(id) {
        const el = document.getElementById(id);
        if (el) { el.remove(); }
    },

    // --- PASSENGERS & MODAL ---
    togglePassengers(event) {
        if (event) event.stopPropagation();
        const modal = document.getElementById('passenger-modal');
        if (modal) modal.classList.toggle('active');
    },

    updateQty(type, delta, event) {
        if (event) event.stopPropagation();
        
        const p = this.state.passengers;
        if (delta > 0 && (p.adult + p.child + p.infant) >= 9) return;
        if (delta < 0 && p[type] <= (type === 'adult' ? 1 : 0)) return;

        if (type === 'infant' && delta > 0 && (p.infant + 1) > p.adult) {
            this.showAlert("Un bébé doit être accompagné d'un adulte.");
            return;
        }

        this.state.passengers[type] += delta;
        const qtyEl = document.getElementById(`qty-${type}`);
        if (qtyEl) qtyEl.innerText = this.state.passengers[type];
        this.updateSummary();
    },

    renderClassButtons(mode) {
        const grid = document.getElementById('class-options-grid');
        if (!grid) return;

        const currentClasses = this.config.classes[mode] || this.config.classes.stays;
        
        grid.innerHTML = currentClasses.map((c) => `
            <button type="button" onclick="TerraEngine.setClass('${c}', event)" 
                    class="class-btn ${this.state.travelClass === c ? 'active' : ''}">${c}</button>
        `).join('');
        this.updateSummary();
    },

    setClass(name, event) {
        if (event) event.stopPropagation();
        
        this.state.travelClass = name;
        this.state.travelClassCode = this.config.internalMapping[name] || 'economy';

        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.classList.toggle('active', btn.innerText.trim() === name);
        });
        this.updateSummary();
    },

    updateSummary() {
        const { adult, child, infant } = this.state.passengers;
        const summary = document.getElementById('passenger-summary');
        if (!summary) return;

        let parts = [`${adult} Adulte${adult > 1 ? 's' : ''}`];
        if (child > 0) parts.push(`${child} Enf.`);
        if (infant > 0) parts.push(`${infant} Bébé`);
        summary.innerText = `${parts.join(', ')} - ${this.state.travelClass}`;
    },

    toggleDisplay(id, show) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !show);
    },

    showAlert(msg) { alert(msg); }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    TerraEngine.changeMode('stays');

    // Gestion de la fermeture des modales
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('passenger-modal');
        if (modal && modal.classList.contains('active')) {
            if (!e.target.closest('#passenger-modal') && !e.target.closest('[onclick*="togglePassengers"]')) {
                modal.classList.remove('active');
            }
        }
    });
});