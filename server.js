require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); // Pour la signature Hotelbeds
const { Duffel } = require('@duffel/api');

const app = express();
const PORT = process.env.PORT || 3000; // Dynamique pour Render

// Initialisation Duffel
const duffel = new Duffel({
    token: process.env.DUFFEL_ACCESS_TOKEN 
});

app.use(cors());
app.use(express.json());

// --- UTILITAIRE : SIGNATURE HOTELBEDS ---
function getHotelbedsSignature() {
    const timestamp = Math.floor(Date.now() / 1000);
    const data = process.env.HOTELBEDS_API_KEY + process.env.HOTELBEDS_SECRET + timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
}

// --- RECHERCHE DE VOLS (DUFFEL) ---
app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, cabinClass, passengers, tripType } = req.body;
    try {
        const slices = [{
            origin: origin.trim().toUpperCase(),
            destination: destination.trim().toUpperCase(),
            departure_date: departureDate
        }];

        if (tripType === 'round_trip' && returnDate) {
            slices.push({
                origin: destination.trim().toUpperCase(),
                destination: origin.trim().toUpperCase(),
                departure_date: returnDate
            });
        }

        const offerRequest = await duffel.offerRequests.create({
            slices: slices,
            passengers: Array.from({ length: parseInt(passengers) || 1 }, () => ({ type: "adult" })),
            cabin_class: cabinClass,
            return_offers: true
        });

        console.log(`[GDS-FLIGHTS] ${offerRequest.data.offers.length} offres trouvées.`);
        res.json({ offers: offerRequest.data?.offers || [] });
    } catch (error) {
        console.error("❌ ERREUR DUFFEL:", error.message);
        res.status(400).json({ error: error.message });
    }
});

// --- RECHERCHE D'HÔTELS (HOTELBEDS) ---
app.post('/search-hotels', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    const signature = getHotelbedsSignature();

    try {
        const response = await fetch("https://api.test.hotelbeds.com/hotel-booking/1.0/hotels", {
            method: "POST",
            headers: {
                "Api-key": process.env.HOTELBEDS_API_KEY,
                "X-Signature": signature,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                stay: { checkIn, checkOut },
                occupancies: [{ rooms: 1, adults: parseInt(adults) || 1, children: 0 }],
                destination: { code: destinationCode.toUpperCase() } 
            })
        });

        const data = await response.json();
        console.log(`[GDS-HOTELS] Recherche effectuée pour ${destinationCode}`);
        res.json(data);
    } catch (error) {
        console.error("❌ ERREUR HOTELBEDS:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- RÉSERVATION DE VOL (BOOKING) ---
app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email } = req.body;
    try {
        const offer = await duffel.offers.get(offer_id);
        const gdsPassengerIds = offer.data.passengers.map(p => p.id);

        const order = await duffel.orders.create({
            type: "instant",
            selected_offers: [offer_id],
            passengers: passengers.map((p, index) => ({
                id: gdsPassengerIds[index], 
                type: "adult",
                given_name: p.first_name,
                family_name: p.last_name,
                gender: p.gender === 'm' ? 'm' : 'f',
                born_on: p.born_on,
                title: p.gender === 'm' ? 'mr' : 'ms',
                email: email,
                phone_number: "+33612345678"
            })),
            payments: [{
                type: "balance",
                currency: offer.data.total_currency,
                amount: offer.data.total_amount
            }]
        });

        res.json({ success: true, booking_reference: order.data.booking_reference });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('TERMINAL GDS TERRA VOYAGE : MULTI-PROVIDER ONLINE 🟢');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Terminal running on port ${PORT}`);
});
