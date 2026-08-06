import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Clock, Truck, ChevronDown, Check, Sparkles } from "lucide-react";
import { counties } from "../data/counties";
import { calculateDelivery, getCutoffCountdown, DeliveryPrediction } from "../utils/delivery";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface DeliveryCountdownProps {
  county?: string;
  city?: string;
  country?: string;
  hideSelector?: boolean;
  onLocationChange?: (county: string, city: string, country?: string) => void;
  compact?: boolean;
  className?: string;
}

export const DeliveryCountdown: React.FC<DeliveryCountdownProps> = ({
  county,
  city,
  country,
  hideSelector = false,
  onLocationChange,
  compact = false,
  className = "",
}) => {
  // Read location from localStorage or default to Nairobi CBD
  const [internalCountry, setInternalCountry] = useState<string>(() => {
    return localStorage.getItem("sokoplus_delivery_country") || "Kenya";
  });
  const [internalCounty, setInternalCounty] = useState<string>(() => {
    return localStorage.getItem("sokoplus_delivery_county") || "Nairobi City County";
  });
  const [internalCity, setInternalCity] = useState<string>(() => {
    return localStorage.getItem("sokoplus_delivery_city") || "Nairobi CBD";
  });

  const selectedCountry = country !== undefined ? country : internalCountry;
  const selectedCounty = county !== undefined ? county : internalCounty;
  const selectedCity = city !== undefined ? city : internalCity;

  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [prediction, setPrediction] = useState<DeliveryPrediction | null>(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, formatted: "00:00:00", totalSeconds: 0 });

  // Update prediction when location changes
  useEffect(() => {
    const pred = calculateDelivery(selectedCounty, selectedCity, new Date(), selectedCountry);
    setPrediction(pred);
    
    // Only write internal state and local storage if not controlled from props
    if (country === undefined) {
      localStorage.setItem("sokoplus_delivery_country", selectedCountry);
    }
    if (county === undefined) {
      localStorage.setItem("sokoplus_delivery_county", selectedCounty);
    }
    if (city === undefined) {
      localStorage.setItem("sokoplus_delivery_city", selectedCity);
    }

    if (onLocationChange) {
      onLocationChange(selectedCounty, selectedCity, selectedCountry);
    }
  }, [selectedCounty, selectedCity, selectedCountry, county, city, country, onLocationChange]);

  // Handle countdown clock ticking
  useEffect(() => {
    if (!prediction) return;

    // Tick immediately
    const updateTime = () => {
      const timeData = getCutoffCountdown(prediction.cutoffHour);
      setCountdown(timeData);
    };
    updateTime();

    // Set interval
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [prediction]);

  const [disabledCountries, setDisabledCountries] = useState<string[]>([]);
  const [disabledCounties, setDisabledCounties] = useState<string[]>([]);
  const [disabledCities, setDisabledCities] = useState<string[]>([]);

  // Fetch settings & adjust
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "homepage");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const disabledCo = data.disabledCounties || [];
          const disabledCi = data.disabledCities || [];
          const disabledCt = data.disabledCountries || [];
          setDisabledCountries(disabledCt);
          setDisabledCounties(disabledCo);
          setDisabledCities(disabledCi);

          // Validate current county selection
          let nextCountry = selectedCountry;
          let nextCounty = selectedCounty;
          let nextCity = selectedCity;
          let changed = false;

          if (disabledCt.includes(nextCountry)) {
            const firstEnabledCountry = ["Kenya", "Uganda", "Tanzania", "Rwanda"].find(c => !disabledCt.includes(c));
            if (firstEnabledCountry) {
              nextCountry = firstEnabledCountry;
              changed = true;
            }
          }

          if (nextCountry === "Kenya") {
            if (disabledCo.includes(nextCounty)) {
              const firstEnabled = counties.find(c => !disabledCo.includes(c.name));
              if (firstEnabled) {
                nextCounty = firstEnabled.name;
                changed = true;
              }
            }

            const matchedCountyObj = counties.find(c => c.name === nextCounty);
            if (matchedCountyObj) {
              if (disabledCi.includes(nextCity) || !matchedCountyObj.cities.includes(nextCity)) {
                const firstEnabledCity = matchedCountyObj.cities.find(c => !disabledCi.includes(c));
                if (firstEnabledCity) {
                  nextCity = firstEnabledCity;
                  changed = true;
                }
              }
            }
          } else {
            const CITIES_MAP: Record<string, string[]> = {
              "Uganda": ["Kampala", "Entebbe", "Jinja"],
              "Tanzania": ["Dar es Salaam", "Arusha", "Zanzibar"],
              "Rwanda": ["Kigali", "Gisenyi"],
            };
            const countryCities = CITIES_MAP[nextCountry] || [];
            if (disabledCi.includes(nextCity) || !countryCities.includes(nextCity)) {
              const firstEnabledCity = countryCities.find(c => !disabledCi.includes(c));
              if (firstEnabledCity) {
                nextCity = firstEnabledCity;
                changed = true;
              }
            }
          }

          if (changed) {
            if (country === undefined) setInternalCountry(nextCountry);
            if (county === undefined) setInternalCounty(nextCounty);
            if (city === undefined) setInternalCity(nextCity);
          }
        }
      } catch (e) {
        console.warn("Delivery settings fetch bypassed in DeliveryCountdown (using defaults):", e);
      }
    };
    fetchSettings();
  }, [country, county, city, selectedCountry, selectedCounty, selectedCity]);

  const selectedCountyData = counties.find((c) => c.name === selectedCounty) || counties[0];
  const cities = selectedCountyData 
    ? selectedCountyData.cities.filter(city => !disabledCities.includes(city)) 
    : [];

  const handleCountyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const matchedCounty = counties.find((c) => c.name === val);
    const matchedCities = matchedCounty ? matchedCounty.cities : [];
    const firstCity = matchedCities.find(c => !disabledCities.includes(c)) || matchedCities[0] || "";

    if (county === undefined) {
      setInternalCounty(val);
      setInternalCity(firstCity);
    } else if (onLocationChange) {
      onLocationChange(val, firstCity);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (city === undefined) {
      setInternalCity(val);
    } else if (onLocationChange) {
      onLocationChange(selectedCounty, val);
    }
  };

  if (!prediction) return null;

  const isNairobiCentral = selectedCounty === "Nairobi City County" && 
    ["Nairobi CBD", "Westlands", "Lavington", "Kilimani", "Kileleshwa", "Hurlingham", "Parklands", "Highridge", "Ngara"].includes(selectedCity);

  // Pulse color classes based on remaining time (red alert if under 1 hour)
  const isUrgent = countdown.hours === 0 && countdown.totalSeconds > 0;

  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br from-orange-50/10 via-orange-50/5 to-transparent border border-gray-100 dark:border-gray-800 shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Delivery estimation info */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-orange-100/60 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200/40 dark:border-orange-900/30 shadow-sm shrink-0">
            <Truck className="animate-pulse" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none ${
                isNairobiCentral 
                  ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-extrabold border border-green-200/20 dark:border-green-900/30" 
                  : "bg-orange-100 dark:bg-orange-950/40 text-orange-750 dark:text-orange-450 font-extrabold border border-orange-200/20 dark:border-orange-900/30"
              }`}>
                {prediction.tier}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
                <MapPin size={11} /> {selectedCity}
              </span>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mt-1.5 leading-snug">
              Expected Time to Receive: <span className="text-orange-600 dark:text-orange-500">{prediction.time}</span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 max-w-sm">
              {prediction.desc}
            </p>
          </div>
        </div>

        {/* Customer-First Expected Arrival Badge */}
        <div className="flex flex-col items-start sm:items-end justify-center py-2.5 px-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20 dark:border-emerald-500/30 min-w-[210px]">
          <span className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1">
            <Sparkles size={12} className="text-emerald-500" /> Expected Arrival
          </span>
          <div className="text-base font-black text-emerald-950 dark:text-emerald-100 mt-1">
            {prediction.time}
          </div>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400/80 mt-0.5 leading-none">
            Direct to your door in {selectedCity}
          </p>
        </div>
      </div>

      {/* Location Changer Toggle & Form */}
      {!hideSelector && (
        <div className="mt-4 pt-3.5 border-t border-gray-100/80 dark:border-gray-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsChangingLocation(!isChangingLocation)}
              className="text-xs font-extrabold text-orange-650 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer focus:outline-none"
            >
              <MapPin size={12} />
              <span>Shipping to: </span>
              <span className="text-gray-700 dark:text-gray-300 font-black border-b border-dashed border-gray-400 dark:border-gray-600 hover:border-orange-600 dark:hover:border-orange-500 pb-0.5">
                {selectedCounty}, {selectedCity}
              </span>
              <ChevronDown size={12} className={`transition-transform duration-250 ${isChangingLocation ? "rotate-180" : ""}`} />
            </button>
          </div>

          <AnimatePresence>
            {isChangingLocation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-550 dark:text-gray-400 mb-1 tracking-wider">County</label>
                    <select
                      value={selectedCounty}
                      onChange={handleCountyChange}
                      className="w-full text-xs font-bold p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1.5 focus:ring-orange-500/30 focus:border-orange-500 transition-all cursor-pointer"
                    >
                      {counties.filter(c => !disabledCounties.includes(c.name)).map((c) => (
                        <option key={c.name} value={c.name} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-555 dark:text-gray-400 mb-1 tracking-wider">City / Neighborhood</label>
                    <select
                      value={selectedCity}
                      onChange={handleCityChange}
                      className="w-full text-xs font-bold p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1.5 focus:ring-orange-500/30 focus:border-orange-500 transition-all cursor-pointer"
                    >
                      {cities.map((city) => (
                        <option key={city} value={city} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      onClick={() => setIsChangingLocation(false)}
                      className="px-3.5 py-1.5 text-xs font-bold text-white dark:text-gray-950 bg-gray-900 dark:bg-gray-100 hover:bg-orange-600 dark:hover:bg-orange-500 transition-all rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Check size={12} /> Confirm Location
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
