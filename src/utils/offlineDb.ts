import { Product } from "../types";

const DB_NAME = "SokoPlusOfflineCacheDB";
const DB_VERSION = 1;
const PRODUCTS_STORE = "products";
const SETTINGS_STORE = "homepage_settings";

/**
 * Initializes and returns a connection to the local IndexedDB.
 */
export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("IndexedDB open error:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Store products indexed by ID
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
      }
      
      // Store settings or generic configs
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
  });
}

/**
 * Saves fetched products array into the IndexedDB product store.
 */
export async function saveProductsToCache(products: Product[]): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(PRODUCTS_STORE, "readwrite");
    const store = tx.objectStore(PRODUCTS_STORE);
    
    // Clear old elements to align with active listings
    store.clear();
    
    products.forEach((p) => {
      store.put(p);
    });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save products to IndexedDB:", err);
  }
}

/**
 * Retrieves cached products array from IndexedDB.
 */
export async function getCachedProducts(): Promise<Product[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(PRODUCTS_STORE, "readonly");
    const store = tx.objectStore(PRODUCTS_STORE);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to query cached products from IndexedDB:", err);
    return [];
  }
}

/**
 * Saves specific key-value homepage configurations.
 */
export async function saveHomepageSettings(key: string, data: any): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    const store = tx.objectStore(SETTINGS_STORE);
    
    store.put({ key, ...data });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to store homepage settings:", err);
  }
}

/**
 * Returns stored homepage configurations by key.
 */
export async function getHomepageSettings(key: string): Promise<any | null> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to query homepage settings:", err);
    return null;
  }
}

/**
 * Clears all cached products and settings from IndexedDB.
 */
export async function clearAllOfflineCache(): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction([PRODUCTS_STORE, SETTINGS_STORE], "readwrite");
    tx.objectStore(PRODUCTS_STORE).clear();
    tx.objectStore(SETTINGS_STORE).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to clear IndexedDB offline store:", err);
  }
}
