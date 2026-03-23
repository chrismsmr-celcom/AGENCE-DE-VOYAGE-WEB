const packages = {
    'paris': {
        title: "Paris Privé",
        tag: "Du 15 au 22 Mai 2026",
        img: "https://images.unsplash.com/photo-1509439581779-6298f75bf6e5?q=80&w=687",
        desc: "L'élégance française dans toute sa splendeur. Un séjour conçu pour ceux qui aiment le luxe discret et les vues imprenables.",
        price: "1.250$",
        features: ["Vol A/R Premium", "Hôtel Palace 5*", "Transfert privé", "Dîner sur la Seine"]
    },
    'capetown': {
        title: "Cape Town Safari",
        tag: "Du 05 au 12 Juin 2026",
        img: "https://images.unsplash.com/photo-1515205244153-fce4e5d8bc49?q=80&w=1552",
        desc: "Une aventure entre Table Mountain et les vignobles de Stellenbosch. Le mélange parfait de nature sauvage et de confort urbain.",
        price: "1.850$",
        features: ["Vol A/R", "Lodge de Luxe", "Excursion privée", "Dégustation VIP"]
    },
    'istanbul': {
        title: "Bosphore Gold",
        tag: "Du 20 au 27 Juillet 2026",
        img: "https://images.unsplash.com/photo-1571941646730-3ad5b00997ef?q=80&w=1491",
        desc: "Découvrez l'histoire à chaque coin de rue. Un séjour enchanteur entre palais ottomans et bazars vibrants.",
        price: "950$",
        features: ["Vol direct", "Hôtel de charme", "Croisière privée", "Accès musées"]
    },
    'canton': {
        title: "Foire de Canton",
        tag: "Dates de la session d'Octobre",
        img: "https://images.unsplash.com/photo-1599412405527-1e09a44bcd06?q=80&w=1374",
        desc: "Le rendez-vous incontournable des entrepreneurs. Nous gérons toute la logistique pour que vous vous concentriez sur votre business.",
        price: "2.100$",
        features: ["Visa Business inclus", "Hôtel proche foire", "Interprète dédié", "Navettes privées"]
    },
    'bresil': {
        title: "Rio & Copacabana",
        tag: "Du 10 au 18 Août 2026",
        img: "https://images.unsplash.com/photo-1507125524815-d9d6dccda1dc?q=80&w=1382",
        desc: "Vibrez au rythme de la samba. Un séjour ensoleillé au pied du Christ Rédempteur avec service de conciergerie 24h/24.",
        price: "1.600$",
        features: ["Vol Premium", "Front de mer 5*", "Visites guidées", "Soirée privée"]
    },
  'new york': {
    title: "Empire State Experience",
    tag: "Du 12 au 19 Septembre 2026",
    img: "https://images.unsplash.com/photo-1516893842880-5d8aada7ac05?q=80&w=764",
    desc: "Plongez au cœur de la ville qui ne dort jamais. Un itinéraire exclusif entre les lumières de Times Square, le calme de Central Park et les rooftops les      plus prisés de Manhattan.",
    price: "1.950$", // Ajusté pour le standard NY
    features: ["Vol direct Premium", "Hôtel à Times Square", "Pass VIP Rockefeller Center", "Transfert en SUV privé"]
    }
    
};

function openPackageModal(id) {
    const pkg = packages[id];
    if(!pkg) return;

    document.getElementById('modalTitle').innerText = pkg.title;
    document.getElementById('modalTag').innerText = pkg.tag;
    document.getElementById('modalImg').src = pkg.img;
    document.getElementById('modalDesc').innerText = pkg.desc;
    document.getElementById('modalPrice').innerText = pkg.price;

    const featuresList = document.getElementById('modalFeatures');
    featuresList.innerHTML = pkg.features.map(f => `<li class="flex items-center gap-3"><i class="fas fa-check text-red-600 text-[10px]"></i> ${f}</li>`).join('');

    const modal = document.getElementById('packageModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden'; // Bloque le scroll
}

function closePackageModal() {
    const modal = document.getElementById('packageModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';
}