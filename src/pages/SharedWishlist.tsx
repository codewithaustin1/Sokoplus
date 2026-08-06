import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";
import { Heart, ShoppingBag, ArrowRight } from "lucide-react";
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

export default function SharedWishlist() {
  const { shareId } = useParams<{ shareId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    async function fetchSharedWishlist() {
      if (!shareId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const shareSnap = await getDoc(doc(db, "shared_wishlists", shareId));
        if (shareSnap.exists()) {
          const shareData = shareSnap.data();
          const productIds: string[] = shareData.productIds || [];
          setOwnerName(shareData.ownerName || "");

          const fetchedProducts: Product[] = [];
          for (const id of productIds) {
            // Check cache first
            if (productCache.has(id)) {
              fetchedProducts.push(productCache.get(id)!);
              continue;
            }
            const prodSnap = await getDoc(doc(db, "products", id));
            if (prodSnap.exists()) {
              const prod = { id: prodSnap.id, ...prodSnap.data() } as Product;
              fetchedProducts.push(prod);
              productCache.set(prod.id, prod);
            }
          }
          setProducts(fetchedProducts);
        } else {
          toast.error("Shared wishlist not found");
        }
      } catch (error) {
        console.error("Error fetching shared wishlist:", error);
        toast.error("Could not load shared wishlist");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedWishlist();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const wishlistTitle = ownerName 
    ? `${ownerName}'s Wishlist` 
    : "Shared Wishlist";

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEO title={wishlistTitle} />
      
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-full border border-orange-100 dark:border-orange-900/30">
          <Heart className="text-orange-600 animate-pulse-subtle" fill="currentColor" size={36} />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          {wishlistTitle}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl">
          {t("Explore these handpicked artisan crafts saved by a SokoPlus user. Ready to add them to your cart?")}
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyState 
          icon={Heart}
          title={t("No items found")}
          description={t("This shared wishlist is empty or the items are no longer available.")}
          actionLabel={t("Browse Products")}
          actionPath="/"
        />
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={product.id}
                className="group bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 dark:border-gray-800/60 flex flex-col h-full justify-between"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gray-50 dark:bg-gray-950">
                  <Link to={`/product/${product.id}`} state={{ product }} className="block w-full h-full">
                    <div className="w-full h-full group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                      <FastImage 
                        src={product.images?.filter(img => !!img && img.trim() !== "")[0] || ""} 
                        alt={product.name} 
                        fallbackIconSize={64}
                      />
                    </div>
                  </Link>

                  {/* Stock Tag */}
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
                        {product.stock} {t("In Stock")}
                      </span>
                    )}
                  </span>

                  {/* Discount Tag */}
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="absolute top-4 left-4 bg-red-600 border border-red-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-xl shadow-md z-10">
                      -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider block mb-1">
                      {product.category}
                    </span>
                    <Link to={`/product/${product.id}`} state={{ product }} className="text-xl font-bold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors line-clamp-1">
                      {product.name}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 line-through mt-1 font-medium select-none">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-1 font-sans">
                    <Link
                      to={`/product/${product.id}`}
                      state={{ product }}
                      className="col-span-2 text-center bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-black text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center border border-gray-100 dark:border-gray-700/50"
                    >
                      {t("Details")}
                    </Link>
                    <AddToCartButton
                      product={product}
                      productId={product.id}
                      className="col-span-3 py-3 rounded-xl font-black text-xs"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* SokoPlus Promo Callout */}
          <div className="bg-orange-50 dark:bg-orange-950/10 rounded-3xl p-8 border border-orange-100 dark:border-orange-900/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {t("Love these selections?")}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl">
                {t("Join SokoPlus today to create your own personalized wishlists, discover unique local crafts, and support brilliant artisans across the region.")}
              </p>
            </div>
            <Link 
              to="/" 
              className="inline-flex items-center px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg whitespace-nowrap"
            >
              {t("Explore Marketplace")}
              <ArrowRight className="ml-2" size={18} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
