"use client";
import React from "react";
import type { MapLayer, LayerControl } from "@/lib/types";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { findIcon, iconDataUri } from "@/lib/point-icons";

// ─── helpers ──────────────────────────────────────────────────────────────────
function geomKind(layer: MapLayer): "point" | "line" | "polygon" {
  const raw = (layer.geomTypeOverride || layer.table.geom_type || "").toLowerCase();
  if (raw.includes("linestring") || raw.includes("line")) return "line";
  if (raw.includes("polygon")) return "polygon";
  return "point";
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function colLabel(col: string) {
  return col.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── swatch components ────────────────────────────────────────────────────────
function GeomSwatch({ kind, color, strokeColor, pointShape }: {
  kind: "point" | "line" | "polygon";
  color: string;
  strokeColor: string;
  pointShape?: string;
}) {
  if (kind === "line") return (
    <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0">
      <line x1="2" y1="5" x2="16" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  if (kind === "polygon") return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <rect x="1" y="1" width="12" height="12" rx="1.5" fill={color} stroke={strokeColor} strokeWidth="1.5" />
    </svg>
  );
  if (pointShape && pointShape !== "circle") {
    return <img src={iconDataUri(findIcon(pointShape), color)} width={14} height={14} className="shrink-0" alt={pointShape} />;
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="5" fill={color} stroke={strokeColor} strokeWidth="1.5" />
    </svg>
  );
}

// ─── get active controls (geometry-aware) ─────────────────────────────────────
function activeCategorical(layer: MapLayer, kind: "point" | "line" | "polygon") {
  const target = kind === "line" ? "stroke" : "fill";
  return (layer.controls ?? []).find(
    c => c.type === "categorical" && c.enabled && (c as Extract<LayerControl, { type: "categorical" }>).target === target
  ) as Extract<LayerControl, { type: "categorical" }> | undefined;
}

function activeThreshold(layer: MapLayer, kind: "point" | "line" | "polygon") {
  const target = kind === "line" ? "stroke" : "fill";
  return (layer.controls ?? []).find(
    c => c.type === "threshold" && c.enabled && (c as Extract<LayerControl, { type: "threshold" }>).target === target
  ) as Extract<LayerControl, { type: "threshold" }> | undefined;
}

// ─── categorical color swatches ───────────────────────────────────────────────
function CategoricalLegend({ ctrl }: { ctrl: Extract<LayerControl, { type: "categorical" }> }) {
  const shown = ctrl.rules.slice(0, 8);
  const rest = ctrl.rules.length - 8;
  return (
    <div className="space-y-0.5 mt-0.5">
      {shown.map((rule, i) => {
        const isHidden = rule.values.length > 0 && rule.values.every(v => ctrl.hiddenValues.includes(v));
        const label = rule.values.length === 0
          ? "(no values)"
          : rule.values.slice(0, 2).join(", ") + (rule.values.length > 2 ? ` +${rule.values.length - 2}` : "");
        return (
          <div key={i} className={`flex items-center gap-1.5 ${isHidden ? "opacity-30" : ""}`}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: rule.color }} />
            <span className="text-[10px] text-foreground/80 truncate">{label}</span>
          </div>
        );
      })}
      {rest > 0 && (
        <span className="text-[9px] text-muted-foreground pl-4">+{rest} more</span>
      )}
      {ctrl.rules.length === 0 && (
        <span className="text-[10px] text-muted-foreground italic">No categories</span>
      )}
    </div>
  );
}

// ─── threshold color legend ───────────────────────────────────────────────────
function ThresholdLegend({ ctrl }: { ctrl: Extract<LayerControl, { type: "threshold" }> }) {
  if (ctrl.ranges && ctrl.ranges.length > 0) {
    return (
      <div className="space-y-0.5 mt-0.5">
        {ctrl.ranges.map((r, i) => {
          const lo = r.from != null ? fmt(r.from) : "−∞";
          const hi = r.to != null ? fmt(r.to) : "+∞";
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: r.color }} />
              <span className="text-[10px] text-foreground/80">{lo} – {hi}</span>
            </div>
          );
        })}
        {ctrl.defaultColor && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: ctrl.defaultColor }} />
            <span className="text-[10px] text-muted-foreground">other</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-0.5 mt-0.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: ctrl.aboveColor }} />
        <span className="text-[10px] text-foreground/80">≥ {fmt(ctrl.threshold)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: ctrl.belowColor }} />
        <span className="text-[10px] text-muted-foreground">below</span>
      </div>
    </div>
  );
}

