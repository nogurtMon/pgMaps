"use client";
import React from "react";
import dynamic from "next/dynamic";
const MaplibreMap = dynamic(() => import("@/components/maplibre-map"), { ssr: false });
import { ConnectionsDialog } from "@/components/connections-dialog";
import { TableSidebar } from "@/components/table-sidebar";
import { useConnection } from "@/hooks/use-connection";
import { LAYER_COLORS, DEFAULT_STYLE, migrateLayerControls } from "@/lib/types";
import type { TableRow, MapLayer } from "@/lib/types";
import type { ZoomTarget, MapView } from "@/components/maplibre-map";

import { Button } from "@/components/ui/button";
import { Map, Database, Github, Bug } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { SavedViewsDialog } from "@/components/saved-views-dialog";
import { BASEMAP_OPTIONS } from "@/lib/types";
import { ImportTasksProvider } from "@/lib/import-tasks-context";
import { Toaster } from "@/components/toaster";

const LAYERS_KEY = "postgis-layers";
const CONN_LS_KEY = "pg_connection_id";

function loadLayers(connectionId: string): MapLayer[] {
  try {
    const all = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? "{}");
    return (all[connectionId] ?? []).map((l: any) => ({
      ...l,
      dataVersion: 0,
      controls: migrateLayerControls(l),
      filters: undefined,
    }));
  } catch { return []; }
}

function saveLayers(connectionId: string, layers: MapLayer[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? "{}");
    all[connectionId] = layers;
    localStorage.setItem(LAYERS_KEY, JSON.stringify(all));
  } catch {}
}

