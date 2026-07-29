import { collection, query, where, getDocs, writeBatch, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

const GUEST_TOKEN_KEY = "sokoplus_guest_session_token";
const GUEST_ADDRESS_KEY = "sokoplus_guest_address_draft";

/**
 * Returns an existing guest session token or creates a new unique one.
 */
export function getOrCreateGuestSessionToken(): string {
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (!token) {
    token = `sokoplus_guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

/**
 * Persists guest address details temporarily in localStorage so refresh/return doesn't lose inputs.
 */
export function saveGuestAddressDraft(address: any): void {
  try {
    localStorage.setItem(GUEST_ADDRESS_KEY, JSON.stringify(address));
  } catch (e) {
    console.error("Failed to save guest address draft", e);
  }
}

/**
 * Retrieves saved guest address draft if present.
 */
export function getGuestAddressDraft(): any | null {
  try {
    const data = localStorage.getItem(GUEST_ADDRESS_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Claims all guest orders associated with a user's email or guest session token,
 * converting them to full user orders and attributing loyalty points to the user document.
 */
export async function claimGuestOrdersForUser(userId: string, userEmail: string): Promise<{ claimedCount: number; pointsClaimed: number }> {
  if (!userId || !userEmail) return { claimedCount: 0, pointsClaimed: 0 };

  try {
    const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
    const ordersRef = collection(db, "orders");

    // Search by email or guest session token
    const emailQuery = query(ordersRef, where("userEmail", "==", userEmail.toLowerCase().trim()), where("userId", "==", "guest"));
    const emailSnap = await getDocs(emailQuery);

    let tokenSnapDocs: any[] = [];
    if (guestToken) {
      const tokenQuery = query(ordersRef, where("guestSessionToken", "==", guestToken), where("userId", "==", "guest"));
      const tokenSnap = await getDocs(tokenQuery);
      tokenSnapDocs = tokenSnap.docs;
    }

    // Deduplicate docs found by email or token
    const map = new Map<string, any>();
    emailSnap.docs.forEach((doc) => map.set(doc.id, doc));
    tokenSnapDocs.forEach((doc) => map.set(doc.id, doc));

    if (map.size === 0) {
      return { claimedCount: 0, pointsClaimed: 0 };
    }

    const batch = writeBatch(db);
    let totalPoints = 0;

    map.forEach((orderDoc, orderId) => {
      const data = orderDoc.data();
      const orderPoints = Math.floor((data.totalAmount || 0) / 100);
      totalPoints += orderPoints;

      batch.update(doc(db, "orders", orderId), {
        userId: userId,
        isGuestOrder: false,
        claimedAt: new Date().toISOString()
      });
    });

    // Award loyalty points to the user profile
    if (totalPoints > 0) {
      const userRef = doc(db, "users", userId);
      batch.update(userRef, {
        loyaltyPoints: increment(totalPoints)
      });
    }

    await batch.commit();
    console.log(`[Guest Conversion] Successfully converted ${map.size} guest orders for user ${userId}. Awarded ${totalPoints} XP.`);
    return { claimedCount: map.size, pointsClaimed: totalPoints };
  } catch (error) {
    console.error("Error claiming guest orders:", error);
    return { claimedCount: 0, pointsClaimed: 0 };
  }
}
