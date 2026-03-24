/**
 * TERRA VOYAGE - GDS TERMINAL (FULL EDITION)
 * Vols: Duffel + Google Flights (RapidAPI)
 * Hôtels: Lite API + Hotelbeds
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
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

// --- UTILITAIRE : SIGNATURE HOTELBEDS ---
function getHotelbedsSignature() {
    const timestamp = Math.floor(Date.now() / 1000);
    const apiKey = process.env.HOTELBEDS_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    if (!apiKey || !secret) return null;
    return crypto.createHash('sha256').update(apiKey + secret + timestamp).digest('hex');
}

// ==========================================
// 1. VOLS : RECHERCHE (DUFFEL + RAPIDAPI)
// ==========================================

app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, passengers, tripType } = req.body;
    let results = { duffel: [], googleFlights: [] };

    // Source A : Duffel
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
        results.duffel = duffelRes.data.offers;
    } catch (e) { console.error("Duffel Search Error"); }

    // Source B : RapidAPI (Google Flights)
    try {
        const rapidRes = await axios.post('https://google-flights-live-api.p.rapidapi.com/api/google_flights/oneway/v1', {
            departure_date: departureDate,
            from_airport: origin,
            to_airport: destination
        }, {
            headers: { 'x-rapidapi-key': RAPID_API_KEY, 'x-rapidapi-host': 'google-flights-live-api.p.rapidapi.com' }
        });
        results.googleFlights = rapidRes.data;
    } catch (e) { console.error("RapidAPI Search Error"); }

    res.json(results);
});

// ==========================================
// 2. VOLS : RÉSERVATION (ROUTE MANQUANTE)
// ==========================================

app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email, phone } = req.body;

    try {
        // 1. Récupération de l'offre pour valider les données
        const offer = await duffel.offers.get(offer_id);
        const duffelPassengers = offer.data.passengers;

        // 2. Création de la réservation (Mode HOLD / En attente)
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

        res.json({ 
            success: true, 
            booking_reference: order.data.booking_reference,
            order_id: order.data.id,
            total_amount: order.data.total_amount,
            expires_at: order.data.expires_at // Date limite pour payer
        });

    } catch (error) {
        console.error("❌ ERREUR RÉSERVATION:", JSON.stringify(error.errors || error.message));
        res.status(400).json({ success: false, details: error.errors });
    }
});

// ==========================================
// 3. HÔTELS : RECHERCHE HYBRIDE
// ==========================================

app.post('/search-hotels', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;

    // Priorité Lite API
    try {
        const liteRes = await axios.post("https://api.liteapi.travel/v3.0/hotels/rates?rm=true", {
            hotelIds: [destinationCode],
            checkin: checkIn, checkout: checkOut,
            occupancies: [{ adults: parseInt(adults) || 1 }],
            currency: "USD", guestNationality: "US"
        }, { headers: { "X-API-Key": LITE_API_KEY } });

        if (liteRes.data.data?.length > 0) return res.json({ source: "liteapi", hotels: liteRes.data.data });
    } catch (e) { console.log("Lite API échec..."); }

    // Fallback Hotelbeds
    try {
        const signature = getHotelbedsSignature();
        const hbRes = await axios.post("https://api.test.hotelbeds.com/hotel-booking/1.0/hotels", {
            stay: { checkIn, checkOut },
            occupancies: [{ rooms: 1, adults: parseInt(adults) || 1 }],
            destination: { code: destinationCode }
        }, {
            headers: { "Api-key": process.env.HOTELBEDS_KEY, "X-Signature": signature, "Accept": "application/json" }
        });
        if (hbRes.data.hotels?.hotels) return res.json({ source: "hotelbeds", hotels: hbRes.data.hotels.hotels });
    } catch (e) { console.error("Hotelbeds échec..."); }

    res.json({ hotels: [] });
});

// ==========================================
// 4. LANCEMENT
// ==========================================

app.get('/', (req, res) => res.send('🚀 TERRA ENGINE V3 : ONLINE 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});
