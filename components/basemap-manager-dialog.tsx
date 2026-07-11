"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import { getBasemapColor } from "@/lib/basemaps";
import type { UserBasemap } from "@/lib/basemaps";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: () => void;
}

type Mode = "list" | "add" | "edit";

export function BasemapManagerDialog({ open, onOpenChange, onChange }: Props) {
  const [basemaps, setBasemaps] = React.useState<UserBasemap[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [styleUrl, setStyleUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/basemaps");
      if (res.ok) setBasemaps(await res.json());
    } finally { setLoading(false); }
  }

  React.useEffect(() => {
    if (open) { resetForm(); load(); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setMode("list");
    setEditingId(null);
    setName("");
    setStyleUrl("");
    setError(null);
    setConfirmDeleteId(null);
  }

  function startEdit(b: UserBasemap) {
    setEditingId(b.id);
    setName(b.name);
    setStyleUrl(b.styleUrl);
    setError(null);
    setMode("edit");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/basemaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, styleUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      await load(); onChange(); resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/basemaps/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, styleUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update"); return; }
      await load(); onChange(); resetForm();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/basemaps/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    await load(); onChange();
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      await fetch("/api/basemaps/restore", { method: "POST" });
      await load(); onChange();
    } finally { setRestoring(false); }
  }

  const canSave = name.trim().length > 0 && styleUrl.trim().length > 0;
  const isForm = mode === "add" || mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[min(90vw,32rem)] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isForm && (
              <button onClick={resetForm} className="p-1 rounded hover:bg-muted text-muted-foreground -ml-1">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle>{isForm ? (mode === "edit" ? "Edit Basemap" : "Add Basemap") : "Basemaps"}</DialogTitle>
          </div>
        </DialogHeader>

        {/* List */}
        {!isForm && (
          <div className="space-y-3 mt-1">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : basemaps.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">No basemaps. Restore defaults?</p>
                <Button size="sm" variant="outline" onClick={handleRestore} disabled={restoring}>
                  {restoring && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Restore defaults
                </Button>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {basemaps.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm min-w-0">
                      <div className="w-4 h-4 rounded-sm border shrink-0" style={{ background: getBasemapColor(b.id) }} />
                      <span className="flex-1 min-w-0 font-medium truncate">{b.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                        {confirmDeleteId === b.id ? (
                          <>
                            <span className="text-[11px] text-muted-foreground">Sure?</span>
                            <button onClick={() => handleDelete(b.id)} className="text-[11px] text-destructive hover:underline px-1">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] text-muted-foreground hover:underline px-1">No</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(b)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(b.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    {restoring ? "Restoring…" : "Restore defaults"}
                  </button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setMode("add"); setError(null); }}>
                    <Plus className="h-3.5 w-3.5" /> Add Basemap
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Form */}
        {isForm && (
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="bm-name">Name</Label>
              <Input id="bm-name" placeholder="My Satellite" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bm-url">Style URL</Label>
              <Input
                id="bm-url"
                placeholder="https://api.maptiler.com/maps/satellite/style.json?key=…"
                value={styleUrl}
                onChange={(e) => setStyleUrl(e.target.value)}
                className="font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground">Any MapLibre GL-compatible style URL.</p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" disabled={!canSave || saving} onClick={mode === "edit" ? handleUpdate : handleSave}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {mode === "edit" ? "Save Changes" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
