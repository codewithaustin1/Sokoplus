import { useState, useEffect } from "react";
import { UserProfile, Product, Order } from "../types";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Plus, Trash2, Package, TrendingUp, Users, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";

interface AdminProps {
  user: UserProfile | null;
}

export default function Admin({ user }: AdminProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    category: "Fashion",
    stock: 10,
    images: [""]
  });

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    toast.error(`Error: ${errInfo.error}`);
  }

  const fetchData = async () => {
    try {
      const pSnap = await getDocs(collection(db, "products"));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      
      const oSnap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
      setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
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

  const seedData = async () => {
    try {
      const sampleProducts = [
        { name: "Maasai Beaded Necklace", price: 2500, category: "Local Crafts", description: "Authentic handmade Maasai jewelry from Narok.", stock: 50, images: ["https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000"] },
        { name: "Sokoplus Tech Bag", price: 4500, category: "Fashion", description: "Waterproof laptop bag for the Nairobi commuter.", stock: 30, images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000"] },
        { name: "Coffee - Mount Kenya Special", price: 1200, category: "Groceries", description: "Premium medium roast coffee beans from Central Kenya.", stock: 100, images: ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2000"] },
        { name: "Bamboo Speaker", price: 3200, category: "Electronics", description: "Eco-friendly bamboo bluetooth speaker, handcrafted.", stock: 15, images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000"] }
      ];
      for (const p of sampleProducts) {
        await addDoc(collection(db, "products"), { ...p, rating: 4.8, reviewCount: 15, createdAt: new Date().toISOString() });
      }
      toast.success("Sample data seeded!");
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "products");
    }
  };

  if (!user?.isAdmin) {
    return <div className="h-[60vh] flex items-center justify-center text-2xl font-bold">Access Denied</div>;
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "products"), {
        ...newProduct,
        rating: 4.5,
        reviewCount: 0,
        createdAt: new Date().toISOString()
      });
      toast.success("Product added successfully!");
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "products");
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success("Product deleted.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: status as any } : o));
      toast.success("Order updated.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const totalSales = orders.reduce((acc, o) => acc + (o.status !== "cancelled" ? o.totalAmount : 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black tracking-tight">Admin Dashboard</h1>
           <p className="text-gray-500">Welcome back, {user.displayName}. Managing Soplus Kenya.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={seedData}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-gray-200 transition-all self-start"
          >
            Seed Sample Data
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
          >
            <Plus className="mr-2" /> Add New Product
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
           <div className="text-orange-600 bg-orange-50 w-10 h-10 rounded-xl flex items-center justify-center"><TrendingUp size={20} /></div>
           <p className="text-sm font-bold text-gray-500 uppercase">Total Sales</p>
           <p className="text-2xl font-black">KES {totalSales.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
           <div className="text-blue-600 bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center"><Package size={20} /></div>
           <p className="text-sm font-bold text-gray-500 uppercase">Total Orders</p>
           <p className="text-2xl font-black">{orders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
           <div className="text-green-600 bg-green-50 w-10 h-10 rounded-xl flex items-center justify-center"><ShoppingBag size={20} /></div>
           <p className="text-sm font-bold text-gray-500 uppercase">Unique Products</p>
           <p className="text-2xl font-black">{products.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
           <div className="text-purple-600 bg-purple-50 w-10 h-10 rounded-xl flex items-center justify-center"><Users size={20} /></div>
           <p className="text-sm font-bold text-gray-500 uppercase">Retailers</p>
           <p className="text-2xl font-black">42</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Products Table */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <h2 className="text-xl font-bold mb-6">Inventory Management</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
                  <th className="pb-4 uppercase">Product</th>
                  <th className="pb-4 uppercase">Category</th>
                  <th className="pb-4 uppercase text-right">Price</th>
                  <th className="pb-4 uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="text-sm hover:bg-gray-50/50">
                    <td className="py-4 font-bold">{p.name}</td>
                    <td className="py-4 text-gray-500">{p.category}</td>
                    <td className="py-4 text-right font-black">KES {p.price.toLocaleString()}</td>
                    <td className="py-4 text-center">
                      <button onClick={() => deleteProduct(p.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <h2 className="text-xl font-bold mb-6">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
                  <th className="pb-4 uppercase">Order ID</th>
                  <th className="pb-4 uppercase">Customer</th>
                  <th className="pb-4 uppercase">Status</th>
                  <th className="pb-4 uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id} className="text-sm hover:bg-gray-50/50">
                    <td className="py-4 font-mono text-xs text-gray-400">#{o.id.slice(0, 8)}</td>
                    <td className="py-4 text-gray-700">{o.userId.slice(0, 8)}...</td>
                    <td className="py-4">
                      <select 
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase outline-none ${
                          o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          o.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-4 text-right font-black">KES {o.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleAddProduct} className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6">
            <h2 className="text-2xl font-bold">Add New Product</h2>
            <div className="grid grid-cols-2 gap-4">
               <div className="col-span-2">
                 <label className="text-xs font-bold uppercase text-gray-400">Product Name</label>
                 <input required type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-bold uppercase text-gray-400">Category</label>
                 <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                   <option>Fashion</option>
                   <option>Electronics</option>
                   <option>Local Crafts</option>
                   <option>Groceries</option>
                 </select>
               </div>
               <div>
                 <label className="text-xs font-bold uppercase text-gray-400">Price (KES)</label>
                 <input required type="number" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
               </div>
               <div className="col-span-2">
                 <label className="text-xs font-bold uppercase text-gray-400">Description</label>
                 <textarea className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none h-24" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}></textarea>
               </div>
               <div className="col-span-2">
                 <label className="text-xs font-bold uppercase text-gray-400">Image URL</label>
                 <input type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none" value={newProduct.images[0]} onChange={e => setNewProduct({...newProduct, images: [e.target.value]})} />
               </div>
            </div>
            <div className="flex space-x-4">
              <button disabled={loading} type="submit" className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all">Add Product</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
