"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { formatDate, statusColor, cn } from "@/lib/utils";
import { Play, RefreshCw, FileText, Target, Radar, ShieldCheck, Search, Eye, Terminal } from "lucide-react";
import type { Severity } from "@/lib/utils";

const moduleConfig: Record<string, { label: string; icon: React.ElementType; color: string; placeholder: string; available: boolean }> = {
  pentest:        { label: "Pentest",      icon: Target,      color: "text-sp-high",   placeholder: "192.168.1.0/24 o https://target.com", available: true },
  discovery:      { label: "Discovery",    icon: Radar,       color: "text-sp-cyan",   placeholder: "target.com",                           available: true },
  compliance:     { label: "Compliance",   icon: ShieldCheck, color: "text-sp-teal",   placeholder: "192.168.1.100 o ./docker-compose.yml", available: true },
  forensics:      { label: "Forensics",    icon: Search,      color: "text-sp-purple", placeholder: "", available: false },
  "threat-intel": { label: "Threat Intel", icon: Eye,         color: "text-sp-orange", placeholder: "", available: false },
};

interface JobDetail {
  job_id: string;
  status: string;
  progress: number;
  target?: string;
  module?: string;
  created_at?: string;
  result?: Record<string, unknown> | null;
  logs?: string[];
}

