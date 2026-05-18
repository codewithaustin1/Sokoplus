import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut, X, ShoppingBag, Heart } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { auth } from "../lib/firebase";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface NavbarProps {
  user: UserProfile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const { items } = useCart();
  const [search, setSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Blog", path: "/blog" },
    ...(user?.isAdmin ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-bold tracking-tighter text-orange-600">
              Sokoplus<span className="text-gray-900">.</span>
            </Link>
          </div>

          {/* Desktop Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products in Kenya..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
              />
            </div>
          </form>

          {/* Nav Icons */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 mr-4">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} className="text-sm font-medium text-gray-600 hover:text-orange-600">
                  {link.label}
                </Link>
              ))}
            </div>

            <Link to="/wishlist" className="relative group p-2">
              <Heart className="text-gray-700 group-hover:text-red-500 transition-colors" size={24} />
              {user?.wishlist && user.wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {user.wishlist.length}
                </span>
              )}
            </Link>

            <Link to="/profile" className="p-2 group">
              <User className="text-gray-700 group-hover:text-orange-600 transition-colors" size={24} />
            </Link>

            <Link to="/cart" className="relative group p-2">
              <ShoppingCart className="text-gray-700 group-hover:text-orange-600 transition-colors" size={24} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {itemCount}
                </span>
              )}
            </Link>

            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  <Link to="/login" className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <User size={24} className="text-gray-700" />
                  </Link>
                  <button 
                    onClick={() => setShowLogoutConfirm(true)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-700 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 md:hidden p-6 flex flex-col space-y-8"
            >
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold tracking-tighter">Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400">
                  <X size={24} />
                </button>
              </div>

              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </form>

              {/* Links */}
              <div className="flex flex-col space-y-4">
                {user && (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-2xl font-black text-gray-900 flex items-center justify-between group"
                    >
                      Profile
                      <motion.div whileHover={{ x: 5 }} className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <User size={24} />
                      </motion.div>
                    </Link>
                    <Link
                      to="/wishlist"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-2xl font-black text-gray-900 flex items-center justify-between group"
                    >
                      Wishlist
                      <motion.div whileHover={{ x: 5 }} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Heart size={24} fill="currentColor" />
                      </motion.div>
                    </Link>
                  </>
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-black text-gray-900 flex items-center justify-between group"
                  >
                    {link.label}
                    <motion.div whileHover={{ x: 5 }} className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShoppingBag size={24} />
                    </motion.div>
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-8 border-t border-gray-100 flex flex-col space-y-4">
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-2xl">
                      <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.displayName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowLogoutConfirm(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 text-gray-600 font-bold p-4 hover:text-red-500"
                    >
                      <LogOut size={20} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full bg-orange-600 text-white text-center py-4 rounded-2xl font-bold text-lg"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl p-8 z-[70] shadow-2xl space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                  <LogOut size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900">Sign Out?</h3>
                  <p className="text-gray-500 font-medium">Are you sure you want to sign out of your account?</p>
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => {
                    auth.signOut();
                    setShowLogoutConfirm(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-50 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
