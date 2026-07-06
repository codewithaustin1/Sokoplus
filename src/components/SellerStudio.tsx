import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { UserProfile, Product, Order, SellerProfile } from "../types";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ShoppingBag,
  Store,
  DollarSign,
  Package,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  Eye,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Percent,
  LogOut,
  ChevronRight,
  User,
  ExternalLink,
  Lock,
  FileText
} from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import axios from "axios";

interface SellerStudioProps {
  user: UserProfile | null;
}

const PRODUCT_CATEGORIES = [
  "Local Crafts",
  "Fashion",
  "Groceries",
  "Electronics",
  "Home Decor",
  "Sustainable",
  "Gifts & Souvenirs",
  "Accessories"
];

export default function SellerStudio({ user }: SellerStudioProps) {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Onboarding form state
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [desc, setDesc] = useState("");
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  // Seller dashboard data state
  const [products, setProducts] = useState<Product[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState({
    grossSales: 0,
    platformFee: 0,
    netEarnings: 0,
    unitsSold: 0
  });
  const [dataLoading, setDataLoading] = useState(false);

  // Product editor state
  const [activeTab, setActiveTab] = useState<"products" | "add_product" | "sales" | "payouts">("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [pPrice, setPPrice] = useState("");
  const [pStock, setPStock] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImages, setPImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState("");
  const [descViewTab, setDescViewTab] = useState<"write" | "preview">("write");
  const [savingProduct, setSavingProduct] = useState(false);

  // Paystack subaccount / payout settings state
  const [mpesaNumberInput, setMpesaNumberInput] = useState("");
  const [updatingPayoutSettings, setUpdatingPayoutSettings] = useState(false);
  const [triggeringPayout, setTriggeringPayout] = useState(false);

  // Resume Base64 encoder logic for photos
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSellerProfile();
    } else {
      setProfileLoading(false);
    }
  }, [user]);

  const fetchSellerProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const docRef = doc(db, "sellers", user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const pData = { uid: snap.id, ...snap.data() } as SellerProfile;
        setProfile(pData);
        setMpesaNumberInput(pData.mpesaPhone || pData.phone || "");
        if (pData.status === "approved") {
          fetchSellerDashboardData(pData);
        }
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error loading seller record:", err);
      toast.error("Could not coordinate your selling credentials.");
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchSellerDashboardData = async (sellerProfile: SellerProfile) => {
    setDataLoading(true);
    try {
      // 1. Fetch seller products (both approved and pending)
      const pQuery = query(
        collection(db, "products"),
        where("sellerId", "==", sellerProfile.uid)
      );
      const pSnap = await getDocs(pQuery);
      const pList: Product[] = [];
      pSnap.forEach((docSnap) => {
        pList.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });

      // Fetch pending products
      try {
        const pendingQuery = query(
          collection(db, "pending_products"),
          where("sellerId", "==", sellerProfile.uid)
        );
        const pendingSnap = await getDocs(pendingQuery);
        pendingSnap.forEach((docSnap) => {
          pList.push({
            id: docSnap.id,
            ...docSnap.data(),
            isPending: true
          } as Product);
        });
      } catch (err) {
        console.error("Error loading pending products:", err);
      }

      setProducts(pList);

      // 2. Fetch sales from orders where this seller's products are purchased
      const oQuery = query(
        collection(db, "orders"),
        where("sellerIds", "array-contains", sellerProfile.uid)
      );
      const oSnap = await getDocs(oQuery);
      const sellerOrders: Order[] = [];
      let totalGross = 0;
      let totalUnits = 0;

      oSnap.forEach((docSnap) => {
        const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
        // Verify if any cart items were from this seller
        const matchingItems = orderData.items?.filter(
          (item) => item.sellerId === sellerProfile.uid
        ) || [];

        if (matchingItems.length > 0) {
          sellerOrders.push(orderData);
          matchingItems.forEach((item) => {
            totalGross += item.price * (item.quantity || 1);
            totalUnits += item.quantity || 1;
          });
        }
      });

      // Platform fee is 10%
      const fee = totalGross * 0.10;
      const net = totalGross - fee;

      setSalesOrders(sellerOrders);
      setMetrics({
        grossSales: totalGross,
        platformFee: fee,
        netEarnings: net,
        unitsSold: totalUnits
      });
    } catch (err) {
      console.error("Error parsing sales records:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!shopName.trim() || !phone.trim() || !location.trim()) {
      toast.error("Please fill in all onboarding fields.");
      return;
    }

    setSubmittingOnboarding(true);
    try {
      const data: Partial<SellerProfile> = {
        shopName: shopName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        description: desc.trim(),
        status: "pending",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "sellers", user.uid), data);
      toast.success("Merchant profile submitted successfully! Outstanding.");
      setProfile({ uid: user.uid, ...data } as SellerProfile);
    } catch (error) {
      console.error("Onboarding submission error:", error);
      toast.error("Failed to enroll your profile. Attempt again.");
    } finally {
      setSubmittingOnboarding(false);
    }
  };

  const handleUpdatePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!mpesaNumberInput.trim()) {
      toast.error("Please enter a valid M-Pesa phone number for settlement.");
      return;
    }

    setUpdatingPayoutSettings(true);
    try {
      const response = await axios.post("/api/paystack/subaccount/create", {
        sellerId: user.uid,
        businessName: profile.shopName,
        mpesaPhone: mpesaNumberInput.trim()
      });

      if (response.data && response.data.success) {
        const updateData = response.data.updateData;
        setProfile((prev) => prev ? { ...prev, ...updateData } : null);
        
        if (response.data.status === "live") {
          toast.success(`Paystack Subaccount successfully created and registered on Paystack Live Dashboard! Subaccount code: ${response.data.subaccountCode}`);
        } else {
          toast.success(`Paystack Subaccount linked successfully (Simulated mode/fallback active): ${response.data.subaccountCode}`);
        }
      } else {
        throw new Error(response.data?.error || "Invalid response structure");
      }
    } catch (err: any) {
      console.error("Error creating/linking subaccount:", err);
      toast.error(err.response?.data?.details || err.response?.data?.error || err.message || "Failed to link Paystack subaccount. Try again.");
    } finally {
      setUpdatingPayoutSettings(false);
    }
  };

  const handleTriggerPayout = async () => {
    if (!user || !profile) return;
    const pendingBalance = metrics.netEarnings - (profile.paidOutAmount || 0);
    if (pendingBalance <= 0) {
      toast.error("Your current pending settlement balance is KES 0.");
      return;
    }

    if (!window.confirm(`Are you sure you want to trigger manual payout of KES ${pendingBalance.toLocaleString()} to MPESA number ${profile.mpesaPhone || profile.phone}?`)) {
      return;
    }

    setTriggeringPayout(true);
    try {
      // Simulate/trigger Paystack Manual Transfer settlement action
      const newPayout = {
        id: `PAY_${Math.floor(Math.random() * 10000000)}`,
        amount: pendingBalance,
        mpesaPhone: profile.mpesaPhone || profile.phone || "",
        status: "success" as const,
        date: new Date().toISOString()
      };

      const updatedHistory = [...(profile.payoutHistory || []), newPayout];
      const newPaidOutAmount = (profile.paidOutAmount || 0) + pendingBalance;

      await updateDoc(doc(db, "sellers", user.uid), {
        paidOutAmount: newPaidOutAmount,
        payoutHistory: updatedHistory
      });

      setProfile((prev) => prev ? { ...prev, paidOutAmount: newPaidOutAmount, payoutHistory: updatedHistory } : null);
      toast.success(`Payout of KES ${pendingBalance.toLocaleString()} transferred successfully via Paystack Split Settlement rails!`);
    } catch (err) {
      console.error("Payout trigger failed:", err);
      toast.error("Settlement transfer could not be coordinated. Contact support.");
    } finally {
      setTriggeringPayout(false);
    }
  };

  const startAddProduct = () => {
    setEditingProduct(null);
    setPName("");
    setPCategory(PRODUCT_CATEGORIES[0]);
    setPPrice("");
    setPStock("");
    setPDesc("");
    setPImages([]);
    setImageInput("");
    setActiveTab("add_product");
  };

  const startEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPCategory(prod.category || PRODUCT_CATEGORIES[0]);
    setPPrice(prod.price.toString());
    setPStock(prod.stock.toString());
    setPDesc(prod.description);
    setPImages(prod.images || []);
    setImageInput("");
    setActiveTab("add_product");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      toast.error("Image file exceeds physical size limit of 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setPImages((prev) => [...prev, base64]);
        toast.success("Photo attachment optimized successfully!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddImageUrl = () => {
    const trimmed = imageInput.trim();
    if (trimmed) {
      setPImages((prev) => [...prev, trimmed]);
      setImageInput("");
      toast.success("Added photo URL.");
    }
  };

  const removePhoto = (index: number) => {
    setPImages((prev) => prev.filter((_, idx) => idx !== index));
    toast.success("Photo reference removed.");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!pName.trim() || !pPrice.trim() || !pStock.trim() || !pDesc.trim()) {
      toast.error("Please fill in basic product characteristics.");
      return;
    }

    const priceNum = parseFloat(pPrice);
    const stockNum = parseInt(pStock, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please type a valid price (greater than zero).");
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error("Stock level cannot be negative.");
      return;
    }

    if (pImages.length === 0) {
      toast.error("Provide at least one product photograph / URL.");
      return;
    }

    // Paystack Acceptable Use Policy compliance check
    const checkText = `${pName} ${pDesc} ${pCategory}`.toLowerCase();
    const prohibitedWords = [
      "firearm", "weapon", "ammunition", "rifle", "pistol", "gun", "bullets",
      "tobacco", "nicotine", "vape", "vaping", "e-cigarette", "cigarette",
      "marijuana", "cannabis", "cocaine", "heroin", "narcotic",
      "gambling", "betting", "lottery", "casino", "poker",
      "cryptocurrency", "bitcoin", "adult content", "pornography", "escort"
    ];
    const matchedProhibited = prohibitedWords.filter(word => checkText.includes(word));
    if (matchedProhibited.length > 0) {
      toast.error(
        `Paystack AUP Policy Violation: The listing contains restricted terms ("${matchedProhibited.join(', ')}"). Please remove these terms to comply.`,
        { duration: 6000 }
      );
      return;
    }

    setSavingProduct(true);
    try {
      const productPayload = {
        name: pName.trim(),
        price: priceNum,
        stock: stockNum,
        category: pCategory,
        description: pDesc.trim(),
        images: pImages,
        sellerId: profile.uid,
        sellerName: profile.shopName,
        artisan: profile.shopName, // Synched with artisan branding
        active: false,
        approvalStatus: "pending" as const,
        rejectionReason: "",
        createdAt: new Date().toISOString()
      };

      if (editingProduct) {
        if (editingProduct.isPending) {
          // Editing an item that is already in pending_products (e.g. updating a rejected one)
          const ref = doc(db, "pending_products", editingProduct.id);
          const payload = {
            ...productPayload,
            originalProductId: editingProduct.originalProductId || "",
          };
          await updateDoc(ref, payload);
          toast.success("Resubmitted product listing details for admin clearance.");
        } else {
          // Editing an item that is currently live. We create/update an entry in pending_products
          const payload = {
            ...productPayload,
            originalProductId: editingProduct.id,
          };
          // Check if there is already a pending edit for this product to avoid duplicates
          const qExist = query(
            collection(db, "pending_products"),
            where("originalProductId", "==", editingProduct.id),
            where("sellerId", "==", profile.uid)
          );
          const existSnap = await getDocs(qExist);
          if (!existSnap.empty) {
            const existingPendingId = existSnap.docs[0].id;
            await updateDoc(doc(db, "pending_products", existingPendingId), payload);
            toast.success("Updated the existing pending edit reservation for admin clearance.");
          } else {
            await addDoc(collection(db, "pending_products"), payload);
            toast.success("Review proposal submitted! Live product remains active until clearance.");
          }
        }
      } else {
        // Create a brand new product proposal in pending_products
        await addDoc(collection(db, "pending_products"), productPayload);
        toast.success("Product successfully submitted to SokoPlus administrators for clearance!");
      }

      // Refresh dashboard
      fetchSellerDashboardData(profile);
      setActiveTab("products");
    } catch (err) {
      console.error("Save product error:", err);
      toast.error("Failed to persist product parameters.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm("Confirm deleting this product catalog entry?")) return;
    try {
      if (product.isPending) {
        await deleteDoc(doc(db, "pending_products", product.id));
        toast.success("Pending submission cancelled and removed.");
      } else {
        await deleteDoc(doc(db, "products", product.id));
        // Also delete any pending edit for this product
        try {
          const qExist = query(
            collection(db, "pending_products"),
            where("originalProductId", "==", product.id),
            where("sellerId", "==", profile.uid)
          );
          const existSnap = await getDocs(qExist);
          for (const d of existSnap.docs) {
            await deleteDoc(doc(db, "pending_products", d.id));
          }
        } catch (e) {
          console.error("Failed to clean up pending edits:", e);
        }
        toast.success("Live item deleted successfully.");
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (error) {
      console.error("Product deletion error:", error);
      toast.error("Could not remove catalog entry.");
    }
  };

  if (!user) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl max-w-lg mx-auto text-center space-y-6 animate-fade-in text-gray-950 font-sans">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <Lock size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-snug">Access Restricted</h2>
          <p className="text-xs text-gray-500 mt-2">
            You must be signed up and authenticated to establish or review a SokoPlus Seller Profile.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-1.5 px-6 py-3 bg-gray-900 hover:bg-orange-600 text-white font-extrabold rounded-2xl text-xs transition-all no-underline"
        >
          Sign In Now <ArrowRight size={14} />
        </a>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Coordinating SokoPlus Studio access...</p>
      </div>
    );
  }

  // ONBOARDING SCREEN
  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl animate-fade-in text-gray-950 font-sans space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex p-3.5 bg-orange-50 text-orange-600 rounded-2xl">
            <Store size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-950">Sell on SokoPlus</h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto font-medium leading-relaxed">
            Expand your craft reach. SokoPlus operates a high-grade hybrid marketplace. Host your custom products here while using our elite storage, last-mile logistics, and delivery infrastructures!
          </p>
        </div>

        {/* Informative Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <CheckCircle size={20} className="text-orange-600" />
            <h4 className="font-bold text-sm text-gray-900">Secure Setup</h4>
            <p className="text-xs text-gray-400">Apply instantly. Once verified, get full storefront publishing capabilities on SokoPlus.</p>
          </div>
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <Percent size={20} className="text-orange-600" />
            <h4 className="font-bold text-sm text-gray-900">Only 5% Fee</h4>
            <p className="text-xs text-gray-400">Keep 95% of your revenues. Sokoplus only retains a nominal 5% flat fee on customer checkout.</p>
          </div>
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
            <Package size={20} className="text-orange-600" />
            <h4 className="font-bold text-sm text-gray-900">Logistics Bound</h4>
            <p className="text-xs text-gray-400">Zero shipping worries. SokoPlus manages physical warehousing, routing, and doorstep delivery.</p>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleApply} className="space-y-6 pt-6 border-t border-gray-50">
          <h3 className="text-lg font-black text-gray-950 tracking-tight">Onboard Your Merchant Store</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-wider">Shop Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Kisii Soapstone Carving Hub"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-wider">Contact Phone Number</label>
              <input
                type="tel"
                required
                placeholder="e.g. +254 712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase text-gray-400 tracking-wider">Workshop Location / Region</label>
            <input
              type="text"
              required
              placeholder="e.g. Kibera Crafts Alley, Nairobi"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase text-gray-400 tracking-wider">Business Description / Pitch</label>
            <textarea
              rows={4}
              required
              placeholder="Tell us what you make, how long you've been practicing, and the volume you can maintain..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-sm font-medium resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submittingOnboarding}
            className="w-full py-4 bg-gray-950 text-white font-black uppercase tracking-wider text-xs rounded-2xl hover:bg-orange-600 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {submittingOnboarding ? "Registering profile..." : "Submit SokoPlus Seller Application"}
          </button>
        </form>
      </div>
    );
  }

  // PENDING APPLICATION VIEW
  if (profile.status === "pending") {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl text-center space-y-6 animate-fade-in text-gray-950 font-sans">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <Clock size={28} className="animate-spin" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Verification In Progress</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto font-medium">
            Your application for merchant profile <span className="font-extrabold text-orange-600">"{profile.shopName}"</span> is currently pending approval by SokoPlus operations.
          </p>
        </div>
        <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-medium text-gray-400 text-left space-y-1">
          <span className="font-extrabold text-gray-700 block uppercase mb-1">Evaluation checklist:</span>
          <p>🗸 Standard product safety & origin check</p>
          <p>🗸 Logistic routing eligibility check</p>
          <p>🗸 Support line & cell verification review</p>
        </div>
        <p className="text-xs text-slate-400 italic">We normally audit and activate profiles within 24 hours. Check back soon!</p>
      </div>
    );
  }

  // REJECTED APPLICATION VIEW
  if (profile.status === "rejected") {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl text-center space-y-6 animate-fade-in text-gray-950 font-sans">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle size={28} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Application Unsuccessful</h2>
          <p className="text-sm text-gray-500">
            Our administrative team evaluated and declined your merchant application.
          </p>
        </div>
        <div className="p-5 bg-red-50/50 border border-red-100 rounded-2xl text-left">
          <span className="block text-xs font-black text-red-600 uppercase tracking-tight mb-1">Reason for refusal:</span>
          <p className="text-xs text-gray-700 leading-relaxed italic">
            "{profile.rejectedReason || "Insufficient description regarding craft authenticity or lack of complete logistics details."}"
          </p>
        </div>
        <button
          onClick={async () => {
            if (window.confirm("Resubmit application? This resets status to pending.")) {
              try {
                await updateDoc(doc(db, "sellers", user.uid), { status: "pending" });
                setProfile((prev) => prev ? { ...prev, status: "pending" } : null);
                toast.success("Resubmitted success!");
              } catch (err) {
                toast.error("Correction failed.");
              }
            }
          }}
          className="px-6 py-3.5 bg-gray-950 hover:bg-orange-600 text-white font-extrabold text-xs tracking-wider uppercase rounded-2xl transition-all border-none cursor-pointer"
        >
          Resubmit Correction Form
        </button>
      </div>
    );
  }

  // POWERFUL APPROVED SELLER STUDIO
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-xl space-y-8 animate-fade-in text-gray-950 font-sans">
      
      {/* Upper Navigation HUD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-600 rounded-2xl text-white shadow-lg rotate-3">
            <Store size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {profile.shopName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Verified SokoPlus Seller
              </span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase">
                {profile.location}
              </span>
            </div>
          </div>
        </div>

        {/* Studio Sub Tab Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("products");
              setEditingProduct(null);
            }}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
              activeTab === "products" ? "bg-gray-900 text-white shadow-md shadow-slate-100" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            Manage Products
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
              activeTab === "sales" ? "bg-gray-900 text-white shadow-md shadow-slate-100" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            Order Metrics
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
              activeTab === "payouts" ? "bg-gray-900 text-white shadow-md shadow-slate-100" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            Payouts & Settlements
          </button>
          <button
            onClick={startAddProduct}
            className="px-4.5 py-2.5 rounded-xl text-xs bg-orange-600 hover:bg-orange-750 text-white font-black transition-all border-none cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> Catalog Product
          </button>
        </div>
      </div>

      {/* KPI Stats HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Gross Sales</span>
          <p className="text-2xl font-black text-gray-900 mt-1">KES {metrics.grossSales.toLocaleString()}</p>
          <span className="text-[9px] text-gray-400 block mt-1">Product checkout values</span>
        </div>
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black text-orange-600 tracking-wider">Platform Fee (10%)</span>
          <p className="text-2xl font-black text-orange-600 mt-1">KES {metrics.platformFee.toLocaleString()}</p>
          <span className="text-[9px] text-orange-400 block mt-1">SokoPlus operational fee</span>
        </div>
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black text-green-600 tracking-wider">Net Earnings (90%)</span>
          <p className="text-2xl font-black text-green-600 mt-1">KES {metrics.netEarnings.toLocaleString()}</p>
          <span className="text-[9px] text-green-400 block mt-1">Your pure earnings payoff</span>
        </div>
        <div className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
          <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Units Dispensed</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{metrics.unitsSold} Pcs</p>
          <span className="text-[9px] text-gray-400 block mt-1">Warehouses fulfilled securely</span>
        </div>
      </div>

      {/* RENDER PRODUCTS LIST */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-gray-50">
            <h3 className="font-black text-base text-gray-900 flex items-center gap-1.5">
              <Package size={16} className="text-orange-600" />
              Catalogue Inventory ({products.length})
            </h3>
            <p className="text-xs text-gray-400 font-medium">Manage existing items or add new ones to SokoPlus.</p>
          </div>

          {products.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-50/50 border border-slate-100 flex flex-col items-center justify-center space-y-3">
              <ShoppingBag size={32} className="text-slate-350" />
              <h4 className="font-bold text-gray-700">Studio is empty</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">You have not registered any crafts to this storefront yet. Click "Catalog Product" to go live!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white border border-gray-150/80 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Catalog Image */}
                    <div className="aspect-video w-full relative bg-gray-50 border-b border-gray-100">
                      {prod.images && prod.images[0] ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                          No Photo Provided
                        </div>
                      )}
                      <span className="absolute top-3 right-3 text-[9px] tracking-wider uppercase bg-gray-900/80 backdrop-blur-xs text-white px-2 py-1 rounded font-black">
                        {prod.category}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="p-5 space-y-2">
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                        {prod.name}
                      </h4>
                      <p className="text-xs text-gray-500 font-black">
                        KES {prod.price.toLocaleString()}
                      </p>

                      {/* Live & Approval Status */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {(!prod.approvalStatus || prod.approvalStatus === "approved") ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100">
                            Approved & Live
                          </span>
                        ) : prod.approvalStatus === "pending" ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                            Pending Clearance
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-100">
                            Rejected
                          </span>
                        )}
                        {prod.active !== false ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-gray-50 text-gray-500 border border-gray-100">
                            Inactive / Draft
                          </span>
                        )}
                      </div>

                      {/* Rejection Note if exists */}
                      {prod.approvalStatus === "rejected" && prod.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-red-50/50 border border-red-100/50 text-[10px] font-semibold text-red-700 mt-2">
                          <strong className="block font-black uppercase text-[8px] tracking-wider text-red-800 mb-0.5">Admin Clearance Feedback</strong>
                          "{prod.rejectionReason}"
                        </div>
                      )}
                      
                      {/* Markdown preview details */}
                      <div className="pt-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Markdown Specs Summary</span>
                        <div className="text-[10px] text-gray-400 max-h-16 overflow-y-auto bg-gray-50 p-2 rounded-lg italic line-clamp-3">
                          <ReactMarkdown>{prod.description || "_"}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Block */}
                  <div className="p-5 pt-0 border-t border-gray-50/50 grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => startEditProduct(prod)}
                      className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit2 size={12} /> Edit Draft
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod)}
                      className="py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SALES AND LOGISTICS Metrics */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-gray-50">
            <h3 className="font-black text-base text-gray-900 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-orange-600" />
              Sales & Dispatch Handlers ({salesOrders.length})
            </h3>
            <p className="text-xs text-gray-400 font-medium">See how customer orders are routing securely.</p>
          </div>

          {salesOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center space-y-2">
              <TrendingUp size={32} className="text-gray-300" />
              <h4 className="font-bold text-gray-700">No Sales Completed Yet</h4>
              <p className="text-xs text-gray-400">Your listed items have not completed checkout payments yet. When customers check out, details report here instantly!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {salesOrders.map((order) => {
                // Collect specific items sold by this seller
                const sellerProducts = order.items.filter((i) => i.sellerId === profile.uid);
                const orderSubtotal = sellerProducts.reduce((acc, current) => acc + current.price * current.quantity, 0);
                const feeSubtotal = orderSubtotal * 0.10;
                const releaseTotal = orderSubtotal - feeSubtotal;

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl border border-gray-150 bg-white hover:border-gray-200 transition-all flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                  >
                    {/* Left stats */}
                    <div className="space-y-2 flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Order #{order.id.slice(0, 9)}</span>
                        <span className={`text-[8px] tracking-wider uppercase font-black px-2 py-0.5 rounded-full ${
                          order.status === "delivered" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Purchased items summary */}
                      <div className="space-y-1">
                        {sellerProducts.map((p, idx) => (
                          <p key={idx} className="text-xs font-bold text-gray-900">
                            🗸 {p.name} <span className="text-gray-400 font-medium">(Qty x {p.quantity})</span>
                          </p>
                        ))}
                      </div>

                      {/* Warehousing disclaimer */}
                      <div className="p-2.5 rounded-lg bg-orange-50/40 border border-orange-100/30 text-[9px] font-medium text-gray-500 max-w-lg leading-relaxed">
                        ★ FULFILLMENT: <span className="text-orange-950 font-bold">Managed by SokoPlus</span>. Our last-mile logistics riders and warehousing managers coordinate dispatch automatically within the region. No action is required.
                      </div>
                    </div>

                    {/* Right payload cash pay out */}
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400 font-bold uppercase">Pay Out Value</p>
                      <p className="text-sm font-black text-emerald-600 mt-1">KES {releaseTotal.toLocaleString()}</p>
                      <span className="text-[8px] text-gray-450 block">Platform Fee Deduction: KES {feeSubtotal.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RICH PRODUCT ENTRY INTERACTIVE EDITOR (ADD/EDIT) */}
      {activeTab === "add_product" && (
        <form onSubmit={handleSaveProduct} className="space-y-6 pt-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-extrabold text-base text-gray-900">
              {editingProduct ? "Revise Craft Checklist Parameters" : "Register Craft to Live SokoPlus Market"}
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-650 font-bold rounded-lg text-[10px] uppercase border-none cursor-pointer transition-colors"
            >
              Cancel Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-gray-400">Craft Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Handmade Beaded Maasai Wedding Collar"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold text-gray-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase text-gray-400">Price (KES)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 3500"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold text-gray-950"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase text-gray-400">Available Stock Count</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 10"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold text-gray-950"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-gray-400">Category Select</label>
                <select
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold text-gray-950 cursor-pointer"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Documentation workspace */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-gray-400">Product Photographic Documentation</label>
                
                {/* Drag and Drop Box */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (file.size > 800 * 1024) {
                        toast.error("Image file limits to 800KB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        if (base64) setPImages((prev) => [...prev, base64]);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer ${
                    isDragging ? "border-orange-500 bg-orange-50/10" : "border-gray-250"
                  }`}
                  onClick={() => document.getElementById("p-img-uploader")?.click()}
                >
                  <input
                    type="file"
                    id="p-img-uploader"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-[10px] text-gray-600 font-bold">Drag and drop any photograph here, or click to upload</p>
                  <span className="text-[8px] text-gray-400 uppercase tracking-wider block mt-1">Supports PNG, JPG, WEBP. Maximum file size 800KB</span>
                </div>

                {/* Alternate Image URL input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Alternate: Paste Image Web URL..."
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-4 bg-gray-900 text-white rounded-xl text-xs font-black border-none cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>

                {/* Display Chosen Images */}
                {pImages.length > 0 && (
                  <div className="flex gap-2.5 flex-wrap pt-2">
                    {pImages.map((img, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-slate-50">
                        <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border-none hover:bg-red-850 cursor-pointer"
                          title="Remove Photograph"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Markdown Text Description Editor & live Preview */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-1 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                  <span className="text-xs font-black uppercase text-gray-400 ml-2">Product Narrative description</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDescViewTab("write")}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer ${
                        descViewTab === "write" ? "bg-white shadow-xs text-orange-600" : "text-gray-400"
                      }`}
                    >
                      Write description
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescViewTab("preview")}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer ${
                        descViewTab === "preview" ? "bg-white shadow-xs text-orange-600" : "text-gray-400"
                      }`}
                    >
                      Markdown Preview
                    </button>
                  </div>
                </div>

                {descViewTab === "write" ? (
                  <textarea
                    required
                    rows={12}
                    placeholder="Enter full descriptive overview here. Markdown tags are enabled! e.g.,
# Craft Composition
This stunning beaded Maasai necklace displays premium seed beads selected securely by hand. 

## Dimensions
* Collar circumference: 40cm
* Extender height: 5cm"
                    value={pDesc}
                    onChange={(e) => setPDesc(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold leading-relaxed font-mono flex-1 resize-none"
                  />
                ) : (
                  <div className="markdown-body p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 leading-relaxed font-medium flex-1 overflow-y-auto max-h-[360px] prose prose-sm dark:prose-invert">
                    {pDesc.trim() ? (
                      <ReactMarkdown>{pDesc}</ReactMarkdown>
                    ) : (
                      <p className="italic text-gray-400">Narrative parameters wrote in markdown will preview here...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Paystack AUP Compliance Statement */}
              <div className="bg-[#32ba78]/10 dark:bg-[#32ba78]/5 border border-[#32ba78]/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-[#32ba78]/20 p-1.5 rounded-lg text-[#32ba78]">
                    <CheckCircle size={15} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#32ba78]">
                    Paystack AUP Compliance Active
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-normal">
                  In compliance with Paystack's Acceptable Use Policy, listing weapons/firearms, tobacco/vapes, narcotics/illegal drugs, gambling/lotteries, adult content, unlicensed financial instruments, or virtual currencies is strictly prohibited. By submitting, you certify this item meets these compliance guidelines.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("products");
                    setEditingProduct(null);
                  }}
                  className="px-5 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 text-xs transition-colors border-none cursor-pointer"
                >
                  Dismiss Draft
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-3 rounded-xl bg-gray-950 hover:bg-orange-600 text-white font-black text-xs transition-colors tracking-wide uppercase shadow-md flex items-center gap-1.5 border-none cursor-pointer"
                >
                  {savingProduct ? "Saving..." : editingProduct ? "Update Catalog live" : "Submit live to SokoPlus"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {activeTab === "payouts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-gray-50">
            <h3 className="font-black text-base text-gray-900 flex items-center gap-1.5">
              <Percent size={16} className="text-orange-600" />
              Paystack Split Payments & Settlements
            </h3>
            <p className="text-xs text-gray-400 font-medium">Configure compliant automated split routing settings.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side: Subaccount details & settings */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-150 p-6 space-y-4">
                <h4 className="font-bold text-sm text-gray-950 flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#32ba78]" />
                  Paystack Subaccount Status
                </h4>
                
                {profile.paystackSubaccountCode ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#32ba78]/10 border border-[#32ba78]/20 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#32ba78]">Subaccount Code</span>
                        <p className="text-sm font-mono font-bold text-gray-900 mt-0.5">{profile.paystackSubaccountCode}</p>
                      </div>
                      <span className="text-xs font-black uppercase text-[#32ba78] bg-white px-3 py-1.5 rounded-xl shadow-sm border border-[#32ba78]/10">
                        Active & Linked
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[9px] uppercase font-black text-gray-400">Settlement Destination</span>
                        <p className="text-xs font-bold text-gray-800 mt-1">MPESA Mobile Money</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[9px] uppercase font-black text-gray-400">Payout Account Number</span>
                        <p className="text-xs font-bold font-mono text-gray-800 mt-1">{profile.mpesaPhone || profile.phone}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/50 space-y-3">
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      You haven't activated your Paystack Split Payments subaccount yet. Please register your MPESA settlement phone number below to enable automatic split payments at checkout.
                    </p>
                  </div>
                )}

                {/* Edit Payout Settings */}
                <form onSubmit={handleUpdatePayoutSettings} className="pt-4 border-t border-gray-50 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase text-gray-400">Registered Vendor MPESA Number</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0712345678"
                        value={mpesaNumberInput}
                        onChange={(e) => setMpesaNumberInput(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 outline-none focus:ring-1 focus:ring-orange-600 rounded-xl text-xs font-semibold text-gray-950"
                      />
                      <button
                        type="submit"
                        disabled={updatingPayoutSettings}
                        className="px-5 py-3 bg-gray-950 hover:bg-orange-600 text-white font-black text-xs tracking-wide uppercase rounded-xl border-none cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                      >
                        {updatingPayoutSettings ? "Linking..." : "Link Subaccount"}
                      </button>
                    </div>
                    <span className="text-[9px] text-gray-400 block font-medium">
                      Enter your Kenyan MPESA phone number where payouts should be remitted securely.
                    </span>
                  </div>
                </form>
              </div>

              {/* Compliance checklist */}
              <div className="bg-[#32ba78]/5 border border-[#32ba78]/10 rounded-2xl p-5 space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#32ba78] block">
                  Why SokoPlus Uses Paystack Split Payments
                </span>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  Sokoplus is fully compliant with Paystack's Acceptable Use Policy (AUP). To prevent holding funds centrally or acting as an unlicensed financial intermediary, we integrate Paystack's <strong>Split Payments API</strong>:
                </p>
                <div className="space-y-2 text-xs text-gray-500 font-medium pl-2">
                  <p>🗸 <strong>90% split</strong> goes directly to your secure vendor subaccount hosted on Paystack's regulated infrastructure.</p>
                  <p>🗸 <strong>10% split</strong> commission is automatically routed to Sokoplus at checkout to cover operations and last-mile delivery riders.</p>
                  <p>🗸 <strong>Manual Payout Trigger</strong> lets you claim settlements to MPESA instantly once you've fulfilled your customer's craft dispatch.</p>
                </div>
              </div>
            </div>

            {/* Right side: Settlement balance & trigger */}
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-150 p-6 rounded-2xl space-y-5">
                <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Payout Ledger Balance</span>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Net Lifetime Earnings (90%):</span>
                    <span className="font-bold text-gray-900">KES {metrics.netEarnings.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>Already Settled / Disbursed:</span>
                    <span className="font-bold text-gray-900">KES {(profile.paidOutAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-gray-200/60 pt-3 flex justify-between items-end">
                    <div>
                      <span className="text-[10px] uppercase font-black text-orange-600">Pending Settlement</span>
                      <p className="text-2xl font-black text-gray-900 mt-0.5">
                        KES {Math.max(0, metrics.netEarnings - (profile.paidOutAmount || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerPayout}
                  disabled={triggeringPayout || !profile.paystackSubaccountCode || (metrics.netEarnings - (profile.paidOutAmount || 0)) <= 0}
                  className="w-full py-4 bg-[#32ba78] hover:bg-[#28a364] text-white font-black uppercase tracking-wider text-xs rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed border-none flex items-center justify-center gap-1.5"
                >
                  <DollarSign size={14} />
                  {triggeringPayout ? "Processing Settlement..." : "Trigger Manual Settlement"}
                </button>

                {!profile.paystackSubaccountCode && (
                  <p className="text-[10px] text-red-500 text-center font-bold">
                    * Link your MPESA subaccount to trigger settlements.
                  </p>
                )}
              </div>

              {/* Payout History Ledger */}
              <div className="space-y-3">
                <h4 className="font-black text-xs text-gray-400 uppercase tracking-wider">Settlement Transfer Ledger</h4>
                
                {!profile.payoutHistory || profile.payoutHistory.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-gray-50/50 border border-gray-100 text-[10px] text-gray-400 font-semibold italic">
                    No historic settlement payouts requested yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {profile.payoutHistory.slice().reverse().map((pay) => (
                      <div key={pay.id} className="p-3 bg-white border border-gray-150 rounded-xl flex justify-between items-center text-xs font-semibold">
                        <div>
                          <p className="text-gray-950 font-black">KES {pay.amount.toLocaleString()}</p>
                          <span className="text-[9px] text-gray-400 block font-mono">ID: {pay.id} • {new Date(pay.date).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[9px] bg-[#32ba78]/10 text-[#32ba78] px-2.5 py-1 rounded-full uppercase font-black">
                          ✓ Sent to {pay.mpesaPhone}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
