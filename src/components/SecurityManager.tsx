import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, Plus, Trash2, Users, Check, X, AlertTriangle, 
  UserPlus, RefreshCw, Key, ToggleLeft, ToggleRight, Info,
  History, Search, Filter, Calendar
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface SecurityManagerProps {
  user: any;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  description: string;
  updatedAt?: string;
}

interface AdminProfile {
  id: string; // The user's UID
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  updatedAt?: string;
  updatedBy?: string;
}

interface RegisteredUser {
  id: string;
  email: string;
  displayName: string;
}

const AVAILABLE_PERMISSIONS = [
  { value: "manage_inventory", label: "Inventory Management", desc: "Allows adding, editing, and deleting store products" },
  { value: "manage_orders", label: "Order Processing", desc: "Allows marking order status, dispatching, and cancellations" },
  { value: "manage_blogs", label: "Blog Authoring", desc: "Allows producing, publishing, and deleting marketing blog posts" },
  { value: "manage_inbox", label: "Support Inbox", desc: "Allows reading, replying, resolving support tickets & newsletter list" },
  { value: "manage_settings", label: "Global Settings", desc: "Allows customizing homepage banner layouts and physical map links" },
  { value: "manage_careers", label: "Careers & Jobs", desc: "Allows posting open roles and analyzing candidate submissions" },
  { value: "manage_users", label: "Users Directories", desc: "Allows reviewing customer demographic accounts and logs" },
];

