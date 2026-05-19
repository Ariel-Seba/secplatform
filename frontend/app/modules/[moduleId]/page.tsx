"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { formatDate, statusColor, cn } from "@/lib/utils";
import { Play, RefreshCw, FileText, Target, Radar, ShieldCheck } from "lucide-react";
import type { Severity } from "@/lib/utils";

const moduleConfig: Record<string, { label: string; icon: React.ElementType; color: string; placeholder: string }> = {
  pentest:    { label: "Pentest",     icon: Target,      color: "text-sp-high",  placeholder: "192.168.1.0/24 o https://target.com" },
  discovery:  { label: "Discovery",   icon: Radar,       color: "text-sp-cyan",  placeholder: "target.com" },
  compliance: { label: "Compliance",  icon: ShieldCheck, color: "text-sp-teal",  placeholder: "192.168.1.100 o ./docker-compose.yml" },
};

export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const mod = moduleConfig[moduleId] ?? { label: moduleId, icon: Target, color: "text-sp-cyan", placeholder: "target" };
  const Icon = mod.icon;

  const [target, setTarget] = useState("");
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [polling, setPolling] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const all = await api.get<Record<string, unknown>[]>("/api/modules/jobs/");
      setJobs(all.filter((j) => j.module === moduleId));
    } catch {}
  }, [moduleId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setScanning(true);
    try {
      const res = await api.post<{ job_id: string }>(`/api/modules/${moduleId}/scan`, { target });
      await loadJobs();
      pollJob(res.job_id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al iniciar scan");
    } finally {
      setScanning(false);
    }
  }

  function pollJob(jobId: string) {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const status = await api.get<Record<string, unknown>>(`/api/modules/${moduleId}/scan/${jobId}`);
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
          <button type="submit" disabled={scanning} className="sp-btn-primary px-6">
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? "Scanning..." : "Iniciar"}
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
                  onClick={() => setSelected(job)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                    selected?.job_id === job.job_id
                      ? "bg-sp-bg-elevated border border-sp-cyan/30"
                      : "bg-sp-bg-secondary border border-sp-border hover:border-sp-border"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", {
                    "bg-sp-low": job.status === "completed",
                    "bg-sp-cyan animate-pulse": job.status === "running",
                    "bg-sp-orange": job.status === "pending",
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
        <div className="sp-card p-5">
          {!selected ? (
            <div className="flex items-center justify-center h-48 text-sp-muted text-sm">
              Seleccioná un scan para ver el detalle
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sp-text text-sm">Detalle del Scan</h2>
                {polling && <RefreshCw className="w-4 h-4 text-sp-cyan animate-spin" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Job ID", value: (selected.job_id as string).slice(0, 8) + "...", mono: true },
                  { label: "Estado",  value: (selected.status as string).toUpperCase(), color: statusColor(selected.status as string) },
                  { label: "Target",  value: selected.target as string },
                  { label: "Módulo",  value: selected.module as string, mono: true },
                ].map(({ label, value, mono, color }) => (
                  <div key={label} className="bg-sp-bg-secondary rounded-lg p-3">
                    <p className="text-xs text-sp-muted mb-1">{label}</p>
                    <p className={cn("text-sm font-semibold truncate", mono ? "font-mono text-sp-cyan" : "text-sp-text", color)}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {selected.status === "running" && (
                <div>
                  <div className="flex justify-between text-xs text-sp-muted mb-1">
                    <span>Progreso</span>
                    <span className="font-mono">{selected.progress as number}%</span>
                  </div>
                  <div className="h-1.5 bg-sp-bg-secondary rounded-full overflow-hidden border border-sp-border">
                    <div
                      className="h-full bg-sp-cyan rounded-full transition-all duration-500"
                      style={{ width: `${selected.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {selected.status === "completed" && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-sp-muted uppercase tracking-widest">Hallazgos</p>
                    <button className="sp-btn-ghost text-xs py-1 px-3">
                      <FileText className="w-3 h-3" />
                      Generar Reporte
                    </button>
                  </div>
                  {selected.result ? (
                    <div className="bg-sp-bg-secondary rounded-lg p-3 font-mono text-xs text-sp-muted max-h-40 overflow-y-auto">
                      <pre>{JSON.stringify(selected.result, null, 2)}</pre>
                    </div>
                  ) : (
                    <p className="text-sp-muted text-sm">Sin hallazgos disponibles</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
