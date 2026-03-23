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
    // Utilisation stricte de HOTELBEDS_KEY comme sur ton Render
    const apiKey = process.env.HOTELBEDS_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    
    if (!apiKey || !secret) {
        console.error("❌ Clés Hotelbeds manquantes dans les variables d'environnement !");
        return null;
    }

    const data = apiKey + secret + timestamp;
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
    // On accepte destinationCode OU city pour être compatible avec ton front
    const { destinationCode, city, checkIn, checkOut, adults } = req.body;
    const finalCityCode = (destinationCode || city || "").trim().toUpperCase();

    if (!finalCityCode || !checkIn || !checkOut) {
        return res.status(400).json({ error: "Données manquantes : Code ville, check-in ou check-out." });
    }

    const signature = getHotelbedsSignature();
    if (!signature) return res.status(500).json({ error: "Erreur de configuration serveur (Signature)" });

    try {
        const response = await fetch("https://api.test.hotelbeds.com/hotel-booking/1.0/hotels", {
            method: "POST",
            headers: {
                "Api-key": process.env.HOTELBEDS_KEY, // On utilise bien ta clé Render
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
                destination: { code: finalCityCode } 
            })
        });

        const data = await response.json();
        
        // Log pour débugger dans Render si ça échoue encore
        if (!response.ok) {
            console.error("❌ HOTELBEDS API ERROR:", data);
            return res.status(response.status).json({ error: data.error?.message || "Erreur API Hotelbeds" });
        }

        res.json({ 
            hotels: data.hotels && data.hotels.hotels ? data.hotels.hotels : [] 
        });

    } catch (error) {
        console.error("❌ CRITICAL SERVER ERROR:", error.message);
        res.status(500).json({ error: "Le serveur n'a pas pu contacter le fournisseur d'hôtels." });
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
