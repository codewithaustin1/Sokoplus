import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  X,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { DataErasureRequest, UserProfile } from "../types";
import { toast } from "react-hot-toast";

interface UserDataErasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

export const UserDataErasureModal: React.FC<UserDataErasureModalProps> = ({
  isOpen,
  onClose,
  userProfile
}) => {
  const [existingRequest, setExistingRequest] = useState<DataErasureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [erasureType, setErasureType] = useState<"anonymize_for_audit" | "full_deletion">("anonymize_for_audit");
  const [reason, setReason] = useState("");
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    setLoading(true);

    const q = query(
      collection(db, "data_erasure_requests"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          setExistingRequest({
            id: docSnap.id,
            userId: data.userId,
            userEmail: data.userEmail,
            displayName: data.displayName,
            requestDate: data.requestDate,
            statutoryDeadline: data.statutoryDeadline,
            status: data.status,
            erasureType: data.erasureType,
            reason: data.reason,
            processedAt: data.processedAt,
            rejectionReason: data.rejectionReason,
            auditMetrics: data.auditMetrics
          });
        } else {
          setExistingRequest(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching user data erasure request:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error("Please sign in to submit a privacy request.");
      return;
    }
    if (!confirmCheckbox) {
      toast.error("Please acknowledge the statutory data erasure notice.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days statutory window

      await addDoc(collection(db, "data_erasure_requests"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || "",
        displayName: userProfile?.displayName || auth.currentUser.displayName || "Customer",
        requestDate: serverTimestamp(),
        statutoryDeadline: deadline.toISOString(),
        status: "pending",
        erasureType,
        reason: reason.trim() || "Customer statutory data erasure request."
      });

      toast.success("Your Data Erasure Request has been submitted and queued for fulfillment!");
      setReason("");
      setConfirmCheckbox(false);
    } catch (err) {
      console.error("Failed to submit erasure request:", err);
      toast.error("Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!existingRequest) return;
    if (!window.confirm("Are you sure you want to cancel your data erasure request?")) return;

    try {
      await deleteDoc(doc(db, "data_erasure_requests", existingRequest.id));
      toast.success("Data erasure request cancelled.");
      setExistingRequest(null);
    } catch (err) {
      console.error("Failed to cancel erasure request:", err);
      toast.error("Failed to cancel request.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-gray-150 dark:border-gray-800 shadow-2xl space-y-6 my-8">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-2xl">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-950 dark:text-white">
                Data Erasure & Privacy Rights
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                KPDPA & GDPR Right to Erasure / Right to Be Forgotten
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* ACTIVE REQUEST PRESENT */}
        {existingRequest ? (
          <div className="space-y-5">
            <div
              className={`p-5 rounded-2xl border space-y-3 ${
                existingRequest.status === "completed"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
                  : existingRequest.status === "rejected"
                  ? "bg-gray-100 dark:bg-gray-800 border-gray-200 text-gray-800 dark:text-gray-200"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={16} />
                  Request Status: <span className="underline font-black">{existingRequest.status}</span>
                </span>
                <span className="text-[10px] font-bold bg-white/60 dark:bg-black/40 px-2.5 py-1 rounded-full">
                  30-Day Statutory Window
                </span>
              </div>

              <p className="text-xs font-medium leading-relaxed">
                {existingRequest.status === "pending" &&
                  "Your request has been received by our privacy compliance desk. Data scrub operations will be executed across all store collections."}
                {existingRequest.status === "processing" &&
                  "Our automated cascading script is currently scrubbing your personal records."}
                {existingRequest.status === "completed" &&
                  "Your personal data has been erased and scrubbed from our active collections."}
                {existingRequest.status === "rejected" &&
                  `Your request was declined: ${existingRequest.rejectionReason || "Identity verification pending."}`}
              </p>

              {existingRequest.status === "pending" && (
                <div className="pt-2">
                  <button
                    onClick={handleCancelRequest}
                    className="px-4 py-2 bg-white dark:bg-gray-900 text-red-600 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-50 cursor-pointer"
                  >
                    Withdraw / Cancel Request
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs text-gray-500 space-y-2">
              <div className="flex justify-between">
                <span>Request Email:</span>
                <span className="font-bold text-gray-900 dark:text-white">{existingRequest.userEmail}</span>
              </div>
              <div className="flex justify-between">
                <span>Erasure Type:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {existingRequest.erasureType === "full_deletion" ? "Full Hard Delete" : "Anonymize PII for Tax Retention"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* SUBMIT NEW REQUEST FORM */
          <form onSubmit={handleSubmitRequest} className="space-y-5">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[11px]">
                <ShieldCheck size={16} className="text-amber-600" />
                Statutory Privacy Notice
              </div>
              <p className="leading-relaxed">
                Under the Kenya Data Protection Act (KPDPA) & GDPR, you have the right to request erasure of your personal records. Note that financial audit rules require retaining anonymized transactional totals for tax compliance.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Select Erasure Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      erasureType === "anonymize_for_audit"
                        ? "border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-950 dark:text-red-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="erasureType"
                      value="anonymize_for_audit"
                      checked={erasureType === "anonymize_for_audit"}
                      onChange={() => setErasureType("anonymize_for_audit")}
                      className="sr-only"
                    />
                    <span className="font-black block text-xs mb-1">Anonymize PII (Recommended)</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block leading-tight">
                      Scrubs your name, phone, email & address while retaining non-identifying order numbers for tax audit compliance.
                    </span>
                  </label>

                  <label
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      erasureType === "full_deletion"
                        ? "border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-950 dark:text-red-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="erasureType"
                      value="full_deletion"
                      checked={erasureType === "full_deletion"}
                      onChange={() => setErasureType("full_deletion")}
                      className="sr-only"
                    />
                    <span className="font-black block text-xs mb-1">Complete Hard Deletion</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block leading-tight">
                      Permanently purges your user account document and all associated support tickets and reviews.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-black text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Reason for Request (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Account closure, privacy preference..."
                  rows={3}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl outline-none font-bold text-gray-900 dark:text-white"
                ></textarea>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="confirmErasure"
                  checked={confirmCheckbox}
                  onChange={(e) => setConfirmCheckbox(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="confirmErasure" className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold cursor-pointer leading-tight">
                  I confirm that I am requesting the statutory erasure or anonymization of personal data associated with email <strong className="text-gray-900 dark:text-white">{auth.currentUser?.email}</strong>.
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-extrabold text-xs uppercase tracking-wider rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !confirmCheckbox}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {submitting ? "Queueing..." : "Submit Data Erasure Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
