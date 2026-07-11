"use client";
import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, Loader2, Plus, Trash2, Wrench, Database, ServerCrash, Pencil, ArrowLeft } from "lucide-react";

const CLOUD_HOSTS = ["neon.tech", "supabase.co", "rds.amazonaws.com", "railway.app", "render.com"];

interface ConnFields {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

const EMPTY_FIELDS: ConnFields = { host: "", port: "5432", database: "", username: "", password: "", ssl: false };

function fieldsFromDsn(raw: string): ConnFields {
  try {
    const url = new URL(raw.trim());
    const ssl = url.searchParams.get("sslmode") === "require";
    return {
      host: url.hostname || "",
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "") || "",
      username: decodeURIComponent(url.username) || "",
      password: decodeURIComponent(url.password) || "",
      ssl,
    };
  } catch {
    return EMPTY_FIELDS;
  }
}

function fieldsToDsn(f: ConnFields): string {
  if (!f.host || !f.database || !f.username) return "";
  const user = encodeURIComponent(f.username);
  const pass = f.password ? `:${encodeURIComponent(f.password)}` : "";
  const port = f.port || "5432";
  const ssl = f.ssl ? "?sslmode=require" : "";
  return `postgresql://${user}${pass}@${f.host}:${port}/${f.database}${ssl}`;
}

function needsSsl(f: ConnFields): boolean {
  return CLOUD_HOSTS.some((h) => f.host.includes(h)) && !f.ssl;
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
  initialEditId?: string;
}

type Mode = "list" | "add" | "edit";

