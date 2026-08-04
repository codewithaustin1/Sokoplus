/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

let GA_MEASUREMENT_ID: string | undefined = (import.meta as any).env?.VITE_GA_MEASUREMENT_ID;

export function setGAMeasurementId(id: string) {
  if (id && id.trim()) {
    GA_MEASUREMENT_ID = id.trim();
  }
}

export function getGAMeasurementId(): string {
  return GA_MEASUREMENT_ID || "G-MEASURE-ID";
}

/**
 * Initializes the Google Analytics script tag and defines window.gtag
 */
export function initGA(force = false, customId?: string) {
  if (typeof window === "undefined") return;
  if (customId && customId.trim()) {
    GA_MEASUREMENT_ID = customId.trim();
  }

  const activeId = GA_MEASUREMENT_ID || "G-MEASURE-ID";

  if (activeId === "G-MEASURE-ID" || !activeId.startsWith("G-")) {
    console.warn("[Google Analytics] Notice: Google Analytics is currently using a placeholder ID ('G-MEASURE-ID'). Please configure your Google Analytics Measurement ID (G-XXXXXXXXXX) in the SokoPlus Admin Panel or set VITE_GA_MEASUREMENT_ID in your environment variables to enable real-time tracking.");
  }

  // Track if consent actually exists; if not forced or accepted, defer loading GA
  const consent = localStorage.getItem("sokoplus_cookie_consent");
  if (!force && consent !== "accepted") {
    console.log("[Google Analytics] Deferring initialization: no explicit cookie consent granted yet.");
    return;
  }

  // Prevent multiple initializations with the exact same script tag
  if (document.getElementById("ga-gtag-script")) return;

  try {
    const scriptNode = document.createElement("script");
    scriptNode.id = "ga-gtag-script";
    scriptNode.async = true;
    scriptNode.src = `https://www.googletagmanager.com/gtag/js?id=${activeId}`;
    document.head.appendChild(scriptNode);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", activeId, {
      send_page_view: false, // Turn off automatic page views to support custom single page transitions
    });
    
    console.log(`[Google Analytics] Initialized with Measurement ID: ${activeId}`);
  } catch (error) {
    console.error("[Google Analytics] Initialization failed:", error);
  }
}

/**
 * Tracks standard pageview with GA
 * @param path The relative URL path
 * @param title Custom document/page title
 */
export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined" || !window.gtag || !GA_MEASUREMENT_ID) return;
  
  try {
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: title || document.title,
    });
    console.log(`[Google Analytics] Page View tracked: ${path}`);
  } catch (error) {
    console.error("[Google Analytics] Page tracking error:", error);
  }
}

/**
 * Tracks custom and standard GA e-commerce events
 * @param eventName Name of the event e.g., 'select_item', 'add_to_cart', 'purchase'
 * @param params Custom event parameters
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || !window.gtag) return;

  try {
    window.gtag("event", eventName, params);
    console.log(`[Google Analytics] Event tracked: ${eventName}`, params);
  } catch (error) {
    console.error(`[Google Analytics] Event tracking error for ${eventName}:`, error);
  }
}
