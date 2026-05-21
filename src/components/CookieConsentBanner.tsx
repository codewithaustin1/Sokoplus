/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Cookie, X, Check, ArrowRight } from "lucide-react";
import { initGA, trackPageView } from "../lib/analytics";

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a selection
    const consent = localStorage.getItem("sokoplus_cookie_consent");
    if (!consent) {
      // Delay showing the banner slightly for a smoother entry
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("sokoplus_cookie_consent", "accepted");
    // Force initialize Google Analytics now that we have explicit user consent
    initGA(true);
    // Track the initial pageview since the page has already loaded
    trackPageView(window.location.pathname + window.location.search);
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("sokoplus_cookie_consent", "declined");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="cookie-consent-container"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 border-t border-zinc-800 text-white backdrop-blur-md shadow-2xl pointer-events-auto"
        >
          <div className="relative max-w-7xl mx-auto px-6 pr-12 md:pr-16 py-4 md:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 text-center md:text-left">
              <div className="p-2 rounded-xl bg-orange-600/10 border border-orange-600/20 text-orange-500 shrink-0 hidden sm:block">
                <Cookie size={18} />
              </div>
              <p className="text-zinc-300 text-xs md:text-sm font-medium leading-relaxed">
                We use cookies to analyze traffic, improve performance, and provide a seamless checkout experience. 
                Read our{" "}
                <Link 
                  to="/cookies" 
                  className="text-orange-500 hover:text-orange-400 underline font-bold transition-colors inline-flex items-center"
                  onClick={() => setIsVisible(false)}
                >
                  Cookie Policy <ArrowRight size={10} className="ml-0.5 inline" />
                </Link>{" "}
                to learn more.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end shrink-0">
              <button
                id="cookie-decline-button"
                type="button"
                onClick={handleDecline}
                className="px-5 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Decline
              </button>
              <button
                id="cookie-accept-button"
                type="button"
                onClick={handleAccept}
                className="px-5 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-500 transition-all text-xs font-black uppercase tracking-wider flex items-center space-x-1 shadow-lg shadow-orange-950/40 cursor-pointer"
              >
                <Check size={12} className="stroke-[3]" />
                <span>Accept Cookies</span>
              </button>
            </div>

            <button
              id="cookie-close-button"
              type="button"
              onClick={() => setIsVisible(false)}
              className="absolute top-4 right-4 md:top-1/2 md:-translate-y-1/2 md:right-6 text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
              aria-label="Dismiss cookie policy banner"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
