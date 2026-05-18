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
  isAdmin?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: any;
  paymentReference?: string;
}
