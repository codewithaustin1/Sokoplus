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
    added: "Added!",
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
    recommendedForYou: "Recommended for You",

    // Footer
    aboutTitle: "About SokoPlus",
    aboutDesc: "SokoPlus connects authentic Kenyan workshops directly to global and local buyers, with transparent logistics and verification.",
    quickLinks: "Quick Links",
    customerSupport: "Customer Support",
    copyright: "All rights reserved. Sourced direct from Kenyan creators."
  },
  sw: {
    // Navbar & Search
    searchPlaceholder: "Tafuta bidhaa na kazi safi za mikono sokoni...",
    home: "Nyumbani (Karibu)",
    blog: "Hadithi Zetu",
    admin: "Usimamizi wa Soko",
    cart: "Kikapu Chako",
    profile: "Wasifu Wako",
    login: "Ingia (Karibu)",
    logout: "Ondoka Salama",
    wishlist: "Vipendavyo Moyoni",
    navSlogan: "Kazi Safi ya Mikono, Nafsi ya Kenya",

    // Hero Section / Homepage
    heroBadge: "SokoPlus Kenya • Kazi Maalum na Bidhaa 100% Halisi za Kienyeji",
    heroTitle: "Bidhaa Bora, Nafsi ya Kenya.",
    heroSubtitle: "Gundua sanaa asilia kamilifu na bidhaa bora zilizoundwa kwa upendo na mafundi wetu kote nchini. Lipa salama kupitia M-Pesa na upokee mzigo mlangoni pako kwa uaminifu na amani ya akili.",
    shopCollect: "Anza Kununua Sasa",
    learnStory: "Jifunze Historia Yetu",
    categoriesTitle: "Vitengo Vilivyoteuliwa kwa Makini",
    categoriesSub: "Kazi safi za mikono, zilizosafirishwa moja kwa moja kutoka kwa mafundi shupavu wa Kenya.",
    featuredTitle: "Kazi Kubwa za Sanaa Zinazovuma",
    featuredSub: "Miundo maarufu inayopendwa zaidi, iliyohakikiwa kwa ubora mkuu na asili yake halisi.",
    foundProductsBefore: "Tumefanikiwa kupata bidhaa",
    foundProductsAfter: "halisi na thabiti sokoni",
    allCategories: "Vitengo Vyote",
    highToLow: "Bei: Juu hadi Chini",
    lowToHigh: "Bei: Chini hadi Juu",
    noProducts: "Hakuna bidhaa zilizolingana na vigezo vyako.",
    offlineCacheView: "Mwonekano wa Cache ya Nje ya Mtandao",

    // Product Card
    addToCart: "Weka Kwenye Kikapu",
    added: "Imewekwa!",
    outOfStock: "Mali imeisha kwa sasa",
    earnPoints: "Vuna alama za uaminifu na upate zawadi maalum kwa kila ununuzi kote sokoni.",

    // Cart Page
    yourCartEmpty: "Kikapu chako kiko tupu kwa sasa",
    yourCartEmptySub: "Inaonekana bado hujaweka ununuzi wowote kwenye kikapu chako. Karibu utazame bidhaa zetu kupata unachoipenda.",
    continueShopping: "Rudi Sokoni / Endelea Kununua",
    cartSummary: "Muhtasari wa Ununuzi wako",
    subtotal: "Jumla Ndogo (Gharama)",
    taxVat: "Imeshatolewa kodi yote ya VAT ya kawaida",
    checkoutButton: "Lipia sasa kupitia M-Pesa kwa urahisi",
    remove: "Ondoa mbali",
    loyaltyApplied: "Alama za Zawadi ya SokoPlus Loyalty zimetumika kwa mafanikio",

    // Profile Page
    loyaltyPoints: "Alama Zako za Uaminifu",
    userProfile: "Wasifu wa Mwanasoko",
    personalStats: "Takwimu Zako za Ununuzi",
    deviceAlerts: "Arifa za Wakati Real Kuhusu Safari ya Mzigo",
    deviceAlertsSub: "Washa arifa za kivinjari ili kupata ujumbe kiotomatiki wakati mzigo wako unapoondoka karakana hadi unapokaribia mlangoni pako.",
    enableAlerts: "Washa Arifa za Safari ya Mzigo",
    activeAlerts: "Ruhusa Zimekubaliwa",
    active: "Inafanya Kazi vyema",
    blocked: "Imezuiwa",
    disabled: "Imezimwa",
    status: "Hali",
    orderHistory: "Historia ya Maagizo Yako",
    filterMonth: "Mwezi Huu",
    filter12Months: "Miezi 12 Iliyopita",
    filterSpecific: "Mwezi Maalum",
    noOrders: "Bado hujaagiza katika kundi hili.",
    recommendedForYou: "Zilizopendekezwa kwa Ajili Yako",

    // Footer
    aboutTitle: "Kuhusu SokoPlus Kenya",
    aboutDesc: "SokoPlus inaandaa soko la kidijitali linalounganisha warsha na mafundi hodari wa Kenya moja kwa moja na mioyo ya wanunuzi kote duniani, kwa uwazi kamili na urahisi.",
    quickLinks: "Viungo vya Haraka",
    customerSupport: "Tuko Hapa Kukusaidia (Msaada)",
    copyright: "Haki zote zimehifadhiwa © SokoPlus. Kazi za dhati kutoka kwa mafundi shupavu wa Kenya."
  }
};

