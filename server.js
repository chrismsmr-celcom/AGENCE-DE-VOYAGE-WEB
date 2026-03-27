/**
 * TERRA VOYAGE - HUB CENTRAL API (V5.0 - Version Premium avec Amadeus)
 * API robuste avec Amadeus (principal) + Duffel (fallback)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialisation Amadeus
const Amadeus = require('amadeus');

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
let amadeus = null;

try {
    duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Initialisation Amadeus
    if (process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET) {
        amadeus = new Amadeus({
            clientId: process.env.AMADEUS_API_KEY,
            clientSecret: process.env.AMADEUS_API_SECRET
        });
        console.log('✅ Amadeus API initialisé');
    } else {
        console.warn('⚠️ Amadeus credentials manquantes');
    }
    
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

// Cache géocodage simple
const geocodeCache = {};

/**
 * Convertit une ville en coordonnées géographiques
 */
async function geocodeCity(cityName) {
    if (!cityName) return null;
    
    const cacheKey = cityName.toLowerCase().trim();
    if (geocodeCache[cacheKey]) {
        return geocodeCache[cacheKey];
    }
    
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cityName,
                format: 'json',
                limit: 1,
                'accept-language': 'fr'
            },
            timeout: 5000,
            headers: { 'User-Agent': 'TerraVoyage/1.0' }
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
 * Convertit une ville en code IATA Amadeus
 */
async function getCityCode(cityName) {
    if (!amadeus) return cityName;
    
    try {
        const response = await amadeus.referenceData.locations.get({
            keyword: cityName,
            subType: 'CITY'
        });
        
        if (response.data && response.data.length > 0) {
            return response.data[0].iataCode;
        }
        return cityName.toUpperCase();
    } catch (error) {
        console.error('Erreur récupération code ville:', error.message);
        return cityName.toUpperCase();
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

// Middleware de logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`📡 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${new Date().toISOString()}`);
    });
    next();
});

