import React, { useState } from "react";
import { useCart } from "../lib/CartContext";
import { UserProfile } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { CreditCard, ShoppingBag, ShieldCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { counties } from "../data/counties";

interface CheckoutProps {
  user: UserProfile | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { items, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [address, setAddress] = useState({
    city: "Nairobi CBD",
    county: "Nairobi City County",
    street: "",
    phone: user?.phoneNumber || "",
    email: user?.email || ""
  });
  const navigate = useNavigate();

  const handleCountyChange = (countyName: string) => {
    const selectedCounty = counties.find(c => c.name === countyName);
    const defaultCity = selectedCounty && selectedCounty.cities.length > 0 ? selectedCounty.cities[0] : "";
    setAddress({
      ...address,
      county: countyName,
      city: defaultCity
    });
  };

  const selectedCountyData = counties.find(c => c.name === address.county) || counties.find(c => c.name === "Nairobi City County") || counties[0];
  const currentCities = selectedCountyData ? selectedCountyData.cities : [];

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

    if (!address.email) {
      toast.error("An email address is required for payment processing.");
      return;
    }

    setLoading(true);
    try {
      // 1. Stock Check
      for (const item of items) {
        const pRef = doc(db, "products", item.productId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const pData = pSnap.data();
          if (pData.stock < item.quantity) {
            toast.error(`Sorry, ${item.name} is currently out of stock or has insufficient quantity.`);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Initialize Paystack
      const response = await axios.post("/api/paystack/initialize", {
        email: address.email,
        amount: total + 250,
        callback_url: window.location.origin + "/payment-success",
        metadata: {
          userId: user.uid,
          items: items.map(i => ({ id: i.productId, qty: i.quantity }))
        }
      });

      const { authorization_url, reference } = response.data.data;

      // 3. Log Order to Firestore (as pending)
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: address.email,
        items,
        totalAmount: total + 250,
        status: "pending",
        paymentStatus: "unpaid",
        paymentReference: reference,
        shippingAddress: address,
        createdAt: serverTimestamp()
      });

      // 4. Smooth Redirect
      setRedirecting(true);
      setTimeout(() => {
        window.location.href = authorization_url;
      }, 300);
      
    } catch (error: any) {
      const detail = error.response?.data?.details || error.response?.data?.error || "Failed to process checkout. Please try again.";
      console.error("Checkout error:", error);
      toast.error(detail, { duration: 5000 });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 relative">
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
                <ShieldCheck size={32} className="text-orange-600" />
              </div>
            </div>
            <h2 className="text-3xl font-black italic mb-2">Connecting Securely</h2>
            <p className="text-gray-500 font-medium max-w-sm">
              We're taking you to Paystack to complete your purchase safely.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-4xl font-black mb-10 tracking-tight italic">Checkout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-4">
            <h2 className="text-xl font-bold mb-4">Shipping Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                  <input 
                    required
                    type="email" 
                    value={address.email}
                    onChange={(e) => setAddress({...address, email: e.target.value})}
                    placeholder="your@email.com" 
                    disabled={!!user?.email}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                  />
                  {user?.email && <p className="text-[10px] text-gray-400 mt-1 ml-1">Using account email</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                  <input 
                    required
                    type="text" 
                    value={address.phone}
                    onChange={(e) => setAddress({...address, phone: e.target.value})}
                    placeholder="+254..." 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">County</label>
                  <select 
                    value={address.county}
                    onChange={(e) => handleCountyChange(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium"
                  >
                    {counties.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City / Town</label>
                  <select 
                    value={address.city}
                    onChange={(e) => setAddress({...address, city: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium"
                  >
                    {currentCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Street Address</label>
                <input 
                  required
                  type="text" 
                  value={address.street}
                  onChange={(e) => setAddress({...address, street: e.target.value})}
                  placeholder="Apartment, Studio, or Floor" 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                />
              </div>
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black text-xl hover:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50 group"
          >
            {loading ? (
              <>
                <Loader2 className="mr-3 animate-spin" />
                Processing Order...
              </>
            ) : (
              <>
                Confirm & Pay KES {(total + 250).toLocaleString()} 
                <CreditCard className="ml-3 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Review Items</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {items.map(item => (
                <div key={item.productId} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                      <ShoppingBag size={16} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold">KES {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-6 pt-6 space-y-2">
              <div className="flex justify-between text-gray-500">
                <span>Shipping Fee</span>
                <span>KES 250</span>
              </div>
              <div className="flex justify-between text-2xl font-black pt-2">
                <span>Total</span>
                <span>KES {(total + 250).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
