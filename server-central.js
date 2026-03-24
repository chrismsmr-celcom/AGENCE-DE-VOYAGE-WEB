/**
 * TERRA VOYAGE - HUB CENTRAL API (V3.0)
 * Vols : Duffel + Google Flights
 * Hôtels : Lite API
 * Packages, Activités, Voitures, Assurances, Transferts : Supabase
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// --- INITIALISATION DES CLIENTS ---
const duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const LITE_HEADERS = { "X-API-Key": process.env.LITE_API_KEY, "Content-Type": "application/json" };
const RAPID_HEADERS = { 
    'x-rapidapi-key': process.env.RAPIDAPI_KEY, 
    'x-rapidapi-host': 'google-flights-live-api.p.rapidapi.com' 
};

// ==========================================
// 1. VOLS (DUFFEL + GOOGLE)
// ==========================================
app.post('/api/flights/search', async (req, res) => {
    const { origin, destination, departureDate, returnDate, passengers, tripType } = req.body;
    let results = { duffel: [], googleFlights: [] };

    try {
        const slices = [{ origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure_date: departureDate }];
        if (tripType === 'round_trip' && returnDate) {
            slices.push({ origin: destination.toUpperCase(), destination: origin.toUpperCase(), departure_date: returnDate });
        }
        const duffelRes = await duffel.offerRequests.create({
            slices,
            passengers: Array.from({ length: parseInt(passengers) || 1 }, () => ({ type: "adult" })),
            return_offers: true
        });
        results.duffel = duffelRes.data.offers || [];
    } catch (e) { console.error("Erreur Vols Duffel"); }

    try {
        const rapidRes = await axios.post('https://google-flights-live-api.p.rapidapi.com/api/google_flights/oneway/v1', 
        { departure_date: departureDate, from_airport: origin, to_airport: destination }, 
        { headers: RAPID_HEADERS });
        results.googleFlights = rapidRes.data;
    } catch (e) { console.error("Erreur Google Flights"); }

    res.json(results);
});
app.get('/api/locations/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    const { data, error } = await supabase
        .from('air_destinations')
        .select('*')
        // On cherche par Nom, Ville ou Code IATA
        .or(`name.ilike.%${query}%,municipality.ilike.%${query}%,iata_code.ilike.%${query}%`)
        // On priorise les grands aéroports (large_airport) pour plus de pertinence
        .order('type', { ascending: false }) 
        .limit(10);

    res.json(error ? [] : data);
});
// ==========================================
// 2. HÔTELS (LITE API)
// ==========================================
app.post('/api/hotels/search', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    try {
        const response = await axios.post("https://api.liteapi.travel/v3.0/hotels/rates?rm=true", {
            hotelIds: [destinationCode], checkin: checkIn, checkout: checkOut,
            occupancies: [{ adults: parseInt(adults) || 1 }], currency: "USD", guestNationality: "US"
        }, { headers: LITE_HEADERS });
        res.json({ source: "liteapi", hotels: response.data.data || [] });
    } catch (e) { res.status(500).json({ hotels: [], error: "Service Lite API indisponible" }); }
});

// ==========================================
// 3. SERVICES SUPABASE (CONTROLE TOTAL CHRIS)
// ==========================================

// Packages Touristiques
app.get('/api/packages', async (req, res) => {
    const { data, error } = await supabase.from('packages').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// Activités & Excursions
app.get('/api/activities', async (req, res) => {
    const { data, error } = await supabase.from('activities').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// Location de Voitures
app.get('/api/cars', async (req, res) => {
    const { data, error } = await supabase.from('cars').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// Assurances Voyage
app.get('/api/insurance', async (req, res) => {
    const { data, error } = await supabase.from('insurance').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// Transferts (Navettes)
app.get('/api/transfers', async (req, res) => {
    // On peut aussi imaginer une recherche par ville ici
    const { data, error } = await supabase.from('transfers').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// ==========================================
// 4. RÉSERVATIONS & PAIEMENTS
// ==========================================
app.post('/api/checkout', async (req, res) => {
    const { type, details, customer, totalPrice } = req.body;
    try {
        const { data, error } = await supabase.from('bookings').insert([{
            type, // 'flight', 'hotel', 'package', etc.
            details,
            customer_email: customer.email,
            customer_name: customer.name,
            total_price: totalPrice,
            status: 'pending'
        }]).select();
        
        if (error) throw error;
        res.json({ success: true, booking: data[0] });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.get('/', (req, res) => res.send('🌍 TERRA HUB CENTRAL V3.0 - TOUT-EN-UN 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Hub Central opérationnel sur le port ${PORT}`);
});
