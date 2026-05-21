/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CartProvider } from "./lib/CartContext";
import { CurrencyProvider } from "./lib/CurrencyContext";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Cookies from "./pages/Cookies";
import FAQ from "./pages/FAQ";
import ReturnPolicy from "./pages/ReturnPolicy";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { UserProfile } from "./types";
import { MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import SupportChat from "./components/SupportChat";
import VerificationBanner from "./components/VerificationBanner";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  useEffect(() => {
    const handleOpenSupport = () => setIsSupportOpen(true);
    window.addEventListener("open-support-chat", handleOpenSupport);
    return () => {
      window.removeEventListener("open-support-chat", handleOpenSupport);
    };
  }, []);

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
              email: fbUser.email || data.email || null,
              phoneNumber: fbUser.phoneNumber || data.phoneNumber || null,
              displayName: fbUser.displayName || data.displayName || "User",
              loyaltyPoints: data.loyaltyPoints || 0,
              wishlist: data.wishlist || [],
              isAdmin,
              emailVerified: fbUser.emailVerified
            });
          } else {
            // Document might not exist yet if just signed up, wait for Login page to create it
            setUser({
              uid: fbUser.uid,
              email: fbUser.email || null,
              phoneNumber: fbUser.phoneNumber || null,
              displayName: fbUser.displayName || "User",
              loyaltyPoints: 0,
              wishlist: [],
              isAdmin,
              emailVerified: fbUser.emailVerified
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
    <CurrencyProvider>
      <CartProvider>
        <Router>
        <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-gray-900 selection:bg-orange-100">
          {user && !user.emailVerified && <VerificationBanner email={user.email} />}
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
              <Route path="/blog" element={<Blog user={user} />} />
              <Route path="/login" element={<Login />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/returns" element={<ReturnPolicy />} />
            </Routes>
          </main>
          <Footer />
          <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-4 z-[60]">
            <a 
              href="https://wa.me/254740463021" 
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-[#25D366] text-white rounded-full shadow-2xl hover:scale-110 transition-all group flex items-center"
              title="Official WhatsApp Support"
            >
              <MessageCircle size={24} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                WhatsApp Us
              </span>
            </a>
            
            <button 
              className={`p-4 rounded-full shadow-2xl transition-all group flex items-center ${isSupportOpen ? 'bg-orange-600 text-white rotate-90 scale-110' : 'bg-gray-900 text-white hover:bg-orange-600'}`}
              onClick={() => setIsSupportOpen(!isSupportOpen)}
            >
              <MessageCircle size={24} />
              {!isSupportOpen && (
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                  Chat with us
                </span>
              )}
            </button>
          </div>

          <SupportChat user={user} isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </CartProvider>
    </CurrencyProvider>
  );
}
