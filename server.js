/**
 * TERRA VOYAGE - HUB CENTRAL API (V4.0 - Version Premium avec Duffel Stays)
 * API robuste avec gestion des erreurs, logging et fallbacks
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuration CORS améliorée
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// --- INITIALISATION DES CLIENTS ---
let duffel = null;
let supabase = null;

try {
    duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('✅ Clients API initialisés');
} catch (error) {
    console.error('❌ Erreur initialisation clients:', error.message);
}

// Headers Lite API (fallback)
const LITE_HEADERS = { 
    "X-API-Key": process.env.LITE_API_KEY, 
    "Content-Type": "application/json",
    "Accept": "application/json"
};

// Cache géocodage simple (pour éviter trop d'appels)
const geocodeCache = {};

/**
 * Convertit une ville en coordonnées géographiques (fallback)
 * Utilise une API gratuite de géocodage
 */
async function geocodeCity(cityName) {
    if (!cityName) return null;
    
    // Vérifier le cache
    const cacheKey = cityName.toLowerCase().trim();
    if (geocodeCache[cacheKey]) {
        return geocodeCache[cacheKey];
    }
    
    try {
        // Utiliser l'API Nominatim d'OpenStreetMap (gratuite, pas de clé requise)
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cityName,
                format: 'json',
                limit: 1,
                'accept-language': 'fr'
            },
            timeout: 5000,
            headers: {
                'User-Agent': 'TerraVoyage/1.0'
            }
        });
        
        if (response.data && response.data.length > 0) {
            const coords = {
                latitude: parseFloat(response.data[0].lat),
                longitude: parseFloat(response.data[0].lon)
            };
            geocodeCache[cacheKey] = coords;
            return coords;
        }
        return null;
    } catch (error) {
        console.error('Erreur géocodage:', error.message);
        return null;
    }
}

/**
 * Construit la liste des invités pour Duffel Stays
 */
function buildGuestsList(adults, children) {
    const guests = [];
    const numAdults = parseInt(adults) || 1;
    const numChildren = parseInt(children) || 0;
    
    for (let i = 0; i < numAdults; i++) {
        guests.push({ type: 'adult' });
    }
    for (let i = 0; i < numChildren; i++) {
        guests.push({ type: 'child' });
    }
    
    return guests;
}

// Middleware de logging amélioré
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`📡 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${new Date().toISOString()}`);
    });
    next();
});

// ==========================================
// 1. VOLS (DUFFEL FLIGHTS)
// ==========================================
app.post('/api/flights/search', async (req, res) => {
    const { origin, destination, departureDate, returnDate, adults, children, infants, class: travelClass, tripType } = req.body;

    if (!origin || !destination || !departureDate) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: origin, destination, departureDate requis" 
        });
    }

    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible",
            flights: []
        });
    }

    try {
        const slices = [{ 
            origin: origin.toUpperCase(), 
            destination: destination.toUpperCase(), 
            departure_date: departureDate 
        }];

        if (tripType === 'round_trip' && returnDate) {
            slices.push({ 
                origin: destination.toUpperCase(), 
                destination: origin.toUpperCase(), 
                departure_date: returnDate 
            });
        }

        const passengerList = [];
        const numAdults = parseInt(adults) || 1;
        for (let i = 0; i < numAdults; i++) passengerList.push({ type: "adult" });
        
        const numChildren = parseInt(children) || 0;
        for (let i = 0; i < numChildren; i++) passengerList.push({ type: "child" });
        
        const numInfants = parseInt(infants) || 0;
        for (let i = 0; i < numInfants; i++) passengerList.push({ type: "infant_without_seat" });

        const duffelRes = await duffel.offerRequests.create({
            slices: slices,
            passengers: passengerList,
            return_offers: true,
            cabin_class: travelClass || 'economy'
        });

        console.log(`✅ Vols trouvés pour ${origin}-${destination}: ${duffelRes.data.offers?.length || 0} offres`);
        
        res.json({ 
            success: true,
            source: "duffel_flights",
            flights: duffelRes.data.offers || [],
            slices: duffelRes.data.slices,
            count: duffelRes.data.offers?.length || 0
        });

    } catch (e) { 
        console.error("❌ Erreur Duffel Flights:", e.errors ? JSON.stringify(e.errors) : e.message);
        
        res.json({ 
            success: false,
            source: "duffel_flights",
            flights: [], 
            error: "Aucun vol trouvé pour ces critères",
            details: process.env.NODE_ENV === 'development' ? e.message : null
        });
    }
});
app.get('/api/airline-logo/:code', async (req, res) => {
    const { code } = req.params;
    const iataCode = code.toUpperCase();
    
    if (!supabase) {
        return res.status(503).json({ error: "Service indisponible" });
    }
    
    try {
        // Chercher le logo dans la base
        const { data, error } = await supabase
            .from('airline_logos')
            .select('logo_url, logo_svg')
            .eq('iata_code', iataCode)
            .eq('is_active', true)
            .single();
        
        if (error || !data) {
            // Logo par défaut si non trouvé
            const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40">
                <rect width="60" height="40" fill="#2563eb" rx="4"/>
                <text x="30" y="25" font-size="10" font-family="monospace" text-anchor="middle" fill="white">${iataCode}</text>
            </svg>`;
            
            res.set('Content-Type', 'image/svg+xml');
            return res.send(defaultSvg);
        }
        
        // Si c'est une URL externe, rediriger
        if (data.logo_url && data.logo_url.startsWith('http')) {
            return res.redirect(data.logo_url);
        }
        
        // Sinon, envoyer le SVG
        res.set('Content-Type', 'image/svg+xml');
        res.send(data.logo_svg || data.logo_url);
        
    } catch (error) {
        console.error('Erreur logo:', error);
        // Fallback SVG
        res.set('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40">
            <rect width="60" height="40" fill="#2563eb" rx="4"/>
            <text x="30" y="25" font-size="10" text-anchor="middle" fill="white">${iataCode}</text>
        </svg>`);
    }
});

