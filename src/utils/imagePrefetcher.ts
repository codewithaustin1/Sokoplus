/**
 * High-performance, zero-dependencies client-side Image Prefetcher for Sokoplus.
 * Leverages native browser caching to ensure 0ms latency image transitions.
 */

const preloadedUrls = new Set<string>();

/**
 * Prefetches an image URL into the browser cache
 */
export function prefetchImageUrl(url: string): Promise<string> {
  if (!url || typeof url !== "string") {
    return Promise.resolve("");
  }
  
  const trimmed = url.trim();
  if (trimmed === "" || preloadedUrls.has(trimmed)) {
    return Promise.resolve(trimmed);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    
    img.onload = () => {
      preloadedUrls.add(trimmed);
      resolve(trimmed);
    };
    
    img.onerror = () => {
      // Resolve anyway to avoid blocking execution lists
      resolve(trimmed);
    };
    
    img.src = trimmed;
  });
}

/**
 * Prefetches all images associated with a product object
 * This ensures both the main thumbnail AND detail page sub-images are loaded
 */
export function prefetchProductAssets(product: { id: string; images?: string[] }): void {
  if (!product || !product.images || !Array.isArray(product.images)) return;
  
  // Filter and prefetch all valid, non-empty image URLs
  const validImages = product.images.filter(img => typeof img === "string" && img.trim() !== "");
  
  if (validImages.length === 0) return;

  // Prefetch the first image (primary) with highest priority
  prefetchImageUrl(validImages[0]).then(() => {
    // Prefetch remaining gallery images in the background
    if (validImages.length > 1) {
      Promise.all(validImages.slice(1).map(url => prefetchImageUrl(url)))
        .catch(err => console.debug("Gallery prefetch bypassed:", err));
    }
  }).catch(err => console.debug("Primary asset prefetch bypassed:", err));
}

/**
 * Checks if an image has already been logged as preloaded/cached
 */
export function isImagePrecached(url: string): boolean {
  if (!url) return false;
  return preloadedUrls.has(url.trim());
}
