import React, { memo } from "react";
import { Download, Search, Eye, Trash2 } from "lucide-react";

interface OrdersTabProps {
  orderStatusFilter: string;
  setOrderStatusFilter: (val: string) => void;
  orderSortBy: string;
  setOrderSortBy: (val: string) => void;
  orderSearchTerm: string;
  setOrderSearchTerm: (val: string) => void;
  handleDownloadCSV: () => void;
  filteredOrders: any[];
  updateOrderStatus: (id: string, status: string) => void;
  setSelectedViewOrder: (order: any) => void;
  deleteOrder: (id: string) => void;
  ordersPage?: number;
  hasMoreOrders?: boolean;
  isOrdersLoading?: boolean;
  onNextOrdersPage?: () => void;
  onPrevOrdersPage?: () => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = memo(({
  orderStatusFilter,
  setOrderStatusFilter,
  orderSortBy,
  setOrderSortBy,
  orderSearchTerm,
  setOrderSearchTerm,
  handleDownloadCSV,
  filteredOrders,
  updateOrderStatus,
  setSelectedViewOrder,
  deleteOrder,
  ordersPage = 1,
  hasMoreOrders = false,
  isOrdersLoading = false,
  onNextOrdersPage,
  onPrevOrdersPage,
}) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">Recent Orders</h2>
          <p className="text-xs text-emerald-700 font-semibold mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Server-side constraints active (limit, orderBy, where)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
          >
            <option value="all">All Orders</option>
            <option value="guest">Guest Checkout Orders</option>
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
              placeholder="Search Receipt ID, Email, Name, Phone, or M-Pesa Ref..."
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
        <table className="w-full text-left min-w-[680px]">
          <thead>
            <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
              <th className="pb-4 uppercase">Order ID</th>
              <th className="pb-4 uppercase">Customer</th>
              <th className="pb-4 uppercase">Date & Timestamp</th>
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
                    <div className="flex flex-col space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-gray-900 text-xs">
                          {o.shippingAddress?.fullName || o.customerName || o.userEmail?.split("@")[0] || "Guest Customer"}
                        </span>
                        {(o.isGuestOrder || o.userId === "guest" || !o.userId) && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Guest
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium break-all">
                        {o.userEmail || o.shippingAddress?.phone || "No Email Provided"}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-gray-700 font-medium">
                    {o.createdAt ? (
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                        {o.createdAt.toDate
                          ? o.createdAt.toDate().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
                          : new Date(o.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic font-medium">No Date</span>
                    )}
                  </td>
                  <td className="py-4">
                    <select
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
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
                  colSpan={6}
                  className="py-12 text-center text-gray-500 font-medium"
                >
                  No orders found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 pt-4 mt-6 gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-200">
            ⚡ Firestore Server Query (limit 25)
          </span>
          <span>Page {ordersPage}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onPrevOrdersPage}
            disabled={ordersPage <= 1 || isOrdersLoading}
            className="px-4 py-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold rounded-xl border border-gray-200 cursor-pointer transition-all"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNextOrdersPage}
            disabled={!hasMoreOrders || isOrdersLoading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all"
          >
            {isOrdersLoading ? "Loading..." : "Next Page"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default OrdersTab;