// Récupérer tous les logos (pour admin)
app.get('/api/airline-logos', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, logos: [] });
    }
    
    try {
        const { data, error } = await supabase
            .from('airline_logos')
            .select('iata_code, name, logo_url, priority')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('name');
        
        res.json({ success: true, logos: data || [] });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Ajouter/modifier un logo (endpoint admin)
app.post('/api/airline-logo', async (req, res) => {
    const { iata_code, name, logo_url, priority } = req.body;
    
    if (!iata_code || !name) {
        return res.status(400).json({ error: "iata_code et name requis" });
    }
    
    try {
        const { data, error } = await supabase
            .from('airline_logos')
            .upsert({
                iata_code: iata_code.toUpperCase(),
                name,
                logo_url,
                priority: priority || 0,
                updated_at: new Date().toISOString()
            })
            .select();
        
        if (error) throw error;
        res.json({ success: true, logo: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// ==========================================
// 2. HÔTELS (Booking.com via RapidAPI + Fallback)
// ==========================================
app.post('/api/stays/search', async (req, res) => {
    const { 
        city, 
        latitude, 
        longitude, 
        checkIn, 
        checkOut, 
        adults, 
        children,
        rooms,
        radius
    } = req.body;

    if (!checkIn || !checkOut) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: checkIn et checkOut requis" 
        });
    }

    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    try {
        // ==========================================
        // 1. ESSAYER BOOKING.COM VIA RAPIDAPI
        // ==========================================
        if (RAPIDAPI_KEY && city) {
            console.log('🔍 Recherche Booking.com via RapidAPI pour:', city);
            
            // Étape 1: Obtenir l'ID de la ville
            const locationRes = await axios.get('https://booking-com.p.rapidapi.com/v1/hotels/locations', {
                params: { 
                    query: city, 
                    locale: 'fr-fr' 
                },
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
                },
                timeout: 8000
            });
            
            if (locationRes.data && locationRes.data.length > 0) {
                const cityId = locationRes.data[0].dest_id;
                const cityType = locationRes.data[0].dest_type;
                
                console.log(`📍 Ville trouvée: ${cityId} (${cityType})`);
                
                // Étape 2: Rechercher les hôtels
                const hotelsRes = await axios.get('https://booking-com.p.rapidapi.com/v1/hotels/search', {
                    params: {
                        dest_id: cityId,
                        dest_type: cityType,
                        checkin_date: checkIn,
                        checkout_date: checkOut,
                        adults: parseInt(adults) || 2,
                        children: parseInt(children) || 0,
                        rooms: rooms || 1,
                        locale: 'fr-fr',
                        order_by: 'price',
                        filter_by_currency: 'EUR',
                        units: 'metric'
                    },
                    headers: {
                        'X-RapidAPI-Key': RAPIDAPI_KEY,
                        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
                    },
                    timeout: 10000
                });
                
                const bookingHotels = (hotelsRes.data.result || []).map(hotel => ({
                    id: hotel.hotel_id?.toString() || `booking_${Date.now()}_${Math.random()}`,
                    name: hotel.hotel_name || 'Hôtel',
                    address: hotel.address || hotel.city_name_en || city,
                    city: hotel.city_name_en || city,
                    country: hotel.countrycode || 'FR',
                    rating: hotel.review_score || 0,
                    review_count: hotel.review_nr || 0,
                    price_per_night: hotel.min_total_price ? Math.round(hotel.min_total_price) : 0,
                    total_price: hotel.min_total_price ? Math.round(hotel.min_total_price) : 0,
                    currency: hotel.currency_code || 'EUR',
                    main_photo: hotel.main_photo_url || null,
                    images: hotel.main_photo_url ? [hotel.main_photo_url] : [],
                    description: hotel.hotel_description || `${hotel.hotel_name} à ${city}`,
                    amenities: hotel.hotel_amenities || [],
                    url: hotel.url,
                    latitude: hotel.latitude,
                    longitude: hotel.longitude
                }));
                
                if (bookingHotels.length > 0) {
                    console.log(`✅ Booking.com: ${bookingHotels.length} hôtels trouvés`);
                    return res.json({ 
                        success: true, 
                        source: "booking_via_rapidapi", 
                        stays: bookingHotels,
                        count: bookingHotels.length
                    });
                }
            }
        }
        
        // ==========================================
        // 2. ESSAYER DUFFEL STAYS
        // ==========================================
        if (duffel) {
            console.log('🔍 Recherche Duffel Stays...');
            
            const searchParams = {
                rooms: rooms || 1,
                check_in_date: checkIn,
                check_out_date: checkOut,
                guests: buildGuestsList(adults, children)
            };
            
            // Ajouter la localisation
            if (latitude && longitude) {
                searchParams.location = {
                    radius: radius || 10,
                    geographic_coordinates: {
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude)
                    }
                };
            } else if (city) {
                const coords = await geocodeCity(city);
                if (coords) {
                    searchParams.location = {
                        radius: radius || 10,
                        geographic_coordinates: coords
                    };
                } else {
                    searchParams.location = {
                        radius: radius || 10,
                        named_location: city
                    };
                }
            } else {
                return res.status(400).json({ 
                    success: false,
                    error: "Paramètres manquants: city ou latitude/longitude requis" 
                });
            }
            
            console.log('🔍 Paramètres Duffel:', JSON.stringify(searchParams, null, 2));
            
            const duffelRes = await duffel.stays.search(searchParams);
            
            if (duffelRes.data && duffelRes.data.length > 0) {
                console.log(`✅ Duffel Stays: ${duffelRes.data.length} hébergements trouvés`);
                return res.json({ 
                    success: true,
                    source: "duffel_stays",
                    stays: duffelRes.data,
                    count: duffelRes.data.length
                });
            }
        }
        
        // ==========================================
        // 3. FALLBACK: DONNÉES DÉMO POUR TEST
        // ==========================================
        console.log('🔄 Aucun résultat des APIs, utilisation de données de démonstration...');
        
        // Données de démonstration pour que le site ne soit pas vide
        const demoHotels = generateDemoHotels(city, checkIn, checkOut, adults);
        
        res.json({ 
            success: true,
            source: "demo_fallback",
            stays: demoHotels,
            count: demoHotels.length,
            fallback: true,
            message: "Affichage d'hôtels de démonstration"
        });
        
    } catch (error) {
        console.error("❌ Erreur recherche hôtels:", error.response?.data || error.message);
        
        // Fallback final: données de démonstration
        const demoHotels = generateDemoHotels(city || 'Paris', checkIn, checkOut, adults);
        
        res.json({ 
            success: true,
            source: "demo_fallback",
            stays: demoHotels,
            count: demoHotels.length,
            fallback: true,
            message: "Service temporairement indisponible, affichage d'hôtels de démonstration"
        });
    }
});

/**
 * Génère des données d'hôtels de démonstration pour le fallback
 */
function generateDemoHotels(city, checkIn, checkOut, adults) {
    const cityName = city || 'Paris';
    const nights = checkIn && checkOut ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)) : 3;
    
    const demoHotels = [
        {
            id: "demo_hotel_1",
            name: `Hôtel Royal ${cityName}`,
            address: `Centre-ville, ${cityName}`,
            city: cityName,
            country: "FR",
            rating: 4.8,
            review_count: 234,
            price_per_night: 189,
            total_price: 189 * nights,
            currency: "EUR",
            main_photo: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400",
            images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400"],
            description: `Magnifique hôtel 5 étoiles au cœur de ${cityName}. Chambres luxueuses avec vue panoramique, spa et restaurant gastronomique.`,
            amenities: ["Wi-Fi gratuit", "Piscine", "Spa", "Restaurant", "Parking"],
            rating_text: "Exceptionnel"
        },
        {
            id: "demo_hotel_2",
            name: `Grand Hôtel ${cityName}`,
            address: `Quartier des affaires, ${cityName}`,
            city: cityName,
            country: "FR",
            rating: 4.5,
            review_count: 567,
            price_per_night: 145,
            total_price: 145 * nights,
            currency: "EUR",
            main_photo: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400",
            images: ["https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400"],
            description: `Hôtel 4 étoiles idéalement situé, à proximité des principales attractions de ${cityName}. Confort moderne et service attentionné.`,
            amenities: ["Wi-Fi gratuit", "Salle de sport", "Room service", "Bar"],
            rating_text: "Très bien"
        },
        {
            id: "demo_hotel_3",
            name: `Résidence ${cityName} Centre`,
            address: `Rue principale, ${cityName}`,
            city: cityName,
            country: "FR",
            rating: 4.2,
            review_count: 892,
            price_per_night: 98,
            total_price: 98 * nights,
            currency: "EUR",
            main_photo: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",
            images: ["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400"],
            description: `Séjour économique au cœur de ${cityName}. Appartements modernes et bien équipés, parfaits pour les familles.`,
            amenities: ["Wi-Fi gratuit", "Kitchenette", "Ascenseur", "Climatisation"],
            rating_text: "Très bien"
        },
        {
            id: "demo_hotel_4",
            name: `Luxe & Spa ${cityName}`,
            address: `Avenue des Champs, ${cityName}`,
            city: cityName,
            country: "FR",
            rating: 4.9,
            review_count: 123,
            price_per_night: 320,
            total_price: 320 * nights,
            currency: "EUR",
            main_photo: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400",
            images: ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400"],
            description: `Hôtel de luxe 5 étoiles avec spa exclusif, piscine intérieure et restaurant étoilé. Séjour d'exception à ${cityName}.`,
            amenities: ["Wi-Fi gratuit", "Spa", "Piscine intérieure", "Restaurant étoilé", "Service voiturier"],
            rating_text: "Exceptionnel"
        },
        {
            id: "demo_hotel_5",
            name: `Le Petit ${cityName}`,
            address: `Quartier historique, ${cityName}`,
            city: cityName,
            country: "FR",
            rating: 4.3,
            review_count: 445,
            price_per_night: 78,
            total_price: 78 * nights,
            currency: "EUR",
            main_photo: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400",
            images: ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400"],
            description: `Hôtel de charme dans le quartier historique de ${cityName}. Ambiance chaleureuse et accueil personnalisé.`,
            amenities: ["Wi-Fi gratuit", "Petit-déjeuner", "Terrasse", "Animaux acceptés"],
            rating_text: "Très bien"
        }
    ];
    
    // Ajouter un hôtel avec le nom de la ville
    return demoHotels;
}
// ==========================================
// 2.5. TRADUCTEUR VILLE → CODE IATA (NOUVEAU !)
// ==========================================

