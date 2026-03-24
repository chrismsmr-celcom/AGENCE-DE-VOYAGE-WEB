/**
 * TERRA VOYAGE - HUB CENTRAL API
 * Regroupe : Vols, Hôtels, Packages, Assurances, Voitures, Transferts & Activités.
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

// --- CONFIGURATIONS DES CLIENTS ---
const duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Headers réutilisables
const LITE_HEADERS = { "X-API-Key": process.env.LITE_API_KEY, "Content-Type": "application/json" };
const RAPID_HEADERS = { 
    'x-rapidapi-key': process.env.RAPIDAPI_KEY, 
    'x-rapidapi-host': 'google-flights-live-api.p.rapidapi.com' 
};

// ==========================================
// SECTION 1 : VOLS (Duffel + Google)
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
    } catch (e) { console.error("Err Duffel"); }

    try {
        const rapidRes = await axios.post('https://google-flights-live-api.p.rapidapi.com/api/google_flights/oneway/v1', 
        { departure_date: departureDate, from_airport: origin, to_airport: destination }, 
        { headers: RAPID_HEADERS });
        results.googleFlights = rapidRes.data;
    } catch (e) { console.error("Err RapidAPI"); }

    res.json(results);
});

// ==========================================
// SECTION 2 : HÔTELS (Lite API)
// ==========================================

app.post('/api/hotels/search', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    try {
        const response = await axios.post("https://api.liteapi.travel/v3.0/hotels/rates?rm=true", {
            hotelIds: [destinationCode], checkin: checkIn, checkout: checkOut,
            occupancies: [{ adults: parseInt(adults) || 1 }], currency: "USD", guestNationality: "US"
        }, { headers: LITE_HEADERS });
        res.json({ source: "liteapi", hotels: response.data.data || [] });
    } catch (e) { res.status(500).json({ hotels: [] }); }
});

// ==========================================
// SECTION 3 : PACKAGES & ACTIVITÉS (Supabase)
// ==========================================

app.get('/api/packages', async (req, res) => {
    const { data, error } = await supabase.from('packages').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

app.get('/api/activities', async (req, res) => {
    // Activités : Excursions, visites guidées, etc.
    const { data, error } = await supabase.from('activities').select('*').eq('active', true);
    res.json(error ? { error } : data);
});

// ==========================================
// SECTION 4 : VOITURES & TRANSFERTS
// ==========================================

app.post('/api/cars/search', async (req, res) => {
    // Note : Ici tu peux lier une API comme Skyscanner ou RentalCars via RapidAPI
    res.json({ message: "Recherche de voitures activée", status: "simulate" });
});

app.post('/api/transfers/search', async (req, res) => {
    // Souvent géré via ta table Supabase 'drivers' ou API Mozio
    const { pickup, dropoff } = req.body;
    res.json({ source: "terra-drivers", results: [] });
});

// ==========================================
// SECTION 5 : ASSURANCES
// ==========================================

app.get('/api/insurance/plans', async (req, res) => {
    // Tu peux lister tes plans d'assurance personnalisés ici
    const plans = [
        { id: "basic", name: "Terra Basic", price_pct: 5, coverage: "Santé uniquement" },
        { id: "premium", name: "Terra Premium", price_pct: 12, coverage: "Annulation + Santé + Bagages" }
    ];
    res.json(plans);
});

// ==========================================
// GESTION DES RÉSERVATIONS GÉNÉRALES
// ==========================================

app.post('/api/checkout', async (req, res) => {
    const { type, details, customer } = req.body;
    // Logique universelle pour enregistrer une vente dans Supabase
    const { data, error } = await supabase.from('bookings').insert([{
        type, // 'flight', 'hotel', 'package', etc.
        details,
        customer_email: customer.email,
        status: 'pending_payment'
    }]);
    
    res.json({ success: true, booking_id: data ? data[0].id : null });
});

app.get('/', (req, res) => res.send('🌍 TERRA HUB CENTRAL V1.0 - ONLINE 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Hub Central lancé sur le port ${PORT}`);
});
