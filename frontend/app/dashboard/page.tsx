"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { formatDate, statusColor } from "@/lib/utils";
import {
  Activity, AlertTriangle, CheckCircle, FileText,
  Target, Radar, ShieldCheck, ArrowRight
} from "lucide-react";
import Link from "next/link";
import type { Severity } from "@/lib/utils";

const modules = [
  { id: "pentest",    label: "Pentest",    icon: Target,      color: "text-sp-high",   href: "/modules/pentest" },
  { id: "discovery",  label: "Discovery",  icon: Radar,       color: "text-sp-cyan",   href: "/modules/discovery" },
  { id: "compliance", label: "Compliance", icon: ShieldCheck, color: "text-sp-teal",   href: "/modules/compliance" },
];

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, unknown>[]>("/api/modules/jobs/")
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total:     jobs.length,
    completed: jobs.filter((j) => j.status === "completed").length,
    running:   jobs.filter((j) => j.status === "running").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-sp-text">Dashboard</h1>
        <p className="text-sp-muted text-sm mt-1">Resumen de operaciones de seguridad</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Scans"   value={stats.total}     icon={Activity}      accent="cyan" />
        <StatCard label="Completados"   value={stats.completed} icon={CheckCircle}   accent="teal" />
        <StatCard label="En Progreso"   value={stats.running}   icon={AlertTriangle} accent="orange" />
        <StatCard label="Módulos"       value={3}               icon={FileText}      accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent jobs */}
        <div className="lg:col-span-2 sp-card p-5">
          <h2 className="font-semibold text-sp-text mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sp-cyan" />
            Actividad Reciente
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg skeleton" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sp-muted text-sm text-center py-10">No hay scans aún. ¡Iniciá uno desde un módulo!</p>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 10).map((job) => (
                <div key={job.job_id as string}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg bg-sp-bg-secondary border border-sp-border hover:border-sp-cyan/20 transition-all">
                  <div className="w-2 h-2 rounded-full bg-current flex-shrink-0" style={{ color: "inherit" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-sp-muted truncate">{job.target as string}</p>
                    <p className="text-xs text-sp-subtle">{formatDate(job.created_at as string)}</p>
                  </div>
                  <span className="text-xs font-mono uppercase font-semibold text-sp-muted">{job.module as string}</span>
                  <span className={`text-xs font-semibold font-mono ${statusColor(job.status as string)}`}>
                    {(job.status as string).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modules quick access */}
        <div className="sp-card p-5">
          <h2 className="font-semibold text-sp-text mb-4">Módulos Disponibles</h2>
          <div className="space-y-3">
            {modules.map((mod) => (
              <Link key={mod.id} href={mod.href}
                className="flex items-center gap-3 p-4 rounded-lg bg-sp-bg-secondary border border-sp-border hover:border-sp-cyan/30 hover:bg-sp-bg-elevated transition-all group">
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
                <span className="flex-1 font-medium text-sp-text text-sm">{mod.label}</span>
                <ArrowRight className="w-4 h-4 text-sp-muted group-hover:text-sp-cyan transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
