const CACHE_NAME = "sokoplus-pwa-cache-v2";
const CATEGORY_CACHE_NAME = "sokoplus-category-cache-v1";
const OFFLINE_URL = "/index.html";

// Static assets to match initial shell
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico"
];

// Installation event: cache the critical app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets...");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation event: cleanup outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== CATEGORY_CACHE_NAME) {
            console.log("[Service Worker] Removing old cache storage:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if request is a Firestore database or Firebase Auth endpoint
function isFirebaseRequest(url) {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebaseapp.com") ||
    url.includes("googleapis.com/identitytoolkit") ||
    url.includes("securetoken.googleapis.com")
  );
}

// Helper: Check if domain is allowed for caching (same-origin, Google Fonts, Unsplash / CDNs, or images)
function isCacheableRequest(request, url) {
  if (request.method !== "GET" || isFirebaseRequest(request.url)) {
    return false;
  }
  if (url.startsWith(self.location.origin)) return true;
  if (url.startsWith("https://fonts.googleapis.com") || url.startsWith("https://fonts.gstatic.com")) return true;
  if (url.includes("images.unsplash.com") || request.destination === "image") return true;
  return false;
}

// Intercept requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  if (!isCacheableRequest(request, url)) {
    return;
  }

  // Cache-first with network background revalidation strategy for images and category assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Background revalidation for CSS, JS, assets, and images
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === "opaque")) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {/* Offline fallback, preserve cached response */});
        return cachedResponse;
      }

      // Check category pre-warmed cache storage if not found in primary cache
      return caches.open(CATEGORY_CACHE_NAME).then((categoryCache) => {
        return categoryCache.match(request).then((catCached) => {
          if (catCached) return catCached;

          // Network request with cache store on success
          return fetch(request)
            .then((networkResponse) => {
              if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== "opaque")) {
                return networkResponse;
              }

              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });

              return networkResponse;
            })
            .catch(() => {
              if (cachedResponse) return cachedResponse;
              if (request.mode === "navigate") {
                return caches.match(OFFLINE_URL);
              }
            });
        });
      });
    })
  );
});

// Listener for messages from the React client (Notifications & Cache Warmer)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  // 1. Local OS Notification trigger
  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    if (self.registration) {
      event.waitUntil(
        self.registration.showNotification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [100, 50, 100],
          ...options
        })
      );
    }
  }

  // 2. High-Speed Internet Category Cache Warmer
  if (event.data.type === "WARM_CATEGORY_CACHE") {
    const { urls, categories, networkSpeed } = event.data;
    console.log(`[Service Worker Cache Warmer] Received cache warming command for ${categories?.length || 0} popular categories on ${networkSpeed || 'high-speed'} connection.`);

    if (Array.isArray(urls) && urls.length > 0) {
      event.waitUntil(
        caches.open(CATEGORY_CACHE_NAME).then((categoryCache) => {
          return Promise.allSettled(
            urls.map((targetUrl) => {
              const fetchOptions = targetUrl.startsWith(self.location.origin) 
                ? { cache: "reload" } 
                : { mode: "no-cors" };

              return fetch(targetUrl, fetchOptions)
                .then((res) => {
                  if (res && (res.status === 200 || res.type === "opaque")) {
                    return categoryCache.put(targetUrl, res);
                  }
                })
                .catch((err) => {
                  console.warn("[Cache Warmer] Could not prefetch asset:", targetUrl, err);
                });
            })
          ).then((results) => {
            const successCount = results.filter((r) => r.status === "fulfilled").length;
            console.log(`[Service Worker Cache Warmer] Successfully pre-warmed ${successCount}/${urls.length} category assets into persistent cache!`);

            // Notify all open client tabs of completed cache warming
            return self.clients.matchAll({ type: "window" }).then((clients) => {
              clients.forEach((client) => {
                client.postMessage({
                  type: "CACHE_WARM_COMPLETE",
                  categories,
                  prefetchedCount: successCount,
                  totalUrls: urls.length,
                  timestamp: Date.now(),
                  networkSpeed
                });
              });
            });
          });
        })
      );
    }
  }
});
