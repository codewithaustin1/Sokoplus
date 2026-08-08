import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Send, Mail, MapPin, Phone, X, ExternalLink, Youtube, MessageCircle, Music } from "lucide-react";
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLanguage } from "../lib/LanguageContext";
import { useSettings } from "../lib/SettingsContext";
import { motion, AnimatePresence } from "motion/react";

const TikTokIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 1 1-2.896-2.892c.38 0 .733.074 1.055.206V9.48a6.334 6.334 0 1 0 5.286 6.223V9.088c1.474 1.054 3.284 1.68 5.24 1.68V7.323a8.216 8.216 0 0 1-1.47-.637z" />
  </svg>
);

const WhatsAppIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
  </svg>
);

const YouTubeIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  </svg>
);

const MastercardLogo = () => (
  <div className="flex flex-col items-center justify-center">
    <svg viewBox="0 0 32 18" className="h-[14px] w-auto animate-fade-in" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="9" r="8" fill="#EB001B" />
      <circle cx="22" cy="9" r="8" fill="#F79E1B" />
      <path d="M16 9c0-2.28.92-4.34 2.4-5.83a7.97 7.97 0 00-4.8 0c1.48 1.49 2.4 3.55 2.4 5.83s-.92 4.34-2.4 5.83c1.6 1.49 3.2 1.49 4.8 0A7.97 7.97 0 0016 9z" fill="#FF5F00" opacity="0.9" />
    </svg>
    <span className="text-[6px] text-gray-500 dark:text-gray-400 font-sans tracking-tight leading-none uppercase font-bold mt-0.5">mastercard</span>
  </div>
);

const VisaLogo = () => (
  <svg viewBox="0 0 60 20" className="h-[12px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.2 2.3L15.3 17.5h-3.8L7.3 5.4c-.4-1.5-1.5-2.2-2.8-2.3v-.5h6.3c1.4 0 2.5.9 2.8 2.2l1.7 8.1 3.5-9.4c.5-1.1 1.4-1.8 2.7-1.8h3.5v.3c-2.3.5-3.3 1.5-3.8 2.9zm10.7 15.2h-3.6l2.3-15.2h3.6l-2.3 15.2zm14.1-10c-1.3-.7-2.1-1.1-2.1-1.8 0-.6.7-1.3 2.1-1.3 1.6-.1 2.8.6 3.5 1l.4-2.8c-1-.4-2.6-.8-4.3-.8-3.8 0-6.5 2-6.5 5 0 2.1 1.9 3.3 3.3 4 1.5.7 2 1.2 2 1.9 0 1-1.2 1.5-2.3 1.5-2 0-3-.5-4-1l-.4 2.9c1.1.5 3.1.9 4.8.9 4 0 6.6-2 6.6-5.1-.1-2.4-1.5-3.6-3.1-4.3zm13.1-5.2h-2.8c-1.1 0-1.6.3-2 1.2L50 17.5h3.8l.8-2.1h4.6c.1.5.4 2.1.4 2.1h3.4l-3-15.2zm-4.3 10.3c.3-.8 1.4-3.8 1.4-3.8l.8 3.8h-2.2z" className="fill-[#154694] dark:fill-white transition-colors duration-200" />
    <path d="M11.5 2.3h-4L3 5.3s2-.5 3.5-1.6C7.9 2.5 11.5 2.3 11.5 2.3z" className="fill-[#FAA61A] dark:fill-[#FAA61A] transition-colors duration-200" />
  </svg>
);

const MPesaLogo = () => (
  <svg viewBox="0 0 72 20" className="h-[14px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(0, -1.5)">
      <rect x="1" y="2" width="13" height="19" rx="3" className="fill-[#A4D852] dark:fill-[#4CA829] transition-colors duration-200" />
      <rect x="2.5" y="3" width="10" height="7" rx="1" fill="white" />
      <circle cx="4.5" cy="12" r="0.8" fill="white" />
      <circle cx="7.5" cy="12" r="0.8" fill="white" />
      <circle cx="10.5" cy="12" r="0.8" fill="white" />
      <circle cx="4.5" cy="14.5" r="0.8" fill="white" />
      <circle cx="7.5" cy="14.5" r="0.8" fill="white" />
      <circle cx="10.5" cy="14.5" r="0.8" fill="white" />
      <circle cx="4.5" cy="17" r="0.8" fill="white" />
      <circle cx="7.5" cy="17" r="0.8" fill="white" />
      <circle cx="10.5" cy="17" r="0.8" fill="white" />
      <path d="M0.5 10C3.5 11.5 9 10 11.5 8L12.5 10.5C9.5 12.5 3.5 13 0.5 11.5V10Z" fill="#E11D48" />
    </g>
    <text x="17" y="14.5" className="fill-[#4B9A25] dark:fill-[#22C55E] transition-colors duration-200" fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif" fontWeight="900" fontSize="11px" letterSpacing="0">M-</text>
    <text x="31" y="14.5" className="fill-[#E11D48] dark:fill-rose-500 transition-colors duration-200" fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif" fontWeight="900" fontSize="11px" letterSpacing="0">PESA</text>
  </svg>
);

