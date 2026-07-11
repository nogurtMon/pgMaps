"use client";
import React from "react";
import { Eye, EyeOff, Locate, ChevronDown, ChevronUp, Map as MapIcon, X, Table as TableIcon, Loader2, Search, Columns, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { MapLayer, LayerControl, TemporalMode } from "@/lib/types";
import { findIcon, iconDataUri } from "@/lib/point-icons";
import { getBasemapColor, type UserBasemap } from "@/lib/basemaps";
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

function PointSwatchShape({ shape, fill }: { shape: string; fill: string }) {
  switch (shape) {
    case "square":   return <rect x="2" y="2" width="10" height="10" fill={fill} />;
    case "triangle": return <polygon points="7,1.5 13,13 1,13" fill={fill} />;
    case "diamond":  return <polygon points="7,1 13,7 7,13 1,7" fill={fill} />;
    case "star":     return <polygon points="7,1 8.5,5 13,5 9.5,8 11,12.5 7,10 3,12.5 4.5,8 1,5 5.5,5" fill={fill} />;
    case "cross":    return <path d="M4.5,1H9.5V4.5H13V9.5H9.5V13H4.5V9.5H1V4.5H4.5Z" fill={fill} />;
    case "hexagon":  return <polygon points="13,7 10,12.5 4,12.5 1,7 4,1.5 10,1.5" fill={fill} />;
    case "circle":   return <circle cx="7" cy="7" r="5" fill={fill} />;
    default: {
      const href = iconDataUri(findIcon(shape), fill);
      return <image href={href} x="0" y="0" width="14" height="14" />;
    }
  }
}

function GeomSwatch({ layer }: { layer: MapLayer }) {
  const kind = geomKind(layer);
  const fillCtrl = (layer.controls ?? []).find(c => c.type === "fill") as Extract<LayerControl, { type: "fill" }> | undefined;
  const strokeCtrl = (layer.controls ?? []).find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;
  const fill = fillCtrl?.color ?? layer.style?.color ?? "#3b82f6";
  const stroke = strokeCtrl?.color ?? layer.style?.strokeColor ?? "#ffffff";
  const lineColor = strokeCtrl?.color ?? layer.style?.color ?? "#3b82f6";
  if (kind === "line") return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <line x1="1" y1="7" x2="13" y2="7" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (kind === "polygon") return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <rect x="1" y="1" width="12" height="12" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
  const pointShape = layer.style?.pointShape ?? "circle";
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <PointSwatchShape shape={pointShape} fill={fill} />
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
        <p className="text-[10px] text-muted-foreground">Column: <span className="text-foreground">{f.column}</span></p>
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
  function toggleStep(rule: typeof f.rules[number]) {
    const hidden = new Set(f.hiddenValues);
    const allHidden = rule.values.length > 0 && rule.values.every(v => hidden.has(v));
    if (allHidden) rule.values.forEach(v => hidden.delete(v));
    else rule.values.forEach(v => hidden.add(v));
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
        {f.rules.map((rule, i) => {
          const allHidden = rule.values.length > 0 && rule.values.every(v => f.hiddenValues.includes(v));
          const label = rule.values.length === 0
            ? <em className="text-muted-foreground">No values</em>
            : <>{rule.values.slice(0, 2).join(", ")}{rule.values.length > 2 && <span className="text-muted-foreground"> +{rule.values.length - 2}</span>}</>;
          return (
            <button key={i} onClick={() => toggleStep(rule)}
              className={`flex items-center gap-1 w-full text-left transition-opacity py-px ${allHidden ? "opacity-40" : ""}`}>
              <span className="w-2 h-2 rounded-sm shrink-0 border" style={{ backgroundColor: rule.color }} />
              <span className="text-[10px] truncate leading-tight">{label}</span>
            </button>
          );
        })}
        {f.rules.length === 0 && <p className="text-[10px] text-muted-foreground">Toggle categories to filter the map.</p>}
      </div>
    </div>
  );
}

function ShapeCategoricalLegend({ f, layer }: {
  f: Extract<LayerControl, { type: "shape-categorical" }>;
  layer: MapLayer;
}) {
  const fill = ((layer.controls ?? []).find(c => c.type === "fill") as any)?.color ?? layer.style?.color ?? "#3b82f6";
  const allRules = [...f.rules, { values: ["(other)"], shape: f.defaultShape }];
  return (
    <div>
      {allRules.map((rule, i) => {
        const label = i === allRules.length - 1
          ? <em className="text-muted-foreground">Other</em>
          : <>{rule.values.slice(0, 2).join(", ")}{rule.values.length > 2 && <span className="text-muted-foreground"> +{rule.values.length - 2}</span>}</>;
        return (
          <div key={i} className="flex items-center gap-1.5 py-px">
            <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
              <PointSwatchShape shape={rule.shape} fill={fill} />
            </svg>
            <span className="text-[10px] truncate leading-tight">{label}</span>
          </div>
        );
      })}
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
        <InlineEditNumber value={f.threshold} onChange={v => onUpdate(f.id, { threshold: v })} className="text-[10px] flex-1" />
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

function LineWidthScaleLegend({ ctrl, layer }: {
  ctrl: Extract<LayerControl, { type: "numeric" }>;
  layer: MapLayer;
}) {
  const { column, dataMin, dataMax, minOutput, maxOutput } = ctrl;
  const midV = (dataMin + dataMax) / 2;
  const midW = (minOutput + maxOutput) / 2;
  const dynamicColor = (layer.controls ?? []).some(
    c => c.enabled && (c.type === "categorical" || c.type === "threshold") &&
      (c as Extract<LayerControl, { type: "categorical" }>).target === "stroke"
  );
  const strokeCtrl = (layer.controls ?? []).find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;
  const color = dynamicColor ? null : (strokeCtrl?.color ?? layer.style?.strokeColor ?? layer.style?.color ?? "#3b82f6");
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
  return (
    <div className="mt-0.5">
      <p className="text-[10px] text-muted-foreground mb-1 capitalize">{column.replace(/_/g, " ")}</p>
      <div className="space-y-1">
        {[{ w: minOutput, v: dataMin }, { w: midW, v: midV }, { w: maxOutput, v: dataMax }].map(({ w, v }, i) => {
          const svgH = Math.max(Math.ceil(w) + 2, 4);
          return (
            <div key={i} className="flex items-center gap-2">
              <svg width="36" height={svgH} viewBox={`0 0 36 ${svgH}`} className="shrink-0 text-foreground/40">
                <line x1="2" y1={svgH / 2} x2="34" y2={svgH / 2}
                  stroke={color ?? "currentColor"} strokeWidth={w} strokeLinecap="round" />
              </svg>
              <span className="text-[9px] text-muted-foreground tabular-nums">{fmt(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── panels ───────────────────────────────────────────────────────────────────
function LayersPanel({ layers, onUpdateLayerRaw, onToggleVisible, onFlyTo }: {
  layers: MapLayer[];
  onUpdateLayerRaw: (id: string, patch: Partial<MapLayer>) => void;
  onToggleVisible: (id: string) => void;
  onFlyTo: (bounds: [[number, number], [number, number]]) => void;
}) {
  const [expandedLayer, setExpandedLayer] = React.useState<string | null>(null);
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
        const sharedControls = (layer.controls ?? []).filter(c => c.shared && c.enabled);
        const catControl = sharedControls.find(c => c.type === "categorical") as Extract<LayerControl, { type: "categorical" }> | undefined;
        const thrControl = sharedControls.find(c => c.type === "threshold") as Extract<LayerControl, { type: "threshold" }> | undefined;
        const lineWidthControl = sharedControls.find(c => c.type === "numeric" && (c as Extract<LayerControl, { type: "numeric" }>).target === "line-width") as Extract<LayerControl, { type: "numeric" }> | undefined;
        const shapeCatControl = (layer.controls ?? []).find(c => c.type === "shape-categorical" && c.enabled) as Extract<LayerControl, { type: "shape-categorical" }> | undefined;
        const interactiveControls = sharedControls.filter(c => c.type === "temporal" || (c.type === "numeric" && (c as any).target !== "radius" && (c as any).target !== "line-width"));
        const hasCatFill = catControl && catControl.target === "fill" && catControl.rules.length > 0;
        const hasInteractive = interactiveControls.length > 0;
        const isExpanded = expandedLayer === layer.id;

        return (
          <div key={layer.id} className={`transition-opacity ${!layer.visible ? "opacity-40" : ""}`}>
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2">
              {!hasCatFill && <GeomSwatch layer={layer} />}
              <span className="text-[11px] font-medium truncate flex-1" title={layer.table.table_name}>{toTitleCase(layer.table.table_name)}</span>
              <button onClick={() => handleZoom(layer)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5" title="Zoom to extent">
                <Locate className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onToggleVisible(layer.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title={layer.visible ? "Hide layer" : "Show layer"}>
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              {hasInteractive && (
                <button onClick={() => setExpandedLayer(isExpanded ? null : layer.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {/* Legend — always visible: categorical, threshold, line-width scale, shape-categorical */}
            {(catControl || thrControl || lineWidthControl || shapeCatControl) && (
              <div className="pl-7 pr-3 pb-2 space-y-1">
                {catControl && <CategoricalViewer f={catControl} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                {thrControl && <ThresholdViewer f={thrControl} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                {lineWidthControl && <LineWidthScaleLegend ctrl={lineWidthControl} layer={layer} />}
                {shapeCatControl && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">Shape by {fmtCol(shapeCatControl.column)}</p>
                    <ShapeCategoricalLegend f={shapeCatControl} layer={layer} />
                  </>
                )}
              </div>
            )}

            {/* Interactive controls (temporal / numeric) — expandable */}
            {hasInteractive && (
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? "max-h-[600px]" : "max-h-0"}`}>
                <div className="pl-7 pr-3 border-l ml-4 mb-2 divide-y">
                  {interactiveControls.map(c => (
                    <div key={c.id} className="py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{getControlLabel(c)}</p>
                      {c.type === "temporal" && <TemporalViewer f={c} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                      {c.type === "numeric" && <NumericViewer f={c} layerId={layer.id} onUpdate={(cid, p) => handleControlUpdate(layer.id, cid, p)} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BasemapsPanel({ basemap, onSetBasemap, userBasemaps }: { basemap: string; onSetBasemap: (b: string) => void; userBasemaps: UserBasemap[] }) {
  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      {userBasemaps.map(({ id, name }) => (
        <button key={id} onClick={() => onSetBasemap(id)}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-left transition-colors border ${basemap === id ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted"}`}>
          <div className="w-6 h-6 rounded shrink-0 border" style={{ background: getBasemapColor(id) }} />
          {name}
        </button>
      ))}
    </div>
  );
}

// ─── table panel ──────────────────────────────────────────────────────────────
const TABLE_PAGE_SIZE = 100;
const TABLE_DEFAULT_HEIGHT = 280;
const TABLE_MIN_HEIGHT = 120;
const TABLE_MAX_HEIGHT = 700;

interface ColumnMeta { name: string; dataType: string; isGeom: boolean; }

function TablePanel({ layers, mapBounds, onClose }: { layers: MapLayer[]; mapBounds?: [number, number, number, number]; onClose: () => void }) {
  const dataLayers = layers.filter(l => l.table.table_name && l.table.table_schema);
  const [activeLayerId, setActiveLayerId] = React.useState(() => dataLayers[0]?.id ?? "");
  const activeLayer = dataLayers.find(l => l.id === activeLayerId) ?? dataLayers[0];
  const schema = activeLayer?.table.table_schema ?? "";
  const table  = activeLayer?.table.table_name  ?? "";

  const [columns, setColumns]         = React.useState<ColumnMeta[]>([]);
  const [rows, setRows]               = React.useState<Record<string, any>[]>([]);
  const [total, setTotal]             = React.useState(0);
  const [page, setPage]               = React.useState(0);
  const [sortCol, setSortCol]         = React.useState<string | null>(null);
  const [sortDir, setSortDir]         = React.useState<"asc" | "desc">("asc");
  const [search, setSearch]           = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [loading, setLoading]         = React.useState(false);
  const [error, setError]             = React.useState<string | null>(null);
  const [visibleOnly, setVisibleOnly] = React.useState(false);
  const [hiddenCols, setHiddenCols]   = React.useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = React.useState(false);
  const [height, setHeight]           = React.useState(TABLE_DEFAULT_HEIGHT);
  const dragRef    = React.useRef<{ startY: number; startH: number } | null>(null);
  const colPickerRef = React.useRef<HTMLDivElement>(null);

  async function fetchRows(opts: { p?: number; sc?: string | null; sd?: "asc" | "desc"; s?: string; vo?: boolean } = {}) {
    if (!schema || !table || !activeLayer) return;
    const p  = opts.p  ?? page;
    const sc = "sc" in opts ? opts.sc : sortCol;
    const sd = opts.sd ?? sortDir;
    const s  = "s"  in opts ? opts.s  : search;
    const vo = "vo" in opts ? opts.vo : visibleOnly;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/pg/table-rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: activeLayer.shareId,
          schema, table,
          page: p, pageSize: TABLE_PAGE_SIZE,
          sortCol: sc, sortDir: sd,
          search: s,
          bbox: vo ? mapBounds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setColumns(data.columns); setRows(data.rows); setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Reset + fetch when layer changes
  const prevKey = React.useRef("");
  React.useEffect(() => {
    if (!schema || !table) return;
    const key = `${schema}.${table}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    setPage(0); setSortCol(null); setSortDir("asc"); setSearch(""); setSearchInput("");
    setVisibleOnly(false); setHiddenCols(new Set());
    fetchRows({ p: 0, sc: null, sd: "asc", s: "", vo: false });
  }, [schema, table]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevBoundsRef = React.useRef<string>("");
  React.useEffect(() => {
    const key = JSON.stringify(mapBounds);
    if (!visibleOnly || key === prevBoundsRef.current) return;
    prevBoundsRef.current = key;
    fetchRows({ p: 0 });
  }, [mapBounds]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(col: string) {
    let nc: string | null = col, nd: "asc" | "desc" = "asc";
    if (sortCol === col) { if (sortDir === "asc") nd = "desc"; else nc = null; }
    setSortCol(nc); setSortDir(nd); setPage(0); fetchRows({ p: 0, sc: nc, sd: nd });
  }
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = searchInput.trim(); setSearch(s); setPage(0); fetchRows({ p: 0, s });
  }
  function clearSearch() { setSearchInput(""); setSearch(""); setPage(0); fetchRows({ p: 0, s: "" }); }
  function handlePageChange(np: number) { setPage(np); fetchRows({ p: np }); }

  function onDragMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setHeight(Math.min(TABLE_MAX_HEIGHT, Math.max(TABLE_MIN_HEIGHT, dragRef.current.startH + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (dataLayers.length === 0) return null;

  const pageCount = Math.ceil(total / TABLE_PAGE_SIZE);
  const rowStart  = page * TABLE_PAGE_SIZE + 1;
  const rowEnd    = Math.min((page + 1) * TABLE_PAGE_SIZE, total);
  const displayCols = columns.filter(c => !hiddenCols.has(c.name));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t shadow-2xl flex flex-col" style={{ height }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragMouseDown}
        className="h-1.5 w-full shrink-0 cursor-row-resize flex items-center justify-center group hover:bg-primary/10 transition-colors"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center border-b shrink-0 bg-muted/20 px-2 gap-2">
        <div className="flex-1 min-w-0 max-w-64">
          <select
            value={activeLayerId}
            onChange={e => setActiveLayerId(e.target.value)}
            className="h-6 text-xs bg-transparent border rounded px-1.5 w-full max-w-[220px] text-foreground"
          >
            {dataLayers.map(l => (
              <option key={l.id} value={l.id}>{l.table.table_schema}.{l.table.table_name}</option>
            ))}
          </select>
        </div>

        {/* All / Visible toggle */}
        <div className="flex rounded border h-6 overflow-hidden text-[11px] shrink-0">
          <button
            className={`px-2 transition-colors ${!visibleOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setVisibleOnly(false); setPage(0); fetchRows({ p: 0, vo: false }); }}
          >All</button>
          <button
            className={`px-2 border-l transition-colors ${visibleOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setVisibleOnly(true); setPage(0); fetchRows({ p: 0, vo: true }); }}
          >Visible</button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-1">
            <Input placeholder="Search…" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="h-6 text-xs w-36" />
            <Button type="submit" size="sm" variant="ghost" className="h-6 w-6 p-0"><Search className="h-3 w-3" /></Button>
            {search && <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={clearSearch}><X className="h-3 w-3" /></Button>}
          </form>
          <div className="relative">
            <Button size="sm" variant={hiddenCols.size > 0 ? "secondary" : "ghost"} className="h-6 text-xs gap-1 px-2"
              onClick={() => setShowColPicker(v => !v)}>
              <Columns className="h-3 w-3" />
            </Button>
            {showColPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)} />
                <div ref={colPickerRef}
                  className="absolute right-0 bottom-full mb-1 z-20 bg-background border rounded-md shadow-lg py-1 min-w-40 max-h-60 overflow-y-auto">
                  <div className="px-2 py-1 flex items-center justify-between border-b mb-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Columns</span>
                    {hiddenCols.size > 0 && <button className="text-[10px] text-primary hover:underline" onClick={() => setHiddenCols(new Set())}>Show all</button>}
                  </div>
                  {columns.map(col => (
                    <label key={col.name} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 cursor-pointer text-xs">
                      <input type="checkbox" className="h-3 w-3 shrink-0" checked={!hiddenCols.has(col.name)}
                        onChange={() => setHiddenCols(prev => { const n = new Set(prev); n.has(col.name) ? n.delete(col.name) : n.add(col.name); return n; })} />
                      <span className="truncate">{col.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && <div className="flex items-center justify-center h-full gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
        {error && <p className="p-3 text-xs text-destructive">{error}</p>}
        {!loading && !error && (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-background z-10 border-b shadow-sm">
              <tr>
                {displayCols.map(col => (
                  <th key={col.name}
                    className={`px-2 py-1.5 text-left border-r last:border-r-0 whitespace-nowrap ${!col.isGeom ? "cursor-pointer select-none hover:bg-muted/60" : ""}`}
                    onClick={() => !col.isGeom && handleSort(col.name)}>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{col.name}</span>
                      {sortCol === col.name && (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary shrink-0" /> : <ChevronDown className="h-3 w-3 text-primary shrink-0" />)}
                    </div>
                    <div className="text-[9px] font-normal font-sans text-muted-foreground/70">{col.dataType}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row._ctid ?? ri}
                  className={`border-b hover:bg-muted/40 transition-colors ${ri % 2 === 0 ? "" : "bg-muted/20"}`}>
                  {displayCols.map(col => {
                    const val = row[col.name];
                    return (
                      <td key={col.name}
                        className="px-2 py-1 border-r last:border-r-0 max-w-[14rem] overflow-hidden"
                        title={val == null ? "NULL" : String(val)}>
                        {val == null
                          ? <span className="text-muted-foreground/40 italic select-none">null</span>
                          : col.isGeom
                            ? <span className="text-muted-foreground text-[10px] truncate block">{String(val).slice(0, 40)}…</span>
                            : <span className="truncate block">{String(val)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={Math.max(displayCols.length, 1)} className="text-center py-8 text-muted-foreground text-xs">
                  {search ? "No rows match the search." : "This table has no rows."}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-3 py-1 flex items-center justify-between text-xs text-muted-foreground bg-background">
        <span>
          {total === 0 ? "No rows" : `${rowStart.toLocaleString()}–${rowEnd.toLocaleString()} of ${total.toLocaleString()} rows`}
          {search && <span className="ml-1 text-primary">(filtered)</span>}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={page === 0 || loading} onClick={() => handlePageChange(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {Math.max(1, pageCount)}</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={page >= pageCount - 1 || loading} onClick={() => handlePageChange(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// ─── bar button ───────────────────────────────────────────────────────────────
function BarButton({ icon, label, active, onClick, showLabel }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; showLabel?: boolean;
}) {
  return (
    <button onClick={onClick} title={label}
      className={`flex items-center justify-center h-7 rounded transition-colors ${showLabel ? "gap-1.5 px-2 text-xs font-medium" : "w-7"} ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
      {icon}
      {showLabel && <span>{label}</span>}
    </button>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
type ActivePanel = "basemaps" | "table" | null;

interface ShareMapBarProps {
  mapName?: string;
  layers: MapLayer[];
  basemap: string;
  markdown?: string;
  mapBounds?: [number, number, number, number];
  onSetBasemap: (b: string) => void;
  onUpdateLayer: (id: string, patch: Partial<MapLayer>) => void;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
}

export function ShareMapBar({
  mapName, layers, basemap, markdown, mapBounds, onSetBasemap, onUpdateLayer, notesOpen, onToggleNotes,
}: ShareMapBarProps) {
  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [userBasemaps, setUserBasemaps] = React.useState<UserBasemap[]>([]);
  React.useEffect(() => {
    fetch("/api/basemaps").then(r => r.ok ? r.json() : []).then(setUserBasemaps).catch(() => {});
  }, []);

  function togglePanel(panel: ActivePanel) {
    setActivePanel(prev => prev === panel ? null : panel);
  }

  return (
    <div ref={barRef} className="absolute top-0 left-0 right-0 z-20">
      {/* Bar */}
      <div className="h-10 flex items-center px-3 gap-3 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        {/* Left: logo + name */}
        <Link href="/" title="pgMaps" className="shrink-0 hover:opacity-70 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Postgresql_elephant.png" alt="pgMaps" className="w-7 h-7 shrink-0" />
        </Link>
        {mapName && (
          <span className="text-base font-semibold truncate max-w-[200px] sm:max-w-sm">
            {mapName}
          </span>
        )}

        <div className="flex-1" />

        {/* Right: panel buttons */}
        {markdown && onToggleNotes && (
          <BarButton
            icon={<FileText className="h-4 w-4" />}
            label="Description"
            active={!!notesOpen}
            onClick={onToggleNotes}
            showLabel
          />
        )}
        <BarButton
          icon={<MapIcon className="h-4 w-4" />}
          label="Basemaps"
          active={activePanel === "basemaps"}
          onClick={() => togglePanel("basemaps")}
        />
        <BarButton
          icon={<TableIcon className="h-4 w-4" />}
          label="Table"
          active={activePanel === "table"}
          onClick={() => togglePanel("table")}
        />
      </div>

      {/* Active floating panel (basemaps) */}
      {activePanel === "basemaps" && (
        <div className="absolute top-full right-3 mt-1 w-[min(320px,calc(100vw-24px))] bg-background border rounded-lg shadow-xl overflow-hidden" style={{ maxHeight: "min(70dvh, 480px)", overflowY: "auto" }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b bg-muted/30 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Basemaps</span>
            <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <BasemapsPanel basemap={basemap} onSetBasemap={onSetBasemap} userBasemaps={userBasemaps} />
        </div>
      )}

      {/* Table panel — fixed bottom sheet */}
      {activePanel === "table" && (
        <TablePanel layers={layers} mapBounds={mapBounds} onClose={() => setActivePanel(null)} />
      )}
    </div>
  );
}