// ==========================================
// 1. VOLS (Amadeus principal + Duffel fallback)
// ==========================================
app.post('/api/flights/search', async (req, res) => {
    const { origin, destination, departureDate, returnDate, adults, children, infants, class: travelClass, tripType } = req.body;

    if (!origin || !destination || !departureDate) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: origin, destination, departureDate requis" 
        });
    }

    // === TRADUCTION DES VILLES EN CODES IATA ===
    const originCodes = await getAirportCodes(origin);
    const destCodes = await getAirportCodes(destination);
    
    console.log(`📍 Traduction: ${origin} → ${originCodes.join(', ')}`);
    console.log(`📍 Traduction: ${destination} → ${destCodes.join(', ')}`);
    
    let allFlights = [];
    
    // 1. ESSAYER AMADEUS POUR CHAQUE COMBINAISON
    if (amadeus) {
        for (const originCode of originCodes) {
            for (const destCode of destCodes) {
                try {
                    console.log(`🔍 Recherche Amadeus: ${originCode} → ${destCode}`);
                    
                    const amadeusParams = {
                        originLocationCode: originCode,
                        destinationLocationCode: destCode,
                        departureDate: departureDate,
                        adults: parseInt(adults) || 1,
                        max: 50
                    };
                    
                    if (tripType === 'round_trip' && returnDate) {
                        amadeusParams.returnDate = returnDate;
                    }
                    
                    if (travelClass) {
                        const classMap = {
                            economy: 'ECONOMY',
                            premium_economy: 'PREMIUM_ECONOMY',
                            business: 'BUSINESS',
                            first: 'FIRST'
                        };
                        amadeusParams.travelClass = classMap[travelClass] || 'ECONOMY';
                    }
                    
                    const amadeusResponse = await amadeus.shopping.flightOffersSearch.get(amadeusParams);
                    
                    if (amadeusResponse.data && amadeusResponse.data.length > 0) {
                        console.log(`✅ Amadeus: ${amadeusResponse.data.length} vols trouvés pour ${originCode}→${destCode}`);
                        allFlights.push(...amadeusResponse.data);
                    }
                    
                } catch (error) {
                    console.error(`❌ Erreur Amadeus pour ${originCode}→${destCode}:`, error.message);
                }
            }
        }
    }
    
    // Si Amadeus a trouvé des résultats, les retourner
    if (allFlights.length > 0) {
        console.log(`✅ Total Amadeus: ${allFlights.length} vols trouvés`);
        return res.json({ 
            success: true, 
            source: "amadeus",
            flights: allFlights,
            count: allFlights.length,
            search_details: {
                origin_codes: originCodes,
                destination_codes: destCodes
            }
        });
    }
    
    // 2. FALLBACK VERS DUFFEL
    if (duffel) {
        try {
            console.log('🔄 Fallback vers Duffel Flights...');
            
            // Duffel accepte les codes IATA, on prend le premier de chaque liste
            const originCode = originCodes[0] || origin.toUpperCase();
            const destCode = destCodes[0] || destination.toUpperCase();
            
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
            
            const duffelRes = await duffel.offerRequests.create({
                slices: slices,
                passengers: passengerList,
                return_offers: true,
                cabin_class: travelClass || 'economy'
            });
            
            console.log(`✅ Duffel: ${duffelRes.data.offers?.length || 0} vols trouvés`);
            
            return res.json({ 
                success: true,
                source: "duffel_fallback",
                flights: duffelRes.data.offers || [],
                count: duffelRes.data.offers?.length || 0
            });
            
        } catch (duffelError) {
            console.error('❌ Erreur Duffel:', duffelError.message);
        }
    }
    
    return res.json({ 
        success: false, 
        flights: [], 
        error: "Aucun vol trouvé" 
    });
});
// ==========================================
// 2. HÔTELS (Amadeus principal + fallback)
// ==========================================
app.post('/api/hotels/search', async (req, res) => {
    const { city, checkIn, checkOut, adults, children } = req.body;
    
    if (!city || !checkIn || !checkOut) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: city, checkIn, checkOut requis" 
        });
    }
    
    // 1. ESSAYER AMADEUS
    if (amadeus) {
        try {
            console.log(`🔍 Recherche Amadeus Hotels pour: ${city}`);
            
            // Chercher le code de la ville
            const cityCode = await getCityCode(city);
            console.log(`📍 Code ville Amadeus: ${cityCode}`);
            
            const amadeusResponse = await amadeus.shopping.hotelOffers.get({
                cityCode: cityCode,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                adults: parseInt(adults) || 1,
                roomQuantity: 1
            });
            
            if (amadeusResponse.data && amadeusResponse.data.length > 0) {
                const hotels = amadeusResponse.data.map(hotel => ({
                    id: hotel.hotel.hotelId,
                    name: hotel.hotel.name,
                    address: hotel.hotel.address?.lines?.join(', ') || city,
                    city: city,
                    rating: hotel.hotel.rating || 0,
                    price_per_night: hotel.offers[0]?.price?.total || 0,
                    currency: hotel.offers[0]?.price?.currency || 'EUR',
                    main_photo: hotel.hotel.media?.[0]?.uri || null,
                    amenities: hotel.offers[0]?.room?.amenities || [],
                    description: hotel.hotel.description?.text || `Séjour à ${city}`
                }));
                
                console.log(`✅ Amadeus Hotels: ${hotels.length} hôtels trouvés`);
                return res.json({ 
                    success: true, 
                    source: "amadeus",
                    hotels: hotels,
                    count: hotels.length
                });
            }
            
        } catch (error) {
            console.error('❌ Erreur Amadeus Hotels:', error.message);
        }
    }
    
    // 2. FALLBACK VERS BOOKING.COM
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    if (RAPIDAPI_KEY) {
        try {
            console.log('🔄 Fallback vers Booking.com...');
            
            const locationRes = await axios.get('https://booking-com.p.rapidapi.com/v1/hotels/locations', {
                params: { query: city, locale: 'fr-fr' },
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
                },
                timeout: 8000
            });
            
            if (locationRes.data && locationRes.data.length > 0) {
                const cityId = locationRes.data[0].dest_id;
                const cityType = locationRes.data[0].dest_type;
                
                const hotelsRes = await axios.get('https://booking-com.p.rapidapi.com/v1/hotels/search', {
                    params: {
                        dest_id: cityId,
                        dest_type: cityType,
                        checkin_date: checkIn,
                        checkout_date: checkOut,
                        adults: parseInt(adults) || 2,
                        children: parseInt(children) || 0,
                        rooms: 1,
                        locale: 'fr-fr',
                        order_by: 'price'
                    },
                    headers: {
                        'X-RapidAPI-Key': RAPIDAPI_KEY,
                        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
                    },
                    timeout: 10000
                });
                
                const bookingHotels = (hotelsRes.data.result || []).map(hotel => ({
                    id: hotel.hotel_id?.toString(),
                    name: hotel.hotel_name || 'Hôtel',
                    address: hotel.address || city,
                    city: city,
                    rating: hotel.review_score || 0,
                    price_per_night: hotel.min_total_price ? Math.round(hotel.min_total_price) : 0,
                    currency: hotel.currency_code || 'EUR',
                    main_photo: hotel.main_photo_url,
                    amenities: hotel.hotel_amenities || []
                }));
                
                if (bookingHotels.length > 0) {
                    console.log(`✅ Booking.com: ${bookingHotels.length} hôtels trouvés`);
                    return res.json({ 
                        success: true, 
                        source: "booking_fallback",
                        hotels: bookingHotels,
                        count: bookingHotels.length
                    });
                }
            }
        } catch (error) {
            console.error('❌ Erreur Booking.com:', error.message);
        }
    }
    
    return res.json({ 
        success: false, 
        hotels: [], 
        error: "Aucun hôtel trouvé" 
    });
});

