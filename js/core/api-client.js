/**
 * TERRA VOYAGE - API CLIENT
 * Gestion des appels API avec retry et cache
 */

const API_BASE_URL = 'https://agence-de-voyage-web.onrender.com/api';

export class ApiClient {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.pendingRequests = new Map();
    }
    
    /**
     * Requête générique avec cache et retry
     */
    async request(endpoint, options = {}, retries = 2) {
        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        
        // Vérifier le cache
        if (options.cache !== false && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes
                return cached.data;
            }
        }
        
        // Éviter les doublons de requêtes
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }
        
        const promise = this._fetchWithRetry(endpoint, options, retries);
        this.pendingRequests.set(cacheKey, promise);
        
        try {
            const data = await promise;
            
            // Mettre en cache
            if (options.cache !== false) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }
    
    /**
     * Fetch avec retry
     */
    async _fetchWithRetry(endpoint, options, retries) {
        const url = `${this.baseUrl}${endpoint}`;
        
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return await response.json();
            } catch (error) {
                if (i === retries) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
    
    /**
     * Recherche de vols
     */
    async searchFlights(params) {
        return this.request('/flights/search', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }
    
    /**
     * Recherche d'hôtels
     */
    async searchHotels(params) {
        return this.request('/hotels/search', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }
    
   /**
     * Recherche de locations (autocomplete) - CORRIGÉ
     */
   async searchLocations(query) {
    if (!query || query.trim().length < 2) return [];
    
    // Annuler la requête précédente si elle existe encore
    if (this.abortController) {
        this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
        const response = await fetch(
            `${this.baseUrl}/locations/search?q=${encodeURIComponent(query)}`,
            { signal: this.abortController.signal }
        );
        
        if (!response.ok) {
            console.error(`Erreur API: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        
        return (data || []).map(item => {
            const code = (item.iata_code || item.code || '').toUpperCase();
            const cityName = item.municipality || item.city || '';
            
            return {
                id: item.id,
                name: item.name || '',
                iata_code: code,
                municipality: cityName,
                iso_country: item.iso_country || '',
                type: item.type || 'airport',
                // On crée un nom d'affichage propre pour ta liste déroulante
                display_name: item.display_name || `${cityName} ${item.name} (${code})`
            };
        });
    } catch (error) {
        if (error.name === 'AbortError') return []; // Ignorer l'erreur d'annulation
        console.error('Erreur searchLocations:', error);
        return [];
    }
}
    
    /**
     * Récupération des packages
     */
    async getPackages() {
        return this.request('/packages', { method: 'GET', cache: true });
    }
    
    /**
     * Récupération des voitures
     */
    async getCars() {
        return this.request('/cars', { method: 'GET', cache: true });
    }
    
    /**
     * Création d'une réservation
     */
    async createBooking(bookingData) {
        return this.request('/checkout', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    }
    
    /**
     * Vérification de la santé de l'API
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
    
    /**
     * Vide le cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export const api = new ApiClient();