/**
 * TERRA VOYAGE - FLIGHT ENGINE
 * Vols : Duffel + RapidAPI (Flux bruts)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT_FLIGHTS || 10001; // Port différent pour éviter les conflits

app.use(cors());
app.use(express.json());

const duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
const RAPID_API_KEY = process.env.RAPIDAPI_KEY || "7646ef4d03mshf86c223aa40343dp1daab3jsnd792b7e9f0d7";

// --- RECHERCHE VOLS ---
app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, passengers, tripType } = req.body;
    let results = { duffel: [], googleFlights: [] };

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

// --- RÉSERVATION VOLS ---
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

app.listen(PORT, '0.0.0.0', () => console.log(`✈️  Flight Engine prêt sur le port ${PORT}`));