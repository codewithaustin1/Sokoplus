import React, { useState, useEffect } from "react";
import { useCart } from "../lib/CartContext";
import { UserProfile, CartItem } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { 
  CreditCard, 
  ShoppingBag, 
  ShieldCheck, 
  Loader2, 
  MapPin, 
  Truck, 
  Check, 
  Info, 
  AlertTriangle, 
  Sparkles, 
  Trash2, 
  Smartphone, 
  Plus, 
  Minus, 
  Lock, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { counties } from "../data/counties";
import { FastImage } from "../components/FastImage";
import { calculateDelivery, calculateShippingFee } from "../utils/delivery";
import { DeliveryCountdown } from "../components/DeliveryCountdown";

interface CheckoutProps {
  user: UserProfile | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { items, total, addToCart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectStage, setRedirectStage] = useState("Securing Connection");
  const [redirectDescription, setRedirectDescription] = useState("We are connecting you securely to Paystack to finalize your payment options.");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card">("mpesa");
  const [showMobilSummaryDrawer, setShowMobilSummaryDrawer] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  const [address, setAddress] = useState(() => {
    const savedCounty = localStorage.getItem("sokoplus_delivery_county") || "Nairobi City County";
    const savedCity = localStorage.getItem("sokoplus_delivery_city") || "Nairobi CBD";
    
    let initialPhone = user?.phoneNumber || "";
    initialPhone = initialPhone.replace(/\s+/g, "");
    if (initialPhone.startsWith("+254")) {
      initialPhone = initialPhone.substring(4);
    } else if (initialPhone.startsWith("254")) {
      initialPhone = initialPhone.substring(3);
    } else if (initialPhone.startsWith("0")) {
      initialPhone = initialPhone.substring(1);
    }

    return {
      city: savedCity,
      county: savedCounty,
      street: "",
      phone: initialPhone,
      email: user?.email || ""
    };
  });

  const navigate = useNavigate();

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !redirecting) {
      toast.error("Your cart is empty. Please add items before checking out.");
      navigate("/cart");
    }
  }, [items, navigate, redirecting]);

  const handleCountyChange = (countyName: string) => {
    const selectedCounty = counties.find(c => c.name === countyName);
    const defaultCity = selectedCounty && selectedCounty.cities.length > 0 ? selectedCounty.cities[0] : "";
    setAddress({
      ...address,
      county: countyName,
      city: defaultCity
    });
    localStorage.setItem("sokoplus_delivery_county", countyName);
    localStorage.setItem("sokoplus_delivery_city", defaultCity);
  };

  const selectedCountyData = counties.find(c => c.name === address.county) || counties.find(c => c.name === "Nairobi City County") || counties[0];
  const currentCities = selectedCountyData ? selectedCountyData.cities : [];

  const shippingFee = calculateShippingFee(address.county, address.city, total);
  const overallTotal = total + shippingFee;

  // Free shipping progress variables
  const FREE_SHIPPING_LIMIT = 15000;
  const progressToFreeShipping = Math.min((total / FREE_SHIPPING_LIMIT) * 100, 100);
  const remainingForFreeShipping = FREE_SHIPPING_LIMIT - total;

  // Real-time Dynamic Delivery Prediction
  const deliveryPrediction = calculateDelivery(address.county, address.city);

  // Change Quantity in Checkout page
  const handleIncreaseQty = (item: CartItem) => {
    addToCart({ ...item, quantity: 1 });
  };

  const handleDecreaseQty = (item: CartItem) => {
    if (item.quantity <= 1) {
      removeFromCart(item.productId, item.customizations);
    } else {
      addToCart({ ...item, quantity: -1 });
    }
  };

  const handleRemove = (item: CartItem) => {
    removeFromCart(item.productId, item.customizations);
    toast.success(`${item.name} removed from your checkout cart.`);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!address.phone) {
      errors.phone = "Phone number is required for dispatch notifications.";
    } else {
      const cleaned = address.phone.replace(/\s+/g, "");
      if (cleaned.length !== 9 || !/^[17]\d{8}$/.test(cleaned)) {
        errors.phone = "Please enter a valid 9-digit phone number (starts with 1 or 7, e.g. 712345678).";
      }
    }
    if (!address.street.trim()) {
      errors.street = "Please enter a delivery street or apartment address.";
    }
    if (!address.email) {
      errors.email = "An email is required for secure payment receipts.";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to complete your checkout.");
      navigate("/login");
      return;
    }

    if (user.email && !user.emailVerified) {
      toast.error("Please verify your email address before placing an order.", { icon: "📧" });
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill in all required standard shipping fields.");
      return;
    }

    // Instantly activate redirection/processing screen as an Optimistic action
    setRedirecting(true);
    setLoading(true);
    setRedirectStage("Validating Basket Stock");
    setRedirectDescription("Ensuring items in your cart are in stock and ready to pack for delivery...");

    try {
      // 1. Stock Check
      for (const item of items) {
        const pRef = doc(db, "products", item.productId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          if (pData.stock < item.quantity) {
            toast.error(`Sorry, "${item.name}" has insufficient stock. Only ${pData.stock} available.`);
            setLoading(false);
            setRedirecting(false);
            return;
          }
        }
      }

      setRedirectStage("Securing Connection");
      setRedirectDescription("Drafting Paystack billing configuration securely for instant payment validation...");

      // 2. Initialize Paystack
      const response = await axios.post("/api/paystack/initialize", {
        email: address.email,
        amount: overallTotal,
        callback_url: window.location.origin + "/payment-success",
        metadata: {
          userId: user.uid,
          items: items.map(i => ({ id: i.productId, qty: i.quantity, customs: i.customizations })),
          preferredPaymentMethod: paymentMethod
        }
      });

      const { authorization_url, reference } = response.data.data;

      setRedirectStage("Placing Order Records");
      setRedirectDescription("Updating your transaction database records so your order is tracked live...");

      // 3. Log Order to Firestore (as pending)
      const submittedAddress = {
        ...address,
        phone: `+254${address.phone.replace(/\s+/g, "")}`
      };

      const sellerIdsList = Array.from(new Set(items.map(i => i.sellerId).filter((id): id is string => !!id)));

      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: address.email,
        items,
        sellerIds: sellerIdsList,
        totalAmount: overallTotal,
        status: "pending",
        paymentStatus: "unpaid",
        paymentReference: reference,
        shippingAddress: submittedAddress,
        preferredPaymentMethod: paymentMethod,
        createdAt: serverTimestamp()
      });

      // 4. Smooth Redirect
      setRedirectStage("Redirecting to Paystack");
      setRedirectDescription("Navigating you securely to final portal Checkout...");
      
      setTimeout(() => {
        window.location.href = authorization_url;
      }, 100);
      
    } catch (error: any) {
      const detail = error.response?.data?.details || error.response?.data?.error || "Failed to process checkout. Please try again.";
      console.error("Checkout error:", error);
      toast.error(detail, { duration: 5000 });
      setLoading(false);
      setRedirecting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative font-sans text-gray-900 pb-28 md:pb-12">
      
      {/* Redirection Overlay */}
      <AnimatePresence>
        {redirecting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-orange-100 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-orange-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck size={32} className="text-orange-600 animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-black italic mb-2 tracking-tight">{redirectStage}</h2>
            <p className="text-gray-500 font-semibold max-w-sm">
              {redirectDescription}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <span className="text-xs uppercase font-extrabold tracking-widest text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-full">
          SokoPlus Express Checkout
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-3 italic text-gray-950 dark:text-white flex items-center gap-2">
          <span>Complete Your Order</span>
          <span className="text-sm not-italic font-bold bg-gray-150 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full shrink-0">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Single Cohesive Scrolling Sheet */}
        <div className="lg:col-span-8 space-y-8 max-h-[1400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          
          {/* STEP 1: Delivery Location Card */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 w-full"></div>
            
            <div className="flex items-start gap-4">
              <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 p-2.5 rounded-2xl shrink-0">
                <MapPin size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">1. Delivery Location</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Select your exact shipping destination inside Kenya
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">County Territory</label>
                <div className="relative">
                  <select 
                    value={address.county}
                    onChange={(e) => handleCountyChange(e.target.value)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                  >
                    {counties.map((c) => (
                      <option key={c.name} value={c.name} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Township / Settlement</label>
                <div className="relative">
                  <select 
                    value={address.city}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddress({...address, city: val});
                      localStorage.setItem("sokoplus_delivery_city", val);
                    }}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl outline-none text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none cursor-pointer pr-10"
                  >
                    {currentCities.map((city) => (
                      <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium">
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Detailed Street Address / Apartment / Estate</label>
              <input 
                required
                type="text" 
                value={address.street}
                onChange={(e) => {
                  setAddress({...address, street: e.target.value});
                  if (e.target.value.trim()) {
                    setValidationErrors(prev => {
                      const updated = { ...prev };
                      delete updated.street;
                      return updated;
                    });
                  }
                }}
                placeholder="e.g. Apartment A14, Pine Breeze Estate, 3rd Avenue" 
                className={`w-full p-4 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border rounded-2xl outline-none font-semibold focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all ${
                  validationErrors.street ? "border-red-500 focus:ring-red-400" : "border-gray-150 dark:border-gray-800"
                }`}
              />
              {validationErrors.street && (
                <p className="text-red-500 text-[10px] font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} />
                  <span>{validationErrors.street}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Delivery Phone Number</label>
                <div className={`flex rounded-2xl border overflow-hidden bg-gray-50 dark:bg-gray-950 focus-within:ring-2 focus-within:ring-orange-500 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-transparent transition-all ${
                  validationErrors.phone ? "border-red-500" : "border-gray-150 dark:border-gray-800"
                }`}>
                  <div className="flex items-center gap-1 px-4 bg-gray-150/60 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-800 select-none text-gray-600 dark:text-gray-400 font-bold text-sm">
                    <span className="text-base select-none">🇰🇪</span>
                    <span>+254</span>
                  </div>
                  <input 
                    required
                    type="tel" 
                    value={address.phone}
                    onChange={(e) => {
                      let val = e.target.value;
                      // Keep only digits
                      val = val.replace(/\D/g, "");
                      // Strip leading '0'
                      if (val.startsWith("0")) {
                        val = val.substring(1);
                      }
                      // Strip accidental typed/pasted '254'
                      if (val.startsWith("254")) {
                        val = val.substring(3);
                      }
                      setAddress({...address, phone: val});
                      if (val.trim()) {
                        setValidationErrors(prev => {
                          const updated = { ...prev };
                          delete updated.phone;
                          return updated;
                        });
                      }
                    }}
                    placeholder="712 345678" 
                    maxLength={9}
                    className="w-full p-4 bg-transparent outline-none font-bold text-gray-950 dark:text-white placeholder-gray-400"
                  />
                </div>
                {validationErrors.phone ? (
                  <p className="text-red-500 text-[10px] font-bold flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} />
                    <span>{validationErrors.phone}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-semibold ml-1">For driver coordination during delivery dispatch</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Notification Email Address</label>
                <input 
                  required
                  type="email" 
                  value={address.email}
                  onChange={(e) => {
                    setAddress({...address, email: e.target.value});
                    if (e.target.value.trim()) {
                      setValidationErrors(prev => {
                        const updated = { ...prev };
                        delete updated.email;
                        return updated;
                      });
                    }
                  }}
                  placeholder="name@email.com" 
                  disabled={!!user?.email}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-900 outline-none font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-all text-gray-900 dark:text-white"
                />
                {user?.email && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1.5 font-bold ml-1 uppercase tracking-tight flex items-center gap-1">
                    <ShieldCheck size={12} />
                    <span>Using verified account email</span>
                  </p>
                )}
              </div>
            </div>

            {/* Predictive Delivery Time Display Box with live Countdown */}
            <DeliveryCountdown 
              county={address.county} 
              city={address.city} 
              hideSelector={true} 
              className="mt-4"
            />

          </div>

          {/* STEP 2: Product Review & Interactive Quantities */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-teal-500 to-emerald-500 h-1.5 w-full"></div>
            
            <div className="flex items-start justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4">
              <div className="flex items-start gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-2xl shrink-0">
                  <ShoppingBag size={22} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight text-gray-955 dark:text-white">2. Review Your Items</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                    Fine-tune quantities directly in page without leaving
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {items.map((item) => (
                <div 
                  key={`${item.productId}-${item.customizations?.color || ""}-${item.customizations?.material || ""}`} 
                  className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-950 rounded-2xl outline outline-1 outline-gray-100/80 dark:outline-gray-800/80 overflow-hidden shrink-0 relative flex items-center justify-center">
                      <FastImage 
                        src={item.image || ""} 
                        alt={item.name}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h4 className="font-extrabold text-gray-950 dark:text-white text-sm md:text-md truncate hover:text-orange-600 dark:hover:text-orange-500 transition-colors">
                        <Link to={`/product/${item.productId}`}>
                          {item.name}
                        </Link>
                      </h4>
                      
                      {/* Sub-features/customizations */}
                      {item.customizations && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                          {item.customizations.material && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-black">
                              {item.customizations.material}
                            </span>
                          )}
                          {item.customizations.colorName && (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-black flex items-center gap-1 uppercase">
                              <span 
                                className="w-2 h-2 rounded-full border border-gray-200 dark:border-gray-700"
                                style={{ backgroundColor: item.customizations.color }}
                              />
                              {item.customizations.colorName}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="font-semibold text-gray-500 dark:text-gray-400 text-xs">
                        KES {item.price.toLocaleString()} each
                      </div>
                    </div>
                  </div>

                  {/* Quantity Actions & Item delete inside Checkout */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-950 rounded-xl px-2.5 py-1.5 border border-gray-150 dark:border-gray-800">
                      <button 
                        type="button"
                        onClick={() => handleDecreaseQty(item)}
                        className="p-1 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-900 rounded-lg transition-all text-gray-400 dark:text-gray-550 cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-xs font-black text-gray-950 dark:text-white">{item.quantity}</span>
                      <button 
                        type="button"
                        onClick={() => handleIncreaseQty(item)}
                        className="p-1 hover:text-orange-600 hover:bg-white dark:hover:bg-gray-900 rounded-lg transition-all text-gray-400 dark:text-gray-550 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="text-right min-w-[70px] hidden sm:block">
                      <p className="font-black text-xs text-gray-950 dark:text-white">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleRemove(item)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                      title="Remove product"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Items count alert details */}
            <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 flex justify-between items-center">
              <span>Dynamic cart total weight/item count check:</span>
              <span className="font-black text-gray-900 dark:text-white uppercase font-black">Pre-Cleaned</span>
            </div>

          </div>

          {/* STEP 3: Interactive Payment gateway selector */}
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 w-full"></div>
            
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 p-2.5 rounded-2xl shrink-0">
                <CreditCard size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">3. Preferred Payment Method</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Both channels processed automatically & securely through Paystack
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              
              {/* Option Cards: Mpesa */}
              <div 
                onClick={() => setPaymentMethod("mpesa")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between h-32 ${
                  paymentMethod === "mpesa" 
                    ? "border-orange-600 bg-orange-50/15 dark:bg-orange-950/10 ring-2 ring-orange-100 dark:ring-orange-900/30" 
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white uppercase">M-PESA / Mobile Money</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "mpesa" ? "border-orange-600 bg-orange-600" : "border-gray-300 dark:border-gray-700"
                  }`}>
                    {paymentMethod === "mpesa" && <Check className="text-white" size={12} />}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Supported Telcos</p>
                  <p className="text-xs text-gray-800 dark:text-gray-200 font-extrabold flex items-center gap-1.5">
                    <Smartphone size={14} className="text-orange-600" />
                    <span>Safaricom M-Pesa instant checkout STK Push</span>
                  </p>
                </div>
              </div>

              {/* Option Cards: Card */}
              <div 
                onClick={() => setPaymentMethod("card")}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between h-32 ${
                  paymentMethod === "card" 
                    ? "border-orange-600 bg-orange-50/15 dark:bg-orange-950/10 ring-2 ring-orange-100 dark:ring-orange-900/30" 
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white uppercase">Credit / Debit Cards</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === "card" ? "border-orange-600 bg-orange-600" : "border-gray-300 dark:border-gray-700"
                  }`}>
                    {paymentMethod === "card" && <Check className="text-white" size={12} />}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">Accepted Cards</p>
                  <p className="text-xs text-gray-800 dark:text-gray-200 font-extrabold flex items-center gap-1.5">
                    <CreditCard size={14} className="text-orange-600" />
                    <span>Visa, Mastercard, & American Express secure transaction</span>
                  </p>
                </div>
              </div>

            </div>

            <div className="bg-gray-50/70 dark:bg-gray-950/70 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-semibold justify-between mt-2">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>100% Secure Checkout powered by Paystack.</span>
              </div>
              <span className="text-[10px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-550 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
                PCI-DSS Compliant
              </span>
            </div>

          </div>   </div>

               {/* RIGHT COLUMN: Sticky Predictive Calculation Summary Panel */}
        <div className="lg:col-span-4 sticky top-24 self-start hidden lg:block">
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl dark:shadow-none space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-gray-800">
              <h2 className="text-md font-black uppercase tracking-wider text-gray-955 dark:text-white flex items-center gap-2">
                <Receipt size={16} className="text-orange-600 dark:text-orange-400" />
                <span>Calculation Summary</span>
              </h2>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-extrabold uppercase">Dynamic predictions</span>
            </div>

            {/* Predictive Free Shipping progress tracker */}
            <div className="space-y-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10 p-4 rounded-2xl border border-orange-100/30 dark:border-orange-900/20">
              <div className="flex items-center justify-between text-xs font-bold leading-none">
                <span className="text-orange-850 dark:text-orange-300 flex items-center gap-1.5 uppercase font-black text-[10px] tracking-wider">
                  <Sparkles size={12} className="text-orange-600 dark:text-orange-400" />
                  Free delivery test
                </span>
                <span className="text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase">
                  Threshold: KES 15,000
                </span>
              </div>

              {/* Progress gauge */}
              <div className="w-full bg-orange-100/30 dark:bg-orange-950/40 rounded-full h-2 overflow-hidden mt-1.5">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressToFreeShipping}%` }}
                />
              </div>

              {remainingForFreeShipping > 0 ? (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed mt-1">
                  Add <span className="font-extrabold text-orange-600 dark:text-orange-400">KES {remainingForFreeShipping.toLocaleString()}</span> more to unlock <span className="font-extrabold">FREE shipping</span>.
                </p>
              ) : (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1 uppercase tracking-tight">
                  <Check size={12} />
                  <span>Unbelievable! You've unlocked FREE Delivery.</span>
                </p>
              )}
            </div>

            {/* Breakdown fields */}
            <div className="space-y-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
              
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-black text-gray-900 dark:text-white">KES {total.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span>Express Courier Fee</span>
                  <p className="text-[9px] text-gray-450 dark:text-gray-400 font-bold mt-0.5 leading-none uppercase">
                    {address.county.split(" ")[0]} Area Rate
                  </p>
                </div>
                <span className="font-black text-gray-900 dark:text-white">
                  {shippingFee === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] bg-emerald-50 dark:bg-emerald-950/35 px-2 py-0.5 rounded-full">
                      Free shipping
                    </span>
                  ) : (
                    `KES ${shippingFee.toLocaleString()}`
                  )}
                </span>
              </div>

              <div className="flex justify-between pt-1 border-t border-dashed border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500">
                <span>Value Added Tax (16% VAT)</span>
                <span className="font-bold">Included</span>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-1">
                <div className="flex justify-between items-baseline text-2xl font-black text-gray-950 dark:text-white">
                  <span>Grand Total</span>
                  <span className="text-orange-655 dark:text-orange-400 font-black">
                    KES {overallTotal.toLocaleString()}
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 dark:text-gray-550 text-right font-medium leading-none">
                  Fully transparent pricing details.
                </p>
              </div>

            </div>

            <button 
              onClick={handleCheckout}
              disabled={loading || items.length === 0}
              type="button"
              className="w-full bg-gray-900 dark:bg-orange-600 text-white py-5 rounded-3xl font-black text-md hover:bg-orange-600 dark:hover:bg-orange-700 focus:bg-orange-605 focus:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group shadow-lg shadow-gray-100 dark:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 animate-spin" />
                  Finalizing Order...
                </>
              ) : (
                <>
                  Secure Payment with Paystack
                  <ArrowRight className="ml-2.5 group-hover:translate-x-1 transition-transform" size={16} />
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold leading-relaxed">
                By clicking pay, you will be redirected to the secure gateway channel. Guaranteed protection by Paystack.
              </p>
            </div>

          </div>
        </div>

      </div>

           {/* MOBILE STICKY BOTTOM CHECKOUT SUMMARY DISPLAY BAR (Exclusive to small/medium views) */}
      <div className="fixed sm:static lg:hidden inset-x-0 bottom-0 z-40 bg-white dark:bg-gray-950 shadow-[-5px_-10px_35px_rgba(0,0,0,0.08)] dark:shadow-none border-t border-gray-100 dark:border-gray-800 p-4 md:p-6 pb-6 flex items-center justify-between gap-4 font-sans max-w-full">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1 pb-1.5" onClick={() => setShowMobilSummaryDrawer(!showMobilSummaryDrawer)}>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest">Grand Total</span>
            <ChevronUp size={12} className="text-gray-400" />
          </div>
          <p className="text-xl font-black text-gray-955 dark:text-white leading-none tracking-tight">
            KES {overallTotal.toLocaleString()}
          </p>
          <button 
            type="button"
            onClick={() => setShowMobilSummaryDrawer(true)}
            className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold uppercase mt-1.5 tracking-tight hover:underline flex items-center"
          >
            Breakdown & Shipping
          </button>
        </div>

        <button 
          onClick={handleCheckout}
          disabled={loading || items.length === 0}
          type="button"
          className="flex-1 bg-gray-950 dark:bg-orange-600 text-white py-4 px-5 rounded-2xl font-black text-sm hover:bg-orange-600 dark:hover:bg-orange-700 active:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <span className="flex items-center gap-1.5 uppercase tracking-wide text-xs">
              <span>Checkout</span>
              <ArrowRight size={14} />
            </span>
          )}
        </button>
      </div>

      {/* MOBILE BREAKDOWN DRAWER MODAL OVERLAY */}
      <AnimatePresence>
        {showMobilSummaryDrawer && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobilSummaryDrawer(false)}
              className="fixed inset-0 z-45 bg-black"
            />

            {/* Content Drawer Sheet */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-[2.5rem] shadow-2xl p-6 md:p-8 space-y-6 pb-12 font-sans"
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto" onClick={() => setShowMobilSummaryDrawer(false)}></div>
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-black italic tracking-tight text-gray-950 dark:text-white flex items-center gap-2">
                  <Receipt size={18} className="text-orange-600 dark:text-orange-400" />
                  <span>Interactive Calculation</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowMobilSummaryDrawer(false)}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full font-bold cursor-pointer transition-all"
                >
                  Dismiss
                </button>
              </div>

              {/* Free delivery metrics validation display */}
              <div className="space-y-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/10 dark:to-amber-950/10 p-4 rounded-2xl border border-orange-100/30 dark:border-orange-900/10">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-orange-800 dark:text-orange-300">Free delivery test</span>
                  <span className="text-orange-600 dark:text-orange-400">Threshold: KES 15,000</span>
                </div>
                <div className="w-full bg-orange-100/30 dark:bg-orange-950/40 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full"
                    style={{ width: `${progressToFreeShipping}%` }}
                  />
                </div>
                {remainingForFreeShipping > 0 ? (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-snug">
                    Add <span className="font-extrabold text-orange-600 dark:text-orange-400">KES {remainingForFreeShipping.toLocaleString()}</span> more to unlock <span className="font-extrabold text-gray-800 dark:text-gray-300">FREE shipping</span>.
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                    <Check size={12} />
                    <span>Unlocked FREE delivery!</span>
                  </p>
                )}
              </div>

              {/* Calculation List Table */}
              <div className="space-y-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 pt-2">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-gray-905 dark:text-white">KES {total.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <span>Express Delivery Courier Fee</span>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold leading-none mt-0.5">
                      {address.county} Zone Rate
                    </p>
                  </div>
                  <span className="font-bold text-gray-950 dark:text-white">
                    {shippingFee === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[10px] bg-emerald-50 dark:bg-emerald-950/35 px-2 py-0.5 rounded-full">
                        Free shipping
                      </span>
                    ) : (
                      `KES ${shippingFee.toLocaleString()}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between pt-1 border-t border-dashed border-gray-100 dark:border-gray-850 text-gray-400 dark:text-gray-500">
                  <span>VAT Tax (16% inclusive)</span>
                  <span className="font-bold">Included</span>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-1">
                  <div className="flex justify-between items-baseline text-2xl font-black text-gray-950 dark:text-white">
                    <span>Grand Total</span>
                    <span className="text-orange-655 dark:text-orange-400 font-black">
                      KES {overallTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-955 p-4 rounded-2xl text-[10px] leading-relaxed text-gray-400 dark:text-gray-500 font-semibold max-w-full">
                🚨 Delivery expectation for <span className="text-gray-900 dark:text-white font-black">{address.county} ({address.city})</span>: {deliveryPrediction.time}.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
