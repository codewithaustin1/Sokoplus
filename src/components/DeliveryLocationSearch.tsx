import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2, X, Navigation } from "lucide-react";
import axios from "axios";

export interface OpenMapLocation {
  place_id?: number | string;
  display_name: string;
  lat: string | number;
  lon: string | number;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    village?: string;
    quarter?: string;
    commercial?: string;
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
  name?: string;
}

export interface SelectedLocationData {
  displayName: string;
  shortAddress: string;
  lat: number;
  lng: number;
  city: string;
  county: string;
  country: string;
  street: string;
  raw?: OpenMapLocation;
}

interface DeliveryLocationSearchProps {
  onSelectLocation: (location: SelectedLocationData) => void;
  placeholder?: string;
  initialValue?: string;
  countryHint?: string;
  darkTheme?: boolean;
  className?: string;
  inputClassName?: string;
  showLocateMe?: boolean;
}

export default function DeliveryLocationSearch({
  onSelectLocation,
  placeholder = "Search delivery location (e.g., Westlands, Nairobi)...",
  initialValue = "",
  countryHint = "",
  darkTheme = false,
  className = "",
  inputClassName = "",
  showLocateMe = false,
}: DeliveryLocationSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<OpenMapLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep query in sync with initialValue prop when it changes externally
  useEffect(() => {
    setQuery(initialValue || "");
  }, [initialValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch OpenMaps suggestions as the user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // First try server proxy
        let fetchedItems: OpenMapLocation[] = [];
        try {
          const res = await axios.get("/api/openmaps/search", {
            params: { q: val, country: countryHint, limit: 6 },
          });
          if (res.data && Array.isArray(res.data.suggestions)) {
            fetchedItems = res.data.suggestions;
          }
        } catch {
          // Direct OpenStreetMap Nominatim fallback
          const directUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
            val + (countryHint && !val.toLowerCase().includes(countryHint.toLowerCase()) ? `, ${countryHint}` : "")
          )}`;
          const response = await fetch(directUrl, {
            headers: { "User-Agent": "SokoPlus-Delivery-Applet/1.0" },
          });
          if (response.ok) {
            fetchedItems = await response.json();
          }
        }

        setSuggestions(fetchedItems);
        setIsOpen(fetchedItems.length > 0);
      } catch (err) {
        console.warn("[DeliveryLocationSearch] OpenMaps query notice:", err);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleLocateMe = (isAuto = false) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "User-Agent": "SokoPlus-Kenya-Delivery-Applet" } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              const addr = data.address || {};
              const localPlace = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.commercial || addr.road || "";
              const cityTown = addr.city || addr.town || addr.municipality || "Nairobi";
              const countyRegion = addr.county || "Nairobi";
              const cleanAddress = localPlace ? `${localPlace}, ${cityTown}` : data.display_name.split(",").slice(0, 2).join(",");

              setQuery(cleanAddress);
              onSelectLocation({
                displayName: data.display_name,
                shortAddress: cleanAddress,
                lat: latitude,
                lng: longitude,
                city: cityTown,
                county: countyRegion,
                country: addr.country || "Kenya",
                street: localPlace || cleanAddress,
                raw: data,
              });
            }
          }
        } catch (err) {
          console.warn("Locate me reverse geocode warning:", err);
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        console.warn("Locate me geolocation warning:", err);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
      let statusObj: PermissionStatus | null = null;
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          statusObj = status;
          if (status.state === "granted") {
            handleLocateMe(true);
          }
          status.onchange = () => {
            if (status.state === "granted") {
              handleLocateMe(true);
            }
          };
        })
        .catch(() => {});

      return () => {
        if (statusObj) {
          statusObj.onchange = null;
        }
      };
    }
  }, [showLocateMe]);

  const handleSelect = (item: OpenMapLocation) => {
    const addr = item.address || {};
    const lat = typeof item.lat === "number" ? item.lat : parseFloat(item.lat);
    const lng = typeof item.lon === "number" ? item.lon : parseFloat(item.lon);

    // Extract town/city
    const city = addr.city || addr.town || addr.municipality || addr.suburb || "Nairobi";
    // Extract county/region
    const county = addr.county || addr.state || "Nairobi City County";
    // Extract country
    const country = addr.country || "Kenya";
    // Extract street/neighborhood
    const street =
      item.name ||
      addr.road ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.village ||
      addr.commercial ||
      item.display_name.split(",")[0];

    // Build concise short address
    const shortAddress = street
      ? `${street}${city && city !== street ? `, ${city}` : ""}`
      : item.display_name.split(",").slice(0, 2).join(",");

    setQuery(shortAddress);
    setIsOpen(false);

    onSelectLocation({
      displayName: item.display_name,
      shortAddress,
      lat,
      lng,
      city,
      county,
      country,
      street,
      raw: item,
    });
  };

  const clearInput = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center">
        <Search
          size={16}
          className={`absolute left-3.5 pointer-events-none transition-colors ${
            darkTheme ? "text-gray-400" : "text-gray-400"
          }`}
        />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full pl-10 pr-9 py-2.5 text-xs font-semibold rounded-xl transition-all focus:outline-none ${
            darkTheme
              ? "bg-[#2a2a2a] border border-gray-700 text-white placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              : "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          } ${inputClassName}`}
        />

        <div className="absolute right-3 flex items-center gap-1">
          {isLoading && <Loader2 size={14} className="animate-spin text-orange-500" />}
          {!isLoading && query && (
            <button
              type="button"
              onClick={clearInput}
              className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-[120] max-h-64 overflow-y-auto rounded-xl shadow-2xl border text-xs divide-y transition-all ${
            darkTheme
              ? "bg-[#242424] border-gray-700 divide-gray-800 text-white"
              : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 divide-gray-100 dark:divide-gray-800 text-gray-900 dark:text-white"
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin size={11} /> OpenMaps Suggestions
            </span>
          </div>

          {suggestions.map((item, idx) => {
            const primaryName =
              item.name || item.display_name.split(",")[0] || "Location";
            const secondaryAddress = item.display_name
              .split(",")
              .slice(1)
              .join(",")
              .trim();

            return (
              <button
                key={item.place_id || idx}
                type="button"
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                  darkTheme
                    ? "hover:bg-gray-800 hover:text-white"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate leading-tight">
                    {primaryName}
                  </div>
                  {secondaryAddress && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-400 truncate mt-0.5">
                      {secondaryAddress}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
