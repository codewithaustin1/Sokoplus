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
      className="w-full bg-gradient-to-r from-orange-50/40 via-orange-100/20 to-orange-50/40 dark:from-orange-950/10 dark:via-orange-900/10 dark:to-orange-950/10 border-y border-orange-200/50 dark:border-orange-900/30 py-3.5 overflow-hidden relative flex items-center transition-all"
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
        className="flex items-center space-x-2 px-5 sm:px-6 bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 dark:from-orange-500 dark:via-amber-500 dark:to-red-500 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-r-full shadow-lg z-10 whitespace-nowrap select-none shrink-0"
      >
        <Flame className="animate-bounce text-yellow-300" size={15} fill="currentColor" />
        <span className="font-extrabold">{t("dailyDeals")}</span>
        <span className="hidden sm:inline-block w-2 h-2 bg-green-400 rounded-full animate-ping ml-1" />
      </div>

      {/* Scrolling Content Marquee Wrapper */}
      <div 
        id="daily-deals-ticker-marquee-wrapper"
        className="flex-1 overflow-hidden relative select-none"
      >
        <div 
          id="daily-deals-ticker-marquee-track"
          className="flex items-center space-x-6 animate-ticker-marquee whitespace-nowrap pl-6"
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
                className="inline-flex items-center space-x-3.5 bg-white/90 dark:bg-gray-900/90 hover:bg-white dark:hover:bg-gray-950 backdrop-blur-md px-4.5 py-2.5 rounded-2xl border border-orange-200/50 dark:border-orange-900/30 shadow-sm hover:shadow-md hover:border-orange-500 dark:hover:border-orange-600 transition-all duration-300 group shrink-0"
              >
                {/* Image and Rank container */}
                <div className="relative shrink-0">
                  {product.images && product.images.length > 0 && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900/20 shadow-inner relative">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="absolute -top-1.5 -left-1.5 flex items-center justify-center bg-gradient-to-br from-orange-600 to-amber-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full shadow-sm border border-white dark:border-gray-900">
                    #{(idx % 5) + 1}
                  </div>
                </div>

                {/* Info Container */}
                <div className="flex flex-col space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-gray-800 dark:text-gray-150 truncate max-w-[120px] sm:max-w-[150px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {product.name}
                    </span>
                    <span className="inline-flex items-center space-x-0.5 text-[9px] text-amber-500 font-semibold bg-amber-500/5 px-1 rounded">
                      <Star size={9} fill="currentColor" />
                      <span>{product.rating?.toFixed(1) || "4.8"}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                      {formatPrice(product.price)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through font-medium">
                      {formatPrice(originalPrice)}
                    </span>
                  </div>

                  {/* Stock Bar Indicator to enhance graphical richness */}
                  <div className="w-full bg-gray-100/80 dark:bg-gray-850/80 h-1 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full animate-pulse"
                      style={{ width: `${(parseInt(product.id.slice(-2), 16) % 35) + 40}%` }}
                    />
                  </div>
                </div>

                {/* Discount Badge */}
                <div className="pl-1 shrink-0">
                  <div className="flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 text-white font-black text-[10px] px-2 py-1.5 rounded-xl shadow-sm tracking-tighter uppercase leading-none">
                    <span>-{mockDiscountPercent}%</span>
                    <span className="text-[7px] font-medium tracking-normal text-orange-100 uppercase mt-0.5">off</span>
                  </div>
                </div>

                {/* Divider bullet */}
                <Sparkles size={11} className="text-orange-400/60 dark:text-orange-500/40 animate-pulse ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
