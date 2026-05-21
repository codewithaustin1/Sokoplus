import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  ShoppingBag, ArrowRight, Search, Calendar, User, Clock, X, ArrowLeft, 
  Share2, MessageSquare, Trash2, CornerDownRight, Send 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SEO from "../components/SEO";
import Markdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import { BlogPost, UserProfile } from "../types";
import toast from "react-hot-toast";

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

    setLoadingComments(true);
    const q = query(
      collection(db, "comments"),
      where("postId", "==", selectedPost.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as BlogComment[];

        // Client-side sorting because we can't assume composite index exists
        fetched.sort((a, b) => {
          const tA = new Date(a.createdAt).getTime();
          const tB = new Date(b.createdAt).getTime();
          return tA - tB;
        });

        setComments(fetched);
        setLoadingComments(false);
      },
      (error) => {
        console.error("Error listening to comments:", error);
        setLoadingComments(false);
      }
    );

    return unsubscribe;
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
      await addDoc(collection(db, "comments"), {
        postId: selectedPost.id,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "User",
        content: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        replies: []
      });
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
            readTime: data.readTime || "3 min read",
            seoTitle: data.seoTitle || "",
            seoDescription: data.seoDescription || ""
          };
        });
        
        setPosts(fetched);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        setPosts([]);
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
          className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all grid grid-cols-1 lg:grid-cols-12 gap-0 cursor-pointer relative"
          onClick={() => handleOpenPost(featuredPost)}
        >
          <div className="lg:col-span-7 aspect-[16/10] lg:aspect-auto min-h-[300px] bg-gray-100 relative">
            {featuredPost.image ? (
              <img src={featuredPost.image} alt={featuredPost.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingBag size={64} />
              </div>
            )}
            <span className="absolute top-4 left-4 bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md z-10">
              Featured Story
            </span>
            <button
              onClick={(e) => handleShare(e, featuredPost)}
              className="absolute top-4 right-4 p-2.5 bg-white/95 hover:bg-white text-gray-700 hover:text-orange-600 rounded-full shadow-md z-10 transition-all border border-gray-100/50 cursor-pointer flex items-center justify-center"
              title="Share Story"
            >
              <Share2 size={13} />
            </button>
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
              className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col h-full relative"
              onClick={() => handleOpenPost(post)}
            >
              <div className="aspect-[16/10] bg-gray-50 overflow-hidden relative">
                 {post.image ? (
                   <img src={post.image} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={48} />
                   </div>
                 )}
                 <button
                   onClick={(e) => handleShare(e, post)}
                   className="absolute top-4 right-4 p-2.5 bg-white/95 hover:bg-white text-gray-700 hover:text-orange-600 rounded-full shadow-md z-10 transition-all border border-gray-100/50 cursor-pointer flex items-center justify-center"
                   title="Share Story"
                 >
                   <Share2 size={13} />
                 </button>
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
                   
                   <p className="text-gray-550 line-clamp-3 text-xs leading-relaxed">
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
              onClick={handleClosePost}
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
                  onClick={handleClosePost}
                  className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Stories</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={(e) => handleShare(e, selectedPost)}
                    className="p-2 text-gray-500 hover:text-orange-600 rounded-full transition-all cursor-pointer flex items-center justify-center"
                    title="Share Story"
                  >
                    <Share2 size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={handleClosePost}
                    className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-all flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>
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

                  {/* High Quality Rich Text / Markdown Story Rendering */}
                  <div className="text-gray-700 text-sm md:text-base leading-relaxed space-y-4 font-medium tracking-wide prose prose-orange max-w-none">
                    <Markdown
                      components={{
                        h2: ({ ...props }) => (
                          <h2 className="text-xl md:text-2xl font-black text-gray-900 mt-8 mb-4 border-b border-gray-100 pb-2" {...props} />
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-lg font-bold text-gray-850 mt-6 mb-3" {...props} />
                        ),
                        p: ({ ...props }) => (
                          <p className="text-gray-700 leading-relaxed mb-4 text-sm md:text-base" {...props} />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc pl-5 mb-4 space-y-2 text-sm md:text-base text-gray-700" {...props} />
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal pl-5 mb-4 space-y-2 text-sm md:text-base text-gray-700" {...props} />
                        ),
                        li: ({ ...props }) => (
                          <li className="text-gray-750" {...props} />
                        ),
                        a: ({ ...props }) => (
                          <a className="text-orange-600 hover:text-orange-700 underline font-semibold transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                        ),
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-4 border-orange-500 pl-4 italic text-gray-600 my-6 bg-orange-50/20 py-2 pr-3 rounded-r-xl" {...props} />
                        ),
                        strong: ({ ...props }) => (
                          <strong className="font-extrabold text-gray-900" {...props} />
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
                  <div className="bg-orange-50/50 rounded-2xl p-6 border border-orange-100/60 mt-8 space-y-4">
                    <h3 className="font-bold text-gray-900 text-sm">Do you love this craft story?</h3>
                    <p className="text-xs text-gray-500 font-medium">SokoPlus guarantees real prosperity. Supporting our marketplace directly fosters sustainable income streams for these artisans.</p>
                    <button 
                      type="button"
                      onClick={() => {
                        handleClosePost();
                        window.scrollTo({ top: 300, behavior: "smooth" });
                      }}
                      className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all shadow-md shadow-gray-900/10"
                    >
                      Explore Artisan Creations
                    </button>
                  </div>

                  <hr className="border-gray-100 my-8" />

                  {/* Comments System Thread */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-black text-gray-900 flex items-center space-x-2">
                        <MessageSquare size={18} className="text-orange-600" />
                        <span>Comments ({comments.length})</span>
                      </h3>
                      {loadingComments && (
                        <div className="text-xs text-gray-400 animate-pulse">Syncing...</div>
                      )}
                    </div>

                    {/* Thread comments list */}
                    <div className="space-y-6">
                      {comments.length > 0 ? (
                        comments.map((comment) => (
                          <div key={comment.id} className="space-y-4">
                            {/* Parent Comment Card */}
                            <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 space-y-3 relative group">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  {/* Initials Avatar */}
                                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black uppercase select-none">
                                    {comment.userName.substring(0, 2)}
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-xs text-gray-800">{comment.userName}</h4>
                                    <span className="text-[10px] text-gray-400 font-medium">
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
                                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors duration-200 cursor-pointer"
                                    title="Delete Comment"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>

                              <p className="text-gray-700 text-xs md:text-sm whitespace-pre-wrap leading-relaxed font-semibold">
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
                                  className="text-[10px] font-black uppercase tracking-wider text-orange-600 hover:text-orange-700 flex items-center space-x-1 cursor-pointer"
                                >
                                  <CornerDownRight size={12} />
                                  <span>{replyingToCommentId === comment.id ? "Cancel Reply" : "Reply"}</span>
                                </button>
                                {comment.replies && comment.replies.length > 0 && (
                                  <span className="text-[10px] uppercase font-bold text-gray-400">
                                    {comment.replies.length} {comment.replies.length === 1 ? "response" : "responses"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Replies List */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="pl-6 md:pl-10 space-y-3 border-l-2 border-gray-100">
                                {comment.replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className="bg-orange-50/20 rounded-xl p-4 border border-orange-100/50 space-y-2 relative"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-700 flex items-center justify-center text-[10px] font-black uppercase select-none">
                                          {reply.userName.substring(0, 2)}
                                        </div>
                                        <div>
                                          <h5 className="font-extrabold text-[11px] text-gray-800">{reply.userName}</h5>
                                          <span className="text-[9px] text-gray-450 font-medium">
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

                                    <p className="text-gray-700 text-xs leading-relaxed font-semibold">
                                      {reply.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Reply Form */}
                            {replyingToCommentId === comment.id && (
                              <div className="pl-6 md:pl-10">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400">
                                    Replying to {comment.userName}
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={newReplyText}
                                    onChange={(e) => setNewReplyText(e.target.value)}
                                    placeholder="Write your response..."
                                    className="w-full text-xs bg-gray-50 border border-gray-150 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
                                  />
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setReplyingToCommentId(null)}
                                      className="px-3 py-1.5 text-[9px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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
                        <div className="py-8 text-center space-y-2 border border-dashed border-gray-150 rounded-2xl bg-gray-50/30">
                          <p className="text-xs text-gray-400 font-semibold italic">
                            No comments yet. Be the first to share your thoughts!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Write Parent Comment Input */}
                    <div className="border-t border-gray-150 pt-6">
                      {user ? (
                        <form onSubmit={handleAddComment} className="space-y-3">
                          <label className="block text-xs font-black uppercase tracking-wider text-gray-750">
                            Join the conversation
                          </label>
                          <textarea
                            rows={3}
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write an insightful comment..."
                            className="w-full text-xs text-gray-800 bg-gray-50 border border-gray-150 rounded-xl p-3 outline-none focus:ring-1 focus:ring-orange-500 font-semibold"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={submittingComment || !newCommentText.trim()}
                              className="bg-gray-950 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-orange-600 transition shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span>{submittingComment ? "Posting..." : "Add Comment"}</span>
                              <Send size={12} />
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="bg-orange-50/40 rounded-2xl p-5 border border-orange-100/60 text-center space-y-3">
                          <p className="text-xs text-gray-650 font-medium">
                            Join the dialogue. Reading is open, but sharing comments and responses requires an active account.
                          </p>
                          <Link
                            to="/login"
                            className="inline-block bg-gray-950 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-all shadow-md"
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
