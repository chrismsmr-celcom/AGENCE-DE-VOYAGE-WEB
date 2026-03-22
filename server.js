require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Duffel } = require('@duffel/api');

const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json()); // Crucial pour req.body

// --- INITIALISATION DUFFEL ---
console.log("Vérification de la configuration...");

// On gère les deux noms possibles pour ton token
const duffelToken = process.env.DUFFEL_TOKEN || process.env.DUFFEL_ACCESS_TOKEN;

if (!duffelToken) {
    console.error("❌ ERREUR CRITIQUE : Token Duffel manquant dans l'environnement !");
} else {
    console.log("✅ Token Duffel détecté (Type: " + (duffelToken.startsWith('duffel_test') ? 'TEST' : 'LIVE') + ")");
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

// --- RECHERCHE DE VOLS (DUFFEL) ---
app.post('/search-flights', async (req, res) => {
    console.log("Requête reçue /search-flights");
    
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

        // On s'assure que passengers est un nombre
        const count = parseInt(passengers) || 1;

        const offerRequest = await duffel.offerRequests.create({
            slices: slices,
            passengers: Array.from({ length: count }, () => ({ type: "adult" })),
            cabin_class: cabinClass || "economy",
            return_offers: true
        });

        console.log(`[DUFFEL] ${offerRequest.data.offers.length} offres trouvées.`);
        res.json({ offers: offerRequest.data.offers || [] });

    } catch (error) {
        console.error("❌ ERREUR DUFFEL DÉTAILLÉE:", JSON.stringify(error.errors || error.message));
        res.status(400).json({ 
            error: "Erreur Duffel", 
            details: error.errors || error.message 
        });
    }
});

// --- RECHERCHE D'HÔTELS (HOTELBEDS) ---
app.post('/search-hotels', async (req, res) => {
    const { destinationCode, checkIn, checkOut, adults } = req.body;
    
    // Sécurité : Vérification des données entrantes
    if (!destinationCode || !checkIn || !checkOut) {
        return res.status(400).json({ error: "Dates ou destination manquantes" });
    }

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
                occupancies: [{ 
                    rooms: 1, 
                    adults: parseInt(adults) || 1, 
                    children: 0 
                }],
                // Correction ici : Hotelbeds attend souvent un code de zone ou une destination précise
                destination: { code: destinationCode.toUpperCase() } 
            })
        });

        const data = await response.json();
        
        // Hotelbeds renvoie parfois les hôtels dans data.hotels.hotels
        res.json({ 
            hotels: data.hotels ? data.hotels.hotels : [] 
        });
    } catch (error) {
        console.error("❌ ERREUR HOTELBEDS:", error.message);
        res.status(500).json({ error: "Erreur interne GDS" });
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
                title: p.gender === 'm' ? 'mr' : 'ms',
                given_name: p.first_name,
                family_name: p.last_name,
                gender: p.gender === 'm' ? 'm' : 'f',
                born_on: p.born_on,
                email: email,
                phone_number: "+33600000000" // Format E.164
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
        res.status(400).json({ success: false, details: error.errors });
    }
});

app.get('/', (req, res) => {
    res.send('TERMINAL GDS TERRA VOYAGE : CONNECTÉ 🟢');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif sur le port ${PORT}`);
});

