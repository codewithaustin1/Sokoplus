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
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Admin from "./pages/Admin";
import Blog from "./pages/Blog";
import Login from "./pages/Login";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { UserProfile } from "./types";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
        setUser({
          uid: fbUser.uid,
          email: fbUser.email || "",
          displayName: fbUser.displayName || "User",
          loyaltyPoints: 0,
          isAdmin: adminDoc.exists()
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-sans">Loading Soplus...</div>;

  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-gray-900 selection:bg-orange-100">
          <Navbar user={user} />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout user={user} />} />
              <Route path="/admin/*" element={<Admin user={user} />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
          <Footer />
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </CartProvider>
  );
}
