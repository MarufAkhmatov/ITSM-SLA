import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

// Default to same-origin "/api" (Vite proxies it to the Python backend). This
// lets the dashboard work unchanged over localhost, the LAN IP, or a public
// tunnel — the phone never needs to know the backend's address.
// Override with VITE_API_URL only for a split deployment.
const API = (import.meta as any).env?.VITE_API_URL ?? "";

interface PortfolioState {
  data: any | null;          // { widgets, kpis, meta }
  loading: boolean;
  online: boolean;
  meta: any | null;
  refresh: () => void;
  upload: (file: File, mode?: "replace" | "merge") => Promise<any>;
  uploadBatch: (files: File[], mode?: "replace" | "merge", onProgress?: (done: number, total: number, current: string, lastResult?: any) => void) => Promise<{ results: any[]; summary: any }>;
  ask: (q: string, lang?: string, opts?: { scope?: string; context?: string }) => Promise<any>;
  pmBoard: (period: string) => Promise<any>;
  notifications: () => Promise<any>;
  dataQuality: () => Promise<any>;
  statusAudit: () => Promise<any>;
  drill: (params: Record<string, string>) => Promise<any>;
  issueDetail: (key: string) => Promise<any>;
  issueSummary: (key: string) => Promise<any>;
  issueRecommend: (key: string) => Promise<any>;
  ttm: (params: Record<string, string>) => Promise<any>;
  analyze: (text: string) => Promise<any>;
  calendar: (params: Record<string, string>) => Promise<any>;
  risk: () => Promise<any>;
  flow: (params: Record<string, string>) => Promise<any>;
  epicQuality: () => Promise<any>;
  epicQualityRecommend: (key: string, lang?: string) => Promise<any>;
}

