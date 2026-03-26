// scripts/add-logos.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const logos = [
    { iata: 'AF', name: 'Air France', url: 'https://...' },
    { iata: 'LH', name: 'Lufthansa', url: 'https://...' },
    // Ajoutez ici tous les logos
];

async function addLogos() {
    for (const logo of logos) {
        await supabase.from('airline_logos').upsert({
            iata_code: logo.iata,
            name: logo.name,
            logo_url: logo.url,
            priority: 10
        });
        console.log(`✅ Logo ${logo.iata} ajouté`);
    }
}

addLogos();