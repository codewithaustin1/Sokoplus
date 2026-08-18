import { useState, useEffect, useRef, useMemo } from "react";
import { AfricanCitiesSlideshow } from "./AfricanCitiesSlideshow";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut, X, ShoppingBag, Heart, Award, Layers, Mic, MicOff, ChevronRight, ChevronDown, Globe, Moon, Sun, Grid, Check, Coins, Store, Compass, BookOpen, HelpCircle, PhoneCall } from "lucide-react";
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
  const { settings, loading: settingsLoading } = useSettings();
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
  const [showDrawerLanguageMenu, setShowDrawerLanguageMenu] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showAllCategoriesMenu, setShowAllCategoriesMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [animatingDrawerItemId, setAnimatingDrawerItemId] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
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
        (p.subcategory && matchesFuzzyQuery(p.subcategory, queryStr)) ||
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
                <span>{language === "sw" ? "Swahili" : "English"}</span>
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
                        <span>English</span>
                        {language === "en" && <Check size={12} className="text-amber-400" />}
                      </div>
                      <div 
                        onClick={() => {
                          setLanguage("sw");
                          setShowLanguageDropdown(false);
                          toast.success("Lugha imebadilishwa kuwa Swahili");
                        }}
                        className={`px-3 py-2 hover:bg-amber-400 hover:text-black transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
                          language === "sw" ? "text-amber-400 bg-white/5" : "text-gray-300"
                        }`}
                      >
                        <span>Swahili</span>
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
                ) : settingsLoading ? (
                  <div className={`${isNavCompact ? "h-7" : "h-8 md:h-10"} w-28 bg-gray-800/30 dark:bg-gray-800/50 rounded animate-pulse`} />
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
              <Link to="/cart" className="relative flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors py-1 group select-none">
                <motion.div
                  animate={isBouncing ? { scale: [1, 1.4, 0.85, 1.15, 0.95, 1] } : { scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="relative flex items-center justify-center min-w-[32px] h-[28px]"
                >
                  <ShoppingCart size={26} className="text-gray-200 group-hover:text-amber-400 transition-colors stroke-[2]" />
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1.5 left-[10px] text-amber-400 font-extrabold text-[12px] leading-none tabular-nums drop-shadow-xs"
                  >
                    {itemCount}
                  </motion.span>
                </motion.div>
                <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors self-end pb-0.5 tracking-tight">
                  Cart
                </span>
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
            {/* Elegant backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-md z-[140] md:hidden"
            />
            {/* Mobile Left-Side Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="x"
              dragConstraints={{ right: 0, left: -320 }}
              dragElastic={{ left: 0.6, right: 0 }}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -80) {
                  setIsMobileMenuOpen(false);
                }
              }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white dark:bg-gray-950 shadow-2xl z-[150] md:hidden flex flex-col justify-between overflow-y-auto touch-pan-y border-r border-gray-150 dark:border-gray-800 rounded-none"
            >
              {/* Top Banner Header with African Cities & Landmarks Slideshow (No orange overlay) */}
              <div>
                <AfricanCitiesSlideshow>
                  <div className="flex justify-between items-center">
                    <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="inline-block">
                      {settings.brandLogoUrl && !logoError ? (
                        <img 
                          src={settings.brandLogoUrl} 
                          alt="Sokoplus" 
                          onError={() => setLogoError(true)}
                          className="h-9 w-auto object-contain filter drop-shadow-md" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="flex items-center space-x-2.5 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/20 shadow-md">
                          <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-xs">
                            S
                          </div>
                          <span className="text-xl font-black tracking-tight text-white font-sans drop-shadow-sm">
                            Sokoplus<span className="text-amber-400">.</span>
                          </span>
                        </div>
                      )}
                    </Link>

                    <button 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="p-2 text-white hover:text-amber-300 bg-black/40 hover:bg-black/60 rounded-xl transition-colors backdrop-blur-md cursor-pointer border border-white/20"
                      aria-label="Close menu"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="text-[11px] font-semibold text-gray-200 tracking-wide mt-2 drop-shadow-sm">
                    {language === "sw" ? "Soko la Bidhaa Halisi za Afrika na Kenya" : "Authentic African & Kenyan Marketplace"}
                  </p>
                </AfricanCitiesSlideshow>

                {/* Mobile Search Input inside drawer */}
                <div className="p-4 pb-2">
                  <form onSubmit={handleSearch} className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t("searchPlaceholder")}
                      className="w-full pl-9 pr-14 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-semibold transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-1">
                      {search && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setSuggestedProducts([]);
                            setSuggestedCategories([]);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={toggleVoiceSearch}
                        className={`p-1 rounded-full transition-all cursor-pointer ${
                          isListening ? "text-red-500 bg-red-50 animate-pulse" : "text-gray-400 hover:text-amber-500"
                        }`}
                      >
                        {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Sokoplus Menu Components Stack */}
                <div className="px-4 py-2 space-y-1 divide-y divide-gray-100 dark:divide-gray-850">
                  {[
                    {
                      id: "categories",
                      title: language === "sw" ? "Vitengo" : "Categories",
                      subtitle: language === "sw" ? "Sanaa za mikono, mitindo, vifaa & urembo" : "Handcrafted crafts, fashion, tech & beauty",
                      icon: Grid,
                      path: "/",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate("/");
                      }
                    },
                    ...(settings.sellerStudioEnabled ? [{
                      id: "seller-studio",
                      title: language === "sw" ? "Studio ya Muuzaji" : "Seller Studio",
                      subtitle: language === "sw" ? "Anza kuuza au simamia duka lako" : "Start selling or manage your artisan store",
                      icon: Store,
                      path: "/seller",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate("/seller");
                      }
                    }] : []),
                    {
                      id: "wishlist",
                      title: language === "sw" ? "Wishlist" : "Wishlist",
                      subtitle: language === "sw" ? "Bidhaa zako ulizopenda na kuhifadhi" : "Your curated favorites & saved products",
                      icon: Heart,
                      path: "/wishlist",
                      badge: user?.wishlist?.length ? user.wishlist.length : null,
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate("/wishlist");
                      }
                    },
                    {
                      id: "blog",
                      title: language === "sw" ? "Blogs" : "Blogs",
                      subtitle: language === "sw" ? "Gundua utamaduni na safari za soko" : "Discover culture and market journeys",
                      icon: BookOpen,
                      path: "/blog",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate("/blog");
                      }
                    },
                    {
                      id: "account",
                      title: language === "sw" ? "Akaunti" : "Account",
                      subtitle: user 
                        ? (language === "sw" ? `Umeingia kama ${user.displayName}` : `Logged in as ${user.displayName}`)
                        : (language === "sw" ? "Fuatilia oda, anwani na pointi za zawadi" : "Track purchases, address book & loyalty points"),
                      icon: User,
                      path: "/profile",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate(user ? "/profile" : "/login");
                      }
                    },
                    {
                      id: "support",
                      title: language === "sw" ? "Msaada na Huduma" : "Help & Live Support",
                      subtitle: language === "sw" ? "Msaada wa saa 24/7 na huduma kwa wateja" : "24/7 live chat & customer assistance",
                      icon: HelpCircle,
                      path: "#support",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        window.dispatchEvent(new CustomEvent("open-support-chat"));
                        const supportBtn = document.getElementById("support-chat-trigger") || document.getElementById("unified-support-trigger-btn");
                        if (supportBtn) {
                          supportBtn.click();
                        }
                      }
                    },
                    ...(user?.isAdmin ? [{
                      id: "admin",
                      title: language === "sw" ? "Paneli ya Utawala" : "Admin Control Panel",
                      subtitle: language === "sw" ? "Simamia bidhaa, oda na mipangilio" : "Manage inventory, orders & site settings",
                      icon: Award,
                      path: "/admin",
                      onClick: () => {
                        setIsMobileMenuOpen(false);
                        navigate("/admin");
                      }
                    }] : [])
                  ].map((item) => {
                    const IconComp = item.icon;
                    const isActive = location.pathname === item.path;
                    const isAnimating = animatingDrawerItemId === item.id;

                    return (
                      <div key={item.id} className="pt-2.5 pb-2.5 first:pt-0">
                        <button
                          onClick={() => {
                            setAnimatingDrawerItemId(item.id);
                            setTimeout(() => {
                              item.onClick();
                              setAnimatingDrawerItemId(null);
                            }, 220);
                          }}
                          className="w-full flex items-center space-x-3.5 text-left group cursor-pointer border-none bg-transparent"
                        >
                          <motion.div
                            whileTap={{ scale: 0.85 }}
                            animate={isAnimating ? {
                              scale: [1, 1.32, 0.88, 1.15, 1],
                              rotate: [0, -14, 14, -6, 0]
                            } : {
                              scale: 1,
                              rotate: 0
                            }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              isActive 
                                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950 shadow-sm" 
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-700/80 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 group-hover:text-gray-900 dark:group-hover:text-white"
                            }`}
                          >
                            <IconComp size={19} className="stroke-[2]" />
                          </motion.div>

                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-bold transition-colors ${
                                isActive
                                  ? "text-gray-950 dark:text-white font-extrabold"
                                  : "text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                              }`}>
                                {item.title}
                              </span>
                              {item.badge ? (
                                <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                  {item.badge}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5 line-clamp-1 font-medium">
                              {item.subtitle}
                            </p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Footer Section with "Get Started" Button (No blinking animation) */}
              <div className="p-4 pt-3 border-t border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 space-y-3 mt-auto">
                {/* Currency & Language Row - Image 1 Exact Design */}
                <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-50/80 dark:bg-gray-900/80 p-2 rounded-2xl border border-gray-150 dark:border-gray-800">
                  {/* Currency Pill: KES | USD */}
                  <div className="inline-flex items-center bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("KES");
                        toast.success("Currency: KES");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-black tracking-tight transition-all cursor-pointer border-none ${
                        currency === "KES"
                          ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                          : "bg-transparent text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      KES
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("USD");
                        toast.success("Currency: USD");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-black tracking-tight transition-all cursor-pointer border-none ${
                        currency === "USD"
                          ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                          : "bg-transparent text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      USD
                    </button>
                  </div>

                  {/* Language Selector: Globe + Text + ChevronDown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDrawerLanguageMenu(!showDrawerLanguageMenu)}
                      className="flex items-center gap-1.5 text-sm font-black text-gray-900 dark:text-gray-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer border-none bg-transparent py-1 px-1.5 rounded-lg"
                    >
                      <Globe size={18} className="text-gray-900 dark:text-gray-100 shrink-0" />
                      <span className="text-sm font-extrabold">{language === "sw" ? "Swahili" : "English"}</span>
                      <ChevronDown size={16} className={`text-gray-900 dark:text-gray-100 transition-transform duration-200 ${showDrawerLanguageMenu ? "rotate-180 text-amber-500" : ""}`} />
                    </button>

                    {/* Language Dropdown Menu */}
                    <AnimatePresence>
                      {showDrawerLanguageMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          className="absolute right-0 bottom-full mb-2 w-36 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden z-[160] py-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setLanguage("en");
                              setShowDrawerLanguageMenu(false);
                              toast.success("Language: English");
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-none ${
                              language === "en" ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span>English</span>
                            {language === "en" && <Check size={14} className="text-amber-500" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLanguage("sw");
                              setShowDrawerLanguageMenu(false);
                              toast.success("Lugha: Swahili");
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-none ${
                              language === "sw" ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span>Swahili</span>
                            {language === "sw" && <Check size={14} className="text-amber-500" />}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Logout or User info if logged in */}
                {user && (
                  <div className="flex items-center justify-between p-2.5 bg-gray-100/80 dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {user.displayName ? user.displayName[0] : "U"}
                      </div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{user.displayName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="text-xs text-gray-500 hover:text-red-500 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>{t("logout")}</span>
                    </button>
                  </div>
                )}

                {/* Primary CTA Button: Must say "Get Started" and MUST NOT BLINK */}
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-sm py-3 px-4 rounded-xl text-center shadow-md transition-colors cursor-pointer block border-none"
                  >
                    Get Started
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-sm py-3 px-4 rounded-xl text-center shadow-md transition-colors cursor-pointer block text-decoration-none"
                  >
                    Get Started
                  </Link>
                )}

                {/* Legal / Policy Footer Links */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 dark:text-gray-500 px-1 pt-0.5">
                  <Link 
                    to="/privacy" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {language === "sw" ? "Sera ya Faragha" : "Privacy Policy"}
                  </Link>
                  <span>•</span>
                  <Link 
                    to="/terms" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {language === "sw" ? "Masharti na Vigezo" : "Terms of Service"}
                  </Link>
                </div>
              </div>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200]"
            />
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: isMobile ? 32 : 25 }}
              className={`fixed ${isMobile ? "bottom-0 left-0 right-0 rounded-t-[2.5rem] p-6 pb-8" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-3xl p-8"} bg-white dark:bg-gray-900 z-[210] shadow-2xl space-y-6 text-gray-900 dark:text-gray-100 border-t md:border border-gray-150 dark:border-gray-800`}
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
