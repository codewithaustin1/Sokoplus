import React, { createContext, useContext, useState, useEffect } from "react";
import { CartItem } from "../types";

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, customizations?: CartItem["customizations"]) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("sokoplus_cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("sokoplus_cart", JSON.stringify(items));
  }, [items]);

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
