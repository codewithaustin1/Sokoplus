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
  createdAt?: string;
  sellerId?: string;
  sellerName?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  originalProductId?: string;
  isPending?: boolean;
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
  sellerId?: string;
  sellerName?: string;
}

export interface Voucher {
  id: string;
  title: string;
  badge: string;
  description: string;
  code: string;
  icon: string;
  color: string;
  bgGradient: string;
  unlockedAt: string;
  orderId: string;
  status: "active" | "used" | "redeemed";
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
  photoURL?: string | null;
  vouchers?: Voucher[];
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
  clearedByClient?: boolean;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
  images?: string[];
  adminReply?: string;
  repliedAt?: any;
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
  replies?: { sender: "user" | "admin"; message: string; createdAt: any; senderName?: string }[];
  unreadCountClient?: number;
  unreadCountAdmin?: number;
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

export interface JobOffer {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string; // "Full-time" | "Part-time" | "Contract" | "Remote"
  description: string;
  requirements: string[];
  active?: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  resumeDetails: string; // Details of qualifications or base64 file string
  resumeName?: string; // Original name of resume
  coverLetter?: string;
  status: "pending" | "reviewed" | "shortlisted" | "rejected";
  createdAt: any;
}

export interface SellerProfile {
  uid: string;
  shopName: string;
  description: string;
  location: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
  rejectedReason?: string;
  mpesaPhone?: string;
  paystackSubaccountCode?: string;
  settlementType?: "manual" | "automatic";
  splitStatus?: "active" | "pending" | "inactive";
  paidOutAmount?: number;
  payoutHistory?: {
    id: string;
    amount: number;
    mpesaPhone: string;
    status: "pending" | "success" | "failed";
    date: string;
  }[];
}


