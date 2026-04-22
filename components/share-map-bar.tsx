"use client";
import React from "react";
import { Eye, EyeOff, Locate, ChevronDown, BookOpen, Layers as LayersIcon, Map as MapIcon, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { MapLayer, LayerControl, TemporalMode } from "@/lib/types";
import { BASEMAP_OPTIONS } from "@/lib/types";
import Link from "next/link";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCol(col: string) { return col.replace(/_/g, " ").toUpperCase(); }

function toTitleCase(name: string): string {
  return name.replace(/[_\-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getControlLabel(c: LayerControl): string {
  if ("label" in c && c.label) return c.label;
  switch (c.type) {
    case "temporal": return "Timeline";
    case "categorical": return c.target === "fill" ? `Color by ${fmtCol(c.column)}` : `Stroke by ${fmtCol(c.column)}`;
    case "numeric":
      if (c.target === "radius") return "Radius by Value";
      if (c.target === "opacity") return "Opacity by Value";
      if (c.target === "strokeOpacity") return "Stroke Opacity";
      if (c.target === "line-width") return "Line Width";
      if (c.target === "filter") return `Range · ${fmtCol(c.column)}`;
      return fmtCol(c.column);
    case "threshold": return c.label || (c.target === "fill" ? `Color by ${fmtCol(c.column)}` : `Stroke by ${fmtCol(c.column)}`);
    case "attribute": return c.label || fmtCol(c.column);
    default: return "";
  }
}

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
      <line x1="1" y1="7" x2="13" y2="7" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
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

function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ─── inline edit helpers ──────────────────────────────────────────────────────
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

function InlineEditDate({ value, onChange, align = "left", className }: {
  value: string; onChange: (v: string) => void; align?: "left" | "right"; className?: string;
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

// ─── control viewers ──────────────────────────────────────────────────────────
function TemporalHistogram({ snapPoints, snapCounts, activeFrom, activeTo, mode }: {
  snapPoints: string[]; snapCounts: number[]; activeFrom: number; activeTo: number; mode: "range" | "snapshot";
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
          <rect key={i} x={`${prevPct}%`} width={`${nextPct - prevPct}%`} y={BAR_H - h} height={h}
            className={isActive ? "fill-primary/80" : "fill-muted-foreground/20"} rx={1} />
        );
      })}
    </svg>
  );
}

function TemporalViewer({ f, layerId, onUpdate }: {
  f: Extract<LayerControl, { type: "temporal" }>; layerId: string;
  onUpdate: (id: string, patch: any) => void;
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

  if (!f.dataMin || !f.dataMax) return null;

  return (
    <div className="space-y-2">
      {f.column && (
        <p className="text-[10px] text-muted-foreground">Column: <span className="font-mono text-foreground">{f.column}</span></p>
      )}
      <div className="flex gap-1">
        {(["all", "range", "snapshot"] as TemporalMode[]).map(m => (
          <button key={m} onClick={() => onUpdate(f.id, { mode: m })}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-colors min-h-[32px] ${f.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground border hover:text-foreground"}`}>
            {m === "all" ? "All" : m === "range" ? "Range" : "Snapshot"}
          </button>
        ))}
      </div>
      {f.mode === "all" && (
        <div className="space-y-0.5">
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts} activeFrom={0} activeTo={snapPoints.length - 1} mode="range" />
          <p className="text-[9px] text-muted-foreground text-center mt-0.5">{fmtDate(f.dataMin)} — {fmtDate(f.dataMax)}</p>
        </div>
      )}
      {f.mode === "range" && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
            <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.to.slice(0, 10)}
              onChange={e => onUpdate(f.id, { from: e.target.value })}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
            <span className="text-muted-foreground">to</span>
            <input type="date" value={f.to.slice(0, 10)} min={f.from.slice(0, 10)} max={f.dataMax.slice(0, 10)}
              onChange={e => onUpdate(f.id, { to: e.target.value })}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
          </div>
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts} activeFrom={dateToIdx(f.from)} activeTo={dateToIdx(f.to)} mode="range" />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <InlineEditDate value={f.dataMin} onChange={v => { if (v < f.dataMax.slice(0, 10)) onUpdate(f.id, { dataMin: v, from: v }); }} />
            <InlineEditDate value={f.dataMax} onChange={v => { if (v > f.dataMin.slice(0, 10)) onUpdate(f.id, { dataMax: v, to: v }); }} align="right" />
          </div>
        </div>
      )}
      {f.mode === "snapshot" && (
        <div className="space-y-0.5">
          <div className="flex justify-center mb-1">
            <input type="date" value={f.from.slice(0, 10)} min={f.dataMin.slice(0, 10)} max={f.dataMax.slice(0, 10)}
              onChange={e => { const d = e.target.value; onUpdate(f.id, { from: d, to: d }); }}
              className="border rounded px-1 py-0.5 text-[10px] bg-background w-28" />
          </div>
          <TemporalHistogram snapPoints={snapPoints} snapCounts={snapCounts} activeFrom={dateToIdx(f.from)} activeTo={dateToIdx(f.from)} mode="snapshot" />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <InlineEditDate value={f.dataMin} onChange={v => { if (v < f.dataMax.slice(0, 10)) onUpdate(f.id, { dataMin: v, from: v }); }} />
            <InlineEditDate value={f.dataMax} onChange={v => { if (v > f.dataMin.slice(0, 10)) onUpdate(f.id, { dataMax: v, to: v }); }} align="right" />
          </div>
        </div>
      )}
    </div>
  );
}

