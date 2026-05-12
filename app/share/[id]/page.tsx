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
  const [basemap, setBasemap] = React.useState("streets");
  const [initialView, setInitialView] = React.useState<{ longitude: number; latitude: number; zoom: number } | undefined>(undefined);
  const [flyTo, setFlyTo] = React.useState<ZoomTarget | null>(null);
  const [status, setStatus] = React.useState<"loading" | "requires_password" | "expired" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [passwordInput, setPasswordInput] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");

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

  function applyConfig(config: any) {
    setBasemap(config.basemap ?? "streets");
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
  }

  React.useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401 && data.requires_password) { setStatus("requires_password"); return; }
        if (r.status === 410 || data.is_expired) { setStatus("expired"); setErrorMsg(data.error ?? "Link expired."); return; }
        if (!r.ok) throw new Error(data.error ?? "Failed to load share.");
        applyConfig(data);
      })
      .catch((e) => { setErrorMsg(e.message ?? "Unknown error"); setStatus("error"); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPassword() {
    setPasswordError("");
    try {
      const r = await fetch(`/api/share/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await r.json();
      if (r.status === 403) { setPasswordError("Incorrect password."); return; }
      if (!r.ok) throw new Error(data.error ?? "Failed to verify.");
      applyConfig(data);
    } catch (e: any) {
      setPasswordError(e.message ?? "Unknown error");
    }
  }

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

  if (status === "requires_password") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-full max-w-xs space-y-4 p-6 border rounded-lg bg-card shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium">Password required</p>
            <p className="text-xs text-muted-foreground">This map is password protected.</p>
          </div>
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
              className="w-full px-3 py-1.5 text-sm border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          </div>
          <button
            onClick={submitPassword}
            className="w-full px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-sm font-medium">Link expired</p>
          <p className="text-xs text-muted-foreground">This share link has expired and is no longer available.</p>
          <a href="/" className="text-xs text-muted-foreground underline underline-offset-2">Go to PostGIS Frontend</a>
        </div>
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
          className="hidden md:flex absolute bottom-10 right-2 z-20 w-7 h-7 items-center justify-center bg-background/95 backdrop-blur-sm border rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
