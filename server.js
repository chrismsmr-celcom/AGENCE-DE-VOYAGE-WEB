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
if (!duffelToken) console.error("❌ ERREUR : Token Duffel manquant !");

const duffel = new Duffel({ token: duffelToken || "" });

// --- UTILITAIRE : SIGNATURE HOTELBEDS ---
function getHotelbedsSignature() {
    const timestamp = Math.floor(Date.now() / 1000);
    const apiKey = process.env.HOTELBEDS_KEY;
    const secret = process.env.HOTELBEDS_SECRET;
    
    if (!apiKey || !secret) {
        console.error("❌ Clés Hotelbeds manquantes !");
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
    const { destinationCode, city, checkIn, checkOut, adults } = req.body;
    const finalCityCode = (destinationCode || city || "").trim().toUpperCase();

    if (!finalCityCode || !checkIn || !checkOut) {
        return res.status(400).json({ error: "Données manquantes (Code ville, dates)." });
    }

    const signature = getHotelbedsSignature();
    if (!signature) return res.status(500).json({ error: "Erreur Signature" });

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
                destination: { code: finalCityCode } 
            })
        });

        const data = await response.json().catch(() => ({})); // Évite le crash si JSON invalide

        if (!response.ok) {
            console.warn("⚠️ HOTELBEDS API REJECTED:", data);
            // On renvoie une liste vide au lieu d'une erreur 500 pour ne pas faire planter le front
            return res.json({ hotels: [] }); 
        }

        // Renvoi propre des données
        const hotelList = data.hotels && data.hotels.hotels ? data.hotels.hotels : [];
        res.json({ hotels: hotelList });

    } catch (error) {
        console.error("❌ CRITICAL HOTEL ERROR:", error.message);
        res.status(500).json({ error: "Erreur de connexion fournisseur." });
    }
});
// --- CONFIGURATION LITE API ---
const LITE_API_KEY = "sand_802ba304-83f9-414e-b9b6-e0c629aaf404";
const LITE_HEADERS = {
    "X-API-Key": LITE_API_KEY,
    "Content-Type": "application/json"
};

// --- RECHERCHE D'HÔTELS (LITE API) ---
app.post('/hotels/search', async (req, res) => {
    try {
        const response = await fetch("https://api.liteapi.travel/v3.0/hotels/rates?rm=true", {
            method: "POST",
            headers: LITE_HEADERS,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Erreur Lite API Search" });
    }
});

// --- PRÉ-RÉSERVATION (Vérification du prix final) ---
app.post('/hotels/prebook', async (req, res) => {
    try {
        const response = await fetch("https://book.liteapi.travel/v3.0/rates/prebook", {
            method: "POST",
            headers: LITE_HEADERS,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Erreur Lite API Prebook" });
    }
});

// --- CONFIRMATION DE RÉSERVATION ---
app.post('/hotels/book', async (req, res) => {
    try {
        const response = await fetch("https://book.liteapi.travel/v3.0/rates/book", {
            method: "POST",
            headers: LITE_HEADERS,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Erreur Lite API Booking" });
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
// --- RÉCUPÉRER LES DÉTAILS D'UNE OFFRE (Optimisé avec SDK) ---
app.get('/get-offer/:id', async (req, res) => {
    try {
        // On utilise le SDK déjà initialisé plus haut
        const offer = await duffel.offers.get(req.params.id);
        res.json(offer); // Le SDK renvoie déjà le bon format { data: { ... } }
    } catch (error) {
        console.error("❌ ERREUR GET OFFER:", error.message);
        res.status(404).json({ error: "Offre introuvable ou expirée" });
    }
});

// --- RÉSERVATION DE VOL (Version Robuste) ---
app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email, phone } = req.body;

    try {
        // 1. Récupérer l'offre pour avoir les IDs passagers requis par Duffel
        const offer = await duffel.offers.get(offer_id);
        const duffelPassengers = offer.data.passengers;

        // 2. Création de l'ordre
        const order = await duffel.orders.create({
            type: "hold", // IMPORTANT: On utilise 'hold' pour Terra Voyage
            selected_offers: [offer_id],
            passengers: passengers.map((p, index) => ({
                id: duffelPassengers[index].id, // On lie l'ID de l'offre au passager
                title: p.title || "mr",
                given_name: p.given_name,
                family_name: p.family_name,
                gender: p.gender || "m",
                born_on: p.born_on,
                email: email,
                phone_number: phone || "+243000000000"
            })),
            // On ne met pas de 'payments' ici car on est en mode 'hold'
        });

        res.json({ 
            success: true, 
            booking_reference: order.data.booking_reference,
            id: order.data.id // ID interne Duffel pour le paiement plus tard
        });

    } catch (error) {
        console.error("❌ ERREUR RÉSERVATION:", JSON.stringify(error.errors || error.message));
        res.status(400).json({ 
            success: false, 
            message: "La réservation a échoué",
            details: error.errors 
        });
    }
});
app.get('/', (req, res) => res.send('GDS TERMINAL : ONLINE 🟢'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif sur le port ${PORT}`);
});
