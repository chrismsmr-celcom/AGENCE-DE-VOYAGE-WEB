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

// ==========================================
// 2. HÔTELS (DUFFEL STAYS - NOUVEAU !)
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

    if (!duffel) {
        return res.status(503).json({ 
            success: false,
            error: "Service Duffel non disponible",
            stays: []
        });
    }

    try {
        // Préparer les paramètres de recherche
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
            // Convertir la ville en coordonnées
            const coords = await geocodeCity(city);
            if (coords) {
                searchParams.location = {
                    radius: radius || 10,
                    geographic_coordinates: coords
                };
            } else {
                // Fallback : recherche par nom de ville (si supporté par Duffel)
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

        console.log('🔍 Recherche Duffel Stays:', JSON.stringify(searchParams, null, 2));
        
        const duffelRes = await duffel.stays.search(searchParams);

        console.log(`✅ Hébergements trouvés: ${duffelRes.data?.length || 0} propriétés`);
        
        res.json({ 
            success: true,
            source: "duffel_stays",
            stays: duffelRes.data || [],
            count: duffelRes.data?.length || 0
        });

    } catch (e) { 
        console.error("❌ Erreur Duffel Stays:", e.errors ? JSON.stringify(e.errors) : e.message);
        
        // Fallback vers Lite API si Duffel Stays échoue
        console.log('🔄 Fallback vers Lite API...');
        try {
            const fallbackRes = await axios.post("https://api.liteapi.travel/v3.0/hotels/search", {
                destination: city,
                checkin: checkIn,
                checkout: checkOut,
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
                source: "liteapi_fallback",
                stays: fallbackRes.data.data || [],
                count: fallbackRes.data.data?.length || 0,
                fallback: true
            });
        } catch (fallbackError) {
            res.json({ 
                success: false,
                source: "duffel_stays",
                stays: [], 
                error: "Aucun hébergement trouvé pour ces critères",
                details: process.env.NODE_ENV === 'development' ? e.message : null
            });
        }
    }
});
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
