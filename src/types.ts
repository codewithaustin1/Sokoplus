export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  images: string[];
  stock: number;
  rating?: number;
  reviewCount?: number;
  active?: boolean;
  artisan?: string;
  buyingPrice?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  customizations?: {
    material?: string;
    color?: string;
    colorName?: string;
    notes?: string;
  };
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName: string;
  loyaltyPoints: number;
  wishlist?: string[];
  isAdmin?: boolean;
  emailVerified: boolean;
}

export interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "unpaid" | "paid";
  createdAt: any;
  paymentReference?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface SupportTicket {
  id: string;
  userId?: string;
  email: string;
  subject: "Technical Support" | "Billing/Invoices" | "Order Status" | "General Inquiry";
  message: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: any;
  updatedAt?: any;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  image?: string;
  tags?: string[];
  author?: string;
  publishedAt?: any;
  readTime?: string;
  seoTitle?: string;
  seoDescription?: string;
}


