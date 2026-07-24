import { collection, getDocsFromServer, getDocsFromCache, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface MarketingBannerData {
  id: string;
  text: string;
  backgroundColor: string;
  textColor?: string;
  startDate: string;
  endDate: string;
  active: boolean;
  actionText?: string;
  actionUrl?: string;
  closable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

let cachedBannersPromise: Promise<MarketingBannerData[]> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes cache duration

export async function fetchMarketingBanners(): Promise<MarketingBannerData[]> {
  const now = Date.now();
  
  if (cachedBannersPromise && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedBannersPromise;
  }

  lastFetchTime = now;
  cachedBannersPromise = (async () => {
    const bannersQuery = query(
      collection(db, "marketing_banners"),
      orderBy("createdAt", "desc")
    );
    try {
      // Attempt to fetch fresh data from server
      const snapshot = await getDocsFromServer(bannersQuery);
      const fetchedBanners: MarketingBannerData[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedBanners.push({
          id: docSnap.id,
          ...data,
        } as MarketingBannerData);
      });
      
      return fetchedBanners;
    } catch (error) {
      console.warn("[bannerCache] Server fetch failed, attempting local cache fallback:", error);
      try {
        const cacheSnapshot = await getDocsFromCache(bannersQuery);
        const cachedBanners: MarketingBannerData[] = [];
        cacheSnapshot.forEach((docSnap) => {
          cachedBanners.push({
            id: docSnap.id,
            ...docSnap.data(),
          } as MarketingBannerData);
        });
        if (cachedBanners.length > 0) return cachedBanners;
      } catch (cacheErr) {
        console.warn("[bannerCache] Cache fallback also failed:", cacheErr);
      }

      // Reset cache promise on complete failure
      cachedBannersPromise = null;
      lastFetchTime = 0;
      return [];
    }
  })();

  return cachedBannersPromise;
}

