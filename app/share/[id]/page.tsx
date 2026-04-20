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
    <div className="h-[100dvh] overflow-hidden flex flex-col">
      {!isEmbed && (
        <header className="bg-background border-b px-3 flex items-center justify-between gap-2 text-[11px] font-mono shrink-0 min-h-[44px]">
          <Link href="/map" className="flex items-center gap-1.5 font-bold tracking-widest text-primary uppercase text-xs shrink-0 hover:opacity-80 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.ico" alt="" className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">PostGIS-Frontend</span>
          </Link>
          {mapName
            ? <span className="font-semibold text-sm truncate flex-1 text-center">{mapName}</span>
            : <span className="text-muted-foreground text-[10px] flex-1 text-center">shared view · {layers.length} {layers.length === 1 ? "layer" : "layers"}</span>
          }
          <div className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Basemap">
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
            <ModeToggle />
          </div>
        </header>
      )}
      <div className="flex-1 relative min-h-0">
        <MaplibreMap
          layers={layers}
          basemap={basemap}
          initialView={initialView}
          flyTo={flyTo}
          hideLegend
        />
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
          onFlyTo={(bounds) => { setFlyTo({ bounds }); setAttrTableLayer(null); }}
        />
      )}
    </div>
  );
}
