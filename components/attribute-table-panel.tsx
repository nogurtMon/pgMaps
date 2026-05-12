"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Search, X, Loader2, Filter, Columns, Plus, Locate, Trash2, Pencil } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { AttrOperator, AttrFilter, LayerControl, MapLayer, UndoableOp } from "@/lib/types";

const OPERATOR_LABELS: Record<AttrOperator, string> = {
  ilike: "contains", eq: "equals", neq: "not equals",
  gt: "greater than", lt: "less than", gte: "≥", lte: "≤",
  is_null: "is null", is_not_null: "is not null",
  starts_with: "starts with", in: "in", not_in: "not in",
  date_between: "between dates",
};
const ALL_OPERATORS = Object.keys(OPERATOR_LABELS) as AttrOperator[];
const NULL_OPERATORS: AttrOperator[] = ["is_null", "is_not_null"];

interface ColumnMeta { name: string; dataType: string; isGeom: boolean; }

interface Props {
  layers: MapLayer[];
  activeLayerId: string;
  onLayerChange: (id: string) => void;
  onClose: () => void;
  connectionId: string;
  onFlyTo?: (bounds: [[number, number], [number, number]]) => void;
  onUpdateLayer?: (id: string, patch: Partial<MapLayer>) => void;
  mapBounds?: [number, number, number, number];
  editMode?: boolean;
  onEdit?: (op: UndoableOp) => void;
  onEditGeometry?: (ctid: string) => void;
  onAddFeature?: () => void;
  goToCtid?: string;
  activateGoTo?: number;
}

const PAGE_SIZE = 100;
const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 700;

