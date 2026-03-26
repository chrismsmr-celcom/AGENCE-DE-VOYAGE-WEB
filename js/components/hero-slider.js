/**
 * TERRA VOYAGE - HERO SLIDER COMPONENT
 */

export class HeroSlider {
    constructor() {
        this.slides = document.querySelectorAll('.hero-slide');
        this.currentSlide = 0;
        this.interval = null;
        this.intervalDuration = 5000;
        
        if (this.slides.length > 1) {
            this.init();
        }
    }
    
    init() {
        this.start();
        
        // Pause au survol
        const slider = document.getElementById('slider');
        if (slider) {
            slider.addEventListener('mouseenter', () => this.stop());
            slider.addEventListener('mouseleave', () => this.start());
        }
    }
    
    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.next(), this.intervalDuration);
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    next() {
        this.slides[this.currentSlide].classList.remove('active');
        this.currentSlide = (this.currentSlide + 1) % this.slides.length;
        this.slides[this.currentSlide].classList.add('active');
    }
    
    prev() {
        this.slides[this.currentSlide].classList.remove('active');
        this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
        this.slides[this.currentSlide].classList.add('active');
    }
}

// Exporter une instance unique
export const heroSlider = new HeroSlider();