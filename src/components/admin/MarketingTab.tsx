import React, { memo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { addDoc, collection, doc, updateDoc, getDocs, query, limit } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../../lib/firebase";

interface MarketingTabProps {
  campaigns: any[];
  campaignTitle: string;
  setCampaignTitle: (val: string) => void;
  campaignMessage: string;
  setCampaignMessage: (val: string) => void;
  campaignChannel: string;
  setCampaignChannel: (val: string) => void;
  campaignTargetType: string;
  setCampaignTargetType: (val: string) => void;
  campaignProductId: string;
  setCampaignProductId: (val: string) => void;
  campaignCategory: string;
  setCampaignCategory: (val: string) => void;
  isCreatingCampaign: boolean;
  setIsCreatingCampaign: (val: boolean) => void;
  user: any;
  products: any[];
  fetchData: () => Promise<void>;
  handleStartEditCampaign: (camp: any) => void;
  handleDeleteCampaign: (id: string) => void;
}

export const MarketingTab: React.FC<MarketingTabProps> = memo(({
  campaigns,
  campaignTitle,
  setCampaignTitle,
  campaignMessage,
  setCampaignMessage,
  campaignChannel,
  setCampaignChannel,
  campaignTargetType,
  setCampaignTargetType,
  campaignProductId,
  setCampaignProductId,
  campaignCategory,
  setCampaignCategory,
  isCreatingCampaign,
  setIsCreatingCampaign,
  user,
  products,
  fetchData,
  handleStartEditCampaign,
  handleDeleteCampaign,
}) => {
  return (
    <div className="space-y-8 animate-fade-in text-gray-950 font-sans">
      {/* Header & Stats Banner */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100/50">
              CRM Marketing Automation
            </span>
            <h1 className="text-3xl font-black text-gray-950 tracking-tight mt-3">
              Targeted Marketing Campaigns
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Send high-conversion, behavior-triggered push alerts and email newsletters based on cart contents or wishlists.
            </p>
          </div>
        </div>

        {/* Micro Stats Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Campaigns</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{campaigns.length}</p>
          </div>
          <div className="p-5 bg-green-50/50 rounded-2xl border border-green-100/30">
            <p className="text-xs font-bold text-green-700/70 uppercase tracking-wider">Completed Sends</p>
            <p className="text-2xl font-black text-green-700 mt-1">
              {campaigns.filter((c) => c.status === "completed").length}
            </p>
          </div>
          <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/30">
            <p className="text-xs font-bold text-blue-700/70 uppercase tracking-wider">Processing / Pending</p>
            <p className="text-2xl font-black text-blue-700 mt-1">
              {campaigns.filter((c) => c.status === "processing" || c.status === "pending").length}
            </p>
          </div>
          <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100/30">
            <p className="text-xs font-bold text-orange-700/70 uppercase tracking-wider">Recipients Reached</p>
            <p className="text-2xl font-black text-orange-700 mt-1">
              {campaigns.reduce((acc, curr) => acc + (curr.sentCount || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Create Campaign Form */}
        <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-black text-gray-950 tracking-tight">Create Campaign</h2>
            <p className="text-xs text-gray-400 mt-1 font-semibold">Define your audience, message details and launch instantly.</p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!campaignTitle.trim() || !campaignMessage.trim()) {
                toast.error("Please provide both a campaign title and content body message.");
                return;
              }

              setIsCreatingCampaign(true);
              try {
                // Create Firestore document
                const campaignPayload = {
                  title: campaignTitle,
                  message: campaignMessage,
                  channel: campaignChannel,
                  status: "pending",
                  targetCriteria: {
                    type: campaignTargetType,
                    productId: campaignProductId || null,
                    category: campaignCategory || null
                  },
                  createdAt: new Date().toISOString(),
                  createdBy: user?.email || "Admin"
                };

                const docRef = await addDoc(collection(db, "marketing_campaigns"), campaignPayload);
                toast.success("Marketing campaign registered. Launching background engine...");

                // Trigger the express endpoint immediately for instant dev execution & feedback
                const response = await fetch("/api/admin/marketing/trigger", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ campaignId: docRef.id })
                });

                if (response.ok) {
                  const resData = await response.json();
                  if (resData.bypassToClient) {
                    toast("Sandbox developer environment detected. Executing targeting algorithm in secure browser context...", {
                      icon: "ℹ️"
                    });
                    
                    // Fetch all users & carts client-side with full admin entitlements
                    const [usersSnap, cartsSnap] = await Promise.all([
                      getDocs(query(collection(db, "users"), limit(100))),
                      getDocs(query(collection(db, "carts"), limit(100)))
                    ]);
                    
                    const allUsers: any[] = [];
                    usersSnap.forEach((d) => {
                      const data = d.data();
                      allUsers.push({
                        uid: d.id,
                        email: data.email || null,
                        displayName: data.displayName || "Valued Customer",
                        wishlist: data.wishlist || []
                      });
                    });
                    
                    const allCarts: any[] = [];
                    cartsSnap.forEach((d) => {
                      const data = d.data();
                      allCarts.push({
                        userId: d.id,
                        email: data.email || null,
                        items: data.items || []
                      });
                    });
                    
                    const criteriaType = campaignTargetType;
                    let targetUsers: any[] = [];
                    
                    if (criteriaType === "all") {
                      targetUsers = allUsers.filter((u) => u.email);
                    } else if (criteriaType === "wishlist_nonempty") {
                      targetUsers = allUsers.filter((u) => u.email && u.wishlist && u.wishlist.length > 0);
                    } else if (criteriaType === "wishlist_product") {
                      targetUsers = allUsers.filter((u) => u.email && u.wishlist && u.wishlist.includes(campaignProductId));
                    } else if (criteriaType === "wishlist_category") {
                      const productIdsInCategory = products
                        .filter((p) => p.category === campaignCategory)
                        .map((p) => p.id);
                      targetUsers = allUsers.filter((u) => 
                        u.email && 
                        u.wishlist && 
                        u.wishlist.some((pId: string) => productIdsInCategory.includes(pId))
                      );
                    } else if (criteriaType === "cart_nonempty") {
                      const userIdsWithCartsSet = new Set(allCarts.filter((c) => c.items && c.items.length > 0).map((c) => c.userId));
                      targetUsers = allUsers.filter((u) => u.email && userIdsWithCartsSet.has(u.uid));
                    } else if (criteriaType === "cart_product") {
                      const userIdsWithCartProdSet = new Set(
                        allCarts.filter((c) => c.items && c.items.some((item: any) => item.productId === campaignProductId)).map((c) => c.userId)
                      );
                      targetUsers = allUsers.filter((u) => u.email && userIdsWithCartProdSet.has(u.uid));
                    } else if (criteriaType === "cart_category") {
                      const productIdsInCategory = new Set(
                        products.filter((p) => p.category === campaignCategory).map((p) => p.id)
                      );
                      const userIdsWithCartCatSet = new Set(
                        allCarts.filter((c) => c.items && c.items.some((item: any) => productIdsInCategory.has(item.productId))).map((c) => c.userId)
                      );
                      targetUsers = allUsers.filter((u) => u.email && userIdsWithCartCatSet.has(u.uid));
                    }
                    
                    let sendCount = 0;
                    const deliveryPromises: Promise<any>[] = [];
                    
                    for (const targetUser of targetUsers) {
                      if (campaignChannel === "email" || campaignChannel === "both") {
                        sendCount++;
                      }
                      if (campaignChannel === "push" || campaignChannel === "both") {
                        const notifPromise = addDoc(collection(db, "users", targetUser.uid, "notifications"), {
                          title: campaignTitle,
                          body: campaignMessage,
                          read: false,
                          createdAt: new Date().toISOString(),
                          campaignId: docRef.id,
                          type: "marketing"
                        }).then(() => {
                          if (campaignChannel === "push") {
                            sendCount++;
                          }
                        }).catch((err) => {
                          console.error("Push notify error inside client fallback", err);
                        });
                        deliveryPromises.push(notifPromise);
                      }
                    }
                    
                    await Promise.all(deliveryPromises);
                    
                    // Complete campaign document on client side
                    await updateDoc(doc(db, "marketing_campaigns", docRef.id), {
                      status: "completed",
                      sentCount: sendCount,
                      completedAt: new Date().toISOString()
                    });
                    
                    toast.success(`Development Sandbox Broadcast Success! Dispatched notifications & simulated emails. Targeted: ${targetUsers.length}.`, {
                      icon: "🚀",
                      duration: 6000
                    });
                  } else {
                    toast.success(`Success! Campaign launched. Targeted ${resData.targetedCount} recipients.`, {
                      icon: "🚀",
                      duration: 6000
                    });
                  }
                } else {
                  console.warn("Express direct engine trigger bypassed or failed, waiting for Cloud Function execution.");
                }

                // Reset form and refresh list
                setCampaignTitle("");
                setCampaignMessage("");
                setCampaignTargetType("all");
                setCampaignProductId("");
                setCampaignCategory("");
                
                // Refresh data
                await fetchData();

              } catch (err: any) {
                toast.error(`Error launching campaign: ${err.message || err}`);
                console.error(err);
              } finally {
                setIsCreatingCampaign(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Campaign Title</label>
              <input
                type="text"
                required
                placeholder="e.g. 20% off all artisan craft sculptures!"
                className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-950"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Delivery Channel</label>
                <select
                  className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                  value={campaignChannel}
                  onChange={(e: any) => setCampaignChannel(e.target.value)}
                >
                  <option value="both">Both (Email & Push)</option>
                  <option value="email">Email Only</option>
                  <option value="push">Live Push Alert Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Target Audience</label>
                <select
                  className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                  value={campaignTargetType}
                  onChange={(e) => setCampaignTargetType(e.target.value)}
                >
                  <option value="all">All Register Users</option>
                  <option value="wishlist_nonempty">Any Item in Wishlist</option>
                  <option value="wishlist_product">Specific Item in Wishlist</option>
                  <option value="wishlist_category">Specific Category in Wishlist</option>
                  <option value="cart_nonempty">Any Item inside Active Cart</option>
                  <option value="cart_product">Specific Item in Cart</option>
                  <option value="cart_category">Specific Category in Cart</option>
                </select>
              </div>
            </div>

            {/* Dynamic selector inputs depending on target selection */}
            {campaignTargetType.endsWith("_product") && (
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Select Specific Product</label>
                <select
                  required
                  className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                  value={campaignProductId}
                  onChange={(e) => setCampaignProductId(e.target.value)}
                >
                  <option value="">-- Choose target product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (KES {p.price})</option>
                  ))}
                </select>
              </div>
            )}

            {campaignTargetType.endsWith("_category") && (
              <div>
                <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Select Specific Category</label>
                <select
                  required
                  className="w-full p-3.5 bg-gray-55 border border-gray-100 rounded-xl text-xs font-black outline-none focus:ring-1 focus:ring-orange-600 text-gray-700"
                  value={campaignCategory}
                  onChange={(e) => setCampaignCategory(e.target.value)}
                >
                  <option value="">-- Choose target category --</option>
                  {Array.from(new Set(products.map((p) => p.category))).map((c: any) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Broadcast Message Content</label>
              <textarea
                required
                rows={6}
                placeholder="Write a personalized, high-converting message. Try adding localized details! e.g. 'Habari Gani! We noticed you saved this beautiful handcrafted item in your wishlist. Order today and enjoy same-day delivery across Nairobi!'"
                className="w-full p-4 bg-gray-55 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium leading-relaxed resize-none shadow-sm"
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 font-semibold italic mt-1">Supports plain text with paragraphs. This message is converted dynamically for email templates.</p>
            </div>

            <button
              type="submit"
              disabled={isCreatingCampaign}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 active:scale-98 text-white text-xs font-black uppercase tracking-wider py-4 px-4 rounded-xl transition-all shadow-lg shadow-orange-600/10 cursor-pointer"
            >
              {isCreatingCampaign ? "Broadcasting Audience Updates..." : "🚀 Launch Campaign Now"}
            </button>
          </form>
        </div>

        {/* Right Column: Historical Campaigns List */}
        <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
          <div>
            <h2 className="text-xl font-black text-gray-950 tracking-tight">Campaign Dispatch Log</h2>
            <p className="text-xs text-gray-400 mt-1 font-semibold">Track historical CRM performance metrics and campaign delivery statuses.</p>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            {campaigns.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-medium">
                No marketing campaigns dispatched yet. Launch your first targeted newsletter above!
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <th className="p-4">Target Criteria</th>
                    <th className="p-4">Message Body</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4 text-center">Recipients</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                  {campaigns.map((camp) => {
                    const dateFormatted = camp.createdAt 
                      ? new Date(camp.createdAt).toLocaleDateString("en-KE", { 
                          day: "numeric", 
                          month: "short", 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })
                      : "Unknown time";

                    return (
                      <tr key={camp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-black text-gray-950 space-y-1">
                          <p className="mb-0.5 tracking-tight font-black text-gray-900">{camp.title}</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="inline-block text-[9px] font-extrabold uppercase bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100/30">
                              {camp.targetCriteria?.type || "all"}
                            </span>
                            {camp.targetCriteria?.category && (
                              <span className="inline-block text-[9px] font-bold bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                                {camp.targetCriteria.category}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-gray-400 font-semibold">{dateFormatted}</p>
                        </td>
                        <td className="p-4 max-w-xs font-medium text-gray-500 line-clamp-2">
                          {camp.message}
                        </td>
                        <td className="p-4 font-extrabold uppercase text-[10px] text-gray-500">
                          {camp.channel === "both" ? "Email & Push" : camp.channel}
                        </td>
                        <td className="p-4 text-center font-black text-sm text-gray-900">
                          {camp.sentCount || 0}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] tracking-wider uppercase font-extrabold px-2.5 py-1 rounded-full ${
                            camp.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : camp.status === "processing"
                                ? "bg-blue-100 text-blue-700 animate-pulse"
                                : camp.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                          }`}>
                            {camp.status === "processing" && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />}
                            {camp.status || "pending"}
                          </span>
                          {camp.error && (
                            <p className="text-[9px] text-red-500 font-bold mt-1 max-w-[150px] leading-tight break-words">
                              Error: {camp.error}
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEditCampaign(camp)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Campaign Details"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteCampaign(camp.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Campaign"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default MarketingTab;
