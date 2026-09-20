/**
 * Service Worker for YES English Center
 * Provides offline support and caching
 */

const CACHE_NAME = 'yes-english-center-v5';
const STATIC_CACHE = 'yes-static-v5';
const DYNAMIC_CACHE = 'yes-dynamic-v5';
// The reading test must reopen after a refresh with no internet, so its own
// files (and the Firebase SDK it imports) are kept here. Network first:
// students always get the newest version while online.
const READING_CACHE = 'yes-reading-v2';
const DYNAMIC_CACHE_MAX_ENTRIES = 60;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/lang.js',
  '/glass-effects.js',
  '/src/main.js',
  '/image/logo.webp',
  '/image/logo_copy.png',
  '/image/placeholder.svg',
  '/image/no_user.webp'
];

// Keep the dynamic cache from growing without bound (drop oldest first)
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      await cache.delete(keys[0]);
      await trimCache(cacheName, maxEntries);
    }
  } catch (error) {
    // Ignore trim failures
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        // Silently fail if some assets can't be cached
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== READING_CACHE;
          })
          .map((name) => {
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// What the reading test needs to open without internet
function isReadingAsset(url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith('/pages/mock/reading/') ||
      url.pathname.startsWith('/pages/mock/engine/') ||
      url.pathname === '/config.js' ||
      url.pathname === '/image/logo.webp' ||
      url.pathname === '/image/logo_copy.png'
    );
  }
  return url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
}

function networkFirst(request, isNavigation) {
  // `cache: 'reload'` skips the browser's own HTTP cache. Without it this
  // "network first" could still be handed a stale copy by the cache sitting
  // underneath it, which is how an old module once reached a new page.
  return fetch(new Request(request.url, { cache: 'reload', credentials: 'same-origin' }))
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(READING_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() =>
      // a test page opened with a different ?testId is the same page
      caches.match(request, { ignoreSearch: isNavigation }).then((hit) => hit || Response.error())
    );
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip unsupported URL schemes (chrome-extension, chrome, etc.)
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') {
    return;
  }

  // The reading test and what it needs to boot, network first
  if (isReadingAsset(url)) {
    event.respondWith(networkFirst(request, request.mode === 'navigate'));
    return;
  }

  // Skip Firebase and external API requests
  if (
    url.origin.includes('firebase') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('gstatic') ||
    url.origin.includes('unpkg.com') ||
    url.origin.includes('cdn.jsdelivr.net')
  ) {
    return;
  }

  // Skip dashboard SPA - it handles its own caching via Vite hashed assets
  if (url.pathname.startsWith('/pages/dashboard') || url.pathname.startsWith('/settings/') || url.pathname.startsWith('/pages/mock/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Don't cache if URL scheme is unsupported
          if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache dynamic content
          caches.open(DYNAMIC_CACHE).then((cache) => {
            try {
              cache.put(request, responseToCache);
              trimCache(DYNAMIC_CACHE, DYNAMIC_CACHE_MAX_ENTRIES);
            } catch (error) {
              // Silently fail if caching is not possible
            }
          });

          return response;
        })
        .catch(() => {
          // If network fails and it's a navigation request, return offline page
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// Background sync for form submissions (if needed in future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      Promise.resolve()
    );
  }
});
