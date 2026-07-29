import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  UserCheck,
  FileText,
  RefreshCw,
  Zap,
  UserX,
  Plus,
  Lock,
  Database,
  Info,
  ChevronRight,
  Terminal,
  Building2,
  Check,
  X
} from "lucide-react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  where,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { DataErasureRequest } from "../types";
import { toast } from "react-hot-toast";

interface AuditScanResult {
  userId: string;
  userEmail: string;
  usersFound: number;
  ordersFound: number;
  ticketsFound: number;
  reviewsFound: number;
  commentsFound: number;
  notificationsFound: number;
  cartsFound: number;
  priceAlertsFound: number;
  jobAppsFound: number;
  scannedAt: string;
}

export const AdminDataErasureManager: React.FC = () => {
  const [requests, setRequests] = useState<DataErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "completed" | "rejected">("all");

  // Audit modal state
  const [selectedRequest, setSelectedRequest] = useState<DataErasureRequest | null>(null);
  const [auditResult, setAuditResult] = useState<AuditScanResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [executionProgress, setExecutionProgress] = useState(0);

  // Manual Trigger Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualUid, setManualUid] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualType, setManualType] = useState<"full_deletion" | "anonymize_for_audit">("anonymize_for_audit");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Rejection Modal
  const [rejectingRequest, setRejectingRequest] = useState<DataErasureRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // Listen to data_erasure_requests collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "data_erasure_requests"), orderBy("requestDate", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: DataErasureRequest[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            userId: data.userId || "",
            userEmail: data.userEmail || "",
            displayName: data.displayName || "",
            requestDate: data.requestDate,
            statutoryDeadline: data.statutoryDeadline,
            status: data.status || "pending",
            erasureType: data.erasureType || "anonymize_for_audit",
            reason: data.reason || "",
            processedAt: data.processedAt,
            processedBy: data.processedBy,
            rejectionReason: data.rejectionReason,
            auditMetrics: data.auditMetrics
          });
        });
        setRequests(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to data_erasure_requests:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.displayName && r.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  // Check urgent requests (< 7 days left)
  const urgentCount = requests.filter((r) => {
    if (r.status !== "pending") return false;
    const deadline = r.statutoryDeadline ? new Date(r.statutoryDeadline.toDate ? r.statutoryDeadline.toDate() : r.statutoryDeadline).getTime() : Date.now() + 30 * 86400000;
    const daysLeft = Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7;
  }).length;

  // Run Audit Scan for a user across all Firestore collections
  const runAuditScan = async (req: DataErasureRequest) => {
    setSelectedRequest(req);
    setIsAuditing(true);
    setAuditResult(null);

    try {
      const targetUid = req.userId;
      const targetEmail = req.userEmail.toLowerCase();

      // 1. Users
      let usersFound = 0;
      if (targetUid) {
        const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", targetEmail)));
        usersFound = uSnap.size > 0 ? uSnap.size : 1;
      }

      // 2. Orders
      let ordersFound = 0;
      if (targetUid) {
        const oSnap = await getDocs(query(collection(db, "orders"), where("userId", "==", targetUid)));
        ordersFound = oSnap.size;
      } else if (targetEmail) {
        const oSnap = await getDocs(query(collection(db, "orders"), where("userEmail", "==", targetEmail)));
        ordersFound = oSnap.size;
      }

      // 3. Support Tickets
      let ticketsFound = 0;
      if (targetEmail) {
        const tSnap = await getDocs(query(collection(db, "support_tickets"), where("email", "==", targetEmail)));
        ticketsFound = tSnap.size;
      }

      // 4. Reviews
      let reviewsFound = 0;
      if (targetUid) {
        const rSnap = await getDocs(query(collection(db, "reviews"), where("userId", "==", targetUid)));
        reviewsFound = rSnap.size;
      }

      // 5. Comments
      let commentsFound = 0;
      if (targetUid) {
        const cSnap = await getDocs(query(collection(db, "comments"), where("userId", "==", targetUid)));
        commentsFound = cSnap.size;
      }

      // 6. User Notifications
      let notificationsFound = 0;
      if (targetUid) {
        const nSnap = await getDocs(collection(db, "users", targetUid, "notifications"));
        notificationsFound = nSnap.size;
      }

      // 7. Carts
      let cartsFound = 0;
      if (targetUid) {
        const cartSnap = await getDocs(query(collection(db, "carts"), where("userId", "==", targetUid)));
        cartsFound = cartSnap.size;
      }

      // 8. Price Drop Alerts
      let priceAlertsFound = 0;
      if (targetEmail) {
        const paSnap = await getDocs(query(collection(db, "price_drop_alerts"), where("email", "==", targetEmail)));
        priceAlertsFound = paSnap.size;
      }

      // 9. Job Applications
      let jobAppsFound = 0;
      if (targetUid) {
        const jaSnap = await getDocs(query(collection(db, "job_applications"), where("userId", "==", targetUid)));
        jobAppsFound = jaSnap.size;
      }

      setAuditResult({
        userId: targetUid,
        userEmail: targetEmail,
        usersFound,
        ordersFound,
        ticketsFound,
        reviewsFound,
        commentsFound,
        notificationsFound,
        cartsFound,
        priceAlertsFound,
        jobAppsFound,
        scannedAt: new Date().toLocaleTimeString()
      });
    } catch (err) {
      console.error("Audit scan failed:", err);
      toast.error("Audit scan failed to complete.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Execute Cascading Deletion / Anonymization
  const executeCascadingErasure = async (req: DataErasureRequest, typeOverride?: "full_deletion" | "anonymize_for_audit") => {
    const erasureType = typeOverride || req.erasureType || "anonymize_for_audit";
    const targetUid = req.userId;
    const targetEmail = req.userEmail.toLowerCase();
    const adminEmail = auth.currentUser?.email || "Admin System";

    const confirmMsg =
      erasureType === "full_deletion"
        ? `PERMANENT DELETION WARNING: Are you sure you want to hard-delete all documents for ${req.userEmail}? This action is irreversible.`
        : `ANONYMIZATION WARNING: Are you sure you want to scrub PII and anonymize records for ${req.userEmail}? Transactional records will be preserved for financial compliance.`;

    if (!window.confirm(confirmMsg)) return;

    setIsExecuting(true);
    setExecutionLogs([]);
    setExecutionProgress(5);

    const log = (msg: string) => {
      setExecutionLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    log(`Starting cascading ${erasureType} for User: ${req.userEmail} (UID: ${targetUid || "N/A"})`);

    let usersScrubbed = 0;
    let ordersAnonymized = 0;
    let ticketsScrubbed = 0;
    let reviewsScrubbed = 0;
    let notificationsDeleted = 0;
    let commentsScrubbed = 0;
    let jobAppsScrubbed = 0;

    try {
      // Step 1: Update Erasure Request Status to "processing"
      await updateDoc(doc(db, "data_erasure_requests", req.id), {
        status: "processing"
      });
      log("Request status updated to 'processing'.");
      setExecutionProgress(15);

      // Step 2: Scrub / Anonymize User Profile in `users`
      if (targetUid) {
        log("Searching for User Profile document...");
        const userRef = doc(db, "users", targetUid);
        if (erasureType === "full_deletion") {
          await deleteDoc(userRef);
          log("User Profile document DELETED.");
        } else {
          await updateDoc(userRef, {
            displayName: "Anonymized Consumer",
            email: `deleted_${targetUid.slice(0, 8)}@anonymized.local`,
            phoneNumber: null,
            photoURL: null,
            deliveryAddress: null,
            deliveryCity: null,
            deliveryCounty: null,
            deliveryCountry: null,
            twoFactorSecret: null,
            twoFactorEnabled: false,
            loyaltyPoints: 0,
            vouchers: [],
            wishlist: [],
            erasedAt: serverTimestamp(),
            isAnonymized: true
          });
          log("User Profile PII scrubbed and anonymized.");
        }
        usersScrubbed++;
      }
      setExecutionProgress(35);

      // Step 3: Scrub / Anonymize Orders in `orders`
      log("Processing associated Order records...");
      let oSnap;
      if (targetUid) {
        oSnap = await getDocs(query(collection(db, "orders"), where("userId", "==", targetUid)));
      } else {
        oSnap = await getDocs(query(collection(db, "orders"), where("userEmail", "==", targetEmail)));
      }

      for (const orderDoc of oSnap.docs) {
        if (erasureType === "full_deletion") {
          await deleteDoc(doc(db, "orders", orderDoc.id));
        } else {
          await updateDoc(doc(db, "orders", orderDoc.id), {
            userEmail: `anonymized_${orderDoc.id.slice(0, 6)}@deleted.local`,
            shippingAddress: {
              county: orderDoc.data().shippingAddress?.county || "County",
              city: "Anonymized City",
              street: "Scrubbed for Privacy",
              name: "Anonymized Customer",
              phone: "+254000000000"
            },
            customerNotes: [],
            isAnonymizedForAudit: true,
            anonymizedAt: serverTimestamp()
          });
        }
        ordersAnonymized++;
      }
      log(`Processed ${ordersAnonymized} Order records (${erasureType}).`);
      setExecutionProgress(55);

      // Step 4: Support Tickets
      log("Processing Support Tickets...");
      const tSnap = await getDocs(query(collection(db, "support_tickets"), where("email", "==", targetEmail)));
      for (const tDoc of tSnap.docs) {
        if (erasureType === "full_deletion") {
          await deleteDoc(doc(db, "support_tickets", tDoc.id));
        } else {
          await updateDoc(doc(db, "support_tickets", tDoc.id), {
            email: "deleted@anonymized.local",
            message: "[Content Scrubbed under Statutory Data Erasure Request]",
            replies: []
          });
        }
        ticketsScrubbed++;
      }
      log(`Processed ${ticketsScrubbed} Support Ticket records.`);
      setExecutionProgress(70);

      // Step 5: Reviews & Comments
      log("Scrubbing product reviews & blog comments...");
      if (targetUid) {
        const rSnap = await getDocs(query(collection(db, "reviews"), where("userId", "==", targetUid)));
        for (const rDoc of rSnap.docs) {
          if (erasureType === "full_deletion") {
            await deleteDoc(doc(db, "reviews", rDoc.id));
          } else {
            await updateDoc(doc(db, "reviews", rDoc.id), {
              userName: "Anonymous Consumer",
              comment: "[Review content anonymized by user request]"
            });
          }
          reviewsScrubbed++;
        }

        const cSnap = await getDocs(query(collection(db, "comments"), where("userId", "==", targetUid)));
        for (const cDoc of cSnap.docs) {
          if (erasureType === "full_deletion") {
            await deleteDoc(doc(db, "comments", cDoc.id));
          } else {
            await updateDoc(doc(db, "comments", cDoc.id), {
              userName: "Anonymous Consumer",
              content: "[Comment scrubbed under statutory erasure]"
            });
          }
          commentsScrubbed++;
        }
      }
      log(`Scrubbed ${reviewsScrubbed} reviews and ${commentsScrubbed} comments.`);
      setExecutionProgress(85);

      // Step 6: Delete Notifications, Carts, Price Alerts, Job Applications
      log("Purging transient notifications, carts, price alerts & job applications...");
      if (targetUid) {
        const nSnap = await getDocs(collection(db, "users", targetUid, "notifications"));
        for (const nDoc of nSnap.docs) {
          await deleteDoc(doc(db, "users", targetUid, "notifications", nDoc.id));
          notificationsDeleted++;
        }

        const cartSnap = await getDocs(query(collection(db, "carts"), where("userId", "==", targetUid)));
        for (const cDoc of cartSnap.docs) {
          await deleteDoc(doc(db, "carts", cDoc.id));
        }

        const jaSnap = await getDocs(query(collection(db, "job_applications"), where("userId", "==", targetUid)));
        for (const jDoc of jaSnap.docs) {
          await deleteDoc(doc(db, "job_applications", jDoc.id));
          jobAppsScrubbed++;
        }
      }

      if (targetEmail) {
        const paSnap = await getDocs(query(collection(db, "price_drop_alerts"), where("email", "==", targetEmail)));
        for (const paDoc of paSnap.docs) {
          await deleteDoc(doc(db, "price_drop_alerts", paDoc.id));
        }
      }
      log(`Deleted ${notificationsDeleted} user notifications and ${jobAppsScrubbed} job applications.`);
      setExecutionProgress(95);

      // Step 7: Finalize Request & Audit Log Entry
      const metrics = {
        usersScrubbed,
        ordersAnonymized,
        ticketsScrubbed,
        reviewsScrubbed,
        notificationsDeleted,
        commentsScrubbed,
        jobAppsScrubbed
      };

      await updateDoc(doc(db, "data_erasure_requests", req.id), {
        status: "completed",
        processedAt: serverTimestamp(),
        processedBy: adminEmail,
        auditMetrics: metrics
      });

      // Write to audit_logs
      await addDoc(collection(db, "audit_logs"), {
        userId: auth.currentUser?.uid || "admin",
        userEmail: adminEmail,
        action: "data_erasure_completed",
        details: `Completed ${erasureType} for ${req.userEmail}. Metrics: ${JSON.stringify(metrics)}`,
        targetId: req.id,
        targetName: req.userEmail,
        timestamp: serverTimestamp()
      });

      log("SUCCESS: Data erasure request finalized and statutory compliance audit log recorded!");
      setExecutionProgress(100);
      toast.success(`Data erasure completed for ${req.userEmail}!`);
    } catch (err: any) {
      console.error("Cascading erasure failed:", err);
      log(`ERROR: ${err.message || String(err)}`);
      toast.error("Cascading erasure encountered errors. Check logs.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Submit Manual Erasure Request by Admin
  const handleCreateManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) {
      toast.error("Please enter a valid target user email.");
      return;
    }
    setManualSubmitting(true);
    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 Days statutory deadline

      await addDoc(collection(db, "data_erasure_requests"), {
        userId: manualUid.trim() || "",
        userEmail: manualEmail.trim().toLowerCase(),
        displayName: "Queued by Admin",
        requestDate: serverTimestamp(),
        statutoryDeadline: deadline.toISOString(),
        status: "pending",
        erasureType: manualType,
        reason: manualReason.trim() || "Administrative queue trigger per legal customer request."
      });

      toast.success("Data erasure request queued successfully!");
      setShowManualModal(false);
      setManualEmail("");
      setManualUid("");
      setManualReason("");
    } catch (err) {
      console.error("Failed to queue manual request:", err);
      toast.error("Failed to queue request.");
    } finally {
      setManualSubmitting(false);
    }
  };

  // Reject Request
  const handleRejectRequest = async () => {
    if (!rejectingRequest) return;
    if (!rejectionReasonInput.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }
    try {
      await updateDoc(doc(db, "data_erasure_requests", rejectingRequest.id), {
        status: "rejected",
        processedAt: serverTimestamp(),
        processedBy: auth.currentUser?.email || "Admin",
        rejectionReason: rejectionReasonInput.trim()
      });

      // Log audit
      await addDoc(collection(db, "audit_logs"), {
        userId: auth.currentUser?.uid || "admin",
        userEmail: auth.currentUser?.email || "admin",
        action: "data_erasure_rejected",
        details: `Rejected erasure request for ${rejectingRequest.userEmail}. Reason: ${rejectionReasonInput.trim()}`,
        targetId: rejectingRequest.id,
        targetName: rejectingRequest.userEmail,
        timestamp: serverTimestamp()
      });

      toast.success("Request rejected.");
      setRejectingRequest(null);
      setRejectionReasonInput("");
    } catch (err) {
      console.error("Error rejecting request:", err);
      toast.error("Failed to reject request.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-950 p-6 sm:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-gray-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 border border-red-500/30">
                <ShieldAlert size={14} />
                GDPR & KPDPA Compliance Utility
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/30">
                Automated Cascading Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Customer Data Erasure & Privacy Queue
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl leading-relaxed font-medium">
              Fulfill customer "Right to Be Forgotten" requests within the 30-day statutory window. Scans and performs cascading anonymization or hard deletion across all Firestore collections while preserving financial audit integrity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              Queue New Request
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
          <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Pending Queue</span>
            <span className="text-2xl font-black text-amber-400">{pendingCount}</span>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Statutory Alert (&lt; 7d)</span>
            <span className={`text-2xl font-black ${urgentCount > 0 ? "text-red-400 animate-pulse" : "text-gray-300"}`}>
              {urgentCount}
            </span>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Completed Erasures</span>
            <span className="text-2xl font-black text-emerald-400">{completedCount}</span>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Rejected Requests</span>
            <span className="text-2xl font-black text-gray-400">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search request by email or UID..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-red-500 outline-none text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {(["all", "pending", "processing", "completed", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950 shadow"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* REQUESTS LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-gray-100 dark:border-gray-800 text-center text-gray-400 space-y-3">
            <RefreshCw size={28} className="animate-spin mx-auto text-red-500" />
            <p className="font-bold text-sm">Loading Data Erasure Queue from Firestore...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl border border-gray-100 dark:border-gray-800 text-center text-gray-400 space-y-3">
            <UserCheck size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
            <p className="font-black text-base text-gray-700 dark:text-gray-300">No matching erasure requests found</p>
            <p className="text-xs">All customer privacy requests are up to date and statutory deadlines are met.</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            // Calculate Days Left
            const deadlineDate = req.statutoryDeadline
              ? new Date(req.statutoryDeadline.toDate ? req.statutoryDeadline.toDate() : req.statutoryDeadline)
              : new Date(Date.now() + 30 * 86400000);
            const daysRemaining = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isUrgent = req.status === "pending" && daysRemaining <= 7;

            return (
              <div
                key={req.id}
                className={`bg-white dark:bg-gray-900 p-6 rounded-3xl border transition-all space-y-5 shadow-sm hover:shadow-md ${
                  isUrgent
                    ? "border-red-300 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10"
                    : req.status === "pending"
                    ? "border-amber-200 dark:border-amber-900/30"
                    : "border-gray-150 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-2xl shrink-0 ${
                        req.status === "completed"
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600"
                          : req.status === "rejected"
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-500"
                          : isUrgent
                          ? "bg-red-100 dark:bg-red-950/50 text-red-600 animate-pulse"
                          : "bg-amber-100 dark:bg-amber-950/50 text-amber-600"
                      }`}
                    >
                      <UserX size={22} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-gray-950 dark:text-white">
                          {req.userEmail}
                        </h3>
                        {req.displayName && (
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            ({req.displayName})
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            req.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : req.status === "rejected"
                              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              : req.status === "processing"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          }`}
                        >
                          {req.status}
                        </span>

                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md">
                          {req.erasureType === "full_deletion" ? "Full Hard Delete" : "Anonymize for Tax Retention"}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 font-medium flex items-center gap-3">
                        <span>UID: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">{req.userId || "Not logged in"}</code></span>
                        <span>•</span>
                        <span>Requested: {req.requestDate?.toDate ? new Date(req.requestDate.toDate()).toLocaleDateString() : "Recently"}</span>
                      </p>
                    </div>
                  </div>

                  {/* STATUTORY DEADLINE TIMER */}
                  {req.status === "pending" && (
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-950 px-4 py-3 rounded-2xl border border-gray-150 dark:border-gray-800">
                      <Clock size={16} className={isUrgent ? "text-red-500" : "text-amber-500"} />
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block leading-none">
                          Statutory Deadline (30d Window)
                        </span>
                        <span className={`text-xs font-black ${isUrgent ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                          {daysRemaining > 0 ? `${daysRemaining} Days Remaining` : "Deadline EXCEEDED (Action Required)"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* REASON / AUDIT METRICS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1">
                    <span className="font-extrabold text-gray-400 uppercase tracking-wider text-[10px] block">Customer Reason / Notes</span>
                    <p className="text-gray-700 dark:text-gray-300 font-semibold italic">
                      "{req.reason || "No explicit customer reason provided."}"
                    </p>
                  </div>

                  {req.status === "completed" && req.auditMetrics && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-1">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px] block flex items-center gap-1">
                        <CheckCircle2 size={12} /> Fulfilling Audit Trail
                      </span>
                      <div className="flex flex-wrap gap-2 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                        <span>Users Scrubbed: {req.auditMetrics.usersScrubbed}</span> • 
                        <span>Orders Anonymized: {req.auditMetrics.ordersAnonymized}</span> • 
                        <span>Tickets: {req.auditMetrics.ticketsScrubbed}</span> • 
                        <span>Reviews: {req.auditMetrics.reviewsScrubbed}</span>
                      </div>
                    </div>
                  )}

                  {req.status === "rejected" && (
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl space-y-1">
                      <span className="font-extrabold text-gray-500 uppercase tracking-wider text-[10px] block">Rejection Note</span>
                      <p className="text-gray-600 dark:text-gray-400 font-semibold">
                        {req.rejectionReason || "Request declined by administrator."}
                      </p>
                    </div>
                  )}
                </div>

                {/* ACTION BUTTONS */}
                {req.status === "pending" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => runAuditScan(req)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Eye size={14} />
                      Audit & Dry-Run Scan Data
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingRequest(req)}
                        className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        Reject Request
                      </button>

                      <button
                        type="button"
                        onClick={() => executeCascadingErasure(req, "anonymize_for_audit")}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Zap size={14} />
                        Approve & Trigger Cascading Anonymization
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* AUDIT SCAN & DRY-RUN MODAL */}
      {selectedRequest && auditResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-gray-100 dark:border-gray-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-950 dark:text-white">
                    Audit & Dry-Run Inspector
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold">
                    Target: {auditResult.userEmail} (Scanned at {auditResult.scannedAt})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setAuditResult(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                The dry-run scan queried Firestore collections for records belonging to this customer. Below is the exact inventory of data that will be modified or purged during cascading execution:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">User Profile (`users`)</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.usersFound} doc</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Orders (`orders`)</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.ordersFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Support Tickets</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.ticketsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Reviews & Ratings</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.reviewsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Blog Comments</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.commentsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Notifications</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.notificationsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Synced Carts</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.cartsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Price Drop Alerts</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.priceAlertsFound} docs</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-950 p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Job Applications</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{auditResult.jobAppsFound} docs</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setAuditResult(null);
                }}
                className="w-full sm:w-auto px-5 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl"
              >
                Close Audit Window
              </button>

              <button
                onClick={() => {
                  const req = selectedRequest;
                  setSelectedRequest(null);
                  setAuditResult(null);
                  executeCascadingErasure(req, "anonymize_for_audit");
                }}
                className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={15} />
                Execute Cascading Anonymization Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE EXECUTION TERMINAL MODAL */}
      {isExecuting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-950 text-gray-100 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-gray-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal size={22} className="text-red-500 animate-pulse" />
                <div>
                  <h3 className="text-base font-black text-white">Cascading Script Execution Progress</h3>
                  <p className="text-xs text-gray-400">Scrubbing PII across Firestore collections</p>
                </div>
              </div>
              <span className="text-xs font-black text-red-400 font-mono">{executionProgress}%</span>
            </div>

            {/* PROGRESS BAR */}
            <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 h-full transition-all duration-300"
                style={{ width: `${executionProgress}%` }}
              ></div>
            </div>

            {/* LOG TERMINAL */}
            <div className="bg-black/90 p-4 rounded-2xl border border-gray-800 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1.5 no-scrollbar">
              {executionLogs.map((logStr, i) => (
                <p key={i} className="leading-relaxed">
                  {logStr}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL QUEUE MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleCreateManualRequest} className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-gray-100 dark:border-gray-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-black text-gray-950 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-red-500" />
                Queue Erasure Request (Admin)
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Target Customer Email *
                </label>
                <input
                  type="email"
                  required
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Target Customer UID (Optional)
                </label>
                <input
                  type="text"
                  value={manualUid}
                  onChange={(e) => setManualUid(e.target.value)}
                  placeholder="e.g., usr_98127391823"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Erasure Execution Method
                </label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as any)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-gray-900 dark:text-white"
                >
                  <option value="anonymize_for_audit">Anonymize PII (Preserve Financial Audit Records)</option>
                  <option value="full_deletion">Full Hard Delete (Purge All Documents)</option>
                </select>
              </div>

              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Reason / Source Reference
                </label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="e.g. Received formal written data erasure request via privacy@sokoplus.co.ke"
                  rows={3}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={manualSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                {manualSubmitting ? "Queueing..." : "Queue Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-gray-100 dark:border-gray-800 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-gray-950 dark:text-white">
              Reject Erasure Request for {rejectingRequest.userEmail}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              Specify the legal or operational ground for declining this request (e.g. identity verification failure or fraudulent claim).
            </p>
            <textarea
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-xs text-gray-900 dark:text-white"
            ></textarea>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingRequest(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRequest}
                className="px-5 py-2 bg-gray-950 dark:bg-white text-white dark:text-gray-950 font-black text-xs rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
