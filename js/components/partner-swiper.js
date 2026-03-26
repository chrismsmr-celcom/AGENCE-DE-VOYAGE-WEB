/**
 * TERRA VOYAGE - PARTNER SWIPER COMPONENT
 */

export class PartnerSwiper {
    constructor() {
        this.swiper = null;
        this.init();
    }
    
    init() {
        if (typeof Swiper === 'undefined') {
            console.warn('Swiper non chargé');
            return;
        }
        
        const container = document.querySelector('.partnerSwiper');
        if (!container) return;
        
        this.swiper = new Swiper('.partnerSwiper', {
            slidesPerView: 2,
            spaceBetween: 30,
            loop: true,
            autoplay: {
                delay: 2500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true
            },
            breakpoints: {
                640: { slidesPerView: 3 },
                768: { slidesPerView: 4 },
                1024: { slidesPerView: 5 }
            },
            on: {
                init: () => console.log('Partner swiper initialized'),
                autoplayStart: () => console.log('Autoplay started')
            }
        });
    }
}

// Exporter une instance unique
export const partnerSwiper = new PartnerSwiper();