import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  accent?: "cyan" | "teal" | "purple" | "orange" | "critical" | "high";
}

const accentMap = {
  cyan:     "text-sp-cyan border-sp-cyan/30 bg-sp-cyan/5",
  teal:     "text-sp-teal border-sp-teal/30 bg-sp-teal/5",
  purple:   "text-sp-purple border-sp-purple/30 bg-sp-purple/5",
  orange:   "text-sp-orange border-sp-orange/30 bg-sp-orange/5",
  critical: "text-sp-critical border-sp-critical/30 bg-sp-critical/5",
  high:     "text-sp-high border-sp-high/30 bg-sp-high/5",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "cyan" }: StatCardProps) {
  return (
    <div className="sp-card p-5 sp-glow-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="sp-section-header mb-2">{label}</p>
          <p className="text-3xl font-black font-mono text-sp-text">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1", trend.positive ? "text-sp-low" : "text-sp-high")}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}% vs período anterior
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg border", accentMap[accent])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
