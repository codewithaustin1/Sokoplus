import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { isImagePrecached, prefetchImageUrl } from "../utils/imagePrefetcher";
import { ShoppingBag } from "lucide-react";

interface FastImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIconSize?: number;
  priority?: boolean; // Set to true for hero banners or critical above-the-fold images
  aspectRatio?: string; // Optional custom aspect ratio class, e.g. "aspect-square" or "aspect-video"
}

// Built-in base64 SVG premium skeleton sequence to prevent layout shifts
const PLACEHOLDER_SVG = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIG9mZnNldD0iNSUiIHN0b3AtY29sb3I9IiNmOWZhYmIiLz48c3RvcCBvZmZzZXQ9IjI1JSIgc3RvcC1jb2xvcj0iI2YxZjVmOSIvPjxzdG9wIG9mZnNldD0iMzUlIiBzdG9wLWNvbG9yPSIjZjlmYWJiIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==`;

export function FastImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackIconSize = 40,
  priority = false,
  aspectRatio = "aspect-square",
}: FastImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const cleanSrc = src ? src.trim() : "";
  const isPrecached = cleanSrc ? isImagePrecached(cleanSrc) : false;

  // Initialize load state immediately if cached or running SSG/SSR
  useEffect(() => {
    if (isPrecached) {
      setIsLoaded(true);
    }
  }, [cleanSrc, isPrecached]);

  // Viewport-based prefetching
  useEffect(() => {
    if (!cleanSrc || isLoaded || priority) return;

    if ("IntersectionObserver" in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Trigger priority prefetch on viewport entry
              prefetchImageUrl(cleanSrc).then(() => {
                setIsLoaded(true);
              });
              // Stop observing once prefetch begins
              if (observerRef.current && containerRef.current) {
                observerRef.current.unobserve(containerRef.current);
              }
            }
          });
        },
        { rootMargin: "250px" } // Load images 250px before they enter view for perfect buffer
      );

      if (containerRef.current) {
        observerRef.current.observe(containerRef.current);
      }
    } else {
      // Fallback for older browsers
      setIsLoaded(true);
    }

    return () => {
      if (observerRef.current && containerRef.current) {
        observerRef.current.unobserve(containerRef.current);
      }
    };
  }, [cleanSrc, isLoaded, priority]);

  // Helper to determine if className already specifies custom aspect
  const hasCustomAspect = className.includes("aspect-") || className.includes("h-");
  const aspectClass = hasCustomAspect ? "" : aspectRatio;

  if (!cleanSrc) {
    return (
      <div className={`w-full h-full ${aspectClass} bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 rounded-inherit overflow-hidden`}>
        <ShoppingBag size={fallbackIconSize} />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full ${aspectClass} bg-gray-100 dark:bg-gray-800 overflow-hidden select-none shrink-0`}
      style={{
        backgroundImage: `url("${PLACEHOLDER_SVG}")`,
        backgroundSize: "cover"
      }}
    >
      {/* Real Image Layer */}
      {!hasError && (
         <img
           referrerPolicy="no-referrer"
           src={cleanSrc}
           alt={alt}
           loading={priority ? "eager" : "lazy"}
           onLoad={() => setIsLoaded(true)}
           onError={() => setHasError(true)}
           className={`${className} transition-opacity duration-300 ${
             isLoaded ? "opacity-100" : "opacity-0"
           }`}
         />
      )}

      {/* Immediate blur state or error state if fails to load */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 z-10">
          <ShoppingBag size={fallbackIconSize} />
        </div>
      )}
    </div>
  );
}