const AirtelLogo = () => (
  <svg viewBox="0 0 65 20" className="h-[14px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="10" fill="#E11D48" />
    <path d="M10 5.5C7.5 5.5 5.5 7.5 5.5 10C5.5 12.5 7.5 14.5 10 14.5C12.5 14.5 14.5 12.5 14.5 10C14.5 7.5 12.5 5.5 10 5.5ZM10 12.5C8.6 12.5 7.5 11.4 7.5 10C7.5 8.6 8.6 7.5 10 7.5C11.4 7.5 12.5 8.6 12.5 10C12.5 11.4 11.4 12.5 10 12.5Z" fill="white" />
    <text x="24" y="13.5" className="fill-[#E11D48] dark:fill-rose-400" fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif" fontWeight="800" fontSize="11px" letterSpacing="-0.3">airtel</text>
  </svg>
);

const EquitelLogo = () => (
  <svg viewBox="0 0 76 20" className="h-[14px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="11" className="fill-[#E28743] dark:fill-orange-400" fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif" fontWeight="900" fontSize="11.5px" letterSpacing="-0.3">Equitel</text>
    <text x="0" y="16.5" className="fill-[#8B5A2B] dark:fill-gray-400" fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif" fontWeight="600" fontSize="4.2px" letterSpacing="0">My money. My phone. My life.</text>
    <circle cx="51" cy="9" r="2.2" className="fill-[#E28743] dark:fill-orange-400" />
    <line x1="51" y1="9" x2="57.5" y2="6.2" className="stroke-[#8B5A2B] dark:stroke-gray-600" strokeWidth="0.8" />
    <circle cx="57.5" cy="6.2" r="3" className="fill-[#F4A261] dark:fill-orange-300" />
    <line x1="57.5" y1="6.2" x2="65.5" y2="9" className="stroke-[#8B5A2B] dark:stroke-gray-600" strokeWidth="0.8" />
    <circle cx="65.5" cy="9" r="4" className="fill-[#E26D5C] dark:fill-red-400" />
    <line x1="57.5" y1="6.2" x2="57.5" y2="13.5" className="stroke-[#8B5A2B] dark:stroke-gray-600" strokeWidth="0.8" />
    <circle cx="57.5" cy="13.5" r="2.8" className="fill-[#4A2810] dark:fill-amber-900" />
  </svg>
);

const AmexLogo = () => (
  <div className="flex items-center justify-center bg-[#018CCF] px-2 py-0.5 rounded-md h-[18px] w-fit shadow-xs border border-blue-400/20">
    <span className="text-white font-black tracking-widest uppercase text-center block" style={{ fontSize: '3.8px', lineHeight: '1.1' }}>
      AMERICAN<br />EXPRESS
    </span>
  </div>
);

const ApplePayLogo = () => (
  <div className="flex items-center justify-center space-x-1">
    <svg viewBox="0 0 16 16" className="h-[15px] w-auto fill-gray-900 dark:fill-white" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.66 3.99c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.39-.57.65-1.06 1.74-.92 2.81 1.04.08 2.06-.52 2.67-1.26zm1.15 4.23c-.03-1.68 1.38-2.49 1.44-2.53-.78-1.15-2-1.3-2.43-1.33-1.03-.11-2.01.61-2.53.61-.52 0-1.33-.59-2.19-.58-1.13.02-2.17.66-2.75 1.67-1.18 2.05-.3 5.09.84 6.74.56.81 1.22 1.71 2.09 1.68.84-.03 1.15-.54 2.16-.54 1.01 0 1.3.54 2.17.51.89-.02 1.48-.82 2.02-1.62.63-.92.89-1.8 1.06-1.85-.02-.01-1.74-.67-1.76-2.67L12.81 8.22z" />
    </svg>
    <span className="text-gray-900 dark:text-white font-sans font-black tracking-tight leading-none text-[13px] -mt-0.5">Pay</span>
  </div>
);

export default function Footer() {
  const [email, setEmail] = useState("");
  const { settings } = useSettings();
  const googleMapsLink = settings.googleMapsLink;
  const googleMapsLinks = settings.googleMapsLinks;
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const { t } = useLanguage();

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
              {settings.brandLogoUrl ? (
                <img src={settings.brandLogoUrl} alt="SokoPlus" className="h-10 w-auto object-contain animate-fade-in" referrerPolicy="no-referrer" />
              ) : (
                <h2 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white uppercase animate-fade-in">
                  Soko<span className="text-orange-600">plus.</span>
                </h2>
              )}
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
                <li><Link to="/careers" className="text-sm text-gray-500 dark:text-gray-400 font-medium hover:text-orange-600 dark:hover:text-orange-400 transition-colors">{t("Find a job")}</Link></li>
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
                  <span>hello@sokoplus.co.ke</span>
                </li>
                <li className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-450">
                  <Phone size={18} className="text-orange-600 shrink-0" />
                  <a href="tel:+254740463021" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">+254 740 463 021</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest">
              {t("Payment methods")}
            </h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium max-w-sm">
              {t("Securely processed with standard East African gateways (M-Pesa, Airtel, Equitel, credit cards, Apple Pay).")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[70px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <MastercardLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[70px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <VisaLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[76px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <MPesaLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[70px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <AirtelLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[78px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <EquitelLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[70px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <AmexLogo />
            </div>
            <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-100/90 dark:border-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center justify-center h-9 w-[78px] hover:scale-105 hover:border-orange-500/20 dark:hover:border-orange-500/30 transition-all duration-300">
              <ApplePayLogo />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8">
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

          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const social = settings.socialLinks || {};

              const defaultFallbacks: Record<string, string> = {
                instagram: "https://instagram.com/sokoplus",
                facebook: "https://facebook.com/sokoplus",
                twitter: "https://x.com/sokoplus",
                linkedin: "https://linkedin.com/company/sokoplus",
                tiktok: "https://tiktok.com/@sokoplus",
                whatsapp: "https://wa.me/254740463021",
                youtube: "https://youtube.com/@sokoplus",
              };

              const allPlatforms = [
                {
                  key: "instagram",
                  label: "Instagram",
                  url: social.instagram?.trim() || defaultFallbacks.instagram,
                  icon: <Instagram size={18} />,
                  activeClass: "hover:bg-pink-50 dark:hover:bg-pink-950/20 hover:text-pink-600 dark:hover:text-pink-400",
                },
                {
                  key: "facebook",
                  label: "Facebook",
                  url: social.facebook?.trim() || defaultFallbacks.facebook,
                  icon: <Facebook size={18} fill="currentColor" />,
                  activeClass: "hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400",
                },
                {
                  key: "twitter",
                  label: "Twitter / X",
                  url: social.twitter?.trim() || defaultFallbacks.twitter,
                  icon: <Twitter size={18} />,
                  activeClass: "hover:bg-sky-50 dark:hover:bg-sky-950/20 hover:text-sky-500 dark:hover:text-sky-400",
                },
                {
                  key: "linkedin",
                  label: "LinkedIn",
                  url: social.linkedin?.trim() || defaultFallbacks.linkedin,
                  icon: <Linkedin size={18} fill="currentColor" />,
                  activeClass: "hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400",
                },
                {
                  key: "tiktok",
                  label: "TikTok",
                  url: social.tiktok?.trim() || defaultFallbacks.tiktok,
                  icon: <TikTokIcon size={18} />,
                  activeClass: "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-black dark:hover:text-white",
                },
                {
                  key: "whatsapp",
                  label: "WhatsApp",
                  url: social.whatsapp?.trim() || defaultFallbacks.whatsapp,
                  icon: <WhatsAppIcon size={18} />,
                  activeClass: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-600 dark:hover:text-emerald-400",
                },
                {
                  key: "youtube",
                  label: "YouTube",
                  url: social.youtube?.trim() || defaultFallbacks.youtube,
                  icon: <YouTubeIcon size={18} />,
                  activeClass: "hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400",
                },
              ];

              const visiblePlatforms = allPlatforms.filter((p) => {
                const vis = (social as any)[`${p.key}Visible`];
                return vis !== false;
              });

              return visiblePlatforms.map((p) => (
                <a
                  key={p.key}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Follow us on ${p.label}`}
                  className={`bg-gray-50 dark:bg-gray-900 p-2.5 sm:p-3 rounded-xl text-gray-400 dark:text-gray-500 transition-all shadow-xs border border-gray-100 dark:border-gray-800 flex items-center justify-center ${p.activeClass}`}
                >
                  {p.icon}
                </a>
              ));
            })()}
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
