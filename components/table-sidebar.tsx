"use client";
import React from "react";
import type { TableRow, MapLayer, LayerControl, AttrOperator, FillColorRule, TemporalMode } from "@/lib/types";
import { BASEMAP_OPTIONS } from "@/lib/types";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { ImportTasksPanel } from "@/components/import-tasks-panel";
import { DeleteTableDialog } from "@/components/delete-table-dialog";
import { RenameTableDialog } from "@/components/rename-table-dialog";
import { AttributeTableDialog } from "@/components/attribute-table-dialog";
import { TableInfoDialog } from "@/components/table-info-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Eye, EyeOff, X, Plus,
  Check, MapPin, TriangleAlert, Maximize2, Folder, GripVertical, Table2, Globe, Lock,
  Calendar, Hash, List, Filter, Paintbrush, Sliders, Tag, PanelLeftClose, PanelLeft,
} from "lucide-react";

interface Props {
  connectionId: string;
  connectionLoaded?: boolean;
  layers: MapLayer[];
  onAddLayer: (table: TableRow) => void;
  onRemoveLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
  onReorderLayers: (newOrder: string[]) => void;
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  onZoomToLayer?: (layer: MapLayer) => void;
  onZoomToTable?: (table: TableRow) => void;
  onFlyTo?: (bounds: [[number, number], [number, number]]) => void;
  onOpenSettings?: () => void;
  basemap: string;
  onBasemapChange: (key: string) => void;
}

// ─── connection error helper ─────────────────────────────────────────────────
function friendlyConnError(msg: string): { title: string; detail: string } {
  if (/ETIMEDOUT|timeout|timed out/i.test(msg))
    return { title: "Connection timed out", detail: "If your database requires IP allowlisting, make sure this server's IP address is added to the allowlist." };
  if (/ssl.*required|no pg_hba|SSL SYSCALL|SSL connection/i.test(msg))
    return { title: "SSL required", detail: "Add sslmode=require to your connection string and try again." };
  if (/ECONNREFUSED/i.test(msg))
    return { title: "Connection refused", detail: "Check that the host and port are correct and the database server is running." };
  if (/password authentication failed/i.test(msg))
    return { title: "Authentication failed", detail: "The username or password in your connection string is incorrect." };
  if (/database .* does not exist/i.test(msg))
    return { title: "Database not found", detail: "Check that the database name in your connection string is correct." };
  if (/ENOTFOUND|getaddrinfo/i.test(msg))
    return { title: "Host not found", detail: "The hostname in your connection string could not be resolved. Check for typos." };
  if (/POSTGRES_URL|storage database/i.test(msg))
    return { title: "Storage not configured", detail: "Set POSTGRES_URL in your .env file to enable saved connections. See .env.example for setup instructions." };
  return { title: "Connection error", detail: msg };
}

// ─── filter helpers ──────────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<AttrOperator, string> = {
  ilike: "contains", eq: "equals", neq: "not equals",
  gt: ">", lt: "<", gte: "≥", lte: "≤",
  is_null: "is null", is_not_null: "is not null", starts_with: "starts with",
  in: "in", not_in: "not in", date_between: "between dates",
};
const ALL_OPERATORS = Object.keys(OPERATOR_LABELS) as AttrOperator[];
const NULL_OPERATORS: AttrOperator[] = ["is_null", "is_not_null"];
const DATE_OPERATORS: AttrOperator[] = ["date_between"];

const NUMERIC_TYPES_SET = new Set([
  "smallint", "integer", "bigint", "decimal", "numeric", "real", "double precision", "money",
]);


const CAT_COLORS = [
  "#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00",
  "#a65628","#f781bf","#ffed6f","#66c2a5","#fc8d62",
  "#8da0cb","#e78ac3",
];



function InValuePicker({
  connectionId, schema, table, column, value, onChange,
}: {
  connectionId: string; schema: string; table: string; column: string;
  value: string; onChange: (v: string) => void;
}) {
  const [distinctValues, setDistinctValues] = React.useState<string[] | null>(null);
  const [truncated, setTruncated] = React.useState(false);

  React.useEffect(() => {
    if (!connectionId || !schema || !table || !column) return;
    setDistinctValues(null);
    fetch("/api/pg/column-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema, table, column }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.values) { setDistinctValues(data.values); setTruncated(!!data.truncated); }
      })
      .catch(() => {});
  }, [connectionId, schema, table, column]);

  const selected = React.useMemo(() => new Set(value.split(",").map((v) => v.trim()).filter(Boolean)), [value]);

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange([...next].join(","));
  }

  if (truncated || distinctValues === null && !truncated) {
    return (
      <Input
        value={value}
        placeholder={distinctValues === null ? "Loading…" : "comma-separated values"}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[11px] flex-1 min-w-0 max-w-30"
      />
    );
  }

  return (
    <div className="w-full min-w-0 border rounded max-h-28 overflow-x-hidden overflow-y-auto bg-background">
      {distinctValues!.map((v) => (
        <label key={v} className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-muted/40 cursor-pointer min-w-0 max-w-50">
          <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)} className="h-3 w-3 shrink-0" />
          <span className="text-[11px] truncate font-mono min-w-0 flex-1" title={v}>{v}</span>
        </label>
      ))}
      {distinctValues!.length === 0 && (
        <p className="text-[10px] text-muted-foreground px-2 py-1">No values</p>
      )}
    </div>
  );
}