/**
 * Convertit un nom de ville en codes IATA d'aéroports
 * Utilise la table city_iata_mapping de Supabase
 */
app.get('/api/geocode/city-to-iata', async (req, res) => {
    const { city } = req.query;
    
    if (!city || city.length < 2) {
        return res.status(400).json({ 
            success: false, 
            error: "Paramètre 'city' requis" 
        });
    }
    
    if (!supabase) {
        return res.status(503).json({ 
            success: false, 
            error: "Service de géocodage indisponible" 
        });
    }
    
    try {
        // Normaliser le nom de la ville
        const normalizedCity = city.toLowerCase().trim();
        
        // Rechercher dans la base de données
        const { data, error } = await supabase
            .from('city_iata_mapping')
            .select('*')
            .or(`city_name_normalized.ilike.%${normalizedCity}%,city_name.ilike.%${normalizedCity}%`)
            .limit(5);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            // Fallback: utiliser une API externe de géocodage
            console.log(`Ville non trouvée en base, tentative géocodage externe: ${city}`);
            
            try {
                // Utiliser Nominatim (OpenStreetMap) pour obtenir les coordonnées
                const geoResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: {
                        q: city,
                        format: 'json',
                        limit: 1,
                        'accept-language': 'fr'
                    },
                    timeout: 5000,
                    headers: { 'User-Agent': 'TerraVoyage/1.0' }
                });
                
                if (geoResponse.data && geoResponse.data.length > 0) {
                    const location = geoResponse.data[0];
                    
                    // Chercher les aéroports proches via Overpass API
                    const airportsResponse = await axios.get('https://overpass-api.de/api/interpreter', {
                        params: {
                            data: `[out:json];(node["aeroway"="aerodrome"](around:50000,${location.lat},${location.lon}););out;`
                        },
                        timeout: 8000
                    });
                    
                    const airports = airportsResponse.data.elements || [];
                    const iataCodes = [];
                    
                    // Extraire les codes IATA des résultats (simplifié)
                    for (const airport of airports) {
                        if (airport.tags && airport.tags.iata) {
                            iataCodes.push(airport.tags.iata);
                        }
                    }
                    
                    if (iataCodes.length > 0) {
                        return res.json({
                            success: true,
                            source: 'external',
                            city: city,
                            normalized: normalizedCity,
                            coordinates: { lat: location.lat, lon: location.lon },
                            iata_codes: iataCodes,
                            count: iataCodes.length
                        });
                    }
                }
            } catch (geoError) {
                console.error('Erreur géocodage externe:', geoError.message);
            }
            
            return res.json({
                success: false,
                error: "Ville non trouvée",
                city: city
            });
        }
        
        // Formater la réponse
        const result = data[0]; // Prendre le premier résultat (le plus pertinent)
        
        res.json({
            success: true,
            source: 'database',
            city: result.city_name,
            normalized: result.city_name_normalized,
            country: result.country,
            country_code: result.country_code,
            coordinates: { lat: result.latitude, lon: result.longitude },
            iata_codes: result.iata_codes,
            count: result.iata_codes.length,
            is_capital: result.is_capital
        });
        
    } catch (error) {
        console.error("❌ Erreur traducteur ville→IATA:", error);
        res.status(500).json({ 
            success: false, 
            error: "Erreur interne du serveur" 
        });
    }
});

