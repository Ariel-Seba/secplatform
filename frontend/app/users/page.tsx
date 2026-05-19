"use client";

import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Users, UserPlus, Trash2, RefreshCw, X, Shield,
  Check, Plus, Target, Radar, ShieldCheck, FileText,
  Search, Eye, ChevronDown, Pencil
} from "lucide-react";

const ALL_MODULES = [
  { id: "pentest",      label: "Pentest",      icon: Target,      color: "text-sp-high" },
  { id: "discovery",    label: "Discovery",    icon: Radar,       color: "text-sp-cyan" },
  { id: "compliance",   label: "Compliance",   icon: ShieldCheck, color: "text-sp-teal" },
  { id: "forensics",    label: "Forensics",    icon: Search,      color: "text-sp-purple" },
  { id: "threat-intel", label: "Threat Intel", icon: Eye,         color: "text-sp-orange" },
  { id: "reports",      label: "Reports",      icon: FileText,    color: "text-sp-muted" },
];

const ROLES = ["superadmin", "admin", "analyst", "viewer"] as const;
type Role = typeof ROLES[number];

const roleColors: Record<string, string> = {
  superadmin:   "text-sp-critical",
  admin:        "text-sp-high",
  analyst:      "text-sp-cyan",
  viewer:       "text-sp-muted",
  module_admin: "text-sp-purple",
};

interface Group {
  id: number;
  name: string;
  role: string;
  allowed_modules: string[];
  description: string;
  member_count?: number;
}

