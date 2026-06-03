/**
 * Utility to register the static SokoPlus Service Worker for offline asset cache support.
 */
export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[Service Worker] Registration successful on scope:", registration.scope);
        })
        .catch((error) => {
          console.error("[Service Worker] Registration failed:", error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log("[Service Worker] Unregistered successfully.");
      })
      .catch((error) => {
        console.error("[Service Worker] Unregistering failed:", error);
      });
  }
}
