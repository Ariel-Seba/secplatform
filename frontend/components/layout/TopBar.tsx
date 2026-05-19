"use client";

import { Bell, User } from "lucide-react";
import { getUser } from "@/lib/api";
import { useEffect, useState } from "react";

export function TopBar() {
  const [user, setUser] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="h-14 bg-sp-bg-secondary border-b border-sp-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-sp-muted">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 text-sp-muted hover:text-sp-text transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-sp-critical rounded-full" />
        </button>

        <div className="flex items-center gap-2 bg-sp-bg-elevated border border-sp-border rounded-lg px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-sp-cyan/20 border border-sp-cyan/30 flex items-center justify-center">
            <User className="w-3 h-3 text-sp-cyan" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-sp-text">{user?.username ?? "..."}</p>
            <p className="text-sp-muted font-mono">{user?.role ?? ""}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
