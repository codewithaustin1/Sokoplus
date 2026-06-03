import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, limit, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, orderBy, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile, Review } from "../types";
import { ShoppingBag, Star, ShieldCheck, Truck, RefreshCw, Heart, Send, Sparkles, Layers, Share2, Bell } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useCurrency } from "../lib/CurrencyContext";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import axios from "axios";
import SEO from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { FastImage } from "../components/FastImage";
import { prefetchProductAssets } from "../utils/imagePrefetcher";
import { productCache } from "../utils/productCache";
import Markdown from "react-markdown";

interface ProductDetailsProps {
  user: UserProfile | null;
}

const recommendationCache = new Map<string, { items: Product[]; source: "ai" | "category" }>();

export default function ProductDetails({ user }: ProductDetailsProps) {
  const { id } = useParams();
  const location = useLocation();
  const [product, setProduct] = useState<Product | null>(() => {
    if (id) {
      const cached = productCache.get(id);
      if (cached) return cached;
    }
    const stateProduct = location.state?.product as Product | undefined;
    if (stateProduct && stateProduct.id === id) {
      productCache.set(id, stateProduct);
      return stateProduct;
    }
    return null;
  });
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recSource, setRecSource] = useState<"ai" | "category">("category");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(() => {
    if (id) {
      if (productCache.has(id)) return false;
    }
    const stateProduct = location.state?.product as Product | undefined;
    if (stateProduct && stateProduct.id === id) return false;
    return true;
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [activeImage, setActiveImage] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  const { addToCart } = useCart();
  const { currency, setCurrency, formatPrice } = useCurrency();

  const [alertEmail, setAlertEmail] = useState(user?.email || "");
  const [isSettingAlert, setIsSettingAlert] = useState(false);
  const [alertSetSuccessfully, setAlertSetSuccessfully] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setAlertEmail(user.email);
    }
  }, [user]);

  const handleSetPriceDropAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!alertEmail || alertEmail.trim() === "" || !alertEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSettingAlert(true);
    try {
      await addDoc(collection(db, "price_drop_alerts"), {
        productId: product.id,
        productName: product.name,
        email: alertEmail.trim(),
        userId: user ? user.uid : null,
        targetPrice: product.price,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      setAlertSetSuccessfully(true);
      toast.success("Price drop notification alert set!");
      trackEvent("set_price_alert", {
        item_id: product.id,
        item_name: product.name,
        email: alertEmail.trim(),
      });
    } catch (err) {
      console.error("Error setting price alert:", err);
      toast.error("Failed to set alert. Please try again.");
    } finally {
      setIsSettingAlert(false);
    }
  };

  const isWishlisted = user?.wishlist?.includes(id || "") || false;

  const toggleWishlist = async () => {
    if (!user) {
      toast.error("Please login to save to wishlist");
      return;
    }
    if (!user.emailVerified) {
      toast.error("Please verify your email to update wishlist");
      return;
    }
    if (!id) return;

    try {
      const userRef = doc(db, "users", user.uid);
      if (isWishlisted) {
        await updateDoc(userRef, {
          wishlist: arrayRemove(id)
        });
        toast.success("Removed from wishlist");
      } else {
        await updateDoc(userRef, {
          wishlist: arrayUnion(id)
        });
        toast.success("Added to wishlist");
      }
    } catch (error) {
      console.error("Wishlist error:", error);
      toast.error("Failed to update wishlist");
    }
  };

  const fallbackShare = () => {
    if (!product) return;
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard! Share it with your friends.");
      trackEvent("share", {
        item_id: product.id,
        item_name: product.name,
        method: "Clipboard Fallback"
      });
    } catch (e) {
      console.error("Clipboard copy failed:", e);
      toast.error("Sharing not supported on this browser.");
    }
  };

  const handleShare = async () => {
    if (!product) return;
    const shareData = {
      title: product.name,
      text: `Buy ${product.name} on Sokoplus for only ${formatPrice(product.price)}!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
        trackEvent("share", {
          item_id: product.id,
          item_name: product.name,
          method: "Web Share API"
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
          fallbackShare();
        }
      }
    } else {
      fallbackShare();
    }
  };

  const fetchReviews = async () => {
    if (!id) return;
    try {
      const q = query(
        collection(db, "reviews"),
        where("productId", "==", id),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    } catch (error) {
      console.error("Fetch reviews error:", error);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to review products");
      return;
    }
    if (!user.emailVerified) {
      toast.error("Please verify your email to leave a review");
      return;
    }
    if (!id || !newReview.comment.trim()) return;

    setSubmittingReview(true);
    try {
      const reviewData = {
        productId: id,
        userId: user.uid,
        userName: user.displayName,
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "reviews"), reviewData);
      
      // Update product rating (naive average for now)
      if (product) {
        const newCount = (product.reviewCount || 0) + 1;
        const newRating = ((product.rating || 5) * (product.reviewCount || 0) + newReview.rating) / newCount;
        
        await updateDoc(doc(db, "products", id), {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newCount
        });
      }

      toast.success("Review submitted!");
      setNewReview({ rating: 5, comment: "" });
      fetchReviews();
    } catch (error) {
      console.error("Review error:", error);
      toast.error("Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      const hasProductPreloaded = productCache.has(id) || (location.state?.product && (location.state.product as Product).id === id);
      if (!hasProductPreloaded) {
        setLoading(true);
      }
      try {
        const docRef = doc(db, "products", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() } as Product;
          if (p.active === false && !user?.isAdmin) {
            setProduct(null);
            setLoading(false);
            return;
          }
          setProduct(p);
          productCache.set(snap.id, p);
          prefetchProductAssets(p);
          trackEvent("view_item", {
            currency: "KES",
            value: p.price,
            items: [{
              item_id: p.id,
              item_name: p.name,
              price: p.price,
              item_category: p.category
            }]
          });
          
          fetchReviews();

          // Fetch recommendations via AI
          if (recommendationCache.has(id)) {
            const cached = recommendationCache.get(id);
            if (cached) {
              setRecommendations(cached.items);
              setRecSource(cached.source);
            }
            return;
          }

          const allProductsSnap = await getDocs(query(collection(db, "products"), limit(20)));
          const allProducts = allProductsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Product))
            .filter(ap => ap.active !== false);
          
          try {
            const recResponse = await axios.post("/api/recommendations", {
              history: [p.category],
              products: allProducts.map(ap => ({ id: ap.id, name: ap.name, category: ap.category }))
            });
            const recIds = recResponse.data.recommendationIds;
            const recs = allProducts.filter(ap => recIds.includes(ap.id)).slice(0, 4);
            setRecommendations(recs);
            recs.forEach(rp => productCache.set(rp.id, rp));
            setRecSource("ai");
            recommendationCache.set(id, { items: recs, source: "ai" });
          } catch (e: any) {
            // Fallback to same category silently for quota errors
            if (e.response?.status === 429) {
              console.log("AI recommendations on cooldown, using category fallback.");
            } else {
              console.warn("AI recommendation error:", e.message);
            }
            
            const fallbacks = allProducts.filter(ap => ap.category === p.category && ap.id !== p.id).slice(0, 4);
            setRecommendations(fallbacks);
            fallbacks.forEach(rp => productCache.set(rp.id, rp));
            setRecSource("category");
            // Cache the fallback to prevent retrying the 429 endpoint for this product
            recommendationCache.set(id, { items: fallbacks, source: "category" });
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading details...</div>;
  if (!product) return <div className="h-screen flex items-center justify-center">Product not found</div>;

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": product.images || [product.images?.[0]],
    "description": product.description,
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Sokoplus"
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": currency || "KES",
      "price": product.price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating || "4.5",
      "reviewCount": product.reviewCount || "12"
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEO 
        title={product.name}
        description={product.description}
        image={product.images?.[0]}
        type="product"
        schema={productSchema}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-4">
          <div 
            className="group relative aspect-square bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in"
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
            onMouseMove={handleMouseMove}
          >
            <div 
              className="w-full h-full"
              style={{
                transform: isZoomed ? "scale(2.2)" : "scale(1)",
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transition: isZoomed ? "transform 0.05s ease-out" : "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)"
              }}
            >
              <FastImage 
                src={product.images?.[activeImage] || ""} 
                alt={product.name} 
                fallbackIconSize={100}
                priority={true}
              />
            </div>
            {/* Elegant overlay hint */}
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-950/80 backdrop-blur-md text-white text-[11px] px-3.5 py-1.5 rounded-full pointer-events-none select-none font-bold tracking-wide transition-all ${isZoomed ? "opacity-0 scale-95" : "opacity-0 group-hover:opacity-100 scale-100 duration-300"}`}>
              Move mouse to zoom & pan
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {product.images?.filter(img => !!img && img.trim() !== "").map((img, i) => (
              <div 
                key={i} 
                onClick={() => setActiveImage(i)}
                className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${activeImage === i ? "border-orange-600 scale-95 shadow-lg animate-pulse" : "border-transparent bg-gray-50 opacity-70 hover:opacity-100"}`}
              >
                <FastImage 
                  src={img} 
                  alt={`${product.name} thumbnail ${i}`} 
                  fallbackIconSize={30}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="inline-block px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold uppercase tracking-widest">
              {product.category}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900">{product.name}</h1>
            {product.artisan && (
              <div className="flex items-center space-x-2 text-xs font-semibold text-gray-655 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 w-fit">
                <span className="text-gray-400">By:</span>
                <span className="font-extrabold text-orange-600">{product.artisan}</span>
              </div>
            )}
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-yellow-400">
                <Star fill="currentColor" size={20} />
                <span className="ml-1 text-gray-900 font-bold">{product.rating || 4.5}</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">{product.reviewCount || 12} Happy Customers</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-gray-100">
            <div className="flex items-baseline space-x-3">
              <p className="text-4xl font-black text-orange-600">{formatPrice(product.price)}</p>
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="flex items-center space-x-2">
                  <span className="text-lg text-gray-400 line-through font-semibold">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="bg-red-50 text-red-600 text-xs font-extrabold px-2.5 py-1 rounded-xl border border-red-100 uppercase animate-pulse-subtle">
                    Save {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 105 / 1.05)}%
                  </span>
                </div>
              )}
            </div>
            
            {/* Currency Switching Pill */}
            <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 items-center space-x-1 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrency("KES")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  currency === "KES"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-950"
                }`}
              >
                KES
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-950"
                }`}
              >
                USD
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${product.stock > 0 ? "bg-green-500" : "bg-red-500"}`} />
            <p className={`text-sm font-bold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
              {product.stock > 0 ? `${product.stock} units in stock` : "Out of stock"}
            </p>
          </div>

          <div className="text-gray-650 leading-relaxed text-sm select-text border-t border-b border-gray-100 py-6 my-6 bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Product Description & Details</h3>
            <Markdown
              components={{
                h2: ({ ...props }) => (
                  <h2
                    className="text-lg font-black text-gray-900 mt-5 first:mt-0 mb-3 border-b border-gray-100 pb-1 font-sans"
                    {...props}
                  />
                ),
                h3: ({ ...props }) => (
                  <h3 className="text-base font-bold text-gray-850 mt-4 mb-2 font-sans" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4 font-sans" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc pl-5 mb-4 space-y-1.5 text-sm text-gray-700 font-sans" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-sm text-gray-700 font-sans" {...props} />
                ),
                li: ({ ...props }) => <li className="text-gray-700 font-medium font-sans" {...props} />,
                a: ({ ...props }) => (
                  <a
                    className="text-orange-600 hover:text-orange-700 underline font-semibold transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote
                    className="border-l-4 border-orange-500 pl-4 italic text-gray-600 my-4 bg-gray-50 py-1 pr-2 rounded-r-lg"
                    {...props}
                  />
                ),
                strong: ({ ...props }) => <strong className="font-extrabold text-gray-950" {...props} />,
                em: ({ ...props }) => <em className="italic" {...props} />,
              }}
            >
              {product.description || "No description provided."}
            </Markdown>

            {product.artisan && (
              <div className="mt-8 p-6 bg-gradient-to-br from-orange-50/20 via-orange-50/5 to-transparent border border-orange-100 rounded-3xl space-y-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-full bg-orange-100/60 text-orange-600 border border-orange-200/40 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {product.artisan.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Meet the Craftsman</h4>
                    <p className="text-base font-black text-gray-900 leading-tight">{product.artisan}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-550 leading-relaxed font-semibold">
                  Every selection in our marketplace empowers independent creators like <strong>{product.artisan}</strong>. Sokoplus works closely with Kenyan artisan guilds, ensuring fair wages, safe workshops, and community growth.
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <motion.button 
              whileHover={product.stock > 0 ? { scale: 1.01, y: -1 } : {}}
              whileTap={product.stock > 0 ? { scale: 0.98, y: 0 } : {}}
              transition={{ type: "spring", stiffness: 450, damping: 12 }}
              onClick={() => {
                addToCart({ productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0] || "" });
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
              disabled={product.stock <= 0}
              className="flex-grow bg-gray-900 text-white py-5 rounded-2xl font-black text-lg sm:text-xl hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
            >
              {product.stock > 0 ? "Add to Cart" : "Out of Stock"} <ShoppingBag className="ml-3" size={24} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 450, damping: 12 }}
              onClick={toggleWishlist}
              className={`p-5 border rounded-2xl transition-colors cursor-pointer flex-shrink-0 ${
                isWishlisted ? "bg-red-50 border-red-100 text-red-500" : "border-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"
              }`}
              title="Add to Wishlist"
            >
              <Heart size={24} fill={isWishlisted ? "currentColor" : "none"} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 450, damping: 12 }}
              onClick={handleShare}
              className="p-5 border border-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-600 rounded-2xl transition-colors cursor-pointer flex-shrink-0"
              title="Share Product"
            >
              <Share2 size={24} />
            </motion.button>
          </div>

          {/* Price Drop Alert Section */}
          <div className="p-5 bg-orange-50/10 border border-orange-100/30 rounded-2xl space-y-3">
            <div className="flex items-center space-x-3 text-orange-600">
              <Bell size={20} className="animate-pulse" />
              <h4 className="font-bold text-sm text-gray-900">Notify Me of Price Drops</h4>
            </div>
            <p className="text-xs text-gray-500 leading-normal">
              Interested in this item? Enter your email to be automatically notified when the price of <strong>{product.name}</strong> decreases below {formatPrice(product.price)}.
            </p>
            {alertSetSuccessfully ? (
              <div className="p-3 bg-green-50 border border-green-150 rounded-xl flex items-center justify-center space-x-2 text-green-700 text-xs font-semibold animate-fade-in">
                <span>✓ Price alert set successfully for {alertEmail}!</span>
              </div>
            ) : (
              <form onSubmit={handleSetPriceDropAlert} className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="flex-grow p-3 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-medium transition-all"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isSettingAlert}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white text-xs font-extrabold px-5 py-3 rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  {isSettingAlert ? "Setting..." : "Alert Me"}
                </button>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Truck size={20} /></div>
              <p className="text-xs font-bold text-gray-500">Fast Delivery</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ShieldCheck size={20} /></div>
              <p className="text-xs font-bold text-gray-500">Authentic Goods</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg"><RefreshCw size={20} /></div>
              <p className="text-xs font-bold text-gray-500">Easy Returns</p>
            </div>
          </div>
        </div>
      </div>

      {/* Related / Smart Recommendations Section */}
      {recommendations.length > 0 && (
        <section className="mt-24 space-y-8 border-t border-gray-100 pt-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-gray-900">You Might Also Like</h2>
            </div>
          </div>

           <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
             {recommendations.map((p) => (
               <motion.article 
                 onMouseEnter={() => prefetchProductAssets(p)}
                 onTouchStart={() => prefetchProductAssets(p)}
                 whileHover={{ y: -6 }}
                 key={p.id} 
                 className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col h-full relative"
               >
                 <div className="aspect-square bg-gray-50 overflow-hidden relative">
                    <FastImage 
                      src={p.images?.filter(img => !!img && img.trim() !== "")[0] || ""} 
                      alt={p.name} 
                      fallbackIconSize={48}
                    />
                   {/* Stock Badge Overlay */}
                   <span className="absolute top-3 left-3 z-10">
                     {p.stock === 0 ? (
                       <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 shadow-sm">
                         Out of Stock
                       </span>
                     ) : p.stock <= 5 ? (
                       <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm">
                         Low Stock
                       </span>
                     ) : (
                       <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 shadow-sm">
                         In Stock
                       </span>
                     )}
                   </span>
                </div>
                
                <div className="p-5 flex flex-col flex-grow justify-between space-y-3">
                   <div className="space-y-1">
                     <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                       {p.category}
                     </span>
                     <Link 
                       to={`/product/${p.id}`} 
                       state={{ product: p }}
                       className="block text-sm font-extrabold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1"
                     >
                       {p.name}
                     </Link>
                   </div>
                   
                   <div className="flex items-center justify-between pt-1">
                     <span className="text-base font-black text-gray-900">{formatPrice(p.price)}</span>
                     <Link 
                       to={`/product/${p.id}`}
                       state={{ product: p }}
                       className="text-xs font-black uppercase tracking-wider text-orange-600 hover:text-orange-700 flex items-center space-x-1"
                     >
                       <span>View Details</span>
                     </Link>
                   </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* Reviews Section */}
      <section className="mt-24 grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-gray-100 pt-16">
        <div className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Customer Reviews</h2>
            <div className="flex items-center space-x-4">
              <div className="text-5xl font-black text-gray-900">{product.rating || 5}</div>
              <div>
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill={i < Math.round(product.rating || 5) ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="text-sm text-gray-500 font-medium">Based on {product.reviewCount || 0} reviews</p>
              </div>
            </div>
          </div>

          {user ? (
            <form onSubmit={submitReview} className="bg-gray-50 p-6 rounded-3xl space-y-4 border border-gray-100">
              <h3 className="font-bold text-gray-900">Leave a Review</h3>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                    className={`transition-all ${star <= newReview.rating ? "text-yellow-400" : "text-gray-300"}`}
                  >
                    <Star size={24} fill={star <= newReview.rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="Share your thoughts about this product..."
                className="w-full bg-white border border-gray-100 rounded-xl p-4 min-h-[120px] outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                required
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
                <Send size={18} className="ml-2" />
              </button>
            </form>
          ) : (
            <div className="bg-gray-50 p-8 rounded-3xl text-center border border-dashed border-gray-200">
              <p className="text-gray-500 mb-4">You must be logged in to leave a review.</p>
              <Link to="/login" className="text-orange-600 font-bold hover:underline">Login Now</Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {reviews.length > 0 ? (
            <div className="space-y-8">
              {reviews.map((review) => (
                <div key={review.id} className="pb-8 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900">{review.userName}</h4>
                      <div className="flex text-yellow-400 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {review.createdAt?.toDate().toLocaleDateString() || "Recently"}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 rounded-3xl border border-gray-50">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 mb-4">
                <Star size={32} />
              </div>
              <h3 className="font-bold text-gray-900">No reviews yet</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">Be the first to share your experience with this product!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
