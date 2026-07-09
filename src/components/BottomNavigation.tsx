import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useLanguage } from "../lib/LanguageContext";
import { UserProfile } from "../types";
import { motion } from "motion/react";

interface BottomNavigationProps {
  user: UserProfile | null;
}

export default function BottomNavigation({ user }: BottomNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { items } = useCart();
  const { language } = useLanguage();

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Determine active state based on current location and search query
  const isSearchActive = location.pathname === "/" && location.search.includes("search");
  const isHomeActive = location.pathname === "/" && !location.search.includes("search");
  const isCartActive = location.pathname === "/cart";
  const isProfileActive = location.pathname === "/profile";

  const navItems = [
    {
      id: "home",
      label: language === "sw" ? "Nyumbani" : "Home",
      icon: Home,
      isActive: isHomeActive,
      onClick: () => navigate("/"),
    },
    {
      id: "search",
      label: language === "sw" ? "Tafuta" : "Search",
      icon: Search,
      isActive: isSearchActive,
      onClick: () => {
        const input = document.getElementById("mobile-search-input");
        if (input) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => {
            input.focus();
          }, 150);
        } else {
          navigate("/?search-focus=true");
          setTimeout(() => {
            const retryInput = document.getElementById("mobile-search-input");
            if (retryInput) {
              window.scrollTo({ top: 0, behavior: "smooth" });
              retryInput.focus();
            }
          }, 350);
        }
      },
    },
    {
      id: "cart",
      label: language === "sw" ? "Kikapu" : "Cart",
      icon: ShoppingCart,
      isActive: isCartActive,
      onClick: () => navigate("/cart"),
      badge: itemCount > 0 ? itemCount : undefined,
    },
    {
      id: "profile",
      label: language === "sw" ? "Wasifu" : "Profile",
      icon: User,
      isActive: isProfileActive,
      onClick: () => navigate("/profile"),
      avatar: user?.photoURL || undefined,
    },
  ];

  return (
    <div 
      id="mobile-bottom-navigation" 
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-150/80 dark:border-gray-800/80 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)] pb-safe-bottom"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={item.onClick}
              whileTap={{ scale: 0.9 }}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center group cursor-pointer focus:outline-none bg-transparent border-none"
            >
              {/* Active Backing Pill */}
              {item.isActive && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-x-2 top-1 bottom-1 bg-orange-50 dark:bg-orange-950/30 rounded-2xl -z-10"
                />
              )}

              <div className="relative flex items-center justify-center p-1">
                {/* Optional Custom User Avatar */}
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt="User profile"
                    className={`w-6 h-6 rounded-full object-cover border-2 transition-all duration-200 ${
                      item.isActive
                        ? "border-orange-500 scale-110"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <IconComponent
                    size={20}
                    className={`transition-all duration-250 ${
                      item.isActive
                        ? "text-orange-600 dark:text-orange-500 scale-110"
                        : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200"
                    }`}
                  />
                )}

                {/* Badge Indicator for Cart count */}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-orange-600 text-white text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 border border-white dark:border-gray-950 shadow-xs scale-100">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label text */}
              <span
                className={`text-[10px] font-bold mt-1 tracking-tight transition-colors duration-200 ${
                  item.isActive
                    ? "text-orange-600 dark:text-orange-500 font-extrabold"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
