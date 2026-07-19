import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, Gift, Percent, Tag, ShieldCheck } from "lucide-react";
import { fetchMarketingBanners, MarketingBannerData as PromoBannerData } from "../utils/bannerCache";
import { useSettings } from "../lib/SettingsContext";

export default function PromotionalBanner() {
  const { settings } = useSettings();
  const [promos, setPromos] = useState<PromoBannerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!settings.promotionalBannersEnabled) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const fetchPromos = async () => {
      try {
        const fetchedList = await fetchMarketingBanners();
        const activePromos: PromoBannerData[] = [];
        const now = new Date();

        fetchedList.forEach((data) => {
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);

          if (data.active === true && start <= now && end >= now) {
            activePromos.push(data);
          }
        });

        // Filter out any that don't match or have expired
        if (isMounted) {
          setPromos(activePromos);
          setLoading(false);
        }
      } catch (error) {
        console.warn("Could not retrieve promotional banners: ", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPromos();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto transition every 6 seconds
  useEffect(() => {
    if (promos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [promos.length]);

  if (!settings.promotionalBannersEnabled || loading || promos.length === 0) {
    return null;
  }

  const currentPromo = promos[currentIndex];

  const getBgClass = (bgVal: string) => {
    const clean = bgVal.trim().toLowerCase();
    switch (clean) {
      case "sunset":
      case "sunset orange":
        return "bg-gradient-to-r from-orange-600 via-amber-600 to-red-650";
      case "ocean":
      case "ocean Indigo":
        return "bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600";
      case "royal":
      case "royal purple":
        return "bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600";
      case "charcoal":
      case "charcoal dark":
        return "bg-gradient-to-r from-gray-900 via-slate-800 to-black";
      case "gold":
      case "amber gold":
        return "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600";
      case "festive":
      case "festive red":
        return "bg-gradient-to-r from-red-600 via-rose-700 to-red-800";
      case "forest":
      case "forest green":
        return "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600";
      case "black":
      case "solid-black":
      case "solid black":
        // A super high-end deep black background styled with rich dark borders and a premium mesh/satin sheen
        return "bg-black text-white border border-gray-900 shadow-[0_4px_30px_rgba(0,0,0,0.8)]";
      default:
        return bgVal.startsWith("bg-") ? bgVal : "bg-gradient-to-r from-orange-600 to-amber-600";
    }
  };

  const isBlackTheme = ["black", "solid-black", "solid black"].includes(currentPromo.backgroundColor.trim().toLowerCase());

  // Render elegant contextual icon based on text
  const getContextIcon = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("percent") || lower.includes("%") || lower.includes("off") || lower.includes("discount")) {
      return <Percent className="text-orange-400" size={18} />;
    }
    if (lower.includes("gift") || lower.includes("free") || lower.includes("reward")) {
      return <Gift className="text-orange-400" size={18} />;
    }
    if (lower.includes("shipping") || lower.includes("deliver") || lower.includes("delivery")) {
      return <ShieldCheck className="text-orange-400" size={18} />;
    }
    return <Sparkles className="text-orange-400" size={18} />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8" id="home-featured-promotional-banner">
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-gray-100/10 transition-all duration-500">
        
        {/* Animated Slide Transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPromo.id}
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={`w-full min-h-[140px] md:min-h-[160px] flex items-center p-6 md:p-8 relative ${getBgClass(currentPromo.backgroundColor)}`}
          >
            {/* Satin/mesh premium overlay */}
            <div className={`absolute inset-0 pointer-events-none ${isBlackTheme ? "opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black" : "bg-white/5 backdrop-blur-[0.5px]"}`} />

            {/* Premium geometric shapes */}
            {isBlackTheme ? (
              <>
                <div className="absolute top-0 right-1/4 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-neutral-800/40 rounded-full blur-2xl pointer-events-none" />
              </>
            ) : (
              <>
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-black/10 rounded-full blur-xl pointer-events-none" />
              </>
            )}

            <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex items-center gap-4 text-left">
                {/* Decorative icon wrapper */}
                <div className={`hidden sm:flex shrink-0 p-3 rounded-2xl ${isBlackTheme ? "bg-neutral-900 border border-neutral-800 text-orange-500" : "bg-white/15 text-white"}`}>
                  {getContextIcon(currentPromo.text)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isBlackTheme ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "bg-white/20 text-white"}`}>
                      Featured Offer
                    </span>
                    {promos.length > 1 && (
                      <span className={`text-[10px] font-mono font-bold tracking-tight ${isBlackTheme ? "text-neutral-505" : "text-white/70"}`}>
                        ({currentIndex + 1}/{promos.length})
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg md:text-2xl font-black font-sans leading-snug ${currentPromo.textColor || "text-white"}`}>
                    {currentPromo.text}
                  </h3>
                </div>
              </div>

              {/* Action Button & CTAs */}
              {currentPromo.actionText && currentPromo.actionUrl && (
                <div className="shrink-0">
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    href={currentPromo.actionUrl}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all ${
                      isBlackTheme 
                        ? "bg-orange-600 text-white hover:bg-orange-700" 
                        : "bg-white text-gray-950 hover:bg-gray-50 hover:scale-103"
                    }`}
                  >
                    {currentPromo.actionText}
                    <ArrowRight size={14} className="animate-pulse" />
                  </motion.a>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
