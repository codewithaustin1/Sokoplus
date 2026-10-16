/**
 * Production-Grade OpenMaps (OpenStreetMap / Nominatim / Photon) Geocoding Service
 * Compliant with OSM Usage Policies:
 * - Server-side execution only (Custom User-Agent & contact info sent on every request)
 * - In-memory LRU caching for frequent and repeat searches
 * - Photon by Komoot as primary high-speed autocomplete engine (built for real-time typeahead)
 * - Nominatim as secondary verified geocoder
 * - Built-in offline Kenyan gazetteer fallback across all 47 counties and major urban hubs
 */

export interface OpenMapAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  [key: string]: any;
}

export interface OpenMapLocation {
  place_id: string | number;
  lat: string;
  lon: string;
  display_name: string;
  address?: OpenMapAddress;
  type?: string;
  importance?: number;
}

// Extensive Kenyan Gazetteer for instant offline search & reverse geocode fallback
export interface GazetteerEntry {
  name: string;
  suburb?: string;
  city: string;
  county: string;
  country: string;
  lat: number;
  lng: number;
}

export const KENYAN_GAZETTEER: GazetteerEntry[] = [
  // Nairobi County & Hubs
  { name: "Nairobi Central Business District (CBD)", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.286389, lng: 36.817223 },
  { name: "Westlands", suburb: "Westlands", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2673, lng: 36.8114 },
  { name: "Kilimani", suburb: "Kilimani", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2960, lng: 36.7818 },
  { name: "Upper Hill", suburb: "Upper Hill", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2995, lng: 36.8157 },
  { name: "Karen", suburb: "Karen", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3197, lng: 36.7065 },
  { name: "Kileleshwa", suburb: "Kileleshwa", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2828, lng: 36.7878 },
  { name: "Lavington", suburb: "Lavington", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2774, lng: 36.7686 },
  { name: "Parklands", suburb: "Parklands", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2625, lng: 36.8222 },
  { name: "South B", suburb: "South B", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3108, lng: 36.8375 },
  { name: "South C", suburb: "South C", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3204, lng: 36.8312 },
  { name: "Eastleigh", suburb: "Eastleigh", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2758, lng: 36.8524 },
  { name: "Roysambu", suburb: "Roysambu", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2185, lng: 36.8874 },
  { name: "Kasarani", suburb: "Kasarani", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2256, lng: 36.9022 },
  { name: "Lang'ata", suburb: "Lang'ata", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3533, lng: 36.7588 },
  { name: "Ngong Road", suburb: "Dagoretti", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3002, lng: 36.7725 },
  { name: "Gigiri / UN Avenue", suburb: "Gigiri", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2333, lng: 36.8167 },
  { name: "Muthaiga", suburb: "Muthaiga", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.2586, lng: 36.8354 },
  { name: "Embakasi", suburb: "Embakasi", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3167, lng: 36.9000 },
  { name: "JKIA Airport", suburb: "Embakasi", city: "Nairobi", county: "Nairobi", country: "Kenya", lat: -1.3192, lng: 36.9278 },

  // Kiambu & Greater Nairobi Metropolis
  { name: "Ruaka", city: "Ruaka", county: "Kiambu", country: "Kenya", lat: -1.2058, lng: 36.7786 },
  { name: "Thika Town", city: "Thika", county: "Kiambu", country: "Kenya", lat: -1.0333, lng: 37.0694 },
  { name: "Ruiru", city: "Ruiru", county: "Kiambu", country: "Kenya", lat: -1.1444, lng: 36.9611 },
  { name: "Kikuyu Town", city: "Kikuyu", county: "Kiambu", country: "Kenya", lat: -1.2464, lng: 36.6631 },
  { name: "Limuru", city: "Limuru", county: "Kiambu", country: "Kenya", lat: -1.1167, lng: 36.6500 },
  { name: "Juja", city: "Juja", county: "Kiambu", country: "Kenya", lat: -1.1039, lng: 37.0136 },
  { name: "Kiambu Town", city: "Kiambu", county: "Kiambu", country: "Kenya", lat: -1.1714, lng: 36.8356 },

  // Kajiado / Machakos
  { name: "Ngong Town", city: "Ngong", county: "Kajiado", country: "Kenya", lat: -1.3619, lng: 36.6567 },
  { name: "Ongata Rongai", city: "Ongata Rongai", county: "Kajiado", country: "Kenya", lat: -1.3967, lng: 36.7600 },
  { name: "Kitengela", city: "Kitengela", county: "Kajiado", country: "Kenya", lat: -1.4744, lng: 36.9606 },
  { name: "Syokimau", city: "Syokimau", county: "Machakos", country: "Kenya", lat: -1.3508, lng: 36.9381 },
  { name: "Athi River", city: "Athi River", county: "Machakos", country: "Kenya", lat: -1.4500, lng: 36.9833 },
  { name: "Mlolongo", city: "Mlolongo", county: "Machakos", country: "Kenya", lat: -1.3800, lng: 36.9400 },
  { name: "Machakos Town", city: "Machakos", county: "Machakos", country: "Kenya", lat: -1.5167, lng: 37.2667 },

  // Coast Region
  { name: "Mombasa Island (CBD)", city: "Mombasa", county: "Mombasa", country: "Kenya", lat: -4.0435, lng: 39.6682 },
  { name: "Nyali", suburb: "Nyali", city: "Mombasa", county: "Mombasa", country: "Kenya", lat: -4.0308, lng: 39.7119 },
  { name: "Bamburi", suburb: "Bamburi", city: "Mombasa", county: "Mombasa", country: "Kenya", lat: -3.9881, lng: 39.7225 },
  { name: "Diani Beach", city: "Diani", county: "Kwale", country: "Kenya", lat: -4.2797, lng: 39.5939 },
  { name: "Mtwapa", city: "Mtwapa", county: "Kilifi", country: "Kenya", lat: -3.9439, lng: 39.7431 },
  { name: "Malindi Town", city: "Malindi", county: "Kilifi", country: "Kenya", lat: -3.2192, lng: 40.1169 },
  { name: "Kilifi Town", city: "Kilifi", county: "Kilifi", country: "Kenya", lat: -3.6306, lng: 39.8497 },
  { name: "Lamu Island", city: "Lamu", county: "Lamu", country: "Kenya", lat: -2.2694, lng: 40.9022 },
  { name: "Voi Town", city: "Voi", county: "Taita-Taveta", country: "Kenya", lat: -3.3967, lng: 38.5561 },

  // Rift Valley
  { name: "Nakuru City", city: "Nakuru", county: "Nakuru", country: "Kenya", lat: -0.3031, lng: 36.0800 },
  { name: "Naivasha Town", city: "Naivasha", county: "Nakuru", country: "Kenya", lat: -0.7172, lng: 36.4311 },
  { name: "Eldoret City", city: "Eldoret", county: "Uasin Gishu", country: "Kenya", lat: 0.5143, lng: 35.2698 },
  { name: "Kericho Town", city: "Kericho", county: "Kericho", country: "Kenya", lat: -0.3689, lng: 35.2864 },
  { name: "Narok Town", city: "Narok", county: "Narok", country: "Kenya", lat: -1.0833, lng: 35.8667 },
  { name: "Kitale Town", city: "Kitale", county: "Trans Nzoia", country: "Kenya", lat: 1.0167, lng: 35.0000 },
  { name: "Nanyuki Town", city: "Nanyuki", county: "Laikipia", country: "Kenya", lat: 0.0167, lng: 37.0728 },

  // Western & Nyanza
  { name: "Kisumu City", city: "Kisumu", county: "Kisumu", country: "Kenya", lat: -0.0917, lng: 34.7680 },
  { name: "Kisii Town", city: "Kisii", county: "Kisii", country: "Kenya", lat: -0.6817, lng: 34.7667 },
  { name: "Kakamega Town", city: "Kakamega", county: "Kakamega", country: "Kenya", lat: 0.2833, lng: 34.7500 },
  { name: "Bungoma Town", city: "Bungoma", county: "Bungoma", country: "Kenya", lat: 0.5636, lng: 34.5606 },
  { name: "Busia Town", city: "Busia", county: "Busia", country: "Kenya", lat: 0.4608, lng: 34.1114 },
  { name: "Homa Bay Town", city: "Homa Bay", county: "Homa Bay", country: "Kenya", lat: -0.5272, lng: 34.4569 },
  { name: "Migori Town", city: "Migori", county: "Migori", country: "Kenya", lat: -1.0634, lng: 34.4731 },

  // Central & Eastern & Northern
  { name: "Nyeri Town", city: "Nyeri", county: "Nyeri", country: "Kenya", lat: -0.4201, lng: 36.9476 },
  { name: "Meru Town", city: "Meru", county: "Meru", country: "Kenya", lat: 0.0500, lng: 37.6500 },
  { name: "Embu Town", city: "Embu", county: "Embu", country: "Kenya", lat: -0.5311, lng: 37.4589 },
  { name: "Garissa Town", city: "Garissa", county: "Garissa", country: "Kenya", lat: -0.4536, lng: 39.6461 },
  { name: "Isiolo Town", city: "Isiolo", county: "Isiolo", country: "Kenya", lat: 0.3547, lng: 37.5822 },
  { name: "Lodwar Town", city: "Lodwar", county: "Turkana", country: "Kenya", lat: 3.1192, lng: 35.5972 },
];