export function AttributeTablePanel({ layers, activeLayerId, onLayerChange, onClose, connectionId, onFlyTo, onUpdateLayer, mapBounds, editMode, onEdit, onEditGeometry, onAddFeature, goToCtid, activateGoTo }: Props) {
  const activeLayer = layers.find(l => l.id === activeLayerId) ?? layers[0];
  const schema = activeLayer?.table.table_schema ?? "";
  const table  = activeLayer?.table.table_name  ?? "";
  const geomCol = activeLayer?.table.geom_col ?? null;

  const [columns, setColumns]       = React.useState<ColumnMeta[]>([]);
  const [rows, setRows]             = React.useState<Record<string, any>[]>([]);
  const [total, setTotal]           = React.useState(0);
  const [page, setPage]             = React.useState(0);
  const [sortCol, setSortCol]       = React.useState<string | null>(null);
  const [sortDir, setSortDir]       = React.useState<"asc" | "desc">("asc");
  const [search, setSearch]         = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState<string | null>(null);
  const [attrFilters, setAttrFilters] = React.useState<AttrFilter[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [hiddenCols, setHiddenCols] = React.useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = React.useState(false);
  const [visibleOnly, setVisibleOnly] = React.useState(false);
  const [highlightedCtid, setHighlightedCtid] = React.useState<string | null>(null);
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const colPickerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(DEFAULT_HEIGHT);
  const dragRef = React.useRef<{ startY: number; startH: number } | null>(null);
  // Used to prevent the sync effect from re-fetching when the table itself made the change
  const selfUpdating = React.useRef(false);
  // Track our own dataVersion bumps so we don't re-fetch after our own edits
  const ownDataVersion = React.useRef<number | undefined>(undefined);

  // Inline cell editing
  const [editingCell, setEditingCell] = React.useState<{ ctid: string; col: string; value: string } | null>(null);
  const [savingCell, setSavingCell] = React.useState(false);
  const [cellError, setCellError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [deletingRow, setDeletingRow] = React.useState<string | null>(null);
  const editCancelRef = React.useRef(false);

  const editableCols = React.useMemo(() => columns.filter(c => !c.isGeom), [columns]);

  const layersRef = React.useRef(layers);
  const onUpdateLayerRef = React.useRef(onUpdateLayer);
  React.useEffect(() => { layersRef.current = layers; }, [layers]);
  React.useEffect(() => { onUpdateLayerRef.current = onUpdateLayer; }, [onUpdateLayer]);

  async function fetchRows(opts: { p?: number; sc?: string | null; sd?: "asc"|"desc"; s?: string; af?: AttrFilter[]; vo?: boolean } = {}) {
    const p  = opts.p  ?? page;
    const sc = "sc" in opts ? opts.sc : sortCol;
    const sd = opts.sd ?? sortDir;
    const s  = "s"  in opts ? opts.s : search;
    const af = "af" in opts ? opts.af : attrFilters;
    const vo = "vo" in opts ? opts.vo : visibleOnly;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/pg/table-rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: activeLayer?.connectionId ?? connectionId, schema, table, page: p, pageSize: PAGE_SIZE, sortCol: sc, sortDir: sd, search: s, attrFilters: af, bbox: vo ? mapBounds : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setColumns(data.columns); setRows(data.rows); setTotal(data.total);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function navigateToCtid(ctid: string) {
    if (!ctid || !schema || !table) return;
    // If the row is already on the current page, just highlight and scroll — no fetch.
    if (rows.some(r => r._ctid === ctid)) {
      setHighlightedCtid(ctid);
      rowRefs.current[ctid]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/pg/table-rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: activeLayer?.connectionId ?? connectionId, schema, table, pageSize: PAGE_SIZE, goToCtid: ctid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setColumns(data.columns);
      setRows(data.rows);
      setTotal(data.total);
      setPage(data.goToPage ?? 0);
      setSortCol(null); setSortDir("asc");
      setSearch(""); setSearchInput("");
      setAttrFilters([]); setVisibleOnly(false);
      setHighlightedCtid(ctid);
      setTimeout(() => {
        rowRefs.current[ctid]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Reset when active layer changes — initialize attrFilters from the new layer's controls
  const prevKey = React.useRef("");
  React.useEffect(() => {
    if (!schema || !table) return;
    const key = `${schema}.${table}`;
    prevKey.current = key;
    const initialFilters = (activeLayer?.controls ?? []).filter((c): c is AttrFilter => c.type === "attribute");
    setPage(0); setSortCol(null); setSortDir("asc"); setSearch(""); setSearchInput("");
    setAttrFilters(initialFilters); setShowFilters(false);
    setHiddenCols(new Set()); setShowColPicker(false); setHighlightedCtid(null);
    fetchRows({ p: 0, sc: null, sd: "asc", s: "", af: initialFilters, vo: visibleOnly });
  }, [schema, table]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync attrFilters when the sidebar changes layer controls externally
  const prevLayerFiltersKey = React.useRef("");
  React.useEffect(() => {
    const layerFilters = (activeLayer?.controls ?? []).filter((c): c is AttrFilter => c.type === "attribute");
    const key = JSON.stringify(layerFilters);
    if (key === prevLayerFiltersKey.current) return;
    prevLayerFiltersKey.current = key;
    if (selfUpdating.current) { selfUpdating.current = false; return; } // table made this change — already fetched
    if (!schema || !table) return;
    setAttrFilters(layerFilters);
    setShowFilters(prev => prev || layerFilters.length > 0);
    setPage(0); fetchRows({ p: 0, af: layerFilters });
  }, [activeLayer?.controls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to a specific row when triggered externally ("Show in table" popup button)
  const prevActivateGoTo = React.useRef(0);
  React.useEffect(() => {
    const v = activateGoTo ?? 0;
    if (v > 0 && v !== prevActivateGoTo.current && goToCtid) navigateToCtid(goToCtid);
    prevActivateGoTo.current = v;
  }, [activateGoTo, goToCtid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when an external actor (e.g. undo) bumps dataVersion
  React.useEffect(() => {
    const v = activeLayer?.dataVersion;
    if (v === undefined || !schema || !table) { ownDataVersion.current = v; return; }
    if (ownDataVersion.current !== undefined && v !== ownDataVersion.current) {
      fetchRows();
    }
    ownDataVersion.current = v;
  }, [activeLayer?.dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when visible-only toggle or map bounds change
  const prevBoundsRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!schema || !table) return;
    const key = JSON.stringify(mapBounds);
    if (!visibleOnly || key === prevBoundsRef.current) return;
    prevBoundsRef.current = key;
    setPage(0); fetchRows({ p: 0, vo: true });
  }, [mapBounds]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(col: string) {
    let nc: string | null = col, nd: "asc"|"desc" = "asc";
    if (sortCol === col) { if (sortDir === "asc") nd = "desc"; else nc = null; }
    setSortCol(nc); setSortDir(nd); setPage(0); fetchRows({ p: 0, sc: nc, sd: nd });
  }
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = searchInput.trim(); setSearch(s); setPage(0); fetchRows({ p: 0, s });
  }
  function clearSearch() { setSearchInput(""); setSearch(""); setPage(0); fetchRows({ p: 0, s: "" }); }
  function handlePageChange(np: number) { setPage(np); fetchRows({ p: np }); }

  const activeGeomCol = geomCol ?? columns.find(c => c.isGeom)?.name ?? null;
  async function zoomToRow(ctid: string) {
    if (!onFlyTo || !activeGeomCol) return;
    try {
      const res = await fetch("/api/pg/row-extent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: activeLayer?.connectionId ?? connectionId, schema, table, geomCol: activeGeomCol, ctid }),
      });
      const d = await res.json();
      if (d.xmin != null) {
        onFlyTo([[d.xmin, d.ymin], [d.xmax, d.ymax]]);
        setHighlightedCtid(ctid);
        setTimeout(() => { rowRefs.current[ctid]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 80);
      }
    } catch {}
  }

  async function commitCell() {
    if (!editingCell || savingCell || !activeLayer) return;
    const { ctid, col, value } = editingCell;
    const origValue = rows.find(r => r._ctid === ctid)?.[col] ?? null;
    const newValue = value === "" ? null : value;
    if (String(origValue ?? "") === String(newValue ?? "") && origValue === newValue) {
      setEditingCell(null);
      return;
    }
    setSavingCell(true);
    setCellError(null);
    try {
      const res = await fetch("/api/pg/feature-row", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: activeLayer.connectionId,
          shareId: activeLayer.shareId,
          schema, table, ctid,
          updates: { [col]: newValue },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const newCtid = data.ctid ?? ctid;
      setRows(prev => prev.map(r =>
        r._ctid === ctid ? { ...r, [col]: newValue, _ctid: newCtid } : r
      ));
      const nextVersion = (activeLayer.dataVersion ?? 0) + 1;
      ownDataVersion.current = nextVersion;
      onUpdateLayer?.(activeLayer.id, { dataVersion: nextVersion });
      // Queue undo op — revert patches back to original value
      const { connectionId: cid, shareId: sid } = activeLayer;
      onEdit?.({
        id: crypto.randomUUID(),
        label: `Edit ${col} in ${table}`,
        layerId: activeLayer.id,
        revert: async () => {
          const r = await fetch("/api/pg/feature-row", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: cid, shareId: sid, schema, table, ctid: newCtid, updates: { [col]: origValue } }),
          });
          if (!r.ok) throw new Error((await r.json()).error ?? "Undo failed");
          const currentLayer = layersRef.current.find(l => l.id === activeLayer.id);
          onUpdateLayerRef.current?.(activeLayer.id, { dataVersion: (currentLayer?.dataVersion ?? 0) + 1 });
        },
      });
      setEditingCell(null);
    } catch (e: any) {
      setCellError(e.message);
    } finally {
      setSavingCell(false);
    }
  }

  async function deleteRow(ctid: string) {
    if (!activeLayer) return;
    const { connectionId: cid, shareId: sid } = activeLayer;

    // Capture attrs + geometry before deleting (needed for undo re-insert)
    const capturedRow = rows.find(r => r._ctid === ctid);
    const attrs: Record<string, any> = {};
    if (capturedRow) {
      for (const col of columns) {
        if (!col.isGeom && col.name !== "_ctid") attrs[col.name] = capturedRow[col.name];
      }
    }
    let geometry: any = null;
    const geomColName = activeGeomCol;
    if (geomColName) {
      try {
        const gr = await fetch("/api/pg/feature-geometry", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: cid, shareId: sid, schema, table, geomCol: geomColName, ctid }),
        });
        const gd = await gr.json();
        geometry = gd.geometry ?? null;
      } catch {}
    }

    setDeletingRow(ctid);
    try {
      const res = await fetch("/api/pg/feature-row", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: cid, shareId: sid, schema, table, ctid }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setRows(prev => prev.filter(r => r._ctid !== ctid));
      setTotal(prev => prev - 1);
      const nextVersion = (activeLayer.dataVersion ?? 0) + 1;
      ownDataVersion.current = nextVersion;
      onUpdateLayer?.(activeLayer.id, { dataVersion: nextVersion });
      if (geometry) {
        onEdit?.({
          id: crypto.randomUUID(),
          label: `Deleted row from ${table}`,
          layerId: activeLayer.id,
          revert: async () => {
            const srid = activeLayer.table.srid ?? 4326;
            const r = await fetch("/api/pg/feature-row", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ connectionId: cid, shareId: sid, schema, table, geomCol: geomColName, geometry, srid, attrs }),
            });
            if (!r.ok) throw new Error((await r.json()).error ?? "Undo failed");
            const currentLayer = layersRef.current.find(l => l.id === activeLayer.id);
            onUpdateLayerRef.current?.(activeLayer.id, { dataVersion: (currentLayer?.dataVersion ?? 0) + 1 });
          },
        });
      }
    } catch (e: any) {
      console.error("Delete failed:", e.message);
    } finally {
      setDeletingRow(null);
      setDeleteConfirm(null);
    }
  }

  function addAttrFilter() {
    const firstCol = editableCols[0]?.name ?? "";
    const newFilter: AttrFilter = { id: crypto.randomUUID(), type: "attribute" as const, enabled: true, shared: false, column: firstCol, operator: "ilike" as AttrOperator, value: "" };
    const next = [...attrFilters, newFilter];
    setAttrFilters(next);
    setShowFilters(true);
    syncToLayer(next); // sync without refetch — filter is empty so nothing to fetch yet
  }
  function removeAttrFilter(id: string) {
    const next = attrFilters.filter(f => f.id !== id);
    setAttrFilters(next); applyFiltersChange(next);
  }
  function applyAttrFilter(next: AttrFilter[]) { setAttrFilters(next); applyFiltersChange(next); }
  function syncToLayer(next: AttrFilter[]) {
    if (!activeLayer || !onUpdateLayer) return;
    const nonAttr = (activeLayer.controls ?? []).filter(c => c.type !== "attribute");
    selfUpdating.current = true;
    onUpdateLayer(activeLayer.id, { controls: [...nonAttr, ...next] });
  }
  function applyFiltersChange(next: AttrFilter[]) {
    syncToLayer(next);
    setPage(0); fetchRows({ p: 0, af: next });
  }
  function clearAttrFilters() { setAttrFilters([]); applyFiltersChange([]); }

  function onDragMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const activeFilterCount = attrFilters.filter(f => f.column && (NULL_OPERATORS.includes(f.operator) || f.value.trim() !== "")).length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const rowStart  = page * PAGE_SIZE + 1;
  const rowEnd    = Math.min((page + 1) * PAGE_SIZE, total);
  const displayCols = columns.filter(c => !hiddenCols.has(c.name));
  const displayRows = rows;

  if (!activeLayer) return null;

  return (
    <div className="border-t flex flex-col bg-background shrink-0" style={{ height }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragMouseDown}
        className="h-1.5 w-full shrink-0 cursor-row-resize flex items-center justify-center group hover:bg-primary/10 transition-colors"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center border-b shrink-0 bg-muted/20 px-2 gap-2">
        {/* Left — layer selector */}
        <div className="flex-1 min-w-0 max-w-64">
          <select
            value={activeLayerId}
            onChange={e => onLayerChange(e.target.value)}
            className="h-6 text-xs bg-transparent border rounded px-1.5 w-full max-w-[220px] text-foreground"
          >
            {layers.map(l => (
              <option key={l.id} value={l.id}>
                {l.table.table_schema}.{l.table.table_name}
              </option>
            ))}
          </select>
        </div>

        {/* Center — All / Visible toggle */}
        <div className="flex rounded border h-6 overflow-hidden text-[11px] shrink-0">
          <button
            className={`px-2 transition-colors ${!visibleOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setVisibleOnly(false); setPage(0); fetchRows({ p: 0, vo: false }); }}
          >All</button>
          <button
            className={`px-2 border-l transition-colors ${visibleOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setVisibleOnly(true); setPage(0); fetchRows({ p: 0, vo: true }); }}
          >Visible</button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-1">
            <Input placeholder="Search…" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="h-6 text-xs w-36" />
            <Button type="submit" size="sm" variant="ghost" className="h-6 w-6 p-0"><Search className="h-3 w-3" /></Button>
            {search && <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={clearSearch}><X className="h-3 w-3" /></Button>}
          </form>
          {editMode && onAddFeature && activeGeomCol && (
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={onAddFeature} title="Add feature">
              <Plus className="h-3 w-3" />Add feature
            </Button>
          )}
          <Button size="sm" variant={showFilters || activeFilterCount > 0 ? "secondary" : "ghost"} className="h-6 text-xs gap-1 px-2"
            onClick={() => { setShowFilters(v => !v); if (!showFilters && attrFilters.length === 0) addAttrFilter(); }}>
            <Filter className="h-3 w-3" />
            {activeFilterCount > 0 && <span className="rounded-full bg-primary text-primary-foreground px-1 text-[9px] leading-3">{activeFilterCount}</span>}
          </Button>
          <div className="relative">
            <Button size="sm" variant={hiddenCols.size > 0 ? "secondary" : "ghost"} className="h-6 text-xs gap-1 px-2"
              onClick={() => setShowColPicker(v => !v)}>
              <Columns className="h-3 w-3" />
            </Button>
            {showColPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)} />
                <div ref={colPickerRef}
                  className="absolute right-0 bottom-full mb-1 z-20 bg-background border rounded-md shadow-lg py-1 min-w-40 max-h-60 overflow-y-auto">
                  <div className="px-2 py-1 flex items-center justify-between border-b mb-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Columns</span>
                    {hiddenCols.size > 0 && <button className="text-[10px] text-primary hover:underline" onClick={() => setHiddenCols(new Set())}>Show all</button>}
                  </div>
                  {columns.map(col => (
                    <label key={col.name} className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 cursor-pointer text-xs">
                      <input type="checkbox" className="h-3 w-3 shrink-0" checked={!hiddenCols.has(col.name)}
                        onChange={() => setHiddenCols(prev => { const n = new Set(prev); n.has(col.name) ? n.delete(col.name) : n.add(col.name); return n; })} />
                      <span className="truncate">{col.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="shrink-0 border-b bg-muted/10 px-3 py-1.5 flex flex-wrap items-center gap-2">
          {attrFilters.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => removeAttrFilter(f.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              <span className="text-xs text-muted-foreground shrink-0">{i === 0 ? "where" : "and"}</span>
              <Select value={f.column} onValueChange={col => applyAttrFilter(attrFilters.map(fi => fi.id === f.id ? { ...fi, column: col, value: "" } : fi))}>
                <SelectTrigger className="h-6 text-xs w-32"><SelectValue placeholder="column" /></SelectTrigger>
                <SelectContent>{editableCols.map(c => <SelectItem key={c.name} value={c.name} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={f.operator} onValueChange={op => applyAttrFilter(attrFilters.map(fi => fi.id === f.id ? { ...fi, operator: op as AttrOperator } : fi))}>
                <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_OPERATORS.map(op => <SelectItem key={op} value={op} className="text-xs">{OPERATOR_LABELS[op]}</SelectItem>)}</SelectContent>
              </Select>
              {!NULL_OPERATORS.includes(f.operator) && (
                <Input value={f.value} placeholder={f.operator === "in" ? "a,b,c" : "value"}
                  onChange={e => setAttrFilters(prev => prev.map(fi => fi.id === f.id ? { ...fi, value: e.target.value } : fi))}
                  onBlur={e => applyAttrFilter(attrFilters.map(fi => fi.id === f.id ? { ...fi, value: e.target.value } : fi))}
                  onKeyDown={e => { if (e.key === "Enter") applyAttrFilter(attrFilters.map(fi => fi.id === f.id ? { ...fi, value: (e.target as HTMLInputElement).value } : fi)); }}
                  className="h-6 text-xs w-36" />
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={addAttrFilter}><Plus className="h-3 w-3 mr-1" />Add</Button>
          {attrFilters.length > 0 && <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={clearAttrFilters}>Clear</Button>}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && <div className="flex items-center justify-center h-full gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
        {error && <p className="p-3 text-xs text-destructive">{error}</p>}
        {!loading && !error && (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-background z-10 border-b shadow-sm">
              <tr>
                {((onFlyTo && activeGeomCol) || editMode) && <th className="px-1 py-1.5 w-10 border-r" />}
                {displayCols.map(col => (
                  <th key={col.name}
                    className={`px-2 py-1.5 text-left border-r last:border-r-0 whitespace-nowrap ${!col.isGeom ? "cursor-pointer select-none hover:bg-muted/60" : ""}`}
                    onClick={() => !col.isGeom && handleSort(col.name)}>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">{col.name}</span>
                      {sortCol === col.name && (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary shrink-0" /> : <ChevronDown className="h-3 w-3 text-primary shrink-0" />)}
                    </div>
                    <div className="text-[9px] font-normal font-sans text-muted-foreground/70">{col.dataType}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => (
                <tr
                  key={row._ctid}
                  ref={el => { rowRefs.current[row._ctid as string] = el; }}
                  className={`border-b hover:bg-muted/40 group transition-colors cursor-pointer ${row._ctid === highlightedCtid ? "bg-primary/10 outline outline-1 outline-primary/40" : ri % 2 === 0 ? "" : "bg-muted/20"}`}
                  onClick={() => zoomToRow(row._ctid)}
                >
                  {((onFlyTo && activeGeomCol) || editMode) && (
                    <td className="px-1 border-r w-10">
                      <div className="flex items-center gap-0.5">
                        {onFlyTo && activeGeomCol && (
                          <button onClick={e => { e.stopPropagation(); zoomToRow(row._ctid); }}
                            className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all shrink-0" title="Zoom to feature">
                            <Locate className="h-3 w-3" />
                          </button>
                        )}
                        {editMode && (
                          deletingRow === row._ctid ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                          ) : deleteConfirm === row._ctid ? (
                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              <button onClick={() => deleteRow(row._ctid)} className="text-[9px] text-destructive font-medium hover:underline px-0.5">Del</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-[9px] text-muted-foreground hover:underline px-0.5">No</button>
                            </div>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); setDeleteConfirm(row._ctid); }}
                              className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-muted transition-all shrink-0" title="Delete row">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  )}
                  {displayCols.map(col => {
                    const val = row[col.name];
                    const isEditing = editMode && !col.isGeom && editingCell?.ctid === row._ctid && editingCell?.col === col.name;
                    if (isEditing) {
                      return (
                        <td key={col.name} className="px-1 py-0.5 border-r last:border-r-0">
                          <input
                            className="w-full text-xs bg-background border border-primary rounded px-1 py-0.5 outline-none min-w-0"
                            value={editingCell!.value}
                            autoFocus
                            disabled={savingCell}
                            onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={e => {
                              if (e.key === "Escape") { editCancelRef.current = true; setEditingCell(null); setCellError(null); }
                              if (e.key === "Enter") { e.preventDefault(); commitCell(); }
                            }}
                            onBlur={() => { if (editCancelRef.current) { editCancelRef.current = false; return; } commitCell(); }}
                          />
                          {cellError && <div className="text-[9px] text-destructive mt-0.5">{cellError}</div>}
                        </td>
                      );
                    }
                    return (
                      <td key={col.name}
                        className={`px-2 py-1 border-r last:border-r-0 max-w-[14rem] overflow-hidden ${editMode && !col.isGeom ? "cursor-pointer hover:bg-primary/5" : ""}`}
                        title={val == null ? "NULL" : String(val)}
                        onClick={e => {
                          if (!editMode || col.isGeom) return;
                          e.stopPropagation();
                          setDeleteConfirm(null);
                          setCellError(null);
                          setEditingCell({ ctid: row._ctid, col: col.name, value: val == null ? "" : String(val) });
                        }}
                      >
                        {val == null ? <span className="text-muted-foreground/40 italic select-none">null</span>
                          : col.isGeom ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-muted-foreground text-[10px] truncate">{String(val).slice(0, 40)}…</span>
                              {editMode && onEditGeometry && (
                                <button onClick={e => { e.stopPropagation(); onEditGeometry(row._ctid); }}
                                  className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Edit geometry">
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : <span className="truncate block">{String(val)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={displayCols.length + (((onFlyTo && activeGeomCol) || editMode) ? 1 : 0)} className="text-center py-8 text-muted-foreground text-xs">
                  {search ? "No rows match the search." : "This table has no rows."}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t px-3 py-1 flex items-center justify-between text-xs text-muted-foreground bg-background">
        <span>
          {total === 0 ? "No rows" : `${rowStart.toLocaleString()}–${rowEnd.toLocaleString()} of ${total.toLocaleString()} rows`}
          {search && <span className="ml-1 text-primary">(filtered)</span>}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={page === 0 || loading} onClick={() => handlePageChange(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {Math.max(1, pageCount)}</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={page >= pageCount - 1 || loading} onClick={() => handlePageChange(page + 1)}>Next</Button>
        </div>
      </div>

    </div>
  );
}
