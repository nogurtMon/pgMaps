export interface TableRow {
  table_schema: string;
  table_name: string;
  geom_col: string | null;
  geom_type: string | null;
  srid: number | null;
  row_count?: number | null;
  has_pk?: boolean | null;
  has_spatial_index?: boolean | null;
  is_clustered?: boolean | null;
}

export type AttrOperator =
  | "ilike" | "eq" | "neq" | "gt" | "lt" | "gte" | "lte"
  | "is_null" | "is_not_null" | "starts_with" | "in" | "not_in" | "date_between";

// Used for radiusScale and lineWidthScale which remain in LayerStyle
export interface ValueScale {
  column: string;
  minValue: number;
  maxValue: number;
  minOutput: number;
  maxOutput: number;
}

export interface RadiusScale {
  column: string;
  minValue: number;
  maxValue: number;
  minRadius: number;
  maxRadius: number;
}

export interface FillColorRule {
  value: string;
  color: string;
}

export type TemporalMode = "all" | "range" | "snapshot";

// ─── unified layer controls ────────────────────────────────────────────────────
// Each control bundles style + filter semantics in one item.
// enabled: whether the control's effect is applied to the map
// shared: whether viewers can interact with this control
export type LayerControl =
  | {
      id: string; type: "fill"; enabled: boolean; shared: boolean;
      color: string; opacity: number;
    }
  | {
      id: string; type: "stroke"; enabled: boolean; shared: boolean;
      color: string; opacity: number; width: number;
    }
  | {
      id: string; type: "categorical"; enabled: boolean; shared: boolean;
      column: string; rules: FillColorRule[]; defaultColor: string;
      hiddenValues: string[];
      target: "fill" | "stroke";
      label?: string;
    }
  | {
      id: string; type: "numeric"; enabled: boolean; shared: boolean;
      column: string; min: number; max: number; dataMin: number; dataMax: number;
      minOutput: number; maxOutput: number;
      target: "opacity" | "strokeOpacity" | "radius" | "line-width" | "filter";
      label?: string;
    }
  | {
      id: string; type: "temporal"; enabled: boolean; shared: boolean;
      column: string; mode: TemporalMode; from: string; to: string;
      dataMin: string; dataMax: string;
      label?: string;
    }
  | {
      id: string; type: "attribute"; enabled: boolean; shared: boolean;
      column: string; operator: AttrOperator; value: string; label?: string;
    }
  | {
      id: string; type: "threshold"; enabled: boolean; shared: boolean;
      column: string; threshold: number;
      aboveColor: string; belowColor: string;
      target: "fill" | "stroke";
      label?: string;
    };

// Backward-compat aliases
export type LayerFilter = LayerControl;
export type AttrFilter = Extract<LayerControl, { type: "attribute" }>;

export interface LayerStyle {
  color: string;         // fill for points/polygons, line color for linestrings
  strokeColor: string;   // outline for points/polygons
  opacity: number;       // fill opacity for points/polygons; overall opacity for lines
  strokeOpacity: number; // outline opacity
  radius: number;        // px, for point layers
  lineWidth: number;     // px, stroke width
  radiusScale: RadiusScale | null;
  lineWidthScale: ValueScale | null;
}

export interface MapLayer {
  id: string;
  table: TableRow;
  connectionId: string;  // server-side connection ID
  shareId?: string;      // set on read-only share pages; used in place of connectionId for tile/API requests
  visible: boolean;
  style: LayerStyle;
  controls: LayerControl[];
  dataVersion?: number;
  geomTypeOverride?: string | null;
}

export const BASEMAP_OPTIONS: { key: string; label: string }[] = [
  { key: "liberty",   label: "Street"    },
  { key: "satellite", label: "Satellite" },
];

export const LAYER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

export const DEFAULT_STYLE: LayerStyle = {
  color: "#3b82f6",
  strokeColor: "#ffffff",
  opacity: 0.85,
  strokeOpacity: 1.0,
  radius: 6,
  lineWidth: 1,
  radiusScale: null,
  lineWidthScale: null,
};

