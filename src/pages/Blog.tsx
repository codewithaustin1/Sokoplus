import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  ShoppingBag, ArrowRight, Search, Calendar, User, Clock, X, ArrowLeft, 
  Share2, MessageSquare, Trash2, CornerDownRight, Send, Bookmark 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SEO from "../components/SEO";
import Markdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import { BlogPost, UserProfile } from "../types";
import toast from "react-hot-toast";
import { NewsletterSignup } from "../components/NewsletterSignup";
import GoogleNewsWidget from "../components/GoogleNewsWidget";

interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface BlogComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  replies: CommentReply[];
}

const DEFAULT_FALLBACK_POSTS: BlogPost[] = [
  {
    id: "kisii-soapstone",
    title: "The Art of Kisii Soapstone: Preserving Kenyan Craft Traditions",
    content: "Deep in the green highlands of Kisii County, artisans have been carving Tabaka soapstone for generations. Each piece represents hours of meticulous hand-shaping, carving, and delicate painting. From abstract sculptures symbolizing family unity to finely polished bowls and animal figurines, these items are beautiful decorative objects and critical livelihoods for local workshops. At Sokoplus, we partner directly with Tabaka self-help groups to ensure they receive fair trade premiums and sustainable wages, preserving this magnificent heritage for generations to come. When you buy a Sokoplus soapstone piece, you are buying a piece of Kisii history.",
    image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=2000",
    tags: ["Crafts", "Heritage", "Sokoplus Impact"],
    author: "Grace Wambui",
    publishedAt: "2026-06-18T10:00:00.000Z",
    readTime: "5 min read",
    seoTitle: "The Art of Kisii Soapstone Carving - Sokoplus Blog",
    seoDescription: "Discover the heritage of Kisii soapstone carving, Tabaka artisan communities, and how ethically purchasing local crafts transforms lives in Kenya."
  },
  {
    id: "nairobi-leather",
    title: "The Essential Guide to Kenyan Premium Leather Craftsmanship",
    content: "Nairobi is fast becoming a hub for premium leather goods. By combining locally sourced, full-grain bovine leather with traditional hand-stretching and modern stitching techniques, Kenyan leather artisans are creating pieces that rival top European fashion houses. From sturdy canvas-lined travel duffels to sleek minimalist wallets, these accessories are built for durability and character that only improves with age. We take a look inside the Kariobangi leather workshops to see how raw hides are processed sustainably, colored using natural vegetable dyes, and meticulously finished into Sokoplus signature bags.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
    tags: ["Fashion", "Artisans", "Style"],
    author: "David Mwangi",
    publishedAt: "2026-06-12T14:30:00.000Z",
    readTime: "4 min read",
    seoTitle: "Kenyan Leather Guide: Premium Handcrafted Bags - Sokoplus",
    seoDescription: "Explore the rising trend of premium Kenyan leather craftsmanship. Learn about sustainable vegetable-dyed full-grain leather bags and local artisans."
  },
  {
    id: "sustainable-weaving",
    title: "Weaving Hope: How Handwoven Sisal Kiondos Support Rural Women",
    content: "The iconic Kiondo basket is a testament to the perseverance and skill of rural weavers in Machakos and Taita Taveta counties. Woven using resilient sisal plant fibers—often stripped, hand-spun, and naturally dyed—each basket can take anywhere from a week to a month to complete. Originally designed for carrying groceries, modern Kiondos feature clean contemporary patterns, leather handles, and secure linings, making them the ultimate eco-friendly accessory. Sokoplus partners with women-led weaving cooperatives, providing stable incomes that fund children's secondary education and health coverage. Discover how your fashion choices can directly touch the hearts and lives of communities.",
    image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=2000",
    tags: ["Sustainability", "Weaving", "Community"],
    author: "Amara Okech",
    publishedAt: "2026-06-05T08:00:00.000Z",
    readTime: "6 min read",
    seoTitle: "Sisal Kiondo Bags & Handwoven African Baskets - Sokoplus",
    seoDescription: "Learn about the ancient art of weaving Kiondo baskets from sisal fibers, and how rural Kenyan women's cooperatives achieve financial independence."
  },
  {
    id: "central-kenya-coffee",
    title: "Nurturing the Perfect Cup: The Journey of Central Kenya's Coffee",
    content: "The rich, volcanic red soils of Mt. Kenya's slopes provide the absolute perfect microclimate for producing some of the world's finest Arabica coffee beans. Highly regarded for their intense aroma, crisp brightness, and complex dark berry undertones, these beans are grown with extreme care by smallholder farmers. In this story, we follow the life cycle of our Mount Kenya Special single-origin coffee from the delicate white blossoms on the farms, through the honey processing watermills, to the precision medium-roasts in Nairobi. Plus, we share top brewing tips from professional Nairobi baristas on how to unlock the perfect notes at home using a French press or pour-over.",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=2000",
    tags: ["Groceries", "Culinary", "Local Produce"],
    author: "Njuguna Kimani",
    publishedAt: "2026-05-28T09:15:00.000Z",
    readTime: "5 min read",
    seoTitle: "Nurturing Mount Kenya Arabica Coffee Beans - Sokoplus",
    seoDescription: "The journey of premium Arabica coffee beans from Nyeri's volcanic slopes to your morning cup. Learn processing steps and brewing techniques."
  }
];