function CategoricalViewer({ f, layerId, onUpdate }: {
  f: Extract<LayerControl, { type: "categorical" }>; layerId: string;
  onUpdate: (id: string, patch: any) => void;
}) {
  function toggleValue(val: string) {
    const hidden = new Set(f.hiddenValues);
    if (hidden.has(val)) hidden.delete(val); else hidden.add(val);
    onUpdate(f.id, { hiddenValues: [...hidden] });
  }
  return (
    <div>
      {f.hiddenValues.length > 0 && (
        <button onClick={() => onUpdate(f.id, { hiddenValues: [] })}
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

function NumericViewer({ f, layerId, onUpdate }: {
  f: Extract<LayerControl, { type: "numeric" }>; layerId: string;
  onUpdate: (id: string, patch: any) => void;
}) {
  const [sliderRange, setSliderRange] = React.useState([f.min, f.max]);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => { setSliderRange([f.min, f.max]); }, [f.min, f.max]);
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
  const sliderStep = f.dataMax !== f.dataMin ? Math.max((f.dataMax - f.dataMin) / 1000, 0.0001) : 1;
  if (f.dataMin === f.dataMax) return null;
  const loPct = (sliderRange[0] - f.dataMin) / (f.dataMax - f.dataMin) * 100;
  const hiPct = (sliderRange[1] - f.dataMin) / (f.dataMax - f.dataMin) * 100;
  return (
    <div className="space-y-1">
      <div className="relative pt-4">
        <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
          style={{ left: `clamp(0%, ${loPct}%, 100%)` }}>{fmt(sliderRange[0])}</span>
        <span className="absolute top-0 text-[9px] font-semibold text-foreground tabular-nums -translate-x-1/2 pointer-events-none leading-none"
          style={{ left: `clamp(0%, ${hiPct}%, 100%)` }}>{fmt(sliderRange[1])}</span>
        <Slider min={f.dataMin} max={f.dataMax} step={sliderStep} value={sliderRange}
          onValueChange={([lo, hi]) => {
            setSliderRange([lo, hi]);
            if (debounce.current) clearTimeout(debounce.current);
            debounce.current = setTimeout(() => onUpdate(f.id, { min: lo, max: hi }), 80);
          }} />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
        <InlineEditNumber value={f.dataMin} onChange={v => { if (v < f.dataMax) onUpdate(f.id, { dataMin: v, min: Math.max(sliderRange[0], v) }); }} fmt={fmt} className="text-[9px]" />
        <InlineEditNumber value={f.dataMax} onChange={v => { if (v > f.dataMin) onUpdate(f.id, { dataMax: v, max: Math.min(sliderRange[1], v) }); }} fmt={fmt} align="right" className="text-[9px]" />
      </div>
    </div>
  );
}

function ThresholdViewer({ f, onUpdate }: {
  f: Extract<LayerControl, { type: "threshold" }>; onUpdate: (id: string, patch: any) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Threshold</span>
        <InlineEditNumber value={f.threshold} onChange={v => onUpdate(f.id, { threshold: v })} className="text-[10px] font-mono flex-1" />
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

// ─── panels ───────────────────────────────────────────────────────────────────
function LegendPanel({ layers }: { layers: MapLayer[] }) {
  const visLayers = [...layers].reverse().filter(l => l.table.geom_col);
  if (visLayers.length === 0) return <p className="text-[11px] text-muted-foreground p-3">No layers.</p>;
  return (
    <div className="space-y-3 p-3">
      {visLayers.map(layer => {
        const catControl = (layer.controls ?? []).find(
          c => c.type === "categorical" && c.enabled && c.shared
        ) as Extract<LayerControl, { type: "categorical" }> | undefined;
        const thrControl = (layer.controls ?? []).find(
          c => c.type === "threshold" && c.enabled && c.shared
        ) as Extract<LayerControl, { type: "threshold" }> | undefined;
        const hasCatFill = catControl && catControl.target === "fill" && catControl.rules.length > 0;
        return (
          <div key={layer.id} className={`space-y-1 ${!layer.visible ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-2">
              {!hasCatFill && <GeomSwatch layer={layer} />}
              <span className="text-[11px] font-medium truncate" title={layer.table.table_name}>{toTitleCase(layer.table.table_name)}</span>
            </div>
            {catControl && catControl.rules.length > 0 && (
              <div className="pl-5 space-y-0.5">
                {catControl.rules.slice(0, 10).map(rule => (
                  <div key={rule.value} className={`flex items-center gap-1.5 ${catControl.hiddenValues.includes(rule.value) ? "opacity-40" : ""}`}>
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: rule.color }} />
                    <span className="text-[10px] text-muted-foreground truncate">{rule.value}</span>
                  </div>
                ))}
                {catControl.rules.length > 10 && (
                  <span className="text-[9px] text-muted-foreground pl-3.5">+{catControl.rules.length - 10} more</span>
                )}
              </div>
            )}
            {thrControl && (
              <div className="pl-5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: thrControl.aboveColor }} />
                  <span className="text-[10px] text-muted-foreground">≥ {thrControl.threshold}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: thrControl.belowColor }} />
                  <span className="text-[10px] text-muted-foreground">below</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LayersPanel({ layers, onUpdateLayerRaw, onToggleVisible, onFlyTo }: {
  layers: MapLayer[];
  onUpdateLayerRaw: (id: string, patch: Partial<MapLayer>) => void;
  onToggleVisible: (id: string) => void;
  onFlyTo: (bounds: [[number, number], [number, number]]) => void;
}) {
  const [expandedControl, setExpandedControl] = React.useState<string | null>(null);
  const [collapsedLayers, setCollapsedLayers] = React.useState<Set<string>>(() => new Set());

  const visLayers = [...layers].reverse().filter(l => l.table.geom_col);

  function handleControlUpdate(layerId: string, controlId: string, patch: any) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    onUpdateLayerRaw(layerId, {
      controls: (layer.controls ?? []).map(c => c.id === controlId ? { ...c, ...patch } : c) as LayerControl[],
    });
  }

  async function handleZoom(layer: MapLayer) {
    try {
      const res = await fetch("/api/pg/extent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(layer.shareId ? { shareId: layer.shareId } : { connectionId: layer.connectionId }), schema: layer.table.table_schema, table: layer.table.table_name, geomCol: layer.table.geom_col }),
      });
      const d = await res.json();
      if (d.xmin != null) onFlyTo([[d.xmin, d.ymin], [d.xmax, d.ymax]]);
    } catch {}
  }

  if (visLayers.length === 0) return <p className="text-[11px] text-muted-foreground p-3">No layers.</p>;

  return (
    <div className="divide-y">
      {visLayers.map(layer => {
        const layerControls = (layer.controls ?? []).filter(c => c.shared && c.enabled);
        const isCollapsed = collapsedLayers.has(layer.id);
        return (
          <div key={layer.id} className={`transition-opacity ${!layer.visible ? "opacity-40" : ""}`}>
            <div
              className={`flex items-center gap-2 px-3 py-2 ${layerControls.length > 0 ? "cursor-pointer hover:bg-muted/40" : ""}`}
              onClick={() => layerControls.length > 0 && setCollapsedLayers(prev => {
                const next = new Set(prev);
                next.has(layer.id) ? next.delete(layer.id) : next.add(layer.id);
                return next;
              })}
            >
              <span className="text-[11px] font-medium truncate flex-1" title={layer.table.table_name}>{toTitleCase(layer.table.table_name)}</span>
              <button onClick={e => { e.stopPropagation(); handleZoom(layer); }}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5" title="Zoom to extent">
                <Locate className="h-5 w-5" />
              </button>
              <button onClick={e => { e.stopPropagation(); onToggleVisible(layer.id); }}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title={layer.visible ? "Hide layer" : "Show layer"}>
                {layer.visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
              {layerControls.length > 0 && (
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${isCollapsed ? "" : "rotate-180"}`} />
              )}
            </div>

            {layerControls.length > 0 && (
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? "max-h-0" : "max-h-[600px]"}`}>
                <div className="pl-7 pr-3 border-l ml-4 mb-2 divide-y">
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
                            {c.type === "temporal" && <TemporalViewer f={c} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                            {c.type === "categorical" && <CategoricalViewer f={c} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                            {c.type === "threshold" && <ThresholdViewer f={c} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                            {c.type === "numeric" && c.target !== "radius" && <NumericViewer f={c} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
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
  );
}

function BasemapsPanel({ basemap, onSetBasemap }: { basemap: string; onSetBasemap: (b: string) => void }) {
  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      {BASEMAP_OPTIONS.map(({ key, label }) => (
        <button key={key} onClick={() => onSetBasemap(key)}
          className={`px-3 py-2 rounded-md text-[11px] font-medium text-left transition-colors border ${basemap === key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-transparent"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── bar button ───────────────────────────────────────────────────────────────
function BarButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={label}
      className={`flex items-center justify-center h-9 w-9 rounded transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
      {icon}
    </button>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
type ActivePanel = "legend" | "layers" | "basemaps" | null;

interface ShareMapBarProps {
  mapName?: string;
  layers: MapLayer[];
  basemap: string;
  onSetBasemap: (b: string) => void;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
  onToggleVisible: (id: string) => void;
  onFlyTo: (bounds: [[number, number], [number, number]]) => void;
}

export function ShareMapBar({
  mapName, layers, basemap, onSetBasemap, onUpdateLayer, onToggleVisible, onFlyTo,
}: ShareMapBarProps) {
  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  function togglePanel(panel: ActivePanel) {
    setActivePanel(prev => prev === panel ? null : panel);
  }

  const hasLayers = layers.some(l => l.table.geom_col);
  const hasControls = layers.some(l => (l.controls ?? []).some(c => c.shared && c.enabled));

  return (
    <div ref={barRef} className="absolute top-0 left-0 right-0 z-20">
      {/* Bar */}
      <div className="h-11 flex items-center px-3 gap-3 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        {/* Left: logo + name */}
        <Link href="/" title="PostGIS Frontend" className="shrink-0 hover:opacity-70 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Postgresql_elephant.png" alt="PostGIS Frontend" className="w-7 h-7 shrink-0" />
        </Link>
        {mapName && (
          <span className="text-[16px] font-semibold truncate max-w-[200px] sm:max-w-sm mr-2" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
            {mapName}
          </span>
        )}

        <div className="flex-1" />

        {/* Right: panel buttons */}
        {hasLayers && (
          <BarButton
            icon={<BookOpen className="h-5 w-5" />}
            label="Legend"
            active={activePanel === "legend"}
            onClick={() => togglePanel("legend")}
          />
        )}
        {(hasLayers || hasControls) && (
          <BarButton
            icon={<LayersIcon className="h-5 w-5" />}
            label="Layers"
            active={activePanel === "layers"}
            onClick={() => togglePanel("layers")}
          />
        )}
        <BarButton
          icon={<MapIcon className="h-5 w-5" />}
          label="Basemaps"
          active={activePanel === "basemaps"}
          onClick={() => togglePanel("basemaps")}
        />
      </div>

      {/* Active panel */}
      {activePanel && (
        <div className="absolute top-full right-3 mt-1 w-[min(320px,calc(100vw-24px))] bg-background border rounded-lg shadow-xl overflow-hidden" style={{ maxHeight: "min(70dvh, 480px)", overflowY: "auto" }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b bg-muted/30 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {activePanel === "legend" ? "Legend" : activePanel === "layers" ? "Layers" : "Basemaps"}
            </span>
            <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          {activePanel === "legend" && <LegendPanel layers={layers} />}
          {activePanel === "layers" && (
            <LayersPanel
              layers={layers}
              onUpdateLayerRaw={onUpdateLayer}
              onToggleVisible={onToggleVisible}
              onFlyTo={onFlyTo}
            />
          )}
          {activePanel === "basemaps" && <BasemapsPanel basemap={basemap} onSetBasemap={onSetBasemap} />}
        </div>
      )}
    </div>
  );
}
