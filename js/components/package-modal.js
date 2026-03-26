/**
 * TERRA VOYAGE - PACKAGE MODAL COMPONENT
 * Avec carrousel d'images, flèches de navigation et dots
 */

import { packages } from '../data/packages.js';
import { sanitize } from '../utils/validators.js';

export class PackageModal {
    constructor() {
        this.modal = document.getElementById('packageModal');
        this.isOpen = false;
        this.currentImageIndex = 0;
        this.currentImages = [];
        this.autoSlideInterval = null;
        this.init();
    }
    
    init() {
        if (!this.modal) {
            console.warn('PackageModal: élément modal non trouvé');
            return;
        }
        
        // Fermer en cliquant sur l'overlay
        const overlay = this.modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.close());
        }
        
        // Fermer avec Echap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Navigation avec les flèches du clavier
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            if (e.key === 'ArrowLeft') {
                this.prevImage();
            } else if (e.key === 'ArrowRight') {
                this.nextImage();
            }
        });
        
        // Gestion du formulaire
        const form = this.modal.querySelector('#package-quote-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleQuoteRequest();
            });
        }
        
        // Boutons de navigation
        const prevBtn = document.getElementById('modal-prev-btn');
        const nextBtn = document.getElementById('modal-next-btn');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevImage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextImage());
    }
    
    open(packageId) {
        const pkg = packages[packageId];
        if (!pkg) {
            console.error(`Package ${packageId} non trouvé`);
            return;
        }
        
        this.currentImages = pkg.images || [pkg.img];
        this.currentImageIndex = 0;
        
        this.fillModal(pkg);
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        this.isOpen = true;
        
        // Démarrer le diaporama automatique
        this.startAutoSlide();
        
        // Mettre à jour les dots
        this.updateDots();
    }
    
    fillModal(pkg) {
        const title = document.getElementById('modalTitle');
        const tag = document.getElementById('modalTag');
        const desc = document.getElementById('modalDesc');
        const price = document.getElementById('modalPrice');
        const featuresList = document.getElementById('modalFeatures');
        const mainImage = document.getElementById('modalMainImage');
        
        // Mettre à jour le texte
        if (title) title.innerText = sanitize(pkg.title);
        if (tag) tag.innerText = sanitize(pkg.tag);
        if (desc) desc.innerText = sanitize(pkg.desc);
        if (price) price.innerHTML = pkg.priceFormatted;
        
        // Mettre à jour l'image principale
        if (mainImage && this.currentImages[this.currentImageIndex]) {
            mainImage.src = this.currentImages[this.currentImageIndex];
            mainImage.alt = pkg.title;
        }
        
        // Mettre à jour les caractéristiques
        if (featuresList) {
            featuresList.innerHTML = pkg.features.map(f => `
                <li class="flex items-center gap-2 py-1">
                    <i class="fas fa-check-circle text-green-500 text-xs"></i>
                    <span class="text-sm text-gray-700">${sanitize(f)}</span>
                </li>
            `).join('');
        }
        
        // Ajouter la durée si présente
        const durationElement = document.getElementById('modal-duration');
        if (durationElement && pkg.duration) {
            durationElement.innerHTML = `<i class="far fa-clock mr-1"></i> ${pkg.duration}`;
            durationElement.classList.remove('hidden');
        } else if (durationElement) {
            durationElement.classList.add('hidden');
        }
        
        // Générer les dots
        this.generateDots();
    }
    
    generateDots() {
        const dotsContainer = document.getElementById('modal-dots');
        if (!dotsContainer) return;
        
        dotsContainer.innerHTML = '';
        for (let i = 0; i < this.currentImages.length; i++) {
            const dot = document.createElement('button');
            dot.className = `modal-dot ${i === this.currentImageIndex ? 'active' : ''}`;
            dot.setAttribute('data-index', i);
            dot.addEventListener('click', () => this.goToImage(i));
            dotsContainer.appendChild(dot);
        }
    }
    
    updateDots() {
        const dots = document.querySelectorAll('.modal-dot');
        for (let i = 0; i < dots.length; i++) {
            if (i === this.currentImageIndex) {
                dots[i].classList.add('active');
            } else {
                dots[i].classList.remove('active');
            }
        }
    }
    
    updateMainImage() {
        const mainImage = document.getElementById('modalMainImage');
        if (mainImage && this.currentImages[this.currentImageIndex]) {
            // Animation de fondu
            mainImage.style.opacity = '0';
            setTimeout(() => {
                mainImage.src = this.currentImages[this.currentImageIndex];
                mainImage.style.opacity = '1';
            }, 150);
        }
        
        this.updateDots();
    }
    
    nextImage() {
        if (this.currentImages.length <= 1) return;
        
        this.currentImageIndex = (this.currentImageIndex + 1) % this.currentImages.length;
        this.updateMainImage();
        
        // Réinitialiser le timer automatique
        this.resetAutoSlide();
    }
    
    prevImage() {
        if (this.currentImages.length <= 1) return;
        
        this.currentImageIndex = (this.currentImageIndex - 1 + this.currentImages.length) % this.currentImages.length;
        this.updateMainImage();
        
        // Réinitialiser le timer automatique
        this.resetAutoSlide();
    }
    
    goToImage(index) {
        if (index === this.currentImageIndex || index < 0 || index >= this.currentImages.length) return;
        
        this.currentImageIndex = index;
        this.updateMainImage();
        
        // Réinitialiser le timer automatique
        this.resetAutoSlide();
    }
    
    startAutoSlide() {
        // Arrêter tout intervalle existant
        if (this.autoSlideInterval) {
            clearInterval(this.autoSlideInterval);
        }
        
        // Démarrer le diaporama automatique si plus d'une image
        if (this.currentImages.length > 1) {
            this.autoSlideInterval = setInterval(() => {
                if (this.isOpen) {
                    this.nextImage();
                }
            }, 5000);
        }
    }
    
    resetAutoSlide() {
        if (this.autoSlideInterval) {
            clearInterval(this.autoSlideInterval);
            this.startAutoSlide();
        }
    }
    
    handleQuoteRequest() {
        const name = this.modal.querySelector('input[placeholder="Nom"]')?.value;
        const email = this.modal.querySelector('input[placeholder="Email"]')?.value;
        
        if (!name || !email) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        alert(`✨ Merci ${name} !\n\nNotre équipe vous contactera sous 24h pour finaliser votre voyage.`);
        this.close();
    }
    
    close() {
        if (this.modal) {
            // Arrêter le diaporama automatique
            if (this.autoSlideInterval) {
                clearInterval(this.autoSlideInterval);
                this.autoSlideInterval = null;
            }
            
            this.modal.classList.add('hidden');
            this.modal.classList.remove('flex');
            document.body.style.overflow = '';
            this.isOpen = false;
            this.currentImageIndex = 0;
        }
    }
}

export const packageModal = new PackageModal();

// Exposer globalement pour les appels inline
window.openPackageModal = (id) => packageModal.open(id);
window.closePackageModal = () => packageModal.close();