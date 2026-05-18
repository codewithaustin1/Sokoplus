import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Menu, Search, LogOut } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { auth } from "../lib/firebase";
import { UserProfile } from "../types";

interface NavbarProps {
  user: UserProfile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const { items } = useCart();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  };

  return (
    <nav id="main-nav" className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold tracking-tighter text-orange-600">
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
            <Link to="/blog" className="text-sm font-medium text-gray-600 hover:text-orange-600 hidden sm:block">
              Blog
            </Link>
            
            {user?.isAdmin && (
              <Link to="/admin" className="text-sm font-medium text-gray-600 hover:text-orange-600 hidden sm:block">
                Admin
              </Link>
            )}

            <Link to="/cart" className="relative group p-2">
              <ShoppingCart className="text-gray-700 group-hover:text-orange-600 transition-colors" size={24} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center space-x-2">
                <Link to="/login" className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <User size={24} className="text-gray-700" />
                </Link>
                <button 
                  onClick={() => auth.signOut()}
                  className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-700 transition-colors"
              >
                Sign In
              </Link>
            )}

            <button className="md:hidden p-2 text-gray-700">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
