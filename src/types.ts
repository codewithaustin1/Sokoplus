export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  stock: number;
  rating?: number;
  reviewCount?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  loyaltyPoints: number;
  wishlist?: string[];
  isAdmin?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
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
