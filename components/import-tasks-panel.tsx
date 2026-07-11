"use client";
import React from "react";
import { useImportTasks, type ImportTask } from "@/lib/import-tasks-context";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, X, RotateCcw } from "lucide-react";

function fmt(n: number) { return n.toLocaleString(); }

function ProgressBar({ pct }: { pct: number | null }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-300"
        style={{ width: pct != null ? `${pct}%` : "30%", animation: pct == null ? "pulse 1.5s ease-in-out infinite" : undefined }}
      />
    </div>
  );
}

async function dropTable(connectionId: string, schema: string, table: string) {
  await fetch("/api/pg/drop-table", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId, schema, table }),
  });
}

function TaskRow({ task, onRefresh }: { task: ImportTask; onRefresh?: () => void }) {
  const { cancelTask, resumeTask, removeTask, updateTask } = useImportTasks();
  const pct = task.total > 0 ? Math.round((task.done / task.total) * 100) : null;
  const isActive = task.phase === "importing" || task.phase === "cancelling";

  async function handleDrop() {
    await dropTable(task.connectionId, task.schema, task.table);
    removeTask(task.id);
  }

  function handleKeep() {
    onRefresh?.();
    removeTask(task.id);
  }

  function handleResume() {
    updateTask(task.id, { phase: "importing", resumeOffset: undefined });
    resumeTask(task.id);
  }

  return (
    <div className="px-3 py-2.5 space-y-1.5">
      {/* Header row */}
      <div className="flex items-center gap-1.5 min-w-0">
        {task.phase === "importing" && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />}
        {task.phase === "cancelling" && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
        {task.phase === "done" && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
        {(task.phase === "cancelled" || task.phase === "interrupted") && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />}
        {task.phase === "error" && <XCircle className="h-3 w-3 shrink-0 text-destructive" />}

        <span className="text-xs font-medium truncate flex-1 min-w-0">{task.label}</span>
        <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-wide">{task.type === "arcgis" ? "ArcGIS" : "File"}</span>

        {/* Dismiss non-active tasks */}
        {!isActive && (
          <button onClick={() => removeTask(task.id)} className="shrink-0 text-muted-foreground hover:text-foreground ml-0.5">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Progress */}
      {isActive && (
        <>
          <ProgressBar pct={pct} />
          <p className="text-[10px] text-muted-foreground">
            {task.phase === "cancelling" ? "Cancelling…" : (
              task.total > 0
                ? `${fmt(task.done)} / ${fmt(task.total)} ${task.type === "arcgis" ? "features" : "rows"}${pct != null ? ` · ${pct}%` : ""}`
                : `${fmt(task.done)} ${task.type === "arcgis" ? "features" : "rows"}`
            )}
          </p>
        </>
      )}

      {/* Done */}
      {task.phase === "done" && (
        <p className="text-[10px] text-muted-foreground">
          {fmt(task.done)} {task.type === "arcgis" ? "features" : "rows"} → <span className="">{task.schema}.{task.table}</span>
        </p>
      )}

      {/* Cancelled */}
      {task.phase === "cancelled" && (
        <p className="text-[10px] text-muted-foreground">
          Cancelled at {fmt(task.done)}{task.total > 0 ? ` / ${fmt(task.total)}` : ""} {task.type === "arcgis" ? "features" : "rows"}
        </p>
      )}

      {/* Interrupted */}
      {task.phase === "interrupted" && (
        <p className="text-[10px] text-muted-foreground">
          Interrupted at {fmt(task.done)}{task.total > 0 ? ` / ${fmt(task.total)}` : ""} — connection lost.
        </p>
      )}

      {/* Error */}
      {task.phase === "error" && task.error && (
        <p className="text-[10px] text-destructive break-words">{task.error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 justify-end">
        {task.phase === "importing" && (
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
            onClick={() => cancelTask(task.id)}>
            Cancel
          </Button>
        )}
        {(task.phase === "cancelled" || task.phase === "interrupted" || (task.phase === "error" && !task.error?.toLowerCase().includes("already exists"))) && (
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDrop}>
            Drop table
          </Button>
        )}
        {task.phase === "cancelled" && (
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
            onClick={handleKeep}>
            Keep partial
          </Button>
        )}
        {task.phase === "interrupted" && (
          <>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={handleKeep}>
              Keep partial
            </Button>
            <Button size="sm" className="h-6 text-[11px] px-2 gap-1"
              onClick={handleResume}>
              <RotateCcw className="h-2.5 w-2.5" /> Resume
            </Button>
          </>
        )}
        {task.phase === "done" && (
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
            onClick={handleKeep}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImportTasksPanel({ onRefresh, connectionId }: { onRefresh?: () => void; connectionId?: string }) {
  const { tasks } = useImportTasks();
  const visible = connectionId ? tasks.filter((t) => t.connectionId === connectionId) : tasks;
  if (visible.length === 0) return null;

  return (
    <div className="border-b">
      <div className="px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Imports</span>
        <span className="text-[10px] text-muted-foreground">{visible.filter(t => t.phase === "importing" || t.phase === "cancelling").length > 0 ? "Running" : "Done"}</span>
      </div>
      <div className="divide-y">
        {visible.map((task) => (
          <TaskRow key={task.id} task={task} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}