/**
 * Recherche multi-aéroports (recherche sur plusieurs codes IATA)
 */
app.post('/api/flights/search-multi', async (req, res) => {
    const { origin, destination, departureDate, returnDate, adults, children, infants, class: travelClass, tripType } = req.body;
    
    if (!origin || !destination || !departureDate) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants" 
        });
    }
    
    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible",
            flights: []
        });
    }
    
    try {
        // Vérifier si origin est déjà un code IATA ou une ville
        const isOriginIATA = /^[A-Z]{3}$/.test(origin.toUpperCase());
        const isDestIATA = /^[A-Z]{3}$/.test(destination.toUpperCase());
        
        let originCodes = [origin.toUpperCase()];
        let destCodes = [destination.toUpperCase()];
        
        // Si ce n'est pas un code IATA, chercher les codes correspondants
        if (!isOriginIATA) {
            const geoRes = await fetch(`${req.protocol}://${req.get('host')}/api/geocode/city-to-iata?city=${encodeURIComponent(origin)}`);
            const geoData = await geoRes.json();
            if (geoData.success && geoData.iata_codes) {
                originCodes = geoData.iata_codes;
                console.log(`📍 ${origin} → ${originCodes.join(', ')}`);
            }
        }
        
        if (!isDestIATA) {
            const geoRes = await fetch(`${req.protocol}://${req.get('host')}/api/geocode/city-to-iata?city=${encodeURIComponent(destination)}`);
            const geoData = await geoRes.json();
            if (geoData.success && geoData.iata_codes) {
                destCodes = geoData.iata_codes;
                console.log(`📍 ${destination} → ${destCodes.join(', ')}`);
            }
        }
        
        // Lancer les recherches en parallèle pour toutes les combinaisons
        const searchPromises = [];
        
        for (const originCode of originCodes) {
            for (const destCode of destCodes) {
                searchPromises.push(
                    (async () => {
                        try {
                            const slices = [{ 
                                origin: originCode, 
                                destination: destCode, 
                                departure_date: departureDate 
                            }];
                            
                            if (tripType === 'round_trip' && returnDate) {
                                slices.push({ 
                                    origin: destCode, 
                                    destination: originCode, 
                                    departure_date: returnDate 
                                });
                            }
                            
                            const passengerList = [];
                            const numAdults = parseInt(adults) || 1;
                            for (let i = 0; i < numAdults; i++) passengerList.push({ type: "adult" });
                            
                            const numChildren = parseInt(children) || 0;
                            for (let i = 0; i < numChildren; i++) passengerList.push({ type: "child" });
                            
                            const numInfants = parseInt(infants) || 0;
                            for (let i = 0; i < numInfants; i++) passengerList.push({ type: "infant_without_seat" });
                            
                            const result = await duffel.offerRequests.create({
                                slices: slices,
                                passengers: passengerList,
                                return_offers: true,
                                cabin_class: travelClass || 'economy'
                            });
                            
                            return {
                                success: true,
                                origin: originCode,
                                destination: destCode,
                                offers: result.data.offers || []
                            };
                        } catch (error) {
                            return {
                                success: false,
                                origin: originCode,
                                destination: destCode,
                                error: error.message,
                                offers: []
                            };
                        }
                    })()
                );
            }
        }
        
        const results = await Promise.all(searchPromises);
        
        // Combiner tous les résultats
        const allFlights = [];
        for (const result of results) {
            if (result.success && result.offers.length > 0) {
                allFlights.push(...result.offers);
            }
        }
        
        // Trier par prix (optionnel)
        allFlights.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
        
        console.log(`✅ ${allFlights.length} vols trouvés pour ${origin}/${destination}`);
        
        res.json({
            success: true,
            source: "duffel_multi",
            flights: allFlights,
            search_details: {
                origin_codes: originCodes,
                destination_codes: destCodes,
                combinations_tested: results.length
            },
            count: allFlights.length
        });
        
    } catch (error) {
        console.error("❌ Erreur recherche multi-aéroports:", error);
        res.json({ 
            success: false,
            flights: [], 
            error: "Aucun vol trouvé pour ces critères"
        });
    }
});
// ==========================================
// 3. RÉCUPÉRATION DES TARIFS POUR UN HÉBERGEMENT
// ==========================================
app.post('/api/stays/rates', async (req, res) => {
    const { searchResultId } = req.body;
    
    if (!searchResultId) {
        return res.status(400).json({ 
            success: false,
            error: "searchResultId requis" 
        });
    }
    
    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible"
        });
    }
    
    try {
        const rates = await duffel.stays.searchResults.fetchAllRates(searchResultId);
        
        res.json({ 
            success: true,
            source: "duffel_stays",
            rates: rates.data || [],
            count: rates.data?.length || 0
        });
    } catch (e) {
        console.error("❌ Erreur récupération tarifs:", e.message);
        res.json({ 
            success: false,
            rates: [],
            error: e.message
        });
    }
});

