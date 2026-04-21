"use client";
import React from "react";
import { ChevronDown, Eye, EyeOff, Locate, SlidersHorizontal, Table2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { MapLayer, LayerControl, TemporalMode } from "@/lib/types";

// ─── control label helper ─────────────────────────────────────────────────────
function fmtCol(col: string) {
  return col.replace(/_/g, " ").toUpperCase();
}
function getControlLabel(c: LayerControl): string {
  if ("label" in c && c.label) return c.label;
  switch (c.type) {
    case "temporal":     return "Timeline";
    case "categorical":  return c.target === "fill" ? `Color by ${fmtCol(c.column)}` : `Stroke by ${fmtCol(c.column)}`;
    case "numeric":
      if (c.target === "radius")        return "Radius by Value";
      if (c.target === "opacity")       return "Opacity by Value";
      if (c.target === "strokeOpacity") return "Stroke Opacity";
      if (c.target === "line-width")    return "Line Width";
      if (c.target === "filter")        return `Range · ${fmtCol(c.column)}`;
      return fmtCol(c.column);
    case "threshold":    return c.label || (c.target === "fill" ? `Color by ${fmtCol(c.column)}` : `Stroke by ${fmtCol(c.column)}`);
    case "attribute":    return c.label || fmtCol(c.column);
    default:             return "";
  }
}

// ─── geometry helpers ─────────────────────────────────────────────────────────
function geomKind(layer: MapLayer): "point" | "line" | "polygon" {
  const raw = (layer.geomTypeOverride || layer.table.geom_type || "").toLowerCase();
  if (raw.includes("linestring") || raw.includes("line")) return "line";
  if (raw.includes("polygon")) return "polygon";
  return "point";
}

function GeomSwatch({ layer }: { layer: MapLayer }) {
  const kind = geomKind(layer);
  const fill = layer.style?.color ?? "#3b82f6";
  const stroke = layer.style?.strokeColor ?? "#ffffff";
  if (kind === "line") return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <line x1="1" y1="7" x2="13" y2="7" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (kind === "polygon") return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <rect x="1" y="1" width="12" height="12" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

// ─── date helpers ─────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ─── inline editable number label ────────────────────────────────────────────
function InlineEditNumber({ value, onChange, fmt: fmtFn, className, align = "left" }: {
  value: number; onChange: (v: number) => void;
  fmt?: (v: number) => string; className?: string; align?: "left" | "right";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const format = fmtFn ?? ((n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2));
  if (editing) {
    return (
      <input autoFocus type="number" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { const v = parseFloat(draft); if (!isNaN(v)) onChange(v); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
        className={`bg-transparent border-b border-primary outline-none tabular-nums ${align === "right" ? "text-right" : ""} ${className ?? ""}`}
      />
    );
  }
  return (
    <span onClick={() => { setEditing(true); setDraft(String(value)); }}
      className={`cursor-pointer hover:font-bold hover:text-foreground transition-all tabular-nums ${className ?? ""}`}
    >{format(value)}</span>
  );
}

// ─── inline editable date label ──────────────────────────────────────────────
function InlineEditDate({ value, onChange, align = "left", className }: {
  value: string; onChange: (v: string) => void;
  align?: "left" | "right"; className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
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
    >{fmtDate(value)}</span>
  );
}

// ─── per-control viewer components ───────────────────────────────────────────
// ─── temporal histogram ───────────────────────────────────────────────────────
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
        const prevPct = i > 0 ? (((i - 0.5) / (snapPoints.length - 1)) * 100) : 0;
        const nextPct = i < snapPoints.length - 1 ? (((i + 0.5) / (snapPoints.length - 1)) * 100) : 100;
        const h = Math.max(2, (snapCounts[i] / maxCount) * BAR_H);
        const isActive = mode === "snapshot" ? i === activeFrom : i >= activeFrom && i <= activeTo;
        return (
          <rect key={i} x={`${prevPct}%`} width={`${nextPct - prevPct}%`}
            y={BAR_H - h} height={h}
            className={isActive ? "fill-primary/80" : "fill-muted-foreground/20"} rx={1} />
        );
      })}
    </svg>
  );
}

