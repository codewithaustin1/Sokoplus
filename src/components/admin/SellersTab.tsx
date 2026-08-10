import React, { memo } from "react";
import { Pencil } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import axios from "axios";
import toast from "react-hot-toast";
import { db } from "../../lib/firebase";

interface SellersTabProps {
  sellers: any[];
  setSellers: React.Dispatch<React.SetStateAction<any[]>>;
  setEditingSeller: (val: any) => void;
  setEditSellerShopName: (val: string) => void;
  setEditSellerPhone: (val: string) => void;
  setEditSellerLocation: (val: string) => void;
  setEditSellerDescription: (val: string) => void;
  confirmingApproveSellerId: string | null;
  setConfirmingApproveSellerId: (val: string | null) => void;
  selectedSellerForRejection: any;
  setSelectedSellerForRejection: (val: any) => void;
  rejectionReasonInput: string;
  setRejectionReasonInput: (val: string) => void;
}

export const SellersTab: React.FC<SellersTabProps> = memo(({
  sellers,
  setSellers,
  setEditingSeller,
  setEditSellerShopName,
  setEditSellerPhone,
  setEditSellerLocation,
  setEditSellerDescription,
  confirmingApproveSellerId,
  setConfirmingApproveSellerId,
  selectedSellerForRejection,
  setSelectedSellerForRejection,
  rejectionReasonInput,
  setRejectionReasonInput,
}) => {
  return (
    <div className="space-y-8 animate-fade-in text-gray-950 font-sans">
      {/* Header Card */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-3">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight">Marketplace Governance</h1>
        <p className="text-xs sm:text-sm text-gray-500 font-medium">
          Review third-party merchant seller proposals, audit shop configurations, process approvals or rejections, and oversee platform commissions.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase block">Pending Audits</span>
          <p className="text-xl sm:text-3xl font-black text-orange-600 mt-1">
            {sellers.filter(s => s.status === "pending").length} proposals
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase block">Approved Partners</span>
          <p className="text-xl sm:text-3xl font-black text-green-600 mt-1">
            {sellers.filter(s => s.status === "approved").length} merchants
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase block">Marketplace Commission Fee</span>
          <p className="text-xl sm:text-3xl font-black text-gray-900 mt-1">10.0% flat</p>
        </div>
      </div>

      {/* List of Proposals */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <h3 className="text-lg font-black text-gray-900">Active Proposals & Merchants</h3>
          <p className="text-xs text-gray-400">Total registered profiles loaded: {sellers.length}</p>
        </div>

        {sellers.length === 0 ? (
          <div className="p-12 text-center text-gray-400 italic bg-gray-50 rounded-2xl border border-gray-100">
            No seller profiles or applications have been recorded in the system.
          </div>
        ) : (
          <div className="space-y-6">
            {sellers.map((seller) => (
              <div
                key={seller.uid}
                className="p-6 rounded-2xl border border-gray-150 bg-white shadow-xs space-y-4 hover:border-orange-200 transition-all text-left"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-black text-gray-900">{seller.shopName}</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeller(seller);
                          setEditSellerShopName(seller.shopName || "");
                          setEditSellerPhone(seller.phone || "");
                          setEditSellerLocation(seller.location || "");
                          setEditSellerDescription(seller.description || "");
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-gray-200/50 hover:border-orange-200/50 cursor-pointer"
                        title="Edit Seller Details"
                      >
                        <Pencil size={11} />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-semibold mt-1">
                      Location: <span className="text-gray-700">{seller.location}</span> | Contact: <span className="text-gray-700">{seller.phone}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                    seller.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" :
                    seller.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                    "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                  }`}>
                    {seller.status}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Shop Pitch</span>
                  <p className="text-xs text-gray-650 leading-relaxed font-medium">
                    {seller.description || "_No pitch or description was supplied._"}
                  </p>
                  {seller.status === "rejected" && seller.rejectedReason && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50 text-[10px] text-red-650 font-medium">
                      <strong>Rejection Note:</strong> "{seller.rejectedReason}"
                    </div>
                  )}
                </div>

                {/* Paystack Split Settlement & Onboarding Details */}
                <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-150 space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Paystack Split Settlement & Onboarding Details</span>
                  {seller.paystackSubaccountCode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Subaccount Code</span>
                        <span className="font-mono font-bold text-gray-900">{seller.paystackSubaccountCode}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Settlement Target</span>
                        <span className="font-bold text-gray-800">MPESA ({seller.mpesaPhone || seller.phone})</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Split Setup Status</span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full font-black border border-green-150">
                          ● Active (10% Split)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/40">
                      <span className="text-amber-800 font-semibold italic">Onboarding incomplete: No Paystack Subaccount configured by seller yet.</span>
                      <span className="text-[9px] uppercase font-black text-amber-700 bg-white px-2 py-1 rounded-md shadow-xs border border-amber-200">Pending Setup</span>
                    </div>
                  )}
                </div>

                {seller.status === "pending" && (
                  <div className="flex items-center gap-2 justify-end pt-2">
                    {confirmingApproveSellerId === seller.uid && (
                      <button
                        type="button"
                        onClick={() => setConfirmingApproveSellerId(null)}
                        className="px-3 py-1.5 rounded-xl bg-gray-150 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition-all border-none cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSellerForRejection(seller);
                        setRejectionReasonInput("");
                        setConfirmingApproveSellerId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 font-extrabold text-xs transition-all border-none cursor-pointer"
                    >
                      Reject Application
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirmingApproveSellerId !== seller.uid) {
                          setConfirmingApproveSellerId(seller.uid);
                          return;
                        }
                        try {
                          // First approve the seller
                          await updateDoc(doc(db, "sellers", seller.uid), { status: "approved" });
                          
                          // Now attempt to programmatically trigger Paystack Subaccount creation
                          let extraData = {};
                          try {
                            const phoneNum = seller.mpesaPhone || seller.phone || "";
                            if (phoneNum) {
                              const subRes = await axios.post("/api/paystack/subaccount/create", {
                                sellerId: seller.uid,
                                businessName: seller.shopName,
                                mpesaPhone: phoneNum
                              });
                              if (subRes.data && subRes.data.success) {
                                extraData = subRes.data.updateData || {};
                                if (subRes.data.status === "live") {
                                  toast.success(`Paystack Subaccount automatically created and linked: ${subRes.data.subaccountCode}`);
                                } else {
                                  toast.success(`Paystack Subaccount successfully initialized (simulated/sandbox): ${subRes.data.subaccountCode}`);
                                }
                              }
                            }
                          } catch (subErr) {
                            console.warn("[Admin] Auto-subaccount creation had issues:", subErr);
                          }

                          setSellers(prev => prev.map(s => s.uid === seller.uid ? { ...s, status: "approved", ...extraData } : s));
                          toast.success(`Merchant "${seller.shopName}" has been successfully approved!`);
                          setConfirmingApproveSellerId(null);
                        } catch (error) {
                          console.error("[Admin] Failed to approve merchant:", error);
                          toast.error(`Could not update merchant status: ${error instanceof Error ? error.message : String(error)}`);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl font-extrabold text-xs transition-all border-none cursor-pointer flex items-center gap-1 ${
                        confirmingApproveSellerId === seller.uid
                          ? "bg-amber-600 hover:bg-amber-750 text-white animate-pulse"
                          : "bg-green-600 hover:bg-green-750 text-white"
                      }`}
                    >
                      {confirmingApproveSellerId === seller.uid ? "Confirm Approval?" : "Approve Partner"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Rejection Overlay Dialog */}
      {selectedSellerForRejection && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full border border-gray-150 shadow-2xl space-y-5 animate-fade-in text-left">
            <h3 className="text-lg font-black text-gray-900">Provide Rejection Reason</h3>
            <p className="text-xs text-gray-400">
              Are you sure you want to decline the proposal from <span className="font-extrabold text-gray-800">"{selectedSellerForRejection.shopName}"</span>? Explain the reason below:
            </p>
            <textarea
              required
              rows={4}
              placeholder="e.g., Authentic local sourcing validation failed, or contact credentials appear incorrect."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-orange-600 font-medium text-xs resize-none text-gray-950"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSellerForRejection(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-650 font-extrabold rounded-lg text-xs cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!rejectionReasonInput.trim()) {
                    toast.error("Typing a rejection reason is mandatory.");
                    return;
                  }
                  try {
                    const note = rejectionReasonInput.trim();
                    await updateDoc(doc(db, "sellers", selectedSellerForRejection.uid), {
                      status: "rejected",
                      rejectedReason: note
                    });
                    setSellers(prev => prev.map(s => s.uid === selectedSellerForRejection.uid ? { ...s, status: "rejected", rejectedReason: note } : s));
                    toast.success(`Merchant proposal declined.`);
                    setSelectedSellerForRejection(null);
                  } catch (err: any) {
                    toast.error(`Failed to reject proposal: ${err.message || err}`);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg text-xs cursor-pointer border-none"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SellersTab;
