import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, UserProfile } from "../types";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Star, ShoppingBag, Heart, Filter, X, ChevronDown } from "lucide-react";
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

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high" | "rating">("newest");

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
    
    let result = [...products];

    // Category Filter
    if (selectedCategory !== "All") {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Search Filter
    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.description.toLowerCase().includes(searchTerm)
      );
    }

    // Advanced Filters
    if (minPrice !== "") {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice !== "") {
      result = result.filter(p => p.price <= Number(maxPrice));
    }
    if (minRating > 0) {
      result = result.filter(p => (p.rating || 0) >= minRating);
    }
    if (onlyInStock) {
      result = result.filter(p => p.stock > 0);
    }

    // Sorting
    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredProducts(result);
  }, [selectedCategory, products, searchParams, minPrice, maxPrice, minRating, onlyInStock, sortBy]);

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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
             <h2 className="text-4xl font-black tracking-tight text-gray-900">{selectedCategory === "All" ? "Latest Arrivals" : `${selectedCategory} Collection`}</h2>
             <p className="text-gray-500 mt-2 font-medium">Handpicked premium goods from across the 47 counties.</p>
          </div>
          <Link to="/" onClick={() => {
            setSelectedCategory("All");
            setMinPrice("");
            setMaxPrice("");
            setMinRating(0);
            setOnlyInStock(false);
          }} className="text-orange-600 font-bold flex items-center hover:underline group">
            Reset All <X size={16} className="ml-1 group-hover:rotate-90 transition-transform" />
          </Link>
        </div>

        {/* Filtering & Sorting Bar */}
        <div className="flex flex-col space-y-6 mb-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-8 py-4 rounded-2xl border transition-all font-bold shadow-sm ${
                  showFilters ? "bg-gray-900 text-white border-gray-900 shadow-xl" : "bg-white text-gray-900 border-gray-100 hover:border-orange-600"
                }`}
              >
                <Filter size={18} />
                <span>Filters</span>
                {(minPrice !== "" || maxPrice !== "" || minRating > 0 || onlyInStock) && (
                   <span className="w-5 h-5 bg-orange-600 text-white rounded-full text-[10px] flex items-center justify-center animate-pulse">
                     !
                   </span>
                )}
              </button>
              
              <div className="relative group">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-white border border-gray-100 px-8 py-4 pr-12 rounded-2xl font-bold cursor-pointer hover:border-orange-600 transition-all outline-none shadow-sm"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>

            <p className="text-gray-500 font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
              Found <span className="text-orange-600">{filteredProducts.length}</span> authentic products
            </p>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 md:p-10 grid grid-cols-1 md:grid-cols-4 gap-10 shadow-xl shadow-gray-100/50">
                  {/* Price Range */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 block">Price Range (KES)</label>
                    <div className="flex items-center space-x-3">
                       <input 
                         type="number" 
                         placeholder="Min" 
                         value={minPrice}
                         onChange={(e) => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
                         className="w-full bg-gray-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-600 transition-all"
                       />
                       <div className="h-0.5 w-4 bg-gray-200"></div>
                       <input 
                         type="number" 
                         placeholder="Max" 
                         value={maxPrice}
                         onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
                         className="w-full bg-gray-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-600 transition-all"
                       />
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 block">Minimum Rating</label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setMinRating(minRating === star ? 0 : star)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                            minRating >= star ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "bg-gray-50 text-gray-300 hover:text-orange-400 hover:bg-gray-100"
                          }`}
                        >
                          <Star size={18} fill={minRating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 block">Availability</label>
                    <button 
                      onClick={() => setOnlyInStock(!onlyInStock)}
                      className={`flex items-center space-x-4 w-full px-5 py-4 rounded-xl border transition-all group ${
                        onlyInStock ? "bg-orange-50 border-orange-100 text-orange-700 shadow-inner" : "bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                       <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                         onlyInStock ? "bg-orange-600 border-orange-600 text-white" : "bg-white border-gray-200 group-hover:border-orange-300"
                       }`}>
                         {onlyInStock && <ArrowRight size={14} className="rotate-0 animate-in fade-in zoom-in" />}
                       </div>
                       <span className="text-sm font-black uppercase tracking-tight">In Stock Only</span>
                    </button>
                  </div>

                  {/* Clear All */}
                  <div className="flex flex-col justify-end">
                    <button 
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        setMinRating(0);
                        setOnlyInStock(false);
                        setSelectedCategory("All");
                      }}
                      className="flex items-center justify-center space-x-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-6 py-4 rounded-xl font-black transition-all shadow-sm"
                    >
                      <X size={18} />
                      <span className="text-xs uppercase tracking-widest">Reset Filters</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                  {p.images?.filter(img => !!img && img.trim() !== "")[0] ? (
                    <img referrerPolicy="no-referrer" src={p.images.filter(img => !!img && img.trim() !== "")[0]} alt={p.name} className="w-full h-full object-cover" />
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
                        addToCart({ productId: p.id, name: p.name, price: p.price, quantity: 1, image: p.images?.filter(img => !!img && img.trim() !== "")[0] || "" });
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
