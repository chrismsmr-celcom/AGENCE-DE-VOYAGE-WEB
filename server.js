require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Duffel } = require('@duffel/api');

const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- INITIALISATION DUFFEL ---
const duffelToken = process.env.DUFFEL_TOKEN || process.env.DUFFEL_ACCESS_TOKEN;

if (!duffelToken) {
    console.error("❌ ERREUR : Token Duffel manquant !");
}

const duffel = new Duffel({
    token: duffelToken || ""
});

// --- UTILITAIRE : SIGNATURE HOTELBEDS ---
function getHotelbedsSignature() {
    const timestamp = Math.floor(Date.now() / 1000);
    const data = process.env.HOTELBEDS_API_KEY + process.env.HOTELBEDS_SECRET + timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
}

// --- RECHERCHE DE VOLS ---
app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, cabinClass, passengers, tripType } = req.body;

    if (!origin || !destination || !departureDate) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

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
            cabin_class: cabinClass || "economy",
            return_offers: true
        });

        res.json({ offers: offerRequest.data.offers || [] });

    } catch (error) {
        console.error("❌ ERREUR DUFFEL:", error.message);
        res.status(400).json({ error: "Erreur Duffel", details: error.errors || error.message });
    }
});

// --- RECHERCHE D'HÔTELS ---
app.post('/search-hotels', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    
    if (!destinationCode || !checkIn || !checkOut) {
        return res.status(400).json({ error: "Dates ou destination (Code IATA) manquantes" });
    }

    const signature = getHotelbedsSignature();

    try {
        const response = await fetch("https://api.test.hotelbeds.com/hotel-booking/1.0/hotels", {
            method: "POST",
            headers: {
                "Api-key": process.env.HOTELBEDS_KEY,
                "X-Signature": signature,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                stay: { checkIn, checkOut },
                occupancies: [{ 
                    rooms: 1, 
                    adults: parseInt(adults) || 1, 
                    children: 0 
                }],
                destination: { code: destinationCode.trim().toUpperCase() } 
            })
        });

        const data = await response.json();
        
        // Sécurité : Vérifier si Hotelbeds renvoie une erreur structurée
        if (data.error || data.code === "INVALID_DATA") {
            return res.status(400).json({ error: data.error?.message || "Données invalides pour Hotelbeds" });
        }

        // On renvoie un objet propre au front
        res.json({ 
            hotels: data.hotels && data.hotels.hotels ? data.hotels.hotels : [] 
        });

    } catch (error) {
        console.error("❌ ERREUR HOTELBEDS:", error.message);
        res.status(500).json({ error: "Erreur de connexion au GDS Hôtels" });
    }
});

// --- RÉSERVATION DE VOL ---
app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email } = req.body;
    try {
        const offer = await duffel.offers.get(offer_id);
        const gdsPassengers = offer.data.passengers;

        const order = await duffel.orders.create({
            type: "instant",
            selected_offers: [offer_id],
            passengers: passengers.map((p, index) => ({
                id: gdsPassengers[index].id,
                title: (p.gender === 'm' || p.gender === 'mr') ? 'mr' : 'ms',
                given_name: p.first_name,
                family_name: p.last_name,
                gender: (p.gender === 'm' || p.gender === 'mr') ? 'm' : 'f',
                born_on: p.born_on,
                email: email,
                phone_number: p.phone || "+33600000000"
            })),
            payments: [{
                type: "balance",
                currency: offer.data.total_currency,
                amount: offer.data.total_amount
            }]
        });

        res.json({ success: true, booking_reference: order.data.booking_reference });
    } catch (error) {
        console.error("❌ ERREUR RÉSERVATION:", JSON.stringify(error.errors || error.message));
        res.status(400).json({ success: false, details: error.errors || error.message });
    }
});

app.get('/', (req, res) => res.send('GDS TERMINAL : ONLINE 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif sur le port ${PORT}`);
});
