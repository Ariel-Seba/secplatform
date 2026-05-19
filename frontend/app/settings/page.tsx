"use client";

import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { Settings, Key, Bell, Shield, Database, RefreshCw, Check } from "lucide-react";

interface PlatformHealth {
  status: string;
  version?: string;
  database?: string;
  redis?: string;
  modules?: Record<string, string>;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [saved, setSaved] = useState(false);
  const currentUser = getUser();
  const isSuperadmin = currentUser?.role === "superadmin";

  useEffect(() => {
    api.get<PlatformHealth>("/api/health")
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoadingHealth(false));
  }, []);

  const fakeSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-sp-text">Settings</h1>
        <p className="text-sp-muted text-sm mt-1">Platform configuration and diagnostics</p>
      </div>

      {/* Platform Health */}
      <div className="sp-card p-5 space-y-4">
        <h2 className="font-semibold text-sp-text flex items-center gap-2">
          <Database className="w-4 h-4 text-sp-cyan" /> Platform Health
        </h2>
        {loadingHealth ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-8 skeleton rounded" />)}
          </div>
        ) : health ? (
          <div className="space-y-2">
            {[
              { label: "API Backend",    value: health.status === "ok" ? "Online" : "Degraded", ok: health.status === "ok" },
              { label: "Database",       value: health.database ?? "Unknown", ok: health.database === "ok" },
              { label: "Redis / Queue",  value: health.redis ?? "Unknown", ok: health.redis === "ok" },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-sp-bg-secondary border border-sp-border">
                <span className="text-sm text-sp-muted">{label}</span>
                <span className={`text-xs font-semibold font-mono ${ok ? "text-sp-teal" : "text-sp-critical"}`}>
                  {value.toUpperCase()}
                </span>
              </div>
            ))}

            {health.modules && Object.entries(health.modules).map(([mod, status]) => (
              <div key={mod} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-sp-bg-secondary border border-sp-border">
                <span className="text-sm text-sp-muted">Module: {mod}</span>
                <span className={`text-xs font-semibold font-mono ${status === "ok" ? "text-sp-teal" : "text-sp-high"}`}>
                  {status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sp-muted text-sm">Could not reach backend.</p>
        )}
      </div>

      {/* Profile */}
      <div className="sp-card p-5 space-y-4">
        <h2 className="font-semibold text-sp-text flex items-center gap-2">
          <Shield className="w-4 h-4 text-sp-cyan" /> My Profile
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Username",  value: currentUser?.username  ?? "—" },
            { label: "Full Name", value: currentUser?.full_name ?? "—" },
            { label: "Email",     value: currentUser?.email     ?? "—" },
            { label: "Role",      value: currentUser?.role      ?? "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-sp-muted uppercase tracking-wider">{label}</p>
              <p className="text-sm text-sp-text font-mono mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="sp-card p-5 space-y-4">
        <h2 className="font-semibold text-sp-text flex items-center gap-2">
          <Bell className="w-4 h-4 text-sp-cyan" /> Notifications
        </h2>
        <div className="space-y-3">
          {[
            "Email alerts for CRITICAL findings",
            "Scan completion notifications",
            "Report generation notifications",
            "Failed scan alerts",
          ].map((label) => (
            <label key={label} className="flex items-center justify-between px-4 py-3 rounded-lg bg-sp-bg-secondary border border-sp-border cursor-pointer">
              <span className="text-sm text-sp-text">{label}</span>
              <div className="relative inline-flex">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-sp-border rounded-full peer peer-checked:bg-sp-cyan transition-all" />
                <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-all peer-checked:translate-x-4" />
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="sp-card p-5 space-y-4">
        <h2 className="font-semibold text-sp-text flex items-center gap-2">
          <Key className="w-4 h-4 text-sp-cyan" /> Security
        </h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Current Password</span>
            <input type="password" className="sp-input mt-1 w-full" placeholder="••••••••" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">New Password</span>
            <input type="password" className="sp-input mt-1 w-full" placeholder="••••••••" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Confirm New Password</span>
            <input type="password" className="sp-input mt-1 w-full" placeholder="••••••••" />
          </label>
          <button onClick={fakeSave} className="sp-btn-primary flex items-center gap-2">
            {saved ? <Check className="w-4 h-4" /> : <Key className="w-4 h-4" />}
            {saved ? "Saved!" : "Update Password"}
          </button>
        </div>
      </div>

      {/* Platform (superadmin only) */}
      {isSuperadmin && (
        <div className="sp-card p-5 space-y-4">
          <h2 className="font-semibold text-sp-text flex items-center gap-2">
            <Settings className="w-4 h-4 text-sp-cyan" /> Platform (Superadmin)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "JWT Token TTL",     value: "15 minutes" },
              { label: "Refresh Token TTL", value: "7 days" },
              { label: "Max Concurrent Scans", value: "10" },
              { label: "Audit Log Retention",  value: "90 days" },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 rounded-lg bg-sp-bg-secondary border border-sp-border">
                <p className="text-xs text-sp-muted">{label}</p>
                <p className="text-sm font-mono text-sp-text mt-1">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-sp-subtle">Platform config is managed via environment variables in <code className="sp-mono bg-sp-bg-elevated px-1 rounded">.env</code>. Restart services after changes.</p>
        </div>
      )}
    </div>
  );
}