// ==========================================
// 4. DEMANDE DE DEVIS POUR UN TARIF
// ==========================================
app.post('/api/stays/quote', async (req, res) => {
    const { rateId } = req.body;
    
    if (!rateId) {
        return res.status(400).json({ 
            success: false,
            error: "rateId requis" 
        });
    }
    
    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible"
        });
    }
    
    try {
        const quote = await duffel.stays.quotes.create(rateId);
        
        res.json({ 
            success: true,
            source: "duffel_stays",
            quote: quote.data
        });
    } catch (e) {
        console.error("❌ Erreur création devis:", e.message);
        res.json({ 
            success: false,
            error: e.message
        });
    }
});

// ==========================================
// 5. CRÉATION DE RÉSERVATION HÔTEL
// ==========================================
app.post('/api/stays/book', async (req, res) => {
    const { quoteId, customer } = req.body;
    
    if (!quoteId || !customer || !customer.email) {
        return res.status(400).json({ 
            success: false,
            error: "quoteId et informations client requis" 
        });
    }
    
    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible"
        });
    }
    
    try {
        const booking = await duffel.stays.bookings.create({
            quote_id: quoteId,
            email: customer.email,
            phone_number: customer.phone,
            guests: customer.guests || []
        });
        
        res.json({ 
            success: true,
            source: "duffel_stays",
            booking: booking.data
        });
    } catch (e) {
        console.error("❌ Erreur réservation:", e.message);
        res.json({ 
            success: false,
            error: e.message
        });
    }
});

