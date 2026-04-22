"use client";
import React from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MVTLayer } from "@deck.gl/geo-layers";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GeocoderControl } from "@/components/geocoder-control";
import { MapLegend } from "@/components/map-legend";
import type { MapLayer, LayerControl } from "@/lib/types";
import { Plus, Minus, Navigation, Home, Maximize2, Minimize2 } from "lucide-react";

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
  return `/api/pg/tiles/{z}/{x}/{y}?${params.toString()}`;
}

// ─── basemap definitions ──────────────────────────────────────────────────────
const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri-satellite", type: "raster" as const, source: "esri-satellite" }],
};

const BASEMAPS: Record<string, string | typeof SATELLITE_STYLE> = {
  liberty:   "https://tiles.openfreemap.org/styles/liberty",
  bright:    "https://tiles.openfreemap.org/styles/bright",
  positron:  "https://tiles.openfreemap.org/styles/positron",
  satellite: SATELLITE_STYLE,
};

const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
export type ZoomTarget =
  | { bounds: [[number, number], [number, number]] }
  | { center: [number, number]; zoom: number };
export interface MapView { longitude: number; latitude: number; zoom: number; }

interface Props {
  layers: MapLayer[];
  onUpdateLayer?: (id: string, patch: Partial<MapLayer>) => void;
  shareControls?: boolean;
  flyTo?: ZoomTarget | null;
  basemap?: string;
  initialView?: MapView;
  onViewChange?: (view: MapView) => void;
  hideLegend?: boolean;
  hideGeocoder?: boolean;
  hideZoom?: boolean;
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
  return <span className="text-sm break-words whitespace-normal" title={value}>{value}</span>;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function MaplibreMap({ layers, flyTo, basemap = "", initialView, onViewChange, onUpdateLayer, hideLegend, hideGeocoder, hideZoom, shareControls }: Props) {
  const mapRef = React.useRef<any>(null);
  const overlay = React.useMemo(() => new MapboxOverlay({ interleaved: false }), []);

  const [selectionItems, setSelectionItems] = React.useState<SelectionItem[]>([]);
  const [selectionIdx, setSelectionIdx] = React.useState(0);
  const [isPropsOpen, setIsPropsOpen] = React.useState(false);
  const [zoom, setZoom] = React.useState(4);
  const [bearing, setBearing] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

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
        if (!c.enabled) continue;
        if (c.type === "fill") { fillCtrl = c; }
        else if (c.type === "stroke") { strokeCtrl = c; }
        else if (c.type === "categorical") {
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
      const fillAlpha  = Math.round((fillCtrl?.opacity ?? layer.style.opacity) * 255);
      const strokeAlpha = Math.round((strokeCtrl?.opacity ?? layer.style.strokeOpacity ?? 1) * 255);
      const staticFill: [number,number,number,number]   = [...fillRgb,   fillAlpha];
      const staticStroke: [number,number,number,number] = [...strokeRgb, strokeAlpha];

      return new MVTLayer({
        id: `layer-${layer.id}`,
        data: buildTileUrl(layer),
        minZoom: 0,
        maxZoom: 14,
        refinementStrategy: "best-available",
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
              return [...hexToRgb(v >= threshFill!.threshold ? threshFill!.aboveColor : threshFill!.belowColor), fillAlpha] as [number,number,number,number];
            }
          : catFill
          ? (d: any) => {
              const rule = catFill!.rules.find(r => r.value === String(d.properties?.[catFill!.column] ?? ""));
              return [...hexToRgb(rule ? rule.color : catFill!.defaultColor), fillAlpha] as [number,number,number,number];
            }
          : numOpacity
          ? (d: any) => [...fillRgb, Math.round(lerp(Number(d.properties?.[numOpacity!.column] ?? 0), numOpacity!.min, numOpacity!.max, numOpacity!.minOutput, numOpacity!.maxOutput) * 255)] as [number,number,number,number]
          : staticFill,

        getLineColor: threshStroke
          ? (d: any) => {
              const v = Number(d.properties?.[threshStroke!.column] ?? 0);
              return [...hexToRgb(v >= threshStroke!.threshold ? threshStroke!.aboveColor : threshStroke!.belowColor), strokeAlpha] as [number,number,number,number];
            }
          : catStroke
          ? (d: any) => {
              const rule = catStroke!.rules.find(r => r.value === String(d.properties?.[catStroke!.column] ?? ""));
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
          if (!info.object) return;
          const picks: any[] = (overlay as any).pickMultipleObjects?.({ x: info.x, y: info.y, radius: 1, depth: 50 }) ?? [info];
          const items = (picks.length > 0 ? picks : [info])
            .filter((p: any) => p.object)
            .map((p: any) => {
              const ml = layers.find(l => l.id === (p.layer?.id ?? "").replace(/^layer-/, ""));
              return ml ? { feature: p.object, layer: ml } : null;
            })
            .filter(Boolean) as SelectionItem[];
          if (items.length === 0) return;
          setSelectionItems(sortByDatetime(items));
          setSelectionIdx(0);
          setIsPropsOpen(true);
        },
      });
    }),
  [layers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── mount overlay on map load ────────────────────────────────────────────
  const onLoad = React.useCallback(() => {
    mapRef.current?.getMap()?.addControl(overlay);
  }, [overlay]);

  // ─── sync deck layers to overlay ─────────────────────────────────────────
  React.useEffect(() => {
    overlay.setProps({
      layers: deckLayers,
      getCursor: ({ isHovering }: { isHovering: boolean }) => isHovering ? "pointer" : "",
      onHover: (info: any) => {
        const canvas = mapRef.current?.getMap()?.getCanvas();
        if (canvas) canvas.style.cursor = info.object ? "pointer" : "";
      },
    });
  }, [overlay, deckLayers]); // eslint-disable-line react-hooks/exhaustive-deps

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
        onMoveEnd={(e) => onViewChange?.({ longitude: e.viewState.longitude, latitude: e.viewState.latitude, zoom: e.viewState.zoom })}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={{ compact: true, customAttribution: "" }}
      />

      {!hideZoom && (
        <div className="absolute bottom-8 right-2 z-10 pointer-events-none bg-black/50 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          z{zoom.toFixed(1)}
        </div>
      )}

      {!hideGeocoder && !shareControls && (
        <GeocoderControl
          onSelect={(lng, lat, zoom) => {
            mapRef.current?.getMap().flyTo({ center: [lng, lat], zoom });
          }}
        />
      )}

      {shareControls && (
        <div className="absolute z-10 flex items-start gap-1 md:gap-1.5 top-[52px] left-2">
          {/* Zoom +/- */}
          <div className="flex flex-col shrink-0">
            <button title="Zoom in" onClick={() => mapRef.current?.getMap().zoomIn()}
              className="w-7 h-7 md:w-10 md:h-10 flex items-center justify-center bg-background/95 backdrop-blur-sm border border-b-0 rounded-t-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5 md:h-5 md:w-5" />
            </button>
            <button title="Zoom out" onClick={() => mapRef.current?.getMap().zoomOut()}
              className="w-7 h-7 md:w-10 md:h-10 flex items-center justify-center bg-background/95 backdrop-blur-sm border rounded-b-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
              <Minus className="h-3.5 w-3.5 md:h-5 md:w-5" />
            </button>
          </div>

          {/* Geocoder + compass/home stacked below it */}
          <div className="flex flex-col gap-1">
            <GeocoderControl
              className="w-[min(14rem,calc(100vw-52px))] md:w-[min(16rem,calc(100vw-88px))] z-10"
              inputHeight="h-7 md:h-10"
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

      {!hideLegend && (
        <MapLegend
          layers={layers}
          onToggleVisible={onUpdateLayer ? (id) => onUpdateLayer(id, { visible: !layers.find(l => l.id === id)?.visible }) : undefined}
        />
      )}

      <Dialog open={isPropsOpen} onOpenChange={setIsPropsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Feature Properties</span>
              {selectionItems.length > 1 && (
                <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <button onClick={() => setSelectionIdx(i => Math.max(0, i - 1))} disabled={selectionIdx === 0}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors" aria-label="Previous feature">‹</button>
                  <span className="tabular-nums">{selectionIdx + 1} / {selectionItems.length}</span>
                  <button onClick={() => setSelectionIdx(i => Math.min(selectionItems.length - 1, i + 1))} disabled={selectionIdx === selectionItems.length - 1}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors" aria-label="Next feature">›</button>
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectionItems[selectionIdx]
                ? `${selectionItems[selectionIdx].layer.table.table_schema}.${selectionItems[selectionIdx].layer.table.table_name}`
                : "Attributes for the selected feature"}
            </DialogDescription>
          </DialogHeader>
          {selectionItems[selectionIdx] && (
            <ScrollArea className="max-h-[50vh] mt-2">
              <div className="space-y-0">
                {Object.entries(selectionItems[selectionIdx].feature.properties || {}).map(([key, value]) => (
                  <div key={key} className="py-2 border-b last:border-0">
                    <span className="text-xs font-medium capitalize text-muted-foreground block" title={key}>{key.replace(/_/g, " ")}</span>
                    <PropValue value={String(value)} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