export default function SecurityManager({ user }: SecurityManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals for Role Creation
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Modals for Admin Creation
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [adminSelectRole, setAdminSelectRole] = useState<string>("");
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Audit / Activity Log States
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("all");

  const fetchAuditLogs = async (silent = false) => {
    if (!silent) setAuditLogsLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const headers = { Authorization: `Bearer ${idToken}` };
      const res = await axios.get("/api/admin/audit_logs", { headers });
      if (res.data.success) {
        setAuditLogs(res.data.logs);
      }
    } catch (err: any) {
      console.error("Failed to load system audit/activity logs:", err);
    } finally {
      if (!silent) setAuditLogsLoading(false);
    }
  };

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Could not acquire auth credentials");

      const headers = { Authorization: `Bearer ${idToken}` };

      // 1. Fetch available Roles from backend REST endpoint
      const rolesRes = await axios.get("/api/admin/roles", { headers });
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.roles);
      }

      // 2. Fetch Administrators list from backend REST endpoint
      const adminsRes = await axios.get("/api/admin/admins", { headers });
      if (adminsRes.data.success) {
        setAdmins(adminsRes.data.admins);
      }

      // 3. Fetch Registered Users directory to assist with direct lookup mappings
      const userSnap = await getDocs(collection(db, "users"));
      const usersList = userSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          email: d.email || "",
          displayName: d.displayName || "Valued Customer",
        };
      }).filter(u => u.email !== "upfrontretaile@gmail.com"); // Super-admin resides on supreme level
      setRegisteredUsers(usersList);

      // 4. Fetch platform activity logs
      await fetchAuditLogs(true);

    } catch (err: any) {
      console.error("Failed to load security administration dashboard:", err);
      toast.error(err.response?.data?.error || err.message || "Failed to sync system parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim()) {
      return toast.error("Please specify a valid role display name");
    }
    if (newRole.permissions.length === 0) {
      return toast.error("Please grant at least one permission to this role");
    }

    setActionLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const res = await axios.post("/api/admin/roles", {
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions,
      }, { headers });

      if (res.data.success) {
        toast.success(res.data.message || "Custom role created successfully");
        setShowRoleModal(false);
        setNewRole({ name: "", description: "", permissions: [] });
        fetchSecurityData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to submit role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to permanently delete the role "${roleName}"?`)) return;

    setActionLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const res = await axios.delete(`/api/admin/roles/${roleId}`, { headers });
      if (res.data.success) {
        toast.success(res.data.message || "Role deleted");
        fetchSecurityData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to remove role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleSelectionChange = (roleId: string) => {
    setAdminSelectRole(roleId);
    const matchedRole = roles.find(r => r.id === roleId);
    if (matchedRole) {
      setAdminPermissions([...matchedRole.permissions]);
    } else if (roleId === "custom") {
      setAdminPermissions([]);
    }
  };

  const handleToggleAdminPermission = (perm: string) => {
    if (adminPermissions.includes(perm)) {
      setAdminPermissions(adminPermissions.filter(p => p !== perm));
    } else {
      setAdminPermissions([...adminPermissions, perm]);
    }
  };

  const handleToggleNewRolePermission = (perm: string) => {
    if (newRole.permissions.includes(perm)) {
      setNewRole({
        ...newRole,
        permissions: newRole.permissions.filter(p => p !== perm)
      });
    } else {
      setNewRole({
        ...newRole,
        permissions: [...newRole.permissions, perm]
      });
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      return toast.error("Please lookup and select a registered customer to promote");
    }
    if (adminPermissions.length === 0) {
      return toast.error("Please grant at least one access right permission key");
    }

    setActionLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const selectedRoleObject = roles.find(r => r.id === adminSelectRole);

      const res = await axios.post("/api/admin/admins", {
        uid: selectedUser.id,
        email: selectedUser.email,
        roleId: adminSelectRole === "custom" ? "custom" : adminSelectRole,
        roleName: adminSelectRole === "custom" ? "Custom Profile" : (selectedRoleObject?.name || ""),
        permissions: adminPermissions,
      }, { headers });

      if (res.data.success) {
        toast.success(res.data.message || "Admin permissions modified securely");
        setShowAdminModal(false);
        setSelectedUser(null);
        setAdminSelectRole("");
        setAdminPermissions([]);
        fetchSecurityData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to map administrator.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAdmin = async (uid: string, email: string) => {
    if (!confirm(`Are you sure you want to completely revoke administrator access for ${email}?`)) return;

    setActionLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const res = await axios.delete(`/api/admin/admins/${uid}`, { headers });
      if (res.data.success) {
        toast.success(res.data.message || "Admin privileges revoked successfully");
        fetchSecurityData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to revoke permissions.");
    } finally {
      setActionLoading(false);
    }
  };

  // Safe helper directory user search filter
  const filteredUsers = registeredUsers.filter(u => {
    const q = searchTerm.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const q = auditSearchQuery.toLowerCase();
    const actionLabel = log.action || "";
    const userEmail = log.userEmail || "";
    const details = log.details || "";
    const targetName = log.targetName || "";
    
    const matchesSearch =
      userEmail.toLowerCase().includes(q) ||
      details.toLowerCase().includes(q) ||
      targetName.toLowerCase().includes(q) ||
      actionLabel.toLowerCase().includes(q);

    const matchesAction = selectedActionFilter === "all" || log.action === selectedActionFilter;

    return matchesSearch && matchesAction;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-white border border-gray-100 rounded-3xl min-h-[400px]">
        <RefreshCw className="animate-spin text-orange-600 mb-3" size={32} />
        <p className="text-sm font-semibold">Decrypting secure security parameters & schemas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Super-admin Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-y-4">
          <Shield size={240} />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-white/10 p-3 rounded-2xl">
            <Shield size={36} />
          </div>
          <div>
            <h2 className="text-xl font-bold">RBAC Administration Console</h2>
            <p className="text-orange-50/90 text-xs font-semibold mt-1">
              Logged in as super-admin: <span className="font-extrabold text-white underline">{user?.email}</span>. 
              Only you have access to create roles, maintain schemas, and deploy access grants.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Roles & Permission Blueprints */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-950">Custom User Roles</h3>
              <p className="text-xs text-gray-400 font-semibold">Define custom role templates map to multiple permissions.</p>
            </div>
            <button
              onClick={() => {
                setNewRole({ name: "", description: "", permissions: [] });
                setShowRoleModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm"
            >
              <Plus size={14} />
              <span>New Role</span>
            </button>
          </div>

          <div className="space-y-4">
            {roles.length === 0 ? (
              <div className="text-center p-8 bg-gray-50/50 border border-dashed border-gray-150 rounded-2xl">
                <Shield className="text-gray-300 mx-auto mb-2" size={28} />
                <p className="text-xs text-gray-500 font-semibold">No custom roles mapped yet.</p>
              </div>
            ) : (
              roles.map(role => (
                <div key={role.id} className="p-4 bg-gray-50 hover:bg-gray-50/40 border border-gray-150 rounded-2xl relative transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-gray-800 uppercase tracking-wide bg-white px-2.5 py-0.5 rounded shadow-sm border border-gray-100">
                        {role.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        ID: {role.id}
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-gray-500 font-medium">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {role.permissions.map(p => {
                        const matched = AVAILABLE_PERMISSIONS.find(ap => ap.value === p);
                        return (
                          <span key={p} className="text-[9px] bg-orange-50 text-orange-700 font-extrabold uppercase px-2 py-0.5 rounded">
                            {matched?.label || p}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end md:self-start"
                    title="Delete custom role blueprint"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Administrators Directory mapping */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-950">Platform Administrators</h3>
              <p className="text-xs text-gray-400 font-semibold">Map admin privileges, revoke access levels, or assign custom permissions.</p>
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
                setAdminSelectRole("");
                setAdminPermissions([]);
                setShowAdminModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-extrabold text-xs rounded-xl transition-all"
            >
              <UserPlus size={14} />
              <span>Add Administrator</span>
            </button>
          </div>

          <div className="space-y-4">
            {admins.length === 0 ? (
              <div className="text-center p-8 bg-gray-50/55 border border-dashed border-gray-150 rounded-2xl">
                <Users className="text-gray-300 mx-auto mb-2" size={28} />
                <p className="text-xs text-gray-500 font-semibold">No platform administrator records mapped yet.</p>
              </div>
            ) : (
              admins.map(adm => {
                const isSelf = adm.id === auth.currentUser?.uid;
                return (
                  <div key={adm.id} className="p-4 border border-gray-150 rounded-2xl bg-white hover:bg-gray-50/20 transition-all space-y-3 relative">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-extrabold text-gray-950 tracking-tight leading-none mb-1.5">{adm.email}</p>
                        <p className="text-[10px] text-gray-400 font-bold">UID Field Mapping: <code className="bg-gray-50 px-1 rounded text-red-650">{adm.id}</code></p>
                      </div>

                      {adm.roleName && (
                        <span className="text-[9px] bg-orange-600 text-white font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                          {adm.roleName}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {adm.permissions.map(p => {
                        const matched = AVAILABLE_PERMISSIONS.find(ap => ap.value === p);
                        return (
                          <span key={p} className="text-[9px] bg-neutral-100 text-neutral-600 font-bold px-2 py-0.5 rounded select-none border border-neutral-150/20">
                            {matched?.label || p}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 text-[10px] text-gray-400 font-bold">
                      <span>Updated: {adm.updatedAt?.split("T")[0] || "Implicit Schema"}</span>
                      {isSelf ? (
                        <span className="text-amber-600 font-black flex items-center gap-0.5 uppercase tracking-tighter">
                          <AlertTriangle size={12} /> Root Super Admin
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevokeAdmin(adm.id, adm.email)}
                          className="text-red-500 hover:text-red-700 hover:underline uppercase tracking-tight"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Platform Activity & Accountability Audit Log Dashboard */}
      <div id="system-activity-audit-log" className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <History size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-950">System Activity & Security Audit Log</h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                Tamper-proof backend log tracking role modifications and permission changes for absolute accountability.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
              {filteredAuditLogs.length} Records Found
            </span>
            <button
              onClick={() => fetchAuditLogs(false)}
              disabled={auditLogsLoading}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-orange-600 rounded-xl transition-all disabled:opacity-50"
              title="Refresh Audit Logs"
            >
              <RefreshCw className={`w-4 h-4 ${auditLogsLoading ? "animate-spin text-orange-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search audit logs by admin email, details, or role ID..."
              value={auditSearchQuery}
              onChange={(e) => setAuditSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-150 rounded-2xl bg-gray-50/50 outline-none focus:ring-1 focus:ring-orange-600 focus:bg-white font-semibold transition-all"
            />
            {auditSearchQuery && (
              <button
                onClick={() => setAuditSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Action Choice Select Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-400 text-xs hidden md:inline font-bold">
              <Filter size={14} className="inline mr-1" /> Action:
            </span>
            <select
              value={selectedActionFilter}
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-150 rounded-2xl bg-gray-50/70 outline-none focus:ring-1 focus:ring-orange-600 font-semibold cursor-pointer"
            >
              <option value="all">All Operations</option>
              <option value="create_role">Create Role</option>
              <option value="update_role">Update Role</option>
              <option value="delete_role">Delete Role</option>
              <option value="assign_admin_privileges">Assign Admin Privileges</option>
              <option value="update_admin_privileges">Update Admin Privileges</option>
              <option value="revoke_admin_privileges">Revoke Admin Privileges</option>
            </select>
          </div>
        </div>

        {/* Logs visual content */}
        <div className="space-y-3">
          {auditLogsLoading && auditLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/45 rounded-2xl border border-dashed border-gray-100">
              <RefreshCw className="animate-spin text-orange-600 mx-auto mb-2" size={24} />
              <p className="text-xs text-gray-500 font-medium">Re-indexing log entries from secure serverless vault...</p>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/45 rounded-2xl border border-dashed border-gray-150">
              <History className="text-gray-300 mx-auto mb-2" size={28} />
              <p className="text-xs text-gray-500 font-semibold">No accountability logs match the search queries.</p>
              <p className="text-[10px] text-gray-400 font-medium mt-1">Try relaxing filters or adjusting search metrics.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-450 font-black border-b border-gray-100 text-[10px] uppercase tracking-wider select-none">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Activity Action</th>
                    <th className="py-3 px-4">Description Report</th>
                    <th className="py-3 px-4">Executive Admin</th>
                    <th className="py-3 px-4">Target Affected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAuditLogs.map((log) => {
                    // Let's deduce styling based on action
                    let actionBadgeStyle = "bg-neutral-50 text-neutral-600 border-neutral-250";
                    let actionLabelClean = log.action;

                    if (log.action === "create_role") {
                      actionBadgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      actionLabelClean = "Create Role";
                    } else if (log.action === "update_role") {
                      actionBadgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-100";
                      actionLabelClean = "Update Role";
                    } else if (log.action === "delete_role") {
                      actionBadgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                      actionLabelClean = "Delete Role";
                    } else if (log.action === "assign_admin_privileges") {
                      actionBadgeStyle = "bg-sky-50 text-sky-700 border-sky-100";
                      actionLabelClean = "Assign Admin";
                    } else if (log.action === "update_admin_privileges") {
                      actionBadgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                      actionLabelClean = "Update Admin";
                    } else if (log.action === "revoke_admin_privileges") {
                      actionBadgeStyle = "bg-red-50 text-red-705 border-red-100";
                      actionLabelClean = "Revoke Admin";
                    }

                    const formatDateTime = (str: string) => {
                      if (!str) return "N/A";
                      try {
                        const date = new Date(str);
                        return date.toLocaleString();
                      } catch {
                        return str;
                      }
                    };

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Timestamp columns */}
                        <td className="py-3.5 px-4 font-medium text-gray-450 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 font-mono text-[10px]">
                            <Calendar size={12} className="text-gray-300" />
                            {formatDateTime(log.timestamp)}
                          </span>
                        </td>

                        {/* Action column */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${actionBadgeStyle}`}>
                            {actionLabelClean}
                          </span>
                        </td>

                        {/* Details/Description column */}
                        <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                          <p className="text-gray-700 font-bold leading-relaxed">{log.details}</p>
                          {log.targetId && (
                            <p className="text-[10px] text-gray-400 font-semibold mt-1">
                              Affected ID: <code className="bg-gray-50 px-1 py-0.5 rounded text-[9px] font-mono">{log.targetId}</code>
                            </p>
                          )}
                        </td>

                        {/* Admin Initiator column */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-900 leading-tight">{log.userEmail}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5 font-mono">ID: {log.userId?.slice(0, 8)}...</span>
                          </div>
                        </td>

                        {/* Target column */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.targetName ? (
                            <span className="text-[10px] bg-gray-50 text-gray-600 font-extrabold px-2 py-1 rounded border border-gray-150 font-mono">
                              {log.targetName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-semibold italic">System</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Role Creation Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-900">Define Custom Access Role</h4>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 overflow-y-auto pr-1 flex-grow">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-400">Role Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sales Moderator, Editorial Editor"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs border border-gray-150 rounded-xl bg-gray-50 outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-400">Brief Responsibilities Description</label>
                <textarea
                  placeholder="What is this user role in charge of doing?"
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs border border-gray-150 rounded-xl bg-gray-50 outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-800 min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase text-gray-400 block pb-1 border-b border-gray-100">
                  Assign Permissions Mappings
                </label>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {AVAILABLE_PERMISSIONS.map(p => {
                    const isSelected = newRole.permissions.includes(p.value);
                    return (
                      <div 
                        key={p.value} 
                        onClick={() => handleToggleNewRolePermission(p.value)}
                        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                          isSelected ? "border-orange-500 bg-orange-50/20" : "border-gray-150 hover:bg-gray-50"
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-orange-600 bg-orange-600 text-white" : "border-gray-300"
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 leading-none mb-1">{p.label}</p>
                          <p className="text-[10px] text-gray-400 font-semibold leading-normal">{p.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all"
                >
                  {actionLoading ? "Submitting..." : "Initialize Role"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Admin Privilege Access Grant Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-900">Map Platform Admin Profile</h4>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="space-y-4 overflow-y-auto pr-1 flex-grow">
              {/* Directory User Selector Lookup */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase text-gray-400 block">
                  Select Registered Customer Profile
                </label>
                
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50/15 rounded-xl">
                    <div>
                      <p className="text-xs font-black text-gray-900">{selectedUser.displayName}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{selectedUser.email}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedUser(null)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Start typing email or customer display name to search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs border border-gray-150 rounded-xl bg-gray-50 outline-none focus:ring-1 focus:ring-orange-600 font-semibold"
                    />
                    
                    <div className="border border-gray-100 rounded-xl max-h-[120px] overflow-y-auto divide-y divide-gray-50">
                      {filteredUsers.length === 0 ? (
                        <p className="text-center p-3 text-[10px] text-gray-400 font-bold">No matching registered customers found</p>
                      ) : (
                        filteredUsers.slice(0, 5).map(u => (
                          <div 
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className="p-2 text-left cursor-pointer hover:bg-orange-50/30 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold text-gray-900 leading-none mb-1">{u.displayName}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{u.email}</p>
                            </div>
                            <span className="text-[8px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded uppercase">Select</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Role template selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-400">Select Access Role Blueprint</label>
                <select
                  value={adminSelectRole}
                  onChange={(e) => handleRoleSelectionChange(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-gray-150 rounded-xl bg-gray-50 outline-none focus:ring-1 focus:ring-orange-600 font-semibold text-gray-800 cursor-pointer"
                  required
                >
                  <option value="">-- Click to assign role template --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.permissions.length} permissions)</option>
                  ))}
                  <option value="custom">Custom Permissions Profile Override</option>
                </select>
              </div>

              {/* Individual Permissions overrides */}
              {adminSelectRole && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                    <label className="text-[10px] font-extrabold uppercase text-gray-400">
                      Fine-tune Granular Permissions
                    </label>
                    {adminSelectRole !== "custom" && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-orange-600 bg-orange-100/60 px-1.5 py-0.5 rounded">
                        Template Autofill Enabled
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {AVAILABLE_PERMISSIONS.map(p => {
                      const isChecked = adminPermissions.includes(p.value);
                      return (
                        <div 
                          key={p.value} 
                          onClick={() => handleToggleAdminPermission(p.value)}
                          className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-colors border ${
                            isChecked ? "bg-stone-50/50 border-neutral-250" : "bg-transparent border-transparent hover:bg-neutral-50/40"
                          }`}
                        >
                          <div className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                            isChecked ? "bg-orange-600 text-white border-orange-600" : "border-gray-350 bg-white"
                          }`}>
                            {isChecked && <Check size={10} />}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-800 leading-none mb-0.5">{p.label}</p>
                            <p className="text-[9px] text-gray-400 font-medium leading-none">{p.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all animate-none"
                >
                  {actionLoading ? "Deploying..." : "Assign & Deploy Rights"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
