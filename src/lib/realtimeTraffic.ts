/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, auth } from "./firebase";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";

export interface ActiveVisitorSession {
  sessionId: string;
  uid?: string | null;
  displayName?: string | null;
  email?: string | null;
  path: string;
  pageTitle: string;
  lastSeen: string; // ISO string timestamp
  city: string;
  county: string;
  country: string;
  device: "Desktop" | "Mobile" | "Tablet";
  isNewVisitor: boolean;
  firstVisitedAt: string;
}

export interface PageviewLog {
  id?: string;
  sessionId: string;
  path: string;
  pageTitle: string;
  city: string;
  country: string;
  device: "Desktop" | "Mobile" | "Tablet";
  timestamp: string;
}

export function detectVisitorLocation(): { city: string; county: string; country: string } {
  if (typeof window === "undefined") return { city: "Nairobi", county: "Nairobi City", country: "Kenya" };

  const savedCity = localStorage.getItem("sokoplus_delivery_city");
  const savedCounty = localStorage.getItem("sokoplus_delivery_county");
  const savedCountry = localStorage.getItem("sokoplus_delivery_country");

  if (savedCity && savedCountry) {
    return {
      city: savedCity,
      county: savedCounty || "County Area",
      country: savedCountry,
    };
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (tz.includes("Nairobi")) {
    return { city: "Nairobi", county: "Nairobi City County", country: "Kenya" };
  } else if (tz.includes("Mombasa")) {
    return { city: "Mombasa", county: "Mombasa County", country: "Kenya" };
  } else if (tz.includes("London") || tz.includes("Europe")) {
    return { city: "London", county: "Greater London", country: "United Kingdom" };
  } else if (tz.includes("New_York") || tz.includes("America")) {
    return { city: "New York", county: "NY State", country: "United States" };
  } else if (tz.includes("Dubai")) {
    return { city: "Dubai", county: "Dubai Emirate", country: "United Arab Emirates" };
  }

  return { city: "Nairobi", county: "Nairobi City County", country: "Kenya" };
}

export function detectDeviceType(): "Desktop" | "Mobile" | "Tablet" {
  if (typeof window === "undefined") return "Desktop";
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function getOrCreateVisitorSession(): { sessionId: string; isNewVisitor: boolean; firstVisitedAt: string } {
  if (typeof window === "undefined") {
    return { sessionId: "guest_server", isNewVisitor: false, firstVisitedAt: new Date().toISOString() };
  }
  let sessionId = localStorage.getItem("sokoplus_visitor_id");
  let firstVisitedAt = localStorage.getItem("sokoplus_visitor_first_visit");
  let isNewVisitor = false;

  if (!sessionId) {
    sessionId = "vis_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem("sokoplus_visitor_id", sessionId);
    firstVisitedAt = new Date().toISOString();
    localStorage.setItem("sokoplus_visitor_first_visit", firstVisitedAt);
    isNewVisitor = true;
  }

  return { sessionId, isNewVisitor, firstVisitedAt: firstVisitedAt || new Date().toISOString() };
}

export function getHumanPageTitle(pathname: string): string {
  if (pathname === "/") return "Homepage (Main Catalog)";
  if (pathname.startsWith("/product/")) return "Product Details View";
  if (pathname === "/cart") return "Shopping Cart";
  if (pathname === "/checkout") return "Checkout & Direct Payment";
  if (pathname === "/wishlist") return "Saved Wishlist";
  if (pathname.startsWith("/admin")) return "Admin Intelligence Console";
  if (pathname === "/blog") return "Artisan Community Blog";
  if (pathname === "/careers") return "Careers & Recruitment";
  if (pathname === "/track-order") return "Order Tracking Portal";
  if (pathname === "/login") return "Customer Auth Portal";
  if (pathname === "/profile") return "Customer Profile";
  if (pathname === "/faq") return "FAQ & Help Center";
  return pathname;
}

export async function sendHeartbeat(pathname: string) {
  try {
    const { sessionId, isNewVisitor, firstVisitedAt } = getOrCreateVisitorSession();
    const locationInfo = detectVisitorLocation();
    const device = detectDeviceType();
    const pageTitle = getHumanPageTitle(pathname);

    const currentUser = auth.currentUser;

    const sessionPayload: ActiveVisitorSession = {
      sessionId,
      uid: currentUser?.uid || null,
      displayName: currentUser?.displayName || null,
      email: currentUser?.email || null,
      path: pathname,
      pageTitle,
      lastSeen: new Date().toISOString(),
      city: locationInfo.city,
      county: locationInfo.county,
      country: locationInfo.country,
      device,
      isNewVisitor,
      firstVisitedAt,
    };

    // Store in Firestore active_sessions
    const sessionRef = doc(db, "active_sessions", sessionId);
    await setDoc(sessionRef, sessionPayload, { merge: true });

    // Log pageview
    const logsRef = collection(db, "pageviews_logs");
    await addDoc(logsRef, {
      sessionId,
      path: pathname,
      pageTitle,
      city: locationInfo.city,
      country: locationInfo.country,
      device,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[RealtimeTraffic] Heartbeat send skipped (offline or quota):", err);
  }
}
