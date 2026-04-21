"use client";
import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Trash2, RefreshCw, Plus, Pencil, X, Loader2, Lock, Globe, ExternalLink } from "lucide-react";
import type { MapLayer } from "@/lib/types";
import type { ShareState } from "@/components/share-dialog";
import type { MapView } from "@/components/maplibre-map";

interface ServerView {
  id: string;
  name: string;
  state_json: ShareState;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

function toState(layers: MapLayer[], basemap: string, view?: MapView, name?: string): ShareState {
  return {
    name,
    basemap,
    view,
    layers: layers.map((l) => ({
      id: l.id,
      table: l.table,
      connectionId: l.connectionId,
      visible: l.visible,
      style: l.style,
      controls: l.controls,
      geomTypeOverride: l.geomTypeOverride ?? null,
    })),
  };
}

function shareUrl(id: string) {
  return `${window.location.origin}/share/${id}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionId: string;
  layers: MapLayer[];
  basemap: string;
  view?: MapView;
  activeViewName?: string | null;
  onActiveViewNameChange?: (name: string | null) => void;
  onLoad: (state: ShareState, name: string) => void;
}

export function SavedViewsDialog({ open, onOpenChange, connectionId, layers, basemap, view, activeViewName, onActiveViewNameChange, onLoad }: Props) {
  const [views, setViews] = React.useState<ServerView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  async function fetchViews() {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pg/saved-views?connectionId=${encodeURIComponent(connectionId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load views");
      setViews(data.views ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    fetchViews();
    setShowNewForm(false);
    setNewName("");
    setRenamingId(null);
  }, [open, connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createView() {
    if (!newName.trim() || !connectionId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, id: crypto.randomUUID(), name: newName.trim(), state: toState(layers, basemap, view, newName.trim()) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save view");
      onActiveViewNameChange?.(newName.trim());
      setNewName("");
      setShowNewForm(false);
      await fetchViews();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateView(v: ServerView) {
    try {
      const res = await fetch(`/api/pg/saved-views/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: toState(layers, basemap, view, v.name) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update view");
      onActiveViewNameChange?.(v.name);
      await fetchViews();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function renameView(id: string, name: string) {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/pg/saved-views/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to rename view");
      if (activeViewName === views.find(v => v.id === id)?.name) onActiveViewNameChange?.(name.trim());
      setViews(prev => prev.map(v => v.id === id ? { ...v, name: name.trim() } : v));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRenamingId(null);
    }
  }

  async function togglePublic(v: ServerView) {
    setTogglingId(v.id);
    try {
      const res = await fetch(`/api/pg/saved-views/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !v.is_public }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update visibility");
      setViews(prev => prev.map(sv => sv.id === v.id ? { ...sv, is_public: !v.is_public } : sv));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  }

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(id));
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteView(id: string) {
    try {
      const res = await fetch(`/api/pg/saved-views/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete view");
      const deleted = views.find(v => v.id === id);
      if (deleted?.name === activeViewName) onActiveViewNameChange?.(null);
      setViews(prev => prev.filter(v => v.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleLoad(v: ServerView) {
    onLoad(v.state_json, v.name);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[min(90vw,42rem)]">
        <DialogHeader>
          <DialogTitle>Saved Views</DialogTitle>
          <DialogDescription>
            Save your current layers, styles, and map position. Private views are only visible to you. Public views can be shared via link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {error && (
            <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : views.length === 0 && !showNewForm ? (
            <p className="text-sm text-muted-foreground text-center py-6">No saved views yet. Save your current map to get started.</p>
          ) : (
            <div className="space-y-1">
              {views.map((v) => {
                const isActive = v.name === activeViewName;
                const isRenaming = renamingId === v.id;
                const isToggling = togglingId === v.id;
                return (
                  <div key={v.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors min-w-0 overflow-hidden ${isActive ? "border-primary/40 bg-primary/5" : ""}`}>
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") renameView(v.id, renameValue);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => renameView(v.id, renameValue)}
                          className="h-7 text-sm font-medium"
                        />
                      ) : (
                        <>
                          <button
                            className="text-sm font-medium truncate block w-full text-left hover:text-primary transition-colors"
                            onClick={() => handleLoad(v)}
                          >
                            {v.name}
                            {isActive && <span className="ml-1.5 text-[10px] font-normal text-primary/70">active</span>}
                          </button>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {v.is_public
                              ? <span className="text-green-600 dark:text-green-400 font-medium">Public</span>
                              : <span>Private</span>
                            }
                            <span>· {v.state_json.layers.length} {v.state_json.layers.length === 1 ? "layer" : "layers"} · {fmtDate(v.created_at)}</span>
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {isRenaming ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenamingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Rename" onClick={() => { setRenamingId(v.id); setRenameValue(v.name); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className={`h-7 w-7 ${v.is_public ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                            title={v.is_public ? "Public — click to make private" : "Private — click to make public"}
                            disabled={isToggling}
                            onClick={() => togglePublic(v)}
                          >
                            {isToggling
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : v.is_public
                                ? <Globe className="h-3.5 w-3.5" />
                                : <Lock className="h-3.5 w-3.5" />
                            }
                          </Button>
                          {v.is_public && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Open share link" onClick={() => window.open(shareUrl(v.id), "_blank", "noopener,noreferrer")}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy share link" onClick={() => copyLink(v.id)}>
                                {copied === v.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Update with current map state" onClick={() => updateView(v)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" onClick={() => deleteView(v.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showNewForm && (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="View name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createView(); if (e.key === "Escape") setShowNewForm(false); }}
                className="text-sm"
              />
              <Button size="sm" onClick={createView} disabled={!newName.trim() || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Cancel</Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t">
            <p className="text-xs text-muted-foreground">
              {layers.length} {layers.length === 1 ? "layer" : "layers"} on canvas
            </p>
            {!showNewForm && (
              <Button size="sm" onClick={() => setShowNewForm(true)} disabled={layers.length === 0 || !connectionId}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Save current view
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
