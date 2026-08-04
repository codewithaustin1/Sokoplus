import React, { memo } from "react";
import { Inbox, MessageSquare, Send, Clock, Check, CheckCheck, Trash2, CheckCircle2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface SupportTicket {
  id: string;
  subject: string;
  email: string;
  message: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: any;
  replies?: Array<{ sender: string; message: string; createdAt: any }>;
  unreadCountAdmin?: number;
}

interface InboxTabProps {
  tickets: SupportTicket[];
  updateTicketStatus: (id: string, status: SupportTicket["status"]) => void;
  handleSendAdminReply: (e: React.FormEvent, ticketId: string, currentReplies: any[]) => void;
  adminReplyText: Record<string, string>;
  setAdminReplyText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  deleteTicket: (id: string) => void;
}

export const InboxTab: React.FC<InboxTabProps> = memo(({
  tickets,
  updateTicketStatus,
  handleSendAdminReply,
  adminReplyText,
  setAdminReplyText,
  deleteTicket,
}) => {
  return (
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
              className={`p-6 rounded-3xl border transition-all ${
                t.status === "resolved" || t.status === "closed"
                  ? "bg-gray-50 border-gray-100 opacity-60"
                  : "bg-white border-orange-100 shadow-sm"
              }`}
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
                      e.target.value as SupportTicket["status"]
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

              {/* Interactive Replies Conversation History */}
              {t.replies && t.replies.length > 0 && (
                <div className="mb-4 pl-4 border-l-2 border-orange-500 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Conversation History
                  </p>
                  {t.replies.map((reply, rid) => (
                    <div
                      key={rid}
                      className={`p-3 rounded-2xl text-xs ${
                        reply.sender === "admin"
                          ? "bg-orange-50 text-orange-950 border border-orange-100"
                          : "bg-gray-50 text-gray-800 border border-gray-150"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold uppercase text-[9px] tracking-wider text-orange-600">
                          {reply.sender === "admin" ? "Soplus Team" : t.email ? t.email.split("@")[0] : "Customer"}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {reply.createdAt && typeof reply.createdAt === "string"
                            ? new Date(reply.createdAt).toLocaleString()
                            : String(reply.createdAt)}
                        </span>
                      </div>
                      <p className="font-medium whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Send Outbound Response Box */}
              <form
                onSubmit={(e) => handleSendAdminReply(e, t.id, t.replies || [])}
                className="mb-4 flex gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Type response matching registered email..."
                  className="flex-grow p-3 text-xs bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-850 rounded-xl outline-none focus:ring-1 focus:ring-orange-550 transition-all font-semibold"
                  value={adminReplyText[t.id] || ""}
                  onChange={(e) =>
                    setAdminReplyText((prev) => ({
                      ...prev,
                      [t.id]: e.target.value,
                    }))
                  }
                />
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer border-none"
                >
                  <Send size={12} />
                  <span>Reply</span>
                </button>
              </form>
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <div className="flex items-center">
                  <Clock size={12} className="mr-1" />
                  {t.createdAt?.toDate
                    ? t.createdAt.toDate().toLocaleString()
                    : String(t.createdAt)}
                </div>
                <div className="flex items-center space-x-3">
                  {t.unreadCountAdmin && t.unreadCountAdmin > 0 ? (
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, "support_tickets", t.id), {
                            unreadCountAdmin: 0,
                          });
                        } catch (e) {
                          console.warn("Failed to mark ticket read:", e);
                        }
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-xl uppercase cursor-pointer border-none flex items-center transition-all"
                      title="Clear unread notification"
                    >
                      <Check size={10} className="mr-1" /> Clear Unread ({t.unreadCountAdmin})
                    </button>
                  ) : (
                    <span className="text-[10px] text-green-650 font-bold flex items-center bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                      <CheckCheck size={12} className="mr-1 text-green-600" /> All Read
                    </span>
                  )}

                  {t.status === "closed" && (
                    <button
                      onClick={() => deleteTicket(t.id)}
                      className="flex items-center text-red-600 hover:text-red-700 transition-all font-bold group"
                    >
                      <Trash2 size={12} className="mr-1 text-red-500 group-hover:scale-110 transition-transform" /> Delete Ticket
                    </button>
                  )}
                  {t.status !== "resolved" && t.status !== "closed" && (
                    <button
                      onClick={() => updateTicketStatus(t.id, "resolved")}
                      className="flex items-center text-green-600 hover:text-green-700 transition-colors"
                    >
                      <CheckCircle2 size={12} className="mr-1" /> Mark Resolved
                    </button>
                  )}
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
  );
});

export default InboxTab;
