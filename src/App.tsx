/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider } from "./lib/CartContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import ProductDetails from "./pages/ProductDetails";
import Wishlist from "./pages/Wishlist";
import Profile from "./pages/Profile";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Admin from "./pages/Admin";
import Blog from "./pages/Blog";
import Login from "./pages/Login";
import PaymentSuccess from "./pages/PaymentSuccess";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { UserProfile } from "./types";
import { MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Unsubscribe from previous user if exists
        if (unsubscribeUser) unsubscribeUser();

        // Listen to user document for real-time updates (like wishlist)
        const userRef = doc(db, "users", fbUser.uid);
        unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          let isAdmin = false;
          try {
            const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
            isAdmin = adminDoc.exists();
          } catch (e) {
            console.warn("Admin check failed:", e);
          }

          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || "",
              displayName: fbUser.displayName || "User",
              loyaltyPoints: data.loyaltyPoints || 0,
              wishlist: data.wishlist || [],
              isAdmin
            });
          } else {
            // Document might not exist yet if just signed up, wait for Login page to create it
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || "",
              displayName: fbUser.displayName || "User",
              loyaltyPoints: 0,
              wishlist: [],
              isAdmin
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("User doc listener error:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-sans">Loading Soplus...</div>;

  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-gray-900 selection:bg-orange-100">
          <Navbar user={user} />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/product/:id" element={<ProductDetails user={user} />} />
              <Route path="/wishlist" element={<Wishlist user={user} />} />
              <Route path="/profile" element={<Profile user={user} />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout user={user} />} />
              <Route path="/admin/*" element={<Admin user={user} />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/login" element={<Login />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
            </Routes>
          </main>
          <Footer />
          <button 
            className="fixed bottom-6 right-6 bg-gray-900 text-white p-4 rounded-full shadow-2xl hover:bg-orange-600 transition-all z-50 group flex items-center"
            onClick={() => toast("Chat support coming soon to Nairobi!", { icon: '💬' })}
          >
            <MessageCircle size={24} />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
              Chat with us
            </span>
          </button>
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </CartProvider>
  );
}
