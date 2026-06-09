import { useState, useEffect } from "react";
import { UserProfile, Product, Order, SupportTicket, BlogPost, JobOffer, JobApplication } from "../types";
import { db, auth } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  where,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Package,
  TrendingUp,
  Users,
  ShoppingBag,
  Search,
  Pencil,
  Inbox,
  CheckCircle2,
  Clock,
  MessageSquare,
  BookOpen,
  FileText,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link,
  Star,
  Eye,
  X,
  Settings,
  Upload,
  Image,
  Download,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  Coins,
  Briefcase,
  MapPin,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import RichTextEditor from "../components/RichTextEditor";
import { downloadReceipt } from "../utils/pdfGenerator";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AdminProps {
  user: UserProfile | null;
}

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  toast.error(`Error: ${errInfo.error}`);
}

const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 800; // Optimal HD but lightweight product sizing
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const compressed = canvas.toDataURL("image/jpeg", 0.7);
            resolve(compressed);
          } catch (e) {
            reject(new Error("Failed to compress image"));
          }
        } else {
          reject(new Error("Failed to resize image"));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image resource"));
      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
};

interface ProductImageManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function ProductImageManager({ images, onChange }: ProductImageManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUrlChange = (idx: number, val: string) => {
    const updated = [...images];
    updated[idx] = val;
    onChange(updated);
  };

  const handleAddField = () => {
    onChange([...images, ""]);
  };

  const handleRemoveField = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    onChange(updated.length > 0 ? updated : [""]);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    onChange(updated);
    toast.success("Image order updated! First image is now the main thumbnail.");
  };

  const moveDown = (idx: number) => {
    if (idx === images.length - 1) return;
    const updated = [...images];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    onChange(updated);
    toast.success("Image order updated! First image is now the main thumbnail.");
  };

  const handleFiles = async (files: FileList) => {
    setIsProcessing(true);
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast.error("Please drop or select valid image files only.");
      setIsProcessing(false);
      return;
    }

    const loaders = validFiles.map(async (file) => {
      try {
        return await compressImageFile(file);
      } catch (err: any) {
        console.error(err);
        toast.error(`Could not process "${file.name}": ${err.message}`);
        return null;
      }
    });

    const results = (await Promise.all(loaders)).filter((res): res is string => res !== null);
    if (results.length > 0) {
      const currentFiltered = images.filter(img => img.trim() !== "");
      onChange([...currentFiltered, ...results]);
      toast.success(`Successfully uploaded & optimized ${results.length} product image(s).`);
    }
    setIsProcessing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleReplaceSlotWithFile = async (idx: number, file: File) => {
    try {
      setIsProcessing(true);
      const optimized = await compressImageFile(file);
      const updated = [...images];
      updated[idx] = optimized;
      onChange(updated);
      toast.success("Image slot updated with fine optimized file.");
    } catch (err: any) {
      toast.error(`Failed to upload to slot: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase text-gray-400">
          Product Images (Upload or Link)
        </label>
        <button
          type="button"
          onClick={handleAddField}
          className="text-xs font-extrabold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-all"
        >
          + Add Empty Link Slot
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all relative ${
          isDragging ? "border-orange-500 bg-orange-50/50" : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"
        }`}
      >
        <UploadCloud className="mx-auto text-gray-400 mb-3" size={36} />
        <p className="text-sm font-semibold text-gray-700">
          Drag & drop product images here, or{" "}
          <label className="text-orange-600 underline cursor-pointer hover:text-orange-700 font-bold">
            browse local files
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>
        </p>
        <p className="text-xs text-gray-400 mt-1 font-medium">
          Supports JPG, PNG, WebP. Auto-resizes to deliver ultra-fast page speeds.
        </p>
        {isProcessing && (
          <div className="absolute inset-x-0 bottom-2 text-center text-xs text-orange-600 font-bold animate-pulse">
            Cropping and optimizing product images...
          </div>
        )}
      </div>

      <div className="space-y-3">
        {images.map((url, idx) => {
          const isValidUrl = url && url.trim().length > 0;
          const isCover = idx === 0;

          return (
            <div
              key={idx}
              className={`flex flex-col sm:flex-row gap-3 p-4 border rounded-2xl relative transition-all ${
                isCover ? "border-orange-200 bg-orange-50/10" : "border-gray-150 bg-white"
              }`}
            >
              <div className="absolute -top-2.5 -left-2 flex items-center">
                {isCover ? (
                  <span className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                    ★ COVER PREVIEW
                  </span>
                ) : (
                  <span className="bg-gray-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    Slot {idx + 1}
                  </span>
                )}
              </div>

              <div className="w-16 h-16 rounded-xl border border-gray-150 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {isValidUrl ? (
                  <img
                    src={url}
                    alt={`Product slot ${idx}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1594122230689-45899d9e6f69?auto=format&fit=crop&q=80&w=200";
                    }}
                  />
                ) : (
                  <Image className="text-gray-300" size={24} />
                )}
              </div>

              <div className="flex-grow flex flex-col gap-1 min-w-0">
                <input
                  type="text"
                  placeholder="Paste un-encoded image URL address or upload below"
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-150 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 text-gray-800"
                  value={url}
                  onChange={(e) => handleUrlChange(idx, e.target.value)}
                />
                <label className="text-[10px] text-gray-400 hover:text-orange-600 font-extrabold uppercase cursor-pointer flex items-center gap-1 w-fit">
                  <Upload size={10} />
                  <span>Upload file here</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReplaceSlotWithFile(idx, file);
                    }}
                  />
                </label>
              </div>

              <div className="flex sm:flex-col items-center justify-end gap-1.5 self-center sm:self-stretch">
                <div className="flex sm:flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveUp(idx)}
                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Make main preview thumbnail"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveDown(idx)}
                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Move image down"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveField(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Remove image slot"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PIE_COLORS = [
  "#ea580c", // principal orange-600
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#d97706", // amber-600
  "#06b6d4", // cyan-500
];

const CustomTrendsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rev = payload.find((p: any) => p.name === "Revenue (KES)")?.value || 0;
    const cost = payload.find((p: any) => p.name === "Cost of Goods (KES)")?.value || 0;
    const profit = payload.find((p: any) => p.name === "Gross Profit (KES)")?.value || 0;
    const ordersCount = payload.find((p: any) => p.name === "Orders Count")?.value ?? 
                        payload[0]?.payload?.["Orders Count"] ?? 0;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xl space-y-2.5 text-xs text-gray-800 font-sans">
        <p className="font-extrabold text-gray-900 border-b border-gray-100 pb-1.5">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block shrink-0"></span>
              Revenue:
            </span>
            <span className="font-black text-gray-900">KES {rev.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block shrink-0"></span>
              Cost of Goods:
            </span>
            <span className="font-bold text-gray-700">KES {cost.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-dashed border-gray-100 pt-1.5">
            <span className="flex items-center gap-1.5 text-emerald-700 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
              Gross Profit:
            </span>
            <span className="font-black text-emerald-600 text-sm">KES {profit.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 pt-1">
            <span className="text-gray-400 font-bold text-[10px] uppercase">Margin %:</span>
            <span className="font-extrabold text-emerald-700 text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/10">
              {margin.toFixed(1)}% Margin
            </span>
          </div>
          {ordersCount !== undefined && (
            <div className="flex items-center justify-between gap-6 border-t border-gray-100 pt-1 mt-1 text-[10px] text-gray-400 font-bold">
              <span>Orders Received:</span>
              <span>{ordersCount}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const CustomCategoryTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const rev = data["Revenue (KES)"] || 0;
    const cost = data["Cost of Goods (KES)"] || 0;
    const profit = data["Gross Profit (KES)"] || 0;
    const units = data["Units Sold"] || 0;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xl space-y-2 text-xs text-gray-800 font-sans z-50">
        <p className="font-extrabold text-orange-900 border-b border-gray-150 pb-1.5">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500 font-semibold">Total Revenue:</span>
            <span className="font-black text-gray-900">KES {rev.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500 font-semibold">Cost of Goods:</span>
            <span className="font-bold text-gray-700">KES {cost.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-gray-100 pt-1.5">
            <span className="font-black text-emerald-600">Actual Profit:</span>
            <span className="font-black text-emerald-600">KES {profit.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-6 pt-1">
            <span className="text-gray-400 font-bold text-[10px] uppercase">Margin %:</span>
            <span className="font-extrabold text-white bg-emerald-650 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">
              {margin.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-6 text-[10px] text-gray-400 font-bold pt-1">
            <span>Units Sold:</span>
            <span>{units} pcs</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function Admin({ user }: AdminProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedViewOrder, setSelectedViewOrder] = useState<any | null>(null);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [showJobAddModal, setShowJobAddModal] = useState(false);
  const [newJob, setNewJob] = useState({
    title: "",
    department: "Engineering",
    location: "Nairobi (Hybrid)",
    type: "Full-time",
    description: "",
    requirementsString: ""
  });
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [subTab, setSubTab] = useState<"openings" | "applicants">("openings");
  const [activeTab, setActiveTab] = useState<
    "inventory" | "orders" | "inbox" | "blogs" | "settings" | "careers"
  >("inventory");
  const [homepageHeroUrl, setHomepageHeroUrl] = useState<string>("");
  const [homepageHeroBadge, setHomepageHeroBadge] = useState<string>("Vetted excellence");
  const [homepageHeroHeading, setHomepageHeroHeading] = useState<string>("Authentic & Trusted Goods");
  const [googleMapsLink, setGoogleMapsLink] = useState<string>("");
  const [googleMapsLinks, setGoogleMapsLinks] = useState<{ name: string; url: string }[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSortBy, setOrderSortBy] = useState<string>("newest");
  const [blogSearchTerm, setBlogSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [productSortBy, setProductSortBy] = useState<string>("default");
  const [loading, setLoading] = useState(true);
  const [trendsPeriod, setTrendsPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showBlogAddModal, setShowBlogAddModal] = useState(false);
  const [showBlogEditModal, setShowBlogEditModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    originalPrice: 0,
    category: "Fashion",
    stock: 10,
    images: [""],
    artisan: "",
    buyingPrice: 0,
  });

  const [newBlog, setNewBlog] = useState({
    title: "",
    content: "",
    image: "",
    tagsString: "Artisans, Impact",
    author: "Sokoplus Team",
    readTime: "5 min read",
    publishedAt: new Date().toISOString().split("T")[0],
    seoTitle: "",
    seoDescription: "",
  });

  const fetchData = async () => {
    try {
      const pSnap = await getDocs(collection(db, "products"));
      setProducts(
        pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product),
      );

      const oSnap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc")),
      );
      let loadedOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);

      // 1-Year Order History TTL Cleanup policy
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const ordersOlderThanOneYear = loadedOrders.filter((order: any) => {
        let orderDate: Date;
        if (order.createdAt?.toDate) {
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt?.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else if (order.createdAt) {
          orderDate = new Date(order.createdAt);
        } else {
          orderDate = new Date();
        }
        return orderDate < oneYearAgo && (order.status === "delivered" || order.status === "cancelled");
      });

      if (ordersOlderThanOneYear.length > 0) {
        for (const ord of ordersOlderThanOneYear) {
          await deleteDoc(doc(db, "orders", ord.id));
        }
        const deletedIds = new Set(ordersOlderThanOneYear.map((o: any) => o.id));
        loadedOrders = loadedOrders.filter((o: any) => !deletedIds.has(o.id));
        toast.success(`Automated TTL: Cleared ${ordersOlderThanOneYear.length} Delivered/Cancelled orders older than one year.`);
      }

      // Capping recent orders to 50: autodelete excess Completed/Cancelled orders
      if (loadedOrders.length >= 50) {
        const deletable = loadedOrders.filter(
          (o: any) => o.status === "delivered" || o.status === "cancelled"
        );
        if (deletable.length > 0) {
          // Sort oldest first based on timestamp
          const sortedDeletable = [...deletable].sort((a: any, b: any) => {
            const getTs = (ord: any): number => {
              if (!ord.createdAt) return 0;
              if (typeof ord.createdAt.toDate === "function") {
                return ord.createdAt.toDate().getTime();
              }
              if (ord.createdAt.seconds !== undefined) {
                return ord.createdAt.seconds * 1000 + (ord.createdAt.nanoseconds || 0) / 1000000;
              }
              const date = new Date(ord.createdAt);
              return isNaN(date.getTime()) ? 0 : date.getTime();
            };
            return getTs(a) - getTs(b);
          });

          // To stay under 50 total orders, delete excess delivered/cancelled orders
          const maxAllowed = 49;
          const numToDelete = loadedOrders.length - maxAllowed;
          if (numToDelete > 0) {
            const toDelete = sortedDeletable.slice(0, numToDelete);
            for (const ord of toDelete) {
              await deleteDoc(doc(db, "orders", ord.id));
            }
            const deletedIds = new Set(toDelete.map((o: any) => o.id));
            loadedOrders = loadedOrders.filter((o: any) => !deletedIds.has(o.id));
            toast.success(`Enforced cap of 50 orders: auto-deleted ${toDelete.length} outdated archives (delivered/cancelled).`);
          }
        }
      }
      setOrders(loadedOrders);

      const tSnap = await getDocs(
        query(collection(db, "support_tickets"), orderBy("createdAt", "desc")),
      );
      setTickets(
        tSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket),
      );

      try {
        const bSnap = await getDocs(collection(db, "blog"));
        setBlogs(
          bSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || "",
              content: data.content || "",
              image: data.image || "",
              tags: data.tags || [],
              author: data.author || "Sokoplus Team",
              readTime: data.readTime || "4 min read",
              publishedAt: data.publishedAt,
              seoTitle: data.seoTitle || "",
              seoDescription: data.seoDescription || "",
            } as BlogPost;
          }),
        );
      } catch (blogErr) {
        console.warn(
          "Could not fetch blogs, using empty state or fallbacks",
          blogErr,
        );
      }

      try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          if (settingsData.heroImageUrl) {
            setHomepageHeroUrl(settingsData.heroImageUrl);
          }
          if (settingsData.heroBadgeText) {
            setHomepageHeroBadge(settingsData.heroBadgeText);
          }
          if (settingsData.heroHeadingText) {
            setHomepageHeroHeading(settingsData.heroHeadingText);
          }
          if (settingsData.googleMapsLink) {
            setGoogleMapsLink(settingsData.googleMapsLink);
          }
          if (settingsData.googleMapsLinks) {
            setGoogleMapsLinks(settingsData.googleMapsLinks);
          } else if (settingsData.googleMapsLink) {
            setGoogleMapsLinks([{ name: "Nairobi Store", url: settingsData.googleMapsLink }]);
          }
        }
      } catch (settingsError) {
        console.warn("Could not retrieve hero image settings: ", settingsError);
      }

      try {
        const jobsSnap = await getDocs(
          query(collection(db, "job_offers"), orderBy("createdAt", "desc"))
        );
        setJobOffers(
          jobsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as JobOffer)
        );

        const appsSnap = await getDocs(
          query(collection(db, "job_applications"), orderBy("createdAt", "desc"))
        );
        setJobApplications(
          appsSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              jobId: data.jobId || "",
              jobTitle: data.jobTitle || "",
              userId: data.userId || "",
              applicantName: data.applicantName || "",
              applicantEmail: data.applicantEmail || "",
              applicantPhone: data.applicantPhone || "",
              resumeDetails: data.resumeDetails || "",
              resumeName: data.resumeName || "",
              coverLetter: data.coverLetter || "",
              status: (data.status as any) || "pending",
              createdAt: data.createdAt || ""
            } as JobApplication;
          })
        );
      } catch (careersError) {
        console.warn("Could not retrieve careers data: ", careersError);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "products/orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchData();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image file is too large! Maximum limit is 12MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // High-definition but optimized boundary sizing
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;

        // Perform resize maintaining standard aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Render white solid background first (so transparent PNGs are clean JPEGs)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          try {
            // Compress with high quality parameter to JPEG
            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
            
            // Validate against the exact Firestore 1MB document limit
            const sizeInBytes = Math.round((compressedDataUrl.length * 3) / 4);
            if (sizeInBytes > 800 * 1024) {
              toast.error("The image is still too large to store. Please select a simpler image with less complexity.");
              return;
            }

            setHomepageHeroUrl(compressedDataUrl);
            toast.success("Image successfully optimized & loaded! Click 'Save Changes' to update the site.");
          } catch (compressErr) {
            console.error("Compression error:", compressErr);
            toast.error("Failed to compress and optimize the image file.");
          }
        } else {
          toast.error("Could not initialize browser canvas for graphics compression.");
        }
      };

      img.onerror = () => {
        toast.error("Failed to parse upload as a valid image.");
      };

      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.onerror = () => {
      toast.error("Failed to process the uploaded source file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      // Direct guard against Firestore document exceeding 1 MiB limit
      if (homepageHeroUrl && homepageHeroUrl.startsWith("data:") && homepageHeroUrl.length > 1.2 * 1024 * 1024) {
        toast.error("Saved settings exceed Firestore document limit! Please clear and upload an optimized image.");
        setIsSavingSettings(false);
        return;
      }

      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, {
        heroImageUrl: homepageHeroUrl,
        heroBadgeText: homepageHeroBadge,
        heroHeadingText: homepageHeroHeading,
        googleMapsLink: googleMapsLinks.length > 0 ? googleMapsLinks[0].url : "",
        googleMapsLinks: googleMapsLinks,
        updatedAt: new Date(),
        updatedBy: user?.email || "Admin",
      }, { merge: true });
      toast.success("Homepage settings successfully saved! Changes are now live.");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      if (error?.message && error.message.includes("exceeds the maximum")) {
        toast.error("Image file is still too large for the database limits. Try uploading a smaller size or link/URL.");
      } else {
        toast.error("Failed to save homepage settings.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    if (confirm("Are you sure you want to reset the hero banner back to default?")) {
      setIsSavingSettings(true);
      try {
        const settingsRef = doc(db, "settings", "homepage");
        await setDoc(settingsRef, {
          heroImageUrl: "",
          heroBadgeText: "Vetted excellence",
          heroHeadingText: "Authentic & Trusted Goods",
          googleMapsLink: "",
          googleMapsLinks: [],
          updatedAt: new Date(),
          updatedBy: user?.email || "Admin",
        }, { merge: true });
        setHomepageHeroUrl("");
        setHomepageHeroBadge("Vetted excellence");
        setHomepageHeroHeading("Authentic & Trusted Goods");
        setGoogleMapsLink("");
        setGoogleMapsLinks([]);
        toast.success("Successfully reset to default hero banner & texts!");
      } catch (error) {
        console.error("Error resetting settings:", error);
        toast.error("Failed to reset settings.");
      } finally {
        setIsSavingSettings(false);
      }
    }
  };

  const seedData = async () => {
    try {
      const sampleProducts = [
        {
          name: "Maasai Beaded Necklace",
          price: 2500,
          category: "Local Crafts",
          description: "Authentic handmade Maasai jewelry from Narok.",
          stock: 50,
          images: [
            "https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Mama Stacey of Narok Maasai Crafts",
          buyingPrice: 1500,
        },
        {
          name: "Sokoplus Tech Bag",
          price: 4500,
          category: "Fashion",
          description: "Waterproof laptop bag for the Nairobi commuter.",
          stock: 30,
          images: [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Kariobangi Leather Artisans",
          buyingPrice: 2800,
        },
        {
          name: "Coffee - Mount Kenya Special",
          price: 1200,
          category: "Groceries",
          description: "Premium medium roast coffee beans from Central Kenya.",
          stock: 100,
          images: [
            "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Nyeri Smallholder Coffee Coop",
          buyingPrice: 700,
        },
        {
          name: "Bamboo Speaker",
          price: 3200,
          category: "Electronics",
          description: "Eco-friendly bamboo bluetooth speaker, handcrafted.",
          stock: 15,
          images: [
            "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000",
          ],
          artisan: "Mombasa Sustainable Woodworks",
          buyingPrice: 1900,
        },
      ];
      for (const p of sampleProducts) {
        await addDoc(collection(db, "products"), {
          ...p,
          rating: 4.8,
          reviewCount: 15,
          createdAt: new Date().toISOString(),
        });
      }
      toast.success("Sample data seeded!");
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "products");
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-2xl font-bold">
        Access Denied
      </div>
    );
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!newProduct.name.trim()) {
      newErrors.name = "Product name is required";
    }
    if (newProduct.price <= 0) {
      newErrors.price = "Price must be greater than zero";
    }
    if (newProduct.stock < 0) {
      newErrors.stock = "Stock cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const sanitizedImages = newProduct.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      await addDoc(collection(db, "products"), {
        ...newProduct,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
        originalPrice: newProduct.originalPrice && newProduct.originalPrice > 0 ? newProduct.originalPrice : null,
        rating: 4.5,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      });
      toast.success("Product added successfully!");
      setShowAddModal(false);
      setNewProduct({
        name: "",
        description: "",
        price: 0,
        originalPrice: 0,
        category: "Fashion",
        stock: 10,
        images: [""],
        artisan: "",
        buyingPrice: 0,
      });
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "products");
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!id) {
      toast.error("This product has no valid ID.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`"${name}" has been deleted.`);
    } catch (error: any) {
      console.error("Delete error:", error);
      if (error.code === "permission-denied") {
        toast.error(
          "Access denied. You don't have permission to delete this product.",
        );
      } else {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const newErrors: { [key: string]: string } = {};
    if (!editingProduct.name.trim())
      newErrors.name = "Product name is required";
    if (editingProduct.price <= 0)
      newErrors.price = "Price must be greater than zero";
    if (editingProduct.stock < 0) newErrors.stock = "Stock cannot be negative";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingProduct;
      const sanitizedImages = updateData.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      
      const previousProduct = products.find((p) => p.id === id);
      const isPriceDropped = previousProduct && updateData.price < previousProduct.price;

      await updateDoc(doc(db, "products", id), {
        ...updateData,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
        originalPrice: editingProduct.originalPrice && editingProduct.originalPrice > 0 ? editingProduct.originalPrice : null,
      });

      if (isPriceDropped) {
        try {
          const q = query(
            collection(db, "price_drop_alerts"),
            where("productId", "==", id),
            where("status", "==", "active")
          );
          const alertsSnap = await getDocs(q);
          if (!alertsSnap.empty) {
            const batchPromises = alertsSnap.docs.map((alertDoc) => 
              updateDoc(doc(db, "price_drop_alerts", alertDoc.id), {
                status: "triggered",
                triggeredAt: new Date().toISOString(),
                triggeredPrice: updateData.price,
              })
            );
            await Promise.all(batchPromises);
            toast.success(`Triggered ${alertsSnap.size} price drop notification alert(s) for subscribed customers!`);
          }
        } catch (alertErr) {
          console.error("Failed to process alerts on price drop:", alertErr);
        }
      }

      toast.success("Product updated successfully!");
      setShowEditModal(false);
      setEditingProduct(null);
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `products/${editingProduct.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      await updateDoc(doc(db, "orders", orderId), { status });
      setOrders(
        orders.map((o) =>
          o.id === orderId ? { ...o, status: status as any } : o,
        ),
      );
      toast.success("Order updated.");
      if (status === "delivered" || status === "cancelled") {
        fetchData();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicket["status"],
  ) => {
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status,
        updatedAt: new Date().toISOString(),
      });
      setTickets(
        tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );
      toast.success("Ticket status updated.");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `support_tickets/${ticketId}`,
      );
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await deleteDoc(doc(db, "support_tickets", ticketId));
      setTickets(tickets.filter((t) => t.id !== ticketId));
      toast.success("Ticket deleted successfully.");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `support_tickets/${ticketId}`,
      );
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this order? This action cannot be undone."
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      setOrders(orders.filter((o) => o.id !== orderId));
      toast.success("Order deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const applyFormatting = (
    type:
      | "bold"
      | "italic"
      | "header"
      | "subheader"
      | "list"
      | "numlist"
      | "quote"
      | "link",
    target: "new" | "edit",
  ) => {
    const elementId =
      target === "new" ? "new-blog-content" : "edit-blog-content";
    const textarea = document.getElementById(
      elementId,
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = "";
    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        break;
      case "header":
        replacement = `\n## ${selectedText || "Heading"}\n`;
        break;
      case "subheader":
        replacement = `\n### ${selectedText || "Subheading"}\n`;
        break;
      case "list":
        replacement = `\n- ${selectedText || "List item"}\n`;
        break;
      case "numlist":
        replacement = `\n1. ${selectedText || "List item"}\n`;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "Quote"}\n`;
        break;
      case "link":
        replacement = `[${selectedText || "Link text"}](https://example.com)`;
        break;
    }

    const newContent =
      text.substring(0, start) + replacement + text.substring(end);

    if (target === "new") {
      setNewBlog({ ...newBlog, content: newContent });
    } else if (editingBlog) {
      setEditingBlog({ ...editingBlog, content: newContent });
    }

    // Refocus and select the new text after state update
    setTimeout(() => {
      textarea.focus();
      const selectionOffset = replacement.length - selectedText.length;
      textarea.setSelectionRange(start, end + selectionOffset);
    }, 50);
  };

  const handleAddBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlog.title.trim()) {
      toast.error("Blog title is required.");
      return;
    }
    if (!newBlog.content.trim()) {
      toast.error("Blog content is required.");
      return;
    }

    setLoading(true);
    try {
      const parsedTags = newBlog.tagsString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await addDoc(collection(db, "blog"), {
        title: newBlog.title,
        content: newBlog.content,
        image:
          newBlog.image ||
          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
        tags: parsedTags,
        author: newBlog.author || "Sokoplus Team",
        readTime: newBlog.readTime || "5 min read",
        publishedAt: `${newBlog.publishedAt || new Date().toISOString().split("T")[0]}T12:00:00Z`,
        seoTitle: newBlog.seoTitle || "",
        seoDescription: newBlog.seoDescription || "",
      });

      toast.success("Blog post created successfully!");
      setShowBlogAddModal(false);
      setNewBlog({
        title: "",
        content: "",
        image: "",
        tagsString: "Artisans, Impact",
        author: "Sokoplus Team",
        readTime: "5 min read",
        publishedAt: new Date().toISOString().split("T")[0],
        seoTitle: "",
        seoDescription: "",
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "blog");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingBlog ||
      !editingBlog.title.trim() ||
      !editingBlog.content.trim()
    ) {
      toast.error("Title and content are required.");
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingBlog;
      await updateDoc(doc(db, "blog", id), {
        ...updateData,
      });
      toast.success("Blog post updated successfully!");
      setShowBlogEditModal(false);
      setEditingBlog(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `blog/${editingBlog.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteBlog = async (id: string, title: string) => {
    if (!id) {
      toast.error("Could not find a valid blog ID.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "blog", id));
      setBlogs((prev) => prev.filter((b) => b.id !== id));
      toast.success(`Blog post "${title}" has been deleted.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blog/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = orders.reduce(
    (acc, o) =>
      acc +
      (o.status !== "cancelled" && o.paymentStatus === "paid"
        ? o.totalAmount
        : 0),
    0,
  );

  const totalProfit = orders.reduce((acc, o) => {
    if (o.status === "cancelled" || o.paymentStatus !== "paid") return acc;
    const orderCost = o.items.reduce((costSum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
      return costSum + unitCost * item.quantity;
    }, 0);
    const orderRevenue = o.items.reduce((revSum, item) => revSum + item.price * item.quantity, 0);
    const orderProfit = orderRevenue - orderCost;
    return acc + orderProfit;
  }, 0);

  const totalItemsRevenue = orders.reduce((acc, o) => {
    if (o.status === "cancelled" || o.paymentStatus !== "paid") return acc;
    const orderRevenue = o.items.reduce((revSum, item) => revSum + item.price * item.quantity, 0);
    return acc + orderRevenue;
  }, 0);
  const averageMarginPercentage = totalItemsRevenue > 0 ? (totalProfit / totalItemsRevenue) * 100 : 0;

  const getOrderTimestamp = (order: any): number => {
    if (!order.createdAt) return 0;
    if (typeof order.createdAt.toDate === "function") {
      return order.createdAt.toDate().getTime();
    }
    if (order.createdAt.seconds !== undefined) {
      return order.createdAt.seconds * 1000 + (order.createdAt.nanoseconds || 0) / 1000000;
    }
    const date = new Date(order.createdAt);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  };

  // Daily Performance (Past 30 Days)
  const dailyAnalyticsData = Array.from({ length: 30 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (29 - i));
    const label = day.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
    
    const startOfThisDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const endOfThisDay = startOfThisDay + 24 * 60 * 60 * 1000;

    const dayOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfThisDay && ts < endOfThisDay && o.status !== "cancelled";
    });

    const dailyRevenue = dayOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const dailyCOGS = dayOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const dailyProfit = Math.max(0, dailyRevenue - dailyCOGS);

    return {
      date: label,
      "Revenue (KES)": dailyRevenue,
      "Cost of Goods (KES)": dailyCOGS,
      "Gross Profit (KES)": dailyProfit,
      "Orders Count": dayOrders.length,
    };
  });

  // Weekly Performance (Past 12 Weeks)
  const weeklyAnalyticsData = Array.from({ length: 12 }, (_, i) => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (11 - i) * 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    const label = `Wk ${i + 1} (${startOfWeek.toLocaleDateString("en-KE", { month: "short", day: "numeric" })})`;

    const weekOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfWeek.getTime() && ts < endOfWeek.getTime() && o.status !== "cancelled";
    });

    const weeklyRevenue = weekOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const weeklyCOGS = weekOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const weeklyProfit = Math.max(0, weeklyRevenue - weeklyCOGS);

    return {
      date: label,
      "Revenue (KES)": weeklyRevenue,
      "Cost of Goods (KES)": weeklyCOGS,
      "Gross Profit (KES)": weeklyProfit,
      "Orders Count": weekOrders.length,
    };
  });

  // Monthly Performance (Past 12 Months)
  const monthlyAnalyticsData = Array.from({ length: 12 }, (_, i) => {
    const today = new Date();
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
    const label = monthDate.toLocaleDateString("en-KE", { month: "short", year: "2-digit" });

    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime();
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).getTime();

    const monthOrders = orders.filter((o) => {
      const ts = getOrderTimestamp(o);
      return ts >= startOfMonth && ts < endOfMonth && o.status !== "cancelled";
    });

    const monthlyRevenue = monthOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const monthlyCOGS = monthOrders.reduce((sum, o) => {
      return sum + o.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        return itemSum + unitCost * item.quantity;
      }, 0);
    }, 0);

    const monthlyProfit = Math.max(0, monthlyRevenue - monthlyCOGS);

    return {
      date: label,
      "Revenue (KES)": monthlyRevenue,
      "Cost of Goods (KES)": monthlyCOGS,
      "Gross Profit (KES)": monthlyProfit,
      "Orders Count": monthOrders.length,
    };
  });

  // Category Earnings & Profitability Breakdown
  const categoryAnalytics = (() => {
    const categoriesMap: { [key: string]: { revenue: number; cogs: number; profit: number; unitsSold: number } } = {};
    
    orders.forEach((o) => {
      if (o.status === "cancelled" || o.paymentStatus !== "paid") return;
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const category = prod?.category || "Uncategorized";
        const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
        
        const itemRevenue = item.price * item.quantity;
        const itemCost = unitCost * item.quantity;
        const itemProfit = itemRevenue - itemCost;

        if (!categoriesMap[category]) {
          categoriesMap[category] = { revenue: 0, cogs: 0, profit: 0, unitsSold: 0 };
        }
        categoriesMap[category].revenue += itemRevenue;
        categoriesMap[category].cogs += itemCost;
        categoriesMap[category].profit += itemProfit;
        categoriesMap[category].unitsSold += item.quantity;
      });
    });

    return Object.entries(categoriesMap).map(([category, data]) => ({
      name: category,
      "Revenue (KES)": data.revenue,
      "Cost of Goods (KES)": data.cogs,
      "Gross Profit (KES)": Math.max(0, data.profit),
      "Units Sold": data.unitsSold,
    })).sort((a, b) => b["Revenue (KES)"] - a["Revenue (KES)"]);
  })();

  const activeTrendsData = 
    trendsPeriod === "daily" 
      ? dailyAnalyticsData 
      : trendsPeriod === "weekly" 
        ? weeklyAnalyticsData 
        : monthlyAnalyticsData;

  const filteredOrders = orders
    .filter((o) => {
      const cleanTerm = orderSearchTerm.trim().toLowerCase().replace(/^#/, "");
      if (!cleanTerm) return orderStatusFilter === "all" || o.status === orderStatusFilter;

      const receiptId = o.id.slice(0, 8).toLowerCase();
      const fullId = o.id.toLowerCase();
      const userId = o.userId.toLowerCase();
      const userEmail = (o.userEmail || "").toLowerCase();
      const paymentRef = (o.paymentReference || "").toLowerCase();

      const matchesSearch = 
        receiptId.includes(cleanTerm) ||
        fullId.includes(cleanTerm) ||
        userId.includes(cleanTerm) ||
        userEmail.includes(cleanTerm) ||
        paymentRef.includes(cleanTerm);

      const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const timeA = getOrderTimestamp(a);
      const timeB = getOrderTimestamp(b);
      return orderSortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

  const handleDownloadCSV = () => {
    const headers = ["Order ID", "Customer ID / Email", "Date", "Status", "Total Amount"];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map((o) => {
      let dateStr = "";
      if (o.createdAt) {
        const dateObj = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        dateStr = dateObj.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
      } else {
        dateStr = "N/A";
      }
      return [
        o.id,
        o.userEmail || o.userId,
        dateStr,
        o.status,
        `KES ${o.totalAmount}`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sokoplus_orders_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully!");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-gray-500">
            Welcome back, {user.displayName}. Managing Soplus Kenya.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={seedData}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-gray-200 transition-all self-start"
          >
            Seed Sample Data
          </button>
          {activeTab === "blogs" ? (
            <button
              onClick={() => setShowBlogAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Create Blog Post
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-orange-600 bg-orange-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Total Sales
          </p>
          <p className="text-2xl font-black">
            KES {totalSales.toLocaleString()}
          </p>
        </div>
        <div className="bg-orange-950/5 p-6 rounded-3xl border border-orange-100/50 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute right-2 top-2 text-[9px] uppercase font-black text-orange-650 bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200/50 tracking-tighter">
            Internal
          </div>
          <div className="text-orange-655 bg-orange-100/50 w-10 h-10 rounded-xl flex items-center justify-center">
            <Coins size={20} />
          </div>
          <p className="text-xs font-bold text-gray-550 uppercase">
            Est. Gross Profit
          </p>
          <p className="text-2xl font-black text-orange-850">
            KES {totalProfit.toLocaleString()}
          </p>
          <p className="text-[11px] font-bold text-orange-600 uppercase tracking-tight">
            ★ Avg Margin: {averageMarginPercentage.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-blue-600 bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <Package size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Total Orders
          </p>
          <p className="text-2xl font-black">{orders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-green-600 bg-green-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Unique Products
          </p>
          <p className="text-2xl font-black">{products.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-purple-600 bg-purple-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Blog Stories
          </p>
          <p className="text-2xl font-black">{blogs.length}</p>
        </div>
      </div>

      {/* Analytics Chart Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Trends Chart details (Col Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="text-orange-600" size={20} />
                  <span>Business Performance Trend Lines</span>
                </h2>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  Interactive visualization of paid revenue, internal costs, and real gross profit margins.
                </p>
              </div>

              {/* Timescale Selector toggles */}
              <div className="flex bg-gray-50 border border-gray-100/80 p-1 rounded-2xl w-fit self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("daily")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "daily"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("weekly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "weekly"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setTrendsPeriod("monthly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    trendsPeriod === "monthly"
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Recharts Trend Line View */}
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeTrendsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `KES ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip content={<CustomTrendsTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                  />

                  <Area 
                    type="monotone" 
                    dataKey="Gross Profit (KES)" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProfitGradient)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Revenue (KES)" 
                    stroke="#ea580c" 
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Cost of Goods (KES)" 
                    stroke="#6b7280" 
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Profits Breakdown (Col Span 1) */}
          <div className="bg-orange-50/15 border border-orange-100 rounded-3xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-md font-bold text-gray-900 flex items-center gap-1.5">
                <Coins className="text-orange-655" size={16} />
                <span>Earnings by Category</span>
              </h3>
              <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">
                Acquisition Optimizer
              </p>
            </div>

            {categoryAnalytics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 border border-dashed border-gray-100 rounded-2xl bg-white/50">
                <Package className="text-gray-300" size={32} />
                <p className="text-[11px] font-bold text-gray-400 uppercase">No completed orders data</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                
                {/* Pie Chart element */}
                <div className="h-32 w-full flex items-center justify-center relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-gray-400 uppercase font-black tracking-tight leading-none">Total Profit</span>
                    <span className="text-sm font-black text-emerald-600 mt-0.5">KES {totalProfit.toLocaleString()}</span>
                  </div>
                  
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryAnalytics}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="Gross Profit (KES)"
                      >
                        {categoryAnalytics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomCategoryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list with exact numbers and metrics */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {categoryAnalytics.map((entry, index) => {
                    const profit = entry["Gross Profit (KES)"];
                    const rev = entry["Revenue (KES)"];
                    const margin = rev > 0 ? (profit / rev) * 100 : 0;
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs font-semibold bg-white p-2 border border-gray-100/50 hover:bg-orange-50/20 transition-all">
                        <div className="flex items-center space-x-2 truncate">
                          <span 
                            className="w-2.5 h-2.5 rounded-md inline-block shrink-0" 
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <span className="text-gray-800 text-xs font-bold truncate">{entry.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-950 text-[11px]">KES {profit.toLocaleString()}</p>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">{margin.toFixed(0)}% margin ({entry["Units Sold"]} sold)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[9px] text-gray-400 font-extrabold text-center uppercase tracking-tight">
              * Higher margins highlight best categories to acquire
            </p>
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "inventory" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "orders" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "inbox" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Inbox{" "}
          {tickets.filter((t) => t.status === "open").length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tickets.filter((t) => t.status === "open").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("blogs")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "blogs" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Blog Manager
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "settings" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Admin Settings
        </button>
        <button
          onClick={() => setActiveTab("careers")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "careers" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Careers Board
        </button>
      </div>

      <div>
        {activeTab === "inventory" && (
          /* Products Table */
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <h2 className="text-xl font-bold mb-6">Inventory Management</h2>
            
            {/* Filter controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-50">
              <div className="flex flex-wrap items-center gap-4">
                {/* Minimum Rating Selector */}
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Minimum Rating</span>
                  <select
                    value={minRatingFilter}
                    onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer min-w-[140px]"
                  >
                    <option value={0}>All Ratings</option>
                    <option value={1}>1.0+ Stars</option>
                    <option value={2}>2.0+ Stars</option>
                    <option value={3}>3.0+ Stars</option>
                    <option value={4}>4.0+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                    <option value={5}>5.0 Stars</option>
                  </select>
                </div>

                {/* Sort dropdown */}
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Sort By</span>
                  <select
                    value={productSortBy}
                    onChange={(e) => setProductSortBy(e.target.value)}
                    className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer min-w-[180px]"
                  >
                    <option value="default">Default</option>
                    <option value="rating-desc">Rating: High to Low</option>
                    <option value="rating-asc">Rating: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="stock-asc">Stock: Low to High</option>
                    <option value="stock-desc">Stock: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Product search input */}
              <div className="flex flex-col space-y-1 w-full md:max-w-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Search Directory</span>
                <div className="relative group">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search product name or category..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm text-gray-900"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
                    <th className="pb-4 uppercase">Product</th>
                    <th className="pb-4 uppercase">Category</th>
                    <th className="pb-4 uppercase text-center">Rating</th>
                    <th className="pb-4 uppercase text-center">Status</th>
                    <th className="pb-4 uppercase text-center">Stock</th>
                    <th className="pb-4 uppercase text-right">Price</th>
                    <th className="pb-4 uppercase text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products
                    .filter((p) => {
                      const rating = p.rating || 0;
                      if (rating < minRatingFilter) return false;
                      
                      if (
                        productSearchTerm.trim() !== "" &&
                        !p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
                        !p.category.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
                        !(p.artisan || "").toLowerCase().includes(productSearchTerm.toLowerCase())
                      ) {
                        return false;
                      }
                      
                      return true;
                    })
                    .sort((a, b) => {
                      if (productSortBy === "rating-desc") {
                        return (b.rating || 0) - (a.rating || 0);
                      }
                      if (productSortBy === "rating-asc") {
                        return (a.rating || 0) - (b.rating || 0);
                      }
                      if (productSortBy === "price-desc") {
                        return b.price - a.price;
                      }
                      if (productSortBy === "price-asc") {
                        return a.price - b.price;
                      }
                      if (productSortBy === "stock-asc") {
                        return a.stock - b.stock;
                      }
                      if (productSortBy === "stock-desc") {
                        return b.stock - a.stock;
                      }
                      return 0;
                    })
                    .map((p) => (
                      <tr key={p.id} className={`text-sm hover:bg-gray-50/50 transition-all ${p.active === false ? "opacity-60 bg-gray-50/20" : ""}`}>
                        <td className="py-4">
                          <div className="font-bold">{p.name}</div>
                          {p.artisan && (
                            <div className="text-[11px] font-semibold text-orange-600">by {p.artisan}</div>
                          )}
                        </td>
                        <td className="py-4 text-gray-500">{p.category}</td>
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center space-x-1 font-bold text-gray-700 bg-amber-50/50 py-1 px-2.5 rounded-full border border-amber-100/30 w-fit mx-auto">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span>{p.rating?.toFixed(1) || "N/A"}</span>
                            {p.reviewCount !== undefined && p.reviewCount > 0 && (
                              <span className="text-[10px] text-gray-400 font-medium">({p.reviewCount})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const newStatus = p.active === false;
                                try {
                                  await updateDoc(doc(db, "products", p.id), {
                                    active: newStatus,
                                  });
                                  setProducts((prev) =>
                                    prev.map((prod) =>
                                      prod.id === p.id
                                        ? { ...prod, active: newStatus }
                                        : prod,
                                    ),
                                  );
                                  toast.success(
                                    `"${p.name}" is now ${newStatus ? "Active" : "Inactive"}`
                                  );
                                } catch (error) {
                                  handleFirestoreError(
                                    error,
                                    OperationType.UPDATE,
                                    `products/${p.id}`,
                                  );
                                }
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                p.active !== false ? "bg-orange-600" : "bg-gray-200"
                              }`}
                              title={p.active !== false ? "Switch to Inactive" : "Switch to Active"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  p.active !== false ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className={`text-[10px] uppercase tracking-wider font-extrabold select-none ${p.active !== false ? "text-green-600" : "text-gray-400"}`}>
                              {p.active !== false ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            className="w-16 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold outline-none focus:ring-1 focus:ring-orange-600 transition-all py-1"
                            value={p.stock}
                            onChange={async (e) => {
                              const newStock = Number(e.target.value);
                              try {
                                await updateDoc(doc(db, "products", p.id), {
                                  stock: newStock,
                                });
                                setProducts((prev) =>
                                  prev.map((prod) =>
                                    prod.id === p.id
                                      ? { ...prod, stock: newStock }
                                      : prod,
                                  ),
                                );
                              } catch (error) {
                                handleFirestoreError(
                                  error,
                                  OperationType.UPDATE,
                                  `products/${p.id}`,
                                );
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4 text-right font-black">
                        KES {p.price.toLocaleString()}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setShowEditModal(true);
                            }}
                            className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Product"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id, p.name)}
                            className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          /* Orders Table */
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold">Recent Orders</h2>
              <div className="flex flex-wrap items-center gap-4">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={orderSortBy}
                  onChange={(e) => setOrderSortBy(e.target.value)}
                  className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <div className="relative group flex-grow max-w-sm">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search Receipt ID (#ABC1234F), Email, or M-Pesa Ref..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-medium"
                  />
                </div>
                <button
                  type="button"
                  id="admin-download-csv-btn"
                  onClick={handleDownloadCSV}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-2xl text-sm font-bold shadow-sm flex items-center space-x-2 transition-all cursor-pointer hover:shadow"
                >
                  <Download size={16} />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
                    <th className="pb-4 uppercase">Order ID</th>
                    <th className="pb-4 uppercase">Customer</th>
                    <th className="pb-4 uppercase">Status</th>
                    <th className="pb-4 uppercase text-right">Total</th>
                    <th className="pb-4 uppercase text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="text-sm hover:bg-gray-50/50">
                        <td className="py-4 font-mono text-xs text-gray-400">
                          #{o.id.slice(0, 8)}
                        </td>
                        <td className="py-4 text-gray-700">
                          <div>{o.userEmail || o.userId.slice(0, 8)}</div>
                          {o.createdAt && (
                            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                              {o.createdAt.toDate
                                ? o.createdAt.toDate().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
                                : new Date(o.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <select
                            value={o.status}
                            onChange={(e) =>
                              updateOrderStatus(o.id, e.target.value)
                            }
                            className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase outline-none cursor-pointer ${
                              o.status === "delivered"
                                ? "bg-green-100 text-green-700"
                                : o.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="py-4 text-right font-black">
                          KES {o.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedViewOrder(o)}
                              className="inline-flex items-center justify-center text-orange-600 p-2 hover:bg-orange-50 rounded-xl transition-all group cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                            {o.status === "delivered" || o.status === "cancelled" ? (
                              <button
                                type="button"
                                onClick={() => deleteOrder(o.id)}
                                className="inline-flex items-center justify-center text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all hover:text-red-700 group cursor-pointer"
                                title="Delete Order"
                              >
                                <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                              </button>
                            ) : (
                              <div className="w-8 shrink-0"></div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-gray-500 font-medium"
                      >
                        No orders found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "inbox" && (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold flex items-center">
                <Inbox className="mr-2 text-orange-600" /> Support Inbox
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {tickets.length} Total Tickets
              </p>
            </div>

            {tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={`p-6 rounded-3xl border transition-all ${t.status === "resolved" || t.status === "closed" ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-orange-100 shadow-sm"}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-3 rounded-2xl ${
                            t.subject === "Technical Support"
                              ? "bg-red-50 text-red-600"
                              : t.subject === "Billing/Invoices"
                                ? "bg-green-50 text-green-600"
                                : t.subject === "Order Status"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{t.subject}</h4>
                          <p className="text-sm text-gray-500">
                            From:{" "}
                            <span className="font-medium text-gray-900">
                              {t.email}
                            </span>
                          </p>
                        </div>
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) =>
                          updateTicketStatus(
                            t.id,
                            e.target.value as SupportTicket["status"],
                          )
                        }
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase outline-none cursor-pointer border-none shadow-sm ${
                          t.status === "resolved"
                            ? "bg-green-600 text-white"
                            : t.status === "open"
                              ? "bg-orange-100 text-orange-700"
                              : t.status === "in-progress"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-400 text-white"
                        }`}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-gray-700 whitespace-pre-wrap text-sm leading-relaxed border border-gray-100">
                      {t.message}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {t.createdAt?.toDate
                          ? t.createdAt.toDate().toLocaleString()
                          : String(t.createdAt)}
                      </div>
                      <div className="flex items-center space-x-3">
                        {t.status === "closed" && (
                          <button
                            onClick={() => deleteTicket(t.id)}
                            className="flex items-center text-red-600 hover:text-red-700 transition-all font-bold group"
                          >
                            <Trash2 size={12} className="mr-1 text-red-500 group-hover:scale-110 transition-transform" /> Delete Ticket
                          </button>
                        )}
                        {t.status !== "resolved" && t.status !== "closed" && (
                          <button
                            onClick={() => updateTicketStatus(t.id, "resolved")}
                            className="flex items-center text-green-600 hover:text-green-700 transition-colors"
                          >
                            <CheckCircle2 size={12} className="mr-1" /> Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="bg-gray-50 p-6 rounded-full">
                  <Inbox size={48} />
                </div>
                <p className="font-bold uppercase tracking-widest text-xs">
                  No support tickets found
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "blogs" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center text-gray-950">
                <BookOpen className="mr-2 text-orange-600" /> Blog Stories &
                Articles
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create, edit, and keep Kenyan artisan stories updated.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group flex-grow max-w-xs sm:w-64 font-sans text-gray-950">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search blogs by title..."
                  value={blogSearchTerm}
                  onChange={(e) => setBlogSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                />
              </div>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-2xl flex items-center shadow-md transition-all shrink-0"
                title="Create Blog Post"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {blogs.filter((b) =>
            b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
          ).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs
                .filter((b) =>
                  b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
                )
                .map((blog) => (
                  <div
                    key={blog.id}
                    className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full group text-gray-950"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={
                          blog.image ||
                          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop"
                        }
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingBlog({
                              ...blog,
                              tags: blog.tags || [],
                            });
                            setShowBlogEditModal(true);
                          }}
                          className="p-2.5 bg-white/95 text-blue-600 rounded-xl hover:bg-white shadow-md hover:text-blue-700 transition-all"
                          title="Edit Blog"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => deleteBlog(blog.id, blog.title)}
                          className="p-2.5 bg-white/95 text-red-600 rounded-xl hover:bg-white shadow-md hover:text-red-700 transition-all"
                          title="Delete Blog"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow space-y-4">
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>By {blog.author || "Sokoplus Team"}</span>
                        <span>•</span>
                        <span>{blog.readTime || "5 min read"}</span>
                      </div>
                      <h3 className="font-bold text-gray-950 text-base leading-tight group-hover:text-orange-600 transition-all line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed flex-grow">
                        {blog.content}
                      </p>
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 font-sans">
                          {blog.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-extrabold tracking-tight bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md uppercase"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <div className="inline-flex p-4 rounded-full bg-orange-50 text-orange-600 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Articles Found
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                None of your artisan stories or news articles match the current
                filter search.
              </p>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-2.5 rounded-2xl text-sm transition-all shadow-sm"
              >
                Create Your First Article
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8 animate-fade-in text-gray-950">
          <div>
            <h2 className="text-xl font-bold flex items-center text-gray-950">
              <Settings className="mr-2 text-orange-600 animate-spin-slow" /> Administrative Website Controls
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure active marketing campaigns, visual headers, and customizable homepage assets.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
            {/* Left Column: Form Settings controls */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 bg-orange-50/40 rounded-3xl border border-orange-100/50 space-y-3">
                <h3 className="text-sm font-bold text-orange-850 flex items-center">
                  <Image size={16} className="mr-2 text-orange-600" /> Homepage Hero Banner Configuration
                </h3>
                <p className="text-xs text-orange-705 leading-relaxed font-medium">
                  Personalize the first visual banner shown to Kenyan shoppers and global collectors. You can either paste an image URL or upload a custom image file below.
                </p>
              </div>

              {/* URL Option */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Custom Image Source URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="e.g. https://images.unsplash.com/photo-..."
                    value={homepageHeroUrl}
                    onChange={(e) => setHomepageHeroUrl(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950"
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                  Paste the direct URL of any high-resolution image hosted online.
                </p>
              </div>

              {/* Upload Option */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Or Upload Direct Image Target
                </label>
                <div className="border border-dashed border-gray-200 hover:border-orange-300 rounded-2xl p-6 bg-gray-50/50 hover:bg-orange-50/10 transition-colors flex flex-col items-center justify-center text-center relative group min-h-[140px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="Upload homepage hero image"
                  />
                  <Upload size={28} className="text-gray-400 group-hover:text-orange-600 transition-colors duration-200" />
                  <p className="text-xs font-bold text-gray-705 mt-2">
                    Click or Drag to Upload
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold leading-relaxed">
                    PNG, JPG, JPEG formats accepted (Max size: 2.5MB)
                  </p>
                </div>
              </div>

              {/* Overlay Badge and Heading Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                    Hero Badge Text Overlay
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="e.g. Vetted excellence"
                    value={homepageHeroBadge}
                    onChange={(e) => setHomepageHeroBadge(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                    Max 30 characters. Describes active standard trust label (e.g., "Verified Artisans").
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                    Hero Main Headline Overlay
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="e.g. Authentic & Trusted Goods"
                    value={homepageHeroHeading}
                    onChange={(e) => setHomepageHeroHeading(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                    Max 40 characters. High-impact text displayed over image template.
                  </p>
                </div>
              </div>

              {/* Google Maps Link Configuration */}
              <div className="p-6 bg-orange-50/20 dark:bg-orange-950/10 rounded-3xl border border-orange-100/50 dark:border-orange-900/30 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-orange-850 dark:text-orange-400 flex items-center">
                    <MapPin size={16} className="mr-2 text-orange-600 animate-pulse" /> Google Maps Shop Locations
                  </h3>
                  <p className="text-xs text-orange-705 dark:text-orange-300 leading-relaxed font-medium">
                    Configure names and links for all physical shop locations. These will be beautifully visible as an active dropdown or list directory inside the footer section.
                  </p>
                </div>

                <div className="space-y-3">
                  {googleMapsLinks.map((loc, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 p-4 bg-white/70 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl relative group pb-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-400 block">
                          Location Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Nairobi CBD Main Office"
                          value={loc.name}
                          onChange={(e) => {
                            const updated = [...googleMapsLinks];
                            updated[idx].name = e.target.value;
                            setGoogleMapsLinks(updated);
                          }}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-900 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950 dark:text-white"
                        />
                      </div>
                      
                      <div className="flex-[2] space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-400 block">
                          Google Maps Link URL
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="e.g. https://maps.app.goo.gl/..."
                            value={loc.url}
                            onChange={(e) => {
                              const updated = [...googleMapsLinks];
                              updated[idx].url = e.target.value;
                              setGoogleMapsLinks(updated);
                            }}
                            className="flex-1 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-150 dark:border-gray-900 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs font-sans text-gray-950 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = googleMapsLinks.filter((_, i) => i !== idx);
                              setGoogleMapsLinks(updated);
                            }}
                            className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                            title="Remove Location"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {googleMapsLinks.length === 0 && (
                    <div className="p-6 bg-white/40 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center space-y-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium font-sans">No physical shop locations configured yet.</p>
                      <button
                        type="button"
                        onClick={() => setGoogleMapsLinks([{ name: "Nairobi Store", url: "" }])}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer border-none"
                      >
                        <Plus size={14} /> Add First Location
                      </button>
                    </div>
                  )}

                  {googleMapsLinks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGoogleMapsLinks([...googleMapsLinks, { name: "", url: "" }])}
                      className="w-full py-3 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 border-dashed text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 hover:border-orange-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} className="text-orange-600" /> Add Another Store Location
                    </button>
                  )}
                </div>
              </div>

              {/* Sizing, Aspect, and Placement safety guidance */}
              <div className="p-5 bg-gray-50 rounded-2xl space-y-2 text-xs border border-gray-100/50">
                <p className="font-bold text-gray-800 uppercase tracking-tight text-[11px]">Recommended Asset Specifications:</p>
                <ul className="space-y-1.5 text-gray-500 font-semibold list-disc pl-4 text-[11px]">
                  <li><strong className="text-gray-700">Aspect Ratio:</strong> Strictly 1:1 Square (e.g., 800x800px or 1000x1000px) ensures balanced spatial rhythm and prevents visual warping on responsive viewports.</li>
                  <li><strong className="text-gray-700">Dimensions:</strong> Recommended minimum of 600px width for premium organic sharpness.</li>
                  <li><strong className="text-gray-700">Aesthetics:</strong> High-contrasting colors, vibrant warm tones, or minimalist negative space backgrounds to preserve the premium African marketplace visual identity.</li>
                </ul>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold px-6 py-3.5 rounded-2xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {isSavingSettings ? "Saving Settings..." : "Save Marketing Settings"}
                </button>
                <button
                  type="button"
                  onClick={handleResetSettings}
                  disabled={isSavingSettings}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-5 py-3.5 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Clear &amp; Reset to Default
                </button>
              </div>
            </div>

            {/* Right Column: Hero Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                Live Rendering Preview
              </label>
              
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100/80 flex flex-col items-center justify-center relative">
                {/* Simulated Container of the Hero banner */}
                <div className="w-full max-w-[280px] sm:max-w-sm aspect-square bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 relative group">
                  {homepageHeroUrl ? (
                    <img
                      src={homepageHeroUrl}
                      alt="Hero Live Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50 text-orange-600 p-8 text-center">
                      <Image size={40} className="mb-2 opacity-50" />
                      <p className="text-xs font-extrabold">Default Master Image</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">Showing our standard high-quality supplied art banner.</p>
                    </div>
                  )}

                  {/* Superimposed badge mirroring Home page precisely */}
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl flex items-center justify-between border border-white/20 shadow-lg text-left">
                    <div>
                      <p className="text-[9px] text-orange-600 font-black tracking-wider uppercase">{homepageHeroBadge}</p>
                      <p className="text-xs font-black text-gray-900 mt-0.5">{homepageHeroHeading}</p>
                    </div>
                    <div className="flex -space-x-1.5">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="w-5 h-5 rounded-full bg-orange-100 border border-white flex items-center justify-center text-[8px] font-bold text-orange-650 animate-pulse">
                          ✦
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded">
                    Real-time Frame Preview
                  </span>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed font-medium">
                    This mimics the exact responsive layout container of the homepage main stage. Use it to check alignment, crop balance, and aesthetic color consistency.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 invisible hidden">
        {/* Old Tables Removed for Tabbed View */}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleAddProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
            <div className="overflow-y-auto pr-1 flex-grow space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.name}
                  onChange={(e) => {
                    setNewProduct({ ...newProduct, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-semibold text-gray-800"
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Groceries</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Artisan / Creator
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mama Stacey of Narok Maasai Crafts"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={newProduct.artisan}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, artisan: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 10"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.stock === 0 ? "" : newProduct.stock}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Selling Price (KES)</span>
                  <span className="text-orange-600 font-extrabold text-[10px] uppercase">(Active)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1500"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.price === 0 ? "" : newProduct.price}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Buying Price / Cost (KES)</span>
                  <span className="text-orange-650 font-black text-[10px] uppercase">(Internal Only)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={newProduct.buyingPrice === 0 ? "" : newProduct.buyingPrice}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      buyingPrice: Number(e.target.value),
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Used strictly internally to evaluate profit margins.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Original Price (KES)</span>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">(Optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2000 for discount"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                  value={newProduct.originalPrice || ""}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      originalPrice: e.target.value ? Number(e.target.value) : 0,
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Enter a higher number to display a stricken price markdown badge.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Description (& Formatting Tools)
                </label>
                <RichTextEditor
                  content={newProduct.description}
                  onChange={(val) => setNewProduct({ ...newProduct, description: val })}
                  placeholder="Describe your premium item (supports bold, headings, bullets, lists, link-items, quotes...)"
                />
              </div>
              <div className="col-span-2">
                <ProductImageManager
                  images={newProduct.images}
                  onChange={(imgs) => setNewProduct({ ...newProduct, images: imgs })}
                />
              </div>
            </div>
            </div>
            <div className="flex space-x-4 mt-6 border-t border-gray-100 pt-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            <h2 className="text-2xl font-bold mb-4">Edit Product</h2>
            <div className="overflow-y-auto pr-1 flex-grow space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.name}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                    });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-semibold text-gray-800"
                  value={editingProduct.category}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value,
                    })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Groceries</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Artisan / Creator
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mama Stacey of Narok Maasai Crafts"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={editingProduct.artisan || ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      artisan: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 10"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.stock}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Selling Price (KES)</span>
                  <span className="text-orange-600 font-extrabold text-[10px] uppercase">(Active)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1500"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.price}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Buying Price / Cost (KES)</span>
                  <span className="text-orange-655 font-black text-[10px] uppercase">(Internal Only)</span>
                </label>
                <input
                  required
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm font-semibold text-gray-800"
                  value={editingProduct.buyingPrice || ""}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      buyingPrice: Number(e.target.value),
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Used strictly internally to evaluate profit margins.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                  <span>Original Price (KES)</span>
                  <span className="text-gray-400 font-bold text-[10px] uppercase">(Optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2000 for discount"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                  value={editingProduct.originalPrice || ""}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      originalPrice: e.target.value ? Number(e.target.value) : 0,
                    });
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">
                  Enter a higher number to display a stricken price markdown badge.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Description (& Formatting Tools)
                </label>
                <RichTextEditor
                  content={editingProduct.description}
                  onChange={(val) => setEditingProduct({ ...editingProduct, description: val })}
                  placeholder="Describe your premium item (supports bold, headings, bullets, lists, link-items, quotes...)"
                />
              </div>
              <div className="col-span-2">
                <ProductImageManager
                  images={editingProduct.images}
                  onChange={(imgs) => setEditingProduct({ ...editingProduct, images: imgs })}
                />
              </div>
            </div>
            </div>
            <div className="flex space-x-4 mt-6 border-t border-gray-100 pt-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Product
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Blog Post Modal */}
      {showBlogAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleAddBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-950">
              Create New Article
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  placeholder="e.g. Empowering Rural Artisans through Soplus"
                  value={newBlog.title}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.author}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.readTime}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Published Date
                </label>
                <input
                  required
                  type="date"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.publishedAt}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, publishedAt: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={newBlog.image}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.tagsString}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, tagsString: e.target.value })
                  }
                />
              </div>

              {/* SEO Sub-section */}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <span className="text-xs font-black uppercase text-orange-600 tracking-wider">SEO Fields (Optional)</span>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  placeholder="Custom browser tab title for search engines"
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.seoTitle}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, seoTitle: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Description
                </label>
                <textarea
                  placeholder="Short, highly indexable summary of this blog post (150-160 characters)"
                  rows={2}
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.seoDescription}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, seoDescription: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="mt-1">
                  <RichTextEditor
                    content={newBlog.content}
                    onChange={(val) => setNewBlog({ ...newBlog, content: val })}
                    placeholder="Write your beautiful artisan storytelling article here..."
                    id="new-blog-content"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Create Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Blog Post Modal */}
      {showBlogEditModal && editingBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleUpdateBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-950">Edit Article</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.title}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.author || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.readTime || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Published Date
                </label>
                <input
                  required
                  type="date"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={
                    editingBlog.publishedAt && typeof editingBlog.publishedAt === "string"
                      ? editingBlog.publishedAt.split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      publishedAt: `${e.target.value}T12:00:00Z`,
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={editingBlog.image || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              {/* SEO Sub-section */}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <span className="text-xs font-black uppercase text-orange-600 tracking-wider">SEO Fields (Optional)</span>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  placeholder="Custom browser tab title for search engines"
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.seoTitle || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, seoTitle: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  SEO Meta Description
                </label>
                <textarea
                  placeholder="Short, highly indexable summary of this blog post (150-160 characters)"
                  rows={2}
                  className="w-full p-4 bg-gray-55 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.seoDescription || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, seoDescription: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="mt-1">
                  <RichTextEditor
                    content={editingBlog.content}
                    onChange={(val) => setEditingBlog({ ...editingBlog, content: val })}
                    placeholder="Write your beautiful artisan storytelling article here..."
                    id="edit-blog-content"
                  />
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "careers" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8 animate-fade-in text-gray-950 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Briefcase size={22} className="text-orange-600" />
                Careers Board
              </h2>
              <p className="text-sm text-gray-500 font-medium col-span-12">
                Create SokoPlus workspace listings, accept applications, evaluate candidate qualifications, and download encrypted resumes.
              </p>
            </div>
            
            <button
              onClick={() => {
                setNewJob({
                  title: "",
                  department: "Engineering",
                  location: "Nairobi (Hybrid)",
                  type: "Full-time",
                  description: "",
                  requirementsString: ""
                });
                setShowJobAddModal(true);
              }}
              className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs transition-all tracking-wide shadow-md shadow-orange-600/10 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              + Create Job Offer
            </button>
          </div>

          <div className="flex space-x-2 border-b border-gray-100 pb-3">
            <button
              onClick={() => setSubTab("openings")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                subTab === "openings" 
                  ? "bg-orange-50 text-orange-700 border border-orange-100" 
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Active Job Postings ({jobOffers.length})
            </button>
            <button
              onClick={() => setSubTab("applicants")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                subTab === "applicants" 
                  ? "bg-orange-50 text-orange-700 border border-orange-100" 
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Candidates & Folders ({jobApplications.length})
            </button>
          </div>

          {subTab === "openings" ? (
            <div className="space-y-4">
              {jobOffers.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 space-y-3">
                  <Briefcase size={32} className="text-gray-300 mx-auto" />
                  <p className="text-sm font-black text-gray-700">No Postings Created Yet</p>
                  <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">
                    Click "Create Job Offer" to make your first job opening visible to job seekers.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-xs text-gray-400 font-black uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Role Title</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                      {jobOffers.map((j) => (
                        <tr key={j.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-black text-gray-900">{j.title}</td>
                          <td className="p-4"><span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-black tracking-wider uppercase text-gray-600">{j.department}</span></td>
                          <td className="p-4 text-xs font-semibold">{j.location}</td>
                          <td className="p-4 text-xs font-semibold">{j.type}</td>
                          <td className="p-4">
                            <button
                              onClick={async () => {
                                try {
                                  if (!j.id) return;
                                  const jobRef = doc(db, "job_offers", j.id);
                                  const nextState = j.active === false ? true : false;
                                  await updateDoc(jobRef, { active: nextState });
                                  setJobOffers(jobOffers.map(o => o.id === j.id ? { ...o, active: nextState } : o));
                                  toast.success(`Job status changed to: ${nextState ? "Active" : "Paused"}`);
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                              className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                                j.active !== false 
                                  ? "bg-green-50 text-green-750 hover:bg-green-100" 
                                  : "bg-red-50 text-red-750 hover:bg-red-100"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${j.active !== false ? "bg-green-600" : "bg-red-500"}`}></span>
                              {j.active !== false ? "Recruiting" : "Paused / Draft"}
                            </button>
                          </td>
                          <td className="p-4 text-center font-sans">
                            <button
                              onClick={async () => {
                                if (!window.confirm("Are you sure you want to delete this career opportunity?")) return;
                                try {
                                  if (!j.id) return;
                                  await deleteDoc(doc(db, "job_offers", j.id));
                                  setJobOffers(jobOffers.filter(o => o.id !== j.id));
                                  toast.success("Job posting removed successfully!");
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete Posting"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {jobApplications.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 space-y-3">
                  <Users size={32} className="text-gray-300 mx-auto" />
                  <p className="text-sm font-black text-gray-700">No Candidate Leads Yet</p>
                  <p className="text-xs text-gray-400 font-medium">
                    When visitors submit documents for active openings, their records will pop up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-xs text-gray-400 font-black uppercase tracking-wider">
                        <tr>
                          <th className="p-4">Candidate & Contacts</th>
                          <th className="p-4">Target Role</th>
                          <th className="p-4">Submission Date</th>
                          <th className="p-4">Recruitment Status</th>
                          <th className="p-4 text-center">CV / Document File</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 font-medium text-xs">
                        {jobApplications.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <p className="font-black text-gray-900 text-sm">{app.applicantName}</p>
                                <p className="text-gray-400 font-semibold">{app.applicantEmail}</p>
                                <p className="text-gray-400 font-semibold">{app.applicantPhone}</p>
                              </div>
                            </td>
                            <td className="p-4 font-black text-gray-800 text-xs">
                              {app.jobTitle}
                            </td>
                            <td className="p-4 text-gray-400 font-semibold">
                              {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Just Now"}
                            </td>
                            <td className="p-4">
                              <select
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-orange-600 transition-all cursor-pointer ${
                                  app.status === "shortlisted" 
                                    ? "bg-green-100 text-green-800" 
                                    : app.status === "rejected" 
                                      ? "bg-red-100 text-red-800" 
                                      : app.status === "reviewed"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-amber-100 text-amber-800"
                                }`}
                                value={app.status || "pending"}
                                onChange={async (e) => {
                                  try {
                                    const selectVal = e.target.value;
                                    const appRef = doc(db, "job_applications", app.id);
                                    await updateDoc(appRef, { status: selectVal });
                                    setJobApplications(jobApplications.map(p => p.id === app.id ? { ...p, status: selectVal as any } : p));
                                    toast.success(`Application updated to: ${selectVal.toUpperCase()}`);
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                              >
                                <option value="pending">PENDING</option>
                                <option value="reviewed">REVIEWED</option>
                                <option value="shortlisted">SHORTLISTED</option>
                                <option value="rejected">REJECTED</option>
                              </select>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    // Download candidate details natively
                                    const handleDownloadCV = (aDetails: JobApplication) => {
                                      try {
                                        if (!aDetails.resumeDetails) {
                                          toast.error("No CV document details found on database storage.");
                                          return;
                                        }
                                        let fileBlob: Blob;
                                        let filename = aDetails.resumeName || `${aDetails.applicantName.replace(/\s+/g, "_")}_Resume.pdf`;
                                        
                                        if (aDetails.resumeDetails.startsWith("data:")) {
                                          const parts = aDetails.resumeDetails.split(";base64,");
                                          const contentType = parts[0].split(":")[1];
                                          const raw = window.atob(parts[1]);
                                          const rawLength = raw.length;
                                          const uInt8Array = new Uint8Array(rawLength);
                                          for (let i = 0; i < rawLength; ++i) {
                                            uInt8Array[i] = raw.charCodeAt(i);
                                          }
                                          fileBlob = new Blob([uInt8Array], { type: contentType });
                                        } else {
                                          fileBlob = new Blob([aDetails.resumeDetails], { type: "text/plain" });
                                          if (!filename.endsWith(".txt")) filename += ".txt";
                                        }
                                        const url = URL.createObjectURL(fileBlob);
                                        const b = document.createElement("a");
                                        b.href = url;
                                        b.download = filename;
                                        document.body.appendChild(b);
                                        b.click();
                                        document.body.removeChild(b);
                                        URL.revokeObjectURL(url);
                                        toast.success(`CV File downloaded: ${filename}`);
                                      } catch (err: any) {
                                        toast.error(err.message);
                                      }
                                    };
                                    handleDownloadCV(app);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition-all font-black text-[10px] flex items-center gap-1.5 cursor-pointer border border-orange-100/40"
                                >
                                  <Download size={12} />
                                  Download CV
                                </button>
                                {app.coverLetter && (
                                  <button
                                    onClick={() => toast((t) => (
                                      <div className="space-y-2 text-xs text-gray-900 font-medium font-sans">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                          <b className="font-bold text-xs">Cover Letter Pitch</b>
                                          <button className="text-[10px] font-bold text-gray-400 hover:text-gray-900" onClick={() => toast.dismiss(t.id)}>Close</button>
                                        </div>
                                        <p className="leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100 max-h-48 overflow-y-auto max-w-sm whitespace-pre-line">{app.coverLetter}</p>
                                      </div>
                                    ), { duration: 15000 })}
                                    className="px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition-all font-black text-[10px] cursor-pointer"
                                  >
                                    Read Pitch
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SokoPlus Job Creation Modal block */}
      <AnimatePresence>
        {showJobAddModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-xl mx-auto my-8 overflow-hidden self-center font-sans text-gray-950">
              <div className="bg-orange-600 p-6 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-orange-100">CMS Jobs Operations</span>
                  <h3 className="text-xl font-black">Publish New Job Offer</h3>
                </div>
                <button 
                  onClick={() => setShowJobAddModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newJob.title || !newJob.description) {
                    toast.error("Please complete all required fields.");
                    return;
                  }

                  setIsSavingJob(true);
                  try {
                    const requirementsArr = newJob.requirementsString
                      .split("\n")
                      .map(r => r.trim())
                      .filter(r => r.length > 0);

                    const payload = {
                      title: newJob.title,
                      department: newJob.department,
                      location: newJob.location,
                      type: newJob.type,
                      description: newJob.description,
                      requirements: requirementsArr,
                      active: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };

                    const docRef = await addDoc(collection(db, "job_offers"), payload);
                    setJobOffers([{ id: docRef.id, ...payload } as JobOffer, ...jobOffers]);
                    toast.success(`Job Opening "${newJob.title}" has been successfully broadcast!`);
                    setShowJobAddModal(false);
                  } catch (err: any) {
                    toast.error(`Posting failed: ${err.message}`);
                  } finally {
                    setIsSavingJob(false);
                  }
                }}
                className="p-6 md:p-8 space-y-5 max-h-[75vh] overflow-y-auto"
              >
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Job Posting Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Logistics Handler"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium shadow-sm"
                    value={newJob.title}
                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Department</label>
                    <select
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                      value={newJob.department}
                      onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Community & Sourcing">Sourcing</option>
                      <option value="Operations">Operations</option>
                      <option value="Customer Experience">Experience</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Location</label>
                    <select
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                      value={newJob.location}
                      onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                    >
                      <option value="Nairobi (Hybrid)">Nairobi (Hybrid)</option>
                      <option value="Remote (Kenya)">Remote (Kenya)</option>
                      <option value="Mombasa Workshop">Mombasa Workshop</option>
                      <option value="Eldoret Site">Eldoret Site</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Engagement</label>
                    <select
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                      value={newJob.type}
                      onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Remote">Remote</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Role Overview Description</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide a compelling overview describing day-to-day work, SokoPlus impact..."
                    className="w-full p-4 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium resize-none shadow-sm"
                    value={newJob.description}
                    onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Candidate Requirements (One per line)</label>
                  <textarea
                    rows={4}
                    placeholder="Enter key requirements...&#10;e.g. 2+ years React experience&#10;Fluent in Swahili & English&#10;Excellent communication"
                    className="w-full p-4 bg-gray-55 border border-gray-100 rounded-xl text-xs font-mono outline-none focus:ring-1 focus:ring-orange-600 resize-none leading-relaxed shadow-sm"
                    value={newJob.requirementsString}
                    onChange={(e) => setNewJob({ ...newJob, requirementsString: e.target.value })}
                  />
                  <span className="text-[10px] text-gray-400 font-medium italic">Make sure to split different requirements/bullets using a hard enter key.</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowJobAddModal(false)}
                    className="px-5 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all text-xs"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingJob}
                    className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold transition-all text-xs shadow-md shadow-orange-600/10"
                  >
                    {isSavingJob ? "Broadcasting..." : "Publish Opportunity"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* View Order Details Modal */}
      {selectedViewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative text-gray-950 font-sans">
            {/* Close button */}
            <button
              onClick={() => setSelectedViewOrder(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-2xl transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider bg-orange-50 px-2.5 py-1 rounded-md">
                Order details
              </span>
              <h2 className="text-2xl font-black mt-2">Order #{selectedViewOrder.id.slice(0, 8)}</h2>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Placed on:{" "}
                {selectedViewOrder.createdAt?.toDate
                  ? selectedViewOrder.createdAt.toDate().toLocaleString("en-KE")
                  : new Date(selectedViewOrder.createdAt).toLocaleString("en-KE")}
              </p>
            </div>

            {/* Customer Details info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-55 p-6 rounded-3xl border border-gray-100/50 text-xs">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Customer info</p>
                <p className="font-extrabold text-gray-800 break-all">{selectedViewOrder.userEmail || "Guest User"}</p>
                <p className="text-[11px] text-gray-500 font-medium">ID: {selectedViewOrder.userId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Delivery Address</p>
                <p className="font-extrabold text-gray-800">
                  {selectedViewOrder.shippingAddress?.fullName || "N/A"}
                </p>
                <p className="text-xs text-gray-650 leading-relaxed">
                  {selectedViewOrder.shippingAddress?.streetAddress || selectedViewOrder.shippingAddress?.street}, {selectedViewOrder.shippingAddress?.city},{" "}
                  {selectedViewOrder.shippingAddress?.county} Kenya.
                </p>
                {selectedViewOrder.shippingAddress?.phone && (
                  <p className="text-xs text-orange-605 font-bold">
                    Phone: {selectedViewOrder.shippingAddress.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Items order details */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Items Ordered</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-3xl overflow-hidden bg-white">
                {selectedViewOrder.items && selectedViewOrder.items.map((item: any, idx: number) => {
                  const itemProd = products.find((p) => p.id === item.productId);
                  const itemBuyingPrice = itemProd && itemProd.buyingPrice !== undefined ? itemProd.buyingPrice : (item.price * 0.6);
                  const itemProfit = (item.price - itemBuyingPrice) * item.quantity;
                  return (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm hover:bg-gray-50/30 transition-colors gap-2">
                      <div className="flex items-center space-x-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-xl border border-gray-100 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div>
                          <p className="font-bold text-gray-955">{item.name}</p>
                          <p className="text-xs text-gray-450 font-medium">Qty: {item.quantity} × KES {item.price.toLocaleString()}</p>
                          <div className="mt-1 text-[11px] text-orange-655 font-bold bg-orange-50/50 rounded-lg border border-orange-100/10 px-2 py-0.5 w-fit">
                            Est. Profit: KES {itemProfit.toLocaleString()} <span className="text-gray-400 font-semibold">(Cost: KES {itemBuyingPrice.toLocaleString()}/unit)</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-black text-gray-955 text-right shrink-0">
                        KES {(item.quantity * item.price).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial summaries */}
            <div className="pt-4 border-t border-gray-100 flex flex-col space-y-3">
              {(() => {
                const orderTotalCost = selectedViewOrder.items ? selectedViewOrder.items.reduce((sum: number, item: any) => {
                  const prod = products.find((p) => p.id === item.productId);
                  const unitCost = prod && prod.buyingPrice !== undefined ? prod.buyingPrice : (item.price * 0.6);
                  return sum + (unitCost * item.quantity);
                }, 0) : 0;
                const orderItemsRevenue = selectedViewOrder.items ? selectedViewOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0;
                const orderTotalProfit = orderItemsRevenue - orderTotalCost;
                const orderProfitMargin = orderItemsRevenue > 0 ? (orderTotalProfit / orderItemsRevenue) * 100 : 0;
                return (
                  <div className="flex items-center justify-between text-sm text-gray-500 font-semibold bg-orange-50/30 border border-orange-150/20 p-4 rounded-3xl mb-1.5 shadow-sm">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-black text-orange-700 block mb-0.5">Estimated Order Profit (Internal)</span>
                      <span className="text-lg font-black text-orange-850">KES {orderTotalProfit.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest font-black text-orange-700 block mb-0.5">Profit Margin</span>
                      <span className="text-xs font-black text-white bg-orange-600 px-3 py-1 rounded-full">{orderProfitMargin.toFixed(1)}% Margin</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between text-sm text-gray-500 font-semibold items-center">
                <span>Status</span>
                <span className={`text-[10px] tracking-wider uppercase font-bold px-2.5 py-0.5 rounded-md ${
                  selectedViewOrder.status === "delivered"
                    ? "bg-green-100 text-green-700"
                    : selectedViewOrder.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}>
                  {selectedViewOrder.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 font-semibold">
                <span>Shipping Fee</span>
                <span className="text-gray-950 font-black">
                  KES {(selectedViewOrder.shippingFee || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Total Amount</p>
                  <p className="text-xl font-black text-gray-950 tracking-tight leading-tight">
                    KES {selectedViewOrder.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold tracking-tight">
                    Prices are inclusive of 16% VAT.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const dummyUser: UserProfile = {
                        uid: selectedViewOrder.userId,
                        email: selectedViewOrder.userEmail || "customer@sokoplus.com",
                        displayName: selectedViewOrder.shippingAddress?.fullName || selectedViewOrder.userEmail?.split("@")[0] || "Valued Customer",
                        phoneNumber: selectedViewOrder.shippingAddress?.phone || "",
                        isAdmin: false,
                        loyaltyPoints: 0,
                        emailVerified: true,
                      };
                      downloadReceipt(selectedViewOrder, dummyUser);
                    }}
                    className="inline-flex items-center bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold px-4 py-3 rounded-2xl text-xs transition-colors cursor-pointer border border-orange-100/50"
                  >
                    <span>Download Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedViewOrder(null)}
                    className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
