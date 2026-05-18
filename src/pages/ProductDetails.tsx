import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, query, limit, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, orderBy, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile, Review } from "../types";
import { ShoppingBag, Star, ShieldCheck, Truck, RefreshCw, Heart, Send } from "lucide-react";
import { useCart } from "../lib/CartContext";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import axios from "axios";

interface ProductDetailsProps {
  user: UserProfile | null;
}

export default function ProductDetails({ user }: ProductDetailsProps) {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const { addToCart } = useCart();

  const isWishlisted = user?.wishlist?.includes(id || "") || false;

  const toggleWishlist = async () => {
    if (!user) {
      toast.error("Please login to save to wishlist");
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
          setProduct(p);
          
          fetchReviews();

          // Fetch recommendations via AI
          const allProductsSnap = await getDocs(query(collection(db, "products"), limit(20)));
          const allProducts = allProductsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
          
          try {
            const recResponse = await axios.post("/api/recommendations", {
              history: [p.category],
              products: allProducts.map(ap => ({ id: ap.id, name: ap.name, category: ap.category }))
            });
            const recIds = recResponse.data.recommendationIds;
            setRecommendations(allProducts.filter(ap => recIds.includes(ap.id)).slice(0, 4));
          } catch (e) {
            // Fallback to same category
            setRecommendations(allProducts.filter(ap => ap.category === p.category && ap.id !== p.id).slice(0, 4));
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <ShoppingBag size={100} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {product.images?.slice(1).map((img, i) => (
              <div key={i} className="aspect-square bg-gray-50 rounded-xl overflow-hidden cursor-pointer">
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

          <p className="text-4xl font-black text-orange-600">KES {product.price.toLocaleString()}</p>
          
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
            <button 
              onClick={() => {
                addToCart({ productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0] || "" });
                toast.success("Added to cart!");
              }}
              disabled={product.stock <= 0}
              className="flex-grow bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-orange-600 transition-all shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {product.stock > 0 ? "Add to Cart" : "Out of Stock"} <ShoppingBag className="ml-3" size={24} />
            </button>
            <button 
              onClick={toggleWishlist}
              className={`p-5 border rounded-2xl transition-all ${
                isWishlisted ? "bg-red-50 border-red-100 text-red-500" : "border-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <Heart size={24} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
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

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="mt-24 space-y-8">
          <h2 className="text-3xl font-black tracking-tight">You Might Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {recommendations.map(p => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={p.id} 
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all"
              >
                <Link to={`/product/${p.id}`} className="block aspect-square bg-gray-50 rounded-xl overflow-hidden mb-4 relative">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                      <ShoppingBag size={48} />
                    </div>
                  )}
                </Link>
                <Link to={`/product/${p.id}`} className="text-lg font-bold hover:text-orange-600 transition-colors line-clamp-1">{p.name}</Link>
                <p className="text-orange-600 font-black">KES {p.price.toLocaleString()}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
