import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Compass, Search, AlertCircle, CheckCircle } from "lucide-react";

// Inline pin SVG to avoid broken default asset URLs in bundlers
const PIN_SVG = `
<svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#ea580c" stroke="#ffffff" stroke-width="1.5"/>
</svg>
`;

interface FreeDeliveryMapProps {
  county: string;
  city: string;
  onChange: (lat: number, lng: number, addressText?: string) => void;
}

interface LocationCoords {
  lat: number;
  lng: number;
  zoom: number;
}

const COUNTY_COORDINATES: { [key: string]: LocationCoords } = {
  "Nairobi City County": { lat: -1.2921, lng: 36.8219, zoom: 11 },
  "Mombasa County": { lat: -4.0435, lng: 39.6682, zoom: 12 },
  "Kiambu County": { lat: -1.1477, lng: 36.9535, zoom: 11 },
  "Nakuru County": { lat: -0.3031, lng: 36.0800, zoom: 11 },
  "Kisumu County": { lat: -0.1022, lng: 34.7617, zoom: 12 },
  "Uasin Gishu County": { lat: 0.5143, lng: 35.2698, zoom: 12 },
  "Kajiado County": { lat: -1.8517, lng: 36.7869, zoom: 10 },
  "Machakos County": { lat: -1.5177, lng: 37.2634, zoom: 11 },
  "Kilifi County": { lat: -3.6307, lng: 39.8499, zoom: 10 },
  "Meru County": { lat: 0.0515, lng: 37.6456, zoom: 11 },
  "Nyeri County": { lat: -0.4201, lng: 36.9476, zoom: 11 },
  "Murang'a County": { lat: -0.7210, lng: 37.1500, zoom: 11 },
  "Trans Nzoia County": { lat: 1.0182, lng: 35.0020, zoom: 11 },
  "Nandi County": { lat: 0.1833, lng: 35.1000, zoom: 11 },
  "Narok County": { lat: -1.0784, lng: 35.8601, zoom: 10 },
  "Kericho County": { lat: -0.3689, lng: 35.2863, zoom: 11 },
  "Kakamega County": { lat: 0.2827, lng: 34.7519, zoom: 11 },
  "Bungoma County": { lat: 0.5635, lng: 34.5606, zoom: 11 },
  "Kisii County": { lat: -0.6817, lng: 34.7796, zoom: 11 },
};

const CITY_COORDINATES: { [key: string]: LocationCoords } = {
  // Nairobi regions
  "Nairobi CBD": { lat: -1.2863, lng: 36.8222, zoom: 15 },
  "Karen": { lat: -1.3201, lng: 36.7050, zoom: 14 },
  "Muthaiga": { lat: -1.2543, lng: 36.8294, zoom: 14 },
  "Runda": { lat: -1.2131, lng: 36.8049, zoom: 14 },
  "Gigiri": { lat: -1.2323, lng: 36.8068, zoom: 14 },
  "Westlands": { lat: -1.2644, lng: 36.8044, zoom: 15 },
  "Lavington": { lat: -1.2774, lng: 36.7725, zoom: 14 },
  "Kilimani": { lat: -1.2908, lng: 36.7828, zoom: 14 },
  "Kileleshwa": { lat: -1.2796, lng: 36.7890, zoom: 14 },
  "Parklands": { lat: -1.2606, lng: 36.8184, zoom: 14 },
  "South C": { lat: -1.3213, lng: 36.8288, zoom: 14 },
  "Mombasa City (CBD/Island)": { lat: -4.0547, lng: 39.6636, zoom: 15 },
  "Mtwapa": { lat: -3.9431, lng: 39.7525, zoom: 14 },
  "Changamwe": { lat: -4.0191, lng: 39.6191, zoom: 14 },
  "Likoni": { lat: -4.0933, lng: 39.6582, zoom: 14 },
  "Eldoret City": { lat: 0.5143, lng: 35.2698, zoom: 14 },
  "Nakuru City": { lat: -0.3031, lng: 36.0800, zoom: 14 },
  "Naivasha": { lat: -0.7171, lng: 36.4310, zoom: 14 },
  "Kisumu City": { lat: -0.1022, lng: 34.7617, zoom: 14 },
  "Machakos Town": { lat: -1.5177, lng: 37.2634, zoom: 14 },
  "Mlolongo": { lat: -1.3917, lng: 36.9242, zoom: 14 },
};