function TemporalViewer({ f, layerId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "temporal" }>;
  layerId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const snapPoints: string[] = (f as any).snapPoints ?? [];
  const snapCounts: number[] = (f as any).snapCounts ?? [];

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

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layerId, { __controlPatch: { id: f.id, patch } } as any);
  }

  if (!f.dataMin || !f.dataMax) return null;

  return (
    <div className="space-y-2">
      {f.column && (
        <p className="text-[10px] text-muted-foreground">Column: <span className="font-mono text-foreground">{f.column}</span></p>
      )}
      <div className="flex gap-1">
        {(["all", "range", "snapshot"] as TemporalMode[]).map(m => (
          <button key={m} onClick={() => update({ mode: m })}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors min-h-[32px] ${f.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground border hover:text-foreground"}`}>
            {m === "all" ? "All" : m === "range" ? "Range" : "Snapshot"}
          </button>
        ))}
      </div>
      {f.mode === "all" && (
        <div className="space-y-0.5">
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts}
            activeFrom={0} activeTo={snapPoints.length - 1} mode="range" />
          <p className="text-[9px] text-muted-foreground text-center mt-0.5">{fmtDate(f.dataMin)} — {fmtDate(f.dataMax)}</p>
        </div>
      )}
      {f.mode === "range" && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
            <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.to.slice(0, 10)}
              onChange={e => update({ from: e.target.value })}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
            <span className="text-muted-foreground">to</span>
            <input type="date" value={f.to.slice(0, 10)} min={f.from.slice(0, 10)} max={f.dataMax.slice(0, 10)}
              onChange={e => update({ to: e.target.value })}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
          </div>
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts}
            activeFrom={dateToIdx(f.from)} activeTo={dateToIdx(f.to)} mode="range" />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <InlineEditDate value={f.dataMin} onChange={v => { if (v < f.dataMax.slice(0, 10)) update({ dataMin: v, from: v }); }} />
            <InlineEditDate value={f.dataMax} onChange={v => { if (v > f.dataMin.slice(0, 10)) update({ dataMax: v, to: v }); }} align="right" />
          </div>
        </div>
      )}
      {f.mode === "snapshot" && (
        <div className="space-y-0.5">
          <div className="flex justify-center mb-1">
            <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.dataMax.slice(0, 10)}
              onChange={e => { const d = e.target.value; update({ from: d, to: d }); }}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
          </div>
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts}
            activeFrom={dateToIdx(f.from)} activeTo={dateToIdx(f.from)} mode="snapshot" />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <InlineEditDate value={f.dataMin} onChange={v => { if (v < f.dataMax.slice(0, 10)) update({ dataMin: v, from: v }); }} />
            <InlineEditDate value={f.dataMax} onChange={v => { if (v > f.dataMin.slice(0, 10)) update({ dataMax: v, to: v }); }} align="right" />
          </div>
        </div>
      )}
    </div>
  );
}

function CategoricalViewer({ f, layerId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "categorical" }>;
  layerId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  function toggleValue(val: string) {
    const hidden = new Set(f.hiddenValues);
    if (hidden.has(val)) hidden.delete(val); else hidden.add(val);
    onUpdateLayer(layerId, { __controlPatch: { id: f.id, patch: { hiddenValues: [...hidden] } } } as any);
  }

  return (
    <div>
      {f.hiddenValues.length > 0 && (
        <button onClick={() => onUpdateLayer(layerId, { __controlPatch: { id: f.id, patch: { hiddenValues: [] } } } as any)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-0.5">
          Show all
        </button>
      )}
      <div>
        {f.rules.map(rule => {
          const hidden = f.hiddenValues.includes(rule.value);
          return (
            <button key={rule.value} onClick={() => toggleValue(rule.value)}
              className={`flex items-center gap-1 w-full text-left transition-opacity py-px ${hidden ? "opacity-40" : ""}`}>
              <span className="w-2 h-2 rounded-sm shrink-0 border" style={{ backgroundColor: rule.color }} />
              <span className="text-[10px] truncate leading-tight">{rule.value}</span>
            </button>
          );
        })}
        {f.rules.length === 0 && <p className="text-[10px] text-muted-foreground">Toggle categories to filter the map.</p>}
      </div>
    </div>
  );
}

const NUMERIC_TYPES_SET = new Set([
  "smallint", "integer", "bigint", "decimal", "numeric", "real", "double precision", "money",
]);

function NumericViewer({ f, layerId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "numeric" }>;
  layerId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [sliderRange, setSliderRange] = React.useState([f.min, f.max]);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSliderRange([f.min, f.max]);
  }, [f.min, f.max]);

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layerId, { __controlPatch: { id: f.id, patch } } as any);
  }

  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
  const sliderStep = f.dataMax !== f.dataMin ? Math.max((f.dataMax - f.dataMin) / 1000, 0.0001) : 1;

  if (f.dataMin === f.dataMax) return null;

  const loPct = (sliderRange[0] - f.dataMin) / (f.dataMax - f.dataMin) * 100;
  const hiPct = (sliderRange[1] - f.dataMin) / (f.dataMax - f.dataMin) * 100;

  return (
    <div className="space-y-1">
      <div className="relative pt-4">
        {/* Floating value labels above each thumb */}
        <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
          style={{ left: `clamp(0%, ${loPct}%, 100%)` }}>{fmt(sliderRange[0])}</span>
        <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
          style={{ left: `clamp(0%, ${hiPct}%, 100%)` }}>{fmt(sliderRange[1])}</span>
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
  );
}

