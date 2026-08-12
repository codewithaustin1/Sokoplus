import { DEFAULT_CATEGORY_IMAGES, getCategoryImageUrl } from "../lib/categoryImages";
import { prefetchImageUrl } from "./imagePrefetcher";
import { Product } from "../types";

export interface NetworkSpeedStatus {
  isHighSpeed: boolean;
  connectionType: string; // e.g. '4g', '3g', 'wifi', 'ethernet', 'unknown'
  downlinkMb: number; // e.g. 10 Mbps
  rttMs: number; // Round-trip time in ms
  saveData: boolean;
  speedLabel: string; // Human-readable e.g. "4G High-Speed (12.5 Mbps)"
  reason?: string;
}

export interface CacheWarmResult {
  triggered: boolean;
  speedInfo: NetworkSpeedStatus;
  urlCount: number;
  categories: string[];
  reason?: string;
}

export interface CacheWarmNotification {
  categories: string[];
  prefetchedCount: number;
  totalUrls: number;
  timestamp: number;
  networkSpeed?: string;
}

export const POPULAR_CATEGORIES = [
  "Local Crafts",
  "Fashion & Apparel",
  "Electronics & Tech",
  "Beauty & Personal Care",
  "Home & Office Décor",
];

/**
 * Assesses the current network connection speed using Network Information API or fallback latency test.
 */
export function getNetworkSpeedStatus(): NetworkSpeedStatus {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isHighSpeed: false,
      connectionType: "unknown",
      downlinkMb: 0,
      rttMs: 0,
      saveData: false,
      speedLabel: "Unknown Network",
      reason: "Server-side environment",
    };
  }

  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (connection) {
    const saveData = Boolean(connection.saveData);
    const effectiveType = connection.effectiveType || "unknown"; // '4g', '3g', '2g', 'slow-2g'
    const downlink = typeof connection.downlink === "number" ? connection.downlink : 5; // Mbps
    const rtt = typeof connection.rtt === "number" ? connection.rtt : 50; // ms

    if (saveData) {
      return {
        isHighSpeed: false,
        connectionType: effectiveType,
        downlinkMb: downlink,
        rttMs: rtt,
        saveData: true,
        speedLabel: "Data Saver Active",
        reason: "User has enabled Data Saver mode",
      };
    }

    const isHighSpeed = effectiveType === "4g" || downlink >= 2.0;
    const speedLabel = isHighSpeed
      ? `High-Speed ${effectiveType.toUpperCase()} (${downlink} Mbps)`
      : `Standard/Low ${effectiveType.toUpperCase()} (${downlink} Mbps)`;

    return {
      isHighSpeed,
      connectionType: effectiveType,
      downlinkMb: downlink,
      rttMs: rtt,
      saveData: false,
      speedLabel,
      reason: isHighSpeed ? undefined : "Connection speed is below 4G/2Mbps threshold",
    };
  }

  // Fallback for browsers without Network Information API (assume high speed if online with fast execution)
  const isOnline = navigator.onLine;
  return {
    isHighSpeed: isOnline,
    connectionType: isOnline ? "broadband" : "offline",
    downlinkMb: isOnline ? 10 : 0,
    rttMs: 30,
    saveData: false,
    speedLabel: isOnline ? "High-Speed Broadband" : "Offline",
    reason: isOnline ? undefined : "Device is currently offline",
  };
}

/**
 * Collects target asset URLs to prefetch for popular product categories.
 */
export function getPopularCategoryAssets(
  customCategoryImages?: Record<string, string>,
  products?: Product[]
): { categories: string[]; urls: string[] } {
  const urlSet = new Set<string>();

  // 1. Category route endpoints for popular categories
  POPULAR_CATEGORIES.forEach((cat) => {
    urlSet.add(`/?category=${encodeURIComponent(cat)}`);
  });

  // 2. Main category banner image URLs
  POPULAR_CATEGORIES.forEach((cat) => {
    const imgUrl = getCategoryImageUrl(cat, customCategoryImages);
    if (imgUrl && typeof imgUrl === "string") {
      urlSet.add(imgUrl);
    }
  });

  // Also include all default category fallback images to ensure zero visual pop-in
  Object.values(DEFAULT_CATEGORY_IMAGES).forEach((imgUrl) => {
    if (imgUrl) urlSet.add(imgUrl);
  });

  // 3. Extract top-rated product thumbnail images belonging to popular categories
  if (products && Array.isArray(products)) {
    const popularProducts = products.filter((p) =>
      POPULAR_CATEGORIES.some(
        (popCat) =>
          p.category?.toLowerCase().includes(popCat.toLowerCase()) ||
          popCat.toLowerCase().includes(p.category?.toLowerCase() || "")
      )
    );

    // Pick up to 2 top products per popular category to avoid over-fetching
    popularProducts.slice(0, 15).forEach((p) => {
      if (p.images && Array.isArray(p.images)) {
        p.images.slice(0, 2).forEach((img) => {
          if (img) urlSet.add(img);
        });
      }
    });
  }

  return {
    categories: [...POPULAR_CATEGORIES],
    urls: Array.from(urlSet),
  };
}

/**
 * Triggers the Service Worker Cache Warmer for popular product categories when high-speed internet is detected.
 */
export async function warmCategoryCache(
  customCategoryImages?: Record<string, string>,
  products?: Product[]
): Promise<CacheWarmResult> {
  const speedInfo = getNetworkSpeedStatus();

  if (!speedInfo.isHighSpeed || speedInfo.saveData) {
    console.log(
      `[Cache Warmer] Skipping category cache warming. Reason: ${speedInfo.reason || "Slow network"}`
    );
    return {
      triggered: false,
      speedInfo,
      urlCount: 0,
      categories: POPULAR_CATEGORIES,
      reason: speedInfo.reason || "Slow network connection",
    };
  }

  const { categories, urls } = getPopularCategoryAssets(customCategoryImages, products);

  if (urls.length === 0) {
    return {
      triggered: false,
      speedInfo,
      urlCount: 0,
      categories,
      reason: "No asset URLs available to prefetch",
    };
  }

  // 1. Client-side memory image prefetch for ultra-fast local rendering
  urls.forEach((url) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
      prefetchImageUrl(url).catch(() => {});
    }
  });

  // 2. Dispatch message to Service Worker for persistent SW Cache storage
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    const registerWorkerAndPost = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const targetWorker = navigator.serviceWorker.controller || registration.active;

        if (targetWorker) {
          targetWorker.postMessage({
            type: "WARM_CATEGORY_CACHE",
            categories,
            urls,
            networkSpeed: speedInfo.speedLabel,
          });
          console.log(
            `[Cache Warmer] Dispatched WARM_CATEGORY_CACHE command to Service Worker for ${urls.length} popular category assets.`
          );
        }
      } catch (err) {
        console.warn("[Cache Warmer] Could not dispatch message to Service Worker:", err);
      }
    };

    registerWorkerAndPost();
  }

  return {
    triggered: true,
    speedInfo,
    urlCount: urls.length,
    categories,
  };
}

// Subscriptions for SW Cache Warm completion events
type CacheWarmListener = (event: CacheWarmNotification) => void;
const listeners = new Set<CacheWarmListener>();

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "CACHE_WARM_COMPLETE") {
      listeners.forEach((listener) => listener(event.data));
    }
  });
}

export function subscribeToCacheWarmEvents(listener: CacheWarmListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
