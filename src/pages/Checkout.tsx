import React, { useState } from "react";
import { useCart } from "../lib/CartContext";
import { UserProfile } from "../types";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { CreditCard, ShoppingBag, AlertCircle } from "lucide-react";

interface CheckoutProps {
  user: UserProfile | null;
}

export default function Checkout({ user }: CheckoutProps) {
  const { items, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    city: "Nairobi",
    county: "Nairobi",
    street: "",
    phone: ""
  });
  const navigate = useNavigate();

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to complete your checkout.");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      // 0. Preliminary Stock Check
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

      // 1. Initialize Paystack
      const response = await axios.post("/api/paystack/initialize", {
        email: user.email,
        amount: total + 250,
        callback_url: window.location.origin + "/payment-success",
        metadata: {
          userId: user.uid,
          items: items.map(i => ({ id: i.productId, qty: i.quantity }))
        }
      });

      const { authorization_url, reference } = response.data.data;

      // 2. Log Order to Firestore (as pending)
      const orderDoc = await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: user.email,
        items,
        totalAmount: total + 250,
        status: "pending",
        paymentStatus: "unpaid",
        paymentReference: reference,
        shippingAddress: address,
        createdAt: serverTimestamp()
      });

      // Send initial notification
      axios.post("/api/orders/notify-status", {
        orderId: orderDoc.id,
        email: user.email,
        status: "pending",
        customerName: user.displayName || "Valued Customer"
      }).catch(err => console.error("Initial notification failed:", err));

      // 3. Redirect to Paystack
      toast.success("Redirecting to secure payment...");
      window.location.href = authorization_url;
      
    } catch (error: any) {
      const detail = error.response?.data?.details || error.response?.data?.error || "Failed to process checkout. Please try again.";
      console.error("Checkout error:", error);
      toast.error(detail, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black mb-8">Checkout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-4">
            <h2 className="text-xl font-bold mb-4">Shipping Details</h2>
            <div className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">County</label>
                  <select 
                    value={address.county}
                    onChange={(e) => setAddress({...address, county: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                  >
                    <option>Nairobi</option>
                    <option>Kiambu</option>
                    <option>Mombasa</option>
                    <option>Kisumu</option>
                    <option>Nakuru</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
                  <input 
                    required
                    type="text" 
                    value={address.city}
                    onChange={(e) => setAddress({...address, city: e.target.value})}
                    placeholder="Area/Estate" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                  />
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
            className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black text-xl hover:bg-orange-600 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {loading ? "Processing..." : (
              <>Pay KES {(total + 250).toLocaleString()} <CreditCard className="ml-3" /></>
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
