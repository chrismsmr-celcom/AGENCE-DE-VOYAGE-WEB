/**
 * TERRA VOYAGE - GDS TERMINAL (CLEAN EDITION)
 * Vols : Duffel + RapidAPI (Flux bruts)
 * Hôtels : Lite API uniquement (Recherche + Réservation)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// --- CONFIGURATIONS ---
const duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
const RAPID_API_KEY = process.env.RAPIDAPI_KEY || "7646ef4d03mshf86c223aa40343dp1daab3jsnd792b7e9f0d7";
const LITE_API_KEY = process.env.LITE_API_KEY || "sand_802ba304-83f9-414e-b9b6-e0c629aaf404";

const LITE_HEADERS = {
    "X-API-Key": LITE_API_KEY,
    "Content-Type": "application/json"
};

// ==========================================
// 1. VOLS : RECHERCHE (FLUX BRUTS)
// ==========================================

app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, passengers, tripType } = req.body;
    let results = { duffel: [], googleFlights: [] };

    // Duffel - On renvoie tout sans filtre
    try {
        const slices = [{
            origin: origin.trim().toUpperCase(),
            destination: destination.trim().toUpperCase(),
            departure_date: departureDate
        }];
        if (tripType === 'round_trip' && returnDate) {
            slices.push({ origin: destination, destination: origin, departure_date: returnDate });
        }
        const duffelRes = await duffel.offerRequests.create({
            slices,
            passengers: Array.from({ length: parseInt(passengers) || 1 }, () => ({ type: "adult" })),
            return_offers: true
        });
        results.duffel = duffelRes.data.offers || [];
    } catch (e) { console.error("Erreur Search Duffel"); }

    // RapidAPI - On renvoie tout sans filtre
    try {
        const rapidRes = await axios.post('https://google-flights-live-api.p.rapidapi.com/api/google_flights/oneway/v1', {
            departure_date: departureDate,
            from_airport: origin,
            to_airport: destination
        }, {
            headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': 'google-flights-live-api.p.rapidapi.com' }
        });
        results.googleFlights = rapidRes.data;
    } catch (e) { console.error("Erreur Search RapidAPI"); }

    res.json(results);
});

// ==========================================
// 2. VOLS : RÉSERVATION (DUFFEL HOLD)
// ==========================================

app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email, phone } = req.body;
    try {
        const offer = await duffel.offers.get(offer_id);
        const duffelPassengers = offer.data.passengers;

        const order = await duffel.orders.create({
            type: "hold", 
            selected_offers: [offer_id],
            passengers: passengers.map((p, index) => ({
                id: duffelPassengers[index].id,
                title: p.title || "mr",
                given_name: p.given_name,
                family_name: p.family_name,
                gender: p.gender || "m",
                born_on: p.born_on,
                email: email,
                phone_number: phone || "+243000000000"
            }))
        });
        res.json({ success: true, data: order.data });
    } catch (error) {
        res.status(400).json({ success: false, details: error.errors });
    }
});

// ==========================================
// 3. HÔTELS : RECHERCHE (LITE API UNIQUEMENT)
// ==========================================

app.post('/search-hotels', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    try {
        const response = await axios.post("https://api.liteapi.travel/v3.0/hotels/rates?rm=true", {
            hotelIds: [destinationCode],
            checkin: checkIn,
            checkout: checkOut,
            occupancies: [{ adults: parseInt(adults) || 1 }],
            currency: "USD",
            guestNationality: "US"
        }, { headers: LITE_HEADERS });

        res.json({ source: "liteapi", hotels: response.data.data || [] });
    } catch (e) {
        console.error("Erreur Lite API Search");
        res.status(500).json({ hotels: [], error: "Service indisponible" });
    }
});

// ==========================================
// 4. HÔTELS : RÉSERVATION (LITE API BOOK)
// ==========================================

app.post('/book-hotel', async (req, res) => {
    // req.body doit contenir : rateId, guestDetails, paymentDetails, etc.
    try {
        console.log("🏨 Tentative de réservation d'hôtel...");
        const response = await axios.post("https://book.liteapi.travel/v3.0/rates/book", req.body, {
            headers: LITE_HEADERS
        });
        
        res.json({ success: true, booking: response.data });
    } catch (error) {
        console.error("❌ Erreur Booking Hôtel:", error.response?.data || error.message);
        res.status(400).json({ 
            success: false, 
            message: "La réservation d'hôtel a échoué",
            details: error.response?.data 
        });
    }
});

// ==========================================
// 5. LANCEMENT
// ==========================================

app.get('/', (req, res) => res.send('🌍 TERRA ENGINE V3 (LITE EDITION) : ONLINE 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});