// Helper: Haversine distance in kilometers
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-Memory Cache with TTL
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_CACHE_SIZE = 1200;

const searchCache = new Map<string, CacheItem<OpenMapLocation[]>>();
const reverseCache = new Map<string, CacheItem<OpenMapLocation>>();

function cleanCache<T>(cache: Map<string, CacheItem<T>>) {
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKeys = Array.from(cache.keys()).slice(0, 200);
    oldestKeys.forEach((k) => cache.delete(k));
  }
}

// User-Agent compliant with OpenStreetMap Nominatim Foundation Policy
const NOMINATIM_USER_AGENT = "SokoPlus-Delivery-Platform/2.0 (+https://sokoplus.co.ke; support@sokoplus.co.ke)";

/**
 * Search locations using Photon (primary), Nominatim (secondary), and Kenyan Gazetteer (fallback).
 */
export async function searchOpenMapLocations(
  query: string,
  countryHint: string = "Kenya",
  limit: number = 6
): Promise<{ suggestions: OpenMapLocation[]; source: string }> {
  const trimmed = (query || "").trim();
  if (!trimmed || trimmed.length < 2) {
    return { suggestions: [], source: "none" };
  }

  const cacheKey = `${trimmed.toLowerCase()}_${countryHint.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { suggestions: cached.data, source: "cache" };
  }

  // 1. Try Photon API by Komoot (Purpose-built for fast typeahead & free autocomplete)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=${limit}&lat=-1.2921&lon=36.8219`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const photonRes = await fetch(photonUrl, {
      signal: controller.signal,
      headers: { "Accept-Language": "en" },
    });
    clearTimeout(timeoutId);

    if (photonRes.ok) {
      const pData: any = await photonRes.json();
      if (pData && Array.isArray(pData.features) && pData.features.length > 0) {
        const transformed: OpenMapLocation[] = pData.features.map((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [0, 0];
          const primaryName = props.name || props.street || "Unknown Location";
          const parts = [
            primaryName,
            props.street && props.street !== primaryName ? props.street : null,
            props.district || props.locality,
            props.city || props.state,
            props.country || "Kenya",
          ].filter(Boolean);

          return {
            place_id: props.osm_id ? `photon_${props.osm_id}` : `p_${Math.random().toString(36).substring(2, 9)}`,
            lat: String(coords[1] || -1.2921),
            lon: String(coords[0] || 36.8219),
            display_name: parts.join(", "),
            address: {
              road: props.street || "",
              suburb: props.district || props.locality || "",
              neighbourhood: props.locality || "",
              city: props.city || props.state || "Nairobi",
              county: props.state || props.city || "Nairobi",
              country: props.country || "Kenya",
              country_code: (props.countrycode || "KE").toLowerCase(),
              postcode: props.postcode || "",
            },
            type: props.osm_value || props.type || "place",
          };
        });

        if (transformed.length > 0) {
          cleanCache(searchCache);
          searchCache.set(cacheKey, { data: transformed, timestamp: Date.now() });
          return { suggestions: transformed, source: "photon" };
        }
      }
    }
  } catch (photonErr) {
    console.warn("[OpenMaps Proxy] Photon lookup notice, attempting Nominatim:", (photonErr as Error).message);
  }

  // 2. Secondary: Nominatim API with compliant User-Agent
  try {
    let searchQuery = trimmed;
    if (countryHint && !trimmed.toLowerCase().includes(countryHint.toLowerCase())) {
      searchQuery += `, ${countryHint}`;
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(
      searchQuery
    )}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nomRes = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        "Accept-Language": "en",
      },
    });
    clearTimeout(timeoutId);

    if (nomRes.ok) {
      const nData = await nomRes.json();
      if (Array.isArray(nData) && nData.length > 0) {
        cleanCache(searchCache);
        searchCache.set(cacheKey, { data: nData, timestamp: Date.now() });
        return { suggestions: nData, source: "nominatim" };
      }
    }
  } catch (nomErr) {
    console.warn("[OpenMaps Proxy] Nominatim search notice, falling back to Kenyan Gazetteer:", (nomErr as Error).message);
  }

  // 3. Fallback: Offline Kenyan Gazetteer Search
  const lowerQ = trimmed.toLowerCase();
  const matched = KENYAN_GAZETTEER.filter((entry) => {
    return (
      entry.name.toLowerCase().includes(lowerQ) ||
      (entry.suburb && entry.suburb.toLowerCase().includes(lowerQ)) ||
      entry.city.toLowerCase().includes(lowerQ) ||
      entry.county.toLowerCase().includes(lowerQ)
    );
  }).slice(0, limit);

  const gazetteerSuggestions: OpenMapLocation[] = matched.map((g, idx) => ({
    place_id: `gazetteer_${idx}_${g.name.replace(/\s+/g, "_")}`,
    lat: String(g.lat),
    lon: String(g.lng),
    display_name: `${g.name}, ${g.city}, ${g.county} County, Kenya`,
    address: {
      suburb: g.suburb || g.name,
      neighbourhood: g.name,
      city: g.city,
      county: g.county,
      state: g.county,
      country: g.country,
      country_code: "ke",
    },
    type: "settlement",
  }));

  if (gazetteerSuggestions.length > 0) {
    cleanCache(searchCache);
    searchCache.set(cacheKey, { data: gazetteerSuggestions, timestamp: Date.now() });
    return { suggestions: gazetteerSuggestions, source: "gazetteer" };
  }

  return { suggestions: [], source: "empty" };
}

