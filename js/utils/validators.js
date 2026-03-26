/**
 * TERRA VOYAGE - VALIDATORS
 * Fonctions de validation et utilitaires
 */

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Valide un email
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return re.test(email);
}

/**
 * Valide un code IATA
 */
export function isValidIATA(code) {
    const re = /^[A-Z]{3}$/;
    return re.test(code);
}

/**
 * Valide une date
 */
export function isValidDate(date) {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
}

/**
 * Sanitize une string (prévention XSS)
 */
export function sanitize(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}