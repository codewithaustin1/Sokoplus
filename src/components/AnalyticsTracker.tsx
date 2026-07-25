/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGA, trackPageView } from "../lib/analytics";
import { sendHeartbeat } from "../lib/realtimeTraffic";

export default function AnalyticsTracker() {
  const location = useLocation();

  // Initialize GA on mount
  useEffect(() => {
    initGA();
  }, []);

  // Track page navigation whenever location or search query changes & trigger real-time traffic heartbeat
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    trackPageView(fullPath);
    sendHeartbeat(fullPath);

    // Periodic heartbeat every 20s to keep session active
    const interval = setInterval(() => {
      sendHeartbeat(fullPath);
    }, 20000);

    return () => clearInterval(interval);
  }, [location]);

  return null; // This component handles side-effects only and renders nothing visible
}
