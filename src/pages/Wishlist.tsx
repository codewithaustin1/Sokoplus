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
import { useCart } from "../lib/CartContext";
import { useCurrency } from "../lib/CurrencyContext";
import { useLanguage } from "../lib/LanguageContext";
import { trackEvent } from "../lib/analytics";
import { FastImage } from "../components/FastImage";
import { productCache } from "../utils/productCache";
import { AddToCartButton } from "../components/AddToCartButton";

interface WishlistProps {
  user: UserProfile | null;
}

export default function Wishlist({ user }: WishlistProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState("default");
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

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
            const prod = { id: docSnap.id, ...docSnap.data() } as Product;
            fetchedProducts.push(prod);
            productCache.set(prod.id, prod);
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
      <SEO title={t("My Wishlist")} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 flex items-center">
            <Heart className="mr-3 text-red-500" fill="currentColor" size={32} />
            {t("My Wishlist")}
          </h1>
          <p className="text-gray-500 text-lg">{t("Items you've saved for later. Ready to make them yours?")}</p>
        </div>

        {products.length > 0 && (
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t("Sort by")}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-gray-100 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-orange-600 transition-all cursor-pointer shadow-sm"
            >
              <option value="default">{t("Recently Added")}</option>
              <option value="price-low">{t("Price: Low to High")}</option>
              <option value="price-high">{t("Price: High to Low")}</option>
              <option value="name-asc">{t("Name: A-Z")}</option>
              <option value="name-desc">{t("Name: Z-A")}</option>
            </select>
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState 
          icon={Heart}
          title={t("Your wishlist is empty")}
          description={t("Explore our collection and save your favorite items by clicking the heart icon. We'll keep them safe for you.")}
          actionLabel={t("Start Shopping")}
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
              className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col h-full justify-between"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-gray-50">
                <Link to={`/product/${product.id}`} state={{ product }} className="block w-full h-full">
                  <div className="w-full h-full group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                    <FastImage 
                      src={product.images?.filter(img => !!img && img.trim() !== "")[0] || ""} 
                      alt={product.name} 
                      fallbackIconSize={64}
                    />
                  </div>
                </Link>
                
                {/* Always visible Trash / Remove button on overlay */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 500, damping: 12 }}
                  onClick={(e) => toggleWishlist(product.id, e)}
                  className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors shadow-md z-10 cursor-pointer"
                  title="Remove from wishlist"
                >
                  <Trash2 size={18} />
                </motion.button>

                {/* Stock Tag on image overlay */}
                <span className="absolute bottom-4 left-4 z-10">
                  {product.stock === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 shadow-sm border border-red-200/50">
                      {t("Out of Stock")}
                    </span>
                  ) : product.stock <= 5 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm border border-amber-200/50">
                      {t("Low Stock")} ({product.stock})
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 shadow-sm border border-green-200/50">
                      {t("In Stock")}
                    </span>
                  )}
                </span>

                {/* Discount overlay badge */}
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="absolute top-4 left-4 bg-red-600 border border-red-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-xl shadow-md z-10 animate-pulse-subtle">
                    -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 105 / 1.05)}%
                  </span>
                )}
              </div>
              
              <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      {product.category}
                    </span>
                  </div>
                  <Link to={`/product/${product.id}`} state={{ product }} className="text-xl font-bold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1">
                    {product.name}
                  </Link>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-gray-900 leading-none">{formatPrice(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-xs text-gray-400 line-through mt-1 font-medium select-none">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-2 pt-1 font-sans">
                  <Link
                    to={`/product/${product.id}`}
                    state={{ product }}
                    className="col-span-2 text-center bg-gray-50 text-gray-700 py-3 rounded-xl font-black text-xs hover:bg-gray-100 hover:text-gray-950 transition-all flex items-center justify-center border border-gray-100"
                  >
                    {t("Details")}
                  </Link>
                  <AddToCartButton
                    label={product.stock > 0 ? t("addToCart") : t("outOfStock")}
                    successLabel={t("added")}
                    disabled={product.stock === 0}
                    onClick={() => {
                      addToCart({
                        productId: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: 1,
                        image: product.images?.filter((img) => !!img && img.trim() !== "")[0] || "",
                      });
                      trackEvent("add_to_cart", {
                        items: [{
                          item_id: product.id,
                          item_name: product.name,
                          price: product.price,
                          quantity: 1,
                          item_category: product.category
                        }]
                      });
                      toast.success("Added to cart!");
                    }}
                    className={`col-span-3 py-3 rounded-xl font-black text-xs transition-colors flex items-center justify-center ${
                      product.stock === 0
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-orange-600 hover:shadow-md hover:shadow-orange-100 cursor-pointer"
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
