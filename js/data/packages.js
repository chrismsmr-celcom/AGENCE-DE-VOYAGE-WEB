/**
 * TERRA VOYAGE - PACKAGES DATA
 * Données des packages de destinations avec galeries d'images
 */

export const packages = {
    paris: {
        id: 'paris',
        title: "Paris Privé",
        tag: "Luxe & Romance",
        desc: "Découvrez Paris comme jamais auparavant avec un circuit exclusif incluant une croisière sur la Seine, un dîner dans un restaurant étoilé et une visite privée du Louvre.",
        price: 1750,
        priceFormatted: "1.750$",
        images: [
            "https://images.unsplash.com/photo-1509439581779-6298f75bf6e5?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            "https://images.unsplash.com/photo-1551634979-2b11f8c946fe?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            "https://images.unsplash.com/photo-1715591264500-54d949535d30?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            "https://images.unsplash.com/photo-1716141453366-357e6f6bd8ac?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            "https://images.unsplash.com/photo-1585076491343-592f07930a99?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        ],
        features: [
            "Vol aller-retour Classe Économique",
            "Hôtel 4* au centre de Paris",
            "Petit-déjeuner inclus",
            "Croisière sur la Seine",
            "Assistance 24h/24 et 7j/7"
        ],
        duration: "6 jours / 5 nuits"
    },
    capetown: {
        id: 'capetown',
        title: "Cape Town Safari",
        tag: "Aventure & Nature",
        desc: "Un voyage unique entre l'océan Atlantique et les montagnes de la Table. Safari au parc national Kruger et découverte de la route des vins.",
        price: 2150,
        priceFormatted: "2.150$",
        images: [
            "https://images.unsplash.com/photo-1712850256111-bfd1677f7f5e?q=80&w=870",
            "https://images.unsplash.com/photo-1563789809870-81e0437b2b47?q=80&w=881",
            "https://images.unsplash.com/photo-1570527141186-e391a3914c42?q=80&w=870",
            "https://images.unsplash.com/photo-1496497243327-9dccd845c35f?q=80&w=870",
            "https://images.unsplash.com/photo-1669238658622-49ca0506cfb1?q=80&w=840"
        ],
        features: [
            "Vol aller-retour direct/1 escale",
            "Safari 4x4 inclus",
            "Hébergement en Lodge de luxe",
            "Visite du Cap de Bonne-Espérance",
            "Transferts privés inclus"
        ],
        duration: "8 jours / 7 nuits"
    },
    istanbul: {
        id: 'istanbul',
        title: "Bosphore Gold",
        tag: "Culture & Détente",
        desc: "Plongez au cœur de l'histoire et de la culture turque. Découvrez Sainte-Sophie, la Mosquée Bleue et profitez d'une croisière privée sur le Bosphore.",
        price: 1350,
        priceFormatted: "1.350$",
        images: [
            "https://images.unsplash.com/photo-1684254889561-fdd9a84cd8d5?q=80&w=987",
            "https://images.unsplash.com/photo-1629649456013-88519a031d64?q=80&w=927",
            "https://images.unsplash.com/photo-1630874274767-daaaae53254e?q=80&w=930",
            "https://images.unsplash.com/photo-1621164870333-7931835f05de?q=80&w=987",
            "https://images.unsplash.com/photo-1576740858825-9f207efc968f?q=80&w=934"
        ],
        features: [
            "Vol aller-retour (Turkish Airlines)",
            "Hôtel 4* avec vue sur mer",
            "Demi-pension incluse",
            "Croisière sur le Bosphore",
            "Visite guidée privée"
        ],
        duration: "5 jours / 4 nuits"
    },
    canton: {
        id: 'canton',
        title: "Foire de Canton",
        tag: "Business & Sourcing",
        desc: "Le pack idéal pour les entrepreneurs. Accès prioritaire à la Foire de Canton, hébergement de luxe et services d'interprétation professionnelle.",
        price: 2850,
        priceFormatted: "2.850$",
        images: [
            "https://images.unsplash.com/photo-1563090162-6b4c2a20d658?q=80&w=982",
            "https://images.unsplash.com/photo-1630831241310-3984f1b3d711?q=80&w=869",
            "https://images.unsplash.com/photo-1588267863680-ba244f1bf0d4?q=80&w=870",
            "https://images.unsplash.com/photo-1594482278927-aa3fa61fd132?q=80&w=927",
            "https://images.unsplash.com/photo-1626445503811-c8ae17ab99d5?q=80&w=927"
        ],
        features: [
            "Vol en Classe Affaires",
            "Hôtel 5* en centre-ville",
            "Accès VIP à la Foire",
            "Interprète dédié (Français/Chinois)",
            "Transferts privés VIP"
        ],
        duration: "7 jours / 6 nuits"
    },
    bresil: {
        id: 'bresil',
        title: "Rio & Copacabana",
        tag: "Plage & Carnaval",
        desc: "L'énergie brésilienne vous attend ! Découvrez Rio, ses plages mythiques, le Christ Rédempteur et le Pain de Sucre.",
        price: 2400,
        priceFormatted: "2.400$",
        images: [
            "https://images.unsplash.com/photo-1668194534225-5d7b688d505c?q=80&w=870",
            "https://images.unsplash.com/photo-1630410139620-15d3a0791a5b?q=80&w=930",
            "https://images.unsplash.com/photo-1648554586178-bbd078dd26b4?q=80&w=875",
            "https://images.unsplash.com/photo-1660948298281-cfa208bf3d11?q=80&w=927",
            "https://images.unsplash.com/photo-1648802258829-70a2ca531237?q=80&w=875"
        ],
        features: [
            "Vol aller-retour",
            "Hôtel avec vue sur mer",
            "Excursion au Corcovado",
            "Dîner-spectacle Samba",
            "Assistance locale francophone"
        ],
        duration: "7 jours / 6 nuits"
    },
    'new york': {
        id: 'new-york',
        title: "New York City",
        tag: "Urbain & Vibrant",
        desc: "La ville qui ne dort jamais. Découvrez Manhattan, Times Square, la Statue de la Liberté et les meilleurs spots de la Grosse Pomme.",
        price: 2650,
        priceFormatted: "2.650$",
        images: [
            "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=870",
            "https://images.unsplash.com/photo-1476837754190-8036496cea40?q=80&w=987",
            "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?q=80&w=899",
            "https://images.unsplash.com/photo-1575372587186-5012f8886b4e?q=80&w=870",
            "https://images.unsplash.com/photo-1650839322343-532cd49f1127?q=80&w=988"
        ],
        features: [
            "Vol aller-retour (FIH-JFK)",
            "Hôtel au cœur de Manhattan",
            "CityPASS New York inclus",
            "Croisière Statue de la Liberté",
            "Guide francophone privé"
        ],
        duration: "7 jours / 6 nuits"
    }
};
export function getPackage(id) {
    return packages[id];
}

export function getAllPackages() {
    return Object.values(packages);
}