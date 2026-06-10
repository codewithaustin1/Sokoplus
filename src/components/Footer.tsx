import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Send, Mail, MapPin, Phone, X, ExternalLink } from "lucide-react";
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLanguage } from "../lib/LanguageContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  const [googleMapsLinks, setGoogleMapsLinks] = useState<{ name: string; url: string }[]>([]);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    try {
      const settingsRef = doc(db, "settings", "homepage");
      const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.googleMapsLinks && Array.isArray(data.googleMapsLinks)) {
            setGoogleMapsLinks(data.googleMapsLinks);
          } else if (data.googleMapsLink) {
            setGoogleMapsLinks([{ name: "Nairobi Store", url: data.googleMapsLink }]);
          } else {
            setGoogleMapsLinks([]);
          }

          if (data.googleMapsLink) {
            setGoogleMapsLink(data.googleMapsLink);
          } else {
            setGoogleMapsLink("");
          }
        }
      }, (error) => {
        console.warn("Could not load maps link in footer:", error);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn("Error setting up snapshots for footer:", err);
    }
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success(t("Thanks for subscribing to Sokoplus updates!"), { icon: "📧" });
    setEmail("");
  };

  return (
    <footer className="bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-4 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white uppercase animate-fade-in">
                Soko<span className="text-orange-600">plus.</span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-xs">
                {t("Bridging the gap between Kenya's finest local artisans and global quality standards. Discover the heart of Nairobi.")}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("Join our community")}</h3>
              <form onSubmit={handleSubscribe} className="relative flex max-w-sm">
                <input 
                  type="email"
                  required
                  placeholder={t("Enter your email")}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium pr-14"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 dark:bg-gray-800 text-white p-2.5 rounded-xl hover:bg-orange-600 dark:hover:bg-orange-500 transition-all"
                >
                  <Send size={18} />
                </button>
              </form>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium italic">{t("Receive weekly curated product drops and local stories.")}</p>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest border-b border-orange-100 dark:border-orange-950 pb-2 w-fit">{t("Marketplace")}</h3>
              <ul className="space-y-3">
                <li><Link to="/" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("All Products")}</Link></li>
                <li><Link to="/" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Best Sellers")}</Link></li>
                <li><Link to="/blog" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Market Stories")}</Link></li>
                <li><Link to="/careers" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Careers")}</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest border-b border-orange-100 dark:border-orange-950 pb-2 w-fit">{t("Support")}</h3>
              <ul className="space-y-3">
                <li><Link to="/profile" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Track Order")}</Link></li>
                <li><Link to="/shipping" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Shipping Info")}</Link></li>
                <li><Link to="/returns" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Returns & Exchanges")}</Link></li>
                <li><Link to="/faq" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("FAQ")}</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-widest border-b border-orange-100 dark:border-orange-950 pb-2 w-fit">{t("Contact")}</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3 text-sm text-gray-500 dark:text-gray-450">
                  <MapPin size={18} className="text-orange-600 shrink-0 mt-0.5" />
                  {googleMapsLinks.length === 0 ? (
                    <span>{t("Revlon Plaza, Biashara Street,")}<br/>{t("Nairobi CBD")}</span>
                  ) : googleMapsLinks.length === 1 ? (
                    <a 
                      href={googleMapsLinks[0].url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200 underline decoration-orange-500/30 hover:decoration-orange-500/80 font-semibold cursor-pointer"
                    >
                      <span>{t("Revlon Plaza, Biashara Street,")}<br/>{t("Nairobi CBD")}</span>
                      <span className="block mt-1 text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline">
                        {t("View Shop Location")} &rarr;
                      </span>
                    </a>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setShowLocationsModal(true)}
                      className="text-left hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200 underline decoration-orange-500/30 hover:decoration-orange-500/80 font-semibold cursor-pointer outline-none bg-transparent"
                    >
                      <span>{t("Revlon Plaza, Biashara Street,")}<br/>{t("Nairobi CBD")}</span>
                      <span className="block mt-1 text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline">
                        {t("Our Outlets")} ({googleMapsLinks.length} {t("Locations")}) &rarr;
                      </span>
                    </button>
                  )}
                </li>
                <li className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-450">
                  <Mail size={18} className="text-orange-600 shrink-0" />
                  <span>hello@sokoplus.com</span>
                </li>
                <li className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-450">
                  <Phone size={18} className="text-orange-600 shrink-0" />
                  <a href="tel:+254740463021" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">+254 740 463 021</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start space-y-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              &copy; {new Date().getFullYear()} Sokoplus Ltd. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <Link to="/privacy" className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 uppercase tracking-tighter font-bold">Privacy Policy</Link>
              <Link to="/terms" className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 uppercase tracking-tighter font-bold">Terms of Service</Link>
              <Link to="/cookies" className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 uppercase tracking-tighter font-bold">Cookies</Link>
              <Link to="/returns" className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 uppercase tracking-tighter font-bold">Return Policy</Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <a href="#" className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-sm border border-gray-100 dark:border-gray-800">
              <Instagram size={20} />
            </a>
            <a href="#" className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-sm border border-gray-100 dark:border-gray-800">
              <Twitter size={20} />
            </a>
            <a href="#" className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-sm border border-gray-100 dark:border-gray-800 text-blue-600">
              <Facebook size={20} fill="currentColor" />
            </a>
            <a href="#" className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 transition-all shadow-sm border border-gray-100 dark:border-gray-800 text-blue-800">
              <Linkedin size={20} fill="currentColor" />
            </a>
          </div>

          <div className="flex items-center space-x-3 opacity-30 dark:opacity-40 grayscale hover:grayscale-0 hover:opacity-100 dark:hover:opacity-100 transition-all duration-500">
             <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600 dark:text-gray-400">MPESA</div>
             <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600 dark:text-gray-400">VISA</div>
             <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600 dark:text-gray-400">MASTERCARD</div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLocationsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationsModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl p-6 overflow-hidden z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-orange-100 dark:bg-orange-950/40 text-orange-600 rounded-xl">
                    <MapPin size={18} className="animate-pulse" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">
                      {t("Our Store Locations")}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      {googleMapsLinks.length} {t("outlets found")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationsModal(false)}
                  className="p-1.5 text-gray-450 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
                {googleMapsLinks.map((loc, idx) => (
                  <a
                    key={idx}
                    href={loc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-orange-50/20 dark:bg-gray-950 dark:hover:bg-orange-950/10 border border-gray-150/40 dark:border-gray-950/50 hover:border-orange-200/50 dark:hover:border-orange-900/30 rounded-2xl group transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {loc.name || `${t("Shop Location")} ${idx + 1}`}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium font-mono line-clamp-1 truncate max-w-[240px]">
                        {loc.url}
                      </p>
                    </div>
                    <span className="p-1 text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      <ExternalLink size={14} />
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowLocationsModal(false)}
                  className="w-full py-3 bg-gray-900 dark:bg-gray-800 text-white hover:bg-orange-600 dark:hover:bg-orange-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </footer>
  );
}
