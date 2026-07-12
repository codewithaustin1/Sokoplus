import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, limit, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Product } from "../types";
import { useCurrency } from "../lib/CurrencyContext";
import { useLanguage } from "../lib/LanguageContext";
import { Flame, Star, Sparkles, AlertCircle } from "lucide-react";
import { getCachedProducts } from "../utils/offlineDb";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error in DailyDealsTicker: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function DailyDealsTicker() {
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(30);
  
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "homepage"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.showDailyDeals !== undefined) {
          setEnabled(data.showDailyDeals);
        }
        if (data.dailyDealsSpeed !== undefined) {
          setSpeed(data.dailyDealsSpeed);
        }
      }
    }, (err) => {
      console.warn("Failed to listen to homepage daily deals setting:", err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsPath = "products";
    const q = query(collection(db, productsPath), limit(50));

    const processAndSetProducts = (productList: Product[]) => {
      // Filter for active and approved products
      const activeApproved = productList.filter(
        (p) => p.active !== false && (!p.approvalStatus || p.approvalStatus === "approved")
      );

      // Sort by rating (desc) then reviewCount (desc) to find top trending
      const sorted = activeApproved.sort((a, b) => {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        const reviewsA = a.reviewCount ?? 0;
        const reviewsB = b.reviewCount ?? 0;
        return reviewsB - reviewsA;
      });

      // Top 5 trending products
      setTrendingProducts(sorted.slice(0, 5));
      setLoading(false);
      setError(null);
    };

    const loadFromCache = async () => {
      try {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          processAndSetProducts(cached);
        } else {
          setLoading(false);
        }
      } catch (cacheErr) {
        console.error("Failed to load trending deals from IndexedDB cache:", cacheErr);
        setLoading(false);
      }
    };

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const fetched = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[];

          if (fetched && fetched.length > 0) {
            processAndSetProducts(fetched);
          } else {
            loadFromCache();
          }
        } catch (err) {
          console.warn("Failed to parse real-time snapshot, attempting cache fallback:", err);
          loadFromCache();
        }
      },
      (firestoreErr) => {
        console.warn("Firestore error in DailyDealsTicker onSnapshot, falling back to local cache:", firestoreErr);
        loadFromCache();
      }
    );

    return () => unsubscribe();
  }, []);

  if (!enabled || loading || error || trendingProducts.length === 0) {
    return null; // Gracefully hide the ticker if disabled, loading, error or no trending items are present
  }

  // Duplicate items to ensure seamless infinite looping marquee
  const marqueeItems = [...trendingProducts, ...trendingProducts, ...trendingProducts];

  return (
    <div 
      id="daily-deals-ticker-container"
      className="w-full bg-gradient-to-r from-orange-500/5 via-orange-500/10 to-orange-500/5 dark:from-orange-950/20 dark:via-orange-950/30 dark:to-orange-950/20 border-y border-orange-200/40 dark:border-orange-900/30 py-3 overflow-hidden relative flex items-center transition-all"
    >
      <style>{`
        @keyframes ticker-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-ticker-marquee {
          animation: ticker-marquee ${speed}s linear infinite;
        }
        .animate-ticker-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Static Badge on the left */}
      <div 
        id="daily-deals-ticker-badge"
        className="flex items-center space-x-1.5 px-4 sm:px-6 bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-500 dark:to-amber-500 text-white font-bold text-xs uppercase tracking-wider py-1.5 rounded-r-full shadow-md z-10 whitespace-nowrap select-none shrink-0"
      >
        <Flame className="animate-bounce" size={14} fill="currentColor" />
        <span>{t("dailyDeals")}</span>
        <span className="hidden sm:inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping ml-1" />
      </div>

      {/* Scrolling Content Marquee Wrapper */}
      <div 
        id="daily-deals-ticker-marquee-wrapper"
        className="flex-1 overflow-hidden relative select-none"
      >
        <div 
          id="daily-deals-ticker-marquee-track"
          className="flex items-center space-x-12 animate-ticker-marquee whitespace-nowrap pl-6"
          style={{ width: "fit-content" }}
        >
          {marqueeItems.map((product, idx) => {
            // Apply a consistent mock percentage discount for visual deal engagement (e.g. 5% to 15%)
            const mockDiscountPercent = 5 + (parseInt(product.id.slice(-2), 16) % 11 || 7);
            const originalPrice = product.price / (1 - mockDiscountPercent / 100);

            return (
              <Link
                key={`${product.id}-deal-${idx}`}
                id={`daily-deals-ticker-item-${product.id}-${idx}`}
                to={`/product/${product.id}`}
                className="inline-flex items-center space-x-3.5 group cursor-pointer hover:opacity-95 transition-opacity"
              >
                {/* Product rank badge (only for first duplicate set for perfect consistency) */}
                <div 
                  id={`daily-deals-rank-${product.id}-${idx}`}
                  className="flex items-center justify-center bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold text-[10px] w-5 h-5 rounded-full border border-orange-200/50 dark:border-orange-900/30"
                >
                  #{(idx % 5) + 1}
                </div>

                {/* Thumbnail image */}
                {product.images && product.images.length > 0 && (
                  <div className="w-8 h-8 rounded-md overflow-hidden bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900/20 shrink-0 shadow-sm relative">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {product.name}
                  </span>
                  
                  {/* Localized Price and simulated original price */}
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through">
                    {formatPrice(originalPrice)}
                  </span>

                  {/* Rating display */}
                  <span className="inline-flex items-center space-x-0.5 text-[11px] text-amber-500 dark:text-amber-400 font-medium bg-amber-500/5 dark:bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-500/10">
                    <Star size={10} fill="currentColor" />
                    <span>{product.rating?.toFixed(1) || "4.8"}</span>
                  </span>

                  {/* Discount Percentage Badge */}
                  <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-400/10 px-1.5 py-0.5 rounded">
                    -{mockDiscountPercent}%
                  </span>
                </div>

                {/* Divider bullet */}
                <Sparkles size={10} className="text-orange-400/60 dark:text-orange-500/40 animate-pulse ml-4" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
