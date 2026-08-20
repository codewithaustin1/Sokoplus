import { Product } from "../types";

export const FALLBACK_CATALOG: Product[] = [
  {
    id: "YE7evehFmLlkFO0Nl1sw",
    name: "Upfront Handcrafted Maasai Beadwork Royal Necklace",
    price: 3800,
    originalPrice: 4800,
    category: "Local Crafts",
    subcategory: "Maasai Beadwork & Adornments",
    description: "Exquisite layered Maasai royal collar necklace handcrafted with vibrant glass seed beads and secure brass closure. Sourced directly through Upfront Retail Kenya.",
    images: [
      "https://images.unsplash.com/photo-1611591475152-47eac9806830?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=1000"
    ],
    stock: 25,
    sku: "UPF-MSI-001",
    artisan: "Upfront Retail Kenya",
    buyingPrice: 2400,
    rating: 4.9,
    reviewCount: 38,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "tCa1ICP8eGP84nWTxg6v",
    name: "Upfront Handwoven Sisal Kiondo Basket with Cowhide Straps",
    price: 3200,
    originalPrice: 3900,
    category: "Local Crafts",
    subcategory: "Handwoven Baskets & Kiondos",
    description: "Durable eco-friendly Machakos sisal tote featuring genuine full-grain leather shoulder straps. Perfect for weekend shopping and artisan home styling.",
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=1000"
    ],
    stock: 30,
    sku: "UPF-KND-002",
    artisan: "Upfront Retail Kenya",
    buyingPrice: 2000,
    rating: 4.8,
    reviewCount: 24,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "xDXg6oPcbFWJeD5SSf7O",
    name: "Upfront Premium Pure African Shea & Marula Body Butter (250ml)",
    price: 1850,
    originalPrice: 2400,
    category: "Beauty & Personal Care (Skincare, Haircare, Cosmetics)",
    subcategory: "Body Butters, Lotions & Moisturizers",
    description: "Unrefined cold-pressed shea butter infused with wild-harvested Kenyan Marula oil and calming lavender essentials. Deeply hydrating for all skin types.",
    images: [
      "https://images.unsplash.com/photo-1608248597359-5937d5843477?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=1000"
    ],
    stock: 45,
    sku: "UPF-BEA-003",
    artisan: "Upfront Retail Kenya",
    buyingPrice: 1100,
    rating: 5.0,
    reviewCount: 41,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "maasai-beaded-necklace",
    name: "Maasai Beaded Necklace",
    price: 2500,
    originalPrice: 3200,
    category: "Local Crafts",
    subcategory: "Maasai Beadwork & Adornments",
    description: "Authentic handmade Maasai jewelry from Narok. Crafted with durable nylon threading and high-grade glass beads.",
    stock: 50,
    images: ["https://images.unsplash.com/photo-1629196914068-3974bcda318b?auto=format&fit=crop&q=80&w=2000"],
    artisan: "Mama Stacey of Narok Maasai Crafts",
    sku: "SKU-MSI-101",
    rating: 4.8,
    reviewCount: 15,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "sokoplus-tech-bag",
    name: "Sokoplus Tech Bag",
    price: 4500,
    originalPrice: 5500,
    category: "Fashion",
    subcategory: "Bags, Backpacks & Wallets",
    description: "Waterproof laptop bag for the Nairobi commuter with padded 15.6 inch laptop compartment and USB pass-through.",
    stock: 30,
    images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000"],
    artisan: "Kariobangi Leather Artisans",
    sku: "SKU-BAG-202",
    rating: 4.7,
    reviewCount: 22,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "bamboo-speaker",
    name: "Bamboo Speaker",
    price: 3200,
    originalPrice: 4000,
    category: "Electronics",
    subcategory: "Audio & Accessories (Headphones, Speakers, Cables)",
    description: "Eco-friendly bamboo bluetooth speaker, handcrafted with rich bass acoustics and 12-hour rechargeable battery.",
    stock: 15,
    images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&q=80&w=2000"],
    artisan: "Mombasa Sustainable Woodworks",
    sku: "SKU-SPK-303",
    rating: 4.6,
    reviewCount: 8,
    active: true,
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  }
];

export function findFallbackProduct(queryIdOrSku: string): Product | null {
  if (!queryIdOrSku) return null;
  const clean = queryIdOrSku.trim().toLowerCase();
  
  // Strict matching: Match exact document ID, exact SKU, or exact slug only.
  // Avoid loose partial substring matching to prevent new products from being mislabeled.
  return (
    FALLBACK_CATALOG.find(p => {
      if (p.id.toLowerCase() === clean) return true;
      if (p.sku && p.sku.toLowerCase() === clean) return true;
      const exactSlug = p.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return exactSlug === clean;
    }) || null
  );
}