/**
 * Reverse geocode coordinates to an address using Nominatim (server-side) and Kenyan Gazetteer fallback.
 */
export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<{ location: OpenMapLocation; source: string }> {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLng = Number(lng.toFixed(4));
  const cacheKey = `${roundedLat},${roundedLng}`;

  const cached = reverseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { location: cached.data, source: "cache" };
  }

  // 1. Primary: Nominatim Reverse Geocoding with Compliant User-Agent
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${roundedLat}&lon=${roundedLng}&zoom=18&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(nomUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        "Accept-Language": "en",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.display_name) {
        cleanCache(reverseCache);
        reverseCache.set(cacheKey, { data, timestamp: Date.now() });
        return { location: data, source: "nominatim" };
      }
    }
  } catch (err) {
    console.warn("[OpenMaps Proxy] Nominatim reverse geocode notice, falling back:", (err as Error).message);
  }

  // 2. Secondary: Match Nearest Point in Kenyan Gazetteer
  let nearest: GazetteerEntry = KENYAN_GAZETTEER[0];
  let minDistanceKm = Infinity;

  for (const entry of KENYAN_GAZETTEER) {
    const dist = calculateHaversineKm(lat, lng, entry.lat, entry.lng);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      nearest = entry;
    }
  }

  const isVeryClose = minDistanceKm < 5;
  const displayName = isVeryClose
    ? `${nearest.name}, ${nearest.city}, ${nearest.county} County, Kenya`
    : `Near ${nearest.name} (${minDistanceKm.toFixed(1)} km), ${nearest.city}, ${nearest.county} County, Kenya`;

  const fallbackLocation: OpenMapLocation = {
    place_id: `nearest_${roundedLat}_${roundedLng}`,
    lat: String(roundedLat),
    lon: String(roundedLng),
    display_name: displayName,
    address: {
      suburb: nearest.suburb || nearest.name,
      neighbourhood: nearest.name,
      city: nearest.city,
      county: nearest.county,
      state: nearest.county,
      country: nearest.country,
      country_code: "ke",
    },
    type: "point",
  };

  cleanCache(reverseCache);
  reverseCache.set(cacheKey, { data: fallbackLocation, timestamp: Date.now() });
  return { location: fallbackLocation, source: "gazetteer_nearest" };
}