// ─── shape categorical legend ─────────────────────────────────────────────────
function ShapeCategoricalLegend({ ctrl, fillColor }: {
  ctrl: Extract<LayerControl, { type: "shape-categorical" }>;
  fillColor: string;
}) {
  const shown = ctrl.rules.slice(0, 8);
  const rest = ctrl.rules.length - 8;
  return (
    <div className="space-y-0.5 mt-0.5">
      {shown.map((rule, i) => {
        const label = rule.values.length === 0
          ? "(no values)"
          : rule.values.slice(0, 2).join(", ") + (rule.values.length > 2 ? ` +${rule.values.length - 2}` : "");
        return (
          <div key={i} className="flex items-center gap-1.5">
            <img src={iconDataUri(findIcon(rule.shape), fillColor)} width={10} height={10} className="shrink-0" alt={rule.shape} />
            <span className="text-[10px] text-foreground/80 truncate">{label}</span>
          </div>
        );
      })}
      {rest > 0 && <span className="text-[9px] text-muted-foreground pl-4">+{rest} more</span>}
      {ctrl.rules.length > 0 && (
        <div className="flex items-center gap-1.5">
          <img src={iconDataUri(findIcon(ctrl.defaultShape), fillColor)} width={10} height={10} className="shrink-0" alt={ctrl.defaultShape} />
          <span className="text-[10px] text-muted-foreground italic">other</span>
        </div>
      )}
    </div>
  );
}

