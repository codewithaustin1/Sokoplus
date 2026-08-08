import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface SkuValidationResult {
  isValid: boolean;
  error?: string;
  normalizedSku: string;
}

/**
 * Validates the format of a product SKU.
 * Format Rules:
 * - Length: 3 to 20 characters
 * - Characters: Uppercase letters, numbers, hyphens (-), and underscores (_)
 * - No spaces or special characters
 */
export function validateSkuFormat(sku: string): SkuValidationResult {
  if (!sku || !sku.trim()) {
    return {
      isValid: false,
      error: "SKU is required",
      normalizedSku: "",
    };
  }

  const normalizedSku = sku.trim().toUpperCase();

  if (normalizedSku.length < 3 || normalizedSku.length > 20) {
    return {
      isValid: false,
      error: "SKU must be between 3 and 20 characters in length",
      normalizedSku,
    };
  }

  const skuRegex = /^[A-Z0-9\-_]+$/;
  if (!skuRegex.test(normalizedSku)) {
    return {
      isValid: false,
      error: "SKU can only contain uppercase letters, numbers, hyphens (-), and underscores (_)",
      normalizedSku,
    };
  }

  return {
    isValid: true,
    normalizedSku,
  };
}

/**
 * Checks if a SKU is unique across all products in Firestore.
 * Ignores currentProductId when editing an existing product.
 */
export async function validateSkuUniqueness(
  sku: string,
  currentProductId?: string
): Promise<{ isUnique: boolean; error?: string; normalizedSku: string }> {
  const formatCheck = validateSkuFormat(sku);
  if (!formatCheck.isValid) {
    return {
      isUnique: false,
      error: formatCheck.error,
      normalizedSku: formatCheck.normalizedSku,
    };
  }

  const normalized = formatCheck.normalizedSku;

  try {
    const q = query(collection(db, "products"), where("sku", "==", normalized), limit(10));
    const snapshot = await getDocs(q);

    const duplicate = snapshot.docs.find((docSnap) => docSnap.id !== currentProductId);

    if (duplicate) {
      return {
        isUnique: false,
        error: `SKU "${normalized}" is already assigned to product "${duplicate.data().name || 'Existing Item'}". SKUs must be unique.`,
        normalizedSku: normalized,
      };
    }

    return {
      isUnique: true,
      normalizedSku: normalized,
    };
  } catch (err) {
    console.warn("Notice checking SKU uniqueness in Firestore:", err);
    // Return true with format validation if query fails (offline or permission fallback)
    return {
      isUnique: true,
      normalizedSku: normalized,
    };
  }
}

/**
 * Automatically generates a standardized, unique-formatted SKU suggestion
 * based on category prefix and name or random suffix.
 * Example: SOKO-FAS-8492
 */
export function generateSuggestedSku(category: string = "GEN", name: string = ""): string {
  const cleanCat = category.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() || "GEN";
  const cleanName = name.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
  const randomCode = Math.floor(1000 + Math.random() * 9000); // 4-digit code

  if (cleanName) {
    return `SOKO-${cleanCat}-${cleanName}-${randomCode}`;
  }
  return `SOKO-${cleanCat}-${randomCode}`;
}