// ==========================================
// 6. AUTOCOMPLETE LOCATIONS (Supabase)
// ==========================================
app.get('/api/locations/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    if (!supabase) {
        console.error('Supabase non initialisé');
        return res.json([]);
    }

    try {
        const { data, error } = await supabase
            .from('air_destinations')
            .select('*')
            .or(`name.ilike.%${query}%,municipality.ilike.%${query}%,iata_code.ilike.%${query}%`)
            .order('type', { ascending: false })
            .limit(15);

        if (error) throw error;
        
        const formatted = (data || []).map(item => ({
            id: item.id,
            name: item.name,
            iata_code: item.iata_code || item.code,
            municipality: item.municipality,
            iso_country: item.iso_country,
            type: item.type,
            display_name: `${item.name} (${item.iata_code || item.code}) - ${item.municipality || ''}, ${item.iso_country || ''}`
        }));
        
        res.json(formatted);
    } catch (e) {
        console.error("Erreur autocomplete:", e);
        res.json([]);
    }
});

// ==========================================
// 7. HÔTELS (LITE API - GARDE POUR COMPATIBILITÉ)
// ==========================================
app.post('/api/hotels/search', async (req, res) => {
    const { destination, city, checkIn, checkOut, adults, children } = req.body;
    
    try {
        const response = await axios.post("https://api.liteapi.travel/v3.0/hotels/search", {
            destination: city || destination,
            checkin: checkIn,
            checkout: checkOut || checkIn,
            adults: parseInt(adults) || 1,
            children: parseInt(children) || 0,
            currency: "USD",
            guestNationality: "US"
        }, { 
            headers: LITE_HEADERS,
            timeout: 10000 
        });
        
        res.json({ 
            success: true,
            source: "liteapi",
            hotels: response.data.data || [],
            count: response.data.data?.length || 0
        });
    } catch (e) {
        console.error("Erreur Lite API:", e.message);
        
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('hotels')
                    .select('*')
                    .limit(10);
                    
                res.json({ 
                    success: true,
                    source: "supabase",
                    hotels: error ? [] : data,
                    count: error ? 0 : data?.length || 0
                });
            } catch (fallbackError) {
                res.json({ 
                    success: false,
                    source: "fallback",
                    hotels: [],
                    error: "Service hôtels temporairement indisponible"
                });
            }
        } else {
            res.json({ 
                success: false,
                hotels: [],
                error: "Service hôtels temporairement indisponible"
            });
        }
    }
});

