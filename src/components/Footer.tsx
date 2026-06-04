import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Send, Mail, MapPin, Phone } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useLanguage } from "../lib/LanguageContext";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { t } = useLanguage();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success(t("Thanks for subscribing to Sokoplus updates!"), { icon: "📧" });
    setEmail("");
  };

  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-4 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tighter text-gray-900 uppercase">
                Soko<span className="text-orange-600">plus.</span>
              </h2>
              <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-xs">
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
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium pr-14"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white p-2.5 rounded-xl hover:bg-orange-600 transition-all"
                >
                  <Send size={18} />
                </button>
              </form>
              <p className="text-[10px] text-gray-400 font-medium italic">{t("Receive weekly curated product drops and local stories.")}</p>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-orange-100 pb-2 w-fit">{t("Marketplace")}</h3>
              <ul className="space-y-3">
                <li><Link to="/" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("All Products")}</Link></li>
                <li><Link to="/" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Best Sellers")}</Link></li>
                <li><Link to="/blog" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Market Stories")}</Link></li>
                <li><Link to="/careers" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Careers")}</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-orange-100 pb-2 w-fit">{t("Support")}</h3>
              <ul className="space-y-3">
                <li><Link to="/profile" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Track Order")}</Link></li>
                <li><Link to="/shipping" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Shipping Info")}</Link></li>
                <li><Link to="/returns" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("Returns & Exchanges")}</Link></li>
                <li><Link to="/faq" className="text-sm text-gray-500 font-medium hover:text-orange-600 transition-colors">{t("FAQ")}</Link></li>
              </ul>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest border-b border-orange-100 pb-2 w-fit">{t("Contact")}</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3 text-sm text-gray-500">
                  <MapPin size={18} className="text-orange-600 shrink-0" />
                  <span>{t("Nairobi Business District,")}<br/>{t("Kenyan Avenue, Kenya")}</span>
                </li>
                <li className="flex items-center space-x-3 text-sm text-gray-500">
                  <Mail size={18} className="text-orange-600 shrink-0" />
                  <span>hello@sokoplus.com</span>
                </li>
                <li className="flex items-center space-x-3 text-sm text-gray-500">
                  <Phone size={18} className="text-orange-600 shrink-0" />
                  <a href="tel:+254740463021" className="hover:text-orange-600 transition-colors">+254 740 463 021</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start space-y-2">
            <p className="text-xs text-gray-400 font-medium">
              &copy; {new Date().getFullYear()} Sokoplus Ltd. All rights reserved.
            </p>
            <div className="flex items-center space-x-4">
              <Link to="/privacy" className="text-[10px] text-gray-400 hover:text-gray-900 uppercase tracking-tighter font-bold">Privacy Policy</Link>
              <Link to="/terms" className="text-[10px] text-gray-400 hover:text-gray-900 uppercase tracking-tighter font-bold">Terms of Service</Link>
              <Link to="/cookies" className="text-[10px] text-gray-400 hover:text-gray-900 uppercase tracking-tighter font-bold">Cookies</Link>
              <Link to="/returns" className="text-[10px] text-gray-400 hover:text-gray-900 uppercase tracking-tighter font-bold">Return Policy</Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <a href="#" className="bg-gray-50 p-3 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm border border-gray-100">
              <Instagram size={20} />
            </a>
            <a href="#" className="bg-gray-50 p-3 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm border border-gray-100">
              <Twitter size={20} />
            </a>
            <a href="#" className="bg-gray-50 p-3 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm border border-gray-100 text-blue-600">
              <Facebook size={20} fill="currentColor" />
            </a>
            <a href="#" className="bg-gray-50 p-3 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm border border-gray-100 text-blue-800">
              <Linkedin size={20} fill="currentColor" />
            </a>
          </div>

          <div className="flex items-center space-x-3 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
             <div className="bg-gray-200 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600">MPESA</div>
             <div className="bg-gray-200 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600">VISA</div>
             <div className="bg-gray-200 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600">MASTERCARD</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