// ==========================================
// 3. VOITURES (Amadeus Car Rentals)
// ==========================================
app.post('/api/cars/search', async (req, res) => {
    const { location, pickUpDate, dropOffDate } = req.body;
    
    if (!location || !pickUpDate) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: location, pickUpDate requis" 
        });
    }
    
    if (!amadeus) {
        return res.json({ 
            success: false, 
            cars: [], 
            error: "Service Amadeus non disponible" 
        });
    }
    
    try {
        console.log(`🔍 Recherche Amadeus Cars pour: ${location}`);
        
        const locationCode = await getCityCode(location);
        
        const response = await amadeus.shopping.carRentals.get({
            pickUpLocationCode: locationCode,
            pickUpDateTime: pickUpDate,
            dropOffDateTime: dropOffDate || pickUpDate
        });
        
        const cars = (response.data || []).map(car => ({
            id: car.id,
            name: `${car.vehicle?.make || ''} ${car.vehicle?.model || ''}`.trim() || 'Véhicule',
            type: car.vehicle?.category || 'Berline',
            transmission: car.vehicle?.transmission || 'Automatique',
            seats: car.vehicle?.passengerCapacity || 5,
            price_per_day: car.rental_fees?.total?.amount || 0,
            currency: car.rental_fees?.total?.currency || 'EUR',
            location: car.pickUpLocation?.address || location,
            image: car.vehicle?.pictureUri || null
        }));
        
        console.log(`✅ Amadeus Cars: ${cars.length} véhicules trouvés`);
        
        res.json({ 
            success: true, 
            source: "amadeus",
            cars: cars,
            count: cars.length
        });
        
    } catch (error) {
        console.error('❌ Erreur Amadeus Cars:', error.message);
        res.json({ 
            success: false, 
            cars: [], 
            error: error.message 
        });
    }
});

// ==========================================
// 4. ACTIVITÉS (Amadeus Tourisme)
// ==========================================
app.post('/api/activities/search', async (req, res) => {
    const { city, latitude, longitude, radius } = req.body;
    
    if (!city && (!latitude || !longitude)) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: city ou latitude/longitude requis" 
        });
    }
    
    if (!amadeus) {
        return res.json({ 
            success: false, 
            activities: [], 
            error: "Service Amadeus non disponible" 
        });
    }
    
    try {
        let lat = latitude;
        let lon = longitude;
        
        if (city && !lat) {
            const coords = await geocodeCity(city);
            if (coords) {
                lat = coords.latitude;
                lon = coords.longitude;
            }
        }
        
        if (!lat || !lon) {
            return res.json({ success: false, activities: [], error: "Coordonnées non trouvées" });
        }
        
        console.log(`🔍 Recherche Amadeus Activities autour de ${lat}, ${lon}`);
        
        const response = await amadeus.shopping.activities.get({
            latitude: lat,
            longitude: lon,
            radius: radius || 10
        });
        
        const activities = (response.data || []).map(activity => ({
            id: activity.id,
            name: activity.name,
            description: activity.shortDescription || activity.description,
            price: activity.price?.amount || 0,
            currency: activity.price?.currencyCode || 'EUR',
            duration: activity.duration,
            rating: activity.rating,
            images: activity.pictures || [],
            location: {
                latitude: activity.geoCode?.latitude,
                longitude: activity.geoCode?.longitude
            },
            bookingLink: activity.bookingLink
        }));
        
        console.log(`✅ Amadeus Activities: ${activities.length} activités trouvées`);
        
        res.json({ 
            success: true, 
            source: "amadeus",
            activities: activities,
            count: activities.length
        });
        
    } catch (error) {
        console.error('❌ Erreur Amadeus Activities:', error.message);
        res.json({ 
            success: false, 
            activities: [], 
            error: error.message 
        });
    }
});

