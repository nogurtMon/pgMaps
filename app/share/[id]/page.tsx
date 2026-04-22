"use client";
import React from "react";
import dynamic from "next/dynamic";
import { use } from "react";
import { DEFAULT_STYLE, migrateLayerControls } from "@/lib/types";
import type { MapLayer } from "@/lib/types";
import Link from "next/link";
import { ShareMapBar } from "@/components/share-map-bar";
import type { ZoomTarget } from "@/components/maplibre-map";
import { Maximize2, Minimize2 } from "lucide-react";

const MaplibreMap = dynamic(() => import("@/components/maplibre-map"), { ssr: false });

export default function ShareViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [layers, setLayers] = React.useState<MapLayer[]>([]);
  const [mapName, setMapName] = React.useState<string | undefined>(undefined);
  const [basemap, setBasemap] = React.useState("liberty");
  const [initialView, setInitialView] = React.useState<{ longitude: number; latitude: number; zoom: number } | undefined>(undefined);
  const [flyTo, setFlyTo] = React.useState<ZoomTarget | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState("");

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

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
          hideZoom
          shareControls
        />

        <ShareMapBar
          mapName={mapName}
          layers={layers}
          basemap={basemap}
          onSetBasemap={setBasemap}
          onUpdateLayer={updateLayer}
          onToggleVisible={(layerId) => updateLayer(layerId, { visible: !layers.find(l => l.id === layerId)?.visible })}
          onFlyTo={(bounds) => setFlyTo({ bounds })}
        />

        {/* Fullscreen toggle — desktop only (mobile browsers block iframe fullscreen) */}
        <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="hidden md:flex absolute bottom-10 right-2 z-20 w-9 h-9 items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