export default function FreeDeliveryMap({ county, city, onChange }: FreeDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [geocodingError, setGeocodingError] = useState<string>("");
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Get default coordinates based on city and county
    const targetCoords = CITY_COORDINATES[city] || COUNTY_COORDINATES[county] || { lat: -1.2921, lng: 36.8219, zoom: 10 };

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: [targetCoords.lat, targetCoords.lng],
      zoom: targetCoords.zoom,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Add Free OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Create Custom Pin Icon
    const customIcon = L.divIcon({
      html: PIN_SVG,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38],
      className: "custom-delivery-pin-icon",
    });

    // Create draggable marker
    const marker = L.marker([targetCoords.lat, targetCoords.lng], {
      icon: customIcon,
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;
    setSelectedCoords({ lat: targetCoords.lat, lng: targetCoords.lng });

    // Handle marker drag
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      setSelectedCoords({ lat: position.lat, lng: position.lng });
    });

    // Handle map click
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      setSelectedCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Clean up
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Map when county/city changes in standard form inputs
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    const targetCoords = CITY_COORDINATES[city] || COUNTY_COORDINATES[county];
    if (targetCoords) {
      mapInstanceRef.current.setView([targetCoords.lat, targetCoords.lng], targetCoords.zoom, {
        animate: true,
        duration: 0.8,
      });
      markerRef.current.setLatLng([targetCoords.lat, targetCoords.lng]);
      setSelectedCoords({ lat: targetCoords.lat, lng: targetCoords.lng });
    }
  }, [county, city]);

  // Reverse Geocoding with OSM Nominatim API (with debounce to follow usage guidelines)
  useEffect(() => {
    if (!selectedCoords) return;

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    setLoading(true);
    setGeocodingError("");

    geocodeTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${selectedCoords.lat}&lon=${selectedCoords.lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              "User-Agent": "SokoPlus-Kenya-Delivery-Applet",
            },
          }
        );

        if (!res.ok) throw new Error("Nominatim response error");
        const data = await res.json();

        if (data && data.display_name) {
          // Parse a cleaner, shorter description from address details to populate the input
          const addr = data.address || {};
          const localPlace = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.commercial || addr.road || "";
          const cityTown = addr.city || addr.town || addr.municipality || "";
          const countyRegion = addr.county || "";
          
          let cleanAddress = data.display_name;
          if (localPlace) {
            cleanAddress = `${localPlace}${cityTown ? `, ${cityTown}` : ""}`;
          }

          setResolvedAddress(data.display_name);
          onChange(selectedCoords.lat, selectedCoords.lng, cleanAddress);
        } else {
          onChange(selectedCoords.lat, selectedCoords.lng);
        }
      } catch (err) {
        console.error("Geocoding failed:", err);
        setGeocodingError("Failed to lookup address details. Map pin coordinates remain active.");
        onChange(selectedCoords.lat, selectedCoords.lng);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, [selectedCoords]);

  // Geolocation trigger
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16, {
            animate: true,
            duration: 1,
          });
          markerRef.current.setLatLng([latitude, longitude]);
          setSelectedCoords({ lat: latitude, lng: longitude });
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Geolocation warning:", err);
        alert("Could not access your physical location. Please select it manually on the map.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            📍 Exact Delivery Pin-drop
          </label>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            Tap or drag the marker to your precise apartment/building location. 100% Free OpenStreetMap.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLocateMe}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/70 border border-orange-200/50 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-black transition-all shadow-sm"
        >
          <Compass className="w-3.5 h-3.5 animate-spin-slow" />
          <span>Locate Me</span>
        </button>
      </div>

      <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-gray-150 dark:border-gray-800 shadow-sm bg-gray-100 dark:bg-gray-950">
        {/* Leaflet target container */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Loading / geocoding overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 z-20 flex items-center justify-center pointer-events-none transition-all">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-100 dark:border-gray-800/80">
              <span className="w-2.5 h-2.5 bg-orange-600 rounded-full animate-ping" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Resolving location details...</span>
            </div>
          </div>
        )}
      </div>

      {/* Address feedback bar */}
      <div className="bg-gray-50 dark:bg-gray-950/40 border border-gray-150 dark:border-gray-850 p-3.5 rounded-2xl flex items-start gap-2.5">
        <MapPin className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
        <div className="space-y-1 w-full text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-gray-400 uppercase text-[9px] tracking-wider">
              RESOLVED POSITION
            </span>
            {selectedCoords && (
              <span className="font-mono text-[9px] text-gray-400 font-extrabold bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded-md">
                {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
              </span>
            )}
          </div>
          {resolvedAddress ? (
            <p className="text-gray-700 dark:text-gray-300 font-bold leading-relaxed line-clamp-2">
              {resolvedAddress}
            </p>
          ) : loading ? (
            <p className="text-gray-400 font-medium italic animate-pulse">Contacting satellite co-ops...</p>
          ) : (
            <p className="text-gray-400 font-medium italic">Place pin on map to resolve exact delivery street address.</p>
          )}

          {geocodingError && (
            <p className="text-amber-500 font-bold flex items-center gap-1 text-[9px] pt-1">
              <AlertCircle size={10} />
              <span>{geocodingError}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
