import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { CartItem } from "../types";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, customizations?: CartItem["customizations"]) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper to clean undefined fields before saving to Firestore to prevent crashes
function sanitizeData(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData);
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          clean[key] = sanitizeData(value);
        }
      }
    }
    return clean;
  }
  return obj;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("sokoplus_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const skipSyncRef = useRef(false);

  // Sync to local storage and update Firestore
  useEffect(() => {
    localStorage.setItem("sokoplus_cart", JSON.stringify(items));
    
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    
    const user = auth.currentUser;
    if (user) {
      const cartRef = doc(db, "carts", user.uid);
      const rawData = {
        userId: user.uid,
        email: user.email || null,
        items: items,
        isAbandonedEmailSent: false,
        updatedAt: new Date().toISOString()
      };
      setDoc(cartRef, sanitizeData(rawData), { merge: true }).catch((err) => {
        console.warn("Firestore cart auto-sync failed:", err);
      });
    }
  }, [items]);

  // Fetch Firestore cart on user authentication changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const cartRef = doc(db, "carts", user.uid);
          const snap = await getDoc(cartRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.items) && data.items.length > 0) {
              skipSyncRef.current = true;
              setItems(data.items);
            } else if (items.length > 0) {
              // Upload local items to cloud if cloud is empty
              const rawData = {
                userId: user.uid,
                email: user.email || null,
                items: items,
                isAbandonedEmailSent: false,
                updatedAt: new Date().toISOString()
              };
              await setDoc(cartRef, sanitizeData(rawData), { merge: true });
            }
          } else if (items.length > 0) {
            // Create cloud cart from local items
            const rawData = {
              userId: user.uid,
              email: user.email || null,
              items: items,
              isAbandonedEmailSent: false,
              updatedAt: new Date().toISOString()
            };
            await setDoc(cartRef, sanitizeData(rawData));
          }
        } catch (err) {
          console.warn("Could not sync cloud cart on authenticator change:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const addToCart = (newItem: CartItem) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => {
        if (i.productId !== newItem.productId) return false;
        // Check customizations compatibility
        const c1 = i.customizations;
        const c2 = newItem.customizations;
        if (!c1 && !c2) return true;
        if (c1 && c2 && c1.material === c2.material && c1.color === c2.color) return true;
        return false;
      });
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + newItem.quantity } : item
        );
      }
      return [...prev, newItem];
    });
  };

  const removeFromCart = (productId: string, customizations?: CartItem["customizations"]) => {
    setItems((prev) => prev.filter((i) => {
      if (i.productId !== productId) return true;
      // If we are filtering this product out, differentiate by customization
      const c1 = i.customizations;
      const c2 = customizations;
      if (!c1 && !c2) return false;
      if (c1 && c2 && c1.material === c2.material && c1.color === c2.color) return false;
      return true;
    }));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
