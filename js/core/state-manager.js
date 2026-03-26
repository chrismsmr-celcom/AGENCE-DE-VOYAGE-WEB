/**
 * TERRA VOYAGE - STATE MANAGER
 * Gestion d'état réactive et observable
 */

export class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = new Map();
        this._isInitialized = false;
    }
    
    /**
     * Initialise le state manager
     */
    init() {
        if (this._isInitialized) return;
        
        // Charger depuis localStorage
        const saved = localStorage.getItem('terra_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(this.state, parsed);
            } catch (e) {
                console.error('Error loading state:', e);
            }
        }
        
        this._isInitialized = true;
        this._saveToStorage();
    }
    
    /**
     * Récupère une valeur
     */
    get(key) {
        return this.state[key];
    }
    
    /**
     * Définit une valeur et notifie les listeners
     */
    set(key, value, silent = false) {
        const oldValue = this.state[key];
        if (oldValue === value) return;
        
        this.state[key] = value;
        
        if (!silent) {
            this._notify(key, value, oldValue);
        }
        
        this._saveToStorage();
    }
    
    /**
     * Met à jour plusieurs valeurs
     */
    update(updates, silent = false) {
        const changed = [];
        
        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this.state[key];
            if (oldValue !== value) {
                this.state[key] = value;
                changed.push({ key, value, oldValue });
            }
        }
        
        if (!silent) {
            changed.forEach(({ key, value, oldValue }) => {
                this._notify(key, value, oldValue);
            });
        }
        
        this._saveToStorage();
        return changed;
    }
    
    /**
     * S'abonne aux changements d'une clé
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        // Retourne une fonction pour se désabonner
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        };
    }
    
    /**
     * Notifie les listeners d'un changement
     */
    _notify(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key) || [];
        callbacks.forEach(cb => {
            try {
                cb(newValue, oldValue);
            } catch (e) {
                console.error(`Error in listener for ${key}:`, e);
            }
        });
    }
    
    /**
     * Sauvegarde dans localStorage
     */
    _saveToStorage() {
        try {
            localStorage.setItem('terra_state', JSON.stringify(this.state));
        } catch (e) {
            console.error('Error saving state:', e);
        }
    }
    
    /**
     * Réinitialise le state
     */
    reset() {
        this.state = {};
        this.listeners.clear();
        localStorage.removeItem('terra_state');
        this._saveToStorage();
    }
}

// Export d'une instance unique
export const state = new StateManager({
    currentMode: 'flights',
    passengers: { adult: 1, child: 0, infant: 0 },
    travelClass: 'Économique',
    travelClassCode: 'economy',
    tripType: 'round_trip',
    departureDate: '',
    returnDate: '',
    loading: false,
    searchResults: null
});