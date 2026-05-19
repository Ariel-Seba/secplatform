"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { formatDate } from "@/lib/utils";
import {
  FileText, Plus, Download, RefreshCw, X, ChevronDown
} from "lucide-react";

const TEMPLATES = ["executive", "technical", "compliance", "discovery"] as const;
type Template = typeof TEMPLATES[number];

interface Report {
  id: string;
  title: string;
  template: Template;
  client_name: string;
  pdf_path: string | null;
  created_at: string;
}

interface ScanJob {
  job_id: string;
  module: string;
  target: string;
  status: string;
  created_at: string;
}

const templateInfo: Record<Template, { label: string; desc: string; color: string }> = {
  executive:  { label: "Executive",  desc: "C-Suite / Client (5-8 pages)", color: "text-sp-purple" },
  technical:  { label: "Technical",  desc: "Engineering team (detailed findings)", color: "text-sp-cyan" },
  compliance: { label: "Compliance", desc: "Audit / Legal (controls + gaps)", color: "text-sp-teal" },
  discovery:  { label: "Discovery",  desc: "Attack surface overview", color: "text-sp-orange" },
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    template: "executive" as Template,
    client_name: "",
    job_ids: [] as string[],
  });

  const fetchReports = () =>
    api.get<Report[]>("/api/reports/").then(setReports).catch(() => {});

  const fetchJobs = () =>
    api.get<ScanJob[]>("/api/modules/jobs/")
      .then((j) => setJobs(j.filter((job) => job.status === "completed")))
      .catch(() => {});

  useEffect(() => {
    Promise.all([fetchReports(), fetchJobs()]).finally(() => setLoading(false));
  }, []);

  const toggleJob = (id: string) => {
    setForm((f) => ({
      ...f,
      job_ids: f.job_ids.includes(id)
        ? f.job_ids.filter((j) => j !== id)
        : [...f.job_ids, id],
    }));
  };

  const generate = async () => {
    if (!form.title || !form.client_name) {
      setError("Title and client name are required.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      await api.post("/api/reports/", form);
      setShowForm(false);
      setForm({ title: "", template: "executive", client_name: "", job_ids: [] });
      await fetchReports();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sp-text">Reports</h1>
          <p className="text-sp-muted text-sm mt-1">Generate and download security reports</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="sp-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Report
        </button>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TEMPLATES.map((t) => (
          <div key={t} className="sp-card p-4 hover:border-sp-cyan/30 transition-all">
            <FileText className={`w-6 h-6 mb-2 ${templateInfo[t].color}`} />
            <p className="font-semibold text-sp-text text-sm">{templateInfo[t].label}</p>
            <p className="text-sp-muted text-xs mt-1">{templateInfo[t].desc}</p>
          </div>
        ))}
      </div>

      {/* Report list */}
      <div className="sp-card">
        <div className="flex items-center justify-between p-5 border-b border-sp-border">
          <h2 className="font-semibold text-sp-text flex items-center gap-2">
            <FileText className="w-4 h-4 text-sp-cyan" />
            Generated Reports
          </h2>
          <button onClick={fetchReports} className="sp-btn-ghost p-2 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-sp-muted text-sm">
            No reports yet. Generate your first report above.
          </div>
        ) : (
          <div className="divide-y divide-sp-border">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-sp-bg-secondary transition-all">
                <FileText className={`w-5 h-5 flex-shrink-0 ${templateInfo[r.template as Template]?.color ?? "text-sp-muted"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sp-text text-sm truncate">{r.title}</p>
                  <p className="text-xs text-sp-muted">{r.client_name} · {templateInfo[r.template as Template]?.label} · {formatDate(r.created_at)}</p>
                </div>
                {r.pdf_path ? (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/reports/${r.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="sp-btn-ghost flex items-center gap-1 text-xs px-3 py-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                ) : (
                  <span className="text-xs text-sp-subtle italic px-3 py-1.5">Generating…</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New report modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="sp-card w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sp-text text-lg">Generate Report</h3>
              <button onClick={() => setShowForm(false)} className="sp-btn-ghost p-2 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-sp-critical text-sm bg-sp-critical/10 rounded-lg px-4 py-2">{error}</p>}

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Report Title</span>
                <input
                  className="sp-input mt-1 w-full"
                  placeholder="e.g. Pentest Report Q2 2025"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Client / Organization</span>
                <input
                  className="sp-input mt-1 w-full"
                  placeholder="e.g. Acme Corp"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">Template</span>
                <div className="relative mt-1">
                  <select
                    className="sp-input w-full appearance-none"
                    value={form.template}
                    onChange={(e) => setForm({ ...form, template: e.target.value as Template })}
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t} value={t}>{templateInfo[t].label} — {templateInfo[t].desc}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sp-muted pointer-events-none" />
                </div>
              </label>

              <div>
                <span className="text-xs font-semibold text-sp-muted uppercase tracking-wider">
                  Scan Jobs ({form.job_ids.length} selected)
                </span>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto border border-sp-border rounded-lg p-2">
                  {jobs.length === 0 ? (
                    <p className="text-sp-subtle text-xs text-center py-2">No completed scans available</p>
                  ) : jobs.map((job) => (
                    <label key={job.job_id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-sp-bg-elevated cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.job_ids.includes(job.job_id)}
                        onChange={() => toggleJob(job.job_id)}
                        className="accent-sp-cyan"
                      />
                      <span className="text-xs font-mono text-sp-muted">[{job.module}]</span>
                      <span className="text-xs text-sp-text truncate flex-1">{job.target}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="sp-btn-ghost flex-1">Cancel</button>
              <button
                onClick={generate}
                disabled={generating}
                className="sp-btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {generating ? "Generating…" : "Generate PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
