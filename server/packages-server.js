/**
 * TERRA VOYAGE - CUSTOM PACKAGES ENGINE
 * Source : Supabase (Offres privées de Chris Musumary)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT_PACKAGES || 10003;

app.use(cors());
app.use(express.json());

// --- INITIALISATION SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- RÉCUPÉRER TOUS LES PACKAGES ---
app.get('/search-packages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('packages') // Nom de ta table dans Supabase
            .select('*')
            .eq('active', true) // Uniquement les offres actives
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ source: "supabase", packages: data });
    } catch (e) {
        console.error("Erreur Supabase:", e.message);
        res.status(500).json({ packages: [], error: "Impossible de charger les packages" });
    }
});

// --- RÉCUPÉRER UN PACKAGE PAR SON ID (Pour la page détails) ---
app.get('/package/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(404).json({ error: "Package introuvable" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`📦 Package Engine (Supabase) prêt sur le port ${PORT}`);
});
