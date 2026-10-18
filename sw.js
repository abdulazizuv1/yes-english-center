/**
 * Service Worker for YES English Center
 * Provides offline support and caching
 */

const CACHE_NAME = 'yes-english-center-v8';
const STATIC_CACHE = 'yes-static-v8';
const DYNAMIC_CACHE = 'yes-dynamic-v8';
// The reading and listening tests must reopen after a refresh with no
// internet, so their own files (and the Firebase SDK they import) are kept
// here. Network first: students always get the newest version while online.
const TEST_CACHE = 'yes-tests-v4';
// The listening test keeps its recordings here itself (audioStore.js);
// this worker only has to leave that cache alone.
const LISTENING_AUDIO_CACHE = 'yes-listening-audio-v1';
const DYNAMIC_CACHE_MAX_ENTRIES = 60;

// On the local dev server Vite answers one URL differently depending on who
// asks: a stylesheet <link> gets CSS, a plain fetch gets a JS module. A copy
// cached here would be the wrong one (the page came up unstyled), so in
// development this worker caches nothing and serves nothing.
const IS_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

// Assets to cache on install
// The page's CSS and scripts are loaded with a ?v= version (index.html), so
// they are cached as the page requests them rather than listed here.
const STATIC_ASSETS = [
  '/',
  '/index.html',
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
  if (IS_DEV) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // cache: 'reload' goes past the browser's HTTP cache to the server
      const fresh = STATIC_ASSETS.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(fresh).catch((error) => {
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
            return name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== TEST_CACHE && name !== LISTENING_AUDIO_CACHE;
          })
          .map((name) => {
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// What the reading and listening tests need to open without internet
function isTestAsset(url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith('/pages/mock/reading/') ||
      url.pathname.startsWith('/pages/mock/listening/') ||
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
        caches.open(TEST_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
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
  if (IS_DEV) return;
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

  // The reading and listening tests and what they need to boot, network first
  if (isTestAsset(url)) {
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

      // Otherwise fetch from network: for our own files, check with the
      // server first so an old copy in the HTTP cache is never stored here
      const sameOrigin = url.origin === self.location.origin;
      return fetch(sameOrigin ? new Request(request, { cache: 'no-cache' }) : request)
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
          // No network: a page falls back to the saved home page; anything
          // else fails cleanly (returning nothing here made the browser throw
          // "Failed to convert value to 'Response'" for every missing file)
          if (request.mode === 'navigate') {
            return caches.match('/index.html').then((page) => page || Response.error());
          }
          return Response.error();
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