interface PlatformUser {
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

function ModuleChip({ id }: { id: string }) {
  const mod = ALL_MODULES.find((m) => m.id === id);
  if (!mod) return <span className="text-xs bg-sp-bg-elevated border border-sp-border rounded px-2 py-0.5 text-sp-subtle">{id}</span>;
  const Icon = mod.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs bg-sp-bg-elevated border border-sp-border rounded px-2 py-0.5 ${mod.color}`}>
      <Icon className="w-3 h-3" />{mod.label}
    </span>
  );
}

function ModuleSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  return (
    <div className="grid grid-cols-3 gap-2">
      {ALL_MODULES.map(({ id, label, icon: Icon, color }) => {
        const active = selected.includes(id);
        return (
          <button key={id} type="button" onClick={() => toggle(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
              active ? `border-current bg-sp-bg-elevated ${color}` : "border-sp-border text-sp-muted hover:text-sp-text"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
            {active && <Check className="w-3 h-3 ml-auto" />}
          </button>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const currentUser = getUser();
  const canManage = ["superadmin", "admin"].includes(currentUser?.role ?? "");

  const [showUserForm, setShowUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [userForm, setUserForm] = useState({ username: "", email: "", full_name: "", password: "", group_ids: [] as number[] });

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", description: "", role: "analyst" as Role, allowed_modules: [] as string[] });

  const fetchAll = () =>
    Promise.all([
      api.get<PlatformUser[]>("/api/users/").then(setUsers),
      api.get<Group[]>("/api/groups/").then(setGroups),
    ]).catch(() => {});

  useEffect(() => { fetchAll().finally(() => setLoading(false)); }, []);

  const createUser = async () => {
    if (!userForm.username || !userForm.email || !userForm.password) {
      setUserError("Username, email y contraseña son requeridos."); return;
    }
    setSavingUser(true); setUserError("");
    try {
      await api.post("/api/users/", userForm);
      setShowUserForm(false);
      setUserForm({ username: "", email: "", full_name: "", password: "", group_ids: [] });
      await fetchAll();
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : "Error al crear usuario");
    } finally { setSavingUser(false); }
  };

  const deleteUser = async (id: number) => {
    await api.delete(`/api/users/${id}`).catch(() => {});
    setDeleteId(null); await fetchAll();
  };

  const openGroupForm = (g?: Group) => {
    setEditingGroup(g ?? null);
    setGroupForm(g
      ? { name: g.name, description: g.description ?? "", role: g.role as Role, allowed_modules: g.allowed_modules }
      : { name: "", description: "", role: "analyst", allowed_modules: [] }
    );
    setGroupError(""); setShowGroupForm(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name) { setGroupError("El nombre es requerido."); return; }
    setSavingGroup(true); setGroupError("");
    try {
      if (editingGroup) {
        await api.put(`/api/groups/${editingGroup.id}`, {
          description: groupForm.description, role: groupForm.role, allowed_modules: groupForm.allowed_modules,
        });
      } else {
        await api.post("/api/groups/", groupForm);
      }
      setShowGroupForm(false); await fetchAll();
    } catch (e: unknown) {
      setGroupError(e instanceof Error ? e.message : "Error al guardar grupo");
    } finally { setSavingGroup(false); }
  };

  const deleteGroup = async (id: number) => {
    await api.delete(`/api/groups/${id}`).catch(() => {});
    setDeleteGroupId(null); await fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sp-text">Usuarios & Grupos</h1>
          <p className="text-sp-muted text-sm mt-1">Gestión de acceso y permisos de módulos</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {tab === "groups" && (
              <button onClick={() => openGroupForm()} className="sp-btn-ghost flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nuevo Grupo
              </button>
            )}
            {tab === "users" && (
              <button onClick={() => setShowUserForm(true)} className="sp-btn-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Nuevo Usuario
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sp-border">
        {(["users", "groups"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t ? "border-sp-cyan text-sp-cyan" : "border-transparent text-sp-muted hover:text-sp-text"
            }`}>
            {t === "users"
              ? <><Users className="w-4 h-4 inline mr-1.5" />Usuarios</>
              : <><Shield className="w-4 h-4 inline mr-1.5" />Grupos</>}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="sp-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-sp-border">
            <p className="text-sm font-semibold text-sp-text">{users.length} usuarios</p>
            <button onClick={fetchAll} className="sp-btn-ghost p-2 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sp-border">
                    {["Usuario", "Email", "Rol", "Módulos accesibles", "Último login", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-sp-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sp-border">
                  {users.map((u) => {
                    const modules = u.groups.flatMap((g) => g.allowed_modules).filter((v, i, a) => a.indexOf(v) === i);
                    return (
                      <tr key={u.id} className="hover:bg-sp-bg-secondary transition-all">
                        <td className="px-5 py-3">
                          <p className="font-medium text-sp-text">{u.full_name || u.username}</p>
                          <p className="text-xs font-mono text-sp-muted">@{u.username}</p>
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-sp-muted">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold font-mono ${roleColors[u.role] ?? "text-sp-muted"}`}>{u.role}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {modules.length === 0
                              ? <span className="text-xs text-sp-subtle italic">Sin módulos</span>
                              : modules.map((m) => <ModuleChip key={m} id={m} />)}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-sp-subtle">{u.last_login ? formatDate(u.last_login) : "Nunca"}</td>
                        <td className="px-5 py-3">
                          {canManage && u.username !== currentUser?.username && (
                            <button onClick={() => setDeleteId(u.id)}
                              className="p-1.5 rounded hover:bg-sp-critical/10 hover:text-sp-critical text-sp-muted transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* Groups tab */}
      {tab === "groups" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <div key={g.id} className="sp-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sp-text">{g.name}</p>
                  <p className="text-xs text-sp-subtle mt-0.5">{g.description}</p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openGroupForm(g)} className="p-1.5 sp-btn-ghost rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteGroupId(g.id)}
                      className="p-1.5 rounded hover:bg-sp-critical/10 hover:text-sp-critical text-sp-muted transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-semibold ${roleColors[g.role] ?? ""}`}>{g.role}</span>
                <span className="text-sp-subtle text-xs">·</span>
                <span className="text-xs text-sp-muted">{g.member_count ?? 0} miembros</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.allowed_modules.length === 0
                  ? <span className="text-xs text-sp-subtle italic">Sin acceso a módulos</span>
                  : g.allowed_modules.map((m) => <ModuleChip key={m} id={m} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create user modal */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sp-text text-lg">Crear Usuario</h3>
              <button onClick={() => setShowUserForm(false)} className="sp-btn-ghost p-2 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            {userError && <p className="text-sp-critical text-sm bg-sp-critical/10 rounded-lg px-4 py-2">{userError}</p>}
            <div className="space-y-3">
              {[
                { field: "username",  label: "Username",  type: "text",     ph: "jsmith" },
                { field: "email",     label: "Email",     type: "email",    ph: "j.smith@org.com" },
                { field: "full_name", label: "Nombre completo", type: "text", ph: "John Smith" },
                { field: "password",  label: "Contraseña", type: "password", ph: "••••••••" },
              ].map(({ field, label, type, ph }) => (
                <label key={field} className="block">
                  <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">{label}</span>
                  <input type={type} className="sp-input mt-1 w-full" placeholder={ph}
                    value={(userForm as Record<string, unknown>)[field] as string}
                    onChange={(e) => setUserForm({ ...userForm, [field]: e.target.value })} />
                </label>
              ))}
              <div>
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Grupos y módulos accesibles</span>
                <p className="text-xs text-sp-subtle mt-0.5 mb-2">El acceso a módulos se hereda del grupo seleccionado</p>
                <div className="space-y-2">
                  {groups.map((g) => {
                    const active = userForm.group_ids.includes(g.id);
                    return (
                      <div key={g.id} onClick={() => setUserForm((f) => ({
                          ...f, group_ids: f.group_ids.includes(g.id) ? f.group_ids.filter((x) => x !== g.id) : [...f.group_ids, g.id]
                        }))}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          active ? "border-sp-cyan/40 bg-sp-bg-elevated" : "border-sp-border hover:bg-sp-bg-elevated"
                        }`}>
                        <div className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                          active ? "bg-sp-cyan border-sp-cyan" : "border-sp-border"
                        }`}>
                          {active && <Check className="w-2.5 h-2.5 text-sp-bg-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-sp-text">{g.name}</p>
                            <span className={`text-xs font-mono ${roleColors[g.role] ?? ""}`}>{g.role}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {g.allowed_modules.length === 0
                              ? <span className="text-xs text-sp-subtle italic">Sin módulos</span>
                              : g.allowed_modules.map((m) => <ModuleChip key={m} id={m} />)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowUserForm(false)} className="sp-btn-ghost flex-1">Cancelar</button>
              <button onClick={createUser} disabled={savingUser} className="sp-btn-primary flex-1 flex items-center justify-center gap-2">
                {savingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {savingUser ? "Creando..." : "Crear Usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group form modal */}
      {showGroupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sp-text text-lg">{editingGroup ? "Editar Grupo" : "Nuevo Grupo"}</h3>
              <button onClick={() => setShowGroupForm(false)} className="sp-btn-ghost p-2 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            {groupError && <p className="text-sp-critical text-sm bg-sp-critical/10 rounded-lg px-4 py-2">{groupError}</p>}
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Nombre</span>
                <input className="sp-input mt-1 w-full" placeholder="Red Team" value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} disabled={!!editingGroup} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Descripción</span>
                <input className="sp-input mt-1 w-full" placeholder="Descripción del grupo" value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
              </label>
              <div>
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Rol del grupo</span>
                <div className="relative mt-1">
                  <select className="sp-input w-full appearance-none" value={groupForm.role}
                    onChange={(e) => setGroupForm({ ...groupForm, role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sp-muted pointer-events-none" />
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Módulos permitidos</span>
                <div className="mt-2">
                  <ModuleSelector selected={groupForm.allowed_modules}
                    onChange={(v) => setGroupForm({ ...groupForm, allowed_modules: v })} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowGroupForm(false)} className="sp-btn-ghost flex-1">Cancelar</button>
              <button onClick={saveGroup} disabled={savingGroup} className="sp-btn-primary flex-1 flex items-center justify-center gap-2">
                {savingGroup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {savingGroup ? "Guardando..." : editingGroup ? "Guardar cambios" : "Crear Grupo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete user */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="w-8 h-8 text-sp-critical mx-auto" />
            <p className="font-semibold text-sp-text">¿Eliminar este usuario?</p>
            <p className="text-sm text-sp-muted">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="sp-btn-ghost flex-1">Cancelar</button>
              <button onClick={() => deleteUser(deleteId)} className="sp-btn-danger flex-1">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete group */}
      {deleteGroupId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="w-8 h-8 text-sp-critical mx-auto" />
            <p className="font-semibold text-sp-text">¿Eliminar este grupo?</p>
            <p className="text-sm text-sp-muted">Los miembros perderán ese acceso.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteGroupId(null)} className="sp-btn-ghost flex-1">Cancelar</button>
              <button onClick={() => deleteGroup(deleteGroupId)} className="sp-btn-danger flex-1">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