// ─── migration ─────────────────────────────────────────────────────────────────
// Converts any saved layer shape (old filters-based or new controls-based) into
// the current LayerControl[]. Pass the raw saved layer object.
export function migrateLayerControls(raw: any): LayerControl[] {
  if (!raw) return [];
  const controls: LayerControl[] = [];

  for (const f of (raw.controls ?? raw.filters ?? [])) {
    const base = { id: f.id ?? crypto.randomUUID(), enabled: f.enabled ?? true, shared: f.shared ?? false };
    if (f.type === "fill") {
      controls.push({ ...base, type: "fill", color: f.color ?? "#3b82f6", opacity: f.opacity ?? 0.85 });
    } else if (f.type === "stroke") {
      controls.push({ ...base, type: "stroke", color: f.color ?? "#ffffff", opacity: f.opacity ?? 1, width: f.width ?? 1 });
    } else if (!f.type || f.type === "attribute") {
      controls.push({ ...base, type: "attribute", column: f.column ?? "", operator: f.operator ?? "ilike", value: f.value ?? "", label: f.label });
    } else if (f.type === "temporal") {
      controls.push({ ...base, type: "temporal", column: f.column ?? "", mode: f.mode ?? "all", from: f.from ?? "", to: f.to ?? "", dataMin: f.dataMin ?? "", dataMax: f.dataMax ?? "" });
    } else if (f.type === "categorical") {
      const cfStyle = f.target === "stroke" ? raw.style?.categoricalStroke : raw.style?.categoricalFill;
      controls.push({ ...base, type: "categorical", column: f.column ?? "", rules: f.rules ?? (cfStyle?.column === f.column ? cfStyle.rules : []), defaultColor: f.defaultColor ?? cfStyle?.defaultColor ?? "#aaaaaa", hiddenValues: f.hiddenValues ?? [], target: f.target ?? "fill" });
    } else if (f.type === "numeric") {
      controls.push({ ...base, type: "numeric", column: f.column ?? "", min: f.min ?? 0, max: f.max ?? 0, dataMin: f.dataMin ?? 0, dataMax: f.dataMax ?? 0, minOutput: f.minOutput ?? 0.2, maxOutput: f.maxOutput ?? 1, target: f.target ?? "opacity" });
    } else if (f.type === "threshold") {
      controls.push({ ...base, type: "threshold", column: f.column ?? "", threshold: f.threshold ?? 0, aboveColor: f.aboveColor ?? "#22c55e", belowColor: f.belowColor ?? "#ef4444", target: f.target ?? "fill", label: f.label });
    }
  }

  // Promote old style.categoricalFill/Stroke if not already represented
  if (raw.style?.categoricalFill && !controls.find(c => c.type === "categorical" && c.target === "fill")) {
    const cf = raw.style.categoricalFill;
    controls.push({ id: crypto.randomUUID(), type: "categorical", enabled: true, shared: false, column: cf.column ?? "", rules: cf.rules ?? [], defaultColor: cf.defaultColor ?? "#aaaaaa", hiddenValues: [], target: "fill" });
  }
  if (raw.style?.categoricalStroke && !controls.find(c => c.type === "categorical" && c.target === "stroke")) {
    const cs = raw.style.categoricalStroke;
    controls.push({ id: crypto.randomUUID(), type: "categorical", enabled: true, shared: false, column: cs.column ?? "", rules: cs.rules ?? [], defaultColor: cs.defaultColor ?? "#aaaaaa", hiddenValues: [], target: "stroke" });
  }
  if (raw.style?.opacityScale && !controls.find(c => c.type === "numeric" && c.target === "opacity")) {
    const os = raw.style.opacityScale;
    controls.push({ id: crypto.randomUUID(), type: "numeric", enabled: true, shared: false, column: os.column, min: os.minValue, max: os.maxValue, dataMin: os.minValue, dataMax: os.maxValue, minOutput: os.minOutput, maxOutput: os.maxOutput, target: "opacity" });
  }
  if (raw.style?.strokeOpacityScale && !controls.find(c => c.type === "numeric" && c.target === "strokeOpacity")) {
    const sos = raw.style.strokeOpacityScale;
    controls.push({ id: crypto.randomUUID(), type: "numeric", enabled: true, shared: false, column: sos.column, min: sos.minValue, max: sos.maxValue, dataMin: sos.minValue, dataMax: sos.maxValue, minOutput: sos.minOutput, maxOutput: sos.maxOutput, target: "strokeOpacity" });
  }

  return controls;
}

// Backward-compat: old call sites passed just the filters array
export function migrateLayerFilters(filtersOrRaw: any): LayerControl[] {
  if (Array.isArray(filtersOrRaw)) {
    return migrateLayerControls({ controls: filtersOrRaw });
  }
  return migrateLayerControls(filtersOrRaw);
}
