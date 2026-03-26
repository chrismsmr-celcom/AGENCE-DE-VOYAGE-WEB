/**
 * TERRA VOYAGE - PASSENGER MODAL COMPONENT
 * Gestion du modal de sélection des passagers
 */

import { state } from '../core/state-manager.js';

export class PassengerModal {
    constructor(trigger, modal) {
        this.trigger = trigger;
        this.modal = modal;
        this.isOpen = false;
        this.init();
    }
    
    init() {
        if (!this.trigger || !this.modal) return;
        
        // Ouvrir/fermer au clic sur le trigger
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Fermer en cliquant à l'extérieur
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.modal.contains(e.target) && 
                !this.trigger.contains(e.target)) {
                this.close();
            }
        });
        
        // Écouter les changements de state
        state.subscribe('passengers', () => this.updateCounters());
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.modal.classList.remove('hidden');
        this.isOpen = true;
        this.updateCounters();
    }
    
    close() {
        this.modal.classList.add('hidden');
        this.isOpen = false;
    }
    
    updateCounters() {
        const passengers = state.get('passengers');
        
        const adultSpan = document.getElementById('qty-adult');
        const childSpan = document.getElementById('qty-child');
        const infantSpan = document.getElementById('qty-infant');
        
        if (adultSpan) adultSpan.innerText = passengers.adult;
        if (childSpan) childSpan.innerText = passengers.child;
        if (infantSpan) infantSpan.innerText = passengers.infant;
    }
}