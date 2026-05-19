import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile } from "../types";
import { Heart, ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import EmptyState from "../components/EmptyState";

interface WishlistProps {
  user: UserProfile | null;
}

export default function Wishlist({ user }: WishlistProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState("default");
  const [loading, setLoading] = useState(true);

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;
    
    if (!user.emailVerified) {
      toast.error("Please verify your email to update wishlist");
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        wishlist: arrayRemove(productId)
      });
      toast.success("Removed from wishlist");
      // Local state update for immediate feedback
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error("Wishlist error:", error);
      toast.error("Failed to remove from wishlist");
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    if (sortBy === "name-desc") return b.name.localeCompare(a.name);
    return 0; // default
  });

  useEffect(() => {
    async function fetchWishlist() {
      if (!user?.wishlist || user.wishlist.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const fetchedProducts: Product[] = [];
        for (const id of user.wishlist) {
          const docSnap = await getDoc(doc(db, "products", id));
          if (docSnap.exists()) {
            fetchedProducts.push({ id: docSnap.id, ...docSnap.data() } as Product);
          }
        }
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Error fetching wishlist:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchWishlist();
  }, [user?.wishlist]);

  if (!user) return <Navigate to="/login" />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEO title="My Wishlist" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 flex items-center">
            <Heart className="mr-3 text-red-500" fill="currentColor" size={32} />
            My Wishlist
          </h1>
          <p className="text-gray-500 text-lg">Items you've saved for later. Ready to make them yours?</p>
        </div>

        {products.length > 0 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-100 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-orange-600 transition-all cursor-pointer shadow-sm"
            >
              <option value="default">Recently Added</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
              <option value="name-desc">Name: Z-A</option>
            </select>
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState 
          icon={Heart}
          title="Your wishlist is empty"
          description="Explore our collection and save your favorite items by clicking the heart icon. We'll keep them safe for you."
          actionLabel="Start Shopping"
          actionPath="/"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {sortedProducts.map((product) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={product.id}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100"
            >
              <Link to={`/product/${product.id}`} className="block aspect-[4/5] overflow-hidden relative">
                {product.images?.filter(img => !!img && img.trim() !== "")[0] ? (
                  <img
                    src={product.images.filter(img => !!img && img.trim() !== "")[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-200">
                    <ShoppingBag size={64} />
                  </div>
                )}
                <button
                  onClick={(e) => toggleWishlist(product.id, e)}
                  className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                >
                  <Trash2 size={20} />
                </button>
              </Link>
              <div className="p-6 space-y-4">
                <div>
                  <Link to={`/product/${product.id}`} className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1">
                    {product.name}
                  </Link>
                  <p className="text-sm text-gray-500 font-medium">{product.category}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-black text-orange-600">KES {product.price.toLocaleString()}</p>
                </div>
                <Link
                  to={`/product/${product.id}`}
                  className="w-full bg-gray-50 text-gray-900 py-3 rounded-xl font-bold text-center block hover:bg-orange-600 hover:text-white transition-all underline-none"
                >
                  View Details
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