export function ConnectionsDialog({ open, onOpenChange, activeConnectionId, onSelect, initialEditId }: Props) {
  const [connections, setConnections] = React.useState<SavedConnection[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [loadingDsn, setLoadingDsn] = React.useState(false);

  const [name, setName] = React.useState("");
  const [fields, setFields] = React.useState<ConnFields>(EMPTY_FIELDS);
  const [rawDsn, setRawDsn] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<"ok" | "fail" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function setField<K extends keyof ConnFields>(k: K, v: ConnFields[K]) {
    setFields((prev) => {
      const next = { ...prev, [k]: v };
      const assembled = fieldsToDsn(next);
      if (assembled) setRawDsn(assembled);
      return next;
    });
    setTestResult(null);
  }

  function handleRawDsnChange(value: string) {
    setRawDsn(value);
    setTestResult(null);
    if (/^postgres(?:ql)?:\/\//i.test(value)) {
      const parsed = fieldsFromDsn(value);
      if (parsed.host) setFields(parsed);
    }
  }

  const dsn = fieldsToDsn(fields);
  const canSave = name.trim().length > 0 && !!dsn;
  const canTest = canSave;
  const showSslWarning = needsSsl(fields);

  async function loadConnections(): Promise<SavedConnection[]> {
    setLoading(true);
    setStorageError(null);
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data: SavedConnection[] = await res.json();
        setConnections(data);
        return data;
      } else {
        const data = await res.json();
        if (res.status === 500 && data.error?.includes("POSTGRES_URL")) {
          setStorageError(data.error);
        }
      }
    } finally { setLoading(false); }
    return [];
  }

  React.useEffect(() => {
    if (!open) return;
    resetForm();
    loadConnections().then((data) => {
      if (initialEditId) {
        const c = data.find((x) => x.id === initialEditId);
        if (c) startEdit(c);
      }
    });
  }, [open, initialEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setMode("list");
    setEditingId(null);
    setName("");
    setFields(EMPTY_FIELDS);
    setRawDsn("");
    setTestResult(null);
    setError(null);
  }

  async function startEdit(c: SavedConnection) {
    setMode("edit");
    setEditingId(c.id);
    setName(c.name);
    setFields(EMPTY_FIELDS);
    setTestResult(null);
    setError(null);
    setLoadingDsn(true);
    try {
      const res = await fetch(`/api/connections/${c.id}?dsn=1`);
      if (res.ok) {
        const data = await res.json();
        const raw = data.dsn ?? "";
        setRawDsn(raw);
        setFields(fieldsFromDsn(raw));
      }
    } finally { setLoadingDsn(false); }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "test", dsn, test: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult("ok");
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
        body: JSON.stringify({ name: name.trim(), dsn }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      await loadConnections();
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dsn }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update"); return; }
      await loadConnections();
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to delete");
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  const isForm = mode === "add" || mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[min(90vw,42rem)] overflow-hidden">

        {/* ── LIST PAGE ── */}
        {!isForm && (
          <>
            <DialogHeader>
              <DialogTitle>Database Connections</DialogTitle>
              <DialogDescription>
                Connection strings are encrypted and stored server-side.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-1">
              {storageError && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
                  <ServerCrash className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive text-xs">Storage not configured</p>
                    <p className="text-xs text-muted-foreground">
                      Set a <code className="font-mono bg-muted px-0.5 rounded">POSTGRES_URL</code> environment variable pointing to any Postgres database.
                    </p>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : connections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No saved connections. Add one below.</p>
              ) : (
                <ul className="space-y-1.5">
                  {connections.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium truncate block">{c.name}</span>
                          <span className="text-xs text-muted-foreground truncate block">{c.host} / {c.database}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(c)} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Edit connection">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" title="Delete connection">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => { setMode("add"); setError(null); }}>
                <Plus className="h-3.5 w-3.5" /> Add Connection
              </Button>
            </div>
          </>
        )}

        {/* ── ADD / EDIT PAGE ── */}
        {isForm && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button onClick={resetForm} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors -ml-1" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle>{mode === "edit" ? "Edit Connection" : "Add Connection"}</DialogTitle>
              </div>
              <DialogDescription>
                {mode === "edit" ? "Update the connection details." : "Add a new PostGIS database connection."}
              </DialogDescription>
            </DialogHeader>

            {loadingDsn ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <div className="space-y-4 mt-1">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="conn-name">Name</Label>
                  <Input id="conn-name" placeholder="My PostGIS DB" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                {/* Connection string (paste or assembled from fields) */}
                <div className="space-y-1.5">
                  <Label htmlFor="conn-dsn">Connection string</Label>
                  <Input
                    id="conn-dsn"
                    placeholder="postgresql://user:pass@host:5432/dbname"
                    value={rawDsn}
                    onChange={(e) => handleRawDsnChange(e.target.value)}
                    className="font-mono text-[12px]"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-[11px] text-muted-foreground">Paste a connection string to auto-fill the fields below.</p>
                </div>

                <div className="border-t" />

                {/* Host + Port */}
                <div className="grid grid-cols-[1fr_100px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="conn-host">Host</Label>
                    <Input id="conn-host" placeholder="localhost" value={fields.host} onChange={(e) => setField("host", e.target.value)} className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="conn-port">Port</Label>
                    <Input id="conn-port" placeholder="5432" value={fields.port} onChange={(e) => setField("port", e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>

                {/* Database */}
                <div className="space-y-1.5">
                  <Label htmlFor="conn-db">Database</Label>
                  <Input id="conn-db" placeholder="postgres" value={fields.database} onChange={(e) => setField("database", e.target.value)} className="font-mono text-sm" />
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="conn-user">Username</Label>
                    <Input id="conn-user" placeholder="postgres" value={fields.username} onChange={(e) => setField("username", e.target.value)} className="font-mono text-sm" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="conn-pass">Password</Label>
                    <Input id="conn-pass" type="password" placeholder="••••••••" value={fields.password} onChange={(e) => setField("password", e.target.value)} className="font-mono text-sm" autoComplete="new-password" />
                  </div>
                </div>

                {/* SSL toggle */}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="conn-ssl" checked={fields.ssl} onChange={(e) => setField("ssl", e.target.checked)} className="h-4 w-4 rounded border" />
                  <Label htmlFor="conn-ssl" className="font-normal cursor-pointer">Require SSL (sslmode=require)</Label>
                </div>

                {/* SSL warning */}
                {showSslWarning && (
                  <div className="flex items-start gap-2.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-amber-800 dark:text-amber-300 text-xs">SSL recommended for this host</p>
                      <button className="text-xs text-amber-700 dark:text-amber-400 underline" onClick={() => setField("ssl", true)}>
                        Enable SSL
                      </button>
                    </div>
                  </div>
                )}

                {testResult === "ok" && (
                  <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" /> Connection successful
                  </p>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={!canTest || testing}>
                    {testing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Test
                  </Button>
                  <Button size="sm" onClick={mode === "edit" ? handleUpdate : handleSave} disabled={!canSave || saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    {mode === "edit" ? "Save Changes" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
