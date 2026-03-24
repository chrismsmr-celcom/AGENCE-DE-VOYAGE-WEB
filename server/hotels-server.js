/**
 * TERRA VOYAGE - HOTEL ENGINE
 * Hôtels : Lite API uniquement
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT_HOTELS || 10002;

app.use(cors());
app.use(express.json());

const LITE_API_KEY = process.env.LITE_API_KEY || "sand_802ba304-83f9-414e-b9b6-e0c629aaf404";
const LITE_HEADERS = { "X-API-Key": LITE_API_KEY, "Content-Type": "application/json" };

// --- RECHERCHE HÔTELS ---
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
        res.status(500).json({ hotels: [], error: "Service indisponible" });
    }
});

// --- RÉSERVATION HÔTELS ---
app.post('/book-hotel', async (req, res) => {
    try {
        const response = await axios.post("https://book.liteapi.travel/v3.0/rates/book", req.body, {
            headers: LITE_HEADERS
        });
        res.json({ success: true, booking: response.data });
    } catch (error) {
        res.status(400).json({ success: false, details: error.response?.data });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🏨 Hotel Engine prêt sur le port ${PORT}`));