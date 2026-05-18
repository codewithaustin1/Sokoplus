import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Order } from "../types";
import { User, Mail, Award, Package, ArrowRight, ShoppingBag, Clock, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../lib/firebase";

interface ProfileProps {
  user: UserProfile | null;
}

export default function Profile({ user }: ProfileProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      } catch (error) {
        console.error("Error fetching user orders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [user]);

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
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
                <Mail size={16} className="mr-2" />
                {user.email}
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
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black tracking-tight text-gray-900 flex items-center">
            <Package className="mr-3 text-orange-600" size={32} />
            Order History
          </h2>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full">
            {orders.length} Total Orders
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-50 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
            <div className="bg-gray-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={40} className="text-gray-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Ready to find something you love? Start exploring our curated collection.
            </p>
            <Link
              to="/"
              className="inline-flex items-center space-x-2 bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg"
            >
              Start Shopping <ArrowRight size={20} className="ml-2" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orders.map((order, index) => (
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
                    <p className="text-gray-500 font-medium">Total Amount</p>
                    <p className="text-2xl font-black text-orange-600">
                      KES {order.totalAmount.toLocaleString()}
                    </p>
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