// ─── radius scale legend (nested concentric circles) ─────────────────────────
function RadiusScaleLegend({ layer }: { layer: MapLayer }) {
  const ctrl = (layer.controls ?? []).find(
    c => c.type === "numeric" && c.enabled && (c as Extract<LayerControl, { type: "numeric" }>).target === "radius"
  ) as Extract<LayerControl, { type: "numeric" }> | undefined;
  if (!ctrl) return null;

  const { column, dataMin, dataMax, minOutput, maxOutput } = ctrl;
  const midV = (dataMin + dataMax) / 2;
  const midR = (minOutput + maxOutput) / 2;

  const pad = 2;
  const labelGap = 6;
  const labelW = 54;
  const R = maxOutput;
  const cx = R + pad;
  const cy = R + pad;
  const svgW = cx + R + labelGap + labelW;
  const svgH = (R + pad) * 2;

  const steps = [
    { r: maxOutput, v: dataMax },
    { r: midR,      v: midV   },
    { r: minOutput, v: dataMin },
  ];

  return (
    <div className="mt-1.5">
      <p className="text-[10px] text-muted-foreground mb-1 capitalize">{colLabel(column)}</p>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
        {steps.map(({ r, v }, i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="0.75" className="text-foreground/40" />
            <line
              x1={cx + r} y1={cy - r}
              x2={cx + R + labelGap} y2={cy - r}
              stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-muted-foreground/50"
            />
            <text
              x={cx + R + labelGap + 2} y={cy - r + 3.5}
              fontSize="8" fill="currentColor" className="text-muted-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmt(v)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── line width scale legend ──────────────────────────────────────────────────
function LineWidthScaleLegend({ layer }: { layer: MapLayer }) {
  const ctrl = (layer.controls ?? []).find(
    c => c.type === "numeric" && c.enabled && (c as Extract<LayerControl, { type: "numeric" }>).target === "line-width"
  ) as Extract<LayerControl, { type: "numeric" }> | undefined;
  if (!ctrl) return null;

  const { column, dataMin, dataMax, minOutput, maxOutput } = ctrl;
  const midV = (dataMin + dataMax) / 2;
  const midW = (minOutput + maxOutput) / 2;
  const dynamicColor = (layer.controls ?? []).some(
    c => c.enabled && (c.type === "categorical" || c.type === "threshold") &&
      (c as Extract<LayerControl, { type: "categorical" }>).target === "stroke"
  );
  const strokeCtrl = (layer.controls ?? []).find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;
  const color = dynamicColor ? null : (strokeCtrl?.color ?? layer.style?.strokeColor ?? layer.style?.color ?? "#3b82f6");

  return (
    <div className="mt-1.5">
      <p className="text-[10px] text-muted-foreground mb-1 capitalize">{colLabel(column)}</p>
      <div className="space-y-1">
        {[
          { w: minOutput, v: dataMin },
          { w: midW, v: midV },
          { w: maxOutput, v: dataMax },
        ].map(({ w, v }, i) => {
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

// ─── single layer entry ───────────────────────────────────────────────────────
function LayerEntry({ layer, onToggleVisible }: {
  layer: MapLayer;
  onToggleVisible?: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const kind = geomKind(layer);
  const cat = activeCategorical(layer, kind);
  const thresh = activeThreshold(layer, kind);
  const shapeCat = (layer.controls ?? []).find(c => c.type === "shape-categorical" && c.enabled) as Extract<LayerControl, { type: "shape-categorical" }> | undefined;
  const hasRadiusCtrl = (layer.controls ?? []).some(c => c.type === "numeric" && c.enabled && (c as Extract<LayerControl, { type: "numeric" }>).target === "radius");
  const hasLineWidthCtrl = (layer.controls ?? []).some(c => c.type === "numeric" && c.enabled && (c as Extract<LayerControl, { type: "numeric" }>).target === "line-width");
  const hasDetail = !!(cat || thresh || shapeCat || hasRadiusCtrl || hasLineWidthCtrl);

  const fillCtrl = (layer.controls ?? []).find(c => c.type === "fill") as Extract<LayerControl, { type: "fill" }> | undefined;
  const strokeCtrl = (layer.controls ?? []).find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;

  // For lines the rendered color comes from the stroke control (mirrors maplibre-map.tsx logic).
  // style.color / style.strokeColor can be stale when the control color is edited directly.
  const fillColor = fillCtrl?.color ?? layer.style?.color ?? "#3b82f6";
  const strokeColor = layer.style?.strokeColor ?? "#ffffff";
  const swatchColor = kind === "line"
    ? (strokeCtrl?.color ?? layer.style?.strokeColor ?? layer.style?.color ?? "#3b82f6")
    : fillColor;

  const catLabel = cat ? (cat.label || `Color · ${colLabel(cat.column)}`) : null;
  const thrLabel = thresh ? (thresh.label || colLabel(thresh.column)) : null;
  const shapeCatLabel = shapeCat ? `Shape · ${colLabel(shapeCat.column)}` : null;

  return (
    <div className={`transition-opacity ${!layer.visible ? "opacity-40" : ""}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-1.5 py-1 ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        {!cat && !shapeCat && (
          <GeomSwatch kind={kind} color={swatchColor} strokeColor={strokeColor} pointShape={layer.style?.pointShape} />
        )}
        <span className="text-[11px] font-medium truncate flex-1">{colLabel(layer.table.table_name)}</span>
        {onToggleVisible && (
          <button
            onClick={e => { e.stopPropagation(); onToggleVisible(layer.id); }}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title={layer.visible ? "Hide layer" : "Show layer"}
          >
            {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        )}
        {hasDetail && (
          <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {/* Detail rows */}
      {hasDetail && open && (
        <div className="pl-1 mb-1 space-y-1.5">
          {cat && (
            <div>
              {catLabel && <p className="text-[10px] text-muted-foreground mb-0.5">{catLabel}</p>}
              <CategoricalLegend ctrl={cat} />
            </div>
          )}
          {thresh && (
            <div>
              {thrLabel && <p className="text-[10px] text-muted-foreground mb-0.5">{thrLabel}</p>}
              <ThresholdLegend ctrl={thresh} />
            </div>
          )}
          {shapeCat && (
            <div>
              {shapeCatLabel && <p className="text-[10px] text-muted-foreground mb-0.5">{shapeCatLabel}</p>}
              <ShapeCategoricalLegend ctrl={shapeCat} fillColor={fillColor} />
            </div>
          )}
          {kind === "point" && <RadiusScaleLegend layer={layer} />}
          {kind === "line" && <LineWidthScaleLegend layer={layer} />}
        </div>
      )}
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
interface MapLegendProps {
  layers: MapLayer[];
  onToggleVisible?: (id: string) => void;
}

export function MapLegend({ layers, onToggleVisible }: MapLegendProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const visLayers = [...layers].reverse().filter(l => l.table.geom_col);
  if (visLayers.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-3 z-10 w-64 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Legend</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
      </button>

      {/* Layer list */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${collapsed ? "max-h-0" : "max-h-[60dvh]"}`}>
        <div className="overflow-y-auto px-3 pb-2.5 divide-y max-h-[60dvh]">
          {visLayers.map(layer => (
            <div key={layer.id} className="pt-1.5 first:pt-0.5">
              <LayerEntry layer={layer} onToggleVisible={onToggleVisible} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
