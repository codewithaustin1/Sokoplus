import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Order } from "../types";
import { User, Mail, Award, Package, ArrowRight, ShoppingBag, Clock, LogOut, Phone, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../lib/firebase";
import SEO from "../components/SEO";
import EmptyState from "../components/EmptyState";
import { downloadReceipt } from "../utils/pdfGenerator";

interface ProfileProps {
  user: UserProfile | null;
}

export default function Profile({ user }: ProfileProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"this-month" | "last-12-months" | "specific-month">("this-month");
  
  // Initialize with current year and month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(`${now.getFullYear()}-${now.getMonth()}`);

  const getMonthsList = () => {
    const list = [];
    const tempDate = new Date();
    for (let i = 0; i < 12; i++) {
      const monthName = tempDate.toLocaleString('default', { month: 'long' });
      const year = tempDate.getFullYear();
      const value = `${tempDate.getFullYear()}-${tempDate.getMonth()}`;
      list.push({ label: `${monthName} ${year}`, value });
      tempDate.setMonth(tempDate.getMonth() - 1);
    }
    return list;
  };
  const monthsList = getMonthsList();

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const allFetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        
        // Auto delete Delivered or Cancelled orders older than one year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const ordersToDelete: Order[] = [];
        const activeOrders: Order[] = [];
        
        allFetchedOrders.forEach(order => {
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
          
          const isOlderThanOneYear = orderDate < oneYearAgo;
          if (isOlderThanOneYear && (order.status === 'delivered' || order.status === 'cancelled')) {
            ordersToDelete.push(order);
          } else {
            activeOrders.push(order);
          }
        });
        
        if (ordersToDelete.length > 0) {
          await Promise.all(ordersToDelete.map(order => deleteDoc(doc(db, "orders", order.id))));
          console.log(`Auto-deleted ${ordersToDelete.length} Delivered/Cancelled orders older than one year.`);
        }
        
        setOrders(activeOrders);
      } catch (error) {
        console.error("Error fetching user orders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [user]);

  const getFilteredOrders = () => {
    const currentDate = new Date();
    return orders.filter(order => {
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
      
      if (timeFilter === "this-month") {
        return orderDate.getMonth() === currentDate.getMonth() && orderDate.getFullYear() === currentDate.getFullYear();
      }
      
      if (timeFilter === "last-12-months") {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        return orderDate >= twelveMonthsAgo;
      }
      
      if (timeFilter === "specific-month") {
        if (!selectedMonth) return false;
        const [year, month] = selectedMonth.split("-").map(Number);
        return orderDate.getMonth() === month && orderDate.getFullYear() === year;
      }
      
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO title="My Profile" />
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full -mr-32 -mt-32 opacity-50" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
          <div className="w-24 h-24 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
            <User size={48} />
          </div>
          
          <div className="flex-grow text-center md:text-left space-y-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-gray-900">{user.displayName}</h1>
              <p className="text-gray-500 flex items-center justify-center md:justify-start mt-1">
                {user.email ? <Mail size={16} className="mr-2" /> : <Phone size={16} className="mr-2" />}
                {user.email || user.phoneNumber || "No contact info"}
              </p>
            </div>
            
            <div className="flex items-center justify-center md:justify-start space-x-4">
              <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl flex items-center">
                <Award size={20} className="text-orange-600 mr-2" />
                <span className="font-bold text-orange-900">{user.loyaltyPoints} Loyalty Points</span>
              </div>
              {user.isAdmin && (
                <Link 
                  to="/admin" 
                  className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-600 transition-all text-sm"
                >
                  Admin Panel
                </Link>
              )}
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-all text-sm flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order History */}
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-3xl font-black tracking-tight text-gray-900 flex items-center">
            <Package className="mr-3 text-orange-600" size={32} />
            Order History
          </h2>
          <span className="text-sm font-bold text-gray-500 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full self-start sm:self-auto">
            Showing {filteredOrders.length} of {orders.length}
          </span>
        </div>

        {/* Time Filter Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {(["this-month", "last-12-months", "specific-month"] as const).map((filterOpt) => {
              const labelMap = {
                "this-month": "This Month",
                "last-12-months": "Last 12 Months",
                "specific-month": "Specific Month"
              };
              return (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setTimeFilter(filterOpt)}
                  className={`px-4.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    timeFilter === filterOpt
                      ? "bg-orange-600 text-white shadow-lg shadow-orange-100 scale-[1.02]"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  }`}
                >
                  {labelMap[filterOpt]}
                </button>
              );
            })}
          </div>

          {timeFilter === "specific-month" && (
            <div className="flex items-center space-x-2 animate-fade-in">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Select Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-50 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState 
            icon={Package}
            title="No orders yet"
            description="Ready to find something you love? Start exploring our curated collection of Kenyan excellence."
            actionLabel="Start Shopping"
            actionPath="/"
          />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mx-auto">
              <Package size={28} />
            </div>
            <h3 className="text-xl font-black text-gray-900">No orders found</h3>
            <p className="text-gray-500 text-sm font-medium">There are no orders matching the selected filter criteria for this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Order ID</p>
                    <p className="font-mono text-sm text-gray-900">#{order.id.slice(0, 8)}</p>
                  </div>
                  <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.status}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Tracking Timeline */}
                  <div className="relative pt-2 pb-4">
                    <div className="absolute top-[22px] left-0 w-full h-0.5 bg-gray-100" />
                    <div 
                      className="absolute top-[22px] left-0 h-0.5 bg-orange-600 transition-all duration-500" 
                      style={{ 
                        width: order.status === 'pending' ? '0%' : 
                               order.status === 'processing' ? '25%' : 
                               order.status === 'shipped' ? '50%' : 
                               order.status === 'delivered' ? '100%' : '0%' 
                      }} 
                    />
                    
                    <div className="relative flex justify-between">
                      {[
                        { label: 'Pending', key: 'pending' },
                        { label: 'Processing', key: 'processing' },
                        { label: 'Shipped', key: 'shipped' },
                        { label: 'Delivered', key: 'delivered' }
                      ].map((step, idx) => {
                        const statuses = ['pending', 'processing', 'shipped', 'delivered'];
                        const currentIdx = statuses.indexOf(order.status);
                        const isCompleted = currentIdx >= idx && order.status !== 'cancelled';
                        const isCurrent = currentIdx === idx && order.status !== 'cancelled';

                        return (
                          <div key={step.key} className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full border-2 bg-white z-10 transition-colors ${
                              isCompleted ? 'border-orange-600 bg-orange-600' : 'border-gray-200'
                            } ${isCurrent ? 'ring-4 ring-orange-100' : ''}`} />
                            <span className={`text-[8px] font-black uppercase tracking-tighter mt-2 ${
                              isCompleted ? 'text-orange-600' : 'text-gray-300'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center text-gray-500 text-sm">
                    <Clock size={16} className="mr-2" />
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Recent'}
                  </div>
                  
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Total Amount</p>
                      <p className="text-xl font-black text-gray-900 leading-tight">
                        KES {order.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <button
                      id={`download-receipt-${order.id}`}
                      type="button"
                      onClick={() => downloadReceipt(order, user)}
                      className="inline-flex items-center space-x-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-extrabold px-3.5 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer border border-orange-100/50"
                    >
                      <Download size={14} />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl p-8 z-[110] shadow-2xl space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                  <LogOut size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900">Sign Out?</h3>
                  <p className="text-gray-500 font-medium">Are you sure you want to sign out of your account?</p>
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => {
                    auth.signOut();
                    setShowLogoutConfirm(false);
                  }}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg"
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-gray-50 text-gray-900 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