function RadiusViewer({ f, layer, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "numeric" }>;
  layer: MapLayer;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  const [cols, setCols] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/pg/columns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(layer.shareId ? { shareId: layer.shareId } : { connectionId: layer.connectionId }), schema: layer.table.table_schema, table: layer.table.table_name }) })
      .then(r => r.json())
      .then(d => setCols((d.columns ?? []).filter((c: any) => NUMERIC_TYPES_SET.has(c.dataType)).map((c: any) => c.name)))
      .catch(() => {});
  }, [layer.shareId, layer.connectionId, layer.table.table_schema, layer.table.table_name]);

  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layer.id, { __controlPatch: { id: f.id, patch } } as any);
  }

  async function fetchExtent(col: string) {
    setOpen(false);
    try {
      const res = await fetch("/api/pg/numeric-extent", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(layer.shareId ? { shareId: layer.shareId } : { connectionId: layer.connectionId }), schema: layer.table.table_schema, table: layer.table.table_name, column: col }) });
      const d = await res.json();
      if (d.min != null && d.max != null) {
        update({ column: col, dataMin: d.min, dataMax: d.max, min: d.min, max: d.max });
      } else {
        update({ column: col });
      }
    } catch {}
  }

  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

  return (
    <div className="space-y-2">
      {/* Column selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground shrink-0">Column</span>
        <div className="relative flex-1">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between gap-1 border rounded px-2 py-1 text-[11px] font-mono bg-background hover:bg-muted transition-colors"
          >
            <span className="truncate">{f.column || "—"}</span>
            <span className="text-muted-foreground text-[9px]">▾</span>
          </button>
          {open && cols.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-background border rounded shadow-md min-w-full max-h-40 overflow-y-auto">
              {cols.map(c => (
                <button key={c} onClick={() => fetchExtent(c)}
                  className={`w-full text-left px-2 py-1 text-[11px] font-mono hover:bg-muted transition-colors ${c === f.column ? "text-primary font-semibold" : ""}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {f.dataMin !== f.dataMax && (
        <div className="pt-0.5">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Scale mapping</p>
          <div className="flex items-end justify-between gap-2 px-1">
            {/* Min side */}
            <div className="flex flex-col items-center gap-1.5">
              <svg width={Math.max(6, Math.min(24, f.minOutput * 2))} height={Math.max(6, Math.min(24, f.minOutput * 2))} className="overflow-visible">
                <circle cx={Math.max(3, Math.min(12, f.minOutput))} cy={Math.max(3, Math.min(12, f.minOutput))} r={Math.max(3, Math.min(12, f.minOutput))} className="fill-primary/70" />
              </svg>
              <div className="flex flex-col items-center gap-0.5">
                <InlineEditNumber value={f.minOutput} onChange={v => update({ minOutput: Math.max(1, Math.min(v, f.maxOutput - 1)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                <div className="w-px h-2 bg-border" />
                <InlineEditNumber value={f.dataMin} onChange={v => { if (v < f.dataMax) update({ dataMin: v, min: Math.max(f.min, v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
              </div>
            </div>
            {/* Connector */}
            <div className="flex-1 flex items-center pb-7">
              <div className="w-full h-px bg-border" style={{ borderStyle: "dashed" }} />
            </div>
            {/* Max side */}
            <div className="flex flex-col items-center gap-1.5">
              <svg width={Math.max(6, Math.min(40, f.maxOutput * 2))} height={Math.max(6, Math.min(40, f.maxOutput * 2))} className="overflow-visible">
                <circle cx={Math.max(3, Math.min(20, f.maxOutput))} cy={Math.max(3, Math.min(20, f.maxOutput))} r={Math.max(3, Math.min(20, f.maxOutput))} className="fill-primary" />
              </svg>
              <div className="flex flex-col items-center gap-0.5">
                <InlineEditNumber value={f.maxOutput} onChange={v => update({ maxOutput: Math.max(f.minOutput + 1, Math.min(v, 60)) })} fmt={v => `${v}px`} className="text-[10px] text-muted-foreground w-10 text-center" />
                <div className="w-px h-2 bg-border" />
                <InlineEditNumber value={f.dataMax} onChange={v => { if (v > f.dataMin) update({ dataMax: v, max: Math.min(f.max, v) }); }} fmt={fmt} className="text-[9px] text-muted-foreground/70 w-14 text-center" />
              </div>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/60 text-center mt-1">Click any value to edit</p>
        </div>
      )}
    </div>
  );
}

function ThresholdViewer({ f, layerId, onUpdateLayer }: {
  f: Extract<LayerControl, { type: "threshold" }>;
  layerId: string;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
}) {
  function update(patch: Partial<typeof f>) {
    onUpdateLayer(layerId, { __controlPatch: { id: f.id, patch } } as any);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Threshold</span>
        <InlineEditNumber
          value={f.threshold}
          onChange={v => update({ threshold: v })}
          className="text-[10px] font-mono flex-1"
        />
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-3 h-3 rounded-sm shrink-0 border" style={{ backgroundColor: f.aboveColor }} />
        <span className="text-muted-foreground">≥ threshold</span>
        <span className="w-3 h-3 rounded-sm shrink-0 border ml-auto" style={{ backgroundColor: f.belowColor }} />
        <span className="text-muted-foreground">below</span>
      </div>
    </div>
  );
}

// ─── main panel ───────────────────────────────────────────────────────────────
interface Props {
  layers: MapLayer[];
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
  onToggleVisible?: (id: string) => void;
  onFlyTo?: (bounds: [[number, number], [number, number]]) => void;
  onOpenAttributeTable?: (layer: MapLayer) => void;
}

export function ViewerFiltersPanel({ layers, onUpdateLayer, onToggleVisible, onFlyTo, onOpenAttributeTable }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const firstControlId = layers.flatMap(l => (l.controls ?? []).filter(c => c.shared && c.enabled && c.type !== "attribute"))[0]?.id ?? null;
  const [expandedControl, setExpandedControl] = React.useState<string | null>(firstControlId);
  const [collapsedLayers, setCollapsedLayers] = React.useState<Set<string>>(() => new Set(layers.map(l => l.id)));

  const legendLayers = [...layers].reverse().filter(l => l.table.geom_col);

  async function handleZoom(layer: MapLayer) {
    if (!onFlyTo) return;
    try {
      const res = await fetch("/api/pg/extent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(layer.shareId ? { shareId: layer.shareId } : { connectionId: layer.connectionId }), schema: layer.table.table_schema, table: layer.table.table_name, geomCol: layer.table.geom_col }),
      });
      const d = await res.json();
      if (d.xmin != null) onFlyTo([[d.xmin, d.ymin], [d.xmax, d.ymax]]);
    } catch {}
  }
  const sharedControls = layers.flatMap(l =>
    (l.controls ?? []).filter(c => c.shared && c.enabled).map(c => ({ control: c, layer: l }))
  );

  if (legendLayers.length === 0 && sharedControls.length === 0) return null;

  function handleUpdate(layerId: string, patch: Partial<MapLayer> & { __controlPatch?: { id: string; patch: any } }) {
    if ((patch as any).__controlPatch) {
      const { id, patch: cp } = (patch as any).__controlPatch;
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;
      onUpdateLayer(layerId, {
        controls: (layer.controls ?? []).map(c => c.id === id ? { ...c, ...cp } : c) as LayerControl[],
      });
    } else {
      onUpdateLayer(layerId, patch);
    }
  }

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-10 w-[min(560px,calc(100vw-24px))] bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg flex flex-col"
      style={{ bottom: 'max(0.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.25rem))' }}
    >
      {/* Header / toggle — min 44px touch target */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between w-full px-4 pt-2.5 pb-2.5 min-h-[44px] shrink-0"
      >
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sharedControls.length > 0 ? "Layers & Controls" : "Layers"}
          </span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${collapsed ? "max-h-0" : "max-h-[480px]"}`}>
        <div
          className="overflow-y-auto overscroll-contain px-4 pb-3"
          style={{ maxHeight: 'min(60dvh, 480px)' }}
        >
          <div className="divide-y">
            {legendLayers.map(layer => {
              const layerControls = (layer.controls ?? []).filter(c => c.shared && c.enabled);
              const isLayerCollapsed = collapsedLayers.has(layer.id);
              return (
                <div key={layer.id} className={`transition-opacity ${!layer.visible ? "opacity-40" : ""}`}>
                  {/* Layer header row */}
                  <div
                    className={`flex items-center gap-2 py-1.5 rounded transition-colors ${layerControls.length > 0 ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    onClick={() => layerControls.length > 0 && setCollapsedLayers(prev => {
                      const next = new Set(prev);
                      next.has(layer.id) ? next.delete(layer.id) : next.add(layer.id);
                      return next;
                    })}
                  >
                    <GeomSwatch layer={layer} />
                    <span className="text-[11px] font-medium truncate flex-1">{layer.table.table_name}</span>
                    {onOpenAttributeTable && layer.table.geom_col && (
                      <button onClick={e => { e.stopPropagation(); onOpenAttributeTable(layer); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        title="View attribute table">
                        <Table2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onFlyTo && (
                      <button onClick={e => { e.stopPropagation(); handleZoom(layer); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        title="Zoom to extent">
                        <Locate className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onToggleVisible && (
                      <button onClick={e => { e.stopPropagation(); onToggleVisible(layer.id); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        title={layer.visible ? "Hide layer" : "Show layer"}>
                        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {layerControls.length > 0 && (
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${isLayerCollapsed ? "" : "rotate-180"}`} />
                    )}
                  </div>

                  {/* Controls belonging to this layer */}
                  {layerControls.length > 0 && (
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isLayerCollapsed ? "max-h-0" : "max-h-[600px]"}`}>
                      <div className="pl-4 border-l ml-1.5 mb-1.5 divide-y">
                        {layerControls.map(c => {
                          const isOpen = expandedControl === c.id;
                          const isInteractive = c.type !== "attribute";
                          return (
                            <div key={c.id}>
                              <button
                                onClick={() => isInteractive && setExpandedControl(isOpen ? null : c.id)}
                                className={`flex items-center justify-between w-full py-1.5 gap-2 ${isInteractive ? "cursor-pointer" : "cursor-default"}`}
                              >
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-left text-muted-foreground">
                                  {getControlLabel(c)}
                                </span>
                                {isInteractive && (
                                  <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                                )}
                                {c.type === "attribute" && (
                                  <span className="text-[9px] text-muted-foreground font-normal normal-case truncate">
                                    {c.operator} {c.value}
                                  </span>
                                )}
                              </button>
                              <div className={`overflow-hidden transition-all duration-150 ease-in-out ${isOpen ? "max-h-[400px]" : "max-h-0"}`}>
                                <div className="pb-2.5">
                                  {c.type === "temporal" && <TemporalViewer f={c} layerId={layer.id} onUpdateLayer={handleUpdate} />}
                                  {c.type === "categorical" && <CategoricalViewer f={c} layerId={layer.id} onUpdateLayer={handleUpdate} />}
                                  {c.type === "threshold" && <ThresholdViewer f={c} layerId={layer.id} onUpdateLayer={handleUpdate} />}
                                  {c.type === "numeric" && c.target === "radius"
                                    ? <RadiusViewer f={c} layer={layer} onUpdateLayer={handleUpdate} />
                                    : c.type === "numeric" && <NumericViewer f={c} layerId={layer.id} onUpdateLayer={handleUpdate} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
