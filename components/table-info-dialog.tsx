"use client";
import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  is_identity: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface IndexInfo {
  index_name: string;
  access_method: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
}

interface TriggerInfo {
  trigger_name: string;
  event: string;
  timing: string;
  table_name: string;
  definition: string;
}

interface GeomInfo {
  column_name: string;
  type: string;
  srid: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connectionId: string;
  schema: string;
  table: string;
  onChanged?: () => void;
}

const VALID_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TableInfoDialog({ open, onOpenChange, connectionId, schema, table, onChanged }: Props) {
  const [columns, setColumns] = React.useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = React.useState<IndexInfo[]>([]);
  const [triggers, setTriggers] = React.useState<TriggerInfo[]>([]);
  const [geometry, setGeometry] = React.useState<GeomInfo[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Table metadata
  const [description, setDescription] = React.useState<string | null>(null);
  const [createdAt, setCreatedAt] = React.useState<string | null>(null);
  const [lastActivity, setLastActivity] = React.useState<string | null>(null);
  const [totalSize, setTotalSize] = React.useState<string | null>(null);

  // Description edit state
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [descDraft, setDescDraft] = React.useState("");
  const [descSaving, setDescSaving] = React.useState(false);
  const [descError, setDescError] = React.useState<string | null>(null);

  // Rename column state
  const [renamingCol, setRenamingCol] = React.useState<string | null>(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [renameLoading, setRenameLoading] = React.useState(false);
  const [renameError, setRenameError] = React.useState<string | null>(null);

  // Drop column state
  const [droppingCol, setDroppingCol] = React.useState<string | null>(null);
  const [dropLoading, setDropLoading] = React.useState(false);
  const [dropError, setDropError] = React.useState<string | null>(null);

  // Add field state
  const [addingField, setAddingField] = React.useState(false);
  const [newFieldName, setNewFieldName] = React.useState("");
  const [newFieldType, setNewFieldType] = React.useState("text");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [addLoading, setAddLoading] = React.useState(false);

  function loadInfo() {
    if (!connectionId || !schema || !table) return;
    setLoading(true);
    setLoadError(null);
    fetch("/api/pg/table-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema, table }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setColumns(data.columns);
        setIndexes(data.indexes);
        setTriggers(data.triggers);
        setGeometry(data.geometry ?? []);
        setDescription(data.description ?? null);
        setCreatedAt(data.created_at ?? null);
        // Pick the most recent timestamp from vacuum/analyze as a proxy for last activity
        const times = [data.last_autovacuum, data.last_autoanalyze, data.last_analyze, data.last_vacuum]
          .filter(Boolean)
          .map((t: string) => new Date(t).getTime());
        setLastActivity(times.length ? new Date(Math.max(...times)).toISOString() : null);
        setTotalSize(data.total_size ?? null);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => {
    if (open) {
      loadInfo();
      setRenamingCol(null);
      setDroppingCol(null);
      setAddingField(false);
      setNewFieldName("");
      setNewFieldType("text");
      setAddError(null);
      setEditingDesc(false);
      setDescError(null);
    }
  }, [open, connectionId, schema, table]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveDesc(value: string) {
    setDescSaving(true);
    setDescError(null);
    try {
      const res = await fetch("/api/pg/set-table-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, schema, table, comment: value.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDescription(value.trim() || null);
      setEditingDesc(false);
      onChanged?.();
    } catch (e: any) {
      setDescError(e.message);
    } finally {
      setDescSaving(false);
    }
  }

  async function alterColumn(action: string, extra: object) {
    const res = await fetch("/api/pg/alter-column", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, schema, table, action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  }

  async function handleRenameColumn(column: string) {
    if (!VALID_IDENT.test(renameVal)) { setRenameError("Invalid column name"); return; }
    setRenameLoading(true);
    setRenameError(null);
    try {
      await alterColumn("rename", { column, newName: renameVal });
      setRenamingCol(null);
      loadInfo();
      onChanged?.();
    } catch (e: any) {
      setRenameError(e.message);
    } finally {
      setRenameLoading(false);
    }
  }

  async function handleAddField() {
    const name = newFieldName.trim();
    if (!VALID_IDENT.test(name)) { setAddError("Letters, numbers, underscores only"); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      await alterColumn("add", { column: name, type: newFieldType });
      setAddingField(false);
      setNewFieldName("");
      setNewFieldType("text");
      loadInfo();
      onChanged?.();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDropColumn(column: string) {
    setDropLoading(true);
    setDropError(null);
    try {
      await alterColumn("drop", { column });
      setDroppingCol(null);
      loadInfo();
      onChanged?.();
    } catch (e: any) {
      setDropError(e.message);
    } finally {
      setDropLoading(false);
    }
  }

  function displayType(col: ColumnInfo) {
    if (col.data_type === "USER-DEFINED") return col.udt_name;
    if (col.data_type === "character varying") {
      return col.character_maximum_length ? `varchar(${col.character_maximum_length})` : "varchar";
    }
    if (col.data_type === "numeric" && col.numeric_precision != null) {
      return col.numeric_scale != null
        ? `numeric(${col.numeric_precision},${col.numeric_scale})`
        : `numeric(${col.numeric_precision})`;
    }
    return col.data_type;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
          <DialogTitle className="text-base font-semibold">
            {schema}.{table}
          </DialogTitle>
        </DialogHeader>

        {/* Description */}
        <div className="px-5 pb-3 shrink-0">
          {editingDesc ? (
            <div className="space-y-1.5">
              <textarea
                autoFocus
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setEditingDesc(false); setDescError(null); }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveDesc(descDraft);
                }}
                placeholder="Describe this table…"
                className="w-full text-sm resize-none rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring min-h-[60px] leading-relaxed"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-6 text-xs px-2.5" onClick={() => handleSaveDesc(descDraft)} disabled={descSaving}>
                  {descSaving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditingDesc(false); setDescError(null); }}>
                  Cancel
                </Button>
                {description && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleSaveDesc("")}>
                    Remove
                  </Button>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">Ctrl+Enter to save</span>
              </div>
              {descError && <p className="text-[10px] text-destructive">{descError}</p>}
            </div>
          ) : description ? (
            <button
              className="group flex items-start gap-1.5 w-full text-left"
              onClick={() => { setDescDraft(description); setEditingDesc(true); }}
            >
              <p className="text-sm text-muted-foreground flex-1 leading-relaxed">{description}</p>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0 mt-0.5" />
            </button>
          ) : (
            !loading && (
              <button
                className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                onClick={() => { setDescDraft(""); setEditingDesc(true); }}
              >
                + Add description
              </button>
            )
          )}
        </div>

        {/* Stats row */}
        {!loading && (createdAt || lastActivity || totalSize) && (
          <div className="px-5 pb-3 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
            {createdAt && (
              <span className="text-[11px] text-muted-foreground">
                <span className="text-foreground/50">Created</span> {fmtDate(createdAt)}
              </span>
            )}
            {lastActivity && (
              <span className="text-[11px] text-muted-foreground">
                <span className="text-foreground/50">Last activity</span> {fmtDate(lastActivity)}
              </span>
            )}
            {totalSize && (
              <span className="text-[11px] text-muted-foreground">
                <span className="text-foreground/50">Size</span> {totalSize}
              </span>
            )}
          </div>
        )}

        {loadError && (
          <p className="px-5 pb-3 text-sm text-destructive">{loadError}</p>
        )}
        {loading && (
          <p className="px-5 pb-3 text-sm text-muted-foreground">Loading…</p>
        )}

        {geometry.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {geometry.map((g) => (
              <div key={g.column_name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium">{g.column_name}</span>
                <span className="text-muted-foreground/40">·</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">{g.type}</Badge>
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">SRID {g.srid}</Badge>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="columns" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-5 shrink-0 w-fit">
            <TabsTrigger value="columns" className="text-xs">
              Columns
              {columns.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{columns.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="indexes" className="text-xs">
              Indexes
              {indexes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{indexes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="triggers" className="text-xs">
              Triggers
              {triggers.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{triggers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* COLUMNS */}
          <TabsContent value="columns" className="flex-1 min-h-0 flex flex-col mt-0 px-5 pb-5 gap-0">
            <ScrollArea className="flex-1 min-h-0 mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1.5 pr-3 font-medium">Name</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Type</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Nullable</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Default</th>
                    <th className="text-right py-1.5 font-medium w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => {
                    const isRenaming = renamingCol === col.column_name;
                    const isDropping = droppingCol === col.column_name;
                    return (
                      <React.Fragment key={col.column_name}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 group">
                          <td className="py-1.5 pr-3">
                            {col.column_name}
                            {col.is_identity === "YES" && (
                              <Badge variant="secondary" className="ml-1.5 h-3.5 px-1 text-[9px] font-normal">identity</Badge>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{displayType(col)}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{col.is_nullable === "YES" ? "yes" : "no"}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-32" title={col.column_default ?? ""}>
                            {col.column_default ?? <span className="opacity-40">—</span>}
                          </td>
                          <td className="py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon" variant="ghost"
                                className="h-5 w-5 text-muted-foreground"
                                title="Rename column"
                                onClick={() => {
                                  setRenamingCol(isRenaming ? null : col.column_name);
                                  setRenameVal(col.column_name);
                                  setRenameError(null);
                                  setDroppingCol(null);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                title="Drop column"
                                onClick={() => {
                                  setDroppingCol(isDropping ? null : col.column_name);
                                  setDropError(null);
                                  setRenamingCol(null);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isRenaming && (
                          <tr>
                            <td colSpan={5} className="py-2 px-2 bg-muted/40 border-b">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0">New name:</span>
                                <Input
                                  value={renameVal}
                                  onChange={(e) => setRenameVal(e.target.value)}
                                  className="h-6 text-xs w-40"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameColumn(col.column_name);
                                    if (e.key === "Escape") setRenamingCol(null);
                                  }}
                                  autoFocus
                                />
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6"
                                  disabled={renameLoading}
                                  onClick={() => handleRenameColumn(col.column_name)}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6"
                                  onClick={() => setRenamingCol(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                {renameError && <p className="text-[10px] text-destructive">{renameError}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                        {isDropping && (
                          <tr>
                            <td colSpan={5} className="py-2 px-2 bg-destructive/5 border-b">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                  Drop <span className="font-semibold">{col.column_name}</span>?
                                  This cannot be undone.
                                </span>
                                <Button
                                  size="sm" variant="destructive" className="h-6 text-[11px] px-2"
                                  disabled={dropLoading}
                                  onClick={() => handleDropColumn(col.column_name)}
                                >
                                  {dropLoading ? "Dropping…" : "Drop"}
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                                  onClick={() => setDroppingCol(null)}
                                >
                                  Cancel
                                </Button>
                                {dropError && <p className="text-[10px] text-destructive">{dropError}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>

            {/* Add field */}
            {addingField ? (
              <div className="border-t pt-3 mt-1 space-y-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newFieldName}
                    onChange={e => { setNewFieldName(e.target.value); setAddError(null); }}
                    onKeyDown={e => { if (e.key === "Enter") handleAddField(); if (e.key === "Escape") setAddingField(false); }}
                    placeholder="field_name"
                    className="h-7 text-xs font-mono flex-1 min-w-0"
                  />
                  <select
                    value={newFieldType}
                    onChange={e => setNewFieldType(e.target.value)}
                    className="h-7 text-[11px] bg-muted border rounded px-1.5 outline-none focus:ring-1 focus:ring-ring shrink-0"
                  >
                    {["text","integer","bigint","numeric","real","boolean","date","timestamp","timestamptz","jsonb"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"
                    disabled={addLoading} onClick={handleAddField} title="Add (Enter)">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                    onClick={() => setAddingField(false)} title="Cancel (Esc)">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {addError && <p className="text-[10px] text-destructive">{addError}</p>}
              </div>
            ) : (
              <Button
                variant="ghost" size="sm"
                className="mt-2 h-7 px-2 text-xs text-muted-foreground gap-1.5 self-start shrink-0"
                onClick={() => { setAddingField(true); setAddError(null); setNewFieldName(""); setNewFieldType("text"); }}
              >
                <Plus className="h-3.5 w-3.5" />
                New field
              </Button>
            )}
          </TabsContent>

          {/* INDEXES */}
          <TabsContent value="indexes" className="flex-1 min-h-0 mt-0 px-5 pb-5">
            <ScrollArea className="h-full mt-3">
              {indexes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No indexes.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="text-left py-1.5 pr-3 font-medium">Name</th>
                      <th className="text-left py-1.5 pr-3 font-medium">Method</th>
                      <th className="text-left py-1.5 pr-3 font-medium">Columns</th>
                      <th className="text-left py-1.5 font-medium">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map((idx) => (
                      <tr key={idx.index_name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-3">{idx.index_name}</td>
                        <td className="py-1.5 pr-3 uppercase text-muted-foreground">{idx.access_method}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {(Array.isArray(idx.columns)
                            ? idx.columns
                            : String(idx.columns).replace(/^{|}$/g, "").split(",")
                          ).join(", ")}
                        </td>
                        <td className="py-1.5">
                          <div className="flex gap-1">
                            {idx.is_primary && (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px]">PK</Badge>
                            )}
                            {idx.is_unique && !idx.is_primary && (
                              <Badge variant="secondary" className="h-4 px-1 text-[9px]">UNIQUE</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </TabsContent>

          {/* TRIGGERS */}
          <TabsContent value="triggers" className="flex-1 min-h-0 mt-0 px-5 pb-5">
            <ScrollArea className="h-full mt-3">
              {triggers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No triggers.</p>
              ) : (
                <div className="space-y-3">
                  {triggers.map((trig) => (
                    <div key={trig.trigger_name} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{trig.trigger_name}</span>
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">{trig.timing} {trig.event}</Badge>
                      </div>
                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {trig.definition}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