// ==========================================
// 5. TRAIN (Amadeus Rail - Europe)
// ==========================================
app.post('/api/train/search', async (req, res) => {
    const { origin, destination, date, adults } = req.body;
    
    if (!origin || !destination || !date) {
        return res.status(400).json({ 
            success: false,
            error: "Paramètres manquants: origin, destination, date requis" 
        });
    }
    
    if (!amadeus) {
        return res.json({ 
            success: false, 
            trains: [], 
            error: "Service Amadeus non disponible" 
        });
    }
    
    try {
        console.log(`🔍 Recherche Amadeus Rail de ${origin} à ${destination}`);
        
        const originCode = await getCityCode(origin);
        const destCode = await getCityCode(destination);
        
        const response = await amadeus.shopping.trainOffers.get({
            originStationCode: originCode,
            destinationStationCode: destCode,
            departureDateTime: date,
            adults: parseInt(adults) || 1
        });
        
        const trains = (response.data || []).map(train => ({
            id: train.id,
            operator: train.operator?.name || 'Train',
            origin: train.origin?.stationName || origin,
            destination: train.destination?.stationName || destination,
            departureTime: train.departureDateTime,
            arrivalTime: train.arrivalDateTime,
            duration: train.duration,
            price: train.price?.total || 0,
            currency: train.price?.currency || 'EUR',
            class: train.class
        }));
        
        console.log(`✅ Amadeus Rail: ${trains.length} trains trouvés`);
        
        res.json({ 
            success: true, 
            source: "amadeus",
            trains: trains,
            count: trains.length
        });
        
    } catch (error) {
        console.error('❌ Erreur Amadeus Rail:', error.message);
        res.json({ 
            success: false, 
            trains: [], 
            error: error.message 
        });
    }
});

