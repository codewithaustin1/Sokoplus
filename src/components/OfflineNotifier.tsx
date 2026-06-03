import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, CloudLightning, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

export function OfflineNotifier() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [showBanner, setShowBanner] = useState<boolean>(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
      
      if (wasOffline) {
        toast.success("Connection restored! Syncing with latest marketplace listings...", {
          icon: "⚡",
          id: "network-status-toast",
          duration: 4000
        });
        
        // Force a component or route update message if needed
        setTimeout(() => {
          // Dispatch custom event if any other page needs to refresh from network
          window.dispatchEvent(new Event("network-sync"));
        }, 1000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
      
      toast.error("Offline mode active. Browsing cached listings.", {
        icon: "🔌",
        id: "network-status-toast",
        duration: 5000
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed bottom-[88px] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
          id="offline-notifier-container"
        >
          <div className="bg-gray-950 text-white rounded-3xl p-5 border border-amber-500/20 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans backdrop-blur-md bg-opacity-95">
            <div className="flex items-start gap-4">
              <div className="bg-amber-500/10 text-amber-500 p-3 rounded-2xl shrink-0 border border-amber-500/20 flex items-center justify-center">
                <WifiOff className="animate-pulse" size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    Offline Mode
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                </div>
                <h4 className="text-sm font-black tracking-tight text-white">Internet Connection Lost</h4>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                  Browsing cached artisanal collections. You can still modify your cart & wishlist; changes will sync online upon recovery.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  if (navigator.onLine) {
                    setIsOnline(true);
                    setShowBanner(false);
                  } else {
                    toast.error("Still offline. Reconnecting...", { id: "still-offline-toast" });
                  }
                }}
                className="bg-white/10 hover:bg-white/25 active:scale-95 text-xs text-white font-extrabold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-white/5"
              >
                <RefreshCw size={12} className="animate-spin-slow" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl transition-all hover:bg-white/5 cursor-pointer"
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
