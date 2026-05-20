import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShoppingBag, ArrowRight, Search, Calendar, User, Clock, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SEO from "../components/SEO";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  image?: string;
  tags?: string[];
  author?: string;
  publishedAt?: any;
  readTime?: string;
}

const FALLBACK_POSTS: BlogPost[] = [
  {
    id: "fallback-1",
    title: "Empowering Women Weavers in Machakos",
    content: `In the serene, sun-swept hills of Machakos County, a quiet revolution is taking place at the tips of fingers. Traditional hand-weaving of Sisal baskets—locally known as Kiondos—has been passed down through generations of Akamba women as a social activity.\n\nToday, coordinated self-help collectives are turning this beautiful legacy into high-fashion exports. SokoPlus works directly with these collectives, organizing direct fair wages, supply chain materials, and providing digital channels to showcase their talent to global design enthusiasts.\n\n"Weaving is more than a chore; it is our history," says Mueni, a master weaver of 35 years. "When you hold a finished basket, you hold our songs, our laughs, and our hopes for our children." Every dyed fiber is naturally sourced from local plants, crafted over weeks of intense precision.\n\nBy ensuring that these artisans receive direct, uninterrupted proceeds, we do not only sustain rural households; we preserve the physical memory of Kenya's cultural heritage.`,
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
    tags: ["Artisans", "Impact"],
    author: "Mwende K.",
    publishedAt: "2026-05-18T12:00:00Z",
    readTime: "4 min read"
  },
  {
    id: "fallback-2",
    title: "Why Handcrafted Kenyan Leather Lasts a Lifetime",
    content: `Walk into any artisan workshop along Nairobi's outer rim, and your senses are instantly greeted by the rich, warm scent of genuine vegetable-tanned leather. Here, master leather workers craft belts, bags, and boots meant to withstand the test of time.\n\nIn an era dominated by fast-fashion synthetics, Kenyan artisan leather stands out because of its architectural honesty and durability. Utilizing locally sourced hides—primarily reclaimed as a by-product of rural livestock husbandry—our makers follow a rigorous vegetable tanning process.\n\n"Synthetic fake leather peels in months. Natural leather matures," explains David, a third-generation saddle and bag maker. "It gains a beautiful patina, absorbing the history of its owner. Each scratch and dark patch becomes a badge of honor."\n\nUnlike assembly-line products, these bags feature individually hand-stitched reinforcement points, sturdy cast-brass buckles, and deep oil feeds to prevent drying out. Buying a SokoPlus leather piece is an investment in a companion that lives and ages alongside you.`,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=800&auto=format&fit=crop",
    tags: ["Guides", "Leather"],
    author: "David O.",
    publishedAt: "2026-05-15T10:30:00Z",
    readTime: "5 min read"
  },
  {
    id: "fallback-3",
    title: "Nairobi's Clay Revolution: From Soil to Stoneware",
    content: `In the quiet, leafy suburbs of Westlands and Karen, contemporary design studios are breathing abstract ceramic forms into organic Kenyan clays. Inspired by traditional potters of Western and Eastern Kenya, these new wave designers are hand-sculpting functional tableware that competes with international galleries.\n\nThe process remains delightfully close to the soil. Raw clay is often transported directly from the deep riverbeds of Mount Kenya and Athi River, refined by hand, throwing it on electric or manual kick-wheels.\n\n"We are moving past default souvenirs," says Aminah, founder of a modern pottery atelier. "Sokoplus clayware needs to feel completely at home in a chic restaurant or a cozy family dining table. It represents the sophistication of modern African design—minimalist, heavy, textured, and deeply earth-aligned."\n\nEach stoneware cup, bowl, and vase is fired in high-temperature kilns, creating high-durability kitchen items that are fully microwave and dishwasher safe while preserving an irreproducible, dimpled hand-touch charm.`,
    image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop",
    tags: ["Trends", "Home Decor"],
    author: "Aminah T.",
    publishedAt: "2026-05-10T09:15:00Z",
    readTime: "6 min read"
  }
];

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const snap = await getDocs(query(collection(db, "blog"), orderBy("publishedAt", "desc")));
        const fetched: BlogPost[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "",
            content: data.content || "",
            image: data.image || "",
            tags: data.tags || [],
            author: data.author || "Sokoplus team",
            publishedAt: data.publishedAt,
            readTime: data.readTime || "3 min read"
          };
        });
        
        // Merge fetched posts with our rich authentic local fallback stories
        const combined = [...fetched];
        FALLBACK_POSTS.forEach(fallback => {
          if (!combined.some(p => p.title.toLowerCase() === fallback.title.toLowerCase())) {
            combined.push(fallback);
          }
        });
        
        setPosts(combined);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        setPosts(FALLBACK_POSTS);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  // Extract unique tags present across all posts
  const allTags = ["All", ...Array.from(new Set(posts.flatMap(p => p.tags || [])))];

  // Filter posts based on search term and active tag selection
  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.tags && post.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
      
    const matchesTag = activeTag === "All" || (post.tags && post.tags.includes(activeTag));
    return matchesSearch && matchesTag;
  });

  // Latest or designated featured post
  const featuredPost = filteredPosts[0];
  const regularPosts = filteredPosts.slice(1);

  const formatDate = (dateInput: any) => {
    if (!dateInput) return "May 19, 2026";
    try {
      if (dateInput.toDate) {
        return dateInput.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return new Date(dateInput).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "May 19, 2026";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 space-y-12">
      <SEO 
        title="Market Stories" 
        description="Explore stories from local Kenyan artisans, market trends, and the heart of Kenyan commerce on the Sokoplus blog."
      />
      
      {/* Editorial Header Section */}
      <div className="text-center space-y-4 max-w-xl mx-auto">
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">
          SokoPlus Chronicles
        </span>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">Market Stories</h1>
        <p className="text-gray-500 font-medium text-sm md:text-base">
          Insights, craft techniques, and direct narratives from the hardworking makers and artisans across Kenya.
        </p>
      </div>

      {/* Navigation Tools: Search & Tag list */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search stories, topics, makers..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-orange-500 transition-all font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                  activeTag === tag 
                    ? "bg-gray-900 text-white border-gray-900" 
                    : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-orange-55 hover:text-orange-650"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Post (Highlighted on Top) */}
      {featuredPost && activeTag === "All" && !searchTerm && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all grid grid-cols-1 lg:grid-cols-12 gap-0 cursor-pointer"
          onClick={() => setSelectedPost(featuredPost)}
        >
          <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto min-h-[300px] bg-gray-100 relative">
            {featuredPost.image ? (
              <img src={featuredPost.image} alt={featuredPost.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingBag size={64} />
              </div>
            )}
            <span className="absolute top-4 left-4 bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
              Featured Story
            </span>
          </div>
          <div className="lg:col-span-5 p-8 md:p-12 flex flex-col justify-center space-y-6">
            <div className="flex items-center space-x-4 text-xs font-semibold text-gray-400">
              <span className="flex items-center"><User size={14} className="mr-1" /> {featuredPost.author}</span>
              <span className="flex items-center"><Clock size={14} className="mr-1" /> {featuredPost.readTime}</span>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 hover:text-orange-600 transition-colors leading-tight">
                {featuredPost.title}
              </h2>
              <p className="text-gray-550 text-sm leading-relaxed line-clamp-4">
                {featuredPost.content}
              </p>
            </div>

            <div className="flex space-x-2">
              {featuredPost.tags?.map(t => (
                <span key={t} className="text-[9px] font-black tracking-widest uppercase bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-4 flex items-center text-sm font-black text-gray-900 group">
              <span>Read Story</span>
              <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform text-orange-600" size={16} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid of Other / Regular Stories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(activeTag !== "All" || searchTerm ? filteredPosts : regularPosts).length > 0 ? (
          (activeTag !== "All" || searchTerm ? filteredPosts : regularPosts).map(post => (
            <motion.article 
              whileHover={{ y: -6 }}
              key={post.id} 
              className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col h-full"
              onClick={() => setSelectedPost(post)}
            >
              <div className="aspect-[16/10] bg-gray-50 overflow-hidden relative">
                 {post.image ? (
                   <img src={post.image} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={48} />
                   </div>
                 )}
              </div>
              
              <div className="p-6 flex flex-col flex-grow justify-between space-y-4">
                <div className="space-y-2">
                   {/* Meta information tags */}
                   <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                     <span className="flex items-center"><Calendar size={12} className="mr-1" /> {formatDate(post.publishedAt)}</span>
                     <span className="flex items-center"><Clock size={12} className="mr-1" /> {post.readTime}</span>
                   </div>

                   <h2 className="text-lg font-black text-gray-900 line-clamp-2 hover:text-orange-600 transition-colors">
                     {post.title}
                   </h2>
                   
                   <p className="text-gray-500 line-clamp-3 text-xs leading-relaxed">
                     {post.content}
                   </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {post.tags?.map((tag: string) => (
                      <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center text-xs font-black text-gray-900 group">
                    <span>Read Story</span>
                    <ArrowRight className="ml-1.5 text-orange-600" size={12} />
                  </div>
                </div>
              </div>
            </motion.article>
          ))
        ) : (
          <div className="col-span-full py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-center space-y-4 max-w-lg mx-auto w-full">
             <div className="text-gray-300 flex justify-center"><ShoppingBag size={48} /></div>
             <p className="text-gray-500 font-medium text-sm italic">Our writers are busy spinning new stories. Check back soon!</p>
          </div>
        )}
      </div>

      {/* Elegant Popup Story Reader Drawer */}
      <AnimatePresence>
        {selectedPost && (
          <>
            {/* Backdrop filter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPost(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] cursor-zoom-out"
            />
            
            {/* Detailed Reader Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-[110] flex flex-col md:my-4 md:right-4 md:rounded-3xl overflow-hidden border border-gray-100"
            >
              {/* Floating control bar on top */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
                <button 
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Stories</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Story content */}
              <div className="flex-grow overflow-y-auto">
                {/* Hero Header image inside detail popup */}
                <div className="aspect-[16/9] bg-gray-50 relative">
                  {selectedPost.image ? (
                    <img src={selectedPost.image} alt={selectedPost.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={64} />
                    </div>
                  )}
                  {selectedPost.tags?.map(t => (
                    <span key={t} className="absolute bottom-4 left-4 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-md">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="p-8 space-y-8">
                  {/* Meta tags and timing */}
                  <div className="flex flex-wrap gap-y-2 items-center text-xs font-semibold text-gray-400 space-x-6 border-b border-gray-50 pb-6">
                    <span className="flex items-center"><User size={14} className="mr-1.5 text-orange-600" /> By {selectedPost.author}</span>
                    <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-gray-400" /> Published {formatDate(selectedPost.publishedAt)}</span>
                    <span className="flex items-center"><Clock size={14} className="mr-1.5 text-gray-400" /> {selectedPost.readTime}</span>
                  </div>

                  {/* High Quality Typography Heading */}
                  <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                    {selectedPost.title}
                  </h1>

                  {/* Clean text paragraph rendering */}
                  <div className="text-gray-700 text-sm md:text-base leading-relaxed space-y-6 font-medium tracking-wide">
                    {selectedPost.content.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>

                  {/* Support dialogue */}
                  <div className="bg-orange-50/50 rounded-2xl p-6 border border-orange-100/60 mt-8 space-y-4">
                    <h3 className="font-bold text-gray-900 text-sm">Do you love this craft story?</h3>
                    <p className="text-xs text-gray-500 font-medium">SokoPlus guarantees real prosperity. Supporting our marketplace directly fosters sustainable income streams for these artisans.</p>
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedPost(null);
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all shadow-md shadow-gray-900/10"
                    >
                      Explore Artisan Creations
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
