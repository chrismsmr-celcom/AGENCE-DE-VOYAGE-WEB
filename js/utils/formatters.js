/**
 * TERRA VOYAGE - FORMATTERS
 * Fonctions de formatage de données
 */

/**
 * Formate une date
 */
export function formatDate(date, locale = 'fr-FR') {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Formate un prix
 */
export function formatPrice(price, currency = 'USD') {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

/**
 * Formate une durée (minutes -> heures)
 */
export function formatDuration(minutes) {
    if (!minutes) return 'Durée inconnue';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? mins : ''}`;
}

/**
 * Formate les horaires de vol
 */
export function formatFlightTimes(segment) {
    if (!segment) return { departure: '--:--', arrival: '--:--', duration: null };
    
    const depTime = segment.departing_at ? new Date(segment.departing_at) : null;
    const arrTime = segment.arriving_at ? new Date(segment.arriving_at) : null;
    
    return {
        departure: depTime ? depTime.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '--:--',
        arrival: arrTime ? arrTime.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '--:--',
        duration: segment.duration ? formatDuration(segment.duration) : null
    };
}