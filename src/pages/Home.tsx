import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Star, ShoppingBag } from "lucide-react";
import { useCart } from "../lib/CartContext";
import toast from "react-hot-toast";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), limit(8));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(fetched);
      } catch (error) {
        console.error("Fetch products error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const featured = products[0];

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <section className="relative bg-orange-50 py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:w-1/2 space-y-6 z-10"
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Quality Goods, <br/>
              <span className="text-orange-600 underline decoration-orange-200">Kenyan Soul.</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-lg">
              Discover authentic Kenyan products delivered to your doorstep. Trust, efficiency, and speed.
            </p>
            <div className="flex space-x-4">
              <button className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-700 transition-all flex items-center">
                Shop Now <ArrowRight className="ml-2" size={20} />
              </button>
              <button className="bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-full font-bold hover:bg-gray-50 transition-all">
                Learn More
              </button>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="md:w-1/2 mt-12 md:mt-0 relative"
          >
            <div className="w-80 h-80 md:w-[450px] md:h-[450px] bg-orange-200 rounded-full blur-3xl absolute -top-10 -right-10 opacity-50"></div>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-8 border-white bg-white aspect-square flex items-center justify-center">
               <ShoppingBag size={120} className="text-orange-600 opacity-20" />
               <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm uppercase tracking-widest px-8 text-center italic">
                 Authentic. Trusted. Efficient.
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-8">Popular Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Fashion", "Electronics", "Local Crafts", "Groceries"].map((cat) => (
            <div key={cat} className="h-40 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm hover:shadow-md transition-all cursor-pointer group">
               <span className="text-lg font-semibold group-hover:text-orange-600 transition-colors uppercase tracking-tight">{cat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <div>
             <h2 className="text-3xl font-bold tracking-tight">Latest Arrivals</h2>
             <p className="text-gray-500 mt-1">Handpicked for you in Nairobi</p>
          </div>
          <Link to="/" className="text-orange-600 font-semibold flex items-center hover:underline">
            View All <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-pulse">
            {[1,2,3,4].map(n => <div key={n} className="bg-gray-100 h-80 rounded-2xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((p) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={p.id} 
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all"
              >
                <Link to={`/product/${p.id}`} className="block aspect-square bg-gray-50 rounded-xl overflow-hidden mb-4 relative group">
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all"></div>
                  {p.images?.[0] ? (
                    <img referrerPolicy="no-referrer" src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={48} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold shadow-sm">
                    {p.category}
                  </div>
                </Link>
                <div className="space-y-1">
                  <div className="flex items-center text-yellow-400 mb-1">
                     <Star size={14} fill="currentColor" />
                     <span className="text-gray-500 text-xs ml-1 font-medium">{p.rating || 4.5}</span>
                  </div>
                  <Link to={`/product/${p.id}`} className="text-lg font-bold hover:text-orange-600 transition-colors line-clamp-1">
                    {p.name}
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xl font-black text-gray-900">KES {p.price.toLocaleString()}</span>
                    <button 
                      onClick={() => {
                        addToCart({ productId: p.id, name: p.name, price: p.price, quantity: 1, image: p.images?.[0] || "" });
                        toast.success("Added to cart!");
                      }}
                      className="bg-gray-900 text-white p-2 rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <ShoppingBag size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Trust Banner */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><Star size={32} /></div>
              <h3 className="text-xl font-bold">Trusted in Kenya</h3>
              <p className="text-gray-400 text-sm">Join thousands of happy customers shopping securely with Sokoplus.</p>
           </div>
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><ShoppingBag size={32} /></div>
              <h3 className="text-xl font-bold">Efficient Logistics</h3>
              <p className="text-gray-400 text-sm">Next day delivery in Nairobi and Kiambu. Efficient across 47 counties.</p>
           </div>
           <div className="space-y-3">
              <div className="text-orange-500 flex justify-center"><Star size={32} /></div>
              <h3 className="text-xl font-bold">Safe Payments</h3>
              <p className="text-gray-400 text-sm">Integrated with Paystack & M-Pesa for seamless, secure transactions.</p>
           </div>
        </div>
      </section>
    </div>
  );
}
