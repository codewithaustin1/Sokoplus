export type ProductCondition = "NEW" | "REFURBISHED" | "OPEN_BOX" | "USED" | "FOR_PARTS";

export interface Product {
  id: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  condition?: ProductCondition;
  images: string[];
  stock: number;
  isDigital?: boolean;
  digitalFormat?: "pdf" | "video" | "audio" | "zip" | "ebook" | "software" | "other";
  digitalFileUrl?: string;
  digitalFileSize?: string;
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
  availableColors?: string[];
  availableSizes?: string[];
  availableMaterials?: { name: string; priceDelta?: number }[];
  allowEngraving?: boolean;
  engravingMaxChars?: number;
  variantMatrix?: {
    size?: string;
    color?: string;
    material?: string;
    stock: number;
    priceDelta?: number;
  }[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  isDigital?: boolean;
  digitalFormat?: "pdf" | "video" | "audio" | "zip" | "ebook" | "software" | "other";
  digitalFileUrl?: string;
  customizations?: {
    size?: string;
    material?: string;
    color?: string;
    colorName?: string;
    engravingText?: string;
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
  type?: string;
  discount?: number;
  minSpend?: number;
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
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt?: string;
  deliveryCountry?: string;
  deliveryCounty?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
}

export interface RefundItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  restocked: boolean;
}

export interface RefundRecord {
  id: string;
  amount: number;
  reason: string;
  customerNote?: string;
  items: RefundItem[];
  createdAt: string;
  processedBy?: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail?: string;
  customerName?: string;
  isGuestOrder?: boolean;
  guestSessionToken?: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "partially_refunded" | "refunded";
  paymentStatus: "unpaid" | "paid";
  createdAt: any;
  paymentReference?: string;
  clearedByClient?: boolean;
  refundedAmount?: number;
  refunds?: RefundRecord[];
  customerNotes?: { note: string; createdAt: string; author: string }[];
  shippingAddress?: any;
  shippingFee?: number;
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

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  stock: number;
  threshold: number;
  category?: string;
  artisan?: string;
  status: "unread" | "resolved" | "dismissed";
  createdAt: any;
  updatedAt?: any;
}

export interface DataErasureRequest {
  id: string;
  userId: string;
  userEmail: string;
  displayName?: string;
  requestDate: any;
  statutoryDeadline: any; // statutory 30-day compliance deadline
  status: "pending" | "processing" | "completed" | "rejected";
  erasureType: "full_deletion" | "anonymize_for_audit";
  reason?: string;
  processedAt?: any;
  processedBy?: string;
  rejectionReason?: string;
  auditMetrics?: {
    usersScrubbed: number;
    ordersAnonymized: number;
    ticketsScrubbed: number;
    reviewsScrubbed: number;
    notificationsDeleted: number;
    commentsScrubbed: number;
    jobAppsScrubbed: number;
  };
}


