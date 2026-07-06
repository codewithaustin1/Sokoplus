import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, query, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile } from "../types";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Star, ShoppingBag, Heart, Filter, X, ChevronDown, WifiOff, Search, Loader2, Check, GitCompare } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useCurrency } from "../lib/CurrencyContext";
import { useLanguage } from "../lib/LanguageContext";
import toast from "react-hot-toast";
import axios from "axios";
import SEO from "../components/SEO";
import EmptyState from "../components/EmptyState";
import MarketingBanner from "../components/MarketingBanner";
import PromotionalBanner from "../components/PromotionalBanner";
import { trackEvent } from "../lib/analytics";
import heroImage from "../assets/images/sokoplus_hero_bg_1782815259030.jpg";
import { FastImage } from "../components/FastImage";
import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { prefetchProductAssets, prefetchImageUrl } from "../utils/imagePrefetcher";
import { productCache } from "../utils/productCache";
import { saveProductsToCache, getCachedProducts, saveHomepageSettings, getHomepageSettings } from "../utils/offlineDb";
import { getCompareList, addToCompare, removeFromCompare } from "../utils/compare";
import { useSellerStudio } from "../lib/SellerStudioContext";

interface HomeProps {
  user: UserProfile | null;
}

export default function Home({ user }: HomeProps) {
  const { sellerStudioEnabled } = useSellerStudio();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string>("");
  const [heroImageUrls, setHeroImageUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return searchParams.get("category") || searchParams.get("collection") || "All";
  });

  const selectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (cat === "All") {
        next.delete("category");
        next.delete("collection");
      } else {
        next.set("category", cat);
        next.delete("collection");
      }
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const urlCategory = searchParams.get("category") || searchParams.get("collection") || "All";
    if (urlCategory !== selectedCategory) {
      setSelectedCategory(urlCategory);
    }
  }, [searchParams]);

  const [isOfflineView, setIsOfflineView] = useState<boolean>(false);
  const [addingMap, setAddingMap] = useState<Record<string, "idle" | "loading" | "added">>({});
  const { addToCart } = useCart();
  const { currency, setCurrency, exchangeRate, formatPrice } = useCurrency();

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high" | "rating">("newest");

  // Recommended for You State
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [recLoading, setRecLoading] = useState<boolean>(true);
  const [hasHistory, setHasHistory] = useState<boolean>(false);

  // Product Comparison Selector State
  const [compareIds, setCompareIds] = useState<string[]>([]);
  useEffect(() => {
    const syncCompare = () => {
      setCompareIds(getCompareList().map((item) => item.id));
    };
    syncCompare();
    window.addEventListener("sokoplus_compare_changed", syncCompare);
    return () => {
      window.removeEventListener("sokoplus_compare_changed", syncCompare);
    };
  }, []);

  const handleToggleCompare = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (compareIds.includes(product.id)) {
      removeFromCompare(product.id);
    } else {
      addToCompare(product);
    }
  };

  const [homeSearch, setHomeSearch] = useState(() => searchParams.get("search") || "");

  useEffect(() => {
    setHomeSearch(searchParams.get("search") || "");
  }, [searchParams]);

  const handleHomeHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (homeSearch.trim()) {
      setSearchParams({ search: homeSearch.trim() });
      setTimeout(() => {
        scrollToProducts();
      }, 100);
    } else {
      setSearchParams({});
    }
  };

  useEffect(() => {
    if (products.length === 0) return;

    let isMounted = true;

    async function generateHomeRecommendations() {
      setRecLoading(true);
      try {
        const wishlistIds = user?.wishlist || [];
        let browsingHistoryIds: string[] = [];
        try {
          const historyJson = localStorage.getItem("sokoplus_browsing_history");
          browsingHistoryIds = historyJson ? JSON.parse(historyJson) : [];
          if (!Array.isArray(browsingHistoryIds)) {
            browsingHistoryIds = [];
          }
        } catch (err) {
          console.error("Failed to parse browsing history from localStorage", err);
        }

        const combinedIds = Array.from(new Set([...wishlistIds, ...browsingHistoryIds]));
        const hasInteractions = combinedIds.length > 0;
        if (isMounted) {
          setHasHistory(hasInteractions);
        }

        const wishlistProducts = products.filter(p => wishlistIds.includes(p.id));
        const historyProducts = products.filter(p => browsingHistoryIds.includes(p.id));

        console.log(`Generating home recommendations. Wishlist items: ${wishlistIds.length}, Browsing items: ${browsingHistoryIds.length}`);

        if (!hasInteractions) {
          // Select default popular products (trending/highly rated)
          const trending = [...products]
            .sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5))
            .slice(0, 4);
          if (isMounted) {
            setRecommendedProducts(trending);
            setRecLoading(false);
          }
          return;
        }

        // Call server-side recommendations endpoint
        try {
          const response = await axios.post("/api/recommendations", {
            history: {
              wishlist: wishlistProducts.map(p => ({ id: p.id, name: p.name, category: p.category })),
              browsingHistory: historyProducts.map(p => ({ id: p.id, name: p.name, category: p.category }))
            },
            products: products.map(p => ({ id: p.id, name: p.name, category: p.category }))
          });

          const recIds = response.data?.recommendationIds || [];
          if (Array.isArray(recIds) && recIds.length > 0) {
            const recs = recIds
              .map(id => products.find(p => p.id === id))
              .filter((p): p is Product => !!p && p.active !== false)
              .slice(0, 4);

            if (recs.length > 0) {
              if (isMounted) {
                setRecommendedProducts(recs);
                setRecLoading(false);
              }
              return;
            }
          }
        } catch (apiErr) {
          console.warn("Home recommendations API error, using smart client-side heuristic fallback:", apiErr);
        }

        // Local Heuristic Fallback
        const preferredCategories = Array.from(
          new Set(
            [...wishlistProducts, ...historyProducts].map(p => p.category).filter((c): c is string => !!c)
          )
        );

        let fallbacks: Product[] = [];
        if (preferredCategories.length > 0) {
          // Find products in preferred categories that are NOT already saved/viewed (to promote discovery)
          fallbacks = products.filter(
            p => 
              preferredCategories.includes(p.category) && 
              !combinedIds.includes(p.id) && 
              p.active !== false
          );

          if (fallbacks.length < 4) {
            const alreadyInteractedInCat = products.filter(
              p => 
                preferredCategories.includes(p.category) && 
                combinedIds.includes(p.id) && 
                p.active !== false
            );
            fallbacks = [...fallbacks, ...alreadyInteractedInCat];
          }
        }

        fallbacks = Array.from(new Set(fallbacks));

        if (fallbacks.length < 4) {
          const generalPopular = [...products]
            .filter(p => !fallbacks.some(f => f.id === p.id) && p.active !== false)
            .sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
          fallbacks = [...fallbacks, ...generalPopular];
        }

        const finalRecs = fallbacks.slice(0, 4);
        if (isMounted) {
          setRecommendedProducts(finalRecs);
          setRecLoading(false);
        }

      } catch (err) {
        console.error("Critical error generating home recommendations:", err);
        if (isMounted) {
          setRecLoading(false);
        }
      }
    }

    generateHomeRecommendations();

    return () => {
      isMounted = false;
    };
  }, [products, user?.wishlist]);

  // Dynamic slider range calculation based on inventory
  const sliderMax = Math.ceil(
    products.length > 0
      ? Math.max(...products.map(p => currency === "USD" ? p.price * exchangeRate : p.price))
      : (currency === "USD" ? 250 : 25000)
  ) || (currency === "USD" ? 250 : 25000);

  const tempMin = minPrice === "" ? 0 : Number(minPrice);
  const tempMax = maxPrice === "" ? sliderMax : Number(maxPrice);

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Please login to save to wishlist");
      return;
    }

    if (!user.emailVerified) {
      toast.error("Please verify your email to update wishlist");
      return;
    }

    const currentWishlist = user.wishlist || [];
    const isWishlisted = currentWishlist.includes(productId);
    const newWishlist = isWishlisted 
      ? currentWishlist.filter(id => id !== productId)
      : [...currentWishlist, productId];

    // Optimistic state update via custom event prior to database transaction
    window.dispatchEvent(new CustomEvent("optimistic-user-update", { detail: { wishlist: newWishlist } }));
    toast.success(isWishlisted ? "Removed from wishlist" : "Added to wishlist");

    try {
      const userRef = doc(db, "users", user.uid);
      if (isWishlisted) {
        await updateDoc(userRef, {
          wishlist: arrayRemove(productId)
        });
      } else {
        await updateDoc(userRef, {
          wishlist: arrayUnion(productId)
        });
      }
    } catch (error) {
      console.error("Wishlist error:", error);
      // Roll back to original list in database if the transaction fails
      window.dispatchEvent(new CustomEvent("optimistic-user-update", { detail: { wishlist: currentWishlist } }));
      toast.error("Failed to update wishlist");
    }
  };

  const { data: heroSettings } = useQuery({
    queryKey: ["homepage-hero-settings"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cachedSettings = await getHomepageSettings("hero");
        return cachedSettings || null;
      }
      try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          const newImg = settingsData.heroImageUrl || "";
          const newImgs = settingsData.heroImageUrls || [];
          
          await saveHomepageSettings("hero", {
            heroImageUrl: newImg,
            heroImageUrls: newImgs
          });

          return { heroImageUrl: newImg, heroImageUrls: newImgs };
        }
      } catch (err) {
        console.warn("Could not retrieve homepage settings:", err);
      }
      const cachedSettings = await getHomepageSettings("hero");
      return cachedSettings || null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: queriedProductsList, isLoading: isQueryLoading, refetch: refetchProductsQuery } = useQuery<Product[]>({
    queryKey: ["products-list"],
    queryFn: async () => {
      // Offline Flow Check
      if (!navigator.onLine) {
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          setIsOfflineView(true);
          cached.forEach(p => productCache.set(p.id, p));
          return cached;
        }
        throw new Error("Offline and no cache");
      }

      // Online Flow Path
      try {
        const q = query(collection(db, "products"), limit(20));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.active !== false && (!p.approvalStatus || p.approvalStatus === "approved"));
        
        setIsOfflineView(false);
        fetched.forEach(p => productCache.set(p.id, p));

        // Save downloaded listings in background IndexedDB
        saveProductsToCache(fetched).catch((err) =>
          console.error("IndexedDB storage cache failure:", err)
        );

        return fetched;
      } catch (error) {
        // Dispatch global quota exception if detected
        const errStr = error instanceof Error ? error.message : String(error);
        const isQuota = errStr.toLowerCase().includes("quota");
        
        if (isQuota) {
          console.warn("Fetch products quota limit warning, attempting local cache fallback:", errStr);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("firestore-quota-exceeded", {
                detail: { error: errStr, path: "products" }
              })
            );
          }
        } else {
          console.error("Fetch products error, attempting local cache fallback:", error);
        }

        let cached = await getCachedProducts();
        if (!cached || cached.length === 0) {
          // Build excellent default storefront catalog item fallback
          cached = [
            {
              id: "maasai-beaded-necklace",
              name: "Maasai Beaded Necklace",
              price: 2500,
              category: "Local Crafts",
              description: "Authentic handmade Maasai jewelry from Narok.",
              stock: 50,
              images: ["https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000"],
              artisan: "Mama Stacey of Narok Maasai Crafts",
              rating: 4.8,
              reviewCount: 15,
              createdAt: new Date().toISOString()
            },
            {
              id: "sokoplus-tech-bag",
              name: "Sokoplus Tech Bag",
              price: 4500,
              category: "Fashion",
              description: "Waterproof laptop bag for the Nairobi commuter.",
              stock: 30,
              images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000"],
              artisan: "Kariobangi Leather Artisans",
              rating: 4.7,
              reviewCount: 22,
              createdAt: new Date().toISOString()
            },
            {
              id: "mount-kenya-coffee",
              name: "Coffee - Mount Kenya Special",
              price: 1200,
              category: "Groceries",
              description: "Premium medium roast coffee beans from Central Kenya.",
              stock: 100,
              images: ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2000"],
              artisan: "Nyeri Smallholder Coffee Coop",
              rating: 4.9,
              reviewCount: 37,
              createdAt: new Date().toISOString()
            },
            {
              id: "bamboo-speaker",
              name: "Bamboo Speaker",
              price: 3200,
              category: "Electronics",
              description: "Eco-friendly bamboo bluetooth speaker, handcrafted.",
              stock: 15,
              images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000"],
              artisan: "Mombasa Sustainable Woodworks",
              rating: 4.6,
              reviewCount: 8,
              createdAt: new Date().toISOString()
            }
          ] as any[];
        }

        if (cached && cached.length > 0) {
          setIsOfflineView(true);
          cached.forEach(p => productCache.set(p.id, p));
          toast.success("Loaded products offline in secure fallback mode", { icon: "📦" });
          return cached;
        }

        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (queriedProductsList) {
      setProducts(queriedProductsList);
      setFilteredProducts(queriedProductsList);
    }
  }, [queriedProductsList]);

  useEffect(() => {
    if (heroSettings) {
      if (heroSettings.heroImageUrl) setHeroImageUrl(heroSettings.heroImageUrl);
      if (heroSettings.heroImageUrls) setHeroImageUrls(heroSettings.heroImageUrls);
    }
  }, [heroSettings]);

  const slides = useMemo(() => {
    if (heroImageUrls && heroImageUrls.length > 0) {
      return heroImageUrls;
    }
    if (heroImageUrl) {
      return [heroImageUrl];
    }
    return [heroImage];
  }, [heroImageUrls, heroImageUrl]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides]);

  // Prefetch large carousel images to guarantee zero-latency transitions
  useEffect(() => {
    if (slides && slides.length > 0) {
      slides.forEach((url) => {
        prefetchImageUrl(url);
      });
    }
  }, [slides]);

  useEffect(() => {
    setLoading(isQueryLoading);
  }, [isQueryLoading]);

  useEffect(() => {
    const handleSync = () => {
      refetchProductsQuery();
    };

    window.addEventListener("network-sync", handleSync);
    return () => {
      window.removeEventListener("network-sync", handleSync);
    };
  }, [refetchProductsQuery]);

  useEffect(() => {
    const searchTerm = searchParams.get("search")?.toLowerCase();
    
    let result = [...products];

    // Category Filter
    if (selectedCategory !== "All") {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search Filter
    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.description.toLowerCase().includes(searchTerm)
      );
    }

    // Advanced Filters
    if (minPrice !== "") {
      const minKes = currency === "USD" ? Number(minPrice) / exchangeRate : Number(minPrice);
      result = result.filter(p => p.price >= minKes);
    }
    if (maxPrice !== "") {
      const maxKes = currency === "USD" ? Number(maxPrice) / exchangeRate : Number(maxPrice);
      result = result.filter(p => p.price <= maxKes);
    }
    if (minRating > 0) {
      result = result.filter(p => (p.rating || 0) >= minRating);
    }
    if (onlyInStock) {
      result = result.filter(p => p.stock > 0);
    }

    // Sorting
    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredProducts(result);
  }, [selectedCategory, products, searchParams, minPrice, maxPrice, minRating, onlyInStock, sortBy, currency, exchangeRate]);

  const [showMission, setShowMission] = useState(false);

  const homeSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": "Sokoplus",
    "description": "Shop the best authentic Kenyan products. From local artisans to global quality standards, Sokoplus is your home for Kenyan excellence.",
    "url": window.location.origin,
    "logo": `${window.location.origin}/logo.jpg`,
    "telephone": "+254700000000",
    "priceRange": "KES",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Nairobi CBD",
      "addressLocality": "Nairobi",
      "addressRegion": "Nairobi County",
      "postalCode": "00100",
      "addressCountry": "KE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -1.2921,
      "longitude": 36.8219
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    }
  };

  const scrollToProducts = () => {
    document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-12 pb-20">
      <SEO 
        title="Premium Kenyan Marketplace" 
        description="Shop the best authentic Kenyan products. From local artisans to global quality standards, Sokoplus is your home for Kenyan excellence."
        schema={homeSchema}
      />
      <MarketingBanner />
      {/* Hero Section */}
      <section className="relative min-h-[480px] sm:min-h-[520px] md:min-h-[580px] py-12 sm:py-16 md:py-24 px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-gray-900/50 overflow-hidden flex items-center transition-colors duration-200">
        {/* Full-width Responsive Background Carousel */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.img
              key={currentSlide}
              src={slides[currentSlide]}
              alt="SokoPlus - Premium Kenyan Marketplace"
              variants={{
                enter: { x: "100%", opacity: 0 },
                center: { x: 0, opacity: 1 },
                exit: { x: "-100%", opacity: 0 }
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center] md:object-right"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          {/* Immersive Cinematic Scrim - dual dark gradients on mobile to guarantee extreme contrast & rich depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25 md:hidden pointer-events-none z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent md:hidden pointer-events-none z-10" />
          {/* Desktop-specific standard premium blending overlays */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-amber-500/15 via-transparent to-transparent pointer-events-none z-10" />
          <div className="hidden md:block absolute inset-0 bg-black/15 dark:bg-black/40 pointer-events-none z-10" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-start">
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full md:max-w-xl space-y-4 sm:space-y-6 bg-transparent md:bg-white/75 md:dark:bg-gray-950/75 md:backdrop-blur-md p-0 md:p-10 rounded-none md:rounded-3xl border-none md:border md:border-white/40 md:dark:border-gray-800/40 shadow-none md:shadow-2xl"
            >
              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white md:text-gray-900 md:dark:text-white leading-tight">
                  {language === "sw" ? "Bidhaa Bora." : "Better Products."} <br/>
                  <span className="text-orange-400 md:text-orange-600 underline decoration-orange-300 md:decoration-orange-200 dark:decoration-orange-800">
                    {language === "sw" ? "Bei Bora zaidi." : "Better Prices."}
                  </span>
                </h1>
              </div>

              <p className="text-sm sm:text-base md:text-lg text-gray-200 md:text-gray-700 md:dark:text-gray-350 font-semibold leading-relaxed">
                {t("heroSubtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 pt-1 sm:pt-2">
                <button 
                  onClick={scrollToProducts}
                  className="group bg-orange-600 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold hover:bg-orange-700 transition-all flex items-center justify-center font-sans cursor-pointer shadow-lg shadow-orange-600/30 hover:shadow-orange-600/40 transform hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base"
                >
                  {t("shopCollect")}{" "}
                  <ArrowRight className="ml-2 transform group-hover:translate-x-1 transition-transform duration-200" size={18} />
                </button>
                <button 
                  onClick={() => setShowMission(true)}
                  className="bg-white/10 backdrop-blur-sm md:bg-white md:dark:bg-gray-900 text-white md:text-gray-900 md:dark:text-white border border-white/30 md:border-gray-200 md:dark:border-gray-800 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold hover:bg-white/20 md:hover:bg-gray-50 md:dark:hover:bg-gray-800 transition-all font-sans cursor-pointer flex items-center justify-center shadow-md transform hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base"
                >
                  {t("learnStory")}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Carousel Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-12 sm:bottom-6 z-20 flex space-x-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 border-none outline-none cursor-pointer ${
                  currentSlide === idx 
                    ? "bg-orange-600 w-7" 
                    : "bg-white/55 hover:bg-white"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Product categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-white">
          {language === "sw" ? "Vitengo Maarufu Sokoni" : "Popular Categories"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {["All", "Fashion", "Electronics", "Local Crafts", "Groceries"].map((cat) => (
            <div 
              key={cat} 
              onClick={() => {
                selectCategory(cat);
                scrollToProducts();
              }}
              className={`h-24 md:h-32 border rounded-2xl flex items-center justify-center shadow-sm transition-all cursor-pointer group ${
                selectedCategory === cat 
                  ? "bg-orange-600 border-orange-600 text-white font-bold" 
                  : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:shadow-md"
              }`}
            >
               <span className={`text-sm md:text-lg font-semibold transition-colors uppercase tracking-tight ${
                 selectedCategory === cat 
                   ? "text-white" 
                   : "text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400"
               }`}>
                 {cat === "All" ? t("allCategories") : cat === "Local Crafts" ? (language === "sw" ? "Sanaa na Kazi za Mikono" : "Local Crafts") : cat === "Fashion" ? (language === "sw" ? "Mitindo na Mavazi" : "Fashion") : cat === "Electronics" ? (language === "sw" ? "Vifaa vya Kidijitali" : "Electronics") : cat === "Groceries" ? (language === "sw" ? "Bidhaa Safi na Vyakula" : "Groceries") : cat}
               </span>
            </div>
          ))}
        </div>
      </section>

      <PromotionalBanner />

      {/* Recommended for You Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-b border-gray-100 dark:border-gray-800 bg-orange-50/10 dark:bg-gray-900/10 rounded-3xl mt-12 mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              {t("Recommended for You")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium text-sm">
              {hasHistory 
                ? t("based on your interest") 
                : t("browse products or save to wishlist for personalized recommendations.")}
            </p>
          </div>
        </div>

        {recLoading ? (
          <ProductCardSkeleton />
        ) : recommendedProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Heart size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">{t("No recommendations found")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {recommendedProducts.map((p) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={`rec-${p.id}`} 
                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-4 shadow-sm transition-all premium-card-spotlight"
              >
                <Link 
                  to={`/product/${p.id}`} 
                  state={{ product: p }}
                  onMouseEnter={() => prefetchProductAssets(p)}
                  onTouchStart={() => prefetchProductAssets(p)}
                  className="block aspect-square bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden mb-4 relative group"
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-all text-orange-600 dark:text-orange-500"></div>
                  <FastImage 
                    src={p.images?.filter(img => !!img && img.trim() !== "")[0] || ""} 
                    alt={p.name} 
                    fallbackIconSize={48}
                  />
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-transparent dark:border-gray-800">
                      {p.category}
                    </div>
                    {p.originalPrice && p.originalPrice > p.price && (
                      <div className="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-sm border border-red-700 animate-pulse-subtle">
                        -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                      </div>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 12 }}
                    onClick={(e) => toggleWishlist(p.id, e)}
                    className={`absolute top-2 left-2 p-2 rounded-full shadow-sm z-10 transition-colors ${
                      user?.wishlist?.includes(p.id) 
                        ? "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40" 
                        : "bg-white/80 dark:bg-gray-900/80 text-gray-400 dark:text-gray-300 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800"
                    }`}
                  >
                    <Heart size={16} fill={user?.wishlist?.includes(p.id) ? "currentColor" : "none"} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 12 }}
                    onClick={(e) => handleToggleCompare(p, e)}
                    className={`absolute top-2 left-12 p-2 rounded-full shadow-sm z-10 transition-colors ${
                      compareIds.includes(p.id) 
                        ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-450 hover:bg-orange-100 dark:hover:bg-orange-900/40" 
                        : "bg-white/80 dark:bg-gray-900/80 text-gray-400 dark:text-gray-300 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-800"
                    }`}
                    title="Compare Product Specifications"
                  >
                    <GitCompare size={16} />
                  </motion.button>
                </Link>
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center text-yellow-400">
                       <Star size={14} fill="currentColor" />
                       <span className="text-gray-500 dark:text-gray-400 text-xs ml-1 font-medium">{p.rating || 4.5}</span>
                    </div>
                    <div>
                      {p.stock === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                          {t("Out of Stock")}
                        </span>
                      ) : p.stock <= 5 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                          {t("Low Stock")} ({p.stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                          {t("In Stock")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link to={`/product/${p.id}`} state={{ product: p }} className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-500 transition-colors line-clamp-1">
                    {p.name}
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-gray-900 dark:text-white leading-none">{formatPrice(p.price)}</span>
                      {p.originalPrice && p.originalPrice > p.price && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 line-through mt-1 font-medium select-none">
                          {formatPrice(p.originalPrice)}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const status = addingMap[p.id] || "idle";
                      return (
                        <motion.button 
                          whileHover={p.stock === 0 || status === "loading" ? {} : { scale: 1.15, rotate: -3 }}
                          whileTap={p.stock === 0 || status === "loading" ? {} : { scale: 0.85, rotate: 3 }}
                          transition={{ type: "spring", stiffness: 500, damping: 12 }}
                          disabled={p.stock === 0 || status === "loading" || status === "added"}
                          onClick={() => {
                            if (p.stock === 0) {
                              toast.error("This product is out of stock!");
                              return;
                            }
                            setAddingMap(prev => ({ ...prev, [p.id]: "loading" }));
                            addToCart({ productId: p.id, name: p.name, price: p.price, quantity: 1, image: p.images?.filter(img => !!img && img.trim() !== "")[0] || "" });
                            trackEvent("add_to_cart", {
                              items: [{
                                item_id: p.id,
                                item_name: p.name,
                                price: p.price,
                                quantity: 1,
                                item_category: p.category
                              }]
                            });
                            
                            setTimeout(() => {
                              setAddingMap(prev => ({ ...prev, [p.id]: "added" }));
                              toast.success(`${p.name} added to cart!`);
                              setTimeout(() => {
                                setAddingMap(prev => {
                                  const updated = { ...prev };
                                  delete updated[p.id];
                                  return updated;
                                });
                              }, 1500);
                            }, 850);
                          }}
                          className={`p-2.5 rounded-xl transition-all relative overflow-hidden flex items-center justify-center select-none ${
                            p.stock === 0 
                              ? "bg-gray-100 dark:bg-gray-805 text-gray-400 dark:text-gray-500 cursor-not-allowed" 
                              : status === "added"
                              ? "bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/10"
                              : "bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-600/10 dark:shadow-none"
                          }`}
                          style={{ minWidth: "2.5rem", minHeight: "2.5rem" }}
                        >
                          <AnimatePresence mode="wait">
                            {status === "idle" && (
                              <motion.div
                                key="idle"
                                initial={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center justify-center"
                              >
                                <ShoppingBag size={18} />
                              </motion.div>
                            )}
                            {status === "loading" && (
                              <motion.div
                                key="loading"
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center justify-center"
                              >
                                <Loader2 className="animate-spin" size={18} />
                              </motion.div>
                            )}
                            {status === "added" && (
                              <motion.div
                                key="added"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: [1, 1.25, 1] }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ 
                                  scale: { duration: 0.3, ease: "easeInOut" },
                                  opacity: { type: "spring", stiffness: 400, damping: 10 }
                                }}
                                className="flex items-center justify-center"
                              >
                                <Check size={18} className="stroke-[3]" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Product Grid */}
      <section id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
             <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
               {selectedCategory === "All" 
                 ? (language === "sw" ? "Mkusanyiko Mpya wa Bidhaa" : "Latest Arrivals") 
                 : (selectedCategory === "Local Crafts" ? (language === "sw" ? "Sanaa Maalum za Mikono" : "Local Crafts Collection") : selectedCategory === "Fashion" ? (language === "sw" ? "Mavazi na Mitindo ya Kisasa" : "Fashion Collection") : selectedCategory === "Electronics" ? (language === "sw" ? "Vifaa vya Kidijitali na Kielektroniki" : "Electronics Collection") : selectedCategory === "Groceries" ? (language === "sw" ? "Vyakula Fresh na Mahitaji ya Jikoni" : "Groceries Collection") : `${selectedCategory} Collection`)}
             </h2>
             <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
               {language === "sw" ? "Sanaa safi na bidhaa teule zilizosafirishwa moja kwa moja kutoka kaunti zote 47 za Kenya yetu." : "Handpicked premium goods from across the 47 counties."}
             </p>
          </div>
          <button onClick={() => {
            setMinPrice("");
            setMaxPrice("");
            setMinRating(0);
            setOnlyInStock(false);
            setSearchParams(params => {
              const next = new URLSearchParams(params);
              next.delete("search");
              next.delete("category");
              next.delete("collection");
              return next;
            }, { replace: true });
            setSelectedCategory("All");
          }} className="text-orange-600 dark:text-orange-500 font-bold flex items-center hover:underline group">
            Reset All <X size={16} className="ml-1 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {searchParams.get("search") && (
          <div className="bg-orange-50 border border-orange-100 rounded-[2rem] p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-inner">
            <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-3 gap-2">
              <span className="text-sm font-black text-gray-500 uppercase tracking-wider">Search Results For</span>
              <span className="bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md shadow-orange-600/10">
                "{searchParams.get("search")}"
              </span>
            </div>
            <button
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("search");
                  return next;
                });
              }}
              className="flex items-center space-x-2 bg-white text-gray-900 px-5 py-3 rounded-2xl font-bold border border-gray-100 hover:border-red-500 hover:text-red-500 transition-all shadow-sm"
            >
              <X size={16} />
              <span className="text-xs uppercase tracking-wider">Clear Search</span>
            </button>
          </div>
        )}

        {/* Filtering & Sorting Bar */}
        <div className="flex flex-col space-y-6 mb-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-5 sm:px-8 py-3.5 sm:py-4 rounded-2xl border transition-all font-bold shadow-sm text-sm sm:text-base ${
                  showFilters 
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-950 border-gray-900 dark:border-white shadow-xl" 
                    : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-100 dark:border-gray-800 hover:border-orange-600 dark:hover:border-orange-500"
                }`}
              >
                <Filter size={18} />
                <span>Filters</span>
                {(minPrice !== "" || maxPrice !== "" || minRating > 0 || onlyInStock) && (
                   <span className="w-5 h-5 bg-orange-600 dark:bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center animate-pulse">
                     !
                   </span>
                )}
              </button>
              
              <div className="relative group flex-grow sm:flex-grow-0">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full sm:w-auto appearance-none bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-5 sm:px-8 py-3.5 sm:py-4 pr-10 sm:pr-12 rounded-2xl font-bold cursor-pointer hover:border-orange-600 dark:hover:border-orange-500 text-gray-900 dark:text-gray-100 transition-all outline-none shadow-sm text-sm sm:text-base"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" size={18} />
              </div>

              {/* Currency Switching Pill */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-800 items-center space-x-1 shadow-sm h-[50px] sm:h-[58px]">
                <button
                  type="button"
                  onClick={() => setCurrency("KES")}
                  className={`px-4 sm:px-5 h-[40px] sm:h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    currency === "KES"
                      ? "bg-white dark:bg-gray-950 text-orange-600 dark:text-orange-500 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  KES
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`px-4 sm:px-5 h-[40px] sm:h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    currency === "USD"
                      ? "bg-white dark:bg-gray-950 text-orange-600 dark:text-orange-500 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  USD
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOfflineView && (
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 shadow-sm animate-fade-in shrink-0">
                  <WifiOff size={14} className="animate-pulse shrink-0" />
                  Offline Cache View
                </span>
              )}
              <p className="text-gray-500 dark:text-gray-400 font-bold bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-full border border-gray-100 dark:border-gray-800 text-sm sm:text-base whitespace-nowrap">
                Found <span className="text-orange-600 dark:text-orange-500">{filteredProducts.length}</span> authentic products
              </p>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-8 md:p-10 grid grid-cols-1 md:grid-cols-4 gap-10 shadow-xl shadow-gray-100/50 dark:shadow-none">
                  {/* Price Range */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 block">Price Range ({currency})</label>
                      <span className="text-xs font-black text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg">
                        {currency === "USD" ? "$" : "KES "}
                        {Math.round(tempMin).toLocaleString()} - {currency === "USD" ? "$" : "KES "}
                        {Math.round(tempMax).toLocaleString()}
                      </span>
                    </div>

                    <div className="relative h-6 flex items-center select-none pt-2">
                      {/* Underlay Track */}
                      <div className="absolute left-0 right-0 h-2 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                      
                      {/* Active highlighted range strip */}
                      <div 
                        className="absolute h-2 bg-orange-600 dark:bg-orange-500 rounded-full"
                        style={{
                          left: `${sliderMax > 0 ? (tempMin / sliderMax) * 100 : 0}%`,
                          right: `${sliderMax > 0 ? 100 - (tempMax / sliderMax) * 100 : 0}%`
                        }}
                      ></div>

                      {/* Absolute Range sliders overlaid */}
                      <input 
                        type="range"
                        min={0}
                        max={sliderMax}
                        value={tempMin}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), tempMax - (sliderMax * 0.05));
                          setMinPrice(val);
                        }}
                        className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none focus:outline-none [-webkit-appearance:none] h-2 cursor-pointer"
                        style={{
                          zIndex: tempMin > sliderMax / 2 ? 15 : 14
                        }}
                      />
                      <input 
                        type="range"
                        min={0}
                        max={sliderMax}
                        value={tempMax}
                        onChange={(e) => {
                          const val = Math.max(Number(e.target.value), tempMin + (sliderMax * 0.05));
                          setMaxPrice(val);
                        }}
                        className="absolute left-0 right-0 w-full appearance-none bg-transparent pointer-events-none focus:outline-none [-webkit-appearance:none] h-2 cursor-pointer"
                        style={{
                          zIndex: tempMin > sliderMax / 2 ? 14 : 15
                        }}
                      />
                    </div>
                    
                    <style>{`
                      input[type="range"]::-webkit-slider-thumb {
                        pointer-events: auto;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #ea580c;
                        border: 2px solid #ffffff;
                        cursor: pointer;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        -webkit-appearance: none;
                        transition: transform 0.1s ease;
                        margin-top: 0px;
                      }
                      input[type="range"]::-webkit-slider-thumb:hover {
                        transform: scale(1.18);
                      }
                      input[type="range"]::-webkit-slider-thumb:active {
                        transform: scale(1.24);
                      }
                      input[type="range"]::-moz-range-thumb {
                        pointer-events: auto;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #ea580c;
                        border: 2px solid #ffffff;
                        cursor: pointer;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        transition: transform 0.1s ease;
                      }
                      input[type="range"]::-moz-range-thumb:hover {
                        transform: scale(1.18);
                      }
                      input[type="range"]::-moz-range-thumb:active {
                        transform: scale(1.24);
                      }
                    `}</style>
                  </div>

                  {/* Rating */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 block">Minimum Rating</label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setMinRating(minRating === star ? 0 : star)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                            minRating >= star 
                              ? "bg-orange-600 text-white shadow-lg shadow-orange-200 dark:shadow-none" 
                              : "bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-650 hover:text-orange-400 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <Star size={18} fill={minRating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 block">Availability</label>
                    <button 
                      onClick={() => setOnlyInStock(!onlyInStock)}
                      className={`flex items-center space-x-4 w-full px-5 py-4 rounded-xl border transition-all group ${
                        onlyInStock 
                          ? "bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/40 text-orange-700 dark:text-orange-400 shadow-inner" 
                          : "bg-gray-50 dark:bg-gray-800 border-transparent dark:border-transparent text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                       <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                         onlyInStock 
                           ? "bg-orange-600 border-orange-600 text-white" 
                           : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 group-hover:border-orange-300 dark:group-hover:border-orange-500"
                       }`}>
                         {onlyInStock && <ArrowRight size={14} className="rotate-0 animate-in fade-in zoom-in" />}
                       </div>
                       <span className="text-sm font-black uppercase tracking-tight">In Stock Only</span>
                    </button>
                  </div>

                  {/* Clear All */}
                  <div className="flex flex-col justify-end">
                    <button 
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        setMinRating(0);
                        setOnlyInStock(false);
                        selectCategory("All");
                      }}
                      className="flex items-center justify-center space-x-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white px-6 py-4 rounded-xl font-black transition-all shadow-sm"
                    >
                      <X size={18} />
                      <span className="text-xs uppercase tracking-widest">Reset Filters</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {loading ? (
          <ProductCardSkeleton />
        ) : filteredProducts.length === 0 ? (
          <EmptyState 
            icon={ShoppingBag}
            title="No products found"
            description={`We couldn't find any products in "${selectedCategory}" matching your criteria. Try adjusting your search or category.`}
            actionLabel="Clear Filters"
            onAction={() => {
              setMinPrice("");
              setMaxPrice("");
              setMinRating(0);
              setOnlyInStock(false);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("search");
                next.delete("category");
                next.delete("collection");
                return next;
              }, { replace: true });
              setSelectedCategory("All");
            }}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {filteredProducts.map((p) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={p.id} 
                className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-4 shadow-sm transition-all premium-card-spotlight"
              >
                <Link 
                  to={`/product/${p.id}`} 
                  state={{ product: p }}
                  onMouseEnter={() => prefetchProductAssets(p)}
                  onTouchStart={() => prefetchProductAssets(p)}
                  className="block aspect-square bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden mb-4 relative group"
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-all text-orange-600 dark:text-orange-500"></div>
                  <FastImage 
                    src={p.images?.filter(img => !!img && img.trim() !== "")[0] || ""} 
                    alt={p.name} 
                    fallbackIconSize={48}
                  />
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-transparent dark:border-gray-800">
                      {p.category}
                    </div>
                    {p.originalPrice && p.originalPrice > p.price && (
                      <div className="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-sm border border-red-700 animate-pulse-subtle">
                        -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 105)}%
                      </div>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 12 }}
                    onClick={(e) => toggleWishlist(p.id, e)}
                    className={`absolute top-2 left-2 p-2 rounded-full shadow-sm z-10 transition-colors ${
                      user?.wishlist?.includes(p.id) 
                        ? "bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40" 
                        : "bg-white/80 dark:bg-gray-900/80 text-gray-400 dark:text-gray-300 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800"
                    }`}
                  >
                    <Heart size={16} fill={user?.wishlist?.includes(p.id) ? "currentColor" : "none"} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 12 }}
                    onClick={(e) => handleToggleCompare(p, e)}
                    className={`absolute top-2 left-12 p-2 rounded-full shadow-sm z-10 transition-colors ${
                      compareIds.includes(p.id) 
                        ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-450 hover:bg-orange-100 dark:hover:bg-orange-900/40" 
                        : "bg-white/80 dark:bg-gray-900/80 text-gray-400 dark:text-gray-300 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-800"
                    }`}
                    title="Compare Product Specifications"
                  >
                    <GitCompare size={16} />
                  </motion.button>
                </Link>
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center text-yellow-400">
                       <Star size={14} fill="currentColor" />
                       <span className="text-gray-500 dark:text-gray-400 text-xs ml-1 font-medium">{p.rating || 4.5}</span>
                    </div>
                    <div>
                      {p.stock === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                          Out of Stock
                        </span>
                      ) : p.stock <= 5 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                          Low Stock ({p.stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>
                  <Link to={`/product/${p.id}`} state={{ product: p }} className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-500 transition-colors line-clamp-1">
                    {p.name}
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col">
                      <span className="text-xl font-black text-gray-900 dark:text-white leading-none">{formatPrice(p.price)}</span>
                      {p.originalPrice && p.originalPrice > p.price && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 line-through mt-1 font-medium select-none">
                          {formatPrice(p.originalPrice)}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const status = addingMap[p.id] || "idle";
                      return (
                        <motion.button 
                          whileHover={p.stock === 0 || status === "loading" ? {} : { scale: 1.15, rotate: -3 }}
                          whileTap={p.stock === 0 || status === "loading" ? {} : { scale: 0.85, rotate: 3 }}
                          transition={{ type: "spring", stiffness: 500, damping: 12 }}
                          disabled={p.stock === 0 || status === "loading" || status === "added"}
                          onClick={() => {
                            if (p.stock === 0) {
                              toast.error("This product is out of stock!");
                              return;
                            }
                            setAddingMap(prev => ({ ...prev, [p.id]: "loading" }));
                            addToCart({ productId: p.id, name: p.name, price: p.price, quantity: 1, image: p.images?.filter(img => !!img && img.trim() !== "")[0] || "" });
                            trackEvent("add_to_cart", {
                              items: [{
                                item_id: p.id,
                                item_name: p.name,
                                price: p.price,
                                quantity: 1,
                                item_category: p.category
                              }]
                            });
                            
                            setTimeout(() => {
                              setAddingMap(prev => ({ ...prev, [p.id]: "added" }));
                              toast.success("Added to cart!");
                              setTimeout(() => {
                                setAddingMap(prev => {
                                  const updated = { ...prev };
                                  delete updated[p.id];
                                  return updated;
                                });
                              }, 1500);
                            }, 850);
                          }}
                          className={`p-2 rounded-lg transition-colors relative overflow-hidden flex items-center justify-center select-none ${
                            p.stock === 0 
                              ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed" 
                              : status === "added"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-gray-900 dark:bg-gray-800 text-white hover:bg-orange-600 cursor-pointer"
                          }`}
                          style={{ minWidth: "2.5rem", minHeight: "2.5rem" }}
                        >
                          <AnimatePresence mode="wait">
                            {status === "idle" && (
                              <motion.div
                                key="idle"
                                initial={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center justify-center"
                              >
                                <ShoppingBag size={18} />
                              </motion.div>
                            )}
                            {status === "loading" && (
                              <motion.div
                                key="loading"
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center justify-center"
                              >
                                <Loader2 className="animate-spin" size={18} />
                              </motion.div>
                            )}
                            {status === "added" && (
                              <motion.div
                                key="added"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: [1, 1.25, 1] }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ 
                                  scale: { duration: 0.3, ease: "easeInOut" },
                                  opacity: { type: "spring", stiffness: 400, damping: 10 }
                                }}
                                className="flex items-center justify-center"
                              >
                                <Check size={18} className="stroke-[3]" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Trust Banner */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><Star size={32} /></div>
              <h3 className="text-xl font-bold">Trusted in Kenya</h3>
              <p className="text-gray-400 text-sm">Join thousands of happy customers shopping securely with Sokoplus.</p>
           </div>
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><ShoppingBag size={32} /></div>
              <h3 className="text-xl font-bold">Efficient Logistics</h3>
              <p className="text-gray-400 text-sm">Next day delivery in Nairobi and Kiambu. Efficient across 47 counties.</p>
           </div>
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><Star size={32} /></div>
              <h3 className="text-xl font-bold">Safe Payments</h3>
              <p className="text-gray-400 text-sm">Integrated with Paystack & M-Pesa for seamless, secure transactions.</p>
           </div>
        </div>
      </section>      {/* Mission Modal */}
      {showMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 max-w-2xl w-full rounded-3xl overflow-y-auto max-h-[90vh] md:max-h-[95vh] shadow-2xl relative border border-gray-100 dark:border-gray-800"
          >
            <button 
              onClick={() => setShowMission(false)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all z-20 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer"
              title="Close"
            >
              <X size={18} className="text-gray-700 dark:text-gray-300" />
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-6 sm:p-10 space-y-5 sm:space-y-6">
                <div>
                  <div className="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit mb-4">Our Commitment</div>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">Shop With <span className="text-orange-600">Confidence.</span></h2>
                </div>
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">
                    Finding quality online shouldn't feel like a gamble.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {sellerStudioEnabled ? (
                      "Sokoplus brings together trusted sellers, secure payments, and carefully selected products so you can spend less time worrying and more time enjoying what you buy."
                    ) : (
                      "Sokoplus brings together secure payments, certified quality, and carefully selected products so you can spend less time worrying and more time enjoying what you buy."
                    )}
                  </p>
                </div>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-950/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-850">
                  <div className="flex items-center space-x-3 text-gray-800 dark:text-gray-200">
                    <div className="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-450 p-1 rounded-md shrink-0">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm">
                      {sellerStudioEnabled ? "Verified Sellers" : "Verified Products"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-800 dark:text-gray-200">
                    <div className="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-450 p-1 rounded-md shrink-0">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm">Secure M-pesa Payments</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-800 dark:text-gray-200">
                    <div className="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-450 p-1 rounded-md shrink-0">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm">Nationwide Delivery</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMission(false)}
                  className="w-full bg-gray-900 dark:bg-gray-800 text-white font-bold py-3.5 rounded-2xl hover:bg-orange-600 dark:hover:bg-orange-600 text-xs sm:text-sm transition-all shadow-lg cursor-pointer"
                >
                  Browse What's New
                </button>
              </div>
              <div className="bg-orange-600 p-6 sm:p-10 flex flex-col justify-center text-white space-y-5 sm:space-y-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                 <div className="relative z-10 space-y-2">
                   <h3 className="text-3xl sm:text-4xl font-black italic opacity-20 uppercase tracking-tighter">Sokoplus</h3>
                   <p className="text-lg sm:text-xl font-bold">"Built for shoppers who value quality and value equally."</p>
                 </div>
                 <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
                    <p className="text-xs sm:text-sm font-medium leading-relaxed">
                       Founded in Nairobi, our goal is to ensure that Kenyan soul reaches global standards of service.
                    </p>
                 </div>
                 <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                    <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
