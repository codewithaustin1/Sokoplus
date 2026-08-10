import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayRemove, collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile } from "../types";
import { Heart, ShoppingBag, ArrowRight, Trash2, Share2, Copy, Check, Facebook, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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

  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleShareWishlist = async () => {
    if (!user || products.length === 0) return;
    
    if (shareUrl) {
      setShowShareModal(true);
      return;
    }

    setSharing(true);
    try {
      const docRef = await addDoc(collection(db, "shared_wishlists"), {
        productIds: products.map(p => p.id),
        ownerName: user.displayName || user.email?.split("@")[0] || "A user",
        createdAt: new Date().toISOString()
      });
      const url = window.location.origin + "/wishlist/shared/" + docRef.id;
      setShareUrl(url);
      setShowShareModal(true);
      toast.success(t("Shareable link generated successfully!"));
    } catch (error) {
      console.error("Error sharing wishlist:", error);
      toast.error(t("Failed to generate shareable link. Please try again."));
    } finally {
      setSharing(false);
    }
  };

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;
    
    if (!user.emailVerified) {
      toast.error("Please verify your email to update wishlist");
      return;
    }

    const currentWishlist = user.wishlist || [];
    const newWishlist = currentWishlist.filter(itemId => itemId !== productId);
    const originalProducts = [...products];

    // Optimistic user state update (helps instant count in Navbar / sidebar)
    window.dispatchEvent(new CustomEvent("optimistic-user-update", { detail: { wishlist: newWishlist } }));
    toast.success("Removed from wishlist");
    // Local state update for immediate feedback
    setProducts(prev => prev.filter(p => p.id !== productId));

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        wishlist: arrayRemove(productId)
      });
    } catch (error) {
      console.error("Wishlist error:", error);
      // Rollback
      window.dispatchEvent(new CustomEvent("optimistic-user-update", { detail: { wishlist: currentWishlist } }));
      setProducts(originalProducts);
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleShareWishlist}
              disabled={sharing}
              className="inline-flex items-center justify-center p-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-xl transition-all shadow-sm cursor-pointer hover:shadow-md active:scale-95"
              title={t("Share Wishlist")}
            >
              {sharing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Share2 size={20} />
              )}
            </button>

            <div className="flex items-center justify-between sm:justify-start space-x-3 bg-white border border-gray-100 px-4 py-2.5 rounded-xl shadow-sm">
              <span className="text-xs font-black text-gray-400 uppercase tracking-wider">{t("Sort by")}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer"
              >
                <option value="default">{t("Recently Added")}</option>
                <option value="price-low">{t("Price: Low to High")}</option>
                <option value="price-high">{t("Price: High to Low")}</option>
                <option value="name-asc">{t("Name: A-Z")}</option>
                <option value="name-desc">{t("Name: Z-A")}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Share Wishlist Modal */}
      <AnimatePresence>
        {showShareModal && shareUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-800/60 max-w-md w-full relative z-10 space-y-6"
            >
              <div className="flex justify-between items-start">
                <div className="pr-4">
                  <h3 className="text-xl font-black text-gray-950 dark:text-white flex items-center gap-2">
                    <Share2 className="text-orange-600" size={20} />
                    {t("share your wishlist")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
                    {t("anyone with this unique link can view your curated collection and add items to their cart.")}
                  </p>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex-shrink-0"
                >
                  <span className="sr-only">{t("close")}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Popular Sharing Platforms */}
              <div className="space-y-3">
                <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                  {t("Popular Platforms")}
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(t("Check out my wishlist: ") + shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors font-bold text-sm"
                  >
                    <div className="bg-emerald-600 text-white p-2 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </div>
                    {t("WhatsApp")}
                  </a>

                  {/* Facebook */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors font-bold text-sm"
                  >
                    <div className="bg-[#1877F2] text-white p-2 rounded-xl flex items-center justify-center">
                      <Facebook size={16} />
                    </div>
                    {t("Facebook")}
                  </a>

                  {/* X / Twitter */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t("Check out my SokoPlus wishlist!"))}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 text-gray-800 dark:text-gray-300 border border-gray-200/50 dark:border-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-sm"
                  >
                    <div className="bg-black text-white p-2 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    {t("Twitter")}
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(t("My SokoPlus Wishlist"))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors font-bold text-sm"
                  >
                    <div className="bg-[#229ED9] text-white p-2 rounded-xl flex items-center justify-center">
                      <Send size={16} className="-rotate-45 relative top-[1px]" />
                    </div>
                    {t("Telegram")}
                  </a>

                  {/* TikTok */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success(t("wishlist link copied! paste it in your tiktok bio or dm."));
                      window.open("https://www.tiktok.com", "_blank", "noopener,noreferrer");
                    }}
                    className="col-span-2 flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/40 text-gray-800 dark:text-gray-300 border border-gray-200/50 dark:border-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-sm text-left w-full cursor-pointer"
                  >
                    <div className="bg-black text-white p-2 rounded-xl flex items-center justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .57.04.84.13V9.5a7.21 7.21 0 0 0-1-.07 6.34 6.34 0 0 0-6.33 6.33 6.34 6.34 0 0 0 6.33 6.33 6.34 6.34 0 0 0 6.33-6.33V8.66A9.6 9.6 0 0 0 19.6 10v-3.31z"/>
                      </svg>
                    </div>
                    {t("TikTok")}
                  </button>
                </div>
              </div>

              {/* Copy Link Section */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                  {t("Copy Link")}
                </span>
                
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-950 border border-gray-200/60 dark:border-gray-800 p-1.5 pl-4 rounded-2xl shadow-inner">
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate flex-grow text-left">
                    {shareUrl}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      toast.success(t("Copied to clipboard!"));
                      setTimeout(() => setCopied(false), 3000);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-colors cursor-pointer flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check size={14} />
                        {t("copied!")}
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        {t("Copy")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#D32F2F] text-white shadow-sm">
                      {t("Out of Stock")}
                    </span>
                  ) : product.stock <= 5 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FF8C00] text-white shadow-sm">
                      {t("Low Stock")} ({product.stock})
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#28b45b] to-[#16a34a] text-white shadow-sm">
                      {product.stock} {t("In Stock")}
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
                    product={product}
                    productId={product.id}
                    className="col-span-3 py-3 rounded-xl font-black text-xs"
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
