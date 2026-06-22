import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut, X, ShoppingBag, Heart, Award, Layers, Sun, Moon, Mic, MicOff } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../lib/ThemeContext";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";
import { auth, db } from "../lib/firebase";
import { UserProfile, Product } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { FastImage } from "./FastImage";
import { prefetchProductAssets } from "../utils/imagePrefetcher";
import { productCache } from "../utils/productCache";

interface NavbarProps {
  user: UserProfile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [showDesktopSuggestions, setShowDesktopSuggestions] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = language === "sw" ? "sw-KE" : "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const cleanedTranscript = transcript.replace(/[.?!]/g, "").trim();
          handleSearchChange(cleanedTranscript);
          toast.success(`${language === "sw" ? "Imepatikana" : "Found"}: "${cleanedTranscript}"`, {
            id: "voice-search-result",
            icon: "🎙️",
            duration: 3000
          });
          if (cleanedTranscript) {
            navigate(`/?search=${encodeURIComponent(cleanedTranscript)}`);
            setIsMobileMenuOpen(false);
            setIsMobileSearchOpen(false);
          }
        }
      };

      rec.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted" && event.error !== "network") {
          console.error("Speech recognition error:", event.error);
        } else {
          console.log("Speech recognition info:", event.error);
        }
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error(language === "sw" ? "Ruhusa ya maikrofoni imekataliwa." : "Microphone access is blocked or not allowed.", { id: "voice-search-error" });
        } else if (event.error === "network") {
          toast.error(
            language === "sw" 
              ? "Kuna shida ya mtandao. Utambuzi sauti unahitaji intaneti." 
              : "Network error. Speech recognition requires an active internet connection.",
            { id: "voice-search-error" }
          );
        } else if (event.error === "no-speech" || event.error === "aborted") {
          // Ignore general quiet moments or intentional abort requests during unmount / toggle stop
        } else {
          toast.error(`${language === "sw" ? "Hitilafu" : "Error"}: ${event.error}`, { id: "voice-search-error" });
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [allProducts, language, navigate]);

  const toggleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(language === "sw" ? "Utambuzi wa sauti hautegemezwi kwenye kivinjari hiki." : "Voice search is not supported in this browser.", { id: "voice-search-unsupported" });
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } else {
      try {
        if (recognitionRef.current) {
          // Update language setting dynamically before start
          recognitionRef.current.lang = language === "sw" ? "sw-KE" : "en-US";
          recognitionRef.current.start();
          toast.success(language === "sw" ? "Sikiliza... Ongea sasa!" : "Listening... Speak now!", {
            id: "voice-search-listening",
            icon: "🎙️",
            duration: 4000
          });
        }
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const [isBouncing, setIsBouncing] = useState(false);
  const prevItemCountRef = useRef(itemCount);

  useEffect(() => {
    if (itemCount > prevItemCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 800);
      return () => clearTimeout(timer);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount]);

  // Auto-close menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), limit(50));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.active !== false);
        setAllProducts(fetched);
        fetched.forEach(p => productCache.set(p.id, p));
      } catch (err) {
        console.warn("Failed to fetch products for search suggestions:", err);
      }
    }
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setSuggestedProducts([]);
      setIsMobileMenuOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (val.trim()) {
      const queryStr = val.toLowerCase();
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(queryStr) || 
        p.description.toLowerCase().includes(queryStr) ||
        p.category.toLowerCase().includes(queryStr)
      ).slice(0, 5);
      setSuggestedProducts(filtered);
    } else {
      setSuggestedProducts([]);
    }
  };

  const handleProductSelect = (productId: string) => {
    const matchedProduct = allProducts.find(p => p.id === productId);
    navigate(`/product/${productId}`, { state: matchedProduct ? { product: matchedProduct } : undefined });
    setSearch("");
    setSuggestedProducts([]);
    setShowDesktopSuggestions(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { label: t("home"), path: "/" },
    { label: t("blog"), path: "/blog" },
    ...(user?.isAdmin ? [{ label: t("admin"), path: "/admin" }] : []),
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 bg-white/95 md:bg-white/90 dark:bg-gray-950/95 dark:md:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-bold tracking-tighter text-orange-600">
              Sokoplus<span className="text-gray-900 dark:text-white">.</span>
            </Link>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:block flex-1 max-w-md mx-8 relative">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDesktopSuggestions(true)}
                  placeholder={t("searchPlaceholder")}
                  className="block w-full pl-10 pr-18 py-2 border border-gray-200 dark:border-gray-800 rounded-full leading-5 bg-gray-50 dark:bg-gray-900 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-white focus:dark:bg-gray-950 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-all focus:shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSuggestedProducts([]);
                      }}
                      className="p-1 text-gray-450 hover:text-gray-650 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title={language === "sw" ? "Futa" : "Clear"}
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceSearch}
                    className={`p-1.5 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      isListening
                        ? "text-red-600 bg-red-50 dark:bg-red-950/40 animate-pulse scale-110"
                        : "text-gray-480 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-800/40"
                    }`}
                    title={language === "sw" ? "Tafuta kwa sauti" : "Search by voice"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>
              </div>
            </form>

            {/* Desktop Suggestions Dropdown */}
            <AnimatePresence>
              {showDesktopSuggestions && (search.trim() || suggestedProducts.length > 0) && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDesktopSuggestions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl dark:shadow-black/40 z-50 p-5 space-y-4 max-h-[80vh] overflow-y-auto"
                  >
                    {suggestedProducts.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instant Matches</div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {suggestedProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleProductSelect(p.id)}
                              onMouseEnter={() => prefetchProductAssets(p)}
                              onTouchStart={() => prefetchProductAssets(p)}
                              className="flex items-center space-x-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-2xl px-2 group transition-all"
                            >
                              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200/50 dark:border-gray-700/50">
                                <FastImage 
                                  src={p.images?.[0] || ""} 
                                  alt={p.name} 
                                  fallbackIconSize={16}
                                />
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">{p.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{p.category}</p>
                              </div>
                              <div className="text-sm font-black text-gray-950 dark:text-gray-50 whitespace-nowrap">
                                KES {p.price.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        No matches for "{search}"
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Nav Icons */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 mr-4">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-500 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>

            <Link to="/wishlist" className="hidden md:inline-flex relative group p-2 animate-pulse-subtle">
              <Heart className="text-gray-700 dark:text-gray-350 group-hover:text-red-500 transition-colors" size={24} />
              {user?.wishlist && user.wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {user.wishlist.length}
                </span>
              )}
            </Link>

            <Link to="/profile" className="hidden md:inline-flex group rounded-full border border-gray-200 dark:border-gray-850 hover:border-orange-500 transition-all focus:outline-none items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="p-2"><User className="text-gray-700 dark:text-gray-350 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors" size={24} /></div>
              )}
            </Link>

            <Link to="/cart" className="relative group p-2">
              <motion.div
                animate={isBouncing ? { scale: [1, 1.4, 0.85, 1.15, 0.95, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="relative"
              >
                <ShoppingCart className="text-gray-700 dark:text-gray-300 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors" size={24} />
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 10
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </motion.div>
            </Link>

            {/* Language Toggle */}
            <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-850 rounded-full p-0.5 border border-gray-200 dark:border-gray-800 mr-2">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider transition-all duration-155 cursor-pointer ${
                  language === "en"
                    ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-xs"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-950 hover:dark:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("sw")}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider transition-all duration-155 cursor-pointer ${
                  language === "sw"
                    ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-xs"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-950 hover:dark:text-white"
                }`}
              >
                SW
              </button>
            </div>

            {/* Desktop Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="hidden md:flex items-center justify-center p-2 rounded-full cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 text-gray-750 dark:text-gray-300 border border-gray-200 dark:border-gray-800 transition-colors"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Theme"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} className="text-yellow-500 animate-pulse-subtle" />}
            </motion.button>

            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter flex items-center">
                      <Award size={10} className="mr-0.5" /> {user.loyaltyPoints || 0} PTS
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Loyalty</span>
                  </div>
                  <Link to="/profile" className="flex items-center justify-center p-0.5 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-full transition-colors border border-gray-200 dark:border-gray-800">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 object-cover rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="p-1.5"><User size={20} className="text-gray-700 dark:text-gray-300" /></div>
                    )}
                  </Link>
                  <button 
                    onClick={() => setShowLogoutConfirm(true)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-700 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile Theme Toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="md:hidden flex items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800 transition-colors mr-1 cursor-pointer"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Theme"}
            >
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} className="text-yellow-500" />}
            </motion.button>

            <button 
              onClick={() => {
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="md:hidden p-2 text-gray-750 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-xl transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Modern, Neutral, High-Visibility Mobile Search Bar (Always handy, no micro-icon triggers needed) */}
      <div className="md:hidden px-4 pb-3 pt-0.5 border-b border-gray-50 dark:border-gray-850 bg-white/95 dark:bg-gray-950/95 relative transition-colors duration-200">
        <form onSubmit={handleSearch} className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-450 dark:text-gray-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={language === "sw" ? "Tafuta bidhaa bora za Kenya..." : "Search products in Kenya..."}
            className="block w-full pl-9 pr-14 py-2 border border-gray-200/80 dark:border-gray-800 rounded-xl leading-5 bg-gray-50/80 dark:bg-gray-900/80 placeholder-gray-400 dark:placeholder-gray-500 text-gray-800 dark:text-gray-100 text-xs font-medium focus:outline-none focus:bg-white focus:dark:bg-gray-950 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-inner-sm"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1">
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSuggestedProducts([]);
                }}
                className="p-1 text-gray-450 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title={language === "sw" ? "Futa" : "Clear"}
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-1 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                isListening
                  ? "text-red-600 bg-red-50 dark:bg-red-950/45 animate-pulse scale-110"
                  : "text-gray-400 hover:text-orange-600 dark:text-gray-550 dark:hover:text-orange-400"
              }`}
              title={language === "sw" ? "Tafuta kwa sauti" : "Search by voice"}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          </div>
        </form>

        {/* Suggestion Dropdown floating beautifully over the parent page */}
        <AnimatePresence>
          {suggestedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-4 right-4 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl max-h-60 overflow-y-auto p-3 space-y-1 z-[100]"
            >
              <div className="text-[9px] font-black uppercase text-gray-400 tracking-wider px-2 py-1">Instant Matches</div>
              {suggestedProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleProductSelect(p.id)}
                  className="flex items-center space-x-3 py-2 cursor-pointer hover:bg-gray-50 px-2 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-150">
                    <FastImage 
                      src={p.images?.[0] || ""} 
                      alt={p.name} 
                      fallbackIconSize={14}
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-bold text-gray-950 truncate">{p.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{p.category}</p>
                  </div>
                  <div className="text-xs font-black text-gray-900 whitespace-nowrap">
                    KES {p.price.toLocaleString()}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Elegant premium backdrop with deep blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 md:hidden"
            />
            {/* Spring-physics powered right-to-left drawer with interactive swipe close gesture */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240, restDelta: 0.5 }}
              drag="x"
              dragConstraints={{ left: 0, right: 320 }}
              dragElastic={{ left: 0, right: 0.6 }}
              onDragEnd={(e, info) => {
                if (info.offset.x > 80) {
                  setIsMobileMenuOpen(false);
                }
              }}
              className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 shadow-2xl z-50 md:hidden p-6 flex flex-col space-y-7 touch-pan-y transition-colors duration-200"
            >
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold tracking-tighter text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse" />
                  <span>Sokoplus Menu</span>
                </span>
                <motion.button 
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="p-2 text-gray-400 hover:text-orange-600 transition-colors bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800"
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Mobile Search */}
              <motion.form 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onSubmit={handleSearch} 
                className="relative"
              >
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all focus:border-orange-500 focus:bg-white focus:dark:bg-gray-900 font-medium"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSuggestedProducts([]);
                      }}
                      className="p-1 text-gray-450 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
                      title={language === "sw" ? "Futa" : "Clear"}
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceSearch}
                    className={`p-1.5 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                      isListening
                        ? "text-red-600 bg-red-50 dark:bg-red-950/45 animate-pulse scale-110"
                        : "text-gray-420 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400"
                    }`}
                    title={language === "sw" ? "Tafuta kwa sauti" : "Search by voice"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>
              </motion.form>

              {/* Mobile Language Selector */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-150/50 dark:border-gray-850">
                <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lugha / Language</span>
                <div className="flex bg-white dark:bg-gray-800 rounded-xl p-0.5 border border-gray-100 dark:border-gray-750 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      language === "en"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("sw")}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      language === "sw"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    SW
                  </button>
                </div>
              </div>

              {/* Staggered Links */}
              <motion.div 
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.04,
                      delayChildren: 0.1
                    }
                  }
                }}
                initial="hidden"
                animate="show"
                className="flex flex-col space-y-4"
              >
                {/* Home */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center justify-between group py-1"
                  >
                    <span>{t("home")}</span>
                    <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                      <ShoppingBag size={20} />
                    </div>
                  </Link>
                </motion.div>



                {/* Blog */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/blog"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center justify-between group py-1"
                  >
                    <span>{t("blog")}</span>
                    <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                      <Award size={20} />
                    </div>
                  </Link>
                </motion.div>

                {/* Wishlist */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center justify-between group py-1"
                  >
                    <div className="flex items-center space-x-2">
                       <span>{t("wishlist")}</span>
                      {user?.wishlist && user.wishlist.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {user.wishlist.length}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 group-hover:text-red-500 transition-colors">
                      <Heart size={20} />
                    </div>
                  </Link>
                </motion.div>

                {/* Profile */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center justify-between group py-1"
                  >
                    <span>{t("profile")}</span>
                    <div className="text-gray-400 dark:text-gray-450 group-hover:text-orange-600 transition-colors">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-6 h-6 object-cover rounded-full border border-gray-200 dark:border-gray-800" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                  </Link>
                </motion.div>

                {/* Admin Control */}
                {user?.isAdmin && (
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, x: 25 },
                      show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                    }}
                    whileHover={{ x: 6 }} 
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      to="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-lg font-black text-orange-600 flex items-center justify-between group py-1"
                    >
                      <span>{t("admin")}</span>
                      <div className="text-orange-605">
                        <Award size={20} />
                      </div>
                    </Link>
                  </motion.div>
                )}
              </motion.div>

              {/* Bottom footer profile / controls with entry slide up */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.25 }}
                className="mt-auto pt-6 border-t border-gray-150 dark:border-gray-800 flex flex-col space-y-4"
              >
                {user ? (
                   <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-orange-50/50 dark:bg-orange-950/25 rounded-2xl border border-orange-100/30 dark:border-orange-900/35">
                      <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                        {user.displayName[0]}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{user.displayName}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mr-2">{user.email}</p>
                          <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded-lg text-[9px] font-black text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900 flex items-center shadow-xs flex-shrink-0">
                            <Award size={10} className="mr-0.5" /> {user.loyaltyPoints || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-red-500 font-bold p-3 bg-gray-55 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 text-sm transition-colors cursor-pointer"
                    >
                      <LogOut size={16} />
                      <span>{t("logout")}</span>
                    </motion.button>
                  </div>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full bg-orange-600 hover:bg-orange-700 text-white text-center py-4 rounded-2xl font-bold text-base transition-colors shadow-md"
                    >
                      Get Started
                    </Link>
                  </motion.div>
                )}
                
                <div className="text-[10px] text-center text-gray-400 font-medium tracking-tight">
                  Drag right or tap backdrop to close • Sokoplus V2.5
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl p-8 z-[70] shadow-2xl space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                  <LogOut size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900">Sign Out?</h3>
                  <p className="text-gray-500 font-medium">Are you sure you want to sign out of your account?</p>
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => {
                    auth.signOut();
                    setShowLogoutConfirm(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-50 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