export default function Blog({ user }: { user: UserProfile | null }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // Comments state
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [newReplyText, setNewReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Bookmarking state with local storage persistence
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("blog_bookmarks");
      if (saved) {
        setBookmarkedIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load blog bookmarks:", e);
    }
  }, []);

  const toggleBookmark = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const isCurrentlyBookmarked = bookmarkedIds.includes(postId);
    let updated: string[];
    if (isCurrentlyBookmarked) {
      updated = bookmarkedIds.filter(id => id !== postId);
      toast.success("Bookmark removed!");
    } else {
      updated = [...bookmarkedIds, postId];
      toast.success("Story bookmarked successfully!");
    }
    setBookmarkedIds(updated);
    try {
      localStorage.setItem("blog_bookmarks", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save blog bookmarks:", err);
    }
  };

  // Synchronize URL search params with active popup
  useEffect(() => {
    const postId = searchParams.get("post");
    if (postId && posts.length > 0) {
      const found = posts.find((p) => p.id === postId);
      if (found) {
        setSelectedPost(found);
      }
    } else {
      setSelectedPost(null);
    }
  }, [posts, searchParams]);

  // Real-time comments listener
  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      return;
    }

    let isMounted = true;
    setLoadingComments(true);

    const fetchComments = async () => {
      try {
        const q = query(
          collection(db, "comments"),
          where("postId", "==", selectedPost.id),
          limit(50)
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as BlogComment[];

        fetched.sort((a, b) => {
          const tA = new Date(a.createdAt).getTime();
          const tB = new Date(b.createdAt).getTime();
          return tA - tB;
        });

        setComments(fetched);
      } catch (error) {
        console.warn("Notice fetching comments:", error);
      } finally {
        if (isMounted) setLoadingComments(false);
      }
    };

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [selectedPost]);

  const handleOpenPost = (post: BlogPost) => {
    setSelectedPost(post);
    setSearchParams({ post: post.id });
  };

  const handleClosePost = () => {
    setSelectedPost(null);
    setSearchParams({});
  };

  const handleShare = async (e: React.MouseEvent, post: BlogPost) => {
    e.stopPropagation(); // prevent triggering card clicks
    const shareUrl = `${window.location.origin}/blog?post=${post.id}`;
    const shareData = {
      title: post.title,
      text: post.content.substring(0, 100) + "...",
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
          fallbackCopy(shareUrl);
        }
      }
    } else {
      fallbackCopy(shareUrl);
    }
  };

  const fallbackCopy = (url: string) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        toast.success("Link copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        toast.error("Could not copy link to clipboard.");
      });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to leave a comment.");
      return;
    }
    if (!selectedPost) return;
    if (!newCommentText.trim()) return;

    setSubmittingComment(true);
    try {
      const newCommentData = {
        postId: selectedPost.id,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "User",
        content: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        replies: []
      };
      const docRef = await addDoc(collection(db, "comments"), newCommentData);
      setComments(prev => [...prev, { id: docRef.id, ...newCommentData }]);
      setNewCommentText("");
      toast.success("Comment added!");
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (comment: BlogComment) => {
    if (!user) {
      toast.error("Please log in to reply.");
      return;
    }
    if (!newReplyText.trim()) return;

    setSubmittingReply(true);
    try {
      const updatedReplies = [
        ...(comment.replies || []),
        {
          id: Math.random().toString(36).substring(2, 9),
          userId: user.uid,
          userName: user.displayName || user.email?.split("@")[0] || "User",
          content: newReplyText.trim(),
          createdAt: new Date().toISOString()
        }
      ];

      await updateDoc(doc(db, "comments", comment.id), {
        replies: updatedReplies
      });
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, replies: updatedReplies } : c));
      setNewReplyText("");
      setReplyingToCommentId(null);
      toast.success("Reply added!");
    } catch (err) {
      console.error("Error adding reply:", err);
      toast.error("Failed to add reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await deleteDoc(doc(db, "comments", commentId));
        setComments(prev => prev.filter(c => c.id !== commentId));
        toast.success("Comment deleted!");
      } catch (err) {
        console.error("Error deleting comment:", err);
        toast.error("Failed to delete comment.");
      }
    }
  };

  const handleDeleteReply = async (comment: BlogComment, replyId: string) => {
    if (window.confirm("Are you sure you want to delete this reply?")) {
      try {
        const updatedReplies = comment.replies.filter(r => r.id !== replyId);
        await updateDoc(doc(db, "comments", comment.id), {
          replies: updatedReplies
        });
        setComments(prev => prev.map(c => c.id === comment.id ? { ...c, replies: updatedReplies } : c));
        toast.success("Reply deleted!");
      } catch (err) {
        console.error("Error deleting reply:", err);
        toast.error("Failed to delete reply.");
      }
    }
  };

  useEffect(() => {
    async function fetchPosts() {
      try {
        const snap = await getDocs(query(collection(db, "blog"), orderBy("publishedAt", "desc"), limit(20)));
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
            readTime: data.readTime || "3 min read",
            seoTitle: data.seoTitle || "",
            seoDescription: data.seoDescription || ""
          };
        });
        
        if (fetched.length > 0) {
          setPosts(fetched);
        } else {
          setPosts(DEFAULT_FALLBACK_POSTS);
        }
      } catch (error) {
        console.warn("Notice fetching blogs (using premium fallback/static cache):", error);
        setPosts(DEFAULT_FALLBACK_POSTS);
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

  const blogSchema = selectedPost ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": selectedPost.title,
    "image": [selectedPost.image],
    "datePublished": selectedPost.publishedAt?.toDate ? selectedPost.publishedAt.toDate().toISOString() : new Date().toISOString(),
    "author": {
      "@type": "Person",
      "name": selectedPost.author || "Sokoplus Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Sokoplus",
      "logo": {
        "@type": "ImageObject",
        "url": `${window.location.origin}/logo.jpg`
      }
    },
    "description": selectedPost.seoDescription || (selectedPost.content.substring(0, 160).replace(/[#*_`~\n-]/g, " ").trim() + "...")
  } : {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Sokoplus Market Stories",
    "description": "Explore stories from local Kenyan artisans, market trends, and the heart of Kenyan commerce on the Sokoplus blog.",
    "publisher": {
      "@type": "Organization",
      "name": "Sokoplus"
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 space-y-12">
      <SEO 
        title={selectedPost ? (selectedPost.seoTitle || selectedPost.title) : "Market Stories"} 
        description={
          selectedPost 
            ? (selectedPost.seoDescription || (selectedPost.content.substring(0, 160).replace(/[#*_`~\n-]/g, " ").trim() + "...")) 
            : "Explore stories from local Kenyan artisans, market trends, and the heart of Kenyan commerce on the Sokoplus blog."
        }
        image={selectedPost ? selectedPost.image : undefined}
        url={
          selectedPost 
            ? `${window.location.origin}/blog?post=${selectedPost.id}` 
            : `${window.location.origin}/blog`
        }
        type={selectedPost ? "article" : "website"}
        schema={blogSchema}
        keywords={selectedPost?.tags || ["Kenyan market news", "artisan stories", "ecommerce Kenya", "Sokoplus blog"]}
        articleAuthor={selectedPost ? (selectedPost.author || "Sokoplus Team") : undefined}
        articlePublishedTime={
          selectedPost 
            ? (selectedPost.publishedAt?.toDate 
                ? selectedPost.publishedAt.toDate().toISOString() 
                : new Date(selectedPost.publishedAt).toISOString())
            : undefined
        }
      />
      
      {/* Editorial Header Section */}
      <div className="text-center space-y-4 max-w-xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Market Stories</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm md:text-base">
          Insights, craft techniques, and direct narratives from the hardworking makers and artisans across Kenya.
        </p>
      </div>

      {/* Navigation Tools: Search & Tag list */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input 
              type="text"
              placeholder="Search stories, topics, makers..."
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl pl-11 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-orange-500 transition-all font-semibold text-gray-900 dark:text-gray-100"
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
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100" 
                    : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-orange-55 hover:text-orange-650 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800 dark:hover:bg-gray-900 dark:hover:border-gray-700"
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
          className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all grid grid-cols-1 lg:grid-cols-12 gap-0 cursor-pointer relative"
          onClick={() => handleOpenPost(featuredPost)}
        >
          <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto min-h-[300px] bg-gray-100 dark:bg-gray-950 relative">
            {featuredPost.image ? (
              <img src={featuredPost.image} alt={featuredPost.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                <ShoppingBag size={64} />
              </div>
            )}
            <span className="absolute top-4 left-4 bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md z-10">
              Featured Story
            </span>
            <button
              onClick={(e) => handleShare(e, featuredPost)}
              className="absolute top-4 right-4 p-2.5 bg-white/95 hover:bg-white text-gray-700 hover:text-orange-600 dark:bg-gray-800/95 dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-orange-400 rounded-full shadow-md z-10 transition-all border border-gray-100/50 dark:border-gray-700/50 cursor-pointer flex items-center justify-center"
              title="Share Story"
            >
              <Share2 size={13} />
            </button>
          </div>
          <div className="lg:col-span-5 p-8 md:p-12 flex flex-col justify-center space-y-6">
            <div className="flex items-center space-x-4 text-xs font-semibold text-gray-400 dark:text-gray-500">
              <span className="flex items-center"><User size={14} className="mr-1" /> {featuredPost.author}</span>
              <span className="flex items-center"><Clock size={14} className="mr-1" /> {featuredPost.readTime}</span>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-500 transition-colors leading-tight">
                {featuredPost.title}
              </h2>
              <p className="text-gray-650 dark:text-gray-300 text-sm leading-relaxed line-clamp-4">
                {featuredPost.content}
              </p>
            </div>

            <div className="flex space-x-2">
              {featuredPost.tags?.map(t => (
                <span key={t} className="text-[9px] font-black tracking-widest uppercase bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full">
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-4 flex items-center text-sm font-black text-gray-900 dark:text-gray-100 group">
              <span>Read Story</span>
              <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform text-orange-600" size={16} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid of Other / Regular Stories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {(activeTag !== "All" || searchTerm ? filteredPosts : regularPosts).length > 0 ? (
          (activeTag !== "All" || searchTerm ? filteredPosts : regularPosts).map(post => (
            <motion.article 
              whileHover={{ y: -6 }}
              key={post.id} 
              className="news-card bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col sm:flex-row h-full relative"
              onClick={() => handleOpenPost(post)}
            >
              <div className="w-full sm:w-2/5 aspect-[16/10] sm:aspect-auto sm:min-h-full bg-gray-50 dark:bg-gray-950 overflow-hidden relative flex-shrink-0">
                 {post.image ? (
                   <img src={post.image} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                       <ShoppingBag size={48} />
                   </div>
                 )}
                 <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
                   <button
                     onClick={(e) => toggleBookmark(e, post.id)}
                     className={`p-2.5 rounded-full shadow-md transition-all border border-gray-100/50 dark:border-gray-700/50 cursor-pointer flex items-center justify-center ${
                       bookmarkedIds.includes(post.id)
                         ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                         : "bg-white/95 hover:bg-white text-gray-700 hover:text-orange-600 dark:bg-gray-800/95 dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-orange-400"
                     }`}
                     title={bookmarkedIds.includes(post.id) ? "Remove Bookmark" : "Bookmark Story"}
                   >
                     <Bookmark size={13} fill={bookmarkedIds.includes(post.id) ? "currentColor" : "none"} />
                   </button>
                   <button
                     onClick={(e) => handleShare(e, post)}
                     className="p-2.5 bg-white/95 hover:bg-white text-gray-700 hover:text-orange-600 dark:bg-gray-800/95 dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-orange-400 rounded-full shadow-md transition-all border border-gray-100/50 dark:border-gray-700/50 cursor-pointer flex items-center justify-center animate-none"
                     title="Share Story"
                   >
                     <Share2 size={13} />
                   </button>
                 </div>
              </div>
              
              <div className="p-6 md:p-8 flex flex-col flex-grow justify-between space-y-4 sm:w-3/5">
                <div className="space-y-2">
                   {/* Meta information tags */}
                   <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                     <span className="flex items-center"><Calendar size={12} className="mr-1" /> {formatDate(post.publishedAt)}</span>
                     <span className="flex items-center"><Clock size={12} className="mr-1" /> {post.readTime}</span>
                   </div>

                   <h2 className="text-lg font-black text-gray-900 dark:text-white line-clamp-2 hover:text-orange-600 dark:hover:text-orange-500 transition-colors">
                     {post.title}
                   </h2>
                   
                   <p className="text-gray-600 dark:text-gray-300 line-clamp-3 text-xs leading-relaxed">
                     {post.content}
                   </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {post.tags?.map((tag: string) => (
                      <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400 px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center text-xs font-black text-gray-900 dark:text-gray-100 group">
                    <span>Read Story</span>
                    <ArrowRight className="ml-1.5 text-orange-600" size={12} />
                  </div>
                </div>
              </div>
            </motion.article>
          ))
        ) : (
          <div className="col-span-full py-16 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-4 max-w-lg mx-auto w-full">
             <div className="text-gray-300 dark:text-gray-700 flex justify-center"><ShoppingBag size={48} /></div>
             <p className="text-gray-550 dark:text-gray-400 font-medium text-sm italic">Our writers are busy spinning new stories. Check back soon!</p>
          </div>
        )}
      </div>

      {/* Live Google News Stream */}
      <div className="my-10">
        <GoogleNewsWidget defaultQuery="Kenya Business Commerce Trade" />
      </div>

      {/* Newsletter Signup Section */}
      <NewsletterSignup />

      {/* Elegant Popup Story Reader Drawer */}
      <AnimatePresence>
        {selectedPost && (
          <>
            {/* Backdrop filter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePost}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] cursor-zoom-out"
            />
            
            {/* Detailed Reader Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-[110] flex flex-col md:my-4 md:right-4 md:rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              {/* Floating control bar on top */}
              <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between z-10">
                <button 
                  type="button"
                  onClick={handleClosePost}
                  className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-150 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Stories</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={(e) => handleShare(e, selectedPost)}
                    className="p-2 text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 rounded-full transition-all cursor-pointer flex items-center justify-center"
                    title="Share Story"
                  >
                    <Share2 size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={handleClosePost}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100 rounded-full transition-all flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable Story content */}
              <div className="flex-grow overflow-y-auto">
                {/* Hero Header image inside detail popup */}
                <div className="aspect-[16/9] bg-gray-50 dark:bg-gray-950 relative">
                  {selectedPost.image ? (
                    <img src={selectedPost.image} alt={selectedPost.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                      <ShoppingBag size={64} />
                    </div>
                  )}
                  {selectedPost.tags?.map(t => (
                    <span key={t} className="absolute bottom-4 left-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-md">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="p-8 space-y-8">
                  {/* Meta tags and timing */}
                  <div className="flex flex-wrap gap-y-2 items-center text-xs font-semibold text-gray-400 dark:text-gray-500 space-x-6 border-b border-gray-50 dark:border-gray-800 pb-6">
                    <span className="flex items-center"><User size={14} className="mr-1.5 text-orange-600" /> By {selectedPost.author}</span>
                    <span className="flex items-center"><Calendar size={14} className="mr-1.5 text-gray-400" /> Published {formatDate(selectedPost.publishedAt)}</span>
                    <span className="flex items-center"><Clock size={14} className="mr-1.5 text-gray-400" /> {selectedPost.readTime}</span>
                  </div>

                  {/* High Quality Typography Heading */}
                  <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                    {selectedPost.title}
                  </h1>

                  {/* High Quality Rich Text / Markdown Story Rendering */}
                  <div className="text-gray-750 dark:text-gray-300 text-sm md:text-base leading-relaxed space-y-4 font-medium tracking-wide prose prose-orange dark:prose-invert max-w-none">
                    <Markdown
                      components={{
                        h2: ({ ...props }) => (
                          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-8 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2" {...props} />
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-lg font-bold text-gray-850 dark:text-gray-200 mt-6 mb-3" {...props} />
                        ),
                        p: ({ ...props }) => (
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-sm md:text-base" {...props} />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc pl-5 mb-4 space-y-2 text-sm md:text-base text-gray-700 dark:text-gray-300" {...props} />
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal pl-5 mb-4 space-y-2 text-sm md:text-base text-gray-700 dark:text-gray-300" {...props} />
                        ),
                        li: ({ ...props }) => (
                          <li className="text-gray-750 dark:text-gray-300" {...props} />
                        ),
                        a: ({ ...props }) => (
                          <a className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-500 underline font-semibold transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                        ),
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-4 border-orange-500 pl-4 italic text-gray-600 dark:text-gray-400 my-6 bg-orange-50/20 dark:bg-orange-950/10 py-2 pr-3 rounded-r-xl" {...props} />
                        ),
                        strong: ({ ...props }) => (
                          <strong className="font-extrabold text-gray-900 dark:text-white" {...props} />
                        ),
                        em: ({ ...props }) => (
                          <em className="italic" {...props} />
                        ),
                      }}
                    >
                      {selectedPost.content}
                    </Markdown>
                  </div>

                  {/* Support dialogue */}
                  <div className="bg-orange-50/50 dark:bg-orange-950/10 rounded-2xl p-6 border border-orange-100/60 dark:border-orange-900/20 mt-8 space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Do you love this craft story?</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">SokoPlus guarantees real prosperity. Supporting our marketplace directly fosters sustainable income streams for these artisans.</p>
                    <button 
                      type="button"
                      onClick={() => {
                        handleClosePost();
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-orange-600 dark:hover:bg-orange-500 transition-all shadow-md shadow-gray-900/10 dark:shadow-none"
                    >
                      Explore Artisan Creations
                    </button>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-800 my-8" />

                  {/* Comments System Thread */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center space-x-2">
                        <MessageSquare size={18} className="text-orange-600" />
                        <span>Comments ({comments.length})</span>
                      </h3>
                      {loadingComments && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Syncing...</div>
                      )}
                    </div>

                    {/* Thread comments list */}
                    <div className="space-y-6">
                      {comments.length > 0 ? (
                        comments.map((comment) => (
                          <div key={comment.id} className="space-y-4">
                            {/* Parent Comment Card */}
                            <div className="bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 space-y-3 relative group">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  {/* Initials Avatar */}
                                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 flex items-center justify-center text-xs font-black uppercase select-none">
                                    {comment.userName.substring(0, 2)}
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-xs text-gray-800 dark:text-gray-200">{comment.userName}</h4>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                      {new Date(comment.createdAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      })}
                                    </span>
                                  </div>
                                </div>

                                {/* Delete Parent Comment Button */}
                                {user && (user.uid === comment.userId || user.isAdmin) && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    type="button"
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors duration-200 cursor-pointer"
                                    title="Delete Comment"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>

                              <p className="text-gray-700 dark:text-gray-300 text-xs md:text-sm whitespace-pre-wrap leading-relaxed font-semibold">
                                {comment.content}
                              </p>

                              {/* Action row to reply */}
                              <div className="flex items-center space-x-4 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingToCommentId(
                                      replyingToCommentId === comment.id ? null : comment.id
                                    );
                                    setNewReplyText("");
                                  }}
                                  className="text-[10px] font-black uppercase tracking-wider text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center space-x-1 cursor-pointer"
                                >
                                  <CornerDownRight size={12} />
                                  <span>{replyingToCommentId === comment.id ? "Cancel Reply" : "Reply"}</span>
                                </button>
                                {comment.replies && comment.replies.length > 0 && (
                                  <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">
                                    {comment.replies.length} {comment.replies.length === 1 ? "response" : "responses"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Replies List */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="pl-6 md:pl-10 space-y-3 border-l-2 border-gray-100 dark:border-gray-800">
                                {comment.replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className="bg-orange-50/20 dark:bg-orange-950/5 rounded-xl p-4 border border-orange-100/50 dark:border-orange-900/20 space-y-2 relative"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 rounded-full bg-orange-50 dark:bg-orange-950/45 text-orange-700 dark:text-orange-400 flex items-center justify-center text-[10px] font-black uppercase select-none">
                                          {reply.userName.substring(0, 2)}
                                        </div>
                                        <div>
                                          <h5 className="font-extrabold text-[11px] text-gray-800 dark:text-gray-200">{reply.userName}</h5>
                                          <span className="text-[9px] text-gray-450 dark:text-gray-550 font-medium">
                                            {new Date(reply.createdAt).toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit"
                                            })}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Delete Reply Button */}
                                      {user && (user.uid === reply.userId || user.isAdmin) && (
                                        <button
                                          onClick={() => handleDeleteReply(comment, reply.id)}
                                          type="button"
                                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors duration-200 cursor-pointer"
                                          title="Delete Reply"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>

                                    <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed font-semibold">
                                      {reply.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Reply Form */}
                            {replyingToCommentId === comment.id && (
                              <div className="pl-6 md:pl-10">
                                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Replying to {comment.userName}
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={newReplyText}
                                    onChange={(e) => setNewReplyText(e.target.value)}
                                    placeholder="Write your response..."
                                    className="w-full text-xs text-gray-850 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
                                  />
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setReplyingToCommentId(null)}
                                      className="px-3 py-1.5 text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submittingReply || !newReplyText.trim()}
                                      onClick={() => handleAddReply(comment)}
                                      className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center space-x-1 hover:bg-orange-700 transition cursor-pointer"
                                    >
                                      <span>{submittingReply ? "Posting..." : "Reply"}</span>
                                      <Send size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center space-y-2 border border-dashed border-gray-150 dark:border-gray-800 rounded-2xl bg-gray-50/30 dark:bg-gray-900/30">
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold italic">
                            No comments yet. Be the first to share your thoughts!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Write Parent Comment Input */}
                    <div className="border-t border-gray-150 dark:border-gray-800 pt-6">
                      {user ? (
                        <form onSubmit={handleAddComment} className="space-y-3">
                          <label className="block text-xs font-black uppercase tracking-wider text-gray-750 dark:text-gray-300">
                            Join the conversation
                          </label>
                          <textarea
                            rows={3}
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write an insightful comment..."
                            className="w-full text-xs text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={submittingComment || !newCommentText.trim()}
                              className="bg-gray-950 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-orange-600 dark:hover:bg-orange-500 transition shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span>{submittingComment ? "Posting..." : "Add Comment"}</span>
                              <Send size={12} />
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="bg-orange-50/40 dark:bg-orange-950/10 rounded-2xl p-5 border border-orange-100/60 dark:border-orange-900/20 text-center space-y-3">
                          <p className="text-xs text-gray-650 dark:text-gray-400 font-medium">
                            Join the dialogue. Reading is open, but sharing comments and responses requires an active account.
                          </p>
                          <Link
                            to="/login"
                            className="inline-block bg-gray-950 dark:bg-gray-100 text-white dark:text-gray-900 text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-orange-600 dark:hover:bg-orange-500 transition-all shadow-md"
                          >
                            Sign In to Comment
                          </Link>
                        </div>
                      )}
                    </div>
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
