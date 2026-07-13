import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface HomepageSettings {
  sellerStudioEnabled: boolean;
  showAudioBubble: boolean;
  showDailyDeals: boolean;
  dailyDealsSpeed: number;
  dailyDealsHours: number;
  googleMapsLink: string;
  googleMapsLinks: { name: string; url: string }[];
  updatedAt: any;
  anchorTime: number | null;
}

interface SettingsContextType {
  settings: HomepageSettings;
  loading: boolean;
}

const defaultSettings: HomepageSettings = {
  sellerStudioEnabled: true,
  showAudioBubble: true,
  showDailyDeals: true,
  dailyDealsSpeed: 30,
  dailyDealsHours: 24,
  googleMapsLink: "",
  googleMapsLinks: [],
  updatedAt: null,
  anchorTime: null,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<HomepageSettings>(defaultSettings);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const settingsRef = doc(db, "settings", "homepage");
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Parse maps links
        let mapsLinks: { name: string; url: string }[] = [];
        if (data.googleMapsLinks && Array.isArray(data.googleMapsLinks)) {
          mapsLinks = data.googleMapsLinks;
        } else if (data.googleMapsLink) {
          mapsLinks = [{ name: "Nairobi Store", url: data.googleMapsLink }];
        }

        // Parse anchorTime
        let anchor: number | null = null;
        if (data.updatedAt) {
          if (typeof data.updatedAt.toMillis === "function") {
            anchor = data.updatedAt.toMillis();
          } else if (data.updatedAt instanceof Date) {
            anchor = data.updatedAt.getTime();
          } else if (typeof data.updatedAt.seconds === "number") {
            anchor = data.updatedAt.seconds * 1000;
          } else if (typeof data.updatedAt === "string" || typeof data.updatedAt === "number") {
            anchor = new Date(data.updatedAt).getTime();
          }
        }

        setSettings({
          sellerStudioEnabled: data.sellerStudioEnabled !== undefined ? data.sellerStudioEnabled : true,
          showAudioBubble: data.showAudioBubble !== undefined ? data.showAudioBubble : true,
          showDailyDeals: data.showDailyDeals !== undefined ? data.showDailyDeals : true,
          dailyDealsSpeed: data.dailyDealsSpeed !== undefined ? data.dailyDealsSpeed : 30,
          dailyDealsHours: data.dailyDealsHours !== undefined ? data.dailyDealsHours : 24,
          googleMapsLink: data.googleMapsLink || "",
          googleMapsLinks: mapsLinks,
          updatedAt: data.updatedAt || null,
          anchorTime: anchor,
        });
      } else {
        setSettings(defaultSettings);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Failed to listen to homepage settings in parent context:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
