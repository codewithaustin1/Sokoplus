import { Product } from "../types";
import toast from "react-hot-toast";

const COMPARE_STORAGE_KEY = "sokoplus_compare_items";

/**
 * Gets the current list of products selected for comparison.
 */
export function getCompareList(): Product[] {
  try {
    const json = localStorage.getItem(COMPARE_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to parse comparison items", error);
    return [];
  }
}

/**
 * Adds a product to the comparison list. Limit to max 3 items.
 */
export function addToCompare(product: Product): boolean {
  const current = getCompareList();
  
  if (current.some((item) => item.id === product.id)) {
    toast.error(`${product.name} is already in the comparison list.`);
    return false;
  }
  
  if (current.length >= 3) {
    toast.error("You can compare up to 3 items at a time. Remove an item to add this one!");
    return false;
  }
  
  const updated = [...current, product];
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
  toast.success(`Added ${product.name} to comparison.`);
  
  // Dispatch a custom event to notify listeners
  window.dispatchEvent(new Event("sokoplus_compare_changed"));
  return true;
}

/**
 * Removes a product from the comparison list.
 */
export function removeFromCompare(productId: string): void {
  const current = getCompareList();
  const updated = current.filter((item) => item.id !== productId);
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
  toast.success("Removed from comparison.");
  
  // Dispatch a custom event to notify listeners
  window.dispatchEvent(new Event("sokoplus_compare_changed"));
}

/**
 * Checks if a product is in the comparison list.
 */
export function isInCompareList(productId: string): boolean {
  const current = getCompareList();
  return current.some((item) => item.id === productId);
}

/**
 * Clears the calculation/comparison list.
 */
export function clearCompareList(): void {
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([]));
  
  // Dispatch a custom event to notify listeners
  window.dispatchEvent(new Event("sokoplus_compare_changed"));
}
