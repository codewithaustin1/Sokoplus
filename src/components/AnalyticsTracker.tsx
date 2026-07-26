/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGA, trackPageView } from "../lib/analytics";

export default function AnalyticsTracker() {
  const location = useLocation();

  // Initialize GA on mount
  useEffect(() => {
    initGA();
  }, []);

  // Track page navigation whenever location or search query changes
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    trackPageView(fullPath);
  }, [location]);

  return null; // This component handles side-effects only and renders nothing visible
}
