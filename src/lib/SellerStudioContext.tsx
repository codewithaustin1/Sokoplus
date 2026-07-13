import React, { createContext, useContext } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import toast from "react-hot-toast";
import { useSettings } from "./SettingsContext";

interface SellerStudioContextType {
  sellerStudioEnabled: boolean;
  toggleSellerStudio: (enabled: boolean) => Promise<void>;
  loading: boolean;
}

const SellerStudioContext = createContext<SellerStudioContextType | undefined>(undefined);

export function SellerStudioProvider({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useSettings();
  const sellerStudioEnabled = settings.sellerStudioEnabled;

  const toggleSellerStudio = async (enabled: boolean) => {
    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { sellerStudioEnabled: enabled }, { merge: true });
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
