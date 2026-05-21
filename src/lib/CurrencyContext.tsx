import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export type CurrencyMode = "KES" | "USD";

interface CurrencyContextType {
  currency: CurrencyMode;
  setCurrency: (currency: CurrencyMode) => void;
  exchangeRate: number; // 1 KES = X USD
  loadingRates: boolean;
  formatPrice: (priceInKes: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyMode>(() => {
    const saved = localStorage.getItem("sokoplus_currency");
    return (saved as CurrencyMode) || "KES";
  });
  
  // 1 KES = X USD
  const [exchangeRate, setExchangeRate] = useState<number>(0.0076);
  const [loadingRates, setLoadingRates] = useState<boolean>(true);

  const setCurrency = (mode: CurrencyMode) => {
    setCurrencyState(mode);
    localStorage.setItem("sokoplus_currency", mode);
  };

  useEffect(() => {
    async function fetchRates() {
      try {
        const response = await axios.get("https://open.er-api.com/v6/latest/KES");
        if (response.data && response.data.rates && typeof response.data.rates.USD === "number") {
          const usdRate = response.data.rates.USD;
          setExchangeRate(usdRate);
          console.log("Fetched exchange rate from KES to USD:", usdRate);
        }
      } catch (err) {
        console.warn("Failed to fetch live exchange rate, using fallback rate:", err);
        setExchangeRate(0.0076); // Fallback: ~131.5 KES per USD
      } finally {
        setLoadingRates(false);
      }
    }
    fetchRates();
  }, []);

  const formatPrice = (priceInKes: number): string => {
    if (currency === "KES") {
      return `KES ${Math.round(priceInKes).toLocaleString()}`;
    } else {
      const priceInUsd = priceInKes * exchangeRate;
      return `USD ${priceInUsd.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRate, loadingRates, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
