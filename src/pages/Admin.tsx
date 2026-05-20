import { useState, useEffect } from "react";
import { UserProfile, Product, Order, SupportTicket, BlogPost } from "../types";
import { db, auth } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Package,
  TrendingUp,
  Users,
  ShoppingBag,
  Search,
  Pencil,
  Inbox,
  CheckCircle2,
  Clock,
  MessageSquare,
  BookOpen,
  FileText,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface AdminProps {
  user: UserProfile | null;
}

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  toast.error(`Error: ${errInfo.error}`);
}

export default function Admin({ user }: AdminProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [activeTab, setActiveTab] = useState<
    "inventory" | "orders" | "inbox" | "blogs"
  >("inventory");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [blogSearchTerm, setBlogSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showBlogAddModal, setShowBlogAddModal] = useState(false);
  const [showBlogEditModal, setShowBlogEditModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    category: "Fashion",
    stock: 10,
    images: [""],
  });

  const [newBlog, setNewBlog] = useState({
    title: "",
    content: "",
    image: "",
    tagsString: "Artisans, Impact",
    author: "Sokoplus Team",
    readTime: "5 min read",
  });

  const fetchData = async () => {
    try {
      const pSnap = await getDocs(collection(db, "products"));
      setProducts(
        pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product),
      );

      const oSnap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc")),
      );
      setOrders(oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any));

      const tSnap = await getDocs(
        query(collection(db, "support_tickets"), orderBy("createdAt", "desc")),
      );
      setTickets(
        tSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket),
      );

      try {
        const bSnap = await getDocs(collection(db, "blog"));
        setBlogs(
          bSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || "",
              content: data.content || "",
              image: data.image || "",
              tags: data.tags || [],
              author: data.author || "Sokoplus Team",
              readTime: data.readTime || "4 min read",
              publishedAt: data.publishedAt,
            } as BlogPost;
          }),
        );
      } catch (blogErr) {
        console.warn(
          "Could not fetch blogs, using empty state or fallbacks",
          blogErr,
        );
      }
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
        {
          name: "Maasai Beaded Necklace",
          price: 2500,
          category: "Local Crafts",
          description: "Authentic handmade Maasai jewelry from Narok.",
          stock: 50,
          images: [
            "https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000",
          ],
        },
        {
          name: "Sokoplus Tech Bag",
          price: 4500,
          category: "Fashion",
          description: "Waterproof laptop bag for the Nairobi commuter.",
          stock: 30,
          images: [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
          ],
        },
        {
          name: "Coffee - Mount Kenya Special",
          price: 1200,
          category: "Groceries",
          description: "Premium medium roast coffee beans from Central Kenya.",
          stock: 100,
          images: [
            "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2000",
          ],
        },
        {
          name: "Bamboo Speaker",
          price: 3200,
          category: "Electronics",
          description: "Eco-friendly bamboo bluetooth speaker, handcrafted.",
          stock: 15,
          images: [
            "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000",
          ],
        },
      ];
      for (const p of sampleProducts) {
        await addDoc(collection(db, "products"), {
          ...p,
          rating: 4.8,
          reviewCount: 15,
          createdAt: new Date().toISOString(),
        });
      }
      toast.success("Sample data seeded!");
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, "products");
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-2xl font-bold">
        Access Denied
      </div>
    );
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!newProduct.name.trim()) {
      newErrors.name = "Product name is required";
    }
    if (newProduct.price <= 0) {
      newErrors.price = "Price must be greater than zero";
    }
    if (newProduct.stock < 0) {
      newErrors.stock = "Stock cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const sanitizedImages = newProduct.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      await addDoc(collection(db, "products"), {
        ...newProduct,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
        rating: 4.5,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      });
      toast.success("Product added successfully!");
      setShowAddModal(false);
      setNewProduct({
        name: "",
        description: "",
        price: 0,
        category: "Fashion",
        stock: 10,
        images: [""],
      });
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "products");
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!id) {
      toast.error("This product has no valid ID.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`"${name}" has been deleted.`);
    } catch (error: any) {
      console.error("Delete error:", error);
      if (error.code === "permission-denied") {
        toast.error(
          "Access denied. You don't have permission to delete this product.",
        );
      } else {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const newErrors: { [key: string]: string } = {};
    if (!editingProduct.name.trim())
      newErrors.name = "Product name is required";
    if (editingProduct.price <= 0)
      newErrors.price = "Price must be greater than zero";
    if (editingProduct.stock < 0) newErrors.stock = "Stock cannot be negative";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingProduct;
      const sanitizedImages = updateData.images.filter(
        (url) => !!url && url.trim() !== "",
      );
      await updateDoc(doc(db, "products", id), {
        ...updateData,
        images: sanitizedImages.length > 0 ? sanitizedImages : [],
      });
      toast.success("Product updated successfully!");
      setShowEditModal(false);
      setEditingProduct(null);
      setErrors({});
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `products/${editingProduct.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      await updateDoc(doc(db, "orders", orderId), { status });
      setOrders(
        orders.map((o) =>
          o.id === orderId ? { ...o, status: status as any } : o,
        ),
      );
      toast.success("Order updated.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicket["status"],
  ) => {
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status,
        updatedAt: new Date().toISOString(),
      });
      setTickets(
        tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );
      toast.success("Ticket status updated.");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `support_tickets/${ticketId}`,
      );
    }
  };

  const applyFormatting = (
    type:
      | "bold"
      | "italic"
      | "header"
      | "subheader"
      | "list"
      | "numlist"
      | "quote"
      | "link",
    target: "new" | "edit",
  ) => {
    const elementId =
      target === "new" ? "new-blog-content" : "edit-blog-content";
    const textarea = document.getElementById(
      elementId,
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = "";
    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        break;
      case "header":
        replacement = `\n## ${selectedText || "Heading"}\n`;
        break;
      case "subheader":
        replacement = `\n### ${selectedText || "Subheading"}\n`;
        break;
      case "list":
        replacement = `\n- ${selectedText || "List item"}\n`;
        break;
      case "numlist":
        replacement = `\n1. ${selectedText || "List item"}\n`;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "Quote"}\n`;
        break;
      case "link":
        replacement = `[${selectedText || "Link text"}](https://example.com)`;
        break;
    }

    const newContent =
      text.substring(0, start) + replacement + text.substring(end);

    if (target === "new") {
      setNewBlog({ ...newBlog, content: newContent });
    } else if (editingBlog) {
      setEditingBlog({ ...editingBlog, content: newContent });
    }

    // Refocus and select the new text after state update
    setTimeout(() => {
      textarea.focus();
      const selectionOffset = replacement.length - selectedText.length;
      textarea.setSelectionRange(start, end + selectionOffset);
    }, 50);
  };

  const handleAddBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlog.title.trim()) {
      toast.error("Blog title is required.");
      return;
    }
    if (!newBlog.content.trim()) {
      toast.error("Blog content is required.");
      return;
    }

    setLoading(true);
    try {
      const parsedTags = newBlog.tagsString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await addDoc(collection(db, "blog"), {
        title: newBlog.title,
        content: newBlog.content,
        image:
          newBlog.image ||
          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
        tags: parsedTags,
        author: newBlog.author || "Sokoplus Team",
        readTime: newBlog.readTime || "5 min read",
        publishedAt: new Date().toISOString(),
      });

      toast.success("Blog post created successfully!");
      setShowBlogAddModal(false);
      setNewBlog({
        title: "",
        content: "",
        image: "",
        tagsString: "Artisans, Impact",
        author: "Sokoplus Team",
        readTime: "5 min read",
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "blog");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingBlog ||
      !editingBlog.title.trim() ||
      !editingBlog.content.trim()
    ) {
      toast.error("Title and content are required.");
      return;
    }

    setLoading(true);
    try {
      const { id, ...updateData } = editingBlog;
      await updateDoc(doc(db, "blog", id), {
        ...updateData,
      });
      toast.success("Blog post updated successfully!");
      setShowBlogEditModal(false);
      setEditingBlog(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `blog/${editingBlog.id}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteBlog = async (id: string, title: string) => {
    if (!id) {
      toast.error("Could not find a valid blog ID.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "blog", id));
      setBlogs((prev) => prev.filter((b) => b.id !== id));
      toast.success(`Blog post "${title}" has been deleted.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `blog/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = orders.reduce(
    (acc, o) =>
      acc +
      (o.status !== "cancelled" && o.paymentStatus === "paid"
        ? o.totalAmount
        : 0),
    0,
  );

  const filteredOrders = orders.filter(
    (o) =>
      (o.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
        o.userId.toLowerCase().includes(orderSearchTerm.toLowerCase())) &&
      (orderStatusFilter === "all" || o.status === orderStatusFilter),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-gray-500">
            Welcome back, {user.displayName}. Managing Soplus Kenya.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={seedData}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-gray-200 transition-all self-start"
          >
            Seed Sample Data
          </button>
          {activeTab === "blogs" ? (
            <button
              onClick={() => setShowBlogAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Create Blog Post
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center shadow-lg hover:bg-orange-700 transition-all self-start"
            >
              <Plus className="mr-2" /> Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-orange-600 bg-orange-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Total Sales
          </p>
          <p className="text-2xl font-black">
            KES {totalSales.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-blue-600 bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <Package size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Total Orders
          </p>
          <p className="text-2xl font-black">{orders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-green-600 bg-green-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Unique Products
          </p>
          <p className="text-2xl font-black">{products.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
          <div className="text-purple-600 bg-purple-50 w-10 h-10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} />
          </div>
          <p className="text-sm font-bold text-gray-500 uppercase">
            Blog Stories
          </p>
          <p className="text-2xl font-black">{blogs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "inventory" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "orders" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "inbox" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Inbox{" "}
          {tickets.filter((t) => t.status === "open").length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tickets.filter((t) => t.status === "open").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("blogs")}
          className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === "blogs" ? "bg-white shadow-sm text-orange-600" : "text-gray-500 hover:bg-gray-200"}`}
        >
          Blog Manager
        </button>
      </div>

      <div>
        {activeTab === "inventory" && (
          /* Products Table */
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <h2 className="text-xl font-bold mb-6">Inventory Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-gray-400 border-b border-gray-50">
                    <th className="pb-4 uppercase">Product</th>
                    <th className="pb-4 uppercase">Category</th>
                    <th className="pb-4 uppercase text-center">Stock</th>
                    <th className="pb-4 uppercase text-right">Price</th>
                    <th className="pb-4 uppercase text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p) => (
                    <tr key={p.id} className="text-sm hover:bg-gray-50/50">
                      <td className="py-4 font-bold">{p.name}</td>
                      <td className="py-4 text-gray-500">{p.category}</td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            className="w-16 bg-gray-50 border border-gray-100 rounded-lg text-center font-bold outline-none focus:ring-1 focus:ring-orange-600 transition-all py-1"
                            value={p.stock}
                            onChange={async (e) => {
                              const newStock = Number(e.target.value);
                              try {
                                await updateDoc(doc(db, "products", p.id), {
                                  stock: newStock,
                                });
                                setProducts((prev) =>
                                  prev.map((prod) =>
                                    prod.id === p.id
                                      ? { ...prod, stock: newStock }
                                      : prod,
                                  ),
                                );
                              } catch (error) {
                                handleFirestoreError(
                                  error,
                                  OperationType.UPDATE,
                                  `products/${p.id}`,
                                );
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-4 text-right font-black">
                        KES {p.price.toLocaleString()}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setShowEditModal(true);
                            }}
                            className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Product"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id, p.name)}
                            className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          /* Orders Table */
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold">Recent Orders</h2>
              <div className="flex flex-wrap items-center gap-4">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-1 focus:ring-orange-600 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div className="relative group flex-grow max-w-xs">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search ID or Customer..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                  />
                </div>
              </div>
            </div>
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
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="text-sm hover:bg-gray-50/50">
                        <td className="py-4 font-mono text-xs text-gray-400">
                          #{o.id.slice(0, 8)}
                        </td>
                        <td className="py-4 text-gray-700">
                          {o.userEmail || o.userId.slice(0, 8)}
                        </td>
                        <td className="py-4">
                          <select
                            value={o.status}
                            onChange={(e) =>
                              updateOrderStatus(o.id, e.target.value)
                            }
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-gray-500 font-medium"
                      >
                        No orders found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "inbox" && (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl overflow-hidden min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold flex items-center">
                <Inbox className="mr-2 text-orange-600" /> Support Inbox
              </h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {tickets.length} Total Tickets
              </p>
            </div>

            {tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={`p-6 rounded-3xl border transition-all ${t.status === "resolved" || t.status === "closed" ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-orange-100 shadow-sm"}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-3 rounded-2xl ${
                            t.subject === "Technical Support"
                              ? "bg-red-50 text-red-600"
                              : t.subject === "Billing/Invoices"
                                ? "bg-green-50 text-green-600"
                                : t.subject === "Order Status"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{t.subject}</h4>
                          <p className="text-sm text-gray-500">
                            From:{" "}
                            <span className="font-medium text-gray-900">
                              {t.email}
                            </span>
                          </p>
                        </div>
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) =>
                          updateTicketStatus(
                            t.id,
                            e.target.value as SupportTicket["status"],
                          )
                        }
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase outline-none cursor-pointer border-none shadow-sm ${
                          t.status === "resolved"
                            ? "bg-green-600 text-white"
                            : t.status === "open"
                              ? "bg-orange-100 text-orange-700"
                              : t.status === "in-progress"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-400 text-white"
                        }`}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-gray-700 whitespace-pre-wrap text-sm leading-relaxed border border-gray-100">
                      {t.message}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {t.createdAt?.toDate
                          ? t.createdAt.toDate().toLocaleString()
                          : String(t.createdAt)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateTicketStatus(t.id, "resolved")}
                          className="flex items-center text-green-600 hover:text-green-700 transition-colors"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Mark
                          Resolved
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="bg-gray-50 p-6 rounded-full">
                  <Inbox size={48} />
                </div>
                <p className="font-bold uppercase tracking-widest text-xs">
                  No support tickets found
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "blogs" && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center text-gray-950">
                <BookOpen className="mr-2 text-orange-600" /> Blog Stories &
                Articles
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create, edit, and keep Kenyan artisan stories updated.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group flex-grow max-w-xs sm:w-64 font-sans text-gray-950">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search blogs by title..."
                  value={blogSearchTerm}
                  onChange={(e) => setBlogSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all text-sm"
                />
              </div>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-2xl flex items-center shadow-md transition-all shrink-0"
                title="Create Blog Post"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {blogs.filter((b) =>
            b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
          ).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs
                .filter((b) =>
                  b.title.toLowerCase().includes(blogSearchTerm.toLowerCase()),
                )
                .map((blog) => (
                  <div
                    key={blog.id}
                    className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full group text-gray-950"
                  >
                    <div className="relative h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={
                          blog.image ||
                          "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop"
                        }
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingBlog({
                              ...blog,
                              tags: blog.tags || [],
                            });
                            setShowBlogEditModal(true);
                          }}
                          className="p-2.5 bg-white/95 text-blue-600 rounded-xl hover:bg-white shadow-md hover:text-blue-700 transition-all"
                          title="Edit Blog"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => deleteBlog(blog.id, blog.title)}
                          className="p-2.5 bg-white/95 text-red-600 rounded-xl hover:bg-white shadow-md hover:text-red-700 transition-all"
                          title="Delete Blog"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-grow space-y-4">
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>By {blog.author || "Sokoplus Team"}</span>
                        <span>•</span>
                        <span>{blog.readTime || "5 min read"}</span>
                      </div>
                      <h3 className="font-bold text-gray-950 text-base leading-tight group-hover:text-orange-600 transition-all line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed flex-grow">
                        {blog.content}
                      </p>
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 font-sans">
                          {blog.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-extrabold tracking-tight bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md uppercase"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <div className="inline-flex p-4 rounded-full bg-orange-50 text-orange-600 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Articles Found
              </h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                None of your artisan stories or news articles match the current
                filter search.
              </p>
              <button
                onClick={() => setShowBlogAddModal(true)}
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-2.5 rounded-2xl text-sm transition-all shadow-sm"
              >
                Create Your First Article
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 invisible hidden">
        {/* Old Tables Removed for Tabbed View */}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleAddProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-bold">Add New Product</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.name}
                  onChange={(e) => {
                    setNewProduct({ ...newProduct, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Groceries</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Price (KES)
                </label>
                <input
                  required
                  type="number"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.price}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={newProduct.stock}
                  onChange={(e) => {
                    setNewProduct({
                      ...newProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Description
                </label>
                <textarea
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none h-24"
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      description: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-gray-400">
                    Product Images (URLs)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewProduct({
                        ...newProduct,
                        images: [...newProduct.images, ""],
                      })
                    }
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    + Add Another Image
                  </button>
                </div>
                <div className="space-y-3">
                  {newProduct.images.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600"
                        value={url}
                        onChange={(e) => {
                          const updatedImages = [...newProduct.images];
                          updatedImages[idx] = e.target.value;
                          setNewProduct({
                            ...newProduct,
                            images: updatedImages,
                          });
                        }}
                      />
                      {newProduct.images.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updatedImages = newProduct.images.filter(
                              (_, i) => i !== idx,
                            );
                            setNewProduct({
                              ...newProduct,
                              images: updatedImages,
                            });
                          }}
                          className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateProduct}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-bold">Edit Product</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Product Name
                </label>
                <input
                  required
                  type="text"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.name}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                    });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Category
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none"
                  value={editingProduct.category}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value,
                    })
                  }
                >
                  <option>Fashion</option>
                  <option>Electronics</option>
                  <option>Local Crafts</option>
                  <option>Groceries</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Price (KES)
                </label>
                <input
                  required
                  type="number"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.price ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.price}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      price: Number(e.target.value),
                    });
                    if (errors.price) setErrors({ ...errors, price: "" });
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  className={`w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-1 transition-all ${errors.stock ? "border-red-500 focus:ring-red-500" : "border-gray-100 focus:ring-orange-600"}`}
                  value={editingProduct.stock}
                  onChange={(e) => {
                    setEditingProduct({
                      ...editingProduct,
                      stock: Number(e.target.value),
                    });
                    if (errors.stock) setErrors({ ...errors, stock: "" });
                  }}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.stock}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Description
                </label>
                <textarea
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none h-24"
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-gray-400">
                    Product Images (URLs)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingProduct({
                        ...editingProduct,
                        images: [...editingProduct.images, ""],
                      })
                    }
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    + Add Another Image
                  </button>
                </div>
                <div className="space-y-3">
                  {editingProduct.images.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600"
                        value={url}
                        onChange={(e) => {
                          const updatedImages = [...editingProduct.images];
                          updatedImages[idx] = e.target.value;
                          setEditingProduct({
                            ...editingProduct,
                            images: updatedImages,
                          });
                        }}
                      />
                      {editingProduct.images.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updatedImages = editingProduct.images.filter(
                              (_, i) => i !== idx,
                            );
                            setEditingProduct({
                              ...editingProduct,
                              images: updatedImages,
                            });
                          }}
                          className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Product
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Blog Post Modal */}
      {showBlogAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleAddBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-bold text-gray-950">
              Create New Article
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  placeholder="e.g. Empowering Rural Artisans through Soplus"
                  value={newBlog.title}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.author}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.readTime}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={newBlog.image}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={newBlog.tagsString}
                  onChange={(e) =>
                    setNewBlog({ ...newBlog, tagsString: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden mt-1 focus-within:ring-1 focus-within:ring-orange-600 focus-within:border-transparent transition-all">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => applyFormatting("bold", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-650 hover:text-gray-905 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Bold"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("italic", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-650 hover:text-gray-905 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Italic"
                    >
                      <Italic size={15} />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("header", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center font-bold text-[11px] gap-0.5 text-gray-600 hover:text-gray-900"
                      title="Heading 2"
                    >
                      <Heading size={14} />
                      <span>H2</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("subheader", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center font-bold text-[11px] gap-0.5 text-gray-600 hover:text-gray-900"
                      title="Heading 3"
                    >
                      <Heading size={14} />
                      <span>H3</span>
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("list", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Bullet List"
                    >
                      <List size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("numlist", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Ordered List"
                    >
                      <ListOrdered size={15} />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("quote", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Blockquote"
                    >
                      <Quote size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("link", "new")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Insert Link"
                    >
                      <Link size={15} />
                    </button>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono pr-2">Format Help</span>
                  </div>
                  {/* Input */}
                  <textarea
                    id="new-blog-content"
                    required
                    placeholder="Write your beautiful artisan storytelling article here..."
                    className="w-full p-4 bg-white text-gray-950 outline-none h-44 border-0 focus:ring-0 resize-y"
                    value={newBlog.content}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, content: e.target.value })
                    }
                  ></textarea>
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-orange-600 text-white font-bold py-4 rounded-2xl hover:bg-orange-700 transition-all"
              >
                Create Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogAddModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Blog Post Modal */}
      {showBlogEditModal && editingBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleUpdateBlog}
            className="bg-white w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-bold text-gray-950">Edit Article</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Article Title
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.title}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Author
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.author || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, author: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">
                  Read Estimate
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.readTime || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, readTime: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                  value={editingBlog.image || ""}
                  onChange={(e) =>
                    setEditingBlog({ ...editingBlog, image: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Categories / Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Artisans, Growth, Impact"
                  className="w-full p-4 bg-gray-50 border border-gray-100 text-gray-950 rounded-2xl outline-none focus:ring-1 focus:ring-orange-600 transition-all font-medium"
                  value={editingBlog.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase text-gray-400">
                  Content / Story Message
                </label>
                <div className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden mt-1 focus-within:ring-1 focus-within:ring-orange-600 focus-within:border-transparent transition-all">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => applyFormatting("bold", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-650 hover:text-gray-905 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Bold"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("italic", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-650 hover:text-gray-905 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Italic"
                    >
                      <Italic size={15} />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("header", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center font-bold text-[11px] gap-0.5 text-gray-600 hover:text-gray-900"
                      title="Heading 2"
                    >
                      <Heading size={14} />
                      <span>H2</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("subheader", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center font-bold text-[11px] gap-0.5 text-gray-600 hover:text-gray-900"
                      title="Heading 3"
                    >
                      <Heading size={14} />
                      <span>H3</span>
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("list", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Unordered List"
                    >
                      <List size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("numlist", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Ordered List"
                    >
                      <ListOrdered size={15} />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => applyFormatting("quote", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Blockquote"
                    >
                      <Quote size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting("link", "edit")}
                      className="p-1.5 hover:bg-gray-200 text-gray-655 hover:text-gray-955 rounded-lg transition-colors flex items-center justify-center text-gray-600 hover:text-gray-900"
                      title="Insert Link"
                    >
                      <Link size={15} />
                    </button>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono pr-2">Format Help</span>
                  </div>
                  {/* Input */}
                  <textarea
                    id="edit-blog-content"
                    required
                    className="w-full p-4 bg-white text-gray-950 outline-none h-44 border-0 focus:ring-0 resize-y"
                    value={editingBlog.content}
                    onChange={(e) =>
                      setEditingBlog({
                        ...editingBlog,
                        content: e.target.value,
                      })
                    }
                  ></textarea>
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                disabled={loading}
                type="submit"
                className="flex-grow bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all"
              >
                Update Post
              </button>
              <button
                type="button"
                onClick={() => setShowBlogEditModal(false)}
                className="px-6 py-4 border border-gray-100 font-bold rounded-2xl hover:bg-gray-50 text-gray-750"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
