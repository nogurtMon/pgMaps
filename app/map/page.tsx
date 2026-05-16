"use client";
import React from "react";
import dynamic from "next/dynamic";
const MaplibreMap = dynamic(() => import("@/components/maplibre-map"), { ssr: false });
import { ConnectionsDialog } from "@/components/connections-dialog";
import { TableSidebar } from "@/components/table-sidebar";
import { useConnection } from "@/hooks/use-connection";
import { LAYER_COLORS, DEFAULT_STYLE, migrateLayerControls } from "@/lib/types";
import type { TableRow, MapLayer, LayerControl, UndoableOp } from "@/lib/types";
import type { ZoomTarget, MapView, MaplibreMapHandle } from "@/components/maplibre-map";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Bug, Lightbulb, ChevronDown, ArrowLeft, Share2, Pencil, Eye, Sun, Moon, SheetIcon, Home as HomeIcon, FilePlus, Undo2, FileText, X } from "lucide-react";
import { AttributeTablePanel } from "@/components/attribute-table-panel";
import { ShareDialog } from "@/components/share-dialog";
import { TableInfoDialog } from "@/components/table-info-dialog";
import { BasemapManagerDialog } from "@/components/basemap-manager-dialog";
import { MarkdownPanel } from "@/components/markdown-panel";
import { DEFAULT_BASEMAP, getBasemapColor, getBasemapLabel, type UserBasemap } from "@/lib/basemaps";
import { ImportTasksProvider } from "@/lib/import-tasks-context";
import { Toaster } from "@/components/toaster";
import { MapLegend } from "@/components/map-legend";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export default function Home() {
  const { connectionId, setConnectionId, clearConnection, loaded } = useConnection();
  const { theme, setTheme } = useTheme();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [editingConnectionId, setEditingConnectionId] = React.useState<string | undefined>(undefined);
  const [connectionsKey, setConnectionsKey] = React.useState(0);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [activeViewName, setActiveViewName] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState("");
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const mapRef = React.useRef<MaplibreMapHandle>(null);
  const [layers, setLayers] = React.useState<MapLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);
  const [zoomTarget, setZoomTarget] = React.useState<ZoomTarget | null>(null);
  const [basemap, setBasemap] = React.useState(DEFAULT_BASEMAP);
  const [basemapManagerOpen, setBasemapManagerOpen] = React.useState(false);
  const [userBasemaps, setUserBasemaps] = React.useState<UserBasemap[]>([]);

  async function fetchUserBasemaps() {
    try {
      const res = await fetch("/api/basemaps");
      if (res.ok) setUserBasemaps(await res.json());
    } catch {}
  }

  React.useEffect(() => { fetchUserBasemaps(); }, []);
  const [mapView, setMapView] = React.useState<MapView | undefined>(undefined);
  const [tablePanelOpen, setTablePanelOpen] = React.useState(false);
  const [tablePanelLayerId, setTablePanelLayerId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"editing" | "viewing">("editing");
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);
  const [shareId, setShareId] = React.useState<string | null>(null);
  const [tableInfoTarget, setTableInfoTarget] = React.useState<{ schema: string; table: string } | null>(null);
  const [goToCtid, setGoToCtid] = React.useState<string | undefined>(undefined);
  const [activateGoTo, setActivateGoTo] = React.useState(0);

  function handleSelectionChange(ctids: string[], layerId: string | null) {
    if (tablePanelOpen && layerId && ctids.length > 0) {
      const geoLayers = layers.filter(l => l.table.geom_col);
      if (geoLayers.some(l => l.id === layerId)) {
        setTablePanelLayerId(layerId);
        setGoToCtid(ctids[0]);
        setActivateGoTo(n => n + 1);
      }
    }
  }

  function handleShowInTable(layerId: string, ctid: string) {
    const geoLayers = layers.filter(l => l.table.geom_col);
    if (!geoLayers.some(l => l.id === layerId)) return;
    setTablePanelLayerId(layerId);
    setTablePanelOpen(true);
    setGoToCtid(ctid);
    // Delay so the layer-change fetchRows in the panel completes before navigateToCtid fires.
    setTimeout(() => setActivateGoTo(n => n + 1), 350);
  }
  const [markdown, setMarkdown] = React.useState("");
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [editHistory, setEditHistory] = React.useState<UndoableOp[]>([]);
  const [undoing, setUndoing] = React.useState(false);

  function addEdit(op: UndoableOp) {
    setEditHistory(h => [...h, op]);
  }

  async function undoLast() {
    if (undoing || editHistory.length === 0) return;
    setUndoing(true);
    const op = editHistory[editHistory.length - 1];
    try {
      await op.revert();
      setEditHistory(h => h.slice(0, -1));
    } catch (e: any) {
      console.error("[undo]", e.message);
    } finally {
      setUndoing(false);
    }
  }

  function commitAll() {
    setEditHistory([]);
  }

  // Ctrl+Z = undo
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoLast(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editHistory, undoing]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-load view if ?view= is present
  React.useEffect(() => {
    // Must read window.location inside the effect — useState initializer runs on
    // the server where window is undefined, so it can never be read up front.
    const viewId = new URLSearchParams(window.location.search).get("view");
    if (!viewId) return;
    fetch(`/api/pg/saved-views/${viewId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.view) return;
        const v = data.view;
        setLayers(
          (v.state_json.layers ?? []).map((l: any) => ({
            ...l,
            id: crypto.randomUUID(),
            connectionId: l.connectionId ?? v.connection_id,
            dataVersion: 0,
            controls: migrateLayerControls(l),
            filters: undefined,
          }))
        );
        setBasemap(v.state_json.basemap ?? "liberty");
        if (v.state_json.markdown) setMarkdown(v.state_json.markdown);
        if (v.state_json.view) {
          setZoomTarget({ center: [v.state_json.view.longitude, v.state_json.view.latitude], zoom: v.state_json.view.zoom });
        }
        setActiveViewName(v.name ?? null);
        setActiveViewId(viewId);
        if (v.is_public) setShareId(viewId);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open connections dialog on first load if no connection is configured
  React.useEffect(() => {
    if (loaded && !connectionId) setSettingsOpen(true);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear layers on disconnect
  React.useEffect(() => {
    if (loaded && !connectionId) setLayers([]);
  }, [connectionId, loaded]);


  // Autosave — create immediately on first layer, debounce subsequent updates
  const activeViewIdRef = React.useRef<string | null>(null);
  const creatingRef = React.useRef(false);
  React.useEffect(() => { activeViewIdRef.current = activeViewId; }, [activeViewId]);
  const mapViewRef = React.useRef(mapView);
  React.useEffect(() => { mapViewRef.current = mapView; }, [mapView]);

  function buildState() {
    const v = mapViewRef.current;
    return {
      layers,
      basemap,
      markdown: markdown || undefined,
      view: v ? { longitude: v.longitude, latitude: v.latitude, zoom: v.zoom } : undefined,
    };
  }

  React.useEffect(() => {
    if (!loaded || !connectionId || layers.length === 0) return;
    const currentId = activeViewIdRef.current;

    // No saved view yet — create one immediately (no debounce)
    if (!currentId) {
      if (creatingRef.current) return;
      creatingRef.current = true;
      const id = crypto.randomUUID();
      fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, id, name: "Untitled map", state: buildState() }),
      }).then(res => {
        if (res.ok) {
          setActiveViewId(id);
          activeViewIdRef.current = id;
          window.history.replaceState(null, "", `/map?view=${id}`);
        }
        creatingRef.current = false;
      });
      return;
    }

    // Existing view — debounced update
    const t = setTimeout(() => {
      fetch(`/api/pg/saved-views/${currentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: buildState() }),
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [layers, basemap, connectionId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps


  function addLayer(table: TableRow, connId?: string) {
    const key = `${table.table_schema}.${table.table_name}`;
    if (layers.some((l) => `${l.table.table_schema}.${l.table.table_name}` === key)) return;
    const color = LAYER_COLORS[layers.length % LAYER_COLORS.length];
    const geomType = (table.geom_type ?? "").toLowerCase();
    const isLine = geomType.includes("linestring") || geomType.includes("multiline");
    const strokeColor = isLine ? color : "#ffffff";
    const defaultControls: LayerControl[] = [
      ...(!isLine ? [{ id: crypto.randomUUID(), type: "fill" as const, enabled: true, shared: false, color, opacity: 0.85 }] : []),
      { id: crypto.randomUUID(), type: "stroke" as const, enabled: true, shared: false, color: strokeColor, opacity: 1, width: isLine ? 2 : 1 },
    ];
    setLayers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        table,
        connectionId: connId ?? connectionId,
        visible: true,
        style: {
          ...DEFAULT_STYLE,
          color,
          strokeColor,
          lineWidth: isLine ? 2 : 1,
        },
        controls: defaultControls,
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
      if (patch.controls) {
        updated.dataVersion = (l.dataVersion ?? 0) + 1;
        // Keep style.color / style.strokeColor in sync with the primary fill/stroke controls
        // so that GeomSwatches and other display code reading style get the correct value.
        const controls = updated.controls as LayerControl[];
        const fillCtrl = controls.find(c => c.type === "fill") as Extract<LayerControl, { type: "fill" }> | undefined;
        const strokeCtrl = controls.find(c => c.type === "stroke") as Extract<LayerControl, { type: "stroke" }> | undefined;
        const geomType = (l.geomTypeOverride || l.table?.geom_type || "").toLowerCase();
        const isLine = geomType.includes("linestring") || geomType.includes("line");
        if (fillCtrl) updated.style = { ...updated.style, color: fillCtrl.color };
        if (strokeCtrl) {
          updated.style = { ...updated.style, strokeColor: strokeCtrl.color };
          // For lines, the stroke control IS the line color (no fill control exists)
          if (isLine) updated.style = { ...updated.style, color: strokeCtrl.color };
        }
      }
      return updated;
    }));
  }

  function reorderLayers(newOrder: string[]) {
    setLayers((prev) => newOrder.map((id) => prev.find((l) => l.id === id)!).filter(Boolean));
  }

  return (
    <ImportTasksProvider>
    <Toaster />
    <div className="h-screen overflow-hidden grid grid-rows-[auto_1fr]">
      <header className="bg-background border-b px-3 py-1.5 flex items-center gap-3 shrink-0">
        {/* Elephant logo — dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <button className="shrink-0 flex items-center gap-0.5 rounded-md p-1 hover:bg-muted transition-colors" title="Menu">
              <img src="/Postgresql_elephant.png" alt="PostGIS" className="w-6 h-6" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild>
              <a href="/maps" className="flex items-center gap-2">
                <HomeIcon className="h-3.5 w-3.5" /> Home
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/map" className="flex items-center gap-2">
                <FilePlus className="h-3.5 w-3.5" /> New map
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex items-center gap-2">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend/issues/new?template=feature_request.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5" /> Request a feature
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend/issues/new?template=bug_report.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Bug className="h-3.5 w-3.5" /> Report a bug
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                Visit GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Map name — click to rename */}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => { const t = nameInput.trim(); if (t) { setActiveViewName(t); if (activeViewIdRef.current) fetch(`/api/pg/saved-views/${activeViewIdRef.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: t }) }); } setEditingName(false); }}
            onKeyDown={e => {
              if (e.key === "Enter") { const t = nameInput.trim(); if (t) { setActiveViewName(t); if (activeViewIdRef.current) fetch(`/api/pg/saved-views/${activeViewIdRef.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: t }) }); } setEditingName(false); }
              if (e.key === "Escape") setEditingName(false);
            }}
            className="flex-1 min-w-0 text-base font-semibold bg-transparent border-b border-primary outline-none"
            autoFocus
          />
        ) : (
          <button
            className="flex-1 min-w-0 text-left group"
            onClick={() => { setNameInput(activeViewName ?? ""); setEditingName(true); }}
            title="Click to rename"
          >
            {activeViewName
              ? <span className="text-base font-semibold truncate block group-hover:text-primary transition-colors">{activeViewName}</span>
              : <span className="text-base font-semibold text-muted-foreground block group-hover:text-foreground transition-colors">Untitled map</span>
            }
          </button>
        )}

        {/* Commit bar — shown when there are unsaved edits */}
        {editHistory.length > 0 && viewMode === "editing" && (
          <div className="flex items-center gap-1.5 shrink-0 border rounded-md px-2 py-1 bg-muted/40">
            <span className="text-xs text-muted-foreground">
              {editHistory.length} unsaved change{editHistory.length !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground/30 select-none">·</span>
            <button
              onClick={undoLast}
              disabled={undoing || editHistory.length === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-50 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3 w-3" /> Undo
            </button>
            <button
              onClick={commitAll}
              className="text-xs bg-primary text-primary-foreground rounded px-2 py-0.5 hover:bg-primary/90 transition-colors"
            >
              Commit
            </button>
          </div>
        )}

        {/* Right controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Basemap selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 rounded-md border px-2 text-xs hover:bg-muted transition-colors shrink-0 flex items-center gap-1.5"
                title="Basemap"
              >
                <div className="w-3.5 h-3.5 rounded-sm border shrink-0" style={{ background: getBasemapColor(basemap) }} />
                <span>{getBasemapLabel(basemap, userBasemaps)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {userBasemaps.map(({ id, name }) => (
                <DropdownMenuItem key={id} onClick={() => setBasemap(id)} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm border shrink-0" style={{ background: getBasemapColor(id) }} />
                  <span className="text-xs truncate">{name}</span>
                  {basemap === id && <span className="ml-auto text-primary text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setBasemapManagerOpen(true)} className="text-xs text-muted-foreground">
                Manage basemaps…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon" variant={tablePanelOpen ? "default" : "outline"} className="h-7 w-7"
            title="Attribute table"
            onClick={() => {
              const geoLayers = layers.filter(l => l.table.geom_col);
              if (geoLayers.length === 0) return;
              const id = tablePanelLayerId && geoLayers.some(l => l.id === tablePanelLayerId)
                ? tablePanelLayerId
                : (activeLayerId && geoLayers.some(l => l.id === activeLayerId) ? activeLayerId : geoLayers[0].id);
              setTablePanelLayerId(id);
              setTablePanelOpen(v => !v);
            }}
          >
            <SheetIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm" variant={notesOpen ? "default" : "outline"}
            className="h-7 px-2 text-xs gap-1.5"
            title="Write a description for this map"
            onClick={() => setNotesOpen(v => !v)}
          >
            <FileText className="h-3.5 w-3.5" />
            Description
          </Button>
          {/* Editing / Viewing dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border h-7 px-2.5 text-xs hover:bg-muted transition-colors shrink-0">
                {viewMode === "editing" ? <Pencil className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                {viewMode === "editing" ? "Editing" : "Viewing"}
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setViewMode("editing")} className="flex items-center gap-2 text-xs">
                <Pencil className="h-3 w-3" /> Editing
                {viewMode === "editing" && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setViewMode("viewing"); setTablePanelOpen(false); }} className="flex items-center gap-2 text-xs">
                <Eye className="h-3 w-3" /> Viewing
                {viewMode === "viewing" && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3 w-3" /> Share
          </Button>
        </div>
      </header>

      <div className="flex overflow-hidden">
        {viewMode === "editing" && <TableSidebar
          connectionId={connectionId}
          connectionLoaded={loaded}
          connectionsKey={connectionsKey}
          layers={layers}
          onAddLayer={addLayer}
          onRemoveLayer={removeLayer}
          onUpdateLayer={updateLayer}
          onReorderLayers={reorderLayers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={setActiveLayerId}
          onZoomToLayer={zoomToLayer}
          onFlyTo={(bounds) => setZoomTarget({ bounds })}
          onOpenSettings={() => { setEditingConnectionId(undefined); setSettingsOpen(true); }}
          onEditConnection={(id) => { setEditingConnectionId(id); setSettingsOpen(true); }}
          onConnectionLost={() => { clearConnection(); }}
        />}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 relative min-h-0">
            <MaplibreMap
              ref={mapRef}
              layers={layers}
              onUpdateLayer={updateLayer}
              flyTo={zoomTarget}
              basemap={basemap}
              userBasemaps={userBasemaps}
              onViewChange={setMapView}
              editMode={viewMode === "editing"}
              onManageTable={(schema, table) => setTableInfoTarget({ schema, table })}
              onSelectionChange={handleSelectionChange}
              onShowInTable={handleShowInTable}
              onAddEdit={addEdit}
              tablePanelOpen={tablePanelOpen}
            />
            <MapLegend
              layers={layers}
              onToggleVisible={id => updateLayer(id, { visible: !layers.find(l => l.id === id)?.visible })}
            />
          </div>
          {tablePanelOpen && tablePanelLayerId && layers.filter(l => l.table.geom_col).length > 0 && (
            <AttributeTablePanel
              layers={layers.filter(l => l.table.geom_col)}
              activeLayerId={tablePanelLayerId}
              onLayerChange={setTablePanelLayerId}
              onClose={() => setTablePanelOpen(false)}
              connectionId={connectionId}
              onFlyTo={(bounds) => setZoomTarget({ bounds })}
              onUpdateLayer={updateLayer}
              mapBounds={mapView?.bounds}
              editMode={viewMode === "editing"}
              onEdit={addEdit}
              onEditGeometry={ctid => mapRef.current?.editGeometry(tablePanelLayerId!, ctid)}
              onAddFeature={() => mapRef.current?.addFeature(tablePanelLayerId!)}
              goToCtid={goToCtid}
              activateGoTo={activateGoTo}
            />
          )}
        </div>
        {notesOpen && (
          <MarkdownPanel
            value={markdown}
            onChange={setMarkdown}
            onClose={() => setNotesOpen(false)}
            readOnly={viewMode === "viewing"}
          />
        )}
      </div>

      <BasemapManagerDialog
        open={basemapManagerOpen}
        onOpenChange={setBasemapManagerOpen}
        onChange={fetchUserBasemaps}
      />
      <ConnectionsDialog
        open={settingsOpen}
        onOpenChange={(v) => { setSettingsOpen(v); if (!v) { setConnectionsKey((k) => k + 1); setEditingConnectionId(undefined); } }}
        activeConnectionId={connectionId}
        onSelect={(id) => { setConnectionId(id); }}
        initialEditId={editingConnectionId}
      />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        layers={layers}
        basemap={basemap}
        view={mapView}
        mapName={activeViewName}
        markdown={markdown}
        activeViewId={activeViewId}
        shareId={shareId}
        onShareIdChange={setShareId}
      />
      {tableInfoTarget && (
        <TableInfoDialog
          open={!!tableInfoTarget}
          onOpenChange={v => { if (!v) setTableInfoTarget(null); }}
          connectionId={connectionId}
          schema={tableInfoTarget.schema}
          table={tableInfoTarget.table}
          onChanged={() => {}}
        />
      )}
    </div>
    </ImportTasksProvider>
  );
}
