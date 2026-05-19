"use client";

import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { formatDate } from "@/lib/utils";
import {
  Users, UserPlus, Trash2, RefreshCw, X, Shield, ChevronDown, Check
} from "lucide-react";

interface Group {
  id: number;
  name: string;
  role: string;
  allowed_modules: string[];
  description: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role: string;
  created_at: string;
  last_login: string | null;
  groups: Group[];
}

const roleColors: Record<string, string> = {
  superadmin: "text-sp-critical",
  admin:      "text-sp-high",
  analyst:    "text-sp-cyan",
  viewer:     "text-sp-muted",
  module_admin: "text-sp-purple",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const currentUser = getUser();
  const canManage = ["superadmin", "admin"].includes(currentUser?.role ?? "");

  const [form, setForm] = useState({
    username: "", email: "", full_name: "", password: "", group_ids: [] as number[],
  });

  const fetchAll = () =>
    Promise.all([
      api.get<User[]>("/api/users/").then(setUsers),
      api.get<Group[]>("/api/groups/").then(setGroups),
    ]).catch(() => {});

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, []);

  const toggleGroup = (id: number) =>
    setForm((f) => ({
      ...f,
      group_ids: f.group_ids.includes(id)
        ? f.group_ids.filter((g) => g !== id)
        : [...f.group_ids, id],
    }));

  const createUser = async () => {
    if (!form.username || !form.email || !form.password) {
      setError("Username, email and password are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/users/", form);
      setShowForm(false);
      setForm({ username: "", email: "", full_name: "", password: "", group_ids: [] });
      await fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: number) => {
    try {
      await api.delete(`/api/users/${id}`);
      setDeleteId(null);
      await fetchAll();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sp-text">Users</h1>
          <p className="text-sp-muted text-sm mt-1">Manage platform users and access groups</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="sp-btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> New User
          </button>
        )}
      </div>

      {/* Groups summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {groups.map((g) => (
          <div key={g.id} className="sp-card p-4">
            <Shield className="w-5 h-5 mb-2 text-sp-cyan" />
            <p className="font-semibold text-sp-text text-sm">{g.name}</p>
            <p className={`text-xs font-mono mt-0.5 ${roleColors[g.role] ?? "text-sp-muted"}`}>{g.role}</p>
            <p className="text-xs text-sp-subtle mt-1">{g.description}</p>
            <p className="text-xs text-sp-muted mt-2">{g.allowed_modules.length} modules</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="sp-card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-sp-border">
          <h2 className="font-semibold text-sp-text flex items-center gap-2">
            <Users className="w-4 h-4 text-sp-cyan" /> Platform Users
          </h2>
          <button onClick={fetchAll} className="sp-btn-ghost p-2 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sp-border">
                  {["User", "Email", "Role", "Groups", "Last Login", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-sp-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sp-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-sp-bg-secondary transition-all">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-sp-text">{u.full_name || u.username}</p>
                        <p className="text-xs font-mono text-sp-muted">@{u.username}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sp-muted text-xs font-mono">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold font-mono ${roleColors[u.role] ?? "text-sp-muted"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.groups.map((g) => (
                          <span key={g.id} className="text-xs bg-sp-bg-elevated border border-sp-border rounded px-2 py-0.5 text-sp-muted">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-sp-subtle">
                      {u.last_login ? formatDate(u.last_login) : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${u.is_active ? "text-sp-teal" : "text-sp-critical"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {canManage && u.username !== currentUser?.username && (
                        <button
                          onClick={() => setDeleteId(u.id)}
                          className="p-1.5 rounded hover:bg-sp-critical/10 hover:text-sp-critical text-sp-muted transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sp-text text-lg">Create User</h3>
              <button onClick={() => setShowForm(false)} className="sp-btn-ghost p-2 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-sp-critical text-sm bg-sp-critical/10 rounded-lg px-4 py-2">{error}</p>}

            <div className="space-y-3">
              {[
                { field: "username",   label: "Username",   type: "text",     ph: "jsmith" },
                { field: "email",      label: "Email",      type: "email",    ph: "j.smith@org.com" },
                { field: "full_name",  label: "Full Name",  type: "text",     ph: "John Smith" },
                { field: "password",   label: "Password",   type: "password", ph: "••••••••" },
              ].map(({ field, label, type, ph }) => (
                <label key={field} className="block">
                  <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">{label}</span>
                  <input
                    type={type}
                    className="sp-input mt-1 w-full"
                    placeholder={ph}
                    value={(form as Record<string, unknown>)[field] as string}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                </label>
              ))}

              <div>
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Groups</span>
                <div className="mt-2 space-y-1 max-h-36 overflow-y-auto border border-sp-border rounded-lg p-2">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-sp-bg-elevated cursor-pointer">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        form.group_ids.includes(g.id)
                          ? "bg-sp-cyan border-sp-cyan"
                          : "border-sp-border"
                      }`}
                        onClick={() => toggleGroup(g.id)}>
                        {form.group_ids.includes(g.id) && <Check className="w-2.5 h-2.5 text-sp-bg-primary" />}
                      </div>
                      <span className="text-sm text-sp-text">{g.name}</span>
                      <span className={`text-xs ml-auto font-mono ${roleColors[g.role] ?? ""}`}>{g.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="sp-btn-ghost flex-1">Cancel</button>
              <button onClick={createUser} disabled={saving} className="sp-btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="w-8 h-8 text-sp-critical mx-auto" />
            <p className="font-semibold text-sp-text">Delete this user?</p>
            <p className="text-sm text-sp-muted">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="sp-btn-ghost flex-1">Cancel</button>
              <button onClick={() => deleteUser(deleteId)} className="sp-btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
