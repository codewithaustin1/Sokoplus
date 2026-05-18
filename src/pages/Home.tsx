import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile } from "../types";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Star, ShoppingBag, Heart } from "lucide-react";
import { useCart } from "../lib/CartContext";
import toast from "react-hot-toast";
import SEO from "../components/SEO";
import EmptyState from "../components/EmptyState";

interface HomeProps {
  user: UserProfile | null;
}

export default function Home({ user }: HomeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Please login to save to wishlist");
      return;
    }

    if (!user.emailVerified) {
      toast.error("Please verify your email to update wishlist");
      return;
    }

    const isWishlisted = user.wishlist?.includes(productId);

    try {
      const userRef = doc(db, "users", user.uid);
      if (isWishlisted) {
        await updateDoc(userRef, {
          wishlist: arrayRemove(productId)
        });
        toast.success("Removed from wishlist");
      } else {
        await updateDoc(userRef, {
          wishlist: arrayUnion(productId)
        });
        toast.success("Added to wishlist");
      }
    } catch (error) {
      console.error("Wishlist error:", error);
      toast.error("Failed to update wishlist");
    }
  };

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), limit(20));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(fetched);
        setFilteredProducts(fetched);
      } catch (error) {
        console.error("Fetch products error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    const searchTerm = searchParams.get("search")?.toLowerCase();
    
    let result = products;

    if (selectedCategory !== "All") {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.description.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredProducts(result);
  }, [selectedCategory, products, searchParams]);

  const [showMission, setShowMission] = useState(false);

  const scrollToProducts = () => {
    document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-12 pb-20">
      <SEO 
        title="Premium Kenyan Marketplace" 
        description="Shop the best authentic Kenyan products. From local artisans to global quality standards, Sokoplus is your home for Kenyan excellence."
      />
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
              <button 
                onClick={scrollToProducts}
                className="bg-orange-600 text-white px-8 py-4 rounded-full font-bold hover:bg-orange-700 transition-all flex items-center"
              >
                Shop Now <ArrowRight className="ml-2" size={20} />
              </button>
              <button 
                onClick={() => setShowMission(true)}
                className="bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-full font-bold hover:bg-gray-50 transition-all"
              >
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {["All", "Fashion", "Electronics", "Local Crafts", "Groceries"].map((cat) => (
            <div 
              key={cat} 
              onClick={() => {
                setSelectedCategory(cat);
                scrollToProducts();
              }}
              className={`h-24 md:h-32 border rounded-2xl flex items-center justify-center shadow-sm transition-all cursor-pointer group ${
                selectedCategory === cat ? "bg-orange-600 border-orange-600 text-white font-bold" : "bg-white border-gray-100 hover:shadow-md"
              }`}
            >
               <span className={`text-sm md:text-lg font-semibold transition-colors uppercase tracking-tight ${
                 selectedCategory === cat ? "text-white" : "group-hover:text-orange-600"
               }`}>{cat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="flex justify-between items-end mb-8">
          <div>
             <h2 className="text-3xl font-bold tracking-tight">{selectedCategory === "All" ? "Latest Arrivals" : `${selectedCategory} Collection`}</h2>
             <p className="text-gray-500 mt-1">Handpicked for you in Nairobi</p>
          </div>
          <Link to="/" onClick={() => setSelectedCategory("All")} className="text-orange-600 font-semibold flex items-center hover:underline">
            View All <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-pulse">
            {[1,2,3,4].map(n => <div key={n} className="bg-gray-100 h-80 rounded-2xl"></div>)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState 
            icon={ShoppingBag}
            title="No products found"
            description={`We couldn't find any products in "${selectedCategory}" matching your criteria. Try adjusting your search or category.`}
            actionLabel="Clear Filters"
            onAction={() => {
              setSelectedCategory("All");
              const url = new URL(window.location.href);
              url.searchParams.delete("search");
              window.history.pushState({}, '', url);
            }}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {filteredProducts.map((p) => (
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
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold shadow-sm z-10">
                    {p.category}
                  </div>
                  <button
                    onClick={(e) => toggleWishlist(p.id, e)}
                    className={`absolute top-2 left-2 p-2 rounded-full shadow-sm z-10 transition-all ${
                      user?.wishlist?.includes(p.id) 
                        ? "bg-red-50 text-red-500 hover:bg-red-100" 
                        : "bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white"
                    }`}
                  >
                    <Heart size={16} fill={user?.wishlist?.includes(p.id) ? "currentColor" : "none"} />
                  </button>
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

      {/* Mission Modal */}
      {showMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white max-w-2xl w-full rounded-3xl overflow-hidden shadow-2xl relative"
          >
            <button 
              onClick={() => setShowMission(false)}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-all z-10"
            >
              <ArrowRight className="rotate-180" size={24} />
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-10 space-y-6">
                <div>
                  <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit mb-4">Our Mission</div>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight">Empowering Kenyan <span className="text-orange-600">Commerce.</span></h2>
                </div>
                <p className="text-gray-500 leading-relaxed">
                  Sokoplus isn't just a store; it's a bridge between Kenya's finest local artisans and a modern, digital world.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-100 text-green-600 p-1.5 rounded-lg mt-1"><Star size={16} fill="currentColor" /></div>
                    <div>
                      <h4 className="font-bold text-sm">Verified Retailers</h4>
                      <p className="text-xs text-gray-400">Every shop is vetted for quality and authenticity.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg mt-1"><ShoppingBag size={16} /></div>
                    <div>
                      <h4 className="font-bold text-sm">Loyalty Ecosystem</h4>
                      <p className="text-xs text-gray-400">Earn points on every purchase across all local categories.</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMission(false)}
                  className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg"
                >
                  Start Exploring
                </button>
              </div>
              <div className="bg-orange-600 p-10 flex flex-col justify-center text-white space-y-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                 <div className="relative z-10 space-y-2">
                   <h3 className="text-4xl font-black italic opacity-20 uppercase tracking-tighter">Sokoplus</h3>
                   <p className="text-xl font-bold">"Bridging the gap between tradition and technology."</p>
                 </div>
                 <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
                    <p className="text-sm font-medium leading-relaxed">
                      Founded in Nairobi, our goal is to ensure that Kenyan soul reaches global standards of service.
                    </p>
                 </div>
                 <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                    <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