const swahiliOverrideMap: Record<string, string> = {
  // Simple words and phrases
  "recommended for you": "Zilizopendekezwa kwa Ajili Yako",
  "personalized for you": "Kulingana na Mapendezi Yako",
  "trending picks": "Bidhaa Zinazovuma Sokoni",
  "based on your interest": "Kulingana na bidhaa ulizotazama au kupenda",
  "browse products or save to wishlist for personalized recommendations.": "Tazama bidhaa au weka kwenye Vipendavyo ili kupata mapendekezo yanayokufaa.",
  "your cart": "Kikapu Chako cha Ununuzi",
  "your wishlist is empty": "Orodha yako ya vipendavyo iko tupu kwa sasa",
  "explore our collection and save your favorite items by clicking the heart icon. we'll keep them safe for you.": "Tazama mkusanyiko wetu na uhifadhi bidhaa unazozipenda kwa kubofya alama ya moyo. Tutazilinda salama kwa ajili yako.",
  "items you've saved for later. ready to make them yours?": "Bidhaa ulizohifadhi kwa ajili ya baadaye. Je, uko tayari kuzifanya ziwe zako?",
  "my wishlist": "Vipendavyo Moyoni Mwangu",
  "sort by": "Panga kwa",
  "recently added": "Zilizoongezwa Hivi Karibuni",
  "price: low to high": "Bei: Chini hadi Juu",
  "price: high to low": "Bei: Juu hadi Chini",
  "name: a-z": "Jina: A-Z",
  "name: z-a": "Jina: Z-A",
  "details": "Maelezo Kamili",
  "add to cart": "Weka Kwenye Kikapu",
  "out of stock": "Bila Akiba kwa Sasa",
  "low stock": "Inakaribia Kwisha",
  "in stock": "Ipo Sokoni (Tayari)",
  "billing details": "Maelezo ya Malipo na Mteja",
  "full name": "Majina Kamili",
  "email address": "Anwani ya Barua Pepe",
  "phone number": "Nambari ya Simu",
  "county": "Kaunti",
  "city": "Mji / Sehemu",
  "street address": "Mtaa / Maelezo ya Mlangoni",
  "delivery options": "Njia za Usafirishaji",
  "free": "Bila Malipo (Bure)",
  "m-pesa mobile money": "Malipo ya M-Pesa",
  "credit or debit card": "Kadi ya Benki (Card)",
  "pay with m-pesa": "Lipa kupitia M-Pesa",
  "pay with card": "Lipa kwa Kadi ya Benki",
  "pay now": "Lipa Sasa Hivi",
  "secure checkout": "Lipia Salama Sasa",
  "payments secured via paystack. trusted across 47 counties.": "Malipo yanalindwa kupitia Paystack. Tunaaminika katika kaunti zote 47.",
  "shipping info": "Taarifa za Usafirishaji",
  "returns & exchanges": "Kurudisha & Kubadilisha Bidhaa",
  "faq": "Maswali Yanayoulizwa Sana",
  "contact": "Wasiliana Nasi",
  "join our community": "Jiunge na Jamii Yetu ya Wasanii",
  "enter your email": "Ingiza barua pepe yako",
  "receive weekly curated product drops and local stories.": "Pokea habari za kila wiki kuhusu bidhaa mpya na hadithi zetu za kienyeji.",
  "marketplace": "Soko Letu Kuu",
  "all products": "Bidhaa Zote Safi",
  "best sellers": "Zinazouzwa Sana",
  "market stories": "Hadithi za Soko",
  "support": "Msaada & Huduma",
  "track order": "Fuatilia Mzigo wako",
  "revlon plaza, biashara street,": "Jengo la Revlon Plaza, Mtaa wa Biashara,",
  "nairobi cbd": "Nairobi CBD",
  "all rights reserved. sourced direct from kenyan creators.": "Haki zote zimehifadhiwa © SokoPlus. Kazi za dhati kutoka kwa mafundi shupavu.",
  "bridging the gap between kenya's finest local artisans and global quality standards. discover the heart of nairobi.": "Kuunganisha warsha na mafundi hodari wa Kenya na mioyo ya wanunuzi kote duniani kwa urahisi kabisa.",
  "your cart is empty": "Kikapu chako kiko tupu kwa sasa",
  "looks like you haven't added anything to your cart yet.": "Inaonekana bado hujaweka ununuzi wowote kwenye kikapu chako.",
  "start shopping": "Anza Kununua Sasa",
  "order summary": "Muhtasari wa Ununuzi wako",
  "subtotal": "Jumla Ndogo (Gharama)",
  "shipping": "Usafirishaji",
  "calculated at checkout": "Itahesabiwa unapolipa",
  "shipping (nairobi)": "Usafirishaji (Nairobi)",
  "total": "Jumla Kuu",
  "each": "kila kimoja",
  "color:": "Rangi:",
  "material & hardwood:": "Nyenzo na Mbao:",
  "decrease": "Punguza",
  "increase": "Ongeza",
  "remove all": "Ondoa vyote",
  "remove": "Ondoa",
  "continue shopping": "Rudi Sokoni / Endelea Kununua",
  "standard vat/tax included": "Imeshatolewa kodi yote ya VAT ya kawaida",
  "proceed to checkout": "Lipia sasa kupitia M-Pesa kwa urahisi",
  "sokoplus loyalty xp reward points": "Alama za Zawadi ya SokoPlus Loyalty zimetumika kwa mafanikio",
  "loyalty points": "Alama Zako za Uaminifu",
  "user profile": "Wasifu wa Mwanasoko",
  "personal statistics": "Takwimu Zako za Ununuzi",
  "delivery & dispatch alerts": "Arifa za Wakati Real Kuhusu Safari ya Mzigo",
  "enable browser alerts": "Washa Arifa za Safari ya Mzigo",
  "permission opt-in": "Ruhusa Zimekubaliwa",
  "active": "Inafanya Kazi vyema",
  "blocked": "Imezuiwa",
  "disabled": "Imezimwa",
  "status": "Hali",
  "order history": "Historia ya Maagizo Yako",
  "this month": "Mwezi Huu",
  "last 12 months": "Miezi 12 Iliyopita",
  "specific month": "Mwezi Maalum",
  "no orders found in this selection.": "Bado hujaagiza katika kundi hili.",
  "about sokoplus": "Kuhusu SokoPlus Kenya",
  "quick links": "Viungo vya Haraka",
  "customer support": "Tuko Hapa Kukusaidia (Msaada)"
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
    const cleanedKey = key.trim().toLowerCase();
    const mapVal = swahiliOverrideMap[cleanedKey];
    if (language === "sw" && mapVal) {
      return mapVal;
    }
    // Fallback to exact dictionary mapping if present, else original string
    return translations[language]?.[key] || translations["en"]?.[key] || key;
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
