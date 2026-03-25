/**
 * TERRA VOYAGE - HUB CENTRAL API (V3.2 - Amélioré)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Duffel } = require('@duffel/api');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- INITIALISATION DES CLIENTS ---
const duffel = new Duffel({ token: process.env.DUFFEL_TOKEN });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const LITE_HEADERS = { 
    "X-API-Key": process.env.LITE_API_KEY, 
    "Content-Type": "application/json",
    "Accept": "application/json"
};

// Middleware de logging
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// ==========================================
// 1. VOLS (DUFFEL)
// ==========================================
app.post('/api/flights/search', async (req, res) => {
    const { origin, destination, departureDate, returnDate, adults, children, infants, class: travelClass, tripType } = req.body;

    try {
        // Validation des paramètres
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({ error: "Paramètres manquants: origin, destination, departureDate requis" });
        }

        const slices = [{ 
            origin: origin.toUpperCase(), 
            destination: destination.toUpperCase(), 
            departure_date: departureDate 
        }];

        if (tripType === 'round_trip' && returnDate) {
            slices.push({ 
                origin: destination.toUpperCase(), 
                destination: origin.toUpperCase(), 
                departure_date: returnDate 
            });
        }

        // Construction de la liste des passagers
        const passengerList = [];
        const numAdults = parseInt(adults) || 1;
        for (let i = 0; i < numAdults; i++) passengerList.push({ type: "adult" });
        
        const numChildren = parseInt(children) || 0;
        for (let i = 0; i < numChildren; i++) passengerList.push({ type: "child" });
        
        const numInfants = parseInt(infants) || 0;
        for (let i = 0; i < numInfants; i++) passengerList.push({ type: "infant_without_seat" });

        const duffelRes = await duffel.offerRequests.create({
            slices: slices,
            passengers: passengerList,
            return_offers: true,
            cabin_class: travelClass || 'economy'
        });

        console.log(`✅ Vols trouvés pour ${origin}-${destination}: ${duffelRes.data.offers.length} offres`);
        res.json({ 
            source: "duffel",
            flights: duffelRes.data.offers || [],
            slices: duffelRes.data.slices
        });

    } catch (e) { 
        console.error("❌ Erreur Duffel:", e.errors ? JSON.stringify(e.errors) : e.message);
        
        // Retourner un tableau vide au lieu d'une erreur 500
        res.json({ 
            source: "duffel",
            flights: [], 
            error: "Aucun vol trouvé pour ces critères",
            details: e.message
        });
    }
});

// ==========================================
// 2. AUTOCOMPLETE LOCATIONS (Supabase)
// ==========================================
app.get('/api/locations/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        const { data, error } = await supabase
            .from('air_destinations')
            .select('*')
            .or(`name.ilike.%${query}%,municipality.ilike.%${query}%,iata_code.ilike.%${query}%`)
            .order('type', { ascending: false })
            .limit(15);

        if (error) throw error;
        
        // Formater les résultats
        const formatted = (data || []).map(item => ({
            ...item,
            code: item.iata_code || item.code,
            display_name: `${item.name} (${item.iata_code || item.code}) - ${item.municipality || ''}, ${item.iso_country || ''}`
        }));
        
        res.json(formatted);
    } catch (e) {
        console.error("Erreur autocomplete:", e);
        res.json([]);
    }
});

// ==========================================
// 3. HÔTELS (LITE API avec fallback)
// ==========================================
app.post('/api/hotels/search', async (req, res) => {
    const { destination, city, checkIn, checkOut, adults, children } = req.body;
    
    try {
        // Essayer d'abord Lite API
        const response = await axios.post("https://api.liteapi.travel/v3.0/hotels/search", {
            destination: city || destination,
            checkin: checkIn,
            checkout: checkOut || checkIn,
            adults: parseInt(adults) || 1,
            children: parseInt(children) || 0,
            currency: "USD",
            guestNationality: "US"
        }, { headers: LITE_HEADERS });
        
        res.json({ 
            source: "liteapi",
            hotels: response.data.data || []
        });
    } catch (e) {
        console.error("Erreur Lite API:", e.message);
        
        // Fallback vers Supabase
        const { data, error } = await supabase
            .from('hotels')
            .select('*')
            .limit(10);
            
        res.json({ 
            source: "supabase",
            hotels: error ? [] : data
        });
    }
});

// ==========================================
// 4. PACKAGES (Supabase)
// ==========================================
app.get('/api/packages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });
            
        res.json(error ? [] : data);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================
// 5. VOITURES (Supabase)
// ==========================================
app.get('/api/cars', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cars')
            .select('*')
            .eq('active', true)
            .order('price_per_day', { ascending: true });
            
        res.json(error ? [] : data);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================
// 6. ACTIVITÉS
// ==========================================
app.get('/api/activities', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('active', true);
            
        res.json(error ? [] : data);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================
// 7. ASSURANCES
// ==========================================
app.get('/api/insurance', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('insurance')
            .select('*')
            .eq('active', true);
            
        res.json(error ? [] : data);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================
// 8. TRANSFERTS
// ==========================================
app.get('/api/transfers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transfers')
            .select('*')
            .eq('active', true);
            
        res.json(error ? [] : data);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================
// 9. RÉSERVATIONS
// ==========================================
app.post('/api/checkout', async (req, res) => {
    const { type, details, customer, totalPrice } = req.body;
    
    if (!customer || !customer.email) {
        return res.status(400).json({ success: false, error: "Informations client manquantes" });
    }
    
    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([{
                type, 
                details,
                customer_email: customer.email,
                customer_name: customer.name || 'Non spécifié',
                total_price: totalPrice,
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            booking: data[0],
            message: "Réservation enregistrée avec succès"
        });
    } catch (e) {
        console.error("Erreur réservation:", e);
        res.status(400).json({ success: false, error: e.message });
    }
});

// ==========================================
// 10. STATUT
// ==========================================
app.get('/', (req, res) => {
    res.json({
        status: "online",
        version: "3.2",
        timestamp: new Date().toISOString(),
        message: "🌍 TERRA HUB CENTRAL - API Voyage"
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: "healthy",
        services: {
            duffel: !!process.env.DUFFEL_TOKEN,
            supabase: !!process.env.SUPABASE_URL,
            lite: !!process.env.LITE_API_KEY
        }
    });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint non trouvé" });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error("Erreur serveur:", err);
    res.status(500).json({ error: "Erreur interne du serveur" });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Terra Hub Central V3.2 opérationnel sur le port ${PORT}`);
    console.log(`📡 API disponible sur http://localhost:${PORT}/api`);
});