// ─── filter type icons ────────────────────────────────────────────────────────
function FilterTypeIcon({ type }: { type: LayerControl["type"] }) {
  if (type === "temporal") return <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />;
  if (type === "categorical") return <List className="h-3 w-3 shrink-0 text-muted-foreground" />;
  if (type === "numeric") return <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />;
  return <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

// ─── dual range slider (for temporal + numeric filters) ───────────────────────
function DualRangeSlider({ fromPos, toPos, onChange }: {
  fromPos: number; toPos: number;
  onChange: (from: number, to: number) => void;
}) {
  return (
    <div className="relative h-4 flex items-center">
      <div className="absolute h-1 rounded bg-muted w-full" />
      <div className="absolute h-1 rounded bg-primary"
        style={{ left: `${(fromPos / 1000) * 100}%`, right: `${((1000 - toPos) / 1000) * 100}%` }} />
      <input type="range" min={0} max={1000} value={fromPos}
        onChange={(e) => onChange(Math.min(Number(e.target.value), toPos - 1), toPos)}
        className="absolute w-full h-1 opacity-0 cursor-pointer"
        style={{ zIndex: fromPos > 500 ? 5 : 3 }} />
      <input type="range" min={0} max={1000} value={toPos}
        onChange={(e) => onChange(fromPos, Math.max(Number(e.target.value), fromPos + 1))}
        className="absolute w-full h-1 opacity-0 cursor-pointer" style={{ zIndex: 4 }} />
      <div className="absolute w-3 h-3 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
        style={{ left: `calc(${(fromPos / 1000) * 100}% - 6px)`, zIndex: 6 }} />
      <div className="absolute w-3 h-3 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
        style={{ left: `calc(${(toPos / 1000) * 100}% - 6px)`, zIndex: 6 }} />
    </div>
  );
}

// ─── temporal filter editor ───────────────────────────────────────────────────
// ─── inline editable date label ──────────────────────────────────────────────
function InlineEditDate({ value, onChange, fmt: fmtFn, align = "left", className }: {
  value: string; onChange: (v: string) => void;
  fmt?: (v: string) => string; align?: "left" | "right"; className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const format = fmtFn ?? ((v: string) => v.slice(0, 10));
  if (editing) {
    return (
      <input autoFocus type="date" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft) onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
        className={`bg-transparent border-b border-primary outline-none text-[9px] w-24 ${align === "right" ? "text-right" : ""} ${className ?? ""}`}
      />
    );
  }
  return (
    <span onClick={() => { setEditing(true); setDraft(value.slice(0, 10)); }}
      className={`cursor-pointer hover:font-bold hover:text-foreground transition-all ${className ?? ""}`}
    >{format(value)}</span>
  );
}

// ─── temporal histogram (YouTube-style density bar chart) ────────────────────
function TemporalHistogram({ snapPoints, snapCounts, activeFrom, activeTo, mode }: {
  snapPoints: string[]; snapCounts: number[];
  activeFrom: number; activeTo: number;
  mode: "range" | "snapshot";
}) {
  if (snapPoints.length < 2 || snapCounts.length !== snapPoints.length) return null;
  const BAR_H = 28;
  const maxCount = Math.max(...snapCounts, 1);
  return (
    <svg width="100%" height={BAR_H} className="overflow-visible" style={{ display: "block" }}>
      {snapPoints.map((_, i) => {
        const pct = (i / (snapPoints.length - 1)) * 100;
        const h = Math.max(2, (snapCounts[i] / maxCount) * BAR_H);
        const isActive = mode === "snapshot" ? i === activeFrom : i >= activeFrom && i <= activeTo;
        // Bar width spans from midpoint to previous to midpoint to next
        const prevPct = i > 0 ? (((i - 0.5) / (snapPoints.length - 1)) * 100) : 0;
        const nextPct = i < snapPoints.length - 1 ? (((i + 0.5) / (snapPoints.length - 1)) * 100) : 100;
        return (
          <rect
            key={i}
            x={`${prevPct}%`}
            width={`${nextPct - prevPct}%`}
            y={BAR_H - h}
            height={h}
            className={isActive ? "fill-primary/80" : "fill-muted-foreground/20"}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

function TemporalFilterEditor({ f, layer, connectionId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "temporal" }>;
  layer: MapLayer; connectionId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [cols, setCols] = React.useState<string[]>([]);
  const [loadingExtent, setLoadingExtent] = React.useState(false);
  const [snapPoints, setSnapPoints] = React.useState<string[]>(() => (f as any).snapPoints ?? []);
  const [snapCounts, setSnapCounts] = React.useState<number[]>(() => (f as any).snapCounts ?? []);

  function dateToIdx(date: string): number {
    if (snapPoints.length > 1) {
      const t = new Date(date).getTime();
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < snapPoints.length; i++) {
        const dist = Math.abs(new Date(snapPoints[i]).getTime() - t);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      return best;
    }
    const t = new Date(date).getTime(), lo = new Date(f.dataMin).getTime(), hi = new Date(f.dataMax).getTime();
    if (hi === lo) return 0;
    return Math.round(((t - lo) / (hi - lo)) * 1000);
  }

  React.useEffect(() => {
    fetch("/api/pg/columns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name }) })
      .then(r => r.json()).then(d => {
        setCols((d.columns ?? []).filter((c: any) =>
          c.dataType === "timestamp with time zone" || c.dataType === "timestamp without time zone" || c.dataType === "date"
        ).map((c: any) => c.name));
      }).catch(() => {});
  }, [connectionId, layer.table.table_schema, layer.table.table_name]);

  // Auto-fetch extent when a column is set but dataMin hasn't been loaded yet
  // (happens when the control is first created — deployWithColumn doesn't fetch extent)
  React.useEffect(() => {
    if (f.column && !f.dataMin) fetchExtent(f.column);
  }, [f.column]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchExtent(col: string) {
    setLoadingExtent(true);
    setSnapPoints([]); setSnapCounts([]);
    try {
      const [extRes, cntRes] = await Promise.all([
        fetch("/api/pg/datetime-extent", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) }),
        fetch("/api/pg/column-value-counts", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) }),
      ]);
      const ext = await extRes.json();
      const cnt = await cntRes.json();
      if (ext.min && ext.max) {
        update({ column: col, dataMin: ext.min, dataMax: ext.max, from: ext.min, to: ext.max });
      }
      if (cnt.counts?.length > 1) {
        const sorted: { value: string; count: number }[] = [...cnt.counts].sort(
          (a, b) => new Date(a.value).getTime() - new Date(b.value).getTime()
        );
        const pts = sorted.map(r => r.value);
        const cts = sorted.map(r => r.count);
        setSnapPoints(pts);
        setSnapCounts(cts);
        update({ snapPoints: pts, snapCounts: cts } as any);
      }
    } finally { setLoadingExtent(false); }
  }

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, ...patch } : fi) as LayerControl[] });
  }

  const fmtLabel = (s: string) => {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch { return s.slice(0, 10); }
  };

  return (
    <div className="space-y-1.5 mt-1">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-12 shrink-0">Column</span>
        <Select value={f.column} onValueChange={fetchExtent}>
          <SelectTrigger className="h-6 text-[11px] flex-1 font-mono">
            <SelectValue placeholder={loadingExtent ? "Loading…" : "select column"} />
          </SelectTrigger>
          <SelectContent>
            {cols.map(c => <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1">
        {(["all", "range", "snapshot"] as TemporalMode[]).map(m => (
          <button key={m} onClick={() => update({ mode: m })}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${f.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground border hover:text-foreground"}`}>
            {m === "all" ? "All" : m === "range" ? "Range" : "Snapshot"}
          </button>
        ))}
      </div>

      {f.dataMin && (
        <div className="space-y-0.5">
          {f.mode === "range" && (
            <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
              <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.to.slice(0, 10)}
                onChange={e => update({ from: e.target.value })}
                className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
              <span className="text-muted-foreground">to</span>
              <input type="date" value={f.to.slice(0, 10)} min={f.from.slice(0, 10)} max={f.dataMax.slice(0, 10)}
                onChange={e => update({ to: e.target.value })}
                className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
            </div>
          )}
          {f.mode === "snapshot" && (
            <div className="flex justify-center mb-1">
              <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.dataMax.slice(0, 10)}
                onChange={e => { const d = e.target.value; update({ from: d, to: d }); }}
                className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
            </div>
          )}

          {/* Density histogram — always visible so you can see data distribution */}
          {snapPoints.length > 1 && snapCounts.length === snapPoints.length && (
            <TemporalHistogram
              snapPoints={snapPoints} snapCounts={snapCounts}
              activeFrom={f.mode === "all" ? 0 : dateToIdx(f.from)}
              activeTo={f.mode === "all" ? snapPoints.length - 1 : (f.mode === "snapshot" ? dateToIdx(f.from) : dateToIdx(f.to))}
              mode={f.mode === "snapshot" ? "snapshot" : "range"}
            />
          )}

          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <InlineEditDate value={f.dataMin} fmt={fmtLabel} onChange={v => { if (v < f.dataMax.slice(0, 10)) update({ dataMin: v, from: v }); }} />
            <InlineEditDate value={f.dataMax} fmt={fmtLabel} onChange={v => { if (v > f.dataMin.slice(0, 10)) update({ dataMax: v, to: v }); }} align="right" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── categorical filter editor ────────────────────────────────────────────────
function CategoricalFilterEditor({ f, layer, connectionId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "categorical" }>;
  layer: MapLayer; connectionId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [allValues, setAllValues] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Load allValues from rules if present, else fetch from DB
  React.useEffect(() => {
    if (!f.column) return;
    if (f.rules.length > 0) { setAllValues(f.rules.map(r => r.value)); return; }
    setLoading(true);
    fetch("/api/pg/column-values", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: f.column }) })
      .then(r => r.json())
      .then(d => {
        const vals: string[] = d.values ?? [];
        setAllValues(vals);
        // Auto-assign colors if rules are empty
        if (vals.length > 0 && f.rules.length === 0) {
          update({ rules: vals.map((v, i) => ({ value: v, color: CAT_COLORS[i % CAT_COLORS.length] })) });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [f.column, layer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, ...patch } : fi) as LayerControl[] });
  }

  function toggleValue(val: string) {
    const hidden = new Set(f.hiddenValues);
    if (hidden.has(val)) hidden.delete(val); else hidden.add(val);
    update({ hiddenValues: [...hidden] });
  }

  function setRuleColor(val: string, color: string) {
    const rules = f.rules.map(r => r.value === val ? { ...r, color } : r);
    update({ rules });
  }

  return (
    <div className="space-y-2 mt-1">
      <p className="text-[10px] text-muted-foreground font-mono">{f.column}</p>

      {/* Style on/off indicator */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full border shrink-0 ${f.enabled ? "bg-primary border-primary" : "border-muted-foreground"}`} />
        <span className="text-[10px] text-muted-foreground">
          {f.enabled ? "Colors applied to map" : "Colors not applied — enable control to use"}
        </span>
      </div>

      {loading && <p className="text-[10px] text-muted-foreground">Loading values…</p>}
      {!loading && allValues.length === 0 && <p className="text-[10px] text-muted-foreground">No values found.</p>}
      {allValues.length > 0 && (
        <>
          <div className="flex gap-2">
            <button onClick={() => update({ hiddenValues: [] })} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Show all</button>
            <button onClick={() => update({ hiddenValues: [...allValues] })} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Hide all</button>
          </div>
          <div className="space-y-0.5 max-h-44 overflow-y-auto">
            {allValues.map(val => {
              const hidden = f.hiddenValues.includes(val);
              const colorRule = f.rules.find(r => r.value === val);
              return (
                <div key={val} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-muted/40">
                  {/* Visibility toggle */}
                  <button onClick={() => toggleValue(val)}
                    className={`w-3 h-3 rounded border shrink-0 flex items-center justify-center transition-colors ${hidden ? "border-muted-foreground" : "bg-primary border-primary"}`}>
                    {!hidden && <Check className="h-2 w-2 text-primary-foreground" />}
                  </button>
                  {/* Color swatch + picker */}
                  <label className="cursor-pointer shrink-0">
                    <span className="block w-3.5 h-3.5 rounded-sm border border-border"
                      style={{ backgroundColor: colorRule?.color ?? f.defaultColor }} />
                    <input type="color" className="sr-only" value={colorRule?.color ?? f.defaultColor}
                      onChange={e => setRuleColor(val, e.target.value)} />
                  </label>
                  <span className={`text-[10px] truncate flex-1 ${hidden ? "line-through text-muted-foreground" : ""}`}>{val}</span>
                </div>
              );
            })}
          </div>
          {/* Default color for unmatched values */}
          <div className="flex items-center gap-1.5 pt-1 border-t">
            <label className="cursor-pointer flex items-center gap-1.5">
              <span className="block w-3.5 h-3.5 rounded-sm border border-border shrink-0"
                style={{ backgroundColor: f.defaultColor }} />
              <span className="text-[10px] text-muted-foreground">Other</span>
              <input type="color" className="sr-only" value={f.defaultColor}
                onChange={e => update({ defaultColor: e.target.value })} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// ─── threshold color editor ───────────────────────────────────────────────────
function ThresholdControlEditor({ f, layer, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "threshold" }>;
  layer: MapLayer;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, ...patch } : fi) as LayerControl[] });
  }

  return (
    <div className="space-y-2 mt-1">
      <p className="text-[10px] text-muted-foreground font-mono">{f.column}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Threshold</span>
        <input
          type="number"
          value={f.threshold}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) update({ threshold: v }); }}
          className="flex-1 text-[11px] bg-muted/30 border rounded px-2 py-0.5 outline-none focus:border-primary font-mono min-w-0 h-6"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer shrink-0">
            <span className="block w-3.5 h-3.5 rounded-sm border border-border" style={{ backgroundColor: f.aboveColor }} />
            <input type="color" className="sr-only" value={f.aboveColor} onChange={e => update({ aboveColor: e.target.value })} />
          </label>
          <span className="text-[10px] flex-1">≥ {f.threshold}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer shrink-0">
            <span className="block w-3.5 h-3.5 rounded-sm border border-border" style={{ backgroundColor: f.belowColor }} />
            <input type="color" className="sr-only" value={f.belowColor} onChange={e => update({ belowColor: e.target.value })} />
          </label>
          <span className="text-[10px] flex-1">{"< "}{f.threshold}</span>
        </div>
      </div>
    </div>
  );
}

// ─── numeric filter editor ────────────────────────────────────────────────────
// Inline editable number that shows as a clickable label until clicked
function InlineEditNumber({ value, onChange, className, align = "left", fmt: fmtFn }: {
  value: number; onChange: (v: number) => void;
  className?: string; align?: "left" | "right";
  fmt?: (v: number) => string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const format = fmtFn ?? ((n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2));
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { const v = parseFloat(draft); if (!isNaN(v)) onChange(v); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`bg-transparent border-b border-primary outline-none tabular-nums ${align === "right" ? "text-right" : ""} ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      onClick={() => { setEditing(true); setDraft(String(value)); }}
      className={`cursor-pointer hover:font-bold hover:text-foreground transition-all tabular-nums ${className ?? ""}`}
    >{format(value)}</span>
  );
}

function NumericFilterEditor({ f, layer, connectionId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "numeric" }>;
  layer: MapLayer; connectionId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [cols, setCols] = React.useState<string[]>([]);
  // Local slider state avoids stale closure issues during fast drags
  const [sliderRange, setSliderRange] = React.useState([f.min, f.max]);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from external changes (e.g. column switch resets range)
  React.useEffect(() => {
    setSliderRange([f.min, f.max]);
  }, [f.min, f.max]);

  React.useEffect(() => {
    fetch("/api/pg/columns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name }) })
      .then(r => r.json()).then(d => setCols((d.columns ?? []).filter((c: any) => NUMERIC_TYPES_SET.has(c.dataType)).map((c: any) => c.name)))
      .catch(() => {});
  }, [connectionId, layer.table.table_schema, layer.table.table_name]);

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, ...patch } : fi) as LayerControl[] });
  }

  async function fetchExtent(col: string) {
    try {
      const res = await fetch("/api/pg/numeric-extent", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) });
      const d = await res.json();
      if (d.min != null && d.max != null) {
        update({ column: col, dataMin: d.min, dataMax: d.max, min: d.min, max: d.max });
      }
    } catch {}
  }

  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
  const isOpacity = f.target === "opacity" || f.target === "strokeOpacity";
  const isRadius = f.target === "radius";
  const isLineWidth = f.target === "line-width";
  const outputLabel = { opacity: "Opacity", strokeOpacity: "Stroke opacity", radius: "Radius (px)", "line-width": "Width (px)", filter: "" }[f.target];
  const [outMin, outMax] = isOpacity ? [0, 1] : [0, 30];
  const fmtOut = isOpacity ? (v: number) => `${Math.round(v * 100)}%` : (v: number) => `${v}px`;
  const sliderStep = f.dataMax !== f.dataMin ? Math.max((f.dataMax - f.dataMin) / 1000, 0.0001) : 1;

  return (
    <div className="space-y-2 mt-1">
      {/* Column selector */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-12 shrink-0">Column</span>
        <Select value={f.column} onValueChange={fetchExtent}>
          <SelectTrigger className="h-6 text-[11px] flex-1 font-mono"><SelectValue placeholder="column" /></SelectTrigger>
          <SelectContent>{cols.map(c => <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {f.dataMin !== f.dataMax && (<>
        {/* ── Radius by Value: visual dot-scale mapping ── */}
        {/* ── Radius by Value: visual dot-scale mapping ── */}
        {isRadius && (
          <div className="pt-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Scale mapping</p>
            <div className="flex items-end justify-between gap-2 px-1">
              <div className="flex flex-col items-center gap-1.5">
                <svg width={Math.max(6, Math.min(24, f.minOutput * 2))} height={Math.max(6, Math.min(24, f.minOutput * 2))} className="overflow-visible">
                  <circle cx={Math.max(3, Math.min(12, f.minOutput))} cy={Math.max(3, Math.min(12, f.minOutput))} r={Math.max(3, Math.min(12, f.minOutput))} className="fill-primary/70" />
                </svg>
                <div className="flex flex-col items-center gap-0.5">
                  <InlineEditNumber value={f.minOutput} onChange={v => update({ minOutput: Math.max(1, Math.min(v, f.maxOutput - 1)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                  <div className="w-px h-2 bg-border" />
                  <InlineEditNumber value={f.dataMin} onChange={v => { if (v < f.dataMax) update({ dataMin: v, min: Math.max(sliderRange[0], v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
                </div>
              </div>
              <div className="flex-1 flex items-center pb-7">
                <div className="w-full h-px bg-border" style={{ borderStyle: "dashed" }} />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <svg width={Math.max(6, Math.min(40, f.maxOutput * 2))} height={Math.max(6, Math.min(40, f.maxOutput * 2))} className="overflow-visible">
                  <circle cx={Math.max(3, Math.min(20, f.maxOutput))} cy={Math.max(3, Math.min(20, f.maxOutput))} r={Math.max(3, Math.min(20, f.maxOutput))} className="fill-primary" />
                </svg>
                <div className="flex flex-col items-center gap-0.5">
                  <InlineEditNumber value={f.maxOutput} onChange={v => update({ maxOutput: Math.max(f.minOutput + 1, Math.min(v, 60)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                  <div className="w-px h-2 bg-border" />
                  <InlineEditNumber value={f.dataMax} onChange={v => { if (v > f.dataMin) update({ dataMax: v, max: Math.min(sliderRange[1], v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/60 text-center mt-1">Click any value to edit</p>
          </div>
        )}

        {/* ── Line Width by Value: visual stroke-scale mapping ── */}
        {isLineWidth && (
          <div className="pt-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Scale mapping</p>
            <div className="flex items-center justify-between gap-2 px-1">
              {/* Min side */}
              <div className="flex flex-col items-center gap-1">
                <svg width={32} height={Math.max(2, Math.min(16, f.minOutput))} className="overflow-visible">
                  <line x1={0} y1={Math.max(1, Math.min(8, f.minOutput / 2))} x2={32} y2={Math.max(1, Math.min(8, f.minOutput / 2))} strokeWidth={Math.max(1, Math.min(16, f.minOutput))} strokeLinecap="round" className="stroke-primary/70" />
                </svg>
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <InlineEditNumber value={f.minOutput} onChange={v => update({ minOutput: Math.max(0.5, Math.min(v, f.maxOutput - 0.5)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                  <div className="w-px h-2 bg-border" />
                  <InlineEditNumber value={f.dataMin} onChange={v => { if (v < f.dataMax) update({ dataMin: v, min: Math.max(sliderRange[0], v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
                </div>
              </div>

              {/* Connector: SVG trapezoid showing stroke widening */}
              <div className="flex-1 flex items-center">
                {(() => {
                  const minH = Math.max(1, Math.min(16, f.minOutput));
                  const maxH = Math.max(1, Math.min(24, f.maxOutput));
                  const h = Math.max(minH, maxH) + 2;
                  const mid = h / 2;
                  return (
                    <svg width="100%" height={h} preserveAspectRatio="none" className="overflow-visible">
                      <defs>
                        <linearGradient id="lwGrad" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`0,${mid - minH / 2} 100%,${mid - maxH / 2} 100%,${mid + maxH / 2} 0,${mid + minH / 2}`}
                        fill="url(#lwGrad)" className="text-primary"
                      />
                    </svg>
                  );
                })()}
              </div>

              {/* Max side */}
              <div className="flex flex-col items-center gap-1">
                <svg width={32} height={Math.max(2, Math.min(24, f.maxOutput))} className="overflow-visible">
                  <line x1={0} y1={Math.max(1, Math.min(12, f.maxOutput / 2))} x2={32} y2={Math.max(1, Math.min(12, f.maxOutput / 2))} strokeWidth={Math.max(1, Math.min(24, f.maxOutput))} strokeLinecap="round" className="stroke-primary" />
                </svg>
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <InlineEditNumber value={f.maxOutput} onChange={v => update({ maxOutput: Math.max(f.minOutput + 0.5, Math.min(v, 30)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                  <div className="w-px h-2 bg-border" />
                  <InlineEditNumber value={f.dataMax} onChange={v => { if (v > f.dataMin) update({ dataMax: v, max: Math.min(sliderRange[1], v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/60 text-center mt-1">Click any value to edit</p>
          </div>
        )}

        {/* ── All others: dual-thumb slider for data range ── */}
        {!isRadius && !isLineWidth && (<>
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Data range</p>
            {/* Radix Slider — dual thumbs, no z-index hacks needed */}
            <div className="relative pt-4">
              {/* Floating value labels above each thumb — only for range filter */}
              {f.target === "filter" && f.dataMax !== f.dataMin && (() => {
                const loPct = (sliderRange[0] - f.dataMin) / (f.dataMax - f.dataMin) * 100;
                const hiPct = (sliderRange[1] - f.dataMin) / (f.dataMax - f.dataMin) * 100;
                // Clamp so labels don't overflow the container
                const loLeft = `clamp(0%, ${loPct}%, 100%)`;
                const hiLeft = `clamp(0%, ${hiPct}%, 100%)`;
                return (<>
                  <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
                    style={{ left: loLeft }}>{fmt(sliderRange[0])}</span>
                  <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
                    style={{ left: hiLeft }}>{fmt(sliderRange[1])}</span>
                </>);
              })()}
              <Slider
                min={f.dataMin} max={f.dataMax} step={sliderStep}
                value={sliderRange}
                onValueChange={([lo, hi]) => {
                  setSliderRange([lo, hi]);
                  if (debounce.current) clearTimeout(debounce.current);
                  debounce.current = setTimeout(() => update({ min: lo, max: hi }), 80);
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <InlineEditNumber value={f.dataMin} onChange={v => { if (v < f.dataMax) update({ dataMin: v, min: Math.max(sliderRange[0], v) }); }} fmt={fmt} className="text-[9px]" />
              <InlineEditNumber value={f.dataMax} onChange={v => { if (v > f.dataMin) update({ dataMax: v, max: Math.min(sliderRange[1], v) }); }} fmt={fmt} align="right" className="text-[9px]" />
            </div>
          </div>

          {/* Output range */}
          {f.target !== "filter" && (
            <div className="space-y-1 pt-0.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{outputLabel} range</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <InlineEditNumber value={f.minOutput} onChange={v => update({ minOutput: Math.max(outMin, Math.min(v, f.maxOutput)) })} fmt={fmtOut} className="text-[10px] w-8 text-right" />
                <div className="flex-1 min-w-0">
                  <Slider min={outMin} max={outMax} step={isOpacity ? 0.05 : 0.5}
                    value={[f.minOutput, f.maxOutput]}
                    onValueChange={([lo, hi]) => update({ minOutput: lo, maxOutput: hi })} />
                </div>
                <InlineEditNumber value={f.maxOutput} onChange={v => update({ maxOutput: Math.max(f.minOutput, Math.min(v, outMax)) })} fmt={fmtOut} className="text-[10px] w-8" />
              </div>
            </div>
          )}
        </>)}
      </>)}
    </div>
  );
}

const TEMPORAL_TYPES = new Set([
  "timestamp with time zone", "timestamp without time zone", "date",
  "time with time zone", "time without time zone",
]);

// ─── fill control editor ──────────────────────────────────────────────────────
function FillControlEditor({ f, layer, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "fill" }>;
  layer: MapLayer;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, {
      controls: (layer.controls ?? []).map(c => c.id === f.id ? { ...c, ...patch } : c) as LayerControl[],
    });
  }
  const gt = (layer.geomTypeOverride ?? layer.table.geom_type ?? "").toLowerCase();
  const isPoint = !gt.includes("linestring") && !gt.includes("polygon");
  const hasRadiusByValue = (layer.controls ?? []).some(c => c.type === "numeric" && c.enabled && (c as any).target === "radius");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[4rem_1fr] items-center gap-2">
        <Label className="text-xs text-muted-foreground">Color</Label>
        <label className="cursor-pointer flex items-center gap-1.5">
          <span className="block w-4 h-4 rounded border border-border shrink-0" style={{ backgroundColor: f.color }} />
          <span className="text-xs text-muted-foreground font-mono">{f.color}</span>
          <input type="color" className="sr-only" value={f.color} onChange={e => update({ color: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2">
        <Label className="text-xs text-muted-foreground">Opacity</Label>
        <Slider min={0} max={1} step={0.05} value={[f.opacity]} onValueChange={([v]) => update({ opacity: v })} />
        <span className="text-xs text-muted-foreground text-right">{Math.round(f.opacity * 100)}%</span>
      </div>
      {isPoint && (
        <div className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2">
          <Label className="text-xs text-muted-foreground">Radius</Label>
          <Slider
            min={1} max={40} step={1}
            value={[layer.style.radius]}
            onValueChange={([v]) => onUpdateLayer(layer.id, { style: { ...layer.style, radius: v } })}
            disabled={hasRadiusByValue}
          />
          <span className={`text-xs text-right ${hasRadiusByValue ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
            {hasRadiusByValue ? "—" : `${layer.style.radius}px`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── stroke control editor ────────────────────────────────────────────────────
function StrokeControlEditor({ f, layer, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "stroke" }>;
  layer: MapLayer;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, {
      controls: (layer.controls ?? []).map(c => c.id === f.id ? { ...c, ...patch } : c) as LayerControl[],
    });
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[4rem_1fr] items-center gap-2">
        <Label className="text-xs text-muted-foreground">Color</Label>
        <label className="cursor-pointer flex items-center gap-1.5">
          <span className="block w-4 h-4 rounded border border-border shrink-0" style={{ backgroundColor: f.color }} />
          <span className="text-xs text-muted-foreground font-mono">{f.color}</span>
          <input type="color" className="sr-only" value={f.color} onChange={e => update({ color: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2">
        <Label className="text-xs text-muted-foreground">Opacity</Label>
        <Slider min={0} max={1} step={0.05} value={[f.opacity]} onValueChange={([v]) => update({ opacity: v })} />
        <span className="text-xs text-muted-foreground text-right">{Math.round(f.opacity * 100)}%</span>
      </div>
      <div className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2">
        <Label className="text-xs text-muted-foreground">Width</Label>
        <Slider min={0} max={20} step={0.5} value={[f.width]} onValueChange={([v]) => update({ width: v })} />
        <span className="text-xs text-muted-foreground text-right">{f.width}px</span>
      </div>
    </div>
  );
}

// ─── unified layer filter editor ──────────────────────────────────────────────
function LayerFilterEditor({
  layer, connectionId, onUpdateLayer,
}: {
  layer: MapLayer;
  connectionId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const [columns, setColumns] = React.useState<{ name: string; dataType: string; isGeom: boolean }[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  // deploy flow: option first, column second
  const [deploying, setDeploying] = React.useState(false);
  type ControlOption = { type: LayerControl["type"]; target?: string; label: string; tagline: string; kind: "Style" | "Hybrid" | "Filter"; kindCls: string; icon: React.ReactNode; needsColumn: "numeric" | "temporal" | "any" | false };
  const [pickedOption, setPickedOption] = React.useState<ControlOption | null>(null);
  const [pickedCol, setPickedCol] = React.useState("");
  const [deploying2, setDeploying2] = React.useState(false);

  React.useEffect(() => {
    if (!connectionId || !layer.table.table_schema || !layer.table.table_name) return;
    fetch("/api/pg/columns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name }) })
      .then(r => r.json())
      .then(d => { if (d.columns) setColumns(d.columns); })
      .catch(() => {});
  }, [connectionId, layer.table.table_schema, layer.table.table_name]);

  const nonGeomCols = columns.filter(c => !c.isGeom);

  function applyControls(next: LayerControl[]) {
    onUpdateLayer(layer.id, { controls: next });
  }

  function toggleShare(id: string) {
    applyControls((layer.controls ?? []).map(c => c.id === id ? { ...c, shared: !c.shared } : c));
  }

  function setControlLabel(id: string, label: string) {
    applyControls((layer.controls ?? []).map(c => c.id === id ? { ...c, label: label || undefined } : c));
  }

  function toggleEnabled(id: string) {
    applyControls((layer.controls ?? []).map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  }

  function removeFilter(id: string) {
    applyControls((layer.controls ?? []).filter(c => c.id !== id));
    setExpanded(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  function cancelDeploy() {
    setDeploying(false);
    setPickedOption(null);
    setPickedCol("");
    setDeploying2(false);
  }

  async function deployWithColumn(opt: ControlOption, col: string) {
    setDeploying2(true);
    const id = crypto.randomUUID();
    let control: LayerControl;
    try {
      if (opt.type === "temporal") {
        let dataMin = "", dataMax = "";
        let snapPoints: string[] = [], snapCounts: number[] = [];
        try {
          const [extRes, cntRes] = await Promise.all([
            fetch("/api/pg/datetime-extent", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) }),
            fetch("/api/pg/column-value-counts", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) }),
          ]);
          const ext = await extRes.json();
          const cnt = await cntRes.json();
          if (ext.min && ext.max) { dataMin = ext.min; dataMax = ext.max; }
          if (cnt.counts?.length > 1) {
            const sorted = [...cnt.counts].sort((a: any, b: any) => new Date(a.value).getTime() - new Date(b.value).getTime());
            snapPoints = sorted.map((r: any) => r.value);
            snapCounts = sorted.map((r: any) => r.count);
          }
        } catch {}
        control = { id, type: "temporal", enabled: true, shared: false, column: col, mode: "all", from: dataMin, to: dataMax, dataMin, dataMax, snapPoints, snapCounts } as any;
      } else if (opt.type === "categorical") {
        let rules: FillColorRule[] = [];
        try {
          const res = await fetch("/api/pg/column-values", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) });
          const data = await res.json();
          if (data.values?.length > 0) rules = (data.values as string[]).map((v, i) => ({ value: v, color: CAT_COLORS[i % CAT_COLORS.length] }));
        } catch {}
        control = { id, type: "categorical", enabled: true, shared: false, column: col, rules, defaultColor: "#aaaaaa", hiddenValues: [], target: isLine ? "stroke" : "fill" };
      } else if (opt.type === "numeric") {
        let dataMin = 0, dataMax = 0;
        try {
          const res = await fetch("/api/pg/numeric-extent", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) });
          const data = await res.json();
          if (data.min != null && data.max != null) { dataMin = data.min; dataMax = data.max; }
        } catch {}
        const numTarget = (opt.target ?? "opacity") as Extract<LayerControl, { type: "numeric" }>["target"];
        const OUTPUT_DEFAULTS: Record<typeof numTarget, [number, number]> = { opacity: [0.2, 1], strokeOpacity: [0.2, 1], radius: [3, 20], "line-width": [1, 8], filter: [0, 0] };
        const [minOutput, maxOutput] = OUTPUT_DEFAULTS[numTarget];
        control = { id, type: "numeric", enabled: true, shared: false, column: col, min: dataMin, max: dataMax, dataMin, dataMax, minOutput, maxOutput, target: numTarget };
      } else if (opt.type === "threshold") {
        let midpoint = 0;
        try {
          const res = await fetch("/api/pg/numeric-extent", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, schema: layer.table.table_schema, table: layer.table.table_name, column: col }) });
          const data = await res.json();
          if (data.min != null && data.max != null) midpoint = Math.round((data.min + data.max) / 2);
        } catch {}
        control = { id, type: "threshold", enabled: true, shared: false, column: col, threshold: midpoint, aboveColor: "#22c55e", belowColor: "#ef4444", target: isLine ? "stroke" : "fill" };
      } else {
        control = { id, type: "attribute", enabled: true, shared: false, column: col, operator: "ilike", value: "" };
      }
      applyControls([...(layer.controls ?? []), control]);
      setExpanded(prev => new Set(prev).add(id));
    } finally {
      cancelDeploy();
    }
  }

  // Control type metadata (for deployed cards)
  const CTRL_META: Record<LayerControl["type"], { label: string; kind: "Hybrid" | "Style" | "Filter"; kindCls: string; icon: React.ReactNode }> = {
    fill:        { label: "Fill",      kind: "Style",  kindCls: "bg-purple-500/15 text-purple-600 dark:text-purple-400", icon: <Paintbrush className="h-3 w-3" /> },
    stroke:      { label: "Stroke",    kind: "Style",  kindCls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",       icon: <Sliders    className="h-3 w-3" /> },
    categorical: { label: "Category",  kind: "Hybrid", kindCls: "bg-teal-500/15 text-teal-600 dark:text-teal-400",       icon: <Tag        className="h-3 w-3" /> },
    threshold:   { label: "Threshold", kind: "Style",  kindCls: "bg-orange-500/15 text-orange-600 dark:text-orange-400", icon: <Paintbrush className="h-3 w-3" /> },
    numeric:     { label: "Opacity",   kind: "Style",  kindCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", icon: <Paintbrush className="h-3 w-3" /> },
    temporal:    { label: "Timeline",  kind: "Filter", kindCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",    icon: <Calendar   className="h-3 w-3" /> },
    attribute:   { label: "Condition", kind: "Filter", kindCls: "bg-slate-500/15 text-slate-500 dark:text-slate-400",    icon: <Filter     className="h-3 w-3" /> },
  };

  // All available control options (geom-aware)
  const gt = (layer.geomTypeOverride ?? layer.table.geom_type ?? "").toLowerCase();
  const isLine = gt.includes("linestring");
  const isPoint = !isLine && !gt.includes("polygon");

  const ALL_OPTIONS: ControlOption[] = [
    ...(!isLine ? [{ type: "fill" as const,   label: "Fill",                   tagline: "Set fill color & opacity",                    kind: "Style" as const,  kindCls: "bg-purple-500/15 text-purple-600 dark:text-purple-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: false as const }] : []),
    { type: "stroke",      label: "Stroke",                 tagline: "Set outline color, opacity & width",           kind: "Style",  kindCls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",       icon: <Sliders    className="h-3 w-3" />, needsColumn: false },
    { type: "categorical", label: "Color by Category",      tagline: "Color & filter features by a column's values", kind: "Hybrid", kindCls: "bg-teal-500/15 text-teal-600 dark:text-teal-400",       icon: <Tag        className="h-3 w-3" />, needsColumn: "any" },
    { type: "threshold" as const, label: "Color by Threshold", tagline: "Two colors split at a numeric threshold",       kind: "Style" as const, kindCls: "bg-orange-500/15 text-orange-600 dark:text-orange-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: "numeric" as const },
    ...(!isLine ? [{ type: "numeric" as const, target: "opacity" as const,     label: "Opacity by Value",       tagline: "Fade fill opacity based on a column",          kind: "Style" as const,  kindCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: "numeric" as const }] : []),
    ...(isPoint ? [{ type: "numeric" as const, target: "radius" as const,      label: "Radius by Value",        tagline: "Scale point size based on a column",           kind: "Style" as const,  kindCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: "numeric" as const }] : []),
    ...(isLine  ? [{ type: "numeric" as const, target: "line-width" as const,  label: "Line Width by Value",    tagline: "Scale line width based on a column",           kind: "Style" as const,  kindCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: "numeric" as const }] : []),
    { type: "numeric", target: "strokeOpacity", label: "Stroke Opacity by Value", tagline: "Fade outline opacity based on a column",       kind: "Style",  kindCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", icon: <Paintbrush className="h-3 w-3" />, needsColumn: "numeric" },
    { type: "numeric", target: "filter",        label: "Range Filter",           tagline: "Show only features within a value range",      kind: "Filter", kindCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",    icon: <Hash       className="h-3 w-3" />, needsColumn: "numeric" },
    { type: "temporal",    label: "Timeline Filter",         tagline: "Filter by date or time range",                 kind: "Filter", kindCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",    icon: <Calendar   className="h-3 w-3" />, needsColumn: "temporal" },
    { type: "attribute",   label: "Custom Condition",        tagline: "Filter by any column condition",               kind: "Filter", kindCls: "bg-slate-500/15 text-slate-500 dark:text-slate-400",    icon: <Filter     className="h-3 w-3" />, needsColumn: "any" },
  ];

  // Filtered columns for the chosen option's column picker
  const filteredCols = pickedOption?.needsColumn === "numeric"
    ? nonGeomCols.filter(c => NUMERIC_TYPES_SET.has(c.dataType))
    : pickedOption?.needsColumn === "temporal"
    ? nonGeomCols.filter(c => TEMPORAL_TYPES.has(c.dataType))
    : nonGeomCols;

  return (
    <div className="space-y-2 min-w-0 w-full overflow-hidden">

      {/* Control cards */}
      {(layer.controls ?? []).map((f) => {
        const meta = CTRL_META[f.type];
        return (
          <div key={f.id} className={`border rounded-lg overflow-hidden transition-opacity ${!f.enabled ? "opacity-60" : ""}`}>
            {/* Card header */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 cursor-pointer select-none"
              onClick={() => toggleExpanded(f.id)}>
              {/* Enable toggle */}
              <button
                role="switch"
                aria-checked={f.enabled}
                onClick={() => toggleEnabled(f.id)}
                title={f.enabled ? "On — click to disable" : "Off — click to enable"}
                className={`shrink-0 relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus-visible:outline-none ${f.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`inline-block h-3 w-3 rounded-full shadow transition-transform ${f.enabled ? "bg-white translate-x-3.5" : "bg-white translate-x-0.5"}`} />
              </button>

              {/* Kind badge + label + column */}
              {(() => {
                const effectiveKind = f.type === "numeric" && f.target === "filter" ? "Filter" : meta.kind;
                const effectiveKindCls = f.type === "numeric" && f.target === "filter"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : meta.kindCls;
                return (
                  <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${effectiveKindCls}`}>
                    {effectiveKind}
                  </span>
                );
              })()}
              <span className="text-[10px] font-mono text-foreground/70 truncate flex-1 min-w-0">
                {"column" in f ? f.column : meta.label.toLowerCase()}
                {f.type === "numeric" && (
                  <span className="text-muted-foreground/50 ml-1">·{" "}
                    {{ opacity: "opacity", strokeOpacity: "stroke α", radius: "radius", "line-width": "width", filter: "range" }[f.target]}
                  </span>
                )}
              </span>

              {/* Share toggle */}
              <button
                onClick={e => { e.stopPropagation(); toggleShare(f.id); }}
                title={f.shared ? "Public — visible to viewers" : "Private — owner only"}
                className={`shrink-0 transition-colors ${f.shared ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
              >
                {f.shared ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              </button>
              <button onClick={e => { e.stopPropagation(); removeFilter(f.id); }} className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
              <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform ${expanded.has(f.id) ? "rotate-180" : ""}`} />
            </div>

            {/* Card body — collapsible */}
            {expanded.has(f.id) && <div className="px-2.5 pb-2.5 pt-2 min-w-0 overflow-hidden">
              {/* Public label — only for shared interactive controls */}
              {f.shared && (f.type === "categorical" || f.type === "temporal" || f.type === "numeric" || f.type === "threshold") && (
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide shrink-0">Label</span>
                  <input
                    value={f.label ?? ""}
                    onChange={e => setControlLabel(f.id, e.target.value)}
                    placeholder={(() => {
                      if (f.type === "temporal") return "Timeline";
                      if (f.type === "numeric") return f.target === "radius" ? "Radius by Value" : f.target === "filter" ? `Range · ${f.column}` : f.column;
                      if (f.type === "threshold") return `${f.column} threshold`;
                      return `Color by ${f.column}`;
                    })()}
                    className="flex-1 text-[10px] bg-muted/30 border rounded px-2 py-0.5 outline-none focus:border-primary font-mono min-w-0"
                  />
                </div>
              )}
              {f.type === "fill"        && <FillControlEditor       f={f} layer={layer} onUpdateLayer={onUpdateLayer} />}
              {f.type === "stroke"      && <StrokeControlEditor     f={f} layer={layer} onUpdateLayer={onUpdateLayer} />}
              {f.type === "categorical" && <CategoricalFilterEditor f={f} layer={layer} connectionId={connectionId} onUpdateLayer={onUpdateLayer} />}
              {f.type === "threshold"   && <ThresholdControlEditor  f={f} layer={layer} onUpdateLayer={onUpdateLayer} />}
              {f.type === "temporal"    && <TemporalFilterEditor    f={f} layer={layer} connectionId={connectionId} onUpdateLayer={onUpdateLayer} />}
              {f.type === "numeric"     && <NumericFilterEditor     f={f} layer={layer} connectionId={connectionId} onUpdateLayer={onUpdateLayer} />}
              {f.type === "attribute"   && <AttributeFilterEditor   f={f} layer={layer} nonGeomCols={nonGeomCols} drafts={drafts} setDrafts={setDrafts} onUpdateLayer={onUpdateLayer} connectionId={connectionId} />}
            </div>}
          </div>
        );
      })}

      {/* Add Control */}
      {!deploying ? (
        <button
          onClick={() => setDeploying(true)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-xs"
        >
          <Plus className="h-3 w-3" /> Add control
        </button>
      ) : !pickedOption ? (
        /* Step 1: pick control type */
        <div className="border rounded-lg overflow-hidden bg-muted/10">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30 border-b">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Choose a control</span>
            <button onClick={cancelDeploy} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-1.5 space-y-0.5">
            {ALL_OPTIONS.map(opt => {
              const key = `${opt.type}-${opt.target ?? ""}`;
              const alreadyExists = opt.needsColumn === false && (layer.controls ?? []).some(c => c.type === opt.type);
              return (
                <button key={key}
                  disabled={alreadyExists || deploying2}
                  onClick={() => {
                    if (alreadyExists) return;
                    if (opt.needsColumn === false) {
                      // deploy immediately
                      const id = crypto.randomUUID();
                      const control: LayerControl = opt.type === "fill"
                        ? { id, type: "fill", enabled: true, shared: false, color: layer.style.color, opacity: layer.style.opacity }
                        : { id, type: "stroke", enabled: true, shared: false, color: layer.style.strokeColor ?? "#ffffff", opacity: layer.style.strokeOpacity ?? 1, width: layer.style.lineWidth };
                      applyControls([...(layer.controls ?? []), control]);
                      setExpanded(prev => new Set(prev).add(id));
                      setDeploying(false);
                    } else {
                      setPickedOption(opt);
                      setPickedCol("");
                    }
                  }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md transition-colors text-left ${alreadyExists ? "opacity-35 cursor-not-allowed" : "hover:bg-muted"}`}
                >
                  <span className={`shrink-0 p-1.5 rounded ${opt.kindCls}`}>{opt.icon}</span>
                  <span className="text-[11px] font-semibold flex-1 min-w-0 truncate">{opt.label}</span>
                  <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${alreadyExists ? "bg-muted text-muted-foreground" : opt.kindCls}`}>
                    {alreadyExists ? "added" : opt.kind}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Step 2: pick column for the chosen control type */
        <div className="border rounded-lg overflow-hidden bg-muted/10">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border-b">
            <button onClick={() => { setPickedOption(null); setPickedCol(""); }}
              className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
            <span className={`shrink-0 p-1 rounded ${pickedOption.kindCls}`}>{pickedOption.icon}</span>
            <span className="text-[10px] font-semibold flex-1 truncate">{pickedOption.label}</span>
            <button onClick={cancelDeploy} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2.5 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              {pickedOption.needsColumn === "numeric" ? "Pick a numeric column" : pickedOption.needsColumn === "temporal" ? "Pick a date/time column" : "Pick a column"}
              {filteredCols.length === 0 && <span className="text-destructive"> — no matching columns found</span>}
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {filteredCols.map(c => (
                <button key={c.name}
                  disabled={deploying2}
                  onClick={() => { setPickedCol(c.name); deployWithColumn(pickedOption, c.name); }}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted transition-colors text-left ${pickedCol === c.name ? "bg-muted" : ""}`}
                >
                  <span className="text-[11px] font-mono flex-1 truncate">{c.name}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{c.dataType}</span>
                  {pickedCol === c.name && deploying2 && <span className="text-[9px] text-muted-foreground">…</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── attribute filter sub-editor ──────────────────────────────────────────────
function AttributeFilterEditor({ f, layer, nonGeomCols, drafts, setDrafts, onUpdateLayer, connectionId }: {
  f: Extract<LayerControl, { type: "attribute" }>;
  layer: MapLayer;
  nonGeomCols: { name: string; dataType: string; isGeom: boolean }[];
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
  connectionId: string;
}) {
  const IN_OPERATORS: AttrOperator[] = ["in", "not_in"];

  function apply(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, ...patch } : fi) as LayerControl[] });
  }

  const isPending = !IN_OPERATORS.includes(f.operator) && !NULL_OPERATORS.includes(f.operator) && !DATE_OPERATORS.includes(f.operator) && (drafts[f.id] ?? f.value) !== f.value;

  return (
    <div className="space-y-1 mt-1">
      {/* Column */}
      <Select value={f.column} onValueChange={(col) => { apply({ column: col, value: "" }); setDrafts(p => ({ ...p, [f.id]: "" })); }}>
        <SelectTrigger className="h-6 text-[11px] w-full font-mono overflow-hidden [&>span]:truncate">
          <SelectValue placeholder="column" />
        </SelectTrigger>
        <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
          {nonGeomCols.map(c => <SelectItem key={c.name} value={c.name} className="text-xs font-mono">{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Operator */}
      <Select value={f.operator} onValueChange={(op) => { apply({ operator: op as AttrOperator, value: "" }); setDrafts(p => ({ ...p, [f.id]: "" })); }}>
        <SelectTrigger className="h-6 text-[11px] w-full"><SelectValue /></SelectTrigger>
        <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
          {ALL_OPERATORS.map(op => <SelectItem key={op} value={op} className="text-xs">{OPERATOR_LABELS[op]}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Value */}
      {IN_OPERATORS.includes(f.operator) ? (
        <InValuePicker connectionId={connectionId} schema={layer.table.table_schema} table={layer.table.table_name} column={f.column}
          value={f.value} onChange={v => apply({ value: v })} />
      ) : DATE_OPERATORS.includes(f.operator) ? (
        <div className="space-y-1">
          {(() => {
            const [from, to] = f.value ? f.value.split(",") : ["", ""];
            return (<>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground w-6">from</span>
                <Input type="date" value={from ?? ""} onChange={e => apply({ value: `${e.target.value},${to ?? ""}` })} className="h-6 text-[11px] flex-1" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground w-6">to</span>
                <Input type="date" value={to ?? ""} onChange={e => apply({ value: `${from ?? ""},${e.target.value}` })} className="h-6 text-[11px] flex-1" />
              </div>
            </>);
          })()}
        </div>
      ) : !NULL_OPERATORS.includes(f.operator) && (
        <div className="space-y-0.5">
          <Input value={drafts[f.id] ?? f.value} placeholder="value"
            onChange={e => setDrafts(p => ({ ...p, [f.id]: e.target.value }))}
            onBlur={() => onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, value: drafts[f.id] ?? "" } : fi) as LayerControl[] })}
            onKeyDown={e => { if (e.key === "Enter") onUpdateLayer(layer.id, { controls: layer.controls.map(fi => fi.id === f.id ? { ...fi, value: drafts[f.id] ?? "" } : fi) as LayerControl[] }); }}
            className={`h-6 text-[11px] w-full ${isPending ? "border-amber-400 dark:border-amber-600" : ""}`} />
          {isPending && <p className="text-[10px] text-muted-foreground">Press Enter to apply</p>}
        </div>
      )}
    </div>
  );
}

export function TableSidebar({
  connectionId, connectionLoaded, layers,
  onAddLayer, onRemoveLayer, onUpdateLayer, onReorderLayers,
  activeLayerId, onActiveLayerChange, onZoomToLayer, onZoomToTable, onFlyTo, onOpenSettings,
  basemap, onBasemapChange,
}: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [tab, setTab] = React.useState("browser");
  const [tables, setTables] = React.useState<TableRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [postgisRequired, setPostgisRequired] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [expandedLayer, setExpandedLayer] = React.useState<string | null>(null);
  const [expandedSection, setExpandedSection] = React.useState<"controls" | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  type LayerCtx = { x: number; y: number; layerId: string } | null;
  const [layerCtx, setLayerCtx] = React.useState<LayerCtx>(null);
  const layerCtxRef = React.useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDefaultSchema, setCreateDefaultSchema] = React.useState<string | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = React.useState<{ schema: string; table: string } | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<{ schema: string; table: string } | null>(null);
  const [attrTableLayer, setAttrTableLayer] = React.useState<MapLayer | null>(null);
  const [tableInfoTarget, setTableInfoTarget] = React.useState<{ schema: string; table: string } | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [assigningSrid, setAssigningSrid] = React.useState<string | null>(null);
  const [sridInput, setSridInput] = React.useState("4326");
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);

  const [fixingPk, setFixingPk] = React.useState<string | null>(null);
  const [pkLoading, setPkLoading] = React.useState(false);
  const [pkError, setPkError] = React.useState<string | null>(null);

  const [creatingIdx, setCreatingIdx] = React.useState<string | null>(null);
  const [idxLoading, setIdxLoading] = React.useState(false);
  const [idxError, setIdxError] = React.useState<string | null>(null);

  const [castingGeom, setCastingGeom] = React.useState<string | null>(null);
  const [castType, setCastType] = React.useState("LineString");
  const [castSrid, setCastSrid] = React.useState("4326");
  const [castLoading, setCastLoading] = React.useState(false);
  const [castError, setCastError] = React.useState<string | null>(null);

  const [clusteringTable, setClusteringTable] = React.useState<string | null>(null);
  const [clusterLoading, setClusterLoading] = React.useState(false);
  const [clusterError, setClusterError] = React.useState<string | null>(null);

  const [connectionOpen, setConnectionOpen] = React.useState(false);
  const [basemapOpen, setBasemapOpen] = React.useState(false);
  type CtxTarget =
    | { type: "connection" }
    | { type: "schema"; schema: string }
    | { type: "table"; table: TableRow }
    | { type: "basemap"; key: string };
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; target: CtxTarget } | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!contextMenu) return;
    function close(e: MouseEvent) {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setContextMenu(null); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [!!contextMenu]);

  React.useEffect(() => {
    if (!layerCtx) return;
    function close(e: MouseEvent) {
      if (layerCtxRef.current?.contains(e.target as Node)) return;
      setLayerCtx(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLayerCtx(null); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [!!layerCtx]);

  function handleLayerDrop(toId: string) {
    if (!dragId || dragId === toId) return;
    const visual = [...layers].reverse();
    const from = visual.findIndex((l) => l.id === dragId);
    const to = visual.findIndex((l) => l.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...visual];
    next.splice(from, 1);
    next.splice(to, 0, visual[from]);
    onReorderLayers([...next].reverse().map((l) => l.id));
    setDragId(null);
    setDragOverId(null);
  }

  function toggleSection(layerId: string) {
    if (expandedLayer === layerId && expandedSection === "controls") {
      setExpandedLayer(null);
      setExpandedSection(null);
    } else {
      setExpandedLayer(layerId);
      setExpandedSection("controls");
    }
  }

  async function handleAssignSrid(t: TableRow) {
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await fetch("/api/pg/assign-srid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          schema: t.table_schema,
          table: t.table_name,
          geomCol: t.geom_col,
          srid: sridInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAssigningSrid(null);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setAssignError(e.message);
    } finally {
      setAssignLoading(false);
    }
  }

  React.useEffect(() => {
    if (!connectionId) {
      setTables([]);
      setError(null);
      setPostgisRequired(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPostgisRequired(false);
    fetch("/api/pg/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (data.postgisRequired) { setPostgisRequired(true); setTables([]); return; }
        setTables(data.tables ?? []);
        const allSchemas = new Set<string>(data.tables.map((t: any) => t.table_schema));
        setCollapsed(allSchemas);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [connectionId, refreshKey]);

  // Only show spatial tables — non-spatial tables can't be added to the map
  const spatialTables = React.useMemo(() => tables.filter((t) => t.geom_col), [tables]);

  const schemas = React.useMemo(() => {
    const map = new Map<string, TableRow[]>();
    for (const t of spatialTables) {
      if (!map.has(t.table_schema)) map.set(t.table_schema, []);
      map.get(t.table_schema)!.push(t);
    }
    return map;
  }, [spatialTables]);

  const layerKeys = new Set(layers.map((l) => `${l.table.table_schema}.${l.table.table_name}`));

  function toggleSchema(schema: string) {
    setCollapsed((prev) => {
      if (!prev.has(schema)) {
        // Collapsing this schema
        const next = new Set(prev);
        next.add(schema);
        return next;
      } else {
        // Expanding this schema — collapse all others (accordion)
        const allOthers = new Set([...schemas.keys()].filter((s) => s !== schema));
        return allOthers;
      }
    });
  }

  return (
    <aside className={`${sidebarCollapsed ? "w-8" : "w-84"} transition-[width] duration-200 shrink-0 border-r flex flex-col overflow-hidden bg-muted/30`}>
      {/* Tab bar */}
      <div className="flex shrink-0 border-b bg-muted/50">
        {!sidebarCollapsed && (
          <>
            <button
              onClick={() => setTab("browser")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === "browser" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Browser
            </button>
            <button
              onClick={() => setTab("layers")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === "layers" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Layers
              {layers.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">{layers.length}</Badge>
              )}
            </button>
          </>
        )}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* BROWSER TAB */}
      {!sidebarCollapsed && tab === "browser" && (
        <ScrollArea className="flex-1 min-h-0">
          {/* PostgreSQL root node — always visible */}
          <button
            className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/60 text-left select-none"
            onClick={() => connectionId && setConnectionOpen((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "connection" } });
            }}
          >
            {connectionOpen
              ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
              : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
            }
            <img src="/favicon.ico" className="w-4 h-4 shrink-0" alt="" />
            <span className="text-xs font-semibold flex-1 text-left">PostgreSQL</span>
            <span suppressHydrationWarning className={`w-2 h-2 rounded-full shrink-0 ${connectionId ? "bg-green-500" : "bg-red-400"}`} title={connectionId ? "Connected" : "Not connected"} />
          </button>

          {connectionLoaded && !connectionId && (
            <div className="mx-3 mt-6 mb-2 flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-muted-foreground">Connect a PostGIS database to browse tables and build maps.</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenSettings?.()}>
                Connect database
              </Button>
            </div>
          )}
          {loading && <p className="pl-8 py-1.5 text-xs text-muted-foreground">Loading…</p>}
          {error && (() => { const { title, detail } = friendlyConnError(error); return (
            <div className="mx-3 my-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 space-y-0.5">
              <p className="text-xs font-medium text-destructive">{title}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          ); })()}
          {postgisRequired && (
            <div className="mx-3 my-2 rounded-md border border-amber-400/40 bg-amber-500/5 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">PostGIS not enabled</p>
              <p className="text-xs text-muted-foreground">Enable the PostGIS extension on this database, then reconnect.</p>
              <code className="block text-[10px] bg-muted rounded px-1.5 py-1 text-muted-foreground select-all mt-0.5">CREATE EXTENSION postgis;</code>
            </div>
          )}

          {connectionId && !loading && !error && (
            <>
              {connectionOpen && schemas.size === 0 && !postgisRequired && (
                <div className="mx-3 mt-6 mb-2 flex flex-col items-center gap-3 text-center">
                  <p className="text-xs text-muted-foreground">No spatial tables found. Import a file or create a table with a geometry column to get started.</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreateOpen(true)}>
                    Import data
                  </Button>
                </div>
              )}

              {connectionOpen && [...schemas.entries()].map(([schema, schemaTables]) => {
                const isCollapsed = collapsed.has(schema);
                return (
                  <div key={schema}>
                    {/* Schema node */}
                    <button
                      className="w-full flex items-center gap-1.5 pl-6 pr-3 py-1 hover:bg-muted/50 text-left select-none"
                      onClick={() => toggleSchema(schema)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "schema", schema } });
                      }}
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                      }
                      <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <span className="text-xs font-medium truncate flex-1" title={schema}>{schema}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{schemaTables.length}</span>
                    </button>

                    {!isCollapsed && schemaTables.map((t) => {
                      const key = `${t.table_schema}.${t.table_name}`;
                      const alreadyAdded = layerKeys.has(key);
                      const sridUnknown = !t.srid || t.srid === 0;
                      const isAssigning = assigningSrid === key;
                      const isFixingPk = fixingPk === key;
                      const isCreatingIdx = creatingIdx === key;
                      const isCastingGeom = castingGeom === key;
                      const isClusteringTable = clusteringTable === key;
                      const isGenericGeom = t.geom_type === "GEOMETRY" || t.geom_type === "GEOGRAPHY";
                      return (
                        <div key={key} className={`border-b ${alreadyAdded ? "bg-primary/5" : ""}`}>
                          <div
                            className="flex items-center gap-1.5 pl-11 pr-3 py-1.5 cursor-default select-none hover:bg-muted/40 min-w-0"
                            onDoubleClick={() => { if (!alreadyAdded) { onAddLayer(t); setTab("layers"); } }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "table", table: t } });
                            }}
                          >
                            <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="text-xs truncate max-w-48" title={t.table_name}>{t.table_name}</span>
                            {alreadyAdded && <Check className="h-3 w-3 text-primary shrink-0" />}
                          </div>

                          {/* Warning badges */}
                          {(sridUnknown || t.has_pk === false || t.has_spatial_index === false || isGenericGeom || (t.has_spatial_index && !t.is_clustered && (t.row_count ?? 0) > 10000)) && (
                            <div className="flex flex-row gap-1.5 items-center pl-11 pb-1">
                              {sridUnknown && (
                                <button
                                  className="flex items-center gap-0.5 text-[10px] text-amber-500 hover:text-amber-600"
                                  onClick={() => { setAssigningSrid(isAssigning ? null : key); setSridInput("4326"); setAssignError(null); }}
                                  title="SRID unknown — tiles won't render. Click to assign."
                                >
                                  <TriangleAlert className="h-2.5 w-2.5" />
                                  SRID
                                </button>
                              )}
                              {t.has_pk === false && (
                                <button
                                  className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 border border-amber-400 dark:border-amber-600 rounded px-1 leading-4 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  title="No primary key — click to fix"
                                  onClick={() => { setFixingPk(isFixingPk ? null : key); setPkError(null); }}
                                >
                                  no pk
                                </button>
                              )}
                              {t.has_spatial_index === false && (
                                <button
                                  className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 border border-blue-400 dark:border-blue-600 rounded px-1 leading-4 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  title="No spatial index — click to fix"
                                  onClick={() => { setCreatingIdx(isCreatingIdx ? null : key); setIdxError(null); }}
                                >
                                  no index
                                </button>
                              )}
                              {isGenericGeom && (
                                <button
                                  className="text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 border border-violet-400 dark:border-violet-600 rounded px-1 leading-4 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                                  title="Geometry type unspecified — click to cast"
                                  onClick={() => { setCastingGeom(isCastingGeom ? null : key); setCastSrid(String(t.srid ?? 4326)); setCastError(null); }}
                                >
                                  type unknown
                                </button>
                              )}
                              {t.has_spatial_index && !t.is_clustered && (t.row_count ?? 0) > 10000 && (
                                <button
                                  className="text-[9px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400 border border-teal-400 dark:border-teal-600 rounded px-1 leading-4 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                  title="Cluster rows by spatial index for faster tile serving"
                                  onClick={() => { setClusteringTable(isClusteringTable ? null : key); setClusterError(null); }}
                                >
                                  cluster
                                </button>
                              )}
                            </div>
                          )}

                          {isAssigning && (
                            <div className="px-3 pb-2 space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 border-t">
                              <p className="text-[10px] text-muted-foreground pt-1.5">
                                Assigns an SRID label without reprojecting coordinates.
                                Use this when the data is already in the target CRS.
                              </p>
                              <div className="flex gap-1.5 items-center">
                                <Input value={sridInput} onChange={(e) => setSridInput(e.target.value)} className="h-7 text-xs font-mono w-24" placeholder="4326" />
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleAssignSrid(t)} disabled={assignLoading}>
                                  {assignLoading ? "Saving…" : "Assign SRID"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAssigningSrid(null)}>Cancel</Button>
                              </div>
                              {assignError && <p className="text-[10px] text-destructive break-words">{assignError}</p>}
                            </div>
                          )}

                          {isFixingPk && (
                            <div className="px-3 pb-2 space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 border-t">
                              <p className="text-[10px] text-muted-foreground pt-1.5">
                                Adds an <span className="font-mono">id SERIAL PRIMARY KEY</span> column. Existing rows are assigned sequential IDs automatically.
                              </p>
                              <div className="flex gap-1.5 items-center">
                                <Button size="sm" className="h-7 text-xs" disabled={pkLoading} onClick={async () => {
                                  setPkLoading(true); setPkError(null);
                                  try {
                                    const res = await fetch("/api/pg/add-primary-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, schema: t.table_schema, table: t.table_name }) });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    setFixingPk(null); setRefreshKey((k) => k + 1);
                                  } catch (e: any) { setPkError(e.message); } finally { setPkLoading(false); }
                                }}>
                                  {pkLoading ? "Adding…" : "Add primary key"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFixingPk(null)}>Cancel</Button>
                              </div>
                              {pkError && <p className="text-[10px] text-destructive break-words">{pkError}</p>}
                            </div>
                          )}

                          {isCreatingIdx && (
                            <div className="px-3 pb-2 space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-t">
                              <p className="text-[10px] text-muted-foreground pt-1.5">
                                Creates a <span className="font-mono">GIST</span> index on <span className="font-mono">{t.geom_col}</span> and runs <span className="font-mono">ANALYZE</span>.
                              </p>
                              <div className="flex gap-1.5 items-center">
                                <Button size="sm" className="h-7 text-xs" disabled={idxLoading} onClick={async () => {
                                  setIdxLoading(true); setIdxError(null);
                                  try {
                                    const res = await fetch("/api/pg/create-spatial-index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, schema: t.table_schema, table: t.table_name, geomCol: t.geom_col }) });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    setCreatingIdx(null); setRefreshKey((k) => k + 1);
                                  } catch (e: any) { setIdxError(e.message); } finally { setIdxLoading(false); }
                                }}>
                                  {idxLoading ? "Creating…" : "Create spatial index"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatingIdx(null)}>Cancel</Button>
                              </div>
                              {idxError && <p className="text-[10px] text-destructive break-words">{idxError}</p>}
                            </div>
                          )}

                          {isCastingGeom && (
                            <div className="px-3 pb-2 space-y-1.5 bg-violet-50/50 dark:bg-violet-950/20 border-t">
                              <p className="text-[10px] text-muted-foreground pt-1.5">
                                Casts the geometry column to a specific type. All existing rows must already be of that geometry type.
                              </p>
                              <div className="grid grid-cols-2 gap-1.5">
                                <Select value={castType} onValueChange={setCastType}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["Point","MultiPoint","LineString","MultiLineString","Polygon","MultiPolygon","GeometryCollection"].map((gt) => (
                                      <SelectItem key={gt} value={gt} className="text-xs">{gt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input value={castSrid} onChange={(e) => setCastSrid(e.target.value)} className="h-7 text-xs font-mono" placeholder="SRID e.g. 4326" />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <Button size="sm" className="h-7 text-xs" disabled={castLoading} onClick={async () => {
                                  setCastLoading(true); setCastError(null);
                                  try {
                                    const res = await fetch("/api/pg/cast-geometry-type", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, schema: t.table_schema, table: t.table_name, geomCol: t.geom_col, newType: castType, srid: castSrid }) });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    setCastingGeom(null); setRefreshKey((k) => k + 1);
                                  } catch (e: any) { setCastError(e.message); } finally { setCastLoading(false); }
                                }}>
                                  {castLoading ? "Casting…" : "Cast type"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCastingGeom(null)}>Cancel</Button>
                              </div>
                              {castError && <p className="text-[10px] text-destructive break-words">{castError}</p>}
                            </div>
                          )}

                          {isClusteringTable && (
                            <div className="px-3 pb-2 space-y-1.5 bg-teal-50/50 dark:bg-teal-950/20 border-t">
                              <p className="text-[10px] text-muted-foreground pt-1.5">
                                Physically reorders rows to match the spatial index, improving tile query performance on large tables. Runs <span className="font-mono">CLUSTER</span> then <span className="font-mono">ANALYZE</span>.
                              </p>
                              <div className="flex gap-1.5 items-center">
                                <Button size="sm" className="h-7 text-xs" disabled={clusterLoading} onClick={async () => {
                                  setClusterLoading(true); setClusterError(null);
                                  try {
                                    const res = await fetch("/api/pg/cluster-table", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, schema: t.table_schema, table: t.table_name, geomCol: t.geom_col }) });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    setClusteringTable(null); setRefreshKey((k) => k + 1);
                                  } catch (e: any) { setClusterError(e.message); } finally { setClusterLoading(false); }
                                }}>
                                  {clusterLoading ? "Clustering…" : "Cluster table"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setClusteringTable(null)}>Cancel</Button>
                              </div>
                              {clusterError && <p className="text-[10px] text-destructive break-words">{clusterError}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {/* Empty states — only shown when the connection section is expanded */}
              {connectionOpen && !loading && tables.length === 0 && (
                <div className="pl-8 pr-3 py-3 space-y-1">
                  <p className="text-xs text-muted-foreground">No tables found in this database.</p>
                  <p className="text-xs text-muted-foreground/60">Create a table or import data to get started.</p>
                </div>
              )}
              {connectionOpen && !loading && tables.length > 0 && spatialTables.length === 0 && (
                <div className="pl-8 pr-3 py-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{tables.length} table{tables.length !== 1 ? "s" : ""} found, but none have a geometry column.</p>
                  <p className="text-xs text-muted-foreground/60">Import spatial data or add a PostGIS geometry column to get started.</p>
                </div>
              )}
            </>
          )}

          {/* Basemaps root node */}
          <div className="border-t">
            <button
              className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/60 text-left select-none"
              onClick={() => setBasemapOpen((v) => !v)}
            >
              {basemapOpen
                ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
              }
              <Globe className="w-4 h-4 shrink-0 text-sky-400" />
              <span className="text-xs font-semibold flex-1 text-left">Basemaps</span>
            </button>

            {basemapOpen && (
              <>
                {BASEMAP_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left hover:bg-muted/40 text-xs text-muted-foreground`}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "basemap", key } }); }}
                    onDoubleClick={() => { onBasemapChange(key); setTab("layers"); }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 border ${basemap === key ? "bg-primary border-primary" : "border-muted-foreground"}`} />
                    <span className="flex-1">{label}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* LAYERS TAB */}
      {!sidebarCollapsed && tab === "layers" && (
        <ScrollArea className="flex-1 min-h-0">
          {layers.length === 0 && !basemap && (
            <div className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">No layers added yet.</p>
              <p className="text-xs text-muted-foreground/60">Double-click a table in the Browser tab, or right-click for more options.</p>
            </div>
          )}

          {[...layers].reverse().map((layer) => {
            const gt = (layer.geomTypeOverride ?? layer.table.geom_type ?? "").toLowerCase();
            const isLine = gt.includes("linestring");
            const isDragOver = dragOverId === layer.id && dragId !== layer.id;

            return (
              <div
                key={layer.id}
                className={`border-b select-none ${isDragOver ? "border-t-2 border-t-primary" : ""} ${dragId === layer.id ? "opacity-40" : ""} ${activeLayerId === layer.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                draggable
                onDragStart={() => setDragId(layer.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(layer.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null); }}
                onDrop={(e) => { e.preventDefault(); handleLayerDrop(layer.id); }}
                onContextMenu={(e) => { e.preventDefault(); setLayerCtx({ x: e.clientX, y: e.clientY, layerId: layer.id }); }}
              >
                {/* Layer row */}
                <div className={`flex items-center gap-1 px-1.5 py-1.5 min-w-0 ${!layer.visible ? "opacity-40" : ""}`}>
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 cursor-grab" />
                  <span
                    className="block shrink-0 w-3.5 h-3.5 rounded-sm border border-border"
                    style={{ backgroundColor: (() => {
                      if (isLine) {
                        const sc = (layer.controls ?? []).find(c => c.type === "stroke" && c.enabled) as Extract<LayerControl, { type: "stroke" }> | undefined;
                        return sc ? sc.color : layer.style.strokeColor;
                      }
                      const fc = (layer.controls ?? []).find(c => c.type === "fill" && c.enabled) as Extract<LayerControl, { type: "fill" }> | undefined;
                      const cc = (layer.controls ?? []).find(c => c.type === "categorical" && c.enabled && (c as any).target === "fill") as Extract<LayerControl, { type: "categorical" }> | undefined;
                      return fc ? fc.color : cc ? cc.defaultColor : layer.style.color;
                    })() }}
                  />
                  <span
                    className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden"
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="text-xs truncate font-medium leading-tight max-w-50" title={layer.table.table_name}>{layer.table.table_name}</span>
                      {layer.table.table_schema !== "public" && (
                        <span className="text-[10px] text-muted-foreground truncate leading-tight" title={layer.table.table_schema}>{layer.table.table_schema}</span>
                      )}
                    </span>
                    {(layer.controls ?? []).length > 0 && (
                      <Badge variant="secondary" className="shrink-0 h-4 px-1 text-[10px]">
                        {(layer.controls ?? []).length}
                      </Badge>
                    )}
                  </span>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                    onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
                    title={layer.visible ? "Hide" : "Show"}
                  >
                    {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Controls panel */}
                {expandedLayer === layer.id && expandedSection === "controls" && (
                  <div className="px-3 pb-3 pt-2 bg-muted/20 border-t space-y-3 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Controls</span>
                      <button onClick={() => { setExpandedLayer(null); setExpandedSection(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </div>
                    {(layer.table.geom_type === "GEOMETRY" || layer.table.geom_type === "GEOGRAPHY") && (
                      <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select value={layer.geomTypeOverride ?? ""} onValueChange={(v) => onUpdateLayer(layer.id, { geomTypeOverride: v || null })}>
                          <SelectTrigger className={`h-7 text-xs ${!layer.geomTypeOverride ? "border-amber-400 dark:border-amber-600" : ""}`}>
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Point","MultiPoint","LineString","MultiLineString","Polygon","MultiPolygon"].map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <LayerFilterEditor layer={layer} connectionId={connectionId} onUpdateLayer={onUpdateLayer} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Active basemap entry */}
          {basemap && (() => {
            const bDef = BASEMAP_OPTIONS.find((b) => b.key === basemap);
            return (
              <div className="flex items-center gap-1 px-1.5 py-1.5 border-t">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/20" />
                <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span className="flex-1 flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate leading-tight">{bDef?.label ?? basemap}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Basemap</span>
                </span>
                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                  title="Remove basemap"
                  onClick={() => onBasemapChange("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })()}
        </ScrollArea>
      )}
      {!sidebarCollapsed && <ImportTasksPanel onRefresh={() => setRefreshKey((k) => k + 1)} />}
      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        connectionId={connectionId}
        onCreated={() => setRefreshKey((k) => k + 1)}
        defaultSchema={createDefaultSchema}
      />
      {renameTarget && (
        <RenameTableDialog
          open={!!renameTarget}
          onOpenChange={(v) => { if (!v) setRenameTarget(null); }}
          connectionId={connectionId}
          schema={renameTarget.schema}
          table={renameTarget.table}
          onRenamed={() => {
            setRenameTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
      {tableInfoTarget && (
        <TableInfoDialog
          open={!!tableInfoTarget}
          onOpenChange={(v) => { if (!v) setTableInfoTarget(null); }}
          connectionId={connectionId}
          schema={tableInfoTarget.schema}
          table={tableInfoTarget.table}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {attrTableLayer && (
        <AttributeTableDialog
          open={!!attrTableLayer}
          onOpenChange={(v) => { if (!v) setAttrTableLayer(null); }}
          connectionId={connectionId}
          schema={attrTableLayer.table.table_schema}
          table={attrTableLayer.table.table_name}
          geomCol={attrTableLayer.table.geom_col}
          onFlyTo={onFlyTo}
          filters={attrTableLayer.controls}
          onFiltersChange={(attrControls) => {
            const nonAttr = (attrTableLayer.controls ?? []).filter(c => c.type !== "attribute");
            onUpdateLayer(attrTableLayer.id, { controls: [...nonAttr, ...attrControls] });
          }}
          onDataChanged={() => {
            const current = layers.find((l) => l.id === attrTableLayer.id);
            if (current) onUpdateLayer(current.id, { dataVersion: (current.dataVersion ?? 0) + 1 });
          }}
        />
      )}
      {deleteTarget && (
        <DeleteTableDialog
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          connectionId={connectionId}
          schema={deleteTarget.schema}
          table={deleteTarget.table}
          onDeleted={() => {
            setDeleteTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-44 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.target.type === "connection" && (
            <>
              <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { onOpenSettings?.(); setContextMenu(null); }}>
                {connectionId ? "Change connection" : "Connect…"}
              </button>
              {connectionId && (
                <>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setCreateOpen(true); setContextMenu(null); }}>
                    Create table
                  </button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setRefreshKey((k) => k + 1); setContextMenu(null); }}>
                    Refresh
                  </button>
                </>
              )}
            </>
          )}
          {contextMenu.target.type === "schema" && (() => {
            const { schema } = contextMenu.target as { type: "schema"; schema: string };
            return (
              <>
                <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setCreateDefaultSchema(schema); setCreateOpen(true); setContextMenu(null); }}>
                  New table
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setRefreshKey((k) => k + 1); setContextMenu(null); }}>
                  Refresh
                </button>
              </>
            );
          })()}
          {contextMenu.target.type === "table" && (() => {
            const t = contextMenu.target.table;
            const alreadyAdded = layerKeys.has(`${t.table_schema}.${t.table_name}`);
            return (
              <>
                <button
                  className={`w-full text-left px-3 py-1.5 hover:bg-muted ${alreadyAdded ? "text-muted-foreground" : ""}`}
                  onClick={() => { if (!alreadyAdded) { onAddLayer(t); setTab("layers"); } setContextMenu(null); }}
                >
                  {alreadyAdded ? "Already on map" : "Add to map"}
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setTableInfoTarget({ schema: t.table_schema, table: t.table_name }); setContextMenu(null); }}>
                  Table info / columns
                </button>
                {onZoomToTable && (
                  <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { onZoomToTable(t); setContextMenu(null); }}>
                    Zoom to extent
                  </button>
                )}
                <div className="border-t my-1" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-muted" onClick={() => { setRenameTarget({ schema: t.table_schema, table: t.table_name }); setContextMenu(null); }}>
                  Rename / Move
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-muted text-destructive" onClick={() => { setDeleteTarget({ schema: t.table_schema, table: t.table_name }); setContextMenu(null); }}>
                  Delete table
                </button>
              </>
            );
          })()}
          {contextMenu.target.type === "basemap" && (() => {
            const { key } = contextMenu.target as { type: "basemap"; key: string };
            const alreadyActive = basemap === key;
            return (
              <button
                className={`w-full text-left px-3 py-1.5 hover:bg-muted ${alreadyActive ? "text-muted-foreground" : ""}`}
                onClick={() => { if (!alreadyActive) { onBasemapChange(key); setTab("layers"); } setContextMenu(null); }}
              >
                {alreadyActive ? "Already on map" : "Add to map"}
              </button>
            );
          })()}
        </div>
      )}

      {/* Layer context menu */}
      {layerCtx && (() => {
        const layer = layers.find((l) => l.id === layerCtx.layerId);
        if (!layer) return null;
        const isControlsOpen = expandedLayer === layer.id && expandedSection === "controls";
        return (
          <div
            ref={layerCtxRef}
            className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-44 text-xs"
            style={{ left: layerCtx.x, top: layerCtx.y }}
          >
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center justify-between"
              onClick={() => { toggleSection(layer.id); setLayerCtx(null); }}>
              Controls
              {(layer.controls ?? []).length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{(layer.controls ?? []).length}</Badge>}
              {isControlsOpen && (layer.controls ?? []).length === 0 && <span className="text-[10px] text-primary">▸</span>}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted"
              onClick={() => { setAttrTableLayer(layer); setLayerCtx(null); }}>
              Open attribute table
            </button>
            <div className="border-t my-1" />
            {onZoomToLayer && (
              <button className="w-full text-left px-3 py-1.5 hover:bg-muted"
                onClick={() => { onZoomToLayer(layer); setLayerCtx(null); }}>
                <Maximize2 className="inline h-3 w-3 mr-1.5 mb-0.5" />Zoom to extent
              </button>
            )}
            <div className="border-t my-1" />
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted"
              onClick={() => { onUpdateLayer(layer.id, { visible: !layer.visible }); setLayerCtx(null); }}>
              {layer.visible ? <EyeOff className="inline h-3 w-3 mr-1.5 mb-0.5" /> : <Eye className="inline h-3 w-3 mr-1.5 mb-0.5" />}
              {layer.visible ? "Hide layer" : "Show layer"}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-muted text-destructive"
              onClick={() => { onRemoveLayer(layer.id); setLayerCtx(null); }}>
              Remove layer
            </button>
          </div>
        );
      })()}

    </aside>
  );
}
