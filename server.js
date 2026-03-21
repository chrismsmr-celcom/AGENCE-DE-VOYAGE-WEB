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
// --- RECHERCHE DE VOLS (DUFFEL) ---
app.post('/search-flights', async (req, res) => {
    // 1. Log des données reçues pour le debug
    console.log("Données reçues du client:", req.body);

    const { origin, destination, departureDate, returnDate, cabinClass, passengers, tripType } = req.body;

    // Validation minimale
    if (!origin || !destination || !departureDate) {
        return res.status(400).json({ error: "Champs obligatoires manquants : origin, destination ou departureDate" });
    }

    try {
        // Préparation des segments (slices)
        const slices = [{
            origin: origin.trim().toUpperCase(),
            destination: destination.trim().toUpperCase(),
            departure_date: departureDate // Doit être YYYY-MM-DD
        }];

        if (tripType === 'round_trip' && returnDate) {
            slices.push({
                origin: destination.trim().toUpperCase(),
                destination: origin.trim().toUpperCase(),
                departure_date: returnDate
            });
        }

        // Correction de la création de l'offre
        const offerRequest = await duffel.offerRequests.create({
            slices: slices,
            // Duffel attend un tableau d'objets passagers
            passengers: Array.from({ length: Number(passengers) && Number(passengers) > 0 ? Number(passengers) : 1 }, () => ({ type: "adult" })),
            cabin_class: cabinClass || "economy", // Valeur par défaut si vide
            return_offers: true
        });

        console.log(`[GDS-FLIGHTS] ${offerRequest.data.offers.length} offres trouvées.`);
        res.json({ offers: offerRequest.data?.offers || [] });

    } catch (error) {
        // Log ultra-précis pour voir ce que Duffel renvoie vraiment
        console.error("❌ ERREUR DUFFEL DÉTAILLÉE:", JSON.stringify(error.errors || error.message));
        
        // On renvoie l'erreur détaillée au front pour debugger
        res.status(400).json({ 
            error: "Erreur lors de la recherche Duffel", 
            details: error.errors || error.message 
        });
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
        // 1. On récupère l'offre pour avoir les IDs passagers générés par le GDS
        const offer = await duffel.offers.get(offer_id);
        const gdsPassengers = offer.data.passengers;

        const order = await duffel.orders.create({
            type: "instant",
            selected_offers: [offer_id],
            // On mappe tes données front-end sur les IDs passagers du GDS
            passengers: passengers.map((p, index) => ({
                id: gdsPassengers[index].id, // Crucial : l'ID vient de Duffel, pas de toi
                title: p.gender === 'm' ? 'mr' : 'ms',
                given_name: p.first_name,
                family_name: p.last_name,
                gender: p.gender === 'm' ? 'm' : 'f',
                born_on: p.born_on, // Format YYYY-MM-DD obligatoire
                email: email,
                phone_number: "+33612345678" // Duffel exige un format E.164
            })),
            payments: [{
                type: "balance", // "balance" ne marche que si tu as des fonds sur ton compte Duffel
                currency: offer.data.total_currency,
                amount: offer.data.total_amount
            }]
        });

        console.log(`[BOOKING-SUCCESS] PNR: ${order.data.booking_reference}`);
        res.json({ success: true, booking_reference: order.data.booking_reference });
    } catch (error) {
        console.error("❌ ERREUR RÉSERVATION:", JSON.stringify(error.errors || error.message));
        res.status(400).json({ 
            success: false, 
            message: error.message,
            details: error.errors 
        });
    }
});
app.get('/', (req, res) => {
    res.send('TERMINAL GDS TERRA VOYAGE : MULTI-PROVIDER ONLINE 🟢');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Terminal running on port ${PORT}`);
});
