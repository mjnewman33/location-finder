/**
 * Kroger Location Finder PWA - Service Worker
 * Optimized for online-only functionality with offline notification
 */

const CACHE_NAME = 'kroger-finder-cache-v6';

// Cache only essential UI assets (no data)
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './images/kroger-logo.png',
  './images/company-logo.png',
  './images/KLA512.png',
  './images/KLA192.png',
  './images/KLA180.png',
  './images/KLA152.png',
];

// Install event - cache minimal UI assets
self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching minimal UI assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - minimal intervention
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // For API requests, don't interfere
  if (event.request.url.includes('script.google.com')) {
    return;
  }
  
  // For UI assets, use cache if available, otherwise fetch from network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached UI asset
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .catch(error => {
            // If network request fails, the app.js will handle showing
            // the offline notification to the user
            throw error;
          });
      })
  );
});
