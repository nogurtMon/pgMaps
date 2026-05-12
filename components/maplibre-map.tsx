"use client";
import React from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MVTLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer } from "@deck.gl/layers";
import { GeocoderControl } from "@/components/geocoder-control";
import type { MapLayer, LayerControl, UndoableOp } from "@/lib/types";
import { Plus, Minus, Navigation, Home, Copy, Check, X, ChevronLeft, ChevronRight, Pencil, Settings2, PenLine, GripHorizontal, SquarePen, Trash2, Sheet } from "lucide-react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// ─── helpers ─────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linearly interpolate v from [min,max] → [outMin,outMax], clamped. */
function lerp(v: number, min: number, max: number, outMin: number, outMax: number): number {
  const t = min === max ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}

function resolveThreshColor(
  ctrl: Extract<LayerControl, { type: "threshold" }>,
  value: number,
  alpha: number,
): [number, number, number, number] {
  if (ctrl.ranges && ctrl.ranges.length > 0) {
    for (const r of ctrl.ranges) {
      const lo = r.from ?? -Infinity;
      const hi = r.to ?? Infinity;
      if (value >= lo && value < hi) return [...hexToRgb(r.color), alpha] as [number, number, number, number];
    }
    return [...hexToRgb(ctrl.defaultColor ?? "#aaaaaa"), alpha] as [number, number, number, number];
  }
  return [...hexToRgb(value >= ctrl.threshold ? ctrl.aboveColor : ctrl.belowColor), alpha] as [number, number, number, number];
}

// ─── tile URL ─────────────────────────────────────────────────────────────────
function buildTileUrl(layer: MapLayer): string {
  const params = new URLSearchParams({
    ...(layer.shareId ? { shareId: layer.shareId } : { connectionId: layer.connectionId }),
    schema: layer.table.table_schema,
    table: layer.table.table_name,
    geomCol: layer.table.geom_col ?? "geom",
    srid: String(layer.table.srid ?? 4326),
  });

  const clauses: { column: string; operator: string; value: string }[] = [];

  for (const c of (layer.controls ?? [])) {
    if (!c.enabled) continue;
    if (c.type === "attribute") {
      if (!c.column || !c.operator) continue;
      if (c.operator !== "is_null" && c.operator !== "is_not_null" && !(c.value ?? "").trim()) continue;
      clauses.push({ column: c.column, operator: c.operator, value: c.value });
    } else if (c.type === "temporal" && c.mode !== "all" && c.from && c.to) {
      const val = c.mode === "snapshot" ? `${c.from},${c.from}` : `${c.from},${c.to}`;
      clauses.push({ column: c.column, operator: "date_between", value: val });
    } else if (c.type === "categorical" && c.hiddenValues.length > 0) {
      clauses.push({ column: c.column, operator: "not_in", value: c.hiddenValues.join(",") });
    } else if (c.type === "numeric" && c.target === "filter") {
      clauses.push({ column: c.column, operator: "gte", value: String(c.min) });
      clauses.push({ column: c.column, operator: "lte", value: String(c.max) });
    }
  }

  if (clauses.length > 0) params.set("filters", JSON.stringify(clauses));
  if (layer.dataVersion !== undefined) params.set("v", String(layer.dataVersion));

  // Columns needed for styling at every zoom level (categorical/threshold/numeric scale)
  const styleCols = new Set<string>();
  for (const c of (layer.controls ?? [])) {
    if (!c.enabled) continue;
    if ((c.type === "categorical" || c.type === "threshold") && c.column) styleCols.add(c.column);
    if (c.type === "numeric" && c.target !== "filter" && c.column) styleCols.add(c.column);
  }
  if (styleCols.size > 0) params.set("sc", [...styleCols].join(","));

  return `/api/pg/tiles/{z}/{x}/{y}?${params.toString()}`;
}

