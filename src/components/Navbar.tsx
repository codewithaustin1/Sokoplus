import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut, X, ShoppingBag, Heart, Award } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { auth, db } from "../lib/firebase";
import { UserProfile, Product } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, query, limit } from "firebase/firestore";

interface NavbarProps {
  user: UserProfile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const { items } = useCart();
  const [search, setSearch] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [showDesktopSuggestions, setShowDesktopSuggestions] = useState(false);

  const navigate = useNavigate();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), limit(50));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setAllProducts(fetched);
      } catch (err) {
        console.warn("Failed to fetch products for search suggestions:", err);
      }
    }
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setSuggestedProducts([]);
      setIsMobileMenuOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (val.trim()) {
      const queryStr = val.toLowerCase();
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(queryStr) || 
        p.description.toLowerCase().includes(queryStr) ||
        p.category.toLowerCase().includes(queryStr)
      ).slice(0, 5);
      setSuggestedProducts(filtered);
    } else {
      setSuggestedProducts([]);
    }
  };

  const handleProductSelect = (productId: string) => {
    navigate(`/product/${productId}`);
    setSearch("");
    setSuggestedProducts([]);
    setShowDesktopSuggestions(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Blog", path: "/blog" },
    ...(user?.isAdmin ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 bg-white/95 md:bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-bold tracking-tighter text-orange-600">
              Sokoplus<span className="text-gray-900">.</span>
            </Link>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:block flex-1 max-w-md mx-8 relative">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDesktopSuggestions(true)}
                  placeholder="Search products in Kenya..."
                  className="block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-all focus:shadow-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSuggestedProducts([]);
                    }}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-450 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </form>

            {/* Desktop Suggestions Dropdown */}
            <AnimatePresence>
              {showDesktopSuggestions && (search.trim() || suggestedProducts.length > 0) && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDesktopSuggestions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 mt-2 bg-white rounded-3xl border border-gray-100 shadow-2xl z-50 p-5 space-y-4 max-h-[80vh] overflow-y-auto"
                  >
                    {suggestedProducts.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instant Matches</div>
                        <div className="divide-y divide-gray-100">
                          {suggestedProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleProductSelect(p.id)}
                              className="flex items-center space-x-3 py-3 cursor-pointer hover:bg-gray-50 rounded-2xl px-2 group transition-all"
                            >
                              <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200/50">
                                {p.images?.[0] ? (
                                  <img referrerPolicy="no-referrer" src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <ShoppingBag size={16} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{p.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{p.category}</p>
                              </div>
                              <div className="text-sm font-black text-gray-950 whitespace-nowrap">
                                KES {p.price.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        No matches for "{search}"
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Nav Icons */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 mr-4">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} className="text-sm font-medium text-gray-600 hover:text-orange-600">
                  {link.label}
                </Link>
              ))}
            </div>

            <Link to="/wishlist" className="hidden md:inline-flex relative group p-2">
              <Heart className="text-gray-700 group-hover:text-red-500 transition-colors" size={24} />
              {user?.wishlist && user.wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {user.wishlist.length}
                </span>
              )}
            </Link>

            <Link to="/profile" className="hidden md:inline-flex p-2 group">
              <User className="text-gray-750 group-hover:text-orange-600 transition-colors" size={24} />
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
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter flex items-center">
                      <Award size={10} className="mr-0.5" /> {user.loyaltyPoints || 0} PTS
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Loyalty</span>
                  </div>
                  <Link to="/profile" className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full transition-colors">
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

            {/* Mobile Search Toggle */}
            <button
              onClick={() => {
                setIsMobileSearchOpen(!isMobileSearchOpen);
                setIsMobileMenuOpen(false);
              }}
              className="md:hidden p-2 text-gray-750 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Toggle Search"
            >
              {isMobileSearchOpen ? <X size={24} className="text-orange-600 animate-in spin-in duration-200" /> : <Search size={24} />}
            </button>

            <button 
              onClick={() => {
                setIsMobileMenuOpen(!isMobileMenuOpen);
                setIsMobileSearchOpen(false);
              }}
              className="md:hidden p-2 text-gray-750 hover:bg-gray-100 rounded-xl transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar Overlay */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="md:hidden border-b border-gray-100 bg-white"
          >
            <div className="px-4 py-4 space-y-4">
              <form onSubmit={handleSearch} className="relative w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search products in Kenya..."
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-505 sm:text-sm font-medium transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSuggestedProducts([]);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 animate-fade-in"
                  >
                    <X size={18} />
                  </button>
                )}
              </form>

              {/* Instant Search Suggestions for Mobile */}
              {suggestedProducts.length > 0 && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Instant Matches</div>
                  <div className="space-y-1 divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {suggestedProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleProductSelect(p.id)}
                        className="flex items-center space-x-3 py-3 cursor-pointer hover:bg-gray-55 group transition-all"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200/50">
                          {p.images?.[0] ? (
                            <img referrerPolicy="no-referrer" src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <ShoppingBag size={18} />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{p.category}</p>
                        </div>
                        <div className="text-sm font-black text-gray-900 whitespace-nowrap">
                          KES {p.price.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {search.trim() && suggestedProducts.length === 0 && (
                <div className="py-4 text-center text-xs text-gray-450 font-bold uppercase tracking-wider">
                  No instant matches for "{search}"
                </div>
              )}

              {/* Popular quick searches tags */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Popular categories</div>
                <div className="flex flex-wrap gap-2">
                  {["Fashion", "Electronics", "Local Crafts", "Groceries"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        navigate(`/?search=${encodeURIComponent(tag)}`);
                        setIsMobileSearchOpen(false);
                        setSearch("");
                      }}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 rounded-xl text-xs font-bold text-gray-650 border border-gray-150 transition-all uppercase tracking-tight"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </form>

              {/* Links */}
              <div className="flex flex-col space-y-4">
                {/* Home */}
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-black text-gray-900 flex items-center justify-between group py-1"
                >
                  <span>Home</span>
                  <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                    <ShoppingBag size={24} />
                  </div>
                </Link>

                {/* Blog */}
                <Link
                  to="/blog"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-black text-gray-900 flex items-center justify-between group py-1"
                >
                  <span>Blog</span>
                  <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                    <Award size={24} />
                  </div>
                </Link>

                {/* Wishlist */}
                <Link
                  to="/wishlist"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-black text-gray-900 flex items-center justify-between group py-1"
                >
                  <div className="flex items-center space-x-2">
                    <span>Wishlist</span>
                    {user?.wishlist && user.wishlist.length > 0 && (
                      <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                        {user.wishlist.length}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 group-hover:text-red-500 transition-colors">
                    <Heart size={24} />
                  </div>
                </Link>

                {/* Profile */}
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-black text-gray-900 flex items-center justify-between group py-1"
                >
                  <span>Account Profile</span>
                  <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                    <User size={24} />
                  </div>
                </Link>

                {/* Admin Control */}
                {user?.isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-black text-gray-900 flex items-center justify-between group py-1"
                  >
                    <span className="text-orange-600">Admin Control</span>
                    <div className="text-orange-600">
                      <Award size={24} />
                    </div>
                  </Link>
                )}
              </div>

              <div className="mt-auto pt-8 border-t border-gray-100 flex flex-col space-y-4">
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-2xl">
                      <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.displayName[0]}
                      </div>
                      <div className="flex-grow">
                        <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">{user.email}</p>
                          <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-black text-orange-600 border border-orange-100 flex items-center shadow-sm">
                            <Award size={10} className="mr-1" /> {user.loyaltyPoints || 0}
                          </span>
                        </div>
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