export default function Home() {
  const { connectionId, setConnectionId, clearConnection, loaded } = useConnection();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [activeViewName, setActiveViewName] = React.useState<string | null>(null);
  const [layers, setLayers] = React.useState<MapLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);
  const [zoomTarget, setZoomTarget] = React.useState<ZoomTarget | null>(null);
  const [basemap, setBasemap] = React.useState("liberty");
  const [mapView, setMapView] = React.useState<MapView | undefined>(undefined);

  async function zoomToLayer(layer: MapLayer) {
    try {
      const res = await fetch("/api/pg/extent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: layer.connectionId,
          shareId: layer.shareId,
          schema: layer.table.table_schema,
          table: layer.table.table_name,
          geomCol: layer.table.geom_col,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setZoomTarget({ bounds: [[data.xmin, data.ymin], [data.xmax, data.ymax]] });
    } catch {}
  }

  // Load layers once on mount
  React.useEffect(() => {
    const storedId = localStorage.getItem(CONN_LS_KEY) ?? "";
    if (storedId) setLayers(loadLayers(storedId));
  }, []);

  // Auto-open connections dialog on first load if no connection is configured
  React.useEffect(() => {
    if (loaded && !connectionId) setSettingsOpen(true);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear layers on disconnect
  React.useEffect(() => {
    if (loaded && !connectionId) setLayers([]);
  }, [connectionId, loaded]);

  // Persist layers whenever they change
  React.useEffect(() => {
    if (!loaded || !connectionId) return;
    const t = setTimeout(() => saveLayers(connectionId, layers), 500);
    return () => clearTimeout(t);
  }, [layers, loaded, connectionId]);

  function addLayer(table: TableRow) {
    const key = `${table.table_schema}.${table.table_name}`;
    if (layers.some((l) => `${l.table.table_schema}.${l.table.table_name}` === key)) return;
    const color = LAYER_COLORS[layers.length % LAYER_COLORS.length];
    const geomType = (table.geom_type ?? "").toLowerCase();
    const isLine = geomType.includes("linestring") || geomType.includes("multiline");
    setLayers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        table,
        connectionId,
        visible: true,
        style: {
          ...DEFAULT_STYLE,
          color,
          strokeColor: isLine ? color : "#ffffff",
          lineWidth: isLine ? 2 : 1,
        },
        controls: [],
      },
    ]);
  }

  function removeLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLayer(id: string, patch: Partial<MapLayer>) {
    setLayers((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, ...patch };
      if (patch.controls) updated.dataVersion = (l.dataVersion ?? 0) + 1;
      return updated;
    }));
  }

  function onLayerDataChanged(id: string) {
    setLayers((prev) =>
      prev.map((l) => l.id === id ? { ...l, dataVersion: (l.dataVersion ?? 0) + 1 } : l)
    );
  }

  function reorderLayers(newOrder: string[]) {
    setLayers((prev) => newOrder.map((id) => prev.find((l) => l.id === id)!).filter(Boolean));
  }

  return (
    <ImportTasksProvider>
    <Toaster />
    <div className="h-screen overflow-hidden grid grid-rows-[auto_1fr]">
      <header className="bg-background border-b px-3 py-1 flex items-center gap-3 text-[11px] font-mono shrink-0">
        <span className="flex items-center gap-1.5 font-bold tracking-widest text-primary uppercase text-xs shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.ico" alt="" className="w-4 h-4 shrink-0" />
          PostGIS-Frontend
        </span>

        <button
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 group"
          onClick={() => setShareOpen(true)}
          title="Map views"
        >
          {activeViewName
            ? <span className="text-sm font-semibold truncate max-w-sm group-hover:text-primary transition-colors">{activeViewName}</span>
            : <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Untitled map</span>
          }
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <ModeToggle />
          <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="Report a bug">
            <a href="https://github.com/nogurtMon/postgis-frontend/issues/new?template=bug_report.md" target="_blank" rel="noopener noreferrer">
              <Bug className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="View on GitHub">
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer">
              <Github className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 relative" onClick={() => setSettingsOpen(true)} title="Database connections">
            <Database className="h-3.5 w-3.5" />
            <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background ${!loaded ? "bg-muted-foreground/40" : connectionId ? "bg-green-500" : "bg-red-500"}`} />
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={() => setShareOpen(true)}>
            <Map className="h-3 w-3" /> Maps
          </Button>
        </div>
      </header>

      <div className="flex overflow-hidden">
        <TableSidebar
          connectionId={connectionId}
          connectionLoaded={loaded}
          layers={layers}
          onAddLayer={addLayer}
          onRemoveLayer={removeLayer}
          onUpdateLayer={updateLayer}
          onReorderLayers={reorderLayers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={setActiveLayerId}
          onZoomToLayer={zoomToLayer}
          onFlyTo={(bounds) => setZoomTarget({ bounds })}
          onOpenSettings={() => setSettingsOpen(true)}
          onConnectionLost={() => { clearConnection(); setLayers([]); }}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
        <div className="flex-1 relative">
          <MaplibreMap
            layers={layers}
            onUpdateLayer={updateLayer}
            flyTo={zoomTarget}
            basemap={basemap}
            onViewChange={setMapView}
          />
          <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm border rounded-md px-1.5 py-1 shadow-sm">
            {BASEMAP_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setBasemap(key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  basemap === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ConnectionsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        activeConnectionId={connectionId}
        onSelect={(id) => {
          if (id !== connectionId) {
            setConnectionId(id);
            setLayers(id ? loadLayers(id) : []);
            setActiveViewName(null);
          }
        }}
      />
      <SavedViewsDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        connectionId={connectionId}
        layers={layers}
        basemap={basemap}
        view={mapView}
        activeViewName={activeViewName}
        onActiveViewNameChange={setActiveViewName}
        onLoad={(state, name) => {
          setLayers(state.layers.map((l: any) => ({
            ...l,
            id: crypto.randomUUID(),
            connectionId,
            dataVersion: 0,
            controls: migrateLayerControls(l),
            filters: undefined,
          })));
          setBasemap(state.basemap ?? "liberty");
          if (state.view) setZoomTarget({ center: [state.view.longitude, state.view.latitude], zoom: state.view.zoom });
          setActiveViewName(name ?? state.name ?? null);
        }}
      />
    </div>
    </ImportTasksProvider>
  );
}
