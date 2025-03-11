/**
 * Kroger Location Finder PWA - Service Worker
 * Focused on performance enhancement without offline functionality
 */

const CACHE_NAME = 'kroger-finder-cache-v2';

// Assets to cache for performance improvement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/images/kroger-logo.png',
  '/images/company-logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

/**
 * Installation event handler
 * Caches static assets for performance
 */
self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching static assets for performance');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

/**
 * Activation event handler
 * Cleans up old caches
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event handler
 * Implements a network-first strategy for all requests
 * Only uses cache as a performance optimization
 */
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // For API requests, always use network
  if (event.request.url.includes('script.google.com')) {
    return;
  }
  
  // For static assets, use network-first with caching
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for future performance
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(error => {
        console.log('[Service Worker] Network request failed, trying cache');
        return caches.match(event.request);
      })
  );
});
