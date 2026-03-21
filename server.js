require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');

const app = express();
const port = 3000;

// Initialisation avec la version d'API recommandée
const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN 
  });;

app.use(cors());
app.use(express.json());

// --- RECHERCHE DE VOLS ---
app.post('/search-flights', async (req, res) => {
    const { origin, destination, departureDate, returnDate, cabinClass, passengers, tripType } = req.body;

    try {
        const slices = [
            {
                origin: origin.trim().toUpperCase(),
                destination: destination.trim().toUpperCase(),
                departure_date: departureDate
            }
        ];

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

        console.log(`[GDS] ${offerRequest.data.offers.length} offres trouvées.`);
        res.json({ offers: offerRequest.data?.offers || [] });

    } catch (error) {
        console.error("❌ ERREUR DUFFEL SEARCH:", JSON.stringify(error.errors || error.message, null, 2));
        res.status(400).json({ error: error.message, details: error.errors });
    }
});

// --- CRÉATION DE RÉSERVATION (PNR) ---
// ... (tes imports restent les mêmes)

app.post('/book-flight', async (req, res) => {
    const { offer_id, passengers, email } = req.body;

    try {
        // 1. On récupère d'abord l'offre pour avoir les vrais passenger_ids du GDS
        const offer = await duffel.offers.get(offer_id);
        const gdsPassengerIds = offer.data.passengers.map(p => p.id);

        // 2. On crée la commande avec les IDs officiels
        const order = await duffel.orders.create({
            type: "instant",
            selected_offers: [offer_id],
            passengers: passengers.map((p, index) => ({
                // CRUCIAL : On utilise l'ID que Duffel attend pour ce passager
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
            payments: [
                {
                    type: "balance",
                    currency: offer.data.total_currency,
                    amount: offer.data.total_amount
                }
            ]
        });

        console.log(`[GDS] PNR Créé avec succès : ${order.data.booking_reference}`);
        res.json({ success: true, booking_reference: order.data.booking_reference });

    } catch (error) {
        console.error("❌ ERREUR DUFFEL BOOKING:", JSON.stringify(error.errors || error.message, null, 2));
        res.status(400).json({ 
            success: false, 
            message: error.message, 
            details: error.errors 
        });
    }
});
app.get('/', (req, res) => {
  res.send('TERMINAL GDS TERRA VOYAGE : ONLINE 🟢');
});

app.listen(port, () => {
  console.log(`🚀 Terminal running on http://localhost:${port}`);
});
