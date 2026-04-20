"use client";
import React from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import type { MapLayer } from "@/lib/types";

// ─── geometry helpers ─────────────────────────────────────────────────────────
function geomKind(layer: MapLayer): "point" | "line" | "polygon" {
  const raw = (layer.geomTypeOverride || layer.table.geom_type || "").toLowerCase();
  if (raw.includes("linestring") || raw.includes("line")) return "line";
  if (raw.includes("polygon")) return "polygon";
  return "point";
}

// ─── tiny SVG swatches ────────────────────────────────────────────────────────
function PointSwatch({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function LineSwatch({ color }: { color: string }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0">
      <line x1="1" y1="5" x2="17" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PolygonSwatch({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <rect x="1" y="1" width="12" height="12" rx="1.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function Swatch({ layer, fill, stroke }: { layer: MapLayer; fill: string; stroke: string }) {
  const kind = geomKind(layer);
  if (kind === "line") return <LineSwatch color={stroke} />;
  if (kind === "polygon") return <PolygonSwatch fill={fill} stroke={stroke} />;
  return <PointSwatch fill={fill} stroke={stroke} />;
}

// ─── per-layer legend entry ───────────────────────────────────────────────────
export function LayerEntry({ layer, onToggleVisible }: {
  layer: MapLayer;
  onToggleVisible?: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const { style } = layer;
  const name = layer.table.table_name;
  const kind = geomKind(layer);
  const dim = !layer.visible;

  function VisibilityBtn() {
    if (!onToggleVisible) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-auto pl-1"
        title={layer.visible ? "Hide layer" : "Show layer"}
      >
        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
    );
  }

  // Threshold fill
  const threshFill = (layer.controls ?? []).find(c => c.type === "threshold" && c.enabled && c.target === "fill") as Extract<typeof layer.controls[number], { type: "threshold" }> | undefined;
  if (threshFill) {
    const tf = threshFill;
    return (
      <div className={dim ? "opacity-40" : undefined}>
        <div className="flex items-center gap-1 w-full">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 flex-1 min-w-0">
            <Swatch layer={layer} fill={tf.aboveColor} stroke={style.strokeColor} />
            <span className="font-medium truncate text-[11px] flex-1 text-left" title={name}>{name}</span>
            {open ? <ChevronUp className="h-2.5 w-2.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
          </button>
          <VisibilityBtn />
        </div>
        {open && (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5 pl-1">
              <Swatch layer={layer} fill={tf.aboveColor} stroke={style.strokeColor} />
              <span className="truncate text-[10px]">≥ {tf.threshold}</span>
            </div>
            <div className="flex items-center gap-1.5 pl-1">
              <Swatch layer={layer} fill={tf.belowColor} stroke={style.strokeColor} />
              <span className="truncate text-[10px]">{"< "}{tf.threshold}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Categorical fill — read from controls
  const catFill = (layer.controls ?? []).find(c => c.type === "categorical" && c.enabled && c.target === "fill") as Extract<typeof layer.controls[number], { type: "categorical" }> | undefined;
  const catStroke = (layer.controls ?? []).find(c => c.type === "categorical" && c.enabled && c.target === "stroke") as Extract<typeof layer.controls[number], { type: "categorical" }> | undefined;
  const numOpacity = (layer.controls ?? []).find(c => c.type === "numeric" && c.enabled && c.target === "opacity") as Extract<typeof layer.controls[number], { type: "numeric" }> | undefined;

  if (catFill) {
    const cf = catFill;
    return (
      <div className={dim ? "opacity-40" : undefined}>
        <div className="flex items-center gap-1 w-full">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 flex-1 min-w-0">
            <Swatch layer={layer} fill={cf.rules[0]?.color ?? cf.defaultColor} stroke={style.strokeColor} />
            <span className="font-medium truncate text-[11px] flex-1 text-left" title={name}>{name}</span>
            {open ? <ChevronUp className="h-2.5 w-2.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
          </button>
          <VisibilityBtn />
        </div>
        {open && (
          <div className="mt-1 space-y-0.5">
            {cf.rules.map((rule) => (
              <div key={rule.value} className="flex items-center gap-1.5 pl-1">
                <Swatch layer={layer} fill={rule.color} stroke={style.strokeColor} />
                <span className="truncate text-[10px]" title={rule.value}>{rule.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pl-1">
              <Swatch layer={layer} fill={cf.defaultColor} stroke={style.strokeColor} />
              <span className="truncate text-[10px] text-muted-foreground">Other</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (catStroke && kind === "line") {
    const cs = catStroke;
    return (
      <div className={dim ? "opacity-40" : undefined}>
        <div className="flex items-center gap-1 w-full">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 flex-1 min-w-0">
            <LineSwatch color={cs.rules[0]?.color ?? cs.defaultColor} />
            <span className="font-medium truncate text-[11px] flex-1 text-left" title={name}>{name}</span>
            {open ? <ChevronUp className="h-2.5 w-2.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
          </button>
          <VisibilityBtn />
        </div>
        {open && (
          <div className="mt-1 space-y-0.5">
            {cs.rules.map((rule) => (
              <div key={rule.value} className="flex items-center gap-1.5 pl-1">
                <LineSwatch color={rule.color} />
                <span className="truncate text-[10px]" title={rule.value}>{rule.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pl-1">
              <LineSwatch color={cs.defaultColor} />
              <span className="truncate text-[10px] text-muted-foreground">Other</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Simple / scale-annotated entry
  const scaleNote =
    style.radiusScale ? `Size by ${style.radiusScale.column}` :
    numOpacity ? `Opacity by ${numOpacity.column}` :
    style.lineWidthScale ? `Width by ${style.lineWidthScale.column}` :
    null;

  return (
    <div className={`flex items-center gap-1.5 ${dim ? "opacity-40" : ""}`}>
      <Swatch layer={layer} fill={style.color} stroke={style.strokeColor} />
      <div className="min-w-0 flex-1">
        <span className="font-medium truncate text-[11px] block" title={name}>{name}</span>
        {scaleNote && <span className="text-[9px] text-muted-foreground truncate block" title={scaleNote}>{scaleNote}</span>}
      </div>
      <VisibilityBtn />
    </div>
  );
}

// ─── legend panel ─────────────────────────────────────────────────────────────
export function MapLegend({ layers, onToggleVisible }: {
  layers: MapLayer[];
  onToggleVisible?: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const entries = [...layers].reverse().filter((l) => l.table.geom_col);
  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-10 left-2 z-10 bg-background/90 backdrop-blur-sm rounded-md border shadow-sm text-foreground max-w-52">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Legend</span>
        {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {!collapsed && (
        <div className="px-2.5 pb-2.5 space-y-2.5 max-h-72 overflow-y-auto">
          {entries.map((layer) => (
            <LayerEntry
              key={layer.id}
              layer={layer}
              onToggleVisible={onToggleVisible ? () => onToggleVisible(layer.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
