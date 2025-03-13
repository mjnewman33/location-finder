/**
 * Kroger Location Finder PWA - Service Worker
 * Optimized for online-only functionality with offline notification
 */

const CACHE_NAME = 'kroger-finder-cache-v11'; // Incremented version number
const CSS_CACHE_NAME = 'kroger-finder-css-cache'; // Separate cache for CSS

// Cache only essential UI assets (no data)
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
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
        cacheNames.filter(cacheName => {
          // Keep the CSS cache, delete all other old caches
          return cacheName !== CACHE_NAME && cacheName !== CSS_CACHE_NAME;
        }).map(cacheName => {
          console.log('[Service Worker] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Clear the CSS cache on activation to ensure fresh CSS
      return caches.delete(CSS_CACHE_NAME).then(() => {
        console.log('[Service Worker] CSS cache cleared for fresh updates');
        return self.clients.claim();
      });
    })
  );
});

// Fetch event - with CSS special handling
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // For API requests, don't interfere
  if (event.request.url.includes('script.google.com')) {
    return;
  }
  
  // Special handling for CSS files - network first, then cache
  if (event.request.url.endsWith('.css') || event.request.url.includes('.css?')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh CSS response
          const responseClone = response.clone();
          caches.open(CSS_CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
            console.log('[Service Worker] Updated CSS cache');
          });
          return response;
        })
        .catch(error => {
          // If network fails, try the cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            throw error;
          });
        })
    );
    return;
  }
  
  // For other UI assets, use cache if available, otherwise fetch from network
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

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CSS_CACHE') {
    caches.delete(CSS_CACHE_NAME).then(() => {
      console.log('[Service Worker] CSS cache cleared by request');
      event.ports[0].postMessage({ result: 'CSS cache cleared' });
    });
  }
});
