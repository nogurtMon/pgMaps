"use client";
import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, Loader2, Plus, Trash2, Wrench, Database, CheckCircle2, ServerCrash } from "lucide-react";

const CLOUD_HOSTS = ["neon.tech", "supabase.co", "rds.amazonaws.com", "railway.app", "render.com"];

function analyzeDsn(raw: string) {
  const dsn = raw.trim();
  if (!dsn.startsWith("postgres")) return null;
  try {
    const url = new URL(dsn);
    const host = url.hostname;
    const params = new URLSearchParams(url.search);
    const isCloud = CLOUD_HOSTS.some((h) => host.includes(h));
    const needsSsl = isCloud && !params.has("sslmode");
    return { needsSsl };
  } catch { return null; }
}

function addSslMode(dsn: string): string {
  try {
    const url = new URL(dsn.trim());
    url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return dsn + (dsn.includes("?") ? "&" : "?") + "sslmode=require";
  }
}

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  database: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeConnectionId: string;
  onSelect: (id: string) => void;
}

export function ConnectionsDialog({ open, onOpenChange, activeConnectionId, onSelect }: Props) {
  const [connections, setConnections] = React.useState<SavedConnection[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [name, setName] = React.useState("");
  const [dsn, setDsn] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<"ok" | "fail" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const analysis = analyzeDsn(dsn);
  const canSave = name.trim().length > 0 && dsn.trim().startsWith("postgres");

  async function loadConnections() {
    setLoading(true);
    setStorageError(null);
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        setConnections(await res.json());
      } else {
        const data = await res.json();
        if (res.status === 500 && data.error?.includes("POSTGRES_URL")) {
          setStorageError(data.error);
        }
      }
    } finally { setLoading(false); }
  }

  React.useEffect(() => {
    if (open) { loadConnections(); setShowAdd(false); setError(null); }
  }, [open]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "test", dsn: dsn.trim(), test: true }),
      });
      // We're only testing — don't save yet
      const data = await res.json();
      if (res.ok) {
        setTestResult("ok");
        // Delete the just-created test entry
        await fetch(`/api/connections/${data.id}`, { method: "DELETE" });
      } else {
        setTestResult("fail");
        setError(data.error ?? "Connection failed");
      }
    } catch (e: any) {
      setTestResult("fail");
      setError(e.message);
    } finally { setTesting(false); }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dsn: dsn.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      await loadConnections();
      onSelect(data.id);
      setShowAdd(false);
      setName("");
      setDsn("");
      setTestResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (activeConnectionId === id) onSelect("");
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[min(90vw,32rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Database Connections</DialogTitle>
          <DialogDescription>
            Connection strings are encrypted and stored in your Postgres database. Select a connection to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Storage misconfiguration */}
          {storageError && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
              <ServerCrash className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-destructive text-xs">Storage not configured</p>
                <p className="text-xs text-muted-foreground">
                  Set a <code className="font-mono bg-muted px-0.5 rounded">POSTGRES_URL</code> environment variable pointing to any Postgres database. The app automatically creates two tables to store encrypted connections and saved views.
                </p>
              </div>
            </div>
          )}

          {/* Connection list */}
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : connections.length === 0 && !showAdd ? (
            <p className="text-sm text-muted-foreground text-center py-4">No saved connections. Add one below.</p>
          ) : (
            <ul className="space-y-1.5">
              {connections.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${c.id === activeConnectionId ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"}`}>
                  <button className="flex-1 flex items-center gap-2.5 text-left min-w-0" onClick={() => { onSelect(c.id); onOpenChange(false); }}>
                    {c.id === activeConnectionId
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      : <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    }
                    <span className="font-medium truncate min-w-0 flex-1">{c.name}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    title="Delete connection"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add connection form */}
          {showAdd ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Add Connection</p>
              <div className="space-y-1.5">
                <Label htmlFor="conn-name">Name</Label>
                <Input id="conn-name" placeholder="My PostGIS DB" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conn-dsn">Connection string</Label>
                <Input
                  id="conn-dsn"
                  placeholder="postgresql://user:password@host:5432/dbname"
                  value={dsn}
                  onChange={(e) => { setDsn(e.target.value); setTestResult(null); }}
                  className="font-mono text-xs min-w-0 w-full"
                />
              </div>

              {analysis?.needsSsl && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-amber-800 dark:text-amber-300 text-xs">SSL required for this host</p>
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      onClick={() => setDsn(addSslMode(dsn))}
                    >
                      <Wrench className="h-3 w-3 mr-1" /> Add sslmode=require
                    </Button>
                  </div>
                </div>
              )}

              {testResult === "ok" && (
                <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" /> Connection successful
                </p>
              )}
              {testResult === "fail" && error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setError(null); setTestResult(null); }}>Cancel</Button>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={!canSave || testing}>
                  {testing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Test
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Save &amp; Connect
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => { setShowAdd(true); setError(null); }}>
              <Plus className="h-3.5 w-3.5" /> Add Connection
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
