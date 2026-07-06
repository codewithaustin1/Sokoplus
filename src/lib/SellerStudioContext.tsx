import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import toast from "react-hot-toast";

interface SellerStudioContextType {
  sellerStudioEnabled: boolean;
  toggleSellerStudio: (enabled: boolean) => Promise<void>;
  loading: boolean;
}

const SellerStudioContext = createContext<SellerStudioContextType | undefined>(undefined);

export function SellerStudioProvider({ children }: { children: React.ReactNode }) {
  const [sellerStudioEnabled, setSellerStudioEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const settingsRef = doc(db, "settings", "homepage");
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.sellerStudioEnabled !== undefined) {
          setSellerStudioEnabled(data.sellerStudioEnabled);
        } else {
          setSellerStudioEnabled(true);
        }
      } else {
        setSellerStudioEnabled(true);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Failed to listen to seller studio settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleSellerStudio = async (enabled: boolean) => {
    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { sellerStudioEnabled: enabled }, { merge: true });
      setSellerStudioEnabled(enabled);
      toast.success(`Seller Studio feature toggled ${enabled ? "ON" : "OFF"}`);
    } catch (error) {
      console.error("Failed to toggle Seller Studio: ", error);
      toast.error("Failed to update Seller Studio toggle.");
    }
  };

  return (
    <SellerStudioContext.Provider value={{ sellerStudioEnabled, toggleSellerStudio, loading }}>
      {children}
    </SellerStudioContext.Provider>
  );
}

export function useSellerStudio() {
  const context = useContext(SellerStudioContext);
  if (context === undefined) {
    throw new Error("useSellerStudio must be used within a SellerStudioProvider");
  }
  return context;
}
