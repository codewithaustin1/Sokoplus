import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Sparkles, Megaphone, Gift, Calendar } from "lucide-react";

export interface MarketingBannerData {
  id: string;
  text: string;
  backgroundColor: string;
  textColor?: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  active: boolean;
  actionText?: string;
  actionUrl?: string;
  closable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function MarketingBanner() {
  const [banners, setBanners] = useState<MarketingBannerData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dismissed banners from localStorage
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("sokoplus_dismissed_banners");
      if (dismissed) {
        setDismissedBannerIds(JSON.parse(dismissed));
      }
    } catch (e) {
      console.error("Failed to load dismissed banners", e);
    }
  }, []);

  // Fetch marketing banners from Firestore
  useEffect(() => {
    let isMounted = true;
    const fetchBanners = async () => {
      try {
        const bannersQuery = query(
          collection(db, "marketing_banners"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(bannersQuery);
        const fetchedBanners: MarketingBannerData[] = [];
        
        const now = new Date();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          
          // Only show banners that are active and within the valid seasonal time frame
          if (data.active === true && start <= now && end >= now) {
            fetchedBanners.push({
              id: docSnap.id,
              ...data,
            } as MarketingBannerData);
          }
        });

        if (isMounted) {
          setBanners(fetchedBanners);
          setLoading(false);
        }
      } catch (error) {
        console.warn("Could not retrieve marketing banners from Firestore: ", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter out banners that the user has already dismissed
  const activeAndVisibleBanners = banners.filter(
    (b) => !dismissedBannerIds.includes(b.id)
  );

  // Auto rotate banners if there are multiple
  useEffect(() => {
    if (activeAndVisibleBanners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeAndVisibleBanners.length);
    }, 7000); // Rotate every 7 seconds for optimal scanning speed

    return () => clearInterval(interval);
  }, [activeAndVisibleBanners.length]);

  if (loading || activeAndVisibleBanners.length === 0) {
    return null;
  }

  // Ensure index remains in bounds after dismissals
  const safeIndex = currentIndex >= activeAndVisibleBanners.length ? 0 : currentIndex;
  const currentBanner = activeAndVisibleBanners[safeIndex];

  if (!currentBanner) return null;

  const handleDismiss = (id: string) => {
    const updated = [...dismissedBannerIds, id];
    setDismissedBannerIds(updated);
    try {
      localStorage.setItem("sokoplus_dismissed_banners", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save dismissed banner State", e);
    }
    // Shift index down if needed
    if (safeIndex >= activeAndVisibleBanners.length - 1 && safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeAndVisibleBanners.length) % activeAndVisibleBanners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeAndVisibleBanners.length);
  };

  // Curate preset background visual classes
  const getBgStyle = (bgClass: string) => {
    const cleanClass = bgClass.trim().toLowerCase();
    
    // Preset gradient themes
    if (cleanClass === "sunset" || cleanClass.includes("orange")) {
      return "bg-gradient-to-r from-orange-600 via-amber-600 to-red-600";
    }
    if (cleanClass === "forest" || cleanClass.includes("emerald") || cleanClass.includes("green")) {
      return "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600";
    }
    if (cleanClass === "ocean" || cleanClass.includes("blue") || cleanClass.includes("indigo")) {
      return "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600";
    }
    if (cleanClass === "royal" || cleanClass.includes("purple") || cleanClass.includes("violet")) {
      return "bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600";
    }
    if (cleanClass === "black" || cleanClass === "solid-black") {
      return "bg-black";
    }
    if (cleanClass === "charcoal" || cleanClass.includes("black") || cleanClass.includes("gray")) {
      return "bg-gradient-to-r from-gray-900 via-slate-800 to-black";
    }
    if (cleanClass === "gold" || cleanClass.includes("amber") || cleanClass.includes("yellow")) {
      return "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600";
    }
    if (cleanClass === "festive" || cleanClass.includes("christmas") || cleanClass.includes("red")) {
      return "bg-gradient-to-r from-red-600 via-rose-700 to-red-800";
    }

    // Default or custom class provided directly by the administrator
    return bgClass;
  };

  // Clean textColor or set to default
  const textStyle = currentBanner.textColor || "text-white";

  return (
    <div 
      id="custom-marketing-banner-container"
      className={`${getBgStyle(currentBanner.backgroundColor)} transition-all duration-500 relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-white/5 pointer-events-none backdrop-blur-[1px]"></div>
      
      {/* Decorative patterns */}
      <div className="absolute -left-12 -top-12 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
      <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left min-h-[44px]">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="space-y-0.5">
              <p className={`text-sm md:text-base font-bold tracking-tight ${textStyle} font-sans leading-tight flex flex-wrap items-center justify-center sm:justify-start gap-1.5`}>
                {currentBanner.text}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 justify-center w-full sm:w-auto">
            {/* Action CTA Link */}
            {currentBanner.actionText && currentBanner.actionUrl && (
              <a
                href={currentBanner.actionUrl}
                className="inline-flex items-center bg-white text-gray-950 hover:bg-gray-50 active:scale-95 px-4.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
              >
                {currentBanner.actionText}
              </a>
            )}

            {/* Slider Navigation controls (shown only when multiple banners exist) */}
            {activeAndVisibleBanners.length > 1 && (
              <div className="flex items-center gap-1.5 bg-black/15 px-2 py-1 rounded-full border border-white/5 shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
                  title="Previous Banner"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-black tracking-widest text-white/90 font-mono px-0.5 select-none">
                  {safeIndex + 1}/{activeAndVisibleBanners.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
                  title="Next Banner"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Configurable Closable Control */}
            {currentBanner.closable !== false && (
              <button
                onClick={() => handleDismiss(currentBanner.id)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
                title="Dismiss Alert"
              >
                <X size={16} />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