// ==========================================
// 8. PACKAGES (Supabase)
// ==========================================
app.get('/api/packages', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, packages: [], error: "Base de données indisponible" });
    }
    
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });
            
        res.json({ 
            success: true,
            packages: error ? [] : data,
            count: error ? 0 : data?.length || 0
        });
    } catch (e) {
        console.error("Erreur packages:", e);
        res.json({ success: false, packages: [], error: e.message });
    }
});

// ==========================================
// 9. VOITURES (Supabase)
// ==========================================
app.get('/api/cars', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, cars: [], error: "Base de données indisponible" });
    }
    
    try {
        const { data, error } = await supabase
            .from('cars')
            .select('*')
            .eq('active', true)
            .order('price_per_day', { ascending: true });
            
        res.json({ 
            success: true,
            cars: error ? [] : data,
            count: error ? 0 : data?.length || 0
        });
    } catch (e) {
        console.error("Erreur voitures:", e);
        res.json({ success: false, cars: [], error: e.message });
    }
});

// ==========================================
// 10. ACTIVITÉS (Supabase)
// ==========================================
app.get('/api/activities', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, activities: [], error: "Base de données indisponible" });
    }
    
    try {
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('active', true);
            
        res.json({ 
            success: true,
            activities: error ? [] : data,
            count: error ? 0 : data?.length || 0
        });
    } catch (e) {
        console.error("Erreur activités:", e);
        res.json({ success: false, activities: [], error: e.message });
    }
});

// ==========================================
// 11. ASSURANCES (Supabase)
// ==========================================
app.get('/api/insurance', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, insurance: [], error: "Base de données indisponible" });
    }
    
    try {
        const { data, error } = await supabase
            .from('insurance')
            .select('*')
            .eq('active', true);
            
        res.json({ 
            success: true,
            insurance: error ? [] : data,
            count: error ? 0 : data?.length || 0
        });
    } catch (e) {
        console.error("Erreur assurances:", e);
        res.json({ success: false, insurance: [], error: e.message });
    }
});