const Ctx = createContext<PortfolioState>({
  data: null, loading: true, online: false, meta: null,
  refresh: () => {}, upload: async () => ({}), uploadBatch: async () => ({ results: [], summary: {} }), ask: async () => ({}),
  pmBoard: async () => ({ rows: [] }), notifications: async () => ({ epics: [], tasks: [] }),
  dataQuality: async () => ({ fields: [] }), statusAudit: async () => ({ has_data: false }), drill: async () => ({ issues: [] }),
  issueDetail: async () => ({ found: false }),
  issueSummary: async () => ({ found: false }),
  issueRecommend: async () => ({ found: false }),
  ttm: async () => ({ has_data: false }),
  analyze: async () => ({ similar: [], recommendation: "" }),
  calendar: async () => ({ events: [], types: [] }),
  risk: async () => ({ rollup: {}, register: [], heatmap: [], blocked: {}, aging: [], insights: [], health_buckets: {} }),
  flow: async () => ({ series: [], summary: {} }),
  epicQuality: async () => ({ count: 0, flagged: [] }),
  epicQualityRecommend: async () => ({ found: false }),
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [meta, setMeta] = useState<any | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/dashboard`);
      const j = await r.json();
      setOnline(true);
      if (j.has_data) { setData(j); setMeta(j.meta); }
      else { setData(null); setMeta(null); }
    } catch {
      setOnline(false);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = useCallback(async (file: File, mode: "replace" | "merge" = "replace") => {
    const r = await fetch(`${API}/api/upload?filename=${encodeURIComponent(file.name)}&mode=${mode}`, {
      method: "POST", body: file,
    });
    const j = await r.json();
    await refresh();
    return j;
  }, [refresh]);

  // Batch upload: orchestrates many files in the correct daily-ingest order
  // (issue exports first → history XLSX last). First non-history file uses the
  // requested mode; remaining non-history files merge so a single batch can
  // build PMD + PMO together. History files always enrich the live dataset.
  const uploadBatch = useCallback(async (
    files: File[],
    mode: "replace" | "merge" = "replace",
    onProgress?: (done: number, total: number, current: string, lastResult?: any) => void,
  ) => {
    const isHistory = (f: File) => {
      const n = f.name.toLowerCase();
      return /history/.test(n) && /\.xlsx?$|\.xlsm$/.test(n);
    };
    // Order: non-history (alpha — PMD before PMO) → history (alpha)
    const sorted = [...files].sort((a, b) => {
      const ah = isHistory(a) ? 1 : 0, bh = isHistory(b) ? 1 : 0;
      if (ah !== bh) return ah - bh;
      return a.name.localeCompare(b.name);
    });
    const results: any[] = [];
    let usedReplace = false;
    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      onProgress?.(i, sorted.length, f.name);
      // First non-history uses requested mode; the rest merge so PMD + PMO
      // accumulate in one dataset. History files don't use mode at all.
      const fileMode: "replace" | "merge" = isHistory(f)
        ? "merge"
        : (!usedReplace && mode === "replace" ? "replace" : "merge");
      if (!isHistory(f) && fileMode === "replace") usedReplace = true;
      try {
        const r = await fetch(`${API}/api/upload?filename=${encodeURIComponent(f.name)}&mode=${fileMode}`, {
          method: "POST", body: f,
        });
        const j = await r.json();
        results.push({ file: f.name, ok: !!j?.ok, kind: j?.kind, meta: j?.meta, enriched: j?.enriched, error: j?.error });
        onProgress?.(i + 1, sorted.length, f.name, j);
      } catch (e: any) {
        results.push({ file: f.name, ok: false, error: e?.message || "network error" });
        onProgress?.(i + 1, sorted.length, f.name, { ok: false, error: e?.message });
      }
    }
    await refresh();
    const summary = {
      total: results.length,
      ok: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      enriched: results.reduce((s, r) => s + (r.enriched || 0), 0),
      lastMeta: results.filter(r => r.ok && r.meta).slice(-1)[0]?.meta,
    };
    return { results, summary };
  }, [refresh]);

  const ask = useCallback(async (q: string, lang: string = "en", opts?: { scope?: string; context?: string }) => {
    try {
      const r = await fetch(`${API}/api/aria`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang, scope: opts?.scope, context: opts?.context }),
      });
      return await r.json();
    } catch {
      return { answer: "Temur backend is offline. Start the backend (python backend/server.py).", source: "system" };
    }
  }, []);

  const pmBoard = useCallback(async (period: string) => {
    try {
      const r = await fetch(`${API}/api/pm-leaderboard?period=${encodeURIComponent(period)}`);
      return await r.json();
    } catch {
      return { rows: [] };
    }
  }, []);

  const notifications = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/notifications`);
      return await r.json();
    } catch {
      return { epics: [], tasks: [] };
    }
  }, []);

  const dataQuality = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/data-quality`);
      return await r.json();
    } catch {
      return { fields: [] };
    }
  }, []);

  const statusAudit = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/status-audit`);
      return await r.json();
    } catch {
      return { has_data: false };
    }
  }, []);

  const drill = useCallback(async (params: Record<string, string>) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${API}/api/issues?${qs}`);
      return await r.json();
    } catch {
      return { issues: [] };
    }
  }, []);

  const issueDetail = useCallback(async (key: string) => {
    try {
      const r = await fetch(`${API}/api/issue?key=${encodeURIComponent(key)}`);
      return await r.json();
    } catch {
      return { found: false };
    }
  }, []);

  const issueSummary = useCallback(async (key: string) => {
    try {
      const r = await fetch(`${API}/api/issue-summary?key=${encodeURIComponent(key)}`);
      return await r.json();
    } catch {
      return { found: false };
    }
  }, []);

  const issueRecommend = useCallback(async (key: string) => {
    try {
      const r = await fetch(`${API}/api/issue-recommend?key=${encodeURIComponent(key)}`);
      return await r.json();
    } catch {
      return { found: false };
    }
  }, []);

  const ttm = useCallback(async (params: Record<string, string>) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${API}/api/ttm?${qs}`);
      return await r.json();
    } catch {
      return { has_data: false };
    }
  }, []);

  const analyze = useCallback(async (text: string) => {
    try {
      const r = await fetch(`${API}/api/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return await r.json();
    } catch {
      return { similar: [], recommendation: "" };
    }
  }, []);

  const calendar = useCallback(async (params: Record<string, string>) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${API}/api/calendar?${qs}`);
      return await r.json();
    } catch {
      return { events: [], types: [] };
    }
  }, []);

  const risk = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/risk`);
      return await r.json();
    } catch {
      return { rollup: {}, register: [], heatmap: [], blocked: {}, aging: [], insights: [], health_buckets: {} };
    }
  }, []);

  const flow = useCallback(async (params: Record<string, string>) => {
    try {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${API}/api/flow?${qs}`);
      return await r.json();
    } catch {
      return { series: [], summary: {} };
    }
  }, []);

  const epicQuality = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/epic-quality`);
      return await r.json();
    } catch {
      return { count: 0, flagged: [] };
    }
  }, []);

  const epicQualityRecommend = useCallback(async (key: string, lang: string = "ru") => {
    try {
      const r = await fetch(`${API}/api/epic-quality-recommend?key=${encodeURIComponent(key)}&lang=${lang}`);
      return await r.json();
    } catch {
      return { found: false };
    }
  }, []);

  return (
    <Ctx.Provider value={{ data, loading, online, meta, refresh, upload, uploadBatch, ask, pmBoard, notifications, dataQuality, statusAudit, drill, issueDetail, issueSummary, issueRecommend, ttm, analyze, calendar, risk, flow, epicQuality, epicQualityRecommend }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePortfolio = () => useContext(Ctx);
