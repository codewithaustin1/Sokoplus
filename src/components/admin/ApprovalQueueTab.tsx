import React, { memo } from "react";
import { ShoppingBag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { doc, setDoc, addDoc, collection, deleteDoc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../../lib/firebase";

interface ApprovalQueueTabProps {
  pendingProducts: any[];
  setPendingProducts: React.Dispatch<React.SetStateAction<any[]>>;
  confirmingApprovePendingId: string | null;
  setConfirmingApprovePendingId: (val: string | null) => void;
  selectedPendingForRejection: any;
  setSelectedPendingForRejection: (val: any) => void;
  pendingRejectionReasonInput: string;
  setPendingRejectionReasonInput: (val: string) => void;
  fetchData: () => void;
}

export const ApprovalQueueTab: React.FC<ApprovalQueueTabProps> = memo(({
  pendingProducts,
  setPendingProducts,
  confirmingApprovePendingId,
  setConfirmingApprovePendingId,
  selectedPendingForRejection,
  setSelectedPendingForRejection,
  pendingRejectionReasonInput,
  setPendingRejectionReasonInput,
  fetchData,
}) => {
  return (
    <div className="space-y-8 animate-fade-in text-gray-950 font-sans">
      {/* Header Card */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-4">
        <h1 className="text-3xl font-black text-gray-950 tracking-tight">Product Clearance Control</h1>
        <p className="text-sm text-gray-500 font-medium">
          Oversee artisan submissions. Review descriptions, catalog categories, price consistency, and stock levels before making their listings active in the main shopping index.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-bold uppercase block">Total Submission Slots</span>
          <p className="text-3xl font-black text-orange-600 mt-1">
            {pendingProducts.length} listings
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-bold uppercase block">Pending Clearance</span>
          <p className="text-3xl font-black text-amber-500 mt-1">
            {pendingProducts.filter(p => !p.approvalStatus || p.approvalStatus === "pending").length} items
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-gray-400 font-bold uppercase block">Corrective Adjustments</span>
          <p className="text-3xl font-black text-red-500 mt-1">
            {pendingProducts.filter(p => p.approvalStatus === "rejected").length} items
          </p>
        </div>
      </div>

      {/* Queue View */}
      <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-50">
          <h2 className="font-black text-lg text-gray-950">Pending Review Pipeline</h2>
          <div className="text-xs text-gray-400">
            Authorized administrator handles only
          </div>
        </div>

        {pendingProducts.length === 0 ? (
          <div className="p-16 text-center rounded-2xl bg-slate-50/60 border border-slate-100/80 flex flex-col items-center justify-center space-y-3">
            <ShoppingBag size={42} className="text-slate-300" />
            <h4 className="font-bold text-gray-700">Clearance queue is empty</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              All sellers creations and adjustments are approved! No items require review currently.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingProducts.map((pendingItem) => (
              <div
                key={pendingItem.id}
                className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Image Preview & Category */}
                  <div className="w-full md:w-48 h-32 bg-gray-100 rounded-xl overflow-hidden border border-gray-150 shrink-0 relative">
                    {pendingItem.images && pendingItem.images[0] ? (
                      <img
                        src={pendingItem.images[0]}
                        alt={pendingItem.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                        No Image
                      </div>
                    )}
                    <span className="absolute top-2 right-2 text-[8px] font-black uppercase bg-gray-900/80 text-white px-2 py-0.5 rounded">
                      {pendingItem.category}
                    </span>
                  </div>

                  {/* Info Panel */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-base text-gray-950">{pendingItem.name}</h3>
                      {pendingItem.originalProductId ? (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Revision / Edit
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">
                          New Submission
                        </span>
                      )}

                      {(!pendingItem.approvalStatus || pendingItem.approvalStatus === "pending") ? (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                          Pending Review
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 text-left">
                          <strong>Declined Action:</strong> "{pendingItem.rejectionReason}"
                        </span>
                      )}

                      {(() => {
                        const checkText = `${pendingItem.name} ${pendingItem.description || ""} ${pendingItem.category || ""}`.toLowerCase();
                        const prohibitedWords = [
                          "firearm", "weapon", "ammunition", "rifle", "pistol", "gun", "bullets",
                          "tobacco", "nicotine", "vape", "vaping", "e-cigarette", "cigarette",
                          "marijuana", "cannabis", "cocaine", "heroin", "narcotic",
                          "gambling", "betting", "lottery", "casino", "poker",
                          "cryptocurrency", "bitcoin", "adult content", "pornography", "escort"
                        ];
                        const matched = prohibitedWords.filter(word => checkText.includes(word));
                        if (matched.length > 0) {
                          return (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-50 text-red-650 border border-red-200 animate-pulse flex items-center gap-1 shrink-0">
                              ⚠ Paystack AUP Flagged: {matched.join(", ")}
                            </span>
                          );
                        }
                        return (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#32ba78]/10 text-[#32ba78] border border-[#32ba78]/25 flex items-center gap-1 shrink-0">
                            ✓ Paystack AUP Compliant
                          </span>
                        );
                      })()}
                    </div>

                    {/* Seller Metadata */}
                    <div className="flex items-center gap-4 text-xs text-gray-400 font-bold">
                      {pendingItem.sellerName && (
                        <span className="flex items-center gap-1">
                          Store: <span className="text-gray-700 font-black">{pendingItem.sellerName}</span>
                        </span>
                      )}
                      <span>Stock: <span className="text-gray-700 font-black">{pendingItem.stock}</span></span>
                      <span>Price: <span className="text-orange-600 font-black">KES {pendingItem.price.toLocaleString()}</span></span>
                    </div>

                    {/* Description */}
                    <div className="text-xs text-gray-650 italic bg-white p-3 rounded-xl border border-gray-100 max-h-24 overflow-y-auto">
                      <ReactMarkdown>{pendingItem.description || "_"}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Operational Action Row */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-100/60">
                  {/* Decline Trigger */}
                  {(!pendingItem.approvalStatus || pendingItem.approvalStatus === "pending") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPendingForRejection(pendingItem);
                        setPendingRejectionReasonInput("");
                      }}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold rounded-lg text-xs border-none cursor-pointer flex items-center gap-1.5"
                    >
                      Decline Submission
                    </button>
                  )}

                  {/* Discard Delete Trigger */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Discard this submission draft totally from database records? This is irreversible.`)) return;
                      try {
                        await deleteDoc(doc(db, "pending_products", pendingItem.id));
                        setPendingProducts(prev => prev.filter(p => p.id !== pendingItem.id));
                        toast.success("Submission draft discarded successfully.");
                      } catch (err) {
                        console.error("[Admin] error discarding submission:", err);
                        toast.error("Failed to discard submission.");
                      }
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-650 font-extrabold rounded-lg text-xs border-none cursor-pointer flex items-center gap-1.5"
                  >
                    Discard
                  </button>

                  {/* Confirmation & Approval */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirmingApprovePendingId !== pendingItem.id) {
                        setConfirmingApprovePendingId(pendingItem.id);
                        return;
                      }
                      try {
                        const payload = {
                          name: pendingItem.name,
                          price: pendingItem.price,
                          stock: pendingItem.stock,
                          category: pendingItem.category,
                          description: pendingItem.description,
                          images: pendingItem.images,
                          sellerId: pendingItem.sellerId,
                          sellerName: pendingItem.sellerName,
                          artisan: pendingItem.artisan || pendingItem.sellerName || "Artisan Merchant",
                          active: true,
                          approvalStatus: "approved",
                          rejectionReason: "",
                          createdAt: pendingItem.createdAt || new Date().toISOString(),
                          availableColors: pendingItem.availableColors || []
                        };

                        if (pendingItem.originalProductId) {
                          // Live item amendment
                          await setDoc(doc(db, "products", pendingItem.originalProductId), payload, { merge: true });
                          toast.success(`Approved revision: "${pendingItem.name}" live updates applied!`);
                        } else {
                          // New product publication
                          await addDoc(collection(db, "products"), payload);
                          toast.success(`Published: "${pendingItem.name}" catalogue record published active!`);
                        }

                        // delete from pending queue
                        await deleteDoc(doc(db, "pending_products", pendingItem.id));

                        // update dashboard states
                        setPendingProducts(prev => prev.filter(p => p.id !== pendingItem.id));
                        setConfirmingApprovePendingId(null);
                        
                        // Re-fetch regular products to update admin inventory
                        fetchData();
                      } catch (error) {
                        console.error("[Admin] error approving product:", error);
                        toast.error("Failed to publish or update item settings.");
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer border-none shadow-xs ${
                      confirmingApprovePendingId === pendingItem.id
                        ? "bg-amber-600 text-white animate-pulse"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {confirmingApprovePendingId === pendingItem.id ? "Confirm?" : "Approve Listing"}
                  </button>

                  {confirmingApprovePendingId === pendingItem.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmingApprovePendingId(null)}
                      className="px-3 py-2 bg-gray-250 text-gray-700 font-extrabold rounded-lg text-xs border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Rejection Feedback overlay */}
      {selectedPendingForRejection && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full border border-gray-150 shadow-2xl space-y-5 animate-fade-in text-left">
            <h3 className="text-lg font-black text-gray-900">Decline Listing Submission</h3>
            <p className="text-xs text-gray-400">
              Specify details to guide <span className="font-extrabold text-gray-800">"{selectedPendingForRejection.name}"</span>'s seller on what needs to be changed:
            </p>
            <textarea
              required
              rows={4}
              placeholder="e.g., Please provide a higher-resolution photograph displaying dimensions. Ensure description lists material specs."
              value={pendingRejectionReasonInput}
              onChange={(e) => setPendingRejectionReasonInput(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs resize-none text-gray-950"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedPendingForRejection(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-650 font-extrabold rounded-lg text-xs cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingRejectionReasonInput.trim()) {
                    toast.error("Feedback explanation is required.");
                    return;
                  }
                  try {
                    const feedback = pendingRejectionReasonInput.trim();
                    await updateDoc(doc(db, "pending_products", selectedPendingForRejection.id), {
                      approvalStatus: "rejected",
                      rejectionReason: feedback
                    });
                    
                    setPendingProducts(prev =>
                      prev.map(p =>
                        p.id === selectedPendingForRejection.id
                          ? { ...p, approvalStatus: "rejected", rejectionReason: feedback }
                          : p
                      )
                    );
                    
                    toast.success("Listing submission declined. Seller notified.");
                    setSelectedPendingForRejection(null);
                  } catch (err) {
                    console.error("[Admin] Failed to decline pending product:", err);
                    toast.error("Failed to update status.");
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-800 text-white font-extrabold rounded-lg text-xs cursor-pointer border-none"
              >
                Send Decline Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ApprovalQueueTab;
