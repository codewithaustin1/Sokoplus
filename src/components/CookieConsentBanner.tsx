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
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md w-auto z-50 pointer-events-auto"
        >
          <div className="bg-gray-905 bg-zinc-900 border border-zinc-800 text-white rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* Ambient Background Glow Effect */}
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-orange-600/10 border border-orange-600/20 p-3 rounded-2xl text-orange-500 shrink-0">
                <Cookie size={24} className="animate-spin-slow" />
              </div>
              <div className="space-y-3">
                <h3 className="font-extrabold tracking-tight text-white text-lg">
                  Soko<span className="text-orange-500">plus</span> Cookie Consent
                </h3>
                <p className="text-zinc-400 text-xs md:text-sm leading-relaxed font-medium">
                  We use cookies and analytical tracking like Google Analytics to measure marketplace traffic, improve our loading performance, and provide a seamless checkout experience. 
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
            </div>

            <div className="h-px bg-zinc-800 my-6"></div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                id="cookie-decline-button"
                type="button"
                onClick={handleDecline}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
              >
                No Analytics
              </button>
              <button
                id="cookie-accept-button"
                type="button"
                onClick={handleAccept}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-orange-600 text-white hover:bg-orange-500 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center space-x-1.5 shadow-lg shadow-orange-950/40 cursor-pointer"
              >
                <Check size={14} className="stroke-[3]" />
                <span>Accept Analytics</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
