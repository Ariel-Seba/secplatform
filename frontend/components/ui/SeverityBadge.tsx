import { cn, severityConfig, type Severity } from "@/lib/utils";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wider border font-mono",
      cfg.color, cfg.bg
    )}>
      {cfg.label}
    </span>
  );
}