export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const mod = moduleConfig[moduleId] ?? { label: moduleId, icon: Target, color: "text-sp-cyan", placeholder: "target", available: false };
  const Icon = mod.icon;

  if (!mod.available) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <div className={cn("p-4 rounded-2xl bg-sp-bg-elevated border border-sp-border", mod.color)}>
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sp-text">{mod.label}</h1>
          <p className="text-sp-muted text-sm mt-1">Módulo en desarrollo — próximamente disponible</p>
        </div>
      </div>
    );
  }

  const [target, setTarget] = useState("");
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<JobDetail | null>(null);
  const [scanning, setScanning] = useState(false);
  const [polling, setPolling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const loadJobs = useCallback(async () => {
    try {
      const all = await api.get<Record<string, unknown>[]>("/api/modules/jobs");
      setJobs(all.filter((j) => j.module === moduleId));
    } catch {}
  }, [moduleId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Auto-scroll logs to bottom when new entries arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.logs?.length]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setScanning(true);
    try {
      const res = await api.post<{ job_id: string }>(`/api/modules/${moduleId}/scan`, { target });
      await loadJobs();
      startPolling(res.job_id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al iniciar scan");
    } finally {
      setScanning(false);
    }
  }

  function startPolling(jobId: string) {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const status = await api.get<JobDetail>(`/api/modules/${moduleId}/scan/${jobId}`);
        setSelected(status);
        await loadJobs();
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(interval);
          setPolling(false);
        }
      } catch {
        clearInterval(interval);
        setPolling(false);
      }
    }, 2500);
  }

  async function selectJob(job: Record<string, unknown>) {
    try {
      const detail = await api.get<JobDetail>(`/api/modules/${moduleId}/scan/${job.job_id}`);
      setSelected(detail);
      if (detail.status === "running" || detail.status === "pending") {
        startPolling(detail.job_id);
      }
    } catch {
      setSelected(job as unknown as JobDetail);
    }
  }

  const logs = selected?.logs ?? [];
  const isActive = selected?.status === "running" || selected?.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-xl bg-sp-bg-elevated border border-sp-border", mod.color)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sp-text">{mod.label}</h1>
          <p className="text-sp-muted text-sm">Módulo de seguridad activo</p>
        </div>
      </div>

      {/* Scan form */}
      <div className="sp-card p-5">
        <h2 className="font-semibold text-sp-text mb-4 text-sm sp-section-header">Nuevo Scan</h2>
        <form onSubmit={handleScan} className="flex gap-3">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="sp-input flex-1"
            placeholder={mod.placeholder}
            required
          />
          <button type="submit" disabled={scanning} className="sp-btn-primary px-6 flex items-center gap-2">
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Iniciando..." : "Iniciar"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job list */}
        <div className="sp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sp-text text-sm">Scans Recientes</h2>
            <button onClick={loadJobs} className="text-sp-muted hover:text-sp-cyan transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {jobs.length === 0 ? (
            <p className="text-sp-muted text-sm text-center py-8">No hay scans para este módulo</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.job_id as string}
                  onClick={() => selectJob(job)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                    selected?.job_id === job.job_id
                      ? "bg-sp-bg-elevated border border-sp-cyan/30"
                      : "bg-sp-bg-secondary border border-sp-border hover:border-sp-cyan/20"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", {
                    "bg-sp-low": job.status === "completed",
                    "bg-sp-cyan animate-pulse": job.status === "running",
                    "bg-sp-orange animate-pulse": job.status === "pending",
                    "bg-sp-critical": job.status === "failed",
                  })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-sp-text truncate">{job.target as string}</p>
                    <p className="text-xs text-sp-muted">{formatDate(job.created_at as string)}</p>
                  </div>
                  <span className={cn("text-xs font-mono font-semibold", statusColor(job.status as string))}>
                    {(job.status as string).toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Job detail */}
        <div className="sp-card p-5 flex flex-col gap-4">
          {!selected ? (
            <div className="flex items-center justify-center h-48 text-sp-muted text-sm">
              Seleccioná un scan para ver el detalle
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sp-text text-sm">Detalle del Scan</h2>
                {polling && <RefreshCw className="w-4 h-4 text-sp-cyan animate-spin" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Job ID", value: selected.job_id.slice(0, 8) + "...", mono: true },
                  { label: "Estado",  value: selected.status.toUpperCase(), color: statusColor(selected.status) },
                  { label: "Target",  value: selected.target ?? "—" },
                  { label: "Módulo",  value: selected.module ?? moduleId, mono: true },
                ].map(({ label, value, mono, color }) => (
                  <div key={label} className="bg-sp-bg-secondary rounded-lg p-3">
                    <p className="text-xs text-sp-muted mb-1">{label}</p>
                    <p className={cn("text-sm font-semibold truncate", mono ? "font-mono text-sp-cyan" : "text-sp-text", color)}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Progress bar — visible while running or pending */}
              {(isActive || selected.status === "completed") && (
                <div>
                  <div className="flex justify-between text-xs text-sp-muted mb-1">
                    <span>Progreso</span>
                    <span className="font-mono">{selected.progress ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-sp-bg-secondary rounded-full overflow-hidden border border-sp-border">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        selected.status === "completed" ? "bg-sp-low" : "bg-sp-cyan"
                      )}
                      style={{ width: `${selected.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Live logs terminal */}
              {logs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-3.5 h-3.5 text-sp-muted" />
                    <p className="text-xs font-semibold text-sp-muted uppercase tracking-widest">Log de ejecución</p>
                    {isActive && <span className="ml-auto text-xs text-sp-cyan animate-pulse">● live</span>}
                  </div>
                  <div className="bg-[#0a0d12] border border-sp-border rounded-lg p-3 font-mono text-xs leading-relaxed h-48 overflow-y-auto">
                    {logs.map((line, i) => {
                      const isDiscovery = line.includes("Discovered open port");
                      const isError = line.includes("Error") || line.includes("failed");
                      const isComplete = line.includes("completado") || line.includes("finalizado");
                      return (
                        <p key={i} className={cn(
                          "whitespace-pre-wrap break-all",
                          isDiscovery ? "text-sp-low font-semibold" :
                          isError     ? "text-sp-critical" :
                          isComplete  ? "text-sp-cyan" :
                          "text-sp-muted"
                        )}>
                          {line}
                        </p>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {/* Findings — only when completed */}
              {selected.status === "completed" && selected.result && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-sp-muted uppercase tracking-widest">Hallazgos</p>
                    <button className="sp-btn-ghost text-xs py-1 px-3 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Generar Reporte
                    </button>
                  </div>
                  {(() => {
                    const res = selected.result as Record<string, unknown>;
                    const findings = (res.findings as Record<string, unknown>[]) ?? [];
                    if (findings.length === 0) {
                      return <p className="text-sp-muted text-sm">Sin puertos abiertos encontrados</p>;
                    }
                    return (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {findings.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 bg-sp-bg-secondary rounded-lg px-3 py-2">
                            <SeverityBadge severity={f.severity as Severity} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-sp-text">{f.title as string}</p>
                              <p className="text-xs text-sp-muted truncate">{f.description as string}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {selected.status === "failed" && (
                <p className="text-sp-critical text-sm bg-sp-critical/10 rounded-lg px-4 py-2">
                  {(selected.result as Record<string, unknown>)?.error as string ?? "El scan falló"}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
