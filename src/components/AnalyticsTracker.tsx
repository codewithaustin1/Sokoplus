/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGA, trackPageView } from "../lib/analytics";
import { useSettings } from "../lib/SettingsContext";

export default function AnalyticsTracker() {
  const location = useLocation();
  const { settings } = useSettings();

  // Initialize GA on mount or when gaMeasurementId updates from admin settings
  useEffect(() => {
    initGA(false, settings?.gaMeasurementId);
  }, [settings?.gaMeasurementId]);

  // Track page navigation whenever location or search query changes
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    trackPageView(fullPath);
  }, [location]);

  return null; // This component handles side-effects only and renders nothing visible
}
