import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSun,
  CloudLightning,
  CloudFog,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  Sparkles,
  ChevronDown,
  X,
  MapPin,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LocalWeatherWidgetProps {
  deliveryCity?: string;
  deliveryCountry?: string;
  compact?: boolean;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  condition: string;
  windSpeed: number;
  city: string;
  country: string;
  highTemp: number;
  lowTemp: number;
  timestamp: number;
  recommendations: {
    category: string;
    label: string;
    icon: string;
  }[];
}

const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  nairobi: { lat: -1.286389, lon: 36.817223 },
  mombasa: { lat: -4.043477, lon: 39.668206 },
  kisumu: { lat: -0.091702, lon: 34.767956 },
  nakuru: { lat: -0.303099, lon: 36.080025 },
  eldoret: { lat: 0.514277, lon: 35.26978 },
  kampala: { lat: 0.347596, lon: 32.58252 },
  "dar es salaam": { lat: -6.792354, lon: 39.208328 },
  kigali: { lat: -1.944072, lon: 30.061885 },
  arusha: { lat: -3.386925, lon: 36.682993 },
  zanzibar: { lat: -6.165917, lon: 39.202641 },
};

export function LocalWeatherWidget({
  deliveryCity = "Nairobi",
  deliveryCountry = "Kenya",
  compact = false,
}: LocalWeatherWidgetProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [weather, setWeather] = useState<WeatherData | null>(() => {
    try {
      const cached = localStorage.getItem("sokoplus_weather_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache valid for 30 minutes
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed;
        }
      }
    } catch {
      // Ignore cache parse error
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(!weather);
  const [showModal, setShowModal] = useState(false);

  // Only show weather in the Home view
  const isHomeView = location.pathname === "/";

  useEffect(() => {
    if (!isHomeView) return;

    let isMounted = true;

    async function fetchWeatherData() {
      setIsLoading(true);
      const normalizedCity = deliveryCity.trim().toLowerCase();
      let coords = CITY_COORDINATES[normalizedCity];

      try {
        // If city isn't pre-mapped, geocode via Open-Meteo Geocoding API
        if (!coords) {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              deliveryCity
            )}&count=1&language=en&format=json`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.results && geoData.results[0]) {
              coords = {
                lat: geoData.results[0].latitude,
                lon: geoData.results[0].longitude,
              };
            }
          }
        }

        // Fallback to Nairobi coordinates if unknown
        if (!coords) {
          coords = CITY_COORDINATES["nairobi"];
        }

        // Fetch current weather + daily min/max
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
        );

        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          const current = wData.current_weather;
          const daily = wData.daily;

          const temp = Math.round(current.temperature);
          const code = current.weathercode;
          const wind = Math.round(current.windspeed);
          const high = daily?.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : temp + 3;
          const low = daily?.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : temp - 4;

          const condition = getWeatherCondition(code);
          const recs = getWeatherShoppingRecommendations(code, temp);

          const newWeatherData: WeatherData = {
            temperature: temp,
            weatherCode: code,
            condition,
            windSpeed: wind,
            city: deliveryCity,
            country: deliveryCountry,
            highTemp: high,
            lowTemp: low,
            timestamp: Date.now(),
            recommendations: recs,
          };

          if (isMounted) {
            setWeather(newWeatherData);
            try {
              localStorage.setItem(
                "sokoplus_weather_cache",
                JSON.stringify(newWeatherData)
              );
            } catch {
              // Ignore storage errors
            }
          }
        }
      } catch (err) {
        console.warn("[Weather Widget] Fetch error:", err);
        // Fallback mock weather for seamless UI
        if (isMounted && !weather) {
          const fallback: WeatherData = {
            temperature: 24,
            weatherCode: 1,
            condition: "Partly Cloudy",
            windSpeed: 12,
            city: deliveryCity,
            country: deliveryCountry,
            highTemp: 27,
            lowTemp: 18,
            timestamp: Date.now(),
            recommendations: getWeatherShoppingRecommendations(1, 24),
          };
          setWeather(fallback);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchWeatherData();

    return () => {
      isMounted = false;
    };
  }, [deliveryCity, deliveryCountry, isHomeView]);

  if (!isHomeView) return null;

  const handleRecClick = (category: string) => {
    setShowModal(false);
    navigate(`/?category=${encodeURIComponent(category)}`);
    setTimeout(() => {
      document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  return (
    <>
      {/* Navbar Weather Pill Trigger */}
      <div className="relative inline-flex items-center">
        <button
          onClick={() => setShowModal(!showModal)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer select-none ${
            compact
              ? "bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
              : "bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 hover:border-amber-500/40"
          }`}
          title={`Click for ${weather?.city || deliveryCity} local weather & tailored recommendations`}
        >
          {isLoading ? (
            <RefreshCw size={12} className="animate-spin text-amber-400" />
          ) : (
            getWeatherIcon(weather?.weatherCode ?? 1, "w-3.5 h-3.5 text-amber-400 shrink-0")
          )}

          <span className="text-white font-extrabold font-mono">
            {weather ? `${weather.temperature}°C` : "24°C"}
          </span>

          <span className="hidden sm:inline text-gray-300 truncate max-w-[80px]">
            {weather?.city || deliveryCity}
          </span>

          <ChevronDown size={10} className="text-gray-400" />
        </button>
      </div>

      {/* Interactive Daily Weather & Smart Shopping Recommendation Modal/Popover */}
      <AnimatePresence>
        {showModal && weather && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gray-900 border border-gray-800 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative Accent Background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    {getWeatherIcon(weather.weatherCode, "w-5 h-5 text-white")}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold uppercase tracking-wider">
                      <MapPin size={12} />
                      <span>{weather.city}, {weather.country}</span>
                    </div>
                    <h3 className="text-lg font-black text-white">Local Weather Today</h3>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Weather Hero Display */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-800/80 to-gray-850/80 border border-gray-700/50 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-4xl font-black font-mono text-white flex items-baseline gap-1">
                    {weather.temperature}°C
                    <span className="text-xs text-gray-400 font-sans font-normal">
                      H: {weather.highTemp}° / L: {weather.lowTemp}°
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-amber-300 mt-0.5">
                    {weather.condition}
                  </p>
                </div>

                <div className="space-y-1 text-right text-xs text-gray-300 font-medium">
                  <div className="flex items-center justify-end gap-1 text-gray-400">
                    <Wind size={12} />
                    <span>Wind: {weather.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-gray-400">
                    <Thermometer size={12} />
                    <span>Feels like {weather.temperature + 1}°C</span>
                  </div>
                </div>
              </div>

              {/* Daily Everyday Use Shopping Recommendations */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Sparkles size={14} />
                  <span>Weather-Inspired Daily Picks</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {weather.recommendations.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRecClick(rec.category)}
                      className="w-full p-3 rounded-2xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 hover:border-amber-500/50 flex items-center justify-between text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{rec.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            {rec.label}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Explore {rec.category} essentials
                          </div>
                        </div>
                      </div>

                      <div className="w-7 h-7 rounded-xl bg-gray-700/50 group-hover:bg-amber-500 text-gray-300 group-hover:text-black flex items-center justify-center transition-colors shrink-0">
                        <ArrowUpRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
                <span>Powered by Open-Meteo Realtime API</span>
                <button
                  onClick={() => setShowModal(false)}
                  className="font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helpers
function getWeatherCondition(code: number): string {
  if (code === 0) return "Sunny & Clear";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code === 45 || code === 48) return "Misty & Foggy";
  if (code >= 51 && code <= 67) return "Light Rain & Drizzle";
  if (code >= 80 && code <= 82) return "Heavy Showers";
  if (code >= 71 && code <= 77) return "Cool Breeze & Snow";
  if (code >= 95) return "Thunderstorm Alert";
  return "Pleasant Weather";
}

function getWeatherIcon(code: number, className: string = "w-4 h-4") {
  if (code === 0) return <Sun className={className} />;
  if (code >= 1 && code <= 3) return <CloudSun className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return <CloudRain className={className} />;
  if (code >= 71 && code <= 77) return <Snowflake className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <Cloud className={className} />;
}

function getWeatherShoppingRecommendations(
  code: number,
  temp: number
): { category: string; label: string; icon: string }[] {
  // Rain or Thunderstorm
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
    return [
      {
        category: "Fashion & Apparel",
        label: "Umbrellas, Rain Jackets & Waterproof Boots",
        icon: "☔",
      },
      {
        category: "Local Crafts",
        label: "Handcrafted Ceramic Mugs & Woven Coasters",
        icon: "☕",
      },
      {
        category: "Home & Office Décor",
        label: "Cozy Fleece Blankets & Room Heaters",
        icon: "🛋️",
      },
    ];
  }

  // Hot / Sunny weather
  if (temp >= 26 || code === 0) {
    return [
      {
        category: "Beauty & Personal Care",
        label: "Sunscreen, Hydrating Lotions & Skincare",
        icon: "🧴",
      },
      {
        category: "Beauty & Personal Care",
        label: "Hydrating Facial Mists & Lip Balms",
        icon: "💧",
      },
      {
        category: "Fashion & Apparel",
        label: "Sunglasses, Hats & Light Linen Outfits",
        icon: "🕶️",
      },
    ];
  }

  // Mild / Cool / Cloudy
  return [
    {
      category: "Fashion & Apparel",
      label: "Comfortable Hoodies, Jackets & Casual Wear",
      icon: "🧥",
    },
    {
      category: "Electronics & Tech",
      label: "Wireless Earbuds & Portable Powerbanks",
      icon: "🎧",
    },
    {
      category: "Home & Office Décor",
      label: "Artisan Desk Organizers & Small Gadgets",
      icon: "🕯️",
    },
  ];
}
