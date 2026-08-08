import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
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
      orderBy("createdAt", "desc"),
      limit(20)
    );
    try {
      // Attempt to fetch data from Firestore (uses cache when offline automatically)
      const snapshot = await getDocs(bannersQuery);
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
      console.warn("[bannerCache] Fetch failed, returning empty list fallback:", error);
      cachedBannersPromise = null;
      lastFetchTime = 0;
      return [];
    }
  })();

  return cachedBannersPromise;
}

