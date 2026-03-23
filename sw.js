const CACHE_NAME = 'makmus-travel-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/hotels.html',
  '/vol.html',
  '/assets/manifest.json',
  '/assets/android-chrome-192x192.png',
  '/assets/android-chrome-512x512.png',
  '/style.css',
  '/package.js',
  '/resultats.html',
  '/package.json',
  '/package-lock.json',
  '/script.js',  
];

// Installation du Service Worker et mise en cache des fichiers statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Intercepter les requêtes pour servir le cache si le réseau échoue
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
