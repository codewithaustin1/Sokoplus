import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface HomepageSettings {
  sellerStudioEnabled: boolean;
  showAudioBubble: boolean;
  showDailyDeals: boolean;
  promotionalBannersEnabled: boolean;
  dailyDealsSpeed: number;
  dailyDealsHours: number;
  googleMapsLink: string;
  googleMapsLinks: { name: string; url: string }[];
  updatedAt: any;
  anchorTime: number | null;
  brandLogoUrl?: string;
  faviconUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  featuredCollections?: { title: string; imageUrl: string; category: string }[];
}

interface SettingsContextType {
  settings: HomepageSettings;
  loading: boolean;
}

const defaultSettings: HomepageSettings = {
  sellerStudioEnabled: true,
  showAudioBubble: true,
  showDailyDeals: true,
  promotionalBannersEnabled: true,
  dailyDealsSpeed: 30,
  dailyDealsHours: 24,
  googleMapsLink: "",
  googleMapsLinks: [],
  updatedAt: null,
  anchorTime: null,
  brandLogoUrl: "",
  faviconUrl: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  featuredCollections: [],
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
          promotionalBannersEnabled: data.promotionalBannersEnabled !== undefined ? data.promotionalBannersEnabled : true,
          dailyDealsSpeed: data.dailyDealsSpeed !== undefined ? data.dailyDealsSpeed : 30,
          dailyDealsHours: data.dailyDealsHours !== undefined ? data.dailyDealsHours : 24,
          googleMapsLink: data.googleMapsLink || "",
          googleMapsLinks: mapsLinks,
          updatedAt: data.updatedAt || null,
          anchorTime: anchor,
          brandLogoUrl: data.brandLogoUrl || "",
          faviconUrl: data.faviconUrl || "",
          seoTitle: data.seoTitle || "",
          seoDescription: data.seoDescription || "",
          seoImage: data.seoImage || "",
          featuredCollections: data.featuredCollections || [],
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

  useEffect(() => {
    if (settings.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = settings.faviconUrl;
      } else {
        const newLink = document.createElement("link");
        newLink.rel = "icon";
        newLink.href = settings.faviconUrl;
        document.head.appendChild(newLink);
      }
    }
  }, [settings.faviconUrl]);

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