// ==========================================
// 12. TRANSFERTS (Supabase)
// ==========================================
app.get('/api/transfers', async (req, res) => {
    if (!supabase) {
        return res.json({ success: false, transfers: [], error: "Base de données indisponible" });
    }
    
    try {
        const { data, error } = await supabase
            .from('transfers')
            .select('*')
            .eq('active', true);
            
        res.json({ 
            success: true,
            transfers: error ? [] : data,
            count: error ? 0 : data?.length || 0
        });
    } catch (e) {
        console.error("Erreur transferts:", e);
        res.json({ success: false, transfers: [], error: e.message });
    }
});

// ==========================================
// 13. RÉSERVATIONS (Supabase)
// ==========================================
app.post('/api/checkout', async (req, res) => {
    const { type, details, customer, totalPrice } = req.body;
    
    if (!customer || !customer.email) {
        return res.status(400).json({ 
            success: false, 
            error: "Informations client manquantes" 
        });
    }
    
    if (!supabase) {
        return res.status(503).json({ 
            success: false, 
            error: "Service de réservation temporairement indisponible" 
        });
    }
    
    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([{
                type, 
                details: typeof details === 'string' ? details : JSON.stringify(details),
                customer_email: customer.email,
                customer_name: customer.name || 'Non spécifié',
                total_price: totalPrice,
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            booking: data[0],
            message: "Réservation enregistrée avec succès"
        });
    } catch (e) {
        console.error("Erreur réservation:", e);
        res.status(400).json({ 
            success: false, 
            error: e.message 
        });
    }
});

// ==========================================
// 14. GÉOCODAGE (Helper)
// ==========================================
app.get('/api/geocode', async (req, res) => {
    const { city } = req.query;
    
    if (!city) {
        return res.status(400).json({ success: false, error: "Paramètre city requis" });
    }
    
    try {
        const coords = await geocodeCity(city);
        res.json({ success: true, coordinates: coords });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// 15. STATUT COMPLET
// ==========================================
app.get('/', (req, res) => {
    res.json({
        status: "online",
        version: "4.0",
        timestamp: new Date().toISOString(),
        message: "🌍 TERRA HUB CENTRAL - API Voyage Premium avec Duffel Stays",
        services: {
            duffel_flights: !!duffel,
            duffel_stays: !!duffel,
            supabase: !!supabase,
            lite: !!process.env.LITE_API_KEY
        }
    });
});

app.get('/api/health', async (req, res) => {
    const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            duffel: { available: !!duffel, status: duffel ? 'ready' : 'not_configured' },
            duffel_stays: { available: !!duffel, status: duffel ? 'ready' : 'not_configured' },
            supabase: { available: !!supabase, status: supabase ? 'ready' : 'not_configured' },
            lite: { available: !!process.env.LITE_API_KEY, status: process.env.LITE_API_KEY ? 'configured' : 'missing' }
        }
    };
    
    if (supabase) {
        try {
            const { error } = await supabase.from('air_destinations').select('count').limit(1);
            health.services.supabase.connected = !error;
            health.services.supabase.status = !error ? 'connected' : 'error';
        } catch (e) {
            health.services.supabase.connected = false;
            health.services.supabase.status = 'error';
        }
    }
    
    res.json(health);
});

// ==========================================
// 16. ENDPOINT DE TEST
// ==========================================
app.get('/api/test', (req, res) => {
    res.json({
        message: "API Terra Voyage fonctionnelle avec Duffel Stays",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==========================================
// GESTION DES ERREURS
// ==========================================
app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: "Endpoint non trouvé",
        path: req.path 
    });
});

app.use((err, req, res, next) => {
    console.error("❌ Erreur serveur:", err);
    res.status(500).json({ 
        success: false,
        error: "Erreur interne du serveur",
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==========================================
// DÉMARRAGE
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     🌍 TERRA HUB CENTRAL V4.0 - API Voyage Premium           ║
║                   avec Duffel Stays                          ║
╠═══════════════════════════════════════════════════════════════╣
║  📡 Port: ${PORT}                                               ║
║  🚀 Status: Opérationnel                                       ║
║  📦 Services:                                                  ║
║     - Duffel Flights: ${duffel ? '✅' : '❌'}                                        ║
║     - Duffel Stays: ${duffel ? '✅' : '❌'}                                          ║
║     - Supabase: ${supabase ? '✅' : '❌'}                                           ║
║     - Lite API (fallback): ${process.env.LITE_API_KEY ? '✅' : '❌'}                             ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Arrêt du serveur...');
    process.exit(0);
});
