import { collection, getDocsFromServer, query, orderBy } from "firebase/firestore";
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
    try {
      const bannersQuery = query(
        collection(db, "marketing_banners"),
        orderBy("createdAt", "desc")
      );
      // Use getDocsFromServer to bypass the local persistent cache and ensure fresh data
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
      // Clear cache on failure so next attempt retries
      cachedBannersPromise = null;
      lastFetchTime = 0;
      throw error;
    }
  })();

  return cachedBannersPromise;
}
