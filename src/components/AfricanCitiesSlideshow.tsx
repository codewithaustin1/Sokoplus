import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import johannesburgSkyline from "../assets/images/johannesburg_skyline_1786599114515.jpg";

export interface AfricanDestination {
  id: string;
  name: string;
  country: string;
  imageUrl: string;
}

export const AFRICAN_DESTINATIONS: AfricanDestination[] = [
  {
    id: "johannesburg",
    name: "Johannesburg",
    country: "South Africa",
    imageUrl: johannesburgSkyline
  },
  {
    id: "nairobi",
    name: "Nairobi",
    country: "Kenya",
    imageUrl: "https://images.unsplash.com/photo-1619546952812-520e98064a52?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    imageUrl: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "cairo-giza",
    name: "Cairo & Giza",
    country: "Egypt",
    imageUrl: "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "kigali",
    name: "Kigali",
    country: "Rwanda",
    imageUrl: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "mombasa",
    name: "Mombasa",
    country: "Kenya",
    imageUrl: "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "zanzibar",
    name: "Stone Town, Zanzibar",
    country: "Tanzania",
    imageUrl: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "victoria-falls",
    name: "Victoria Falls",
    country: "Zimbabwe / Zambia",
    imageUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    imageUrl: "https://images.unsplash.com/photo-1572883454114-1cf0031ede2a?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "kilimanjaro",
    name: "Mount Kilimanjaro",
    country: "Tanzania",
    imageUrl: "https://images.unsplash.com/photo-1589553416260-f586c8f1514f?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "addis-ababa",
    name: "Addis Ababa",
    country: "Ethiopia",
    imageUrl: "https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "accra",
    name: "Accra",
    country: "Ghana",
    imageUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "dar-es-salaam",
    name: "Dar es Salaam",
    country: "Tanzania",
    imageUrl: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "dakar",
    name: "Dakar",
    country: "Senegal",
    imageUrl: "https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "maasai-mara",
    name: "Maasai Mara",
    country: "Kenya",
    imageUrl: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "alexandria",
    name: "Alexandria",
    country: "Egypt",
    imageUrl: "https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "durban",
    name: "Durban",
    country: "South Africa",
    imageUrl: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=1000&q=80"
  }
];

interface AfricanCitiesSlideshowProps {
  children?: React.ReactNode;
  autoPlayInterval?: number;
}

export function AfricanCitiesSlideshow({
  children,
  autoPlayInterval = 8500
}: AfricanCitiesSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % AFRICAN_DESTINATIONS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [nextSlide, autoPlayInterval]);

  const currentDestination = AFRICAN_DESTINATIONS[currentIndex];

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 text-white select-none">
      {/* Background Image Carousel with Smooth, Slow Ambient Fade Transition */}
      <div className="absolute inset-0 overflow-hidden bg-slate-900">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentDestination.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${currentDestination.imageUrl})` }}
          />
        </AnimatePresence>

        {/* Natural Dark Scrim / Vignette for crisp text contrast (no orange overlay) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75 pointer-events-none" />
      </div>

      {/* Foreground Content Container - Clean Header with Logo and Close Button */}
      <div className="relative z-10 p-5 pb-6">
        {children}
      </div>
    </div>
  );
}