// ─── draw styles (MapLibre-v5 compatible — no dasharray expressions) ──────────
const DRAW_STYLES = [
  // Polygon fill
  { id: "gl-draw-polygon-fill-inactive", type: "fill", filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "mode", "static"]], paint: { "fill-color": "#3b82f6", "fill-opacity": 0.1 } },
  { id: "gl-draw-polygon-fill-active",   type: "fill", filter: ["all", ["==", "active", "true"],  ["==", "$type", "Polygon"]], paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 } },
  { id: "gl-draw-polygon-fill-static",   type: "fill", filter: ["all", ["==", "mode", "static"],  ["==", "$type", "Polygon"]], paint: { "fill-color": "#667788", "fill-opacity": 0.1 } },
  // Polygon stroke
  { id: "gl-draw-polygon-stroke-inactive", type: "line", filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "mode", "static"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3b82f6", "line-width": 2 } },
  { id: "gl-draw-polygon-stroke-active",   type: "line", filter: ["all", ["==", "active", "true"],  ["==", "$type", "Polygon"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3b82f6", "line-width": 2.5 } },
  { id: "gl-draw-polygon-stroke-static",   type: "line", filter: ["all", ["==", "mode", "static"],  ["==", "$type", "Polygon"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#667788", "line-width": 2 } },
  // Line
  { id: "gl-draw-line-inactive", type: "line", filter: ["all", ["==", "active", "false"], ["==", "$type", "LineString"], ["!=", "mode", "static"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3b82f6", "line-width": 2 } },
  { id: "gl-draw-line-active",   type: "line", filter: ["all", ["==", "active", "true"],  ["==", "$type", "LineString"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#3b82f6", "line-width": 2.5 } },
  { id: "gl-draw-line-static",   type: "line", filter: ["all", ["==", "mode", "static"],  ["==", "$type", "LineString"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#667788", "line-width": 2 } },
  // Vertex midpoints
  { id: "gl-draw-polygon-midpoint", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]], paint: { "circle-radius": 3, "circle-color": "#3b82f6" } },
  // Vertices
  { id: "gl-draw-polygon-and-line-vertex-inactive", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#3b82f6", "circle-stroke-width": 2 } },
  { id: "gl-draw-polygon-and-line-vertex-stroke-inactive", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]], paint: { "circle-radius": 7, "circle-color": "transparent", "circle-stroke-color": "#3b82f6", "circle-stroke-width": 1.5 } },
  // Point features
  { id: "gl-draw-point-point-stroke-inactive", type: "circle", filter: ["all", ["==", "active", "false"], ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"]], paint: { "circle-radius": 8, "circle-opacity": 1, "circle-color": "#fff", "circle-stroke-color": "#3b82f6", "circle-stroke-width": 2 } },
  { id: "gl-draw-point-inactive",              type: "circle", filter: ["all", ["==", "active", "false"], ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"]], paint: { "circle-radius": 5, "circle-color": "#3b82f6" } },
  { id: "gl-draw-point-stroke-active",         type: "circle", filter: ["all", ["==", "active", "true"],  ["==", "$type", "Point"], ["==", "meta", "feature"]], paint: { "circle-radius": 9, "circle-color": "#fff", "circle-stroke-color": "#3b82f6", "circle-stroke-width": 3 } },
  { id: "gl-draw-point-active",                type: "circle", filter: ["all", ["==", "active", "true"],  ["==", "$type", "Point"], ["==", "meta", "feature"]], paint: { "circle-radius": 6, "circle-color": "#3b82f6" } },
  { id: "gl-draw-point-static",                type: "circle", filter: ["all", ["==", "mode", "static"],  ["==", "$type", "Point"]], paint: { "circle-radius": 5, "circle-color": "#667788" } },
];

// ─── geometry anchor point for popup placement ───────────────────────────────
function geomAnchor(geom: any): [number, number] | null {
  if (!geom) return null;
  const c = geom.coordinates;
  if (geom.type === "Point") return c as [number, number];
  if (geom.type === "MultiPoint") return c[0] as [number, number];
  if (geom.type === "LineString") return c[Math.floor(c.length / 2)] as [number, number];
  if (geom.type === "MultiLineString") return c[0][Math.floor(c[0].length / 2)] as [number, number];
  if (geom.type === "Polygon") {
    const ring: [number, number][] = c[0];
    const n = ring.length;
    return ring.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n] as [number, number], [0, 0] as [number, number]);
  }
  if (geom.type === "MultiPolygon") return c[0][0][0] as [number, number];
  return null;
}

// ─── basemap definitions ──────────────────────────────────────────────────────
const MT_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
function mt(styleId: string) {
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MT_KEY}`;
}

const BASEMAPS: Record<string, string> = {
  streets:   mt("streets-v2"),
  satellite: mt("satellite"),
  hybrid:    mt("hybrid"),
  topo:      mt("topo-v2"),
  dataviz:   mt("dataviz"),
};

const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [],
  glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MT_KEY}`,
};

// ─── datetime sort helper ─────────────────────────────────────────────────────
const DATE_KEY_RE = /date|time|week|month|year|dt|timestamp/i;

function sortByDatetime(items: SelectionItem[]): SelectionItem[] {
  if (items.length <= 1) return items;
  const props = items[0].feature.properties ?? {};
  // Find a key that looks like a date: prefer name-matched, then any parseable value
  const keys = Object.keys(props);
  const key =
    keys.find(k => DATE_KEY_RE.test(k) && !isNaN(new Date(props[k]).getTime())) ??
    keys.find(k => items.some(s => !isNaN(new Date(s.feature.properties?.[k]).getTime())));
  if (!key) return items;
  return [...items].sort((a, b) => {
    const da = new Date(a.feature.properties?.[key] ?? "").getTime();
    const db = new Date(b.feature.properties?.[key] ?? "").getTime();
    return (isNaN(da) ? 1 : 0) - (isNaN(db) ? 1 : 0) || da - db;
  });
}

// ─── types ────────────────────────────────────────────────────────────────────
interface SelectionItem { feature: any; layer: MapLayer; }
interface GeomEditState { item: SelectionItem; saving: boolean; error: string | null; loading?: boolean; pointPlaced?: boolean; extending?: "start" | "end"; }
interface AddFeatureState {
  layer: MapLayer;
  phase: "drawing" | "attrs" | "saving";
  columns: { name: string; dataType: string; hasDefault?: boolean; isSerial?: boolean }[];
  attrs: Record<string, string>;
  autoAttrs: Set<string>;
  geometry: any | null;
  error: string | null;
}
export interface MaplibreMapHandle {
  addEdit: (op: UndoableOp) => void;
  editGeometry: (layerId: string, ctid: string) => void;
  addFeature: (layerId: string) => void;
}
export type ZoomTarget =
  | { bounds: [[number, number], [number, number]] }
  | { center: [number, number]; zoom: number };
export interface MapView { longitude: number; latitude: number; zoom: number; bounds?: [number, number, number, number]; }

interface Props {
  layers: MapLayer[];
  onUpdateLayer?: (id: string, patch: Partial<MapLayer>) => void;
  shareControls?: boolean;
  editMode?: boolean;
  flyTo?: ZoomTarget | null;
  basemap?: string;
  initialView?: MapView;
  onViewChange?: (view: MapView) => void;
  hideGeocoder?: boolean;
  hideZoom?: boolean;
  hideLegend?: boolean;
  onManageTable?: (schema: string, table: string) => void;
  onSelectionChange?: (ctids: string[], layerId: string | null) => void;
  onShowInTable?: (layerId: string, ctid: string) => void;
  onAddEdit?: (op: UndoableOp) => void;
  tablePanelOpen?: boolean;
}

// ─── per-feature popup body: fetches full row via ctid on mount ───────────────
function FeatureRows({ item, editMode, onFieldSaved, onManageTable, onEditGeometry, onDeleteFeature, onFieldEdited }: {
  item: SelectionItem;
  editMode: boolean;
  onFieldSaved: () => void;
  onManageTable?: () => void;
  onEditGeometry?: () => void;
  onDeleteFeature?: () => void;
  onFieldEdited?: (field: string, oldValue: any, newValue: any, newCtid: string) => void;
}) {
  const [row, setRow] = React.useState<Record<string, any> | null>(null);
  const [columns, setColumns] = React.useState<{ name: string; dataType: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [savedField, setSavedField] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const propsCtid = item.feature.properties?._ctid as string | undefined;
  const [currentCtid, setCurrentCtid] = React.useState(propsCtid);
  const [deletePhase, setDeletePhase] = React.useState<"idle" | "confirm" | "deleting">("idle");
  const ctid = currentCtid;

  function fetchRow() {
    if (!propsCtid) return;
    setLoading(true);
    const { connectionId, shareId, table } = item.layer;
    fetch("/api/pg/feature-row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: propsCtid }),
    })
      .then(r => r.json())
      .then(d => { if (d.row) { setRow(d.row); setColumns(d.columns ?? []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  React.useEffect(() => {
    setCurrentCtid(propsCtid);
    setDeletePhase("idle");
    setRow(null);
    setEditingField(null);
    fetchRow();
  }, [propsCtid, item.layer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(key: string, value: any) {
    setEditingField(key);
    setEditValue(value == null ? "" : String(value));
    setFieldError(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setFieldError(null);
  }

  async function commitEdit(key: string) {
    if (!row || !currentCtid) return;
    const origStr = row[key] == null ? "" : String(row[key]);
    if (editValue === origStr) { setEditingField(null); return; }

    const origValue = row[key];
    setSavingField(key);
    setFieldError(null);
    const newVal = editValue === "" ? null : editValue;
    const { connectionId, shareId, table } = item.layer;
    try {
      const res = await fetch("/api/pg/feature-row", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: currentCtid, updates: { [key]: newVal } }),
      });
      const data = await res.json();
      if (data.error) {
        setFieldError(data.error);
      } else {
        setRow(prev => prev ? { ...prev, [key]: newVal } : prev);
        setEditingField(null);
        setSavedField(key);
        setTimeout(() => setSavedField(f => f === key ? null : f), 1500);
        if (data.ctid) setCurrentCtid(data.ctid);
        onFieldSaved();
        if (data.ctid) onFieldEdited?.(key, origValue, newVal, data.ctid);
      }
    } catch {
      setFieldError("Network error");
    } finally {
      setSavingField(null);
    }
  }

  function colInputType(key: string) {
    const dt = columns.find(c => c.name === key)?.dataType ?? "";
    if (/int|numeric|real|double|decimal|float/.test(dt)) return "number";
    if (dt === "date") return "date";
    if (dt.includes("timestamp")) return "datetime-local";
    return "text";
  }

  if (loading) return <p className="text-[11px] text-muted-foreground px-3 py-3">Loading…</p>;

  const display: [string, any][] = row
    ? Object.entries(row)
    : Object.entries(item.feature.properties || {}).filter(([k]) => k !== "_ctid");

  if (display.length === 0) return <p className="text-[11px] text-muted-foreground px-3 py-3">No attributes</p>;

  return (
    <div className="divide-y">
      {display.map(([key, value]) => {
        const isEditing = editingField === key;
        const isSaving = savingField === key;
        const isSaved = savedField === key;
        return (
          <div key={key} className="group flex items-start gap-2 px-3 py-1.5 hover:bg-muted/30">
            <span className="text-[11px] text-muted-foreground w-24 shrink-0 truncate pt-px" title={key}>
              {key.replace(/_/g, " ")}
            </span>
            {isEditing ? (
              <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type={colInputType(key)}
                    value={editValue}
                    placeholder="null"
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitEdit(key);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none py-px font-mono"
                  />
                  {isSaving ? (
                    <span className="text-[10px] text-muted-foreground shrink-0">…</span>
                  ) : (
                    <>
                      <button onClick={() => commitEdit(key)} title="Save (Enter)"
                        className="shrink-0 p-0.5 rounded text-green-600 hover:text-green-700 hover:bg-muted transition-colors">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={cancelEdit} title="Cancel (Esc)"
                        className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                {fieldError && (
                  <span className="text-[9px] text-destructive leading-tight">{fieldError}</span>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-1 flex-1 min-w-0">
                {value == null
                  ? <span className="text-sm text-muted-foreground/50 italic flex-1">null</span>
                  : <PropValue value={String(value)} />
                }
                <CopyButton value={value == null ? "" : String(value)} />
                {editMode && (
                  <button onClick={() => startEdit(key, value)} title="Edit"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    {isSaved ? <Check className="h-3 w-3 text-green-500" /> : <Pencil className="h-3 w-3" />}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editMode && onEditGeometry && item.layer.table.geom_col && ctid && (
        <button
          onClick={onEditGeometry}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t"
        >
          <PenLine className="h-3 w-3" />
          Edit geometry
        </button>
      )}
      {editMode && onDeleteFeature && ctid && (
        <div className="border-t">
          {deletePhase === "idle" && (
            <button
              onClick={() => setDeletePhase("confirm")}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-destructive/70 hover:text-destructive hover:bg-muted/30 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete feature
            </button>
          )}
          {deletePhase === "confirm" && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="text-[11px] text-destructive flex-1">Delete this feature?</span>
              <button
                onClick={() => setDeletePhase("idle")}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setDeletePhase("deleting"); onDeleteFeature(); }}
                className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
          {deletePhase === "deleting" && (
            <span className="block text-[11px] text-muted-foreground px-3 py-1.5">Deleting…</span>
          )}
        </div>
      )}
      {editMode && onManageTable && (
        <button
          onClick={onManageTable}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t"
        >
          <Settings2 className="h-3 w-3" />
          Add fields
        </button>
      )}
    </div>
  );
}

// ─── feature property value renderer ─────────────────────────────────────────
function PropValue({ value }: { value: string }) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer"
        className="text-sm break-all text-primary underline underline-offset-2 hover:opacity-80"
        title={value}>{value}</a>
    );
  }
  return <span className="text-sm truncate" title={value}>{value}</span>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }
  return (
    <button onClick={handleCopy} title="Copy value"
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── vertex tool helpers ──────────────────────────────────────────────────────
interface VertexDesc { lngLat: [number,number]; globalIdx: number; polygonIdx: number; ringIdx: number; vertexIdx: number; }
type VertexPos = VertexDesc & { x: number; y: number };
interface MidpointPos { x: number; y: number; lngLat: [number,number]; insertAfterGlobalIdx: number; }

function flattenGeomVertices(geom: any): VertexDesc[] {
  const result: VertexDesc[] = [];
  let g = 0;
  if (geom.type === "LineString") {
    (geom.coordinates as [number,number][]).forEach((lngLat, vi) => result.push({ lngLat, globalIdx: g++, polygonIdx: 0, ringIdx: 0, vertexIdx: vi }));
  } else if (geom.type === "MultiLineString") {
    (geom.coordinates as [number,number][][]).forEach((ring, ri) =>
      ring.forEach((lngLat, vi) => result.push({ lngLat, globalIdx: g++, polygonIdx: 0, ringIdx: ri, vertexIdx: vi })));
  } else if (geom.type === "Polygon") {
    (geom.coordinates as [number,number][][]).forEach((ring, ri) =>
      ring.slice(0, -1).forEach((lngLat, vi) => result.push({ lngLat, globalIdx: g++, polygonIdx: 0, ringIdx: ri, vertexIdx: vi })));
  } else if (geom.type === "MultiPolygon") {
    (geom.coordinates as [number,number][][][]).forEach((poly, pi) =>
      poly.forEach((ring, ri) =>
        ring.slice(0, -1).forEach((lngLat, vi) => result.push({ lngLat: lngLat as [number,number], globalIdx: g++, polygonIdx: pi, ringIdx: ri, vertexIdx: vi }))));
  }
  return result;
}

function computeMidpoints(descs: VertexDesc[], geomType: string): { lngLat: [number,number]; insertAfterGlobalIdx: number }[] {
  const isPoly = geomType.includes("polygon") || geomType.includes("poly");
  const byRing: Record<string, VertexDesc[]> = {};
  for (const d of descs) {
    const key = `${d.polygonIdx}_${d.ringIdx}`;
    if (!byRing[key]) byRing[key] = [];
    byRing[key].push(d);
  }
  const result: { lngLat: [number,number]; insertAfterGlobalIdx: number }[] = [];
  for (const ring of Object.values(byRing)) {
    for (let i = 0; i < ring.length; i++) {
      const curr = ring[i];
      const next = ring[i + 1] ?? (isPoly ? ring[0] : null);
      if (!next) continue;
      result.push({ lngLat: [(curr.lngLat[0]+next.lngLat[0])/2, (curr.lngLat[1]+next.lngLat[1])/2], insertAfterGlobalIdx: curr.globalIdx });
    }
  }
  return result;
}

function mutateGeomVertex(geom: any, descs: VertexDesc[], globalIdx: number, newLngLat: [number,number]): any {
  const d = descs.find(v => v.globalIdx === globalIdx); if (!d) return geom;
  if (geom.type === "LineString") {
    const c = [...geom.coordinates]; c[d.vertexIdx] = newLngLat; return { ...geom, coordinates: c };
  } else if (geom.type === "MultiLineString") {
    return { ...geom, coordinates: geom.coordinates.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const nr = [...r]; nr[d.vertexIdx] = newLngLat; return nr; }) };
  } else if (geom.type === "Polygon") {
    return { ...geom, coordinates: geom.coordinates.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const nr = [...r]; nr[d.vertexIdx] = newLngLat; if (d.vertexIdx === 0) nr[nr.length-1] = newLngLat; return nr; }) };
  } else if (geom.type === "MultiPolygon") {
    return { ...geom, coordinates: geom.coordinates.map((poly: any[][], pi: number) => {
      if (pi !== d.polygonIdx) return poly;
      return poly.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const nr = [...r]; nr[d.vertexIdx] = newLngLat; if (d.vertexIdx === 0) nr[nr.length-1] = newLngLat; return nr; });
    }) };
  }
  return geom;
}

function removeGeomVertex(geom: any, descs: VertexDesc[], globalIdx: number): any | null {
  const d = descs.find(v => v.globalIdx === globalIdx); if (!d) return geom;
  if (geom.type === "LineString") {
    if (geom.coordinates.length <= 2) return null;
    return { ...geom, coordinates: geom.coordinates.filter((_: any, i: number) => i !== d.vertexIdx) };
  } else if (geom.type === "MultiLineString") {
    const rings = geom.coordinates.map((r: any[], ri: number) => ri !== d.ringIdx ? r : r.filter((_: any, i: number) => i !== d.vertexIdx)).filter((r: any[]) => r.length >= 2);
    return rings.length === 0 ? null : { ...geom, coordinates: rings };
  } else if (geom.type === "Polygon") {
    const rings = geom.coordinates.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const v = r.slice(0,-1).filter((_: any,i:number)=>i!==d.vertexIdx); return v.length < 3 ? r : [...v, v[0]]; });
    return { ...geom, coordinates: rings };
  } else if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates.map((poly: any[][], pi: number) => {
      if (pi !== d.polygonIdx) return poly;
      return poly.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const v = r.slice(0,-1).filter((_: any,i:number)=>i!==d.vertexIdx); return v.length < 3 ? r : [...v, v[0]]; });
    });
    return { ...geom, coordinates: polys };
  }
  return geom;
}

function insertGeomVertex(geom: any, descs: VertexDesc[], afterGlobalIdx: number, newLngLat: [number,number]): any {
  const d = descs.find(v => v.globalIdx === afterGlobalIdx); if (!d) return geom;
  if (geom.type === "LineString") {
    const c = [...geom.coordinates]; c.splice(d.vertexIdx+1, 0, newLngLat); return { ...geom, coordinates: c };
  } else if (geom.type === "MultiLineString") {
    return { ...geom, coordinates: geom.coordinates.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const nr = [...r]; nr.splice(d.vertexIdx+1,0,newLngLat); return nr; }) };
  } else if (geom.type === "Polygon") {
    return { ...geom, coordinates: geom.coordinates.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const v = r.slice(0,-1); v.splice(d.vertexIdx+1,0,newLngLat); return [...v, v[0]]; }) };
  } else if (geom.type === "MultiPolygon") {
    return { ...geom, coordinates: geom.coordinates.map((poly: any[][], pi: number) => {
      if (pi !== d.polygonIdx) return poly;
      return poly.map((r: any[], ri: number) => { if (ri !== d.ringIdx) return r; const v = r.slice(0,-1); v.splice(d.vertexIdx+1,0,newLngLat); return [...v, v[0]]; });
    }) };
  }
  return geom;
}

function getNeighborPositions(selected: VertexPos, all: VertexPos[], geomType: string): VertexPos[] {
  const isPoly = geomType.includes("polygon") || geomType.includes("poly");
  const ring = all.filter(v => v.polygonIdx === selected.polygonIdx && v.ringIdx === selected.ringIdx);
  const idx = ring.findIndex(v => v.globalIdx === selected.globalIdx);
  const n = ring.length;
  const result: VertexPos[] = [];
  if (idx > 0) result.push(ring[idx-1]); else if (isPoly && n > 0) result.push(ring[n-1]);
  if (idx < n-1) result.push(ring[idx+1]); else if (isPoly && n > 0) result.push(ring[0]);
  return result;
}

// ─── component ────────────────────────────────────────────────────────────────
const MaplibreMapInner = React.forwardRef<MaplibreMapHandle, Props>(function MaplibreMap({ layers, flyTo, basemap = "", initialView, onViewChange, onUpdateLayer, hideGeocoder, hideZoom, hideLegend, shareControls, editMode = false, onManageTable, onSelectionChange, onShowInTable, onAddEdit, tablePanelOpen }, ref) {
  const mapRef = React.useRef<any>(null);
  const drawRef = React.useRef<MapboxDraw | null>(null);
  const deckCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawCleanupRef = React.useRef<(() => void) | null>(null);
  const extendCleanupRef = React.useRef<(() => void) | null>(null);
  // Shared ctidRef across successive edits to the same row — keeps all undo ops in sync.
  const geomEditEntryCtid = React.useRef<string | null>(null);
  const geomEditSharedCtid = React.useRef<{ entryCtid: string; ctidRef: { v: string } } | null>(null);
  const [extHandlePos, setExtHandlePos] = React.useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [extendAnchorPos, setExtendAnchorPos] = React.useState<{ x: number; y: number } | null>(null);
  // ─── vertex tool state ────────────────────────────────────────────────────
  const [vertexPositions, setVertexPositions] = React.useState<VertexPos[]>([]);
  const [midpointPositions, setMidpointPositions] = React.useState<MidpointPos[]>([]);
  const [selectedVertexGlobalIdx, setSelectedVertexGlobalIdx] = React.useState<number | null>(null);
  const [editorMousePos, setEditorMousePos] = React.useState<{ x: number; y: number } | null>(null);
  // Direct DOM refs — positions are written here synchronously (bypassing React batching)
  // so markers stay locked to geography during pan/zoom animation.
  const vertexEls = React.useRef<Record<number, HTMLDivElement | null>>({});
  const midpointEls = React.useRef<Record<number, HTMLDivElement | null>>({});
  const vertexScreenPos = React.useRef<Record<number, { x: number; y: number }>>({});
  const midpointScreenPos = React.useRef<Record<number, { x: number; y: number }>>({});
  // Ref so handlers can call computeVerts directly after programmatic draw changes
  // (MapboxDraw does NOT fire events for programmatic draw.delete/draw.add calls)
  const computeVertsRef = React.useRef<(() => void) | null>(null);
  const overlay = React.useMemo(() => new MapboxOverlay({ interleaved: false }), []);

  // Refs so the deckLayers useMemo onClick closure can read current edit state
  // without being re-evaluated every time those states change.
  const geomEditStateRef = React.useRef<GeomEditState | null>(null);
  const addFeatureStateRef = React.useRef<AddFeatureState | null>(null);

  const [selectionItems, setSelectionItems] = React.useState<SelectionItem[]>([]);
  const [selectionIdx, setSelectionIdx] = React.useState(0);
  const [popupCoord, setPopupCoord] = React.useState<[number, number] | null>(null);
  const [geomEditState, setGeomEditState] = React.useState<GeomEditState | null>(null);
  const [addFeatureState, setAddFeatureState] = React.useState<AddFeatureState | null>(null);
  React.useEffect(() => { geomEditStateRef.current = geomEditState; }, [geomEditState]);
  React.useEffect(() => { addFeatureStateRef.current = addFeatureState; }, [addFeatureState]);

  // ─── extend handle positions ──────────────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    const draw = drawRef.current;
    const gt = (geomEditState?.item.layer.table.geom_type ?? "").toLowerCase();
    const isLine = gt.includes("line"); // catches linestring, multilinestring, line

    if (!geomEditState || geomEditState.extending || geomEditState.loading || !isLine || !map || !draw) {
      setExtHandlePos(null);
      return;
    }

    const OFFSET_PX = 20;
    function alongDir(tip: {x:number,y:number}, neighbor: {x:number,y:number}|null) {
      if (!neighbor) return { x: tip.x + OFFSET_PX, y: tip.y };
      const dx = tip.x - neighbor.x, dy = tip.y - neighbor.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      return { x: tip.x + (dx/len)*OFFSET_PX, y: tip.y + (dy/len)*OFFSET_PX };
    }

    function computePos() {
      if (!map || !draw) return;
      const features = draw.getAll().features;
      if (!features.length) return;
      const geom = features[0].geometry as any;

      let c0: [number,number]|null = null, c1: [number,number]|null = null; // start, start+1
      let cN: [number,number]|null = null, cN1: [number,number]|null = null; // end, end-1

      if (geom.type === "LineString" && geom.coordinates.length >= 2) {
        c0 = geom.coordinates[0]; c1 = geom.coordinates[1];
        cN = geom.coordinates[geom.coordinates.length - 1];
        cN1 = geom.coordinates[geom.coordinates.length - 2];
      } else if (geom.type === "MultiLineString") {
        const first: [number,number][] = geom.coordinates[0] ?? [];
        const last: [number,number][] = geom.coordinates[geom.coordinates.length - 1] ?? [];
        if (first.length >= 1) { c0 = first[0]; c1 = first[1] ?? null; }
        if (last.length >= 1) { cN = last[last.length - 1]; cN1 = last[last.length - 2] ?? null; }
      }
      if (!c0 || !cN) return;

      const p0  = map.project(c0 as [number,number]);
      const p1  = c1  ? map.project(c1  as [number,number]) : null;
      const pN  = map.project(cN as [number,number]);
      const pN1 = cN1 ? map.project(cN1 as [number,number]) : null;

      setExtHandlePos({
        start: alongDir(p0, p1),
        end:   alongDir(pN, pN1),
      });
    }

    computePos();
    map.on("move", computePos);
    map.on("draw.update", computePos);
    return () => {
      map.off("move", computePos);
      map.off("draw.update", computePos);
      setExtHandlePos(null);
    };
  }, [geomEditState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── extend preview: dotted line from endpoint to cursor ─────────────────
  React.useEffect(() => {
    const dir = geomEditState?.extending;
    if (!dir) { setExtendAnchorPos(null); setEditorMousePos(null); return; }
    const map = mapRef.current?.getMap();
    const canvas = map?.getCanvas();
    const draw = drawRef.current;
    if (!map || !canvas || !draw) return;

    function getAnchorCoord(): [number, number] | null {
      if (!draw) return null;
      const features = draw.getAll().features;
      if (!features.length) return null;
      const geom = features[0].geometry as any;
      if (geom.type === "LineString") {
        return dir === "end" ? geom.coordinates[geom.coordinates.length - 1] : geom.coordinates[0];
      } else if (geom.type === "MultiLineString") {
        const rings: [number,number][][] = geom.coordinates;
        return dir === "end" ? rings[rings.length - 1]?.[rings[rings.length - 1].length - 1] : rings[0]?.[0];
      }
      return null;
    }

    function updateAnchor() {
      const coord = getAnchorCoord();
      if (!coord || !map) return;
      const pt = map.project(coord as [number, number]);
      setExtendAnchorPos({ x: pt.x, y: pt.y });
    }

    updateAnchor();
    map.on("move", updateAnchor);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      setEditorMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    canvas.addEventListener("mousemove", onMove);

    return () => {
      map.off("move", updateAnchor);
      canvas.removeEventListener("mousemove", onMove);
      setExtendAnchorPos(null);
      setEditorMousePos(null);
    };
  }, [geomEditState?.extending]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── vertex tool: screen positions ───────────────────────────────────────
  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    const draw = drawRef.current;
    const gt = (geomEditState?.item.layer.table.geom_type ?? "").toLowerCase();
    const isEditable = gt.includes("line") || gt.includes("polygon") || gt.includes("poly");

    if (!geomEditState || geomEditState.extending || geomEditState.loading || !isEditable || !map || !draw) {
      setVertexPositions([]); setMidpointPositions([]); setSelectedVertexGlobalIdx(null); return;
    }

    function computeVerts() {
      if (!map || !draw) return;
      const features = draw.getAll().features;
      if (!features.length) return;
      const geom = features[0].geometry as any;
      const descs = flattenGeomVertices(geom);
      const mids = computeMidpoints(descs, geom.type.toLowerCase());
      // Direct DOM update — runs synchronously with every map frame, no React batching lag
      const newVerts = descs.map(d => {
        const pt = map.project(d.lngLat);
        vertexScreenPos.current[d.globalIdx] = { x: pt.x, y: pt.y };
        const el = vertexEls.current[d.globalIdx];
        if (el) { el.style.left = pt.x + "px"; el.style.top = pt.y + "px"; }
        return { ...d, x: pt.x, y: pt.y };
      });
      const newMids = mids.map(m => {
        const pt = map.project(m.lngLat);
        midpointScreenPos.current[m.insertAfterGlobalIdx] = { x: pt.x, y: pt.y };
        const el = midpointEls.current[m.insertAfterGlobalIdx];
        if (el) { el.style.left = pt.x + "px"; el.style.top = pt.y + "px"; }
        return { ...m, x: pt.x, y: pt.y };
      });
      // React state update — only used for structural changes (add/remove vertices)
      setVertexPositions(newVerts);
      setMidpointPositions(newMids);
    }

    computeVerts();
    computeVertsRef.current = computeVerts;
    map.on("move", computeVerts);
    map.on("draw.update", computeVerts);
    // draw.delete+draw.add fires draw.create/draw.delete, not draw.update
    map.on("draw.create", computeVerts);
    map.on("draw.delete", computeVerts);
    return () => {
      computeVertsRef.current = null;
      vertexEls.current = {};
      midpointEls.current = {};
      vertexScreenPos.current = {};
      midpointScreenPos.current = {};
      map.off("move", computeVerts);
      map.off("draw.update", computeVerts);
      map.off("draw.create", computeVerts);
      map.off("draw.delete", computeVerts);
      setVertexPositions([]); setMidpointPositions([]); setSelectedVertexGlobalIdx(null);
    };
  }, [geomEditState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── vertex tool: mouse tracking for preview ─────────────────────────────
  React.useEffect(() => {
    if (selectedVertexGlobalIdx === null || !geomEditState) { setEditorMousePos(null); return; }
    const canvas = mapRef.current?.getMap()?.getCanvas();
    if (!canvas) return;
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      setEditorMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    canvas.addEventListener("mousemove", onMove);
    return () => { canvas.removeEventListener("mousemove", onMove); setEditorMousePos(null); };
  }, [selectedVertexGlobalIdx, geomEditState]);

  // ─── vertex tool: canvas click to place selected vertex ──────────────────
  React.useEffect(() => {
    if (selectedVertexGlobalIdx === null || !geomEditState) return;
    const map = mapRef.current?.getMap();
    const canvas = map?.getCanvas();
    if (!canvas) return;

    const onClick = (e: MouseEvent) => {
      // Clicks on vertex/midpoint divs stop propagation — only bare canvas clicks reach here
      const r = canvas.getBoundingClientRect();
      const lngLat = map!.unproject([e.clientX - r.left, e.clientY - r.top]);
      const draw = drawRef.current;
      if (!draw) return;
      const features = draw.getAll().features;
      if (!features.length) return;
      const f = features[0];
      const geom = f.geometry as any;
      const descs = flattenGeomVertices(geom);
      const newGeom = mutateGeomVertex(geom, descs, selectedVertexGlobalIdx, [lngLat.lng, lngLat.lat]);
      const fId = f.id as string;
      draw.delete([fId]);
      draw.add({ type: "Feature", id: fId, geometry: newGeom, properties: {} } as any);
      try { draw.changeMode("simple_select"); } catch {};
      computeVertsRef.current?.();
      setSelectedVertexGlobalIdx(null);
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [selectedVertexGlobalIdx, geomEditState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── vertex tool: Delete key to remove selected vertex ───────────────────
  React.useEffect(() => {
    if (selectedVertexGlobalIdx === null || !geomEditState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      // Stop propagation so MapboxDraw's own Delete handler (which deletes the whole feature)
      // doesn't fire. We're in capture phase so this runs before MapboxDraw's bubble listeners.
      e.preventDefault();
      e.stopPropagation();
      const draw = drawRef.current;
      if (!draw) return;
      const features = draw.getAll().features;
      if (!features.length) return;
      const f = features[0];
      const geom = f.geometry as any;
      const descs = flattenGeomVertices(geom);
      const newGeom = removeGeomVertex(geom, descs, selectedVertexGlobalIdx);
      if (!newGeom) { setGeomEditState(s => s ? { ...s, error: "Cannot remove — line needs at least 2 vertices" } : s); return; }
      const fId = f.id as string;
      draw.delete([fId]);
      draw.add({ type: "Feature", id: fId, geometry: newGeom, properties: {} } as any);
      try { draw.changeMode("simple_select"); } catch {} // prevent MapboxDraw from auto-selecting
      computeVertsRef.current?.();
      setSelectedVertexGlobalIdx(null);
    };
    // Capture phase fires before MapboxDraw's bubble-phase keyboard handlers
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [selectedVertexGlobalIdx, geomEditState]); // eslint-disable-line react-hooks/exhaustive-deps

  const [addFeaturePickerOpen, setAddFeaturePickerOpen] = React.useState(false);
  const [addFeaturePanelPos, setAddFeaturePanelPos] = React.useState<{ x: number; y: number } | null>(null);
  const addFeatureDragRef = React.useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  // When a feature is selected, fetch its full geometry from PostGIS so the
  // selection highlight shows the complete shape — tile geometries are clipped
  // to the tile boundary and simplified at lower zooms.
  const selectionGeomFetchKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    const item = selectionItems[selectionIdx];
    const ctid = item?.feature.properties?._ctid as string | undefined;
    const geomCol = item?.layer.table.geom_col;
    if (!item || !ctid || !geomCol) { selectionGeomFetchKey.current = null; return; }

    const key = `${item.layer.id}|${ctid}`;
    if (selectionGeomFetchKey.current === key) return; // already fetched
    selectionGeomFetchKey.current = key;

    const { connectionId, shareId, table } = item.layer;
    fetch("/api/pg/feature-geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol, ctid }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.geometry) return;
        setSelectionItems(prev => prev.map(it =>
          it.feature.properties?._ctid === ctid && it.layer.id === item.layer.id
            ? { ...it, feature: { ...it.feature, geometry: data.geometry } }
            : it
        ));
      })
      .catch(() => {});
  }, [selectionItems, selectionIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Escape: deselect vertex first; if none, deselect map selection
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (addFeatureStateRef.current) return; // add-feature handles its own escape
      if (geomEditStateRef.current) {
        // If a vertex is selected, just deselect it (don't cancel the whole edit)
        setSelectedVertexGlobalIdx(null);
        return;
      }
      setPopupCoord(null);
      setSelectionItems([]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [panelPos, setPanelPos] = React.useState<{ x: number; y: number } | null>(null);
  const [panelWidth, setPanelWidth] = React.useState(280);
  const [panelHeight, setPanelHeight] = React.useState(256);
  const dragRef = React.useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const panelResizeRef = React.useRef<{ ox: number; oy: number; startW: number; startH: number } | null>(null);

  // Set initial panel position from the clicked map coordinate
  React.useEffect(() => {
    if (!popupCoord) { setPanelPos(null); return; }
    const map = mapRef.current?.getMap();
    if (!map) return;
    const pt = map.project(popupCoord as [number, number]);
    setPanelPos({ x: pt.x + 12, y: pt.y - 20 });
  }, [popupCoord]);

  // Global drag/resize handlers (covers popup drag, add-feature panel drag, and panel resize)
  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragRef.current) {
        const { ox, oy, px, py } = dragRef.current;
        setPanelPos({ x: px + e.clientX - ox, y: py + e.clientY - oy });
      }
      if (addFeatureDragRef.current) {
        const { ox, oy, px, py } = addFeatureDragRef.current;
        setAddFeaturePanelPos({ x: px + e.clientX - ox, y: py + e.clientY - oy });
      }
      if (panelResizeRef.current) {
        const { ox, oy, startW, startH } = panelResizeRef.current;
        setPanelWidth(Math.max(220, Math.min(600, startW + e.clientX - ox)));
        setPanelHeight(Math.max(80, Math.min(520, startH + e.clientY - oy)));
      }
    }
    function onUp() { dragRef.current = null; addFeatureDragRef.current = null; panelResizeRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function startDrag(e: React.MouseEvent) {
    if (!panelPos) return;
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: panelPos.x, py: panelPos.y };
    e.preventDefault();
  }

  const [zoom, setZoom] = React.useState(4);
  const [bearing, setBearing] = React.useState(0);
  const [mapboxDrawMode, setMapboxDrawMode] = React.useState<string>("");
  const layersRef = React.useRef(layers);
  const onUpdateLayerRef = React.useRef(onUpdateLayer);
  const onAddEditRef = React.useRef(onAddEdit);
  const tablePanelOpenRef = React.useRef(tablePanelOpen);
  const preEditGeomRef = React.useRef<any>(null);
  React.useEffect(() => { layersRef.current = layers; }, [layers]);
  React.useEffect(() => { onUpdateLayerRef.current = onUpdateLayer; }, [onUpdateLayer]);
  React.useEffect(() => { onAddEditRef.current = onAddEdit; }, [onAddEdit]);
  React.useEffect(() => { tablePanelOpenRef.current = tablePanelOpen; }, [tablePanelOpen]);

  React.useImperativeHandle(ref, () => ({
    addEdit: (op: UndoableOp) => onAddEditRef.current?.(op),
    editGeometry: (layerId: string, ctid: string) => {
      const layer = layersRef.current.find(l => l.id === layerId);
      if (!layer) return;
      enterGeomEdit({
        layer,
        feature: { type: "Feature", geometry: null, properties: { _ctid: ctid } },
      });
    },
    addFeature: (layerId: string) => {
      const layer = layersRef.current.find(l => l.id === layerId);
      if (!layer) return;
      enterAddFeature(layer);
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const ctids = selectionItems
      .map(it => it.feature.properties?._ctid as string | undefined)
      .filter((c): c is string => !!c);
    const layerId = selectionItems[0]?.layer.id ?? null;
    onSelectionChange?.(ctids, layerId);
  }, [selectionItems]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFeatureSaved(layerId: string) {
    const layer = layers.find(l => l.id === layerId);
    if (layer) onUpdateLayer?.(layerId, { dataVersion: (layer.dataVersion ?? 0) + 1 });
  }

  // ─── geometry editing ─────────────────────────────────────────────────────
  async function enterGeomEdit(item: SelectionItem) {
    const geomCol = item.layer.table.geom_col;
    const ctid = item.feature.properties?._ctid as string | undefined;
    if (!geomCol || !ctid) return;
    geomEditEntryCtid.current = ctid;

    setPopupCoord(null);
    preEditGeomRef.current = null;

    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();

    const gt = (item.layer.table.geom_type ?? "").toLowerCase();
    const isPoint = gt.includes("point");

    // Points enter draw mode immediately.
    // Lines/polygons wait for the real GeoJSON from the API before adding to draw —
    // tile features use typed arrays internally (deck.gl/WebGL) which break JSON.stringify.
    if (isPoint) {
      draw.changeMode("draw_point");
    }

    const canvas = mapRef.current?.getMap()?.getCanvas();
    const mapInst = mapRef.current?.getMap();
    let cleanupFns: Array<() => void> = [];

    if (canvas) {
      // Right-click finishes in-progress line/polygon draw
      const handler = (e: MouseEvent) => {
        e.preventDefault();
        const d = drawRef.current;
        if (!d) return;
        const m = d.getMode();
        if (m === "draw_line_string" || m === "draw_polygon") {
          try { d.changeMode("simple_select"); } catch {}
        }
      };
      canvas.addEventListener("contextmenu", handler);
      cleanupFns.push(() => canvas.removeEventListener("contextmenu", handler));
    }

    if (isPoint && mapInst) {
      // After placing a point MapboxDraw auto-switches to simple_select.
      // Re-enter draw_point immediately (keeping the placed feature in the
      // collection) so the user can click anywhere to replace the point.
      // Track whether any point has been placed so the Save button stays enabled.
      const onPointModeChange = (e: any) => {
        if (e.mode !== "simple_select") return;
        const d = drawRef.current;
        if (!d) return;
        const features = d.getAll().features;
        if (features.length === 0) return;
        // Keep only the most recently placed point
        const latest = features[features.length - 1];
        d.deleteAll();
        d.add(latest as any);
        setGeomEditState(s => s ? { ...s, pointPlaced: true } : s);
        try { d.changeMode("draw_point"); } catch {}
      };
      mapInst.on("draw.modechange", onPointModeChange);
      cleanupFns.push(() => mapInst.off("draw.modechange", onPointModeChange));
    }

    drawCleanupRef.current = () => { for (const fn of cleanupFns) fn(); };

    setGeomEditState({ item, saving: false, error: null, loading: !isPoint, pointPlaced: false });

    try {
      const { connectionId, shareId, table } = item.layer;
      const res = await fetch("/api/pg/feature-geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol, ctid }),
      });
      const data = await res.json();
      if (data.geometry) {
        preEditGeomRef.current = data.geometry;
        if (!isPoint) {
          const d = drawRef.current;
          if (d) {
            d.add({ type: "Feature", geometry: data.geometry, properties: {} } as any);
            // Use simple_select (no feature selected) so MapboxDraw renders the geometry
            // but doesn't show drag handles — our custom vertex tool handles all interaction.
            try { d.changeMode("simple_select"); } catch {}
          }
        }
        const realItem: SelectionItem = { ...item, feature: { ...item.feature, geometry: data.geometry } };
        setGeomEditState(s => s && s.item.feature.properties?._ctid === ctid
          ? { ...s, item: realItem, loading: false }
          : s);
      } else {
        setGeomEditState(s => s && s.item.feature.properties?._ctid === ctid
          ? { ...s, loading: false, error: "Feature geometry not found" }
          : s);
      }
    } catch {
      setGeomEditState(s => s && s.item.feature.properties?._ctid === ctid
        ? { ...s, loading: false, error: "Failed to load geometry" }
        : s);
    }
  }

  async function saveGeomEdit() {
    if (!geomEditState || geomEditState.saving) return;
    const draw = drawRef.current;
    if (!draw) return;
    const features = draw.getAll().features;
    if (!features.length) {
      setGeomEditState(s => s ? { ...s, error: "No geometry to save" } : null);
      return;
    }

    setGeomEditState(s => s ? { ...s, saving: true, error: null } : null);
    const geometry = features[0].geometry;
    const { item } = geomEditState;
    const { connectionId, shareId, table } = item.layer;
    const ctid = item.feature.properties?._ctid;

    const res = await fetch("/api/pg/feature-geometry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol: table.geom_col, ctid, geometry, srid: table.srid }),
    });
    const data = await res.json();
    if (data.error) {
      setGeomEditState(s => s ? { ...s, saving: false, error: data.error } : null);
      return;
    }
    extendCleanupRef.current?.(); extendCleanupRef.current = null;
    drawCleanupRef.current?.(); drawCleanupRef.current = null;
    draw.deleteAll();
    setGeomEditState(null);
    setExtHandlePos(null);
    // Always clear the old selection immediately so the old highlight never lingers.
    setSelectionItems([]);
    setPopupCoord(null);

    // Always read the current dataVersion from the live layers array.
    // item.layer may be a stale snapshot (captured at enterGeomEdit time),
    // so using it directly would produce duplicate version numbers on repeated edits.
    const currentLayer = layers.find(l => l.id === item.layer.id);
    const newVersion = (currentLayer?.dataVersion ?? item.layer.dataVersion ?? 0) + 1;
    onUpdateLayer?.(item.layer.id, { dataVersion: newVersion });

    // Push undo record for geometry edit if we captured the pre-edit geometry
    const oldGeom = preEditGeomRef.current;
    const newGeom = geometry;
    if (oldGeom && data.newCtid) {
      const { connectionId, shareId, table } = item.layer;
      const layerId = item.layer.id;
      // Reuse the shared ctidRef if this edit continues from the same row's last save,
      // so all undo ops for the same row stay in sync as the ctid changes each PATCH.
      let ctidRef: { v: string };
      if (geomEditSharedCtid.current?.entryCtid === geomEditEntryCtid.current) {
        ctidRef = geomEditSharedCtid.current.ctidRef;
        ctidRef.v = data.newCtid;
        geomEditSharedCtid.current.entryCtid = data.newCtid;
      } else {
        ctidRef = { v: data.newCtid };
        geomEditSharedCtid.current = { entryCtid: data.newCtid, ctidRef };
      }
      onAddEditRef.current?.({
        id: crypto.randomUUID(),
        label: `Geometry edit on ${table.table_schema}.${table.table_name}`,
        layerId,
        revert: async () => {
          const r = await fetch("/api/pg/feature-geometry", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol: table.geom_col, ctid: ctidRef.v, geometry: oldGeom, srid: table.srid }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          if (d.newCtid) ctidRef.v = d.newCtid;
          const l = layersRef.current.find(l => l.id === layerId);
          onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
        },
        apply: async () => {
          const r = await fetch("/api/pg/feature-geometry", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol: table.geom_col, ctid: ctidRef.v, geometry: newGeom, srid: table.srid }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          if (d.newCtid) ctidRef.v = d.newCtid;
          const l = layersRef.current.find(l => l.id === layerId);
          onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
        },
      });
    }

    // Reopen popup immediately with the new ctid returned by the server.
    // Use the drawn geometry (not the stale tile geometry) so the highlight
    // appears at the correct new position right away.
    if (data.newCtid) {
      const anchor = geomAnchor(geometry);
      if (anchor) {
        const newItem: SelectionItem = {
          ...item,
          layer: { ...(currentLayer ?? item.layer), dataVersion: newVersion },
          feature: { ...item.feature, geometry, properties: { ...item.feature.properties, _ctid: data.newCtid } },
        };
        setSelectionItems([newItem]);
        setSelectionIdx(0);
        setPopupCoord(anchor);
      }
    }
  }

  function cancelGeomEdit() {
    extendCleanupRef.current?.(); extendCleanupRef.current = null;
    drawCleanupRef.current?.(); drawCleanupRef.current = null;
    drawRef.current?.deleteAll();
    setGeomEditState(null);
    setExtHandlePos(null);
    setSelectionItems([]);
  }

  function startExtend(dir: "start" | "end") {
    const draw = drawRef.current;
    const map = mapRef.current?.getMap();
    if (!draw || !map) return;
    setExtHandlePos(null);
    setSelectedVertexGlobalIdx(null);
    try { draw.changeMode("simple_select"); } catch {}
    setGeomEditState(s => s ? { ...s, extending: dir } : s);

    const canvas = map.getCanvas();

    const clickHandler = (e: MouseEvent) => {
      // Convert pixel coords to lngLat via the map
      const rect = canvas.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const lngLat = map.unproject([point.x, point.y]);

      const d = drawRef.current;
      if (!d) return;
      const features = d.getAll().features;
      if (!features.length) return;
      const f = features[0];
      const geom = f.geometry as any;
      const fId = f.id as string;
      const newPt: [number, number] = [lngLat.lng, lngLat.lat];

      let newGeom: any;
      if (geom.type === "LineString") {
        const coords = [...geom.coordinates];
        if (dir === "end") coords.push(newPt); else coords.unshift(newPt);
        newGeom = { type: "LineString", coordinates: coords };
      } else if (geom.type === "MultiLineString") {
        const rings = geom.coordinates.map((r: any[]) => [...r]);
        if (dir === "end") rings[rings.length - 1].push(newPt);
        else rings[0].unshift(newPt);
        newGeom = { type: "MultiLineString", coordinates: rings };
      } else return;

      // delete + re-add is more reliable than in-place update
      d.delete([fId]);
      d.add({ type: "Feature", id: fId, geometry: newGeom, properties: {} } as any);
      // Shift anchor to the newly placed vertex immediately (programmatic draw calls don't fire events)
      const screenPt = map.project(newPt);
      setExtendAnchorPos({ x: screenPt.x, y: screenPt.y });
    };

    const contextHandler = (e: MouseEvent) => { e.preventDefault(); stopExtend(); };
    canvas.addEventListener("click", clickHandler);
    canvas.addEventListener("contextmenu", contextHandler);
    extendCleanupRef.current = () => {
      canvas.removeEventListener("click", clickHandler);
      canvas.removeEventListener("contextmenu", contextHandler);
    };
  }

  function stopExtend() {
    extendCleanupRef.current?.(); extendCleanupRef.current = null;
    const draw = drawRef.current;
    if (draw) {
      try { draw.changeMode("simple_select"); } catch {}
    }
    setGeomEditState(s => s ? { ...s, extending: undefined } : s);
  }

  // ─── add feature ─────────────────────────────────────────────────────────

  function startAddFeatureDraw(layer: MapLayer, columns: { name: string; dataType: string; hasDefault?: boolean; isSerial?: boolean }[]) {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    const gt = (layer.table.geom_type ?? "").toLowerCase();
    const isPoint = gt.includes("point");

    const map = mapRef.current?.getMap();
    const canvas = map?.getCanvas();

    if (isPoint) {
      // For points: intercept the next map click directly instead of using MapboxDraw's
      // draw_point mode, which has unreliable draw.create event timing and confusing
      // behavior when the user double-clicks to try to confirm placement.
      const clickHandler = (e: any) => {
        const geometry = { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] };
        draw.add({ type: "Feature", id: "new-point", geometry, properties: {} } as any);
        try { draw.changeMode("simple_select", { featureIds: ["new-point"] }); } catch {}
        const state = addFeatureStateRef.current;
        if (!state) return;
        if (state.columns.length === 0) {
          saveNewFeature(state.layer, geometry, state.columns, {});
          return;
        }
        const anchor = geomAnchor(geometry);
        if (anchor) {
          const m = mapRef.current?.getMap();
          if (m) {
            const pt = m.project(anchor as [number, number]);
            setAddFeaturePanelPos({ x: pt.x + 12, y: pt.y - 20 });
          }
        }
        setAddFeatureState(s => s ? { ...s, phase: "attrs", geometry, error: null } : null);
      };
      if (map) map.once("click", clickHandler);
      drawCleanupRef.current = () => { if (map) map.off("click", clickHandler); };
    } else {
      if (gt.includes("linestring") || gt.includes("line")) draw.changeMode("draw_line_string");
      else draw.changeMode("draw_polygon");

      // Right-click to finish line/polygon
      const contextHandler = (e: MouseEvent) => {
        e.preventDefault();
        const d = drawRef.current;
        if (!d) return;
        const m = d.getMode();
        if (m === "draw_line_string" || m === "draw_polygon") try { d.changeMode("simple_select"); } catch {}
      };
      if (canvas) canvas.addEventListener("contextmenu", contextHandler);
      drawCleanupRef.current = () => { if (canvas) canvas.removeEventListener("contextmenu", contextHandler); };
    }

    const attrs: Record<string, string> = {};
    for (const col of columns) attrs[col.name] = "";
    const autoAttrs = new Set(columns.filter(c => c.isSerial).map(c => c.name));
    setAddFeatureState({ layer, phase: "drawing", columns, attrs, autoAttrs, geometry: null, error: null });
  }

  async function enterAddFeature(layer: MapLayer) {
    setPopupCoord(null);
    setSelectionItems([]);
    if (geomEditState) { drawCleanupRef.current?.(); drawCleanupRef.current = null; drawRef.current?.deleteAll(); setGeomEditState(null); }
    setAddFeaturePickerOpen(false);

    // Fetch columns list (ctid=null → returns columns only)
    let columns: { name: string; dataType: string }[] = [];
    try {
      const res = await fetch("/api/pg/feature-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: layer.connectionId, shareId: layer.shareId, schema: layer.table.table_schema, table: layer.table.table_name, ctid: null }),
      });
      const data = await res.json();
      columns = data.columns ?? [];
    } catch {}

    startAddFeatureDraw(layer, columns);
  }

  function addFeatureNextStep() {
    if (!addFeatureState) return;
    const draw = drawRef.current;
    if (!draw) return;
    const mode = draw.getMode();
    if (mode === "draw_line_string" || mode === "draw_polygon") {
      setAddFeatureState(s => s ? { ...s, error: "Double-click or right-click to finish drawing first" } : null);
      return;
    }
    const features = draw.getAll().features;
    if (!features.length) {
      setAddFeatureState(s => s ? { ...s, error: "Draw a geometry first" } : null);
      return;
    }
    const geometry = features[0].geometry;

    if (addFeatureState.columns.length === 0) {
      // No attributes to fill — go straight to save
      saveNewFeature(addFeatureState.layer, geometry, addFeatureState.columns, {});
      return;
    }

    const anchor = geomAnchor(geometry);
    if (anchor) {
      const map = mapRef.current?.getMap();
      if (map) {
        const pt = map.project(anchor as [number, number]);
        setAddFeaturePanelPos({ x: pt.x + 12, y: pt.y - 20 });
      }
    }
    setAddFeatureState(s => s ? { ...s, phase: "attrs", geometry, error: null } : null);
  }

  async function saveNewFeature(layer: MapLayer, geometry: any, columns: { name: string; dataType: string }[], attrs: Record<string, string>, autoAttrs?: Set<string>) {
    setAddFeatureState(s => s ? { ...s, phase: "saving", error: null } : null);
    const filteredAttrs = autoAttrs && autoAttrs.size > 0
      ? Object.fromEntries(Object.entries(attrs).filter(([k]) => !autoAttrs.has(k)))
      : attrs;
    const res = await fetch("/api/pg/feature-row", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: layer.connectionId,
        shareId: layer.shareId,
        schema: layer.table.table_schema,
        table: layer.table.table_name,
        geomCol: layer.table.geom_col,
        geometry,
        srid: layer.table.srid,
        attrs: filteredAttrs,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setAddFeatureState(s => s ? { ...s, phase: "attrs", error: data.error } : null);
      return;
    }
    drawCleanupRef.current?.(); drawCleanupRef.current = null;
    drawRef.current?.deleteAll();
    setAddFeatureState(null);
    setAddFeaturePanelPos(null);

    const currentLayer = layers.find(l => l.id === layer.id);
    const newVersion = (currentLayer?.dataVersion ?? layer.dataVersion ?? 0) + 1;
    onUpdateLayer?.(layer.id, { dataVersion: newVersion });

    if (data.ctid) {
      // Push undo record — undo by deleting the inserted row; redo by re-inserting
      const { connectionId, shareId, table } = layer;
      const layerId = layer.id;
      const ctidRef = { v: data.ctid }; // mutable — updated by apply (re-insert gives new ctid)
      onAddEditRef.current?.({
        id: crypto.randomUUID(),
        label: `Added feature to ${table.table_schema}.${table.table_name}`,
        layerId,
        revert: async () => {
          const r = await fetch("/api/pg/feature-row", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: ctidRef.v }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          const l = layersRef.current.find(l => l.id === layerId);
          onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
        },
        apply: async () => {
          const r = await fetch("/api/pg/feature-row", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol: table.geom_col, geometry, srid: table.srid, attrs: filteredAttrs }),
          });
          const d = await r.json();
          if (d.error) throw new Error(d.error);
          if (d.ctid) ctidRef.v = d.ctid;
          const l = layersRef.current.find(l => l.id === layerId);
          onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
        },
      });

      const anchor = geomAnchor(geometry);
      if (anchor) {
        const newItem: SelectionItem = {
          layer: { ...(currentLayer ?? layer), dataVersion: newVersion },
          feature: { type: "Feature", geometry, properties: { _ctid: data.ctid } },
        };
        setSelectionItems([newItem]);
        setSelectionIdx(0);
        setPopupCoord(anchor);
      }
    }
  }

  function cancelAddFeature() {
    drawCleanupRef.current?.(); drawCleanupRef.current = null;
    drawRef.current?.deleteAll();
    setAddFeatureState(null);
    setAddFeaturePanelPos(null);
  }

  // ─── delete feature ───────────────────────────────────────────────────────
  async function deleteFeature(item: SelectionItem) {
    const geomCol = item.layer.table.geom_col;
    const ctid = item.feature.properties?._ctid as string | undefined;
    if (!ctid || !geomCol) return;

    const { connectionId, shareId, table } = item.layer;
    const layerId = item.layer.id;

    // Close popup immediately
    setSelectionItems([]);
    setPopupCoord(null);

    // Fetch geometry + attrs in parallel before deleting (needed for undo)
    let geometry: any = null;
    let attrs: Record<string, any> = {};
    try {
      const [geomRes, attrRes] = await Promise.all([
        fetch("/api/pg/feature-geometry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, geomCol, ctid }),
        }),
        fetch("/api/pg/feature-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid }),
        }),
      ]);
      const geomData = await geomRes.json();
      const attrData = await attrRes.json();
      geometry = geomData.geometry ?? null;
      attrs = attrData.row ?? {};
    } catch {}

    // Delete the row
    try {
      const res = await fetch("/api/pg/feature-row", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid }),
      });
      const data = await res.json();
      if (data.error) return;

      const currentLayer = layersRef.current.find(l => l.id === layerId);
      const newVersion = (currentLayer?.dataVersion ?? 0) + 1;
      onUpdateLayerRef.current?.(layerId, { dataVersion: newVersion });

      if (geometry) {
        const reinsertedCtid = { v: null as string | null }; // set by revert; used by apply
        onAddEditRef.current?.({
          id: crypto.randomUUID(),
          label: `Deleted feature from ${table.table_schema}.${table.table_name}`,
          layerId,
          revert: async () => {
            const attrKeys = Object.keys(attrs);
            const r = await fetch("/api/pg/feature-row", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connectionId, shareId,
                schema: table.table_schema, table: table.table_name,
                geomCol, geometry, srid: table.srid,
                attrs: Object.fromEntries(attrKeys.map(k => [k, attrs[k] === null || attrs[k] === undefined ? "" : attrs[k]])),
              }),
            });
            const d = await r.json();
            if (d.error) throw new Error(d.error);
            if (d.ctid) reinsertedCtid.v = d.ctid;
            const l = layersRef.current.find(l => l.id === layerId);
            onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
          },
          apply: async () => {
            if (!reinsertedCtid.v) throw new Error("Cannot redo delete: missing ctid");
            const r = await fetch("/api/pg/feature-row", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: reinsertedCtid.v }),
            });
            const d = await r.json();
            if (d.error) throw new Error(d.error);
            reinsertedCtid.v = null;
            const l = layersRef.current.find(l => l.id === layerId);
            onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
          },
        });
      }
    } catch {}
  }

  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    const mapCanvas = map?.getCanvas();
    const isDrawing = !!(geomEditState || addFeatureState?.phase === "drawing");
    if (mapCanvas) mapCanvas.style.cursor = isDrawing ? "crosshair" : "";
    // Let pointer events pass through the deck canvas to MapboxDraw during drawing.
    // Do NOT change opacity — deck.gl renders all MVT layers and hiding it blacks out the map.
    const dc = deckCanvasRef.current;
    if (dc) dc.style.pointerEvents = isDrawing ? "none" : "";
    // MapboxDraw overrides cursor on every mousemove; re-assert ours so crosshair persists.
    if (!isDrawing || !map || !mapCanvas) return;
    const assertCursor = () => { mapCanvas.style.cursor = "crosshair"; };
    map.on("mousemove", assertCursor);
    return () => { map.off("mousemove", assertCursor); mapCanvas.style.cursor = ""; };
  }, [geomEditState, addFeatureState]);

  const mapStyle = React.useMemo(
    () => (basemap && basemap in BASEMAPS ? BASEMAPS[basemap] : BLANK_STYLE) as any,
    [basemap],
  );

  // ─── fly to ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!flyTo) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if ("bounds" in flyTo) map.fitBounds(flyTo.bounds, { padding: 60, maxZoom: 18 });
    else map.flyTo({ center: flyTo.center, zoom: flyTo.zoom });
  }, [flyTo]);

  // ─── deck layers ─────────────────────────────────────────────────────────
  const deckLayers = React.useMemo(() => layers
    .filter(l => l.visible && l.table.geom_col)
    .map(layer => {
      // Single pass over controls — avoids 6+ separate .find() calls per layer
      type NumCtrl = Extract<LayerControl, { type: "numeric" }>;
      type CatCtrl = Extract<LayerControl, { type: "categorical" }>;
      type FillCtrl = Extract<LayerControl, { type: "fill" }>;
      type StrokeCtrl = Extract<LayerControl, { type: "stroke" }>;
      type ThreshCtrl = Extract<LayerControl, { type: "threshold" }>;
      let fillCtrl: FillCtrl | undefined;
      let strokeCtrl: StrokeCtrl | undefined;
      let catFill: CatCtrl | undefined;
      let catStroke: CatCtrl | undefined;
      let threshFill: ThreshCtrl | undefined;
      let threshStroke: ThreshCtrl | undefined;
      let numOpacity: NumCtrl | undefined;
      let numStrokeOpacity: NumCtrl | undefined;
      let radCtrl: NumCtrl | undefined;
      let lwCtrl: NumCtrl | undefined;

      for (const c of (layer.controls ?? [])) {
        if (c.type === "fill") { fillCtrl = c as FillCtrl; continue; }
        if (c.type === "stroke") { strokeCtrl = c as StrokeCtrl; continue; }
        if (!c.enabled) continue;
        if (c.type === "categorical") {
          if (c.target === "fill") catFill = c;
          else if (c.target === "stroke") catStroke = c;
        } else if (c.type === "threshold") {
          if (c.target === "fill") threshFill = c;
          else if (c.target === "stroke") threshStroke = c;
        } else if (c.type === "numeric") {
          if (c.target === "opacity") numOpacity = c;
          else if (c.target === "strokeOpacity") numStrokeOpacity = c;
          else if (c.target === "radius") radCtrl = c;
          else if (c.target === "line-width") lwCtrl = c;
        }
      }

      const fillRgb    = hexToRgb(fillCtrl?.color ?? layer.style.color);
      const strokeRgb  = hexToRgb(strokeCtrl?.color ?? layer.style.strokeColor ?? "#ffffff");
      const fillAlpha  = fillCtrl && !fillCtrl.enabled ? 0 : Math.round((fillCtrl?.opacity ?? layer.style.opacity) * 255);
      const strokeAlpha = strokeCtrl && !strokeCtrl.enabled ? 0 : Math.round((strokeCtrl?.opacity ?? layer.style.strokeOpacity ?? 1) * 255);
      const staticFill: [number,number,number,number]   = [...fillRgb,   fillAlpha];
      const staticStroke: [number,number,number,number] = [...strokeRgb, strokeAlpha];

      return new MVTLayer({
        id: `layer-${layer.id}-v${layer.dataVersion ?? 0}`,
        data: buildTileUrl(layer),
        minZoom: layer.minZoom ?? 0,
        maxZoom: 14,
        refinementStrategy: "no-overlap",
        pickable: true,
        autoHighlight: true,
        pointType: "circle",
        pointRadiusUnits: "pixels",
        lineWidthUnits: "pixels",

        getPointRadius: radCtrl
          ? (d: any) => lerp(Number(d.properties?.[radCtrl!.column] ?? 0), radCtrl!.min, radCtrl!.max, radCtrl!.minOutput, radCtrl!.maxOutput)
          : layer.style.radius,

        getFillColor: threshFill
          ? (d: any) => {
              const v = Number(d.properties?.[threshFill!.column] ?? 0);
              return resolveThreshColor(threshFill!, v, fillAlpha);
            }
          : catFill
          ? (d: any) => {
              const rule = catFill!.rules.find(r => r.values.includes(String(d.properties?.[catFill!.column] ?? "")));
              return [...hexToRgb(rule ? rule.color : catFill!.defaultColor), fillAlpha] as [number,number,number,number];
            }
          : numOpacity
          ? (d: any) => [...fillRgb, Math.round(lerp(Number(d.properties?.[numOpacity!.column] ?? 0), numOpacity!.min, numOpacity!.max, numOpacity!.minOutput, numOpacity!.maxOutput) * 255)] as [number,number,number,number]
          : staticFill,

        getLineColor: threshStroke
          ? (d: any) => {
              const v = Number(d.properties?.[threshStroke!.column] ?? 0);
              return resolveThreshColor(threshStroke!, v, strokeAlpha);
            }
          : catStroke
          ? (d: any) => {
              const rule = catStroke!.rules.find(r => r.values.includes(String(d.properties?.[catStroke!.column] ?? "")));
              return [...hexToRgb(rule ? rule.color : catStroke!.defaultColor), strokeAlpha] as [number,number,number,number];
            }
          : numStrokeOpacity
          ? (d: any) => [...strokeRgb, Math.round(lerp(Number(d.properties?.[numStrokeOpacity!.column] ?? 0), numStrokeOpacity!.min, numStrokeOpacity!.max, numStrokeOpacity!.minOutput, numStrokeOpacity!.maxOutput) * 255)] as [number,number,number,number]
          : staticStroke,

        getLineWidth: lwCtrl
          ? (d: any) => lerp(Number(d.properties?.[lwCtrl!.column] ?? 0), lwCtrl!.min, lwCtrl!.max, lwCtrl!.minOutput, lwCtrl!.maxOutput)
          : strokeCtrl?.width ?? layer.style.lineWidth,

        updateTriggers: {
          getPointRadius:  [layer.controls, layer.style.radius],
          getFillColor:    [layer.controls, layer.style.color, layer.style.opacity],
          getLineColor:    [layer.controls, layer.style.strokeColor, layer.style.strokeOpacity],
          getLineWidth:    [layer.controls, layer.style.lineWidth],
        },

        onClick: (info: any) => {
          if (geomEditStateRef.current || addFeatureStateRef.current) return;
          if (!info.object) return;
          const picks: any[] = (overlay as any).pickMultipleObjects?.({ x: info.x, y: info.y, radius: 1, depth: 50 }) ?? [info];
          const items = (picks.length > 0 ? picks : [info])
            .filter((p: any) => p.object)
            .map((p: any) => {
              const ml = layers.find(l => l.id === (p.layer?.id ?? "").replace(/^layer-/, "").replace(/-v\d+$/, ""));
              return ml ? { feature: p.object, layer: ml } : null;
            })
            .filter(Boolean) as SelectionItem[];
          if (items.length === 0) return;
          setSelectionItems(sortByDatetime(items));
          setSelectionIdx(0);
          if (!tablePanelOpenRef.current) setPopupCoord(info.coordinate as [number, number]);
        },
      });
    }),
  [layers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── mount overlay + draw control on map load ────────────────────────────
  const onLoad = React.useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.addControl(overlay);
    deckCanvasRef.current = (overlay as any).getCanvas?.() ?? null;
    const draw = new MapboxDraw({ displayControlsDefault: false, controls: {}, styles: DRAW_STYLES as any });
    map.addControl(draw as any);
    drawRef.current = draw;
    map.on("draw.modechange", (e: any) => setMapboxDrawMode(e.mode ?? ""));

    // MapLibre-native highlight source — visible even when deck.gl canvas is hidden
    map.addSource("_sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "_sel-fill",   type: "fill",   source: "_sel", filter: ["==", "$type", "Polygon"],    paint: { "fill-color": "#3b82f6", "fill-opacity": 0.18 } });
    map.addLayer({ id: "_sel-line",   type: "line",   source: "_sel",                                        paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.9 } });
    map.addLayer({ id: "_sel-circle", type: "circle", source: "_sel", filter: ["==", "$type", "Point"],      paint: { "circle-radius": 10, "circle-color": "#3b82f6", "circle-opacity": 0.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
  }, [overlay]);

  // ─── keep MapLibre highlight source in sync (visible even during draw mode) ─
  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    const src = map?.getSource("_sel") as any;
    if (!src) return;
    const feature = geomEditState?.item.feature ?? selectionItems[selectionIdx]?.feature;
    src.setData({ type: "FeatureCollection", features: feature ? [feature] : [] });
  }, [selectionItems, selectionIdx, geomEditState]);

  // ─── sync deck layers + selection highlight to overlay ───────────────────
  React.useEffect(() => {
    const selected = selectionItems[selectionIdx]?.feature;
    const highlightLayer = selected
      ? new GeoJsonLayer({
          id: "selection-highlight",
          data: [selected],
          pickable: false,
          filled: true,
          stroked: true,
          getFillColor: [59, 130, 246, 45],
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 2.5,
          lineWidthUnits: "pixels",
          pointRadiusUnits: "pixels",
          getPointRadius: 10,
        })
      : null;

    overlay.setProps({
      layers: highlightLayer ? [...deckLayers, highlightLayer] : deckLayers,
      getCursor: ({ isHovering }: { isHovering: boolean }) => isHovering ? "pointer" : "",
      onHover: (info: any) => {
        // Don't override cursor during geometry edit or add-feature drawing.
        // Use refs so this closure doesn't go stale when those states change.
        if (geomEditStateRef.current || addFeatureStateRef.current?.phase === "drawing") return;
        const canvas = mapRef.current?.getMap()?.getCanvas();
        if (canvas) canvas.style.cursor = info.object ? "pointer" : "";
      },
    });
  }, [overlay, deckLayers, selectionItems, selectionIdx, geomEditState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <p className="text-slate-400 text-sm">Add a layer from the sidebar to get started.</p>
        </div>
      )}

      <Map
        ref={mapRef}
        onLoad={onLoad}
        reuseMaps
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onRotate={(e) => setBearing(e.viewState.bearing ?? 0)}
        initialViewState={initialView ?? { longitude: -98.5556199, latitude: 39.8097343, zoom: 4 }}
        onMoveEnd={(e) => {
          const map = mapRef.current?.getMap();
          const b = map?.getBounds();
          onViewChange?.({
            longitude: e.viewState.longitude,
            latitude: e.viewState.latitude,
            zoom: e.viewState.zoom,
            bounds: b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : undefined,
          });
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={{ compact: true, customAttribution: "" }}
      >
      </Map>

      {panelPos && selectionItems[selectionIdx] && (
        <div
          className="absolute z-20 bg-background border rounded-lg shadow-xl overflow-hidden text-foreground"
          style={{ left: panelPos.x, top: panelPos.y, width: panelWidth }}
        >
          <div
            onMouseDown={startDrag}
            className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40 cursor-grab active:cursor-grabbing select-none"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {selectionItems[selectionIdx].layer.table.table_schema}.{selectionItems[selectionIdx].layer.table.table_name}
            </span>
            {selectionItems.length > 1 && (
              <span className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => setSelectionIdx(i => Math.max(0, i - 1))} disabled={selectionIdx === 0}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[11px] tabular-nums text-muted-foreground">{selectionIdx + 1}/{selectionItems.length}</span>
                <button onClick={() => setSelectionIdx(i => Math.min(selectionItems.length - 1, i + 1))} disabled={selectionIdx === selectionItems.length - 1}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </span>
            )}
            {onShowInTable && (
              <button
                onClick={() => {
                  const item = selectionItems[selectionIdx];
                  onShowInTable(item.layer.id, item.feature.properties?._ctid as string ?? "");
                }}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Open in attribute table"
              >
                <Sheet className="h-3 w-3" />
              </button>
            )}
            <button onClick={() => { setPopupCoord(null); setSelectionItems([]); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: panelHeight }}>
            <FeatureRows
              item={selectionItems[selectionIdx]}
              editMode={editMode}
              onFieldSaved={() => handleFeatureSaved(selectionItems[selectionIdx].layer.id)}
              onManageTable={onManageTable
                ? () => {
                    const { table_schema, table_name } = selectionItems[selectionIdx].layer.table;
                    onManageTable(table_schema, table_name);
                  }
                : undefined}
              onEditGeometry={editMode
                ? () => enterGeomEdit(selectionItems[selectionIdx])
                : undefined}
              onDeleteFeature={editMode
                ? () => deleteFeature(selectionItems[selectionIdx])
                : undefined}
              onFieldEdited={editMode
                ? (field, oldValue, newValue, newCtid) => {
                    const it = selectionItems[selectionIdx];
                    if (!it) return;
                    const { connectionId, shareId, table } = it.layer;
                    const layerId = it.layer.id;
                    const ctidRef = { v: newCtid }; // mutable — updated after each revert/apply
                    onAddEditRef.current?.({
                      id: crypto.randomUUID(),
                      label: `Field edit on ${table.table_schema}.${table.table_name}`,
                      layerId,
                      revert: async () => {
                        const r = await fetch("/api/pg/feature-row", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: ctidRef.v, updates: { [field]: oldValue } }),
                        });
                        const d = await r.json();
                        if (d.ctid) ctidRef.v = d.ctid;
                        const l = layersRef.current.find(l => l.id === layerId);
                        onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
                      },
                      apply: async () => {
                        const r = await fetch("/api/pg/feature-row", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ connectionId, shareId, schema: table.table_schema, table: table.table_name, ctid: ctidRef.v, updates: { [field]: newValue } }),
                        });
                        const d = await r.json();
                        if (d.ctid) ctidRef.v = d.ctid;
                        const l = layersRef.current.find(l => l.id === layerId);
                        onUpdateLayerRef.current?.(layerId, { dataVersion: (l?.dataVersion ?? 0) + 1 });
                      },
                    });
                  }
                : undefined}
            />
          </div>
          {/* Resize handle — bottom-right corner */}
          <div
            onMouseDown={(e) => {
              panelResizeRef.current = { ox: e.clientX, oy: e.clientY, startW: panelWidth, startH: panelHeight };
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 group"
            title="Drag to resize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-0.5 right-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
              <circle cx="8" cy="8" r="1.2" fill="currentColor" />
              <circle cx="5" cy="8" r="1.2" fill="currentColor" />
              <circle cx="8" cy="5" r="1.2" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}

      {!hideZoom && (
        <div className="absolute bottom-8 right-2 z-10 pointer-events-none bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
          z{zoom.toFixed(1)}
        </div>
      )}

      {shareControls && (
        <div className="absolute z-10 flex items-start gap-1 top-[48px] left-2">
          {/* Zoom +/- */}
          <div className="flex flex-col shrink-0">
            <button title="Zoom in" onClick={() => mapRef.current?.getMap().zoomIn()}
              className="w-7 h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border border-b-0 rounded-t-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button title="Zoom out" onClick={() => mapRef.current?.getMap().zoomOut()}
              className="w-7 h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-b-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Geocoder + compass/home stacked below it */}
          <div className="flex flex-col gap-1">
            <GeocoderControl
              className="w-[min(14rem,calc(100vw-52px))] z-10"
              inputHeight="h-7"
              onSelect={(lng, lat, zoom) => mapRef.current?.getMap().flyTo({ center: [lng, lat], zoom })}
            />
            <div className="flex gap-1">
              <button title="Reset north" onClick={() => mapRef.current?.getMap().easeTo({ bearing: 0, pitch: 0, duration: 300 })}
                className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                <Navigation className="h-3 w-3 md:h-3.5 md:w-3.5" style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.2s" }} />
              </button>
              <button title="Home" onClick={() => {
                const iv = initialView ?? { longitude: -98.5556199, latitude: 39.8097343, zoom: 4 };
                mapRef.current?.getMap().flyTo({ center: [iv.longitude, iv.latitude], zoom: iv.zoom, bearing: 0, pitch: 0 });
              }}
                className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                <Home className="h-3 w-3 md:h-3.5 md:w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!shareControls && (
        <div className="absolute z-10 flex items-start gap-1 top-2 left-2">
          <div className="flex flex-col shrink-0">
            <button title="Zoom in" onClick={() => mapRef.current?.getMap().zoomIn()}
              className="w-7 h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border border-b-0 rounded-t-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button title="Zoom out" onClick={() => mapRef.current?.getMap().zoomOut()}
              className="w-7 h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-b-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {!hideGeocoder && (
              <GeocoderControl
                className="w-[min(14rem,calc(100vw-52px))] z-10"
                inputHeight="h-7"
                onSelect={(lng, lat, zoom) => mapRef.current?.getMap().flyTo({ center: [lng, lat], zoom })}
              />
            )}
            <div className="flex gap-1">
              <button title="Reset north" onClick={() => mapRef.current?.getMap().easeTo({ bearing: 0, pitch: 0, duration: 300 })}
                className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                <Navigation className="h-3 w-3 md:h-3.5 md:w-3.5" style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.2s" }} />
              </button>
              <button title="Home" onClick={() => {
                const iv = initialView ?? { longitude: -98.5556199, latitude: 39.8097343, zoom: 4 };
                mapRef.current?.getMap().flyTo({ center: [iv.longitude, iv.latitude], zoom: iv.zoom, bearing: 0, pitch: 0 });
              }}
                className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                <Home className="h-3 w-3 md:h-3.5 md:w-3.5" />
              </button>
              {editMode && layers.some(l => l.visible && l.table.geom_col) && !geomEditState && !addFeatureState && (
                <div className="relative">
                  <button
                    title="Add feature"
                    onClick={() => {
                      const eligible = layers.filter(l => l.visible && l.table.geom_col);
                      if (eligible.length === 1) { enterAddFeature(eligible[0]); }
                      else { setAddFeaturePickerOpen(v => !v); }
                    }}
                    className="h-6 md:h-7 flex items-center gap-1 px-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-xs font-medium backdrop-blur-sm shadow-sm"
                  >
                    <SquarePen className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    <span>Add feature</span>
                  </button>
                  {addFeaturePickerOpen && (
                    <div className="absolute top-full mt-1 left-0 z-30 bg-background border rounded-lg shadow-xl overflow-hidden w-52">
                      <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-b">Add feature to…</p>
                      {layers.filter(l => l.visible && l.table.geom_col).map(l => (
                        <button key={l.id} onClick={() => enterAddFeature(l)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors truncate">
                          {l.table.table_schema}.{l.table.table_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add feature — drawing bar */}
      {addFeatureState?.phase === "drawing" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
            <SquarePen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              {(() => {
                const gt = (addFeatureState.layer.table.geom_type ?? "").toLowerCase();
                if (gt.includes("point")) return "Click to place point";
                return "Click to add vertices, double-click or right-click to finish";
              })()}
              {" — "}
              <span className="text-foreground font-medium">
                {addFeatureState.layer.table.table_schema}.{addFeatureState.layer.table.table_name}
              </span>
            </span>
            {!(addFeatureState.layer.table.geom_type ?? "").toLowerCase().includes("point") && (
              <button
                onClick={addFeatureNextStep}
                disabled={["draw_line_string", "draw_polygon"].includes(mapboxDrawMode)}
                className="ml-1 text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addFeatureState.columns.length === 0 ? "Save" : "Next →"}
              </button>
            )}
            <button onClick={cancelAddFeature}
              className="text-xs text-muted-foreground hover:text-foreground rounded px-2 py-1 hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
          {addFeatureState.error && (
            <span className="text-[11px] text-destructive bg-background/90 px-2 py-0.5 rounded border border-destructive/30">
              {addFeatureState.error}
            </span>
          )}
        </div>
      )}

      {/* Add feature — attribute form panel */}
      {addFeatureState && (addFeatureState.phase === "attrs" || addFeatureState.phase === "saving") && addFeaturePanelPos && (
        <div
          className="absolute z-20 bg-background border rounded-lg shadow-xl overflow-hidden text-foreground w-[280px]"
          style={{ left: addFeaturePanelPos.x, top: addFeaturePanelPos.y }}
        >
          <div
            onMouseDown={(e) => {
              addFeatureDragRef.current = { ox: e.clientX, oy: e.clientY, px: addFeaturePanelPos.x, py: addFeaturePanelPos.y };
              e.preventDefault();
            }}
            className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40 cursor-grab active:cursor-grabbing select-none"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-medium flex-1 truncate">
              New feature — {addFeatureState.layer.table.table_schema}.{addFeatureState.layer.table.table_name}
            </span>
            <button onClick={cancelAddFeature}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {addFeatureState.columns.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-3">No attributes</p>
            ) : (
              <div className="divide-y">
                {addFeatureState.columns.map(col => {
                  const dt = col.dataType;
                  const inputType = /int|numeric|real|double|decimal|float/.test(dt) ? "number"
                    : dt === "date" ? "date"
                    : dt.includes("timestamp") ? "datetime-local"
                    : "text";
                  const isAuto = addFeatureState.autoAttrs.has(col.name);
                  return (
                    <div key={col.name} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[11px] text-muted-foreground w-24 shrink-0 truncate" title={col.name}>
                        {col.name.replace(/_/g, " ")}
                      </span>
                      {isAuto ? (
                        <span className="flex-1 text-[11px] text-muted-foreground italic">auto</span>
                      ) : (
                        <input
                          type={inputType}
                          value={addFeatureState.attrs[col.name] ?? ""}
                          placeholder="null"
                          onChange={e => setAddFeatureState(s => s ? { ...s, attrs: { ...s.attrs, [col.name]: e.target.value } } : null)}
                          className="flex-1 min-w-0 text-sm bg-transparent border-b border-border outline-none py-px font-mono focus:border-primary"
                        />
                      )}
                      {col.hasDefault && (
                        <button
                          title={isAuto ? "Enter value manually" : "Let database generate value"}
                          onClick={() => setAddFeatureState(s => {
                            if (!s) return null;
                            const next = new Set(s.autoAttrs);
                            if (isAuto) next.delete(col.name); else next.add(col.name);
                            return { ...s, autoAttrs: next };
                          })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0 ${isAuto ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary"}`}
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {addFeatureState.error && (
            <p className="text-[11px] text-destructive px-3 py-1.5 border-t break-words">{addFeatureState.error}</p>
          )}
          <div className="flex justify-end gap-2 px-3 py-2 border-t bg-muted/20">
            <button onClick={cancelAddFeature}
              className="text-xs text-muted-foreground hover:text-foreground rounded px-2 py-1 hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={() => saveNewFeature(addFeatureState.layer, addFeatureState.geometry, addFeatureState.columns, addFeatureState.attrs, addFeatureState.autoAttrs)}
              disabled={addFeatureState.phase === "saving"}
              className="text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {addFeatureState.phase === "saving" ? "Saving…" : "Add feature"}
            </button>
          </div>
        </div>
      )}

      {/* Geometry edit bar */}
      {geomEditState && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
            <PenLine className="h-3.5 w-3.5 text-primary shrink-0" />
            {(() => {
              const gt = (geomEditState.item.layer.table.geom_type ?? "").toLowerCase();
              const isPoint = gt.includes("point");
              let hint: string;
              if (geomEditState.loading) hint = "Loading geometry…";
              else if (isPoint) hint = geomEditState.pointPlaced ? "Point placed — click anywhere to replace" : "Click to place point";
              else if (geomEditState.extending === "end") hint = "Click map to add vertices at end · right-click to finish";
              else if (geomEditState.extending === "start") hint = "Click map to add vertices at start · right-click to finish";
              else if (selectedVertexGlobalIdx !== null) hint = "Click map to move vertex here · Delete to remove · click another vertex to switch · Esc to deselect";
              else if (gt.includes("polygon") || gt.includes("poly")) hint = "Click a vertex (✕) to select it · click a midpoint (+) to insert a vertex · Delete to remove";
              else hint = "Click a vertex (✕) to select it · click a midpoint (+) to insert · use green + handles to extend";
              return (
                <span className="text-xs text-muted-foreground">
                  {hint}
                  {" — "}
                  <span className="text-foreground font-medium">
                    {geomEditState.item.layer.table.table_schema}.{geomEditState.item.layer.table.table_name}
                  </span>
                </span>
              );
            })()}
            <button
              onClick={saveGeomEdit}
              disabled={geomEditState.saving || geomEditState.loading || !!geomEditState.extending || (mapboxDrawMode === "draw_point" && !geomEditState.pointPlaced)}
              className="ml-1 text-xs bg-primary text-primary-foreground rounded px-2.5 py-1 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {geomEditState.saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelGeomEdit}
              className="text-xs text-muted-foreground hover:text-foreground rounded px-2 py-1 hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
          {geomEditState.error && (
            <span className="text-[11px] text-destructive bg-background/90 px-2 py-0.5 rounded border border-destructive/30">
              {geomEditState.error}
            </span>
          )}
        </div>
      )}

      {/* Deselect button — shown when a feature is highlighted but no popup is open */}
      {selectionItems.length > 0 && !popupCoord && !geomEditState && !addFeatureState && (
        <button
          onClick={() => { setSelectionItems([]); setPopupCoord(null); }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 text-xs bg-background/95 backdrop-blur-sm border rounded-full px-3 py-1 shadow-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
          title="Deselect (Escape)"
        >
          <X className="h-3 w-3" /> Deselect
        </button>
      )}

      {/* Extend preview: dotted line from line endpoint to cursor */}
      {geomEditState?.extending && extendAnchorPos && editorMousePos && (
        <svg className="absolute inset-0 pointer-events-none z-[25] overflow-visible" style={{ width: "100%", height: "100%" }}>
          <line x1={extendAnchorPos.x} y1={extendAnchorPos.y} x2={editorMousePos.x} y2={editorMousePos.y}
            stroke="#3b82f6" strokeWidth="2" strokeDasharray="7,4" strokeOpacity="0.85" />
        </svg>
      )}

      {/* Vertex tool: dotted preview lines when a vertex is selected and mouse is moving */}
      {geomEditState && selectedVertexGlobalIdx !== null && editorMousePos && (() => {
        const sel = vertexPositions.find(v => v.globalIdx === selectedVertexGlobalIdx);
        if (!sel) return null;
        const gt = (geomEditState.item.layer.table.geom_type ?? "").toLowerCase();
        const neighbors = getNeighborPositions(sel, vertexPositions, gt);
        return (
          <svg className="absolute inset-0 pointer-events-none z-[25] overflow-visible" style={{ width: "100%", height: "100%" }}>
            {neighbors.map((nb, i) => (
              <line key={i} x1={nb.x} y1={nb.y} x2={editorMousePos.x} y2={editorMousePos.y}
                stroke="#3b82f6" strokeWidth="2" strokeDasharray="7,4" strokeOpacity="0.85" />
            ))}
          </svg>
        );
      })()}

      {/* Vertex tool: vertex markers — red × (amber when selected, QGIS style) */}
      {/* left/top are NOT in the React style — they are set directly via vertexEls refs     */}
      {/* so the DOM update is synchronous with the map frame and never lags during pan/zoom */}
      {geomEditState && !geomEditState.extending && vertexPositions.map(v => {
        const isSel = v.globalIdx === selectedVertexGlobalIdx;
        return (
          <div
            key={v.globalIdx}
            ref={el => {
              vertexEls.current[v.globalIdx] = el;
              if (el) {
                const pos = vertexScreenPos.current[v.globalIdx];
                if (pos) { el.style.left = pos.x + "px"; el.style.top = pos.y + "px"; }
              }
            }}
            style={{ position: "absolute", transform: "translate(-50%, -50%)", zIndex: 28 }}
            className={`w-4 h-4 flex items-center justify-center cursor-pointer transition-transform select-none hover:scale-125 font-bold text-sm leading-none drop-shadow ${isSel ? "scale-125 text-amber-400" : "text-red-500"}`}
            title={isSel ? "Selected — click map to move, Delete to remove, Esc to deselect" : "Click to select vertex"}
            onClick={(e) => { e.stopPropagation(); setSelectedVertexGlobalIdx(isSel ? null : v.globalIdx); }}
          >✕</div>
        );
      })}

      {/* Vertex tool: midpoint markers — small red + (only when no vertex selected) */}
      {geomEditState && !geomEditState.extending && selectedVertexGlobalIdx === null && midpointPositions.map((m, i) => (
        <div
          key={i}
          ref={el => {
            midpointEls.current[m.insertAfterGlobalIdx] = el;
            if (el) {
              const pos = midpointScreenPos.current[m.insertAfterGlobalIdx];
              if (pos) { el.style.left = pos.x + "px"; el.style.top = pos.y + "px"; }
            }
          }}
          style={{ position: "absolute", transform: "translate(-50%, -50%)", zIndex: 27 }}
          className="w-3 h-3 flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100 hover:scale-125 transition-all select-none text-red-500 font-bold text-xs leading-none drop-shadow"
          title="Click to insert vertex here"
          onClick={(e) => {
            e.stopPropagation();
            const draw = drawRef.current;
            if (!draw) return;
            const features = draw.getAll().features;
            if (!features.length) return;
            const f = features[0];
            const geom = f.geometry as any;
            const descs = flattenGeomVertices(geom);
            const newGeom = insertGeomVertex(geom, descs, m.insertAfterGlobalIdx, m.lngLat);
            const fId = f.id as string;
            draw.delete([fId]);
            draw.add({ type: "Feature", id: fId, geometry: newGeom, properties: {} } as any);
            try { draw.changeMode("simple_select"); } catch {};
            computeVertsRef.current?.();
            setSelectedVertexGlobalIdx(m.insertAfterGlobalIdx + 1); // select the newly inserted vertex
          }}>+</div>
      ))}

      {/* Extend handles — green "+" at line endpoints */}
      {extHandlePos && (["start", "end"] as const).map(dir => (
        <div
          key={dir}
          style={{ position: "absolute", left: extHandlePos[dir].x, top: extHandlePos[dir].y, transform: "translate(-50%, -50%)", zIndex: 30 }}
          className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold cursor-crosshair hover:scale-125 transition-transform select-none"
          title={dir === "start" ? "Click to extend line from start" : "Click to extend line from end"}
          onClick={() => startExtend(dir)}
        >+</div>
      ))}

    </>
  );
});

export default MaplibreMapInner;
