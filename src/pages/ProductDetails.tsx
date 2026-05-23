import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, query, limit, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, orderBy, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile, Review } from "../types";
import { ShoppingBag, Star, ShieldCheck, Truck, RefreshCw, Heart, Send, Sparkles, Layers } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useCurrency } from "../lib/CurrencyContext";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import axios from "axios";
import SEO from "../components/SEO";
import { trackEvent } from "../lib/analytics";

interface ProductDetailsProps {
  user: UserProfile | null;
}

const recommendationCache = new Map<string, { items: Product[]; source: "ai" | "category" }>();

export default function ProductDetails({ user }: ProductDetailsProps) {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recSource, setRecSource] = useState<"ai" | "category">("category");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart } = useCart();
  const { currency, setCurrency, formatPrice } = useCurrency();

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
      setLoading(true);
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
          <div className="aspect-square bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            {product.images?.[activeImage] ? (
              <img src={product.images[activeImage]} alt={product.name} className="w-full h-full object-cover transition-opacity duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <ShoppingBag size={100} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {product.images?.filter(img => !!img && img.trim() !== "").map((img, i) => (
              <div 
                key={i} 
                onClick={() => setActiveImage(i)}
                className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${activeImage === i ? "border-orange-600 scale-95 shadow-lg" : "border-transparent bg-gray-50 opacity-70 hover:opacity-100"}`}
              >
                <img src={img} alt={`${product.name} ${i}`} className="w-full h-full object-cover" />
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
            <p className="text-4xl font-black text-orange-600">{formatPrice(product.price)}</p>
            
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

          <p className="text-gray-600 leading-relaxed text-lg">
            {product.description}
          </p>

          <div className="flex space-x-4">
            <motion.button 
              whileHover={product.stock > 0 ? { scale: 1.02, y: -2 } : {}}
              whileTap={product.stock > 0 ? { scale: 0.96, y: 0 } : {}}
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
              className="flex-grow bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
            >
              {product.stock > 0 ? "Add to Cart" : "Out of Stock"} <ShoppingBag className="ml-3" size={24} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 450, damping: 12 }}
              onClick={toggleWishlist}
              className={`p-5 border rounded-2xl transition-colors cursor-pointer ${
                isWishlisted ? "bg-red-50 border-red-100 text-red-500" : "border-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <Heart size={24} fill={isWishlisted ? "currentColor" : "none"} />
            </motion.button>
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
                whileHover={{ y: -6 }}
                key={p.id} 
                className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col h-full relative"
              >
                <div className="aspect-square bg-gray-50 overflow-hidden relative">
                   {p.images?.filter(img => !!img && img.trim() !== "")[0] ? (
                     <img 
                       src={p.images.filter(img => !!img && img.trim() !== "")[0]} 
                       alt={p.name} 
                       className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                       loading="lazy"
                       style={{
                         backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj4gPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIj48c3RvcCBvZmZzZXQ9IjUlIiBzdG9wLWNvbG9yPSIjZjNmNGY2Ii8+PHN0b3Agb2Zmc2V0PSIyNSUiIHN0b3AtY29sb3I9IiNlNWU3ZWIiLz48c3RvcCBvZmZzZXQ9IjM1JSIgc3RvcC1jb2xvcj0iI2YzZjRmNiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=")`,
                         backgroundSize: "cover"
                       }}                     />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <ShoppingBag size={48} />
                     </div>
                   )}
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
                       className="block text-sm font-extrabold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1"
                     >
                       {p.name}
                     </Link>
                   </div>
                   
                   <div className="flex items-center justify-between pt-1">
                     <span className="text-base font-black text-gray-900">{formatPrice(p.price)}</span>
                     <Link 
                       to={`/product/${p.id}`}
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
