import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut, X, ShoppingBag, Heart, Award, Layers, Mic, MicOff, ChevronRight, ChevronDown, Globe, Moon, Sun, Grid, Check, Coins } from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";
import { useCurrency } from "../lib/CurrencyContext";
import { useTheme } from "../lib/ThemeContext";
import { useSettings } from "../lib/SettingsContext";
import { auth, db } from "../lib/firebase";
import { UserProfile, Product } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, getDocsFromCache, query, limit, doc, setDoc } from "firebase/firestore";
import { FastImage } from "./FastImage";
import { prefetchProductAssets } from "../utils/imagePrefetcher";
import { productCache } from "../utils/productCache";
import { matchesFuzzyQuery, normalizeSearchQuery } from "../utils/searchFuzzy";
import DeliveryLocationSearch, { SelectedLocationData } from "./DeliveryLocationSearch";
import { LocalWeatherWidget } from "./LocalWeatherWidget";

interface NavbarProps {
  user: UserProfile | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "Kenya": "🇰🇪",
  "Uganda": "🇺🇬",
  "Tanzania": "🇹🇿",
  "Rwanda": "🇷🇼",
};

const COUNTRY_FLAG_IMAGES: Record<string, string> = {
  "Kenya": "https://flagcdn.com/w40/ke.png",
  "Uganda": "https://flagcdn.com/w40/ug.png",
  "Tanzania": "https://flagcdn.com/w40/tz.png",
  "Rwanda": "https://flagcdn.com/w40/rw.png",
};

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
  "Uganda": ["Kampala", "Entebbe", "Jinja"],
  "Tanzania": ["Dar es Salaam", "Arusha", "Zanzibar"],
  "Rwanda": ["Kigali", "Gisenyi"],
};

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const { settings } = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, exchangeRate, formatPrice } = useCurrency();
  const { theme, setTheme } = useTheme();

  const [deliveryCountry, setDeliveryCountry] = useState(() => localStorage.getItem("sokoplus_delivery_country") || user?.deliveryCountry || "Kenya");
  const [deliveryCity, setDeliveryCity] = useState(() => localStorage.getItem("sokoplus_delivery_city") || user?.deliveryCity || "Nairobi");
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    if (user?.deliveryCountry) {
      setDeliveryCountry(user.deliveryCountry);
      localStorage.setItem("sokoplus_delivery_country", user.deliveryCountry);
    }
    if (user?.deliveryCity) {
      setDeliveryCity(user.deliveryCity);
      localStorage.setItem("sokoplus_delivery_city", user.deliveryCity);
    }
  }, [user?.deliveryCountry, user?.deliveryCity]);

  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showAllCategoriesMenu, setShowAllCategoriesMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isNavCompact, setIsNavCompact] = useState(false);
  const [isMobileSearchFocused, setIsMobileSearchFocused] = useState(false);

  const isNavCompactRef = useRef(isNavCompact);
  isNavCompactRef.current = isNavCompact;

  const scrollStateRef = useRef({
    anchorScrollY: 0,
    lastToggleTime: 0,
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = Math.max(0, window.scrollY);
          const now = Date.now();
          const { anchorScrollY, lastToggleTime } = scrollStateRef.current;
          const timeSinceToggle = now - lastToggleTime;
          const compact = isNavCompactRef.current;

          // Always expand when near top of viewport
          if (currentScrollY <= 40) {
            if (compact) {
              setIsNavCompact(false);
              scrollStateRef.current.lastToggleTime = now;
            }
            scrollStateRef.current.anchorScrollY = currentScrollY;
          } else if (timeSinceToggle > 350) {
            // Prevent rapid toggling during CSS transitions
            if (!compact) {
              // Expand -> Compact: must scroll down > 60px past anchor and past 100px total scroll
              if (currentScrollY > 100 && currentScrollY - anchorScrollY > 60) {
                setIsNavCompact(true);
                scrollStateRef.current.lastToggleTime = now;
                scrollStateRef.current.anchorScrollY = currentScrollY;
              } else if (currentScrollY < anchorScrollY) {
                scrollStateRef.current.anchorScrollY = currentScrollY;
              }
            } else {
              // Compact -> Expand: must scroll up > 70px from peak scroll depth
              if (anchorScrollY - currentScrollY > 70) {
                setIsNavCompact(false);
                scrollStateRef.current.lastToggleTime = now;
                scrollStateRef.current.anchorScrollY = currentScrollY;
              } else if (currentScrollY > anchorScrollY) {
                scrollStateRef.current.anchorScrollY = currentScrollY;
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const activeCategories = useMemo(() => {
    const defaultCats = [
      { name: "Fashion", label: language === "sw" ? "Mitindo na Mavazi" : "Fashion" },
      { name: "Electronics", label: language === "sw" ? "Vifaa vya Kidijitali" : "Electronics" },
      { name: "Local Crafts", label: language === "sw" ? "Sanaa za Mikono" : "Local Crafts" },
      { name: "Groceries", label: language === "sw" ? "Bidhaa za Vyakula" : "Groceries" },
      { name: "Beauty & Personal Care (Skincare, Haircare, Cosmetics)", label: language === "sw" ? "Urembo na Vipodozi" : "Beauty & Personal Care (Skincare, Haircare, Cosmetics)" },
      { name: "Home & Office Décor (Small Scale & Gadgets)", label: language === "sw" ? "Mapambo ya Nyumbani na Ofisini" : "Home & Office Décor (Small Scale & Gadgets)" },
      { name: "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)", label: language === "sw" ? "Vifaa vya Wanyama" : "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)" }
    ];

    if (allProducts.length === 0) {
      return [...defaultCats, { name: "All", label: language === "sw" ? "Vitengo Vyote" : "All Products" }];
    }

    const dbCats = Array.from(new Set(
      allProducts
        .filter(p => p.active !== false && (!p.approvalStatus || p.approvalStatus === "approved"))
        .map(p => p.category)
        .filter((c): c is string => !!c)
    ));

    const orderedCats = defaultCats.filter(cat => dbCats.includes(cat.name));
    const extraCats = dbCats
      .filter(catName => !defaultCats.some(dc => dc.name === catName))
      .map(catName => ({ name: catName, label: catName }));

    return [...orderedCats, ...extraCats, { name: "All", label: language === "sw" ? "Vitengo Vyote" : "All Products" }];
  }, [allProducts, language]);

  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Focus mobile search bar when navigating with search-focus query parameter
  useEffect(() => {
    if (location.search.includes("search-focus=true")) {
      const input = document.getElementById("mobile-search-input");
      if (input) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          input.focus();
        }, 150);
      }
    }
  }, [location.search]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), limit(40));
        
        // 1. Instant local-first retrieval using Firestore local cache
        let loadedFromCache = false;
        try {
          const cacheSnapshot = await getDocsFromCache(q);
          if (!cacheSnapshot.empty) {
            const cachedList = cacheSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Product))
              .filter(p => p.active !== false && (!p.approvalStatus || p.approvalStatus === "approved"));
            if (cachedList.length > 0) {
              setAllProducts(cachedList);
              cachedList.forEach(p => productCache.set(p.id, p));
              loadedFromCache = true;
            }
          }
        } catch {
          // Cache miss on cold boot - fallback to network fetch
        }

        if (loadedFromCache) return;

        // 2. Fetch network snapshot only if cache was empty
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.active !== false && (!p.approvalStatus || p.approvalStatus === "approved"));
        setAllProducts(fetched);
        fetched.forEach(p => productCache.set(p.id, p));
      } catch (err) {
        console.warn("Failed to fetch products for predictive search:", err);
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
      setSuggestedCategories([]);
      setShowDesktopSuggestions(false);
      setIsMobileMenuOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (val.trim()) {
      const queryStr = val.trim();

      // 1. Filter predictive matching categories
      const categorySet = new Set<string>();
      const seedCategories = [
        "Electronics", "Phones & Tablets", "Computers & Laptops",
        "TV & Audio", "Home & Kitchen", "Fashion", "Beauty & Personal Care",
        "Sports & Fitness", "Automotive", "Supermarket"
      ];
      seedCategories.forEach(c => categorySet.add(c));
      allProducts.forEach(p => { if (p.category) categorySet.add(p.category); });

      const matchedCats = Array.from(categorySet)
        .filter(cat => matchesFuzzyQuery(cat, queryStr))
        .slice(0, 3);
      setSuggestedCategories(matchedCats);

      // 2. Filter predictive matching products with slang/typo tolerance
      const filtered = allProducts.filter(p => 
        matchesFuzzyQuery(p.name, queryStr) || 
        (p.description && matchesFuzzyQuery(p.description, queryStr)) ||
        (p.category && matchesFuzzyQuery(p.category, queryStr)) ||
        (p.sellerName && matchesFuzzyQuery(p.sellerName, queryStr)) ||
        (p.artisan && matchesFuzzyQuery(p.artisan, queryStr))
      ).slice(0, 5);
      setSuggestedProducts(filtered);
    } else {
      setSuggestedProducts([]);
      setSuggestedCategories([]);
    }
  };

  const handleProductSelect = (productId: string) => {
    const matchedProduct = allProducts.find(p => p.id === productId);
    navigate(`/product/${productId}`, { state: matchedProduct ? { product: matchedProduct } : undefined });
    setSearch("");
    setSuggestedProducts([]);
    setSuggestedCategories([]);
    setShowDesktopSuggestions(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleCategorySelect = (categoryName: string) => {
    navigate(`/?category=${encodeURIComponent(categoryName)}`);
    setSearch("");
    setSuggestedProducts([]);
    setSuggestedCategories([]);
    setShowDesktopSuggestions(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleCategoryClick = (categoryName: string, searchVal?: string) => {
    let target = `/?category=${encodeURIComponent(categoryName)}`;
    if (searchVal) {
      target += `&search=${encodeURIComponent(searchVal)}`;
    }
    navigate(target);
    if (location.pathname === "/") {
      setTimeout(() => {
        document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const navLinks = [
    { label: t("home"), path: "/" },
    { label: t("blog"), path: "/blog" },
    ...(user?.isAdmin ? [{ label: t("admin"), path: "/admin" }] : []),
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 bg-[#000000] text-white transition-all duration-300">
      {/* 1. Top Bar Utility (Hidden on Mobile, Scroll-Aware Collapsing) */}
      <div className={`hidden md:block bg-[#151515] dark:bg-[#0a0a0a] text-gray-300 text-[11px] px-4 border-b border-gray-900 transition-all duration-300 ease-in-out ${
        isNavCompact ? "max-h-0 py-0 opacity-0 border-none pointer-events-none overflow-hidden" : "max-h-12 py-2 opacity-100 overflow-visible"
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between font-bold">
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-1.5 cursor-pointer hover:text-amber-400 transition-colors"
            >
              Deliver to <span className="text-white font-extrabold flex items-center gap-1.5">
                <img 
                  src={COUNTRY_FLAG_IMAGES[deliveryCountry] || "https://flagcdn.com/w40/ke.png"} 
                  alt={deliveryCountry} 
                  className="w-4 h-3 object-cover rounded-xs border border-gray-800/80 shrink-0 select-none"
                  referrerPolicy="no-referrer"
                />
                <span>{deliveryCity}</span>
              </span>
              <ChevronDown size={11} className="text-gray-400" />
            </div>
            <span className="text-gray-700">|</span>
            <LocalWeatherWidget deliveryCity={deliveryCity} deliveryCountry={deliveryCountry} />
            <span className="text-gray-700">|</span>
            <div className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              🚚 Express Delivery
            </div>
            <span className="text-gray-700">|</span>
            <Link
              to="/returns"
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              🔄 Free Returns
            </Link>
          </div>

          <div className="flex items-center gap-5">
            {/* Theme Toggle pill */}
            <div 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-1.5 cursor-pointer select-none text-gray-400 hover:text-white transition-colors group"
            >
              <div className="w-9 h-4.5 bg-gray-750 dark:bg-amber-500 rounded-full p-0.5 relative transition-colors">
                <div 
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center absolute top-0.5 transition-all duration-200 bg-white shadow-sm ${
                    theme === "dark" ? "left-5" : "left-0.5"
                  }`}
                >
                  {theme === "dark" ? (
                    <Moon size={8} className="text-amber-600 stroke-[3]" />
                  ) : (
                    <Sun size={8} className="text-amber-500 stroke-[3]" />
                  )}
                </div>
              </div>
            </div>

            <span className="text-gray-700">|</span>

            {/* Currency selector */}
            <div 
              className="relative py-1 group"
              onMouseEnter={() => {
                setShowCurrencyDropdown(true);
                setShowLanguageDropdown(false);
              }}
              onMouseLeave={() => setShowCurrencyDropdown(false)}
            >
              <div 
                onClick={() => {
                  setShowCurrencyDropdown(!showCurrencyDropdown);
                  setShowLanguageDropdown(false);
                }}
                className="flex items-center gap-1 cursor-pointer select-none text-gray-400 hover:text-white transition-colors uppercase font-black py-0.5 px-1 rounded hover:bg-white/10"
              >
                <span>{currency}</span>
                <ChevronDown size={11} className={`text-gray-400 transition-transform duration-200 ${showCurrencyDropdown ? "rotate-180 text-amber-400" : ""}`} />
              </div>
              <AnimatePresence>
                {showCurrencyDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 3 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full pt-1 z-50"
                  >
                    <div className="bg-[#222222] border border-gray-800 text-white rounded-xl shadow-2xl py-1 w-32 overflow-hidden font-extrabold text-left backdrop-blur-md">
                      {(["KES", "USD"] as const).map((curr) => (
                        <div 
                          key={curr}
                          onClick={() => {
                            setCurrency(curr);
                            setShowCurrencyDropdown(false);
                            toast.success(`Currency changed to ${curr}`);
                          }}
                          className={`px-3 py-2 hover:bg-amber-400 hover:text-black transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
                            currency === curr ? "text-amber-400 bg-white/5" : "text-gray-300"
                          }`}
                        >
                          <span>{curr} ({curr === "KES" ? "KSh" : "$"})</span>
                          {currency === curr && <Check size={12} className="text-amber-400" />}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="text-gray-700">|</span>

            {/* Language Selector */}
            <div 
              className="relative py-1 group"
              onMouseEnter={() => {
                setShowLanguageDropdown(true);
                setShowCurrencyDropdown(false);
              }}
              onMouseLeave={() => setShowLanguageDropdown(false)}
            >
              <div 
                onClick={() => {
                  setShowLanguageDropdown(!showLanguageDropdown);
                  setShowCurrencyDropdown(false);
                }}
                className="flex items-center gap-1 cursor-pointer select-none text-gray-400 hover:text-white transition-colors uppercase font-black py-0.5 px-1 rounded hover:bg-white/10"
              >
                <Globe size={11} className="text-gray-400 group-hover:text-amber-400 transition-colors" />
                <span>{language === "sw" ? "Kiswahili" : "English"}</span>
                <ChevronDown size={11} className={`text-gray-400 transition-transform duration-200 ${showLanguageDropdown ? "rotate-180 text-amber-400" : ""}`} />
              </div>
              <AnimatePresence>
                {showLanguageDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 3 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full pt-1 z-50"
                  >
                    <div className="bg-[#222222] border border-gray-800 text-white rounded-xl shadow-2xl py-1 w-36 overflow-hidden font-extrabold text-left backdrop-blur-md">
                      <div 
                        onClick={() => {
                          setLanguage("en");
                          setShowLanguageDropdown(false);
                          toast.success("Language changed to English");
                        }}
                        className={`px-3 py-2 hover:bg-amber-400 hover:text-black transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
                          language === "en" ? "text-amber-400 bg-white/5" : "text-gray-300"
                        }`}
                      >
                        <span>English (US)</span>
                        {language === "en" && <Check size={12} className="text-amber-400" />}
                      </div>
                      <div 
                        onClick={() => {
                          setLanguage("sw");
                          setShowLanguageDropdown(false);
                          toast.success("Lugha imebadilishwa kuwa Kiswahili");
                        }}
                        className={`px-3 py-2 hover:bg-amber-400 hover:text-black transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
                          language === "sw" ? "text-amber-400 bg-white/5" : "text-gray-300"
                        }`}
                      >
                        <span>Kiswahili (KE)</span>
                        {language === "sw" && <Check size={12} className="text-amber-400" />}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Header (Black background) */}
      <div className="bg-[#000000] border-b border-gray-900 relative z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex justify-between items-center gap-4 transition-all duration-300 ${isNavCompact ? "h-12" : "h-16"}`}>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 text-gray-300 hover:text-white transition-colors border-none bg-transparent"
              >
                <Menu size={22} />
              </button>
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-xl sm:text-2xl font-bold tracking-tighter text-orange-600 select-none cursor-pointer hover:opacity-90 flex items-center">
                {settings.brandLogoUrl ? (
                  <img src={settings.brandLogoUrl} alt="Sokoplus" className={`${isNavCompact ? "h-7" : "h-8 md:h-10"} w-auto object-contain transition-all`} referrerPolicy="no-referrer" />
                ) : (
                  <>Sokoplus<span className="text-white">.</span></>
                )}
              </Link>
              <div className="md:hidden flex items-center">
                <LocalWeatherWidget deliveryCity={deliveryCity} deliveryCountry={deliveryCountry} compact />
              </div>
            </div>

            {/* Centered Desktop Search */}
            <div className="hidden md:block flex-grow max-w-xl mx-4 relative">
              <form onSubmit={handleSearch} className="w-full flex">
                <div className="relative w-full flex items-center">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setShowDesktopSuggestions(true)}
                    placeholder={language === "sw" ? "Tafuta Sokoplus..." : "Search Sokoplus"}
                    className="block w-full h-10 px-4 rounded-l-md border-none leading-5 bg-white placeholder-gray-450 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-semibold transition-all"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center space-x-1.5">
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setSuggestedProducts([]);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        title={language === "sw" ? "Futa" : "Clear"}
                      >
                        <X size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleVoiceSearch}
                      className={`p-1 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                        isListening
                          ? "text-red-600 bg-red-50 animate-pulse scale-110"
                          : "text-gray-400 hover:text-amber-500"
                      }`}
                      title={language === "sw" ? "Tafuta kwa sauti" : "Search by voice"}
                    >
                      {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-500 text-black h-10 px-5 rounded-r-md flex items-center justify-center transition-all cursor-pointer font-black text-xs active:scale-95 shadow-md shadow-amber-400/10 shrink-0"
                >
                  <Search size={18} className="stroke-[2.5]" />
                </button>
              </form>

              {/* Desktop Suggestions Dropdown */}
              <AnimatePresence>
                {showDesktopSuggestions && (search.trim() || suggestedProducts.length > 0 || suggestedCategories.length > 0) && (
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
                      className="absolute left-0 right-0 mt-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-white rounded-2xl border border-gray-150 dark:border-gray-800 shadow-2xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800"
                    >
                      {/* Suggested Categories */}
                      {suggestedCategories.length > 0 && (
                        <div className="p-3 bg-gray-50/70 dark:bg-gray-850/50">
                          <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1.5 px-1">
                            <Layers size={11} className="text-amber-500" /> Matching Categories
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {suggestedCategories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => handleCategorySelect(cat)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-amber-400 hover:text-black hover:border-amber-400 transition-all cursor-pointer shadow-2xs"
                              >
                                <span>📁</span> {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Products */}
                      {suggestedProducts.length > 0 ? (
                        <div className="p-3 space-y-1">
                          <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1 flex items-center gap-1.5 px-1">
                            <ShoppingBag size={11} className="text-orange-500" /> Suggested Products
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {suggestedProducts.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => handleProductSelect(p.id)}
                                onMouseEnter={() => prefetchProductAssets(p)}
                                onTouchStart={() => prefetchProductAssets(p)}
                                className="flex items-center space-x-3 py-2 cursor-pointer hover:bg-orange-50/50 dark:hover:bg-gray-800/60 rounded-xl px-2 group transition-all"
                              >
                                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-200/50 dark:border-gray-700/50">
                                  <FastImage 
                                    src={p.images?.[0] || ""} 
                                    alt={p.name} 
                                    fallbackIconSize={14}
                                  />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-amber-500 transition-colors">{p.name}</p>
                                </div>
                                <div className="text-xs font-extrabold text-gray-950 dark:text-gray-50 whitespace-nowrap tabular-nums">
                                  {formatPrice(p.price)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        suggestedCategories.length === 0 && search.trim() && (
                          <div className="text-center py-5 px-4 text-xs font-semibold text-gray-400">
                            No matching products or categories for "<span className="font-bold text-gray-700 dark:text-gray-300">{search}</span>"
                          </div>
                        )
                      )}

                      {search.trim() && (
                        <div 
                          onClick={handleSearch}
                          className="p-3 bg-gray-50 dark:bg-gray-950/80 hover:bg-amber-400 dark:hover:bg-amber-400 hover:text-black text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Search size={14} className="text-amber-500" />
                            Search all results for "<span className="truncate max-w-[200px]">{search}</span>"
                          </span>
                          <ChevronRight size={14} />
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop Navigation Icons */}
            <div className="hidden md:flex items-center space-x-6 z-40">
              {/* Account Dropdown */}
              <div 
                onMouseEnter={() => setShowAccountDropdown(true)}
                onMouseLeave={() => setShowAccountDropdown(false)}
                className="relative py-2"
              >
                <div className="flex items-center gap-2.5 cursor-pointer text-gray-300 hover:text-white transition-colors py-1 select-none">
                  <User size={22} className="text-gray-300" />
                  <div className="text-left">
                    <span className="text-[9px] uppercase font-black tracking-wider text-gray-400 block leading-none mb-0.5">YOUR ACCOUNT</span>
                    <span className="flex items-center gap-0.5 text-xs font-black text-white leading-none">
                      {user ? (user.displayName || "Mwanasoko") : "Sign In"}
                      <ChevronDown size={11} className="text-gray-400 stroke-[2.5]" />
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {showAccountDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 mt-1 bg-white text-gray-850 dark:bg-gray-900 dark:text-white border border-gray-150 dark:border-gray-800 rounded-xl shadow-2xl py-2 w-48 z-50 font-extrabold text-xs text-left divide-y divide-gray-100 dark:divide-gray-800"
                    >
                      {user ? (
                        <>
                          <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-[10px] uppercase font-black tracking-wider">
                            Hello, {user.displayName || "User"}
                          </div>
                          <div className="py-1">
                            <Link to="/profile" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors cursor-pointer text-gray-800 dark:text-gray-200">
                              My Account / Profile
                            </Link>
                            {user.isAdmin && (
                              <Link to="/admin" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors cursor-pointer text-amber-500 font-black">
                                Admin Dashboard
                              </Link>
                            )}
                          </div>
                          <div className="py-1">
                            <button 
                              onClick={() => {
                                setShowLogoutConfirm(true);
                                setShowAccountDropdown(false);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors cursor-pointer text-left bg-transparent border-none font-bold animate-pulse-subtle"
                            >
                              Sign Out
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="p-3 space-y-2">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase text-center">Manage orders and locations</p>
                          <Link 
                            to="/login"
                            className="block w-full text-center bg-amber-400 hover:bg-amber-500 text-black py-2 rounded-lg font-black transition-colors"
                          >
                            Sign In
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Wishlist Link */}
              <Link to="/wishlist" className="relative flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors py-1 group select-none">
                <Heart size={22} className="text-gray-300 group-hover:text-red-500 transition-colors" />
                <div className="text-left">
                  <span className="text-[9px] uppercase font-black tracking-wider text-gray-400 block leading-none mb-0.5">WISHLIST</span>
                  <span className="text-xs font-black text-white leading-none">FAVORITES</span>
                </div>
                {user?.wishlist && user.wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-md">
                    {user.wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart Link */}
              <Link to="/cart" className="relative flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors py-1 group select-none">
                <motion.div
                  animate={isBouncing ? { scale: [1, 1.4, 0.85, 1.15, 0.95, 1] } : { scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="relative"
                >
                  <ShoppingCart size={22} className="text-gray-300 group-hover:text-amber-400 transition-colors" />
                </motion.div>
                <div className="text-left">
                  <span className="text-[9px] uppercase font-black tracking-wider text-gray-400 block leading-none mb-0.5">YOUR CART</span>
                  <span className="text-xs font-black text-white leading-none">SHOPPING</span>
                </div>
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1 -right-2.5 bg-[#FDD017] text-gray-950 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-md tabular-nums"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Link>
            </div>


          </div>
        </div>
      </div>

      {/* 3. Sub-Navbar Navigation Bar (Desktop only, gold/yellow background, Scroll-Aware Collapsing) */}
      <div className={`hidden md:block bg-[#f5c105] text-black border-b border-amber-500 shadow-md relative z-20 transition-all duration-300 ease-in-out ${
        isNavCompact ? "max-h-0 border-none opacity-0 pointer-events-none h-0 overflow-hidden" : "max-h-12 opacity-100 h-10 overflow-visible"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between w-full h-full text-xs font-black uppercase tracking-wider relative">
          <div className="flex items-center h-full">
            {/* ALL CATEGORIES Megamenu toggle */}
            <div 
              onMouseEnter={() => setShowAllCategoriesMenu(true)}
              onMouseLeave={() => setShowAllCategoriesMenu(false)}
              className="relative h-full"
            >
              <div className="bg-amber-500 hover:bg-amber-600 h-full px-5 flex items-center gap-2 cursor-pointer transition-all border-r border-amber-600/20 select-none text-black">
                <Menu size={14} className="stroke-[2.5]" />
                <span>ALL CATEGORIES</span>
                <ChevronDown size={11} className={`stroke-[2.5] transition-transform duration-200 ${showAllCategoriesMenu ? "rotate-180" : ""}`} />
              </div>
              
              <AnimatePresence>
                {showAllCategoriesMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 bg-white text-gray-800 border border-gray-150 rounded-b-xl shadow-2xl py-1.5 w-56 z-50 text-left font-black text-xs divide-y divide-gray-50"
                  >
                    {activeCategories.map((cat) => (
                      <div 
                        key={cat.name}
                        onClick={() => {
                          handleCategoryClick(cat.name === "All" ? "All" : cat.name);
                          setShowAllCategoriesMenu(false);
                        }}
                        className="px-4 py-2.5 hover:bg-amber-400 hover:text-black transition-colors cursor-pointer text-gray-800 font-extrabold border-none"
                      >
                        {cat.label}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Direct categories */}
            <div className="flex items-center h-full">
              <Link 
                to="/"
                className="hover:bg-amber-500 px-4 h-full flex items-center transition-all cursor-pointer border-r border-amber-600/10 text-black no-underline select-none font-extrabold"
              >
                HOME
              </Link>
              {activeCategories.filter(cat => cat.name !== "All").map((cat) => (
                <div 
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className="hover:bg-amber-500 px-4 h-full flex items-center transition-all cursor-pointer border-r border-amber-600/10 text-black select-none font-extrabold uppercase whitespace-nowrap"
                >
                  {cat.name === "Local Crafts" ? (language === "sw" ? "SANAA ZA MIKONO" : "LOCAL CRAFTS") : 
                   cat.name === "Fashion" ? (language === "sw" ? "MITINDO" : "FASHION") : 
                   cat.name === "Electronics" ? (language === "sw" ? "VIFAA VYA KIDIITALI" : "ELECTRONICS") : 
                   cat.name === "Groceries" ? (language === "sw" ? "VYAKULA" : "GROCERIES") : 
                   cat.name === "Beauty & Personal Care (Skincare, Haircare, Cosmetics)" ? (language === "sw" ? "UREMBO NA VIPODOZI" : "BEAUTY & PERSONAL CARE") :
                   cat.name === "Home & Office Décor (Small Scale & Gadgets)" ? (language === "sw" ? "MAPAMBO" : "HOME & OFFICE DÉCOR") :
                   cat.name === "Pet Supplies (Toys, Collars, Accessories, Dry Kibble)" ? (language === "sw" ? "VIFAA VYA WANYAMA" : "PET SUPPLIES") :
                   cat.label}
                </div>
              ))}
            </div>
          </div>


        </div>
      </div>

      {/* Modern, Neutral, High-Visibility Mobile Search Bar (Scroll-Aware Collapsing & Smooth Focus Expansion) */}
      <div className={`md:hidden px-4 border-b border-gray-100 dark:border-gray-850 bg-white/95 dark:bg-gray-950/95 relative transition-all duration-300 ease-in-out overflow-hidden ${
        isNavCompact && !isMobileSearchFocused && !search 
          ? "max-h-0 py-0 opacity-0 border-none pointer-events-none" 
          : isMobileSearchFocused 
          ? "max-h-20 py-2.5 opacity-100 shadow-xl border-amber-500" 
          : "max-h-14 py-2 opacity-100"
      }`}>
        <form onSubmit={handleSearch} className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-450 dark:text-gray-400">
            <Search size={isMobileSearchFocused ? 17 : 15} className={`transition-all ${isMobileSearchFocused ? "text-amber-500" : ""}`} />
          </span>
          <input
            id="mobile-search-input"
            type="text"
            value={search}
            onFocus={() => setIsMobileSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsMobileSearchFocused(false), 200)}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={language === "sw" ? "Tafuta Sokoplus..." : "Search Sokoplus"}
            className={`block w-full pl-9 pr-14 border border-gray-200/80 dark:border-gray-800 rounded-xl leading-5 bg-gray-50/80 dark:bg-gray-900/80 placeholder-gray-400 dark:placeholder-gray-500 text-gray-800 dark:text-gray-100 font-medium focus:outline-none focus:bg-white focus:dark:bg-gray-950 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner-sm ${
              isMobileSearchFocused ? "py-2.5 text-sm ring-2 ring-amber-500/50" : "py-1.5 text-xs"
            }`}
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1">
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSuggestedProducts([]);
                  setSuggestedCategories([]);
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
          {(suggestedProducts.length > 0 || suggestedCategories.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-4 right-4 mt-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-2xl max-h-72 overflow-y-auto p-3 space-y-2 z-[100] divide-y divide-gray-100 dark:divide-gray-800"
            >
              {suggestedCategories.length > 0 && (
                <div className="space-y-1.5 pb-2">
                  <div className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <Layers size={10} className="text-amber-500" /> Categories
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-amber-400 hover:text-black transition-colors cursor-pointer"
                      >
                        📁 {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {suggestedProducts.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <ShoppingBag size={10} className="text-orange-500" /> Products
                  </div>
                  {suggestedProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleProductSelect(p.id)}
                      className="flex items-center space-x-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 rounded-xl transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-150 dark:border-gray-700">
                        <FastImage 
                          src={p.images?.[0] || ""} 
                          alt={p.name} 
                          fallbackIconSize={14}
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-xs font-bold text-gray-950 dark:text-gray-100 truncate">{p.name}</p>
                      </div>
                      <div className="text-xs font-black text-gray-900 dark:text-gray-100 whitespace-nowrap tabular-nums">
                        {formatPrice(p.price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Elegant premium backdrop with deep blur - High z-index to stay above other floating tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.225 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-lg z-[140] md:hidden"
            />
            {/* Spring-physics powered right-to-left drawer - Solid background and High z-index to overlay perfectly */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 31, stiffness: 296, restDelta: 0.5 }}
              drag="x"
              dragConstraints={{ left: 0, right: 320 }}
              dragElastic={{ left: 0, right: 0.6 }}
              onDragEnd={(e, info) => {
                if (info.offset.x > 80) {
                  setIsMobileMenuOpen(false);
                }
              }}
              className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-950 shadow-2xl z-[150] md:hidden p-6 flex flex-col space-y-6 touch-pan-y transition-all duration-[270ms] border-l border-gray-100 dark:border-gray-850"
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
                  className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all focus:border-orange-500 focus:bg-white focus:dark:bg-gray-950 font-medium"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSuggestedProducts([]);
                        setSuggestedCategories([]);
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

              {/* Mobile Drawer Predictive Search Dropdown */}
              <AnimatePresence>
                {(suggestedProducts.length > 0 || suggestedCategories.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-2xl max-h-72 overflow-y-auto p-3 space-y-2 divide-y divide-gray-100 dark:divide-gray-800"
                  >
                    {suggestedCategories.length > 0 && (
                      <div className="space-y-1.5 pb-2">
                        <div className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                          <Layers size={10} className="text-amber-500" /> Matching Categories
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => handleCategorySelect(cat)}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-amber-400 hover:text-black transition-colors cursor-pointer"
                            >
                              📁 {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestedProducts.length > 0 && (
                      <div className="space-y-1 pt-2">
                        <div className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                          <ShoppingBag size={10} className="text-orange-500" /> Products
                        </div>
                        {suggestedProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleProductSelect(p.id)}
                            className="flex items-center space-x-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 rounded-xl transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-150 dark:border-gray-700">
                              <FastImage 
                                src={p.images?.[0] || ""} 
                                alt={p.name} 
                                fallbackIconSize={14}
                              />
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className="text-xs font-bold text-gray-950 dark:text-gray-100 truncate">{p.name}</p>
                            </div>
                            <div className="text-xs font-black text-gray-900 dark:text-gray-100 whitespace-nowrap tabular-nums">
                              {formatPrice(p.price)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile Currency Quick Switcher */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 p-3 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <Coins size={15} className="text-orange-500" />
                  <span>{language === "sw" ? "Matawi ya Pesa:" : "Site Currency:"}</span>
                </div>
                <div className="flex bg-gray-200 dark:bg-gray-800 p-0.5 rounded-xl">
                  {(["KES", "USD"] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => {
                        setCurrency(curr);
                        toast.success(`Currency changed to ${curr}`);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        currency === curr
                          ? "bg-orange-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category tag for organization */}
              <div className="text-[10px] uppercase font-black tracking-widest text-orange-600 dark:text-orange-500 px-1 py-0.5 select-none pt-2 opacity-80">
                Menu Directories
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
                className="flex flex-col space-y-3"
              >
                {/* Home */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6, scale: 1.01 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      location.pathname === "/"
                        ? "bg-orange-50/75 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 font-bold shadow-sm"
                        : "bg-gray-55 dark:bg-gray-900/30 border-gray-150/40 dark:border-gray-805/40 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className={`p-2 rounded-xl scale-110 transition-all ${
                        location.pathname === "/"
                          ? "bg-orange-100/60 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                          : "bg-white dark:bg-gray-950 text-gray-405 dark:text-gray-500 border border-gray-100 dark:border-gray-850"
                      }`}>
                        <ShoppingBag size={18} />
                      </div>
                      <span className="text-sm tracking-tight font-semibold">{t("home")}</span>
                    </div>
                    <ChevronRight size={16} className={`opacity-40 transition-all ${location.pathname === "/" ? "text-orange-500 opacity-90 scale-110" : ""}`} />
                  </Link>
                </motion.div>

                {/* Blog */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6, scale: 1.01 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/blog"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      location.pathname === "/blog"
                        ? "bg-orange-50/75 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 font-bold shadow-sm"
                        : "bg-gray-55 dark:bg-gray-900/30 border-gray-150/40 dark:border-gray-805/40 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className={`p-2 rounded-xl scale-110 transition-all ${
                        location.pathname === "/blog"
                          ? "bg-orange-100/60 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                          : "bg-white dark:bg-gray-950 text-gray-405 dark:text-gray-500 border border-gray-105 dark:border-gray-850"
                      }`}>
                        <Award size={18} />
                      </div>
                      <span className="text-sm tracking-tight font-semibold">{t("blog")}</span>
                    </div>
                    <ChevronRight size={16} className={`opacity-40 transition-all ${location.pathname === "/blog" ? "text-orange-500 opacity-90 scale-110" : ""}`} />
                  </Link>
                </motion.div>

                {/* Wishlist */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6, scale: 1.01 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/wishlist"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      location.pathname === "/wishlist"
                        ? "bg-orange-50/75 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 font-bold shadow-sm"
                        : "bg-gray-55 dark:bg-gray-900/30 border-gray-150/40 dark:border-gray-805/40 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className={`p-2 rounded-xl scale-110 transition-all ${
                        location.pathname === "/wishlist"
                          ? "bg-orange-100/60 dark:bg-orange-905/50 text-orange-600 dark:text-orange-400"
                          : "bg-white dark:bg-gray-950 text-gray-405 dark:text-gray-500 border border-gray-105 dark:border-gray-850"
                      }`}>
                        <Heart size={18} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm tracking-tight font-semibold">{t("wishlist")}</span>
                        {user?.wishlist && user.wishlist.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                            {user.wishlist.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className={`opacity-40 transition-all ${location.pathname === "/wishlist" ? "text-orange-500 opacity-90 scale-110" : ""}`} />
                  </Link>
                </motion.div>

                {/* Profile */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 25 },
                    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                  }}
                  whileHover={{ x: 6, scale: 1.01 }} 
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                      location.pathname === "/profile"
                        ? "bg-orange-50/75 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 font-bold shadow-sm"
                        : "bg-gray-55 dark:bg-gray-900/30 border-gray-150/40 dark:border-gray-850/40 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className={`p-2 rounded-xl scale-110 transition-all ${
                        location.pathname === "/profile"
                          ? "bg-orange-100/60 dark:bg-orange-905/50 text-orange-600 dark:text-orange-400"
                          : "bg-white dark:bg-gray-950 text-gray-405 dark:text-gray-500 border border-gray-105 dark:border-gray-850"
                      }`}>
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || "User"} className="w-[18px] h-[18px] object-cover rounded-full border border-gray-250 dark:border-gray-800" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={18} />
                        )}
                      </div>
                      <span className="text-sm tracking-tight font-semibold">{t("profile")}</span>
                    </div>
                    <ChevronRight size={16} className={`opacity-40 transition-all ${location.pathname === "/profile" ? "text-orange-500 opacity-90 scale-110" : ""}`} />
                  </Link>
                </motion.div>

                {/* Admin Control */}
                {user?.isAdmin && (
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, x: 25 },
                      show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                    }}
                    whileHover={{ x: 6, scale: 1.01 }} 
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      to="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        location.pathname === "/admin"
                          ? "bg-orange-50/75 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 font-bold shadow-sm"
                          : "bg-gray-55 dark:bg-gray-900/30 border-gray-150/40 dark:border-gray-805/40 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium"
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className={`p-2 rounded-xl scale-110 transition-all ${
                          location.pathname === "/admin"
                            ? "bg-orange-100/60 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                            : "bg-white dark:bg-gray-950 text-gray-405 dark:text-gray-500 border border-gray-105 dark:border-gray-850"
                        }`}>
                          <Award size={18} />
                        </div>
                        <span className="text-sm tracking-tight font-semibold">{t("admin")}</span>
                      </div>
                      <ChevronRight size={16} className={`opacity-40 transition-all ${location.pathname === "/admin" ? "text-orange-500 opacity-90 scale-110" : ""}`} />
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
                      className="block w-full bg-orange-600 hover:bg-orange-700 text-white text-center py-4 rounded-2xl font-bold text-base transition-colors shadow-md animate-pulse"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60]"
            />
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: isMobile ? 32 : 25 }}
              className={`fixed ${isMobile ? "bottom-0 left-0 right-0 rounded-t-[2.5rem] p-6 pb-8" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-3xl p-8"} bg-white dark:bg-gray-900 z-[70] shadow-2xl space-y-6 text-gray-900 dark:text-gray-100 border-t md:border border-gray-150 dark:border-gray-800`}
            >
              {isMobile && (
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-1 cursor-pointer" onClick={() => setShowLogoutConfirm(false)} />
              )}
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center text-red-500">
                  <LogOut size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">Sign Out?</h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Are you sure you want to sign out of your account?</p>
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => {
                    auth.signOut();
                    setShowLogoutConfirm(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-55 dark:bg-gray-800 text-gray-900 dark:text-white py-4 rounded-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Choose your delivery location Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[100]"
            />
            {/* Modal */}
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: isMobile ? 32 : 25 }}
              className={`fixed ${isMobile ? "bottom-0 left-0 right-0 rounded-t-[2.5rem] p-6 pb-8" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-2xl p-6"} bg-[#1e1e1e] border-t md:border border-gray-800 z-[110] shadow-2xl space-y-5 text-white`}
            >
              {isMobile && (
                <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-1 cursor-pointer" onClick={() => setShowLocationModal(false)} />
              )}

              <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Choose your delivery location
                </h3>
                <button 
                  onClick={() => setShowLocationModal(false)}
                  className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-300 font-semibold leading-relaxed">
                Delivery options and delivery speeds may vary depending on the location.
              </p>

              {/* OpenMaps Real-time Location Search Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-gray-300 tracking-wider">
                  🔍 Search Address or Landmark (OpenMaps)
                </label>
                <DeliveryLocationSearch
                  darkTheme={true}
                  placeholder="Type city, street or landmark (e.g. Westlands, Nakuru)..."
                  countryHint={deliveryCountry}
                  onSelectLocation={async (loc) => {
                    const matchedCountry = Object.keys(CITIES_BY_COUNTRY).find(
                      c => c.toLowerCase() === loc.country.toLowerCase()
                    ) || deliveryCountry;

                    let matchedCity = loc.city;
                    const availableCities = CITIES_BY_COUNTRY[matchedCountry] || [];
                    const cityMatch = availableCities.find(
                      c => c.toLowerCase().includes(loc.city.toLowerCase()) || loc.displayName.toLowerCase().includes(c.toLowerCase())
                    );
                    if (cityMatch) matchedCity = cityMatch;

                    setDeliveryCountry(matchedCountry);
                    setDeliveryCity(matchedCity);

                    localStorage.setItem("sokoplus_delivery_country", matchedCountry);
                    localStorage.setItem("sokoplus_delivery_city", matchedCity);
                    localStorage.setItem("sokoplus_delivery_address", loc.shortAddress);
                    localStorage.setItem("sokoplus_delivery_lat", String(loc.lat));
                    localStorage.setItem("sokoplus_delivery_lng", String(loc.lng));

                    const activeUid = auth.currentUser?.uid || user?.uid;
                    if (activeUid) {
                      try {
                        const userRef = doc(db, "users", activeUid);
                        await setDoc(userRef, {
                          deliveryCountry: matchedCountry,
                          deliveryCity: matchedCity,
                          deliveryAddress: loc.shortAddress,
                          updatedAt: new Date().toISOString()
                        }, { merge: true });
                      } catch (err) {
                        console.warn("Could not sync delivery address:", err);
                      }
                    }

                    setShowLocationModal(false);
                    toast.success(`Delivery set to: ${loc.shortAddress}`, {
                      icon: COUNTRY_FLAGS[matchedCountry] || "📍"
                    });
                  }}
                />
              </div>

              {user ? (
                <Link
                  to="/profile"
                  onClick={() => setShowLocationModal(false)}
                  className="w-full bg-[#f5c105] hover:bg-amber-500 text-black py-2 rounded-lg text-xs font-black transition-all text-center block active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  Manage addresses in Profile
                </Link>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setShowLocationModal(false)}
                  className="w-full bg-[#f5c105] hover:bg-amber-500 text-black py-2 rounded-lg text-xs font-black transition-all text-center block active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  Login to manage addresses
                </Link>
              )}

              <div className="flex items-center justify-center gap-3 text-[10px] font-black uppercase text-gray-500 tracking-widest py-1">
                <span className="flex-grow border-t border-gray-800" />
                <span>OR Select Region</span>
                <span className="flex-grow border-t border-gray-800" />
              </div>

              <div className="space-y-4">
                {/* Country Selector */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                    Country
                  </label>
                  <select
                    value={deliveryCountry}
                    onChange={(e) => {
                      const selectedCountry = e.target.value;
                      setDeliveryCountry(selectedCountry);
                      const firstCity = CITIES_BY_COUNTRY[selectedCountry][0];
                      setDeliveryCity(firstCity);
                    }}
                    className="w-full bg-[#2a2a2a] border border-gray-800 text-white rounded-lg p-2.5 text-xs font-extrabold focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    {Object.keys(CITIES_BY_COUNTRY).map((cty) => (
                      <option key={cty} value={cty} className="bg-[#1e1e1e]">
                        {COUNTRY_FLAGS[cty]} {cty}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Selector */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                    City
                  </label>
                  <select
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    className="w-full bg-[#2a2a2a] border border-gray-800 text-white rounded-lg p-2.5 text-xs font-extrabold focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    {CITIES_BY_COUNTRY[deliveryCountry]?.map((ct) => (
                      <option key={ct} value={ct} className="bg-[#1e1e1e]">
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={async () => {
                    localStorage.setItem("sokoplus_delivery_country", deliveryCountry);
                    localStorage.setItem("sokoplus_delivery_city", deliveryCity);

                    const activeUid = auth.currentUser?.uid || user?.uid;
                    if (activeUid) {
                      try {
                        const userRef = doc(db, "users", activeUid);
                        await setDoc(userRef, {
                          deliveryCountry,
                          deliveryCity,
                          updatedAt: new Date().toISOString()
                        }, { merge: true });
                      } catch (err) {
                        console.warn("Could not sync delivery location to user profile:", err);
                      }
                    }

                    setShowLocationModal(false);
                    toast.success(`Delivery address configured to ${deliveryCity}, ${deliveryCountry}`, {
                      icon: COUNTRY_FLAGS[deliveryCountry]
                    });
                  }}
                  className="w-full bg-[#f5c105] hover:bg-amber-500 text-black py-2.5 rounded-lg text-xs font-black transition-all text-center active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  Confirm Location
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
