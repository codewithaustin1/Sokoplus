import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

export type CurrencyMode = "KES" | "USD";

interface CurrencyContextType {
  currency: CurrencyMode;
  setCurrency: (currency: CurrencyMode) => void;
  exchangeRate: number; // 1 KES = X USD
  loadingRates: boolean;
  formatPrice: (priceInKes: number) => string;
  refreshExchangeRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CACHE_KEY = "sokoplus_exchange_rate_cache";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours cache duration
const DEFAULT_KES_TO_USD = 0.0076; // Fallback ~131.5 KES per USD

interface ExchangeRateCache {
  rate: number;
  timestamp: number;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyMode>(() => {
    const saved = localStorage.getItem("sokoplus_currency");
    return (saved as CurrencyMode) || "KES";
  });

  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached: ExchangeRateCache = JSON.parse(cachedStr);
        if (cached && typeof cached.rate === "number" && cached.rate > 0) {
          return cached.rate;
        }
      }
    } catch (e) {
      // Ignore cache parse error
    }
    return DEFAULT_KES_TO_USD;
  });

  const [loadingRates, setLoadingRates] = useState<boolean>(false);

  const setCurrency = useCallback((mode: CurrencyMode) => {
    setCurrencyState(mode);
    localStorage.setItem("sokoplus_currency", mode);
  }, []);

  const fetchRates = useCallback(async (force: boolean = false) => {
    // Check if cached rate is valid and within TTL window
    if (!force) {
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached: ExchangeRateCache = JSON.parse(cachedStr);
          const age = Date.now() - cached.timestamp;
          if (cached && typeof cached.rate === "number" && cached.rate > 0 && age < CACHE_TTL_MS) {
            setExchangeRate(cached.rate);
            setLoadingRates(false);
            return;
          }
        }
      } catch (e) {
        // Fallthrough to fetch live rates
      }
    }

    setLoadingRates(true);
    try {
      const response = await axios.get("https://open.er-api.com/v6/latest/KES", {
        timeout: 5000,
      });
      if (response.data && response.data.rates && typeof response.data.rates.USD === "number") {
        const usdRate = response.data.rates.USD;
        setExchangeRate(usdRate);
        const cacheData: ExchangeRateCache = {
          rate: usdRate,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (err) {
      console.warn("Failed to fetch live exchange rate, using cached/fallback rate:", err);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    fetchRates(false);
  }, [fetchRates]);

  const formatPrice = useCallback(
    (priceInKes: number): string => {
      if (currency === "KES") {
        return `KES ${Math.round(priceInKes).toLocaleString()}`;
      } else {
        const priceInUsd = priceInKes * exchangeRate;
        return `USD ${priceInUsd.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
    },
    [currency, exchangeRate]
  );

  const contextValue = useMemo(
    () => ({
      currency,
      setCurrency,
      exchangeRate,
      loadingRates,
      formatPrice,
      refreshExchangeRates: async () => {
        await fetchRates(true);
      },
    }),
    [currency, setCurrency, exchangeRate, loadingRates, formatPrice, fetchRates]
  );

  return <CurrencyContext.Provider value={contextValue}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

