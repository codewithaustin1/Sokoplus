const CACHE_NAME = "sokoplus-pwa-cache-v1";
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
          if (cache !== CACHE_NAME) {
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

// Intercept requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Avoid intercepting non-GET, chrome extension requests, or raw firestore network streams
  if (
    request.method !== "GET" ||
    isFirebaseRequest(request.url) ||
    !request.url.startsWith(self.location.origin) && !request.url.startsWith("https://fonts.googleapis.com") && !request.url.startsWith("https://fonts.gstatic.com")
  ) {
    return;
  }

  // Handle asset-first, network-fallbacks vs network-first depending on content
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached hit, but fetch fresh content in background for static components
        if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.includes("/assets/")) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {/* Ignore background error offline */});
          return cachedResponse;
        }
      }

      // If not cached, or is index/documents, attempt network API fetch with offline fallback
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }

          // Caching clones of newly accessed assets
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // If offline and request fails, fall back to cached version
          if (cachedResponse) {
            return cachedResponse;
          }

          // If navigation document failed, return index.html shell
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// Listener for receiving explicit local triggers from the React front-end application
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    
    // Ensure that self.registration is accessible and Notification permission exists
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
});

// Listener for when a user clicks the SokoPlus local OS/browser notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLinkPath = event.notification.data?.url || "/profile";
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(deepLinkPath);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLinkPath);
      }
    })
  );
});

