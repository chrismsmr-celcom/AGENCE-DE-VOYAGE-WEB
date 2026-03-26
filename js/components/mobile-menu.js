/**
 * TERRA VOYAGE - MOBILE MENU COMPONENT
 */

export class MobileMenu {
    constructor() {
        this.menu = document.getElementById('mobile-menu');
        this.burger = document.getElementById('menu-btn');
        this.burgerIcon = document.getElementById('burger-icon');
        this.isOpen = false;
        this.init();
    }
    
    init() {
        if (!this.burger) return;
        
        this.burger.addEventListener('click', () => this.toggle());
        
        // Fermer le menu quand on clique sur un lien
        const links = this.menu?.querySelectorAll('a');
        links?.forEach(link => {
            link.addEventListener('click', () => this.close());
        });
        
        // Fermer avec Echap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.menu) {
            this.menu.classList.remove('translate-x-full');
            document.body.style.overflow = 'hidden';
            this.isOpen = true;
        }
        
        if (this.burgerIcon) {
            this.burgerIcon.classList.add('active');
        }
    }
    
    close() {
        if (this.menu) {
            this.menu.classList.add('translate-x-full');
            document.body.style.overflow = '';
            this.isOpen = false;
        }
        
        if (this.burgerIcon) {
            this.burgerIcon.classList.remove('active');
        }
    }
}

// Exporter une instance unique
export const mobileMenu = new MobileMenu();

// Exposer globalement pour les appels inline
window.toggleMenu = () => mobileMenu.toggle();