/**
 * TERRA VOYAGE - CORE ENGINE (V2.5 - Optimized)
 * Intégration complète : IATA, Autocomplete, Flatpickr & State Management
 */

const TerraEngine = {
    state: {
        currentMode: 'stays',
        passengers: { adult: 1, child: 0, infant: 0 },
        travelClass: 'Standard', 
        travelClassCode: 'economy', 
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
        internalMapping: {
            'Économie': 'economy', 'Premium': 'premium_economy', 'Business': 'business', 'First': 'first',
            'Standard': 'standard', 'Luxe': 'luxury'
        }
    },

    iataDatabase: [
        { name: "Paris (Tous)", code: "PAR", country: "France" },
        { name: "Paris CDG", code: "CDG", country: "France" },
        { name: "Paris Orly", code: "ORY", country: "France" },
        { name: "Bruxelles", code: "BRU", country: "Belgique" },
        { name: "Londres", code: "LON", country: "UK" },
        { name: "Istanbul", code: "IST", country: "Turquie" },
        { name: "Genève", code: "GVA", country: "Suisse" },
        { name: "Kinshasa", code: "FIH", country: "RDC" },
        { name: "Lubumbashi", code: "FBM", country: "RDC" },
        { name: "Goma", code: "GOM", country: "RDC" },
        { name: "Abidjan", code: "ABJ", country: "Côte d'Ivoire" },
        { name: "Dakar", code: "DSS", country: "Sénégal" },
        { name: "Casablanca", code: "CMN", country: "Maroc" },
        { name: "Dubai", code: "DXB", country: "UAE" },
        { name: "New York", code: "NYC", country: "USA" },
        { name: "Bangkok", code: "BKK", country: "Thaïlande" }
    ],

    // --- NAVIGATION & UI ---
    changeMode(mode) {
        this.state.currentMode = mode;
        
        document.querySelectorAll('.travala-tab').forEach(tab => {
            const isActive = tab.id === `tab-${mode}`;
            tab.classList.toggle('active', isActive);
            if(isActive) {
                tab.classList.add('border-blue-600', 'text-blue-600');
                tab.classList.remove('text-gray-500');
            } else {
                tab.classList.remove('border-blue-600', 'text-blue-600');
                tab.classList.add('text-gray-500');
            }
        });

        const isFlight = mode === 'flights';
        this.toggleDisplay('box-origin', isFlight); 
        
        const labelMain = document.getElementById('label-main');
        const mainInput = document.getElementById('mainInput');

        if (labelMain) {
            labelMain.innerText = isFlight ? "Arrivée (IATA)" : (mode === 'stays' ? "Destination" : "Lieu de retrait");
        }
        
        if (mainInput) {
            mainInput.placeholder = isFlight ? "Où allez-vous ?" : "Chercher...";
        }

        this.toggleDisplay('flight-options', isFlight);
        this.renderClassButtons(mode);
    },

    // --- AUTOCOMPLETE ---
    setupAutocomplete(inputId, resultsId) {
        const input = document.getElementById(inputId);
        const resultsContainer = document.getElementById(resultsId);
        if (!input || !resultsContainer) return;

        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            resultsContainer.innerHTML = ''; 
            if (value.length < 2) return; 

            const matches = this.iataDatabase.filter(item => 
                item.name.toLowerCase().includes(value) || 
                item.code.toLowerCase().includes(value)
            ).slice(0, 5); 

            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center transition-colors";
                div.innerHTML = `
                    <div>
                        <span class="font-bold text-sm text-gray-800">${match.name}</span>
                        <p class="text-[10px] text-gray-400 uppercase">${match.country}</p>
                    </div>
                    <span class="bg-gray-100 text-blue-600 px-2 py-1 rounded text-[10px] font-black">${match.code}</span>
                `;
                div.onclick = () => {
    // On met le code dans l'input pour que l'utilisateur le voie
    input.value = match.code; 
    
    // On peut aussi stocker le nom complet dans un attribut data pour le backend
    input.dataset.fullName = match.name;
    
    resultsContainer.innerHTML = ''; 
};
                resultsContainer.appendChild(div);
            });
        });
    },

    // --- GESTION MULTI-CITÉ ---
    addMultiCityRow() {
        this.state.multiCityCount++;
        const container = document.getElementById('multi-city-list');
        if (!container) return;
        const row = document.createElement('div');
        row.className = "flex flex-col md:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm animate-fade-in";
        row.innerHTML = `
            <div class="flex-1"><input type="text" placeholder="Origine" class="w-full text-xs font-bold uppercase border-none focus:ring-0"></div>
            <div class="flex-1"><input type="text" placeholder="Destination" class="w-full text-xs font-bold uppercase border-none focus:ring-0"></div>
            <div class="flex-1 border-l pl-4"><input type="date" class="w-full text-xs font-bold border-none focus:ring-0"></div>
            <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 px-2"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(row);
    },

    updateTripTypeUI(type) {
        document.querySelectorAll('input[name="trip-type"]').forEach(input => {
            const label = input.nextElementSibling;
            if (label) {
                if (input.value === type) {
                    label.classList.add('text-blue-600', 'font-black');
                    label.classList.remove('text-gray-400');
                } else {
                    label.classList.remove('text-blue-600', 'font-black');
                    label.classList.add('text-gray-400');
                }
            }
        });
        this.setTripType(type);
    },

    // --- RECHERCHE & REDIRECTION ---
    performSearch() {
        const originInput = document.getElementById('originInput');
        const mainInput = document.getElementById('mainInput');
        
        const dest = mainInput?.value?.trim().toUpperCase();
        const origin = originInput?.value?.trim().toUpperCase() || 'PAR';

        if (!dest || !this.state.departureDate) {
            this.showAlert("Veuillez remplir la destination et la date de départ.");
            return;
        }

        const params = new URLSearchParams({
            origin: origin,
            dest: dest,
            departureDate: this.state.departureDate,
            returnDate: this.state.returnDate || '',
            adults: this.state.passengers.adult,
            class: this.state.travelClassCode,
            tripType: this.state.tripType
        });

        const routes = {
            'flights': 'vol.html',
            'stays': 'hotels.html',
            'cars': 'voitures.html'
        };

        const targetPage = routes[this.state.currentMode] || 'vol.html';
        window.location.href = `${targetPage}?${params.toString()}`;
    },

    // --- GESTION PASSAGERS ---
    togglePassengers(event) {
        if (event) event.stopPropagation();
        const modal = document.getElementById('passenger-modal');
        if (modal) {
            modal.classList.toggle('hidden');
        }
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
        this.updateSummary();
        this.renderClassButtons(this.state.currentMode);
    },

    setCabin(cabinCode, event) {
        if (event) event.stopPropagation();
        this.state.travelClassCode = cabinCode;
        const names = { 'economy': 'Éco', 'premium_economy': 'Eco+', 'business': 'Business', 'first': 'First' };
        this.state.travelClass = names[cabinCode] || 'Éco';

        document.querySelectorAll('.cabin-btn').forEach(btn => {
            btn.classList.toggle('active-cabin', btn.id === `cabin-${cabinCode}`);
        });
        this.updateSummary();
    },

    setTripType(type) {
        this.state.tripType = type;
        this.toggleDisplay('box-return', type === 'round_trip');
        this.toggleDisplay('multi-city-container', type === 'multi');
    },

    updateSummary() {
        const { adult, child, infant } = this.state.passengers;
        const summary = document.getElementById('passenger-summary');
        if (!summary) return;
        let total = adult + child + infant;
        summary.innerText = `${total} Voyageur${total > 1 ? 's' : ''} - ${this.state.travelClass}`;
    },

    toggleDisplay(id, show) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !show);
    },

    showAlert(msg) { alert(msg); }
};

// --- LOGIQUE HORS OBJET (SLIDER & EVENTS) ---

function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    let currentSlide = 0;

    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser le slider
    initHeroSlider();

    // 2. Initialiser les autocomplètes
    TerraEngine.setupAutocomplete('mainInput', 'dest-results');
    TerraEngine.setupAutocomplete('originInput', 'origin-results');

    // 3. Initialiser Flatpickr
    const dateInput = document.getElementById('date-picker-input');
    if (dateInput && typeof flatpickr !== 'undefined') {
        flatpickr(dateInput, {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: "today",
            locale: "fr",
            onChange: function(selectedDates) {
                if (selectedDates.length > 0) {
                    const formatDate = (d) => d.toISOString().split('T')[0];
                    TerraEngine.state.departureDate = formatDate(selectedDates[0]);
                    document.getElementById('display-checkin').innerText = selectedDates[0].toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'});
                    
                    if (selectedDates[1]) {
                        TerraEngine.state.returnDate = formatDate(selectedDates[1]);
                        document.getElementById('display-checkout').innerText = selectedDates[1].toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'});
                    } else {
                        TerraEngine.state.returnDate = '';
                        document.getElementById('display-checkout').innerText = "-- --";
                    }
                }
            }
        });
    }

    // 4. Fermeture modale clic extérieur
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('passenger-modal');
        if (modal && !modal.classList.contains('hidden')) {
            if (!modal.contains(e.target) && !e.target.closest('#passenger-summary') && !e.target.closest('[onclick*="togglePassengers"]')) {
                modal.classList.add('hidden');
            }
        }
    });

    // 5. Mode par défaut
    TerraEngine.changeMode('flights'); 
});

window.addEventListener('scroll', function() {
    const header = document.getElementById('mainHeader');
    if (header) {
        header.classList.toggle('nav-scrolled', window.scrollY > 50);
        header.classList.toggle('nav-transparent', window.scrollY <= 50);
    }
});
// Initialisation du Slider Partenaires
const partnerSwiper = new Swiper('.partnerSwiper', {
    slidesPerView: 2,
    spaceBetween: 30,
    loop: true,
    speed: 5000, // Vitesse du défilement
    autoplay: {
        delay: 0,
        disableOnInteraction: false,
    },
    breakpoints: {
        640: { slidesPerView: 3 },
        1024: { slidesPerView: 5 },
    },
    allowTouchMove: false, // On désactive le drag pour garder l'effet fluide
});
 const mainHeader = document.getElementById('mainHeader');
const logo = document.getElementById('logo');
const menuBtn = document.getElementById('menu-btn');
const burgerIcon = document.getElementById('burger-icon');
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.getElementById('navLinks');
const gdsBtn = document.getElementById('gdsBtn');

// 1. Gérer le scroll (Header Transparent -> Blanc)
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        mainHeader.classList.add('bg-white', 'shadow-lg', 'h-20');
        mainHeader.classList.remove('h-24', 'nav-transparent');
        logo.classList.remove('brightness-0', 'invert-[1]'); // Logo devient noir
        burgerIcon.classList.remove('bg-white', 'before:bg-white', 'after:bg-white');
        burgerIcon.classList.add('bg-black', 'before:bg-black', 'after:bg-black');
        navLinks.classList.replace('text-white', 'text-black');
        gdsBtn.classList.replace('border-white', 'border-black');
        gdsBtn.classList.replace('text-white', 'text-black');
    } else {
        mainHeader.classList.remove('bg-white', 'shadow-lg', 'h-20');
        mainHeader.classList.add('h-24', 'nav-transparent');
        logo.classList.add('brightness-0', 'invert-[1]'); // Logo redevient blanc
        burgerIcon.classList.add('bg-white', 'before:bg-white', 'after:bg-white');
        burgerIcon.classList.remove('bg-black', 'before:bg-black', 'after:bg-black');
        navLinks.classList.replace('text-black', 'text-white');
        gdsBtn.classList.replace('border-black', 'border-white');
        gdsBtn.classList.replace('text-black', 'text-white');
    }
});

// 2. Fonction Toggle Menu Mobile
function toggleMenu() {
    const isMenuOpen = mobileMenu.classList.contains('translate-x-full');

    if (isMenuOpen) {
        // OUVERTURE
        mobileMenu.classList.remove('translate-x-full');
        burgerIcon.classList.add('active'); // Devient un X
        document.body.style.overflow = 'hidden';
    } else {
        // FERMETURE
        mobileMenu.classList.add('translate-x-full');
        burgerIcon.classList.remove('active'); // Devient un Burger
        document.body.style.overflow = 'auto';
        
        // Si on est en haut de page, on remet le burger en blanc
        if (window.scrollY <= 50) {
            burgerIcon.classList.add('bg-white', 'before:bg-white', 'after:bg-white');
            burgerIcon.classList.remove('bg-black', 'before:bg-black', 'after:bg-black');
        }
    }
}

menuBtn.addEventListener('click', toggleMenu);