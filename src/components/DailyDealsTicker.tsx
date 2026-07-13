import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, limit, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Product } from "../types";
import { useCurrency } from "../lib/CurrencyContext";
import { useLanguage } from "../lib/LanguageContext";
import { useSettings } from "../lib/SettingsContext";
import { Star, AlertCircle } from "lucide-react";
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
  const [serverOffset, setServerOffset] = useState<number>(0);
  
  const { settings } = useSettings();
  const enabled = settings.showDailyDeals;
  const speed = settings.dailyDealsSpeed;
  const hours = settings.dailyDealsHours;
  const anchorTime = settings.anchorTime;

  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  const [timeLeft, setTimeLeft] = useState({ hours: 24, minutes: 0, seconds: 0 });

  // Sync client clock with server's time using HEAD requests
  useEffect(() => {
    let active = true;
    const syncClock = async () => {
      try {
        const startTime = Date.now();
        // Request the main page head to inspect response Date header (highly standard, fast, and light)
        const response = await fetch("/", { method: "HEAD" });
        if (!active) return;
        const endTime = Date.now();
        const serverDateStr = response.headers.get("date");
        if (serverDateStr) {
          const serverTime = new Date(serverDateStr).getTime();
          const rtt = endTime - startTime;
          const adjustedServerTime = serverTime + (rtt / 2);
          setServerOffset(adjustedServerTime - endTime);
        }
      } catch (err) {
        console.warn("Failed to sync clock with server, using local time:", err);
      }
    };

    syncClock();
    // Re-sync clock every 3 minutes to maintain high-precision synchrony across devices
    const interval = setInterval(syncClock, 3 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      const nowMs = Date.now() + serverOffset;
      const cycleMs = hours * 60 * 60 * 1000;
      
      // Align cycle start with when the admin last saved/updated settings in Firestore
      const baseAnchor = anchorTime || 0;
      const elapsed = nowMs - baseAnchor;
      
      // Standardize elapsed to start from 0 if anchor is slightly in the future
      const currentCycleElapsed = elapsed > 0 ? (elapsed % cycleMs) : 0;
      const diff = cycleMs - currentCycleElapsed;
      
      if (diff > 0) {
        const totalSeconds = Math.floor(diff / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        setTimeLeft({ hours: h, minutes: m, seconds: s });
      } else {
        setTimeLeft({ hours: hours - 1, minutes: 59, seconds: 59 });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hours, anchorTime, serverOffset]);

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

    const fetchOnline = async () => {
      try {
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];

        if (fetched && fetched.length > 0) {
          processAndSetProducts(fetched);
        } else {
          await loadFromCache();
        }
      } catch (err) {
        console.warn("Failed to fetch products online for DailyDealsTicker, using cache:", err);
        await loadFromCache();
      }
    };

    // Load from cache first for immediate render, then pull from network non-blockingly
    loadFromCache().then(() => {
      if (navigator.onLine) {
        fetchOnline();
      }
    });
  }, []);

  if (!enabled || loading || error || trendingProducts.length === 0) {
    return null; // Gracefully hide the ticker if disabled, loading, error or no trending items are present
  }

  // Duplicate items to ensure seamless infinite looping marquee
  const marqueeItems = [...trendingProducts, ...trendingProducts, ...trendingProducts];

  return (
    <div 
      id="daily-deals-ticker-container"
      className="w-full bg-[#fcfbfa] dark:bg-gray-900 border-y border-gray-200/50 dark:border-gray-800/50 h-[116px] overflow-hidden relative flex items-stretch transition-all select-none"
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

      {/* Solid Orange Badge with integrated countdown timer taking full height on the left */}
      <div 
        id="daily-deals-ticker-badge-container"
        className="flex flex-col justify-center items-center px-6 sm:px-8 bg-gradient-to-b from-[#ff5700] to-[#e64a00] dark:from-[#e64a00] dark:to-[#cc4100] text-white z-10 shrink-0 shadow-lg relative border-r border-orange-600/30"
      >
        <span className="font-sans font-black text-lg sm:text-xl tracking-tight uppercase leading-none mb-2 text-center text-white drop-shadow-sm">
          {t("dailyDeals")}
        </span>
        <div className="flex items-center space-x-1 text-xs font-bold">
          <div className="bg-[#e9ecef] dark:bg-gray-800 text-[#212529] dark:text-gray-100 font-mono font-black px-2 py-0.5 rounded shadow-sm text-sm min-w-[28px] text-center border border-gray-300/20">
            {String(timeLeft.hours).padStart(2, "0")}
          </div>
          <span className="text-white font-extrabold animate-pulse">:</span>
          <div className="bg-[#e9ecef] dark:bg-gray-800 text-[#212529] dark:text-gray-100 font-mono font-black px-2 py-0.5 rounded shadow-sm text-sm min-w-[28px] text-center border border-gray-300/20">
            {String(timeLeft.minutes).padStart(2, "0")}
          </div>
          <span className="text-white font-extrabold animate-pulse">:</span>
          <div className="bg-[#e9ecef] dark:bg-gray-800 text-[#212529] dark:text-gray-100 font-mono font-black px-2 py-0.5 rounded shadow-sm text-sm min-w-[28px] text-center border border-gray-300/20">
            {String(timeLeft.seconds).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Scrolling Content Marquee Wrapper */}
      <div 
        id="daily-deals-ticker-marquee-wrapper"
        className="flex-1 overflow-hidden relative flex items-center"
      >
        <div 
          id="daily-deals-ticker-marquee-track"
          className="flex items-center space-x-5 animate-ticker-marquee whitespace-nowrap pl-5"
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
                className="inline-flex items-center space-x-4 bg-white dark:bg-gray-950 px-4.5 py-2.5 rounded-2xl border border-gray-150/80 dark:border-gray-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-orange-400 dark:hover:border-orange-500 transition-all duration-300 group shrink-0"
              >
                {/* Thumbnail Image container with discount badge overlay */}
                <div className="relative shrink-0">
                  {product.images && product.images.length > 0 && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm relative">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  {/* Floating Discount Badge at top-left corner */}
                  <div className="absolute -top-1.5 -left-1.5 bg-[#ff4e00] text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm z-10 whitespace-nowrap uppercase tracking-wider">
                    -{mockDiscountPercent}% OFF
                  </div>
                </div>

                {/* Info Container */}
                <div className="flex flex-col space-y-0.5">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-150 truncate max-w-[140px] sm:max-w-[180px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-snug">
                    {product.name}
                  </span>
                  
                  {/* Rating Badge */}
                  <span className="inline-flex items-center space-x-0.5 text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/40 w-fit">
                    <Star size={10} fill="currentColor" className="text-amber-500" />
                    <span>{product.rating?.toFixed(1) || "4.8"}</span>
                  </span>

                  {/* Pricing Info */}
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                      {formatPrice(product.price)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through font-medium">
                      {formatPrice(originalPrice)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
