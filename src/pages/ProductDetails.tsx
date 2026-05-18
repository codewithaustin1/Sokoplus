import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";
import { ShoppingBag, Star, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { useCart } from "../lib/CartContext";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import axios from "axios";

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("sokoplus_wishlist") || "[]");
    setIsWishlisted(saved && Array.isArray(saved) && saved.includes(id));
  }, [id]);

  const toggleWishlist = () => {
    const saved = JSON.parse(localStorage.getItem("sokoplus_wishlist") || "[]");
    let newWishlist;
    if (saved.includes(id)) {
      newWishlist = saved.filter((i: string) => i !== id);
      toast.success("Removed from wishlist");
    } else {
      newWishlist = [...saved, id];
      toast.success("Added to wishlist");
    }
    localStorage.setItem("sokoplus_wishlist", JSON.stringify(newWishlist));
    setIsWishlisted(!isWishlisted);
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
          
          // Fetch recommendations via AI
          const allProductsSnap = await getDocs(query(collection(db, "products"), limit(20)));
          const allProducts = allProductsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          try {
            const recResponse = await axios.post("/api/recommendations", {
              history: [p.category],
              products: allProducts.map(ap => ({ id: ap.id, name: ap.name, category: ap.category }))
            });
            const recIds = recResponse.data.recommendationIds;
            setRecommendations(allProducts.filter(ap => recIds.includes(ap.id)).slice(0, 4) as Product[]);
          } catch (e) {
            // Fallback to same category
            setRecommendations(allProducts.filter(ap => ap.category === p.category && ap.id !== p.id).slice(0, 4) as Product[]);
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
          
          <p className="text-gray-600 leading-relaxed text-lg">
            {product.description}
          </p>

          <div className="flex space-x-4">
            <button 
              onClick={() => {
                addToCart({ productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0] || "" });
                toast.success("Added to cart!");
              }}
              className="flex-grow bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-orange-600 transition-all shadow-lg flex items-center justify-center"
            >
              Add to Cart <ShoppingBag className="ml-3" size={24} />
            </button>
            <button 
              onClick={toggleWishlist}
              className={`p-5 border rounded-2xl transition-all ${
                isWishlisted ? "bg-red-50 border-red-100 text-red-500" : "border-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <Star size={24} fill={isWishlisted ? "currentColor" : "none"} />
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
