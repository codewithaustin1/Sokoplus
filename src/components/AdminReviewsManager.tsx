import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { Review } from "../types";
import {
  collection,
  getDocs,
  getDocsFromCache,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  limit,
  getCountFromServer,
  getAggregateFromServer,
  average,
  count,
} from "firebase/firestore";
import {
  Star,
  Trash2,
  MessageSquare,
  Search,
  Check,
  X,
  MessageCircle,
  Filter,
  Image as ImageIcon,
  Clock,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

export default function AdminReviewsManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // "all", "replied", "pending"
  const [replyTexts, setReplyTexts] = useState<{ [reviewId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<{ totalCount: number; avgRating: number }>({
    totalCount: 0,
    avgRating: 0,
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // Execute server aggregate query for total reviews count and average rating
      try {
        const aggRes = await getAggregateFromServer(collection(db, "reviews"), {
          totalCount: count(),
          avgRating: average("rating"),
        });
        if (aggRes) {
          const data = aggRes.data();
          setServerStats({
            totalCount: data.totalCount || 0,
            avgRating: Number(data.avgRating || 0),
          });
        }
      } catch (aggErr) {
        console.warn("Reviews server aggregate query warning:", aggErr);
      }

      const q = query(
        collection(db, "reviews"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      let snapshot;
      try {
        snapshot = await getDocsFromCache(q);
        if (!snapshot || snapshot.empty) {
          snapshot = await getDocs(q);
        }
      } catch (cacheErr) {
        snapshot = await getDocs(q);
      }
      const reviewsList: Review[] = [];
      snapshot.forEach((docSnapshot) => {
        reviewsList.push({
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Review);
      });
      setReviews(reviewsList);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Failed to load reviews list.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishReply = async (reviewId: string) => {
    const text = replyTexts[reviewId]?.trim();
    if (!text) {
      toast.error("Please enter reply text.");
      return;
    }

    setIsSubmittingReply(true);
    try {
      const reviewRef = doc(db, "reviews", reviewId);
      await updateDoc(reviewRef, {
        adminReply: text,
        repliedAt: serverTimestamp()
      });

      toast.success("Response published successfully.");
      setActiveReplyId(null);
      
      // Update local state instantly
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, adminReply: text, repliedAt: { toDate: () => new Date() } }
            : r
        )
      );
    } catch (err) {
      console.error("Error updating admin reply:", err);
      toast.error("Could not upload your response.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    try {
      const reviewRef = doc(db, "reviews", reviewId);
      await updateDoc(reviewRef, {
        adminReply: null,
        repliedAt: null
      });

      toast.success("Response cleared.");
      setReplyTexts((prev) => ({ ...prev, [reviewId]: "" }));
      
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, adminReply: undefined, repliedAt: undefined }
            : r
        )
      );
    } catch (err) {
      console.error("Error clearing reply:", err);
      toast.error("Could not delete response.");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      toast.success("Review deleted successfully.");
      setDeleteConfirmId(null);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Could not delete review.");
    }
  };

  // Filter computation
  const filteredReviews = reviews.filter((review) => {
    const textToMatch = `${review.userName || ""} ${review.productName || ""} ${review.comment || ""}`.toLowerCase();
    const matchesSearch = textToMatch.includes(searchTerm.toLowerCase());
    
    const matchesRating = ratingFilter === "all" || review.rating.toString() === ratingFilter;
    
    let matchesStatus = true;
    if (statusFilter === "replied") {
      matchesStatus = !!review.adminReply;
    } else if (statusFilter === "pending") {
      matchesStatus = !review.adminReply;
    }

    return matchesSearch && matchesRating && matchesStatus;
  });

  // KPI calculations using server aggregate queries (count(), average())
  const totalCount = serverStats.totalCount > 0 ? serverStats.totalCount : reviews.length;
  const avgRating = serverStats.totalCount > 0 
    ? serverStats.avgRating.toFixed(1) 
    : (reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "0.0");
  const pendingReplyCount = reviews.filter((r) => !r.adminReply).length;
  const RepliedCount = reviews.filter((r) => r.adminReply).length;

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8 animate-fade-in text-gray-950 font-sans">
      
      {/* Header and Descriptive HUD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare size={22} className="text-orange-600" />
            Product Reviews Workspace
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Monitor client appraisals, resolve issues by replying directly, or eliminate inappropriate reviews.
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="px-4 py-2 bg-orange-50 text-orange-600 font-bold rounded-xl text-xs hover:bg-orange-100 transition-all border-none cursor-pointer"
        >
          Refresh Feed
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">Total Reviews</span>
          <p className="text-2xl font-black tracking-tight mt-1 text-gray-900">{totalCount}</p>
        </div>
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">Average Score</span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black tracking-tight text-gray-900">{avgRating}</p>
            <div className="flex text-yellow-400 self-center">
              <Star size={14} fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-yellow-50/20 border border-yellow-105/30">
          <span className="text-[10px] uppercase font-black tracking-wider text-yellow-600">Pending Response</span>
          <p className="text-2xl font-black tracking-tight mt-1 text-yellow-600">{pendingReplyCount}</p>
        </div>
        <div className="p-5 rounded-2xl bg-green-50/20 border border-green-105/30">
          <span className="text-[10px] uppercase font-black tracking-wider text-green-600 font-black">Admin Replied</span>
          <p className="text-2xl font-black tracking-tight mt-1 text-green-600">{RepliedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar HUD */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-50/40 p-4 rounded-2xl border border-gray-100">
        
        {/* Search */}
        <div className="relative w-full lg:max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer, item name, or statement content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 text-sm font-medium rounded-xl outline-none focus:ring-1 focus:ring-orange-600 placeholder-gray-400"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-wild">Score:</span>
          </div>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 text-xs font-black rounded-xl outline-none focus:ring-1 focus:ring-orange-600"
          >
            <option value="all">All Stars ({totalCount})</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n.toString()}>{n} Star appraising</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-2">
            <Check size={14} className="text-gray-400" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-wild">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 text-xs font-black rounded-xl outline-none focus:ring-1 focus:ring-orange-600"
          >
            <option value="all">All Statuses</option>
            <option value="replied">Replied ({RepliedCount})</option>
            <option value="pending">Pending Reply ({pendingReplyCount})</option>
          </select>
        </div>
      </div>

      {/* List Feed or Loader */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Synchronizing review logs...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-gray-50/50 border border-gray-100 flex flex-col items-center justify-center space-y-3">
          <AlertCircle size={32} className="text-gray-300" />
          <h3 className="font-bold text-gray-700">No matching reviews found</h3>
          <p className="text-xs text-gray-400 max-w-sm">No customer reviews matched your search criteria or currently exist in this category.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReviews.map((review) => {
            const isEditingThis = activeReplyId === review.id;
            const isDeleteConfirmingThis = deleteConfirmId === review.id;

            return (
              <div
                key={review.id}
                className="p-6 rounded-2xl bg-white border border-gray-150/80 hover:border-gray-200 transition-all flex flex-col md:flex-row gap-6 justify-between items-start"
              >
                {/* Review Metadata & Images Column */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div>
                      <span className="text-xs text-orange-600 font-black tracking-tight hover:underline bg-orange-50/50 px-2 py-1 rounded-md">
                        {review.productName || `Product: ${review.productId}`}
                      </span>
                      <h4 className="font-bold text-sm text-gray-950 mt-1 flex items-center gap-1.5">
                        {review.userName || "Anonymous Customer"}
                      </h4>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">
                      {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : "Recently Added"}
                    </span>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex text-yellow-400 gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < review.rating ? "currentColor" : "none"}
                        className={i < review.rating ? "text-yellow-400" : "text-gray-250"}
                      />
                    ))}
                  </div>

                  {/* Review Text */}
                  <p className="text-xs text-gray-650 font-medium leading-relaxed bg-gray-50/30 p-3 rounded-xl border border-gray-100/30">
                    "{review.comment}"
                  </p>

                  {/* Thumbnail attachment previews */}
                  {review.images && review.images.length > 0 && (
                    <div className="flex items-center gap-2.5 pt-1">
                      <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={10} /> Photo Documentation ({review.images.length}):
                      </span>
                      <div className="flex gap-1.5">
                        {review.images.map((img, idx) => (
                          <div
                            key={idx}
                            className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in"
                            onClick={() => {
                              toast((t) => (
                                <div className="flex flex-col items-center p-1 bg-white">
                                  <img src={img} alt="Product Review Snap" className="max-w-[320px] max-h-[320px] rounded-lg object-contain" referrerPolicy="no-referrer" />
                                  <button onClick={() => toast.dismiss(t.id)} className="mt-2 text-[10px] font-black text-orange-600 border-none bg-transparent cursor-pointer uppercase">Dismiss</button>
                                </div>
                              ), { duration: 12000 });
                            }}
                          >
                            <img src={img} alt="" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Admin Reply Rendered nicely */}
                  {review.adminReply ? (
                    <div className="p-4 rounded-xl bg-orange-50/30 border border-orange-100/50 text-gray-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1">
                          <Check size={10} /> Active Sokoplus Response
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setReplyTexts((prev) => ({ ...prev, [review.id]: review.adminReply || "" }));
                              setActiveReplyId(review.id);
                            }}
                            className="text-[10px] text-gray-500 hover:text-orange-600 font-bold border-none bg-transparent cursor-pointer hover:underline"
                          >
                            Edit
                          </button>
                          <span className="text-[10px] text-gray-300">|</span>
                          <button
                            onClick={() => handleDeleteReply(review.id)}
                            className="text-[10px] text-red-550 hover:text-red-700 font-bold border-none bg-transparent cursor-pointer hover:underline"
                          >
                            Delete Reply
                          </button>
                        </div>
                      </div>
                      <p className="text-xs italic text-gray-700 leading-relaxed pr-8">
                        "{review.adminReply}"
                      </p>
                    </div>
                  ) : (
                    !isEditingThis && (
                      <button
                        onClick={() => {
                          setReplyTexts((prev) => ({ ...prev, [review.id]: "" }));
                          setActiveReplyId(review.id);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-750 font-bold border-none bg-transparent cursor-pointer bg-orange-50/40 hover:bg-orange-100/40 px-3 py-1.5 rounded-lg transition-colors mt-2"
                      >
                        <MessageCircle size={12} />
                        Publish Official Reply
                      </button>
                    )
                  )}

                  {/* Interactive Inline Reply Workspace */}
                  {isEditingThis && (
                    <div className="border border-orange-500/20 bg-orange-50/10 p-4 rounded-xl space-y-3 mt-4">
                      <label className="block text-[9px] font-black uppercase tracking-wider text-orange-600">
                        Write official storefront response
                      </label>
                      <textarea
                        rows={3}
                        value={replyTexts[review.id] || ""}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        placeholder="e.g., Thank you so much for your feedback! SokoPlus strives to guarantee authentic products..."
                        className="w-full p-3 bg-white border border-orange-200/50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-orange-600 leading-relaxed font-medium"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setActiveReplyId(null)}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer border-none"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handlePublishReply(review.id)}
                          disabled={isSubmittingReply}
                          className="px-4.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-750 text-white font-black text-xs transition-colors flex items-center gap-1 border-none cursor-pointer"
                        >
                          {isSubmittingReply ? "Publishing..." : "Publish Response"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Left Side Action Panels (Delete review document completely) */}
                <div className="flex items-center gap-2 mt-4 md:mt-0 self-end md:self-start">
                  {isDeleteConfirmingThis ? (
                    <div className="bg-red-50 p-2.5 rounded-xl border border-red-150 text-right space-y-1.5">
                      <span className="block text-[10px] font-black text-red-600 uppercase tracking-tight">
                        Confirm deleting review?
                      </span>
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-white text-gray-500 font-bold text-[9px] border border-gray-150 rounded-md cursor-pointer"
                        >
                          Abort
                        </button>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="px-2 py-1 bg-red-650 hover:bg-red-750 text-white font-black text-[9px] border-none rounded-md cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(review.id)}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl transition-all border-none cursor-pointer"
                      title="Delete review document completely"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
