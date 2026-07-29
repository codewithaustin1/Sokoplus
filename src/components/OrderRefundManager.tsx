import React, { useState } from "react";
import { Order, Product, RefundRecord, RefundItem } from "../types";
import { db } from "../lib/firebase";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { useCurrency } from "../lib/CurrencyContext";
import { RotateCcw, AlertCircle, CheckCircle2, PackageCheck, Send, DollarSign, History, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

interface OrderRefundManagerProps {
  order: Order;
  products: Product[];
  onRefundSuccess: (updatedOrder: Order, restockedProducts: { productId: string; newStock: number }[]) => void;
}

export const OrderRefundManager: React.FC<OrderRefundManagerProps> = ({
  order,
  products,
  onRefundSuccess
}) => {
  const { formatPrice } = useCurrency();
  const [isExpandingForm, setIsExpandingForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-calculate already refunded quantities per product
  const getAlreadyRefundedQty = (productId: string): number => {
    if (!order.refunds || order.refunds.length === 0) return 0;
    return order.refunds.reduce((sum, r) => {
      const itemMatch = r.items?.find((i) => i.productId === productId);
      return sum + (itemMatch ? itemMatch.quantity : 0);
    }, 0);
  };

  // State for items to refund
  const [itemRefundState, setItemRefundState] = useState<{
    [productId: string]: { quantity: number; restock: boolean };
  }>(() => {
    const initialState: { [productId: string]: { quantity: number; restock: boolean } } = {};
    order.items?.forEach((item) => {
      initialState[item.productId] = { quantity: 0, restock: true };
    });
    return initialState;
  });

  // Reason & Customer Note State
  const REASON_PRESETS = [
    "Customer Return / Exchange",
    "Damaged or Defective Item",
    "Out of Stock / Unfulfillable",
    "Shipping Delay or Lost Package",
    "Goodwill Gesture / Price Adjustment"
  ];

  const [selectedReasonPreset, setSelectedReasonPreset] = useState<string>(REASON_PRESETS[0]);
  const [customReasonDetails, setCustomReasonDetails] = useState<string>("");
  const [customerNote, setCustomerNote] = useState<string>("");
  const [sendCustomerNotification, setSendCustomerNotification] = useState<boolean>(true);
  const [customAdjustmentAmount, setCustomAdjustmentAmount] = useState<string>("");

  // Calculation logic
  const itemsRefundSubtotal = order.items?.reduce((sum, item) => {
    const refQty = itemRefundState[item.productId]?.quantity || 0;
    return sum + refQty * item.price;
  }, 0) || 0;

  const adjVal = parseFloat(customAdjustmentAmount) || 0;
  const calculatedTotalRefund = Math.max(0, itemsRefundSubtotal + adjVal);

  const existingRefundedAmount = order.refundedAmount || 0;
  const maxAllowableRefund = Math.max(0, order.totalAmount - existingRefundedAmount);

  const handleQtyChange = (productId: string, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(qty, maxQty));
    setItemRefundState((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity: validQty
      }
    }));
  };

  const handleRestockToggle = (productId: string, restock: boolean) => {
    setItemRefundState((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        restock
      }
    }));
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();

    if (calculatedTotalRefund <= 0) {
      toast.error("Please select at least 1 item unit or enter an adjustment amount to refund.");
      return;
    }

    if (calculatedTotalRefund > maxAllowableRefund) {
      toast.error(`Refund amount cannot exceed remaining order balance of ${formatPrice(maxAllowableRefund)}.`);
      return;
    }

    setLoading(true);
    try {
      const finalReason = customReasonDetails.trim()
        ? `${selectedReasonPreset}: ${customReasonDetails.trim()}`
        : selectedReasonPreset;

      // Build refund items breakdown
      const refundItems: RefundItem[] = [];
      const restockedProductsList: { productId: string; newStock: number }[] = [];

      for (const item of order.items || []) {
        const state = itemRefundState[item.productId];
        if (state && state.quantity > 0) {
          refundItems.push({
            productId: item.productId,
            name: item.name,
            quantity: state.quantity,
            unitPrice: item.price,
            restocked: state.restock
          });

          // Perform Firestore inventory restocking if requested
          if (state.restock) {
            const prodRef = doc(db, "products", item.productId);
            const matchingProd = products.find((p) => p.id === item.productId);
            const currentStock = matchingProd ? matchingProd.stock : 0;
            const updatedStock = currentStock + state.quantity;

            await updateDoc(prodRef, {
              stock: updatedStock,
              inStock: updatedStock > 0,
              updatedAt: new Date().toISOString()
            });

            restockedProductsList.push({
              productId: item.productId,
              newStock: updatedStock
            });
          }
        }
      }

      const newRefundRecord: RefundRecord = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        amount: calculatedTotalRefund,
        reason: finalReason,
        customerNote: customerNote.trim() || undefined,
        items: refundItems,
        createdAt: new Date().toISOString(),
        processedBy: "Admin"
      };

      const newTotalRefunded = existingRefundedAmount + calculatedTotalRefund;
      const isFullRefund = newTotalRefunded >= order.totalAmount;
      const newOrderStatus = isFullRefund ? "refunded" : "partially_refunded";

      const updatedRefundsArray = [...(order.refunds || []), newRefundRecord];
      const updatedNotesArray = customerNote.trim()
        ? [
            ...(order.customerNotes || []),
            {
              note: customerNote.trim(),
              createdAt: new Date().toISOString(),
              author: "Store Manager (Refund Notice)"
            }
          ]
        : order.customerNotes || [];

      // Update Order Document in Firestore
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        refundedAmount: newTotalRefunded,
        refunds: updatedRefundsArray,
        customerNotes: updatedNotesArray,
        status: newOrderStatus,
        updatedAt: new Date().toISOString()
      });

      // Send real-time in-app notification to customer if configured
      if (sendCustomerNotification && order.userId) {
        try {
          await addDoc(collection(db, "users", order.userId, "notifications"), {
            title: `Refund Processed for Order #${order.id.slice(0, 8)}`,
            body: customerNote.trim()
              ? `Refund of ${formatPrice(calculatedTotalRefund)} processed. Note: ${customerNote.trim()}`
              : `A refund of ${formatPrice(calculatedTotalRefund)} has been issued for your order #${order.id.slice(0, 8)}.`,
            read: false,
            createdAt: new Date().toISOString(),
            type: "refund_update",
            orderId: order.id
          });
        } catch (notifErr) {
          console.warn("[OrderRefundManager] Customer notification push skipped/failed:", notifErr);
        }
      }

      toast.success(
        `Refund of ${formatPrice(calculatedTotalRefund)} issued successfully! ${
          restockedProductsList.length > 0 ? "Inventory restocked." : ""
        }`
      );

      const updatedOrder: Order = {
        ...order,
        refundedAmount: newTotalRefunded,
        refunds: updatedRefundsArray,
        customerNotes: updatedNotesArray,
        status: newOrderStatus
      };

      onRefundSuccess(updatedOrder, restockedProductsList);
      setIsExpandingForm(false);
      setCustomerNote("");
      setCustomReasonDetails("");
      setCustomAdjustmentAmount("");
    } catch (err: any) {
      console.error("Failed to process refund:", err);
      toast.error(`Refund failed: ${err.message || "Database update error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-gray-150 dark:border-gray-800 pt-5 mt-4">
      {/* Header & Balance Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-orange-500" />
            <h4 className="text-xs font-black text-gray-950 dark:text-gray-50 uppercase tracking-wider">
              Refund & Restock Management
            </h4>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            Process item returns, adjust order value, and restore inventory counts seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {existingRefundedAmount > 0 && (
            <div className="text-right border-r border-gray-200 dark:border-gray-700 pr-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Refunded</span>
              <span className="text-xs font-black text-red-600 dark:text-red-400">
                {formatPrice(existingRefundedAmount)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpandingForm(!isExpandingForm)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <DollarSign size={14} />
            <span>{isExpandingForm ? "Cancel Refund" : "Issue Partial Refund"}</span>
          </button>
        </div>
      </div>

      {/* Existing Refund Log History */}
      {order.refunds && order.refunds.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            <History size={13} className="text-orange-500" />
            <span>Processed Refunds ({order.refunds.length})</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {order.refunds.map((ref) => (
              <div
                key={ref.id}
                className="p-3 bg-white dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-red-600 dark:text-red-400 font-black">
                    Refunded: {formatPrice(ref.amount)}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(ref.createdAt).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>

                <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                  <strong>Reason:</strong> {ref.reason}
                </p>

                {ref.customerNote && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200/60 dark:border-amber-900/40 text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                    <MessageSquare size={11} className="shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      <strong>Customer Note Sent:</strong> "{ref.customerNote}"
                    </span>
                  </div>
                )}

                {ref.items && ref.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ref.items.map((i, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold"
                      >
                        {i.quantity}× {i.name} ({i.restocked ? "Restocked" : "No restock"})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Partial Refund Form */}
      {isExpandingForm && (
        <form
          onSubmit={handleProcessRefund}
          className="p-5 bg-white dark:bg-gray-950 rounded-3xl border border-orange-200 dark:border-orange-900/50 shadow-lg space-y-5 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <h5 className="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw size={14} className="text-orange-500" />
              Configure Partial Refund & Inventory Restock
            </h5>
            <span className="text-[11px] font-bold text-gray-500">
              Max Refundable: <strong className="text-gray-900 dark:text-gray-100">{formatPrice(maxAllowableRefund)}</strong>
            </span>
          </div>

          {/* 1. Item Selection and Quantity Adjustments */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
              1. Select Line Items & Restock Units:
            </label>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-150 dark:border-gray-800 rounded-2xl overflow-hidden">
              {order.items?.map((item) => {
                const prevRefunded = getAlreadyRefundedQty(item.productId);
                const remainingQty = Math.max(0, item.quantity - prevRefunded);
                const currentRefundState = itemRefundState[item.productId] || { quantity: 0, restock: true };

                return (
                  <div
                    key={item.productId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-gray-50/50 dark:bg-gray-900/40"
                  >
                    <div className="space-y-0.5 max-w-xs">
                      <p className="font-bold text-gray-900 dark:text-gray-100">{item.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {formatPrice(item.price)} / unit • Purchased: {item.quantity}
                        {prevRefunded > 0 && <span className="text-orange-600 font-semibold"> (Prev. refunded: {prevRefunded})</span>}
                      </p>
                    </div>

                    {remainingQty > 0 ? (
                      <div className="flex items-center gap-4">
                        {/* Qty Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-500">Refund Qty:</span>
                          <input
                            type="number"
                            min={0}
                            max={remainingQty}
                            value={currentRefundState.quantity}
                            onChange={(e) =>
                              handleQtyChange(item.productId, parseInt(e.target.value) || 0, remainingQty)
                            }
                            className="w-16 px-2 py-1 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <span className="text-[10px] text-gray-400">/ max {remainingQty}</span>
                        </div>

                        {/* Restock checkbox */}
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={currentRefundState.restock}
                            onChange={(e) => handleRestockToggle(item.productId, e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="flex items-center gap-1">
                            <PackageCheck size={13} className="text-emerald-500" />
                            Restock Item
                          </span>
                        </label>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-gray-400 italic">Fully Refunded</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Adjustment Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                2. Custom Adjustment / Shipping Refund (Optional):
              </label>
              <input
                type="number"
                placeholder="e.g., 200 for extra shipping refund"
                value={customAdjustmentAmount}
                onChange={(e) => setCustomAdjustmentAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Reason Preset:
              </label>
              <select
                value={selectedReasonPreset}
                onChange={(e) => setSelectedReasonPreset(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {REASON_PRESETS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Reason Details & Customer Note */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                3. Additional Audit Reason / Notes:
              </label>
              <input
                type="text"
                placeholder="Internal audit notes or return tracking number..."
                value={customReasonDetails}
                onChange={(e) => setCustomReasonDetails(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-orange-500" /> Customer-Facing Message Note:
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendCustomerNotification}
                    onChange={(e) => setSendCustomerNotification(e.target.checked)}
                    className="w-3.5 h-3.5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                  />
                  <span>Send In-App Notification</span>
                </label>
              </div>
              <textarea
                rows={2}
                placeholder="e.g. 'We have processed a partial refund of KES 1,500 for your return. Funds will reflect on your M-Pesa account.'"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full p-3 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Calculation Summary Bar & Action */}
          <div className="p-4 bg-orange-50 dark:bg-orange-950/40 rounded-2xl border border-orange-200 dark:border-orange-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-black text-orange-700 dark:text-orange-400 block">
                Calculated Total Partial Refund
              </span>
              <div className="text-xl font-black text-orange-600 dark:text-orange-400">
                {formatPrice(calculatedTotalRefund)}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                Items: {formatPrice(itemsRefundSubtotal)} {adjVal !== 0 && `| Adj: ${formatPrice(adjVal)}`}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || calculatedTotalRefund <= 0}
              className={`px-6 py-3 rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                loading || calculatedTotalRefund <= 0
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700 text-white hover:shadow-lg active:scale-98"
              }`}
            >
              {loading ? (
                <span>Processing Refund & Restock...</span>
              ) : (
                <>
                  <Send size={14} />
                  <span>Execute Refund & Restock</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
