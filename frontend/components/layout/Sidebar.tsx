"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Target, Radar, ShieldCheck, Search, Eye,
  FileText, Users, Settings, LayoutDashboard, LogOut, Hexagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/api";

const navItems = [
  { href: "/dashboard",            label: "Dashboard",   icon: LayoutDashboard, color: "text-sp-cyan" },
];

const moduleItems = [
  { href: "/modules/pentest",    label: "Pentest",     icon: Target,      color: "text-sp-high" },
  { href: "/modules/discovery",  label: "Discovery",   icon: Radar,       color: "text-sp-cyan" },
  { href: "/modules/compliance", label: "Compliance",  icon: ShieldCheck, color: "text-sp-teal" },
  { href: "/modules/forensics",  label: "Forensics",   icon: Search,      color: "text-sp-purple" },
  { href: "/modules/threat-intel", label: "Threat Intel", icon: Eye,      color: "text-sp-orange" },
];

const bottomItems = [
  { href: "/reports",  label: "Reports",  icon: FileText, color: "text-sp-text" },
  { href: "/users",    label: "Users",    icon: Users,    color: "text-sp-muted" },
  { href: "/settings", label: "Settings", icon: Settings, color: "text-sp-muted" },
];

function NavItem({ href, label, icon: Icon, color }: {
  href: string; label: string; icon: React.ElementType; color: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
        active
          ? "bg-sp-bg-elevated border border-sp-border text-sp-text shadow-glow-cyan"
          : "text-sp-muted hover:text-sp-text hover:bg-sp-bg-elevated"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? color : "")} />
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sp-cyan animate-pulse-cyan" />}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 bg-sp-bg-secondary border-r border-sp-border flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-sp-border">
        <div className="flex items-center gap-3">
          <Hexagon className="w-8 h-8 text-sp-cyan" style={{ filter: "drop-shadow(0 0 6px #00d4ff)" }} />
          <span className="font-black text-lg tracking-widest">
            SEC<span className="text-sp-cyan">PLATFORM</span>
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => <NavItem key={item.href} {...item} />)}

        <p className="sp-section-header px-3 pt-5 pb-2">Módulos</p>
        {moduleItems.map((item) => <NavItem key={item.href} {...item} />)}

        <p className="sp-section-header px-3 pt-5 pb-2">Sistema</p>
        {bottomItems.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sp-border">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sp-muted hover:text-sp-critical hover:bg-sp-critical/10 transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
