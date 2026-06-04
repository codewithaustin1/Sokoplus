import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "sw";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar & Search
    searchPlaceholder: "Search products in Kenya...",
    home: "Home",
    blog: "Blog",
    admin: "Admin",
    cart: "Cart",
    profile: "Profile",
    login: "Login",
    logout: "Logout",
    wishlist: "Wishlist",
    navSlogan: "Authentic Kenyan Handcrafts",

    // Hero Section / Homepage
    heroBadge: "SokoPlus Kenya • 100% Authentic Handcrafts",
    heroTitle: "Quality Goods, Kenyan Soul.",
    heroSubtitle: "Discover verified Kenyan crafts and daily goods delivered straight to your door. Safely checkout with M-Pesa & track your delivery from workshop to home.",
    shopCollect: "Shop Collection",
    learnStory: "Learn Our Story",
    categoriesTitle: "Curated Categories",
    categoriesSub: "Handcrafted, sourced sustainably from direct Kenyan artisans.",
    featuredTitle: "Trending Masterpieces",
    featuredSub: "Most loved designs, verified for quality and authentic origins.",
    foundProductsBefore: "Found",
    foundProductsAfter: "authentic products",
    allCategories: "All Categories",
    highToLow: "Price: High to Low",
    lowToHigh: "Price: Low to High",
    noProducts: "No products matched your criteria.",
    offlineCacheView: "Offline Cache View",

    // Product Card
    addToCart: "Add to Cart",
    outOfStock: "Out of Stock",
    earnPoints: "Earn points on every purchase across all local categories.",

    // Cart Page
    yourCartEmpty: "Your cart is empty",
    yourCartEmptySub: "Looks like you haven't added anything to your cart yet.",
    continueShopping: "Continue Shopping",
    cartSummary: "Order Summary",
    subtotal: "Subtotal",
    taxVat: "Standard VAT/Tax included",
    checkoutButton: "Proceed to Checkout",
    remove: "Remove",
    loyaltyApplied: "SokoPlus Loyalty XP Reward Points",

    // Profile Page
    loyaltyPoints: "Loyalty Points",
    userProfile: "User Profile",
    personalStats: "Personal Statistics",
    deviceAlerts: "Delivery & Dispatch Alerts",
    deviceAlertsSub: "Enable native browser alerts to automatically receive real-time notifications about dispatch, routing, and delivered status of your SokoPlus order.",
    enableAlerts: "Enable Browser Alerts",
    activeAlerts: "Permission Opt-In",
    active: "Active",
    blocked: "Blocked",
    disabled: "Disabled",
    status: "Status",
    orderHistory: "Order History",
    filterMonth: "This Month",
    filter12Months: "Last 12 Months",
    filterSpecific: "Specific Month",
    noOrders: "No orders found in this selection.",

    // Footer
    aboutTitle: "About SokoPlus",
    aboutDesc: "SokoPlus connects authentic Kenyan workshops directly to global and local buyers, with transparent logistics and verification.",
    quickLinks: "Quick Links",
    customerSupport: "Customer Support",
    copyright: "All rights reserved. Sourced direct from Kenyan creators."
  },
  sw: {
    // Navbar & Search
    searchPlaceholder: "Tafuta bidhaa nchini Kenya...",
    home: "Nyumbani",
    blog: "Blogu",
    admin: "Usimamizi",
    cart: "Kikapu",
    profile: "Wasifu",
    login: "Ingia",
    logout: "Ondoka",
    wishlist: "Kipendacho",
    navSlogan: "Kazi za Sanaa Halisi za Kenya",

    // Hero Section / Homepage
    heroBadge: "SokoPlus Kenya • Bidhaa 100% Halisi za Sanaa",
    heroTitle: "Bidhaa Bora, Nafsi ya Kenya.",
    heroSubtitle: "Gundua bidhaa zilizothibitishwa za Kenya na mahitaji ya kila siku zilizowasilishwa moja kwa moja hadi mlangoni pako. Lipa salama na M-Pesa na ufuatilie mzigo wako kutoka karakana hadi nyumbani.",
    shopCollect: "Nunua Mkusanyiko",
    learnStory: "Jifunze Historia Yetu",
    categoriesTitle: "Vitengo Vilivyochaguliwa",
    categoriesSub: "Zilizotengenezwa kwa mikono, kutoka kwa mafundi wa moja kwa moja wa Kenya.",
    featuredTitle: "Kazi za Sanaa Zinazovuma",
    featuredSub: "Miundo inayopendwa zaidi, iliyothibitishwa kwa ubora na asili halisi.",
    foundProductsBefore: "Imepata bidhaa",
    foundProductsAfter: "halisi",
    allCategories: "Vitengo Vyote",
    highToLow: "Bei: Juu hadi Chini",
    lowToHigh: "Bei: Chini hadi Juu",
    noProducts: "Hakuna bidhaa zilizolingana na vigezo vyako.",
    offlineCacheView: "Mwonekano wa Cache ya Nje ya Mtandao",

    // Product Card
    addToCart: "Weka Kikapuni",
    outOfStock: "Imeisha",
    earnPoints: "Pata alama kwa kila ununuzi kwenye vitengo vyote vya kienyeji.",

    // Cart Page
    yourCartEmpty: "Kikapu chako kiko tupu",
    yourCartEmptySub: "Inaonekana bado hujaongeza chochote kwenye kikapu chako bado.",
    continueShopping: "Endelea Kununua",
    cartSummary: "Muhtasari wa Agizo",
    subtotal: "Jumla ndogo",
    taxVat: "Kodi ya VAT ya kawaida imejumuishwa",
    checkoutButton: "Endelea na Malipo",
    remove: "Ondoa",
    loyaltyApplied: "Alama za Zawadi ya SokoPlus Loyalty XP",

    // Profile Page
    loyaltyPoints: "Alama za Uaminifu",
    userProfile: "Wasifu wa Mtumiaji",
    personalStats: "Takwimu za Kibinafsi",
    deviceAlerts: "Arifa za Uwasilishaji & Usafirishaji",
    deviceAlertsSub: "Washa arifa za kivinjari ili kupokea kiotomatiki habari za wakati halisi kuhusu usafirishaji na uwasilishaji wa agizo lako la SokoPlus.",
    enableAlerts: "Washa Arifa za Kivinjari",
    activeAlerts: "Ruhusa Imekubaliwa",
    active: "Inatumika",
    blocked: "Imezuiwa",
    disabled: "Imezimwa",
    status: "Hali",
    orderHistory: "Historia ya Agizo",
    filterMonth: "Mwezi Huu",
    filter12Months: "Miezi 12 Iliopita",
    filterSpecific: "Mwezi Maalum",
    noOrders: "Hakuna maagizo yaliyopatikana katika chaguo hili.",

    // Footer
    aboutTitle: "Kuhusu SokoPlus",
    aboutDesc: "SokoPlus inaunganisha warsha halisi za Kenya moja kwa moja na wanunuzi wa kimataifa na wa ndani, kwa kutumia usafirishaji na uthibitishaji ulio wazi.",
    quickLinks: "Viungo vya Haraka",
    customerSupport: "Msaada kwa Wateja",
    copyright: "Haki zote zimehifadhiwa. Imetolewa moja kwa moja kutoka kwa wabunifu wa Kenya."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sokoplus_language");
      if (saved === "en" || saved === "sw") {
        return saved;
      }
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("sokoplus_language", lang);
    }
  };

  const t = (key: string): string => {
    // Resolve key safely with fallback to english or raw key
    const val = translations[language]?.[key] || translations["en"]?.[key] || key;
    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
