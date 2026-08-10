import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
  youtube?: string;
  facebookVisible?: boolean;
  instagramVisible?: boolean;
  twitterVisible?: boolean;
  linkedinVisible?: boolean;
  tiktokVisible?: boolean;
  whatsappVisible?: boolean;
  youtubeVisible?: boolean;
}

export interface HomepageSettings {
  sellerStudioEnabled: boolean;
  showAudioBubble: boolean;
  promotionalBannersEnabled: boolean;
  googleMapsLink: string;
  googleMapsLinks: { name: string; url: string }[];
  updatedAt: any;
  anchorTime: number | null;
  brandLogoUrl?: string;
  faviconUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  gaMeasurementId?: string;
  freeShippingThreshold?: number;
  featuredCollections?: { title: string; imageUrl: string; category: string }[];
  socialLinks?: SocialLinks;
  categoryImages?: Record<string, string>;
  disabledCounties?: string[];
  disabledCities?: string[];
  disabledCountries?: string[];
}

interface SettingsContextType {
  settings: HomepageSettings;
  loading: boolean;
}

const SETTINGS_CACHE_KEY = "sokoplus_homepage_settings_cache_v1";

const defaultSettings: HomepageSettings = {
  sellerStudioEnabled: true,
  showAudioBubble: true,
  promotionalBannersEnabled: true,
  googleMapsLink: "",
  googleMapsLinks: [],
  updatedAt: null,
  anchorTime: null,
  brandLogoUrl: "",
  faviconUrl: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  gaMeasurementId: "",
  freeShippingThreshold: 15000,
  featuredCollections: [],
  categoryImages: {},
  disabledCounties: [],
  disabledCities: [],
  disabledCountries: [],
  socialLinks: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    tiktok: "",
    whatsapp: "",
    youtube: "",
    facebookVisible: true,
    instagramVisible: true,
    twitterVisible: true,
    linkedinVisible: true,
    tiktokVisible: true,
    whatsappVisible: true,
    youtubeVisible: true,
  },
};

function loadCachedSettings(): HomepageSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultSettings,
        ...parsed,
        socialLinks: {
          ...defaultSettings.socialLinks,
          ...(parsed.socialLinks || {}),
        },
      };
    }
  } catch (e) {
    console.warn("Failed to read settings from localStorage cache:", e);
  }
  return defaultSettings;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<HomepageSettings>(() => loadCachedSettings());
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

        const newSettings: HomepageSettings = {
          sellerStudioEnabled: data.sellerStudioEnabled !== undefined ? data.sellerStudioEnabled : true,
          showAudioBubble: data.showAudioBubble !== undefined ? data.showAudioBubble : true,
          promotionalBannersEnabled: data.promotionalBannersEnabled !== undefined ? data.promotionalBannersEnabled : true,
          googleMapsLink: data.googleMapsLink || "",
          googleMapsLinks: mapsLinks,
          updatedAt: data.updatedAt || null,
          anchorTime: anchor,
          brandLogoUrl: data.brandLogoUrl || "",
          faviconUrl: data.faviconUrl || "",
          seoTitle: data.seoTitle || "",
          seoDescription: data.seoDescription || "",
          seoImage: data.seoImage || "",
          gaMeasurementId: data.gaMeasurementId || "",
          freeShippingThreshold: data.freeShippingThreshold !== undefined ? Number(data.freeShippingThreshold) : 15000,
          featuredCollections: data.featuredCollections || [],
          categoryImages: data.categoryImages || {},
          disabledCounties: data.disabledCounties || [],
          disabledCities: data.disabledCities || [],
          disabledCountries: data.disabledCountries || [],
          socialLinks: data.socialLinks ? {
            facebook: data.socialLinks.facebook || "",
            instagram: data.socialLinks.instagram || "",
            twitter: data.socialLinks.twitter || "",
            linkedin: data.socialLinks.linkedin || "",
            tiktok: data.socialLinks.tiktok || "",
            whatsapp: data.socialLinks.whatsapp || "",
            youtube: data.socialLinks.youtube || "",
            facebookVisible: data.socialLinks.facebookVisible !== undefined ? data.socialLinks.facebookVisible : true,
            instagramVisible: data.socialLinks.instagramVisible !== undefined ? data.socialLinks.instagramVisible : true,
            twitterVisible: data.socialLinks.twitterVisible !== undefined ? data.socialLinks.twitterVisible : true,
            linkedinVisible: data.socialLinks.linkedinVisible !== undefined ? data.socialLinks.linkedinVisible : true,
            tiktokVisible: data.socialLinks.tiktokVisible !== undefined ? data.socialLinks.tiktokVisible : true,
            whatsappVisible: data.socialLinks.whatsappVisible !== undefined ? data.socialLinks.whatsappVisible : true,
            youtubeVisible: data.socialLinks.youtubeVisible !== undefined ? data.socialLinks.youtubeVisible : true,
          } : defaultSettings.socialLinks,
        };

        setSettings(newSettings);
        try {
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings));
        } catch (e) {
          console.warn("Failed to write homepage settings to localStorage cache:", e);
        }
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
