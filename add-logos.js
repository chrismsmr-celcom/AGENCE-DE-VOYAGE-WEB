// scripts/add-logos.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Charger les variables d'environnement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Liste complète des logos des compagnies aériennes
const logos = [
    // Europe
    { iata: 'AF', name: 'Air France', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Air_France_Logo.svg/200px-Air_France_Logo.svg.png' },
    { iata: 'KL', name: 'KLM', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/KLM_logo.svg/200px-KLM_logo.svg.png' },
    { iata: 'LH', name: 'Lufthansa', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Lufthansa_Logo_2018.svg/200px-Lufthansa_Logo_2018.svg.png' },
    { iata: 'BA', name: 'British Airways', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/British_Airways_logo_%282016%29.svg/200px-British_Airways_logo_%282016%29.svg.png' },
    { iata: 'TK', name: 'Turkish Airlines', url: 'https://cdn.worldvectorlogo.com/logos/turkish-airlines-logo.svg' },
    { iata: 'LX', name: 'Swiss', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Swiss_International_Air_Lines_logo.svg/200px-Swiss_International_Air_Lines_logo.svg.png' },
    { iata: 'OS', name: 'Austrian Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Austrian_Airlines_logo.svg/200px-Austrian_Airlines_logo.svg.png' },
    { iata: 'SN', name: 'Brussels Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Brussels_Airlines.svg/200px-Brussels_Airlines.svg.png' },
    { iata: 'IB', name: 'Iberia', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Iberia_logo.svg/200px-Iberia_logo.svg.png' },
    { iata: 'AY', name: 'Finnair', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Finnair_logo.svg/200px-Finnair_logo.svg.png' },
    { iata: 'SK', name: 'SAS', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/SAS_logo.svg/200px-SAS_logo.svg.png' },
    { iata: 'TP', name: 'TAP Portugal', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/TAP_Air_Portugal_Logo.svg/200px-TAP_Air_Portugal_Logo.svg.png' },
    { iata: 'A3', name: 'Aegean Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Aegean_Airlines_logo.svg/200px-Aegean_Airlines_logo.svg.png' },
    { iata: 'LO', name: 'LOT Polish Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/LOT_Polish_Airlines_logo.svg/200px-LOT_Polish_Airlines_logo.svg.png' },
    
    // Moyen-Orient
    { iata: 'EK', name: 'Emirates', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Emirates_logo.svg/200px-Emirates_logo.svg.png' },
    { iata: 'QR', name: 'Qatar Airways', url: 'https://cdn.worldvectorlogo.com/logos/qatar-airways-1.svg' },
    { iata: 'EY', name: 'Etihad', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Etihad_Airways_logo.svg/200px-Etihad_Airways_logo.svg.png' },
    { iata: 'GF', name: 'Gulf Air', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Gulf_Air_logo.svg/200px-Gulf_Air_logo.svg.png' },
    { iata: 'KU', name: 'Kuwait Airways', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Kuwait_Airways_logo.svg/200px-Kuwait_Airways_logo.svg.png' },
    { iata: 'WY', name: 'Oman Air', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Oman_Air_logo.svg/200px-Oman_Air_logo.svg.png' },
    { iata: 'RJ', name: 'Royal Jordanian', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Royal_Jordanian_logo.svg/200px-Royal_Jordanian_logo.svg.png' },
    { iata: 'SV', name: 'Saudia', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Saudia_logo.svg/200px-Saudia_logo.svg.png' },
    
    // Afrique
    { iata: 'ET', name: 'Ethiopian Airlines', url: 'https://cdn.worldvectorlogo.com/logos/logo-ethiopian-airlines.svg' },
    { iata: 'KQ', name: 'Kenya Airways', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Kenya_Airways_logo.svg/200px-Kenya_Airways_logo.svg.png' },
    { iata: 'AT', name: 'Royal Air Maroc', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Royal_Air_Maroc_logo.svg/200px-Royal_Air_Maroc_logo.svg.png' },
    { iata: 'MS', name: 'Egyptair', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Egyptair_logo.svg/200px-Egyptair_logo.svg.png' },
    { iata: 'SA', name: 'South African Airways', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/South_African_Airways_Logo.svg/200px-South_African_Airways_Logo.svg.png' },
    { iata: 'RN', name: 'Air Rwanda', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Air_Rwanda_logo.svg/200px-Air_Rwanda_logo.svg.png' },
    { iata: 'TC', name: 'Air Tanzania', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Air_Tanzania_logo.svg/200px-Air_Tanzania_logo.svg.png' },
    { iata: 'UG', name: 'Air Uganda', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Air_Uganda_logo.svg/200px-Air_Uganda_logo.svg.png' },
    
    // Amérique du Nord
    { iata: 'DL', name: 'Delta Air Lines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Delta_Air_Lines_Logo.svg/200px-Delta_Air_Lines_Logo.svg.png' },
    { iata: 'UA', name: 'United Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/United_Airlines_logo_%282019%29.svg/200px-United_Airlines_logo_%282019%29.svg.png' },
    { iata: 'AA', name: 'American Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/American_Airlines_logo_2013.svg/200px-American_Airlines_logo_2013.svg.png' },
    { iata: 'AC', name: 'Air Canada', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Air_Canada_logo.svg/200px-Air_Canada_logo.svg.png' },
    { iata: 'WS', name: 'WestJet', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/WestJet_logo.svg/200px-WestJet_logo.svg.png' },
    { iata: 'AM', name: 'Aeroméxico', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Aeroméxico_logo.svg/200px-Aeroméxico_logo.svg.png' },
    
    // Amérique du Sud
    { iata: 'LA', name: 'LATAM', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/LATAM_Airlines_logo.svg/200px-LATAM_Airlines_logo.svg.png' },
    { iata: 'G3', name: 'Gol', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Gol_Transportes_Aéreos_logo.svg/200px-Gol_Transportes_Aéreos_logo.svg.png' },
    { iata: 'AR', name: 'Aerolíneas Argentinas', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Aerolíneas_Argentinas_logo.svg/200px-Aerolíneas_Argentinas_logo.svg.png' },
    { iata: 'AV', name: 'Avianca', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Avianca_logo.svg/200px-Avianca_logo.svg.png' },
    
    // Asie
    { iata: 'SQ', name: 'Singapore Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Singapore_Airlines_Logo_2019.svg/200px-Singapore_Airlines_Logo_2019.svg.png' },
    { iata: 'CX', name: 'Cathay Pacific', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Cathay_Pacific_logo.svg/200px-Cathay_Pacific_logo.svg.png' },
    { iata: 'NH', name: 'ANA', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ANA_logo.svg/200px-ANA_logo.svg.png' },
    { iata: 'JL', name: 'Japan Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Japan_Airlines_logo.svg/200px-Japan_Airlines_logo.svg.png' },
    { iata: 'KE', name: 'Korean Air', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Korean_Air_logo.svg/200px-Korean_Air_logo.svg.png' },
    { iata: 'OZ', name: 'Asiana', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Asiana_Airlines_logo.svg/200px-Asiana_Airlines_logo.svg.png' },
    { iata: 'TG', name: 'Thai Airways', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Thai_Airways_logo.svg/200px-Thai_Airways_logo.svg.png' },
    { iata: 'MH', name: 'Malaysia Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Malaysia_Airlines_logo.svg/200px-Malaysia_Airlines_logo.svg.png' },
    { iata: 'GA', name: 'Garuda Indonesia', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Garuda_Indonesia_logo.svg/200px-Garuda_Indonesia_logo.svg.png' },
    { iata: 'PR', name: 'Philippine Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Philippine_Airlines_logo.svg/200px-Philippine_Airlines_logo.svg.png' },
    { iata: 'VN', name: 'Vietnam Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Vietnam_Airlines_logo.svg/200px-Vietnam_Airlines_logo.svg.png' },
    
    // Chine
    { iata: 'MU', name: 'China Eastern', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/China_Eastern_Airlines_logo.svg/200px-China_Eastern_Airlines_logo.svg.png' },
    { iata: 'CZ', name: 'China Southern', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/China_Southern_logo.svg/200px-China_Southern_logo.svg.png' },
    { iata: 'CA', name: 'Air China', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Air_China_logo.svg/200px-Air_China_logo.svg.png' },
    { iata: 'HU', name: 'Hainan Airlines', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Hainan_Airlines_logo.svg/200px-Hainan_Airlines_logo.svg.png' },
    
    // Océanie
    { iata: 'QF', name: 'Qantas', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Qantas_logo_2016.svg/200px-Qantas_logo_2016.svg.png' },
    { iata: 'NZ', name: 'Air New Zealand', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Air_New_Zealand_logo.svg/200px-Air_New_Zealand_logo.svg.png' },
    { iata: 'VA', name: 'Virgin Australia', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Virgin_Australia_logo.svg/200px-Virgin_Australia_logo.svg.png' }
];

async function addLogos() {
    console.log('🚀 Import des logos dans Supabase...');
    let success = 0;
    let errors = 0;
    
    for (const logo of logos) {
        try {
            const { data, error } = await supabase
                .from('airline_logos')
                .upsert({
                    iata_code: logo.iata,
                    name: logo.name,
                    logo_url: logo.url,
                    priority: 10,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'iata_code'
                });
            
            if (error) throw error;
            console.log(`✅ Logo ${logo.iata} (${logo.name}) ajouté avec succès`);
            success++;
        } catch (error) {
            console.error(`❌ Erreur pour ${logo.iata}:`, error.message);
            errors++;
        }
    }
    
    console.log('\n📊 Résumé:');
    console.log(`   ✅ Succès: ${success}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📦 Total: ${logos.length}`);
}

// Exécuter le script
addLogos().catch(console.error);