// ==========================================
// 6. AUTOCOMPLETE LOCATIONS (Amadeus + Supabase)
// ==========================================
app.get('/api/locations/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);
    
    let results = [];
    
    // Essayer Amadeus d'abord
    if (amadeus) {
        try {
            const response = await amadeus.referenceData.locations.get({
                keyword: query,
                subType: 'CITY,AIRPORT',
                'page[limit]': 10
            });
            
            if (response.data) {
                results = response.data.map(loc => ({
                    id: loc.id,
                    name: loc.name,
                    iata_code: loc.iataCode,
                    municipality: loc.address?.cityName,
                    iso_country: loc.address?.countryCode,
                    type: loc.subType.toLowerCase(),
                    display_name: `${loc.name} (${loc.iataCode}) - ${loc.address?.cityName || ''}, ${loc.address?.countryCode || ''}`
                }));
            }
        } catch (error) {
            console.error('Erreur Amadeus locations:', error.message);
        }
    }
    
    // Fallback Supabase si pas de résultats
    if (results.length === 0 && supabase) {
        try {
            const { data, error } = await supabase
                .from('air_destinations')
                .select('*')
                .or(`name.ilike.%${query}%,municipality.ilike.%${query}%,iata_code.ilike.%${query}%`)
                .order('type', { ascending: false })
                .limit(15);
            
            if (!error && data) {
                results = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    iata_code: item.iata_code || item.code,
                    municipality: item.municipality,
                    iso_country: item.iso_country,
                    type: item.type,
                    display_name: `${item.name} (${item.iata_code || item.code}) - ${item.municipality || ''}, ${item.iso_country || ''}`
                }));
            }
        } catch (e) {
            console.error("Erreur autocomplete Supabase:", e);
        }
    }
    
    res.json(results);
});
// ==========================================
// TRADUCTION VILLE → CODE IATA (via Supabase)
// ==========================================
async function getAirportCodes(cityName) {
    if (!cityName) return [cityName];
    
    const normalizedCity = cityName.toLowerCase().trim();
    
    // Vérifier si c'est déjà un code IATA (3 lettres majuscules)
    if (/^[A-Z]{3}$/.test(cityName.toUpperCase())) {
        return [cityName.toUpperCase()];
    }
    
    // Chercher dans Supabase
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('city_iata_mapping')
                .select('iata_codes')
                .ilike('city_name_normalized', `%${normalizedCity}%`)
                .limit(1);
            
            if (!error && data && data.length > 0 && data[0].iata_codes) {
                console.log(`📍 Traduction: ${cityName} → ${data[0].iata_codes.join(', ')}`);
                return data[0].iata_codes;
            }
        } catch (e) {
            console.error('Erreur recherche ville:', e);
        }
    }
    
    // Fallback: essayer de trouver un aéroport par le nom
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('air_destinations')
                .select('iata_code')
                .ilike('municipality', `%${normalizedCity}%`)
                .ilike('type', 'airport')
                .limit(3);
            
            if (!error && data && data.length > 0) {
                const codes = data.map(d => d.iata_code).filter(c => c);
                if (codes.length > 0) {
                    console.log(`📍 Traduction (aéroport): ${cityName} → ${codes.join(', ')}`);
                    return codes;
                }
            }
        } catch (e) {
            console.error('Erreur recherche aéroport:', e);
        }
    }
    
    return [cityName.toUpperCase()];
}
// ==========================================
// 7. AIRLINE LOGOS (Supabase)
// ==========================================
app.get('/api/airline-logo/:code', async (req, res) => {
    const { code } = req.params;
    const iataCode = code.toUpperCase();
    
    if (!supabase) {
        const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40">
            <rect width="60" height="40" fill="#2563eb" rx="4"/>
            <text x="30" y="25" font-size="10" font-family="monospace" text-anchor="middle" fill="white">${iataCode}</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(defaultSvg);
    }
    
    try {
        const { data, error } = await supabase
            .from('airline_logos')
            .select('logo_url, logo_svg')
            .eq('iata_code', iataCode)
            .eq('is_active', true)
            .single();
        
        if (error || !data) {
            const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40">
                <rect width="60" height="40" fill="#2563eb" rx="4"/>
                <text x="30" y="25" font-size="10" font-family="monospace" text-anchor="middle" fill="white">${iataCode}</text>
            </svg>`;
            res.set('Content-Type', 'image/svg+xml');
            return res.send(defaultSvg);
        }
        
        if (data.logo_url && data.logo_url.startsWith('http')) {
            return res.redirect(data.logo_url);
        }
        
        res.set('Content-Type', 'image/svg+xml');
        res.send(data.logo_svg || data.logo_url);
        
    } catch (error) {
        console.error('Erreur logo:', error);
        res.set('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 60 40">
            <rect width="60" height="40" fill="#2563eb" rx="4"/>
            <text x="30" y="25" font-size="10" text-anchor="middle" fill="white">${iataCode}</text>
        </svg>`);
    }
});

// ==========================================
// 8. RÉSERVATIONS (Supabase)
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
// 9. STATUT COMPLET
// ==========================================
app.get('/', (req, res) => {
    res.json({
        status: "online",
        version: "5.0",
        timestamp: new Date().toISOString(),
        message: "🌍 TERRA HUB CENTRAL - API Voyage Premium avec Amadeus",
        services: {
            amadeus: !!amadeus,
            duffel: !!duffel,
            supabase: !!supabase
        }
    });
});

app.get('/api/health', async (req, res) => {
    const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            amadeus: { available: !!amadeus, status: amadeus ? 'ready' : 'not_configured' },
            duffel: { available: !!duffel, status: duffel ? 'ready' : 'not_configured' },
            supabase: { available: !!supabase, status: supabase ? 'ready' : 'not_configured' }
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
║     🌍 TERRA HUB CENTRAL V5.0 - API Voyage Premium           ║
║                      avec Amadeus                            ║
╠═══════════════════════════════════════════════════════════════╣
║  📡 Port: ${PORT}                                               ║
║  🚀 Status: Opérationnel                                       ║
║  📦 Services:                                                  ║
║     - Amadeus: ${amadeus ? '✅' : '❌'}                                         ║
║     - Duffel (fallback): ${duffel ? '✅' : '❌'}                                   ║
║     - Supabase: ${supabase ? '✅' : '❌'}                                           ║
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
