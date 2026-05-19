import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const severityConfig = {
  critical: { label: "CRITICAL", color: "text-sp-critical", bg: "bg-sp-critical/10 border-sp-critical/30" },
  high:     { label: "HIGH",     color: "text-sp-high",     bg: "bg-sp-high/10 border-sp-high/30" },
  medium:   { label: "MEDIUM",   color: "text-sp-medium",   bg: "bg-sp-medium/10 border-sp-medium/30" },
  low:      { label: "LOW",      color: "text-sp-low",      bg: "bg-sp-low/10 border-sp-low/30" },
  info:     { label: "INFO",     color: "text-sp-info",     bg: "bg-sp-info/10 border-sp-info/30" },
} as const;

export type Severity = keyof typeof severityConfig;

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    completed: "text-sp-low",
    running:   "text-sp-cyan",
    pending:   "text-sp-orange",
    failed:    "text-sp-critical",
  };
  return map[status] ?? "text-sp-muted";
}
