// Sokoplus Progressive Web App (PWA) Service Worker - Advanced Caching Engine
const CACHE_STATIC_NAME = "sokoplus-static-v3";
const CACHE_FONTS_NAME = "sokoplus-fonts-v3";
const CACHE_IMAGES_NAME = "sokoplus-images-v3";
const CATEGORY_CACHE_NAME = "sokoplus-category-cache-v1";
const OFFLINE_URL = "/index.html";

// Critical app shell static assets to precache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/sitemap.xml",
  "/free_shipping_voucher.jpg",
  "/cash_voucher_bg.jpg",
  "/loyalty_points_voucher.jpg",
  "/artisan_pass_bg.jpg"
];

// Installation event: precache critical app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => {
      console.log("[Service Worker] Precaching app shell assets & offline fallback...");
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation event: purge stale caches and claim clients
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_STATIC_NAME, CACHE_FONTS_NAME, CACHE_IMAGES_NAME, CATEGORY_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!currentCaches.includes(cache)) {
            console.log("[Service Worker] Purging legacy cache storage:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if request targets a dynamic database or auth API
function isBypassedRequest(url) {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebaseapp.com") ||
    url.includes("googleapis.com/identitytoolkit") ||
    url.includes("securetoken.googleapis.com") ||
    url.includes("/api/")
  );
}

// Helper: Identify web font requests (Google Fonts CSS & WOFF2 binary files)
function isFontRequest(request, url) {
  return (
    url.startsWith("https://fonts.googleapis.com") ||
    url.startsWith("https://fonts.gstatic.com") ||
    request.destination === "font" ||
    url.endsWith(".woff2") ||
    url.endsWith(".woff") ||
    url.endsWith(".ttf")
  );
}

// Helper: Identify product images and visual assets
function isImageRequest(request, url) {
  return (
    request.destination === "image" ||
    url.includes("images.unsplash.com") ||
    url.includes("googleusercontent.com") ||
    url.endsWith(".png") ||
    url.endsWith(".jpg") ||
    url.endsWith(".jpeg") ||
    url.endsWith(".webp") ||
    url.endsWith(".gif") ||
    url.endsWith(".svg") ||
    url.endsWith(".ico")
  );
}

// Intercept Network Requests with Tailored Offline Strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests and skip dynamic server APIs
  if (request.method !== "GET" || isBypassedRequest(url)) {
    return;
  }

  // Strategy 1: Page Navigation (SPA Routes) -> Network-First with Offline App Shell Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_STATIC_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          console.log("[Service Worker] Offline detected during navigation. Serving cached app shell:", url);
          return caches.match(OFFLINE_URL).then((cachedShell) => {
            return cachedShell || caches.match("/");
          });
        })
    );
    return;
  }

  // Strategy 2: Web Fonts -> Cache-First with Network Background Revalidation
  if (isFontRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedFont) => {
        if (cachedFont) {
          // Revalidate in background
          fetch(request)
            .then((networkFont) => {
              if (networkFont && (networkFont.status === 200 || networkFont.type === "opaque")) {
                caches.open(CACHE_FONTS_NAME).then((cache) => cache.put(request, networkFont));
              }
            })
            .catch(() => {});
          return cachedFont;
        }

        return fetch(request).then((networkFont) => {
          if (networkFont && (networkFont.status === 200 || networkFont.type === "opaque")) {
            const fontToCache = networkFont.clone();
            caches.open(CACHE_FONTS_NAME).then((cache) => cache.put(request, fontToCache));
          }
          return networkFont;
        });
      })
    );
    return;
  }

  // Strategy 3: Product Images & Visual Assets -> Stale-While-Revalidate / Cache-First Fallback
  if (isImageRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedImage) => {
        if (cachedImage) {
          // Update cache in background
          fetch(request)
            .then((networkImage) => {
              if (networkImage && (networkImage.status === 200 || networkImage.type === "opaque")) {
                caches.open(CACHE_IMAGES_NAME).then((cache) => cache.put(request, networkImage));
              }
            })
            .catch(() => {});
          return cachedImage;
        }

        // Check category pre-warmed cache storage before making network call
        return caches.open(CATEGORY_CACHE_NAME).then((categoryCache) => {
          return categoryCache.match(request).then((categoryCached) => {
            if (categoryCached) return categoryCached;

            return fetch(request)
              .then((networkImage) => {
                if (networkImage && (networkImage.status === 200 || networkImage.type === "opaque")) {
                  const imgToCache = networkImage.clone();
                  caches.open(CACHE_IMAGES_NAME).then((cache) => cache.put(request, imgToCache));
                }
                return networkImage;
              })
              .catch(() => {
                // Return generic placeholder SVG or empty response if offline and not cached
                return new Response(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16">Offline - Image Cached</text></svg>`,
                  { headers: { "Content-Type": "image/svg+xml" } }
                );
              });
          });
        });
      })
    );
    return;
  }

  // Strategy 4: Static JS, CSS, & Local Assets -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === "opaque")) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_STATIC_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listener for client messages (Notifications & Category Cache Warmer)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  // 1. OS Notification trigger
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

  // 2. High-Speed Category Cache Warmer
  if (event.data.type === "WARM_CATEGORY_CACHE") {
    const { urls, categories, networkSpeed } = event.data;
    console.log(`[Service Worker Cache Warmer] Warming ${categories?.length || 0} category assets on ${networkSpeed || 'high-speed'} connection.`);

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
            console.log(`[Service Worker Cache Warmer] Prefetched ${successCount}/${urls.length} category assets to SW cache.`);

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
