"use client";
import React from "react";
import dynamic from "next/dynamic";
import { use } from "react";
import { DEFAULT_STYLE, migrateLayerControls } from "@/lib/types";
import type { MapLayer } from "@/lib/types";
import Link from "next/link";
import { BASEMAP_OPTIONS } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Layers } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { ViewerFiltersPanel } from "@/components/viewer-filters-panel";
import { AttributeTableDialog } from "@/components/attribute-table-dialog";
import type { ZoomTarget } from "@/components/maplibre-map";

const MaplibreMap = dynamic(() => import("@/components/maplibre-map"), { ssr: false });

export default function ShareViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [layers, setLayers] = React.useState<MapLayer[]>([]);
  const [mapName, setMapName] = React.useState<string | undefined>(undefined);
  const [basemap, setBasemap] = React.useState("liberty");
  const [initialView, setInitialView] = React.useState<{ longitude: number; latitude: number; zoom: number } | undefined>(undefined);
  const [flyTo, setFlyTo] = React.useState<ZoomTarget | null>(null);
  const [attrTableLayer, setAttrTableLayer] = React.useState<MapLayer | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState("");

  const [isEmbed, setIsEmbed] = React.useState(false);
  React.useEffect(() => {
    try { setIsEmbed(window.self !== window.top); } catch { setIsEmbed(true); }
  }, []);

  React.useEffect(() => {
    fetch(`/api/share/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Share link not found." : "Failed to load share.");
        return r.json();
      })
      .then((config) => {
        setBasemap(config.basemap ?? "liberty");
        setMapName(config.name);
        if (config.view) setInitialView(config.view);
        const loaded: MapLayer[] = (config.layers ?? []).map((l: any) => ({
          ...l,
          shareId: id,
          connectionId: "",
          dataVersion: 0,
          style: { ...DEFAULT_STYLE, ...l.style },
          controls: migrateLayerControls(l),
          filters: undefined,
        }));
        setLayers(loaded);
        setStatus("ready");
      })
      .catch((e) => {
        setErrorMsg(e.message ?? "Unknown error");
        setStatus("error");
      });
  }, [id]);

  function updateLayer(layerId: string, patch: Partial<MapLayer>) {
    setLayers((prev) => prev.map((l) => {
      if (l.id !== layerId) return l;
      const updated = { ...l, ...patch };
      if (patch.controls) updated.dataVersion = (l.dataVersion ?? 0) + 1;
      return updated;
    }));
  }

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading shared map…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-sm font-medium">{errorMsg}</p>
          <Link href="/" className="text-xs text-muted-foreground underline underline-offset-2">
            Go to PostGIS Frontend
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden">
      <div className="relative w-full h-full">
        <MaplibreMap
          layers={layers}
          basemap={basemap}
          initialView={initialView}
          flyTo={flyTo}
          hideLegend
          hideGeocoder
          hideZoom
        />

        {/* Map title — top center */}
        {mapName && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="bg-background/80 backdrop-blur-sm border rounded-md px-3 py-1 text-sm font-semibold shadow-sm">
              {mapName}
            </span>
          </div>
        )}

        {/* Basemap switcher + mode toggle — top right */}
        {!isEmbed && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 flex items-center justify-center rounded bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background transition-colors text-muted-foreground hover:text-foreground" title="Basemap">
                  <Layers className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BASEMAP_OPTIONS.map(({ key, label }) => (
                  <DropdownMenuItem key={key} onClick={() => setBasemap(key)} className={basemap === key ? "font-semibold" : ""}>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ModeToggle className="h-7 w-7 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background" />
          </div>
        )}

        {/* PostGIS Frontend logo — bottom left */}
        {!isEmbed && (
          <div className="absolute bottom-6 left-3 z-10">
            <Link href="/" className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border rounded-md px-2 py-1 shadow-sm hover:bg-background transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Postgresql_elephant.png" alt="" className="w-4 h-4 shrink-0" />
              <span className="font-bold tracking-widest text-primary uppercase text-[10px] font-mono">PostGIS Frontend</span>
            </Link>
          </div>
        )}
        <ViewerFiltersPanel
          layers={layers}
          onUpdateLayer={updateLayer}
          onToggleVisible={(layerId) => updateLayer(layerId, { visible: !layers.find(l => l.id === layerId)?.visible })}
          onFlyTo={(bounds) => setFlyTo({ bounds })}
          onOpenAttributeTable={setAttrTableLayer}
        />
      </div>
      {attrTableLayer && (
        <AttributeTableDialog
          open={!!attrTableLayer}
          onOpenChange={(v) => { if (!v) setAttrTableLayer(null); }}
          connectionId=""
          shareId={id}
          schema={attrTableLayer.table.table_schema}
          table={attrTableLayer.table.table_name}
          geomCol={attrTableLayer.table.geom_col}
          filters={attrTableLayer.controls}
          onFlyTo={(bounds) => { setFlyTo({ bounds }); setAttrTableLayer(null); }}
        />
      )}
    </div>
  );
}
