import React, { useEffect, useState } from "react";
import { Zap, Wifi, Database, CheckCircle2, RefreshCw, X, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  getNetworkSpeedStatus,
  warmCategoryCache,
  subscribeToCacheWarmEvents,
  NetworkSpeedStatus,
  CacheWarmNotification,
  POPULAR_CATEGORIES,
} from "../utils/cacheWarmer";
import { Product } from "../types";
import toast from "react-hot-toast";

interface CacheWarmerNotifierProps {
  customCategoryImages?: Record<string, string>;
  products?: Product[];
}

export function CacheWarmerNotifier({
  customCategoryImages,
  products,
}: CacheWarmerNotifierProps) {
  const [speedStatus, setSpeedStatus] = useState<NetworkSpeedStatus>(() =>
    getNetworkSpeedStatus()
  );
  const [isWarming, setIsWarming] = useState(false);
  const [lastWarmedInfo, setLastWarmedInfo] = useState<CacheWarmNotification | null>(null);
  const [showToastBanner, setShowToastBanner] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 1. Initial trigger & connection change listener
  useEffect(() => {
    let isMounted = true;

    const executeWarming = async () => {
      const status = getNetworkSpeedStatus();
      if (isMounted) setSpeedStatus(status);

      if (status.isHighSpeed && !status.saveData) {
        setIsWarming(true);
        try {
          const res = await warmCategoryCache(customCategoryImages, products);
          if (res.triggered) {
            console.log(
              `[Cache Warmer UI] High-speed internet detected (${status.speedLabel}). Popular category prefetch initiated.`
            );
          }
        } catch (err) {
          console.warn("[Cache Warmer UI] Error executing cache warming:", err);
        } finally {
          if (isMounted) setIsWarming(false);
        }
      }
    };

    // Run on initial mount after a slight idle delay to prioritize main page hydration
    const timer = setTimeout(() => {
      executeWarming();
    }, 1500);

    // Listen to network connection speed changes
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

    const handleConnectionChange = () => {
      const newStatus = getNetworkSpeedStatus();
      setSpeedStatus(newStatus);
      if (newStatus.isHighSpeed && !newStatus.saveData) {
        toast.success(`⚡ High-speed connection detected (${newStatus.speedLabel}). Refreshing category cache...`, {
          id: "high-speed-detected",
          duration: 3000,
        });
        executeWarming();
      }
    };

    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", handleConnectionChange);
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (connection && typeof connection.removeEventListener === "function") {
        connection.removeEventListener("change", handleConnectionChange);
      }
    };
  }, [customCategoryImages, products]);

  // 2. Subscribe to Service Worker cache warm completion events
  useEffect(() => {
    const unsubscribe = subscribeToCacheWarmEvents((eventData) => {
      setLastWarmedInfo(eventData);
      setIsWarming(false);
      setShowToastBanner(true);

      // Auto-hide toast banner after 6 seconds
      setTimeout(() => {
        setShowToastBanner(false);
      }, 6000);
    });

    return unsubscribe;
  }, []);

  const handleManualWarm = async () => {
    setIsWarming(true);
    const status = getNetworkSpeedStatus();
    setSpeedStatus(status);

    const res = await warmCategoryCache(customCategoryImages, products);
    setIsWarming(false);

    if (res.triggered) {
      toast.success(
        `⚡ High-Speed Cache Warmer Active! Pre-warming ${res.urlCount} assets for popular categories.`
      );
    } else {
      toast.error(
        `Cache warming skipped: ${res.reason || "Connection speed below threshold"}`
      );
    }
  };

  return (
    <>
      {/* 1. Floating High-Speed Cache Warmer Banner Toast */}
      <AnimatePresence>
        {showToastBanner && lastWarmedInfo && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 md:bottom-6 left-4 z-[90] max-w-sm bg-gray-900/95 dark:bg-black/95 text-white backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-amber-500/30 flex items-start gap-3 text-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
              <Zap className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <span>Category Cache Warmer Active</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  0ms Latency
                </span>
              </div>
              <p className="text-gray-300 mt-0.5 text-[11px] leading-relaxed">
                Pre-warmed <strong className="text-white">{lastWarmedInfo.prefetchedCount}</strong> assets across{" "}
                <strong className="text-white">{lastWarmedInfo.categories.length} popular categories</strong> for instant browsing.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  View Network Details
                </button>
                <span className="text-gray-600">•</span>
                <span className="text-[10px] text-gray-400">
                  {speedStatus.speedLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowToastBanner(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Network Speed & Category Cache Inspector Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                      Service Worker Cache Warmer
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Automatic high-speed category prefetching engine
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Connection Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-amber-50/50 dark:from-gray-800/50 dark:to-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Wifi size={14} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-bold text-gray-900 dark:text-white">
                        Network Connection
                      </span>
                    </div>
                    <p className="font-mono text-xs text-amber-700 dark:text-amber-300 font-semibold">
                      {speedStatus.speedLabel}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      speedStatus.isHighSpeed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {speedStatus.isHighSpeed ? "High Speed" : "Standard Speed"}
                  </span>
                </div>

                {/* Popular Categories Pre-warmed Grid */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                      <Database size={14} className="text-orange-500" />
                      <span>Popular Categories Prefetched ({POPULAR_CATEGORIES.length})</span>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      SW Cache: sokoplus-category-cache-v1
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {POPULAR_CATEGORIES.map((cat) => (
                      <div
                        key={cat}
                        className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium"
                      >
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Summary */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2 text-blue-800 dark:text-blue-300">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <p className="leading-relaxed text-[11px]">
                    When high-speed internet is detected, SokoPlus instructs the Service Worker to prefetch high-res category banners and popular items in the background. Subsequent navigations load with <strong>0ms perceived latency</strong> directly from local storage.
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleManualWarm}
                  disabled={isWarming}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer text-xs"
                >
                  <RefreshCw size={14} className={isWarming ? "animate-spin" : ""} />
                  <span>{isWarming ? "Warming Cache..." : "Force Warm Category Caches"}</span>
                </button>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold transition-colors cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
